import ReservationForm from './reservation-form.js';
import GuestForm from './guest-form.js';
import RoomForm from './room-form.js';
import ServiceForm from './service-form.js';
import PaymentForm from './payment-form.js';
import CashForm from './cash-form.js';
import InventoryForm from './inventory-form.js';
import StaffForm from './staff-form.js';
import MaintenanceForm from './maintenance-form.js';
import PurchaseDocumentForm from './purchase-document-form.js';
import AuthManager from './auth-manager.js';
// NEW: Import Sunmi and Hune forms
import { createSunmiTaxForm } from './sunmi-tax-form.js';
import { createHuneDoorLockForm } from './hune-door-lock-form.js';

class ModalManager {
    constructor() {
        this.currentModal = null;
        this._postCloseHook = null;
        this._allowEscClose = true;
        this.lastError = null;

        // Dedicated promise resolvers for prompt and confirm modals
        this._promptPromiseResolve = null;
        this._deleteConfirmPromiseResolve = null;

        // NEW: Centralized configuration for form modals
        this.formConfigurations = {
            reservation: { formClass: ReservationForm, collection: 'reservations', titleNew: 'Yeni Rezervasiya', titleEdit: 'Rezervasiyanı Redaktə Et', afterRender: (formNode, entityId) => { if (window.reservationForm?.attachCalculationListeners) { console.log("Attaching listeners for reservation form."); window.reservationForm.attachCalculationListeners(); if(formNode) formNode.dataset.reservationId = entityId || ''; } } },
            guest: { formClass: GuestForm, collection: 'guests', titleNew: 'Yeni Qonaq', titleEdit: 'Qonağı Redaktə Et' },
            room: { formClass: RoomForm, collection: 'rooms', titleNew: 'Yeni Otaq', titleEdit: 'Otağı Redaktə Et' },
            service: { formClass: ServiceForm, collection: 'services', titleNew: 'Yeni Xidmət', titleEdit: 'Xidməti Redaktə Et' },
            inventory: { formClass: InventoryForm, collection: 'inventory', titleNew: 'Yeni Məhsul', titleEdit: 'Məhsulu Redaktə Et' },
            staff: { formClass: StaffForm, collection: 'staff', titleNew: 'Yeni İşçi', titleEdit: 'İşçini Redaktə Et' },
            maintenance: { formClass: MaintenanceForm, collection: 'maintenance', titleNew: 'Yeni Tapşırıq', titleEdit: 'Tapşırığı Redaktə Et' },
            purchaseDocument: { formClass: PurchaseDocumentForm, collection: 'purchaseDocuments', titleNew: 'Yeni Alış Sənədi', titleEdit: 'Alış Sənədini Redaktə Et' }
        };

        this.createModalContainer();
        this.listenForEscAndLogout(); 
        this.patchGlobalSecurity();
    }

    createModalContainer() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', () => this.createModalContainer(), { once: true });
            return;
        }
        if (!document.getElementById('modalContainer')) {
            const container = document.createElement('div');
            container.id = 'modalContainer';
            document.body.appendChild(container);
        }
    }

    showModal(title, content, actions = '', opts = {}) {
        this.hideModal();

        // REFACTORED: Removed fragile regex-based permission check.
        // Permissions are now expected to be handled by the calling business logic (e.g., in app.js or form submit methods).
        // This makes the modal manager a pure UI component and centralizes security logic where it belongs.

        const existingModal = document.getElementById('modalOverlay');
        if (existingModal) existingModal.remove();

        let modalClassExtra = '';
        if (/form\s+id=["'][\w-]+Form/i.test(content)) modalClassExtra = ' modal--large';

        const modalHTML = `
            <div class="modal-overlay" id="modalOverlay" tabindex="-1">
                <div class="modal${modalClassExtra}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
                    <div class="modal-header">
                        <h3 class="modal-title" id="modalTitle">${title}</h3>
                        <button class="modal-close" onclick="window.modalManager.hideModal()" aria-label="Bağla">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    ${actions ? `<div class="modal-footer">${actions}</div>` : ''}
                </div>
            </div>
        `;

        document.getElementById('modalContainer').innerHTML = modalHTML;
        this.currentModal = document.getElementById('modalOverlay');
        this._allowEscClose = opts.allowEsc !== false; 

        this.currentModal.addEventListener('click', (e) => {
            const clickedCloseBtn = e.target.closest('.modal-close');
            if (clickedCloseBtn) this.hideModal();
        });

        setTimeout(() => {
            try {
                this.currentModal.focus();
            } catch {}
        }, 20);

        this._postCloseHook = typeof opts.postClose === 'function' ? opts.postClose : null;

        this.currentModal.setAttribute('data-secure', 'false'); // Set to false by default as permission check is now external
    }

    hideModal() {
        const container = document.getElementById('modalContainer');
        if (container) container.innerHTML = '';
        this.currentModal = null;
        
        // Execute and clear _postCloseHook first, as it's meant to be a final cleanup.
        if (typeof this._postCloseHook === 'function') {
            try { this._postCloseHook(); } catch (e) { console.error("Error in postCloseHook:", e); }
        }
        this._postCloseHook = null;
        this._allowEscClose = true;
        
        // Safely resolve any pending prompt/confirm promises if modal was closed externally (e.g., ESC key)
        // Set to null BEFORE resolving to prevent recursion.
        const tempDeleteResolve = this._deleteConfirmPromiseResolve;
        const tempPromptResolve = this._promptPromiseResolve;

        this._deleteConfirmPromiseResolve = null; 
        this._promptPromiseResolve = null;

        if (tempDeleteResolve) {
            tempDeleteResolve(false); // Resolve delete confirm with false (cancelled)
        }
        if (tempPromptResolve) {
            tempPromptResolve(null); // Resolve prompt with null (cancelled)
        }
    }

    showInfoModal(title, message, opts = {}) {
        const content = `<div style="text-align:center;">
            <i class="fas fa-info-circle" style="font-size:3rem;color:#3b82f6;margin-bottom:1rem;"></i>
            <p style="color:#1e293b;font-size:1.1rem;margin-bottom:1rem;">${message}</p>
        </div>`;
        const actions = `<button class="btn btn-primary" onclick="window.modalManager.hideModal()">Bağla</button>`;
        this.showModal(title, content, actions, opts);
    }

    showErrorModal(title, message, opts = {}) {
        const content = `<div style="text-align:center;">
            <i class="fas fa-exclamation-triangle" style="font-size:3rem; color:#ef4444;margin-bottom:1rem;"></i>
            <p style="color:#ef4444;font-size:1.1rem;margin-bottom:1rem;">${message}</p>
        </div>`;
        const actions = `<button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>`;
        this.showModal(title, content, actions, opts);
    }

    showSuccessModal(title, message, opts = {}) {
        const content = `<div style="text-align:center;">
            <i class="fas fa-check-circle" style="font-size:3rem; color:#10b981;margin-bottom:1rem;"></i>
            <p style="color:#10b981;font-size:1.1rem;margin-bottom:1rem;">${message}</p>
        </div>`;
        const actions = `<button class="btn btn-primary" onclick="window.modalManager.hideModal()">Bağla</button>`;
        this.showModal(title, content, actions, opts);
    }

    showModuleModal(moduleName, { title = '', content = '', actions = '', requireSuperadmin = false, allowEsc = true, postClose = null } = {}) {
        if (requireSuperadmin && !window.app?.isSuperadmin?.()) {
            this.showErrorModal('İcazə yoxdur', 'Bu bölmə üçün Superadmin olmalısınız.', { allowEsc: true });
            if (window.notificationManager) {
                window.notificationManager.notifyAction({
                    title: 'İcazəsiz modul girişi',
                    message: `Qadağan modulu açmaq istədi: ${title || moduleName}`,
                    type: 'warning',
                    sendToTelegramModule: moduleName,
                });
            }
            return;
        }
        this.showModal(
            title || (moduleName.charAt(0).toUpperCase() + moduleName.substring(1)),
            content,
            actions,
            { allowEsc, postClose }
        );
    }

    listenForEscAndLogout() {
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Escape' || e.keyCode === 27) && this.currentModal && this._allowEscClose) {
                // The concept of a "secure" modal is removed, as permissions are now handled by the calling logic.
                // Any modal can be closed with ESC unless explicitly disallowed with opts.allowEsc = false.
                this.hideModal();
            }
        });
        window.addEventListener('logout', () => this.hideModal());
    }

    patchGlobalSecurity() {
        if (!window._adminPatchesApplied) {
            window._adminPatchesApplied = true;
            const origAlert = window.alert;
            window.alert = function(message) {
                if (window.modalManager) {
                    window.modalManager.showInfoModal('Bildiriş', String(message));
                } else {
                    origAlert(message);
                }
            };
            const origConfirm = window.confirm;
            window.confirm = function(message) {
                if (window.modalManager) {
                    return new Promise(resolve => {
                        window.modalManager.showModal('Təsdiqlə', `<div style="text-align:center;">${message}</div>`,
                            `
                            <button class="btn btn-secondary" onclick="window.modalManager.cancelConfirmModal()">Xeyr</button>
                            <button class="btn btn-primary" onclick="window.modalManager.forceConfirmModal(true)">Bəli</button>
                            `);
                        // Store the resolver from the new Promise on the instance
                        window.modalManager._deleteConfirmPromiseResolve = resolve;
                    });
                } else {
                    return origConfirm(message);
                }
            };
        }
    }

    async confirmDelete(title, message) {
        return new Promise((resolve) => {
            const modalContent = `
                <div style="text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                    <p style="color: #1e293b; font-size: 1.1rem; margin-bottom: 1.5rem;">${message || 'Bu elementi silmək istədiyinizə əminsiniz?'}</p>
                    <p style="color: #64748b; font-size: 0.9rem;">Bu əməliyyat geri qaytarıla bilməz.</p>
                </div>
            `;

            const modalActions = `
                <button class="btn btn-secondary" onclick="window.modalManager.cancelDeleteConfirm()">
                    Ləğv et
                </button>
                <button class="btn btn-primary" style="background-color: #ef4444;" onclick="window.modalManager.forceConfirmDelete()">
                    <i class="fas fa-trash"></i>
                    Bəli, sil
                </button>
            `;

            this._deleteConfirmPromiseResolve = resolve; // Store the promise's resolver
            this.showModal(title || 'Silmə Təsdiqi', modalContent, modalActions, { allowEsc: false });
        });
    }

    // External resolution methods for confirmDelete
    forceConfirmDelete() {
        if (this._deleteConfirmPromiseResolve) {
            this._deleteConfirmPromiseResolve(true);
            this._deleteConfirmPromiseResolve = null; // Clear resolver
        }
        this.hideModal();
    }
    cancelDeleteConfirm() {
        if (this._deleteConfirmPromiseResolve) {
            this._deleteConfirmPromiseResolve(false);
            this._deleteConfirmPromiseResolve = null; // Clear resolver
        }
        this.hideModal();
    }
    // New method to handle global confirm from patchGlobalSecurity
    forceConfirmModal(value) {
        if (this._deleteConfirmPromiseResolve) {
            this._deleteConfirmPromiseResolve(value);
            this._deleteConfirmPromiseResolve = null;
        }
        this.hideModal();
    }
    cancelConfirmModal() {
        if (this._deleteConfirmPromiseResolve) {
            this._deleteConfirmPromiseResolve(false);
            this._deleteConfirmPromiseResolve = null;
        }
        this.hideModal();
    }

    async showPromptModal(title, message, defaultValue = '', inputType = 'text') {
        return new Promise(resolve => {
            const inputId = `promptInput_${Date.now()}`;
            const content = `
                <div style="text-align: center;">
                    <p style="margin-bottom:1rem;color:#1e293b;font-size:1.1rem;">${message}</p>
                    <input type="${inputType}" id="${inputId}" class="form-input" value="${defaultValue}" style="max-width:300px;margin:0 auto;text-align:center;">
                </div>
            `;
            const actions = `
                <button class="btn btn-secondary" onclick="window.modalManager.cancelPromptModal()">Ləğv et</button>
                <button class="btn btn-primary" onclick="window.modalManager.confirmPromptModal(document.getElementById('${inputId}').value)">Təsdiqlə</button>
            `;
            this.showModal(title, content, actions, { allowEsc: false });

            // Store the promise's resolver
            this._promptPromiseResolve = resolve;

            // Focus and select the input
            setTimeout(() => {
                const input = document.getElementById(inputId);
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 100);
        });
    }

    // External resolution methods for showPromptModal
    confirmPromptModal(value) {
        if (this._promptPromiseResolve) {
            this._promptPromiseResolve(value);
            this._promptPromiseResolve = null; // Clear resolver
        }
        this.hideModal();
    }
    cancelPromptModal() {
        if (this._promptPromiseResolve) {
            this._promptPromiseResolve(null); // Resolve with null for cancellation
            this._promptPromiseResolve = null; // Clear resolver
        }
        this.hideModal();
    }

    showUserDetails(userId) {
        if (!userId) {
            const currentUser = window.authManager?.getCurrentUser();
            if (currentUser) {
                // Prioritize finding by Firebase UID, then by email.
                const staffRecord = window.app?.data?.staff?.find(s => s.firebaseUid === currentUser.uid || s.email === currentUser.email);
                if (staffRecord) {
                    userId = staffRecord.id;
                } else {
                    // Fallback if no full staff record found, display basic info.
                    this.showInfoModal('İstifadəçi Məlumatları', `Email: ${currentUser.email}<br>Rol: ${currentUser.role}`);
                    return;
                }
            } else {
                this.showErrorModal('Xəta', 'Cari istifadəçi tapılmadı.');
                return;
            }
        }
        
        const staff = window.app?.data?.staff?.find(s => s.id === userId);
        if (!staff) {
            this.showErrorModal('Xəta', 'İstifadəçi məlumatları tapılmadı.');
            return;
        }

        const isSuperadmin = staff.isSuperadmin || false;

        const displayStaffId = staff.publicId || (window.app ? window.app?.formatInternalId?.(staff.id, 'IS') : staff.id); // Use publicId

        // NEW: Fetch recent login audit logs for this user
        const loginLogs = (window.app?.data?.auditLogs || [])
            .filter(log => log.action === 'login' && log.entityType === 'staff' && log.entityId === staff.firebaseUid)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5); // Show last 5 logins

        let loginHistoryHtml = '';
        if (loginLogs.length > 0) {
            loginHistoryHtml = `
                <h4 style="margin: 0 0 1rem 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">
                    <i class="fas fa-desktop"></i> Daxil Olduğu Qurğular
                </h4>
                <div class="detail-grid" style="font-size: 0.9em;">
                    ${loginLogs.map(log => `
                        <div style="padding-bottom: 0.5em; border-bottom: 1px dashed #e2e8f0; margin-bottom: 0.5em;">
                            <div><strong>Zaman:</strong> ${window.app?.formatDate(log.createdAt, true)}</div>
                            <div><strong>Qurğu:</strong> ${log.deviceInfo?.os || 'Bilinmir'} (${log.deviceInfo?.browser || 'Bilinmir'})</div>
                            <div><strong>IP:</strong> ${log.loginIp?.replace(' (client-side)', '') || 'N/A'}</div>
                            <div style="font-size:0.85em; color:#64748b; margin-top:0.3em;">
                                User-Agent: ${log.deviceInfo?.userAgent?.substring(0, 80) + '...' || 'N/A'}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <p style="color:#64748b;margin-top:0.8em;font-size:0.85em;">
                    <i class="fas fa-info-circle"></i> Qurğu və brauzer məlumatları brauzerdən toplanır. IP ünvanı adətən server tərəfindən təhlükəsizlik məqsədilə toplanır və burada yalnız yer tutucu (placeholder) göstərilir.
                </p>
            `;
        } else {
            loginHistoryHtml = `
                <h4 style="margin: 0 0 1rem 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">
                    <i class="fas fa-desktop"></i> Daxil Olduğu Qurğular
                </h4>
                <div class="detail-grid" style="font-size: 0.9em;">
                    <p style="color:#64748b;">
                        <i class="fas fa-info-circle"></i> Bu istifadəçi üçün heç bir giriş qeydi tapılmadı.
                    </p>
                    <p style="color:#64748b;margin-top:0.5em;">
                        Qurğu və brauzer məlumatları brauzerdən toplanır. IP ünvanı adətən server tərəfindən təhlükəsizlik məqsədilə toplanır və burada yalnız yer tutucu (placeholder) göstərilir.
                    </p>
                </div>
            `;
        }

        const content = `
            <div class="user-details-modal" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
                <div class="detail-section">
                    <h4 style="margin: 0 0 1rem 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">
                        <i class="fas fa-user-circle"></i> Şəxsi Məlumatlar
                    </h4>
                    <div class="detail-grid">
                        <div><strong>ID:</strong> ${displayStaffId}</div>
                        <div><strong>Ad:</strong> ${staff.name}</div>
                        <div><strong>Email:</strong> ${staff.email}</div>
                        <div><strong>Telefon:</strong> ${staff.phone || 'N/A'}</div>
                        <div><strong>Telegram ID:</strong> ${staff.telegramId || 'N/A'}</div>
                    </div>
                </div>

                <div class="detail-section">
                    <h4 style="margin: 0 0 1rem 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">
                        <i class="fas fa-briefcase"></i> İş Məlumatları
                    </h4>
                    <div class="detail-grid">
                        <div><strong>Vəzifə:</strong> ${staff.position}</div>
                        <div><strong>Şöbə:</strong> ${staff.department}</div>
                        <div><strong>Rol:</strong> 
                            <span class="status-badge status-${staff.role === 'admin' || staff.role === 'superadmin' ? 'cancelled' : 'pending'}">${staff.role}</span>
                            ${isSuperadmin ? '<span class="status-badge" style="background-color: #8b5cf6; color: white; margin-left: 5px;">Superadmin</span>' : ''}
                        </div>
                        <div><strong>Status:</strong> <span class="status-badge status-${staff.status === 'active' ? 'confirmed' : 'cancelled'}">${staff.status === 'active' ? 'Aktiv' : 'Deaktiv'}</span></div>
                        <div><strong>Maaş:</strong> ₼${(staff.salary || 0).toFixed(2)}</div>
                        <div><strong>İşə başlama:</strong> ${window.app?.formatDate?.(staff.startDate)}</div>
                    </div>
                </div>

                <div class="detail-section" style="grid-column: 1 / -1;">
                    ${loginHistoryHtml}
                </div>
            </div>
        `;

        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.modalManager.showStaffForm('${staff.id}')">
                <i class="fas fa-edit"></i> Redaktə et
            </button>
        `;

        this.showModal(`İstifadəçi: ${staff.name}`, content, actions);
    }

    showUserPermissions(userId) {
        const staff = window.app?.data?.staff?.find(s => s.id == userId);
        if (!staff) {
            this.showErrorModal('Xəta', 'İstifadəçi tapılmadı.');
            return;
        }

        const allModules = window.authManager.allModules;
        const allActions = window.authManager.allActions;

        const customPerms = staff.permissions || {};

        const permsHtml = allModules.map(module => {
            // getRolePermissions expects a ROLE and returns a {module: [...]} map, so look up
            // the staff member's actual role and then index by the current module.
            const staffRole = staff.role || 'staff';
            const rolePermsForModule = (m) => {
                const map = window.authManager?.getRolePermissions?.(staffRole) || {};
                const arr = map[m];
                return Array.isArray(arr) ? arr : [];
            };
            const rolePerms = rolePermsForModule(module).join(', ') || '—';
            const userCustomPerms = (customPerms[module] || []).join(', ') || '—';
            const effectivePerms = Array.from(new Set([...rolePermsForModule(module), ...(customPerms[module] || [])])).join(', ') || '—';

            return `
                <tr>
                    <td>${module.charAt(0).toUpperCase() + module.slice(1)}</td>
                    <td>${rolePerms}</td>
                    <td>
                        <div class="permission-checkboxes-grid">
                            ${allActions.map(action => {
                                const isChecked = (customPerms[module] || []).includes(action); 
                                const actionLabels = {
                                    'view': 'Baxmaq',
                                    'create': 'Yaratmaq',
                                    'edit': 'Yeniləmək',
                                    'delete': 'Silmək'
                                };
                                return `
                                    <label class="permission-checkbox-label">
                                        <input type="checkbox" 
                                               name="perm_${module}_${action}" 
                                               value="${action}"
                                               data-module="${module}"
                                               data-action="${action}"
                                               ${isChecked ? 'checked' : ''}>
                                        <span>${actionLabels[action] || action}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </td>
                    <td>${effectivePerms}</td>
                </tr>
            `;
        }).join('');

        const displayStaffId = staff.publicId || (window.app ? window.app?.formatInternalId?.(staff.id, 'IS') : staff.id); // Use publicId

        const content = `
            <form id="userPermsForm">
                <div style="margin-bottom:1em;">
                    <strong>${staff.name}</strong> (${displayStaffId})
                    <span class="status-badge status-${staff.role}">${staff.role}</span>
                    ${staff.isSuperadmin ? `<span class="status-badge" style="background: #10b981;color:white;">Superadmin</span>` : ''}
                </div>
                <table class="data-table" style="min-width:900px;">
                    <thead>
                        <tr>
                            <th>Bölmə</th>
                            <th>Roldan İcazələr</th>
                            <th style="width: 35%;">Fərdi İcazələr</th>
                            <th>Faktiki İcazələr</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${permsHtml}
                    </tbody>
                </table>
            </form>
            <div style="color:#64748b;font-size:0.95em;margin-top:0.7em;">
                <i class="fas fa-info-circle"></i> Fərdi icazələr rolun icazələrini ləğv etmir, əksinə əlavə edir.
            </div>
            <style>
                .permission-checkboxes-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); 
                    gap: 0.5rem; 
                    padding: 0.5rem; 
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    background: var(--background-color); 
                    font-size: 0.9em; 
                }
                [data-theme="dark"] .permission-checkboxes-grid {
                    background: #3A3A3A; 
                    border-color: #5A5A5A;
                }

                .permission-checkbox-label {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem; 
                    cursor: pointer;
                    white-space: nowrap; 
                    padding: 0.1em 0.5em; 
                    transition: background-color 0.15s ease;
                    border-radius: var(--radius-sm);
                }

                .permission-checkbox-label:hover {
                    background-color: var(--primary-light); 
                }
                [data-theme="dark"] .permission-checkbox-label:hover {
                    background-color: #4A4A44; 
                }

                .permission-checkbox-label input[type="checkbox"] {
                    transform: scale(0.9); 
                    margin-right: 0.2em;
                    cursor: pointer;
                }

                /* Adjust cell padding for permissions table for better fit */
                .modal .data-table th, .modal .data-table td {
                    padding: 0.5rem 0.8rem;
                }
                /* Ensure th for permissions column is wide enough */
                .modal .data-table th:nth-child(3) { 
                    width: 35%; 
                }

                /* Responsive adjustments for the table within modal on mobile */
                @media (max-width: 768px) {
                    .modal .data-table {
                        min-width: 600px; 
                    }
                    .permission-checkboxes-grid {
                        grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); 
                        gap: 0.3rem;
                        padding: 0.3rem;
                        font-size: 0.8em;
                    }
                    .permission-checkbox-label {
                        padding: 0.1em 0.3em;
                    }
                }
            </style>
        `;
        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Ləğv et</button>
            <button class="btn btn-primary" onclick="window.modalManager.saveUserPermissions('${staff.id}')">
                <i class="fas fa-save"></i> Yadda saxla
            </button>
        `;
        this.showModal('Fərdi İcazələr', content, actions, { allowEsc: false });
    }

    async saveUserPermissions(userId) {
        try {
            const form = document.getElementById('userPermsForm');
            const staff = window.app?.data?.staff?.find(s => s.id == userId);
            if (!form || !staff) {
                this.showErrorModal('Xəta', 'Form və ya istifadəçi tapılmadı.');
                return;
            }

            const newCustomPerms = {}; 
            form.querySelectorAll('input[type="checkbox"][data-module][data-action]').forEach(checkbox => {
                if (checkbox.checked) {
                    const module = checkbox.dataset.module;
                    const action = checkbox.dataset.action;
                    if (!newCustomPerms[module]) {
                        newCustomPerms[module] = [];
                    }
                    newCustomPerms[module].push(action);
                }
            });

            console.log('[ModalManager] Saving user permissions. newCustomPerms:', newCustomPerms);

            const updatedStaff = { ...staff, permissions: newCustomPerms };
            
            await window.app?.updateStaff?.(staff.id, updatedStaff); // Ensure await here
            window.notificationManager?.showNotification('success', 'Yadda saxlandı', 'Fərdi icazələr yeniləndi.', 2000);
            this.hideModal();
            // The refresh and module load is handled by app.updateStaff now, ensuring data consistency
        } catch (e) {
            console.error('[ModalManager] Error saving user permissions:', e);
            this.showErrorModal('Xəta', e.message || 'İcazələr saxlanmadı.');
        }
    }

    showFirebaseSettings() {
        // This function is moved to ModuleRenderer.js
        console.error("modalManager.showFirebaseSettings is deprecated. Use moduleRenderer.showFirebaseSettings().");
        if (window.moduleRenderer && typeof window.moduleRenderer.showFirebaseSettings === 'function') {
            window.moduleRenderer.showFirebaseSettings();
        } else {
            this.showErrorModal('Xəta', 'Firebase tənzimləmə funksiyası tapılmadı. Zəhmət olmasın, səhifəni yeniləyin.');
        }
    }

    async saveFirebaseSettings() {
        // This function is moved to ModuleRenderer.js
        console.error("modalManager.saveFirebaseSettings is deprecated. Use moduleRenderer.saveFirebaseSettings().");
        if (window.moduleRenderer && typeof window.moduleRenderer.saveFirebaseSettings === 'function') {
            await window.moduleRenderer.saveFirebaseSettings();
        } else {
            this.showErrorModal('Xəta', 'Firebase tənzimləmələrini saxlama funksiyası tapılmadı.');
        }
    }

    showDBSyncSettings() {
        if (!window.app?.isSuperadmin?.()) {
            this.showErrorModal('İcazə yoxdur', 'Bu parametrlərə yalnız Superadmin baxa bilər.');
            return;
        }
        let dbStatusHtml = '';
        try {
            const ws = window.app?.ws;
            let onlineType = ws?.onlineDBType || '—', onlineDbStr = ws?.onlineDB ? 'Aktiv' : 'Yoxdur';
            let isOnline = ws?.isOnline ? 'Bəli' : 'Xeyr';
            dbStatusHtml = `
                <div style="display:grid;gap:.7rem;">
                    <div><b>Aktiv Sinxron Baza Türü:</b> ${onlineType}</div>
                    <div><b>Online DB:</b> ${onlineDbStr}</div>
                    <div><b>İnternetdə:</b> ${isOnline}</div>
                    <div><b>Sinxronizasiya növbəsi:</b> ${ws?.syncQueue?.length || 0}</div>
                </div>
                <div style="margin:1em 0;">
                    <button class="btn btn-primary" onclick="window.app?.forceSyncAndRefresh?.()"><i class="fas fa-sync"></i> Sinxronizasiya et</button>
                </div>
            `;
        } catch (err) {
            console.error('Error fetching DB status for modal:', err); 
            dbStatusHtml = `<div style="color:#ef4444;">Baza statusu oxunmadı</div>`;
        }
        this.showModal('Baza Sinxronizasiya Statusu', dbStatusHtml, `<button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>`);
    }

    showPocketbaseSettings() {
        const currentSettings = (() => {
            try { return JSON.parse(localStorage.getItem('pocketbaseSettings') || '{}'); } catch { return {}; }
        })();
        const defaults = {
            url: "https://210c-212-47-132-228.ngrok-free.app", 
            enabled: true
        };
        const merged = { ...defaults, ...currentSettings };
        const content = `
            <form id="pocketbaseSettingsForm" class="form-grid">
                <div class="form-group" style="grid-column:1/-1;">
                    <label class="form-label required">PocketBase sinxronizasiya aktiv</label>
                    <select class="form-select" name="enabled">
                        <option value="true" ${merged.enabled !== false ? 'selected' : ''}>Aktiv</option>
                        <option value="false" ${merged.enabled === false ? 'selected' : ''}>Deaktiv</option>
                    </select>
                    <small class="form-help" style="color:#64748b;">PocketBase konfiqurasiyası aktiv olarsa, məlumatlar sinxronizasiya olunacaq.</small>
                </div>
                <div class="form-group" style="grid-column:1/-1;">
                    <label class="form-label required">PocketBase URL</label>
                    <input type="url" class="form-input" name="url" required value="${merged.url}">
                    <small class="form-help" style="color:#64748b;">Məsələn: http://127.0.0.1:8090 (lokal üçün) və ya https://yourdomain.com</small>
                </div>
            </form>
        `;
        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.modalManager.savePocketbaseSettings()">
                <i class="fas fa-save"></i>
                Yadda saxla
            </button>
        `;
        this.showModal("PocketBase Tənzimləmələri", content, actions, { allowEsc: false });
    }

    async savePocketbaseSettings() {
        try {
            const form = document.getElementById('pocketbaseSettingsForm');
            const formData = new FormData(form);
            const config = {};
            for (const [k, v] of formData.entries()) config[k] = v;
            config.enabled = config.enabled === 'true';
            localStorage.setItem('pocketbaseSettings', JSON.stringify(config));
            window.notificationManager?.showNotification('success', 'PocketBase tənzimləmələri yadda saxlandı', '');
            window.modalManager?.hideModal && window.modalManager?.hideModal();
            if (window.app && typeof window.app?.reinitializeDatabase === "function") {
                await window.app?.reinitializeDatabase?.();
            }
        } catch (e) {
            window.notificationManager?.showNotification('error', 'Saxlanmadı', e.message || "Xəta baş verdi!");
        }
    }

    showStackAuthSettings() {
        const currentSettings = (() => {
            try { return JSON.parse(localStorage.getItem('stackAuthSettings') || '{}'); } catch { return {}; }
        })();
        const defaults = window.app?.defaultStackAuthConfig || {
            projectId: '',
            jwksUrl: '',
            enabled: false
        };
        const merged = { ...defaults, ...currentSettings };
        const content = `
            <form id="stackAuthSettingsForm" class="form-grid">
                <div class="form-group" style="grid-column:1/-1;">
                    <label class="form-label required">Stack Auth İnteqrasiyası Aktiv</label>
                    <select class="form-select" name="enabled">
                        <option value="true" ${merged.enabled !== false ? 'selected' : ''}>Aktiv</option>
                        <option value="false" ${merged.enabled === false ? 'selected' : ''}>Deaktiv</option>
                    </select>
                    <small class="form-help" style="color:#64748b;">Stack Auth aktiv olarsa, xarici sistemlərlə autentifikasiya üçün istifadə oluna bilər.</small>
                </div>
                <div class="form-group">
                    <label class="form-label required">Project ID</label>
                    <input type="text" class="form-input" name="projectId" required value="${merged.projectId}">
                </div>
                <div class="form-group">
                    <label class="form-label required">JWKS URL</label>
                    <input type="url" class="form-input" name="jwksUrl" required value="${merged.jwksUrl}">
                    <small class="form-help" style="color:#64748b;">JSON Web Key Set URL-i.</small>
                </div>
            </form>
        `;
        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.modalManager.saveStackAuthSettings()">
                <i class="fas fa-save"></i> Yadda saxla
            </button>
        `;
        this.showModal("Stack Auth Tənzimləmələri", content, actions, { allowEsc: false });
    }

    async saveStackAuthSettings() {
        try {
            const form = document.getElementById('stackAuthSettingsForm');
            const formData = new FormData(form);
            const config = {};
            for (const [k, v] of formData.entries()) config[k] = v;
            config.enabled = config.enabled === 'true';
            localStorage.setItem('stackAuthSettings', JSON.stringify(config));
            window.notificationManager?.showNotification('success', 'Stack Auth tənzimləmələri yadda saxlandı', '');
            window.modalManager?.hideModal?.();
        } catch (e) {
            window.notificationManager?.showNotification('error', 'Saxlanmadı', e.message || "Xəta baş verdi!");
        }
    }

    showBookingIntegration() {
        const currentSettings = (() => {
            try { return JSON.parse(localStorage.getItem('bookingIntegrationSettings') || '{}'); } catch { return {}; }
        })();
        const defaults = {
            apiKey: '',
            secretKey: '',
            channelId: '',
            enabled: false
        };
        const merged = { ...defaults, ...currentSettings };
        const content = `
            <form id="bookingIntegrationForm" class="form-grid">
                <div class="form-group" style="grid-column:1/-1;">
                    <label class="form-label required">Booking.com İnteqrasiyası Aktiv</label>
                    <select class="form-select" name="enabled">
                        <option value="true" ${merged.enabled === true ? 'selected' : ''}>Aktiv</option>
                        <option value="false" ${merged.enabled !== true ? 'selected' : ''}>Deaktiv</option>
                    </select>
                    <small class="form-help" style="color:#64748b;">Aktiv olduqda, Booking.com rezervasiyaları avtomatik sinxronizasiya oluna bilər.</small>
                </div>
                <div class="form-group">
                    <label class="form-label">API Key</label>
                    <input type="text" class="form-input" name="apiKey" value="${merged.apiKey || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Secret Key</label>
                    <input type="password" class="form-input" name="secretKey" value="${merged.secretKey || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Channel ID</label>
                    <input type="text" class="form-input" name="channelId" value="${merged.channelId || ''}">
                </div>
            </form>
        `;
        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.modalManager.saveBookingIntegration()">
                <i class="fas fa-save"></i> Yadda saxla
            </button>
        `;
        this.showModal("Booking.com Tənzimləmələri", content, actions, { allowEsc: false });
    }

    async saveBookingIntegration() {
        try {
            const form = document.getElementById('bookingIntegrationForm');
            const formData = new FormData(form);
            const config = {};
            for (const [k, v] of formData.entries()) config[k] = v;
            config.enabled = config.enabled === 'true';

            localStorage.setItem('bookingIntegrationSettings', JSON.stringify(config));
            window.notificationManager?.showNotification('success', 'Booking.com tənzimləmələri yadda saxlandı', '');
            window.modalManager?.hideModal?.();
            if (window.app && window.app.currentModule === 'settings') {
                window.app.loadModule('settings');
            }
        } catch (e) {
            window.notificationManager?.showNotification('error', 'Saxlanmadı', e.message || "Xəta baş verdi!");
        }
    }

    showMegaNzSettings() {
        const currentSettings = (() => {
            try { return JSON.parse(localStorage.getItem('megaNzSettings') || '{}'); } catch { return {}; }
        })();
        const defaults = {
            email: '',
            password: '', 
            apiKey: '', 
            enabled: false
        };
        const merged = { ...defaults, ...currentSettings };
        const content = `
            <form id="megaNzSettingsForm" class="form-grid">
                <div class="form-group" style="grid-column:1/-1;">
                    <label class="form-label required">Mega.nz İnteqrasiyası Aktiv</label>
                    <select class="form-select" name="enabled">
                        <option value="true" ${merged.enabled === true ? 'selected' : ''}>Aktiv</option>
                        <option value="false" ${merged.enabled !== true ? 'selected' : ''}>Deaktiv</option>
                    </select>
                    <small class="form-help" style="color:#64748b;">Aktiv olduqda, faylları Mega.nz buluduna yükləyə və ya yükləyə bilərsiniz.</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Hesab E-poçtu</label>
                    <input type="email" class="form-input" name="email" value="${merged.email || ''}" placeholder="istifadəçi@mega.nz">
                </div>
                <div class="form-group">
                    <label class="form-label">Hesab Şifrəsi</label>
                    <input type="password" class="form-input" name="password" value="${merged.password || ''}" placeholder="şifrə (diqqətli olun)">
                    <small class="form-help" style="color:#ef4444;">Vacib: Şifrə birbaşa brauzerdə şifrələnmədən saxlanacaq. Bu, yalnız Electron tətbiqi üçün nəzərdə tutulub.</small>
                </div>
                <div class="form-group" style="grid-column:1/-1;">
                    <label class="form-label">Mega.nz API Key (Əgər varsa)</label>
                    <input type="text" class="form-input" name="apiKey" value="${merged.apiKey || ''}" placeholder="API açarı (əgər istifadə edilirsə)">
                    <small class="form-help" style="color:#64748b;">Bəzi inteqrasiyalar üçün tələb oluna bilər. Ümumiyyətlə, e-poçt və şifrə ilə giriş yetərlidir.</small>
                </div>
            </form>
        `;
        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.modalManager.saveMegaNzSettings()">
                <i class="fas fa-save"></i> Yadda saxla
            </button>
        `;
        this.showModal("Mega.nz Tənzimləmələri", content, actions, { allowEsc: false });
    }

    async saveMegaNzSettings() {
        try {
            const form = document.getElementById('megaNzSettingsForm');
            const formData = new FormData(form);
            const config = {};
            for (const [k, v] of formData.entries()) config[k] = v;
            config.enabled = config.enabled === 'true';

            if (config.enabled && !((config.email && config.password) || config.apiKey)) { 
                window.notificationManager?.showNotification('error', 'Xəta', 'Mega.nz aktiv olarsa, email və şifrə VƏ YA API açarı mütləqdir.');
                return;
            }

            localStorage.setItem('megaNzSettings', JSON.stringify(config));
            window.notificationManager?.showNotification('success', 'Mega.nz tənzimləmələri yadda saxlandı', '');
            window.modalManager?.hideModal?.();
            if (window.app && window.app.currentModule === 'settings') {
                window.app.loadModule('settings');
            }
        } catch (e) {
            window.notificationManager?.showNotification('error', 'Saxlanmadı', e.message || "Xəta baş verdi!");
        }
    }

    showCozyCloudSettings() {
        const currentSettings = (() => {
            try { return JSON.parse(localStorage.getItem('cozyCloudSettings') || '{}'); } catch { return {}; }
        })();
        const defaults = {
            url: "",
            token: "",
            enabled: false
        };
        const merged = { ...defaults, ...currentSettings };
        const content = `
            <form id="cozyCloudSettingsForm" class="form-grid">
                <div class="form-group" style="grid-column:1/-1;">
                    <label class="form-label required">Cozy Cloud İnteqrasiyası Aktiv</label>
                    <select class="form-select" name="enabled">
                        <option value="true" ${merged.enabled === true ? 'selected' : ''}>Aktiv</option>
                        <option value="false" ${merged.enabled !== true ? 'selected' : ''}>Deaktiv</option>
                    </select>
                    <small class="form-help" style="color:#64748b;">Aktiv olduqda, məlumatlar Cozy Cloud ilə sinxronizasiya oluna bilər.</small>
                </div>
                <div class="form-group">
                    <label class="form-label required">Cozy URL</label>
                    <input type="url" class="form-input" name="url" required value="${merged.url || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label required">Cozy Token</label>
                    <input type="password" class="form-input" name="token" required value="${merged.token || ''}">
                    <small class="form-help" style="color:#ef4444;">Vacib: Token birbaşa brauzerdə şifrələnmədən saxlanacaq. Yalnız Electron tətbiqi üçün nəzərdə tutulub.</small>
                </div>
            </form>
        `;
        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.modalManager.saveCozyCloudSettings()">
                <i class="fas fa-save"></i>
                Yadda saxla
            </button>
        `;
        this.showModal("Cozy Cloud Tənzimləmələri", content, actions, { allowEsc: false });
    }

    async saveCozyCloudSettings() {
        try {
            const form = document.getElementById('cozyCloudSettingsForm');
            const formData = new FormData(form);
            const config = {};
            for (const [k, v] of formData.entries()) config[k] = v;
            config.enabled = config.enabled === 'true';

            if (config.enabled && (!config.url || !config.token)) {
                window.notificationManager?.showNotification('error', 'Xəta', 'Cozy Cloud aktiv olarsa, URL və Token mütləqdir.');
                return;
            }

            localStorage.setItem('cozyCloudSettings', JSON.stringify(config));
            window.notificationManager?.showNotification('success', 'Cozy Cloud tənzimləmələri yadda saxlandı', '');
            window.modalManager?.hideModal?.();
            if (window.app && window.app.currentModule === 'settings') {
                window.app.loadModule('settings');
            }
        } catch (e) {
            window.notificationManager?.showNotification('error', 'Saxlanmadı', e.message || "Xəta baş verdi!");
        }
    }

    showPaymentIntegration() {
        const currentSettings = (() => {
            try { return JSON.parse(localStorage.getItem('paymentIntegrationSettings') || '{}'); } catch { return {}; }
        })();
        const defaults = {
            apiKey: '',
            merchantId: '',
            enabled: false
        };
        const merged = { ...defaults, ...currentSettings };
        const content = `
            <form id="paymentIntegrationForm" class="form-grid">
                <div class="form-group" style="grid-column:1/-1;">
                    <label class="form-label required">Ödəniş Qapısı İnteqrasiyası Aktiv</label>
                    <select class="form-select" name="enabled">
                        <option value="true" ${merged.enabled === true ? 'selected' : ''}>Aktiv</option>
                        <option value="false" ${merged.enabled !== true ? 'selected' : ''}>Deaktiv</option>
                    </select>
                    <small class="form-help" style="color:#64748b;">Aktiv olduqda, seçilmiş ödəniş qapısı vasitəsilə ödənişlər qəbul edilə bilər.</small>
                </div>
                <div class="form-group">
                    <label class="form-label">API Key</label>
                    <input type="text" class="form-input" name="apiKey" value="${merged.apiKey || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Merchant ID</label>
                    <input type="text" class="form-input" name="merchantId" value="${merged.merchantId || ''}">
                </div>
                <div class="form-group" style="grid-column:1/-1;">
                    <label class="form-label">Test rejimi</label>
                    <select class="form-select" name="testMode">
                        <option value="true" ${merged.testMode === true ? 'selected' : ''}>Aktiv</option>
                        <option value="false" ${merged.testMode !== true ? 'selected' : ''}>Deaktiv</option>
                    </select>
                </div>
            </form>
        `;
        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.modalManager.savePaymentIntegration()">
                <i class="fas fa-save"></i> Yadda saxla
            </button>
        `;
        this.showModal("Ödəniş Qapısı Tənzimləmələri", content, actions, { allowEsc: false });
    }

    async savePaymentIntegration() {
        try {
            const form = document.getElementById('paymentIntegrationForm');
            const formData = new FormData(form);
            const config = {};
            for (const [k, v] of formData.entries()) config[k] = v;
            config.enabled = config.enabled === 'true';
            config.testMode = config.testMode === 'true';

            if (config.enabled && (!config.apiKey || !config.merchantId)) {
                window.notificationManager?.showNotification('error', 'Xəta', 'Ödəniş qapısı aktiv olarsa, API Key və Merchant ID mütləqdir.');
                return;
            }

            localStorage.setItem('paymentIntegrationSettings', JSON.stringify(config));
            window.notificationManager?.showNotification('success', 'Ödəniş qapısı tənzimləmələri yadda saxlandı', '');
            window.modalManager?.hideModal?.();
            if (window.app && window.app.currentModule === 'settings') {
                window.app.loadModule('settings');
            }
        } catch (e) {
            window.notificationManager?.showNotification('error', 'Saxlanmadı', e.message || "Xəta baş verdi!");
        }
    }

    /**
     * Displays a modal to send a custom Telegram message to a specific staff member.
     * @param {string} staffId - The ID of the staff member (database ID/UID).
     * @param {string} staffName - The name of the staff member.
     */
    showSendTelegramMessageModal(staffId, staffName) {
        const staff = window.app?.data?.staff?.find(s => s.id === staffId);
        if (!staff || !staff.telegramId) {
            this.showErrorModal('Xəta', `${staffName} üçün Telegram ID qeyd olunmayıb. Zəhmət olmasın, işçinin profilini redaktə edin.`);
            return;
        }

        if (!window.authManager.hasPermission('staff', 'edit')) {
            this.showErrorModal('İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
            return;
        }

        const content = `
            <form id="sendTelegramMessageForm" data-staff-id="${staffId}">
                <div class="form-group">
                    <label class="form-label">İşçi</label>
                    <input type="text" class="form-input" value="${staffName}" readonly>
                    <small class="form-help">Telegram ID: ${staff.telegramId}</small>
                </div>
                <div class="form-group">
                    <label class="form-label required">Mesajın Məzmunu</label>
                    <textarea class="form-textarea" name="telegramMessage" rows="5" required placeholder="Mesajı bura yazın..."></textarea>
                </div>
            </form>
        `;

        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Ləğv et</button>
            <button class="btn btn-primary" id="sendTelegramBtn" onclick="window.modalManager.sendTelegramMessageFromModal('${staffId}')">
                <i class="fab fa-telegram-plane"></i> Göndər
            </button>
        `;

        this.showModal(`Telegram Mesajı Göndər: ${staffName}`, content, actions, { allowEsc: false });
    }

    async sendTelegramMessageFromModal(staffId) {
        const form = document.getElementById('sendTelegramMessageForm');
        const sendBtn = document.getElementById('sendTelegramBtn');
        const textarea = form.querySelector('[name="telegramMessage"]');

        if (!textarea || textarea.value.trim() === "") {
            window.notificationManager?.showNotification('warning', 'Mesaj Boşdur', 'Zəhmət olmasın, mesaj daxil edin.');
            textarea?.focus();
            return;
        }

        const message = textarea.value.trim();
        const staff = window.app?.data?.staff?.find(s => s.id === staffId);

        if (!staff || !staff.telegramId) {
            this.showErrorModal('Xəta', 'İşçi tapılmadı və ya Telegram ID yoxdur.');
            return;
        }
        
        // Prevent double submission
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Göndərilir...';
        }

        try {
            // Build message with HTML formatting for bold/line breaks
            const formattedMessage = `<b>Xəbərdarlıq/Mesaj:</b>\n\n${message}`;

            // Pass staff.telegramId directly as the specificStaffId for direct message handling
            const sent = await window.notificationManager.sendTelegramMessage(
                formattedMessage, 
                staff.telegramId, 
                'staff', // Module type for context (not used for recipient here)
                false // Do not force all
            );

            if (sent) {
                window.notificationManager.showNotification('success', 'Göndərildi', `${staff.name} adlı işçiyə mesaj göndərildi.`, 3000);
                this.hideModal();
            } else {
                 throw new Error("Mesaj Telegram API tərəfindən rədd edildi və ya çatmadı.");
            }

        } catch (error) {
            console.error("Error sending Telegram message:", error);
            window.notificationManager.showNotification('error', 'Göndərmə Xətası', `Mesaj göndərilmədi: ${error.message}`);
        } finally {
             if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fab fa-telegram-plane"></i> Göndər';
            }
        }
    }

    showReservationDetails(reservationId) {
        try {
            const reservation = window.app?.data?.reservations?.find(r => r.id == reservationId);
            if (!reservation) {
                window.notificationManager?.showNotification('error', 'Xəta', 'Rezervasiya tapılmadı');
                return;
            }

            const guest = window.app?.data?.guests?.find(g => g.id === reservation.guestId);
            const room = window.app?.data?.rooms?.find(r => r.id === reservation.roomId);
            
            const financialSummary = window.app?.getReservationFinancialSummary?.(reservationId);
            const paidAmount = financialSummary?.totalPaid || 0;
            const posSalesTotal = financialSummary?.posSalesAmount || 0;
            const totalAmountDueDisplay = financialSummary?.totalAmountDue || 0; 
            const debt = financialSummary?.remainingBalance || 0;

            const selectedServices = (reservation.selectedServices || []).map(serviceId => {
                const service = window.app?.data?.services?.find(s => s.id === serviceId);
                return service ? service.name : 'N/A';
            });

            const payments = window.app?.data?.cashTransactions?.filter(t => 
                t.type === 'income' && 
                (t.category === 'Rezervasiya ödənişi' || t.category === 'POS satış (hesaba)') && 
                t.reservationId === reservationId
            );

            const displayResId = reservation.publicId || (window.app ? window.app?.formatInternalId?.(reservation.id, 'RZ') : reservation.id); 
            const displayGuestId = guest?.publicId || (window.app ? window.app?.formatInternalId?.(guest?.id, 'QN') : guest?.id); 

            const content = `
                <div class="reservation-details">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                        <div class="detail-section">
                            <h4 style="margin: 0 0 1rem 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">
                                <i class="fas fa-user"></i> Qonaq Məlumatları
                            </h4>
                            <div class="detail-grid">
                                <div><strong>ID:</strong> ${displayGuestId}</div>
                                <div><strong>Ad Soyad:</strong> ${guest?.name || 'N/A'}</div>
                                <div><strong>Email:</strong> ${guest?.email || 'N/A'}</div>
                                <div><strong>Telefon:</strong> ${guest?.phone || 'N/A'}</div>
                                <div><strong>Pasport:</strong> ${guest?.passportNo || 'N/A'}</div>
                            </div>
                        </div>

                        <div class="detail-section">
                            <h4 style="margin: 0 0 1rem 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">
                                <i class="fas fa-bed"></i> Otaq Məlumatları
                            </h4>
                            <div class="detail-grid">
                                <div><strong>Otaq:</strong> ${room?.number || 'N/A'} (${room?.type || 'N/A'})</div>
                                <div><strong>Tip:</strong> ${room?.type || 'N/A'}</div>
                                <div><strong>Mərtəbə:</strong> ${room?.floor || 'N/A'}</div>
                                <div><strong>Gecəlik qiymət:</strong> ₼${(reservation.roomTotal / (reservation.nights || 1)).toFixed(2)}/gecə</div>
                            </div>
                        </div>
                    </div>

                    <div class="detail-section" style="margin-top: 1.5rem;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">
                            <i class="fas fa-calendar-check"></i> Rezervasiya Detalları
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                            <div><strong>Rezervasiya ID:</strong> ${displayResId}</div>
                            <div><strong>Giriş:</strong> ${window.app?.formatDate?.(reservation.checkIn)}</div>
                            <div><strong>Çıxış:</strong> ${window.app?.formatDate?.(reservation.checkOut)}</div>
                            <div><strong>Gecə sayı:</strong> ${reservation.nights}</div>
                            <div><strong>Böyük:</strong> ${reservation.adults} nəfər</div>
                            <div><strong>Uşaq:</strong> ${reservation.children} nəfər</div>
                            <div>
                                <strong>Status:</strong> 
                                <span class="status-badge status-${reservation.status}">
                                    ${window.statusHelper.getReservationStatus(reservation.status)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="detail-section" style="margin-top: 1.5rem;">
                        <h4 style="margin: 0 0 0.5rem 0;">Ödəniş Məlumatları</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                            <div><strong>Otaq məbləği:</strong> ₼${reservation.roomTotal.toFixed(2)}</div>
                            <div><strong>Xidmətlər:</strong> ₼${reservation.servicesTotal.toFixed(2)}</div>
                            <div><strong>POS satış:</strong> ₼${posSalesTotal.toFixed(2)}</div>
                            <div><strong>Ümumi məbləğ:</strong> ₼${totalAmountDueDisplay.toFixed(2)}</div>
                            <div><strong>Ödənilən:</strong> ₼${paidAmount.toFixed(2)}</div>
                            <div>
                                <strong>Qalıq borc:</strong> 
                                <span style="color: ${debt > 0 ? '#ef4444' : '#10b981'};">
                                    ₼${debt.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        ${payments.length ? `
                            <div style="margin-top: 1rem;">
                                <h5 style="margin: 0 0 0.5rem 0;">Ödəniş Tarixçəsi:</h5>
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Tarix</th>
                                            <th>Növ</th>
                                            <th>Məbləğ</th>
                                            <th>Qeyd</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${payments.map(p => `
                                            <tr>
                                                <td>${window.app?.formatDate?.(p.date || p.createdAt, true)}</td>
                                                <td>${p.category}</td>
                                                <td>₼${p.amount.toFixed(2)}</td>
                                                <td>${p.description || '-'} (ID: ${p.publicId || p.id})</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;

            const actions = `
                <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
                <button class="btn btn-primary" onclick="window.modalManager.showReservationForm('${reservationId}')">
                    <i class="fas fa-edit"></i>
                    Redaktə et
                </button>
                ${debt > 0 && reservation.status !== 'cancelled' ? `
                <button class="btn btn-secondary" onclick="window.modalManager.hideModal(); window.modalManager.showCashForm('income', null, '${reservation.id}')">
                    <i class="fas fa-money-bill-wave"></i>
                    Ödəniş al
                </button>
                ` : ''}
                <button class="btn btn-primary" onclick="window.app?.generateInvoiceForReservation?.('${reservation.id}')">
                    <i class="fas fa-file-invoice"></i>
                    Faktura
                </button>
            `;

            this.showModal(`Rezervasiya #${displayResId}`, content, actions);

        } catch (error) {
            console.error('Error showing reservation details:', error);
            window.notificationManager?.showNotification('error', 'Modal Xətası', 'Rezervasiya detalları göstərilmədi.');
        }
    }

    async showPaymentForm(cartItems, total) {
        try {
            if (!window.paymentForm) {
                window.paymentForm = new PaymentForm();
            }
            const content = window.paymentForm.render(cartItems, total);
            const actions = `
                <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Ləğv et</button>
                <button class="btn btn-primary" onclick="window.paymentForm.processPayment()">
                    <i class="fas fa-check"></i>
                    Ödənişi Tamamla
                </button>
            `;
            this.showModal('Ödəniş', content, actions, { allowEsc: false });

            const formNode = document.querySelector('form[id^="paymentForm_"]');
            if (formNode) {
                window.paymentForm.attachEventListeners(formNode, cartItems, total);
            }

        } catch (error) {
            console.error('Error showing payment form:', error);
            if (window.notificationManager) {
                window.notificationManager?.showNotification('error', 'Xəta', 'Ödəniş formu açılmadı.');
            }
        }
    }

    showCashAccountForm(accountId = null) {
        const isEdit = accountId !== null;
        const account = isEdit ? window.app?.data?.cashAccounts?.find(a => a.id === accountId) : null;
        
        const content = `
            <form id="cashAccountForm" class="form-grid">
                <div class="form-group">
                    <label class="form-label required">Hesab Adı</label>
                    <input type="text" class="form-input" name="name" value="${isEdit ? account.name : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Hesab Növü</label>
                    <select class="form-select" name="type" required>
                        <option value="cash">Nağd</option>
                        <option value="bank" ${isEdit && account.type === 'bank' ? 'selected' : ''}>Bank</option>
                        <option value="pos" ${isEdit && account.type === 'pos' ? 'selected' : ''}>POS Terminal</option>
                        <option value="other" ${isEdit && account.type === 'other' ? 'selected' : ''}>Digər</option>
                    </select>
                </div>

                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label">Təsvir</label>
                    <textarea class="form-textarea" name="description" rows="3">${isEdit ? account.description || '' : ''}</textarea>
                </div>
            </form>
        `;
        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Ləğv et</button>
            <button class="btn btn-primary" onclick="window.app?.saveCashAccount?.(${isEdit ? `'${accountId}'` : 'null'})">
                ${isEdit ? 'Yenilə' : 'Əlavə et'}
            </button>
        `;

        this.showModal(
            isEdit ? 'Hesabı Redaktə Et' : 'Yeni Hesab',
            content,
            actions,
            { allowEsc: false }
        );
    }

    showGuestDetails(guestId) {
        try {
            if (!guestId) return;
            const guest = window.app?.data?.guests?.find(g => g.id == guestId);
            if (!guest) {
                window.notificationManager?.showNotification('error', 'Xəta', 'Qonaq tapılmadı');
                return;
            }

            let isImage = false, docExt = '';
            let docPreviewHtml = '';
            if (guest.documentUrl) {
                docExt = guest.documentUrl.split('.').pop().toLowerCase().split(/\?|#/)[0];
                isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(docExt);
                if (isImage) {
                    docPreviewHtml = `
                        <div style="margin-top:1rem; max-width:100%; text-align:center;">
                            <a href="${guest.documentUrl}" target="_blank" title="Şəkili böyüt">
                                <img src="${guest.documentUrl}" alt="Qonaq sənədi" 
                                    style="max-width:210px; max-height:160px; border-radius:0.5rem; border:1.5px solid #d1d5db; margin-bottom:0.35rem; box-shadow:0 2px 8px #38bdf828;">
                            </a>
                            <br>
                            <a href="${guest.documentUrl}" target="_blank" style="color:#3b82f6;font-size:1em;">
                                <i class="fas fa-search-plus"></i> Sənədi böyüt / endir
                            </a>
                        </div>`;
                } else {
                    docPreviewHtml = `
                        <div style="margin-top:1rem; text-align:center;">
                            <a href="${guest.documentUrl}" target="_blank" style="color:#3b82f6;text-decoration:none;font-weight:500;">
                                <i class="fas fa-file-alt"></i> Sənədi yüklə (${docExt.toUpperCase()})
                            </a>
                        </div>`;
                }
            }

            let reservationHistoryHtml = '';
            try {
                const allReservations = window.app?.data?.reservations ?? [];
                const guestReservations = allReservations
                    .filter(r => r.guestId == guestId)
                    .sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));
                if (guestReservations.length > 0) {
                    reservationHistoryHtml = `
                        <div style="margin-top:2.1rem;">
                            <h4 style="color:#3b82f6;margin:0 0 1rem 0;"><i class="fas fa-calendar-check"></i> Rezervasiyalar Tarixi</h4>
                            <table class="data-table" style="font-size:0.94em;">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Otaq</th>
                                        <th>Giriş</th>
                                        <th>Çıxış</th>
                                        <th>Status</th>
                                        <th>Məbləğ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${
                                        guestReservations.map(r => {
                                            const room = window.app?.data?.rooms?.find(room => room.id === r.roomId);
                                            const resPublicId = r.publicId || (window.app ? window.app?.formatInternalId?.(r.id, 'RZ') : r.id); 
                                            return `
                                                <tr>
                                                    <td>${resPublicId}</td>
                                                    <td>${room ? room.number : '—'}</td>
                                                    <td>${window.app?.formatDate?.(r.checkIn)}</td>
                                                    <td>${window.app?.formatDate?.(r.checkOut)}</td>
                                                    <td><span class="status-badge status-${r.status}">${window.statusHelper?.getReservationStatus ? window.statusHelper.getReservationStatus(r.status) : r.status}</span></td>
                                                    <td>₼${(r.totalAmount||0).toFixed(2)}</td>
                                                </tr>
                                            `;
                                        }).join('')
                                    }
                                </tbody>
                            </table>
                        </div>
                    `;
                } else {
                    reservationHistoryHtml = `
                        <div style="margin-top:2.1rem;">
                            <h4 style="color:#3b82f6;margin:0 0 1rem 0;"><i class="fas fa-calendar-check"></i> Rezervasiyalar Tarixi</h4>
                            <div style="color:#64748b;text-align:center;">Qonağın keçmiş rezervasiyası yoxdur.</div>
                        </div>
                    `;
                }
            } catch(e) {
                reservationHistoryHtml = "";
            }

            const guestPublicId = guest.publicId || (window.app ? window.app?.formatInternalId?.(guest.id, 'QN') : guest.id); 

            const content = `
                <div style="padding: 0.5rem 0;">
                    <h3 style="color: #3b82f6; margin: 0 0 1rem 0;">Qonaq Məlumatları</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.2rem; font-size: 1.05em;">
                        <div><strong>ID:</strong> ${guestPublicId}</div>
                        <div><strong>Ad Soyad:</strong> ${guest.name || 'N/A'}</div>
                        <div><strong>Email:</strong> ${guest.email || 'N/A'}</div>
                        <div><strong>Telefon:</strong> ${guest.phone || 'N/A'}</div>
                        <div><strong>Pasport Nömrəsi:</strong> ${guest.passportNo || 'N/A'}</div>
                        <div><strong>Milliyyəti:</strong> ${guest.nationality || 'N/A'}</div>
                        <div><strong>Ünvan:</strong> ${guest.address || 'N/A'}</div>
                        <div><strong>Doğum Tarihi:</strong> ${guest.birthDate || 'N/A'}</div>
                        <div><strong>Cinsi:</strong> ${guest.gender || 'N/A'}</div>
                        <div><strong>Qeydiyyat Tarixi:</strong> ${guest.createdAt || 'N/A'}</div>
                    </div>
                    ${docPreviewHtml}
                    ${reservationHistoryHtml}
                </div>
            `;
            const actions = `
                <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
                <button class="btn btn-primary" onclick="window.modalManager.showGuestForm('${guestId}')">
                    <i class="fas fa-edit"></i> Redaktə et
                </button>
            `;
            this.showModal('Qonaq Detalları', content, actions);

        } catch (error) {
            console.error('Error showing guest details:', error);
            window.notificationManager?.showNotification('error', 'Modal Xətası', 'Qonaq detalları göstərilmədi.');
        }
    }

    showImportReservationsForm() {
        try {
            const content = `
                <form id="importReservationsForm" class="form-grid">
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label required">XLS/XLSX faylı seçin</label>
                        <input type="file" class="form-input" name="reservationFile" id="reservationFileInput" accept=".xls,.xlsx" required>
                        <small class="form-help" style="color: #64748b; font-size: 0.75rem; margin-top: 0.25rem; display: block;">
                            Excel faylı (XLS/XLSX) vasitəsilə rezervasiyaları idxal edin.
                            Faylda "Qonaq Adı", "Otaq Nömrəsi", "Giriş Tarixi", "Çıxış Tarixi", "Böyük Sayı" sütunları mütləq olmalıdır.
                        </small>
                    </div>
                    <div id="importProgress" style="display: none; margin-top: 1rem; grid-column: 1 / -1;">
                        <div style="background: #f1f5f9; border-radius: 0.5rem; overflow: hidden;">
                            <div id="importProgressBar" style="height: 6px; background: #3b82f6; width: 0%; transition: width 0.3s ease;"></div>
                        </div>
                        <small style="color: #64748b; margin-top: 0.25rem; display: block;">İdxal edilir...</small>
                    </div>
                    <div id="importResult" style="margin-top: 1rem; padding: 1rem; background: #f8fafc; display: none; grid-column: 1 / -1;">
                        <!-- Import results will be displayed here -->
                    </div>
                </form>
            `;
            const actions = `
                <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Ləğv et</button>
                <button class="btn btn-primary" id="importReservationsBtn" onclick="window.app?.importReservationsFromFile?.()">
                    <i class="fas fa-file-import"></i> İdxal et
                </button>
            `;
            this.showModal('Rezervasiya İdxalı', content, actions, { allowEsc: false });
        } catch (error) {
            console.error('Error showing import reservations form:', error);
            window.notificationManager?.showNotification('error', 'Modal Xətası', 'Form açılmadı. Təkrar cəhd edin.');
        }
    }

    showWipeDataModal() {
        if (!window.app?.isSuperadmin?.()) {
            this.showErrorModal('İcazə yoxdur', 'Bu bölməyə yalnız Superadmin giriş edə bilər.', { allowEsc: true });
            return;
        }

        const collectionOptions = Object.entries(window.app?.collections || {}).map(([key, name]) => {
            if (key === 'settings') {
                return ''; 
            }
            return `<option value="${key}">${name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>`;
        }).join('');

        const content = `
            <div style="text-align: center; padding: 1rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                <h3 style="color: #ef4444; margin-bottom: 0.5rem;">Məlumatları Sıfırla</h3>
                <p style="color: #1e293b; font-size: 1.1rem; margin-bottom: 1.5rem;">
                    Bütün bu otel məlumatlarını tamamilə silmək istədiyinizə əminsiniz?
                    Bu əməliyyat geri qaytarıla bilməz və lokal, həmçinin server bazasından bütün məlumatları siləcəkdir.
                </p>
                <div class="form-group">
                    <label class="form-label">Silinəcək məlumat növünü seçin:</label>
                    <select class="form-select" id="wipeDataTypeSelect">
                        <option value="all">Bütün məlumatlar (Hər şey silinir!)</option>
                        ${collectionOptions}
                    </select>
                    <input type="text" class="form-input" id="wipeDataConfirmInput" placeholder="Silməyi təsdiqləmək üçün 'Bəli' yazın" style="margin-top: 1rem;">
                </div>
            </div>
        `;
        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Ləğv et</button>
            <button class="btn btn-primary" style="background-color: #ef4444;" onclick="window.app?.wipeData?.()">
                <i class="fas fa-eraser"></i> Məlumatları Sil
            </button>
        `;
        this.showModal('Məlumatları Sıfırla', content, actions, { allowEsc: false });
    }

    _getSafeConnectionStatus() {
        let status = { isOnline: false, queueLength: 0, lastSyncTime: '0', hasOnlineDB: false, lastError: 'Sistem yüklənir...' };
        try {
            if (window.app?.ws && typeof window.app.ws?.getConnectionStatus === "function") {
                const wsStatus = window.app.ws?.getConnectionStatus();
                status = {
                    isOnline: wsStatus.isOnline,
                    hasOnlineDB: wsStatus.hasOnlineDB,
                    queueLength: wsStatus.queueLength,
                    lastSyncTime: wsStatus.lastSyncTime,
                    lastError: wsStatus.lastError
                };
            }
        } catch (e) {
            console.warn('Error fetching connection status from window.app.ws:', e);
            status.lastError = 'API xətası: ' + e.message; 
        }
        return status;
    }

    async _generateConnectionStatusContent() {
        const status = this._getSafeConnectionStatus();

        let collectionCounts = {};
        let hasLocalAhead = false;
        try {
            if (window.app?.ws && typeof window.app.ws?.getCollectionCounts === "function") {
                collectionCounts = await window.app.ws?.getCollectionCounts();
                for (const colName in collectionCounts) {
                    const counts = collectionCounts[colName];
                    if (counts.localCount !== 'Error' && counts.onlineCount !== 'N/A' && counts.onlineCount !== 'Xəta' && counts.localCount > counts.onlineCount) {
                        hasLocalAhead = true;
                        break;
                    }
                }
            }
        } catch (e) {
            console.warn('Error fetching collection counts:', e);
            collectionCounts = {};
        }

        const formatCollectionName = (name) => {
            const displayNames = {
                'guests': 'Qonaqlar',
                'rooms': 'Otaqlar',
                'reservations': 'Rezervasiyalar',
                'services': 'Xidmətlər',
                'inventory': 'Anbar',
                'staff': 'İşçilər',
                'maintenance': 'Təmizlik/Təmir',
                'cash_transactions': 'Kassa Əməliyyatları',
                'invoices': 'Fakturalar',
                'pos_sales': 'POS Satışlar',
                'reports': 'Hesabatlar',
                'settings': 'Tənzimləmələr',
                'audit_logs': 'Audit Jurnalları',
                'purchase_documents': 'Alış Sənədləri'
            };
            return displayNames[name] || name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        };

        let collectionDetailsHtml = '';
        if (Object.keys(collectionCounts).length > 0) {
            collectionDetailsHtml = `
                <div style="margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 0.8rem; color: #1e293b;">Məlumat Sayı (Lokal vs Server)</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        <table class="data-table" style="font-size: 0.9em;">
                            <thead>
                                <tr>
                                    <th>Bölmə</th>
                                    <th>Lokalda</th>
                                    <th>Serverdə</th>
                                    <th>Sinxronizasiya Statusu</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(collectionCounts).map(([colName, counts]) => {
                                    let syncStatusText = 'Uyğun';
                                    let syncStatusColor = '#10b981'; 

                                    if (counts.onlineCount === 'N/A' || counts.onlineCount === 'Xəta') {
                                        syncStatusText = 'Offline / Server Xətası';
                                        syncStatusColor = '#ef4444'; 
                                    } else if (counts.localCount === 'Error') {
                                        syncStatusText = 'Lokal Xəta';
                                        syncStatusColor = '#ef4444'; 
                                    } else if (counts.localCount > counts.onlineCount) {
                                        syncStatusText = `Lokalda daha çox (${counts.localCount - counts.onlineCount} ədəd)`;
                                        syncStatusColor = '#f59e0b'; 
                                    } else if (counts.localCount < counts.onlineCount) {
                                        syncStatusText = `Serverdə daha çox (${counts.onlineCount - counts.localCount} ədəd)`;
                                        syncStatusColor = '#f59e0b'; 
                                    }

                                    return `
                                        <tr>
                                            <td>${formatCollectionName(colName)}</td>
                                            <td>${counts.localCount}</td>
                                            <td>${counts.onlineCount}</td>
                                            <td><span style="color: ${syncStatusColor}; font-weight: 500;">${syncStatusText}</span></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    <small style="color:#64748b; margin-top:0.5em; display:block;">
                        <i class="fas fa-info-circle"></i> "Uyğun" statusu lokal və server məlumatlarının sayında uyğunluğun göstərir.
                    </small>
                </div>
            `;
        }

        let guidanceMessage = '';
        if (status.lastError) {
            guidanceMessage = `
                <div style="margin-top: 1rem; padding: 1rem; background: #fee2e2; border:1px solid #ef4444; border-radius: 0.5rem;">
                    <p style="margin: 0; color: #991b1b; font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-exclamation-triangle"></i> Son Xəta
                    </p>
                    <p style="color: #991b1b; font-size: 0.9rem; margin: 0.5rem 0 0 0; font-family: monospace;">${status.lastError}</p>
                </div>
            `;
            if (status.lastError.includes('Giriş icazəsi yoxdur') || status.lastError.includes('permission-denied')) {
                guidanceMessage += `
                    <div style="margin-top: 1rem; padding: 1rem; background: #f0f9ff; border:1px solid #0ea5e9; border-radius: 0.5rem;">
                        <p style="margin: 0; color: #1e293b;">
                            <b>Firebase Təhlükəsizlik Qaydaları (Security Rules) xətası:</b> Serverdə yazma və oxuma icazələri düzgün tənzimlənməyib.
                            Test üçün qaydaları müvəqqəti olaraq belə təyin edə bilərsiniz:
                            <pre style="background:#e0f2fe;padding:0.5rem;border-radius:0.5rem;margin-top:0.5rem;font-size:0.85em;"><code>rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}</code></pre>
                            <b>Vacib:</b> Bu qaydalar təhlükəsiz deyil və yalnız test üçündür. Qaydaları tezliklə təhlükəsiz bir şəkildə dəyişdirin.
                        </p>
                    </div>
                `;
            } else if (status.lastError.includes('Şəbəkə xətası') || status.lastError.includes('əlçatmazdır')) {
                guidanceMessage += `
                    <div style="margin-top: 1rem; padding: 1rem; background: #f0f9ff; border:1px solid #0ea5e9; border-radius: 0.5rem;">
                        <p style="margin: 0; color: #1e293b;">
                            <b>Şəbəkə problemi:</b> İnternet bağlantınızı və ya serverin (Firebase, PocketBase və s.) işlək olduğunu yoxlayın.
                        </p>
                    </div>
                `;
            }
        } else if (status.queueLength > 0) {
            guidanceMessage = `
                <div style="margin-top: 1rem; padding: 1rem; background: #fffbeb; border:1px solid #fbbf24; border-radius: 0.5rem;">
                    <p style="margin: 0; color: #92400e;">
                        <b>Gözləyən əməliyyatlar:</b> Lokal bazada serverə göndərilməli ${status.queueLength} ədəd əməliyyat var.
                        İnternet bağlantısı sabit olduqda avtomatik sinxronizasiya olunacaq. Məcburi sinxronizasiya edə bilərsiniz.
                    </p>
                </div>
            `;
        } else if (hasLocalAhead) {
            guidanceMessage = `
                <div style="margin-top: 1rem; padding: 1rem; background: #fffbeb; border:1px solid #fbbf24; border-radius: 0.5rem;">
                    <p style="margin: 0; color: #92400e;">
                        <b>Məlumat fərqliliyi aşkarlandı:</b> Lokal bazada serverdən daha çox məlumat var, lakin gözləyən əməliyyat yoxdur.
                        Bu, son sinxronizasiya cəhdinin server tərəfindən rədd edildiyini (məsələn, icazə səbəbindən) göstərə bilər.
                        Zəhmət olmasın, <b>Firebase Təhlükəsizlik Qaydalarını (Security Rules)</b> yoxlayın və məcburi sinxronizasiya edin.
                    </p>
                </div>
            `;
        } else {
            guidanceMessage = `
                <div style="margin-top: 1.5rem; padding: 1rem; background: #f0f9ff; border:1px solid #0ea5e9; border-radius: 0.5rem;">
                    <p style="margin: 0; color: #1e293b; margin-bottom: 0.5rem;">Sistem lokal bazada işləyir və server əlçatan olduqda avtomatik sinxronizasiya edir.</p>
                </div>
            `;
        }

        return `
            <div style="padding: 1rem;">
                <h4 style="margin-bottom: 1rem;">Bağlantı Statusu</h4>
                <div style="display: grid; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: ${status.isOnline ? '#dcfce7' : '#fee2e2'}; border-radius: 0.5rem;">
                        <span><i class="fas fa-custom-${status.isOnline ? 'wifi' : 'wifi-slash'}"></i> İnternet Bağlantısı</span>
                        <span style="font-weight: bold; color: ${status.isOnline ? '#10b981' : '#ef4444'};">
                            ${status.isOnline ? 'Qoşulu' : 'Qoşulu deyil'}
                        </span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: ${status.hasOnlineDB ? '#dcfce7' : '#fef3c7'}; border-radius: 0.5rem;">
                        <div><i class="fas fa-database"></i> Server Bazası</div>
                        <span style="font-weight: bold; color: ${status.hasOnlineDB ? '#10b981' : '#f59e0b'};">
                            ${status.hasOnlineDB ? 'Mövcud' : 'Mövcud deyil'}
                        </span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #fef9c3; border-radius: 0.5rem;">
                        <span><i class="fas fa-clock"></i> Gözləyən Əməliyyatlar</span>
                        <span style="font-weight: bold;">${status.queueLength}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8fafc; border-radius: 0.5rem;">
                        <span><i class="fas fa-sync"></i> Son Sinxronizasiya</span>
                        <span style="font-weight: bold; color: #64748b;">
                            ${status.lastSyncTime !== '0' ? new Date(status.lastSyncTime).toLocaleString('az-AZ') : 'Heç vaxt'}
                        </span>
                    </div>
                </div>
                
                ${guidanceMessage}
                
                ${collectionDetailsHtml}
            </div>
        `;
    }

    async testAndRefreshConnectionStatus() {
        const modalBody = document.querySelector('.modal-body');
        if (!modalBody) return;

        modalBody.innerHTML = '<div class="loading">Bağlantı yoxlanılır...</div>';

        try {
            if (window.app && window.app.ws) {
                // Re-initialize will perform the connection check and update the internal state
                await window.app.ws.initializeOnlineDB(true);
            } else {
                throw new Error("Sistem komponentləri hazır deyil.");
            }
        } catch (e) {
            console.error("Connection test failed:", e);
            window.notificationManager?.showNotification('error', 'Test Uğursuz Oldu', e.message);
        } finally {
            // Re-generate the content with the latest status and update the modal
            const newContent = await this._generateConnectionStatusContent();
            modalBody.innerHTML = newContent;
        }
    }

    async showConnectionStatus() {
        const content = await this._generateConnectionStatusContent();
        const status = this._getSafeConnectionStatus();

        if (window.modalManager) {
            window.modalManager.showModal(
                'Bağlantı Statusu',
                content,
                `
                    <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
                    <button class="btn btn-secondary" onclick="window.modalManager.testAndRefreshConnectionStatus()">
                        <i class="fas fa-plug"></i> Yenidən Yoxla
                    </button>
                    ${status.isOnline ? `
                    <button class="btn btn-primary" onclick="window.app?.forceSyncAndRefresh?.()">
                        <i class="fas fa-sync"></i>
                        Məcburi Sinxronizasiya
                    </button>
                    ` : ''}
                `
            );
        }
    }

    showTelegramSettings() {
        if (!window.app?.isSuperadmin?.()) {
            this.showErrorModal('İcazə yoxdur', 'Bu bölmə üçün Superadmin olmalısınız.', { allowEsc: true });
            return;
        }
        const currentSettings = window.app?.getSetting('telegramNotificationSettings') || {};
        const allStaff = window.app?.data?.staff || [];

        const renderStaffSelection = (settingKey, label) => {
            const selectedStaffIds = currentSettings[settingKey] || [];
            const extraIdsText = (currentSettings[`${settingKey}_extra`] || []).join(', ');
            return `
                <div class="form-group" style="grid-column: 1 / -1; background: var(--background-color); padding: 1rem; border-radius: 0.5rem;">
                    <label class="form-label" style="font-weight: bold; color: var(--primary-color);">${label}</label>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.5rem; margin-top: 0.5rem;">
                        ${allStaff.map(s => `
                            <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.5rem;">
                                <input type="checkbox" name="${settingKey}" value="${s.id}" ${selectedStaffIds.includes(s.id) ? 'checked' : ''}>
                                <span>${s.name} (${s.role})</span>
                            </label>
                        `).join('')}
                    </div>
                    <textarea class="form-textarea" name="${settingKey}_extra" rows="2" placeholder="Əlavə Telegram ID-ləri (vergüllə ayırın)" style="margin-top: 0.8rem;">${extraIdsText}</textarea>
                    <small class="form-help">Bura əlavə Telegram ID-ləri (rəqəmsal) və ya @username-lər daxil edin. Hər birini vergüllə ayırın.</small>
                </div>
            `;
        };

        const content = `
            <form id="telegramNotificationForm" class="form-grid">
                ${renderStaffSelection('reservationNotifications', 'Rezervasiya Bildirişləri')}
                ${renderStaffSelection('posNotifications', 'POS Satış Bildirişləri')}
                ${renderStaffSelection('maintenanceNotifications', 'Təmir/Təmizlik Bildirişləri')}
                ${renderStaffSelection('inventoryNotifications', 'Anbar Bildirişləri')}
                ${renderStaffSelection('cashNotifications', 'Kassa Əməliyyatları Bildirişləri')}
                ${renderStaffSelection('roomNotifications', 'Otaq Statusu Dəyişikliyi Bildirişləri')}
            </form>
            <div style="margin-top:1.5rem;">
                <button class="btn btn-secondary" onclick="window.notificationManager?.sendTelegramTestNotification?.()"><i class="fas fa-paper-plane"></i> Test Bildiriş Göndər</button>
            </div>
            <p style="margin-top:1rem;font-size:0.9em;color:#64748b;">
                <i class="fab fa-telegram"></i> İşçilər yalnız öz Telegram ID-ləri (profil ayarlarında qeyd olunubsa) vasitəsilə bildirişlər ala bilər.
            </p>
        `;
        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.modalManager.saveTelegramSettings()">
                <i class="fas fa-save"></i> Yadda saxla
            </button>
        `;
        this.showModal("Telegram Bildiriş Tənzimləmələri", content, actions, { allowEsc: false });
    }

    async saveTelegramSettings() {
        try {
            const form = document.getElementById('telegramNotificationForm');
            if (!form) return;

            const notificationSettings = {};
            const categories = [
                'reservationNotifications', 'posNotifications', 'maintenanceNotifications',
                'inventoryNotifications', 'cashNotifications', 'roomNotifications'
            ];

            categories.forEach(category => {
                const selectedStaffIds = [];
                form.querySelectorAll(`input[type="checkbox"][name="${category}"]:checked`).forEach(checkbox => {
                    selectedStaffIds.push(checkbox.value);
                });
                notificationSettings[category] = selectedStaffIds;

                const extraIdsInput = form.querySelector(`textarea[name="${category}_extra"]`);
                if (extraIdsInput) {
                    notificationSettings[`${category}_extra`] = extraIdsInput.value
                        .split(',')
                        .map(id => id.trim())
                        .filter(Boolean); 
                }
            });

            await window.app?.saveSetting('telegramNotificationSettings', notificationSettings);
            
            if (window.notificationManager) {
                window.notificationManager.notificationSettings = notificationSettings; 
            }

            window.notificationManager?.notifyAction?.({
                title: 'Uğurlu',
                message: 'Bildiriş təyinatları yeniləndi.',
                type: 'info',
                sendToTelegramModule: 'settings',
                forceAll: false 
            });
            this.hideModal();
        } catch (error) {
            console.error('Error saving telegram settings:', error);
            window.notificationManager?.showNotification('error', 'Saxlanmadı', error.message || "Telegram tənzimləmələri yadda saxlanmadı.");
        }
    }

    /**
     * REFACTORED: Generic method to display a form modal.
     * @param {string} formKey - The key from this.formConfigurations (e.g., 'reservation', 'guest').
     * @param {string|null} entityId - The ID of the entity to edit, or null for creating a new one.
     */
    _showFormModal(formKey, entityId = null) {
        const config = this.formConfigurations[formKey];
        if (!config) {
            console.error(`_showFormModal: No configuration found for formKey "${formKey}".`);
            return;
        }

        const formInstanceName = `${formKey}Form`; // e.g., 'reservationForm'
        if (!window[formInstanceName]) {
            window[formInstanceName] = new config.formClass();
        }

        const entity = entityId ? (window.app?.data?.[config.collection] || []).find(e => e.id === entityId) : null;
        const content = window[formInstanceName].render(entity);
        const title = entityId ? config.titleEdit : config.titleNew;

        const actions = `
            <button type="button" class="btn btn-secondary" onclick="window.modalManager.hideModal()">Ləğv et</button>
            <button type="button" class="btn btn-primary" onclick="window.${formInstanceName}.submit('${entityId || ''}')">
                <i class="fas fa-save"></i> ${entityId ? 'Yenilə' : 'Əlavə et'}
            </button>
        `;

        this.showModal(title, content, actions, { allowEsc: false });

        // Post-render logic
        if (typeof config.afterRender === 'function') {
            const formNode = document.getElementById(formInstanceName);
            config.afterRender(formNode, entityId);
        }
    }

    showReservationForm(reservationId = null) {
        this._showFormModal('reservation', reservationId);
    }

    showGuestForm(guestId = null) {
        this._showFormModal('guest', guestId);
    }

    showRoomForm(roomId = null) {
        this._showFormModal('room', roomId);
    }

    showServiceForm(serviceId = null) {
        this._showFormModal('service', serviceId);
    }

    showCashForm(type = 'income', transactionId = null, reservationId = null, purchaseDocumentId = null) {
        if (!window.cashForm) {
            window.cashForm = new CashForm();
        }
        const transaction = transactionId ? window.app?.data?.cashTransactions?.find(t => t.id === transactionId) : null;
        const content = window.cashForm.render(type, transaction, reservationId, purchaseDocumentId); 
        const title = transactionId ? 'Kassa Əməliyyatını Redaktə Et' : (type === 'income' ? 'Yeni Gəlir Əlavə Et' : 'Yeni Xərc Əlavə Et');
        const actions = `
            <button type="button" class="btn btn-secondary" onclick="window.modalManager.hideModal()">Ləğv et</button>
            <button type="button" class="btn btn-primary" onclick="window.cashForm.submit('${type}', '${transactionId || ''}')">
                <i class="fas fa-save"></i> ${transactionId ? 'Yenilə' : 'Əlavə et'}
            </button>
        `;
        this.showModal(title, content, actions, { allowEsc: false });

        const formNode = document.querySelector('.modal-body form[id^="cashForm_"]'); 
        if (formNode) {
            window.cashForm.attachFormListeners(formNode.id); 
        }
    }

    showInventoryForm(itemId = null) {
        this._showFormModal('inventory', itemId);
    }

    showStaffForm(staffId = null) {
        this._showFormModal('staff', staffId);
    }

    showMaintenanceForm(taskId = null) {
        this._showFormModal('maintenance', taskId);
    }

    showPurchaseDocumentForm(docId = null) {
        this._showFormModal('purchaseDocument', docId);
    }
    
    // NEW: Show Purchase Document Details
    showPurchaseDocumentDetails(docId) {
        try {
            const doc = window.app?.data?.purchaseDocuments?.find(d => d.id == docId);
            if (!doc) {
                window.notificationManager?.showNotification('error', 'Xəta', 'Alış sənədi tapılmadı');
                return;
            }

            const staff = window.app?.data?.staff?.find(s => s.id === doc.staffId);
            const paidAmount = window.app?.getPaidForPurchaseDocument?.(docId) || 0;
            const remainingDebt = (doc.totalAmount || 0) - paidAmount;
            const displayDocId = doc.publicId || (window.app ? window.app?.formatInternalId?.(doc.id, 'AS') : doc.id);
            const formatDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate : d => d;

            const itemsHtml = (doc.items || []).map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.name || 'N/A'}</td>
                    <td class="text-right">${item.quantity || 0} ${item.unit || ''}</td>
                    <td class="text-right">₼${(item.unitPrice || 0).toFixed(2)}</td>
                    <td class="text-right">₼${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}</td>
                </tr>
            `).join('');

            const content = `
                <div class="purchase-document-details-modal">
                    <h3 style="color: #3b82f6; margin: 0 0 1rem 0;">Alış Sənədi Detalları #${displayDocId}</h3>
                    
                    <div class="info-box" style="margin-bottom: 1.5rem;">
                        <h4 class="info-box-title">Əsas Məlumatlar</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.95em;">
                            <div><strong>Sənəd №:</strong> ${doc.documentNumber || 'N/A'}</div>
                            <div><strong>Təchizatçı:</strong> ${doc.supplierName || 'N/A'}</div>
                            <div><strong>Alış Tarixi:</strong> ${formatDate(doc.purchaseDate)}</div>
                            <div><strong>Qeyd edən:</strong> ${staff?.name || 'N/A'}</div>
                            <div><strong>Qeydlər:</strong> ${doc.notes || '—'}</div>
                            <div><strong>Yüklənmiş Sənəd:</strong> ${doc.documentUrl ? `<a href="${doc.documentUrl}" target="_blank" style="color:#10b981;">Bax <i class="fas fa-external-link-alt"></i></a>` : 'Yoxdur'}</div>
                        </div>
                    </div>
                    
                    <div class="info-box" style="margin-bottom: 1.5rem;">
                        <h4 class="info-box-title">Maliyyə Vəziyyəti</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 1.1em;">
                            <div><strong>Ümumi Məbləğ:</strong> <span style="font-weight: bold;">₼${(doc.totalAmount || 0).toFixed(2)}</span></div>
                            <div><strong>Ödənilən:</strong> <span style="font-weight: bold; color:#10b981;">₼${paidAmount.toFixed(2)}</span></div>
                            <div><strong>Qalıq Borc:</strong> <span style="font-weight: bold; color:${remainingDebt > 0 ? '#ef4444' : '#10b981'};">₼${remainingDebt.toFixed(2)}</span></div>
                        </div>
                    </div>

                    <h4 style="margin: 1.5rem 0 0.5rem 0; color: var(--text-color);">Alınan Məhsullar (${(doc.items || []).length} ədəd)</h4>
                    <div style="overflow-x:auto;">
                        <table class="data-table" style="min-width: 500px; font-size: 0.9em;">
                            <thead>
                                <tr>
                                    <th style="width: 5%;">#</th>
                                    <th style="width: 40%;">Ad</th>
                                    <th class="text-right" style="width: 20%;">Miqdar</th>
                                    <th class="text-right" style="width: 15%;">Birim Qiymət</th>
                                    <th class="text-right" style="width: 20%;">Cəmi Qiymət</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml.length ? itemsHtml : '<tr><td colspan="5" class="text-center">Sənəddə məhsul qeyd edilməyib.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    
                </div>
            `;

            const actions = `
                <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
                <button class="btn btn-primary" onclick="window.modalManager.showPurchaseDocumentForm('${docId}')">
                    <i class="fas fa-edit"></i> Redaktə et
                </button>
                <button class="btn btn-secondary" onclick="window.modalManager.hideModal(); window.modalManager.showCashForm('expense', null, null, '${docId}')">
                    <i class="fas fa-money-bill-wave"></i> Ödəniş Yarat
                </button>
            `;

            this.showModal(`Alış Sənədi #${displayDocId}`, content, actions);

        } catch (error) {
            console.error('Error showing purchase document details:', error);
            window.notificationManager?.showNotification('error', 'Modal Xətası', 'Alış sənədi detalları göstərilmədi.');
            window.app.recordSystemError('ShowPurchaseDocumentDetailsError', error.message, error.stack);
        }
    }

    showReservationPaymentForm(reservationId) {
        if (!window.paymentForm) {
            window.paymentForm = new PaymentForm();
        }
        const reservation = window.app?.data?.reservations?.find(r => r.id === reservationId);
        if (!reservation) {
            this.showErrorModal('Xəta', 'Rezervasiya tapılmadı.');
            return;
        }

        const content = window.paymentForm.renderForReservation(reservation);
        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Ləğv et</button>
            <button class="btn btn-primary" onclick="window.paymentForm.processReservationPayment('${reservationId}')">
                <i class="fas fa-check"></i> Ödənişi Təsdiqlə
            </button>
        `;
        this.showModal('Rezervasiya üçün Ödəniş', content, actions, { allowEsc: false });

        const formNode = document.querySelector('form[id^="reservationPaymentForm_"]');
        if (formNode) {
            window.paymentForm.attachReservationFormListeners(formNode);
        }
    }
}

export default ModalManager;