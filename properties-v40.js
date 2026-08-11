/**
 * Joe Builds - Properties Registry Controller (v40 - Standard Auth Header)
 */
console.log("JB Properties Controller v40 initializing...");
const JoeBuildsProperties = (() => {
  const SUPABASE_URL = 'https://jsqyfiwkbuvuajwzbjhd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_xla-awjgU2npKzrWHdYKDQ_2ox0CWmC';
  let supabase, currentBuildingContext = null, jwtToken = '';
  let currentBuildingRooms = [];
  let currentUserRole = null;
  let DOM = {};
  const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

  const showToast = (message, type = 'success') => { const toast = document.createElement('div'); const color = type === 'success' ? 'var(--status-stable, #3A6B48)' : 'var(--status-review, #A64444)'; toast.style.cssText = `position: fixed; bottom: 24px; right: 24px; background: var(--surface, #FFF); color: var(--foreground, #1A241D); border-left: 4px solid ${color}; padding: 12px 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); font-family: var(--font-mono, monospace); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; z-index: 999999; transform: translateX(120%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 8px;`; const icon = type === 'success' ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>` : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`; toast.innerHTML = `${icon} <span>${message}</span>`; document.body.appendChild(toast); requestAnimationFrame(() => toast.style.transform = 'translateX(0)'); setTimeout(() => { toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 300); }, 3000); };
  
  const toggleSkeletonState = (isLoading) => { 
      try { 
          const elementsToToggle = [DOM.sidebarAssetTitle, DOM.detailEyebrow, DOM.detailTitle, DOM.detailAddress, DOM.detailStatus]; 
          elementsToToggle.forEach(el => { 
              if (el) { 
                  if (isLoading) el.classList.add('jb-skeleton-block'); 
                  else el.classList.remove('jb-skeleton-block'); 
              }
          }); 
          if (isLoading && DOM.propertyGrid && DOM.views && DOM.views.registry && !DOM.views.registry.classList.contains('jb-hidden')) { 
              DOM.propertyGrid.innerHTML = `<div class="property-card jb-skeleton-block" style="height: 180px;"></div><div class="property-card jb-skeleton-block" style="height: 180px;"></div>`; 
          } 
      } catch(err) { console.warn("Skeleton toggle warning:", err); } 
  };

  const authenticateOperator = async () => {
    const member = await window.$memberstackDom.getCurrentMember(); if (!member || !member.data) { window.location.href = '/login'; return null; }
    const { data: profile, error } = await supabase.from('profiles').select('id, role').eq('memberstack_id', member.data.id).single();
    if (error || !profile) { window.location.href = '/login'; return null; }
    currentUserRole = profile.role || 'client';
    if (currentUserRole === 'client' || currentUserRole === 'demo' || currentUserRole === 'suspended') { window.location.href = '/dashboard'; return null; }
    return profile;
  };

  const switchView = (viewName) => {
    if(!DOM.views) return; Object.values(DOM.views).forEach(el => { if(el) el.classList.add('jb-hidden'); });
    if(DOM.views[viewName]) DOM.views[viewName].classList.remove('jb-hidden'); window.scrollTo({ top: 0, behavior: "smooth" });
    if (viewName === 'registry' || viewName === 'newForm') { if(DOM.sidebarAssetTitle) DOM.sidebarAssetTitle.textContent = "Property Register"; if(DOM.headerTelemetry) DOM.headerTelemetry.innerHTML = `<div class="telemetry-node"><span class="eyebrow text-muted-foreground">SCOPE</span><span class="tabular">All Managed Properties</span></div>`; }
  };

  const updateDatalist = (id, items, defaults) => { const dl = document.getElementById(id); if(dl) { const combined = [...new Set([...defaults, ...items])].filter(Boolean); dl.innerHTML = combined.map(i => `<option value="${i}">`).join(''); } };

  const applyComboboxUX = (inputElement) => {
    if (!inputElement || inputElement.dataset.cbAttached) return;
    inputElement.dataset.cbAttached = 'true';
    inputElement.addEventListener('focus', function() { this.setAttribute('data-old-val', this.value); this.value = ''; });
    inputElement.addEventListener('blur', function() { if (this.value.trim() === '') this.value = this.getAttribute('data-old-val') || ''; });
  };

  const fixEditModalDropdowns = () => {
    const editFields = [ { id: 'edit-state', list: 'state-options' }, { id: 'edit-status', list: 'status-options' }, { id: 'edit-property-type', list: 'type-options' } ];
    editFields.forEach(field => {
      const el = document.getElementById(field.id);
      if (el && el.tagName === 'SELECT') {
        const input = document.createElement('input');
        input.type = 'text'; input.id = field.id; input.className = 'control-input';
        input.setAttribute('list', field.list); input.value = el.value;
        if (el.parentElement) el.parentElement.classList.add('select-wrap');
        el.parentNode.replaceChild(input, el);
        applyComboboxUX(input);
      } else if (el && el.tagName === 'INPUT') { applyComboboxUX(el); }
    });
    ['input-state', 'input-status', 'input-property-type'].forEach(id => applyComboboxUX(document.getElementById(id)));
  };

  const handleNewPropertySubmit = async () => {
    if(DOM.btnSubmitProperty) { DOM.btnSubmitProperty.textContent = 'Saving...'; DOM.btnSubmitProperty.disabled = true; }
    const payload = { building_code: document.getElementById('input-building-code').value, address_line_1: document.getElementById('input-address').value, state: document.getElementById('input-state').value, status: document.getElementById('input-status').value, property_type: document.getElementById('input-property-type').value };
    const { error } = await supabase.from('buildings').insert(payload).select().single();
    if(DOM.btnSubmitProperty) { DOM.btnSubmitProperty.textContent = 'Register Property'; DOM.btnSubmitProperty.disabled = false; }
    if(!error) { document.getElementById('form-new-property').reset(); currentBuildingContext = null; switchView('registry'); await fetchAndRenderBuildings(); showToast('Property registered successfully'); } else { showToast('Error creating property', 'error'); }
  };

  const openEditPropertyModal = () => {
    if(!currentBuildingContext) return;
    document.getElementById('edit-building-code').value = currentBuildingContext.building_code || ''; 
    document.getElementById('edit-address').value = currentBuildingContext.address_line_1 || ''; 
    document.getElementById('edit-state').value = currentBuildingContext.state || ''; 
    document.getElementById('edit-status').value = currentBuildingContext.status || ''; 
    const propTypeInput = document.getElementById('edit-property-type');
    if (propTypeInput) propTypeInput.value = currentBuildingContext.property_type || '';

    const form = document.getElementById('formEditProperty');
    if (form && !document.getElementById('btnDeleteProperty') && currentUserRole === 'admin') {
      const delBtn = document.createElement('button');
      delBtn.id = 'btnDeleteProperty'; delBtn.type = 'button'; delBtn.className = 'btn-secondary';
      delBtn.style.cssText = 'margin-top: 0.75rem; width: 100%; color: var(--status-review); border-color: var(--status-review); background: transparent; transition: background 0.2s;';
      delBtn.textContent = 'Delete Property';
      delBtn.onmouseover = () => delBtn.style.background = 'rgba(166, 68, 68, 0.05)'; delBtn.onmouseout = () => delBtn.style.background = 'transparent';
      form.appendChild(delBtn);
      delBtn.addEventListener('click', async () => {
        const confirmDelete = confirm(`Are you absolutely sure you want to delete ${currentBuildingContext.building_code}? This will permanently destroy all rooms, measurements, and milestones associated with it.`);
        if (confirmDelete) {
          delBtn.textContent = 'Deleting...'; delBtn.disabled = true;
          const { error } = await supabase.from('buildings').delete().eq('id', currentBuildingContext.id);
          if (!error) { showToast('Property permanently deleted'); if(DOM.modalEditProperty) DOM.modalEditProperty.classList.add('jb-hidden'); currentBuildingContext = null; switchView('registry'); fetchAndRenderBuildings(); } else { showToast('Error deleting property', 'error'); delBtn.textContent = 'Delete Property'; delBtn.disabled = false; }
        }
      });
    }
    if(DOM.modalEditProperty) DOM.modalEditProperty.classList.remove('jb-hidden');
  };

  const handleSaveProperty = async () => {
    if(!currentBuildingContext) return;
    if(DOM.btnSaveProperty) { DOM.btnSaveProperty.textContent = 'Saving...'; DOM.btnSaveProperty.disabled = true; }
    const propTypeInput = document.getElementById('edit-property-type');
    const payload = { building_code: document.getElementById('edit-building-code').value, address_line_1: document.getElementById('edit-address').value, state: document.getElementById('edit-state').value, status: document.getElementById('edit-status').value, property_type: propTypeInput ? propTypeInput.value : '' };
    const { error } = await supabase.from('buildings').update(payload).eq('id', currentBuildingContext.id);
    if(DOM.btnSaveProperty) { DOM.btnSaveProperty.textContent = 'Save Changes'; DOM.btnSaveProperty.disabled = false; }
    if(DOM.modalEditProperty) DOM.modalEditProperty.classList.add('jb-hidden');
    if(!error) { 
      currentBuildingContext = { ...currentBuildingContext, ...payload }; openPropertyDetail(currentBuildingContext); showToast('Property updated successfully');
      supabase.from('buildings').select('*').then(({data}) => { if(data) { updateDatalist('state-options', data.map(b => b.state), AU_STATES); updateDatalist('status-options', data.map(b => b.status), ['Baseline Pending', 'Monitoring', 'Baseline Complete']); updateDatalist('type-options', data.map(b => b.property_type), ['Residential', 'Commercial', 'Passive House']); } });
    } else { showToast('Error updating property', 'error'); }
  };

  const bindMapClick = () => {
    if (!DOM.mapContainer) return; DOM.mapContainer.addEventListener('click', (e) => {
      const rect = DOM.mapContainer.getBoundingClientRect(); let x = ((e.clientX - rect.left) / rect.width) * 100; let y = ((e.clientY - rect.top) / rect.height) * 100; x = Math.round(x * 10) / 10; y = Math.round(y * 10) / 10;
      document.getElementById('edit-room-x').value = x; document.getElementById('edit-room-y').value = y; if (DOM.mapCoordsText) DOM.mapCoordsText.textContent = `Node set at: X ${x}%, Y ${y}%`;
      let activePin = document.getElementById('modal-active-pin'); if (!activePin) { activePin = document.createElement('div'); activePin.id = 'modal-active-pin'; activePin.className = 'modal-map-pin active'; DOM.mapPins.appendChild(activePin); } activePin.style.left = `${x}%`; activePin.style.top = `${y}%`;
    });
  };

  const openRoomModal = (id = null, code = '', name = '', x = '', y = '') => {
    if(DOM.roomModalTitle) DOM.roomModalTitle.textContent = id ? "Edit Node" : "Add Node";
    document.getElementById('edit-room-id').value = id || ''; document.getElementById('edit-room-code').value = code; document.getElementById('edit-room-name').value = name; document.getElementById('edit-room-x').value = x || ''; document.getElementById('edit-room-y').value = y || '';
    if (DOM.mapCoordsText) DOM.mapCoordsText.textContent = (x && y) ? `Node set at: X ${x}%, Y ${y}%` : "Click map to set location";

    const form = document.getElementById('formRoomManage');
    let delBtn = document.getElementById('btnDeleteRoom');
    if (id && currentUserRole === 'admin') {
      if (!delBtn) {
        delBtn = document.createElement('button'); delBtn.id = 'btnDeleteRoom'; delBtn.type = 'button'; delBtn.className = 'btn-secondary';
        delBtn.style.cssText = 'margin-top: 0.5rem; width: 100%; color: var(--status-review); border-color: var(--status-review); background: transparent; transition: background 0.2s;';
        delBtn.textContent = 'Delete Spatial Node';
        delBtn.onmouseover = () => delBtn.style.background = 'rgba(166, 68, 68, 0.05)'; delBtn.onmouseout = () => delBtn.style.background = 'transparent';
        form.appendChild(delBtn);
      }
      delBtn.style.display = 'block';
      delBtn.onclick = async () => {
        const confirmDelete = confirm(`Are you sure you want to delete ${name}? This will permanently remove its sensors and history.`);
        if (confirmDelete) {
          delBtn.textContent = 'Deleting...'; delBtn.disabled = true;
          const { error } = await supabase.from('rooms').delete().eq('id', id);
          if (!error) { showToast('Spatial node deleted'); if(DOM.modalRoomManage) DOM.modalRoomManage.classList.add('jb-hidden'); fetchBuildingDetails(currentBuildingContext.id); } 
          else { showToast('Error deleting node', 'error'); }
          delBtn.textContent = 'Delete Spatial Node'; delBtn.disabled = false;
        }
      };
    } else { if (delBtn) delBtn.style.display = 'none'; }

    if (DOM.mapPins) {
      DOM.mapPins.innerHTML = ''; currentBuildingRooms.forEach(r => { if (r.id === id) return; if (r.map_x != null && r.map_y != null) { const pin = document.createElement('div'); pin.className = 'modal-map-pin existing'; pin.style.left = `${r.map_x}%`; pin.style.top = `${r.map_y}%`; pin.title = r.room_name_current; DOM.mapPins.appendChild(pin); } }); if (x && y) { const activePin = document.createElement('div'); activePin.id = 'modal-active-pin'; activePin.className = 'modal-map-pin active'; activePin.style.left = `${x}%`; activePin.style.top = `${y}%`; DOM.mapPins.appendChild(activePin); }
    }
    if(DOM.modalRoomManage) DOM.modalRoomManage.classList.remove('jb-hidden');
  };

  const handleSaveRoom = async () => {
    if(!currentBuildingContext) return;
    if(DOM.btnSaveRoom) { DOM.btnSaveRoom.textContent = 'Saving...'; DOM.btnSaveRoom.disabled = true; }
    const roomId = document.getElementById('edit-room-id')?.value; const xVal = document.getElementById('edit-room-x')?.value; const yVal = document.getElementById('edit-room-y')?.value;
    const payload = { room_code: document.getElementById('edit-room-code')?.value, room_name_current: document.getElementById('edit-room-name')?.value, map_x: (xVal === '' || !xVal) ? null : Number(xVal), map_y: (yVal === '' || !yVal) ? null : Number(yVal) };
    if (roomId) { await supabase.from('rooms').update(payload).eq('id', roomId); } else { const { data: newRoom } = await supabase.from('rooms').insert({ building_id: currentBuildingContext.id, ...payload }).select().single(); if (newRoom) { const { data: pts } = await supabase.from('measurement_points').insert([ { building_id: currentBuildingContext.id, room_id: newRoom.id, element_code: 'RH' }, { building_id: currentBuildingContext.id, room_id: newRoom.id, element_code: 'CO2' }, { building_id: currentBuildingContext.id, room_id: newRoom.id, element_code: 'VOC' } ]).select(); if (pts) { const mInserts = pts.map(pt => ({ building_id: currentBuildingContext.id, measurement_point_id: pt.id, room_id: newRoom.id, status_flag: 'unknown', value: 0 })); await supabase.from('measurements').insert(mInserts); } } }
    if(DOM.btnSaveRoom) { DOM.btnSaveRoom.textContent = 'Save Node'; DOM.btnSaveRoom.disabled = false; }
    if(DOM.modalRoomManage) DOM.modalRoomManage.classList.add('jb-hidden'); showToast('Spatial node saved'); await fetchBuildingDetails(currentBuildingContext.id); 
  };

  const handleFileUpload = async (e) => {
    if (!currentBuildingContext || !jwtToken) return; 
    const file = e.target.files[0]; if (!file) return;

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('File exceeds 50MB limit', 'error');
        if(DOM.fileInput) DOM.fileInput.value = '';
        return;
    }

    const targetRoomId = DOM.uploadTargetRoom ? DOM.uploadTargetRoom.value : null;
    const isClientVisible = DOM.uploadClientVisible ? DOM.uploadClientVisible.checked : true;
    const fileExt = file.name.split('.').pop().toLowerCase();

    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExt);
    const isDoc = ['pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx'].includes(fileExt);

    let bucket = ''; let table = ''; let insertPayload = {};

    if (targetRoomId) {
        if (!isImage) { showToast('Room Evidence MUST be an image file (JPG/PNG)', 'error'); DOM.fileInput.value = ''; return; }
        bucket = 'property_assets'; table = 'evidence_assets';
        insertPayload = { building_id: currentBuildingContext.id, room_id: targetRoomId, file_name: file.name, client_visible: isClientVisible };
    } else {
        if (!isDoc) { showToast('Reports MUST be a document file (PDF/CSV)', 'error'); DOM.fileInput.value = ''; return; }
        bucket = 'reports'; table = 'reports';
        insertPayload = { building_id: currentBuildingContext.id, report_title: file.name, report_type: fileExt.toUpperCase(), client_visible: isClientVisible };
    }

    if(DOM.uploadStatusText) DOM.uploadStatusText.textContent = `Uploading ${file.name}...`;
    const fileName = `${currentBuildingContext.id}/${Date.now()}.${fileExt}`;
    
    try {
      const formData = new FormData();
      formData.append('action', 'upload');
      formData.append('file', file);
      formData.append('bucket', bucket);
      formData.append('path', fileName);

      // NATIVE FETCH PROXY UPLOAD
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
      showToast('File uploaded successfully'); 
      fetchBuildingDetails(currentBuildingContext.id);
      if(DOM.fileInput) DOM.fileInput.value = '';
    } catch(err) {
      console.error(err);
      if(DOM.uploadStatusText) DOM.uploadStatusText.textContent = `Drop or click to upload`; 
      showToast('Upload failed: ' + (err.message || 'Server Error'), 'error'); 
      if(DOM.fileInput) DOM.fileInput.value = '';
    }
  };

  const bindUIEvents = () => {
    document.getElementById('btn-create-new')?.addEventListener('click', () => switchView('newForm'));
    document.querySelectorAll('.btn-back').forEach(btn => { btn.addEventListener('click', () => { currentBuildingContext = null; switchView('registry'); fetchAndRenderBuildings(); }); });
    if(DOM.formNewProperty) DOM.formNewProperty.addEventListener('submit', async (e) => { e.preventDefault(); await handleNewPropertySubmit(); });
    if(DOM.btnOpenEditProperty) DOM.btnOpenEditProperty.addEventListener('click', openEditPropertyModal);
    if(DOM.closeEditProperty) DOM.closeEditProperty.addEventListener('click', () => { if(DOM.modalEditProperty) DOM.modalEditProperty.classList.add('jb-hidden'); });
    if(DOM.formEditProperty) DOM.formEditProperty.addEventListener('submit', async (e) => { e.preventDefault(); await handleSaveProperty(); });
    if(DOM.btnOpenAddRoom) DOM.btnOpenAddRoom.addEventListener('click', () => openRoomModal());
    if(DOM.closeRoomModal) DOM.closeRoomModal.addEventListener('click', () => { if(DOM.modalRoomManage) DOM.modalRoomManage.classList.add('jb-hidden'); });
    if(DOM.formRoomManage) DOM.formRoomManage.addEventListener('submit', async (e) => { e.preventDefault(); await handleSaveRoom(); });
    if(DOM.fileInput) DOM.fileInput.addEventListener('change', handleFileUpload);
    bindMapClick();
  };

  const fetchAndRenderBuildings = async () => {
    toggleSkeletonState(true);
    try {
      const { data: buildings, error } = await supabase.from('buildings').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      if (!buildings || buildings.length === 0) { 
          if(DOM.propertyGrid) DOM.propertyGrid.innerHTML = `<div style="padding:3rem; text-align:center; color:var(--muted-foreground); border: 1px dashed var(--border); font-size:13px;">No properties found. Please create one to initialize the registry.</div>`; 
          toggleSkeletonState(false); 
          return; 
      }
      
      updateDatalist('state-options', buildings.map(b => b.state), AU_STATES); 
      updateDatalist('status-options', buildings.map(b => b.status), ['Baseline Pending', 'Monitoring', 'Baseline Complete']); 
      updateDatalist('type-options', buildings.map(b => b.property_type), ['Residential', 'Commercial', 'Passive House']);
      
      if(DOM.propertyGrid) DOM.propertyGrid.innerHTML = '';
      
      buildings.forEach(b => {
        const html = `<button class="property-card" data-id="${b.id}"><div class="property-card-header"><div class="eyebrow">${b.building_code || 'N/A'}</div><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground" style="height:.875rem;width:.875rem"><path d="m9 18 6-6-6-6"></path></svg></div><div class="property-card-title">${b.address_line_1 || 'No Address'}</div><div class="property-card-meta"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="height:.75rem;width:.75rem"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg> ${b.suburb || ''} ${b.state || ''}</div><div class="card-stats-grid"><div class="card-stat-block"><div class="eyebrow" style="font-size:8px;margin-bottom:.125rem">Status</div><div class="font-mono tabular" style="font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.status || 'Pending'}</div></div><div class="card-stat-block" style="grid-column: span 2;"><div class="eyebrow" style="font-size:8px;margin-bottom:.125rem">Property Type</div><div class="font-mono tabular" style="font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.property_type || '-'}</div></div></div></button>`;
        if(DOM.propertyGrid) DOM.propertyGrid.insertAdjacentHTML('beforeend', html);
      });

      document.querySelectorAll('.property-card[data-id]').forEach(card => { 
          card.addEventListener('click', () => { 
              const bData = buildings.find(x => x.id === card.getAttribute('data-id')); 
              if (bData) openPropertyDetail(bData); 
          }); 
      });
    } catch (err) { 
        console.error("Properties Fetch Error:", err);
        if(DOM.propertyGrid) DOM.propertyGrid.innerHTML = `<div style="padding:3rem; text-align:center; color:var(--status-review); border: 1px dashed var(--border); font-size:13px;"><b>Error loading properties:</b> ${err.message || 'Check console.'}</div>`; 
    }
    toggleSkeletonState(false);
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
            'Authorization': `Bearer ${jwtToken}`, 
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

  const fetchBuildingDetails = async (buildingId) => {
    const [evidenceRes, reportsRes, roomsRes] = await Promise.all([ 
        supabase.from('evidence_assets').select('*').eq('building_id', buildingId).order('created_at', { ascending: false }), 
        supabase.from('reports').select('*').eq('building_id', buildingId).order('created_at', { ascending: false }), 
        supabase.from('rooms').select('*').eq('building_id', buildingId).order('created_at', { ascending: true }) 
    ]);
    
    if (DOM.detailRoomsList) {
      currentBuildingRooms = roomsRes.data || [];
      if (DOM.uploadTargetRoom) { 
        DOM.uploadTargetRoom.innerHTML = '<option value="">Entire Building (General Report)</option>'; 
        currentBuildingRooms.forEach(r => { const opt = document.createElement('option'); opt.value = r.id; opt.textContent = r.room_name_current; DOM.uploadTargetRoom.appendChild(opt); }); 
      }
      if (currentBuildingRooms.length === 0) { DOM.detailRoomsList.innerHTML = `<div style="border:1px dashed var(--border);background-color:var(--surface);padding:1.5rem;text-align:center;font-family:var(--font-mono);font-size:10px;text-transform:uppercase;color:var(--muted-foreground)">No zones initialized yet</div>`; } 
      else {
        DOM.detailRoomsList.innerHTML = '';
        currentBuildingRooms.forEach(r => {
          const mapData = (r.map_x != null && r.map_y != null) ? `Mapped (${r.map_x}%, ${r.map_y}%)` : `Not Mapped`;
          DOM.detailRoomsList.insertAdjacentHTML('beforeend', `<div class="archive-item"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground" style="height:1rem;width:1rem"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg><div class="archive-details"><div style="font-size:12.5px;font-weight:500;">${r.room_name_current}</div><div class="font-mono text-muted-foreground" style="margin-top:.125rem;font-size:10px;text-transform:uppercase;letter-spacing:var(--tracking-wider)">Code: ${r.room_code} | ${mapData}</div></div><button class="btn-secondary btn-edit-room" data-id="${r.id}" data-code="${r.room_code}" data-name="${r.room_name_current}" data-x="${r.map_x !== null ? r.map_x : ''}" data-y="${r.map_y !== null ? r.map_y : ''}" style="padding:.5rem .75rem;">Edit</button></div>`);
        });
        document.querySelectorAll('.btn-edit-room').forEach(btn => { btn.addEventListener('click', (e) => { openRoomModal( e.target.getAttribute('data-id'), e.target.getAttribute('data-code'), e.target.getAttribute('data-name'), e.target.getAttribute('data-x'), e.target.getAttribute('data-y') ); }); });
      }
    }

    if (DOM.detailFilesList) {
       const evidenceFiles = evidenceRes.data || [];
       const reportFiles = reportsRes.data || [];

       const evPaths = evidenceFiles.map(f => extractPath(f.file_url, 'property_assets')).filter(Boolean);
       const repPaths = reportFiles.map(f => extractPath(f.report_url, 'reports')).filter(Boolean);

       let signedUrls = {};
       const evMap = await getSignedUrlsNative('property_assets', evPaths);
       const repMap = await getSignedUrlsNative('reports', repPaths);
       signedUrls = { ...evMap, ...repMap };

       const allFiles = [
         ...evidenceFiles.map(f => {
             const p = extractPath(f.file_url, 'property_assets');
             return { ...f, _table: 'evidence_assets', _bucket: 'property_assets', secure_url: (p && signedUrls[p]) ? signedUrls[p] : f.file_url };
         }),
         ...reportFiles.map(f => {
             const p = extractPath(f.report_url, 'reports');
             return { ...f, _table: 'reports', _bucket: 'reports', file_name: f.report_title, file_url: f.report_url, secure_url: (p && signedUrls[p]) ? signedUrls[p] : f.report_url };
         })
       ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

       if (DOM.detailFilesCount) DOM.detailFilesCount.textContent = `${allFiles.length} attached`;

       if (allFiles.length === 0) {
           DOM.detailFilesList.innerHTML = `<div style="border:1px dashed var(--border);background-color:var(--surface);padding:1.5rem;text-align:center;font-family:var(--font-mono);font-size:10px;text-transform:uppercase;color:var(--muted-foreground)">No files attached</div>`;
       } else {
           DOM.detailFilesList.innerHTML = '';
           allFiles.forEach(f => {
              const dateStr = new Date(f.created_at).toLocaleDateString('en-GB');
              const isReport = f._table === 'reports';
              const typeLabel = isReport ? 'Client Report' : 'Internal Evidence';
              const visibilityTag = f.client_visible ? 'Client Visible' : 'Internal Only';
              const deleteBtnHtml = (currentUserRole === 'admin') ? `<button class="btn-delete-file" data-id="${f.id}" data-table="${f._table}" data-bucket="${f._bucket}" data-url="${f.file_url}" style="background:transparent; border:none; color:var(--status-review); cursor:pointer; padding:0.5rem;" title="Delete File"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>` : '';

              const html = `<div class="archive-item"><svg class="text-muted-foreground" style="height:1rem;width:1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg><div class="archive-details"><div style="font-size:12.5px;font-weight:500;"><a href="${f.secure_url}" target="_blank" style="color:var(--foreground); text-decoration:none;">${f.file_name}</a></div><div class="font-mono text-muted-foreground" style="margin-top:.125rem;font-size:10px;text-transform:uppercase;letter-spacing:var(--tracking-wider)">${typeLabel} | ${dateStr} <span style="margin-left: 0.5rem; padding-left: 0.5rem; border-left: 1px solid var(--border); color: ${f.client_visible ? 'var(--status-stable)' : 'var(--status-review)'}">${visibilityTag}</span></div></div>${deleteBtnHtml}</div>`;
              DOM.detailFilesList.insertAdjacentHTML('beforeend', html);
           });

           document.querySelectorAll('.btn-delete-file').forEach(btn => {
              btn.addEventListener('click', async (e) => {
                  e.stopPropagation();
                  const fileId = btn.getAttribute('data-id'); const table = btn.getAttribute('data-table'); const bucket = btn.getAttribute('data-bucket'); const url = btn.getAttribute('data-url');
                  if (!confirm("Are you sure you want to permanently delete this file?")) return;
                  btn.disabled = true; btn.style.opacity = '0.5';
                  try {
                      const { error: dbErr } = await supabase.from(table).delete().eq('id', fileId);
                      if (dbErr) throw dbErr;
                      
                      const filePath = extractPath(url, bucket) || url.split('/').pop();
                      
                      const formData = new FormData();
                      formData.append('action', 'delete');
                      formData.append('bucket', bucket);
                      formData.append('path', filePath);

                      // NATIVE FETCH PROXY DELETE
                      await fetch(`${SUPABASE_URL}/functions/v1/storage-proxy`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${jwtToken}`, 'apikey': SUPABASE_ANON_KEY },
                        body: formData
                      });
                      
                      showToast('File deleted successfully'); fetchBuildingDetails(currentBuildingContext.id);
                  } catch(err) { console.error(err); showToast('Failed to delete file', 'error'); btn.disabled = false; btn.style.opacity = '1'; }
              });
           });
       }
    }
  };

  const openPropertyDetail = async (building) => {
    currentBuildingContext = building; switchView('detail'); toggleSkeletonState(true);
    if(DOM.detailEyebrow) DOM.detailEyebrow.textContent = `Property · ${building.building_code || building.id.substring(0,8)}`;
    if(DOM.detailTitle) DOM.detailTitle.textContent = building.address_line_1;
    if(DOM.detailAddress) DOM.detailAddress.textContent = `${building.suburb || ''} ${building.state || ''}`;
    if(DOM.detailStatus) DOM.detailStatus.textContent = `Status: ${building.status}`;
    if(DOM.sidebarAssetTitle) DOM.sidebarAssetTitle.textContent = building.building_code || 'Selected Property';
    if(DOM.headerTelemetry) DOM.headerTelemetry.innerHTML = `<div class="telemetry-node"><span class="eyebrow text-muted-foreground">PROPERTY</span><span class="tabular">${building.building_code || 'Selected'}</span></div><div class="telemetry-node"><span class="eyebrow text-muted-foreground">STATUS</span><span class="tabular">${building.status}</span><span class="pulse-container"><span class="pulse-ping status-dot-stable"></span><span class="pulse-core status-dot-stable"></span></span></div>`;
    await fetchBuildingDetails(building.id); toggleSkeletonState(false);
  };

  const init = async () => {
    try {
      DOM.views = { registry: document.getElementById('view-registry'), newForm: document.getElementById('view-new-property'), detail: document.getElementById('view-property-detail') };
      DOM.sidebarAssetTitle = document.getElementById('sidebar-asset-title'); DOM.headerTelemetry = document.getElementById('header-telemetry-cluster');
      DOM.propertyGrid = document.getElementById('propertyGridContainer'); DOM.formNewProperty = document.getElementById('form-new-property'); DOM.btnSubmitProperty = document.getElementById('btn-submit-property');
      DOM.detailEyebrow = document.getElementById('detail-eyebrow'); DOM.detailTitle = document.getElementById('detail-title'); DOM.detailAddress = document.getElementById('detail-address'); DOM.detailStatus = document.getElementById('detail-status');
      DOM.detailRoomsList = document.getElementById('detail-rooms-list');
      
      DOM.detailFilesList = document.getElementById('detail-files-list');
      DOM.detailFilesCount = document.getElementById('detail-files-count');
      DOM.uploadTargetRoom = document.getElementById('upload-target-room');
      DOM.uploadClientVisible = document.getElementById('upload-client-visible');

      DOM.btnOpenEditProperty = document.getElementById('btnOpenEditProperty'); DOM.modalEditProperty = document.getElementById('modalEditProperty'); DOM.closeEditProperty = document.getElementById('closeEditProperty'); DOM.formEditProperty = document.getElementById('formEditProperty'); DOM.btnSaveProperty = document.getElementById('btnSaveProperty');
      DOM.btnOpenAddRoom = document.getElementById('btnOpenAddRoom'); DOM.modalRoomManage = document.getElementById('modalRoomManage'); DOM.closeRoomModal = document.getElementById('closeRoomModal'); DOM.formRoomManage = document.getElementById('formRoomManage'); DOM.btnSaveRoom = document.getElementById('btnSaveRoom'); DOM.roomModalTitle = document.getElementById('roomModalTitle');
      DOM.mapContainer = document.getElementById('modal-map-container'); DOM.mapPins = document.getElementById('modal-map-pins'); DOM.mapCoordsText = document.getElementById('modal-map-coords');
      DOM.fileInput = document.getElementById('file-upload-input'); DOM.uploadStatusText = document.getElementById('upload-status-text');

      if (!DOM.propertyGrid) { console.warn("Property Grid element missing"); return; }
      fixEditModalDropdowns();
      
      const pageTitle = document.querySelector('.hero-title'); if (pageTitle) pageTitle.textContent = "Managed Properties";
      const pageDesc = document.querySelector('.hero-desc'); if (pageDesc) pageDesc.textContent = "Managed home records under continuous diagnostic supervision. Create, edit, and attach reports.";
      const eyebrow = document.querySelector('.eyebrow'); if (eyebrow && eyebrow.textContent.includes('Asset Registry')) eyebrow.textContent = 'Property Register / 07';

      bindUIEvents();
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
      
      const profile = await authenticateOperator(); 
      if (profile) await fetchAndRenderBuildings(); 
    } catch (error) { console.error("Init crash:", error); window.location.href = '/login'; }
  };
  return { init };
})();
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', JoeBuildsProperties.init); } else { JoeBuildsProperties.init(); }
