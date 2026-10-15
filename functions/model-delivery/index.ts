// model-delivery v1 (Home State core V5.4, 16 Oct 2026, Mac)
// The only route by which a client's browser receives a private 3D model page.
// Pattern: report-delivery v1.2 (same CORS allow-list, same "authorise as the caller, prove the bytes, no URL" rule).
//
// - verify_jwt FALSE, as report-delivery: the caller's token is still verified, because the authorisation read
//   below is made AS THE CALLER through PostgREST, which rejects any token not signed by a current key.
// - The caller supplies ONLY a twin_models id. Bucket, path and hash are never read from the request.
// - Authorisation: SELECT on twin_models AS THE CALLER. RLS twin_client_read = can_access_building(building_id),
//   twin_staff_all = is_staff(). No row, no model.
// - model_url must be  private:property_assets/<building_id>/models/<file>.html#sha256=<64 hex>
//   and the path must sit under that row's own building_id. Anything else is refused.
// - Bytes are fetched with the service role and hashed. A mismatch is refused. Nothing is streamed until proven.
// - No signed URL is created or returned. No caching. Every denial is the same generic 404.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://portal.joebuilds.com.au",
  "https://joe-builds-membership-site.webflow.io",
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PRIVATE_RE = /^private:property_assets\/([0-9a-f-]{36})\/models\/([a-z0-9][a-z0-9._-]*\.html)#sha256=([0-9a-f]{64})$/;
const MAX_BYTES = 40 * 1024 * 1024;

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function denied(origin: string | null): Response {
  return new Response(JSON.stringify({ error: "not_available" }), {
    status: 404,
    headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store, private" },
  });
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return denied(origin);

  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return denied(origin);

  let twinId = "";
  try {
    const body = await req.json();
    twinId = typeof body?.twin_id === "string" ? body.twin_id.toLowerCase() : "";
  } catch {
    return denied(origin);
  }
  if (!UUID_RE.test(twinId)) return denied(origin);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return denied(origin); // fail closed

  // 1. Authorise AS THE CALLER under RLS.
  const asCaller = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: rows, error } = await asCaller.from("twin_models").select("id, building_id, model_url").eq("id", twinId).limit(2);
  if (error || !Array.isArray(rows) || rows.length !== 1) return denied(origin);
  const row = rows[0] as { id: string; building_id: string; model_url: string };
  const m = PRIVATE_RE.exec(String(row.model_url || ""));
  if (!m || m[1] !== String(row.building_id).toLowerCase()) return denied(origin);
  const path = `${m[1]}/models/${m[2]}`;
  const wantHash = m[3];

  // 2. Fetch and prove the bytes with the service role.
  const svc = createClient(url, service, { auth: { persistSession: false } });
  const { data: blob, error: dlErr } = await svc.storage.from("property_assets").download(path);
  if (dlErr || !blob) return denied(origin);
  const bytes = await blob.arrayBuffer();
  if (!(bytes.byteLength > 0) || bytes.byteLength > MAX_BYTES) return denied(origin);
  if ((await sha256Hex(bytes)) !== wantHash) return denied(origin);

  // 3. Send it. No URL, no cache. The portal loads it as a blob in a sandboxed frame (scripts only, no same-origin).
  return new Response(bytes, {
    status: 200,
    headers: {
      ...cors(origin),
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store, private",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
});
