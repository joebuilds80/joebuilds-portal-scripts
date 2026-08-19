/**
 * Joe Builds Home Intelligence Platform
 * Reports Controller (v15 - X-Custom-Auth Bypass)
 */
const JoeBuildsReports = (() => {
  const SUPABASE_URL = 'https://jsqyfiwkbuvuajwzbjhd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_xla-awjgU2npKzrWHdYKDQ_2ox0CWmC';
  let supabase, jwtToken = '';

  const DOM = {
    desktopSidebarAsset: document.getElementById('desktopSidebarAsset'),
    desktopHeaderAsset: document.getElementById('desktopHeaderAsset'),
    headerClimateText: document.querySelectorAll('.header-telemetry-cluster .tabular')[1],
    headerSysText: document.querySelectorAll('.header-telemetry-cluster .tabular')[2],
    sidebarMeta: document.querySelector('.jb-footer-meta, .sidebar-footer > div:last-child') || document.getElementById('desktopSidebarMeta'),
    reportsGrid: document.getElementById('reportsGrid'),
    reportsCountLabel: document.getElementById('reportsCountLabel')
  };

  const toggleSkeletonState = (isLoading) => {
    const elementsToToggle = [DOM.desktopSidebarAsset, DOM.desktopHeaderAsset, DOM.headerClimateText, DOM.headerSysText, DOM.sidebarMeta];
    elementsToToggle.forEach(el => { if (!el) return; if (isLoading) el.classList.add('jb-skeleton-block'); else el.classList.remove('jb-skeleton-block'); });
  };

  const extractPath = (url, bucket) => {
    if (!url) return null;
    const marker = `/object/public/${bucket}/`;
    if (url.includes(marker)) return url.split(marker)[1];
    return null;
  };

  // NATIVE FETCH PROXY FOR SIGNED URLS
  const getSignedUrlsNative = async (bucket, paths) => {
    if (!paths || paths.length === 0 || !jwtToken) return {};
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/storage-proxy`, {
        method: 'POST',
        headers: { 
            'X-Custom-Auth': `Bearer ${jwtToken}`, // BYPASS GATEWAY
            'apikey': SUPABASE_ANON_KEY, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ action: 'sign', bucket, paths })
      });
      const map = {};
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
            json.data.forEach(item => {
                if (item.signedUrl) {
                    map[item.path] = item.signedUrl.startsWith('http') ? item.signedUrl : `${SUPABASE_URL}${item.signedUrl}`;
                }
            });
        }
      } else {
        console.error("Signed URL fetch failed", await res.text());
      }
      return map;
    } catch (err) { console.error("Sign URLs Error:", err); return {}; }
  };

  const fetchReportsData = async (buildingId) => {
    const [buildingRes, projectsRes, reportsRes, sessRes] = await Promise.all([
      supabase.from('buildings').select('*').eq('id', buildingId).single(),
      supabase.from('projects').select('*').eq('building_id', buildingId).order('created_at', { ascending: false }),
      supabase.from('reports').select('*').eq('building_id', buildingId).eq('client_visible', true).order('created_at', { ascending: false }),
      supabase.from('assessment_sessions').select('*').eq('building_id', buildingId).order('assessment_date', { ascending: false })
    ]);
    return { building: buildingRes.data, currentProject: projectsRes.data?.[0], reports: reportsRes.data || [], sessions: sessRes.data || [] };
  };

  const populateReportsUI = async (data) => {
    if (!data.building) return;

    const assetName = `${data.building.building_code || data.currentProject?.project_code || 'PRJ'} — ${data.building.address_line_1}`;
    if (DOM.desktopSidebarAsset) DOM.desktopSidebarAsset.textContent = assetName; 
    if (DOM.desktopHeaderAsset) DOM.desktopHeaderAsset.textContent = assetName; 
    
    const bStatus = data.building.status === 'Calibrated' ? 'Baseline Complete' : (data.building.status || 'Pending');
    if (DOM.headerSysText) DOM.headerSysText.textContent = bStatus;
    
    const climateText = data.building.climate_zone || '—'; // PS-051: no invented zone. Blank until a recorded value exists.
    if (DOM.headerClimateText) DOM.headerClimateText.textContent = climateText; 
    if (DOM.sidebarMeta) DOM.sidebarMeta.textContent = climateText;

    if (DOM.reportsGrid) {
        DOM.reportsGrid.innerHTML = '';
        if (DOM.reportsCountLabel) DOM.reportsCountLabel.textContent = `${data.reports.length} documents`;
        
        if (data.reports.length === 0) {
           DOM.reportsGrid.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted-foreground); border: 1px dashed var(--border);">No reports available yet.</div>';
        } else {
           
           const repPaths = data.reports.map(f => extractPath(f.report_url, 'reports')).filter(Boolean);
           const signedUrlMap = await getSignedUrlsNative('reports', repPaths);

           data.reports.forEach(rep => {
              const dateStr = new Date(rep.created_at).toLocaleDateString('en-GB');
              const fileType = rep.report_type || 'PDF';
              
              const path = extractPath(rep.report_url, 'reports');
              const finalSecureUrl = (path && signedUrlMap[path]) ? signedUrlMap[path] : rep.report_url;

              const html = `<div class="archive-row"><div class="icon-square"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="height:1.25rem;width:1.25rem;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div><div class="file-details"><div class="file-title">${rep.report_title}</div><div class="file-meta-tags"><span>${fileType}</span><span>${dateStr}</span></div></div><a href="${finalSecureUrl}" target="_blank" class="action-btn-sm" style="text-decoration:none;">Download <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="height:14px;width:14px;margin-left:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></a></div>`;
              DOM.reportsGrid.insertAdjacentHTML('beforeend', html);
           });
        }
    }

    const cal = document.getElementById('calendarMatrix');
    if (cal) {
        cal.innerHTML = '<div class="calendar-day-label">M</div><div class="calendar-day-label">T</div><div class="calendar-day-label">W</div><div class="calendar-day-label">T</div><div class="calendar-day-label">F</div><div class="calendar-day-label">S</div><div class="calendar-day-label">S</div>';
        const now = new Date(); const year = now.getFullYear(); const month = now.getMonth();
        document.getElementById('calendarMonthLabel').textContent = now.toLocaleString('default', { month: 'long', year: 'numeric' });
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const offset = firstDay === 0 ? 6 : firstDay - 1; 
        for (let i = 0; i < offset; i++) cal.innerHTML += `<div></div>`; 
        
        const sessionDates = data.sessions.map(s => {
            if (!s.assessment_date) return -1;
            const d = new Date(s.assessment_date);
            if (d.getMonth() === month && d.getFullYear() === year) return d.getDate();
            return -1;
        });
        
        for (let i = 1; i <= daysInMonth; i++) {
            const hasSess = sessionDates.includes(i);
            const activeCls = hasSess ? 'active-event' : '';
            const dot = hasSess ? `<div class="calendar-event-dot"></div>` : '';
            cal.innerHTML += `<button class="calendar-cell-btn ${activeCls}" title="Day ${i}">${i}${dot}</button>`;
        }
    }

    const agenda = document.getElementById('agendaContainer');
    if (agenda) {
        agenda.innerHTML = '';
        if (data.sessions.length === 0) {
            agenda.innerHTML = '<div class="text-muted-foreground" style="font-size:12px;">No sessions scheduled.</div>';
        } else {
            data.sessions.slice(0,4).forEach(s => {
                const d = s.assessment_date ? new Date(s.assessment_date).toLocaleDateString('en-GB') : 'Unscheduled';
                const iconColor = s.status === 'Completed' ? 'var(--status-stable)' : 'var(--status-measured)';
                agenda.innerHTML += `
                <div class="agenda-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" style="height:1.25rem; width:1.25rem;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <div class="agenda-title" style="flex:1;">
                        <div style="font-weight:500;">${s.assessment_type}</div>
                        <div style="font-size:10px; color:var(--muted-foreground); text-transform:uppercase; margin-top:2px;">${s.status}</div>
                    </div>
                    <div class="agenda-date-tag">${d}</div>
                </div>`;
            });
        }
    }
    toggleSkeletonState(false);
  };

  const init = async () => {
    document.body.classList.add('jb-data-ready');
    const forceStyle = document.createElement('style');
    forceStyle.innerHTML = `.jb-tabular, .jb-metric-string, .jb-status-badge, .header-telemetry-cluster { opacity: 1 !important; visibility: visible !important; }`;
    document.head.appendChild(forceStyle);

    toggleSkeletonState(true);
    if (!window.supabase) return;

    try { 
      const memberReq = await window.$memberstackDom.getCurrentMember();
      if (memberReq && memberReq.data && memberReq.data.customFields && memberReq.data.customFields['supabase-jwt']) {
          jwtToken = memberReq.data.customFields['supabase-jwt'];
      }
    } catch(e) {}

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {} }
    });

    try {
      const member = await window.$memberstackDom.getCurrentMember();
      const { data: profile } = await supabase.from('profiles').select('building_id, role').eq('memberstack_id', member.data.id).single();
      
      let targetBuildingId = profile?.building_id;
      if (!targetBuildingId && (profile?.role === 'admin' || profile?.role === 'operator')) { 
         const { data: fallbackB } = await supabase.from('buildings').select('id').order('created_at', { ascending: false }).limit(1).single(); 
         if (fallbackB) targetBuildingId = fallbackB.id; 
      }
      if (!targetBuildingId && localStorage.getItem('jb_demo_mode') === 'true') { 
        const { data: demoB } = await supabase.from('buildings').select('id').eq('building_code', 'DEMO-001').single(); 
        if (demoB) targetBuildingId = demoB.id; 
      }
      
      if (targetBuildingId) { 
        const reportsData = await fetchReportsData(targetBuildingId); 
        await populateReportsUI(reportsData); 
      } else { 
        toggleSkeletonState(false); 
      }
    } catch (error) { console.error(error); }
  };

  return { init };
})();

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', JoeBuildsReports.init); } else { JoeBuildsReports.init(); }
