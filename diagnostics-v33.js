/**
 * Joe Builds Home Intelligence Platform
 * Diagnostics Controller (v33 - Client Output Standards)
 * v33 (20 Aug 2026), PS-058: readings no longer render as "UNKNOWN Metric".
 * measurement_points rows have never existed so element_code was always null.
 * Titles now fall back to a plain-English label derived from the stored unit,
 * and the two tables split on surface-moisture vs air/environment.
 */
console.log("JB Diagnostics Controller v33 initializing...");

const JoeBuildsDiagnostics = (() => {
  const SUPABASE_URL = 'https://jsqyfiwkbuvuajwzbjhd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_xla-awjgU2npKzrWHdYKDQ_2ox0CWmC';
  let supabase;

  const setTxt = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  const setHTML = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  const addHTML = (id, html) => { const el = document.getElementById(id); if (el) el.insertAdjacentHTML('beforeend', html); };

  const toggleSkeletonState = (isLoading) => {
    const tabs = document.querySelectorAll('.header-telemetry-cluster .tabular, .header-telemetry-cluster .jb-tabular, .jb-desktop-telemetry .tabular, .jb-desktop-telemetry .jb-tabular');
    tabs.forEach(el => { if (isLoading) el.classList.add('jb-skeleton-block'); else el.classList.remove('jb-skeleton-block'); });
    const specificElements = [ document.getElementById('desktopSidebarAsset'), document.getElementById('desktopSidebarMeta') ];
    specificElements.forEach(el => { if (!el) return; if (isLoading) el.classList.add('jb-skeleton-block'); else el.classList.remove('jb-skeleton-block'); });

    if (isLoading) {
      setHTML('tbody-thermal', `<tr><td colspan="5"><div class="jb-skeleton-block" style="height: 40px; width: 100%;"></div></td></tr>`);
      setHTML('tbody-air', `<tr><td colspan="5"><div class="jb-skeleton-block" style="height: 40px; width: 100%;"></div></td></tr>`);
    } else {
      document.querySelectorAll('.jb-skeleton-block').forEach(el => el.classList.remove('jb-skeleton-block'));
    }
  };

  // CLIENT OUTPUT STANDARD: Map DB status to strictly approved wording
  const getBadgeText = (status) => {
      const s = (status || '').toLowerCase().replace(/\s/g, '');
      if (s === 'stable' || s === 'closed') return 'Stable';
      // JOE RULING 18 Aug 2026: a reading stored as 'measured' renders to the client as
      // 'Monitor'. 'Measured' only means a reading was taken; 'Stable' is a judgement about
      // the building that no assessor has made.
      if (s === 'monitor' || s === 'measured') return 'Monitor';
      if (s === 'risk' || s === 'atrisk') return 'At Risk';
      if (s === 'noaccess') return 'No Access';
      if (s === 'notassessed') return 'Not Yet Assessed';
      // PS-052 (20 Aug 2026): findings are stored as 'Further Investigation Required', which
      // strips to 'furtherinvestigationrequired' and was falling through to a Stable default.
      // Safe default: anything unrecognised must NOT read as Stable.
      return 'Further Investigation Required';
  };

  // CLIENT OUTPUT STANDARD: Map DB status to visual CSS classes
  const getStatusVisual = (status) => {
      const s = (status || '').toLowerCase().replace(/\s/g, '');
      if (s === 'stable' || s === 'closed') return 'stable';
      // JOE RULING 18 Aug 2026: 'measured' renders as Monitor, so it takes the Monitor hue.
      if (s === 'monitor' || s === 'measured') return 'measured';
      if (s === 'risk' || s === 'atrisk') return 'risk';
      // PS-053 (20 Aug 2026): 'pending' is deliberately NOT a defined CSS class. The badge
      // falls back to the neutral bordered pill with no status colour, because no judgement
      // has been made about these rooms.
      if (s === 'noaccess' || s === 'notassessed') return 'pending';
      // Safe default: anything unrecognised must NOT render as stable.
      return 'review';
  };

  const formatBuildingStatus = (status) => {
    if (status === 'Calibrated') return 'Baseline Complete';
    return status || 'Pending';
  };

  const mapToDOM = (bData, mData, rData, sData, iData) => {
    setHTML('tbody-thermal', ''); setHTML('tbody-air', '');
    setHTML('mgrid-thermal', ''); setHTML('mgrid-air', '');

    if (!bData) {
       setTxt('desktopSidebarAsset', "Unassigned Property");
       const tabs = document.querySelectorAll('.header-telemetry-cluster .tabular, .header-telemetry-cluster .jb-tabular');
       if(tabs[0]) tabs[0].textContent = "Unassigned Property";
       setHTML('tbody-thermal', `<tr><td colspan="5" style="color:#A64444; padding: 2rem;">No property assigned or database access blocked.</td></tr>`);
       toggleSkeletonState(false);
       return;
    }

    const assetName = `${bData.building_code || 'PRJ-000'} — ${bData.address_line_1}`;
    setTxt('desktopSidebarAsset', assetName); 
    const climateText = bData.climate_zone || '—'; // PS-051: no invented zone. Blank until a recorded value exists.
    setTxt('desktopSidebarMeta', climateText);

    const headerTabs = document.querySelectorAll('.header-telemetry-cluster .tabular, .header-telemetry-cluster .jb-tabular');
    if (headerTabs[0]) headerTabs[0].textContent = assetName;
    if (headerTabs[1]) headerTabs[1].textContent = climateText;
    if (headerTabs[2]) headerTabs[2].textContent = formatBuildingStatus(bData.status);

    const roomsMap = {};
    if (rData) { rData.forEach(r => { roomsMap[r.id] = r.room_name_current; }); }
    
    const sessionsMap = {};
    if (sData) { sData.forEach(s => { sessionsMap[s.assessment_id] = s.assessment_type; }); }

    // --- ANALYST FINDINGS SECTION ---
    if (iData && iData.length > 0) {
        const findingsSectionHtml = `
        <section id="section-findings" style="margin-bottom: 3rem;">
          <div class="jb-section-header">
            <h2 class="jb-section-title">Analyst Findings & Risks</h2><span class="jb-font-mono" style="font-size:10px;color:var(--muted-foreground)">${iData.length} entries</span>
          </div>
          <div class="jb-desktop-only"><table class="jb-data-table">
            <thead><tr><th style="width:3rem">Img</th><th>Finding / Issue</th><th>Room / Zone</th><th>Status</th><th>Analyst Notes</th></tr></thead>
            <tbody id="tbody-findings"></tbody>
          </table></div>
          <div class="jb-mobile-only jb-mobile-data-grid" id="mgrid-findings"></div>
        </section>`;
        
        const thermalSec = document.getElementById('section-thermal');
        if (thermalSec && !document.getElementById('section-findings')) {
            thermalSec.insertAdjacentHTML('beforebegin', findingsSectionHtml);
        }

        iData.forEach(issue => {
            const visualStatus = getStatusVisual(issue.status);
            const badgeText = getBadgeText(issue.status);
            
            const roomName = issue.room_id && roomsMap[issue.room_id] ? roomsMap[issue.room_id] : 'Global / Entire Home';

            const row = `<tr data-title="${issue.issue_type}" style="cursor: pointer;"><td><button class="jb-img-btn"><svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg></button></td><td>${issue.issue_type}</td><td class="jb-font-mono jb-tabular">${roomName}</td><td><span class="jb-status-badge jb-status-${visualStatus}"><span class="jb-badge-dot bg-${visualStatus}"></span>${badgeText}</span></td><td style="color:var(--muted-foreground)">${issue.client_facing_wording || '-'}</td></tr>`;
            addHTML('tbody-findings', row); 
            
            const card = `<div class="jb-mobile-data-card" data-title="${issue.issue_type}" style="cursor: pointer;"><div class="jb-mobile-card-header"><div style="font-size:12.5px;font-weight:500">${issue.issue_type}</div><span class="jb-status-badge jb-status-${visualStatus}">${badgeText}</span></div><div class="jb-font-mono jb-tabular" style="font-size:13px">${roomName}</div><div style="font-size:11px;color:var(--muted-foreground)">${issue.client_facing_wording || '-'}</div></div>`;
            addHTML('mgrid-findings', card);
        });
    }

    const rawMeasurements = mData || [];
    if (rawMeasurements.length === 0) {
      setHTML('tbody-thermal', `<tr><td colspan="5" style="color:#637066; padding: 2rem;">No diagnostic measurements found for this property.</td></tr>`);
      toggleSkeletonState(false);
      return;
    }
    
    // PS-058 (20 Aug 2026): measurement_points rows have never been created, so
    // element_code was always null and EVERY reading rendered as "UNKNOWN Metric".
    // Classify by the unit actually stored on the measurement and fall back to a
    // plain-English label. element_code is still honoured wherever it exists.
    const labelFor = (m) => {
      const code = m.extracted_code;
      if (code && code !== 'UNKNOWN') {
        const known = {
          'U-VALUE': 'Assembly U-Value',
          'ENVELOPE': 'Envelope Integrity',
          'ACH50': 'Air Infiltration Rate (ACH50)',
          'CO2': 'Indoor Air Quality (CO\u2082)',
          'RH': 'Relative Humidity',
          'VOC': 'Volatile Organic Compounds (VOC)',
          'MOISTURE': 'Surface Moisture',
          'PRIORITY': 'Active Priority Recommendation',
          'READINESS': 'Upgrade Readiness'
        };
        return known[code] || code.replace(/[-_]/g, ' ');
      }
      const u = (m.unit || '').trim().toLowerCase();
      if (u === 'rel') return 'Surface Moisture Reading';
      if (u === 'g/kg') return 'Room Air Moisture';
      if (u === 'ppm') return 'Indoor Air Quality (CO\u2082)';
      if (u === '%rh' || u === '%') return 'Relative Humidity';
      if (u === 'degc' || u === '\u00b0c') return 'Temperature';
      return 'Recorded Measurement';
    };
    const isSurface = (m) => {
      if ((m.unit || '').trim().toLowerCase() === 'rel') return true;
      return ['U-VALUE', 'THERMAL_BRIDGE', 'ENVELOPE', 'MOISTURE'].includes(m.extracted_code);
    };

    const thermals = [], airTightsAndOthers = [];
    rawMeasurements.forEach(m => {
      let code = 'UNKNOWN';
      if (m.measurement_points) { code = Array.isArray(m.measurement_points) ? m.measurement_points[0]?.element_code : m.measurement_points.element_code; }
      m.extracted_code = code || 'UNKNOWN';
      m.jb_label = labelFor(m);
      if (isSurface(m)) { thermals.push(m); } else { airTightsAndOthers.push(m); }
    });

    if (thermals.length === 0) {
      setHTML('tbody-thermal', `<tr><td colspan="5" style="color:#637066; padding:1rem;">No surface moisture readings recorded yet.</td></tr>`);
    } else {
      setTxt('count-thermal', `${thermals.length} entries`); 
      thermals.forEach(m => { 
        let title = m.jb_label;
        
        if (m.room_id && roomsMap[m.room_id]) { title += ` <span style="color:var(--muted-foreground); font-family:var(--font-mono); font-size:9px; letter-spacing:0.05em; margin-left:6px; padding-left:6px; border-left:1px solid var(--border);">ZONE: ${roomsMap[m.room_id]}</span>`; }
        if (m.assessment_id && sessionsMap[m.assessment_id]) { title += ` <span style="color:var(--status-measured); font-family:var(--font-mono); font-size:9px; letter-spacing:0.05em; margin-left:6px; padding-left:6px; border-left:1px solid var(--border);">SESSION: ${sessionsMap[m.assessment_id]}</span>`; }

        const visualStatus = getStatusVisual(m.status_flag);
        const badgeText = getBadgeText(m.status_flag);

        const row = `<tr data-title="${m.extracted_code}" style="cursor: pointer;"><td><button class="jb-img-btn"><svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg></button></td><td>${title}</td><td class="jb-font-mono jb-tabular">${m.value || '-'} ${m.unit || ''}</td><td><span class="jb-status-badge jb-status-${visualStatus}"><span class="jb-badge-dot bg-${visualStatus}"></span>${badgeText}</span></td><td style="color:var(--muted-foreground)">${m.client_facing_wording || '-'}</td></tr>`;
        addHTML('tbody-thermal', row); 
        
        const card = `<div class="jb-mobile-data-card" data-title="${m.extracted_code}" style="cursor: pointer;"><div class="jb-mobile-card-header"><div style="font-size:12.5px;font-weight:500">${title}</div><span class="jb-status-badge jb-status-${visualStatus}">${badgeText}</span></div><div class="jb-font-mono jb-tabular" style="font-size:13px">${m.value || '-'} ${m.unit || ''}</div><div style="font-size:11px;color:var(--muted-foreground)">${m.client_facing_wording || '-'}</div></div>`;
        addHTML('mgrid-thermal', card);
      }); 
    }
    
    if (airTightsAndOthers.length === 0) {
      setHTML('tbody-air', `<tr><td colspan="5" style="color:#637066; padding:1rem;">No air or environment readings recorded yet.</td></tr>`);
    } else {
      setTxt('count-air', `${airTightsAndOthers.length} entries`); 

      airTightsAndOthers.forEach(m => { 
        let title = m.jb_label;

        if (m.room_id && roomsMap[m.room_id]) { title += ` <span style="color:var(--muted-foreground); font-family:var(--font-mono); font-size:9px; letter-spacing:0.05em; margin-left:6px; padding-left:6px; border-left:1px solid var(--border);">ZONE: ${roomsMap[m.room_id]}</span>`; }
        if (m.assessment_id && sessionsMap[m.assessment_id]) { title += ` <span style="color:var(--status-measured); font-family:var(--font-mono); font-size:9px; letter-spacing:0.05em; margin-left:6px; padding-left:6px; border-left:1px solid var(--border);">SESSION: ${sessionsMap[m.assessment_id]}</span>`; }

        const visualStatus = getStatusVisual(m.status_flag);
        const badgeText = getBadgeText(m.status_flag);

        const row = `<tr data-title="${m.extracted_code}" style="cursor: pointer;"><td><button class="jb-img-btn"><svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg></button></td><td>${title}</td><td class="jb-font-mono jb-tabular">${m.value || '-'} ${m.unit || ''}</td><td><span class="jb-status-badge jb-status-${visualStatus}"><span class="jb-badge-dot bg-${visualStatus}"></span>${badgeText}</span></td><td style="color:var(--muted-foreground)">${m.client_facing_wording || '-'}</td></tr>`;
        addHTML('tbody-air', row); 
        
        const card = `<div class="jb-mobile-data-card" data-title="${m.extracted_code}" style="cursor: pointer;"><div class="jb-mobile-card-header"><div style="font-size:12.5px;font-weight:500">${title}</div><span class="jb-status-badge jb-status-${visualStatus}">${badgeText}</span></div><div class="jb-font-mono jb-tabular" style="font-size:13px">${m.value || '-'} ${m.unit || ''}</div><div style="font-size:11px;color:var(--muted-foreground)">${m.client_facing_wording || '-'}</div></div>`;
        addHTML('mgrid-air', card);
      }); 
    }

    document.querySelectorAll('tr[data-title], .jb-mobile-data-card[data-title]').forEach(el => { 
      el.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        let metricName = el.querySelector('td:nth-child(2)')?.textContent || el.querySelector('.jb-mobile-card-header div').textContent; 
        if (metricName.includes('ZONE:')) { metricName = metricName.split('ZONE:')[0].trim(); }
        if (metricName.includes('SESSION:')) { metricName = metricName.split('SESSION:')[0].trim(); }
        setTxt('modalMetricTitle', metricName);
        const modal = document.getElementById('jbDiagnosticModal');
        if(modal) modal.classList.remove('jb-hidden'); 
      }); 
    });
    
    toggleSkeletonState(false);
  };

  const init = async () => {
    try {
      document.body.classList.add('jb-data-ready');
      const forceStyle = document.createElement('style');
      forceStyle.innerHTML = `.jb-tabular, .jb-metric-string, .jb-status-badge, .header-telemetry-cluster { opacity: 1 !important; visibility: visible !important; }`;
      document.head.appendChild(forceStyle);

      const closeBtn = document.getElementById('modalCloseBtn');
      const modal = document.getElementById('jbDiagnosticModal');
      if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('jb-hidden'));
      if (modal) modal.addEventListener('click', (e) => { if(e.target === modal) modal.classList.add('jb-hidden'); });

      if (!window.supabase) return;

      let supabaseToken = '';
      try { 
        const memberReq = await window.$memberstackDom.getCurrentMember();
        if (memberReq && memberReq.data && memberReq.data.customFields && memberReq.data.customFields['supabase-jwt']) {
            supabaseToken = memberReq.data.customFields['supabase-jwt'];
        }
      } catch(e) {}

      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: supabaseToken ? { Authorization: `Bearer ${supabaseToken}` } : {} }
      });
      
      const member = await window.$memberstackDom.getCurrentMember();
      if(!member || !member.data) return;
      
      // Polling Loop for Make.com building_id provisioning
      let profile = null;
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase.from('profiles').select('building_id, role').eq('memberstack_id', member.data.id).maybeSingle();
        profile = data;
        if (profile && (profile.building_id || profile.role === 'admin' || profile.role === 'operator')) {
          break;
        }
        await new Promise(res => setTimeout(res, 1000));
      }

      let targetBuildingId = profile?.building_id;
      
      if (!targetBuildingId && (profile?.role === 'admin' || profile?.role === 'operator')) {
         const { data: fallbackB } = await supabase.from('buildings').select('id').order('created_at', { ascending: false }).limit(1).single();
         if (fallbackB) targetBuildingId = fallbackB.id;
      }
      
      if (targetBuildingId) { 
        const [bRes, mRes, rRes, sRes, iRes] = await Promise.all([ 
          supabase.from('buildings').select('*').eq('id', targetBuildingId).single(), 
          supabase.from('measurements').select(`*, measurement_points(*)`).eq('building_id', targetBuildingId).order('created_at', { ascending: false }),
          supabase.from('rooms').select('id, room_name_current').eq('building_id', targetBuildingId),
          supabase.from('assessment_sessions').select('assessment_id, assessment_type').eq('building_id', targetBuildingId),
          supabase.from('issues_findings').select('*').eq('building_id', targetBuildingId).order('created_at', { ascending: false })
        ]); 
        mapToDOM(bRes.data, mRes.data, rRes.data, sRes.data, iRes.data); 
      } else { 
        setHTML('tbody-thermal', `<tr><td colspan="5" style="padding:2rem; color:#A64444;">No property assigned.</td></tr>`);
        toggleSkeletonState(false);
      }
    } catch (error) { console.error("Init Error", error); }
  };
  return { init };
})();

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', JoeBuildsDiagnostics.init); } else { JoeBuildsDiagnostics.init(); }
