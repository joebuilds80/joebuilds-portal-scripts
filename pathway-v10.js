/**
 * Joe Builds - Pathway Controller (v10 - JWT Security & CTA Logic)
 */
const JoeBuildsPathway = (() => {
  const SUPABASE_URL = 'https://jsqyfiwkbuvuajwzbjhd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_xla-awjgU2npKzrWHdYKDQ_2ox0CWmC';
  let supabase, scenariosStore = {};
  
  const DOM = { 
    desktopSidebarAsset: document.getElementById('desktopSidebarAsset'), desktopHeaderAsset: document.getElementById('desktopHeaderAsset'), headerClimateText: document.querySelectorAll('.header-telemetry-cluster .tabular')[1], headerSysText: document.querySelectorAll('.header-telemetry-cluster .tabular')[2], sidebarMeta: document.querySelector('.jb-footer-meta, .sidebar-footer > div:last-child'), 
    p1Count: document.getElementById('p1-count'), p1Bar: document.getElementById('p1-bar'), p2Count: document.getElementById('p2-count'), p2Bar: document.getElementById('p2-bar'), p3Count: document.getElementById('p3-count'), p3Bar: document.getElementById('p3-bar'), sequenceStack: document.getElementById('sequenceStackContainer'), 
    modal: document.getElementById('jbPathwayModal'), modalCloseBtn: document.getElementById('modalCloseBtn'), modalCancelBtn: document.getElementById('modalCancelBtn'), mPhaseName: document.getElementById('modalPhaseName'), mTitle: document.getElementById('modalMilestoneTitle'), mStatusBadge: document.getElementById('modalStatusBadge'), mStatusIcon: document.getElementById('modalStatusIcon'), mStatusText: document.getElementById('modalStatusText'), mDesc: document.getElementById('modalDesc'), mDependencyWrap: document.getElementById('modalDependencyWrap'), mDependencyText: document.getElementById('modalDependencyText'), mActionBtn: document.getElementById('modalActionBtn') 
  };

  const toggleSkeletonState = (isLoading) => { 
    const elementsToToggle = [DOM.desktopSidebarAsset, DOM.desktopHeaderAsset, DOM.headerClimateText, DOM.headerSysText, DOM.sidebarMeta]; 
    elementsToToggle.forEach(el => { if (!el) return; if (isLoading) el.classList.add('jb-skeleton-block'); else el.classList.remove('jb-skeleton-block'); }); 
  };

  const fetchPathwayData = async (buildingId) => { 
    const [buildingRes, projectsRes, scenariosRes] = await Promise.all([ 
      supabase.from('buildings').select('*').eq('id', buildingId).single(), 
      supabase.from('projects').select('*').eq('building_id', buildingId).order('created_at', { ascending: false }), 
      supabase.from('upgrade_scenarios').select('*').eq('building_id', buildingId).order('step_number', { ascending: true }) 
    ]); 
    return { building: buildingRes.data, currentProject: projectsRes.data?.[0], scenarios: scenariosRes.data || [] }; 
  };

  const getStatusIcon = (status) => { if (status === 'completed') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="height: 0.75rem; width: 0.75rem;"><path d="M20 6 9 17l-5-5"></path></svg>`; return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="height: 0.75rem; width: 0.75rem;"><circle cx="12" cy="12" r="10"></circle></svg>`; };

  const renderScenarioRow = (scenario) => {
    const isLocked = scenario.status === 'locked'; 
    const statusClass = scenario.status === 'completed' ? 'stable' : (scenario.status === 'in-progress' ? 'measured' : 'locked'); 
    const statusText = scenario.status === 'in-progress' ? 'In Progress' : (scenario.status === 'completed' ? 'Completed' : 'Locked Phase'); 
    let btnText = isLocked ? 'Locked' : (scenario.status === 'completed' ? 'View Report' : 'Open Phase'); 
    const dependencyHtml = scenario.dependency_text ? `<div class="dependency-chip">Depends on: <span class="dependency-target">${scenario.dependency_text}</span></div>` : '';
    return `<div class="sequence-row ${isLocked ? 'locked-state' : ''}"><div class="row-metric-id"><div>${scenario.phase_name}</div><div class="row-number tabular">${String(scenario.step_number).padStart(2, '0')}</div></div><div><div class="row-header-inline"><h3 class="row-title">${scenario.title}</h3><span class="status-badge ${statusClass}">${getStatusIcon(scenario.status)} ${statusText}</span></div><p class="row-desc">${scenario.client_facing_wording || ''}</p>${dependencyHtml}</div><div class="action-cell"><button ${isLocked ? 'disabled' : ''} class="action-btn" data-id="${scenario.id}">${btnText}</button></div></div>`;
  };

  const populatePathwayUI = (data) => {
    if (!data.building) return;
    const assetName = `${data.currentProject?.project_code || 'PRJ-000'} — ${data.building.address_line_1}`;
    if (DOM.desktopSidebarAsset) DOM.desktopSidebarAsset.textContent = assetName; 
    if (DOM.desktopHeaderAsset) DOM.desktopHeaderAsset.textContent = assetName; 
    if (DOM.headerSysText) DOM.headerSysText.textContent = data.building.status || 'Pending';
    
    const state = data.building.state || 'WA'; 
    const climateText = state === 'WA' ? 'Zone 5 — Warm Temperate' : 'Zone 6 — Mild Temperate';
    if (DOM.headerClimateText) DOM.headerClimateText.textContent = climateText; 
    if (DOM.sidebarMeta) DOM.sidebarMeta.textContent = climateText;
    
    if (DOM.sequenceStack) { 
      DOM.sequenceStack.innerHTML = ''; 
      data.scenarios.forEach(scen => { scenariosStore[scen.id] = scen; DOM.sequenceStack.insertAdjacentHTML('beforeend', renderScenarioRow(scen)); }); 
    }
    
    document.querySelectorAll('.action-btn:not([disabled])').forEach(btn => { 
      btn.addEventListener('click', (e) => { 
        const scen = scenariosStore[e.target.getAttribute('data-id')]; if(!scen) return; 
        DOM.mPhaseName.textContent = `Phase 0${scen.phase} · ${scen.phase_name}`; 
        DOM.mTitle.textContent = scen.title; 
        DOM.mDesc.textContent = scen.client_facing_wording || ''; 
        DOM.mStatusBadge.className = `status-badge ${scen.status === 'completed' ? 'stable' : 'measured'}`; 
        DOM.mStatusIcon.innerHTML = getStatusIcon(scen.status); 
        DOM.mStatusText.textContent = scen.status === 'completed' ? 'Completed' : 'In Progress'; 
        
        if(scen.dependency_text) { DOM.mDependencyText.textContent = scen.dependency_text; DOM.mDependencyWrap.classList.remove('jb-hidden'); } 
        else { DOM.mDependencyWrap.classList.add('jb-hidden'); } 
        
        // Smart CTA Logic
        if (scen.status === 'completed') { 
          DOM.mActionBtn.textContent = 'Go to Reports'; 
          DOM.mActionBtn.onclick = () => window.location.href = '/reports'; 
        } else { 
          DOM.mActionBtn.textContent = 'Book Consultation'; 
          DOM.mActionBtn.onclick = () => window.location.href = 'mailto:hello@joebuilds.com.au?subject=Consultation%20Request%20-%20' + encodeURIComponent(scen.title); 
        }
        DOM.modal.classList.remove('jb-hidden'); 
      }); 
    });
    
    // Update progress bars
    const phaseScenarios = (phase) => data.scenarios.filter(s => s.phase === phase);
    const setProgress = (elCount, elBar, p) => { const total = p.length; if(total===0)return; const comp = p.filter(s=>s.status==='completed').length; const perc = Math.round((comp/total)*100); if(elCount) elCount.textContent = `${comp}/${total}`; if(elBar) elBar.style.width = `${perc}%`; };
    setProgress(DOM.p1Count, DOM.p1Bar, phaseScenarios(1)); setProgress(DOM.p2Count, DOM.p2Bar, phaseScenarios(2)); setProgress(DOM.p3Count, DOM.p3Bar, phaseScenarios(3));
    toggleSkeletonState(false);
  };

  const init = async () => {
    toggleSkeletonState(true); 
    const closeModal = () => DOM.modal.classList.add('jb-hidden'); 
    if (DOM.modalCloseBtn) DOM.modalCloseBtn.addEventListener('click', closeModal); 
    if (DOM.modalCancelBtn) DOM.modalCancelBtn.addEventListener('click', closeModal); 
    if (DOM.modal) DOM.modal.addEventListener('click', (e) => { if (e.target === DOM.modal) closeModal(); });

    if (!window.supabase) return; 

    // SECURE TOKEN HANDSHAKE VIA CUSTOM FIELD
    let supabaseToken = '';
    try { 
      const memberReq = await window.$memberstackDom.getCurrentMember();
      if (memberReq && memberReq.data && memberReq.data.customFields && memberReq.data.customFields['supabase-jwt']) {
          supabaseToken = memberReq.data.customFields['supabase-jwt'];
      }
    } catch(e) { console.warn("No Supabase token found"); }

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: supabaseToken ? { Authorization: `Bearer ${supabaseToken}` } : {} }
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
        const pathwayData = await fetchPathwayData(targetBuildingId); 
        populatePathwayUI(pathwayData); 
      } else { 
        toggleSkeletonState(false); 
      }
    } catch (error) {}
  };
  return { init };
})();

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', JoeBuildsPathway.init); } else { JoeBuildsPathway.init(); }
