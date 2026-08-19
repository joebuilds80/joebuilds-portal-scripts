/**
 * Joe Builds Home Intelligence Platform
 * Global Profile Manager (v42 = v41 + client nav chip reads My Account;
 * glossary and client guide wording brought to the approved standard)
 */
const JoeBuildsProfileManager = (() => {
  const SUPABASE_URL = 'https://jsqyfiwkbuvuajwzbjhd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_xla-awjgU2npKzrWHdYKDQ_2ox0CWmC';
  
  let supabaseClient, currentMember = null, currentUserRole = 'client';

  const injectGlobalCSS = () => {
    if (document.getElementById('jb-forced-mobile-css-v38')) return;
    const style = document.createElement('style');
    style.id = 'jb-forced-mobile-css-v38';
    style.innerHTML = `
      html, body { overflow-x: hidden !important; max-width: 100vw !important; }
      
      @media (max-width: 991px) {
        aside.sidebar, aside.jb-sidebar { display: none !important; }
        .header-telemetry-cluster, .jb-desktop-telemetry { display: none !important; }
        
        .main-wrapper, .jb-main-view-wrapper { padding-left: 0 !important; width: 100% !important; max-width: 100vw !important; }
        .header-container, .jb-header-container { padding: 0 1rem !important; }
        
        .mobile-brand, .jb-mobile-brand { display: flex !important; align-items: center !important; gap: 0.5rem !important; }
        .jb-universal-mobile-nav { 
          display: flex !important; width: 100vw; justify-content: space-evenly;
          background-color: #2A3C30 !important; position: fixed; bottom: 0; left: 0;
          z-index: 99999; padding-top: 8px; padding-bottom: calc(8px + env(safe-area-inset-bottom));
          box-shadow: 0 -4px 12px rgba(0,0,0,0.15);
        }
        .jb-mobile-nav-btn {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 8px 4px; gap: 6px; font-family: "JetBrains Mono", monospace; font-size: 8px !important;
          text-transform: uppercase; color: #A5B39A !important; text-decoration: none !important;
          background: transparent; border: none;
        }
        .jb-mobile-nav-btn.active { color: #fff !important; }
      }

      @media (min-width: 992px) {
        .jb-universal-mobile-nav { display: none !important; }
        .mobile-brand, .jb-mobile-brand { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  };

  const fixTerminologyAndUI = () => {
    document.querySelectorAll('.mobile-brand, .jb-mobile-brand').forEach(brand => {
      if (!brand.querySelector('img')) {
        brand.innerHTML = `<img src="https://cdn.prod.website-files.com/6a2045cc1c7e7eee7fe5ef16/6a20510745a9edb28e4a4330_1-p-500.webp" style="height: 1.5rem; width: auto; object-fit: contain; margin-right: 0.5rem;"><span style="font-size: 12px; font-weight: 600; letter-spacing: -0.025em;">JOE BUILDS</span>`;
        brand.style.display = 'flex'; brand.style.alignItems = 'center';
      }
    });

    document.querySelectorAll('.sidebar-nav a, .jb-sidebar-nav a').forEach(el => {
      const href = el.getAttribute('href');
      if (href && href.includes('/digital-twin')) { el.innerHTML = el.innerHTML.replace('Digital Twin', 'Zones & Rooms'); }
    });

    document.querySelectorAll('.sidebar-nav, .jb-sidebar-nav').forEach(nav => {
      const propLink = nav.querySelector('a[href*="/properties"]');
      const repLink = nav.querySelector('a[href*="/reports"]');
      if (propLink && repLink) { nav.insertBefore(repLink, propLink); }
    });

    document.querySelectorAll('.mobile-nav, .jb-bottom-bar, .jb-mobile-overlay, .jb-hamburger-btn').forEach(el => el.remove());

    const currentPath = window.location.pathname;
    const navHtml = `
      <nav class="jb-universal-mobile-nav">
        <a href="/dashboard" class="jb-mobile-nav-btn ${currentPath.includes('dashboard') ? 'active' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="14" rx="1"></rect><rect width="7" height="7" x="3" y="14" rx="1"></rect></svg>Dashboard</a>
        <a href="/digital-twin" class="jb-mobile-nav-btn ${currentPath.includes('twin') ? 'active' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"></path><path d="M15 5.764v15"></path><path d="M9 3.236v15"></path></svg>Home Map</a>
        <a href="/diagnostics" class="jb-mobile-nav-btn ${currentPath.includes('diagnostics') ? 'active' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"></path><path d="M6.453 15h11.094"></path><path d="M8.5 2h7"></path></svg>Records</a>
        <a href="/pathway" class="jb-mobile-nav-btn ${currentPath.includes('pathway') ? 'active' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6a9 9 0 0 0-9 9V3"></path><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle></svg>Pathway</a>
        <a href="/reports" class="jb-mobile-nav-btn ${currentPath.includes('reports') ? 'active' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>Reports</a>
        <a href="/properties" class="jb-mobile-nav-btn jb-admin-only ${currentPath.includes('properties') ? 'active' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 7h2"></path><path d="M14 7h2"></path><path d="M8 11h2"></path><path d="M14 11h2"></path></svg>Properties</a>
        <a href="/admin" class="jb-mobile-nav-btn jb-admin-only ${currentPath.includes('admin') ? 'active' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 17H5"></path><path d="M19 7h-9"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>Admin</a>
      </nav>
    `;
    document.body.insertAdjacentHTML('beforeend', navHtml);
  };

  const fixOperatorDropdown = () => {
    let dropBtn = document.getElementById('jbOperatorDropdown');
    const opMenu = document.getElementById('jbOperatorMenu');
    if (!dropBtn || !opMenu) return;

    const opLabel = document.getElementById('jbOperatorLabel');
    if (opLabel) opLabel.classList.add('jb-skeleton-block');

    const newBtn = dropBtn.cloneNode(true);
    dropBtn.parentNode.replaceChild(newBtn, dropBtn);
    dropBtn = newBtn; 

    dropBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = dropBtn.getAttribute('aria-expanded') === 'true';
      dropBtn.setAttribute('aria-expanded', !isExpanded);
      opMenu.classList.toggle('jb-hidden');
    });

    document.addEventListener('click', (e) => {
      if (!dropBtn.contains(e.target) && !opMenu.contains(e.target)) {
        dropBtn.setAttribute('aria-expanded', 'false');
        opMenu.classList.add('jb-hidden');
      }
    });

    const logoutBtn = document.getElementById('jbLogoutBtn');
    if (logoutBtn) {
      const newLogout = logoutBtn.cloneNode(true);
      logoutBtn.parentNode.replaceChild(newLogout, logoutBtn);
      newLogout.addEventListener('click', async () => {
        try { await window.$memberstackDom.logout(); window.location.href = '/login'; } catch (err) {}
      });
    }
  };

  const injectProfileHTML = () => {
    if (document.getElementById('jbGlobalProfileModal')) return;
    const modalHTML = `
      <div id="jbGlobalProfileModal" class="jb-hidden" style="position:fixed; inset:0; background:rgba(26,36,29,0.7); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:999999; padding:1rem;">
        <div style="width:100%; max-width:28rem; background:var(--surface,#FFF); border:1px solid var(--border,#C8CCC4); box-shadow:0 24px 48px rgba(0,0,0,0.2); display:flex; flex-direction:column; border-radius:4px; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid var(--border,#C8CCC4); background:var(--background,#EBEBE6);">
            <div>
              <div style="font-family:var(--font-mono, monospace); font-size:9px; color:var(--muted-foreground,#637066); text-transform:uppercase; letter-spacing:0.15em; margin-bottom:0.25rem; font-weight:700;">Account Settings</div>
              <h2 style="font-size:18px; font-weight:500; font-family:var(--font-sans, sans-serif); color:var(--foreground,#1A241D); margin:0;">Edit Profile</h2>
            </div>
            <button id="closeProfileModal" style="background:transparent; border:none; cursor:pointer; color:var(--muted-foreground,#637066); padding:0.25rem; transition:color 0.2s;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>
          </div>
          <div style="padding:1.5rem; display:flex; flex-direction:column; gap:1.25rem;">
            <form id="jbProfileForm" style="display:flex; flex-direction:column; gap:1.25rem; margin:0;">
              <label style="display:block; margin:0;">
                <span style="font-family:var(--font-mono, monospace); font-size:9px; color:var(--muted-foreground,#637066); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.375rem; display:block; font-weight:700;">Full Name</span>
                <input type="text" id="profileName" required style="width:100%; border:1px solid var(--border,#C8CCC4); padding:0.625rem 0.75rem; background:var(--surface,#FFF); color:var(--foreground,#1A241D); font-family:var(--font-mono, monospace); font-size:13px; outline:none; transition: border-color 0.15s ease;" onfocus="this.style.borderColor='var(--accent, #2A3C30)'" onblur="this.style.borderColor='var(--border, #C8CCC4)'">
              </label>
              <label style="display:block; margin:0;">
                <span style="font-family:var(--font-mono, monospace); font-size:9px; color:var(--muted-foreground,#637066); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.375rem; display:block; font-weight:700;">Email Address</span>
                <input type="email" id="profileEmail" required style="width:100%; border:1px solid var(--border,#C8CCC4); padding:0.625rem 0.75rem; background:var(--surface,#FFF); color:var(--foreground,#1A241D); font-family:var(--font-mono, monospace); font-size:13px; outline:none; transition: border-color 0.15s ease;" onfocus="this.style.borderColor='var(--accent, #2A3C30)'" onblur="this.style.borderColor='var(--border, #C8CCC4)'">
              </label>
              <div id="profileStatusMsg" style="font-size:12px; display:none; margin:0; font-weight:500;"></div>
              <button type="submit" id="btnSaveProfile" style="width:100%; background:var(--foreground,#1A241D); color:var(--background,#EBEBE6); padding:0.75rem 1rem; border:1px solid var(--foreground,#1A241D); font-family:var(--font-mono, monospace); font-size:11px; text-transform:uppercase; letter-spacing:0.15em; cursor:pointer; transition:background 0.2s; margin-top:0.5rem;" onmouseover="this.style.background='var(--accent, #2A3C30)'" onmouseout="this.style.background='var(--foreground, #1A241D)'">Save Changes</button>
            </form>
            <div style="border-top: 1px solid var(--border,#C8CCC4); padding-top: 1.25rem; margin-top: 0.5rem;">
               <button type="button" id="btnDeleteAccount" style="width:100%; background:transparent; border:1px solid var(--status-review,#A64444); color:var(--status-review,#A64444); padding:0.75rem 1rem; font-family:var(--font-mono, monospace); font-size:11px; text-transform:uppercase; letter-spacing:0.15em; cursor:pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(166, 68, 68, 0.05)'" onmouseout="this.style.background='transparent'">Delete Account</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  };

  const bindProfileEvents = (profile) => {
    const operatorMenu = document.getElementById('jbOperatorMenu');
    const logoutBtn = document.getElementById('jbLogoutBtn'); 
    if (!operatorMenu || !logoutBtn) return;

    if (!document.getElementById('jbTriggerEditProfile')) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button'; editBtn.id = 'jbTriggerEditProfile'; editBtn.className = 'jb-menu-item';
      editBtn.textContent = 'Edit Profile'; editBtn.style.borderBottom = '1px solid var(--border)';
      operatorMenu.insertBefore(editBtn, logoutBtn);

      editBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); operatorMenu.classList.add('jb-hidden'); 
        if (currentMember && currentMember.data) {
          document.getElementById('profileName').value = currentMember.data.customFields?.['first-name'] || '';
          document.getElementById('profileEmail').value = currentMember.data.auth.email || '';
          const modal = document.getElementById('jbGlobalProfileModal');
          if (modal) modal.classList.remove('jb-hidden');
        }
      });
    }

    const modal = document.getElementById('jbGlobalProfileModal');
    if(modal) {
      document.getElementById('closeProfileModal').addEventListener('click', () => modal.classList.add('jb-hidden'));
      modal.addEventListener('click', (e) => { if (e.target === modal.firstElementChild) modal.classList.add('jb-hidden'); });

      document.getElementById('jbProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const saveBtn = document.getElementById('btnSaveProfile');
        const statusMsg = document.getElementById('profileStatusMsg');
        saveBtn.textContent = 'Saving...'; saveBtn.disabled = true;
        const newName = document.getElementById('profileName').value;
        const newEmail = document.getElementById('profileEmail').value;
        try {
          await window.$memberstackDom.updateMember({ email: newEmail, customFields: { "first-name": newName } });
          if (currentMember && currentMember.data) {
            await supabaseClient.from('profiles').update({ first_name: newName, email: newEmail }).eq('memberstack_id', currentMember.data.id);
          }
          statusMsg.textContent = "Profile updated successfully!"; statusMsg.style.color = "var(--status-stable, #3A6B48)"; statusMsg.style.display = "block";
          setTimeout(() => modal.classList.add('jb-hidden'), 1500);
        } catch (err) {
          statusMsg.textContent = err.message || "Failed to update profile."; statusMsg.style.color = "var(--status-review, #A64444)"; statusMsg.style.display = "block";
        }
        saveBtn.textContent = 'Save Changes'; saveBtn.disabled = false;
      });

      document.getElementById('btnDeleteAccount').addEventListener('click', async () => {
         if (confirm("Are you sure you want to permanently delete your account? This will sever all database connections and cannot be undone.")) {
             try {
                 const btn = document.getElementById('btnDeleteAccount');
                 btn.textContent = "Deleting..."; btn.disabled = true;
                 await supabaseClient.from('user_property_access').delete().eq('user_id', currentMember.data.id);
                 await supabaseClient.from('profiles').delete().eq('memberstack_id', currentMember.data.id);
                 await window.$memberstackDom.logout();
                 window.location.href = '/login';
             } catch(err) {
                 alert("Failed to delete account. Please contact support.");
             }
         }
      });
    }

    // NEW UPGRADE BUTTON FOR DEMO USERS
    if (profile.role === 'demo' && !document.getElementById('jbTriggerUpgrade')) {
      const upgradeBtn = document.createElement('a');
      upgradeBtn.id = 'jbTriggerUpgrade';
      upgradeBtn.className = 'jb-menu-item';
      upgradeBtn.textContent = 'Upgrade Plan';
      upgradeBtn.href = '#'; 
      upgradeBtn.style.borderBottom = '1px solid var(--border)';
      upgradeBtn.style.color = 'var(--status-stable)';
      upgradeBtn.style.textDecoration = 'none';
      upgradeBtn.style.display = 'block';
      operatorMenu.insertBefore(upgradeBtn, logoutBtn);
    }
  };

  const bindClientPropertySwitcher = async (profile) => {
    if (profile.role === 'admin' || profile.role === 'operator') return;

    const { data: accesses, error } = await supabaseClient
       .from('user_property_access')
       .select('building_id, buildings(building_code, address_line_1)')
       .eq('user_id', currentMember.data.id);

    const validAccesses = accesses?.filter(a => a.buildings) || [];

    if (validAccesses.length > 1) {
       const operatorMenu = document.getElementById('jbOperatorMenu');
       
       if (operatorMenu && !document.getElementById('clientPropertySwitcherWrap')) {
           let optionsHtml = '';
           validAccesses.forEach(acc => {
               const b = acc.buildings;
               const isSelected = acc.building_id === profile.building_id ? 'selected' : '';
               optionsHtml += `<option value="${acc.building_id}" ${isSelected}>${b.building_code || 'PRJ'} - ${b.address_line_1.split(',')[0]}</option>`;
           });

           const switcherHtml = `
           <div id="clientPropertySwitcherWrap" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); background: var(--surface);">
              <div style="font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; color: var(--muted-foreground); margin-bottom: 0.5rem; letter-spacing: 0.1em; font-weight: 700;">Switch Property</div>
              <select id="clientPropertySwitcher" style="width: 100%; border: 1px solid var(--border); background-color: var(--surface); color: var(--foreground); padding: 0.375rem 0.5rem; font-size: 11px; font-family: var(--font-mono); outline: none; cursor: pointer; border-radius: 2px;">
                ${optionsHtml}
              </select>
           </div>`;
           
           operatorMenu.insertAdjacentHTML('afterbegin', switcherHtml);
           
           document.getElementById('clientPropertySwitcher').addEventListener('change', async (e) => {
               const newBid = e.target.value;
               e.target.disabled = true;
               await supabaseClient.from('profiles').update({ building_id: newBid }).eq('memberstack_id', currentMember.data.id);
               window.location.reload(); 
           });
       }
    }
  };

  const updateGlobalHeader = async (profile) => {
    let targetBuildingId = profile?.building_id;
    
    if (!targetBuildingId && (profile?.role === 'admin' || profile?.role === 'operator')) {
         const { data: fallbackB } = await supabaseClient.from('buildings').select('id').order('created_at', { ascending: false }).limit(1).single();
         if (fallbackB) targetBuildingId = fallbackB.id;
    }

    if (targetBuildingId) {
        const { data: building } = await supabaseClient.from('buildings').select('*').eq('id', targetBuildingId).single();
        if (building) {
            const assetName = `${building.building_code || 'PRJ'} - ${building.address_line_1}`;
            const climateText = building.climate_zone || '—'; // PS-051: no invented zone. Site-wide script — this one overwrote every page.
            
            const sidebarAsset = document.getElementById('desktopSidebarAsset') || document.querySelector('.jb-footer-project');
            const sidebarMeta = document.getElementById('desktopSidebarMeta') || document.querySelector('.sidebar-footer .text-muted-foreground');
            if (sidebarAsset) { sidebarAsset.textContent = assetName; sidebarAsset.classList.remove('jb-skeleton-block'); }
            if (sidebarMeta) { sidebarMeta.textContent = climateText; sidebarMeta.classList.remove('jb-skeleton-block'); }

            const headerAsset = document.getElementById('desktopHeaderAsset');
            if (headerAsset) { headerAsset.textContent = assetName; headerAsset.classList.remove('jb-skeleton-block'); }

            const headerClimate = document.getElementById('desktopHeaderClimate') || document.querySelectorAll('.header-telemetry-cluster .tabular')[1];
            if (headerClimate) { headerClimate.textContent = climateText; headerClimate.classList.remove('jb-skeleton-block'); }

            const headerSys = document.getElementById('desktopHeaderSys') || document.querySelectorAll('.header-telemetry-cluster .tabular')[2];
            if (headerSys) { headerSys.textContent = building.status || "Active Home Record"; headerSys.classList.remove('jb-skeleton-block'); }
        }
    } else {
        // EMPTY STATE FALLBACK FOR GLOBAL HEADERS
        const sidebarAsset = document.getElementById('desktopSidebarAsset') || document.querySelector('.jb-footer-project');
        const sidebarMeta = document.getElementById('desktopSidebarMeta') || document.querySelector('.sidebar-footer .text-muted-foreground');
        if (sidebarAsset) { sidebarAsset.textContent = 'Unassigned'; sidebarAsset.classList.remove('jb-skeleton-block'); }
        if (sidebarMeta) { sidebarMeta.textContent = '--'; sidebarMeta.classList.remove('jb-skeleton-block'); }

        const headerAsset = document.getElementById('desktopHeaderAsset');
        if (headerAsset) { headerAsset.textContent = 'Unassigned'; headerAsset.classList.remove('jb-skeleton-block'); }

        const headerClimate = document.getElementById('desktopHeaderClimate') || document.querySelectorAll('.header-telemetry-cluster .tabular')[1];
        if (headerClimate) { headerClimate.textContent = '--'; headerClimate.classList.remove('jb-skeleton-block'); }

        const headerSys = document.getElementById('desktopHeaderSys') || document.querySelectorAll('.header-telemetry-cluster .tabular')[2];
        if (headerSys) { headerSys.textContent = 'Pending Provision'; headerSys.classList.remove('jb-skeleton-block'); }
    }
  };

  const getHelpContent = (role) => {
    if (role === 'admin' || role === 'operator') {
      return `
        <div class="jb-accordion-item is-open"><button class="jb-accordion-header">Continuous Auto-Save Mechanics <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></button><div class="jb-accordion-content">This platform uses continuous sync architecture. <strong>There are no "Save" buttons</strong> for measurement data inputs, statuses, or pathway milestones.<br><br><strong>How to save:</strong> Type your value or select a status, and simply <strong>click anywhere outside the field</strong> (or tap outside on mobile), or press <strong>Enter</strong>. The background of the card will briefly pulse green to confirm the data has been securely written to the database.</div></div>
        <div class="jb-accordion-item"><button class="jb-accordion-header">Home Performance Baseline & Rooms <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></button><div class="jb-accordion-content">Navigate to the <strong>Properties</strong> page to register new homes. If a property is entirely blank, use the <strong>Generate Baseline Data Profile</strong> button on the Admin page to automatically deploy the foundational engineering pathway and core metrics.<br><br><strong>Rooms & Zones:</strong> Adding a room on the Properties page automatically generates internal RH%, CO₂, and VOC inputs for that specific zone. If you map it on the floorplan, a hotspot will instantly appear for the client.</div></div>
        <div class="jb-accordion-item"><button class="jb-accordion-header">Contextual Diagnostic Uploads <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></button><div class="jb-accordion-content">Files dragged into the <strong>Admin Page Uploader</strong> are published directly to the client's Reports center.<br><br><strong>Target Context:</strong> If you select a specific room from the dropdown before uploading an image (JPG/PNG), the system will attach it to that room's Zone node instead of the general reports center.</div></div>
      `;
    } else {
      return `
        <div class="jb-accordion-item is-open"><button class="jb-accordion-header">Understanding Your Measured Home Record <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></button><div class="jb-accordion-content">Your dashboard provides a high-level health summary of your building. <br><br><strong>Next Step:</strong> The dark green panel at the bottom shows the next step recorded in your upgrade pathway.</div></div>
        <div class="jb-accordion-item"><button class="jb-accordion-header">Rooms & Diagnostics <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></button><div class="jb-accordion-content"><strong>Zones:</strong> An interactive map of your property. Tap any circular room node to open the side-drawer and inspect measurement data (like bedroom CO₂ levels), analyst notes, and room-specific thermal imagery.<br><br><strong>Diagnostics:</strong> The raw data ledger. This logs the exact measurements captured by our analysts. Clicking any row will pull up the specific instrument record.</div></div>
        <div class="jb-accordion-item"><button class="jb-accordion-header">Building Science Glossary <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></button><div class="jb-accordion-content"><ul><li><strong>ACH50:</strong> Air Changes per Hour at 50 Pascals. This measures how drafty or airtight your home is. Lower is better.</li><li><strong>U-Value:</strong> Measures thermal transmittance. It tells us how effectively your walls and roof prevent heat from escaping. Lower is better.</li><li><strong>VOC (Volatile Organic Compounds):</strong> Compounds released by some paints, glues and materials. Recorded as an indoor air quality indicator.</li><li><strong>RH (Relative Humidity):</strong> The amount of moisture in the air. Elevated RH is associated with condensation and is recorded as a moisture risk indicator.</li></ul></div></div>
      `;
    }
  };

  const injectHelpSystem = (role) => {
    if (document.getElementById('jbHelpFab')) return;
    const fabHTML = `<button id="jbHelpFab" class="jb-help-fab" title="Platform Guide"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></button>`;
    document.body.insertAdjacentHTML('beforeend', fabHTML);

    const titleText = (role === 'admin' || role === 'operator') ? 'Operator Manual' : 'Client Guide';
    const helpModalHTML = `<div id="jbHelpModal" class="jb-hidden" style="position:fixed; inset:0; background:rgba(26,36,29,0.7); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:999999; padding:1rem;"><div class="jb-prof-frame" style="width:100%; max-width:32rem; background:var(--surface,#FFF); border:1px solid var(--border,#C8CCC4); box-shadow:0 24px 48px rgba(0,0,0,0.2); display:flex; flex-direction:column; border-radius:4px; overflow:hidden; max-height:85vh;"><div class="jb-prof-header" style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid var(--border,#C8CCC4); background:var(--background,#EBEBE6);"><div><div class="jb-prof-label" style="font-family:var(--font-mono, monospace); font-size:9px; color:var(--muted-foreground,#637066); text-transform:uppercase; letter-spacing:0.15em; margin-bottom:0.25rem; font-weight:700;">Knowledge Base</div><h2 style="font-size:18px; font-weight:500; font-family:var(--font-sans, sans-serif); color:var(--foreground,#1A241D); margin:0;">${titleText}</h2></div><button id="closeHelpModal" class="jb-prof-close" style="background:transparent; border:none; cursor:pointer; color:var(--muted-foreground,#637066); padding:0.25rem; transition:color 0.2s;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div><div class="jb-prof-body" style="padding: 1.5rem; display:flex; flex-direction:column; gap:0.5rem; overflow-y:auto;">${getHelpContent(role)}</div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', helpModalHTML);

    const fab = document.getElementById('jbHelpFab');
    const helpModal = document.getElementById('jbHelpModal');
    const closeHelp = document.getElementById('closeHelpModal');

    fab.addEventListener('click', () => helpModal.classList.remove('jb-hidden'));
    closeHelp.addEventListener('click', () => helpModal.classList.add('jb-hidden'));
    helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.classList.add('jb-hidden'); });

    document.querySelectorAll('.jb-accordion-item').forEach(acc => {
      acc.querySelector('.jb-accordion-header').addEventListener('click', () => {
        const isOpen = acc.classList.contains('is-open');
        document.querySelectorAll('.jb-accordion-item').forEach(a => a.classList.remove('is-open'));
        if (!isOpen) acc.classList.add('is-open');
      });
    });
  };

  const init = async () => {
    if (!document.getElementById('jbOperatorDropdown')) return;

    injectGlobalCSS();
    fixTerminologyAndUI(); 
    fixOperatorDropdown();

    if (window.supabase) {
      let supabaseToken = '';
      try { 
        const memberReq = await window.$memberstackDom.getCurrentMember();
        if (memberReq?.data?.customFields?.['supabase-jwt']) {
            supabaseToken = memberReq.data.customFields['supabase-jwt'];
        }
      } catch(e) { console.warn("No Supabase token found"); }

      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: supabaseToken ? { Authorization: `Bearer ${supabaseToken}` } : {} }
      });
      
      try {
        currentMember = await window.$memberstackDom.getCurrentMember();
        if (currentMember && currentMember.data) {
          
          const opEmail = document.getElementById('jbOperatorEmail');
          if (opEmail) {
              opEmail.textContent = `Logged in as: ${currentMember.data.auth.email.toLowerCase()}`;
          }

          // POLLING LOOP: Give Make.com a chance to insert the property assignment
          let profile = null;
          for (let i = 0; i < 5; i++) {
            const { data } = await supabaseClient.from('profiles').select('role, building_id').eq('memberstack_id', currentMember.data.id).maybeSingle();
            profile = data;
            if (profile && (profile.building_id || profile.role === 'admin' || profile.role === 'operator')) {
              break;
            }
            await new Promise(r => setTimeout(r, 1000));
          }

          currentUserRole = profile?.role || 'client';

          const displayRole = (currentUserRole === 'client') ? 'My Account' : currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1);
          const opLabel = document.getElementById('jbOperatorLabel');
          if (opLabel) {
            opLabel.classList.remove('jb-skeleton-block');
            opLabel.textContent = displayRole;
          }
          
          injectProfileHTML(); 
          bindProfileEvents(profile);
          injectHelpSystem(currentUserRole);
          await bindClientPropertySwitcher(profile);
          
          await updateGlobalHeader(profile);

          if (currentUserRole === 'admin' || currentUserRole === 'operator') {
             document.querySelectorAll('a[href*="/properties"], a[href*="/admin"], .jb-admin-only').forEach(el => {
                el.style.setProperty('display', 'flex', 'important');
                el.style.setProperty('visibility', 'visible', 'important');
                el.classList.remove('jb-hidden');
             });
          }

          document.body.classList.add('jb-data-ready');
        }
      } catch (err) {
        console.error("Profile Manager Auth Check Failed:", err);
      }
    }
  };

  return { init };
})();

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', JoeBuildsProfileManager.init);
} else { JoeBuildsProfileManager.init(); }
