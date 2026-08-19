/**
 * Joe Builds Home Intelligence Platform
 * Dashboard Controller (v30 = v28 + Joe ruling 18 Aug 2026: measured renders Monitor
 * + honest climate line (no invented zone) + client commentary wording to standard)
 */
const JoeBuildsDashboard = (() => {
  const SUPABASE_URL = 'https://jsqyfiwkbuvuajwzbjhd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_xla-awjgU2npKzrWHdYKDQ_2ox0CWmC';
  let supabase;
  let DOM = {}; 

  const toggleSkeletonState = (isLoading) => { 
    if(!DOM.metricCards) return;
    const elementsToToggle = [
        DOM.integrityValue, 
        DOM.desktopAsset, 
        DOM.headerClimateText, 
        DOM.headerSysText, 
        DOM.sidebarAsset, 
        DOM.heroProjectDate, 
        DOM.ctaTitle, 
        DOM.sidebarMeta
    ]; 
    DOM.metricCards.forEach(card => { 
        elementsToToggle.push(card.querySelector('.jb-metric-string'), card.querySelector('.jb-metric-description'), card.querySelector('.jb-status-badge')); 
    }); 
    elementsToToggle.forEach(el => { 
        if (!el) return; 
        if (isLoading) el.classList.add('jb-skeleton-block'); 
        else el.classList.remove('jb-skeleton-block'); 
    }); 
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
      // Safe default: anything unrecognised must NOT read as Stable.
      return 'Further Investigation Required';
  };

  // CLIENT OUTPUT STANDARD: Map DB status to visual CSS classes
  const getStatusVisual = (status) => {
      const s = (status || '').toLowerCase().replace(/\s/g, '');
      if (s === 'stable' || s === 'closed') return 'stable';
      // JOE RULING 18 Aug 2026: 'measured' now renders as Monitor, so it takes the Monitor
      // (blue) hue, not the Stable hue. CSS class is historically named 'measured'.
      if (s === 'monitor' || s === 'measured') return 'measured';
      if (s === 'risk' || s === 'atrisk') return 'risk';
      // Safe default: anything unrecognised must NOT render as stable.
      return 'review';
  };

  const formatBuildingStatus = (status) => {
      if (status === 'Calibrated') return 'Baseline Complete';
      return status || 'Pending';
  };

  const initUIEvents = () => {
    if (DOM.modalForensicBtn) DOM.modalForensicBtn.addEventListener('click', () => { window.location.href = '/diagnostics'; });
    if (DOM.ctaBtn) DOM.ctaBtn.addEventListener('click', () => { window.location.href = '/pathway'; });
    
    if (DOM.metricCards) {
      DOM.metricCards.forEach(card => { 
        card.addEventListener('click', () => { 
          const visualStatus = card.getAttribute('data-status') || 'unknown'; 
          if(DOM.mTitle) DOM.mTitle.textContent = card.getAttribute('data-title'); 
          if(DOM.mStatusBadge) DOM.mStatusBadge.className = `jb-status-badge jb-status-${visualStatus}`; 
          if(DOM.mStatusDot) DOM.mStatusDot.className = `jb-badge-dot bg-${visualStatus}`; 
          if(DOM.mStatusText) DOM.mStatusText.textContent = card.getAttribute('data-badge'); 
          
          const modalBody = document.querySelector('.jb-modal-body');
          if (modalBody) {
             modalBody.innerHTML = `
              <div style="padding: 2.5rem 1.5rem; background: var(--border); border-radius: 4px; text-align: center; margin-bottom: 1.5rem;">
                  <div class="jb-eyebrow">Current Record</div>
                  <div style="font-size: 28px; font-family: var(--font-mono); color: var(--foreground); font-weight: 500; margin-top: 0.5rem; letter-spacing:-0.02em;">${card.getAttribute('data-current') || '-'}</div>
              </div>
              <div style="display:flex; flex-direction:column; gap: 1.5rem; padding: 0 0.5rem;">
                  <div>
                      <div class="jb-eyebrow" style="color:var(--muted-foreground);">Analyst Commentary</div>
                      <p style="font-size: 13.5px; color: var(--foreground); line-height: 1.6; margin-top: 0.5rem;">${card.getAttribute('data-commentary')}</p>
                  </div>
                  <div style="padding-top: 1rem; border-top: 1px solid var(--border);">
                      <div class="jb-eyebrow" style="color:var(--muted-foreground);">Recommended Action</div>
                      <p style="font-size: 13px; color: var(--muted-foreground); line-height: 1.6; margin-top: 0.5rem;">${card.getAttribute('data-rec')}</p>
                  </div>
              </div>
              <div class="jb-modal-footer" style="margin-top: 2.5rem; padding:0; border-top:none; background:transparent;">
                  <button class="jb-btn-secondary" id="modalFooterCloseBtn">Close Details</button>
                  <button class="jb-btn-primary" onclick="window.location.href='/diagnostics'">View Raw Logs</button>
              </div>`;
             
             document.getElementById('modalFooterCloseBtn').addEventListener('click', () => DOM.modal.classList.add('jb-hidden'));
          }

          if(DOM.modal) DOM.modal.classList.remove('jb-hidden'); 
        }); 
      });
    }

    if (DOM.closeBtns) { DOM.closeBtns.forEach(btn => { if (btn) btn.addEventListener('click', () => DOM.modal.classList.add('jb-hidden')); }); }
    if(DOM.modal) DOM.modal.addEventListener('click', (e) => { if (e.target === DOM.modal) DOM.modal.classList.add('jb-hidden'); });
  };

  const fetchData = async (buildingId) => {
    const [bRes, pRes, mRes, sRes, sessRes, issueRes] = await Promise.all([ 
      supabase.from('buildings').select('*').eq('id', buildingId).single(), 
      supabase.from('projects').select('*').eq('building_id', buildingId).order('created_at', { ascending: false }), 
      supabase.from('measurements').select(`*, measurement_points(zone_code, element_code)`).eq('building_id', buildingId), 
      supabase.from('upgrade_scenarios').select('*').eq('building_id', buildingId).order('step_number', { ascending: true }),
      supabase.from('assessment_sessions').select('*').eq('building_id', buildingId).order('created_at', { ascending: false }),
      supabase.from('issues_findings').select('*').eq('building_id', buildingId).order('created_at', { ascending: false })
    ]);
    return { building: bRes.data, currentProject: pRes.data?.[0], measurements: mRes.data, scenarios: sRes.data, sessions: sessRes.data, issues: issueRes.data };
  };

  const mapMeasurementToCard = (data, elementCode, domTargetTitle, overrideTitle, prefixText = '') => {
    const m = data.measurements?.find(x => x.measurement_points?.element_code === elementCode);
    if (m) {
      const card = Array.from(DOM.metricCards).find(c => c.getAttribute('data-title') === domTargetTitle); if (!card) return;
      
      const visualStatus = getStatusVisual(m.status_flag);
      const badgeText = getBadgeText(m.status_flag);

      // Force Client Wording Overrides
      const titleEl = card.querySelector('.jb-card-title');
      if (titleEl) titleEl.textContent = overrideTitle;
      card.setAttribute('data-title', overrideTitle);

      card.setAttribute('data-status', visualStatus); 
      card.setAttribute('data-badge', badgeText); 
      
      let displayString = `${m.value || ''} ${m.unit || ''}`.trim();
      if (prefixText) { displayString = `${prefixText} ${displayString}`; }
      
      card.setAttribute('data-current', displayString); 
      card.setAttribute('data-commentary', m.client_facing_wording || 'Ongoing measurement active.'); 
      card.setAttribute('data-rec', "Consult pathway for recommended next actions.");
      
      const valueEl = card.querySelector('.jb-metric-string'); 
      const descEl = card.querySelector('.jb-metric-description');
      if (valueEl) valueEl.textContent = displayString; 
      if (descEl) descEl.textContent = m.client_facing_wording || 'Ongoing measurement active.';
      
      const badgeEl = card.querySelector('.jb-status-badge'); 
      const dotEl = card.querySelector('.jb-badge-dot');
      if (badgeEl && dotEl) { 
        badgeEl.className = `jb-status-badge jb-status-${visualStatus}`; 
        dotEl.className = `jb-badge-dot bg-${visualStatus}`; 
        badgeEl.innerHTML = `<span class="${dotEl.className}"></span>${badgeText}`; 
      }
    }
  };

  const mapIssueToPriorityCard = (issues) => {
    if (!DOM.metricCards) return;
    const card = Array.from(DOM.metricCards).find(c => c.getAttribute('data-title') === 'Active Priority Recommendation'); if (!card) return;
    
    const activeIssue = issues?.find(i => i.status !== 'Closed' && i.status !== 'Stable') || null;
    
    if (activeIssue) {
        let dbStatus = activeIssue.status.toLowerCase().replace(/\s/g, ''); // standardize
        if (dbStatus.includes('risk')) dbStatus = 'risk';
        else if (dbStatus.includes('action') || dbStatus.includes('investigation')) dbStatus = 'review';
        else dbStatus = 'review'; // Fallback for uncategorized active issues

        const visualStatus = getStatusVisual(dbStatus);
        const badgeText = getBadgeText(dbStatus);

        const valueEl = card.querySelector('.jb-metric-string'); 
        const descEl = card.querySelector('.jb-metric-description');
        if (valueEl) valueEl.textContent = activeIssue.issue_type || 'Further Investigation Required'; 
        if (descEl) descEl.textContent = activeIssue.client_facing_wording || 'Further investigation required. Recorded by Joe Builds at the last assessment.';
        
        const badgeEl = card.querySelector('.jb-status-badge'); 
        const dotEl = card.querySelector('.jb-badge-dot');
        if (badgeEl && dotEl) { 
            badgeEl.className = `jb-status-badge jb-status-${visualStatus}`; 
            dotEl.className = `jb-badge-dot bg-${visualStatus}`; 
            badgeEl.innerHTML = `<span class="${dotEl.className}"></span>${badgeText}`; 
        }

        card.setAttribute('data-status', visualStatus);
        card.setAttribute('data-badge', badgeText);
        card.setAttribute('data-current', activeIssue.issue_type || 'Further Investigation Required');
        card.setAttribute('data-commentary', activeIssue.client_facing_wording || 'Further investigation required.');
        card.setAttribute('data-rec', activeIssue.recommended_action || "Next step is recorded in your Upgrade Pathway.");

    } else {
        const valueEl = card.querySelector('.jb-metric-string'); 
        const descEl = card.querySelector('.jb-metric-description');
        if (valueEl) valueEl.textContent = 'No Further Action Indicated'; 
        if (descEl) descEl.textContent = 'All recorded parameters are within the observed baseline range.';
        const badgeEl = card.querySelector('.jb-status-badge'); 
        if (badgeEl) { badgeEl.className = `jb-status-badge jb-status-stable`; badgeEl.innerHTML = `<span class="jb-badge-dot bg-stable"></span>Stable`; }
        
        card.setAttribute('data-status', 'stable');
        card.setAttribute('data-badge', 'Stable');
        card.setAttribute('data-current', 'Stable');
        card.setAttribute('data-commentary', 'All recorded diagnostic parameters are indicated Stable at the last assessment.');
        card.setAttribute('data-rec', 'No further action indicated at the last assessment.');
    }
  };

  const mapHistoricalLog = (sessions) => {
    if (!DOM.metricCards) return;
    const card = Array.from(DOM.metricCards).find(c => c.getAttribute('data-title') === 'Historical Diagnostic Log');
    if (!card) return;
    const valueEl = card.querySelector('.jb-metric-string');
    const descEl = card.querySelector('.jb-metric-description');
    const count = sessions?.length || 0;
    
    if (valueEl) valueEl.textContent = `${count} entries`;
    
    let histDate = 'No historical sessions logged.';
    if (count > 0 && sessions[0].assessment_date) {
        histDate = `Last entry: ${new Date(sessions[0].assessment_date).toLocaleDateString('en-GB')}.`;
    }
    if (descEl) descEl.textContent = histDate;
    
    card.setAttribute('data-status', 'stable');
    card.setAttribute('data-badge', 'Stable');
    card.setAttribute('data-current', `${count} Total Assessments`);
    card.setAttribute('data-commentary', 'A dated log of each recorded assessment session for this property.');
    card.setAttribute('data-rec', histDate);
  };

  const mapReadiness = (scenarios) => {
    if (!DOM.metricCards) return;
    const card = Array.from(DOM.metricCards).find(c => c.getAttribute('data-title') === 'Upgrade Sequence Readiness');
    if (!card) return;
    
    const valueEl = card.querySelector('.jb-metric-string');
    const descEl = card.querySelector('.jb-metric-description');
    if (!scenarios || scenarios.length === 0) return;
    
    const completed = scenarios.filter(s => s.status === 'completed').length;
    const total = scenarios.length;
    if (valueEl) valueEl.textContent = `${completed} / ${total} Phases`;
    
    const active = scenarios.find(s => s.status === 'in-progress');
    const descText = active ? `Currently active: ${active.title}` : 'All pathways completed.';
    if (descEl) descEl.textContent = descText;
    
    const badgeEl = card.querySelector('.jb-status-badge');
    const dotEl = card.querySelector('.jb-badge-dot');
    if (badgeEl && dotEl) {
        badgeEl.className = `jb-status-badge jb-status-stable`; // Mapped measured to stable visually for pathways
        dotEl.className = `jb-badge-dot bg-stable`;
        badgeEl.innerHTML = `<span class="${dotEl.className}"></span>Stable`;
    }

    card.setAttribute('data-status', 'stable');
    card.setAttribute('data-badge', 'Stable');
    card.setAttribute('data-current', `${completed} of ${total} Phases Unlocked`);
    card.setAttribute('data-commentary', 'Progress through the recommended upgrade sequence, updated at each assessment.');
    card.setAttribute('data-rec', descText);
  };

  const init = async () => {
    DOM = { 
      integrityValue: document.querySelector('.jb-integrity-value'), 
      integrityBadge: document.querySelector('.jb-integrity-badge'), 
      heroProjectDate: document.querySelector('.jb-page-description .jb-font-mono'), 
      
      desktopAsset: document.getElementById('desktopHeaderAsset'), 
      headerClimateText: document.getElementById('desktopHeaderClimate'), 
      headerSysText: document.getElementById('desktopHeaderSys'), 
      
      sidebarAsset: document.getElementById('desktopSidebarAsset') || document.querySelector('.jb-footer-project'),
      sidebarMeta: document.getElementById('desktopSidebarMeta') || document.querySelector('.sidebar-footer .text-muted-foreground'),
      
      metricCards: document.querySelectorAll('.jb-matrix-card'), 
      ctaTitle: document.querySelector('.jb-cta-title'), 
      ctaBtn: document.querySelector('.jb-cta-action-btn'),
      
      modal: document.getElementById('jbTelemetryModal'), 
      modalForensicBtn: document.querySelector('.jb-btn-primary'), 
      mTitle: document.getElementById('modalTitle'), 
      mStatusBadge: document.getElementById('modalStatusBadge'), 
      mStatusDot: document.getElementById('modalStatusDot'), 
      mStatusText: document.getElementById('modalStatusText'), 
      mCurrent: document.getElementById('mMetricCurrent'), 
      mDelta7: document.getElementById('mMetricDelta7'), 
      mDelta30: document.getElementById('mMetricDelta30'), 
      mThreshold: document.getElementById('mMetricThreshold'), 
      mCommentary: document.getElementById('modalCommentary'), 
      mRec: document.getElementById('modalRecommendations'), 
      modalGraph: document.querySelector('.jb-modal-graph-panel'), 
      closeBtns: [document.getElementById('modalHeaderCloseBtn'), document.getElementById('modalFooterCloseBtn')]
    };

    // --- WORDING FIXES START ---
    // 1. Force hardcoded HTML card title update immediately (Renames Structural Moisture Risk)
    if (DOM.metricCards) {
        DOM.metricCards.forEach(card => {
            if (card.getAttribute('data-title') === 'Structural Moisture Risk') {
                card.setAttribute('data-title', 'Subfloor Moisture');
                const titleEl = card.querySelector('.jb-card-title');
                if (titleEl) titleEl.textContent = 'Subfloor Moisture';
            }
        });
    }

    // 2. Hide the Integrity Badge completely
    const integrityBadge = document.querySelector('.jb-integrity-badge');
    if (integrityBadge) integrityBadge.style.display = 'none';
    const heroRight = document.querySelector('.jb-hero-right');
    if (heroRight) heroRight.style.display = 'none';
    // --- WORDING FIXES END ---

    toggleSkeletonState(true); 
    initUIEvents();

    if (!window.supabase) return; 

    let supabaseToken = '';
      try { 
        const memberReq = await window.$memberstackDom.getCurrentMember();
        if (memberReq?.data?.customFields?.['supabase-jwt']) {
            supabaseToken = memberReq.data.customFields['supabase-jwt'];
        }
      } catch(e) { }

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: supabaseToken ? { Authorization: `Bearer ${supabaseToken}` } : {} }
    });
    
    try {
      const member = await window.$memberstackDom.getCurrentMember();
      
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
      
      if (!targetBuildingId) {
         const bounds = document.querySelector('.jb-content-bounds');
         if (bounds) {
             bounds.innerHTML = `
             <div style="text-align:center; padding: 6rem 2rem; background: var(--surface); border: 1px dashed var(--border); border-radius: 4px; margin-top: 2rem;">
               <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted-foreground); margin-bottom: 1rem;"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg>
               <h3 style="font-size: 20px; font-weight: 500; margin-bottom: 0.5rem; color: var(--foreground);">No Property Assigned</h3>
               <p style="color: var(--muted-foreground); font-size: 13px; max-width: 400px; margin: 0 auto;">Your home intelligence profile is active, but a physical property has not yet been assigned to your account. Please wait for your operator to provision your baseline.</p>
             </div>
             `;
         }
         if (DOM.sidebarAsset) DOM.sidebarAsset.textContent = 'Unassigned'; 
         if (DOM.sidebarMeta) DOM.sidebarMeta.textContent = '--';
         if (DOM.desktopAsset && !document.getElementById('clientPropertySwitcher')) { DOM.desktopAsset.textContent = 'Unassigned'; }
         if (DOM.headerClimateText) DOM.headerClimateText.textContent = '--';
         if (DOM.headerSysText) DOM.headerSysText.textContent = 'Pending Provision';

         toggleSkeletonState(false);
         return; 
      }
      
      if (targetBuildingId) {
        const data = await fetchData(targetBuildingId);
        if (data.building) {
          const assetName = `${data.building.building_code || data.currentProject?.project_code || 'PRJ'} - ${data.building.address_line_1}`;
          const climateText = data.building.climate_zone || '—'; // no invented zone: blank until a recorded value exists

          if (DOM.sidebarAsset) DOM.sidebarAsset.textContent = assetName; 
          if (DOM.sidebarMeta) DOM.sidebarMeta.textContent = climateText;
          if (DOM.desktopAsset && !document.getElementById('clientPropertySwitcher')) {
              DOM.desktopAsset.textContent = assetName;
          }
          if (DOM.headerClimateText) DOM.headerClimateText.textContent = climateText;
          if (DOM.headerSysText) DOM.headerSysText.textContent = formatBuildingStatus(data.building.status);

          if (DOM.heroProjectDate && data.sessions && data.sessions.length > 0 && data.sessions[0].assessment_date) {
              const latestDate = new Date(data.sessions[0].assessment_date).toLocaleDateString('en-GB');
              let dateInsert = document.getElementById('jb-dynamic-date');
              if (!dateInsert) {
                  dateInsert = document.createElement('div');
                  dateInsert.id = 'jb-dynamic-date';
                  dateInsert.className = 'jb-font-mono';
                  dateInsert.style.cssText = 'margin-top: 1rem; color: var(--status-stable); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;';
                  const descEl = document.querySelector('.jb-page-description');
                  if (descEl) descEl.parentNode.insertBefore(dateInsert, descEl.nextSibling);
              }
              dateInsert.textContent = `LATEST ASSESSMENT CONDUCTED: ${latestDate}`;
          }
          
          const envMetric = data.measurements?.find(x => x.measurement_points?.element_code === 'ENVELOPE'); 
          if (envMetric && DOM.integrityValue) {
              // CLIENT STANDARD: Override numeric index with plain status string
              const visualStatus = getStatusVisual(envMetric.status_flag);
              const badgeText = getBadgeText(envMetric.status_flag);
              DOM.integrityValue.innerHTML = `<span style="color: var(--status-${visualStatus})">${badgeText}</span>`;
          }
          
          if (data.scenarios && DOM.ctaTitle) { 
            const nextAction = data.scenarios.find(s => s.status === 'in-progress' || s.status === 'locked'); 
            if (nextAction) DOM.ctaTitle.textContent = nextAction.title; 
            else DOM.ctaTitle.textContent = "No Pathway Recorded Yet"; // PS-054: an empty pathway is not a completed one
          }
          
          // Apply new naming conventions securely via arguments. Notice MOISTURE maps to 'Subfloor Moisture'
          mapMeasurementToCard(data, 'ENVELOPE', 'Envelope Integrity', 'Envelope Integrity', 'Integrity Index'); 
          mapMeasurementToCard(data, 'U-VALUE', 'Thermal Enclosure Performance', 'Thermal Enclosure Performance', 'U-value'); 
          mapMeasurementToCard(data, 'MOISTURE', 'Subfloor Moisture', 'Subfloor Moisture', 'Subfloor RH'); 
          mapMeasurementToCard(data, 'CO2', 'Indoor Air Quality (IAQ)', 'Indoor Air Quality (IAQ)', 'CO₂ avg'); 
          
          mapReadiness(data.scenarios);
          mapHistoricalLog(data.sessions);
          mapIssueToPriorityCard(data.issues);
        }
      }
      toggleSkeletonState(false);
    } catch (error) {}
  };
  return { init };
})();

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', JoeBuildsDashboard.init); } else { JoeBuildsDashboard.init(); }
