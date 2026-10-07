// Service form component
export default class ServiceForm {
    render(service = null) {
        const isEdit = service !== null;

        // Fetch unique categories from settings or fallback to existing services data
        const allServices = window.app?.data?.services || [];
        const uniqueCategories = window.app?.getSetting('serviceCategories') || Array.from(new Set(allServices.map(s => s.category).filter(Boolean))).sort();

        // Escape service.description for textarea to prevent premature closing
        const escapedDescription = (isEdit && service.description) ?
            service.description.replace(/<\/textarea>/g, '&lt;/textarea&gt;') : ''; // Replace literal closing tag

        // NEW: Get current user info for creation tracking
        const staffList = window.app.data.staff || [];
        const currentUser = window.authManager.getCurrentUser();
        // If editing, try to find existing creator. If new, use current user.
        const selectedStaffId = isEdit ? service.createdBy : (currentUser ? currentUser.uid : '');
        const displayStaff = staffList.find(s => s.id === selectedStaffId);
        const displayStaffName = displayStaff ? displayStaff.name : 'Bilinmir';

        return `
            <form id="serviceForm" class="form-grid" novalidate onkeydown="return event.key !== 'Enter';">
                <div class="form-group">
                    <label class="form-label required">Xidmət Adı</label>
                    <input type="text" class="form-input" name="name" value="${isEdit ? service.name : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Kateqoriya</label>
                    <select class="form-select" name="category" required>
                        <option value="">Seçin</option>
                        ${uniqueCategories.map(category => `
                            <option value="${category}" ${isEdit && service.category === category ? 'selected' : ''}>${category}</option>
                        `).join('')}
                        <!-- Ensure there are always default categories available even if uniqueCategories is empty -->
                        ${!uniqueCategories.includes('Otaq Xidməti') ? `<option value="Otaq Xidməti">Otaq Xidməti</option>` : ''}
                        ${!uniqueCategories.includes('Restoran') ? `<option value="Restoran">Restoran</option>` : ''}
                        ${!uniqueCategories.includes('Spa') ? `<option value="Spa">Spa</option>` : ''}
                        ${!uniqueCategories.includes('Nəqliyyat') ? `<option value="Nəqliyyat">Nəqliyyat</option>` : ''}
                        ${!uniqueCategories.includes('Digər') ? `<option value="Digər">Digər</option>` : ''}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Xidmət Növü</label>
                    <select class="form-select" name="serviceType" required onchange="window.serviceForm.updatePriceLabel()">
                        <option value="onetime" ${isEdit && service.serviceType === 'onetime' ? 'selected' : ''}>Birdəfəlik</option>
                        <option value="daily" ${isEdit && service.serviceType === 'daily' ? 'selected' : ''}>Günlük</option>
                    </select>
                    <small class="form-help" style="color: #64748b; font-size: 0.75rem; margin-top: 0.25rem; display: block;">
                        Günlük xidmətlər rezervasiyadakı gecə sayına görə hesablanır
                    </small>
                </div>

                <div class="form-group">
                    <label class="form-label required" id="priceLabel">Qiymət (₼${isEdit && service.serviceType === 'daily' ? '/gün' : ''})</label>
                    <input type="number" class="form-input" name="price" min="0" step="0.01" value="${isEdit ? service.price : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Status</label>
                    <select class="form-select" name="status" required>
                        <option value="active" ${isEdit && service.status === 'active' ? 'selected' : ''}>Aktiv</option>
                        <option value="inactive" ${isEdit && service.status === 'inactive' ? 'selected' : ''}>Deaktiv</option>
                    </select>
                </div>

                <!-- NEW: Creator Field -->
                <div class="form-group">
                    <label class="form-label">Qeyd edən</label>
                    <input type="text" class="form-input" value="${displayStaffName}" readonly>
                    <input type="hidden" name="createdBy" value="${selectedStaffId}">
                </div>
                <!-- END NEW -->

                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label">Təsvir</label>
                    <textarea class="form-textarea" name="description" rows="3">${escapedDescription}</textarea>
                </div>
            </form>

            <script>
                // Initialize on load. The onchange in the HTML will call window.serviceForm.updatePriceLabel()
                // Ensure window.serviceForm exists before trying to call its method.
                setTimeout(() => {
                    if (window.serviceForm && typeof window.serviceForm.updatePriceLabel === 'function') {
                        window.serviceForm.updatePriceLabel();
                    }
                }, 100);
            </script>
        `;
    }

    updatePriceLabel() {
        const serviceTypeSelect = document.querySelector('[name="serviceType"]');
        const priceLabel = document.getElementById('priceLabel');
        if (serviceTypeSelect && priceLabel) {
            if (serviceTypeSelect.value === 'daily') {
                priceLabel.textContent = 'Qiymət (₼/gün)';
            } else {
                priceLabel.textContent = 'Qiymət (₼)';
            }
        }
    }

    // Highlight invalid required fields and show error message
    highlightInvalidFields(form, missingFields) {
        form.querySelectorAll(".input-error-message").forEach(el => el.remove());
        form.querySelectorAll(".form-input, .form-select").forEach(input => {
            input.style.borderColor = "";
            input.style.background = "";
        });

        missingFields.forEach(field => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.style.borderColor = "#ef4444";
                input.style.background = "#fee2e2";
                const formGroup = input.closest('.form-group');
                if (formGroup && !formGroup.querySelector('.input-error-message')) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = "input-error-message";
                    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Bu sahə mütləq doldurulmalıdır`;
                    formGroup.appendChild(errorDiv);
                }
            }
        });
    }

    clearInvalidHighlight(form) {
        form.querySelectorAll(".form-input, .form-select").forEach(input => {
            input.style.borderColor = "";
            input.style.background = "";
        });
        form.querySelectorAll(".input-error-message").forEach(el => el.remove());
    }

    async submit(serviceId = null) {
        try {
            const form = document.getElementById('serviceForm');
            if (!form) {
                window.notificationManager?.showNotification('error', 'Form xətası', 'Form tapılmadı.');
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Validate required fields
            const requiredFields = ['name', 'category', 'price', 'serviceType', 'status'];
            const missingFields = requiredFields.filter(field => !data[field] || String(data[field]).trim() === '');
            if (missingFields.length > 0) {
                this.highlightInvalidFields(form, missingFields);
                const firstInvalid = form.querySelector(`[name="${missingFields[0]}"]`);
                if (firstInvalid) {
                    firstInvalid.focus();
                }
                return;
            } else {
                this.clearInvalidHighlight(form);
            }

            data.price = parseFloat(data.price) || 0;

            if (serviceId && serviceId !== 'null' && serviceId !== "") {
                // Add permission check for edit
                if (!window.authManager.hasPermission('services', 'edit')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                // Update existing service
                await window.app.updateService(serviceId, data);
            } else {
                // Add permission check for create
                if (!window.authManager.hasPermission('services', 'create')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                // Add new service
                await window.app.createService(data);
            }

            // Modalı dərhal bağla
            if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
                window.modalManager.hideModal();
            }

            // The create/update methods in app.js already handle refreshing.
            // No need to call loadModule here.
        } catch (error) {
            console.error('Error in service form submit:', error);
            window.notificationManager?.showNotification('error', 'Sistem xətası', 'Xidmət əlavə və ya yenilənməsi zamanı xəta baş verdi.');
        }
    }
}

// Ensure global availability
window.ServiceForm = ServiceForm;

// Initialize form instance immediately
window.serviceForm = new ServiceForm();