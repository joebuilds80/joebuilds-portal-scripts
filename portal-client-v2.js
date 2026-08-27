/* ============================================================================
   Joe Builds portal - signed session bridge
   portal-client-v2.js

   WHAT THIS DOES
   Signs the portal in to Supabase using the Memberstack session, then makes
   every existing Supabase call carry that signed identity - without editing
   any of the nine page scripts.

   It does that by wrapping window.fetch. Any request going to this Supabase
   project gets the signed bearer token attached. Requests to anywhere else are
   untouched and pass straight through.

   HOW TO INSTALL
   Webflow > Project Settings > Custom Code > Head, or the site-wide header
   embed. It must load AFTER the Memberstack script and the Supabase JS bundle,
   and BEFORE any page script.

       <script src="https://cdn.jsdelivr.net/gh/joebuilds80/joebuilds-portal-scripts@main/portal-client-v2.js"></script>

   NEW CODE SHOULD NOT RELY ON THE WRAPPER.
   When a page script is next revised, have it use the explicit API instead:

       const sb = await JBPortal.client();

   BEHAVIOUR
     - Token is held in memory only. Never written to localStorage or a cookie.
     - Refreshed five minutes before it expires. Concurrent calls share one
       exchange rather than racing.
     - No Memberstack session means no token is attached. The request still
       goes, and row-level security returns nothing. It never invents access.
     - The token exchange call itself is excluded from the wrapper.
   ========================================================================== */
(function (global) {
  'use strict';

  var SUPABASE_URL     = 'https://jsqyfiwkbuvuajwzbjhd.supabase.co';
  var PUBLISHABLE_KEY  = 'sb_publishable_xla-awjgU2npKzrWHdYKDQ_2ox0CWmC';
  var EXCHANGE_PATH    = '/functions/v1/memberstack-session';
  var EXCHANGE_URL     = SUPABASE_URL + EXCHANGE_PATH;
  var REFRESH_MARGIN   = 5 * 60 * 1000;

  var _token = null;
  var _expiresAt = 0;
  var _inFlight = null;
  var _client = null;
  var _lastError = null;

  var _nativeFetch = global.fetch.bind(global);

  function memberstack() {
    return global.$memberstackDom || global.$memberstack || global.MemberStack || null;
  }

  async function memberToken() {
    var ms = memberstack();
    if (ms && typeof ms.getMemberCookie === 'function') {
      try { var t = await ms.getMemberCookie(); if (t) return t; } catch (e) {}
    }
    var m = document.cookie.match(/_ms-mid=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function exchange() {
    var memberTok = await memberToken();
    if (!memberTok) { _lastError = 'not_signed_in'; return null; }

    // Uses the native fetch so the wrapper can never recurse into itself.
    var res = await _nativeFetch(EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: memberTok })
    });

    if (!res.ok) {
      _lastError = res.status === 503 ? 'auth_not_configured'
                 : res.status === 401 ? 'not_signed_in'
                 : 'exchange_failed_' + res.status;
      return null;
    }

    var body = await res.json();
    if (!body || !body.access_token) { _lastError = 'exchange_failed_empty'; return null; }

    _token = body.access_token;
    _expiresAt = Date.now() + (body.expires_in || 3600) * 1000;
    _client = null;
    _lastError = null;
    return _token;
  }

  function tokenIsFresh() {
    return _token && Date.now() < _expiresAt - REFRESH_MARGIN;
  }

  async function accessToken() {
    if (tokenIsFresh()) return _token;
    if (!_inFlight) _inFlight = exchange().finally(function () { _inFlight = null; });
    return _inFlight;
  }

  function urlOf(input) {
    if (typeof input === 'string') return input;
    if (input instanceof Request) return input.url;
    if (input && typeof input.toString === 'function') return input.toString();
    return '';
  }

  function isOurSupabase(url) {
    return url.indexOf(SUPABASE_URL) === 0 && url.indexOf(EXCHANGE_PATH) === -1;
  }

  // ---- the wrapper ---------------------------------------------------------
  global.fetch = async function (input, init) {
    var url = urlOf(input);

    if (!isOurSupabase(url)) return _nativeFetch(input, init);

    var token;
    try { token = await accessToken(); } catch (e) { token = null; }
    if (!token) return _nativeFetch(input, init);   // fail closed, never invent access

    if (input instanceof Request) {
      var req = new Request(input, init);
      req.headers.set('Authorization', 'Bearer ' + token);
      if (!req.headers.get('apikey')) req.headers.set('apikey', PUBLISHABLE_KEY);
      return _nativeFetch(req);
    }

    var opts = Object.assign({}, init);
    var headers = new Headers((init && init.headers) || {});
    headers.set('Authorization', 'Bearer ' + token);
    if (!headers.get('apikey')) headers.set('apikey', PUBLISHABLE_KEY);
    opts.headers = headers;
    return _nativeFetch(input, opts);
  };

  // ---- explicit API, for scripts as they get revised ------------------------
  async function client() {
    var token = await accessToken();
    if (!token) throw new Error(_lastError || 'not_signed_in');
    if (!_client) {
      if (!global.supabase || !global.supabase.createClient) throw new Error('supabase_js_not_loaded');
      _client = global.supabase.createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    }
    return _client;
  }

  async function memberId() {
    var t = await accessToken();
    if (!t) return null;
    try {
      var p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return p.user_id || p.sub || null;
    } catch (e) { return null; }
  }

  async function status() {
    var t = await accessToken();
    return {
      signedIn: !!t,
      memberId: t ? await memberId() : null,
      expiresInSeconds: t ? Math.max(0, Math.round((_expiresAt - Date.now()) / 1000)) : 0,
      lastError: _lastError
    };
  }

  global.JBPortal = {
    version: 'v2',
    client: client,
    memberId: memberId,
    status: status,
    refresh: function () { _token = null; _expiresAt = 0; return accessToken(); },
    signOutLocal: function () { _token = null; _expiresAt = 0; _client = null; }
  };

  // Warm the token immediately so the first page query does not wait on it.
  accessToken();
})(window);
