// Supabase Edge Function: site-event
// Joe Builds — Emma funnel V1
// Public browser receiver for anonymous behaviour events only.
// IMPORTANT: this function never creates a lead and never accepts contact details.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.joebuilds.com.au",
  "https://joebuilds.com.au"
]);

const allowedEvents = new Set([
  "emma_widget_impression",
  "emma_open",
  "emma_conversation_start"
]);

const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin && allowedOrigins.has(origin) ? origin : "https://www.joebuilds.com.au",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "vary": "Origin"
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: cors(origin) });
  }

  if (!origin || !allowedOrigins.has(origin)) {
    return new Response("origin not allowed", { status: 403, headers: cors(origin) });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400, headers: cors(origin) });
  }

  const eventName = String(body.event_name || "");
  const visitorId = String(body.visitor_id || "");
  const sessionId = String(body.session_id || "");

  if (!allowedEvents.has(eventName)) {
    return new Response("event not allowed", { status: 400, headers: cors(origin) });
  }
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(visitorId) || !/^[A-Za-z0-9_-]{8,100}$/.test(sessionId)) {
    return new Response("invalid identifiers", { status: 400, headers: cors(origin) });
  }

  const occurredAt = typeof body.occurred_at === "string" ? body.occurred_at : new Date().toISOString();
  const pagePath = String(body.page_path || "").slice(0, 500);
  const dedupe = [eventName, sessionId].join(":");

  const row = {
    occurred_at: occurredAt,
    schema_version: "emma-funnel-v1",
    event_name: eventName,
    visitor_id: visitorId,
    session_id: sessionId,
    page_path: pagePath,
    landing_page: String(body.landing_page || "").slice(0, 500),
    referrer: String(body.referrer || "").slice(0, 1000),
    utm_source: String(body.utm_source || "").slice(0, 200),
    utm_medium: String(body.utm_medium || "").slice(0, 200),
    utm_campaign: String(body.utm_campaign || "").slice(0, 300),
    utm_content: String(body.utm_content || "").slice(0, 300),
    utm_term: String(body.utm_term || "").slice(0, 300),
    click_id_present: Boolean(body.click_id_present),
    mode: String(body.mode || "").slice(0, 50),
    stage: String(body.stage || "").slice(0, 50),
    origin: "website",
    event_dedupe_key: dedupe,
    metadata: {}
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { error } = await supabase
    .from("site_events")
    .upsert(row, { onConflict: "event_dedupe_key", ignoreDuplicates: true });

  if (error) {
    console.error("site-event insert failed", error.message);
    return new Response("storage error", { status: 500, headers: cors(origin) });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: Object.assign({ "content-type": "application/json" }, cors(origin))
  });
});