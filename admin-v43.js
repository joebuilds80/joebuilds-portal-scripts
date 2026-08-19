/**
 * Joe Builds - Admin Controller (v43 = v42 + Joe ruling 18 Aug 2026: measured renders
 * Monitor; honest climate line; pathway template Control language removed)
 */
console.log("JB Admin Controller v43 initializing...");
const JoeBuildsAdmin = (() => {
  const SUPABASE_URL = 'https://jsqyfiwkbuvuajwzbjhd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_xla-awjgU2npKzrWHdYKDQ_2ox0CWmC';
  let supabase, currentBuildingId = null, currentUserRole = null, globalBuildings = [];
  let currentRooms = []; 
  let activeAccessUser = null; 
  let DOM = {}, jwtToken = ''; 

  const showErrorOnScreen = (message, errDetail = "") => {
    console.error("ADMIN ERROR:", message, errDetail);
  };

  const showToast = (message, type = 'success') => { const toast = document.createElement('div'); const color = type === 'success' ? 'var(--status-stable, #3A6B48)' : 'var(--status-review, #A64444)'; toast.style.cssText = `position: fixed; bottom: 24px; right: 24px; background: var(--surface, #FFF); color: var(--foreground, #1A241D); border-left: 4px solid ${color}; padding: 12px 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); font-family: var(--font-mono, monospace); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; z-index: 999999; transform: translateX(120%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 8px;`; const icon = type === 'success' ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>` : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`; toast.innerHTML = `${icon} <span>${message}</span>`; document.body.appendChild(toast); requestAnimationFrame(() => toast.style.transform = 'translateX(0)'); setTimeout(() => { toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 300); }, 3000); };
  
  const toggleSkeletonState = (isLoading) => { 
    try {
      const elementsToToggle = [DOM.desktopSidebarAsset, DOM.desktopHeaderAsset, DOM.headerClimateText, DOM.headerSysText, DOM.assetCount, DOM.archiveCount, DOM.desktopSidebarMeta]; 
      elementsToToggle.forEach(el => { if (!el) return; if (isLoading) el.classList.add('jb-skeleton-block'); else el.classList.remove('jb-skeleton-block'); }); 
      if (isLoading && DOM.telemetryContainer) DOM.telemetryContainer.innerHTML = `<div class="card-surface jb-skeleton-block" style="height: 150px;"></div>`; 
    } catch(err) { console.warn(err); }
  };

  const handleReportUpload = async (e) => {
    try {
      if (!currentBuildingId || !jwtToken) return;
      const file = e.target.files[0]; if (!file) return;
      
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
          showToast('File exceeds 50MB limit', 'error');
          if(DOM.reportInput) DOM.reportInput.value = '';
          return;
      }

      const targetRoomId = DOM.uploadTargetRoom ? DOM.uploadTargetRoom.value : null;
      const isClientVisible = DOM.uploadClientVisible ? DOM.uploadClientVisible.checked : true;
      const fileExt = file.name.split('.').pop().toLowerCase();

      // STRICT FILE VALIDATION
      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExt);
      const isDoc = ['pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx'].includes(fileExt);

      let bucket = ''; let table = ''; let insertPayload = {};

      if (targetRoomId) {
          if (!isImage) { showToast('Room Evidence MUST be an image file (JPG/PNG)', 'error'); DOM.reportInput.value = ''; return; }
          bucket = 'property_assets'; table = 'evidence_assets';
          insertPayload = { building_id: currentBuildingId, room_id: targetRoomId, file_name: file.name, client_visible: isClientVisible };
      } else {
          if (!isDoc) { showToast('Reports MUST be a document file (PDF/CSV)', 'error'); DOM.reportInput.value = ''; return; }
          bucket = 'reports'; table = 'reports';
          insertPayload = { building_id: currentBuildingId, report_title: file.name, report_type: fileExt.toUpperCase(), client_visible: isClientVisible };
      }

      if(DOM.uploadStatusText) DOM.uploadStatusText.textContent = `Uploading ${file.name}...`;
      
      const fileName = `${currentBuildingId}/${Date.now()}.${fileExt}`;
      
      // NATIVE FETCH UPLOAD TO PROXY (Bypassing Gateway)
      const formData = new FormData();
      formData.append('action', 'upload');
      formData.append('file', file);
      formData.append('bucket', bucket);
      formData.append('path', fileName);

      const uploadRes = await fetch(`${SUPABASE_URL}/functions/v1/storage-proxy`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${jwtToken}`,
            'apikey': SUPABASE_ANON_KEY 
        },
        body: formData
      });
      
      if (!uploadRes.ok) { 
        const errObj = await uploadRes.json();
        throw new Error(errObj.error || "Proxy Upload Failed");
      }
      
      const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
      if (table === 'evidence_assets') { insertPayload.file_url = fileUrl; } 
      else { insertPayload.report_url = fileUrl; }
      
      await supabase.from(table).insert([insertPayload]);
      
      if(DOM.uploadStatusText) DOM.uploadStatusText.textContent = `Drop or click to upload`; 
      if(DOM.reportInput) DOM.reportInput.value = ''; 
      showToast('File uploaded successfully'); 
      loadAssetContext(currentBuildingId);
    } catch(err) {
      if(DOM.uploadStatusText) DOM.uploadStatusText.textContent = `Drop or click to upload`; 
      if(DOM.reportInput) DOM.reportInput.value = ''; 
      showErrorOnScreen("Upload Failed", err.message || err);
      showToast('Upload failed: ' + (err.message || 'Server Error'), 'error'); 
    }
  };

  const injectAccessModal = () => {
    if (document.getElementById('jbUserAccessModal')) return;
    const modalHTML = `
    <div id="jbUserAccessModal" class="jb-modal-backdrop jb-hidden" style="z-index: 999999;">
      <div class="jb-modal-frame" style="max-width: 32rem; background: var(--surface); border: 1px solid var(--border); display: flex; flex-direction: column;">
        <div class="jb-modal-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding: 1rem 1.5rem;">
          <div>
            <div class="eyebrow" style="font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; color: var(--muted-foreground); margin-bottom: 0.25rem;">Property Assignments</div>
            <h2 style="font-size:18px; font-weight:500; margin: 0; color: var(--foreground);" id="accessModalTitle">Manage Access</h2>
          </div>
          <button id="closeUserAccessModal" style="background: transparent; border: none; cursor: pointer; color: var(--muted-foreground);"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.25rem;height:1.25rem;"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>
        </div>
        <div class="jb-modal-body" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
          <div style="margin-bottom: 1rem;">
            <div class="eyebrow" style="font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; color: var(--muted-foreground); margin-bottom: 0.5rem;">Assign New Property</div>
            <div style="display:flex; gap: 0.5rem;">
              <select class="control-select" id="accessModalSelect" style="flex:1; width: 100%; border: 1px solid var(--border); background-color: var(--surface); color: var(--foreground); padding: 0.375rem 0.5rem; font-size: 11px; font-family: var(--font-mono); outline: none;">
                 <option value="">Loading properties...</option>
              </select>
              <button class="btn-primary" id="btnAccessAssign" style="display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border: 1px solid var(--foreground); background-color: var(--foreground); color: var(--background); padding: 0.625rem 1rem; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: var(--tracking-widest); cursor: pointer;">Assign</button>
            </div>
          </div>
          <div>
            <div class="eyebrow" style="font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; color: var(--muted-foreground); margin-bottom: 0.5rem;">Currently Assigned Properties</div>
            <div class="archive-list" id="accessModalList" style="display: flex; flex-direction: column; gap: 1px; background-color: var(--border);">
               <!-- Assigned properties populated here -->
            </div>
          </div>
        </div>
      </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  };

  const initUIEvents = () => {
    if (DOM.assetSelect) { DOM.assetSelect.addEventListener('change', (e) => { currentBuildingId = e.target.value; toggleSkeletonState(true); loadAssetContext(currentBuildingId); }); }
    if (DOM.reportInput) { DOM.reportInput.addEventListener('change', handleReportUpload); } 
    if (DOM.btnInitializeAsset) { DOM.btnInitializeAsset.addEventListener('click', async () => { DOM.btnInitializeAsset.textContent = "Deploying..."; DOM.btnInitializeAsset.disabled = true; await initializeBuildingData(currentBuildingId); }); }
    if (DOM.btnUserManagement) { DOM.btnUserManagement.addEventListener('click', openUsersModal); }
    if (DOM.closeUsersModal) { DOM.closeUsersModal.addEventListener('click', () => { if(DOM.usersModal) DOM.usersModal.classList.add('jb-hidden'); }); }
    if (DOM.usersModal) { DOM.usersModal.addEventListener('click', (e) => { if (e.target === DOM.usersModal) DOM.usersModal.classList.add('jb-hidden'); }); }
    
    if (DOM.closeUserAccessModal) { DOM.closeUserAccessModal.addEventListener('click', () => { if(DOM.accessModal) DOM.accessModal.classList.add('jb-hidden'); }); }
    if (DOM.accessModal) { DOM.accessModal.addEventListener('click', (e) => { if (e.target === DOM.accessModal) DOM.accessModal.classList.add('jb-hidden'); }); }
    
    if (DOM.btnAccessAssign) {
      DOM.btnAccessAssign.addEventListener('click', async () => {
         const bid = DOM.accessModalSelect.value;
         if (!bid || !activeAccessUser) return;
         DOM.btnAccessAssign.textContent = '...'; DOM.btnAccessAssign.disabled = true;
         
         const rCheck = await supabase.from('user_property_access').select('id').eq('user_id', activeAccessUser.memberstack_id).eq('building_id', bid).maybeSingle();
         if (!rCheck.data) {
            const { error: insErr } = await supabase.from('user_property_access').insert([{ user_id: activeAccessUser.memberstack_id, building_id: bid, role: activeAccessUser.role || 'client', access_status: 'active', visibility_level: 'full' }]);
            if(insErr) console.error("Insert Error (check RLS)", insErr);
         }
         
         const { data: prof } = await supabase.from('profiles').select('building_id').eq('memberstack_id', activeAccessUser.memberstack_id).maybeSingle();
         if (prof && !prof.building_id) {
            await supabase.from('profiles').update({ building_id: bid }).eq('memberstack_id', activeAccessUser.memberstack_id);
         }
         
         DOM.btnAccessAssign.textContent = 'Assign'; DOM.btnAccessAssign.disabled = false;
         showToast("Property assigned to user");
         openAccessModal(activeAccessUser); 
      });
    }

    if (DOM.btnNewAssessment) {
      DOM.btnNewAssessment.addEventListener('click', async () => {
         if(!currentBuildingId) return;
         DOM.btnNewAssessment.textContent = "Adding..."; DOM.btnNewAssessment.disabled = true;
         await supabase.from('assessment_sessions').insert([{ building_id: currentBuildingId, assessment_type: 'Home Performance Baseline', status: 'Scheduled' }]);
         showToast('Session created'); 
         await loadAssetContext(currentBuildingId);
         DOM.btnNewAssessment.textContent = "+ Add Session"; DOM.btnNewAssessment.disabled = false;
      });
    }
    
    if (DOM.btnNewIssue) {
      DOM.btnNewIssue.addEventListener('click', async () => {
         if(!currentBuildingId) return;
         DOM.btnNewIssue.textContent = "Adding..."; DOM.btnNewIssue.disabled = true;
         await supabase.from('issues_findings').insert([{ building_id: currentBuildingId, issue_type: 'New Diagnostic Finding', status: 'Monitor' }]);
         showToast('Finding created'); 
         await loadAssetContext(currentBuildingId);
         DOM.btnNewIssue.textContent = "+ Log Finding"; DOM.btnNewIssue.disabled = false;
      });
    }
  };

  const authenticateAdmin = async () => {
    const member = await window.$memberstackDom.getCurrentMember(); if (!member || !member.data) { window.location.href = '/login'; return null; }
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('memberstack_id', member.data.id).maybeSingle();
    if (error || !profile) { window.location.href = '/login'; return null; }
    currentUserRole = profile.role || 'client'; if (currentUserRole === 'client' || currentUserRole === 'demo' || currentUserRole === 'suspended') { window.location.href = '/dashboard'; return null; }
    if ((currentUserRole === 'admin' || currentUserRole === 'operator') && DOM.btnUserManagement) { DOM.btnUserManagement.classList.remove('jb-hidden'); }
    return profile;
  };

  const loadGlobalAssets = async () => {
    const { data: buildings, error } = await supabase.from('buildings').select('id, building_code, address_line_1').order('created_at', { ascending: false });
    if (error || !buildings || buildings.length === 0) { if(DOM.assetCount) DOM.assetCount.textContent = `0 managed records`; if(DOM.assetSelect) DOM.assetSelect.innerHTML = `<option>No properties found</option>`; toggleSkeletonState(false); return; }
    globalBuildings = buildings; if(DOM.assetCount) DOM.assetCount.textContent = `${buildings.length} managed records`; if(DOM.assetSelect) DOM.assetSelect.innerHTML = '';
    buildings.forEach(b => { const opt = document.createElement('option'); opt.value = b.id; opt.textContent = `${b.building_code || 'PRJ'} - ${b.address_line_1}`; if(DOM.assetSelect) DOM.assetSelect.appendChild(opt); });
    currentBuildingId = buildings[0].id; loadAssetContext(currentBuildingId); 
  };

  const loadAssetContext = async (buildingId) => {
    try {
      const [buildingRes, measurementsRes, roomsRes, scenariosRes, reportsRes, sessRes, issuesRes] = await Promise.all([ 
        supabase.from('buildings').select('*').eq('id', buildingId).maybeSingle(),
        supabase.from('measurements').select(`*, measurement_points(*)`).eq('building_id', buildingId), 
        supabase.from('rooms').select('*').eq('building_id', buildingId).order('created_at', { ascending: true }), 
        supabase.from('upgrade_scenarios').select('*').eq('building_id', buildingId).order('step_number', { ascending: true }), 
        supabase.from('reports').select('id').eq('building_id', buildingId),
        supabase.from('assessment_sessions').select('*').eq('building_id', buildingId).order('created_at', { ascending: false }),
        supabase.from('issues_findings').select('*').eq('building_id', buildingId).order('created_at', { ascending: false })
      ]);
      
      const bData = buildingRes.data; 
      const mData = measurementsRes.data || []; currentRooms = roomsRes.data || []; const sData = scenariosRes.data || []; const repData = reportsRes.data || [];
      const sessData = sessRes.data || []; const issueData = issuesRes.data || [];
      
      if (bData) {
        const bTitle = `${bData.building_code || 'PRJ'} - ${bData.address_line_1}`;
        const climateText = bData.climate_zone || '—'; // no invented zone
        
        if(DOM.desktopSidebarAsset) DOM.desktopSidebarAsset.textContent = bTitle; 
        if(DOM.desktopHeaderAsset) DOM.desktopHeaderAsset.textContent = bTitle;
        if(DOM.headerSysText) DOM.headerSysText.textContent = bData.status || 'Pending';
        if(DOM.headerClimateText) DOM.headerClimateText.textContent = climateText;
        if(DOM.desktopSidebarMeta) DOM.desktopSidebarMeta.textContent = climateText;
      }

      if(DOM.archiveCount) DOM.archiveCount.textContent = `Archive currently holds ${repData.length} reports.`;
      
      if (DOM.uploadTargetRoom) { 
        DOM.uploadTargetRoom.innerHTML = '<option value="">Entire Building (General Report)</option>'; 
        currentRooms.forEach(r => { const opt = document.createElement('option'); opt.value = r.id; opt.textContent = r.room_name_current; DOM.uploadTargetRoom.appendChild(opt); }); 
      }
      
      if (mData.length === 0 && sData.length === 0 && sessData.length === 0) { 
        if(DOM.editorsWrap) DOM.editorsWrap.classList.add('jb-hidden'); if(DOM.emptyStateContainer) DOM.emptyStateContainer.classList.remove('jb-hidden'); 
      } else { 
        if(DOM.emptyStateContainer) DOM.emptyStateContainer.classList.add('jb-hidden'); if(DOM.editorsWrap) DOM.editorsWrap.classList.remove('jb-hidden'); 
        renderAssessments(sessData); renderIssues(issueData);
        renderTelemetryEditor(mData, sessData); renderTwinEditor(currentRooms, mData, sessData); renderPathwayEditor(sData); 
      }
    } catch(err) { console.error("Error loading context:", err); }
    toggleSkeletonState(false);
  };

  const initializeBuildingData = async (bId) => {
    try {
      await supabase.from('upgrade_scenarios').insert([
        {building_id: bId, step_number: 1, phase: 1, phase_name: 'Measure', title: 'Home Performance Baseline', status: 'completed'},
        {building_id: bId, step_number: 2, phase: 1, phase_name: 'Measure', title: 'Internal Environment Baseline', status: 'completed'},
        {building_id: bId, step_number: 3, phase: 2, phase_name: 'Understand', title: 'Moisture + Thermal Walkthrough', status: 'in-progress'},
        {building_id: bId, step_number: 4, phase: 2, phase_name: 'Understand', title: 'Room-Level Risk Review', status: 'locked'},
        {building_id: bId, step_number: 5, phase: 2, phase_name: 'Understand', title: 'Triggered Investigation', status: 'locked'},
        {building_id: bId, step_number: 6, phase: 3, phase_name: 'Recommend', title: 'Upgrade Pathway', status: 'locked'},
        {building_id: bId, step_number: 7, phase: 4, phase_name: 'Verify', title: 'Verification / Retest', status: 'locked'},
        {building_id: bId, step_number: 8, phase: 4, phase_name: 'Verify', title: 'Home Stability Report', status: 'locked'}
      ]);
      const {data: rooms} = await supabase.from('rooms').insert([
        {building_id: bId, room_code: 'primary', room_name_current: 'Primary Suite'}, {building_id: bId, room_code: 'kitchen', room_name_current: 'Kitchen'}, {building_id: bId, room_code: 'plant', room_name_current: 'Plant Room'}, {building_id: bId, room_code: 'subfloor', room_name_current: 'Subfloor Void (E)'}, {building_id: bId, room_code: 'living', room_name_current: 'Living Volume'}
      ]).select();
      const {data: basePts} = await supabase.from('measurement_points').insert([
        {building_id: bId, element_code: 'ENVELOPE'}, {building_id: bId, element_code: 'U-VALUE'}, {building_id: bId, element_code: 'READINESS'}, {building_id: bId, element_code: 'PRIORITY'}, {building_id: bId, element_code: 'ACH50'}, {building_id: bId, element_code: 'ELA'}, {building_id: bId, element_code: 'THERMAL_BRIDGE'}
      ]).select();
      
      await supabase.from('assessment_sessions').insert([{ building_id: bId, assessment_type: 'Home Performance Baseline', status: 'Completed', assessor: 'System Auto-Gen' }]);

      if(rooms) { 
        const rPtsInsert = []; rooms.forEach(r => { rPtsInsert.push({building_id: bId, room_id: r.id, element_code: 'RH'}); rPtsInsert.push({building_id: bId, room_id: r.id, element_code: 'CO2'}); rPtsInsert.push({building_id: bId, room_id: r.id, element_code: 'VOC'}); }); 
        const {data: roomPts} = await supabase.from('measurement_points').insert(rPtsInsert).select(); const allPts = [...(basePts||[]), ...(roomPts||[])]; const mInserts = allPts.map(pt => ({ building_id: bId, measurement_point_id: pt.id, room_id: pt.room_id || null, status_flag: 'stable', value: 0 })); await supabase.from('measurements').insert(mInserts); 
      }
      if(DOM.btnInitializeAsset) { DOM.btnInitializeAsset.textContent = "Generate Home Performance Baseline"; DOM.btnInitializeAsset.disabled = false; }
      loadAssetContext(bId);
    } catch(err) {}
  };

  const openUsersModal = async () => {
    if(!DOM.usersTableBody || !DOM.usersModal) return; 

    DOM.usersTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">Loading security records...</td></tr>`; 
    DOM.usersModal.classList.remove('jb-hidden');
    
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if(!profiles) { DOM.usersTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Failed to load users.</td></tr>`; return; }
    DOM.usersTableBody.innerHTML = '';
    
    profiles.forEach(p => {
      const nameStr = p.first_name || 'User'; 
      const emailStr = p.email || (p.memberstack_id ? p.memberstack_id.substring(0,8) : 'Unknown'); 
      const roleDisabled = currentUserRole !== 'admin' ? 'disabled title="Only Admins can modify roles"' : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 500;">${nameStr}</td>
        <td style="color:var(--muted-foreground); font-size:11px;">${emailStr}</td>
        <td>
          <select class="control-select" data-pid="${p.id}" data-mem="${p.memberstack_id}" data-role="${p.role || 'client'}" data-type="role" style="padding: 0.25rem;" ${roleDisabled}>
            <option value="client" ${p.role === 'client' ? 'selected' : ''}>Client</option>
            <option value="demo" ${p.role === 'demo' ? 'selected' : ''}>Demo</option>
            <option value="operator" ${p.role === 'operator' ? 'selected' : ''}>Operator</option>
            <option value="admin" ${p.role === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="suspended" ${p.role === 'suspended' ? 'selected' : ''}>Suspended</option>
          </select>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <button type="button" class="btn-manage-access btn-secondary" style="padding:0.25rem 0.5rem; font-size:10px;">Manage Access</button>
            <button type="button" class="btn-delete-user" style="background:transparent; border:none; color:var(--status-review); cursor:pointer; padding:0.25rem;" title="Delete User DB Profile">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      `;
      
      tr.querySelector('select[data-type="role"]').addEventListener('change', async (e) => { 
        e.target.style.borderColor = 'var(--status-stable)'; 
        await supabase.from('profiles').update({ role: e.target.value }).eq('id', e.target.dataset.pid); 
        setTimeout(() => e.target.style.borderColor = 'var(--border)', 500); 
      }); 

      tr.querySelector('.btn-manage-access').addEventListener('click', () => {
         openAccessModal(p);
      });

      tr.querySelector('.btn-delete-user').addEventListener('click', async () => {
        if (confirm(`Are you sure you want to completely delete ${emailStr}? This severs all their properties and deletes their database record.`)) {
          await supabase.from('user_property_access').delete().eq('user_id', p.memberstack_id);
          const { error } = await supabase.from('profiles').delete().eq('id', p.id);
          if (!error) { showToast('User profile deleted'); openUsersModal(); } else { showToast('Failed to delete user', 'error'); }
        }
      });
      DOM.usersTableBody.appendChild(tr);
    });
  };

  const openAccessModal = async (profile) => {
    activeAccessUser = profile;
    if(!DOM.accessModal) return;
    
    const emailStr = profile.email || 'User';
    if(DOM.accessModalTitle) DOM.accessModalTitle.textContent = `Access: ${emailStr}`;
    
    if(DOM.accessModalList) DOM.accessModalList.innerHTML = `<div style="padding:1rem; text-align:center;">Loading assigned properties...</div>`;
    DOM.accessModal.classList.remove('jb-hidden');

    const { data: accesses } = await supabase.from('user_property_access').select('building_id, buildings(building_code, address_line_1)').eq('user_id', profile.memberstack_id);
    
    const assignedIds = (accesses || []).map(a => a.building_id);
    const availableBuildings = globalBuildings.filter(b => !assignedIds.includes(b.id));
    
    if(DOM.accessModalSelect) {
       DOM.accessModalSelect.innerHTML = `<option value="">Select a property to assign...</option>` + availableBuildings.map(b => `<option value="${b.id}">${b.building_code} - ${b.address_line_1.split(',')[0]}</option>`).join('');
    }

    if(DOM.accessModalList) {
       DOM.accessModalList.innerHTML = '';
       if (!accesses || accesses.length === 0) {
           DOM.accessModalList.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--muted-foreground); font-size:12px;">No properties assigned to this user.</div>`;
       } else {
           accesses.forEach(acc => {
               if(!acc.buildings) return;
               const html = `
               <div class="archive-item" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--surface);">
                  <div class="archive-details">
                     <div style="font-size:12px; font-weight:500;">${acc.buildings.building_code} - ${acc.buildings.address_line_1.split(',')[0]}</div>
                  </div>
                  <button type="button" class="btn-remove-access" data-bid="${acc.building_id}" style="background:transparent; border:none; color:var(--status-review); cursor:pointer; padding:0.25rem;" title="Revoke Access">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
               </div>`;
               DOM.accessModalList.insertAdjacentHTML('beforeend', html);
           });
           
           DOM.accessModalList.querySelectorAll('.btn-remove-access').forEach(btn => {
               btn.addEventListener('click', async () => {
                  const bid = btn.getAttribute('data-bid');
                  btn.disabled = true; btn.style.opacity = '0.5';
                  await supabase.from('user_property_access').delete().eq('user_id', activeAccessUser.memberstack_id).eq('building_id', bid);
                  
                  if (activeAccessUser.building_id === bid) {
                      await supabase.from('profiles').update({ building_id: null }).eq('id', activeAccessUser.id);
                      activeAccessUser.building_id = null;
                  }
                  showToast('Access revoked'); openAccessModal(activeAccessUser); 
               });
           });
       }
    }
  };

  const autoSaveData = async (table, colIdName, id, payload, elementToFlash) => {
    if (!id || id === 'new') return; 
    if(elementToFlash) elementToFlash.classList.add('saving');
    await supabase.from(table).update(payload).eq(colIdName, id);
    if(elementToFlash) setTimeout(() => elementToFlash.classList.remove('saving'), 500);
  };

  const bindAutoSave = (container, table, colIdName) => {
    container.querySelectorAll('input:not([disabled]), select, textarea').forEach(input => { 
      input.addEventListener('change', (e) => { 
        const p = {}; p[e.target.getAttribute('data-col')] = e.target.value || null; 
        autoSaveData(table, colIdName, e.target.getAttribute('data-id'), p, e.target.closest('.card-surface, .pathway-row')); 
      }); 
    });
  };

  const generateStatusOptions = (currentStatus) => { 
      const s = (currentStatus || '').toLowerCase().replace(/\s/g, '');
      let standardizedVal = s;
      if (s === 'closed') standardizedVal = 'stable';
      if (s === 'measured') standardizedVal = 'monitor'; // JOE RULING 18 Aug 2026: measured renders as Monitor
      if (s === 'unknown' || s === 'actionrequired' || s === 'verificationrequired') standardizedVal = 'review';
      
      return `
      <option value="stable" ${standardizedVal === 'stable' ? 'selected' : ''}>Stable</option>
      <option value="monitor" ${standardizedVal === 'monitor' ? 'selected' : ''}>Monitor</option>
      <option value="risk" ${standardizedVal === 'risk' || standardizedVal === 'atrisk' ? 'selected' : ''}>At Risk</option>
      <option value="review" ${standardizedVal === 'review' ? 'selected' : ''}>Further Investigation Required</option>
      `;
  };

  const generateSessionOptions = (sessions, currentSessId) => {
      let html = `<option value="">Unlinked / Ongoing</option>`;
      if(sessions) {
          sessions.forEach(s => {
              const d = s.assessment_date ? new Date(s.assessment_date).toLocaleDateString('en-GB') : 'No Date';
              html += `<option value="${s.assessment_id}" ${s.assessment_id === currentSessId ? 'selected' : ''}>${s.assessment_type} (${d})</option>`;
          });
      }
      return html;
  };

  const renderAssessments = (sessions) => {
    if(!DOM.assessmentsContainer) return; DOM.assessmentsContainer.innerHTML = '';
    sessions.forEach(s => {
      let dateVal = ''; if (s.assessment_date) { const d = new Date(s.assessment_date); dateVal = d.toISOString().split('T')[0]; }
      const cardHTML = `<div class="card-surface" id="sess-${s.assessment_id}"><div class="card-header"><div class="card-title">Assessment Session</div><button class="btn-del-record" data-table="assessment_sessions" data-colid="assessment_id" data-id="${s.assessment_id}" style="background:transparent;border:none;color:var(--status-review);cursor:pointer;padding:0.25rem;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div><div class="metrics-input-grid"><select class="control-select" data-table="assessment_sessions" data-id="${s.assessment_id}" data-col="assessment_type"><option value="Home Performance Baseline" ${s.assessment_type === 'Home Performance Baseline' ? 'selected' : ''}>Baseline Check</option><option value="90-Day Stability Check" ${s.assessment_type === '90-Day Stability Check' ? 'selected' : ''}>90-Day Check</option><option value="Triggered Event Check" ${s.assessment_type === 'Triggered Event Check' ? 'selected' : ''}>Triggered Event</option><option value="Verification" ${s.assessment_type === 'Verification' ? 'selected' : ''}>Verification</option></select><select class="control-select" data-table="assessment_sessions" data-id="${s.assessment_id}" data-col="status"><option value="Scheduled" ${s.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option><option value="In Progress" ${s.status === 'In Progress' ? 'selected' : ''}>In Progress</option><option value="Completed" ${s.status === 'Completed' ? 'selected' : ''}>Completed</option></select></div><div class="metrics-input-grid"><input class="control-input" placeholder="Assessor Name" value="${s.assessor || ''}" data-table="assessment_sessions" data-id="${s.assessment_id}" data-col="assessor"><input type="date" class="control-input" value="${dateVal}" data-table="assessment_sessions" data-id="${s.assessment_id}" data-col="assessment_date" title="Assessment Date"></div><textarea rows="2" class="control-textarea" placeholder="Baseline notes / Weather conditions..." data-table="assessment_sessions" data-id="${s.assessment_id}" data-col="baseline_notes">${s.baseline_notes || ''}</textarea></div>`;
      DOM.assessmentsContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
    bindAutoSave(DOM.assessmentsContainer, 'assessment_sessions', 'assessment_id');
    bindDeleteBtns(DOM.assessmentsContainer);
  };

  const renderIssues = (issues) => {
    if(!DOM.issuesContainer) return; DOM.issuesContainer.innerHTML = '';
    const roomOpts = `<option value="">Entire Property (Global)</option>` + currentRooms.map(r => `<option value="${r.id}">${r.room_name_current}</option>`).join('');

    issues.forEach(i => {
      const rSelected = i.room_id ? roomOpts.replace(`value="${i.room_id}"`, `value="${i.room_id}" selected`) : roomOpts;
      
      const s = (i.status || '').toLowerCase().replace(/\s/g, '');
      let standardizedVal = s;
      if (s === 'closed') standardizedVal = 'stable';
      if (s === 'measured') standardizedVal = 'monitor'; // JOE RULING 18 Aug 2026: measured renders as Monitor
      if (s === 'unknown' || s === 'actionrequired' || s === 'verificationrequired') standardizedVal = 'review';
      if (s === 'atrisk') standardizedVal = 'risk';

      const cardHTML = `<div class="card-surface" id="issue-${i.issue_id}"><div class="card-header"><div class="card-title">Diagnostic Finding</div><button class="btn-del-record" data-table="issues_findings" data-colid="issue_id" data-id="${i.issue_id}" style="background:transparent;border:none;color:var(--status-review);cursor:pointer;padding:0.25rem;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div><div class="metrics-input-grid"><input class="control-input" placeholder="Issue Title" value="${i.issue_type || ''}" data-table="issues_findings" data-id="${i.issue_id}" data-col="issue_type"><select class="control-select" data-table="issues_findings" data-id="${i.issue_id}" data-col="status"><option value="Stable" ${standardizedVal === 'stable' ? 'selected' : ''}>Stable</option><option value="Monitor" ${standardizedVal === 'monitor' ? 'selected' : ''}>Monitor</option><option value="At Risk" ${standardizedVal === 'risk' ? 'selected' : ''}>At Risk</option><option value="Further Investigation Required" ${standardizedVal === 'review' ? 'selected' : ''}>Further Investigation Required</option></select></div><div class="metrics-input-grid"><select class="control-select" data-table="issues_findings" data-id="${i.issue_id}" data-col="severity"><option value="" ${!i.severity ? 'selected' : ''}>Select Severity...</option><option value="Low" ${i.severity === 'Low' ? 'selected' : ''}>Low</option><option value="Medium" ${i.severity === 'Medium' ? 'selected' : ''}>Medium</option><option value="High" ${i.severity === 'High' ? 'selected' : ''}>High</option><option value="Critical" ${i.severity === 'Critical' ? 'selected' : ''}>Critical</option></select><select class="control-select" data-table="issues_findings" data-id="${i.issue_id}" data-col="room_id">${rSelected}</select></div><input class="control-input" placeholder="Recommended Action" value="${i.recommended_action || ''}" data-table="issues_findings" data-id="${i.issue_id}" data-col="recommended_action"><textarea rows="2" class="control-textarea" placeholder="Client facing finding description (e.g. U-value measured at X W/m2K...)" data-table="issues_findings" data-id="${i.issue_id}" data-col="client_facing_wording">${i.client_facing_wording || ''}</textarea></div>`;
      DOM.issuesContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
    bindAutoSave(DOM.issuesContainer, 'issues_findings', 'issue_id');
    bindDeleteBtns(DOM.issuesContainer);
  };

  const bindDeleteBtns = (container) => {
    container.querySelectorAll('.btn-del-record').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id'); const table = btn.getAttribute('data-table'); const col = btn.getAttribute('data-colid');
        if(confirm("Permanently delete this record?")) {
           btn.disabled = true;
           await supabase.from(table).delete().eq(col, id);
           showToast('Record deleted'); loadAssetContext(currentBuildingId);
        }
      });
    });
  };

  const renderTelemetryEditor = (measurements, sessions) => {
    if(!DOM.telemetryContainer) return; DOM.telemetryContainer.innerHTML = '';
    ['ENVELOPE', 'U-VALUE', 'MOISTURE', 'CO2', 'READINESS', 'PRIORITY', 'ACH50', 'ELA', 'THERMAL_BRIDGE'].forEach(code => {
      const m = measurements.find(x => x.measurement_points?.element_code === code); if (!m) return;
      const cardHTML = `<div class="card-surface" id="card-${m.id}"><div class="card-header"><div class="card-title">${code.replace(/-/g, ' ')} Metric</div><span class="status-badge status-${m.status_flag}"><span class="badge-dot"></span>${m.status_flag === 'measured' ? 'monitor' : m.status_flag}</span></div><div class="metrics-input-grid"><select class="control-select" data-table="measurements" data-id="${m.id}" data-col="status_flag">${generateStatusOptions(m.status_flag)}</select><input class="control-input" value="${m.value}" data-table="measurements" data-id="${m.id}" data-col="value"></div><div class="metrics-input-grid" style="grid-template-columns:1fr;"><select class="control-select" data-table="measurements" data-id="${m.id}" data-col="assessment_id" style="color:var(--status-measured)">${generateSessionOptions(sessions, m.assessment_id)}</select></div><textarea rows="2" class="control-textarea" data-table="measurements" data-id="${m.id}" data-col="client_facing_wording">${m.client_facing_wording || ''}</textarea></div>`;
      DOM.telemetryContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
    bindAutoSave(DOM.telemetryContainer, 'measurements', 'id');
  };

  const renderTwinEditor = (rooms, measurements, sessions) => {
    if(!DOM.twinNodesContainer) return; DOM.twinNodesContainer.innerHTML = '';
    rooms.forEach(room => {
      const roomMs = measurements.filter(x => x.room_id === room.id || (x.measurement_points && x.measurement_points.room_id === room.id));
      const overallM = roomMs.find(x => x.status_flag === 'risk' || x.status_flag === 'review') || roomMs[0] || { status_flag: 'unknown', id: 'new' };
      const getValInput = (code) => { let sm = roomMs.find(x => x.measurement_points?.element_code === code); if(!sm && code === 'RH') sm = roomMs.find(x => x.measurement_points?.element_code === 'MOISTURE'); if(!sm) return `<input class="control-input tabular" disabled placeholder="-" title="No sensor assigned">`; return `<input step="any" class="control-input tabular" type="number" value="${sm.value}" data-table="measurements" data-id="${sm.id}" data-col="value">`; };
      
      const cardHTML = `<div class="card-surface" id="card-${room.id}"><div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">${room.room_name_current}<select class="control-select" style="width: auto; padding: 0.25rem;" data-table="measurements" data-id="${overallM.id}" data-col="status_flag">${generateStatusOptions(overallM.status_flag)}</select></div><div class="metrics-input-grid" style="grid-template-columns:1fr; margin-bottom:0.25rem;"><select class="control-select room-session-select" data-room="${room.id}" style="color:var(--status-measured)">${generateSessionOptions(sessions, overallM.assessment_id)}</select></div><div class="node-input-grid"><label><div class="eyebrow" style="margin-bottom: 0.25rem;">RH%</div>${getValInput('RH')}</label><label><div class="eyebrow" style="margin-bottom: 0.25rem;">CO₂</div>${getValInput('CO2')}</label><label><div class="eyebrow" style="margin-bottom: 0.25rem;">VOC</div>${getValInput('VOC')}</label></div><textarea rows="2" class="control-textarea" data-table="rooms" data-id="${room.id}" data-col="notes" placeholder="Analyst Notes for this room...">${room.notes || ''}</textarea></div>`;
      DOM.twinNodesContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
    bindAutoSave(DOM.twinNodesContainer, 'rooms', 'id');
    
    DOM.twinNodesContainer.querySelectorAll('input[data-table="measurements"], select[data-table="measurements"]').forEach(input => { 
      input.addEventListener('change', (e) => { 
        const p = {}; p[e.target.getAttribute('data-col')] = e.target.value; 
        autoSaveData('measurements', 'id', e.target.getAttribute('data-id'), p, e.target.closest('.card-surface')); 
      }); 
    });

    DOM.twinNodesContainer.querySelectorAll('.room-session-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const sessId = e.target.value || null;
            const rId = e.target.getAttribute('data-room');
            const toUpdate = measurements.filter(x => x.room_id === rId);
            for (let m of toUpdate) { await supabase.from('measurements').update({ assessment_id: sessId }).eq('id', m.id); }
            showToast('Linked room to session');
        });
    });
  };

  const renderPathwayEditor = (scenarios) => {
    if(!DOM.pathwayContainer) return; DOM.pathwayContainer.innerHTML = '';
    scenarios.forEach(scen => {
      const cardHTML = `<div class="pathway-row" id="row-${scen.id}"><div class="pathway-title"><span class="font-mono text-muted-foreground" style="font-size: 10px; text-transform: uppercase; letter-spacing: var(--tracking-widest); margin-right: 0.5rem;">Phase 0${scen.phase}</span>${scen.title}</div><select class="control-select" data-table="upgrade_scenarios" data-id="${scen.id}" data-col="status"><option value="completed" ${scen.status === 'completed' ? 'selected' : ''}>Completed</option><option value="in-progress" ${scen.status === 'in-progress' ? 'selected' : ''}>In Progress</option><option value="locked" ${scen.status === 'locked' ? 'selected' : ''}>Locked Phase</option></select></div>`;
      DOM.pathwayContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
    bindAutoSave(DOM.pathwayContainer, 'upgrade_scenarios', 'id');
  };

  const init = async () => {
    injectAccessModal();

    DOM.assetSelect = document.getElementById('asset-select');
    DOM.assetCount = document.getElementById('asset-count');
    DOM.editorsWrap = document.getElementById('admin-editors-wrap');
    DOM.emptyStateContainer = document.getElementById('empty-state-container');
    DOM.btnInitializeAsset = document.getElementById('btnInitializeAsset');
    DOM.telemetryContainer = document.getElementById('telemetry-container');
    DOM.twinNodesContainer = document.getElementById('twin-nodes-container');
    DOM.pathwayContainer = document.getElementById('pathway-container');
    DOM.reportInput = document.getElementById('report-upload-input');
    DOM.uploadStatusText = document.getElementById('upload-status-text');
    DOM.archiveCount = document.getElementById('archive-count');
    DOM.uploadTargetRoom = document.getElementById('upload-target-room');
    DOM.btnUserManagement = document.getElementById('btnUserManagement');
    DOM.usersModal = document.getElementById('jbUsersModal');
    DOM.closeUsersModal = document.getElementById('closeUsersModal');
    DOM.usersTableBody = document.getElementById('usersTableBody');
    DOM.uploadClientVisible = document.getElementById('upload-client-visible');
    DOM.desktopSidebarAsset = document.getElementById('desktopSidebarAsset');
    DOM.desktopHeaderAsset = document.getElementById('desktopHeaderAsset');
    DOM.desktopSidebarMeta = document.getElementById('desktopSidebarMeta') || document.querySelector('.sidebar-footer .text-muted-foreground');
    
    DOM.accessModal = document.getElementById('jbUserAccessModal');
    DOM.closeUserAccessModal = document.getElementById('closeUserAccessModal');
    DOM.accessModalTitle = document.getElementById('accessModalTitle');
    DOM.accessModalSelect = document.getElementById('accessModalSelect');
    DOM.accessModalList = document.getElementById('accessModalList');
    DOM.btnAccessAssign = document.getElementById('btnAccessAssign');

    const headerTabs = document.querySelectorAll('.header-telemetry-cluster .tabular');
    DOM.headerClimateText = headerTabs[1] || null;
    DOM.headerSysText = headerTabs[2] || null;
    
    DOM.assessmentsContainer = document.getElementById('assessments-container');
    DOM.issuesContainer = document.getElementById('issues-container');
    DOM.btnNewAssessment = document.getElementById('btnNewAssessment');
    DOM.btnNewIssue = document.getElementById('btnNewIssue');

    toggleSkeletonState(true); 
    initUIEvents();
    
    if (!window.supabase) return; 

    try { 
      const memberReq = await window.$memberstackDom.getCurrentMember();
      if (memberReq && memberReq.data && memberReq.data.customFields && memberReq.data.customFields['supabase-jwt']) {
          jwtToken = memberReq.data.customFields['supabase-jwt'];
      }
    } catch(e) { console.warn("No Supabase token found"); }

    const options = { global: { headers: jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {} } };
    if (jwtToken) { options.accessToken = async () => jwtToken; }
    
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);

    try { const profile = await authenticateAdmin(); if (profile) await loadGlobalAssets(); } catch (error) { console.error(error); window.location.href = '/login'; }
  };
  return { init };
})();

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', JoeBuildsAdmin.init); } else { JoeBuildsAdmin.init(); }
