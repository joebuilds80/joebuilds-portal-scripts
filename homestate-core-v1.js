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

  const SCREEN = (document.querySelector('[data-hs-screen]') || {}).getAttribute
    ? document.querySelector('[data-hs-screen]').getAttribute('data-hs-screen') : null;
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

  const ROOM_STATE = {
    'within recorded range': 'Within recorded range',
    'elevated readings recorded': 'Elevated readings recorded',
    'not assessed': 'Not assessed'
  };
  const roomBadge = r => {
    const key = String(r.room_status || '').toLowerCase().trim();
    if (key === 'within recorded range') return badge('within recorded range');
    if (key === 'elevated readings recorded') return badge('elevated');
    if (key === 'not assessed') return badge('not assessed');
    return badge('__unmapped__');
  };

  /* ---------- 2. Data ---------- */
  async function loadAll() {
    const { data: bs, error: bErr } = await sb.from('buildings').select('*');
    if (bErr) throw bErr;
    if (!bs || !bs.length) return { none: true };
    const building = bs[0];
    const bid = building.id;
    const [rooms, points, meas, scen, events, reports] = await Promise.all([
      sb.from('rooms').select('*').eq('building_id', bid).order('room_code'),
      sb.from('measurement_points').select('*').eq('building_id', bid),
      sb.from('measurements').select('*, measurement_points(*)').eq('building_id', bid),
      sb.from('upgrade_scenarios').select('*').eq('building_id', bid).order('phase'),
      sb.from('diagnostic_events').select('*').eq('building_id', bid).order('created_at', { ascending: false }),
      sb.from('reports').select('*').eq('building_id', bid).order('report_date', { ascending: false })
    ]).then(rs => rs.map(r => { if (r.error) throw r.error; return r.data || []; }));
    return { building, rooms, points, meas, scen, events, reports };
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
    const grid = $('#hsMetricGrid'); if (grid) {
      grid.innerHTML = '';
      GROUPS.filter(g => !g.recordsOnly).forEach(g => {
        const rows = d.meas.filter(g.match);
        const card = el('article', 'hs-card hs-metric');
        if (!rows.length) {
          card.innerHTML = `<h3>${g.title}</h3><p class="hs-metric-value">Not recorded in this baseline</p>`;
          card.appendChild(el('div', '', chip(badge('not assessed'))));
        } else {
          const s = groupStats(rows);
          const desc = g.key === 'HUMIDITY' && s.allReduced
            ? `${s.locations} mapped locations, ${s.visits} visits. Every location recorded lower than at the first visit.`
            : `${s.locations} mapped locations, ${s.visits} visits.` +
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
      const list = el('ul', 'hs-event-list');
      ev.forEach(e => list.appendChild(el('li', '', `<span class="hs-event-date">${fmt(e.created_at)}</span> ${e.event_type}`)));
      hc.appendChild(list);
    }

    // Priority card (D-1 replacement branch)
    const pr = $('#hsPriorityCard'); if (pr) {
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
      const access = String(r.access_status || '').toLowerCase();
      const accessChip = (access && access !== 'assessed')
        ? `<span class="hs-badge hs-badge--access"><span class="hs-dot"></span>${r.access_status}</span>` : '';
      cell.innerHTML = `<span class="hs-room-name">${r.room_name}</span>${chip(b)}${accessChip}`;
      cell.setAttribute('aria-label', `${r.room_name}: ${b.text}${access && access !== 'assessed' ? ', ' + r.access_status : ''}`);
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
    if (count) count.textContent = `${d.points.length} mapped locations across ${d.rooms.filter(r => String(r.access_status).toLowerCase() !== 'no access').length} accessible spaces`;
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
    const noAccess = String(room.access_status || '').toLowerCase() === 'no access';
    panel.hidden = false;
    panel.innerHTML = `
      <div class="hs-panel-head">
        <h3>${room.room_name}</h3>
        <button class="hs-panel-close" aria-label="Close">×</button>
      </div>
      ${chip(roomBadge(room))}
      ${String(room.access_status || '').toLowerCase() !== 'assessed' ? `<p class="hs-metric-desc">Access: ${room.access_status}${room.access_note ? '. ' + room.access_note : ''}</p>` : ''}
      ${noAccess
        ? `<p class="hs-metric-desc">Recorded as no access at the last visit. No readings were taken. Absence of readings is not evidence of absence of a problem.</p>`
        : rows.length
          ? `<table class="hs-table"><thead><tr><th>Location</th><th>Value</th><th>Date</th><th>State</th></tr></thead><tbody>` +
            rows.map(m => `<tr><td>${m.measurement_points?.element_code || ''}</td><td>${m.value} ${m.unit}</td><td>${fmt(m.measured_at)}</td><td>${chip(badge(m.status_flag))}</td></tr>`).join('') +
            `</tbody></table>`
          : `<p class="hs-metric-desc">Not recorded in this baseline.</p>`}`;
    panel.querySelector('.hs-panel-close').addEventListener('click', () => { panel.hidden = true; });
  }

  /* Records (D-9): grouped by room, honest headings. */
  function renderRecords(d) {
    renderHero(d);
    const wrap = $('#hsRecords'); if (!wrap) return;
    wrap.innerHTML = `<h2 class="hs-h2">Recorded readings</h2><p class="hs-metric-desc">${d.meas.length} readings across ${d.points.length} mapped locations, grouped by room.</p>`;
    d.rooms.forEach(room => {
      const pts = d.points.filter(p => p.room_id === room.id);
      const rows = d.meas.filter(m => pts.some(p => p.id === m.measurement_point_id));
      const sec = el('section', 'hs-card hs-record-room');
      sec.innerHTML = `<div class="hs-record-head"><h3>${room.room_name}</h3>${chip(roomBadge(room))}</div>`;
      if (!rows.length) {
        sec.appendChild(el('p', 'hs-metric-desc', String(room.access_status || '').toLowerCase() === 'no access'
          ? 'Recorded as no access. No readings taken.' : 'Not recorded in this baseline.'));
      } else {
        sec.insertAdjacentHTML('beforeend',
          `<table class="hs-table"><thead><tr><th>Location</th><th>Value</th><th>Date</th><th>State</th></tr></thead><tbody>` +
          rows.map(m => `<tr><td>${m.measurement_points?.element_code || ''}</td><td>${m.value} ${m.unit}</td><td>${fmt(m.measured_at)}</td><td>${chip(badge(m.status_flag))}</td></tr>`).join('') +
          `</tbody></table>`);
      }
      wrap.appendChild(sec);
    });
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
          `<div><strong>${s.scenario_name || s.title || ''}</strong>${s.description ? `<p class="hs-metric-desc">${s.description}</p>` : ''}</div>${chip(st)}`));
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
    d.reports.forEach(r => {
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
