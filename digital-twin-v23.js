/**
 * Joe Builds Home Intelligence Platform
 * Digital Twin Controller (v23 - X-Custom-Auth Bypass)
 */
const JoeBuildsDigitalTwin = (() => {
  const SUPABASE_URL = 'https://jsqyfiwkbuvuajwzbjhd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_xla-awjgU2npKzrWHdYKDQ_2ox0CWmC';
  let supabase, jwtToken = '', activeZonesData = {}, globalImages = [];
  
  const roomCoordinates = { 'primary': { left: '22%', top: '28%' }, 'kitchen': { left: '60%', top: '32%' }, 'plant': { left: '78%', top: '62%' }, 'subfloor': { left: '40%', top: '78%' }, 'living': { left: '45%', top: '50%' } };
  
  const DOM = { 
    desktopSidebarAsset: document.getElementById('desktopSidebarAsset'), desktopHeaderAsset: document.getElementById('desktopHeaderAsset'), headerClimateText: document.getElementById('desktopHeaderClimate'), headerSysText: document.getElementById('desktopHeaderSys'), sidebarMeta: document.getElementById('sidebarMeta'), 
    zonesListContainer: document.getElementById('zonesListContainer'), zonesCountLabel: document.getElementById('zonesCountLabel'), dynamicHotspots: document.getElementById('dynamic-hotspots'), 
    aside: document.getElementById('jbDiagnosticAside'), backdrop: document.getElementById('jbAsideBackdrop'), closeBtn: document.getElementById('asideCloseBtn'), aTitle: document.getElementById('asideZoneTitle'), aRH: document.getElementById('asideMetricRH'), aTVOC: document.getElementById('asideMetricTVOC'), aCO2: document.getElementById('asideMetricCO2'), aBadge: document.getElementById('asideStatusBadge'), aDot: document.getElementById('asideStatusDot'), aTxt: document.getElementById('asideStatusText'), aNotes: document.getElementById('asideNotes'), imageryGrid: document.getElementById('imageryGridContainer'), aMonitoringText: document.getElementById('asideMonitoringText') 
  };

  const toggleSkeletonState = (isLoading) => { 
    const elementsToToggle = [DOM.desktopSidebarAsset, DOM.desktopHeaderAsset, DOM.headerClimateText, DOM.headerSysText, DOM.zonesCountLabel, DOM.sidebarMeta]; 
    elementsToToggle.forEach(el => { if (!el) return; if (isLoading) el.classList.add('jb-skeleton-block'); else el.classList.remove('jb-skeleton-block'); }); 
    if (isLoading && DOM.zonesListContainer) DOM.zonesListContainer.innerHTML = `<div class="jb-zone-row-item jb-skeleton-block" style="height: 48px; margin-bottom: 1px;"></div>`; 
  };

  const getBadgeText = (status) => { 
      const s = (status || '').toLowerCase();
      if (s === 'stable' || s === 'measured') return 'Stable';
      if (s === 'monitor') return 'Monitor';
      if (s === 'risk') return 'At Risk';
      if (s === 'review' || s === 'unknown' || !s) return 'Further Investigation Required';
      return 'Stable';
  };

  const getStatusVisual = (status) => {
      const s = (status || '').toLowerCase();
      if (s === 'stable' || s === 'measured') return 'stable';
      if (s === 'monitor') return 'measured'; 
      if (s === 'risk') return 'risk';
      if (s === 'review' || s === 'unknown' || !s) return 'review';
      return 'stable';
  };

  const extractPath = (url, bucket) => {
    if (!url) return null;
    const marker = `/object/public/${bucket}/`;
    if (url.includes(marker)) return url.split(marker)[1];
    return null;
  };

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
      }
      return map;
    } catch (err) { console.error("Sign URLs Error:", err); return {}; }
  };

  const initUIEvents = () => {
    const closeAside = () => { DOM.aside.classList.remove('is-open'); DOM.backdrop.classList.remove('is-open'); document.querySelectorAll('.jb-hotspot, .jb-zone-row-item').forEach(el => el.classList.remove('jb-active-node')); setTimeout(() => { DOM.aside.classList.add('jb-hidden'); }, 300); };
    if (DOM.closeBtn) DOM.closeBtn.addEventListener('click', closeAside); 
    if (DOM.backdrop) DOM.backdrop.addEventListener('click', closeAside);
  };

  const fetchTwinData = async (buildingId) => {
    const [buildingRes, projectsRes, roomsRes, measurementsRes, evidenceRes] = await Promise.all([ 
      supabase.from('buildings').select('*').eq('id', buildingId).single(), 
      supabase.from('projects').select('*').eq('building_id', buildingId).order('created_at', { ascending: false }), 
      supabase.from('rooms').select('*').eq('building_id', buildingId).order('created_at', { ascending: true }), 
      supabase.from('measurements').select(`*, measurement_points(zone_code, element_code)`).eq('building_id', buildingId), 
      supabase.from('evidence_assets').select('*').eq('building_id', buildingId).order('created_at', { ascending: false }) 
    ]);
    
    if (evidenceRes.data) {
        const rawImgs = evidenceRes.data.filter(f => f.file_name.match(/\.(jpg|jpeg|png|webp|gif)$/i));
        const paths = rawImgs.map(img => extractPath(img.file_url, 'property_assets')).filter(Boolean);
        
        const signedUrlMap = await getSignedUrlsNative('property_assets', paths);
        
        globalImages = rawImgs.map(img => {
            const path = extractPath(img.file_url, 'property_assets');
            return { ...img, secure_url: (path && signedUrlMap[path]) ? signedUrlMap[path] : img.file_url };
        });
    }

    return { building: buildingRes.data, currentProject: projectsRes.data?.[0], rooms: roomsRes.data || [], measurements: measurementsRes.data || [] };
  };

  const renderDashboard = (data) => {
    if (!data.building) return;
    const assetName = `${data.building.building_code || data.currentProject?.project_code || 'PRJ-000'} — ${data.building.address_line_1}`;
    if (DOM.desktopSidebarAsset) DOM.desktopSidebarAsset.textContent = assetName; 
    if (DOM.desktopHeaderAsset) DOM.desktopHeaderAsset.textContent = assetName;
    
    const bStatus = data.building.status === 'Calibrated' ? 'Baseline Complete' : (data.building.status || 'Pending');
    if (DOM.headerSysText) DOM.headerSysText.textContent = bStatus;
    
    const climateText = (data.building.state || 'WA') === 'WA' ? 'Zone 5 — Warm Temperate' : 'Zone 6 — Mild Temperate';
    if (DOM.headerClimateText) DOM.headerClimateText.textContent = climateText; 
    if (DOM.sidebarMeta) DOM.sidebarMeta.textContent = climateText;

    activeZonesData = {};
    data.rooms.forEach(room => {
      const roomMs = data.measurements.filter(m => m.room_id === room.id);
      const getVal = (code) => { 
          let m = roomMs.find(x => x.measurement_points?.element_code === code); 
          if(!m && code === 'RH') m = roomMs.find(x => x.measurement_points?.element_code === 'MOISTURE');
          if (!m) return '--'; 
          let unit = m.unit || ''; return `${m.value || 0} ${unit}`.trim(); 
      };
      const statuses = roomMs.map(m => m.status_flag); 
      
      let rawOverall = 'stable'; 
      if (statuses.includes('review') || statuses.includes('unknown') || statuses.includes('action required')) rawOverall = 'review'; 
      else if (statuses.includes('risk')) rawOverall = 'risk'; 
      else if (statuses.includes('monitor')) rawOverall = 'monitor';
      else if (statuses.includes('measured')) rawOverall = 'measured';

      const visualStatus = getStatusVisual(rawOverall);
      const badgeText = getBadgeText(rawOverall);

      const activeSensors = []; if(getVal('RH') !== '--') activeSensors.push('RH'); if(getVal('CO2') !== '--') activeSensors.push('CO₂'); if(getVal('VOC') !== '--') activeSensors.push('VOC');
      
      activeZonesData[room.id] = { id: room.id, title: room.room_name_current, code: room.room_code.toLowerCase(), map_x: room.map_x, map_y: room.map_y, rh: getVal('RH'), tvoc: getVal('VOC'), co2: getVal('CO2'), status: visualStatus, badge: badgeText, notes: room.notes || 'No active analyst notes for this zone.', monitoring: activeSensors.length > 0 ? `Active Sensors: ${activeSensors.join(', ')}` : `No active nodes linked.` };
    });

    const zoneKeys = Object.keys(activeZonesData);
    if (DOM.zonesCountLabel) DOM.zonesCountLabel.textContent = `Zones · ${zoneKeys.length}`;
    if (DOM.zonesListContainer) { 
      DOM.zonesListContainer.innerHTML = ''; 
      zoneKeys.forEach(key => { 
        const zone = activeZonesData[key]; 
        const btn = document.createElement('button'); btn.className = 'jb-zone-row-item'; btn.setAttribute('data-id', key); 
        btn.innerHTML = `<span class="jb-zone-label">${zone.title}</span><span class="jb-status-badge jb-status-${zone.status}"><span class="jb-badge-dot bg-${zone.status}"></span>${zone.badge}</span>`; 
        btn.addEventListener('click', (e) => { e.stopPropagation(); openDiagnosticPanel(key); }); 
        DOM.zonesListContainer.appendChild(btn); 
      }); 
    }
    
    if (DOM.dynamicHotspots) { 
      DOM.dynamicHotspots.innerHTML = ''; let unknownOffset = 10; 
      zoneKeys.forEach(key => { 
        const zone = activeZonesData[key]; let coords = null; 
        if (zone.map_x != null && zone.map_y != null) { coords = { left: `${zone.map_x}%`, top: `${zone.map_y}%` }; } 
        else if (roomCoordinates[zone.code]) { coords = roomCoordinates[zone.code]; } 
        else { coords = { left: `${unknownOffset}%`, top: '90%' }; unknownOffset += 15; } 
        const hotspotHTML = `<button class="jb-hotspot" style="left:${coords.left}; top:${coords.top};" data-id="${key}"><span class="jb-hotspot-pulse"><span class="jb-hotspot-ping-wave bg-${zone.status}"></span><span class="jb-hotspot-core-ring" style="border-color: var(--status-${zone.status});"></span></span><span class="jb-hotspot-tag">${zone.title}</span></button>`; 
        DOM.dynamicHotspots.insertAdjacentHTML('beforeend', hotspotHTML); 
      }); 
      document.querySelectorAll('.jb-hotspot').forEach(node => { node.addEventListener('click', (e) => { e.stopPropagation(); openDiagnosticPanel(node.getAttribute('data-id')); }); }); 
    }
    toggleSkeletonState(false);
  };

  const openDiagnosticPanel = (zoneId) => {
    document.querySelectorAll('.jb-hotspot, .jb-zone-row-item').forEach(el => el.classList.remove('jb-active-node'));
    const data = activeZonesData[zoneId]; if (!data) return;
    DOM.aTitle.textContent = data.title; DOM.aRH.textContent = data.rh; DOM.aTVOC.textContent = data.tvoc; DOM.aCO2.textContent = data.co2; DOM.aTxt.textContent = data.badge; DOM.aNotes.textContent = data.notes; DOM.aMonitoringText.textContent = data.monitoring; DOM.aBadge.className = `jb-status-badge jb-status-${data.status}`; DOM.aDot.className = `jb-badge-dot bg-${data.status}`;
    
    if (DOM.imageryGrid) { 
      const roomImages = globalImages.filter(img => img.room_id === data.id); 
      DOM.imageryGrid.innerHTML = ''; 
      if (roomImages.length > 0) { 
        roomImages.slice(0, 2).forEach(img => { 
          DOM.imageryGrid.innerHTML += `<div class="jb-imagery-box" style="padding:0; overflow:hidden; border:none; background:var(--border);"><img src="${img.secure_url}" style="width:100%; height:100%; object-fit:cover;"></div>`; 
        }); 
      } else { 
        DOM.imageryGrid.innerHTML = `<div class="jb-imagery-box">No Evidence</div>`; 
      } 
    }
    const tNode = document.querySelector(`.jb-hotspot[data-id="${zoneId}"]`); const tRow = document.querySelector(`.jb-zone-row-item[data-id="${zoneId}"]`); 
    if (tNode) tNode.classList.add('jb-active-node'); 
    if (tRow) { tRow.classList.add('jb-active-node'); tRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    DOM.aside.classList.remove('jb-hidden'); setTimeout(() => { DOM.aside.classList.add('is-open'); DOM.backdrop.classList.add('is-open'); }, 10);
  };

  const init = async () => {
    toggleSkeletonState(true); initUIEvents();
    
    const eyebrow = document.querySelector('.eyebrow');
    if (eyebrow && eyebrow.textContent.includes('Digital Twin')) eyebrow.textContent = 'Home Map / 02';
    const pageTitle = document.querySelector('.hero-title');
    if (pageTitle) pageTitle.textContent = "Measured Home Map";
    const pageDesc = document.querySelector('.hero-desc');
    if (pageDesc) pageDesc.textContent = "Interactive home map showing room-level readings, risk flags, reports, and stability changes over time.";

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
      const { data: profile } = await supabase.from('profiles').select('building_id').eq('memberstack_id', member.data.id).single();
      let targetBuildingId = profile?.building_id;
      if (!targetBuildingId && localStorage.getItem('jb_demo_mode') === 'true') { 
        const { data: demoB } = await supabase.from('buildings').select('id').eq('building_code', 'DEMO-001').single(); 
        if (demoB) targetBuildingId = demoB.id; 
      }
      if (targetBuildingId) { 
        const twinData = await fetchTwinData(targetBuildingId); 
        renderDashboard(twinData); 
      } else { 
        toggleSkeletonState(false); 
      }
    } catch (error) {}
  };
  return { init };
})();

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', JoeBuildsDigitalTwin.init); } else { JoeBuildsDigitalTwin.init(); }
