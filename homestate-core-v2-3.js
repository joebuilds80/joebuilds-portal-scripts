/* ============================================================================
   HOME STATE - PORTAL CORE V2
   homestate-core-v2.js  (V2.0, 2026-09-24, built by Mac)

   Implements the approved Home State Experience V2.1 inside the existing portal
   architecture (Joe unfreeze, 24 Sep): same five pages, same sign-in, same
   signed session bridge, same Row Level Security, same tables. No schema,
   access-model or credential change. Read-only against the record.

   Built on core V1.6 (fe8aede). Adds, to Foundation Pack V1.3 and corrected V2.1:
     V2-1  Ruled palette (Decision Log 24 Sep 12.53pm): Axe V2.1 warm, gradient
           Home State wordmark. Injected here so one pinned file carries it.
     V2-2  Every displayed reading shows value, unit and method (ruling 7), with
           the mapped location code.
     V2-3  Records gains Compare (same mapped location, two visits, side by side)
           and Evidence (first-class, ruling 10). Compare shows values only: no
           difference, no verdict. Pairing basis follows the ruled rules only:
           same location, method and unit are required; a different season is
           Context only (ruling 6). No tolerance exists, so none is applied.
     V2-4  Assessment conditions shown side by side with their source.
     V2-5  Dashboard: record at a glance, next useful action, and the record's
           chapters as a timeline. The priority card now reads open findings
           itself (replaces the footer FIX v3 logic; FIX v3 stays harmless).
     V2-6  Nothing measured is hidden; nothing not measured is implied.
   Rollback: re-pin the site footer to homestate-core-v1.js@58ee7ea.

   V2.1 (2026-09-24, Mac): corrections from Axe's independent source-level
   re-sweep of V2.0 (c0ccd7e). No schema, access-model or credential change.
     A-1  An unknown or empty reading, room or finding status never falls through
          to "Further investigation required". It shows a neutral "No status
          shown", and a finding with an unmapped status stops the priority card
          from claiming none are open.
     A-2  Canonical unit and method adapters. Legacy "degrees C", "percent RH",
          "comparative" and newer "degC", "%RH", "REL" resolve to one key each
          before dashboard grouping or Compare identity checks. The method key is
          method_code when present, else reading_method. Two methods are never
          treated as the same method unless their key is identical; no method
          equivalence is ruled, so none is assumed.
     A-3  Compare keeps every reading: rows are keyed by mapped location, method
          and unit. Where a visit holds more than one reading on a key, the latest
          by measured_at (then id) is shown, with the count and time stated.
     A-4  Evidence items with a stored file open in a private viewer: the bytes
          are read through the existing storage policy as the signed-in member
          and shown from a temporary in-page object that is revoked on close.
          Reports that are published open through the existing report-delivery
          function (authorise, audit, prove bytes). No durable or public URL and
          no signed URL is created. Items without a stored file say so.
     A-5  "Recorded on site" renamed "Visit conditions and context".
     A-6  Latest visit and the history timeline use visit and report dates.
          diagnostic_events has no occurrence date, so its created_at is shown
          only as "logged", as administrative provenance.
     A-7  The close control uses an HTML entity. The file is now ASCII only, so
          no character can be mis-decoded (the visible "A-tilde" defect).
     A-8  The farm model stays labelled and non-default (unchanged).

   V2.2 (2026-09-24, Mac): completes the V2.1 screen set inside the existing five
   pages (no new Webflow page, so no Memberstack gating change). Records gains
   three tabs:
     History       Journey: every visit and released report as a dated chapter,
                   with what was recorded at each; the record log apart.
     Record depth  Layers, derived per foundation pack section 8 from fields that
                   exist: Available (readings exist), Limited / unavailable (a
                   recorded access status or reading status, reason always
                   shown), Not yet measured (a layer that applies to every home,
                   with no reading yet), Future (air movement, not yet offered).
                   Scheduled and Not applicable need data the record does not
                   hold yet, so they are never inferred. Subfloor and roof space
                   are listed only where the record holds that space.
     Context       Property climate context is not held on the record yet and is
                   said so. Visit conditions are listed per visit, as recorded.
   The dashboard gains a record depth summary linking to the tab. Tabs scroll
   sideways on a phone instead of wrapping.

   V2.3 (2026-09-25, Mac): more than one property, and the matched model.
     Property picker  When a member can see more than one property, the header
                      shows a picker. The choice is kept for the browser tab
                      (sessionStorage, cleared on sign out) and can be set with
                      ?p=CODE. With one property nothing changes. Default stays
                      the first DEMO- record by code, as V1.6.
     Matched model    When the property's twin_models row points at a model page
                      on the portal's own GitHub Pages, the Home Map opens on that
                      model (sandbox allow-scripts only, as before). Selecting a
                      room or a mapped location in the model opens the record's
                      own readings for it, found by point code. A property whose
                      model is not matched keeps the plan default and the labelled
                      farm model, exactly as before (DEMO-001).
     Empty status     A reading or room with no recorded status shows no status
                      chip. An unknown, non-empty status still shows "No status
                      shown" (A-1).
   ========================================================================== */
/* ============================================================================
   HOME STATE - LIGHT INTERFACE CORE
   homestate-core-v1.js  (V1, 2026-08-29, built by Mac)

   Replaces: dashboard-v31.js, digital-twin-v24.js, diagnostics-v33.js,
             pathway-v12.js, reports-v16.js (rendering + data mapping).
   Keeps:    portal-client-v2.js @3abfee5 (signed session bridge) untouched.
             profile-manager-v42.js retired from client pages; the shell below
             renders nav + identity itself.

   Implements defect corrections D-1 to D-12 from
   "01 DEFECT CORRECTION MAP - D-1 to D-14 (2026-08-28)":
     D-1  no `Stable` anywhere; badges map only from seeded status values
     D-2  pathway counts read `complete/available/locked` as seeded
     D-3  history reads diagnostic_events (7), newest first, en-AU dates in
          Australia/Sydney (fixes the one-day error)
     D-4  metric groups derive from unit + element_code; envelope/U-value
          cards retired; no invented fields
     D-5  persistent demonstration strip on every screen, keyed DEMO- only
     D-6  home map plan generated from rooms.map_x/map_y (Option 1 - the
          drawn plan artwork is retired; the plan on screen IS the record)
     D-7  room reading state + access state as two chips
     D-8  no CLIMATE field anywhere; climate_zone never read
     D-9  records grouped by room; "Recorded readings"; no air tightness
     D-10 four phases from upgrade_scenarios; `Opens later`, never `Locked`
     D-11 report_date rendered, `Comparison check` wording, honest empty state
     D-12 building status is displayed from buildings.status (admin sets the
          real status row; the disclosure lives in address_line_1 + the strip)

   Data contract (unchanged): Supabase tables buildings, rooms,
   measurement_points, measurements, upgrade_scenarios, diagnostic_events,
   reports, assessment_sessions. RLS enforced by the signed bridge.

   CONFIG: this file reads window.JB_SUPABASE_URL and window.JB_SUPABASE_ANON
   which Joe sets in the site-wide footer embed (copied from the previous
   script by Joe - credentials never travel through the production pack).

   V1.6 (2026-08-29): two findings from the acceptance controller run.
   F-07-A: the building was picked as `bs[0]` with no ordering. Harmless for a
   client, who sees one row, but a staff member sees several and a walkthrough
   could have opened on a real property. Now ordered by building_code with the
   DEMO- record preferred when more than one is visible.
   F-07-D: the dashboard said "7 mapped locations" while the Home Map said
   "33 mapped locations" for the same record - both true, different scopes,
   but a prospect sees both within seconds. The dashboard figure now reads
   "N locations recorded for this measurement", which is what it counts.
   Not a claim change - a scope that was missing from the sentence.

   V1.5 (2026-08-29): dashboard omits metric groups this home has no readings
   in. The g/kg group added in V1.3 was rendering an empty "Moisture in the
   air" card on DEMO-001, because those 8 readings belong to H-0002, not to
   the demonstration home. Correcting the V1.3 note: DEMO-001's 66 readings
   were always fully accounted for - 12 comparative, 30 degrees C, 16 percent
   RH, 8 ppm - and nothing was being dropped from it. Records still reports
   an empty group honestly; the dashboard summary does not pad.

   V1.4 (2026-08-29): reports screen now renders only rows flagged
   `client_visible`. Row Level Security already withholds them from a client,
   but a staff member demonstrating the portal is granted every row, so an
   operator-notes record was visible during a walkthrough. Defence in depth -
   the interface applies the same rule the policy does.

   V1.3 (2026-08-29): LIVE SCHEMA ADAPTERS. The live tables name columns
   differently from the build seed - rooms.room_name_current, upgrade_scenarios
   .title, no buildings.building_name at all - and access_status casing is
   inconsistent in the data. Every read now uses the real column with a
   fallback, and comparisons are lowercased. Added a g/kg group so
   absolute-humidity readings have somewhere to land. See V1.5 above for the
   correction to what that group was originally claimed to fix.

   V1.2 (2026-08-29): SELF-BUILDING SHELL. If a page does not already carry
   [data-hs-screen] markup, the core now builds the whole screen itself from
   location.pathname. This removes the five Webflow Designer embeds entirely -
   Joe touches the head and footer boxes only. Existing page content is HIDDEN,
   not deleted, so removing the footer script line restores the old front end
   exactly. Known consequence, stated plainly: the Webflow Designer no longer
   reflects what a visitor sees on these five pages.

   V1.1 (2026-08-29): 3D model view restored on the Home Map, to Joe's ruling
   of 29 Aug. The previous mount lived in the site footer and was lost when
   the footer was replaced; it now lives here, so there is one pinned file and
   no loose glue. See HS_MODEL below - and read the provenance note there
   before the model is shown to a prospect.
   ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     3D MODEL CONFIG

     PROVENANCE NOTE - READ BEFORE A WALKTHROUGH.
     This model file is `farm-home-model-v5-2.html`. Its own on-screen text
     describes a recorded set of 46 walls and 310+ readings. The DEMO-001
     demonstration record holds 33 mapped locations and 66 readings across
     9 rooms. Those are two different properties and two different counts.
     Showing both on one demonstration puts contradictory figures in front of
     the same prospect, so the plan generated from the DEMO-001 record is the
     default view and the model sits behind a labelled toggle.
     Joe rules whether a matched demonstration model is produced, or the farm
     model stays as an illustration of the modelling capability.
     Flip DEFAULT_VIEW to 'model' only after that ruling.
     -------------------------------------------------------------------------- */
  const HS_MODEL = {
    url: 'https://joebuilds80.github.io/joebuilds-portal-scripts/farm-home-model-v5-2.html',
    label: 'Modelling example from a different recorded property. The readings and counts shown inside the model belong to that property, not to this demonstration record.',
    DEFAULT_VIEW: 'plan'
  };

  /* ---------- 0. Config + client ---------- */
  const URLBASE = window.JB_SUPABASE_URL;
  const ANON = window.JB_SUPABASE_ANON;
  if (!URLBASE || !ANON) { console.error('[HS] missing JB_SUPABASE_URL / JB_SUPABASE_ANON'); return; }
  if (!window.supabase || !window.supabase.createClient) { console.error('[HS] supabase-js not loaded'); return; }
  const sb = window.supabase.createClient(URLBASE, ANON);

  /* ---------- 0b. Self-building shell (V1.2) ----------
     Path -> screen. Only these five paths are ever touched. Anything else on
     the site is left completely alone. */
  const PATH_SCREEN = {
    '/dashboard':    'dashboard',
    '/digital-twin': 'home-map',
    '/diagnostics':  'records',
    '/pathway':      'pathway',
    '/reports':      'reports'
  };

  const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 0 620 180" role="img" aria-label="Home State by Joe Builds">' +
    '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M72 16A62 62 0 0 1 134 78M134 87A62 62 0 0 1 74 148" stroke="#1c3026" stroke-width="2.4"/>' +
    '<path d="M64 148A62 62 0 0 1 12 88M13 76A62 62 0 0 1 63 17" stroke="#ab5948" stroke-width="2.4"/>' +
    '<path d="M73 4V36M73 148v28M0 82h32M135 82h28" stroke="#9d8856" stroke-width="1.6"/>' +
    '<circle cx="73" cy="4" r="5.8" stroke="#ab5948" stroke-width="2"/><circle cx="73" cy="176" r="5.8" stroke="#ab5948" stroke-width="2"/>' +
    '<circle cx="0" cy="82" r="5.8" stroke="#ab5948" stroke-width="2"/><circle cx="163" cy="82" r="5.8" stroke="#ab5948" stroke-width="2"/>' +
    '<path d="M46 111V61l29-24v74M75 55l34-17v72M75 55l34 27v34" stroke="#1c3026" stroke-width="4"/>' +
    '<path d="M75 55l34-17v72M75 55l34 27" stroke="#ab5948" stroke-width="3"/>' +
    '<path d="M24 108c17-8 31 7 49 0 18-7 33 7 54 0M23 116c18-8 32 7 50 0 18-7 33 7 54 0M25 124c17-7 30 7 48 0 18-7 34 7 52 0M30 132c15-6 28 6 43 0 18-7 32 6 47 1" stroke="#9d8856" stroke-width="1.2"/>' +
    '<circle cx="73" cy="82" r="4.5" fill="#ab5948" stroke="none"/></g>' +
    '<defs><linearGradient id="hsWordGrad" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#7a3de2"/><stop offset=".45" stop-color="#b942a2"/><stop offset=".7" stop-color="#d94482"/><stop offset="1" stop-color="#f36f57"/></linearGradient></defs><g fill="url(#hsWordGrad)"><text x="205" y="96" font-family=\'Arial, "Liberation Sans", Helvetica, sans-serif\' font-size="46" font-weight="400" letter-spacing="12">HOME STATE</text>' +
    '<text x="208" y="128" font-family=\'Arial, "Liberation Sans", Helvetica, sans-serif\' font-size="14" font-weight="600" letter-spacing="4.2" fill="#ab5948">BY JOE BUILDS</text></g></svg>';

  const NAV_ITEMS = [
    ['/dashboard', 'Dashboard', 'dashboard'],
    ['/digital-twin', 'Home Map', 'home-map'],
    ['/diagnostics', 'Records', 'records'],
    ['/pathway', 'Pathway', 'pathway'],
    ['/reports', 'Reports', 'reports']
  ];

  const MAIN_BODY = {
    dashboard:
      '<header id="hsHero"></header>' +
      '<div class="hs-grid" id="hsMetricGrid"></div>' +
      '<div class="hs-grid"><article class="hs-card" id="hsPathwayCard"></article>' +
      '<article class="hs-card" id="hsPriorityCard"></article></div>' +
      '<article class="hs-card" id="hsHistoryCard"></article>',
    'home-map':
      '<header id="hsHero"></header>' +
      '<p class="hs-metric-desc" id="hsMapCount"></p>' +
      '<div class="hs-view-switch" id="hsViewSwitch" role="group" aria-label="Home Map view">' +
      '<button type="button" class="hs-view-btn hs-view-on" data-hs-view="plan" aria-pressed="true">Measured plan</button>' +
      '<button type="button" class="hs-view-btn" data-hs-view="model" aria-pressed="false">3D model</button></div>' +
      '<div class="hs-map-stage" id="hsPlanStage"><div id="hsMap"></div></div>' +
      '<div class="hs-model-stage" id="hsModelStage" hidden></div>' +
      '<aside id="hsRoomPanel" hidden></aside>',
    records:  '<header id="hsHero"></header><div id="hsRecords"></div>',
    pathway:  '<header id="hsHero"></header><div id="hsPathway"></div>',
    reports:  '<header id="hsHero"></header><div id="hsReports"></div>'
  };

  const V2CSS = '\n:root{--hs-canvas:#f5eee4;--hs-card:#fffaf3;--hs-card-warm:#faf3e8;--hs-ink:#3d463d;--hs-ink-soft:#5d665d;--hs-clay:#cc7e4b;--hs-gold:#a07a52;--hs-line:#e6dccb}\n.hs-nav{background:var(--hs-card)}\n.hs-nav a.hs-active{background:var(--hs-ink);color:var(--hs-card)}\n.hs-card{border-radius:16px}\n.hs-tabs{display:inline-flex;gap:4px;padding:4px;margin:6px 0 16px;background:var(--hs-card-warm);border:1px solid var(--hs-line);border-radius:999px}\n.hs-tab{border:0;background:none;font:inherit;font-size:13px;font-weight:600;color:var(--hs-ink-soft);padding:7px 16px;border-radius:999px;cursor:pointer}\n.hs-tab.hs-tab-on{background:var(--hs-ink);color:var(--hs-card)}\n.hs-tab:focus-visible,.hs-select:focus-visible{outline:3px solid var(--hs-clay);outline-offset:2px}\n.hs-glance{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px}\n.hs-glance div{background:var(--hs-card);border:1px solid var(--hs-line);border-radius:14px;padding:14px 16px}\n.hs-glance small{display:block;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--hs-gold);font-weight:700}\n.hs-glance b{display:block;font-size:26px;margin-top:4px;color:var(--hs-ink);font-variant-numeric:tabular-nums}\n.hs-next{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}\n.hs-btn{display:inline-block;border:0;border-radius:999px;background:var(--hs-ink);color:var(--hs-card);padding:10px 18px;font:inherit;font-size:13.5px;font-weight:700;text-decoration:none;cursor:pointer}\n.hs-timeline{list-style:none;margin:14px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}\n.hs-timeline li{border:1px solid var(--hs-line);border-radius:12px;padding:10px 12px;background:var(--hs-card-warm);font-size:12.5px;color:var(--hs-ink-soft)}\n.hs-timeline li b{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--hs-gold);margin-bottom:4px}\n.hs-cmp-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px}\n.hs-cmp-controls label{display:flex;flex-direction:column;gap:4px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--hs-gold);font-weight:700}\n.hs-select{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--hs-line);border-radius:10px;background:var(--hs-card);color:var(--hs-ink);min-width:220px;max-width:100%}\n.hs-basis{border-left:4px solid var(--hs-gold);background:var(--hs-card-warm);padding:12px 14px;border-radius:10px;margin-bottom:14px}\n.hs-basis strong{display:block;font-size:15px;color:var(--hs-ink);margin-bottom:4px}\n.hs-cond{display:grid;grid-template-columns:minmax(120px,1fr) 2fr 2fr;gap:0;border:1px solid var(--hs-line);border-radius:12px;overflow:hidden;margin-bottom:16px;font-size:13px}\n.hs-cond>div{padding:8px 12px;border-bottom:1px solid var(--hs-line);color:var(--hs-ink-soft)}\n.hs-cond>.hs-cond-h{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--hs-gold);font-weight:700;background:var(--hs-card-warm)}\n.hs-cond>.hs-cond-k{font-weight:700;color:var(--hs-ink)}\n.hs-scroll{overflow-x:auto}\n.hs-code{font:600 11.5px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--hs-ink-soft)}\n.hs-ev-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}\n.hs-ev-thumb{height:92px;border-radius:10px;background:linear-gradient(135deg,#e4e9e0,#efd4c0);display:grid;place-items:center;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--hs-ink-soft);font-weight:700;margin-bottom:10px}\n.hs-tabs{display:flex;max-width:100%;overflow-x:auto;scrollbar-width:thin}\n.hs-tab{flex:0 0 auto;white-space:nowrap}\n.hs-journey{list-style:none;margin:10px 0 0;padding:0;border-left:3px solid var(--hs-line)}\n.hs-journey li{position:relative;padding:0 0 14px 18px}\n.hs-journey li:before{content:"";position:absolute;left:-8px;top:6px;width:13px;height:13px;border-radius:50%;background:var(--hs-clay)}\n.hs-journey-date{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--hs-gold);font-weight:700;margin-bottom:6px}\n.hs-journey-kind{display:block;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--hs-ink-soft);font-weight:700}\n.hs-depth{display:grid;gap:8px}\n.hs-depth-row{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--hs-card);border:1px solid var(--hs-line);border-radius:12px;padding:10px 14px}\n.hs-depth-row p{margin:2px 0 0}\n.hs-picker{display:flex;align-items:center;gap:10px;margin:12px 0 16px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--hs-gold);font-weight:700}\n.hs-log{margin-top:12px;font-size:12.5px;color:var(--hs-ink-soft)}\n.hs-log summary{cursor:pointer;font-weight:700}\n.hs-log ul{margin:8px 0 0;padding-left:18px}\n.hs-viewer{position:fixed;inset:0;background:rgba(40,44,40,.55);display:grid;place-items:center;z-index:9999;padding:16px}\n.hs-viewer-box{background:var(--hs-card);border-radius:16px;max-width:900px;width:100%;max-height:90vh;overflow:auto;padding:16px 18px}\n.hs-viewer-img{max-width:100%;height:auto;border-radius:10px;display:block}\n.hs-btn:focus-visible,.hs-panel-close:focus-visible,.hs-log summary:focus-visible{outline:3px solid var(--hs-clay);outline-offset:2px}\n.hs-btn[disabled]{opacity:.6;cursor:progress}\n@media (max-width:820px){.hs-cond{grid-template-columns:1fr 1fr}.hs-cond>.hs-cond-k{grid-column:1/-1;background:var(--hs-card-warm)}.hs-select{min-width:0;width:100%}.hs-cmp-controls label{flex:1 1 140px}}\n';
  function injectV2Css(){ if (document.getElementById('hs-v2-css')) return; const st=document.createElement('style'); st.id='hs-v2-css'; st.textContent=V2CSS; document.head.appendChild(st); }
  injectV2Css();

  function buildShell(screen) {
    // Hide, never delete. Removing the footer script line restores the old page.
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el.dataset && el.dataset.hsBuilt) return;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return;
      el.setAttribute('data-hs-hidden', '1');
      el.style.display = 'none';
    });

    const nav = NAV_ITEMS.map(function (n) {
      return '<a href="' + n[0] + '"' + (n[2] === screen ? ' class="hs-active"' : '') + '>' + n[1] + '</a>';
    }).join('');

    const wrap = document.createElement('div');
    wrap.dataset.hsBuilt = '1';
    wrap.innerHTML =
      '<div class="hs-demo-strip" id="jbDemoStrip" hidden>Illustrative demonstration - not a client record</div>' +
      '<div class="hs-shell">' +
        '<nav class="hs-nav" aria-label="Home State">' +
          '<a class="hs-logo" href="/dashboard" aria-label="Home State by Joe Builds">' + LOGO_SVG + '</a>' +
          nav +
          '<div class="hs-nav-admin" data-ms-content="admin">' +
            '<a href="/properties">Properties</a><a href="/admin">Admin</a>' +
          '</div>' +
        '</nav>' +
        '<main class="hs-main" id="hsMain" data-hs-screen="' + screen + '">' + MAIN_BODY[screen] + '</main>' +
      '</div>';
    document.body.appendChild(wrap);
    return screen;
  }

  let SCREEN = document.querySelector('[data-hs-screen]')
    ? document.querySelector('[data-hs-screen]').getAttribute('data-hs-screen')
    : null;

  if (!SCREEN) {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const want = PATH_SCREEN[path];
    if (!want) return;               // not a portal screen - leave the page alone
    SCREEN = buildShell(want);
  }
  if (!SCREEN) return;

  /* ---------- 1. Formatting + status mapping (D-1, D-3, QA-18/21) ---------- */
  const AUFMT = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmt = iso => AUFMT.format(new Date(iso));

  // The only badge vocabulary this interface can produce. No `stable` branch exists.
  const BADGES = {
    'within recorded range': { text: 'Within recorded range', cls: 'range' },
    'reduced':               { text: 'Reduced since baseline', cls: 'reduced' },
    'elevated':              { text: 'Elevated', cls: 'elevated' },
    'measured':              { text: 'Recorded', cls: 'measured' },
    'monitor':               { text: 'Monitor', cls: 'measured' },
    'risk':                  { text: 'At risk', cls: 'risk' },
    'not assessed':          { text: 'Not assessed', cls: 'na' }
  };
  /* V2.1 A-1: an unknown or empty status is shown as unknown. It never falls
     through to "Further investigation required", which is a claim. */
  const UNMAPPED = { text: 'No status shown', cls: 'na' };
  const badge = s => BADGES[String(s || '').toLowerCase().trim()] || UNMAPPED;
  const isMappedFlag = s => Object.prototype.hasOwnProperty.call(BADGES, String(s || '').toLowerCase().trim());
  const chip = (b, extra) => `<span class="hs-badge hs-badge--${b.cls}${extra ? ' ' + extra : ''}"><span class="hs-dot"></span>${b.text}</span>`;
  /* V2.3: no chip at all where nothing is recorded; A-1 still applies to a non-empty unknown status. */
  const statusChip = s => String(s == null ? '' : s).trim() ? chip(badge(s)) : '';

  /* V2-2 reading helpers: value, unit and method on every displayed reading. */
  /* V2.1 A-2: canonical unit and method adapters. The key decides identity
     (grouping, Compare); the label is what is shown. */
  const UNIT_CANON = {
    'degrees c': ['degC', '\u00b0C'], 'degc': ['degC', '\u00b0C'], '\u00b0c': ['degC', '\u00b0C'], 'deg c': ['degC', '\u00b0C'],
    'percent rh': ['%RH', '% RH'], '%rh': ['%RH', '% RH'], '% rh': ['%RH', '% RH'],
    'comparative': ['REL', 'relative scale'], 'rel': ['REL', 'relative scale'],
    'ppm': ['ppm', 'ppm'], 'g/kg': ['g/kg', 'g/kg'], '%wme': ['%WME', '%WME']
  };
  const unitCanon = m => { const raw = String(m.unit || '').trim(); if (!raw) return null; return UNIT_CANON[raw.toLowerCase()] || [raw.toLowerCase(), raw]; };
  const unitKey = m => { const u = unitCanon(m); return u ? u[0] : ''; };
  const METHOD_LABEL = {
    moisture_meter_relative: 'Moisture meter, relative scale',
    surface_temp_ir: 'Infrared surface temperature',
    air_rh: 'Room air relative humidity',
    air_temp: 'Room air temperature'
  };
  const methodRaw = m => String(m.method_code || m.reading_method || '').trim();
  const methodKey = m => methodRaw(m).toLowerCase();
  const methodOf = m => { const r = methodRaw(m); return r ? (METHOD_LABEL[r] || METHOD_LABEL[r.toLowerCase()] || r) : 'method not recorded'; };
  const unitOf = m => { const u = unitCanon(m); return u ? u[1] : 'unit not recorded'; };
  const TIMEFMT = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtTime = iso => TIMEFMT.format(new Date(iso));
  const valOf = m => (m.value === null || m.value === undefined || m.value === '') ? (m.reading_status || 'No value') : m.value;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const readingTable = rows => `<div class="hs-scroll"><table class="hs-table"><thead><tr><th>Location</th><th>Value</th><th>Unit</th><th>Method</th><th>Date</th><th>State</th></tr></thead><tbody>` +
    rows.map(m => `<tr><td><strong>${esc(m.measurement_points?.element_code || '')}</strong><br><span class="hs-code">${esc(m.measurement_points?.point_code || '')}</span></td><td>${esc(valOf(m))}</td><td>${esc(unitOf(m))}</td><td>${esc(methodOf(m))}</td><td>${fmt(m.measured_at)}</td><td>${statusChip(m.status_flag)}</td></tr>`).join('') +
    `</tbody></table></div>`;
  const readingTableCompact = rows => `<div class="hs-scroll"><table class="hs-table"><thead><tr><th>Location</th><th>Reading</th><th>Method</th><th>Date</th></tr></thead><tbody>` +
    rows.map(m => `<tr><td><strong>${esc(m.measurement_points?.element_code || '')}</strong><br><span class="hs-code">${esc(m.measurement_points?.point_code || '')}</span></td><td><strong>${esc(valOf(m))}</strong> ${esc(unitOf(m))}${statusChip(m.status_flag) ? '<br>' + statusChip(m.status_flag) : ''}</td><td>${esc(methodOf(m))}</td><td>${fmt(m.measured_at)}</td></tr>`).join('') +
    `</tbody></table></div>`;
  /* A finding is open when its recorded status begins with "open" (the data carries
     forms such as "Open at baseline, reduced at verification" and "Open, no access").
     Access limitations are counted apart from risk indicators. */
  const isOpenF = f => /^(open|further investigation required)/i.test(String(f.status || '').trim());
  const isClosedF = f => /^(closed|resolved|no further action|not required|withdrawn)/i.test(String(f.status || '').trim());
  const unmappedF = d => (d.findings || []).filter(f => !isOpenF(f) && !isClosedF(f));
  const isAccessF = f => /^access limitation/i.test(String(f.issue_type || '')) || /^not assessed$/i.test(String(f.severity || '').trim());
  const openRisk = d => (d.findings || []).filter(f => isOpenF(f) && !isAccessF(f));
  const openAccess = d => (d.findings || []).filter(f => isOpenF(f) && isAccessF(f));
  const AU_SEASON = iso => { const mth = new Date(iso).getUTCMonth() + 1; return [12, 1, 2].includes(mth) ? 'Summer' : [3, 4, 5].includes(mth) ? 'Autumn' : [6, 7, 8].includes(mth) ? 'Winter' : 'Spring'; };

  const ROOM_STATE = {
    'within recorded range': 'Within recorded range',
    'elevated readings recorded': 'Elevated readings recorded',
    'not assessed': 'Not assessed'
  };
  /* Schema adapters (V1.3). The live tables use different column names from the
     harness seed; these read the real ones and fall back rather than guess.
     rooms.room_name_current is the live name column; access_status casing is
     inconsistent in the data ("Accessed"/"Assessed", "No access"/"No Access"),
     so every comparison is lowercased. */
  const roomName = r => r.room_name_current || r.room_name || r.room_code || '';
  const roomNote = r => r.client_facing_description || r.notes || r.access_note || '';
  const accessOf = r => String(r.access_status || '').toLowerCase().trim();
  const isNoAccess = r => accessOf(r) === 'no access';
  const isAssessed = r => ['assessed', 'accessed'].indexOf(accessOf(r)) !== -1;

  const roomChip = r => String(r.room_status || '').trim() ? chip(roomBadge(r)) : '';
  const roomBadge = r => {
    const key = String(r.room_status || '').toLowerCase().trim();
    if (key === 'within recorded range') return badge('within recorded range');
    if (key === 'elevated readings recorded') return badge('elevated');
    if (key === 'not assessed') return badge('not assessed');
    return badge('__unmapped__');
  };

  /* ---------- 2. Data ---------- */
  async function loadAll() {
    const { data: bs, error: bErr } = await sb.from('buildings').select('*').order('building_code');
    if (bErr) throw bErr;
    if (!bs || !bs.length) return { none: true };
    /* V1.6 (F-07-A): never take whatever row arrives first. A client sees one
       building, so this is a no-op for them. A staff member sees several, and
       an unordered pick could silently open a walkthrough on a real property
       instead of the demonstration. Ordered by code, and the DEMO- record wins
       when more than one is visible. */
    const demo = bs.filter(b => String(b.building_code || '').startsWith('DEMO-'));
    /* V2.3: an explicit choice (?p=CODE, or the one kept for this tab) wins when
       that property is visible to the member. */
    let want = null;
    try { want = new URLSearchParams(location.search).get('p') || sessionStorage.getItem('hs_property'); } catch (e) {}
    const chosen = want ? bs.find(b => b.building_code === want) : null;
    const building = chosen || (demo.length ? demo[0] : bs[0]);
    try { if (chosen) sessionStorage.setItem('hs_property', chosen.building_code); } catch (e) {}
    if (bs.length > 1) console.info('[HS] ' + bs.length + ' buildings visible to this member; showing ' + building.building_code);
    const bid = building.id;
    const [rooms, points, meas, scen, events, reports] = await Promise.all([
      sb.from('rooms').select('*').eq('building_id', bid).order('room_code'),
      sb.from('measurement_points').select('*').eq('building_id', bid),
      sb.from('measurements').select('*, measurement_points(*)').eq('building_id', bid),
      sb.from('upgrade_scenarios').select('*').eq('building_id', bid).order('phase'),
      sb.from('diagnostic_events').select('*').eq('building_id', bid).order('created_at', { ascending: false }),
      sb.from('reports').select('*').eq('building_id', bid).order('report_date', { ascending: false })
    ]).then(rs => rs.map(r => { if (r.error) throw r.error; return r.data || []; }));
    /* V2: visits, evidence and open findings. A failure here degrades to an
       honest "not available" on the screen that needs it; it never blanks the
       record or implies an empty result. */
    const soft = q => q.then(r => r.error ? null : (r.data || [])).catch(() => null);
    const [sessions, evidence, findings, twins] = await Promise.all([
      soft(sb.from('assessment_sessions').select('*').eq('building_id', bid).order('assessment_date')),
      soft(sb.from('evidence_assets').select('*').eq('building_id', bid)),
      soft(sb.from('issues_findings').select('*').eq('building_id', bid)),
      soft(sb.from('twin_models').select('*').eq('building_id', bid))
    ]);
    return { building, buildings: bs, rooms, points, meas, scen, events, reports, sessions, evidence, findings, twins };
  }

  /* ---------- 3. Demonstration strip (D-5, QA-01..04) ---------- */
  function demoStrip(building) {
    const strip = document.getElementById('jbDemoStrip');
    if (!strip) return;
    if (building && String(building.building_code || '').startsWith('DEMO-')) strip.hidden = false;
  }

  /* ---------- 4. Metric groups (D-4) ---------- */
  const GROUPS = [
    { key: 'AIR_TEMP', title: 'Indoor air temperature', note: '',
      match: m => unitKey(m) === 'degC' && String(m.measurement_points?.element_code || '').startsWith('Room air') },
    { key: 'HUMIDITY', title: 'Indoor humidity', note: '',
      match: m => unitKey(m) === '%RH' },
    { key: 'COMPARATIVE', title: 'Comparative moisture', note: 'A comparative scale, not a moisture content percentage.',
      match: m => unitKey(m) === 'REL' },
    { key: 'CO2', title: 'Fresh air, carbon dioxide', note: 'An indicator of how much fresh air reaches a room while it is in use.',
      match: m => unitKey(m) === 'ppm' },
    { key: 'ABS_HUMIDITY', title: 'Moisture in the air', note: 'Grams of water per kilogram of air. Unlike relative humidity this does not move with temperature.',
      match: m => unitKey(m) === 'g/kg' },
    { key: 'SURFACE', title: 'Surface temperature', note: '', recordsOnly: true,
      match: m => unitKey(m) === 'degC' && !String(m.measurement_points?.element_code || '').startsWith('Room air') }
  ];

  function groupStats(rows) {
    if (!rows.length) return null;
    const dates = [...new Set(rows.map(r => String(r.measured_at).slice(0, 10)))].sort();
    const latest = rows.filter(r => String(r.measured_at).startsWith(dates[dates.length - 1]));
    const first = rows.filter(r => String(r.measured_at).startsWith(dates[0]));
    const vals = latest.map(r => parseFloat(r.value)).filter(v => !isNaN(v));
    const flag = r => String(r.status_flag || '').toLowerCase().trim();
    const flagged = latest.filter(r => flag(r));
    const worst = !flagged.length ? null
      : latest.some(r => flag(r) === 'elevated') ? 'elevated'
      : flagged.some(r => !isMappedFlag(r.status_flag)) ? '__unmapped__'
      : latest.every(r => flag(r) === 'reduced') ? 'reduced'
      : 'within recorded range';
    return {
      range: vals.length ? `${Math.min(...vals)} to ${Math.max(...vals)} ${unitOf(latest[0])}` : 'No value recorded',
      locations: latest.length, visits: dates.length,
      firstDate: fmt(first[0].measured_at), lastDate: fmt(latest[0].measured_at),
      worst, allReduced: flagged.length > 0 && latest.every(r => flag(r) === 'reduced')
    };
  }

  /* ---------- 5. Renderers ---------- */
  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function renderHero(d) {
    const h = $('#hsHero'); if (!h) return;
    const b = d.building;
    /* V2.1 A-6: the latest visit is the latest assessment date on record. */
    const visitsDated = (d.sessions || []).filter(s => s.assessment_date).slice().sort((a, b) => String(a.assessment_date).localeCompare(String(b.assessment_date)));
    const latest = visitsDated.length ? visitsDated[visitsDated.length - 1] : null;
    h.innerHTML = `
      <div class="hs-hero-eyebrow">Measured home record</div>
      <h1 class="hs-hero-title">${b.building_name || b.name || b.building_code}</h1>
      <div class="hs-hero-meta">
        <span><strong>Property</strong> ${b.building_code}</span>
        <span><strong>Status</strong> ${b.status || 'Recorded'}</span>
        ${latest ? `<span><strong>Latest visit</strong> ${fmt(latest.assessment_date)}</span>` : ''}
      </div>`;
    /* V2.3 property picker, only when more than one property is visible. */
    if ((d.buildings || []).length > 1) {
      const pick = el('label', 'hs-picker');
      pick.innerHTML = `<span>Property</span><select class="hs-select" id="hsPropPick">` +
        d.buildings.map(x => `<option value="${esc(x.building_code)}"${x.id === b.id ? ' selected' : ''}>${esc(x.building_code)}${x.record_class === 'demo' ? ' (demonstration)' : ''}</option>`).join('') + `</select>`;
      h.appendChild(pick);
      pick.querySelector('select').addEventListener('change', e => {
        try { sessionStorage.setItem('hs_property', e.target.value); } catch (err) {}
        const u = new URL(location.href); u.searchParams.set('p', e.target.value); location.href = u.pathname + u.search + u.hash;
      });
    }
  }

  function renderDashboard(d) {
    renderHero(d);
    /* V2-5 record at a glance + next useful action (above the metric cards). */
    const heroEl = $('#hsHero');
    if (heroEl && !$('#hsGlance')) {
      const visits = (d.sessions || []).filter(s => d.meas.some(m => m.assessment_id === s.assessment_id));
      const ev = (d.evidence || []).filter(e => e.client_visible === true);
      const reps = d.reports.filter(r => r.client_visible === true);
      const g = el('div', 'hs-glance'); g.id = 'hsGlance';
      g.innerHTML = `<div><small>Spaces recorded</small><b>${d.rooms.filter(r => !isNoAccess(r)).length}</b></div><div><small>Mapped locations</small><b>${d.points.length}</b></div>` +
        `<div><small>Visits</small><b>${d.sessions === null ? 'n/a' : visits.length}</b></div><div><small>Evidence items</small><b>${d.evidence === null ? 'n/a' : ev.length}</b></div><div><small>Reports</small><b>${reps.length}</b></div>`;
      heroEl.insertAdjacentElement('afterend', g);
      if (visits.length >= 2) {
        const nx = el('article', 'hs-card hs-next'); nx.id = 'hsNextCard';
        nx.innerHTML = `<div><h3>Next useful action</h3><p class="hs-metric-desc">Look at the same mapped locations at your first and latest visits, side by side.</p></div><a class="hs-btn" href="/diagnostics#compare">Compare visits</a>`;
        g.insertAdjacentElement('afterend', nx);
      }
      /* V2.2 record depth summary. */
      const ls = layerStates(d);
      const avail = ls.filter(x => x.state === 'Available').length, lim = ls.filter(x => x.state === 'Limited / unavailable').length;
      const dp = el('article', 'hs-card hs-next'); dp.id = 'hsDepthCard';
      dp.innerHTML = `<div><h3>Record depth</h3><p class="hs-metric-desc">${avail} of ${ls.length} layers hold readings${lim ? `, ${lim} recorded with limited access` : ''}.</p></div><a class="hs-btn" href="/diagnostics#depth">See each layer</a>`;
      ($('#hsNextCard') || g).insertAdjacentElement('afterend', dp);
    }
    const grid = $('#hsMetricGrid'); if (grid) {
      grid.innerHTML = '';
      /* V1.5: a summary card for a group this home has no readings in says
         nothing and pads the walkthrough. Empty groups are omitted here and
         still reported honestly on the Records screen, where completeness is
         the point. */
      GROUPS.filter(g => !g.recordsOnly).filter(g => d.meas.some(g.match)).forEach(g => {
        const rows = d.meas.filter(g.match);
        const card = el('article', 'hs-card hs-metric');
        if (!rows.length) {
          card.innerHTML = `<h3>${g.title}</h3><p class="hs-metric-value">Not recorded in this baseline</p>`;
          card.appendChild(el('div', '', chip(badge('not assessed'))));
        } else {
          const s = groupStats(rows);
          const desc = g.key === 'HUMIDITY' && s.allReduced
            ? `${s.locations} locations recorded for this measurement, ${s.visits} visits. Every location recorded lower than at the first visit.`
            : `${s.locations} locations recorded for this measurement, ${s.visits} visits.` +
              (s.visits > 1 ? ` First visit ${s.firstDate}, latest ${s.lastDate}.` : '') +
              (g.note ? ` ${g.note}` : '');
          card.innerHTML = `<h3>${g.title}</h3><p class="hs-metric-value">${s.range}</p><p class="hs-metric-desc">${desc}</p>`;
          if (s.worst) card.appendChild(el('div', '', chip(badge(s.worst))));
        }
        grid.appendChild(card);
      });
    }

    // Pathway summary card (D-2)
    const pc = $('#hsPathwayCard'); if (pc) {
      const complete = d.scen.filter(s => s.status === 'complete').length;
      const available = d.scen.filter(s => s.status === 'available').length;
      const locked = d.scen.filter(s => s.status === 'locked').length;
      const total = d.scen.length;
      if (!total) { pc.innerHTML = `<h3>Your upgrade pathway</h3><p class="hs-metric-value">Not set out yet</p><p class="hs-metric-desc">No upgrade pathway is recorded for this property yet.</p>`; }
      else pc.innerHTML = `<h3>Your upgrade pathway</h3>
        <p class="hs-metric-value">${complete} of ${total} steps complete</p>
        <p class="hs-metric-desc">${available} ready to start. ${locked} open once the earlier steps are done.</p>`;
      if (total) pc.appendChild(el('div', '', chip(available > 0 ? { text: 'Next step ready', cls: 'measured' } : badge('measured'))));
    }

    // History card (D-3)
    const hc = $('#hsHistoryCard'); if (hc) {
      /* V2.1 A-6: chapters are dated by when they happened: visits by
         assessment_date, released reports by report_date. diagnostic_events
         carries no occurrence date, so those entries are listed as logged
         (administrative provenance), never as when something happened. */
      const ch = [];
      (d.sessions || []).filter(s => s.assessment_date).forEach(s => ch.push({ at: s.assessment_date, text: (s.assessment_type || 'Visit') + (/visit|record/i.test(String(s.assessment_type || '')) ? '' : ' visit') }));
      d.reports.filter(r => r.client_visible === true && r.report_date).forEach(r => ch.push({ at: r.report_date, text: (r.report_title || r.report_type || 'Report') + ', issued' }));
      ch.sort((a, b) => String(a.at).localeCompare(String(b.at)));
      const ev = d.events;
      hc.innerHTML = `<h3>Your home record over time</h3>
        <p class="hs-metric-value">${ch.length ? ch.length + (ch.length === 1 ? ' dated chapter' : ' dated chapters') : 'No dated chapters yet'}</p>
        <p class="hs-metric-desc">${ch.length ? `Most recent: ${esc(ch[ch.length - 1].text)}, ${fmt(ch[ch.length - 1].at)}.` : 'No visit or released report is recorded yet.'}</p>`;
      hc.appendChild(el('div', '', chip(badge('measured'))));
      if (ch.length) {
        const list = el('ol', 'hs-timeline');
        ch.forEach(c => list.appendChild(el('li', '', `<b>${fmt(c.at)}</b>${esc(c.text)}`)));
        hc.appendChild(list);
      }
      if (ev.length) {
        const log = el('details', 'hs-log');
        log.innerHTML = `<summary>Record log (${ev.length} entries)</summary><ul>` +
          ev.map(e => `<li>${esc(e.event_type)} <span class="hs-code">logged ${fmt(e.created_at)}</span></li>`).join('') + `</ul>`;
        hc.appendChild(log);
      }
    }

    // Priority card (D-1 replacement branch)
    const pr = $('#hsPriorityCard'); if (pr && d.findings === null) {
      pr.innerHTML = `<h3>Active priority recommendation</h3><p class="hs-metric-value">Not available</p><p class="hs-metric-desc">This could not be loaded. Please refresh, or contact Joe Builds.</p>`;
    } else if (pr && openRisk(d).length + openAccess(d).length) {
      const risk = openRisk(d), acc = openAccess(d);
      const w = risk.find(f => f.client_facing_wording) || acc.find(f => f.client_facing_wording);
      pr.innerHTML = `<h3>Active priority recommendation</h3>
        <p class="hs-metric-value">${risk.length === 1 ? '1 risk indicator open' : risk.length + ' risk indicators open'}</p>
        <p class="hs-metric-desc">${esc(w ? w.client_facing_wording : 'Further investigation required. See your report for the recorded detail.')}</p>
        ${acc.length ? `<p class="hs-metric-desc"><strong>${acc.length === 1 ? '1 space' : acc.length + ' spaces'} recorded as no access.</strong> Nothing was measured there, and nothing should be inferred about it.</p>` : ''}
        ${unmappedF(d).length ? `<p class="hs-metric-desc">${unmappedF(d).length === 1 ? '1 further finding has' : unmappedF(d).length + ' further findings have'} a status this screen does not show. See your report.</p>` : ''}
        <p class="hs-metric-fine">This reflects what was measured at the mapped locations on the recorded dates. It does not extend to anything not accessed or not measured.</p>`;
      pr.setAttribute('data-jb-fixed', '1');
    } else if (pr && unmappedF(d).length) {
      /* V2.1 A-1: a finding whose status this screen cannot map is never read
         as closed. */
      pr.innerHTML = `<h3>Active priority recommendation</h3>
        <p class="hs-metric-value">See your report</p>
        <p class="hs-metric-desc">${unmappedF(d).length === 1 ? '1 recorded finding has' : unmappedF(d).length + ' recorded findings have'} a status this screen does not show. Your report holds the recorded detail.</p>
        <p class="hs-metric-fine">This reflects what was measured at the mapped locations on the recorded dates. It does not extend to anything not accessed or not measured.</p>`;
      pr.setAttribute('data-jb-fixed', '1');
    } else if (pr) {
      pr.innerHTML = `<h3>Active priority recommendation</h3>
        <p class="hs-metric-value">No risk indicator open</p>
        <p class="hs-metric-desc">Nothing was recorded as requiring further investigation at the last visit.</p>
        <p class="hs-metric-fine">This reflects what was measured at the mapped locations on the recorded dates. It does not extend to anything not accessed or not measured.</p>`;
      pr.appendChild(el('div', '', chip(badge('measured'))));
    }
  }

  /* Home map (D-6 Option 1, D-7): plan generated from recorded coordinates. */
  function renderHomeMap(d) {
    renderHero(d);
    const wrap = $('#hsMap'); if (!wrap) return;
    wrap.innerHTML = '';
    const plan = el('div', 'hs-plan');
    d.rooms.forEach(r => {
      const cell = el('button', 'hs-room');
      cell.style.left = `calc(${r.map_x}% - 59px)`;
      cell.style.top = `calc(${r.map_y}% - 30px)`;
      const b = roomBadge(r);
      const access = accessOf(r);
      const accessChip = (access && !isAssessed(r))
        ? `<span class="hs-badge hs-badge--access"><span class="hs-dot"></span>${r.access_status}</span>` : '';
      cell.innerHTML = `<span class="hs-room-name">${esc(roomName(r))}</span>${roomChip(r)}${accessChip}`;
      cell.setAttribute('aria-label', `${roomName(r)}${String(r.room_status || '').trim() ? ': ' + b.text : ''}${access && access !== 'assessed' ? ', ' + r.access_status : ''}`);
      cell.addEventListener('click', () => openRoomPanel(d, r, cell));
      plan.appendChild(cell);
    });
    wrap.appendChild(plan);
    // presentation-only de-collision: nudge overlapping cards apart vertically.
    // Recorded map_x/map_y are unchanged; this only prevents label overlap (QA-39).
    function deCollide() {
      const cells = [...plan.querySelectorAll('.hs-room')];
      cells.forEach(c => { c.style.top = c.dataset.hsTop; });   // reset to recorded
      for (let pass = 0; pass < 8; pass++) {
        let moved = false;
        for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) {
          const ra = cells[a].getBoundingClientRect(), rb = cells[b].getBoundingClientRect();
          const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ox > 0 && oy > 0) {
            const lower = ra.top < rb.top ? cells[b] : cells[a];
            lower.style.top = `calc(${lower.style.top} + ${oy + 8}px)`;
            moved = true;
          }
        }
        if (!moved) break;
      }
    }
    [...plan.querySelectorAll('.hs-room')].forEach(c => { c.dataset.hsTop = c.style.top; });
    requestAnimationFrame(deCollide);
    setTimeout(deCollide, 200);
    if (window.ResizeObserver) {
      let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(deCollide, 120); }).observe(plan);
    }
    const count = $('#hsMapCount');
    if (count) count.textContent = `${d.points.length} mapped locations across ${d.rooms.filter(r => !isNoAccess(r)).length} accessible spaces`;
    setupModelView(d);
  }

  /* 3D model view. Lazily mounted: the iframe is only created when the model
     view is first opened, so the Home Map costs nothing extra to load. */
  /* V2.3: a model is matched to the record only when its twin_models row points
     at a model page on the portal's own GitHub Pages. */
  const MATCHED_RE = /^https:\/\/joebuilds80\.github\.io\/joebuilds-portal-scripts\/[a-z0-9-]+\.html$/;
  function matchedModel(d) {
    const t = (d.twins || []).find(x => MATCHED_RE.test(String(x.model_url || '')));
    return t ? { url: t.model_url + '?embed=1', label: 'Three dimensional model of this demonstration property. Select a room or a mapped location to see what the record holds for it.', DEFAULT_VIEW: 'model', matched: true } : null;
  }
  function setupModelView(d) {
    const sw = $('#hsViewSwitch'), stage = $('#hsModelStage'), planStage = $('#hsPlanStage');
    if (!sw || !stage || !planStage) return;            // page not on V1.1 markup
    let mounted = false;
    const MODEL = (d && matchedModel(d)) || HS_MODEL;

    function mount() {
      if (mounted) return; mounted = true;
      const note = el('p', 'hs-model-note');
      note.textContent = MODEL.label;
      const frame = document.createElement('iframe');
      frame.className = 'hs-model-frame';
      if (MODEL.matched) {
        /* Listen before setting src; match messages on event.source (the frame's
           origin reads "null" inside the sandbox). */
        window.addEventListener('message', ev => {
          if (ev.source !== frame.contentWindow) return;
          const m = ev.data || {};
          if (m.source !== 'hs-model' || m.event !== 'select' || !m.payload) return;
          const id = m.payload.id || (m.payload.object && m.payload.object.id);
          if (id) openModelSelection(d, String(id));
        });
      }
      frame.src = MODEL.url;
      frame.title = 'Three dimensional home model';
      frame.setAttribute('loading', 'lazy');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      // No allow-same-origin: the model cannot reach this page's session.
      frame.setAttribute('sandbox', 'allow-scripts');
      stage.appendChild(note);
      stage.appendChild(frame);
    }

    function show(view) {
      const model = view === 'model';
      if (model) mount();
      stage.hidden = !model;
      planStage.hidden = model;
      sw.querySelectorAll('[data-hs-view]').forEach(b => {
        const on = b.getAttribute('data-hs-view') === view;
        b.classList.toggle('hs-view-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    sw.querySelectorAll('[data-hs-view]').forEach(b => {
      b.addEventListener('click', () => show(b.getAttribute('data-hs-view')));
    });
    show(MODEL.DEFAULT_VIEW === 'model' ? 'model' : 'plan');
  }

  /* V2.3: what the record holds for a room or mapped location chosen in the model. */
  function openModelSelection(d, id) {
    const pt = d.points.find(p => p.point_code === id);
    if (pt) {
      const panel = $('#hsRoomPanel'); if (!panel) return;
      const room = d.rooms.find(r => r.id === pt.room_id);
      const rows = d.meas.filter(m => m.measurement_point_id === pt.id).slice().sort((a, b) => String(a.measured_at).localeCompare(String(b.measured_at)));
      panel.hidden = false;
      panel.innerHTML = `<div class="hs-panel-head"><h3>${esc(pt.zone_code || pt.point_code)}</h3><button class="hs-panel-close" aria-label="Close">&times;</button></div>
        <p class="hs-metric-desc">${esc(pt.element_code || '')}${room ? ' | ' + esc(roomName(room)) : ''}</p>
        ${rows.length ? `<div class="hs-scroll"><table class="hs-table"><thead><tr><th>Visit</th><th>Reading</th><th>Method</th></tr></thead><tbody>` +
          rows.map(m => { const v = (d.sessions || []).find(x => x.assessment_id === m.assessment_id);
            return `<tr><td><strong>${esc(v ? v.assessment_type || 'Visit' : 'Visit')}</strong><br><span class="hs-code">${fmt(m.measured_at)}</span></td><td><strong>${esc(valOf(m))}</strong> ${esc(unitOf(m))}${statusChip(m.status_flag) ? '<br>' + statusChip(m.status_flag) : ''}${m.client_facing_wording && (m.value === null || m.value === undefined) ? `<br><span class="hs-metric-fine">${esc(m.client_facing_wording)}</span>` : ''}</td><td>${esc(methodOf(m))}</td></tr>`; }).join('') +
          `</tbody></table></div>` : '<p class="hs-metric-desc">No reading is recorded at this location.</p>'}`;
      const c = panel.querySelector('.hs-panel-close'); c.addEventListener('click', () => { panel.hidden = true; }); c.focus({ preventScroll: true });
      return;
    }
    const parts = id.split('-'); const level = parts[1], code = parts.slice(2).join('-');
    const room = d.rooms.find(r => r.level_id === level && (r.room_code === code || (code === 'ZONE' && ['SF', 'RS'].includes(level))));
    if (room) openRoomPanel(d, room, null);
  }

  function openRoomPanel(d, room, opener) {
    const panel = $('#hsRoomPanel'); if (!panel) return;
    const pts = d.points.filter(p => p.room_id === room.id);
    const rows = d.meas.filter(m => pts.some(p => p.id === m.measurement_point_id));
    const noAccess = isNoAccess(room);
    panel.hidden = false;
    panel.innerHTML = `
      <div class="hs-panel-head">
        <h3>${roomName(room)}</h3>
        <button class="hs-panel-close" aria-label="Close">&times;</button>
      </div>
      ${roomChip(room)}
      ${!isAssessed(room) && room.access_status ? `<p class="hs-metric-desc">Access: ${room.access_status}${roomNote(room) ? '. ' + roomNote(room) : ''}</p>` : ''}
      ${noAccess
        ? `<p class="hs-metric-desc">Recorded as no access at the last visit. No readings were taken. Absence of readings is not evidence of absence of a problem.</p>`
        : rows.length
          ? readingTableCompact(rows)
          : `<p class="hs-metric-desc">Not recorded in this baseline.</p>`}`;
    /* V2.1: keyboard focus moves into the panel and back to the room on close. */
    const closeBtn = panel.querySelector('.hs-panel-close');
    closeBtn.addEventListener('click', () => { panel.hidden = true; if (opener) opener.focus(); });
    closeBtn.focus({ preventScroll: true });
  }

  /* Records (D-9): grouped by room, honest headings. */
  function renderRecords(d) {
    renderHero(d);
    const host = $('#hsRecords'); if (!host) return;
    host.innerHTML = `<div class="hs-tabs" role="tablist" aria-label="Records view">
        <button type="button" class="hs-tab" role="tab" data-hs-tab="readings">Readings</button>
        <button type="button" class="hs-tab" role="tab" data-hs-tab="compare">Compare visits</button>
        <button type="button" class="hs-tab" role="tab" data-hs-tab="evidence">Evidence</button>
        <button type="button" class="hs-tab" role="tab" data-hs-tab="history">History</button>
        <button type="button" class="hs-tab" role="tab" data-hs-tab="depth">Record depth</button>
        <button type="button" class="hs-tab" role="tab" data-hs-tab="context">Context</button></div>
      <div data-hs-pane="readings"></div><div data-hs-pane="compare" hidden></div><div data-hs-pane="evidence" hidden></div>
      <div data-hs-pane="history" hidden></div><div data-hs-pane="depth" hidden></div><div data-hs-pane="context" hidden></div>`;
    const wrap = host.querySelector('[data-hs-pane="readings"]');
    renderCompare(d, host.querySelector('[data-hs-pane="compare"]'));
    renderEvidence(d, host.querySelector('[data-hs-pane="evidence"]'));
    renderHistory(d, host.querySelector('[data-hs-pane="history"]'));
    renderDepth(d, host.querySelector('[data-hs-pane="depth"]'));
    renderContext(d, host.querySelector('[data-hs-pane="context"]'));
    function showTab(t) {
      host.querySelectorAll('[data-hs-tab]').forEach(b => { const on = b.dataset.hsTab === t; b.classList.toggle('hs-tab-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      host.querySelectorAll('[data-hs-pane]').forEach(p => { p.hidden = p.dataset.hsPane !== t; });
      const bar = host.querySelector('.hs-tabs'), on = host.querySelector('.hs-tab-on');
      if (bar && on && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, on.offsetLeft - bar.offsetLeft - 16);
    }
    host.querySelectorAll('[data-hs-tab]').forEach(b => b.addEventListener('click', () => { showTab(b.dataset.hsTab); try { history.replaceState(null, '', '#' + b.dataset.hsTab); } catch (e) {} }));
    const fromHash = () => { const want = (location.hash || '').replace('#', ''); showTab(['readings', 'compare', 'evidence', 'history', 'depth', 'context'].includes(want) ? want : 'readings'); };
    window.addEventListener('hashchange', fromHash);
    fromHash();
    wrap.innerHTML = `<h2 class="hs-h2">Recorded readings</h2><p class="hs-metric-desc">${d.meas.length} readings across ${d.points.length} mapped locations, grouped by room.</p>`;
    d.rooms.forEach(room => {
      const pts = d.points.filter(p => p.room_id === room.id);
      const rows = d.meas.filter(m => pts.some(p => p.id === m.measurement_point_id));
      const sec = el('section', 'hs-card hs-record-room');
      sec.innerHTML = `<div class="hs-record-head"><h3>${esc(roomName(room))}</h3>${roomChip(room)}</div>`;
      if (!rows.length) {
        sec.appendChild(el('p', 'hs-metric-desc', isNoAccess(room)
          ? 'Recorded as no access. No readings taken.' : 'Not recorded in this baseline.'));
      } else {
        sec.insertAdjacentHTML('beforeend', readingTable(rows));
      }
      wrap.appendChild(sec);
    });
  }

  /* V2-3 Compare visits: the same mapped location at two visits, side by side.
     Values only. No difference, trend or verdict is computed. The pairing basis
     states only what the ruled rules allow: same location, method and unit are
     required; a different season is Context only. No tolerance is ruled, so the
     conditions are shown, not scored. */
  function renderCompare(d, pane) {
    if (!pane) return;
    const ss = (d.sessions || []).filter(s => d.meas.some(m => m.assessment_id === s.assessment_id));
    if (d.sessions === null) { pane.innerHTML = '<p class="hs-metric-desc">Visit details could not be loaded just now. Reload the page to try again.</p>'; return; }
    if (ss.length < 2) { pane.innerHTML = `<h2 class="hs-h2">Compare visits</h2><p class="hs-metric-desc">${ss.length ? 'One visit is recorded so far. A comparison opens when the same locations are recorded again.' : 'No visit with readings is recorded yet.'}</p>`; return; }
    const label = s => `${s.assessment_type || 'Visit'}, ${fmt(s.assessment_date)}`;
    const opts = sel => ss.map((s, i) => `<option value="${s.assessment_id}"${i === sel ? ' selected' : ''}>${esc(label(s))}</option>`).join('');
    pane.innerHTML = `<h2 class="hs-h2">Compare visits</h2>
      <p class="hs-metric-desc">The same mapped locations, read at two visits. Values are shown side by side. This screen does not calculate a change or give a verdict.</p>
      <div class="hs-cmp-controls"><label for="hsCmpA">First visit<select class="hs-select" id="hsCmpA">${opts(0)}</select></label>
      <label for="hsCmpB">Second visit<select class="hs-select" id="hsCmpB">${opts(ss.length - 1)}</select></label></div>
      <div id="hsCmpBasis"></div><div id="hsCmpCond"></div><div id="hsCmpBody"></div>`;
    /* V2.1 A-3: every reading is kept. A row is one mapped location read with
       one method and one unit. Where a visit holds more than one reading on the
       same row, the latest by measured_at (then id) is shown and the count is
       stated. Nothing is overwritten and nothing is averaged. */
    const rowKey = m => m.measurement_point_id + '|' + methodKey(m) + '|' + unitKey(m);
    const byKey = rows => {
      const o = {};
      rows.forEach(m => { const k = rowKey(m); (o[k] = o[k] || []).push(m); });
      Object.keys(o).forEach(k => o[k].sort((x, y) => String(x.measured_at).localeCompare(String(y.measured_at)) || String(x.id).localeCompare(String(y.id))));
      return o;
    };
    const draw = () => {
      const A = ss.find(s => s.assessment_id === pane.querySelector('#hsCmpA').value), B = ss.find(s => s.assessment_id === pane.querySelector('#hsCmpB').value);
      const ma = d.meas.filter(m => m.assessment_id === A.assessment_id), mb = d.meas.filter(m => m.assessment_id === B.assessment_id);
      const ka = byKey(ma), kb = byKey(mb);
      const ptsA = new Set(ma.map(m => m.measurement_point_id)), ptsB = new Set(mb.map(m => m.measurement_point_id));
      const both = [...ptsA].filter(p => ptsB.has(p));
      const sharedKeyAt = p => Object.keys(ka).some(k => k.split('|')[0] === String(p) && kb[k]);
      const common = both.filter(sharedKeyAt);
      const mismatch = both.filter(p => !sharedKeyAt(p));
      const sameSeason = AU_SEASON(A.assessment_date) === AU_SEASON(B.assessment_date);
      let head, body;
      if (A.assessment_id === B.assessment_id) { head = 'Same visit on both sides'; body = 'Choose two different visits.'; }
      else if (!sameSeason) { head = 'Context only'; body = `${AU_SEASON(A.assessment_date)} and ${AU_SEASON(B.assessment_date)} are different seasons. Readings from different seasons are shown for context and are not compared as a like-for-like pair.`; }
      else if (mismatch.length) { head = 'Not comparable at some locations'; body = `${mismatch.length} of ${both.length} locations were read with a different method or unit at the two visits. Those rows are marked.`; }
      else { head = 'Same locations, method and unit'; body = 'The pairing rules that are ruled are met. Condition tolerances are not yet ruled, so the conditions below are shown for reading, not scored.'; }
      pane.querySelector('#hsCmpBasis').innerHTML = `<div class="hs-basis"><strong>${head}</strong><span class="hs-metric-desc">${body} ${common.length} of ${d.points.length} mapped locations were read with the same method and unit at both visits.</span></div>`;
      const rowsC = [['Weather', 'weather'], ['Recent rain', 'recent_rain'], ['Occupancy', 'occupancy_status'], ['Windows', 'windows_condition'], ['Heating and cooling', 'hvac_status'], ['Fans', 'fans_status']];
      pane.querySelector('#hsCmpCond').innerHTML = `<h3 class="hs-h2" style="font-size:16px">Visit conditions and context</h3><div class="hs-cond"><div class="hs-cond-h">Condition</div><div class="hs-cond-h">${esc(label(A))}</div><div class="hs-cond-h">${esc(label(B))}</div>` +
        rowsC.map(([k, f]) => `<div class="hs-cond-k">${k}</div><div>${esc(A[f] || 'Not recorded')}</div><div>${esc(B[f] || 'Not recorded')}</div>`).join('') + `</div>`;
      const cell = list => {
        if (!list || !list.length) return '<span class="hs-code">Not read</span>';
        const m = list[list.length - 1];
        return `${esc(valOf(m))} <span class="hs-code">${esc(unitOf(m))}</span>` +
          (list.length > 1 ? `<br><span class="hs-code">latest of ${list.length} readings at this visit, ${fmtTime(m.measured_at)}</span>` : '');
      };
      pane.querySelector('#hsCmpBody').innerHTML = d.rooms.map(room => {
        const pts = d.points.filter(p => p.room_id === room.id && (ptsA.has(p.id) || ptsB.has(p.id)));
        if (!pts.length) return '';
        const trs = pts.map(p => {
          const keys = [...new Set([...Object.keys(ka), ...Object.keys(kb)].filter(k => k.split('|')[0] === String(p.id)))].sort();
          const differs = mismatch.includes(p.id);
          return keys.map(k => { const x = ka[k], y = kb[k]; const any = (x || y)[0];
            return `<tr><td><strong>${esc(p.element_code || '')}</strong><br><span class="hs-code">${esc(p.point_code || '')}</span></td><td>${cell(x)}</td><td>${cell(y)}</td><td>${differs ? '<strong>Differs at the two visits</strong><br>' : ''}${esc(methodOf(any))}</td></tr>`; }).join('');
        }).join('');
        return `<section class="hs-card"><div class="hs-record-head"><h3>${esc(roomName(room))}</h3></div><div class="hs-scroll"><table class="hs-table"><thead><tr><th>Location</th><th>First visit</th><th>Second visit</th><th>Method</th></tr></thead><tbody>` + trs + `</tbody></table></div></section>`;
      }).join('');
    };
    pane.querySelector('#hsCmpA').addEventListener('change', draw);
    pane.querySelector('#hsCmpB').addEventListener('change', draw);
    draw();
  }

  /* V2-3 Evidence: first-class, every item tied to its place and visit. */
  function renderEvidence(d, pane) {
    if (!pane) return;
    if (d.evidence === null) { pane.innerHTML = '<p class="hs-metric-desc">Evidence could not be loaded just now. Reload the page to try again.</p>'; return; }
    const items = (d.evidence || []).filter(e => e.client_visible === true);
    const roomOf = id => d.rooms.find(r => r.id === id);
    const visitOf = id => (d.sessions || []).find(s => s.assessment_id === id);
    pane.innerHTML = `<h2 class="hs-h2">Evidence</h2><p class="hs-metric-desc">${items.length ? `${items.length} items released to this record. Each one stays linked to the room and visit it was recorded at.` : 'No evidence has been released to this record yet.'}</p>` +
      `<div class="hs-ev-grid">` + items.map(e => { const r = roomOf(e.room_id), v = visitOf(e.assessment_id);
        return `<article class="hs-card"><div class="hs-ev-thumb">${esc((e.evidence_type || 'Item').split(',')[0])}</div><h3>${esc(r ? roomName(r) : 'Whole property')}</h3>
          <p class="hs-metric-desc">${esc(e.evidence_type || '')}${v ? ` | ${esc(v.assessment_type || 'Visit')}, ${fmt(v.assessment_date)}` : ''}</p>
          ${e.notes ? `<p class="hs-metric-fine">${esc(e.notes)}</p>` : ''}<p class="hs-code">${esc(e.file_name || '')}</p>
          ${e.storage_object_path ? `<button type="button" class="hs-btn" data-hs-ev="${esc(e.id)}">View item</button>` : '<p class="hs-metric-fine">This item is not yet available to view online. It is held on your record.</p>'}</article>`; }).join('') + `</div>`;
    pane.querySelectorAll('[data-hs-ev]').forEach(btn => btn.addEventListener('click', () => {
      const item = items.find(e => String(e.id) === btn.getAttribute('data-hs-ev'));
      if (item) openEvidence(item, btn);
    }));
  }

  /* V2.1 A-4: private viewer. The bytes are read through the storage policy as
     the signed-in member (the portal bridge attaches the member token), then
     shown from a temporary in-page object URL that is revoked on close. No
     signed URL and no public URL is created. */
  async function openEvidence(item, opener) {
    const dlg = el('div', 'hs-viewer');
    dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-label', 'Evidence item');
    dlg.innerHTML = `<div class="hs-viewer-box"><div class="hs-panel-head"><h3>${esc(item.evidence_type || 'Evidence item')}</h3><button type="button" class="hs-panel-close" aria-label="Close">&times;</button></div><div class="hs-viewer-body"><p class="hs-metric-desc">Opening...</p></div></div>`;
    document.body.appendChild(dlg);
    let objUrl = null;
    const close = () => { if (objUrl) URL.revokeObjectURL(objUrl); dlg.remove(); document.removeEventListener('keydown', onKey); if (opener) opener.focus(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
    const closeBtn = dlg.querySelector('.hs-panel-close'); closeBtn.addEventListener('click', close); closeBtn.focus();
    const body = dlg.querySelector('.hs-viewer-body');
    try {
      const { data, error } = await sb.storage.from('property_assets').download(item.storage_object_path);
      if (error || !data) throw error || new Error('no data');
      objUrl = URL.createObjectURL(data);
      if (/^image\//.test(data.type || '')) body.innerHTML = `<img class="hs-viewer-img" src="${objUrl}" alt="${esc(item.evidence_type || 'Evidence item')}">`;
      else body.innerHTML = `<p class="hs-metric-desc">This item is a file rather than an image.</p><a class="hs-btn" href="${objUrl}" download="${esc(item.file_name || 'evidence')}">Save a copy</a>`;
      body.insertAdjacentHTML('beforeend', `<p class="hs-code">${esc(item.file_name || '')}</p>`);
    } catch (err) {
      body.innerHTML = '<p class="hs-metric-desc">This item could not be opened just now. Please try again, or contact Joe Builds.</p>';
    }
  }

  /* ---------- V2.2 shared helpers ---------- */
  const visitsWithReadings = d => (d.sessions || []).filter(s => s.assessment_date).slice()
    .sort((a, b) => String(a.assessment_date).localeCompare(String(b.assessment_date)));
  const measOf = (d, s) => d.meas.filter(m => m.assessment_id === s.assessment_id);
  const LIMITED_RS = /^(no access|obstructed|unsafe|device not available)/i;
  const isRoomType = (r, re) => re.test(String(r.room_type || '')) || re.test(String(r.room_name_current || r.room_name || ''));
  const RE_WET = /wet|bath|ensuite|laundry|shower|wc|toilet/i, RE_SUB = /sub ?floor/i, RE_ROOF = /roof/i;
  const isMoist = m => ['REL', '%WME'].includes(unitKey(m));
  const isRoomAir = m => String(m.measurement_points?.element_code || '').startsWith('Room air') || ['%RH', 'ppm', 'g/kg'].includes(unitKey(m));
  const isThermal = m => unitKey(m) === 'degC' && !isRoomAir(m);

  /* V2.2 History (Journey): chapters dated by when they happened. */
  function renderHistory(d, pane) {
    if (!pane) return;
    if (d.sessions === null) { pane.innerHTML = '<p class="hs-metric-desc">Visit details could not be loaded just now. Reload the page to try again.</p>'; return; }
    const ch = [];
    visitsWithReadings(d).forEach(s => {
      const rows = measOf(d, s);
      const locs = new Set(rows.map(m => m.measurement_point_id)).size;
      const ev = (d.evidence || []).filter(e => e.client_visible === true && e.assessment_id === s.assessment_id).length;
      ch.push({ at: s.assessment_date, kind: 'Visit', title: s.assessment_type || 'Visit',
        body: rows.length ? `${rows.length} readings at ${locs} mapped locations.${ev ? ` ${ev} evidence ${ev === 1 ? 'item' : 'items'} released.` : ''}` : 'No readings are recorded against this visit.',
        link: rows.length ? '<a href="#compare" class="hs-code">Compare visits</a>' : '' });
    });
    d.reports.filter(r => r.client_visible === true && r.report_date).forEach(r => ch.push({ at: r.report_date, kind: 'Report', title: r.report_title || r.report_type || 'Report',
      body: r.release_status === 'published' && !r.withdrawn_at ? 'Released. Download it on the Reports page.' : 'Issued. Not yet released for download.', link: '<a href="/reports" class="hs-code">Reports</a>' }));
    ch.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    pane.innerHTML = `<h2 class="hs-h2">History</h2><p class="hs-metric-desc">${ch.length ? 'Each chapter is dated by when the visit took place or the report was issued.' : 'No visit or released report is recorded yet.'}</p>` +
      (ch.length ? `<ol class="hs-journey">` + ch.map(c => `<li><div class="hs-journey-date">${fmt(c.at)}</div><div class="hs-card"><small class="hs-journey-kind">${c.kind}</small><h3>${esc(c.title)}</h3><p class="hs-metric-desc">${c.body}</p>${c.link}</div></li>`).join('') + `</ol>` : '') +
      (d.events.length ? `<details class="hs-log"><summary>Record log (${d.events.length} entries)</summary><p class="hs-metric-fine">Entries made on the record. The date shown is when each was logged, not when anything happened.</p><ul>` +
        d.events.map(e => `<li>${esc(e.event_type)} <span class="hs-code">logged ${fmt(e.created_at)}</span></li>`).join('') + `</ul></details>` : '');
  }

  /* V2.2 Record depth: layer states derived per pack section 8 from existing
     fields only. Precedence: Available, then Limited / unavailable, then Not yet
     measured, then Future. Scheduled and Not applicable are never inferred. */
  function layerStates(d) {
    const out = [];
    const limitedRooms = d.rooms.filter(r => accessOf(r) && !isAssessed(r) && accessOf(r) !== 'monitoring location');
    const limitedReads = d.meas.filter(m => LIMITED_RS.test(String(m.reading_status || '').trim()));
    const reasonsFor = (rooms, full) => rooms.map(r => `${roomName(r)}: ${r.access_status}` + (full && r.client_facing_description ? `. ${String(r.client_facing_description).replace(/\.$/, '')}` : ''));
    const push = (layer, rows, rooms, applies, note, specific) => {
      const lim = rooms.filter(r => limitedRooms.includes(r));
      const limReads = limitedReads.filter(m => rows.includes(m));
      if (rows.some(m => !LIMITED_RS.test(String(m.reading_status || '').trim()))) {
        out.push({ layer, state: 'Available', note: `${rows.length} readings recorded.` + (specific && lim.length ? ` Also recorded: ${reasonsFor(lim).join('; ')}.` : '') });
      } else if (lim.length || limReads.length) {
        out.push({ layer, state: 'Limited / unavailable', note: [...reasonsFor(lim, true), ...limReads.map(m => String(m.reading_status) + (m.client_facing_wording ? `. ${String(m.client_facing_wording).replace(/\.$/, '')}` : ''))].join('; ') + '.' });
      } else if (applies) {
        out.push({ layer, state: 'Not yet measured', note: note || 'Applies to every home. No visit has recorded it yet.' });
      }
    };
    const all = d.rooms;
    out.push({ layer: 'Rooms and plan', state: d.rooms.length ? 'Available' : 'Not yet measured', note: d.rooms.length ? `${d.rooms.length} spaces on the plan.` : 'No space is recorded yet.' });
    push('Surface moisture', d.meas.filter(isMoist), all, true);
    push('Thermal', d.meas.filter(isThermal), all, true);
    push('Room air', d.meas.filter(isRoomAir), all, true);
    const wet = d.rooms.filter(r => isRoomType(r, RE_WET));
    if (wet.length) push('Wet areas', d.meas.filter(m => wet.some(r => r.id === m.room_id) || wet.some(r => d.points.some(p => p.room_id === r.id && p.id === m.measurement_point_id))), wet, true, null, true);
    const sub = d.rooms.filter(r => isRoomType(r, RE_SUB));
    if (sub.length) push('Subfloor', d.meas.filter(m => sub.some(r => d.points.some(p => p.room_id === r.id && p.id === m.measurement_point_id))), sub, true, null, true);
    const roof = d.rooms.filter(r => isRoomType(r, RE_ROOF));
    if (roof.length) push('Roof space', d.meas.filter(m => roof.some(r => d.points.some(p => p.room_id === r.id && p.id === m.measurement_point_id))), roof, true, null, true);
    const vs = visitsWithReadings(d).filter(s => measOf(d, s).length);
    const seasonVisits = n => vs.filter(s => AU_SEASON(s.assessment_date) === n);
    ['Winter', 'Summer'].forEach(n => { const v = seasonVisits(n);
      out.push({ layer: n + ' tracking', state: v.length ? 'Available' : 'Not yet measured', note: v.length ? `${v.length} ${n.toLowerCase()} ${v.length === 1 ? 'visit' : 'visits'} recorded.` : `No ${n.toLowerCase()} visit is recorded yet.` }); });
    const ver = vs.filter(s => /verif/i.test(String(s.assessment_type || '')));
    out.push({ layer: 'Verification', state: ver.length ? 'Available' : 'Not yet measured', note: ver.length ? 'A later comparison at the same locations is recorded.' : 'No verification visit is recorded yet.' });
    out.push({ layer: 'Air movement', state: 'Future', note: 'No air movement method is offered yet.' });
    return out;
  }
  function renderDepth(d, pane) {
    if (!pane) return;
    const ls = layerStates(d);
    const cls = { 'Available': 'range', 'Limited / unavailable': 'access', 'Not yet measured': 'na', 'Future': 'na' };
    pane.innerHTML = `<h2 class="hs-h2">Record depth</h2><p class="hs-metric-desc">What this record holds, layer by layer. Everything already measured stays available to you. A new layer is added only by a new visit.</p>` +
      `<div class="hs-depth">` + ls.map(x => `<div class="hs-depth-row"><div><strong>${esc(x.layer)}</strong><p class="hs-metric-fine">${esc(x.note)}</p></div><span class="hs-badge hs-badge--${cls[x.state]}"><span class="hs-dot"></span>${x.state}</span></div>`).join('') + `</div>` +
      `<p class="hs-metric-fine">Layers the record cannot yet speak to are not listed. Nothing here is inferred from a layer that was not measured.</p>`;
  }

  /* V2.2 Context: property climate context kept apart from visit conditions. */
  function renderContext(d, pane) {
    if (!pane) return;
    if (d.sessions === null) { pane.innerHTML = '<p class="hs-metric-desc">Visit details could not be loaded just now. Reload the page to try again.</p>'; return; }
    const vs = visitsWithReadings(d);
    const rowsC = [['Weather', 'weather'], ['Recent rain', 'recent_rain'], ['Occupancy', 'occupancy_status'], ['Windows', 'windows_condition'], ['Heating and cooling', 'hvac_status'], ['Fans', 'fans_status']];
    pane.innerHTML = `<h2 class="hs-h2">Context</h2>
      <section class="hs-card"><h3>Property climate context</h3><p class="hs-metric-desc">Not held on this record yet. When it is added, each value will show where it came from.</p></section>
      <section class="hs-card"><h3>Visit conditions and context</h3><p class="hs-metric-desc">As written into the record at each visit. These are kept apart from the property context above and are not scored.</p>` +
      (vs.length ? `<div class="hs-scroll"><table class="hs-table"><thead><tr><th>Condition</th>${vs.map(s => `<th>${esc(s.assessment_type || 'Visit')}<br><span class="hs-code">${fmt(s.assessment_date)}</span></th>`).join('')}</tr></thead><tbody>` +
        rowsC.map(([k, f]) => `<tr><td><strong>${k}</strong></td>${vs.map(s => `<td>${esc(s[f] || 'Not recorded')}</td>`).join('')}</tr>`).join('') + `</tbody></table></div>`
        : '<p class="hs-metric-desc">No visit is recorded yet.</p>') + `</section>`;
  }

  /* Pathway (D-10): phases from the data, as many as exist. */
  function renderPathway(d) {
    renderHero(d);
    const wrap = $('#hsPathway'); if (!wrap) return;
    wrap.innerHTML = '';
    const phases = [...new Set(d.scen.map(s => s.phase))].sort((a, b) => a - b);
    phases.forEach(p => {
      const steps = d.scen.filter(s => s.phase === p);
      const complete = steps.filter(s => s.status === 'complete').length;
      const available = steps.filter(s => s.status === 'available').length;
      const state = complete === steps.length ? `${complete} of ${steps.length} done`
        : available ? `${available} ready to start` : 'opens after the earlier phases';
      const sec = el('section', 'hs-card hs-phase');
      sec.innerHTML = `<div class="hs-phase-head"><span class="hs-phase-num">Phase ${p}</span><h3>${steps[0].phase_name || ''}</h3><span class="hs-phase-state">${state}</span></div>`;
      const list = el('div', 'hs-steps');
      steps.forEach(s => {
        const st = s.status === 'complete' ? { text: 'Done', cls: 'range' }
          : s.status === 'available' ? { text: 'Ready to start', cls: 'measured' }
          : { text: 'Opens later', cls: 'na' };
        list.appendChild(el('div', 'hs-step',
          `<div><strong>${s.title || s.scenario_name || ''}</strong>${s.client_facing_wording ? `<p class="hs-metric-desc">${s.client_facing_wording}</p>` : ''}</div>${chip(st)}`));
      });
      sec.appendChild(list);
      wrap.appendChild(sec);
    });
  }

  /* Reports (D-11): report_date, comparison wording, honest empty state. */
  function renderReports(d) {
    renderHero(d);
    const wrap = $('#hsReports'); if (!wrap) return;
    wrap.innerHTML = `<h2 class="hs-h2">Recorded so far</h2>`;
    /* V1.4 defence in depth: only render reports explicitly marked
       client_visible. RLS already withholds these from a client, but a staff
       member walking a prospect through the demonstration is granted
       everything by `reports_staff_all` - which is how "Operator working
       notes - not client visible" appeared on the client Reports screen.
       The interface now applies the same rule the policy does. */
    const visible = d.reports.filter(r => r.client_visible === true);
    const withheld = d.reports.length - visible.length;
    if (withheld > 0) console.info('[HS] ' + withheld + ' report(s) not client_visible, withheld from this screen');
    if (!visible.length) {
      wrap.insertAdjacentHTML('beforeend', '<p class="hs-metric-desc">No report has been released to this record yet.</p>');
    }
    visible.forEach(r => {
      /* V2.1 A-4: a published report opens through the existing report-delivery
         function, which authorises the member, writes the audit record and
         proves the bytes before sending them. Nothing is cached and no URL is
         handed out. A report that is not yet published says so. */
      const ready = r.release_status === 'published' && !r.withdrawn_at;
      const card = el('article', 'hs-card hs-report',
        `<div class="hs-record-head"><h3>${esc(r.report_title || r.report_type || 'Report')}</h3>${chip(badge('measured'))}</div>
         <p class="hs-metric-desc">Issued ${fmt(r.report_date || r.created_at)}.</p>` +
        (ready ? `<button type="button" class="hs-btn" data-hs-rep="${esc(r.id)}">Download report</button><p class="hs-metric-fine" aria-live="polite"></p>`
               : `<p class="hs-metric-fine">This report is not yet released for download.</p>`));
      wrap.appendChild(card);
      const btn = card.querySelector('[data-hs-rep]');
      if (btn) btn.addEventListener('click', () => downloadReport(r, btn, card.querySelector('[aria-live]')));
    });
    wrap.insertAdjacentHTML('beforeend', `<h2 class="hs-h2">Next check</h2><p class="hs-metric-desc">No further comparison check scheduled yet.</p>`);
  }

  async function downloadReport(r, btn, status) {
    btn.disabled = true; status.textContent = 'Preparing your report...';
    try {
      const res = await fetch(URLBASE.replace(/\/+$/, '') + '/functions/v1/report-delivery', {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON }, body: JSON.stringify({ report_id: r.id })
      });
      if (!res.ok) throw new Error('not_available');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = m ? m[1] : 'Home-State-report.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.textContent = 'Your report has downloaded.';
    } catch (err) {
      status.textContent = 'The report could not be downloaded just now. Please try again, or contact Joe Builds.';
    } finally { btn.disabled = false; }
  }

  /* ---------- 6. Empty/failure states (QA-24, 28, 29) ---------- */
  function renderNoBuilding() {
    const m = $('#hsMain');
    if (m) m.innerHTML = `<div class="hs-card hs-empty"><h2 class="hs-h2">No property assigned</h2>
      <p class="hs-metric-desc">This sign-in has no home record linked to it yet. If a Home Performance Baseline has been completed for you, contact Joe Builds and the record will be connected.</p></div>`;
  }

  /* ---------- 7. Boot ---------- */
  async function boot() {
    document.body.classList.add('hs-loading');
    try {
      const d = await loadAll();
      if (d.none) { demoStrip(null); renderNoBuilding(); return; }
      demoStrip(d.building);
      if (SCREEN === 'dashboard') renderDashboard(d);
      if (SCREEN === 'home-map') renderHomeMap(d);
      if (SCREEN === 'records') renderRecords(d);
      if (SCREEN === 'pathway') renderPathway(d);
      if (SCREEN === 'reports') renderReports(d);
    } catch (err) {
      console.error('[HS]', err);
      // QA-29: stay in skeleton, never resolve to zeroes or "not assessed"
      const m = $('#hsMain');
      if (m) m.insertAdjacentHTML('afterbegin',
        `<div class="hs-card hs-empty"><p class="hs-metric-desc">The record could not be loaded just now. Nothing shown below reflects the home. Reload the page, or sign in again.</p></div>`);
      return;
    } finally {
      document.body.classList.remove('hs-loading');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
