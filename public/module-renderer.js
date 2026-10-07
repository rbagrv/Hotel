class ModuleRenderer {
  constructor() {
    console.log('ModuleRenderer initialized');
    // Flag to prevent multiple event listeners for connectivity
    this._connectivityListenersAttached = false; // <-- ADDED THIS FLAG
    this._debounceInstance = this._debounceLocal(); // Initialize local debounce instance
  }

  // Private helper function to debounce calls locally
  _debounceLocal() {
    let timeout;
    return function(func, delay) {
         const context = this;
         return function(...args) {
             clearTimeout(timeout);
             timeout = setTimeout(() => func.apply(context, args), delay);
         };
    };
  }

  renderModule(moduleName, data) {
    console.log('[ModuleRenderer] Rendering module:', moduleName);

    const contentArea = document.getElementById('contentArea');
    if (!contentArea) {
      console.error('Content area not found!');
      return;
    }

    // NEW: Add central permission check before rendering any module
    if (window.authManager && !window.authManager.canViewModule(moduleName)) {
        console.warn(`[ModuleRenderer] Access denied for module: ${moduleName}`);
        contentArea.innerHTML = `
            <div class="system-error-card" style="text-align:center; padding: 2rem;">
                <h2 class="error-title" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;"><i class="fas fa-ban"></i> İcazə Yoxdur</h2>
                <p class="error-message">Bu bölməyə giriş üçün icazəniz yoxdur.</p>
                <button onclick="window.app.loadModule('dashboard')" class="btn btn-primary">Əsas Panelə Qayıt</button>
            </div>`;
        return; // Stop rendering
    }

    // --- NEW: Save active element and cursor position before re-render ---
    let activeElementInfo = null;
    if (document.activeElement && 
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) { 
        activeElementInfo = {
            id: document.activeElement.id,
            name: document.activeElement.name, // Keep name as fallback/identifier
            selectionStart: document.activeElement.selectionStart,
            selectionEnd: document.activeElement.selectionEnd,
            value: document.activeElement.value // Capture current value
        };
    }
    // --- END NEW ---

    const safeData = data || {}; 
    // Ensure all expected collections are arrays, even if data is null/undefined or missing a key
    const collections = [
        "guests", "rooms", "reservasiyalar", "services", "inventory",
        "staff", "maintenance", "cashTransactions", "invoices",
        "posSales", "reports", "settings", "auditLogs", "purchaseDocuments", "systemErrors"
    ];
    collections.forEach(key => {
        if (!Array.isArray(safeData[key])) { 
            safeData[key] = []; 
        }
    });

    try {
      const scroller = document.querySelector('.main-content') || window;
      setTimeout(() => {
        if (scroller.scrollTo) scroller.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
        else if (scroller.scrollTop !== undefined) scroller.scrollTop = 0;
      }, 40);
    } catch {}

    safeData.hotelInfo = window.app?.getHotelInfo ? window.app.getHotelInfo() : {
      hotelName: "Hotel PMS",
      address: "Bakı şəhəri, Azərbaycan",
      phone: "+994 12 123 45 67",
      email: "info@hotelpms.az"
    };

    let content = '';
    let asyncContentSet = false; // true when a module set innerHTML asynchronously (non-blocking)
    try {
      switch (moduleName) {
        case 'dashboard':
          if (window.dashboardComponent && typeof window.dashboardComponent.render === 'function') {
            content = window.dashboardComponent.render(safeData);
          } else {
            console.error('DashboardComponent is not available or its render method is missing. window.dashboardComponent:', window.dashboardComponent);
            content = '<div class="loading" style="color:red; font-weight:bold;">Əsas Panel yüklənmədi. Komponent instansı tapılmadı.</div>';
          }
          break;
        case 'reservations':
          content = window.reservationsComponent ? window.reservationsComponent.render(safeData) : '<div class="loading">Rezervasiyalar yüklənir...</div>';
          break;
        case 'guests':
          content = window.guestsComponent ? window.guestsComponent.render(safeData) : '<div class="loading">Qonaqlar yüklənir...</div>';
          break;
        case 'rooms':
          content = window.roomsComponent ? window.roomsComponent.render(safeData) : '<div class="loading">Otaqlar yüklənir...</div>';
          break;
        case 'services':
          content = window.servicesComponent ? window.servicesComponent.render(safeData) : '<div class="loading">Xidmətlər yüklənir...</div>';
          break;
        case 'pos':
          content = window.posComponent ? window.posComponent.render(safeData) : '<div class="loading">POS yüklənir...</div>';
          break;
        case 'cash':
          // Async, non-blocking render: show a loading placeholder now, fill content in chunks so the
          // main thread is never frozen on large datasets (the sidebar/menu stays responsive).
          if (window.cashComponent && typeof window.cashComponent.renderAsync === 'function') {
            contentArea.innerHTML = '<div class="loading">Kassa yüklənir...</div>';
            window.cashComponent.renderAsync(safeData, contentArea);
            asyncContentSet = true;
          } else {
            content = window.cashComponent ? window.cashComponent.render(safeData) : '<div class="loading">Kassa yüklənir...</div>';
          }
          break;
        case 'inventory':
          content = window.inventoryComponent ? window.inventoryComponent.render(safeData) : '<div class="loading">Anbar yüklənir...</div>';
          break;
        case 'invoices':
          content = window.invoicesComponent ? window.invoicesComponent.render(safeData) : '<div class="loading">Fakturalar yüklənir...</div>';
          break;
        case 'staff':
          content = window.staffComponent ? window.staffComponent.render(safeData) : '<div class="loading">İşçilər yüklənir...</div>';
          break;
        case 'maintenance':
          content = window.maintenanceComponent ? window.maintenanceComponent.render(safeData) : '<div class="loading">Təmir yüklənir...</div>';
          break;
        case 'reports':
          content = window.reportsComponent ? window.reportsComponent.render(safeData) : '<div class="loading">Hesabatlar modulu yüklənir...</div>';
          break;
        case 'settings':
          content = this.renderSettingsModern(safeData);
          break;
        case 'superadmin_panel':
          content = this.renderSuperadminPanel(safeData);
          break;
        case 'purchase_documents':
          content = window.purchaseDocumentsComponent ? window.purchaseDocumentsComponent.render(safeData) : '<div class="loading">Alış/Satış Sənədləri yüklənir...</div>';
          break;
        default:
          content = `<div class="loading">Module "${moduleName}" not found</div>`;
      }
      if (!asyncContentSet) {
        contentArea.innerHTML = content;
      }
      if (moduleName === 'dashboard' && window.chartManager) {
        window.chartManager.initDashboardCharts();
      }

        // --- NEW: Restore focus and cursor position after re-render ---
        if (activeElementInfo && (activeElementInfo.id || activeElementInfo.name)) {
            // Use 0ms timeout to defer execution until after current script block finishes and DOM is updated synchronously.
            setTimeout(() => { 
                let restoredElement = activeElementInfo.id ? document.getElementById(activeElementInfo.id) : null;
                if (!restoredElement && activeElementInfo.name) {
                    // Fallback to name if ID didn't work (e.g. dynamic ID in form, or no ID)
                    // This is less precise if multiple elements have the same name.
                    restoredElement = contentArea.querySelector(`[name="${activeElementInfo.name}"]`);
                }
                
                if (restoredElement && (restoredElement.tagName === 'INPUT' || restoredElement.tagName === 'TEXTAREA')) {
                    restoredElement.focus();
                    restoredElement.value = activeElementInfo.value; // Restore the value
                    
                    // --- PATCH START: Check for input types that support setSelectionRange to fix error ---
                    const supportedInputTypes = ['text', 'search', 'url', 'tel', 'password'];
                    if (typeof restoredElement.setSelectionRange === 'function' && 
                        (restoredElement.tagName === 'TEXTAREA' || supportedInputTypes.includes(restoredElement.type))) {
                        try {
                            restoredElement.setSelectionRange(activeElementInfo.selectionStart, activeElementInfo.selectionEnd);
                        } catch (e) {
                            console.warn('Failed to set selection range on element:', restoredElement, e);
                        }
                    }
                    // --- PATCH END ---
                }
            }, 0); 
        }
        // --- END NEW ---

    } catch (error) {
      console.error('Error rendering module:', moduleName, error);
      contentArea.innerHTML = `<div class="system-error-card">
          <h2 class="error-title">Modul Yüklənmə Xətası</h2>
          <p class="error-message">Modulu yükləyərkən kritik xəta baş verdi: ${error.message}</p>
          <pre class="error-details">${error.stack || 'Stack trace yoxdur.'}</pre>
          <button onclick="window.location.reload()" class="btn btn-primary">Səhifəni Yenilə</button>
        </div>`;
      // Record the error automatically
      window.app?.recordSystemError('ModuleRenderError', error.message, error.stack);
      throw error; 
    }

    try {
      if (window.app && typeof window.app.scrollToTop === 'function') window.app.scrollToTop();
    } catch {}

    if (window.jspdf && !window.jspdf.jsPDF.API.autoTable) {
        console.warn("jspdf-autotable not found on jsPDF instance. Re-attaching...");
        try {
            if (window.jspdf_autotable && typeof window.jspdf_autotable.default === 'function') {
                 window.jspdf.jsPDF.API.autoTable = window.jspdf_autotable.default;
            } else {
                console.error("Could not attach jspdf-autotable plugin.");
            }
        } catch(e) {
            console.error("Error attaching jspdf-autotable:", e);
        }
    }
  }

  // NEW: Helper to render a human-readable diff from the changes object
  _renderChangesAsHtml(changes) {
      if (!changes || (typeof changes.oldData !== 'object' && typeof changes.newData !== 'object')) {
          // Fallback for simple changes or unknown format
          return `<pre style="font-size:0.85em;max-width:340px;white-space:pre-wrap; background: var(--background-color); padding: 0.5rem; border-radius: 0.5rem;">${JSON.stringify(changes, null, 2)}</pre>`;
      }

      const { oldData, newData } = changes;

      // Handle creation: Show key details of the new item
      if (newData && !oldData) {
          const name = newData.name || newData.title || newData.documentNumber || (newData.publicId ? `#${newData.publicId}` : `ID...${String(newData.id || '').slice(-4)}`);
          const type = newData.type || newData.category || '';
          return `<div style="font-size:0.9em; color: var(--success-color);"><i class="fas fa-plus-circle"></i> Yaradıldı: <strong>${name}</strong> ${type ? `(${type})` : ''}</div>`;
      }

      // Handle deletion: Show key details of the deleted item
      if (oldData && !newData) {
          const name = oldData.name || oldData.title || oldData.documentNumber || (oldData.publicId ? `#${oldData.publicId}` : `ID...${String(oldData.id || '').slice(-4)}`);
          const type = oldData.type || oldData.category || '';
          return `<div style="font-size:0.9em; color: var(--danger-color);"><i class="fas fa-trash"></i> Silindi: <strong>${name}</strong> ${type ? `(${type})` : ''}</div>`;
      }

      // Handle update: Compare fields and show differences
      const diffs = [];
      const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

      // Keys to ignore in the diff view
      const ignoredKeys = ['id', 'firebaseUid', 'createdAt', 'updatedAt', 'publicId', 'permissions', 'items'];

      for (const key of allKeys) {
          if (ignoredKeys.includes(key)) continue;

          const oldValue = oldData[key];
          const newValue = newData[key];

          // Use JSON.stringify for a simple but effective deep comparison
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
              let oldStr = oldValue === undefined || oldValue === null || oldValue === '' ? '<i>boş</i>' : String(oldValue);
              let newStr = newValue === undefined || newValue === null || newValue === '' ? '<i>boş</i>' : String(newValue);

              // Truncate long strings for better display
              if (oldStr.length > 50) oldStr = oldStr.substring(0, 47) + '...';
              if (newStr.length > 50) newStr = newStr.substring(0, 47) + '...';

              diffs.push(`<li><strong>${this._translateFieldName(key)}:</strong> <span style="color:#ef4444; text-decoration:line-through;">${oldStr}</span> → <span style="color:#10b981;">${newStr}</span></li>`);
          }
      }

      if (diffs.length === 0) {
          return '<span>Dəyişiklik yoxdur.</span>';
      }

      return `<ul style="list-style-type:none; padding:0; margin:0; font-size:0.9em;">${diffs.join('')}</ul>`;
  }

  // NEW: Helper to translate field names for the diff view
  _translateFieldName(key) {
      const map = {
          name: 'Ad', email: 'Email', phone: 'Telefon', passportNo: 'Pasport №', nationality: 'Milliyyət',
          address: 'Ünvan', birthDate: 'Doğum Tarixi', gender: 'Cins', documentUrl: 'Sənəd URL', createdBy: 'Yaradan',
          number: 'Nömrə', type: 'Növ', category: 'Kateqoriya', capacity: 'Tutum', price: 'Qiymət',
          building: 'Bina', floor: 'Mərtəbə', status: 'Status', amenities: 'İmkanlar', guestId: 'Qonaq ID',
          roomId: 'Otaq ID', checkIn: 'Giriş', checkOut: 'Çıxış', adults: 'Böyük', children: 'Uşaq',
          totalAmount: 'Ümumi Məbləğ', nights: 'Gecə', roomTotal: 'Otaq Cəmi', servicesTotal: 'Xidmət Cəmi',
          selectedServices: 'Seçilmiş Xidmətlər', cancellationReason: 'Ləğv Səbəbi', discountValue: 'Endirim Dəyəri',
          discountType: 'Endirim Növü', externalReference: 'Xarici Referans', source: 'Mənbə',
          commissionAmount: 'Komissiya', serviceType: 'Xidmət Növü', description: 'Təsvir', quantity: 'Miqdar',
          minQuantity: 'Min. Miqdar', unit: 'Vahid', purchasePrice: 'Alış Qiyməti', salePrice: 'Satış Qiyməti',
          telegramId: 'Telegram ID', position: 'Vəzifə', department: 'Şöbə', salary: 'Maaş',
          startDate: 'Başlama Tarixi', role: 'Rol', assignedTo: 'Məsul Şəxs', priority: 'Prioritet',
          dueDate: 'Son Tarix', amount: 'Məbləğ', date: 'Tarix', time: 'Vaxt', staffId: 'İşçi ID',
          reservationId: 'Rezervasiya ID', salaryRecipientId: 'Maaş Alan ID', purchaseDocumentId: 'Alış Sənədi ID',
          posSaleId: 'POS Satış ID', accountId: 'Hesab ID', guestName: 'Qonaq Adı', roomNumber: 'Otaq Nömrəsi',
          items: 'Məhsullar', paymentType: 'Ödəniş Növü', reportType: 'Hesabat Növü', title: 'Başlıq',
          dateFrom: 'Başlanğıc Tarix', dateTo: 'Son Tarix', data: 'Məlumat', generatedBy: 'Hazırlayan',
          key: 'Açar', value: 'Dəyər', action: 'Əməliyyat', entityType: 'Obyekt Növü', entityId: 'Obyekt ID',
          changes: 'Dəyişikliklər', performedBy: 'İcraçı', deviceInfo: 'Qurğu Məlumatı', loginIp: 'IP Ünvanı',
          documentNumber: 'Sənəd №', supplierName: 'Təchizatçı', purchaseDate: 'Alış Tarixi', notes: 'Qeydlər',
          timestamp: 'Vaxt Damğası', message: 'Mesaj', filename: 'Fayl Adı', lineno: 'Sətir №',
          colno: 'Sütun №', errorType: 'Xəta Növü', stack: 'Stack Trace', resolved: 'Həll Edilib',
          resolvedBy: 'Həll Edən', resolvedAt: 'Həll Tarixi', createdBy: 'Qeyd edən',
      };
      return map[key] || key;
  }

  refreshCurrentModule() {
    if (this.currentModule && window.app?.data) {
      this.renderModule(this.currentModule, window.app.data);
    }
  }

  getCurrentDBStatusBlock() {
    const ws = window.app?.ws;
    let preferred = ws?.preferredServerDB || '—', onlineType = ws?.onlineDBType || 'offline', isOnline = ws?.isOnline, hasOnlineDB = ws?.onlineDB ? 'Aktiv' : 'Yoxdur';

    let txt = `<div style="padding:0.3em 0.7em;font-size:1em;background:#f3f4f6;border-radius:.38em;">
            <strong>Sistem Baza Tipi:</strong> <span style="color:#3b82f6;font-weight:600;">${preferred.toUpperCase()}</span><br>
            <strong>Online Sinxronizasiya Tipi:</strong> <span style="color:#10b981;font-weight:600;">${onlineType.toUpperCase()}</span><br>
            <strong>Server Bağlantısı:</strong> <span style="color:${isOnline ? '#10b981':'#ef4444'}">${isOnline ? 'Online' : 'Offline'}</span><br>
            <strong>Online DB Statusu:</strong> <span style="color:${hasOnlineDB==='Aktiv' ? '#10b981':'#ef4444'}">${hasOnlineDB}</span>
        </div>`;
    return txt;
  }

  renderSettingsModern(data) {
    const isSuperadmin = window.app?.isSuperadmin() || false;
    const section = window.__selectedSettingsSection || 'system';

    let sidebarHtml = `
            <nav class="settings-menu">
                <div class="settings-menu-header">
                    <i class="fas fa-cogs"></i> Tənzimləmələr
                </div>
                <ul class="settings-menu-list">
                    <li><button class="settings-menu-btn${section === 'system' ? ' active' : ''}" onclick="window.moduleRenderer.selectSettingsSection('system')"><i class="fas fa-cogs"></i> Sistem</button></li>
                    <li><button class="settings-menu-btn${section === 'business' ? ' active' : ''}" onclick="window.moduleRenderer.selectSettingsSection('business')"><i class="fas fa-briefcase"></i> Biznes/Otel</button></li>
                    <li><button class="settings-menu-btn${section === 'categories' ? ' active' : ''}" onclick="window.moduleRenderer.selectSettingsSection('categories')"><i class="fas fa-tags"></i> Kateqoriyalar</button></li>
                </ul>
            </nav>
        `;
    let mainHtml = `
            <main class="settings-main">
                <div class="settings-content-header">
                    <h3>${this.getSectionTitle(section)}</h3>
                </div>
                <div class="settings-content-body">
                    ${this.renderSettingsSectionContent(section, data)}
                </div>
            </main>
        `;

    return `
            <div class="settings-modern-container">
                ${sidebarHtml}
                ${mainHtml}
            </div>
        `;
  }

  getSectionTitle(sec) {
    const map = {
      system: 'Sistem Parametrləri',
      business: 'Biznes/Otel Məlumatları',
      users: 'İstifadəçilər və İcazələr',
      categories: 'Kateqoriyaların İdarə Edilməsi'
    };
    return map[sec] || 'Tənzimləmələr';
  }

  selectSettingsSection(sectionId) {
    window.__selectedSettingsSection = sectionId;
    if (window.app) window.app.loadModule('settings');
  }

  renderSettingsSectionContent(section, data) {
    if (section === 'system') return this.renderSystemSettings(data);
    if (section === 'business') return this.renderBusinessSettings(data);
    if (section === 'users') return this.renderUserSettings(data);
    if (section === 'categories') return this.renderCategoriesSettings(data);

    return `<div style="padding:2rem;">Modul tapılmadı.</div>`;
  }

  renderBusinessSettings(data) {
    const hotelInfo = window.app?.getSetting('hotelInfo') || {};
    const logoUrl = hotelInfo.logoUrl || '';
    const sealUrl = hotelInfo.sealUrl || '';
    const taxEnabled = hotelInfo.taxEnabled === true;
    const taxRate = hotelInfo.taxRate || 0;

    return `
        <div class="table-container">
            <div class="table-header">
                <h3 class="table-title"><i class="fas fa-briefcase"></i> Biznes/Otel Məlumatları</h3>
            </div>
            <form id="businessSettingsForm" class="form-grid" style="padding: 1.5rem;" onsubmit="return false;">
                <div class="form-group">
                    <label class="form-label required">Otel Adı</label>
                    <input type="text" class="form-input" name="hotelName" value="${hotelInfo.hotelName || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-input" name="email" value="${hotelInfo.email || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Telefon</label>
                    <input type="tel" class="form-input" name="phone" value="${hotelInfo.phone || ''}">
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label">Ünvan</label>
                    <textarea class="form-textarea" name="address" rows="2">${hotelInfo.address || ''}</textarea>
                </div>

                <div class="form-group">
                    <label class="form-label">Logo URL</label>
                    <input type="url" class="form-input" name="logoUrl" value="${logoUrl}" placeholder="https://example.com/logo.png">
                    ${logoUrl ? `<img src="${logoUrl}" alt="Logo Preview" style="max-height: 50px; margin-top: 0.5rem; border-radius: var(--radius-sm);">` : ''}
                </div>
                <div class="form-group">
                    <label class="form-label">Möhür URL (Faktura üçün)</label>
                    <input type="url" class="form-input" name="sealUrl" value="${sealUrl}" placeholder="https://example.com/seal.png">
                    ${sealUrl ? `<img src="${sealUrl}" alt="Seal Preview" style="max-height: 50px; margin-top: 0.5rem; border-radius: var(--radius-sm);">` : ''}
                </div>

                <div class="form-group">
                    <label class="form-label">Vergi Aktivdir</label>
                    <select class="form-select" name="taxEnabled">
                        <option value="true" ${taxEnabled ? 'selected' : ''}>Bəli</option>
                        <option value="false" ${!taxEnabled ? 'selected' : ''}>Xeyr</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Vergi Faizi (%)</label>
                    <input type="number" class="form-input" name="taxRate" min="0" step="0.01" value="${taxRate}">
                </div>
                
                <div class="form-group" style="grid-column: 1 / -1; margin-top: 1rem;">
                    <button type="button" class="btn btn-primary" onclick="window.moduleRenderer.saveBusinessSettings()">
                        <i class="fas fa-save"></i> Məlumatları Yadda Saxla
                    </button>
                </div>
            </form>
        </div>
    `;
  }

  async saveBusinessSettings() {
    try {
        const form = document.getElementById('businessSettingsForm');
        if (!form) throw new Error('Form tapılmadı.');

        const formData = new FormData(form);
        const hotelInfo = {};
        for (const [key, value] of formData.entries()) {
            hotelInfo[key] = value;
        }

        hotelInfo.taxEnabled = hotelInfo.taxEnabled === 'true';
        hotelInfo.taxRate = parseFloat(hotelInfo.taxRate) || 0;

        await window.app.saveSetting('hotelInfo', hotelInfo);
    } catch (error) {
        window.notificationManager?.showNotification('error', 'Xəta', `Məlumatlar yadda saxlanmadı: ${error.message}`);
    }
  }

  handleDBTypeChange(dbTypeStr) {
    localStorage.setItem('serverDBType', dbTypeStr);
    window.notificationManager?.showNotification('info', 'Baza növü dəyişdi', 'Dəyişikliklərin qüvvəyə minməsi üçün səhifəni yeniləyin.');
    window.app?.reinitializeDatabase?.();
  }

  renderSystemSettings(data) {
    const backupPath = localStorage.getItem('backupFolderPath') || '';
    const autoBackupEnabled = localStorage.getItem('autoBackupEnabled') === 'true' ? 'enabled' : 'disabled';
    const backupTime = localStorage.getItem('autoBackupTime') || '03:00';
    return `
            <div class="table-container">
                <div class="table-header"><h3 class="table-title"><i class="fas fa-cogs"></i> Sistem Parametrləri</h3></div>
                <form id="systemSettingsForm" class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Avtomatik Sinxronizasiya</label>
                        <select class="form-select" name="autoSync">
                            <option value="enabled">Aktiv</option>
                            <option value="disabled">Deaktiv</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Bildiriş Səsi</label>
                        <select class="form-select" name="notificationSound" onchange="window.notificationManager.toggleMute(this.value === 'disabled')">
                            <option value="enabled" ${!window.notificationManager?.isMuted ? 'selected' : ''}>Aktiv</option>
                            <option value="disabled" ${window.notificationManager?.isMuted ? 'selected' : ''}>Deaktiv</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Dizayn rejimi</label>
                        <select class="form-select" name="theme" onchange="window.moduleRenderer.toggleDarkMode(this.value)">
                            <option value="auto">Sistemə uyğun</option>
                            <option value="light">Açıq</option>
                            <option value="dark">Qara</option>
                        </select>
                        <small class="form-help" style="color:#888;">Qara rejimi aktiv edin və ya sistemə uyğun saxlayın</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Yeniləmə kanalı</label>
                        <select class="form-select" name="updateChannel">
                            <option value="stable">Sabit (Stable)</option>
                            <option value="beta">Beta</option>
                            <option value="dev">Proqramçı (Dev)</option>
                        </select>
                        <small class="form-help" style="color:#888;">Yeniləmələrin tezliyinə uyğun kanalı seçin</small>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Yedəkləmə Qovluğu (yalnız Electron üçün)</label>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="text" class="form-input" id="backupFolderPath" value="${backupPath}" readonly placeholder="Yedəkləmə qovluğu seçin">
                            <button type="button" class="btn btn-secondary" onclick="window.app.selectBackupFolder()">
                                <i class="fas fa-folder-open"></i> Seç
                            </button>
                        </div>
                        <small class="form-help" style="color:#b6bac8;">PNG, JPG desteklenir. Kvadrat şəkil tövsiyə olunur.</small>
                        <div id="logoUploadProgress" style="display: none; margin-top: 0.5rem;">
                            <div style="background: #f1f5f9; border-radius: 0.5rem; overflow: hidden;">
                                <div id="logoProgressBar" style="height: 6px; background: #3b82f6; width: 0%; transition: width 0.3s ease;"></div>
                            </div>
                            <small style="color: #64748b; margin-top: 0.25rem; display: block;">Yüklənir...</small>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Avtomatik Yedəkləmə</label>
                        <select class="form-select" id="autoBackupEnabled" onchange="window.app.toggleAutoBackup(this.value)">
                            <option value="enabled" ${autoBackupEnabled === 'enabled' ? 'selected' : ''}>Aktiv</option>
                            <option value="disabled" ${autoBackupEnabled === 'disabled' ? 'selected' : ''}>Deaktiv</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Yedəkləmə Vaxtı</label>
                        <input type="time" class="form-input" id="autoBackupTime" value="${backupTime}" onchange="window.app.setAutoBackupTime(this.value)">
                        <small class="form-help" style="color:#888;">Hər gün yedəkləmənin aparılacağı vaxtı.</small>
                    </div>
                </form>
                <div style="margin-top:2rem; display: flex; flex-direction: column; gap: 0.7rem;">
                    <button class="btn btn-secondary" onclick="window.moduleRenderer.showAboutModal()">
                        <i class="fas fa-info-circle"></i> RB Hotel PMS Haqqında
                    </button>
                </div>
            </div>
        `;
  }

  toggleDarkMode(value) {
    if (typeof value !== "string" || value === "auto") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("pms_theme");
    } else {
      document.documentElement.setAttribute("data-theme", value);
      localStorage.setItem("pms_theme", value);
    }
  }

  showAboutModal() {
    const version = document.getElementById('appVersionFooter')?.querySelector('span')?.innerText.split('Versiya: ')[1] || '15.2';
    const info = `
            <div style="text-align: center; padding:1em;">
                <img src="assets/appicon.png" style="width:72px;margin-bottom:1em;" alt="App Icon"><br>
                <h2 style="color:#3b82f6;margin:0.3em 0 0 0;font-size:1.8em;">RB Hotel PMS</h2>
                <div style="color:#64748b;font-size:1.1em;">Otel İdarəetmə Sistemi</div>
                <div style="color:#64748b;margin-bottom:1em;">
                  <b>Versiya:</b> ${version}
                </div>
                <div style="font-size:1em;color:#1e293b;">
                    <b>Bütün hüquqlar qorunur.</b><br>
                    &copy; 2023-${new Date().getFullYear()} RB Hotel PMS Team<br>
                    <a href="mailto:info@otelpms.az" style="color:#3b82f6;text-decoration:none;">info@otelpms.az</a>
                </div>
                <div style="margin-top:1.5em;font-size:0.9em;color:#64748b;">Bu proqram RB Hotel üçün hazırlanmışdır. Əlavə informasiya və texniki dəstək üçün yuxarıdakı email ünvanına müraciət edin.</div>
            </div>
        `;
    window.modalManager.showModal('Haqqında - RB Hotel PMS', info, `<button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>`);
  }

  renderUserSettings(data) {
    // THIS IS DEPRECATED. Users will be directed to the main 'Staff' module.
    // Kept here for backward compatibility but should not be used in the new UI.
    return `
        <div class="table-container">
            <div class="table-header">
                <h3 class="table-title">İstifadəçilər və İcazələr</h3>
            </div>
            <div style="padding: 1.5rem; text-align: center;">
                <p>İstifadəçilərin idarə edilməsi üçün sol menyudakı <a href="#" onclick="window.app.loadModule('staff')">'İşçilər'</a> bölməsinə keçin.</p>
            </div>
        </div>
    `;
  }

  renderCategoriesSettings(data) {
      const serviceCategories = window.app?.getSetting('serviceCategories') || [];
      const inventoryCategories = window.app?.getSetting('inventoryCategories') || [];
      const roomTypes = window.app?.getSetting('roomTypes') || [];
      const roomCategories = window.app?.getSetting('roomCategories') || [];
      const cashIncomeCategories = window.app?.getSetting('cashIncomeCategories') || [];
      const cashExpenseCategories = window.app?.getSetting('cashExpenseCategories') || [];

      return `
          <div class="table-container">
              <div class="table-header"><h3 class="table-title"><i class="fas fa-tags"></i> Kateqoriyalar</h3></div>
              <div id="categorySettingsContainer" class="form-grid" style="padding: 1.5rem;">
                  <!-- Service Categories -->
                  <div class="operational-card">
                      <div class="card-header"><h5 class="card-title">Xidmət Kateqoriyaları</h5></div>
                      <div id="serviceCategoriesList" class="category-inline-list">
                          ${serviceCategories.map(cat => this.renderCategoryChip('serviceCategories', cat)).join('')}
                      </div>
                      <div class="category-chip-input-wrapper">
                          <input type="text" id="newServiceCategory" class="form-input" placeholder="Yeni kateqoriya...">
                          <button class="btn btn-primary btn-sm" onclick="window.moduleRenderer.addCategory('serviceCategories', document.getElementById('newServiceCategory').value)">
                              <i class="fas fa-plus"></i>
                          </button>
                      </div>
                  </div>

                  <!-- Inventory Categories -->
                  <div class="operational-card">
                      <div class="card-header"><h5 class="card-title">Anbar Kateqoriyaları</h5></div>
                      <div id="inventoryCategoriesList" class="category-inline-list">
                          ${inventoryCategories.map(cat => this.renderCategoryChip('inventoryCategories', cat)).join('')}
                      </div>
                      <div class="category-chip-input-wrapper">
                          <input type="text" id="newInventoryCategory" class="form-input" placeholder="Yeni kateqoriya...">
                          <button class="btn btn-primary btn-sm" onclick="window.moduleRenderer.addCategory('inventoryCategories', document.getElementById('newInventoryCategory').value)">
                              <i class="fas fa-plus"></i>
                          </button>
                      </div>
                  </div>
                  
                  <!-- Room Types -->
                  <div class="operational-card">
                      <div class="card-header"><h5 class="card-title">Otaq Növləri</h5></div>
                      <div id="roomTypesList" class="category-inline-list">
                          ${roomTypes.map(cat => this.renderCategoryChip('roomTypes', cat)).join('')}
                      </div>
                      <div class="category-chip-input-wrapper">
                          <input type="text" id="newRoomType" class="form-input" placeholder="Yeni növ...">
                          <button class="btn btn-primary btn-sm" onclick="window.moduleRenderer.addCategory('roomTypes', document.getElementById('newRoomType').value)">
                              <i class="fas fa-plus"></i>
                          </button>
                      </div>
                  </div>

                  <!-- Room Categories -->
                  <div class="operational-card">
                      <div class="card-header"><h5 class="card-title">Otaq Kateqoriyaları</h5></div>
                      <div id="roomCategoriesList" class="category-inline-list">
                          ${roomCategories.map(cat => this.renderCategoryChip('roomCategories', cat)).join('')}
                      </div>
                      <div class="category-chip-input-wrapper">
                          <input type="text" id="newRoomCategory" class="form-input" placeholder="Yeni kateqoriya...">
                          <button class="btn btn-primary btn-sm" onclick="window.moduleRenderer.addCategory('roomCategories', document.getElementById('newRoomCategory').value)">
                              <i class="fas fa-plus"></i>
                          </button>
                      </div>
                  </div>
                  
                  <!-- Cash Income Categories -->
                  <div class="operational-card">
                      <div class="card-header"><h5 class="card-title">Kassa Gəlir Kateqoriyaları</h5></div>
                      <div id="cashIncomeCategoriesList" class="category-inline-list">
                          ${cashIncomeCategories.map(cat => this.renderCategoryChip('cashIncomeCategories', cat)).join('')}
                      </div>
                      <div class="category-chip-input-wrapper">
                          <input type="text" id="newCashIncomeCategory" class="form-input" placeholder="Yeni kateqoriya...">
                          <button class="btn btn-primary btn-sm" onclick="window.moduleRenderer.addCategory('cashIncomeCategories', document.getElementById('newCashIncomeCategory').value)">
                              <i class="fas fa-plus"></i>
                          </button>
                      </div>
                  </div>
                  
                  <!-- Cash Expense Categories -->
                  <div class="operational-card">
                      <div class="card-header"><h5 class="card-title">Kassa Xərc Kateqoriyaları</h5></div>
                      <div id="cashExpenseCategoriesList" class="category-inline-list">
                          ${cashExpenseCategories.map(cat => this.renderCategoryChip('cashExpenseCategories', cat)).join('')}
                      </div>
                      <div class="category-chip-input-wrapper">
                          <input type="text" id="newCashExpenseCategory" class="form-input" placeholder="Yeni kateqoriya...">
                          <button class="btn btn-primary btn-sm" onclick="window.moduleRenderer.addCategory('cashExpenseCategories', document.getElementById('newCashExpenseCategory').value)">
                              <i class="fas fa-plus"></i>
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      `;
  }

  renderCategoryChip(settingKey, categoryName) {
      // Escape single quotes for the onclick handler
      const safeCategoryName = categoryName.replace(/'/g, "\\'");
      return `
          <div class="category-chip">
              <span>${categoryName}</span>
              <button class="category-chip-delete" onclick="window.moduleRenderer.removeCategory('${settingKey}', '${safeCategoryName}')">
                  &times;
              </button>
          </div>
      `;
  }

  async addCategory(settingKey, categoryName) {
      if (!categoryName || categoryName.trim() === '') return;
      categoryName = categoryName.trim();

      let currentCategories = window.app?.getSetting(settingKey) || [];
      if (!Array.isArray(currentCategories)) currentCategories = [];
      
      if (currentCategories.find(c => c.toLowerCase() === categoryName.toLowerCase())) {
          window.notificationManager?.showNotification('warning', 'Təkrarlanan Kateqoriya', 'Bu kateqoriya artıq mövcuddur.');
          return;
      }
      
      currentCategories.push(categoryName);
      await window.app?.saveSetting(settingKey, currentCategories);
      this.refreshCurrentModule(); // Re-render the settings module to show the new category
  }

  async removeCategory(settingKey, categoryName) {
      let currentCategories = window.app?.getSetting(settingKey) || [];
      if (!Array.isArray(currentCategories)) currentCategories = [];

      const newCategories = currentCategories.filter(c => c !== categoryName);
      
      await window.app?.saveSetting(settingKey, newCategories);
      this.refreshCurrentModule();
  }

  escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  escapeAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  roleLabel(role) {
    return role === "superadmin" ?
      "SuperAdmin" :
      role === "admin" ?
      "Admin" :
      role === "manager" ?
      "Menecer" :
      "İşçi";
  }

  changeUserRole(userId, newRole) {
    if (!userId) return;
    const staff = window.app?.data?.staff?.find(s => s.id === userId);
    if (!staff) return;
    if (staff.role === newRole) return;
    // The detailed permission checks for role changes (e.g., preventing non-superadmins from
    // changing superadmin roles, or demoting admins) are handled robustly within
    // the `window.app.updateStaff` method itself.
    // This direct check is removed to centralize the complex role permission logic in `app.js`.
    // if ((newRole === "admin" || staff.role === "admin") && !(window.app?.isSuperadmin && window.app.isSuperadmin())) {
    //   window.notificationManager?.showNotification('error', 'Səlahiyyət yoxdur', 'Yalnız superadmin admin rolunu təyin edə bilər.');
    //   return;
    // }
    window.app.updateStaff(userId, { ...staff, role: newRole }).then(() => {
        window.notificationManager?.showNotification('success', 'Rol dəyişdi', 'İstifadəçi rolu uğurla dəyişdirildi.');
        window.app.refreshData('staff');
        window.app.refreshCurrentModule();
    }).catch(error => {
        window.notificationManager?.showNotification('error', 'Rol Dəyişmə Xətası', error.message || 'Rol dəyişdirilmədi.');
    });
  }

  superadminUserSearch(value) {
    window.__superadminUserFilter = value || '';
    if (window.app) window.app.loadModule('superadmin_panel');
  }

  showUserPermissions(userId) {
    if (window.modalManager && window.modalManager.showUserPermissions) {
      window.modalManager.showUserPermissions(userId);
    }
  }

  renderSuperadminPanel(data) {
    if (!window.app?.isSuperadmin()) {
        return `<div class="system-error-card" style="padding: 2rem; text-align: center;"><h2>İcazə Yoxdur</h2><p>Bu bölməyə giriş üçün Superadmin olmalısınız.</p></div>`;
    }

    const section = window.__selectedSuperadminSection || 'dashboard';

    const sidebarHtml = `
        <nav class="settings-menu">
            <div class="settings-menu-header"><i class="fas fa-shield-alt"></i> Superadmin Panel</div>
            <ul class="settings-menu-list">
                <li><button class="settings-menu-btn${section === 'dashboard' ? ' active' : ''}" onclick="window.moduleRenderer.selectSuperadminSection('dashboard')"><i class="fas fa-chart-pie"></i> Panel</button></li>
                <li><button class="settings-menu-btn${section === 'users' ? ' active' : ''}" onclick="window.moduleRenderer.selectSuperadminSection('users')"><i class="fas fa-users-cog"></i> İstifadəçilər</button></li>
                <li><button class="settings-menu-btn${section === 'errors' ? ' active' : ''}" onclick="window.moduleRenderer.selectSuperadminSection('errors')"><i class="fas fa-bug"></i> Sistem Xətaları</button></li>
                <li><button class="settings-menu-btn${section === 'data' ? ' active' : ''}" onclick="window.moduleRenderer.selectSuperadminSection('data')"><i class="fas fa-database"></i> Məlumatlar</button></li>
                <li><button class="settings-menu-btn${section === 'rules' ? ' active' : ''}" onclick="window.moduleRenderer.selectSuperadminSection('rules')"><i class="fas fa-fire"></i> Firebase Qaydaları</button></li>
                <li><button class="settings-menu-btn${section === 'integrations' ? ' active' : ''}" onclick="window.moduleRenderer.selectSuperadminSection('integrations')"><i class="fas fa-plug"></i> İnteqrasiyalar</button></li>
                <li><button class="settings-menu-btn${section === 'audit' ? ' active' : ''}" onclick="window.moduleRenderer.selectSuperadminSection('audit')"><i class="fas fa-history"></i> Audit Jurnalı</button></li>
            </ul>
        </nav>
    `;

    const mainHtml = `
        <main class="settings-main">
            <div class="settings-content-header"><h3>${this.getSuperadminSectionTitle(section)}</h3></div>
            <div class="settings-content-body">
                ${this.renderSuperadminSectionContent(section, data)}
            </div>
        </main>
    `;

    return `<div class="settings-modern-container">${sidebarHtml}${mainHtml}</div>`;
  }

  selectSuperadminSection(sectionId) {
    window.__selectedSuperadminSection = sectionId;
    if (window.app) window.app.loadModule('superadmin_panel');
  }

  getSuperadminSectionTitle(section) {
      const map = {
          dashboard: 'Superadmin Paneli',
          users: 'İstifadəçi İdarəetməsi',
          errors: 'Sistem Xətaları Jurnalı',
          data: 'Məlumatların İdarə Edilməsi',
          rules: 'Firebase Təhlükəsizlik Qaydaları',
          integrations: 'İnteqrasiyalar',
          audit: 'Audit Jurnalı'
      };
      return map[section] || 'Superadmin Panel';
  }

  renderSuperadminSectionContent(section, data) {
      switch (section) {
          case 'dashboard': return this.renderSuperadminDashboard(data);
          case 'users': return this.renderSuperadminUsers(data);
          case 'errors': return this.renderSystemErrors(data);
          case 'data': return this.renderSuperadminDataManagement(data);
          case 'rules': return this.renderSuperadminFirebaseRules(data);
          case 'integrations': return this.renderSuperadminIntegrations(data);
          case 'audit': return this.renderSuperadminAuditLog(data);
          default: return `<p>Bölmə tapılmadı.</p>`;
      }
  }

  renderSuperadminDashboard(data) {
    const dbStatus = this.getCurrentDBStatusBlock();
    return `
        <div class="dashboard-grid">
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">İstifadəçilər</div>
                    <div class="stat-card-icon" style="background-color:#3b82f6;"><i class="fas fa-users"></i></div>
                </div>
                <div class="stat-card-value">${(data.staff || []).length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">Rezervasiyalar</div>
                    <div class="stat-card-icon" style="background-color:#10b981;"><i class="fas fa-calendar-check"></i></div>
                </div>
                <div class="stat-card-value">${(data.reservations || []).length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">Sinx. Növbəsi</div>
                    <div class="stat-card-icon" style="background-color:#f59e0b;"><i class="fas fa-sync"></i></div>
                </div>
                <div class="stat-card-value">${window.app?.ws?.syncQueue?.length || 0}</div>
            </div>
             <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">Sistem Xətaları</div>
                    <div class="stat-card-icon" style="background-color:#ef4444;"><i class="fas fa-bug"></i></div>
                </div>
                <div class="stat-card-value">${(data.systemErrors || []).filter(e => !e.resolved).length}</div>
            </div>
        </div>
        <div class="table-container" style="margin-top: 1.5rem;">
            <div class="table-header"><h3 class="table-title">Baza Statusu</h3></div>
            <div style="padding: 1.5rem;">
                ${dbStatus}
                <div style="margin-top: 1rem;">
                    <button class="btn btn-secondary" onclick="window.modalManager.showConnectionStatus()"><i class="fas fa-network-wired"></i> Ətraflı Status</button>
                </div>
            </div>
        </div>
    `;
  }

  renderSuperadminUsers(data) {
    const staff = data.staff || [];
    const currentUser = window.authManager.getCurrentUser();

    const total = staff.length;
    const superadmins = staff.filter(s => s.isSuperadmin).length;
    const admins = staff.filter(s => s.role === 'admin').length;
    const managers = staff.filter(s => s.role === 'manager').length;
    const workers = staff.filter(s => s.role !== 'admin' && s.role !== 'manager' && s.role !== 'superadmin');
    const inactive = staff.filter(s => s.status === 'inactive').length;

    const filterText = (window.__superadminUserFilter || '').toString().toLowerCase();
    const filtered = filterText
        ? staff.filter(s =>
            (s.name || '').toLowerCase().includes(filterText) ||
            (s.email || '').toLowerCase().includes(filterText) ||
            (s.publicId || '').toString().toLowerCase().includes(filterText) ||
            (s.role || '').toLowerCase().includes(filterText) ||
            (s.department || '').toLowerCase().includes(filterText) ||
            (s.telegramId || '').toLowerCase().includes(filterText))
        : staff;

    const rows = filtered.map(user => {
        const isSelf = user.id === currentUser.uid;
        const roleSelect = isSelf || user.isSuperadmin
            ? `<span class="role-badge role-${user.role || 'staff'}">${this.roleLabel(user.role) || '—'}</span>`
            : `<select class="form-select form-select-sm role-select" data-uid="${user.id}" data-current="${user.role || ''}" onchange="window.moduleRenderer.changeUserRole('${user.id}', this.value)">
                    <option value="staff" ${user.role === 'staff' || !user.role ? 'selected' : ''}>${this.roleLabel('staff')}</option>
                    <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>${this.roleLabel('manager')}</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>${this.roleLabel('admin')}</option>
                </select>`;

        return `
        <tr>
            <td class="mono-cell">${user.publicId || user.id.slice(0, 8)}</td>
            <td>${user.name}<div class="user-sub">${user.department ? this.escapeHtml(user.department) : ''}${user.position ? ' · ' + this.escapeHtml(user.position) : ''}</div></td>
            <td>${user.email}</td>
            <td>
                <span class="role-badge role-${user.role || 'staff'}">${this.roleLabel(user.role)}</span>
                ${user.isSuperadmin ? '<span class="role-badge role-superadmin">SuperAdmin</span>' : ''}
            </td>
            <td>${roleSelect}</td>
            <td>
                <label class="switch">
                    <input type="checkbox" ${user.isSuperadmin ? 'checked' : ''} onchange="window.app.toggleSuperadminStatus('${user.id}', this.checked)" ${isSelf ? 'disabled' : ''}>
                    <span class="slider round"></span>
                </label>
            </td>
            <td>
                <select class="form-select form-select-sm" onchange="window.app.changeUserStatus('${user.id}', this.value)" ${user.isSuperadmin && !window.app.isSuperadmin() ? 'disabled' : ''}>
                    <option value="active" ${user.status === 'active' ? 'selected' : ''}>Aktiv</option>
                    <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Deaktiv</option>
                </select>
            </td>
            <td>
                <button class="btn btn-secondary btn-xs" title="Ətraflı" onclick="window.modalManager.showUserDetails('${user.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn btn-secondary btn-xs" title="İcazələr" onclick="window.modalManager.showUserPermissions('${user.id}')"><i class="fas fa-key"></i></button>
            </td>
        </tr>
    `;
    }).join('');

    return `
        <div class="sa-stats">
            <div class="sa-stat"><div class="sa-stat-value">${total}</div><div class="sa-stat-label">Ümumi</div></div>
            <div class="sa-stat" style="--c:#8b5cf6;"><div class="sa-stat-value">${superadmins}</div><div class="sa-stat-label">Superadmin</div></div>
            <div class="sa-stat" style="--c:#ef4444;"><div class="sa-stat-value">${admins}</div><div class="sa-stat-label">Admin</div></div>
            <div class="sa-stat" style="--c:#f59e0b;"><div class="sa-stat-value">${managers}</div><div class="sa-stat-label">Menecer</div></div>
            <div class="sa-stat" style="--c:#3b82f6;"><div class="sa-stat-value">${workers.length}</div><div class="sa-stat-label">İşçi</div></div>
            <div class="sa-stat" style="--c:#ef4444;"><div class="sa-stat-value">${inactive}</div><div class="sa-stat-label">Deaktiv</div></div>
        </div>
        <div class="table-container">
            <div class="table-header">
                <h3 class="table-title">İstifadəçilər <span class="table-count">${filtered.length}/${total}</span></h3>
                <div class="table-tools">
                    <input class="form-control sa-search" type="search" placeholder="Axtar: ad, email, ID, rol, şöbə..." value="${this.escapeAttr(filterText)}" oninput="window.moduleRenderer.superadminUserSearch(this.value)">
                </div>
            </div>
            <div style="overflow-x:auto;">
                ${filtered.length === 0
                    ? `<div class="empty-state"><i class="fas fa-user-slash"></i> İstifadəçi tapılmadı</div>`
                    : `<table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Ad</th>
                            <th>Email</th>
                            <th>Rol</th>
                            <th>Rol Təyinatı</th>
                            <th>Superadmin</th>
                            <th>Status</th>
                            <th>Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`}
            </div>
        </div>
        <style>
            .mono-cell { font-family: ui-monospace, monospace; font-size: 0.85em; }
            .user-sub { font-size: 0.78em; color: var(--muted-color, #64748b); margin-top: 2px; }
            .table-count { font-size: 0.75em; color: var(--muted-color, #64748b); font-weight: normal; margin-left: 0.5em; }
            .table-tools { margin-left: auto; }
            .sa-search { min-width: 260px; }
            .empty-state { padding: 2.5rem; text-align: center; color: var(--muted-color, #64748b); }
            .empty-state i { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
            .sa-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
            .sa-stat { background: var(--card-bg, #fff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 0.75rem; padding: 0.9rem 1rem; text-align: center; }
            .sa-stat-value { font-size: 1.5rem; font-weight: 700; color: var(--c, #3b82f6); }
            .sa-stat-label { font-size: 0.8em; color: var(--muted-color, #64748b); margin-top: 2px; }
            .role-badge { display: inline-block; padding: 0.2em 0.6em; border-radius: 999px; font-size: 0.75em; font-weight: 600; background: #e2e8f0; color: #334155; margin-right: 4px; }
            .role-badge.role-superadmin { background: #8b5cf6; color: #fff; }
            .role-badge.role-admin { background: #ef4444; color: #fff; }
            .role-badge.role-manager { background: #f59e0b; color: #fff; }
            .role-badge.role-staff { background: #3b82f6; color: #fff; }
            .role-select { min-width: 120px; }
            .switch { position: relative; display: inline-block; width: 40px; height: 24px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; }
            .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; }
            input:checked + .slider { background-color: var(--primary-color); }
            input:checked + .slider:before { transform: translateX(16px); }
            .slider.round { border-radius: 34px; }
            .slider.round:before { border-radius: 50%; }
        </style>
    `;
  }
  
  renderSuperadminDataManagement(data) {
    return `
        <div class="table-container">
            <div class="table-header"><h3 class="table-title">Məlumatların İdarə Edilməsi</h3></div>
            <div class="report-grid" style="padding: 1.5rem;">
                <div class="operational-card clickable" onclick="window.app.exportAllData()">
                    <div class="card-header"><h5 class="card-title"><i class="fas fa-file-export" style="color:#10b981;"></i> Bütün Məlumatları Export Et</h5></div>
                    <p>Bütün otel məlumatlarını (qonaqlar, rezervasiyalar, anbar və s.) JSON faylı kimi yadda saxlayın.</p>
                </div>
                <div class="operational-card clickable" onclick="window.app.importAllData()">
                    <div class="card-header"><h5 class="card-title"><i class="fas fa-file-import" style="color:#3b82f6;"></i> Məlumatları Import Et</h5></div>
                    <p>Əvvəl export edilmiş JSON faylından bütün məlumatları bərpa edin. Diqqət: Mövcud məlumatlar dəyişdirilə bilər.</p>
                </div>
                <div class="operational-card clickable danger-zone-section" onclick="window.modalManager.showWipeDataModal()">
                    <div class="card-header"><h5 class="card-title" style="color:#ef4444;"><i class="fas fa-eraser"></i> Məlumatları Təmizlə</h5></div>
                    <p>Bütün otel məlumatlarını (lokal və server) silin. Bu əməliyyat geri qaytarıla bilməz.</p>
                </div>
            </div>
        </div>
    `;
  }

  renderSuperadminFirebaseRules(data) {
    const firebaseRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function getStaffData(uid) {
      return get(/databases/$(database)/documents/staff/$(uid)).data;
    }
    function isSuperadmin(uid) {
      return getStaffData(uid).isSuperadmin == true;
    }
    function isAdmin(uid) {
      return getStaffData(uid).role == 'admin' || isSuperadmin(uid);
    }
    function isManager(uid) {
      return getStaffData(uid).role == 'manager' || isAdmin(uid);
    }
    function isSignedInStaff() {
      return request.auth != null && exists(/databases/$(database)/documents/staff/$(request.auth.uid));
    }
    function targetIsSuperadmin(targetUid) {
        return get(/databases/$(database)/documents/staff/$(targetUid)).data.isSuperadmin == true;
    }

    // 1. Staff Collection
    match /staff/{userId} {
      allow read: if isSignedInStaff();
      // A new user can create their own staff profile upon first login.
      allow create: if request.auth.uid == userId;
      // Admins/Superadmins can create/update/delete staff members.
      allow update: if isSuperadmin(request.auth.uid) ||
                       (isAdmin(request.auth.uid) && !targetIsSuperadmin(userId)) ||
                       (request.auth.uid == userId); // Users can update their own profile
      allow delete: if isSuperadmin(request.auth.uid) ||
                       (isAdmin(request.auth.uid) && !targetIsSuperadmin(userId));
    }

    // 2. Settings, Audit Logs, System Errors
    match /(settings|audit_logs|system_errors)/{docId} {
      allow read: if isSignedInStaff();
      allow write: if isAdmin(request.auth.uid);
    }

    // 3. Diagnostics collection for connection checks
    match /diagnostics/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // 4. All other core business collections
    match /{collection}/{docId} {
      allow read: if isSignedInStaff();
      allow write, delete: if isAdmin(request.auth.uid) || 
                             isManager(request.auth.uid);
      // Staff can create/update some collections but not delete most of them.
      allow create, update: if getStaffData(request.auth.uid).role == 'staff' &&
        collection in [
          'guests', 'reservations', 'maintenance', 'pos_sales', 'cash_transactions'
        ];
    }
  }
}
    `.trim();

    return `
        <div class="table-container">
            <div class="table-header">
                <h3 class="table-title">Tövsiyə olunan Firebase Təhlükəsizlik Qaydaları</h3>
                <button class="btn btn-secondary" onclick="window.moduleRenderer.copyFirebaseRules()"><i class="fas fa-copy"></i> Qaydaları Kopyala</button>
            </div>
            <div style="padding: 1.5rem;">
                <p>Məlumat təhlükəsizliyini təmin etmək üçün Firebase layihənizin Firestore > Rules bölməsində aşağıdakı qaydaları tətbiq etməyiniz tövsiyə olunur.</p>
                <pre id="firebaseRulesContent" style="background: var(--background-color); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; white-space: pre-wrap; word-break: break-all; font-size: 0.85em; max-height: 60vh; overflow-y: auto;"><code>${firebaseRules.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
            </div>
        </div>
    `;
  }

  copyFirebaseRules() {
    const rulesContent = document.getElementById('firebaseRulesContent')?.textContent;
    if (rulesContent) {
        navigator.clipboard.writeText(rulesContent).then(() => {
            window.notificationManager?.showNotification('success', 'Kopyalandı', 'Firebase qaydaları panoya kopyalandı.', 2000);
        }).catch(err => {
            console.error('Failed to copy Firebase rules:', err);
            window.notificationManager?.showNotification('error', 'Xəta', 'Qaydalar kopyalana bilmədi. Konsolu yoxlayın.');
        });
    }
  }

  copySystemErrorDetails(errorId) {
    const error = window.app?.data?.systemErrors?.find(e => e.id === errorId);
    if (!error) {
        window.notificationManager?.showNotification('error', 'Xəta tapılmadı', 'Kopyalamaq üçün xəta məlumatı tapılmadı.');
        return;
    }

    const detailsToCopy = `
--- System Error Details ---
ID: ${error.publicId || error.id}
Timestamp: ${error.timestamp}
Type: ${error.errorType}
Message: ${error.message}
File: ${error.filename || 'N/A'}
Line: ${error.lineno || 'N/A'}
Column: ${error.colno || 'N/A'}
User: ${error.performedBy || 'N/A'}
--- Stack Trace ---
${error.stack || 'No stack trace available.'}
    `.trim().replace(/^    /gm, ''); // Trim and remove leading spaces from multiline string

    navigator.clipboard.writeText(detailsToCopy).then(() => {
        window.notificationManager?.showNotification('success', 'Kopyalandı', 'Xəta məlumatları panoya kopyalandı.', 2000);
    }).catch(err => {
        console.error('Failed to copy error details:', err);
        window.notificationManager?.showNotification('error', 'Xəta', 'Məlumatlar kopyalana bilmədi. Konsolu yoxlayın.');
    });
  }

  saveCustomVersion() {
    const input = document.getElementById('customVersionInput');
    if (input) {
        const newVersion = input.value.trim();
        localStorage.setItem('customAppVersion', newVersion);
        window.notificationManager?.showNotification('success', 'Versiya yadda saxlandı', `Yeni versiya: ${newVersion || 'standart'}`);
        if (window.app) {
            window.app.updateAppVersionDisplay();
        }
    }
  }

  resetCustomVersion() {
    const input = document.getElementById('customVersionInput');
    if (input) {
        input.value = '';
    }
    localStorage.removeItem('customAppVersion');
    window.notificationManager?.showNotification('info', 'Versiya sıfırlandı', 'Sistem standart versiyaya qayıtdı.');
    if (window.app) {
        window.app.updateAppVersionDisplay();
    }
  }

  applyAuditFilters() {
      window._auditFilters = {
          performer: document.getElementById('auditPerformerFilter')?.value,
          action: document.getElementById('auditActionFilter')?.value,
          entityType: document.getElementById('auditEntityFilter')?.value,
          dateFrom: document.getElementById('auditDateFromFilter')?.value,
          dateTo: document.getElementById('auditDateToFilter')?.value,
      };
      if (window.app) window.app.loadModule('superadmin_panel');
      window.moduleRenderer.selectSuperadminSection('audit'); // Ensure correct tab
  }

  resetAuditFilters() {
      window._auditFilters = {};
      if (window.app) window.app.loadModule('superadmin_panel');
      window.moduleRenderer.selectSuperadminSection('audit');
  }

  renderSystemErrors(data) {
    let errors = data.systemErrors || [];
    
    const filters = window._systemErrorFilters || {};
    const resolvedFilter = filters.resolved || 'unresolved'; 
    const searchFilter = filters.search || '';

    let filteredErrors = errors.slice();
    if (resolvedFilter === 'unresolved') {
        filteredErrors = filteredErrors.filter(err => !err.resolved);
    } else if (resolvedFilter === 'resolved') {
        filteredErrors = filteredErrors.filter(err => err.resolved);
    }

    if (searchFilter) {
        const lowerSearch = searchFilter.toLowerCase();
        filteredErrors = filteredErrors.filter(err =>
            (err.message && err.message.toLowerCase().includes(lowerSearch)) ||
            (err.errorType && err.errorType.toLowerCase().includes(lowerSearch)) ||
            (err.stack && err.stack.toLowerCase().includes(lowerSearch))
        );
    }

    filteredErrors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return `
        <div class="error-log-card">
            <div class="error-log-header">
                <h3 class="error-log-title"><i class="fas fa-bug"></i> Sistem Xətaları (${filteredErrors.length} tapıldı)</h3>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <select class="form-select" style="max-width:120px;" onchange="window.moduleRenderer.applySystemErrorFilters('resolved', this.value)">
                        <option value="unresolved" ${resolvedFilter === 'unresolved' ? 'selected' : ''}>Həll olunmayıb</option>
                        <option value="resolved" ${resolvedFilter === 'resolved' ? 'selected' : ''}>Həll olunub</option>
                        <option value="all" ${resolvedFilter === 'all' ? 'selected' : ''}>Hamısı</option>
                    </select>
                    <input type="search" class="form-input" placeholder="Axtar..." value="${searchFilter}"
                           oninput="window.moduleRenderer._debounceInstance.call(window.moduleRenderer, window.moduleRenderer.applySystemErrorFilters, 300)('search', this.value)" style="max-width:150px;">
                    <button class="btn btn-secondary" onclick="window.moduleRenderer.resetSystemErrorFilters()"><i class="fas fa-times"></i> Sıfırla</button>
                    <button class="btn btn-secondary" onclick="window.app.clearAllResolvedSystemErrors()"><i class="fas fa-trash"></i> Həll olanları sil</button>
                </div>
            </div>
            <div style="overflow-x:auto;">
                <table class="error-log-table">
                    <thead>
                        <tr>
                            <th style="min-width: 140px;">Zaman</th>
                            <th style="min-width: 100px;">Tip</th>
                            <th style="min-width: 300px;">Mesaj</th>
                            <th style="min-width: 350px;">Stack Trace</th>
                            <th style="min-width: 120px;">Status</th>
                            <th style="min-width: 100px;">Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredErrors.length === 0 ? `
                            <tr><td colspan="6" class="text-center" style="color:#64748b;padding:2em;">Xəta qeydi tapılmadı.</td></tr>
                        ` : filteredErrors.map(error => `
                            <tr>
                                <td>${window.app?.formatDate(error.timestamp, true)}</td>
                                <td>${error.errorType || 'Unknown'}</td>
                                <td class="error-message-col" title="${error.message}">${error.message.substring(0,120)}${error.message.length > 120 ? '...' : ''}</td>
                                <td class="error-stack-col" title="${error.stack}">
                                    ${error.stack ? error.stack.substring(0, 150) + (error.stack.length > 150 ? '...' : '') : 'N/A'}
                                </td>
                                <td>
                                    <span class="error-status-badge status-${error.resolved ? 'resolved' : 'unresolved'}">
                                        ${error.resolved ? 'Həll olunub' : 'Həll olunmayıb'}
                                    </span>
                                    ${error.resolvedBy ? `<br><small style="color:#64748b;">(${error.resolvedBy})</small>` : ''}
                                </td>
                                <td>
                                    ${!error.resolved ? `
                                        <button class="btn btn-secondary btn-xs" onclick="window.app.resolveSystemError('${error.id}')" title="Həll et">
                                            <i class="fas fa-check"></i>
                                        </button>
                                    ` : `
                                        <button class="btn btn-secondary btn-xs" onclick="window.app.unresolveSystemError('${error.id}')" title="Geri al">
                                            <i class="fas fa-redo"></i>
                                        </button>
                                    `}
                                    <button class="btn btn-secondary btn-xs" onclick="window.moduleRenderer.copySystemErrorDetails('${error.id}')" title="Xətanı kopyala">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                    <button class="btn btn-secondary btn-xs" onclick="window.app.deleteSystemError('${error.id}')" title="Sil">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top:1em;color:#64748b;font-size:0.96em;">
              <i class="fas fa-info-circle"></i> Bu siyahıda sistem tərəfindən aşkar edilmiş bütün xətalar görünür.
            </div>
        </div>
    `;
  }

  applySystemErrorFilters(filterType, value) {
      if (!window._systemErrorFilters) window._systemErrorFilters = {};
      window._systemErrorFilters[filterType] = value;
      if (window.app) window.app.loadModule('superadmin_panel');
      window.moduleRenderer.selectSuperadminSection('errors'); // Ensure correct tab
  }

  resetSystemErrorFilters() {
      window._systemErrorFilters = {};
      if (window.app) window.app.loadModule('superadmin_panel');
      window.moduleRenderer.selectSuperadminSection('errors');
  }

  showFirebaseSettings() {
    const currentSettings = (() => {
        try { return JSON.parse(localStorage.getItem('firebaseSettings') || '{}'); } catch { return {}; }
    })();
    const defaults = window.ENV ? {
        apiKey: window.ENV.FIREBASE_API_KEY || '',
        authDomain: window.ENV.FIREBASE_AUTH_DOMAIN || '',
        projectId: window.ENV.FIREBASE_PROJECT_ID || '',
        storageBucket: window.ENV.FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: window.ENV.FIREBASE_MESSAGING_SENDER_ID || '',
        appId: window.ENV.FIREBASE_APP_ID || '',
        enabled: true
    } : { enabled: true };
    const merged = { ...defaults, ...currentSettings };
    const content = `
        <form id="firebaseSettingsForm" class="form-grid">
            <div class="form-group" style="grid-column:1/-1;">
                <label class="form-label required">Firebase Sinxronizasiya Aktiv</label>
                <select class="form-select" name="enabled">
                    <option value="true" ${merged.enabled !== false ? 'selected' : ''}>Aktiv</option>
                    <option value="false" ${merged.enabled === false ? 'selected' : ''}>Deaktiv</option>
                </select>
                <small class="form-help" style="color:#64748b;">Firebase konfiqurasiyası aktiv olarsa, məlumatlar Firebase Firestore ilə sinxronizasiya olunacaq.</small>
            </div>
            <div class="form-group">
                <label class="form-label required">API Key</label>
                <input type="text" class="form-input" name="apiKey" required value="${merged.apiKey}">
            </div>
            <div class="form-group">
                <label class="form-label required">Project ID</label>
                <input type="text" class="form-input" name="projectId" required value="${merged.projectId}">
            </div>
            <div class="form-group">
                <label class="form-label">Auth Domain</label>
                <input type="text" class="form-input" name="authDomain" value="${merged.authDomain}" placeholder="projectId.firebaseapp.com">
            </div>
            <div class="form-group">
                <label class="form-label">Storage Bucket</label>
                <input type="text" class="form-input" name="storageBucket" value="${merged.storageBucket}" placeholder="projectId.appspot.com">
            </div>
            <div class="form-group">
                <label class="form-label">Messaging Sender ID</label>
                <input type="text" class="form-input" name="messagingSenderId" value="${merged.messagingSenderId}">
            </div>
            <div class="form-group">
                <label class="form-label">App ID</label>
                <input type="text" class="form-input" name="appId" value="${merged.appId}">
            </div>
        </form>
    `;
    const actions = `
        <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
        <button class="btn btn-primary" onclick="window.moduleRenderer.saveFirebaseSettings()">
            <i class="fas fa-save"></i>
            Yadda saxla və Yenidən Başlat
        </button>
    `;
    window.modalManager.showModal("Firebase Tənzimləmələri", content, actions, { allowEsc: false });
  }

  async saveFirebaseSettings() {
    try {
        const form = document.getElementById('firebaseSettingsForm');
        const formData = new FormData(form);
        const config = {};
        for(const [k,v] of formData.entries()) config[k] = v;
        config.enabled = config.enabled === 'true';

        // Save to localStorage for immediate next load
        localStorage.setItem('firebaseSettings', JSON.stringify(config));

        // Also save to the database for other users/devices
        if (window.app?.saveSetting) {
            await window.app.saveSetting('firebaseSettings', config);
        }

        window.notificationManager?.showNotification('success', 'Firebase tənzimləmələri yadda saxlandı', 'Dəyişikliklərin qüvvəyə minməsi üçün səhifə yenilənir...');
        setTimeout(() => window.location.reload(), 2000);
    } catch(e) {
        window.notificationManager?.showNotification('error', 'Saxlanmadı', e.message || "Xəta baş verdi!");
    }
  }

  renderSuperadminAuditLog(data) {
      let auditLogs = (Array.isArray(data.auditLogs) ? data.auditLogs : []).filter(log => log);

      const uniquePerformers = [...new Set(auditLogs.map(log => log.performedBy).filter(Boolean))];
      const uniqueActions = [...new Set(auditLogs.map(log => log.action).filter(Boolean))];
      const uniqueEntities = [...new Set(auditLogs.map(log => log.entityType).filter(Boolean))];
      
      const filters = window._auditFilters || {};
      const performerFilter = filters.performer || "";
      const actionFilter = filters.action || "";
      const entityFilter = filters.entityType || "";
      const dateFromFilter = filters.dateFrom || "";
      const dateToFilter = filters.dateTo || "";

      if (performerFilter) auditLogs = auditLogs.filter(log => log.performedBy === performerFilter);
      if (actionFilter) auditLogs = auditLogs.filter(log => log.action === actionFilter);
      if (entityFilter) auditLogs = auditLogs.filter(log => log.entityType === entityFilter);
      if (dateFromFilter) auditLogs = auditLogs.filter(log => new Date(log.createdAt) >= new Date(dateFromFilter));
      if (dateToFilter) auditLogs = auditLogs.filter(log => new Date(log.createdAt) <= new Date(dateToFilter));

      auditLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return `
        <div class="table-container">
          <div class="table-header">
            <h3 class="table-title"><i class="fas fa-clipboard-list"></i> Bütün Audit Loglar</h3>
          </div>
          <div class="table-filters" style="padding: 1rem; display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: center; border-bottom: 1px solid var(--border-color);">
              <select id="auditPerformerFilter" class="form-select" style="max-width: 150px;">
                  <option value="">Bütün İcraçılar</option>
                  ${uniquePerformers.map(p => `<option value="${p}" ${performerFilter === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
              <select id="auditActionFilter" class="form-select" style="max-width: 150px;">
                  <option value="">Bütün Əməliyyatlar</option>
                  ${uniqueActions.map(a => `<option value="${a}" ${actionFilter === a ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
              <select id="auditEntityFilter" class="form-select" style="max-width: 150px;">
                  <option value="">Bütün Obyektlər</option>
                  ${uniqueEntities.map(e => `<option value="${e}" ${entityFilter === e ? 'selected' : ''}>${e}</option>`).join('')}
              </select>
              <input type="date" id="auditDateFromFilter" class="form-input" style="max-width: 150px;" value="${dateFromFilter}">
              <input type="date" id="auditDateToFilter" class="form-input" style="max-width: 150px;" value="${dateToFilter}">
              <button class="btn btn-secondary" onclick="window.moduleRenderer.applyAuditFilters()">Filterlə</button>
              <button class="btn btn-secondary" onclick="window.moduleRenderer.resetAuditFilters()">Sıfırla</button>
          </div>
          <table class="data-table" style="font-size:0.92em;">
            <thead>
              <tr>
                <th>Zaman</th><th>Əməliyyat</th><th>Obyekt</th><th>ID</th><th>Dəyişikliklər</th><th>İcraçı</th>
              </tr>
            </thead>
            <tbody>
              ${
                auditLogs.length === 0
                ? `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:2em;">Filtrə uyğun qeyd tapılmadı.</td></tr>`
                : auditLogs.map(log => {
                    const changes = log.changes || {};
                    const entityData = changes.newData || changes.oldData || {};
                    let entityIdentifier = entityData.publicId || log.entityId;
                    if(entityData.name) entityIdentifier += ` (${entityData.name})`;
                    
                    let changesHtml;
                    if (log.action === 'login') {
                        changesHtml = `<span>Sistemə daxil oldu. Qurğu: ${log.deviceInfo?.os || 'Bilinmir'} (${log.deviceInfo?.browser || 'Bilinmir'})</span>`;
                    } else {
                        changesHtml = this._renderChangesAsHtml(changes); // USE THE NEW HELPER
                    }

                    return `
                      <tr>
                        <td>${window.app?.formatDate(log.createdAt, true)}</td>
                        <td>${log.action}</td>
                        <td>${log.entityType}</td>
                        <td>${entityIdentifier}</td>
                        <td>${changesHtml}</td>
                        <td>${log.performedBy||'Sistem'}</td>
                      </tr>
                    `
                }).join('')
              }
            </tbody>
          </table>
        </div>
      `;
  }
  
  renderSuperadminIntegrations(data) {
    if (!window.createSunmiTaxForm || !window.createDoorCardForm) {
        return `<div style="padding: 2rem; text-align: center; color: var(--danger-color);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>Kritik Xəta: İnteqrasiya formaları yüklənmədi. Səhifəni yeniləyin.</p>
                </div>`;
    }

    // 1. Get settings
    const sunmiSettings = window.app?.getSetting('sunmiTaxSettings') || {};
    const doorCardSettings = window.app?.getSetting('doorCardSettings') || {};

    // 2. Get Telegram settings (handled via modal)
    const telegramSettings = window.app?.getSetting('telegramNotificationSettings');
    const hasTelegramConfig = !!window.ENV.TELEGRAM_BOT_TOKEN;
    const allSettingsValues = telegramSettings ? Object.values(telegramSettings).flat() : [];
    const telegramRecipientsCount = allSettingsValues.filter(v => typeof v === 'string' && (v.startsWith('@') || /^\d+$/.test(v))).length;

    // 3. Render forms (relying on global window.create*Form)

    const sunmiFormHtml = window.createSunmiTaxForm({
        taxId: sunmiSettings.taxId,
        companyName: sunmiSettings.companyName,
        taxRate: sunmiSettings.taxRate,
        apiUrl: sunmiSettings.apiUrl,
        enabled: sunmiSettings.enabled
    }).outerHTML;

    const doorCardFormHtml = window.createDoorCardForm({
        settings: doorCardSettings
    }).outerHTML;

    return `
        <div class="report-section">
            <h4>Telegram İnteqrasiyası</h4>
            <div class="report-grid">
                <div class="operational-card">
                    <div class="card-header">
                        <h5 class="card-title">Telegram Bildirişləri</h5>
                        <i class="fab fa-telegram-plane card-icon" style="background-color: #3b82f6;"></i>
                    </div>
                    <p>Vacib hadisələr (rezervasiya, kassa, anbar xəbərdarlıqları) üçün bildirişlərin tənzimlənməsi.</p>
                    <p style="margin-top:0.5em; font-size:0.9em; color:var(--text-light);">
                        Bot Token: ${hasTelegramConfig ? '<span style="color:var(--success-color);">Qeyd olunub</span>' : '<span style="color:var(--danger-color);">Yoxdur</span>'} | 
                        Aktiv alıcı: ${telegramRecipientsCount}
                    </p>
                    <button class="btn btn-secondary btn-sm" style="margin-top:1em;" onclick="window.modalManager.showTelegramSettings()">
                        <i class="fas fa-cog"></i> Tənzimlə
                    </button>
                    <button class="btn btn-secondary btn-sm" style="margin-top:1em; margin-left:0.5em;" onclick="window.notificationManager?.sendTelegramTestNotification?.()">
                        <i class="fas fa-paper-plane"></i> Test
                    </button>
                </div>
            </div>
        </div>

        <div class="report-section" style="margin-top: 1.5rem;">
            <h4>Vergi Kassası İnteqrasiyası (Sunmi)</h4>
            <div class="table-container" style="padding: 1.5rem;">
                <p class="report-description">Qonaqlara və POS satışlarına vergi qəbzlərinin çapı üçün Sunmi cihazı tənzimləmələri.</p>
                ${sunmiFormHtml}
                <div style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                    <button class="btn btn-primary" onclick="window.moduleRenderer.saveSunmiSettings()">
                        <i class="fas fa-save"></i> Yadda saxla
                    </button>
                </div>
            </div>
        </div>

        <div class="report-section" style="margin-top: 1.5rem;">
            <h4>Qapı Kartı Sistemi (Universal)</h4>
            <div class="table-container" style="padding: 1.5rem;">
                <p class="report-description">Rezervasiya tarixi əsasında otaq qapısına vaxt üzrə açarın proqramlaşdırılması və çıxışda bağlanması.</p>
                ${doorCardFormHtml}
                <div style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                    <button class="btn btn-primary" onclick="window.moduleRenderer.saveDoorCardSettings()">
                        <i class="fas fa-save"></i> Yadda saxla
                    </button>
                </div>
            </div>
        </div>
    `;
}

async saveSunmiSettings() {
    const form = document.getElementById('sunmiTaxForm');
    if (!form) return window.notificationManager?.showNotification('error', 'Xəta', 'Sunmi form tapılmadı.');
    const formData = new FormData(form);
    const settings = Object.fromEntries(formData);
    settings.enabled = settings.enabled === 'true';
    settings.taxRate = parseFloat(settings.taxRate) || 0;

    // Simple validation
    if (settings.enabled && (!settings.apiUrl || !settings.taxId)) {
        return window.notificationManager?.showNotification('error', 'Xəta', 'Sunmi aktivdirsə, API URL və Vergi ID mütləqdir.');
    }

    try {
        await window.app.saveSetting('sunmiTaxSettings', settings);
        window.app.loadModule('superadmin_panel');
        window.moduleRenderer.selectSuperadminSection('integrations');
        window.notificationManager?.showNotification('success', 'Saxlanıldı', 'Sunmi tənzimləmələri uğurla yadda saxlandı.');
    } catch (e) {
        window.notificationManager?.showNotification('error', 'Saxlanmadı', e.message);
    }
}

async saveDoorCardSettings() {
    const form = document.getElementById('doorCardForm');
    if (!form) return window.notificationManager?.showNotification('error', 'Xəta', 'Qapı kartı formu tapılmadı.');
    const formData = new FormData(form);
    const settings = Object.fromEntries(formData);
    settings.enabled = settings.enabled === 'true';

    if (settings.enabled && !settings.apiUrl) {
        return window.notificationManager?.showNotification('error', 'Xəta', 'Qapı kartı sistemi aktivdirsə, API URL mütləqdir.');
    }

    try {
        await window.app.saveSetting('doorCardSettings', settings);
        window.app.loadModule('superadmin_panel');
        window.moduleRenderer.selectSuperadminSection('integrations');
        window.notificationManager?.showNotification('success', 'Saxlanıldı', 'Qapı kartı sistemi tənzimləmələri uğurla yadda saxlandı.');
    } catch (e) {
        window.notificationManager?.showNotification('error', 'Saxlanmadı', e.message);
    }
}
}

export default ModuleRenderer;