// Staff component with optimized performance, responsive design, and better UX for mobile/desktop
// --- COLUMN FILTERS IN TABLE HEADER (LIVE FILTER UPDATE) ---

export default class StaffComponent {
    constructor() {
        if (typeof window !== 'undefined') {
            window.staffComponent = this;
        }
    }

    // Helper to get filter value from localStorage
    getFilter(key, defaultValue = '') {
        const storedValue = localStorage.getItem(`staffComponent_${key}`);
        // Treat explicit 'null'/'undefined' strings or actual null as default
        if (storedValue === null || storedValue === 'undefined' || storedValue === 'null') {
            return defaultValue;
        }
        return storedValue;
    }

    // Helper to set filter value in localStorage
    setFilter(key, value) {
        localStorage.setItem(`staffComponent_${key}`, value);
    }

    render(data) {
        // Efficient mapping for salary payments per staff
        const salaryPaymentsByStaffId = {};
        if (Array.isArray(data.cashTransactions)) {
            data.cashTransactions.forEach(tr => {
                if (tr.category === "Maaş ödənişi" && tr.salaryRecipientId) {
                    salaryPaymentsByStaffId[tr.salaryRecipientId] = (salaryPaymentsByStaffId[tr.salaryRecipientId] || 0) + parseFloat(tr.amount || 0);
                }
            });
        }
        const isSuperadmin = window.app?.isSuperadmin() || false;
        const currentUser = window.authManager?.getCurrentUser(); // Get current user for permission checks

        // Filters: search, department, role, status
        const searchVal = this.getFilter('searchVal');
        const departmentVal = this.getFilter('departmentVal');
        const roleVal = this.getFilter('roleVal');
        const statusVal = this.getFilter('statusVal');
        const positionVal = this.getFilter('positionVal');
        const startDateVal = this.getFilter('startDateVal');

        const staffList = data.staff || [];
        const uniqueDepartments = Array.from(new Set(staffList.map(s=>s.department).filter(Boolean))).sort();
        const uniqueRoles = Array.from(new Set(staffList.map(s=>s.role).filter(Boolean))).sort();
        const uniqueStatuses = Array.from(new Set(staffList.map(s=>s.status).filter(Boolean)));
        const uniquePositions = Array.from(new Set(staffList.map(s=>s.position).filter(Boolean))).sort();

        let filtered = staffList;
        // QUICK: lowercase and trim once for search performance
        const searchValTrimmed = searchVal.toLowerCase().trim();
        if (searchValTrimmed) {
            filtered = filtered.filter(s =>
                (s.name && s.name.toLowerCase().includes(searchValTrimmed)) ||
                (s.email && s.email.toLowerCase().includes(searchValTrimmed)) ||
                (s.phone && s.phone.includes(searchValTrimmed)) ||
                (s.telegramId && String(s.telegramId).toLowerCase().includes(searchValTrimmed)) ||
                (s.publicId && s.publicId.toLowerCase().includes(searchValTrimmed)) || // Search by publicId
                (s.id && String(s.id).toLowerCase().includes(searchValTrimmed))
            );
        }
        // Apply filters only if their value is not an empty string (or equivalent)
        if (departmentVal !== '') filtered = filtered.filter(s => s.department === departmentVal);
        if (roleVal !== '') filtered = filtered.filter(s => s.role === roleVal);
        if (statusVal !== '') filtered = filtered.filter(s => s.status === statusVal);
        if (positionVal !== '') filtered = filtered.filter(s => s.position === positionVal);
        if (startDateVal !== '') filtered = filtered.filter(s => s.startDate === startDateVal);

        // Mobile optimization: chunking
        const isMobile = window.innerWidth <= 800;
        const maxVisible = isMobile ? 8 : 30; // Show less on phone/tablet
        const showAll = localStorage.getItem('staffComponent_showAllRows') === 'true' || filtered.length <= maxVisible;
        const visibleStaff = showAll ? filtered : filtered.slice(0, maxVisible);

        return `
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">İşçilərin İdarə Edilməsi</h3>
                    ${window.authManager.hasPermission('staff', 'create') ? `
                    <button class="btn btn-primary" onclick="window.modalManager.showStaffForm()">
                        <i class="fas fa-user-plus"></i>
                        Yeni İşçi
                    </button>
                    ` : ''}
                </div>
                <div style="overflow-x:auto;">
                <table class="data-table" style="min-width:${isMobile?'700px':'990px'};font-size:${isMobile?'0.95em':'1em'};">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th style="min-width: 150px;">
                                ID<br>
                                <input class="form-input" style="max-width:130px;" type="text" placeholder="ID, ad, email, tel..." value="${searchVal}"
                                    id="staffSearchInput"
                                    oninput="window.staffComponent.setFilter('searchVal', this.value); localStorage.removeItem('staffComponent_showAllRows'); window.app.loadModuleDebounced('staff');">
                            </th>
                            <th style="min-width: 150px;">Ad Soyad</th>
                            <th style="min-width: 100px;">
                                Vəzifə<br>
                                <select class="form-select" style="max-width:90px;" onchange="window.staffComponent.setFilter('positionVal', this.value); localStorage.removeItem('staffComponent_showAllRows'); window.app.loadModule('staff');">
                                    <option value="">Hamısı</option>
                                    ${uniquePositions.map(p=>`<option value="${p}" ${p===positionVal?'selected':''}>${p}</option>`).join('')}
                                </select>
                            </th>
                            <th>Rol</th>
                            <th>Şöbə</th>
                            <th>Əmək haqqı</th>
                            <th>Ödənilmiş</th>
                            <th>Telefon<br>Telegram</th>
                            <th>Başlama<br>
                                <input type="date" class="form-input" style="max-width:110px;" value="${startDateVal}"
                                    onchange="window.staffComponent.setFilter('startDateVal', this.value); localStorage.removeItem('staffComponent_showAllRows'); window.app.loadModule('staff');">
                            </th>
                            <th>Status<br>
                                <select class="form-select" style="max-width:70px;" onchange="window.staffComponent.setFilter('statusVal', this.value); localStorage.removeItem('staffComponent_showAllRows'); window.app.loadModule('staff');">
                                    <option value="">Hamısı</option>
                                    ${uniqueStatuses.map(s=>`<option value="${s}" ${s===statusVal?'selected':''}>${s==='active'?'Aktiv':'Deaktiv'}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 120px;">Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? visibleStaff.map((employee, idx) => this.renderStaffRow(employee, salaryPaymentsByStaffId, currentUser, isMobile, idx + 1)).join('') : `
                            <tr><td colspan="12" style="text-align:center; padding: 2rem;">İşçi tapılmadı.</td></tr>
                        `}
                    </tbody>
                </table>
                </div>
                <div style="margin:0.5em 0 1em 0; color:#64748b;font-size:0.96em;">İşçi sayı: <b>${filtered.length}</b></div>
                ${!showAll && filtered.length > maxVisible ? `
                    <div style="text-align:center; margin:1em 0;">
                        <button class="btn btn-secondary" id="showAllStaffBtn" style="font-size:0.98em;" onclick="window.staffComponent.showAllTransactions()">
                            <i class="fas fa-list-ul"></i>
                            Daha çox (${filtered.length - maxVisible}) işçini göstər
                        </button>
                    </div>
                ` : ""}
                <button class="btn btn-secondary" style="margin-top:1em;" onclick="window.staffComponent.setFilter('searchVal', '');window.staffComponent.setFilter('departmentVal', '');window.staffComponent.setFilter('roleVal', '');window.staffComponent.setFilter('statusVal', '');window.staffComponent.setFilter('positionVal', '');window.staffComponent.setFilter('startDateVal', '');localStorage.removeItem('staffComponent_showAllRows');window.app.loadModule('staff');">
                    <i class="fas fa-times"></i> Filtri sıfırla
                </button>
            </div>
        `;
    }

    renderStaffRow(employee, salaryPaymentsByStaffId, currentUser, isMobile, rowIndex) {
        const esc = window.escapeHtml;
        const paid = salaryPaymentsByStaffId?.[employee.id] || 0;
        // Icon, status badge and initials avatar
        let initials = employee.name ? employee.name.split(" ").map(p=>p[0]).join('').substring(0,2).toUpperCase() : "";
        const avatarColors = ["#3b82f6","#8b5cf6","#f59e0b","#10b981","#ef4444"];
        const color = avatarColors[Math.abs((employee.id||"").hashCode?.() || initials.charCodeAt(0) || 0)%avatarColors.length];

        const statusClass = employee.status === 'active' ? 'status-confirmed' : 'status-cancelled';
        const statusText = employee.status === 'active' ? 'Aktiv' : 'Deaktiv';
        const roleLabelText = this.roleLabel(employee.role);

        // Format startDate
        const formatDate = (window.app && typeof window.app.formatDate === "function") ? window.app.formatDate : d => d;

        const displayId = employee.publicId || (window.app ? window.app.formatInternalId(employee.id, 'IS') : employee.id);

        // NEW: Determine if the staff member has a telegram ID for direct communication
        const hasTelegramId = !!employee.telegramId;
        // NEW: Determine if the current user can edit permissions for this employee
        // Superadmins can edit anyone's permissions; admins can edit non-admin, non-superadmin staff.
        const canEditPerms = !!currentUser?.isSuperadmin || (currentUser?.role === 'admin' && !employee.isSuperadmin && employee.role !== 'admin');

        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${rowIndex || ''}</td>
                <td>
                    <strong>
                        ${esc(displayId)}
                        ${employee.firebaseUid ? ` (Firebase: ...${esc(employee.firebaseUid.slice(-4))})` : ''}
                    </strong>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:0.4em;">
                        <span style="min-width:26px;min-height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:${color};color:white;font-size:0.95em;font-weight:600;">
                            ${esc(initials)||'İ'}
                        </span>
                        <span>
                            ${esc(employee.name)}
                            ${!isMobile ? `<br><small style="color:#64748b;">${esc(employee.email||'')}</small>` : ""}
                        </span>
                    </div>
                </td>
                <td>
                    ${esc(employee.position||'')}
                </td>
                <td>
                    <small style="color:#64748b;">
                        ${employee.role?`${esc(this.roleLabel(employee.role))}`:'Rol yoxdur'}
                    </small>
                </td>
                <td>${esc(employee.department||"")}</td>
                <td>₼${parseFloat(employee.salary||0).toFixed(2)}</td>
                <td style="color:${paid>0?'#10b981':'#64748b'}">
                    ${paid > 0 ? `₼${paid.toFixed(2)}` : '&mdash;'}
                </td>
                <td style="word-break:break-all;">
                    <a href="tel:${esc(employee.phone)}" style="color:#10b981;">${esc(employee.phone)}</a>
                    <br>
                    <small style="color: #64748b;">
                        ${employee.telegramId?`<i class="fab fa-telegram"></i> ${esc(employee.telegramId)}`:'Telegram ID yoxdur'}
                    </small>
                </td>
                <td>${formatDate(employee.startDate)}</td>
                <td><span class="status-badge ${statusClass}">${esc(statusText)}</span></td>
                <td>
                    <div class="table-actions" style="display:flex;gap:0.32em;flex-wrap:${isMobile?'wrap':'nowrap'};">
                        ${hasTelegramId && window.authManager.hasPermission('staff', 'edit') ? `
                        <button class="btn btn-secondary" onclick="window.modalManager.showSendTelegramMessageModal('${esc(employee.id)}', '${esc(employee.name)}')" title="Telegram Mesajı Göndər" style="background-color: #2aab33; color: white;padding:0.6em;">
                            <i class="fab fa-telegram-plane"></i>
                        </button>
                        ` : ''}
                        ${canEditPerms ? `
                        <button class="btn btn-secondary" onclick="window.modalManager.showUserPermissions('${esc(employee.id)}')" title="İcazələr" style="background-color: #3b82f6; color: white;">
                            <i class="fas fa-key"></i>
                        </button>
                        ` : ''}
                        ${window.authManager.hasPermission('staff', 'edit') ? `
                        <button class="btn btn-secondary" onclick="window.modalManager.showStaffForm('${esc(employee.id)}')" title="Redaktə et">
                            <i class="fas fa-edit"></i>
                        </button>
                        ` : ''}
                        ${window.authManager.hasPermission('staff', 'delete') ? `
                        <button class="btn btn-secondary" onclick="window.app.deleteStaff('${esc(employee.id)}')" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    roleLabel(role) {
        return role === "superadmin"
            ? "SuperAdmin"
            : role === "admin"
                ? "Admin"
                : role === "manager"
                    ? "Menecer"
                    : "İşçi";
    }
}

// Polyfill for String.hashCode for coloring
if (!String.prototype.hashCode) {
    String.prototype.hashCode = function() {
        let hash = 0, i, chr;
        for (i = 0; i < this.length; i++) {
            chr   = this.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash;
    };
}

// Ensure global availability
window.StaffComponent = StaffComponent;