/* ============================================================================
   Joe Builds portal - shared Supabase client factory
   portal-client-v1.js

   One place where the portal signs in. Every page script uses this instead of
   creating its own anonymous client.

   Load AFTER the Memberstack script and the Supabase JS v2 bundle, and BEFORE
   any page script (dashboard, digital-twin, diagnostics, pathway, reports,
   properties, admin, profile-manager).

   Usage in a page script:

       const sb = await JBPortal.client();      // throws if not signed in
       const { data, error } = await sb.from('rooms').select('*');

   Or, to guard a whole page:

       JBPortal.requireSession().then(sb => { ...render... });

   Behaviour:
     - Exchanges the Memberstack member token for a short-lived Supabase JWT
       via the memberstack-session edge function.
     - Caches the token in memory only. Never written to localStorage.
     - Refreshes 5 minutes before expiry.
     - Fails closed. No session means no client and a redirect to /login.
   ========================================================================== */
(function (global) {
  'use strict';

  var SUPABASE_URL = 'https://jsqyfiwkbuvuajwzbjhd.supabase.co';
  var PUBLISHABLE_KEY = 'sb_publishable_xla-awjgU2npKzrWHdYKDQ_2ox0CWmC';
  var EXCHANGE_URL = SUPABASE_URL + '/functions/v1/memberstack-session';
  var LOGIN_PATH = '/login';
  var REFRESH_MARGIN_MS = 5 * 60 * 1000;

  // In-memory only. Deliberately not persisted.
  var _accessToken = null;
  var _expiresAt = 0;
  var _client = null;
  var _inFlight = null;

  function memberstack() {
    return global.$memberstackDom || global.$memberstack || global.MemberStack || null;
  }

  async function memberToken() {
    var ms = memberstack();
    if (ms && typeof ms.getMemberCookie === 'function') {
      try {
        var t = await ms.getMemberCookie();
        if (t) return t;
      } catch (e) { /* fall through */ }
    }
    var m = document.cookie.match(/_ms-mid=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function exchange() {
    var token = await memberToken();
    if (!token) throw new Error('not_signed_in');

    var res = await fetch(EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token })
    });

    if (res.status === 401) throw new Error('not_signed_in');
    if (res.status === 503) throw new Error('auth_not_configured');
    if (!res.ok) throw new Error('exchange_failed_' + res.status);

    var body = await res.json();
    if (!body || !body.access_token) throw new Error('exchange_failed_empty');

    _accessToken = body.access_token;
    _expiresAt = Date.now() + (body.expires_in || 3600) * 1000;
    _client = null;              // rebuild with the new bearer
    return _accessToken;
  }

  async function accessToken() {
    if (_accessToken && Date.now() < _expiresAt - REFRESH_MARGIN_MS) {
      return _accessToken;
    }
    if (!_inFlight) {
      _inFlight = exchange().finally(function () { _inFlight = null; });
    }
    return _inFlight;
  }

  async function client() {
    var token = await accessToken();
    if (!_client) {
      if (!global.supabase || !global.supabase.createClient) {
        throw new Error('supabase_js_not_loaded');
      }
      _client = global.supabase.createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
        global: { headers: { Authorization: 'Bearer ' + token } },
        auth: { persistSession: false, autoRefreshToken: false }
      });
    }
    return _client;
  }

  // Guard a page. Redirects to sign-in on any failure rather than rendering
  // an empty shell that looks like the client has no data.
  async function requireSession(opts) {
    opts = opts || {};
    try {
      return await client();
    } catch (err) {
      if (opts.onFailure) { opts.onFailure(err); return null; }
      if (err && err.message === 'auth_not_configured') {
        console.error('[JBPortal] Authentication is not configured on the server.');
        return null;
      }
      var next = encodeURIComponent(location.pathname + location.search);
      location.replace(LOGIN_PATH + '?next=' + next);
      return null;
    }
  }

  function signOutLocal() {
    _accessToken = null;
    _expiresAt = 0;
    _client = null;
  }

  // Returns the signed-in Memberstack id, or null. Useful for UI, never for
  // access control - the database decides what this member may read.
  async function memberId() {
    try {
      var t = await accessToken();
      var payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.user_id || payload.sub || null;
    } catch (e) { return null; }
  }

  global.JBPortal = {
    client: client,
    requireSession: requireSession,
    memberId: memberId,
    signOutLocal: signOutLocal,
    SUPABASE_URL: SUPABASE_URL
  };
})(window);
