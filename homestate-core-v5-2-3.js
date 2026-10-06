/* ============================================================================
   HOME STATE - PORTAL CORE V5.1
   homestate-core-v5-2.js  (V5.2.0, 2026-10-06, built by Mac; V5.1.0 = homestate-core-v5-1.js @6dbd967)

   Implements Axe's resolved owner experience (HOME STATE V5.1 - MAC
   IMPLEMENTATION HANDOFF, 2026-10-06) on the EXISTING portal stack:
     - same five Webflow pages, same Memberstack sign-in, same signed session
       bridge (portal-client-v2.js), same Row Level Security, same tables;
     - read-only against the record; no schema, access-model, credential,
       price or payment change; nothing is written anywhere;
     - the synthetic standalone HTML is NOT loaded. Every figure on screen is
       read from the signed-in member's own record through the existing
       supabase-js client, exactly as core V2.4.1 reads it.

   Owner destinations (four): Home, Home Map, History, Reports.
     /dashboard     -> Home
     /digital-twin  -> Home Map
     /diagnostics   -> History
     /reports       -> Reports
     /pathway       -> Home, with Visits & payments open (not in the owner nav)
   Navigation between destinations stays on the page (no reload); the address
   bar is updated to the matching page, so a reload lands on the same view.

   V5.2 (2026-10-06, Joe's review): property hero with climate context (new
   buildings.climate_zone / climate_zone_source / climate_note, Joe approved),
   External envelope renamed External walls (inside-face readings), and the V2.2
   depth restored: visit conditions side by side, record depth, photos & evidence.

   Five persistent sections on Home: External walls, Indoor environment,
   Bathrooms & wet areas, Roof space, Subfloor. Sections are linked views of
   one reading set, never buckets: one reading keeps one ID, one location and
   one visit, and section counts are never summed as a unique total. Readings
   that fit no section stay reachable by room, History and the CSV export.

   Four independent kinds of state, never mixed:
     Coverage        Measured / Partly measured / Not yet measured /
                     Unable to assess / Not in this record. Derived only from
                     readings that exist and from recorded limits (a room's
                     access status, a reading recorded as No Access or
                     Obstructed). "Partly measured" needs a recorded limit.
                     Not applicable is never inferred: the schema holds no
                     applicability field yet, so a space the record does not
                     hold says "Not in this record".
     Interpretation  Only a supplied finding or recommendation
                     (issues_findings, upgrade_scenarios). Measured never
                     means good, complete, healthy or improved.
     Visit progress  From assessment_sessions (status, date) and released
                     reports. A scheduled visit holds no measured evidence.
                     No "revisit due" is created from the age of a reading.
     Commercial      No commercial table is readable by the portal, so the
                     Visits & payments panel states that no quote, invoice or
                     payment record is connected. Nothing is shown as owed,
                     and no demonstration amount is used.

   Home Map: floor plan first (geometry belongs to the matched model and is
   carried here by model URL; a property without matched geometry gets the
   room list and an honest note, never a guessed plan). The 3D view loads the
   existing matched model page from twin_models (sandbox allow-scripts only,
   no allow-same-origin), drives it through HS-MODEL-API-V1 (same messages as
   core V2.3+) and never sends record data into it.

   Reports: released reports open through the existing report-delivery
   function (authorise, audit, prove bytes). Visit record summaries are
   generated from the same readings and labelled as not being a report.

   Rollback: re-pin the webflow.io footer branch to
   homestate-core-v5-1.js@6dbd967 (or V2.4.1 @ad025e5). The custom domain is untouched by this
   file until Joe rules otherwise.
   ========================================================================== */
(function () {
  'use strict';

  var VERSION = '5.2.3';

  /* ---------- 0. Config + client (unchanged from V2.4.1) ---------- */
  const URLBASE = window.JB_SUPABASE_URL;
  const ANON = window.JB_SUPABASE_ANON;
  if (!URLBASE || !ANON) { console.error('[HS] missing JB_SUPABASE_URL / JB_SUPABASE_ANON'); return; }
  if (!window.supabase || !window.supabase.createClient) { console.error('[HS] supabase-js not loaded'); return; }
  const sb = window.supabase.createClient(URLBASE, ANON);

  /* Property choice kept for this tab, tied to the signed-in member and
     removed on sign out (V2.4 Axe correction 2, unchanged). */
  let HS_WHO = null;
  async function memberKey() {
    try { if (window.JBPortal && window.JBPortal.memberId) HS_WHO = (await window.JBPortal.memberId()) || null; } catch (e) { HS_WHO = null; }
    return HS_WHO;
  }
  function readChoice(who) {
    let v = null; try { v = JSON.parse(sessionStorage.getItem('hs_property') || 'null'); } catch (e) { v = null; }
    if (!v || typeof v.code !== 'string' || (v.member || null) !== (who || null)) { try { sessionStorage.removeItem('hs_property'); } catch (e) {} return null; }
    return v.code;
  }
  function writeChoice(code, who) { try { sessionStorage.setItem('hs_property', JSON.stringify({ code: String(code), member: who || null })); } catch (e) {} }
  document.addEventListener('click', e => {
    const t = e.target;
    if (t && t.closest && t.closest('.jb-signout, #jbLogoutBtn, [data-ms-action="logout"], [data-hs-signout]')) { try { sessionStorage.removeItem('hs_property'); } catch (err) {} }
  }, true);

  /* ---------- 0b. Which page, which destination ---------- */
  const PATH_SCREEN = { '/dashboard': 'home', '/digital-twin': 'map', '/diagnostics': 'history', '/pathway': 'home', '/reports': 'reports' };
  const SCREEN_PATH = { home: '/dashboard', map: '/digital-twin', history: '/diagnostics', reports: '/reports' };
  const PATH = location.pathname.replace(/\/+$/, '') || '/';
  if (!PATH_SCREEN[PATH]) return;          // not a portal screen: leave the page alone
  const OPEN_PAYMENTS = PATH === '/pathway';

  /* ---------- 1. Small helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uniq = a => Array.from(new Set(a.filter(v => v != null)));
  const hasValue = r => !!r && typeof r.value === 'number' && isFinite(r.value);
  const T = iso => { const t = Date.parse(iso); return isNaN(t) ? 0 : t; };
  const DATEFMT = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric' });
  const TIMEFMT = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false });
  const date = iso => { if (!iso) return 'Date not recorded'; const t = new Date(iso); return isNaN(t.getTime()) ? 'Date not recorded' : DATEFMT.format(t); };
  const time = iso => { if (!iso) return 'Time not recorded'; const t = new Date(iso); return isNaN(t.getTime()) ? 'Time not recorded' : TIMEFMT.format(t); };
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));

  const iconPaths = {
    home: 'M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7', map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16',
    history: 'M4 4v6h6M5 9a8 8 0 1 1 1 9M12 7v5l3 2', report: 'M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6M9 16h6',
    envelope: 'm12 3 9 5v9l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v9', environment: 'M9 15V5a3 3 0 0 1 6 0v10a5 5 0 1 1-6 0M12 8v9M19 7h2M19 11h2',
    wet: 'M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12ZM9 16c0 2 2 3 3 3', roof: 'm2 12 10-9 10 9M5 10v10h14V10M8 15h8',
    subfloor: 'm3 6 9-4 9 4-9 4ZM3 11l9 4 9-4M3 16l9 4 9-4', arrow: 'M5 12h14M13 6l6 6-6 6', close: 'm6 6 12 12M6 18 18 6',
    help: 'M9 8a3 3 0 1 1 5 3c-2 1-2 2-2 3M12 18h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', account: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2',
    play: 'm9 5 11 7-11 7Z', download: 'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5', info: 'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    signout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11'
  };
  const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[n] || iconPaths.info}"/></svg>`;
  const button = (text, action, arg, kind) => `<button type="button" class="${kind || 'btn light'}" data-action="${esc(action)}" data-id="${esc(arg == null ? '' : arg)}">${esc(text)}${icon('arrow')}</button>`;
  const chip = (text, kind) => `<span class="chip ${kind || ''}">${esc(text)}</span>`;

  /* ---------- 2. Data (contract unchanged from V2.4.1, plus reports read) ---------- */
  async function loadAll() {
    const { data: bs, error: bErr } = await sb.from('buildings').select('*').order('building_code');
    if (bErr) throw bErr;
    if (!bs || !bs.length) return { none: true };
    const demo = bs.filter(b => String(b.building_code || '').startsWith('DEMO-'));
    let want = null;
    const who = await memberKey();
    try { want = new URLSearchParams(location.search).get('p') || readChoice(who); } catch (e) {}
    const chosen = want ? bs.find(b => b.building_code === want) : null;
    const building = chosen || (demo.length ? demo[0] : bs[0]);
    if (chosen) writeChoice(chosen.building_code, who); else { try { sessionStorage.removeItem('hs_property'); } catch (e) {} }
    const bid = building.id;
    const [rooms, points, meas] = await Promise.all([
      sb.from('rooms').select('*').eq('building_id', bid).order('room_code'),
      sb.from('measurement_points').select('*').eq('building_id', bid),
      sb.from('measurements').select('*').eq('building_id', bid)
    ]).then(rs => rs.map(r => { if (r.error) throw r.error; return r.data || []; }));
    /* Supporting reads degrade to an honest "not available" on the view that
       needs them; they never blank the record or imply an empty result. */
    const soft = q => q.then(r => r.error ? null : (r.data || [])).catch(() => null);
    const [sessions, reports, findings, scen, twins, evidence] = await Promise.all([
      soft(sb.from('assessment_sessions').select('*').eq('building_id', bid).order('assessment_date')),
      soft(sb.from('reports').select('*').eq('building_id', bid).order('report_date', { ascending: false })),
      soft(sb.from('issues_findings').select('*').eq('building_id', bid)),
      soft(sb.from('upgrade_scenarios').select('*').eq('building_id', bid).order('phase')),
      soft(sb.from('twin_models').select('*').eq('building_id', bid)),
      soft(sb.from('evidence_assets').select('*').eq('building_id', bid))
    ]);
    const missedChoice = !!(want && !chosen);
    return { missedChoice, building, buildings: bs, who, rooms, points, meas, sessions, reports, findings, scen, twins, evidence };
  }

  /* ---------- 3. Matched model + model-owned plan geometry ---------- */
  const MATCHED_RE = /^https:\/\/joebuilds80\.github\.io\/joebuilds-portal-scripts\/[a-z0-9-]+\.html$/;
  /* Plan rectangles belong to the model definition, not to the record. They
     are carried here keyed by the model page they were taken from, so a
     property is drawn only when its own twin_models row points at that page.
     Source: demonstration-house-v1-1-1.html (sha256 bc78a9f9...e1e7),
     src/model/definition.js ROOMS and ZONES, as packaged by Axe in V5.1. */
  const MODEL_GEOMETRY = { 'demonstration-house-v1-1-1': {"source":"HOME STATE DEMONSTRATION HOUSE V1.1.1 src/model/definition.js ROOMS and ZONES (plan rectangles, mm, origin north-west internal corner of the ground floor, +x east, +z south)","levels":[{"id":"L1","name":"Ground floor"},{"id":"L2","name":"Upper floor"}],"rooms":[{"id":"HSD1-L1-FAM","code":"FAM","name":"Family / living","level":"L1","use":"living","wet":false,"parts":[[0,4600,0,7000]],"floor":"suspended timber on piers"},{"id":"HSD1-L1-DIN","code":"DIN","name":"Dining","level":"L1","use":"living","wet":false,"parts":[[4600,9400,0,3000]],"floor":"suspended timber on piers"},{"id":"HSD1-L1-KIT","code":"KIT","name":"Kitchen","level":"L1","use":"kitchen","wet":false,"parts":[[4600,9400,3000,7000]],"floor":"suspended timber on piers"},{"id":"HSD1-L1-GST","code":"GST","name":"Study / guest","level":"L1","use":"bedroom","wet":false,"parts":[[0,4600,7000,10800]],"floor":"slab on ground"},{"id":"HSD1-L1-LNG","code":"LNG","name":"Lounge","level":"L1","use":"living","wet":false,"parts":[[0,4600,10800,17000]],"floor":"slab on ground"},{"id":"HSD1-L1-ENT","code":"ENT","name":"Entry and hall","level":"L1","use":"circulation","wet":false,"parts":[[4600,7000,7000,10500],[7000,9400,7000,8800],[4600,8300,10500,16000],[8300,9400,10500,11000],[8300,9400,11000,15000],[8300,9400,15000,16000]],"floor":"slab on ground"},{"id":"HSD1-L1-PWD","code":"PWD","name":"Powder room","level":"L1","use":"wet","wet":true,"parts":[[7000,9400,8800,10500]],"floor":"slab on ground"},{"id":"HSD1-L1-LDY","code":"LDY","name":"Laundry","level":"L1","use":"wet","wet":true,"parts":[[9400,12000,7000,10500]],"floor":"slab on ground"},{"id":"HSD1-L1-GAR","code":"GAR","name":"Garage","level":"L1","use":"garage","wet":false,"parts":[[9400,15400,10500,17000],[12000,15400,8800,10500]],"floor":"slab on ground"},{"id":"HSD1-L2-BED3","code":"BED3","name":"Bedroom 3","level":"L2","use":"bedroom","wet":false,"parts":[[0,4600,8800,12600]],"floor":"suspended timber (upper floor)"},{"id":"HSD1-L2-BED2","code":"BED2","name":"Bedroom 2","level":"L2","use":"bedroom","wet":false,"parts":[[0,4600,12600,17000]],"floor":"suspended timber (upper floor)"},{"id":"HSD1-L2-BTH","code":"BTH","name":"Main bathroom","level":"L2","use":"wet","wet":true,"parts":[[4600,7200,8800,11000]],"floor":"suspended timber (upper floor)"},{"id":"HSD1-L2-LAND","code":"LAND","name":"Landing and hall","level":"L2","use":"circulation","wet":false,"parts":[[7200,9400,8800,11000],[4600,8300,11000,12400]],"floor":"suspended timber (upper floor)"},{"id":"HSD1-L2-VOID","code":"VOID","name":"Stair void","level":"L2","use":"void","wet":false,"parts":[[8300,9400,11000,15000]],"floor":"open to entry below"},{"id":"HSD1-L2-RET","code":"RET","name":"Retreat","level":"L2","use":"living","wet":false,"parts":[[4600,8300,12400,16000],[8300,9400,15000,16000]],"floor":"suspended timber (upper floor)"},{"id":"HSD1-L2-LIN","code":"LIN","name":"Linen and store","level":"L2","use":"store","wet":false,"parts":[[9400,12400,8800,10400]],"floor":"suspended timber (upper floor)"},{"id":"HSD1-L2-WIR","code":"WIR","name":"Walk-in robe","level":"L2","use":"store","wet":false,"parts":[[9400,12400,10400,12400]],"floor":"suspended timber (upper floor)"},{"id":"HSD1-L2-ENS","code":"ENS","name":"Ensuite","level":"L2","use":"wet","wet":true,"parts":[[12400,15400,8800,12400]],"floor":"suspended timber (upper floor)"},{"id":"HSD1-L2-BED1","code":"BED1","name":"Main bedroom","level":"L2","use":"bedroom","wet":false,"parts":[[9400,15400,12400,17000]],"floor":"suspended timber (upper floor)"}],"zones":[{"id":"HSD1-L1-POR","code":"POR","name":"Front porch","level":"L1","parts":[[4600,9400,16000,17000]]},{"id":"HSD1-L1-ALF","code":"ALF","name":"Rear alfresco","level":"L1","parts":[[9400,14000,0,5000]]},{"id":"HSD1-L2-BAL","code":"BAL","name":"Balcony","level":"L2","parts":[[4600,9400,16000,17000]]},{"id":"HSD1-SF-ZONE","code":"SUBFLOOR","name":"Underfloor zone","level":"SF","parts":[[0,9400,0,7000]]},{"id":"HSD1-RS-ZONE","code":"ROOF SPACE","name":"Main roof space","level":"RS","parts":[[0,15400,8800,17000]]}]} };

  /* ---------- 4. Adapter: the member's rows -> one connected record ---------- */
  const PARAM_BY_METHOD = {
    moisture_meter_relative: 'moisture', moisture_meter_pin_wme: 'moisture', surface_temp_ir: 'surface_temperature',
    air_temp: 'air_temperature', air_rh: 'relative_humidity', air_co2: 'co2'
  };
  const PARAM_NAME = {
    moisture: 'Moisture response', surface_temperature: 'Surface temperature', air_temperature: 'Air temperature',
    relative_humidity: 'Relative humidity', co2: 'CO\u2082', absolute_humidity: 'Moisture in the air', other: 'Recorded measurement'
  };
  const METHOD_NAME = {
    moisture_meter_relative: 'Non-invasive moisture meter \u00b7 relative scale', moisture_meter_pin_wme: 'Pin-probe moisture meter \u00b7 comparative WME scale',
    surface_temp_ir: 'Infrared surface temperature', air_temp: 'Air-temperature measurement', air_rh: 'Relative-humidity measurement', air_co2: 'CO\u2082 measurement'
  };
  const UNIT_CANON = {
    'degrees c': 'degC', 'degc': 'degC', '\u00b0c': 'degC', 'deg c': 'degC', 'percent rh': '%RH', '%rh': '%RH', '% rh': '%RH',
    'comparative': 'REL', 'rel': 'REL', 'ppm': 'ppm', 'g/kg': 'g/kg', '%wme': 'WME', 'wme': 'WME'
  };
  const UNIT_LABEL = { degC: '\u00b0C', '%RH': '% RH', ppm: 'ppm', REL: 'REL', WME: 'WME', 'g/kg': 'g/kg' };
  const unitKey = u => { const raw = String(u || '').trim(); return raw ? (UNIT_CANON[raw.toLowerCase()] || raw) : null; };
  const unitText = u => u ? (UNIT_LABEL[u] || u) : 'Unit not recorded';
  const methodText = m => m ? (METHOD_NAME[m] || m) : 'Method not recorded';
  const AIR_PARAMS = ['air_temperature', 'relative_humidity', 'co2', 'absolute_humidity'];

  function paramOf(m, pt) {
    const mc = String(m.method_code || m.reading_method || '').trim();
    if (PARAM_BY_METHOD[mc]) return PARAM_BY_METHOD[mc];
    const u = unitKey(m.unit);
    if (u === '%RH') return 'relative_humidity';
    if (u === 'ppm') return 'co2';
    if (u === 'g/kg') return 'absolute_humidity';
    if (u === 'REL' || u === 'WME') return 'moisture';
    if (u === 'degC') return /^room air/i.test(String(pt && pt.element_code || '')) ? 'air_temperature' : 'surface_temperature';
    return 'other';
  }
  const isRecordedStatus = s => /^(recorded|measured)?$/i.test(String(s || '').trim());

  function build(d) {
    const b = d.building;
    const isDemo = String(b.building_code || '').startsWith('DEMO-') || /demo|synthetic/i.test(String(b.record_class || ''));
    /* Joe, 6 Oct: Demo 1 is a real measured farmhouse record with the address and personal details removed. It is not synthetic, so it is labelled differently. */
    const isAnon = isDemo && /real measured record/i.test(String(b.status || ''));
    const twin = (d.twins || []).find(x => MATCHED_RE.test(String(x.model_url || ''))) || null;
    const modelKey = twin ? String(twin.model_url).replace(/^.*\/([a-z0-9-]+)\.html$/, '$1') : null;
    const GEO = modelKey && MODEL_GEOMETRY[modelKey] ? MODEL_GEOMETRY[modelKey] : null;
    /* A model page without HS-MODEL-API-V1 geometry here (for example the farmhouse True Building page) is shown as it is: its own controls, no commands posted in. */
    const standalone = !!twin && !GEO;
    const geoPrefix = GEO ? String((GEO.rooms[0] || {}).id || '').split('-')[0] : null;
    const LEVEL_NAME = { L1: 'Ground floor', L2: 'Upper floor', RS: 'Roof space', SF: 'Subfloor' };
    if (GEO) GEO.levels.forEach(l => { LEVEL_NAME[l.id] = l.name; });

    /* Rooms. Level comes from level_id (else floor_level words). */
    /* Records number levels differently (DEMO-001 uses L0 for ground, L1 for roof space), so the
       written floor_level wins when it is one of the known words; level_id is the fallback. */
    const levelOf = r => {
      const f = String(r.floor_level || '').toLowerCase().trim();
      if (/roof/.test(f)) return 'RS'; if (/sub ?floor|under ?floor/.test(f)) return 'SF';
      if (/^ground|^lower|^level 1$/.test(f)) return 'L1'; if (/^upper|^first|^level 2$/.test(f)) return 'L2';
      const t = String(r.room_type || '').toLowerCase();
      if (/roof/.test(t)) return 'RS'; if (/sub ?floor/.test(t)) return 'SF';
      const l = String(r.level_id || '').trim().toUpperCase();
      return l || 'L1';
    };
    const rooms = (d.rooms || []).map(r => {
      const level = levelOf(r);
      const name = r.room_name_current || r.room_name || r.room_code || 'Room';
      const kind = level === 'RS' || /roof/i.test(r.room_type || '') ? 'roof' : level === 'SF' || /subfloor|under ?floor/i.test(r.room_type || '') ? 'subfloor' : 'room';
      const wet = kind === 'room' && (/wet/i.test(r.room_type || '') || /bath|ensuite|en-suite|laundry|powder|toilet|\bwc\b/i.test(name));
      const access = String(r.access_status || '').trim();
      const limited = /limited|no access|not accessed|restricted|obstructed|unsafe|unable/i.test(access);
      const geoId = GEO ? geoPrefix + '-' + level + '-' + (kind === 'room' ? r.room_code : 'ZONE') : null;
      const geo = GEO ? GEO.rooms.concat(GEO.zones).find(g => g.id === geoId) || null : null;
      return { id: r.id, code: r.room_code, name, level, kind, wet, access, limited, desc: r.client_facing_description || '', geoId: geo ? geoId : null, parts: geo ? geo.parts : null, raw: r };
    });
    const roomBy = {}; rooms.forEach(r => { roomBy[r.id] = r; });
    const roomByGeo = {}; rooms.forEach(r => { if (r.geoId) roomByGeo[r.geoId] = r; });

    /* Visits (events). */
    const measBySession = {};
    (d.meas || []).forEach(m => { const k = m.assessment_id || '__none__'; measBySession[k] = (measBySession[k] || 0) + 1; });
    /* Released means published and not withdrawn, exactly as core V2.4.1 gates downloads. */
    const released = (d.reports || []).filter(r => r.client_visible === true && r.release_status === 'published' && !r.withdrawn_at && !r.archived);
    const events = (d.sessions || []).map(s => {
      const type = String(s.assessment_type || 'Visit').trim();
      const n = measBySession[s.assessment_id] || 0;
      const kind = /baseline/i.test(type) ? 'baseline' : (/intervention|change|works|upgrade/i.test(type) && !n) ? 'intervention' : /verification|follow/i.test(type) ? 'followup' : 'visit';
      const st = String(s.status || '').trim();
      const cancelled = /cancel/i.test(st);
      const done = /^(complete|completed|carried out|done)$/i.test(st) || n > 0;
      const scheduled = !done && !cancelled && T(s.assessment_date) > Date.now();
      const modelEvent = type.toUpperCase().replace(/\bRECORD\b/g, '').replace(/YEAR\s*(\d+)/g, 'Y$1').trim().replace(/\s+/g, '_');
      return {
        id: s.assessment_id, type, label: kind === 'followup' ? 'Follow-up visit' : kind === 'intervention' ? 'Recorded change' : type,
        kind, at: s.assessment_date, status: st, done, scheduled, cancelled, n, raw: s, modelEvent,
        report: released.find(r => r.assessment_id === s.assessment_id) || null
      };
    }).sort((a, z) => T(a.at) - T(z.at));
    const eventBy = {}; events.forEach(e => { eventBy[e.id] = e; });

    /* Readings: one row per measurement, keeping its own ID. */
    const ptBy = {}; (d.points || []).forEach(p => { ptBy[p.id] = p; });
    const readings = (d.meas || []).map(m => {
      const pt = ptBy[m.measurement_point_id] || null;
      const v = m.value === null || m.value === undefined || m.value === '' ? null : Number(m.value);
      return {
        reading_id: m.id, event_id: m.assessment_id || null, target_id: pt ? (pt.point_code || pt.id) : (m.measurement_point_id || m.id),
        point: pt, parameter: paramOf(m, pt), value: isFinite(v) ? v : null, unit: unitKey(m.unit),
        method: String(m.method_code || m.reading_method || '').trim() || null, device_id: m.device_id || null,
        recorded_at: m.measured_at || null, reading_status: m.reading_status || null, note: m.client_facing_wording || '',
        room: m.room_id || (pt && pt.room_id) || null
      };
    });
    const readingBy = {}; readings.forEach(r => { readingBy[r.reading_id] = r; });
    const byEvent = {}; events.forEach(e => { byEvent[e.id] = readings.filter(r => r.event_id === e.id); });
    const measurementEvents = events.filter(e => (byEvent[e.id] || []).some(hasValue));
    const lastVisit = measurementEvents.length ? measurementEvents[measurementEvents.length - 1] : null;
    const baseline = events.find(e => e.kind === 'baseline' && e.done) || measurementEvents[0] || null;
    const interventions = events.filter(e => e.kind === 'intervention');

    /* Sections: linked views, never buckets. */
    const isExternal = r => /external wall/i.test(String(r.point && r.point.element_code || '')) || /-[NSEW]-EXT(-|$)/.test(String(r.target_id || ''));
    function memberships(r) {
      const room = roomBy[r.room];
      if (room && room.kind === 'roof') return ['roof'];
      if (room && room.kind === 'subfloor') return ['subfloor'];
      const out = [];
      if (isExternal(r)) out.push('envelope');
      if (AIR_PARAMS.indexOf(r.parameter) !== -1) out.push('environment');
      if (room && room.wet) out.push('wet');
      return out;
    }
    readings.forEach(r => { r.sections = memberships(r); });
    const chapterRows = (id, ev) => readings.filter(r => (!ev || r.event_id === ev) && r.sections.indexOf(id) !== -1);

    function targetLabel(r) {
      const pt = r.point, room = roomBy[r.room];
      const tail = pt && pt.zone_code ? String(pt.zone_code).split('/').pop().trim() : '';
      /* Joe, 6 Oct 2026: external-wall readings are taken on the inside face of the outer wall. */
      const where = pt && pt.element_code ? String(pt.element_code).replace(/(external wall)\b(?!, inside face)/i, '$1, inside face') : 'Recorded location';
      return (room ? room.name : 'Property') + ' \u00b7 ' + where + (tail && tail !== (room && room.code) ? ' \u00b7 ' + tail : '');
    }

    return { b, isDemo, isAnon, standalone, twin, GEO, LEVEL_NAME, rooms, roomBy, roomByGeo, events, eventBy, readings, readingBy, byEvent, measurementEvents, lastVisit, baseline, interventions, chapterRows, targetLabel, released, findings: d.findings, scen: d.scen, reportsReadable: d.reports !== null, evidence: d.evidence === null ? null : (d.evidence || []).filter(e => e.client_visible === true), buildings: d.buildings, who: d.who, missedChoice: d.missedChoice };
  }

  /* ---------- 5. The five sections and their coverage ---------- */
  const CHAPTERS = [
    { id: 'envelope', title: 'External walls', subtitle: 'Inside face of the outer walls \u00b7 moisture & surface temperature', icon: 'envelope',
      description: 'Readings taken from inside the home, on the inside face of the outer walls. The outside of the walls was not tested.',
      boundary: 'Inside-face readings at accessible recorded locations only. The outside face, cladding and wall cavity were not tested. This is not a structural or whole-envelope assessment.' },
    { id: 'environment', title: 'Indoor environment', subtitle: 'Temperature, humidity & CO\u2082', icon: 'environment',
      description: 'Room-air readings linked to the room, the sensor position and the visit.',
      boundary: 'Room-air evidence in living spaces. Other parameters appear only where they were actually recorded. Roof-space and subfloor air belongs to those sections.' },
    { id: 'wet', title: 'Bathrooms & wet areas', subtitle: 'Bathroom, ensuite, laundry & powder room', icon: 'wet',
      description: 'A room-based view of the readings taken in the home\u2019s named wet rooms.',
      boundary: 'Named wet rooms and their linked surface and air readings. Surface readings and fan readings are different kinds of evidence; ventilation performance is not inferred.' },
    { id: 'roof', title: 'Roof space', subtitle: 'Above the ceiling', icon: 'roof',
      description: 'Measurements from accessible parts of the roof space, with access limits kept visible.',
      boundary: 'Accessible roof-space locations, readings and recorded access limits. Not the same thing as a complete roof assessment.' },
    { id: 'subfloor', title: 'Subfloor', subtitle: 'Below suspended ground floors', icon: 'subfloor',
      description: 'Measurements from the underfloor zone.',
      boundary: 'Actual underfloor zones only. Slab-on-ground areas are not treated as unmeasured subfloor.' }
  ];
  const chapterBy = {}; CHAPTERS.forEach(c => { chapterBy[c.id] = c; });

  function coverage(R, id) {
    const rows = R.chapterRows(id), taken = rows.filter(hasValue);
    const space = id === 'roof' ? R.rooms.filter(r => r.kind === 'roof') : id === 'subfloor' ? R.rooms.filter(r => r.kind === 'subfloor') : id === 'wet' ? R.rooms.filter(r => r.wet) : R.rooms.filter(r => r.kind === 'room');
    /* Every home has outer walls and rooms; roof space, subfloor and wet rooms
       count only where the record holds them. */
    const spaceKnown = id === 'envelope' || id === 'environment' ? true : space.length > 0;
    /* Recorded limits only: a room access status, or a reading recorded
       without a value and with a non-recorded status (No Access, Obstructed). */
    const limitRooms = (id === 'envelope' || id === 'environment') ? [] : space.filter(r => r.limited);
    /* A reading-level limit counts only where that location holds no value at
       any visit: a point obstructed once and measured at other visits is not
       a standing gap. Each limit stays dated in the detail. */
    const limitReadings = rows.filter(r => !hasValue(r) && !isRecordedStatus(r.reading_status) && !R.readings.some(x => x.target_id === r.target_id && hasValue(x)));
    const passing = rows.filter(r => !hasValue(r) && !isRecordedStatus(r.reading_status) && limitReadings.indexOf(r) === -1);
    const limits = [];
    limitRooms.forEach(r => limits.push(r.name + ': ' + (r.desc || ('access recorded as ' + r.access))));
    limitReadings.forEach(r => { const room = R.roomBy[r.room]; const t = (room ? room.name + ': ' : '') + (r.reading_status || 'Not recorded') + (r.note ? ' (' + r.note + ')' : '') + ', ' + date(r.recorded_at); if (limits.indexOf(t) === -1) limits.push(t); });
    let label, kind;
    if (!spaceKnown) { label = 'Not in this record'; kind = 'neutral'; }
    else if (!taken.length) { label = limits.length ? 'Unable to assess' : 'Not yet measured'; kind = 'neutral'; }
    else if (limits.length) { label = 'Partly measured'; kind = 'partial'; }
    else { label = 'Measured'; kind = ''; }
    /* Rooms in this section's space with no reading in it at any visit: stated as fact. */
    const roomsWith = uniq(taken.map(r => r.room));
    let unrecorded = [];
    if (id === 'environment') unrecorded = space.filter(r => !R.readings.some(x => x.room === r.id && hasValue(x) && AIR_PARAMS.indexOf(x.parameter) !== -1)).map(r => r.name);
    if (id === 'wet') unrecorded = space.filter(r => roomsWith.indexOf(r.id) === -1).map(r => r.name);
    const last = taken.slice().sort((a, z) => T(a.recorded_at) - T(z.recorded_at)).pop() || null;
    return { passing, rows, taken, locations: uniq(taken.map(r => r.target_id)).length, rooms: roomsWith, last, label, kind, limits, unrecorded, spaceKnown };
  }

  function latestRows(rs) {
    const m = new Map();
    rs.forEach(r => { const k = [r.target_id, r.parameter, r.method || '', r.unit || ''].join('|'); const o = m.get(k); if (!o || T(r.recorded_at) > T(o.recorded_at)) m.set(k, r); });
    return Array.from(m.values());
  }
  function representative(rs, param) {
    const a = rs.filter(r => r.parameter === param && hasValue(r));
    return a.find(r => /ENV\d+$/.test(String(r.point && r.point.zone_code || r.target_id))) || a.find(r => /AIR-M$/.test(String(r.target_id))) || a[0] || null;
  }
  const valueText = r => hasValue(r) ? r.value + ' ' + unitText(r.unit) : (r && r.reading_status ? r.reading_status : 'No reading');

  /* ---------- 6. Supplied next step ---------- */
  function nextStep(R) {
    /* Same open-finding rule as core V2.4.1; a row marked not client-visible is never shown. */
    const f = (R.findings || []).filter(x => String(x.client_facing_wording || '').trim() && /^(open|further investigation required)/i.test(String(x.status || '').trim()) && x.client_visible !== false);
    if (f.length) {
      const x = f[0];
      return { kicker: 'Your next step', title: 'A recorded finding to review', text: String(x.client_facing_wording), action: x.room_id && R.roomBy[x.room_id] ? ['Open this room', 'room', x.room_id] : ['Open the record', 'nav', 'history'], supplied: true };
    }
    const s = (R.scen || []).find(x => /available|open|current/i.test(String(x.status || '')) && String(x.client_facing_wording || x.title || '').trim());
    if (s) return { kicker: 'Your next step', title: String(s.title || 'Next step in your plan'), text: String(s.client_facing_wording || ''), action: ['Open your visits', 'payments', ''], supplied: true };
    const iv = R.interventions[R.interventions.length - 1];
    const after = iv ? R.measurementEvents.find(e => T(e.at) > T(iv.at)) : null;
    if (iv && after) return { kicker: 'In your record', title: 'Follow the recorded change', text: 'A recorded change on ' + date(iv.at) + ' and the measurement visit after it are connected in your history. Being later does not, on its own, show an improvement.', action: ['View the follow-up', 'event', after.id] };
    if (R.lastVisit) return { kicker: 'In your record', title: 'Open your latest visit', text: plural(R.byEvent[R.lastVisit.id].filter(hasValue).length, 'reading') + ' were recorded on ' + date(R.lastVisit.at) + '.', action: ['View this visit', 'event', R.lastVisit.id] };
    const sch = R.events.find(e => e.scheduled);
    if (sch) return { kicker: 'In your record', title: 'Your first visit is scheduled', text: date(sch.at) + '. A scheduled visit has no measured evidence yet.', action: ['Visits & payments', 'payments', ''] };
    return { kicker: 'In your record', title: 'Your record is ready for its first visit', text: 'Readings will appear here, linked to their room and visit, after your first measurement visit.', action: ['Visits & payments', 'payments', ''] };
  }

  /* ---------- 7. Shell ---------- */
  const CSS = "#hs51{--forest:#293c31;--forest2:#354b3d;--paper:#f5f0e6;--card:#fffcf5;--ink:#273b31;--muted:#646b60;--line:#d7d9cb;--sage:#e5ecdf;--sageink:#385340;--amber:#8b5827;--amberbg:#f6ebd7;--blue:#3d5e6b;--bluebg:#e9f0f2;--radius:5px;--shadow:0 16px 55px #223a3023}\n#hs51 *{box-sizing:border-box}#hs51{font-family:Inter,Segoe UI,Arial,sans-serif;font-size:16px;color:var(--ink);background:var(--paper);scroll-behavior:smooth}#hs51{margin:0}#hs51 button,#hs51 input,#hs51 select,#hs51 textarea{font:inherit}#hs51 button,#hs51 a{-webkit-tap-highlight-color:transparent}#hs51 button{color:inherit;cursor:pointer}#hs51 button:disabled{cursor:not-allowed;opacity:.55}#hs51 button:focus-visible,#hs51 a:focus-visible,#hs51 select:focus-visible,#hs51 input:focus-visible,#hs51 textarea:focus-visible,#hs51 summary:focus-visible,#hs51 [tabindex]:focus-visible{outline:3px solid #ad652a;outline-offset:4px}#hs51 button{min-height:44px}#hs51 button svg,#hs51 .icon svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}#hs51 button svg{pointer-events:none}#hs51 h1,#hs51 h2,#hs51 h3,#hs51 h4,#hs51 p{margin-top:0}#hs51 h1{font-size:clamp(28px,3.1vw,40px);font-weight:550;letter-spacing:-1.25px;line-height:1.17;margin-bottom:10px}#hs51 h2{font-size:22px;font-weight:550;letter-spacing:-.4px;line-height:1.3}#hs51 h3{font-size:19px;font-weight:570;line-height:1.32;letter-spacing:-.2px}#hs51 p{line-height:1.65}#hs51 a{color:inherit}#hs51 small,#hs51 .small{font-size:13px;line-height:1.65;color:var(--muted)}#hs51 .eyebrow{font:600 10px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:1.3px;text-transform:uppercase;color:var(--muted)}#hs51 .muted{color:var(--muted)}#hs51 .mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}#hs51 .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}#hs51 .skip{position:fixed;left:220px;top:-100px;background:var(--card);padding:14px;z-index:1000}#hs51 .skip:focus{top:12px}\n#hs51 .sidebar{position:fixed;inset:0 auto 0 0;width:204px;background:var(--forest);color:#f8f5e8;display:flex;flex-direction:column;z-index:30}#hs51 .brand{height:82px;display:flex;gap:12px;align-items:center;padding:22px;border-bottom:1px solid #ffffff12}#hs51 .brand svg{width:28px;height:28px;fill:none;stroke:#d8dfbc;stroke-width:1.25}#hs51 .brand b{font-weight:600;font-size:18px;letter-spacing:-.5px}#hs51 .brand small{display:block;color:#d2d8be;font:9px/1.7 ui-monospace,monospace;letter-spacing:1.5px;text-transform:uppercase}#hs51 .nav{padding:23px 12px;display:grid;gap:6px}#hs51 .nav button{display:flex;align-items:center;gap:12px;text-align:left;border:1px solid transparent;background:transparent;color:#c9d3c0;padding:11px 13px;border-radius:3px;font-size:14px}#hs51 .nav button[aria-current=page]{background:#e6ebd51a;color:#fffdf2;border-color:#e7efcf23}#hs51 .nav button:hover{background:#e6ebd512;color:white}#hs51 .side-bottom{margin-top:auto;border-top:1px solid #ffffff16;padding:22px;font-size:12px;color:#cbd5c1;line-height:1.7}#hs51 .side-bottom .eyebrow{color:#adbda9;margin-bottom:6px}#hs51 .side-bottom b{font-weight:500;color:#f0f1e1}#hs51 .app{margin-left:204px;min-height:100vh}#hs51 .topbar{height:66px;background:var(--forest2);color:#ecefdb;padding:0 36px;display:flex;align-items:center;justify-content:space-between;gap:16px}#hs51 .top-context{display:flex;gap:24px;font-size:12px}#hs51 .top-context .eyebrow{color:#b8c3a9;font-size:9px;margin-right:7px;display:inline}#hs51 .top-actions{display:flex;align-items:center;gap:9px}#hs51 .topbar button{border:1px solid #dbe3c941;background:#ffffff08;color:#f6f6e5;border-radius:3px;padding:8px 12px;font-size:12px;display:flex;align-items:center;gap:8px}#hs51 .topbar button:hover{background:#ffffff14}#hs51 .topbar svg{width:17px;height:17px}#hs51 .page{max-width:1340px;margin:0 auto;padding:34px 42px 54px}#hs51 .page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:22px;margin-bottom:23px}#hs51 .page-head .eyebrow{margin-bottom:11px}#hs51 .page-head p{margin-bottom:0;font-size:14px;max-width:660px;color:var(--muted)}#hs51 .demo-label{background:#fdf9ed;border:1px solid var(--line);font-size:11px;line-height:1.5;padding:7px 10px;border-radius:3px;white-space:nowrap;color:#656c5c;margin-top:8px}#hs51 .summary{display:flex;align-items:center;gap:0;flex-wrap:wrap;color:var(--muted);font-size:13px;margin-top:16px}#hs51 .summary span+span:before{content:'\u00b7';display:inline-block;margin:0 12px;color:#b0b29d}#hs51 .summary b{color:var(--ink);font-weight:600}#hs51 .visit-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 21px;background:#e9eddf;border:1px solid #d7decb;border-radius:var(--radius);margin:26px 0 28px}#hs51 .visit-strip h3{font-size:16px;margin:3px 0}#hs51 .visit-strip .small{font-size:12px}#hs51 .visit-strip .buttons{margin:0}#hs51 .section-head{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:14px}#hs51 .section-head h2{font-size:17px;letter-spacing:-.1px;margin:0}#hs51 .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--card)}#hs51 .tile{min-height:230px;text-align:left;background:var(--card);padding:24px;display:flex;flex-direction:column;position:relative;border:0;border-right:1px solid var(--line);border-bottom:1px solid var(--line);transition:background .15s}#hs51 .tile:nth-child(3n){border-right:0}#hs51 .tile:nth-child(n+4){border-bottom:0}#hs51 .tile:not(.next):hover{background:#f3f5e9}#hs51 .tile-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:23px}#hs51 .tile-top .icon{display:flex;align-items:center}#hs51 .tile h3{margin-bottom:8px;font-size:19px}#hs51 .tile p{font-size:13px;color:var(--muted);margin:0 0 14px;line-height:1.6}#hs51 .tile .bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;font-size:12px;font-weight:500}#hs51 .tile .bottom svg{width:17px;height:17px}#hs51 .chip{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border-radius:3px;background:var(--sage);color:var(--sageink);padding:5px 8px;font-size:10px;line-height:1.45;font-weight:600;letter-spacing:.15px}#hs51 .chip:before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0}#hs51 .chip.partial,#hs51 .chip.warn{color:var(--amber);background:var(--amberbg)}#hs51 .chip.neutral{color:#626959;background:#eff0e7}#hs51 .chip.blue{color:var(--blue);background:var(--bluebg)}#hs51 .next{background:var(--forest);color:#fbf8eb;border:0;cursor:default}#hs51 .next .eyebrow{color:#c4cbb0}#hs51 .next h3{font-size:21px;max-width:280px;margin:12px 0}#hs51 .next p{color:#d4dcc6;font-size:13px;margin-bottom:19px}#hs51 .next button{margin-top:auto;align-self:flex-start}#hs51 .btn{background:var(--forest);color:#faf8ec;border:1px solid var(--forest);border-radius:3px;padding:11px 15px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:9px;font-size:13px;font-weight:500;line-height:1.4;text-decoration:none}#hs51 .btn:hover{background:#415844}#hs51 .btn.light{background:transparent;border:1px solid var(--line);color:var(--ink)}#hs51 .btn.light:hover{background:var(--sage)}#hs51 .btn.on{background:var(--forest);color:#fffdf4;border-color:var(--forest)}#hs51 .next .btn{border-color:#829077;background:#ffffff08;color:#fcfaed}#hs51 .next .btn:hover{background:#ffffff14}#hs51 .btn svg{width:17px;height:17px}#hs51 .link{padding:0;min-height:44px;background:none;border:0;display:inline-flex;gap:7px;align-items:center;color:var(--forest);font-size:13px;font-weight:550;text-align:left}#hs51 .link:hover{text-decoration:underline}#hs51 .link svg{width:15px;height:15px}#hs51 .buttons{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}#hs51 .footnote{font-size:12px;line-height:1.6;color:var(--muted);margin:16px 0 0}#hs51 .home-foot{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-top:25px;padding-top:18px;border-top:1px solid var(--line)}#hs51 .home-foot p{font-size:13px;margin:0;color:var(--muted)}#hs51 .bottom-nav{display:none}#hs51 .notice{padding:14px 16px;border:1px solid #d4ddcc;background:#edf2e7;font-size:13px;line-height:1.6;border-radius:3px;margin:17px 0}#hs51 .notice.warn{background:#faf0e0;border-color:#e7d5b9}#hs51 .notice.blue{background:var(--bluebg);border-color:#d4e1e5}#hs51 .notice b{font-weight:600}#hs51 .panel{border:1px solid var(--line);background:var(--card);padding:24px;border-radius:var(--radius)}#hs51 .split{display:grid;grid-template-columns:1.1fr 1fr;gap:20px}#hs51 .detail-section{padding:20px 0;border-top:1px solid var(--line);margin-top:20px}#hs51 .detail-section h3{font-size:16px;margin-bottom:13px}#hs51 .list{display:grid;gap:0}#hs51 .row{display:flex;align-items:center;justify-content:space-between;gap:18px;border-top:1px solid var(--line);padding:15px 0}#hs51 .row:first-child{border-top:0}#hs51 .row h4{font-size:14px;font-weight:550;margin:0 0 4px}#hs51 .row p{font-size:12px;margin:0;color:var(--muted);line-height:1.6}#hs51 .row button{flex-shrink:0}#hs51 .room-row{background:transparent;border:0;border-top:1px solid var(--line);width:100%;padding:14px 0;text-align:left;display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:64px}#hs51 .room-row:first-child{border-top:0}#hs51 .room-row:hover{background:var(--sage)}#hs51 .room-row b{font-weight:550;font-size:14px;display:block}#hs51 .room-row small{display:block;font-size:12px}#hs51 .room-row .count{font:12px ui-monospace,monospace;color:var(--muted);white-space:nowrap}#hs51 .modal{width:min(750px,calc(100% - 32px));max-height:calc(100dvh - 48px);border:1px solid var(--line);border-radius:7px;background:var(--card);padding:0;color:var(--ink);box-shadow:var(--shadow)}#hs51 .modal::backdrop{background:#142a225f;backdrop-filter:blur(3px)}#hs51 .modal-head{padding:23px 28px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:15px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card);z-index:2}#hs51 .modal-head h2{margin:6px 0 0;font-size:23px}#hs51 .modal-head button{min-width:44px;min-height:44px;border:1px solid var(--line);background:transparent;display:flex;align-items:center;justify-content:center;border-radius:3px}#hs51 .modal-body{padding:23px 28px 28px}#hs51 .modal-body p{font-size:14px;line-height:1.65}#hs51 .modal-body .lead{font-size:15px}#hs51 .modal-body details{border-top:1px solid var(--line);padding:14px 0;margin-top:18px}#hs51 .modal-body summary{cursor:pointer;font-size:13px;line-height:1.5;min-height:44px;display:flex;align-items:center;gap:8px}#hs51 .modal-body summary:before{content:'+';font-size:18px}#hs51 .modal-body details[open]>summary:before{content:'\u2212'}#hs51 .kvs{display:grid;grid-template-columns:minmax(90px,.75fr) 1.5fr;gap:11px 18px;font-size:12px;line-height:1.55}#hs51 .kvs dt{color:var(--muted)}#hs51 .kvs dd{margin:0;overflow-wrap:anywhere}#hs51 .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:3px}#hs51 table{border-collapse:collapse;width:100%;font-size:12px;line-height:1.55}#hs51 th{text-align:left;padding:11px 12px;background:#eff0e6;font-size:11px;font-weight:600;color:var(--muted)}#hs51 td{padding:12px;border-top:1px solid var(--line);vertical-align:top}#hs51 td strong{font-weight:600}#hs51 td small{font-size:10px;display:block}#hs51 .data-value{font-size:18px;font-weight:500;white-space:nowrap}#hs51 .data-value small{font-size:11px}#hs51 .pagination{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px;margin-top:15px}#hs51 .filters{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin:20px 0}#hs51 .field{display:flex;flex-direction:column;gap:6px;flex:1;min-width:140px}#hs51 .field label{font-size:11px;font-weight:550;color:var(--muted)}#hs51 select,#hs51 input,#hs51 textarea{max-width:100%;width:100%;background:var(--card);color:var(--ink);border:1px solid #bfc8b8;border-radius:3px;padding:11px 12px;min-height:44px;font-size:13px}#hs51 textarea{resize:vertical;min-height:100px}#hs51 .metric-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}#hs51 .metric-card{border:1px solid var(--line);background:#f3f5ed;padding:14px;border-radius:3px}#hs51 .metric-card .value{font-size:22px;font-weight:550;margin:9px 0 5px}#hs51 .metric-card .small{font-size:10px}#hs51 .map-layout{display:grid;grid-template-columns:minmax(0,1fr) 286px;gap:18px}#hs51 .map-panel{background:var(--card);border:1px solid var(--line);border-radius:5px;overflow:hidden;min-width:0}#hs51 .map-toolbar{padding:13px 16px;display:flex;gap:9px;justify-content:space-between;flex-wrap:wrap;border-bottom:1px solid var(--line)}#hs51 .seg{display:flex;gap:4px;align-items:center;flex-wrap:wrap}#hs51 .seg button{border:1px solid transparent;background:transparent;padding:8px 12px;font-size:12px;min-height:44px;border-radius:3px}#hs51 .seg button[aria-pressed=true]{background:var(--forest);color:#fdfcee}#hs51 .seg button:hover:not([aria-pressed=true]){background:var(--sage)}#hs51 .map-stage{height:530px;position:relative;background:#f2f1e7}#hs51 .map-stage svg.plan{width:100%;height:100%;display:block}#hs51 .map-stage iframe{width:100%;height:100%;border:0;display:block}#hs51 .plan .room-shape{fill:#e2e9dc;stroke:#546750;stroke-width:70;transition:fill .15s}#hs51 .plan .room-group:hover .room-shape,#hs51 .plan .room-group:focus .room-shape{fill:#c3d4b6;stroke:#48693e;stroke-width:120}#hs51 .plan .room-group[aria-pressed=true] .room-shape{fill:#afc99e;stroke:#39573c;stroke-width:150}#hs51 .plan .room-no-data .room-shape{fill:#efece0}#hs51 .plan text{font-family:Segoe UI,Arial,sans-serif;fill:#314637;pointer-events:none}#hs51 .map-caption{padding:11px 16px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);line-height:1.6}#hs51 .map-sidebar{padding:20px;max-height:716px;overflow:auto}#hs51 .map-sidebar h3{font-size:16px}#hs51 .map-sidebar .room-row{padding:10px 0;min-height:57px}#hs51 .map-sidebar .room-row b{font-size:12px}#hs51 .map-sidebar .room-row small{font-size:10px}#hs51 .map-sidebar .room-row[aria-pressed=true]{background:var(--sage)}#hs51 .loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#f0f0e6;font-size:14px;color:var(--muted);z-index:1}#hs51 .loading[hidden]{display:none}#hs51 .selected-room{margin-top:18px}#hs51 .selected-room .room-summary{display:flex;align-items:center;justify-content:space-between;gap:20px}#hs51 .selected-room .room-summary h2{margin:4px 0 0}#hs51 .map-options{margin:0 0 18px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}#hs51 .map-options .field{max-width:270px}#hs51 .map-options label{font-size:10px}#hs51 .timeline{position:relative}#hs51 .event-card{position:relative;border:1px solid var(--line);border-left:3px solid #a1b498;background:var(--card);padding:22px;margin:0 0 15px;border-radius:3px}#hs51 .event-card.selected{border-left-color:var(--forest);box-shadow:0 0 0 1px #718464}#hs51 .event-top{display:flex;justify-content:space-between;gap:14px;align-items:start}#hs51 .event-card h3{margin:7px 0 8px;font-size:17px}#hs51 .event-card p{font-size:12px;margin:0 0 10px;color:var(--muted)}#hs51 .event-card .eyebrow{font-size:9px}#hs51 .history-layout{display:grid;grid-template-columns: minmax(240px,.8fr) minmax(0,1.5fr);gap:24px}#hs51 .history-detail{align-self:start;position:sticky;top:20px}#hs51 .event-nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px}#hs51 .event-nav .btn{font-size:11px;padding:8px 11px}#hs51 .context-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0}#hs51 .context-grid div{border:1px solid var(--line);padding:12px;background:#f6f5ec;border-radius:3px}#hs51 .context-grid small{display:block;font-size:10px}#hs51 .context-grid b{display:block;margin-top:5px;font-size:14px;font-weight:500}#hs51 .report-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:20px;padding:21px 0;border-top:1px solid var(--line)}#hs51 .report-card:first-child{border-top:0}#hs51 .report-card .icon{width:46px;height:55px;display:flex;align-items:center;justify-content:center;background:var(--sage);border-radius:3px}#hs51 .report-card h3{font-size:16px;margin:0 0 5px}#hs51 .report-card p{font-size:12px;margin:0;color:var(--muted)}#hs51 .report-card .buttons{margin:0}#hs51 .report-sheet h3{font-size:16px;margin-top:25px}#hs51 .report-sheet p{font-size:12px;line-height:1.7}#hs51 .report-sheet .report-title{font-size:23px}#hs51 .invoice-total{padding:16px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-weight:550}#hs51 .invoice-total .number{font:20px ui-monospace,monospace}#hs51 .tourbar{position:fixed;right:26px;bottom:25px;max-width:425px;background:var(--forest);color:#fdf9ec;box-shadow:var(--shadow);border:1px solid #849075;padding:17px 20px;border-radius:6px;z-index:80}#hs51 .tourbar[hidden]{display:none}#hs51 .tourbar .eyebrow{color:#c4cfb6}#hs51 .tourbar p{font-size:13px;margin:7px 0 13px;line-height:1.5}#hs51 .tourbar .tour-actions{display:flex;justify-content:space-between;gap:6px}#hs51 .tourbar .btn{border-color:#9baa89;color:#fdf9ec;background:transparent;font-size:11px;padding:8px 12px}#hs51 .tourbar .btn.primary{background:#f4f5df;color:var(--forest)}#hs51 .toast{position:fixed;left:calc(50% + 90px);bottom:28px;transform:translateX(-50%);background:var(--forest);color:#fffef3;font-size:13px;line-height:1.5;padding:13px 18px;border-radius:5px;box-shadow:var(--shadow);z-index:150;max-width:90vw}#hs51 .toast[hidden]{display:none}#hs51 .inline-gap{color:var(--amber)}#hs51 .empty{text-align:center;padding:30px 20px;background:#f2f3e9;border:1px dashed #b5bdaa;border-radius:4px;font-size:13px;line-height:1.65}#hs51 .room-reading-chart{width:100%;height:180px;display:block;background:#f6f6ef;border:1px solid var(--line);border-radius:3px;margin:17px 0}#hs51 .chart-note{font-size:11px!important;color:var(--muted)}#hs51 .hidden,#hs51 [hidden]{display:none!important}#hs51 .walk-highlight{box-shadow:0 0 0 3px #aa763e;outline-offset:4px}#hs51 .no-wrap{white-space:nowrap}\n@media(min-width:1600px){#hs51 .page{padding-top:42px}#hs51 .tile{min-height:249px;padding:27px}#hs51 .grid{margin-top:19px}#hs51 .visit-strip{margin-top:30px;margin-bottom:31px}}\n@media(max-width:1150px){#hs51 .sidebar{width:180px}#hs51 .app{margin-left:180px}#hs51 .brand{padding:18px}#hs51 .page{padding:28px}#hs51 .topbar{padding:0 27px}#hs51 .top-context{gap:10px}#hs51 .top-context .climate{display:none}#hs51 .tile{padding:19px;min-height:230px}#hs51 .tile h3{font-size:17px}#hs51 .map-layout{grid-template-columns:minmax(0,1fr) 235px}#hs51 .map-sidebar{padding:15px}#hs51 .top-actions .account-label{display:none}#hs51 .demo-label{font-size:10px}#hs51 .toast{left:calc(50% + 80px)}}\n@media(max-width:870px){#hs51 .sidebar{width:160px}#hs51 .app{margin-left:160px}#hs51 .brand{padding:16px 12px}#hs51 .brand b{font-size:16px}#hs51 .brand svg{width:24px}#hs51 .nav{padding:21px 8px}#hs51 .nav button{padding:10px;font-size:13px;gap:9px}#hs51 .page{padding:26px 22px 40px}#hs51 .topbar{padding:0 22px}#hs51 .top-context .eyebrow{display:none}#hs51 .topbar .help-label{display:none}#hs51 .page-head{display:block}#hs51 .demo-label{display:inline-block;margin:15px 0 0}#hs51 .grid{grid-template-columns:repeat(2,minmax(0,1fr))}#hs51 .tile:nth-child(3n){border-right:1px solid var(--line)}#hs51 .tile:nth-child(2n){border-right:0}#hs51 .tile:nth-child(4){border-bottom:1px solid var(--line)}#hs51 .tile:nth-child(n+5){border-bottom:0}#hs51 .tile{min-height:220px}#hs51 .visit-strip{align-items:flex-start}#hs51 .visit-strip .buttons{flex-direction:column;flex-shrink:0}#hs51 .split,#hs51 .history-layout{grid-template-columns:1fr}#hs51 .history-detail{position:static}#hs51 .map-layout{grid-template-columns:1fr}#hs51 .map-sidebar{max-height:270px}#hs51 .map-sidebar .list{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}#hs51 .report-card{grid-template-columns:auto 1fr}#hs51 .report-card>.buttons{grid-column:2}#hs51 .topbar{gap:8px}#hs51 .top-context{font-size:11px}#hs51 .topbar button{font-size:11px;padding:8px 10px}#hs51 .home-foot{align-items:flex-start}#hs51 .home-foot .link{flex-shrink:0}}\n@media(max-width:600px){#hs51{font-size:16px}#hs51 .sidebar{display:none}#hs51 .app{margin-left:0}#hs51 .topbar{height:62px;padding:0 16px}#hs51 .top-context{font-size:13px;font-weight:500}#hs51 .top-context .record-status{display:none}#hs51 .top-actions{gap:6px}#hs51 .top-actions button{min-width:44px;padding:8px}#hs51 .topbar .payment-label{display:none}#hs51 .page{padding:26px 18px 100px}#hs51 .page-head{margin-bottom:20px}#hs51 .page-head p{font-size:13px;line-height:1.6}#hs51 .page-head .eyebrow{font-size:9px}#hs51 h1{font-size:31px}#hs51 .summary{font-size:11px;line-height:1.8}#hs51 .summary span+span:before{margin:0 8px}#hs51 .demo-label{font-size:10px;margin-top:13px}#hs51 .visit-strip{display:block;padding:15px 16px;margin:21px 0 23px}#hs51 .visit-strip .buttons{flex-direction:row;margin-top:10px}#hs51 .visit-strip .btn{font-size:11px;padding:8px 10px}#hs51 .section-head h2{font-size:16px}#hs51 .grid{grid-template-columns:1fr}#hs51 .tile{border-right:0!important;border-bottom:1px solid var(--line)!important;min-height:174px;padding:20px}#hs51 .tile:last-child{border-bottom:0!important}#hs51 .tile-top{margin-bottom:15px}#hs51 .tile h3{font-size:19px;margin-bottom:6px}#hs51 .tile p{font-size:12px;margin-bottom:13px}#hs51 .tile .bottom{font-size:12px}#hs51 .tile.next{min-height:225px}#hs51 .chip{font-size:10px}#hs51 .home-foot{display:block;margin-top:20px}#hs51 .home-foot .link{margin-top:10px}#hs51 .bottom-nav{position:fixed;bottom:0;left:0;right:0;display:grid;grid-template-columns:repeat(4,1fr);padding:7px 8px calc(7px + env(safe-area-inset-bottom));background:var(--forest);border-top:1px solid #b1bf99;z-index:90}#hs51 .bottom-nav button{background:transparent;color:#d3dfc6;border:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:10px;min-height:47px;border-radius:3px}#hs51 .bottom-nav button[aria-current=page]{background:#e4ebd319;color:#fffdf0}#hs51 .bottom-nav button svg{width:19px;height:19px}#hs51 .modal{width:calc(100% - 20px);max-height:calc(100dvh - 24px);border-radius:5px}#hs51 .modal-head{padding:19px 18px 13px}#hs51 .modal-head h2{font-size:21px}#hs51 .modal-body{padding:19px 18px 25px}#hs51 .modal-body p{font-size:13px}#hs51 .metric-cards{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}#hs51 .metric-card{padding:11px 9px}#hs51 .metric-card .value{font-size:18px}#hs51 .metric-card .eyebrow{font-size:8px;letter-spacing:.4px}#hs51 .buttons .btn{font-size:12px}#hs51 .panel{padding:18px}#hs51 .map-stage{height:415px}#hs51 .map-toolbar{padding:8px 10px}#hs51 .seg button{font-size:11px;padding:8px 10px}#hs51 .map-options{gap:9px}#hs51 .map-options .field{max-width:none}#hs51 .map-sidebar .list{grid-template-columns:1fr 1fr}#hs51 .map-sidebar .room-row b{font-size:11px}#hs51 .map-sidebar .room-row .count{font-size:10px}#hs51 .selected-room .room-summary{display:block}#hs51 .selected-room .room-summary>.buttons{margin-top:12px}#hs51 .report-card{padding:20px 0;gap:13px}#hs51 .report-card h3{font-size:14px}#hs51 .report-card p{font-size:11px}#hs51 .report-card .icon{width:38px;height:49px}#hs51 .report-card>.buttons{grid-column:1/-1}#hs51 .report-card>.buttons .btn{flex:1}#hs51 .tourbar{left:12px;right:12px;bottom:78px;max-width:none;padding:14px 16px}#hs51 .toast{left:50%;bottom:86px;width:calc(100% - 32px)}#hs51 .skip{left:12px}#hs51 .filters{gap:10px}#hs51 .field{min-width:130px}#hs51 .pagination{gap:6px}#hs51 .pagination .btn{padding:8px;font-size:11px}#hs51 .kvs{grid-template-columns:90px 1fr;gap:9px;font-size:11px}#hs51 .context-grid{gap:7px}#hs51 .context-grid div{padding:10px}#hs51 .report-sheet .report-title{font-size:21px}}\n@media(prefers-reduced-motion:reduce){#hs51 *,#hs51 *:before,#hs51 *:after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}\n@media print{#hs51 .sidebar,#hs51 .topbar,#hs51 .bottom-nav,#hs51 .tourbar,#hs51 .toast,#hs51 .buttons,#hs51 .btn,#hs51 .link,#hs51 .skip,#hs51 .map-toolbar{display:none!important}#hs51 .app{margin:0}#hs51 .page{padding:0;max-width:100%}#hs51 .modal[open]{position:static;max-height:none;width:100%;border:0;box-shadow:none}#hs51 .modal[open]~*{display:none!important}#hs51 .modal-head{position:static}#hs51 .modal-head button{display:none}#hs51 .modal::backdrop{background:none}#hs51:has(dialog[open]) .app{display:none}#hs51 .grid,#hs51 .tile,#hs51 .panel{break-inside:avoid}#hs51 .demo-label{display:block!important}}\n\n\n#hs51 .tile .bottom small{display:block;font-size:11px;font-weight:400;margin-top:4px}\n@media(min-width:871px){\n#hs51 .page{padding-top:26px;padding-bottom:30px}\n#hs51 .page-head{margin-bottom:15px}#hs51 .summary{margin-top:12px}\n#hs51 .visit-strip{margin:20px 0 18px;padding:14px 19px}\n#hs51 .tile{min-height:202px;padding:21px}#hs51 .tile-top{margin-bottom:16px}\n#hs51 .tile p{margin-bottom:10px}#hs51 .tile h3{font-size:18px}#hs51 .next h3{font-size:20px}\n#hs51 .next p{margin-bottom:12px}#hs51 .grid{margin-top:0}\n#hs51 .home-foot{margin-top:17px;padding-top:12px}#hs51 .footnote{margin-top:12px}\n}\n@media(max-width:600px){\n#hs51 .top-actions button span{display:none}#hs51 .top-actions button{width:44px}\n#hs51 .tile{min-height:177px}#hs51 .tile .bottom small{font-size:11px}\n#hs51 .tile.next{min-height:207px}\n}\n\n\n#hs51 .history-layout .timeline{gap:0;position:relative;border-left:1px solid var(--line);margin-left:7px;padding-left:19px}\n#hs51 .history-layout .event-card{position:relative;padding:14px 17px;margin:0 0 10px;min-height:0}\n#hs51 .history-layout .event-card:before{content:\"\";position:absolute;width:9px;height:9px;border:2px solid var(--paper);border-radius:50%;background:#879880;left:-27px;top:21px}\n#hs51 .history-layout .event-card.selected:before{background:var(--forest);box-shadow:0 0 0 3px #dfe7d7}\n#hs51 .history-layout .event-card h3{font-size:16px;margin:8px 0 5px}\n#hs51 .history-layout .event-card p{font-size:12px;margin:0}\n#hs51 .history-layout .event-card .link{padding-top:7px;padding-bottom:5px;margin-top:2px;min-height:38px;font-size:12px}\n#hs51 .history-detail{position:sticky;top:20px;align-self:start}\n@media(max-width:870px){#hs51 .history-detail{position:static}}\n\n#hs51 .model-preview-image{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center top;background:#f4eee3}\n#hs51 .model-preview-note{position:absolute;bottom:12px;left:12px;right:12px;background:#fffdf3ee;border:1px solid var(--line);padding:12px 15px;font-size:12px;line-height:1.6;border-radius:3px}#hs51 .model-preview-note .buttons{margin-top:6px}\n\n@media(max-width:600px){\n #hs51 .visit-strip .buttons{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px}\n #hs51 .visit-strip .buttons .btn{font-size:11px;padding:9px 8px;gap:5px;min-height:44px}\n #hs51 .visit-strip .buttons .btn svg{width:13px;height:13px}\n #hs51 .tile{min-height:157px;padding:18px 20px}#hs51 .tile-top{margin-bottom:12px}\n #hs51 .tile.next{order:-1;min-height:178px}#hs51 .tile.next h3{margin:8px 0}#hs51 .tile.next p{margin-bottom:11px}\n #hs51 .page-head{margin-bottom:15px}#hs51 .visit-strip{margin:17px 0 18px}\n}\n";
  const EXTRA_CSS = '#hs51{min-height:100vh;position:relative;z-index:1;line-height:normal;text-align:left}#hs51 .sidebar .side-bottom button{margin-top:12px;border:1px solid #ffffff2a;background:transparent;color:#e8eedb;border-radius:3px;padding:8px 10px;display:flex;gap:8px;align-items:center;font-size:12px}#hs51 .picker{display:flex;align-items:center;gap:8px;font-size:12px}#hs51 .picker select{min-height:36px;padding:6px 8px;font-size:12px;background:#ffffff10;color:#f6f6e5;border-color:#dbe3c941;width:auto}#hs51 .picker option{color:#273b31}#hs51 .topbar .pick{min-height:36px;padding:6px 12px;font-size:12px;border:1px solid #dbe3c941;background:#ffffff08;color:#e9eedb;border-radius:3px}#hs51 .topbar .pick.on{background:#f4f5df;color:#293c31;border-color:#f4f5df;font-weight:600}@media(max-width:600px){#hs51 .picker .eyebrow{display:none}#hs51 .topbar .pick{padding:6px 8px;font-size:11px}}#hs51 .plan-empty{height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:30px;font-size:13px;color:var(--muted)}#hs51 .room-row .chip{flex-shrink:0}#hs51 .model-note{position:absolute;left:12px;right:12px;bottom:12px;background:#fffdf3ee;border:1px solid var(--line);padding:10px 13px;font-size:12px;line-height:1.55;border-radius:3px;z-index:2}#hs51 .loading-record{padding:60px 20px;text-align:center;color:var(--muted);font-size:14px}#hs51 h1:focus{outline:none}#hs51 .next .btn svg{stroke:currentColor}#hs51 .hero{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,1fr);gap:18px;background:linear-gradient(160deg,#e7ede1 0%,#fffcf5 60%,#f6efe3 100%);border:1px solid var(--line);border-radius:8px;padding:26px 28px;margin-bottom:6px}#hs51 .hero h1{margin:8px 0 4px}#hs51 .hero-type{font-size:14px;color:var(--muted);margin:0 0 16px}#hs51 .hero-ctx{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#hs51 .hero-ctx div{background:#fffcf5cc;border:1px solid var(--line);border-radius:4px;padding:11px 13px}#hs51 .hero-ctx small{display:block;font:600 9.5px/1.5 ui-monospace,Consolas,monospace;letter-spacing:1.1px;text-transform:uppercase;color:var(--muted)}#hs51 .hero-ctx b{display:block;font-size:14px;font-weight:550;margin-top:3px}#hs51 .hero-ctx span{display:block;font-size:11px;color:var(--muted);margin-top:2px;line-height:1.45}#hs51 .hero-note{font-size:12px;color:var(--muted);margin:12px 0 0}#hs51 .hero-side{display:flex;flex-direction:column;gap:12px}#hs51 .hero-model{position:relative;height:230px;border-radius:5px;overflow:hidden;border:1px solid var(--line);background:#eef1ea}#hs51 .hero-model iframe{width:100%;height:100%;border:0;display:block}#hs51 .hero-model-note{position:absolute;left:8px;bottom:8px;background:#fffcf5e6;font-size:11px;padding:4px 8px;border-radius:3px}#hs51 .hero-stats{background:var(--card);border:1px solid var(--line);border-radius:5px;padding:16px 18px}#hs51 .stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}#hs51 .stat-grid div{background:#f3f5ed;border-radius:3px;padding:9px 11px}#hs51 .stat-grid small{display:block;font-size:10.5px;color:var(--muted)}#hs51 .stat-grid b{font-size:22px;font-weight:500}#hs51 .depth-mini div{display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:6px 0;border-top:1px solid var(--line)}#hs51 .depth-mini span{color:var(--muted)}#hs51 .depth-mini b{font-weight:550;text-align:right}#hs51 .tabs{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 18px}#hs51 .tabs button{border:1px solid var(--line);background:transparent;border-radius:3px;padding:8px 14px;font-size:13px}#hs51 .tabs button[aria-selected=true]{background:var(--forest);color:#fdfcee;border-color:var(--forest)}#hs51 .cond-table td:first-child{font-weight:600;white-space:nowrap}#hs51 .depth-list .row{align-items:flex-start}#hs51 .ev-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:12px}#hs51 .ev-card{border:1px solid var(--line);border-radius:4px;padding:14px;background:var(--card)}#hs51 .ev-card h4{margin:0 0 4px;font-size:14px}#hs51 .ev-img{max-width:100%;height:auto;display:block;border-radius:3px}@media(max-width:870px){#hs51 .hero{grid-template-columns:1fr;padding:20px}#hs51 .hero-model{height:200px}}@media(max-width:600px){#hs51 .hero-ctx{grid-template-columns:1fr 1fr}#hs51 .hero-ctx b{font-size:13px}#hs51 .hero-model{display:none}#hs51 .hero{padding:18px 16px}}';
  function injectCss() { if (document.getElementById('hs51-css')) return; const st = document.createElement('style'); st.id = 'hs51-css'; st.textContent = CSS + EXTRA_CSS; document.head.appendChild(st); }

  function buildShell() {
    /* Hide, never delete. Removing the footer script line restores the old page. */
    Array.prototype.forEach.call(document.body.children, el => {
      if (el.id === 'hs51' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return;
      el.setAttribute('data-hs-hidden', '1'); el.style.display = 'none';
    });
    const root = document.createElement('div');
    root.id = 'hs51'; root.setAttribute('data-hs-version', VERSION);
    root.innerHTML =
      '<a href="#hs51-content" class="skip">Skip to home record</a>' +
      '<aside class="sidebar"><div class="brand"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="m4 16 14-11 14 11M8 13v17h20V13M18 14v11M18 22c-7 0-10-4-10-9 6 0 10 3 10 9ZM18 24c0-7 4-10 10-10 0 6-4 10-10 10Z"/></svg><div><b>Home State</b><small>by Joe Builds</small></div></div>' +
      '<nav class="nav" id="hs51-desktop-nav" aria-label="Main navigation"></nav><div class="side-bottom" id="hs51-side"></div></aside>' +
      '<div class="app"><header class="topbar"><div class="top-context" id="hs51-context"></div><div class="top-actions" id="hs51-actions"></div></header>' +
      '<main class="page" id="hs51-content" tabindex="-1"><div class="loading-record" id="hs51-loading">Opening your home record\u2026</div>' +
      '<section id="home-page" data-screen="home" hidden></section><section id="map-page" data-screen="map" hidden></section>' +
      '<section id="history-page" data-screen="history" hidden></section><section id="reports-page" data-screen="reports" hidden></section></main></div>' +
      '<nav class="bottom-nav" id="hs51-mobile-nav" aria-label="Mobile navigation"></nav>' +
      '<dialog class="modal" id="hs51-dialog" aria-labelledby="hs51-dialog-title"><header class="modal-head"><div><div class="eyebrow" id="hs51-dialog-kicker"></div><h2 id="hs51-dialog-title"></h2></div>' +
      '<button type="button" id="hs51-dialog-close" data-action="close" aria-label="Close panel">' + icon('close') + '</button></header><div class="modal-body" id="hs51-dialog-body"></div></dialog>' +
      '<aside class="tourbar" id="hs51-tourbar" aria-label="Practice walkthrough" hidden></aside><div class="toast" id="hs51-toast" role="status" aria-live="polite" hidden></div>';
    document.body.appendChild(root);
    const nav = [['home', 'Home', 'home'], ['map', 'Home Map', 'map'], ['history', 'History', 'history'], ['reports', 'Reports', 'report']]
      .map(n => `<button type="button" data-nav="${n[0]}" data-action="nav" data-id="${n[0]}">${icon(n[2])}<span>${n[1]}</span></button>`).join('');
    $('#hs51-desktop-nav').innerHTML = nav; $('#hs51-mobile-nav').innerHTML = nav;
  }

  function header(k, title, desc, R) {
    return `<div class="page-head"><div><div class="eyebrow">${esc(k)}</div><h1 tabindex="-1">${esc(title)}</h1><p>${esc(desc)}</p></div>${R && R.isDemo ? `<span class="demo-label">Demonstration \u00b7 ${demoTag(R)}</span>` : ''}</div>`;
  }
  /* Joe, 6 Oct: name the two demonstration records so he can flick between them. */
  const DEMO_LABEL = { 'DEMO-003': 'Demo 1 \u00b7 Farm', 'DEMO-002': 'Demo 2 \u00b7 House', 'DEMO-001': 'Demo 3 \u00b7 Single storey' };
  const demoTag = R => R && R.isAnon ? 'real measured record, anonymised' : 'synthetic data';
  const byLabel = list => list.slice().sort((a, z) => shortLabel(a).localeCompare(shortLabel(z)));
  const shortLabel = b => DEMO_LABEL[b.building_code] || [b.address_line_1, b.suburb].filter(x => String(x || '').trim() && !/synthetic|demonstration property/i.test(x)).join(', ') || String(b.building_code || 'Property');
  function propertyName(R) {
    if (R.isDemo) return DEMO_LABEL[R.b.building_code] || 'Demonstration property';
    const b = R.b; return [b.address_line_1, b.suburb].filter(x => String(x || '').trim()).join(', ') || String(b.building_code || 'Your property');
  }
  function fillChrome(R) {
    const many = (R.buildings || []).length > 1;
    $('#hs51-context').innerHTML = many
      ? (R.buildings.length <= 3
        ? `<div class="picker" role="group" aria-label="Choose a property"><span class="eyebrow">Property</span>${byLabel(R.buildings).map(b => `<button type="button" class="pick${b.id === R.b.id ? ' on' : ''}" data-action="pick" data-id="${esc(b.building_code)}" aria-pressed="${b.id === R.b.id}">${esc(shortLabel(b))}</button>`).join('')}</div>`
        : `<label class="picker"><span class="eyebrow">Property</span><select id="hs51-picker" aria-label="Choose a property">${byLabel(R.buildings).map(b => `<option value="${esc(b.building_code)}" ${b.id === R.b.id ? 'selected' : ''}>${esc(shortLabel(b))}</option>`).join('')}</select></label>`)
      : `<span><span class="eyebrow">Property</span>${esc(propertyName(R))}</span>${R.isDemo ? `<span class="record-status"><span class="eyebrow">Record</span>${R.isAnon ? 'Anonymised real record' : 'Synthetic example'}</span>` : ''}`;
    $('#hs51-actions').innerHTML = (R.isDemo ? `<button type="button" data-action="help">${icon('play')}<span class="help-label">Practise walkthrough</span></button>` : '') +
      `<button type="button" data-action="payments">${icon('account')}<span class="payment-label">Visits & payments</span></button>`;
    $('#hs51-side').innerHTML = `<div class="eyebrow">Your connected home</div><b>${esc(propertyName(R))}</b>${R.isDemo ? (R.isAnon ? '<br>Anonymised real record \u00b7 not a client record' : '<br>Synthetic record \u00b7 not client data') : ''}<button type="button" data-hs-signout data-ms-action="logout" data-action="signout">${icon('signout')}Sign out</button>`;
  }

  /* ---------- 8. Modal, toast, routing ---------- */
  let activeOpener = null, toastTimer = null, downloadURL = null;
  function toast(t) { const x = $('#hs51-toast'); x.textContent = t; x.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { x.hidden = true; }, 3800); }
  function openModal(title, body, kicker) {
    const d = $('#hs51-dialog'); if (!d.open) activeOpener = document.activeElement;
    $('#hs51-dialog-title').textContent = title; $('#hs51-dialog-kicker').textContent = kicker || 'Home State';
    $('#hs51-dialog-body').innerHTML = body;
    if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    d.scrollTop = 0; $('#hs51-dialog-close').focus({ preventScroll: true });
  }
  function closeModal() { const d = $('#hs51-dialog'); if (d.open) { if (d.close) d.close(); else d.removeAttribute('open'); } }

  const S = { screen: 'home', level: 'L1', levelChosen: false, mapView: null, mapMetric: 'none', event: null, room: null, history: null, compareA: null, compareB: null, compareTarget: null, table: { rows: [], page: 0, title: '', query: '' }, tour: -1, request: null };
  let R = null;

  function setScreen(screen, focus) {
    if (!SCREEN_PATH[screen]) return;
    closeModal(); S.screen = screen;
    $$('#hs51 [data-screen]').forEach(p => { p.hidden = p.dataset.screen !== screen; });
    $$('#hs51 [data-nav]').forEach(b => { if (b.dataset.nav === screen) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (screen === 'home') renderHome(); if (screen === 'map') renderMap(); if (screen === 'history') renderHistory(); if (screen === 'reports') renderReports();
    try { const q = location.search; window.history.replaceState(null, '', SCREEN_PATH[screen] + q); } catch (e) {}
    if (focus !== false) { window.scrollTo(0, 0); requestAnimationFrame(() => { const h = $(`#hs51 [data-screen="${screen}"] h1`); if (h) h.focus({ preventScroll: true }); }); }
  }

  /* ---------- 9. Home ---------- */

  /* ---------- 9a. Property hero (V5.2, Joe 6 Oct): the home, where it sits, and the record at a glance ---------- */
  const firstClause = t => { const x = String(t || '').trim(); if (!x) return ''; return x.split(/[.;](?=\s|$)|,/)[0].trim(); };
  const outdoorText = t => { const x = String(t || ''); const m = x.match(/(-?\d+(?:\.\d+)?)\s*(?:\u00b0\s*)?C\b[^\d]{0,6}(\d+(?:\.\d+)?)\s*(?:percent|%)\s*RH/i); return m ? m[1] + ' \u00b0C, ' + m[2] + '% RH' + (/synthetic/i.test(x) ? ' (synthetic)' : '') : firstClause(x); };
  const seasonOf = iso => { const t = new Date(iso); if (isNaN(t.getTime())) return null; const m = Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', month: 'numeric' }).format(t)); return m === 12 || m <= 2 ? 'Summer' : m <= 5 ? 'Autumn' : m <= 8 ? 'Winter' : 'Spring'; };
  function heroHTML(R, visited, changes) {
    const b = R.b, lv = R.lastVisit, s = lv ? lv.raw : null;
    const type = [b.property_type, [b.suburb, b.state].filter(x => String(x || '').trim() && !/synthetic/i.test(x)).join(' ')].filter(x => String(x || '').trim()).join(' \u00b7 ');
    const ctx = [
      ['Climate zone', b.climate_zone ? b.climate_zone : 'Not recorded yet', b.climate_zone_source || (b.climate_zone ? 'Source not recorded' : 'Added from the property address when the record is set up.')],
      ['Latest visit', lv ? lv.type + ', ' + date(lv.at) : 'No visit yet', lv ? plural(R.byEvent[lv.id].filter(hasValue).length, 'reading') + ' recorded' : ''],
      ['Outdoors at that visit', s && s.weather ? outdoorText(s.weather) : 'Not recorded', 'Outdoor context, not an indoor measurement'],
      ['Rain before that visit', s && s.recent_rain ? firstClause(s.recent_rain) : 'Not recorded', 'As recorded at the visit']
    ];
    const pts = uniq(R.readings.filter(hasValue).map(r => r.target_id)).length;
    const seasons = {}; R.measurementEvents.forEach(e => { const n = seasonOf(e.at); if (n) seasons[n] = (seasons[n] || 0) + 1; });
    const seasonText = Object.keys(seasons).length ? Object.keys(seasons).map(k => k + ' ' + seasons[k]).join(' \u00b7 ') : 'None yet';
    const followups = R.measurementEvents.filter(e => R.interventions.some(iv => T(iv.at) < T(e.at))).length ? 1 : 0;
    const model = R.twin ? `<div class="hero-model"><iframe title="Three-dimensional model of this property" sandbox="allow-scripts" referrerpolicy="no-referrer" loading="lazy" src="${esc(R.twin.model_url)}?embed=1"></iframe>${R.isDemo ? '' : '<span class="hero-model-note">Model shows the shape of the home</span>'}</div>` : '';
    return `<section class="hero" aria-label="Your home"><div class="hero-main"><div class="eyebrow">Your home${R.isDemo ? ' \u00b7 demonstration \u00b7 ' + demoTag(R) : ''}</div><h1 tabindex="-1">${esc(propertyName(R))}</h1><p class="hero-type">${esc(type || 'Property details not recorded yet')}</p>` +
      `<div class="hero-ctx">${ctx.map(c => `<div><small>${esc(c[0])}</small><b>${esc(c[1])}</b>${c[2] ? `<span>${esc(c[2])}</span>` : ''}</div>`).join('')}</div>` +
      (b.climate_note ? `<p class="hero-note">${esc(b.climate_note)}</p>` : '') +
      `<div class="buttons">${R.twin ? button('Explore in 3D', 'hero-3d', '', 'btn') : ''}${button('Open Home Map', 'nav', 'map')}</div></div>` +
      `<aside class="hero-side">${model}<div class="hero-stats"><div class="eyebrow">Current record</div><div class="stat-grid"><div><small>Rooms & areas</small><b>${R.rooms.length}</b></div><div><small>Recorded locations</small><b>${pts}</b></div><div><small>Measurement visits</small><b>${visited}</b></div><div><small>Recorded changes</small><b>${changes}</b></div></div>` +
      `<div class="depth-mini"><div><span>Seasons covered</span><b>${esc(seasonText)}</b></div><div><span>Visit after a recorded change</span><b>${followups ? 'Recorded' : 'None yet'}</b></div><div><span>Evidence items released</span><b>${R.evidence === null ? 'Not available' : R.evidence.length}</b></div></div>${button('Record depth', 'depth', '', 'link')}</div></aside></section>`;
  }

  function renderHome() {
    const visited = R.measurementEvents.length, changes = R.interventions.length, ns = nextStep(R);
    const start = R.baseline, sched = !start ? R.events.find(e => e.scheduled) : null;
    $('#home-page').innerHTML = heroHTML(R, visited, changes) +
      `<section class="visit-strip" aria-label="First visit"><div><div class="eyebrow">How your record began</div><h3>${start ? esc(start.kind === 'baseline' ? 'Home Performance Baseline' : start.type) : sched ? esc(sched.type) + ' scheduled' : 'No visit recorded yet'}</h3><div class="small">${start ? date(start.at) + ' \u00b7 The first visit in this connected record.' : sched ? date(sched.at) + ' \u00b7 Scheduled. No measured evidence yet.' : 'Your first visit will start this record.'}</div></div><div class="buttons">${start ? button('What was measured', 'inclusions') : ''}${button('Visits & payments', 'payments')}</div></section>` +
      `<div class="section-head"><h2>What has been tested</h2>${button('Open Home Map', 'nav', 'map', 'link')}</div>` +
      `<div class="grid">${CHAPTERS.map(c => { const v = coverage(R, c.id); return `<button type="button" class="tile" data-action="chapter" data-id="${c.id}" aria-label="${esc(c.title)}, ${esc(v.label)}"><div class="tile-top"><span class="icon">${icon(c.icon)}</span>${chip(v.label, v.kind)}</div><h3>${esc(c.title)}</h3><p>${esc(c.subtitle)}</p><div class="bottom"><span>${plural(v.locations, 'recorded location')}<small>${v.last ? 'Last measured ' + date(v.last.recorded_at) : 'No readings yet'}</small></span>${icon('arrow')}</div></button>`; }).join('')}` +
      `<section class="tile next" aria-label="${esc(ns.kicker)}"><div class="eyebrow">${esc(ns.kicker)}</div><h3>${esc(ns.title)}</h3><p>${esc(ns.text)}</p>${button(ns.action[0], ns.action[1], ns.action[2], 'btn')}</section></div>` +
      `<p class="footnote">\u201cMeasured\u201d refers to the recorded locations, not every surface or possible test. Open a section to see what was covered and what was not.</p>` +
      `<div class="home-foot"><p><b>One home. One connected record.</b><br>Every visit adds to the same history, map and evidence.</p>${button('See your reports', 'nav', 'reports', 'link')}</div>`;
  }

  function chapterModal(id) {
    const c = chapterBy[id]; if (!c) return;
    const v = coverage(R, id), rooms = v.rooms.map(x => R.roomBy[x]).filter(Boolean);
    const params = uniq(v.taken.map(r => PARAM_NAME[r.parameter] || r.parameter));
    const opp = v.spaceKnown && (v.label !== 'Measured');
    openModal(c.title, `<div class="lead">${esc(c.description)}</div><div class="buttons">${chip(v.label, v.kind)}${chip(plural(v.locations, 'recorded location'), 'neutral')}</div>` +
      `<div class="detail-section"><h3>Recorded across your visits</h3><p>${params.length ? esc(params.join(' \u00b7 ')) + '.' : 'No readings in this section yet.'}</p><div class="list">${rooms.map(r => { const n = uniq(v.taken.filter(x => x.room === r.id).map(x => x.target_id)).length; return `<button type="button" class="room-row" data-action="room" data-id="${esc(r.id)}"><span><b>${esc(r.name)}</b><small>${esc(R.LEVEL_NAME[r.level] || 'Property')}</small></span><span class="count">${plural(n, 'location')} \u2192</span></button>`; }).join('')}` +
      `${v.unrecorded.map(n => `<div class="room-row"><span><b>${esc(n)}</b><small>${id === 'environment' ? 'No room-air readings in this record' : 'No readings in this record'}</small></span>${chip('Not yet measured', 'neutral')}</div>`).join('')}</div></div>` +
      `<div class="notice ${v.kind === 'partial' ? 'warn' : ''}"><b>Coverage & limits</b><br>${esc(c.boundary)}${v.limits.length ? '<br><span class="small">Recorded limits: ' + esc(v.limits.join(' \u00b7 ')) + '</span>' : '<br><span class="small">No access limit is recorded for this section.</span>'}${!v.spaceKnown ? '<br><span class="small">This record does not hold this space. Whether it applies to the home is not recorded here.</span>' : ''}</div>` +
      `<div class="buttons">${v.taken.length ? button('Explore on Home Map', 'chapter-map', id, 'btn') + button('See all readings', 'chapter-readings', id) : ''}</div>` +
      (opp ? `<div class="detail-section"><h3>What could another visit add?</h3><p>A further visit could add evidence where this section is not yet measured or was limited. Access, inclusions and price need to be agreed first.</p>${button('See what another visit adds', 'opportunity', id, 'link')}</div>` : '') +
      `<details><summary>How this connects to your other sections</summary><p>Sections are ways of viewing the same readings. An ensuite outer wall can appear here and under External walls; it remains one reading at one location, not a second test or a second charge.</p><p>A section shows part of your home. A visit shows when it was measured. Your booking shows what you purchased. The three stay connected without being treated as the same thing.</p></details>` +
      `<p class="footnote">${R.isDemo ? (R.isAnon ? 'Real measured readings, address and personal details removed. ' : 'Synthetic demonstration readings. ') : ''}Latest reading in this section: ${v.last ? date(v.last.recorded_at) : 'none yet'}.</p>`, 'Your home record');
  }

  function inclusionsModal() {
    const e = R.baseline; if (!e) return;
    openModal('What was measured', `<p class="lead">What was recorded at your first visit, organised into the same five parts of your home. Later visits add to these sections rather than creating another dashboard.</p>` +
      `<div class="list">${CHAPTERS.map(c => { const rs = R.chapterRows(c.id, e.id).filter(hasValue); return `<div class="row"><div><h4>${esc(c.title)}</h4><p>${plural(uniq(rs.map(r => r.target_id)).length, 'location')} recorded on ${date(e.at)}</p></div>${chip(rs.length ? 'Readings recorded' : 'Not recorded at this visit', rs.length ? '' : 'neutral')}</div>`; }).join('')}</div>` +
      `<div class="notice warn"><b>Recorded coverage is not the same as purchased inclusions.</b><br>This shows what was measured. The inclusions you agreed for a booking come from that booking, and this record does not hold them, so none are listed or assumed here.</div>` +
      `<p>Existing readings remain available. Another service adds new measurements; it does not release a second copy of evidence you already have.</p>` +
      `<div class="buttons">${button('View this visit', 'event', e.id, 'btn')}</div>`, 'Visit \u00b7 ' + date(e.at));
  }

  function opportunityModal(id) {
    const c = chapterBy[id]; if (!c) return;
    const v = coverage(R, id);
    const what = v.label === 'Not yet measured' ? 'Add first readings in this part of your home at agreed locations, using an agreed method.' : 'Add readings where this section was limited' + (v.limits.length ? ' (' + v.limits[0].split(':')[0] + ')' : '') + ' or not yet measured, after access has been confirmed.';
    openModal('Add to this part of your record', `${chip(c.title, 'neutral')}<p class="lead" style="margin-top:18px">${esc(what)}</p>` +
      `<div class="detail-section"><h3>What this adds to Home State</h3><div class="list"><div class="row"><p>New readings tied to exact locations in the Home Map.</p></div><div class="row"><p>A dated visit, its access limits and the agreed report output.</p></div><div class="row"><p>Later comparisons only where the measurements can be compared.</p></div></div></div>` +
      `<div class="notice"><b>Access, inclusions and price to confirm first</b><br>No amount is due because an area is unmeasured. Your existing record stays available.</div>` +
      `<div class="buttons">${button('Prepare an enquiry', 'request', id, 'btn')}${button('Back to the section', 'chapter', id)}</div>${R.isDemo ? '<p class="footnote">Practice mode: no booking or payment will be made.</p>' : ''}`, 'Possible next measurement');
  }

  function requestModal(id) {
    const c = chapterBy[id]; if (!c) return;
    S.request = { chapter: id, kind: 'Confirm access and inclusions', note: '' };
    openModal('Ask about ' + c.title.toLowerCase(), `<p>${R.isDemo ? 'This is a practice enquiry. It stays on this page and is not sent to Joe Builds.' : 'Prepare your question here. Nothing is sent until you choose to send it from your own email.'}</p>` +
      `<form id="hs51-request-form"><div class="field"><label for="hs51-request-kind">What would you like to discuss?</label><select id="hs51-request-kind"><option>Confirm access and inclusions</option><option>Request a price for additional measurements</option><option>Arrange a follow-up conversation</option></select></div>` +
      `<div class="field" style="margin-top:15px"><label for="hs51-request-note">Optional note</label><textarea id="hs51-request-note" maxlength="600" placeholder="For example: what access would be needed?"></textarea></div>` +
      `<div class="buttons"><button class="btn" type="submit">${R.isDemo ? 'Create practice enquiry' : 'Prepare enquiry'} ${icon('arrow')}</button></div></form>` +
      `<div class="notice blue">Nothing has been booked, charged or sent.</div>`, R.isDemo ? 'Practice action' : 'Enquiry');
  }

  function paymentsModal() {
    const visits = R.events.filter(e => e.kind !== 'intervention');
    openModal('Visits & payments', `<p class="lead">The booking tells you what was purchased. The home record tells you what was actually measured.</p>` +
      `<div class="notice blue"><b>No quote, invoice or payment record is connected to this view yet.</b><br>Payment details are not shown here until they can be read from verified records. Nothing below is a quote, an invoice or an amount owed.</div>` +
      `<div class="list">${visits.length ? visits.map(e => `<div class="row"><div><h4>${esc(e.kind === 'followup' ? 'Follow-up visit (' + e.type + ')' : e.type)}</h4><p>${date(e.at)} \u00b7 ${e.scheduled ? 'Scheduled \u00b7 no measured evidence yet' : e.done ? 'Carried out' : esc(e.status || 'Status not recorded')}${e.report ? ' \u00b7 Report ready' : ''}</p></div>${chip('Payment not recorded here', 'neutral')}</div>`).join('') : '<div class="row"><p>No visits are recorded yet.</p></div>'}</div>` +
      `<div class="notice"><b>Further visits: price not yet agreed</b><br>A suggestion in your record is not an invoice. No amount is shown as payable without a confirmed quote or invoice.</div>` +
      `<details><summary>Why a paid visit can still have a coverage limit</summary><p>Payment, booking, fieldwork and report release are different events. A visit can be paid while an area remains inaccessible. The record keeps that limit visible and does not invent missing measurements.</p><p>Paying for a visit never creates coverage and never changes a finding.</p></details>` +
      '<div class="buttons">' + (R.baseline ? button('View your first visit', 'event', R.baseline.id, 'link') : '') + `<button type="button" class="btn light" data-hs-signout data-ms-action="logout" data-action="signout">${icon('signout')}Sign out</button></div>`, 'Account');
  }

  /* ---------- 10. Rooms and readings ---------- */
  const roomRows = (id, ev) => R.readings.filter(r => r.room === id && (!ev || r.event_id === ev));
  function roomMetricsHTML(rs) {
    return `<div class="metric-cards">${['air_temperature', 'relative_humidity', 'co2'].map(p => { const r = representative(rs, p); return `<div class="metric-card"><div class="eyebrow">${esc(PARAM_NAME[p])}</div><div class="value">${r ? esc(r.value) : 'Not recorded'}</div><div class="small">${r ? esc(unitText(r.unit)) : 'Not recorded at this visit'}</div>${r ? `<button type="button" class="link" data-action="reading" data-id="${esc(r.reading_id)}" style="font-size:11px">Reading details \u2192</button>` : ''}</div>`; }).join('')}</div>`;
  }
  function evidenceFor(rs) {
    if (!R.evidence) return [];
    const ids = rs.map(r => r.reading_id), rooms = uniq(rs.map(r => r.room));
    return R.evidence.filter(e => ids.indexOf(e.measurement_id) !== -1 || (!e.measurement_id && rooms.indexOf(e.room_id) !== -1));
  }
  function evidenceHTML(rs) {
    const items = evidenceFor(rs || []);
    return `<details${items.length ? ' open' : ''}><summary>Photos, images & measurement method</summary>${items.length ? `<div class="ev-grid">${items.map(evCard).join('')}</div>` : `<p>${R.evidence === null ? 'Photos and evidence could not be read just now.' : 'No photos or evidence have been released for these readings yet.'} Readings and their locations remain available.</p>`}<p>Open a reading to see its recorded unit, method, device reference and time.</p></details>`;
  }
  function evCard(e) {
    const rm = R.roomBy[e.room_id], ev = R.eventBy[e.assessment_id];
    return `<div class="ev-card"><h4>${esc(rm ? rm.name : 'Whole property')}</h4><p class="small" style="margin:0 0 8px">${esc(e.evidence_type || 'Evidence item')}${ev ? ' \u00b7 ' + esc(ev.type) + ', ' + date(ev.at) : ''}</p>${e.notes ? `<p class="small">${esc(e.notes)}</p>` : ''}${e.storage_object_path ? button('View item', 'evidence', e.id, 'link') : '<p class="small">Held on your record; not yet viewable online.</p>'}</div>`;
  }
  /* Private viewer, as core V2.1 A-4: bytes read through the storage policy as the signed-in member, shown from a temporary object URL revoked on close. No signed or public URL is created. */
  let evURL = null;
  async function openEvidence(id) {
    const e = (R.evidence || []).find(x => String(x.id) === String(id)); if (!e) return;
    openModal(e.evidence_type || 'Evidence item', '<p class="small">Opening\u2026</p>', 'Photos & evidence');
    try {
      const { data, error } = await sb.storage.from('property_assets').download(e.storage_object_path);
      if (error || !data) throw error || new Error('no data');
      if (evURL) URL.revokeObjectURL(evURL); evURL = URL.createObjectURL(data);
      $('#hs51-dialog-body').innerHTML = (/^image\//.test(data.type || '') ? `<img class="ev-img" src="${evURL}" alt="${esc(e.evidence_type || 'Evidence item')}">` : `<p>This item is a file rather than an image.</p><a class="btn" href="${evURL}" download="${esc(e.file_name || 'evidence')}">Save a copy</a>`) + `<p class="footnote">${esc(e.file_name || '')}</p>`;
    } catch (err) { $('#hs51-dialog-body').innerHTML = '<p>This item could not be opened just now. Please try again, or contact Joe Builds.</p>'; }
  }
  function readingModal(id) {
    const r = R.readingBy[id]; if (!r) return;
    const related = r.sections.map(x => chapterBy[x].title), ev = R.eventBy[r.event_id];
    openModal(R.targetLabel(r), `<div class="eyebrow">${esc(PARAM_NAME[r.parameter] || r.parameter)} \u00b7 ${date(r.recorded_at)}</div><div style="font-size:34px;font-weight:500;margin:14px 0">${esc(valueText(r))}</div>` +
      `<p class="small">${esc(ev ? ev.type : 'Visit not recorded')} \u00b7 ${time(r.recorded_at)} (Sydney time)</p>` +
      `<div class="notice">${r.parameter === 'moisture' ? 'REL and WME are comparative meter scales, not percentages of water. Different methods are not treated as interchangeable.' : 'This is a reading at a recorded location and time. It is not a whole-room average or a health assessment.'}${!hasValue(r) && r.note ? '<br>Recorded note: ' + esc(r.note) : ''}</div>` +
      `<div class="buttons">${button('Locate on map', 'reading-map', id, 'btn')}${button('Same-location history', 'target-history', r.target_id)}</div>` +
      `<details open><summary>Measurement record</summary><dl class="kvs"><dt>Value & unit</dt><dd>${esc(valueText(r))}</dd><dt>Method</dt><dd>${esc(methodText(r.method))}</dd><dt>Device reference</dt><dd>${esc(r.device_id || 'Device not recorded')}</dd><dt>Date & time</dt><dd>${r.recorded_at ? date(r.recorded_at) + ', ' + time(r.recorded_at) + ' (Sydney time)' : 'Not recorded'}</dd><dt>Reading status</dt><dd>${esc(r.reading_status || 'Not recorded')}</dd><dt>Visit</dt><dd>${esc(ev ? ev.type + ', ' + date(ev.at) : 'Not recorded')}</dd><dt>Reading reference</dt><dd>${esc(r.reading_id)}</dd><dt>Location reference</dt><dd>${esc(r.target_id)}</dd><dt>Also visible under</dt><dd>${esc(related.join(' \u00b7 ') || 'Room and location readings')}</dd>${R.isDemo ? (R.isAnon ? '<dt>Source</dt><dd>Real field measurement, shown with the address and personal details removed.</dd>' : '<dt>Source</dt><dd>Synthetic demonstration record. Not a field measurement.</dd>') : ''}</dl></details>` + evidenceHTML([r]), 'One reading \u00b7 one location');
  }
  function openTable(title, rows) { S.table = { title, rows: rows.slice(), page: 0, query: '' }; renderTableModal(); }
  function renderTableModal(keepFocus) {
    const t = S.table, q = t.query.toLowerCase();
    const rows = t.rows.filter(r => (R.targetLabel(r) + ' ' + (PARAM_NAME[r.parameter] || r.parameter) + ' ' + r.target_id).toLowerCase().indexOf(q) !== -1);
    const pages = Math.max(1, Math.ceil(rows.length / 16)); t.page = Math.max(0, Math.min(t.page, pages - 1));
    const vis = rows.slice(t.page * 16, t.page * 16 + 16);
    const body = `<p class="small">${plural(rows.length, 'record')}. Values keep their own date, unit and method; missing values are not treated as zero.</p><div class="field"><label for="hs51-reading-search">Find a room, location or measurement</label><input id="hs51-reading-search" value="${esc(t.query)}" placeholder="For example: ensuite, north wall, humidity" autocomplete="off"></div>` +
      `<div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Location / date</th><th>Measurement</th><th>Record</th></tr></thead><tbody>${vis.map(r => `<tr><td>${esc(R.targetLabel(r))}<small>${date(r.recorded_at)} \u00b7 ${time(r.recorded_at)}</small></td><td><strong>${esc(valueText(r))}</strong><small>${esc(PARAM_NAME[r.parameter] || r.parameter)}</small></td><td>${button('Details', 'reading', r.reading_id, 'link')}</td></tr>`).join('') || '<tr><td colspan="3">No matching readings in this selection.</td></tr>'}</tbody></table></div>` +
      `<div class="pagination"><button type="button" class="btn light" data-action="table-prev" ${t.page === 0 ? 'disabled' : ''}>Previous</button><span>${rows.length ? (t.page * 16 + 1) + ' to ' + Math.min(rows.length, (t.page + 1) * 16) : '0'} of ${rows.length}</span><button type="button" class="btn light" data-action="table-next" ${t.page >= pages - 1 ? 'disabled' : ''}>Next</button></div>`;
    if (keepFocus) { const f = $('#hs51-reading-search'), pos = f ? f.selectionStart : 0; $('#hs51-dialog-body').innerHTML = body; const g = $('#hs51-reading-search'); g.focus(); g.setSelectionRange(pos, pos); }
    else openModal(t.title, body, 'Recorded evidence');
  }
  function targetHistory(tid) {
    const rs = R.readings.filter(r => r.target_id === tid).sort((a, z) => T(a.recorded_at) - T(z.recorded_at)); if (!rs.length) return;
    const comparable = rs.filter(hasValue).length > 1;
    openModal(R.targetLabel(rs[0]), `<p class="lead">The same location, kept through time.</p><div class="table-wrap"><table><thead><tr><th>Visit</th><th>Reading</th><th>Method</th></tr></thead><tbody>${rs.map(r => `<tr><td>${esc((R.eventBy[r.event_id] || {}).type || 'Visit')}<small>${date(r.recorded_at)}</small></td><td>${esc(valueText(r))}<small>${esc(PARAM_NAME[r.parameter] || '')}</small></td><td>${esc(methodText(r.method))}${button('Details', 'reading', r.reading_id, 'link')}</td></tr>`).join('')}</tbody></table></div>` +
      `<div class="notice">Side-by-side history is not an improvement claim. Comparison needs the same location, parameter, unit and method, and a supplied comparison decision.</div>` +
      (comparable ? `<div class="buttons">${button('Compare two visits', 'compare-target', tid, 'btn')}</div>` : ''), 'Location history');
  }
  function roomModal(id) {
    const r = R.roomBy[id]; if (!r) return;
    const ev = R.eventBy[S.event], rs = roomRows(id, S.event), any = roomRows(id).some(hasValue);
    openModal(r.name, `<p class="lead">${r.kind === 'roof' ? 'Roof-space measurements' : r.kind === 'subfloor' ? 'Underfloor measurements' : 'Room-linked measurements'}${ev ? ' at ' + date(ev.at) : ''}.</p>${roomMetricsHTML(rs)}` +
      `<div class="buttons">${button('Explore this location', 'room-map', id, 'btn')}${button('View readings', 'room-readings', id)}${button('View location history', 'room-history', id)}</div>` +
      `<div class="notice">${rs.some(hasValue) ? plural(uniq(rs.filter(hasValue).map(x => x.target_id)).length, 'location') + ' have readings at this visit.' : 'No values were recorded here at the selected visit.' + (any ? ' Earlier or later readings remain available in the location history.' : '')}${r.limited ? '<br>Recorded access: ' + esc(r.access) + (r.desc ? '. ' + esc(r.desc) : '') : ''}</div>` + evidenceHTML(rs), 'Home Map \u00b7 ' + (R.LEVEL_NAME[r.level] || 'Property area'));
  }

  /* ---------- 11. Home Map ---------- */
  const MODEL = { frame: null, ready: false, seq: 0, pending: new Map(), errors: [], suppressUntil: 0, timer: null, listening: false };
  const levelsPresent = () => ['L1', 'L2', 'RS', 'SF'].filter(l => R.rooms.some(r => r.level === l)).concat(uniq(R.rooms.map(r => r.level)).filter(l => ['L1', 'L2', 'RS', 'SF'].indexOf(l) === -1));
  const LEVEL_SHORT = { L1: 'Ground', L2: 'Upper', RS: 'Roof', SF: 'Subfloor' };
  function ensureMap() {
    if ($('#map-page').dataset.built) return; $('#map-page').dataset.built = 'true';
    $('#map-page').innerHTML = header('Your spatial record', 'Home Map', 'Choose a room or a recorded location. The map and the readings use the same record.', R) +
      `<div id="hs51-map-options" class="map-options"></div><div class="map-layout"><section class="map-panel"><div class="map-toolbar"><div class="seg" id="hs51-view-buttons"></div><div class="seg" id="hs51-level-buttons"></div></div>` +
      `<div class="map-stage"><div id="hs51-plan-view" style="height:100%"></div><div id="hs51-model-view" style="height:100%" hidden><div class="loading" id="hs51-model-loading">Opening the 3D model\u2026</div></div></div><div id="hs51-map-caption" class="map-caption"></div></section>` +
      `<aside class="panel map-sidebar"><div class="eyebrow">Choose a location</div><h3 style="margin-top:7px">Rooms & areas</h3><div id="hs51-map-rooms" class="list"></div></aside></div><section id="hs51-selected-room" class="panel selected-room"></section>`;
  }
  function renderMap() {
    ensureMap();
    if (!S.event || !R.eventBy[S.event]) S.event = R.lastVisit ? R.lastVisit.id : (R.events[0] ? R.events[0].id : null);
    const lv = levelsPresent(); if (lv.length && lv.indexOf(S.level) === -1) S.level = lv[0];
    const hasModel = !!R.twin;
    if (S.mapView === null) S.mapView = hasModel ? '3d' : 'plan';
    $('#hs51-map-options').innerHTML = (R.measurementEvents.length ? `<div class="field"><label for="hs51-map-event">Showing this visit</label><select id="hs51-map-event">${R.measurementEvents.map(e => `<option value="${esc(e.id)}" ${S.event === e.id ? 'selected' : ''}>${esc(e.type)} \u00b7 ${date(e.at)}</option>`).join('')}</select></div>` : '') +
      (hasModel && !R.standalone && S.mapView === '3d' ? `<div class="field"><label for="hs51-map-metric">Show on the 3D model</label><select id="hs51-map-metric">${[['none', 'Rooms only'], ['moisture', 'Moisture locations'], ['thermal', 'Surface-temperature locations'], ['environment', 'Room-air readings']].map(o => `<option value="${o[0]}" ${S.mapMetric === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>` : '') +
      button('Reset view', 'reset-map', '', 'link');
    $('#hs51-view-buttons').innerHTML = (hasModel ? [['3d', '3D house'], ['plan', 'Floor plan']] : [['plan', 'Floor plan']]).map(v => `<button type="button" data-action="map-view" data-id="${v[0]}" aria-pressed="${S.mapView === v[0]}">${v[1]}</button>`).join('');
    $('#hs51-level-buttons').innerHTML = (R.twin && !R.standalone && S.mapView === '3d' ? `<button type="button" data-action="map-whole" aria-pressed="${!S.levelChosen && !S.room}">Whole house</button>` : '') + lv.map(l => `<button type="button" data-action="map-level" data-id="${esc(l)}" aria-pressed="${(S.levelChosen || S.mapView !== '3d' || !R.twin) && S.level === l}">${esc(LEVEL_SHORT[l] || l)}</button>`).join('');
    if (!hasModel) S.mapView = 'plan';
    $('#hs51-plan-view').hidden = S.mapView !== 'plan'; $('#hs51-model-view').hidden = S.mapView !== '3d';
    const rooms = R.rooms.filter(r => r.level === S.level);
    $('#hs51-map-rooms').innerHTML = rooms.map(r => { const n = uniq(roomRows(r.id, S.event).filter(hasValue).map(x => x.target_id)).length; return `<button type="button" class="room-row" data-action="map-room" data-id="${esc(r.id)}" aria-pressed="${S.room === r.id}"><span><b>${esc(r.name)}</b><small>${n ? plural(n, 'recorded location') : 'No readings at this visit'}</small></span></button>`; }).join('') || '<p class="small">No rooms are recorded on this level.</p>';
    renderPlan(); renderSelectedRoom();
    $('#hs51-map-caption').textContent = S.mapView === 'plan' ? (R.GEO ? 'Floor plan uses the matched model geometry. Select a room, or use the room list. Shaded rooms have readings at the selected visit; shading is not a condition rating.' : 'Use the room list to open a room.') : (R.standalone ? 'This model has its own controls: House, Measured and Intelligence, 3D and 2D. Drag to rotate, scroll or pinch to zoom. The room list beside it holds the recorded readings. Colours are not a condition rating.' : 'Drag to rotate \u00b7 scroll or pinch to zoom \u00b7 tap a room \u00b7 use the room list for precise selection. Colours are not a condition rating.');
    if (S.mapView === '3d') { initModel(); if (MODEL.ready) applyModel(); }
  }
  function renderPlan() {
    const target = $('#hs51-plan-view'); if (!target) return;
    if (!R.GEO) { target.innerHTML = '<div class="plan-empty">A drawn floor plan is not held for this record yet. Every room and its readings are in the list beside this panel.</div>'; return; }
    const rooms = R.rooms.filter(r => r.level === S.level && r.parts);
    if (!rooms.length) { target.innerHTML = '<div class="plan-empty">No drawn plan is held for this level. Use the room list beside this panel.</div>'; return; }
    const inert = R.GEO.rooms.filter(g => g.level === S.level && !R.roomByGeo[g.id] && !/^(POR|ALF|BAL)$/.test(g.code));
    /* Frame the plan to this level's own extents, so a smaller upper floor is not lost in the page. */
    const all = rooms.map(r => r.parts).concat(inert.map(g => g.parts)).reduce((a, x) => a.concat(x), []);
    const x0 = Math.min.apply(null, all.map(p => p[0])), x1 = Math.max.apply(null, all.map(p => p[1])), z0 = Math.min.apply(null, all.map(p => p[2])), z1 = Math.max.apply(null, all.map(p => p[3]));
    const pad = Math.max(900, (x1 - x0) * 0.08), vb = [x0 - pad, z0 - pad * 1.4, (x1 - x0) + pad * 2, (z1 - z0) + pad * 2.4];
    let svg = `<svg class="plan" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="${esc(R.LEVEL_NAME[S.level] || S.level)} plan"><text x="${x1}" y="${z0 - pad * 0.5}" font-size="390" text-anchor="end">N \u2191</text>`;
    inert.forEach(g => { svg += `<g class="room-no-data" aria-hidden="true">${g.parts.map(p => `<rect class="room-shape" x="${p[0]}" y="${p[2]}" width="${p[1] - p[0]}" height="${p[3] - p[2]}" style="opacity:.55"/>`).join('')}</g>`; });
    rooms.forEach(r => {
      const big = r.parts.slice().sort((a, z) => (z[1] - z[0]) * (z[3] - z[2]) - (a[1] - a[0]) * (a[3] - a[2]))[0];
      const n = roomRows(r.id, S.event).filter(hasValue).length;
      svg += `<g class="room-group ${n ? '' : 'room-no-data'}" role="button" tabindex="0" aria-label="${esc(r.name)}${n ? '' : ', no readings at this visit'}" aria-pressed="${S.room === r.id}" data-action="map-room" data-id="${esc(r.id)}">${r.parts.map(p => `<rect class="room-shape" x="${p[0]}" y="${p[2]}" width="${p[1] - p[0]}" height="${p[3] - p[2]}"/>`).join('')}`;
      const cx = (big[0] + big[1]) / 2, cy = (big[2] + big[3]) / 2;
      const labels = (r.name.length > 15 ? r.name.replace(' / ', '/').split(/[ /]/) : [r.name]).filter(Boolean);
      const small = (big[1] - big[0]) < 2200 || (big[3] - big[2]) < 1600;
      svg += labels.map((l, i) => `<text x="${cx}" y="${cy + (i - (labels.length - 1) / 2) * 430}" font-size="${small ? 270 : 360}" text-anchor="middle">${esc(l)}</text>`).join('') + '</g>';
    });
    target.innerHTML = svg + '</svg>';
  }
  function renderSelectedRoom() {
    const t = $('#hs51-selected-room'); if (!t) return;
    if (!S.room || !R.roomBy[S.room]) { t.innerHTML = `<div class="eyebrow">One location \u00b7 connected evidence</div><h2 style="margin:8px 0">Select a room to explore</h2><p class="small" style="margin:0">Its readings, dates and history stay attached to that room. Nothing depends on knowing a technical reference number.</p>`; return; }
    const r = R.roomBy[S.room], ev = R.eventBy[S.event], rs = roomRows(S.room, S.event), n = uniq(rs.filter(hasValue).map(x => x.target_id)).length;
    t.innerHTML = `<div class="room-summary"><div><div class="eyebrow">${ev ? esc(ev.type) + ' \u00b7 ' + date(ev.at) : 'No visit selected'}</div><h2>${esc(r.name)}</h2></div><div class="buttons">${button('View readings', 'room-readings', S.room, 'btn')}${button('Location history', 'room-history', S.room)}</div></div>${roomMetricsHTML(rs)}` +
      `<p class="small">${n ? plural(n, 'recorded location') + ' at this visit.' : 'No measurement values at this visit.'}${r.limited ? ' Recorded access: ' + esc(r.access) + '.' + (r.desc ? ' ' + esc(r.desc) : '') : ''}</p>` + evidenceHTML(rs);
  }
  function goRoom(id, ev) {
    const r = R.roomBy[id]; if (!r) return;
    S.room = id; S.level = r.level; S.levelChosen = true;
    const latest = roomRows(id).filter(hasValue).sort((a, z) => T(a.recorded_at) - T(z.recorded_at)).pop();
    S.event = ev || (latest ? latest.event_id : S.event);
    setScreen('map');
  }

  /* Model: the existing matched model page, sandboxed, HS-MODEL-API-V1. Only
     model commands and location references (station IDs the model already
     holds) are posted into the frame; no values or record text. The model
     shows its own matched fixture. A model that does not answer leaves the plan. */
  function modelCall(method, args) {
    if (!MODEL.ready || !MODEL.frame || !MODEL.frame.contentWindow) return Promise.resolve(null);
    const id = ++MODEL.seq;
    return new Promise(resolve => {
      const timer = setTimeout(() => { MODEL.pending.delete(id); MODEL.errors.push('No reply: ' + method); resolve(null); }, 4000);
      MODEL.pending.set(id, { resolve, timer, method });
      MODEL.frame.contentWindow.postMessage({ target: 'hs-model', id, method, args: args || [] }, '*');
    });
  }
  function initModel() {
    if (MODEL.frame || !R.twin) return;
    listenModel();
    const f = document.createElement('iframe');
    f.id = 'hs51-house-model'; f.title = 'Interactive three-dimensional model of this property';
    f.setAttribute('sandbox', 'allow-scripts'); f.setAttribute('referrerpolicy', 'no-referrer');
    f.style.cssText = 'width:100%;height:100%;border:0;display:block';
    MODEL.frame = f; $('#hs51-model-view').appendChild(f);
    /* A standalone model page (no HS-MODEL-API-V1) is ready when it has loaded; nothing is posted into it. */
    if (R.standalone) f.addEventListener('load', () => { MODEL.loaded = true; clearTimeout(MODEL.timer); const l = $('#hs51-model-loading'); if (l) l.hidden = true; });
    f.src = R.twin.model_url + '?embed=1';
    if (!R.isDemo) { const n = document.createElement('div'); n.className = 'model-note'; n.textContent = 'The 3D model shows the shape of the home. Readings shown inside the model come from the model file, not from this record; use the room list and readings for your recorded values.'; $('#hs51-model-view').appendChild(n); }
    MODEL.timer = setTimeout(() => { if (!MODEL.ready && !MODEL.loaded) { const l = $('#hs51-model-loading'); if (l) l.innerHTML = '<div class="model-note">The 3D model has not opened on this device. The floor plan and room list hold the same record. ' + button('Use the floor plan', 'map-view', 'plan', 'link') + '</div>'; } }, 9000);
  }
  let modelQueue = Promise.resolve();
  function applyModel() { modelQueue = modelQueue.then(applyModelNow).catch(e => MODEL.errors.push(String(e))); return modelQueue; }
  async function applyModelNow() {
    if (!MODEL.ready) return;
    MODEL.suppressUntil = Date.now() + 1600;
    await modelCall('isolate', [null]); await modelCall('select', [null]); await modelCall('clearComparison'); await modelCall('view3d');
    /* Joe, 6 Oct: the map opens on the whole house. Floors are cut away only once a level or room is chosen. */
    const whole = !S.levelChosen && !S.room;
    await modelCall('roof', [whole ? 'on' : S.level === 'RS' ? 'reveal' : 'off']); await modelCall('cutaway', [!whole]); await modelCall('level', [whole ? 'all' : S.level]);
    for (const l of ['moisture', 'thermal', 'environment', 'air', 'envelope', 'context', 'ceilings', 'systems']) await modelCall('layer', [l, l === S.mapMetric]);
    await modelCall('layer', ['rooms', S.mapMetric !== 'environment']);
    const ev = R.eventBy[S.event]; if (ev) await modelCall('setEvent', [ev.modelEvent]);
    const room = R.roomBy[S.room]; if (room && room.geoId) await modelCall('room', [room.geoId]); else if (whole) { await modelCall('view3d'); await modelCall('fit'); } else await modelCall('fit');
  }
  function listenModel() {
    if (MODEL.listening) return; MODEL.listening = true;
    window.addEventListener('message', ev => {
      if (!MODEL.frame || ev.source !== MODEL.frame.contentWindow) return;
      const m = ev.data; if (!m || m.source !== 'hs-model') return;
      if (m.reply_to != null) { const p = MODEL.pending.get(m.reply_to); if (p) { clearTimeout(p.timer); MODEL.pending.delete(m.reply_to); if (m.error) MODEL.errors.push(p.method + ': ' + m.error); p.resolve(m.result); } return; }
      if (m.event === 'ready') { MODEL.ready = true; clearTimeout(MODEL.timer); const l = $('#hs51-model-loading'); if (l) l.hidden = true; applyModel(); return; }
      if (m.event === 'select' && m.payload && Date.now() > MODEL.suppressUntil) {
        const p = m.payload, id = String(p.id || (p.object && p.object.id) || (p.station && p.station.station_id) || (p.sensor && p.sensor.sensor_id) || '');
        const geoRoom = (p.room && p.room.id) || id;
        const room = R.roomByGeo[geoRoom] || (R.readings.find(r => r.target_id === id) ? R.roomBy[R.readings.find(r => r.target_id === id).room] : null);
        if (room) { S.room = room.id; S.level = room.level; renderSelectedRoom(); $$('#hs51-map-rooms [data-id]').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === room.id ? 'true' : 'false')); }
        const row = R.readings.find(r => r.target_id === id && r.event_id === S.event);
        if (row) readingModal(row.reading_id);
      }
    });
  }

  /* ---------- 12. History ---------- */
  function followupOf(e) { const iv = R.interventions.filter(x => T(x.at) < T(e.at)).pop(); if (!iv) return null; const first = R.measurementEvents.find(x => T(x.at) > T(iv.at)); return first && first.id === e.id ? iv : null; }
  function renderHistory() {
    const tab = S.historyTab || 'timeline';
    const head = header('Measured over time', 'Home History', 'Visits, recorded changes and follow-ups stay together. A later date alone does not make two readings comparable.', R) +
      `<div class="tabs" role="tablist" aria-label="History views">${[['timeline', 'Timeline'], ['conditions', 'Visit conditions'], ['depth', 'Record depth']].map(t => `<button type="button" role="tab" aria-selected="${tab === t[0]}" data-action="history-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`;
    if (tab === 'conditions') { $('#history-page').innerHTML = head + conditionsHTML(); return; }
    if (tab === 'depth') { $('#history-page').innerHTML = head + depthHTML(); return; }
    if (!R.events.length) { $('#history-page').innerHTML = head + '<div class="empty">No visits are recorded yet. Your first visit will appear here with what was measured.</div>'; return; }
    if (!S.history || !R.eventBy[S.history]) S.history = (R.lastVisit || R.events[R.events.length - 1]).id;
    const e = R.eventBy[S.history];
    $('#history-page').innerHTML = head +
      `<div class="section-head"><h2>${plural(R.measurementEvents.length, 'measurement visit')} \u00b7 ${plural(R.interventions.length, 'recorded change')}</h2>${compareTargets().length ? button('Compare readings', 'compare', '', 'link') : ''}</div>` +
      `<div class="history-layout"><div class="timeline">${R.events.slice().reverse().map(x => `<article class="event-card ${x.id === S.history ? 'selected' : ''}"><div class="event-top"><div class="eyebrow">${date(x.at)}</div>${chip(x.kind === 'intervention' ? 'Recorded change' : x.kind === 'followup' ? 'Follow-up' : x.scheduled ? 'Scheduled' : x.cancelled ? 'Cancelled' : 'Visit', x.kind === 'intervention' ? 'blue' : 'neutral')}</div><h3>${esc(x.kind === 'intervention' ? 'Recorded change' : x.type)}</h3><p>${x.kind === 'intervention' ? 'An event in the house history, not a measurement visit.' : x.scheduled ? 'Scheduled. No measured evidence yet.' : plural(R.byEvent[x.id].filter(hasValue).length, 'reading') + ' at ' + plural(uniq(R.byEvent[x.id].filter(hasValue).map(r => r.target_id)).length, 'location') + '.'}</p>${button('Open this event', 'history-event', x.id, 'link')}</article>`).join('')}</div><section id="hs51-history-detail" class="panel history-detail">${historyDetail(e)}</section></div>`;
  }
  /* Restored from core V2.2 (Context): property climate context kept apart from visit conditions, which are shown side by side and never scored. */
  function conditionsHTML() {
    const b = R.b, vs = R.events.filter(e => e.kind !== 'intervention' && !e.scheduled);
    const rowsC = [['Weather', 'weather'], ['Recent rain', 'recent_rain'], ['Occupancy', 'occupancy_status'], ['Windows and doors', 'windows_condition'], ['Heating and cooling', 'hvac_status'], ['Fans', 'fans_status']];
    return `<section class="panel"><div class="eyebrow">Property climate context</div><h3 style="margin:8px 0">Where the home sits</h3>` +
      `<dl class="kvs"><dt>Climate zone</dt><dd>${esc(b.climate_zone || 'Not recorded yet')}</dd><dt>Source</dt><dd>${esc(b.climate_zone_source || (b.climate_zone ? 'Source not recorded' : 'Added from the property address when the record is set up.'))}</dd><dt>Property notes</dt><dd>${esc(b.climate_note || 'Not recorded yet')}</dd></dl>` +
      `<p class="footnote">Reference context about the property. It is not a measurement and not a compliance statement.</p></section>` +
      `<section class="panel" style="margin-top:18px"><div class="eyebrow">Visit conditions</div><h3 style="margin:8px 0">What was happening when each visit was measured</h3><p class="small">As written into the record at each visit, side by side. Conditions help decide whether readings can be compared; they are not scored.</p>` +
      (vs.length ? `<div class="table-wrap"><table class="cond-table"><thead><tr><th>Condition</th>${vs.map(e => `<th>${esc(e.type)}<br>${date(e.at)}</th>`).join('')}</tr></thead><tbody>${rowsC.map(rc => `<tr><td>${rc[0]}</td>${vs.map(e => `<td>${esc(e.raw[rc[1]] || 'Not recorded')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="small">No visit is recorded yet.</p>') + `</section>`;
  }
  /* Restored from core V2.2 (Record depth): what the record holds, layer by layer, from fields that exist. Nothing is inferred. */
  function depthHTML() {
    const rows = [];
    CHAPTERS.forEach(c => { const v = coverage(R, c.id); rows.push([c.title, v.label, v.kind, v.taken.length ? plural(v.locations, 'recorded location') + ', last measured ' + date(v.last.recorded_at) + (v.limits.length ? '. Recorded limit: ' + v.limits[0] : '.') : (v.spaceKnown ? 'No readings yet.' : 'This record does not hold this space.')]); });
    const seasons = {}; R.measurementEvents.forEach(e => { const n = seasonOf(e.at); if (n) seasons[n] = (seasons[n] || 0) + 1; });
    ['Winter', 'Summer'].forEach(n => rows.push([n + ' visits', seasons[n] ? 'Measured' : 'Not yet measured', seasons[n] ? '' : 'neutral', seasons[n] ? plural(seasons[n], n.toLowerCase() + ' visit') + ' recorded.' : 'No ' + n.toLowerCase() + ' visit is recorded yet.']));
    const fu = R.measurementEvents.find(e => R.interventions.some(iv => T(iv.at) < T(e.at)));
    rows.push(['Visit after a recorded change', fu ? 'Recorded' : 'Not yet recorded', fu ? '' : 'neutral', fu ? fu.type + ', ' + date(fu.at) + '. A later visit is not, on its own, an improvement.' : 'No change and later visit are recorded yet.']);
    rows.push(['Photos & evidence', R.evidence === null ? 'Not available' : R.evidence.length ? 'Released' : 'None released yet', R.evidence && R.evidence.length ? '' : 'neutral', R.evidence === null ? 'Could not be read just now.' : plural(R.evidence.length, 'item') + ' released to this record.']);
    rows.push(['Air movement', 'Not offered yet', 'neutral', 'No air-movement method is offered yet.']);
    return `<section class="panel"><p class="small" style="margin-top:0">What this record holds, layer by layer. Everything already measured stays available. A new layer is added only by a new visit.</p><div class="list depth-list">${rows.map(r => `<div class="row"><div><h4>${esc(r[0])}</h4><p>${esc(r[3])}</p></div>${chip(r[1], r[2])}</div>`).join('')}</div></section>`;
  }
  function historyDetail(e) {
    const rs = R.byEvent[e.id] || [];
    if (e.kind === 'intervention') {
      const later = R.measurementEvents.find(x => T(x.at) > T(e.at));
      return `<div class="eyebrow">${date(e.at)} \u00b7 Recorded change</div><h2 style="margin-top:9px">${esc(e.type)}</h2><p class="small">${esc(e.raw.baseline_notes || 'No description recorded.')}</p><div class="notice blue">This event has no measurement readings. It does not establish that the change improved anything.</div><div class="buttons">${later ? button('Open the next measurement visit', 'history-event', later.id, 'btn') : ''}</div>`;
    }
    const iv = followupOf(e), s = e.raw;
    const cond = [['Weather', s.weather], ['Recent rain', s.recent_rain], ['Occupancy', s.occupancy_status], ['Windows and doors', s.windows_condition], ['Heating and cooling', s.hvac_status], ['Fans', s.fans_status]];
    return `<div class="eyebrow">${date(e.at)} \u00b7 ${e.kind === 'followup' ? 'Follow-up visit' : 'Measurement visit'}</div><h2 style="margin-top:9px">${esc(e.type)}</h2>` +
      `<p class="small">${e.scheduled ? 'Scheduled. A scheduled visit has no measured evidence yet.' : plural(rs.filter(hasValue).length, 'reading') + ' at ' + plural(uniq(rs.filter(hasValue).map(r => r.target_id)).length, 'location') + '. Includes only the recorded places and methods.'}</p>` +
      (iv ? `<div class="notice"><b>First measurement visit after the recorded change on ${date(iv.at)}</b><br>${esc(iv.raw.baseline_notes || '')}<br>Being later does not make readings comparable or show an improvement. No comparison decision is recorded for this pair.</div>` : '') +
      `<div class="context-grid">${cond.slice(0, 4).map(c => `<div><small>${esc(c[0])}</small><b>${esc(c[1] || 'Not recorded')}</b></div>`).join('')}</div>` +
      `<p class="footnote">Visit conditions as recorded on the day${R.isDemo && !R.isAnon ? ' (synthetic)' : ''}. Weather and rain are outdoor context, not indoor measurements.</p>` +
      `<div class="buttons">${rs.some(hasValue) ? button('View on Home Map', 'event-map', e.id, 'btn') + button('View readings', 'event-readings', e.id) : ''}${e.report ? button('Open the released report', 'nav', 'reports') : rs.some(hasValue) ? button('Visit record summary', 'summary', e.id) : ''}</div>` +
      `<details class="detail-section"><summary>All recorded visit conditions</summary><dl class="kvs">${cond.map(c => `<dt>${esc(c[0])}</dt><dd>${esc(c[1] || 'Not recorded')}</dd>`).join('')}<dt>Assessor</dt><dd>${esc(s.assessor || 'Not recorded')}</dd><dt>Status</dt><dd>${esc(s.status || 'Not recorded')}</dd></dl></details>`;
  }
  /* Compare: same location + parameter + unit + method only. The schema holds
     no comparison decision, so the status always says none is recorded and
     no difference, trend or verdict is calculated. */
  function compareTargets() {
    const m = {}; R.readings.filter(hasValue).forEach(r => { const k = r.target_id + '|' + r.parameter + '|' + r.unit + '|' + r.method; (m[k] = m[k] || new Set()).add(r.event_id); });
    return uniq(Object.keys(m).filter(k => m[k].size > 1).map(k => k.split('|')[0]));
  }
  function compareInfo(a, b, tid) {
    const pick = ev => R.readings.filter(r => r.event_id === ev && r.target_id === tid).sort((x, y) => T(x.recorded_at) - T(y.recorded_at)).pop() || null;
    const l = pick(a), r = pick(b);
    let status = 'No comparison decision recorded', reason = 'Same location, parameter, unit and method. The values are shown side by side only; no difference, trend or verdict is calculated.';
    if (a === b) { status = 'Choose two different visits'; reason = 'A visit cannot be compared with itself.'; }
    else if (!hasValue(l) || !hasValue(r)) { status = 'Not enough readings'; reason = 'Both visits must hold a measurement value at this exact location.'; }
    else if (!l.unit || !r.unit || !l.method || !r.method) { status = 'Comparison not established'; reason = 'Unit or method information is missing. No difference is calculated.'; }
    else if (l.unit !== r.unit || l.method !== r.method || l.parameter !== r.parameter) { status = 'Not comparable'; reason = 'The recorded unit, method or parameter differs. These values are not treated as interchangeable.'; }
    return { l, r, status, reason };
  }
  function compareModal() {
    const opts = compareTargets(); if (!opts.length) return;
    if (opts.indexOf(S.compareTarget) === -1) S.compareTarget = opts[0];
    const evs = R.measurementEvents.filter(e => R.readings.some(r => r.event_id === e.id && r.target_id === S.compareTarget && hasValue(r)));
    if (!R.eventBy[S.compareA] || evs.indexOf(R.eventBy[S.compareA]) === -1) S.compareA = evs[0] ? evs[0].id : null;
    if (!R.eventBy[S.compareB] || evs.indexOf(R.eventBy[S.compareB]) === -1) S.compareB = evs[1] ? evs[1].id : S.compareA;
    const c = compareInfo(S.compareA, S.compareB, S.compareTarget), lbl = tid => R.targetLabel(R.readings.find(r => r.target_id === tid));
    const eo = sel => evs.map(e => `<option value="${esc(e.id)}" ${e.id === sel ? 'selected' : ''}>${esc(e.type)} \u00b7 ${date(e.at)}</option>`).join('');
    const side = (ev, r) => `<div class="panel"><div class="eyebrow">${R.eventBy[ev] ? date(R.eventBy[ev].at) : ''}</div><div class="data-value" style="margin:13px 0">${r ? esc(valueText(r)) : 'No reading'}</div><p class="small">${esc(methodText(r && r.method))}</p>${r ? button('Reading details', 'reading', r.reading_id, 'link') : ''}</div>`;
    openModal('Compare the same location', `<p class="small">Select two visits. Home State keeps the evidence and any comparison decision separate.</p><div class="filters"><div class="field"><label for="hs51-compare-a">Earlier visit</label><select id="hs51-compare-a">${eo(S.compareA)}</select></div><div class="field"><label for="hs51-compare-b">Later visit</label><select id="hs51-compare-b">${eo(S.compareB)}</select></div></div>` +
      `<div class="field"><label for="hs51-compare-target">Exact location</label><select id="hs51-compare-target">${opts.map(id => `<option value="${esc(id)}" ${id === S.compareTarget ? 'selected' : ''}>${esc(lbl(id))}</option>`).join('')}</select></div>` +
      `<div class="notice warn"><b>${esc(c.status)}</b><br>${esc(c.reason)}</div><div class="split">${side(S.compareA, c.l)}${side(S.compareB, c.r)}</div>` +
      `<p class="footnote">No automated cause, trend or improvement verdict is applied.</p><div class="buttons">${button('Open full history', 'target-history', S.compareTarget)}</div>`, 'Evidence comparison');
  }

  /* ---------- 13. Reports ---------- */
  function summaryBody(e) {
    const rs = R.byEvent[e.id] || [], vals = rs.filter(hasValue);
    return `<article class="report-sheet"><div class="eyebrow">Home State \u00b7 visit record summary</div><h2 class="report-title">${esc(e.type)} \u00b7 record summary</h2><p><b>Property:</b> ${esc(propertyName(R))}<br><b>Visit:</b> ${date(e.at)}<br><b>Source:</b> the readings held in this home record${R.isDemo ? ' (synthetic demonstration record)' : ''}.</p>` +
      `<div class="notice blue">This summary is generated from the same readings as Home Map and History. It is not a released professional report.</div>` +
      `<h3>What was recorded</h3><div class="table-wrap"><table><thead><tr><th>Section</th><th>Locations at this visit</th></tr></thead><tbody>${CHAPTERS.map(c => `<tr><td>${esc(c.title)}</td><td>${uniq(R.chapterRows(c.id, e.id).filter(hasValue).map(r => r.target_id)).length}</td></tr>`).join('')}</tbody></table></div>` +
      `<p class="footnote">Sections can share a reading, so their counts are not added together. This visit holds ${plural(vals.length, 'reading')} with values at ${plural(uniq(vals.map(r => r.target_id)).length, 'location')}${rs.length > vals.length ? ', and ' + plural(rs.length - vals.length, 'recorded location') + ' without a value' : ''}.</p>` +
      `<h3>Limits</h3><p>Readings describe the fixed places, times and methods recorded. They do not establish the cause of a moisture pattern, conditions inside unopened construction, or that an entire building element was assessed.</p>` +
      `<h3>Readings</h3><div class="table-wrap"><table><thead><tr><th>Location</th><th>Measurement</th><th>Reading</th><th>Method</th></tr></thead><tbody>${rs.map(r => `<tr><td>${esc(R.targetLabel(r))}</td><td>${esc(PARAM_NAME[r.parameter] || r.parameter)}</td><td>${esc(valueText(r))}</td><td>${esc(methodText(r.method))}</td></tr>`).join('')}</tbody></table></div></article>`;
  }
  function summaryModal(id) { const e = R.eventBy[id]; if (!e || e.kind === 'intervention') return; openModal('Visit record summary', summaryBody(e) + `<div class="buttons">${button('Download this summary', 'download-summary', id, 'btn')}</div>`, 'Generated from your record \u00b7 not a released report'); }
  function renderReports() {
    const rel = R.released, unlinked = R.readings.filter(r => !R.eventBy[r.event_id] && !R.roomBy[r.room]).length;
    $('#reports-page').innerHTML = header('Your formal record', 'Reports', 'Reports stay connected to their visit, locations and source readings.', R) +
      `<section class="panel"><div class="eyebrow">Released reports</div>${!R.reportsReadable ? '<p class="small" style="margin-top:10px">Released reports could not be read just now. Please reload, or contact Joe Builds.</p>' : rel.length ? `<div class="list">${rel.map(r => `<div class="report-card"><span class="icon">${icon('report')}</span><div><h3>${esc(r.report_title || r.report_type || 'Report')}</h3><p>${date(r.report_date || r.published_at)}${r.version ? ' \u00b7 Version ' + esc(r.version) : ''}</p></div><div class="buttons"><button type="button" class="btn light" data-action="download-report" data-id="${esc(r.id)}">${icon('download')} Download</button><span class="small" aria-live="polite" data-status="${esc(r.id)}"></span></div></div>`).join('')}</div>` : '<p class="small" style="margin-top:10px">No released reports are in this record yet. Released reports appear here once Joe Builds publishes them to you.</p>'}</section>` +
      `<section class="panel" style="margin-top:18px"><div class="eyebrow">Photos & evidence</div>${R.evidence === null ? '<p class="small" style="margin-top:10px">Photos and evidence could not be read just now.</p>' : R.evidence.length ? `<div class="ev-grid">${R.evidence.map(evCard).join('')}</div>` : '<p class="small" style="margin-top:10px">No photos or evidence have been released to this record yet. Each item appears here, linked to its room and visit, once released.</p>'}</section>` +
      `<section class="panel" style="margin-top:18px"><div class="eyebrow">Visit record summaries</div><p class="small" style="margin:8px 0 0">Generated from the readings in your record. Not released professional reports.</p><div class="list">${R.measurementEvents.slice().reverse().map(e => `<div class="report-card"><span class="icon">${icon('history')}</span><div><h3>${esc(e.type)}</h3><p>${date(e.at)} \u00b7 ${plural(R.byEvent[e.id].filter(hasValue).length, 'recorded value')}</p></div><div class="buttons">${button('Open', 'summary', e.id)}</div></div>`).join('') || '<p class="small">No measurement visits yet.</p>'}</div></section>` +
      (unlinked ? `<p class="footnote">${plural(unlinked, 'reading')} in this record ${unlinked === 1 ? 'is' : 'are'} not linked to a visit or room. ${unlinked === 1 ? 'It is' : 'They are'} kept in the CSV export.</p>` : '') + `<div class="home-foot"><p>The full reading register keeps every source value and reference.</p>${R.readings.length ? button('Export all readings (CSV)', 'export-csv', '', 'link') : ''}</div>`;
  }
  function download(content, name, type) { if (downloadURL) URL.revokeObjectURL(downloadURL); downloadURL = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = downloadURL; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function fileTag() { return String(R.b.building_code || 'record').replace(/[^A-Za-z0-9-]/g, ''); }
  function downloadSummary(id) {
    const e = R.eventBy[id]; if (!e) return;
    download('<!doctype html><html lang="en-AU"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Home State visit record summary</title><style>body{max-width:850px;margin:40px auto;padding:24px;font:15px/1.6 Arial,sans-serif;color:#293c31}table{border-collapse:collapse;width:100%;font-size:12px}td,th{padding:8px;border:1px solid #d7d9cb;text-align:left}.notice{padding:15px;background:#eef1e8;border:1px solid #ccd4c0}.eyebrow,.footnote{font-size:11px;color:#5c6556}button{display:none}</style>' + summaryBody(e) + '</html>', 'Home-State-' + fileTag() + '-' + e.type.replace(/[^A-Za-z0-9]+/g, '-') + '-summary.html', 'text/html;charset=utf-8');
    toast('Summary downloaded. Open it in a browser to read or print.');
  }
  function exportCSV() {
    const cols = ['reading_id', 'location_reference', 'room', 'visit', 'visit_date', 'parameter', 'value', 'unit', 'method', 'device_reference', 'recorded_at', 'reading_status', 'sections'];
    const cell = v => { let s = String(v == null ? '' : v); if (/^[=+@\-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const rows = R.readings.map(r => { const e = R.eventBy[r.event_id]; const rm = R.roomBy[r.room]; return [r.reading_id, r.target_id, rm ? rm.name : '', e ? e.type : '', e ? e.at : '', PARAM_NAME[r.parameter] || r.parameter, hasValue(r) ? r.value : '', r.unit || '', r.method || '', r.device_id || '', r.recorded_at || '', r.reading_status || '', r.sections.join(' ')]; });
    download('\ufeff' + [cols].concat(rows).map(a => a.map(cell).join(',')).join('\r\n'), 'Home-State-' + fileTag() + '-all-readings.csv', 'text/csv;charset=utf-8');
    toast(plural(R.readings.length, 'reading record') + ' exported.');
  }
  /* Released report: the existing report-delivery function, unchanged from V2.4.1. */
  async function downloadReport(id, btn) {
    const status = $('#hs51 [data-status="' + String(id).replace(/["\\]/g, '') + '"]');
    if (btn) btn.disabled = true; if (status) status.textContent = 'Preparing your report\u2026';
    try {
      const res = await fetch(URLBASE.replace(/\/+$/, '') + '/functions/v1/report-delivery', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON }, body: JSON.stringify({ report_id: id }) });
      if (!res.ok) throw new Error('not_available');
      const blob = await res.blob(), cd = res.headers.get('Content-Disposition') || '', m = cd.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = m ? m[1] : 'Home-State-report.pdf';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      if (status) status.textContent = 'Your report has downloaded.';
    } catch (err) { if (status) status.textContent = 'The report could not be downloaded just now. Please try again, or contact Joe Builds.'; }
    finally { if (btn) btn.disabled = false; }
  }

  /* ---------- 14. Practice walkthrough (demonstration records only) ---------- */
  function tourSteps() {
    const wet = R.rooms.find(r => r.wet && roomRows(r.id).some(hasValue));
    const iv = R.interventions[R.interventions.length - 1], fu = iv ? R.measurementEvents.find(e => T(e.at) > T(iv.at)) : null;
    const lim = CHAPTERS.find(c => coverage(R, c.id).kind === 'partial');
    const steps = [{ title: 'Start with the home, not a list of services', text: 'Five stable sections show where readings exist and where coverage is limited. The Baseline is the visit that started the record.', run: () => setScreen('home') }];
    if (wet) steps.push({ title: 'Follow one location', text: 'Choose a room on the map, then open its readings.', run: () => goRoom(wet.id) });
    if (wet) steps.push({ title: 'Keep the evidence behind the simple surface', text: 'A reading keeps its location, value, unit, method, device and date. It is not a score for the home.', run: () => { const r = roomRows(wet.id, S.event).find(hasValue) || roomRows(wet.id).find(hasValue); if (r) readingModal(r.reading_id); } });
    if (fu) steps.push({ title: 'See how the record grows', text: 'A recorded change is separate from the later measurement visit. A follow-up is not automatically an improvement.', run: () => { S.history = fu.id; setScreen('history'); } });
    if (lim) steps.push({ title: 'Explain the next measurement without a hard sell', text: 'Recorded limits stay visible. An unmeasured area is a chance to agree access and inclusions, not an automatic charge.', run: () => { setScreen('home'); chapterModal(lim.id); } });
    steps.push({ title: 'Finish with the connected output', text: 'Released reports and visit record summaries come from the same values as the map and history.', run: () => setScreen('reports') });
    return steps;
  }
  function showTour() {
    const steps = tourSteps(), step = steps[S.tour], bar = $('#hs51-tourbar');
    if (!step) { bar.hidden = true; return; }
    step.run();
    const html = `<div class="eyebrow">Walkthrough ${S.tour + 1} of ${steps.length} \u00b7 ${esc(step.title)}</div><p>${esc(step.text)}</p><div class="tour-actions"><button type="button" class="btn" data-action="tour-end">Close guide</button><div class="buttons" style="margin:0"><button type="button" class="btn" data-action="tour-prev" ${S.tour === 0 ? 'disabled' : ''}>Back</button><button type="button" class="btn primary" data-action="tour-next">${S.tour === steps.length - 1 ? 'Finish' : 'Next'}</button></div></div>`;
    if ($('#hs51-dialog').open) { bar.hidden = true; const n = document.createElement('div'); n.className = 'notice blue'; n.innerHTML = `<b>Walkthrough ${S.tour + 1} of ${steps.length}</b><br>${esc(step.text)}<div class="buttons">${button(S.tour === steps.length - 1 ? 'Finish' : 'Continue walkthrough', 'tour-next', '', 'btn light')}${button('Close guide', 'tour-end', '', 'link')}</div>`; $('#hs51-dialog-body').prepend(n); }
    else { bar.hidden = false; bar.innerHTML = html; }
  }
  function helpModal() {
    openModal('Practise the Home State walkthrough', `<p class="lead">A read-only walk through this demonstration record.</p><div class="list"><div class="row"><div><h4>Home</h4><p>Explain what was measured and the limits. The Baseline is a visit, not a competing category.</p></div></div><div class="row"><div><h4>Home Map</h4><p>Select a room. Open a reading and follow its location, method and date.</p></div></div><div class="row"><div><h4>History</h4><p>Connect the recorded change with the later visit. Being later is not an improvement.</p></div></div><div class="row"><div><h4>Reports</h4><p>Released reports, visit record summaries and the full reading export.</p></div></div></div><div class="buttons">${button('Start guided walkthrough', 'tour-start', '', 'btn')}</div><div class="notice blue">Synthetic readings only. No client data, payment, booking or outbound request.</div>`, 'Practice guide');
  }

  /* ---------- 15. Actions ---------- */
  async function action(name, id, el) {
    switch (name) {
      case 'pick': try { const u = new URL(location.href); u.searchParams.set('p', id); location.href = u.toString(); } catch (e) {} break;
      case 'nav': if (id === 'history') S.historyTab = 'timeline'; setScreen(id); break;
      case 'close': closeModal(); break;
      case 'chapter': chapterModal(id); break;
      case 'inclusions': inclusionsModal(); break;
      case 'payments': paymentsModal(); break;
      case 'help': helpModal(); break;
      case 'signout':
        try { sessionStorage.removeItem('hs_property'); } catch (e) {}
        /* Same sequence as the site footer FIX v2 sign-out (U-2). */
        if (el) { el.disabled = true; }
        try { if (window.$memberstackDom && window.$memberstackDom.logout) { await window.$memberstackDom.logout(); } } catch (e) {}
        try { if (window.JBPortal && window.JBPortal.signOutLocal) window.JBPortal.signOutLocal(); } catch (e) {}
        try { sessionStorage.clear(); } catch (e) {}
        window.location.replace('/login'); break;
      case 'room': goRoom(id); break;
      case 'room-map': goRoom(id, S.event); break;
      case 'room-details': roomModal(id); break;
      case 'chapter-map': {
        const v = coverage(R, id), last = v.last;
        S.event = last ? last.event_id : S.event; S.room = null;
        S.mapMetric = id === 'environment' ? 'environment' : (id === 'wet' || id === 'envelope') ? 'moisture' : 'none';
        const lv = id === 'roof' ? 'RS' : id === 'subfloor' ? 'SF' : (last && R.roomBy[last.room] ? R.roomBy[last.room].level : 'L1');
        S.level = lv; S.levelChosen = true; setScreen('map'); break;
      }
      case 'chapter-readings': openTable(chapterBy[id].title + ' readings', R.chapterRows(id)); break;
      case 'room-readings': openTable((R.roomBy[id] ? R.roomBy[id].name : 'Location') + ' readings' + (R.eventBy[S.event] ? ' \u00b7 ' + date(R.eventBy[S.event].at) : ''), roomRows(id, S.event)); break;
      case 'room-history': openTable((R.roomBy[id] ? R.roomBy[id].name : 'Location') + ' \u00b7 all visits', roomRows(id)); break;
      case 'map-room': {
        if (!R.roomBy[id]) break;
        S.room = id; S.level = R.roomBy[id].level; S.levelChosen = true; renderSelectedRoom(); renderPlan(); if (S.mapView === '3d' && MODEL.ready) applyModel();
        $$('#hs51-map-rooms [data-id]').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id ? 'true' : 'false'));
        if (MODEL.ready && S.mapView === '3d' && R.roomBy[id].geoId) { MODEL.suppressUntil = Date.now() + 1500; await modelCall('room', [R.roomBy[id].geoId]); }
        if (window.innerWidth < 871) { const t = $('#hs51-selected-room'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        break;
      }
      case 'map-view': S.mapView = id; renderMap(); break;
      case 'map-level': S.level = id; S.levelChosen = true; S.room = null; renderMap(); break;
      case 'map-whole': S.levelChosen = false; S.room = null; renderMap(); break;
      case 'reset-map': S.room = null; S.levelChosen = false; S.mapMetric = 'none'; renderMap(); break;
      case 'event': S.history = id; S.historyTab = 'timeline'; setScreen('history'); break;
      case 'history-tab': S.historyTab = id; renderHistory(); break;
      case 'depth': S.historyTab = 'depth'; setScreen('history'); break;
      case 'hero-3d': S.mapView = '3d'; S.levelChosen = false; S.room = null; setScreen('map'); break;
      case 'evidence': await openEvidence(id); break;
      case 'history-event': S.history = id; S.historyTab = 'timeline'; renderHistory(); if (window.innerWidth < 871) { const t = $('#hs51-history-detail'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } break;
      case 'event-map': S.event = id; S.room = null; setScreen('map'); break;
      case 'event-readings': openTable((R.eventBy[id] ? R.eventBy[id].type : 'Visit') + ' \u00b7 readings', R.byEvent[id] || []); break;
      case 'reading': readingModal(id); break;
      case 'reading-map': {
        const r = R.readingBy[id]; if (!r) break;
        S.event = r.event_id; S.mapMetric = r.parameter === 'moisture' ? 'moisture' : r.parameter === 'surface_temperature' ? 'thermal' : 'environment';
        S.room = R.roomBy[r.room] ? r.room : null; S.level = R.roomBy[r.room] ? R.roomBy[r.room].level : S.level; S.levelChosen = true; setScreen('map');
        if (MODEL.ready && S.mapView === '3d') { await applyModel(); await modelCall('station', [r.target_id]); }
        break;
      }
      case 'target-history': targetHistory(id); break;
      case 'compare-target': S.compareTarget = id; compareModal(); break;
      case 'compare': compareModal(); break;
      case 'summary': summaryModal(id); break;
      case 'download-summary': downloadSummary(id); break;
      case 'download-report': await downloadReport(id, el); break;
      case 'export-csv': exportCSV(); break;
      case 'opportunity': opportunityModal(id); break;
      case 'request': requestModal(id); break;
      case 'download-request': { const p = $('#hs51-request-preview'); if (p) download(p.textContent, 'Home-State-' + (R.isDemo ? 'PRACTICE-' : '') + 'enquiry.txt', 'text/plain;charset=utf-8'); toast('Enquiry text downloaded. Nothing was sent.'); break; }
      case 'table-prev': S.table.page--; renderTableModal(); break;
      case 'table-next': S.table.page++; renderTableModal(); break;
      case 'tour-start': S.tour = 0; closeModal(); showTour(); break;
      case 'tour-next': S.tour++; closeModal(); showTour(); break;
      case 'tour-prev': S.tour--; closeModal(); showTour(); break;
      case 'tour-end': S.tour = -1; $('#hs51-tourbar').hidden = true; closeModal(); break;
    }
  }
  function wire() {
    const root = $('#hs51');
    root.addEventListener('click', ev => {
      const b = ev.target.closest('[data-action]');
      if (b && !b.disabled && root.contains(b)) {
        if (b.dataset.action !== 'signout') ev.preventDefault();
        Promise.resolve(action(b.dataset.action, b.dataset.id || '', b)).catch(e => { MODEL.errors.push(String(e)); console.error('[HS]', e); toast('That view could not open. Return to Home or use the floor plan.'); });
      }
    });
    root.addEventListener('keydown', ev => {
      const b = ev.target.closest('[role=button][data-action]');
      if (b && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); Promise.resolve(action(b.dataset.action, b.dataset.id || '', b)).catch(e => console.error('[HS]', e)); }
    });
    root.addEventListener('change', ev => {
      const el = ev.target;
      if (el.id === 'hs51-picker') { try { const u = new URL(location.href); u.searchParams.set('p', el.value); location.href = u.toString(); } catch (e) {} return; }
      if (el.id === 'hs51-map-event') { S.event = el.value; renderMap(); }
      if (el.id === 'hs51-map-metric') { S.mapMetric = el.value; renderMap(); }
      if (el.id === 'hs51-compare-a' || el.id === 'hs51-compare-b' || el.id === 'hs51-compare-target') {
        const keep = el.id; S[{ 'hs51-compare-a': 'compareA', 'hs51-compare-b': 'compareB', 'hs51-compare-target': 'compareTarget' }[el.id]] = el.value;
        compareModal(); const k = document.getElementById(keep); if (k) k.focus();
      }
    });
    root.addEventListener('input', ev => { if (ev.target.id === 'hs51-reading-search') { S.table.query = ev.target.value; S.table.page = 0; renderTableModal(true); } });
    root.addEventListener('submit', ev => {
      if (ev.target.id !== 'hs51-request-form') return; ev.preventDefault();
      S.request.kind = $('#hs51-request-kind').value; S.request.note = $('#hs51-request-note').value.trim();
      const c = chapterBy[S.request.chapter];
      const text = (R.isDemo ? 'PRACTICE ENQUIRY - NOT SENT\nHome State demonstration property\n' : 'Home State enquiry\nProperty: ' + propertyName(R) + '\n') + 'Area: ' + c.title + '\nRequest: ' + S.request.kind + '\nNote: ' + (S.request.note || 'No additional note') + '\nPrice: not agreed\nBooking: not made\nPayment: no charge';
      const mail = R.isDemo ? '' : `<a class="btn" href="mailto:admin@joebuilds.com.au?subject=${encodeURIComponent('Home State enquiry: ' + c.title)}&body=${encodeURIComponent(text)}">Send from my email ${icon('arrow')}</a>`;
      openModal(R.isDemo ? 'Practice enquiry prepared' : 'Your enquiry is ready', `<div class="notice blue"><b>Nothing has been sent.</b><br>${R.isDemo ? 'This is a rehearsal of the enquiry step.' : 'Send it from your own email when you are ready.'}</div><pre id="hs51-request-preview" style="white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.8 ui-monospace,monospace">${esc(text)}</pre><div class="buttons">${mail}${button('Download the text', 'download-request', '', mail ? 'btn light' : 'btn')}${button('Return to Home', 'nav', 'home')}</div>`, R.isDemo ? 'Practice complete' : 'Enquiry');
    });
    const d = $('#hs51-dialog');
    d.addEventListener('close', () => { if (activeOpener && activeOpener.isConnected) activeOpener.focus({ preventScroll: true }); });
    d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(); } });
  }

  /* ---------- 16. Boot ---------- */
  function renderNoBuilding() {
    $('#hs51-loading').innerHTML = '<h2>No property assigned</h2><p>This sign-in has no home record linked to it yet. If a Home Performance Baseline has been completed for you, contact Joe Builds and the record will be connected.</p>';
  }
  async function boot() {
    injectCss(); buildShell(); wire();
    try {
      const d = await loadAll();
      if (d.none) { renderNoBuilding(); return; }
      R = build(d);
      fillChrome(R);
      $('#hs51-loading').hidden = true;
      setScreen(PATH_SCREEN[PATH], false);
      if (OPEN_PAYMENTS) paymentsModal();
      if (R.missedChoice) toast('That property is not linked to this sign-in. Showing ' + propertyName(R) + '.');
      window.HS51 = Object.freeze({
        version: VERSION, building: () => R.b.building_code,
        counts: () => ({ readings: R.readings.length, uniqueReadingIDs: uniq(R.readings.map(r => r.reading_id)).length, events: R.events.length, measurementVisits: R.measurementEvents.length, interventions: R.interventions.length, unsectioned: R.readings.filter(r => !r.sections.length).length, chapters: CHAPTERS.map(c => { const v = coverage(R, c.id); return { id: c.id, label: v.label, locations: v.locations, rows: v.rows.length, taken: v.taken.length, limits: v.limits.length }; }) }),
        state: () => JSON.parse(JSON.stringify(S)), modelReady: () => MODEL.ready, modelErrors: () => MODEL.errors.slice()
      });
    } catch (err) {
      console.error('[HS]', err);
      $('#hs51-loading').innerHTML = '<p>The record could not be loaded just now. Nothing on this page reflects the home. Reload the page, or sign in again.</p>';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
