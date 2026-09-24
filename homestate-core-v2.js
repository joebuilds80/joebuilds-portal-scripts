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

  const V2CSS = '\n:root{--hs-canvas:#f5eee4;--hs-card:#fffaf3;--hs-card-warm:#faf3e8;--hs-ink:#3d463d;--hs-ink-soft:#5d665d;--hs-clay:#cc7e4b;--hs-gold:#a07a52;--hs-line:#e6dccb}\n.hs-nav{background:var(--hs-card)}\n.hs-nav a.hs-active{background:var(--hs-ink);color:var(--hs-card)}\n.hs-card{border-radius:16px}\n.hs-tabs{display:inline-flex;gap:4px;padding:4px;margin:6px 0 16px;background:var(--hs-card-warm);border:1px solid var(--hs-line);border-radius:999px}\n.hs-tab{border:0;background:none;font:inherit;font-size:13px;font-weight:600;color:var(--hs-ink-soft);padding:7px 16px;border-radius:999px;cursor:pointer}\n.hs-tab.hs-tab-on{background:var(--hs-ink);color:var(--hs-card)}\n.hs-tab:focus-visible,.hs-select:focus-visible{outline:3px solid var(--hs-clay);outline-offset:2px}\n.hs-glance{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px}\n.hs-glance div{background:var(--hs-card);border:1px solid var(--hs-line);border-radius:14px;padding:14px 16px}\n.hs-glance small{display:block;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--hs-gold);font-weight:700}\n.hs-glance b{display:block;font-size:26px;margin-top:4px;color:var(--hs-ink);font-variant-numeric:tabular-nums}\n.hs-next{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}\n.hs-btn{display:inline-block;border:0;border-radius:999px;background:var(--hs-ink);color:var(--hs-card);padding:10px 18px;font:inherit;font-size:13.5px;font-weight:700;text-decoration:none;cursor:pointer}\n.hs-timeline{list-style:none;margin:14px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}\n.hs-timeline li{border:1px solid var(--hs-line);border-radius:12px;padding:10px 12px;background:var(--hs-card-warm);font-size:12.5px;color:var(--hs-ink-soft)}\n.hs-timeline li b{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--hs-gold);margin-bottom:4px}\n.hs-cmp-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px}\n.hs-cmp-controls label{display:flex;flex-direction:column;gap:4px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--hs-gold);font-weight:700}\n.hs-select{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--hs-line);border-radius:10px;background:var(--hs-card);color:var(--hs-ink);min-width:220px;max-width:100%}\n.hs-basis{border-left:4px solid var(--hs-gold);background:var(--hs-card-warm);padding:12px 14px;border-radius:10px;margin-bottom:14px}\n.hs-basis strong{display:block;font-size:15px;color:var(--hs-ink);margin-bottom:4px}\n.hs-cond{display:grid;grid-template-columns:minmax(120px,1fr) 2fr 2fr;gap:0;border:1px solid var(--hs-line);border-radius:12px;overflow:hidden;margin-bottom:16px;font-size:13px}\n.hs-cond>div{padding:8px 12px;border-bottom:1px solid var(--hs-line);color:var(--hs-ink-soft)}\n.hs-cond>.hs-cond-h{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--hs-gold);font-weight:700;background:var(--hs-card-warm)}\n.hs-cond>.hs-cond-k{font-weight:700;color:var(--hs-ink)}\n.hs-scroll{overflow-x:auto}\n.hs-code{font:600 11.5px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--hs-ink-soft)}\n.hs-ev-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}\n.hs-ev-thumb{height:92px;border-radius:10px;background:linear-gradient(135deg,#e4e9e0,#efd4c0);display:grid;place-items:center;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--hs-ink-soft);font-weight:700;margin-bottom:10px}\n@media (max-width:820px){.hs-cond{grid-template-columns:1fr 1fr}.hs-cond>.hs-cond-k{grid-column:1/-1;background:var(--hs-card-warm)}.hs-select{min-width:0;width:100%}.hs-cmp-controls label{flex:1 1 140px}}\n';
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
  const badge = s => BADGES[String(s || '').toLowerCase().trim()] ||
                     { text: 'Further investigation required', cls: 'review' };
  const chip = (b, extra) => `<span class="hs-badge hs-badge--${b.cls}${extra ? ' ' + extra : ''}"><span class="hs-dot"></span>${b.text}</span>`;

  /* V2-2 reading helpers: value, unit and method on every displayed reading. */
  const methodOf = m => m.reading_method || m.method_code || 'method not recorded';
  const unitOf = m => m.unit || 'unit not recorded';
  const valOf = m => (m.value === null || m.value === undefined || m.value === '') ? (m.reading_status || 'No value') : m.value;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const readingTable = rows => `<div class="hs-scroll"><table class="hs-table"><thead><tr><th>Location</th><th>Value</th><th>Unit</th><th>Method</th><th>Date</th><th>State</th></tr></thead><tbody>` +
    rows.map(m => `<tr><td><strong>${esc(m.measurement_points?.element_code || '')}</strong><br><span class="hs-code">${esc(m.measurement_points?.point_code || '')}</span></td><td>${esc(valOf(m))}</td><td>${esc(unitOf(m))}</td><td>${esc(methodOf(m))}</td><td>${fmt(m.measured_at)}</td><td>${chip(badge(m.status_flag))}</td></tr>`).join('') +
    `</tbody></table></div>`;
  const readingTableCompact = rows => `<div class="hs-scroll"><table class="hs-table"><thead><tr><th>Location</th><th>Reading</th><th>Method</th><th>Date</th></tr></thead><tbody>` +
    rows.map(m => `<tr><td><strong>${esc(m.measurement_points?.element_code || '')}</strong><br><span class="hs-code">${esc(m.measurement_points?.point_code || '')}</span></td><td><strong>${esc(valOf(m))}</strong> ${esc(unitOf(m))}<br>${chip(badge(m.status_flag))}</td><td>${esc(methodOf(m))}</td><td>${fmt(m.measured_at)}</td></tr>`).join('') +
    `</tbody></table></div>`;
  /* A finding is open when its recorded status begins with "open" (the data carries
     forms such as "Open at baseline, reduced at verification" and "Open, no access").
     Access limitations are counted apart from risk indicators. */
  const isOpenF = f => /^open/i.test(String(f.status || '').trim());
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
  const roomNote = r => r.notes || r.client_facing_description || r.access_note || '';
  const accessOf = r => String(r.access_status || '').toLowerCase().trim();
  const isNoAccess = r => accessOf(r) === 'no access';
  const isAssessed = r => ['assessed', 'accessed'].indexOf(accessOf(r)) !== -1;

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
    const building = demo.length ? demo[0] : bs[0];
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
    const [sessions, evidence, findings] = await Promise.all([
      soft(sb.from('assessment_sessions').select('*').eq('building_id', bid).order('assessment_date')),
      soft(sb.from('evidence_assets').select('*').eq('building_id', bid)),
      soft(sb.from('issues_findings').select('*').eq('building_id', bid))
    ]);
    return { building, rooms, points, meas, scen, events, reports, sessions, evidence, findings };
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
      match: m => m.unit === 'degrees C' && String(m.measurement_points?.element_code || '').startsWith('Room air') },
    { key: 'HUMIDITY', title: 'Indoor humidity', note: '',
      match: m => m.unit === 'percent RH' },
    { key: 'COMPARATIVE', title: 'Comparative moisture', note: 'A comparative scale, not a moisture content percentage.',
      match: m => m.unit === 'comparative' },
    { key: 'CO2', title: 'Fresh air, carbon dioxide', note: 'An indicator of how much fresh air reaches a room while it is in use.',
      match: m => m.unit === 'ppm' },
    { key: 'ABS_HUMIDITY', title: 'Moisture in the air', note: 'Grams of water per kilogram of air. Unlike relative humidity this does not move with temperature.',
      match: m => m.unit === 'g/kg' },
    { key: 'SURFACE', title: 'Surface temperature', note: '', recordsOnly: true,
      match: m => m.unit === 'degrees C' && !String(m.measurement_points?.element_code || '').startsWith('Room air') }
  ];

  function groupStats(rows) {
    if (!rows.length) return null;
    const dates = [...new Set(rows.map(r => String(r.measured_at).slice(0, 10)))].sort();
    const latest = rows.filter(r => String(r.measured_at).startsWith(dates[dates.length - 1]));
    const first = rows.filter(r => String(r.measured_at).startsWith(dates[0]));
    const vals = latest.map(r => parseFloat(r.value)).filter(v => !isNaN(v));
    const worst = latest.some(r => r.status_flag === 'elevated') ? 'elevated'
      : latest.every(r => r.status_flag === 'reduced') ? 'reduced'
      : 'within recorded range';
    return {
      range: `${Math.min(...vals)} to ${Math.max(...vals)} ${latest[0].unit}`,
      locations: latest.length, visits: dates.length,
      firstDate: fmt(first[0].measured_at), lastDate: fmt(latest[0].measured_at),
      worst, allReduced: latest.every(r => r.status_flag === 'reduced')
    };
  }

  /* ---------- 5. Renderers ---------- */
  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function renderHero(d) {
    const h = $('#hsHero'); if (!h) return;
    const b = d.building;
    const latest = d.events.find(e => /recorded/i.test(e.event_type || '') && /assessment|baseline/i.test(e.event_type || ''));
    h.innerHTML = `
      <div class="hs-hero-eyebrow">Measured home record</div>
      <h1 class="hs-hero-title">${b.building_name || b.name || b.building_code}</h1>
      <div class="hs-hero-meta">
        <span><strong>Property</strong> ${b.building_code}</span>
        <span><strong>Status</strong> ${b.status || 'Recorded'}</span>
        ${latest ? `<span><strong>Latest visit</strong> ${fmt(latest.created_at)}</span>` : ''}
      </div>`;
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
          card.appendChild(el('div', '', chip(badge(s.worst))));
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
      pc.innerHTML = `<h3>Your upgrade pathway</h3>
        <p class="hs-metric-value">${complete} of ${total} steps complete</p>
        <p class="hs-metric-desc">${available} ready to start. ${locked} open once the earlier steps are done.</p>`;
      pc.appendChild(el('div', '', chip(available > 0 ? { text: 'Next step ready', cls: 'measured' } : badge('measured'))));
    }

    // History card (D-3)
    const hc = $('#hsHistoryCard'); if (hc) {
      const ev = d.events;
      hc.innerHTML = `<h3>Your home record over time</h3>
        <p class="hs-metric-value">${ev.length} recorded events</p>
        <p class="hs-metric-desc">${ev.length ? `Most recent: ${ev[0].event_type}, ${fmt(ev[0].created_at)}.` : 'No events recorded yet.'}</p>`;
      hc.appendChild(el('div', '', chip(badge('measured'))));
      const list = el('ol', 'hs-timeline');
      ev.slice().reverse().forEach(e => list.appendChild(el('li', '', `<b>${fmt(e.created_at)}</b>${esc(e.event_type)}`)));
      hc.appendChild(list);
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
      cell.innerHTML = `<span class="hs-room-name">${roomName(r)}</span>${chip(b)}${accessChip}`;
      cell.setAttribute('aria-label', `${roomName(r)}: ${b.text}${access && access !== 'assessed' ? ', ' + r.access_status : ''}`);
      cell.addEventListener('click', () => openRoomPanel(d, r));
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
    setupModelView();
  }

  /* 3D model view. Lazily mounted: the iframe is only created when the model
     view is first opened, so the Home Map costs nothing extra to load. */
  function setupModelView() {
    const sw = $('#hsViewSwitch'), stage = $('#hsModelStage'), planStage = $('#hsPlanStage');
    if (!sw || !stage || !planStage) return;            // page not on V1.1 markup
    let mounted = false;

    function mount() {
      if (mounted) return; mounted = true;
      const note = el('p', 'hs-model-note');
      note.textContent = HS_MODEL.label;
      const frame = document.createElement('iframe');
      frame.className = 'hs-model-frame';
      frame.src = HS_MODEL.url;
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
    show(HS_MODEL.DEFAULT_VIEW === 'model' ? 'model' : 'plan');
  }

  function openRoomPanel(d, room) {
    const panel = $('#hsRoomPanel'); if (!panel) return;
    const pts = d.points.filter(p => p.room_id === room.id);
    const rows = d.meas.filter(m => pts.some(p => p.id === m.measurement_point_id));
    const noAccess = isNoAccess(room);
    panel.hidden = false;
    panel.innerHTML = `
      <div class="hs-panel-head">
        <h3>${roomName(room)}</h3>
        <button class="hs-panel-close" aria-label="Close">×</button>
      </div>
      ${chip(roomBadge(room))}
      ${!isAssessed(room) ? `<p class="hs-metric-desc">Access: ${room.access_status}${roomNote(room) ? '. ' + roomNote(room) : ''}</p>` : ''}
      ${noAccess
        ? `<p class="hs-metric-desc">Recorded as no access at the last visit. No readings were taken. Absence of readings is not evidence of absence of a problem.</p>`
        : rows.length
          ? readingTableCompact(rows)
          : `<p class="hs-metric-desc">Not recorded in this baseline.</p>`}`;
    panel.querySelector('.hs-panel-close').addEventListener('click', () => { panel.hidden = true; });
  }

  /* Records (D-9): grouped by room, honest headings. */
  function renderRecords(d) {
    renderHero(d);
    const host = $('#hsRecords'); if (!host) return;
    host.innerHTML = `<div class="hs-tabs" role="tablist" aria-label="Records view">
        <button type="button" class="hs-tab" role="tab" data-hs-tab="readings">Readings</button>
        <button type="button" class="hs-tab" role="tab" data-hs-tab="compare">Compare visits</button>
        <button type="button" class="hs-tab" role="tab" data-hs-tab="evidence">Evidence</button></div>
      <div data-hs-pane="readings"></div><div data-hs-pane="compare" hidden></div><div data-hs-pane="evidence" hidden></div>`;
    const wrap = host.querySelector('[data-hs-pane="readings"]');
    renderCompare(d, host.querySelector('[data-hs-pane="compare"]'));
    renderEvidence(d, host.querySelector('[data-hs-pane="evidence"]'));
    function showTab(t) {
      host.querySelectorAll('[data-hs-tab]').forEach(b => { const on = b.dataset.hsTab === t; b.classList.toggle('hs-tab-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      host.querySelectorAll('[data-hs-pane]').forEach(p => { p.hidden = p.dataset.hsPane !== t; });
    }
    host.querySelectorAll('[data-hs-tab]').forEach(b => b.addEventListener('click', () => { showTab(b.dataset.hsTab); try { history.replaceState(null, '', '#' + b.dataset.hsTab); } catch (e) {} }));
    const fromHash = () => { const want = (location.hash || '').replace('#', ''); showTab(['readings', 'compare', 'evidence'].includes(want) ? want : 'readings'); };
    window.addEventListener('hashchange', fromHash);
    fromHash();
    wrap.innerHTML = `<h2 class="hs-h2">Recorded readings</h2><p class="hs-metric-desc">${d.meas.length} readings across ${d.points.length} mapped locations, grouped by room.</p>`;
    d.rooms.forEach(room => {
      const pts = d.points.filter(p => p.room_id === room.id);
      const rows = d.meas.filter(m => pts.some(p => p.id === m.measurement_point_id));
      const sec = el('section', 'hs-card hs-record-room');
      sec.innerHTML = `<div class="hs-record-head"><h3>${roomName(room)}</h3>${chip(roomBadge(room))}</div>`;
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
    const draw = () => {
      const A = ss.find(s => s.assessment_id === pane.querySelector('#hsCmpA').value), B = ss.find(s => s.assessment_id === pane.querySelector('#hsCmpB').value);
      const ma = d.meas.filter(m => m.assessment_id === A.assessment_id), mb = d.meas.filter(m => m.assessment_id === B.assessment_id);
      const byPt = rows => { const o = {}; rows.forEach(m => { o[m.measurement_point_id] = m; }); return o; };
      const pa = byPt(ma), pb = byPt(mb);
      const common = Object.keys(pa).filter(k => pb[k]);
      const mismatch = common.filter(k => methodOf(pa[k]) !== methodOf(pb[k]) || unitOf(pa[k]) !== unitOf(pb[k]));
      const sameSeason = AU_SEASON(A.assessment_date) === AU_SEASON(B.assessment_date);
      let head, body;
      if (A.assessment_id === B.assessment_id) { head = 'Same visit on both sides'; body = 'Choose two different visits.'; }
      else if (!sameSeason) { head = 'Context only'; body = `${AU_SEASON(A.assessment_date)} and ${AU_SEASON(B.assessment_date)} are different seasons. Readings from different seasons are shown for context and are not compared as a like-for-like pair.`; }
      else if (mismatch.length) { head = 'Not comparable at some locations'; body = `${mismatch.length} of ${common.length} locations were read with a different method or unit. Those rows are marked.`; }
      else { head = 'Same locations, method and unit'; body = 'The pairing rules that are ruled are met. Condition tolerances are not yet ruled, so the conditions below are shown for reading, not scored.'; }
      pane.querySelector('#hsCmpBasis').innerHTML = `<div class="hs-basis"><strong>${head}</strong><span class="hs-metric-desc">${body} ${common.length} of ${d.points.length} mapped locations were read at both visits.</span></div>`;
      const rowsC = [['Weather', 'weather'], ['Recent rain', 'recent_rain'], ['Occupancy', 'occupancy_status'], ['Windows', 'windows_condition'], ['Heating and cooling', 'hvac_status'], ['Fans', 'fans_status']];
      pane.querySelector('#hsCmpCond').innerHTML = `<h3 class="hs-h2" style="font-size:16px">Conditions at each visit</h3><div class="hs-cond"><div class="hs-cond-h">Recorded on site</div><div class="hs-cond-h">${esc(label(A))}</div><div class="hs-cond-h">${esc(label(B))}</div>` +
        rowsC.map(([k, f]) => `<div class="hs-cond-k">${k}</div><div>${esc(A[f] || 'Not recorded')}</div><div>${esc(B[f] || 'Not recorded')}</div>`).join('') + `</div>`;
      const cell = m => m ? `${esc(valOf(m))} <span class="hs-code">${esc(unitOf(m))}</span>` : '<span class="hs-code">Not read</span>';
      pane.querySelector('#hsCmpBody').innerHTML = d.rooms.map(room => {
        const pts = d.points.filter(p => p.room_id === room.id && (pa[p.id] || pb[p.id]));
        if (!pts.length) return '';
        return `<section class="hs-card"><div class="hs-record-head"><h3>${esc(roomName(room))}</h3></div><div class="hs-scroll"><table class="hs-table"><thead><tr><th>Location</th><th>First visit</th><th>Second visit</th><th>Method</th></tr></thead><tbody>` +
          pts.map(p => { const x = pa[p.id], y = pb[p.id]; const diff = x && y && (methodOf(x) !== methodOf(y) || unitOf(x) !== unitOf(y));
            return `<tr><td><strong>${esc(p.element_code || '')}</strong><br><span class="hs-code">${esc(p.point_code || '')}</span></td><td>${cell(x)}</td><td>${cell(y)}</td><td>${diff ? '<strong>Differs</strong><br>' : ''}${esc(methodOf(x || y))}${diff ? ' / ' + esc(methodOf(y)) : ''}</td></tr>`; }).join('') +
          `</tbody></table></div></section>`;
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
          ${e.notes ? `<p class="hs-metric-fine">${esc(e.notes)}</p>` : ''}<p class="hs-code">${esc(e.file_name || '')}</p></article>`; }).join('') + `</div>`;
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
      wrap.appendChild(el('article', 'hs-card hs-report',
        `<div class="hs-record-head"><h3>${r.report_title || r.report_type || 'Report'}</h3>${chip(badge('measured'))}</div>
         <p class="hs-metric-desc">Issued ${fmt(r.report_date || r.created_at)}.</p>`));
    });
    wrap.insertAdjacentHTML('beforeend', `<h2 class="hs-h2">Next check</h2><p class="hs-metric-desc">No further comparison check scheduled yet.</p>`);
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
