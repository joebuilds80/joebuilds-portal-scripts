/* Joe Builds — Emma funnel tracking V1
 * Browser-side measurement only. No names, email addresses, phone numbers or message text are sent.
 * GA4/dataLayer = behavioural analytics. Supabase site_events = auditable anonymous event record.
 */
(function () {
  "use strict";

  var ENDPOINT = "https://jsqyfiwkbuvuajwzbjhd.supabase.co/functions/v1/site-event";
  var SCHEMA = "emma-funnel-v1";
  var VISITOR_KEY = "jb_visitor_id_v1";
  var SESSION_KEY = "jb_session_id_v1";
  var ATTR_KEY = "jb_attr_v1";
  var fired = {};

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "jb-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function getStored(storage, key, make) {
    try {
      var v = storage.getItem(key);
      if (v) return v;
      v = make();
      storage.setItem(key, v);
      return v;
    } catch (_) {
      return make();
    }
  }

  var visitorId = getStored(localStorage, VISITOR_KEY, uuid);
  var sessionId = getStored(sessionStorage, SESSION_KEY, uuid);

  function captureAttribution() {
    var held = {};
    try { held = JSON.parse(sessionStorage.getItem(ATTR_KEY) || "{}"); } catch (_) {}
    var q = new URLSearchParams(location.search);
    [
      "utm_source","utm_medium","utm_campaign","utm_content","utm_term",
      "gclid","gbraid","wbraid","fbclid","msclkid","src"
    ].forEach(function (k) {
      if (!held[k] && q.get(k)) held[k] = q.get(k);
    });
    if (!held.landing_page) held.landing_page = location.pathname;
    if (!held.referrer && document.referrer && document.referrer.indexOf(location.hostname) === -1) {
      held.referrer = document.referrer;
    }
    try { sessionStorage.setItem(ATTR_KEY, JSON.stringify(held)); } catch (_) {}
    return held;
  }

  var attr = captureAttribution();\n  var isTest = new URLSearchParams(location.search).get("jb_test") === "1";

  function ga(name, extra) {
    var p = Object.assign({
      event_category: "emma_funnel",
      page_path: location.pathname,
      landing_page: attr.landing_page || location.pathname,
      traffic_source: attr.utm_source || "",
      traffic_medium: attr.utm_medium || "",
      traffic_campaign: attr.utm_campaign || ""
    }, extra || {});
    try {
      if (typeof window.gtag === "function") window.gtag("event", name, p);
    } catch (_) {}
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: name }, p));
    } catch (_) {}
  }

  function record(name, extra, oncePerSession) {
    var key = oncePerSession === false ? name + ":" + Date.now() : name;
    if (oncePerSession !== false && fired[key]) return;
    fired[key] = true;

    var payload = Object.assign({
      schema_version: SCHEMA,
      event_name: name,
      occurred_at: new Date().toISOString(),
      visitor_id: visitorId,
      session_id: sessionId,
      page_path: location.pathname,
      landing_page: attr.landing_page || location.pathname,
      referrer: attr.referrer || "",
      utm_source: attr.utm_source || "",
      utm_medium: attr.utm_medium || "",
      utm_campaign: attr.utm_campaign || "",
      utm_content: attr.utm_content || "",
      utm_term: attr.utm_term || "",
      click_id_present: !!(attr.gclid || attr.gbraid || attr.wbraid || attr.fbclid || attr.msclkid),\n      is_test: isTest
    }, extra || {});

    ga(name, {
      emma_mode: payload.mode || "",
      event_stage: payload.stage || ""
    });

    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: "omit"
      }).catch(function () {});
    } catch (_) {}
  }

  function configureWidget(widget) {
    if (!widget || widget.dataset.jbFunnelBound === "1") return;
    widget.dataset.jbFunnelBound = "1";

    // Widget exposure: counted only when at least 25% visible.
    try {
      var seenTimer = null;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio >= 0.25 && !fired.emma_widget_impression) {
            clearTimeout(seenTimer);
            seenTimer = setTimeout(function () {
              record("emma_widget_impression", { stage: "seen" }, true);
              io.disconnect();
            }, 500);
          } else {
            clearTimeout(seenTimer);
          }
        });
      }, { threshold: [0.25] });
      io.observe(widget);
    } catch (_) {}

    // First interaction with the widget = open/engage intent.
    widget.addEventListener("pointerdown", function () {
      record("emma_open", { stage: "opened" }, true);
    }, true);

    // Official ElevenLabs widget lifecycle event. This fires when a conversation session is initiated.
    widget.addEventListener("elevenlabs-convai:call", function (event) {
      record("emma_conversation_start", {
        stage: "conversation_started",
        mode: "widget"
      }, true);

      // Give ElevenLabs a stable anonymous browser ID so completed conversations can be
      // joined back to the same anonymous visitor in Supabase. No personal data is used.
      try {
        if (event.detail && event.detail.config) {
          if (!event.detail.config.userId) event.detail.config.userId = visitorId;
          event.detail.config.dynamicVariables = Object.assign(
            {},
            event.detail.config.dynamicVariables || {},
            {
              jb_visitor_id: visitorId,
              jb_session_id: sessionId,
              jb_landing_page: attr.landing_page || location.pathname,
              jb_page_path: location.pathname,
              jb_utm_source: attr.utm_source || "",
              jb_utm_medium: attr.utm_medium || "",
              jb_utm_campaign: attr.utm_campaign || ""
            }
          );
        }
      } catch (_) {}
    });
  }

  function findWidgets() {
    document.querySelectorAll("elevenlabs-convai").forEach(configureWidget);
  }

  // Track explicit links/buttons that invite a user to speak to Emma.
  document.addEventListener("click", function (event) {
    var el = event.target && event.target.closest ? event.target.closest("a,button") : null;
    if (!el) return;
    var label = ((el.textContent || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
    if (label.indexOf("emma") !== -1 || el.hasAttribute("data-jb-emma-open")) {
      record("emma_open", { stage: "opened", trigger: "page_cta" }, true);
    }
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", findWidgets);
  } else {
    findWidgets();
  }

  new MutationObserver(findWidgets).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();