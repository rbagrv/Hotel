// Inventory form component
export default class InventoryForm {
    render(item = null) {
        const isEdit = item !== null;

        // Fetch unique categories and units from settings or fallback to existing inventory data
        const allInventory = window.app?.data?.inventory || [];
        const uniqueCategories = window.app?.getSetting('inventoryCategories') || Array.from(new Set(allInventory.map(i => i.category).filter(Boolean))).sort();
        const uniqueUnits = window.app?.getSetting('inventoryUnits') || Array.from(new Set(allInventory.map(i => i.unit).filter(Boolean))).sort();

        // Get current user info for creation tracking
        const staffList = window.app.data.staff || [];
        const currentUser = window.authManager.getCurrentUser();
        const selectedStaffId = isEdit ? item.createdBy : (currentUser ? currentUser.uid : '');
        const displayStaff = staffList.find(s => s.id === selectedStaffId);
        const displayStaffName = displayStaff ? displayStaff.name : 'Bilinmir';

        return `
            <form id="inventoryForm" class="form-grid" novalidate onkeydown="return event.key !== 'Enter';">
                <div class="form-group">
                    <label class="form-label required">Məhsul Adı</label>
                    <input type="text" class="form-input" name="name" value="${isEdit ? item.name : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Kateqoriya</label>
                    <select class="form-select" name="category" required>
                        <option value="">Seçin</option>
                        ${uniqueCategories.map(category => `
                            <option value="${category}" ${isEdit && item.category === category ? 'selected' : ''}>${category}</option>
                        `).join('')}
                        <!-- Ensure there are always default categories available -->
                        ${!uniqueCategories.includes('Təmizlik') ? `<option value="Təmizlik">Təmizlik</option>` : ''}
                        ${!uniqueCategories.includes('Yemək-İçmək') ? `<option value="Yemək-İçmək">Yemək-İçmək</option>` : ''}
                        ${!uniqueCategories.includes('Tekstil') ? `<option value="Tekstil">Tekstil</option>` : ''}
                        ${!uniqueCategories.includes('Mebel') ? `<option value="Mebel">Mebel</option>` : ''}
                        ${!uniqueCategories.includes('Elektronika') ? `<option value="Elektronika">Elektronika</option>` : ''}
                        ${!uniqueCategories.includes('Digər') ? `<option value="Digər">Digər</option>` : ''}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Miqdar</label>
                    <input type="number" class="form-input" name="quantity" min="0" value="${isEdit ? item.quantity : ''}" ${isEdit ? 'readonly' : ''} required>
                    ${isEdit ? '<small class="form-help" style="color: var(--warning-color); font-weight: 500;">Anbar qalığı ancaq "Alış Sənədləri" ilə artırıla və ya "POS Satış" ilə azaldıla bilər.</small>' : ''}
                </div>

                <div class="form-group">
                    <label class="form-label required">Minimum Miqdar</label>
                    <input type="number" class="form-input" name="minQuantity" min="0" value="${isEdit ? item.minQuantity : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Vahid</label>
                    <select class="form-select" name="unit" required>
                        <option value="">Seçin</option>
                        ${uniqueUnits.map(unit => `
                            <option value="${unit}" ${isEdit && item.unit === unit ? 'selected' : ''}>${unit}</option>
                        `).join('')}
                        <!-- Ensure there are always default units available -->
                        ${!uniqueUnits.includes('ədəd') ? `<option value="ədəd">ədəd</option>` : ''}
                        ${!uniqueUnits.includes('kg') ? `<option value="kg">kg</option>` : ''}
                        ${!uniqueUnits.includes('litr') ? `<option value="litr">litr</option>` : ''}
                        ${!uniqueUnits.includes('paket') ? `<option value="paket">paket</option>` : ''}
                        ${!uniqueUnits.includes('qutu') ? `<option value="qutu">qutu</option>` : ''}
                        ${!uniqueUnits.includes('metr') ? `<option value="metr">metr</option>` : ''}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Alış Qiyməti</label>
                    <input type="number" class="form-input" name="purchasePrice" min="0" step="0.01" value="${isEdit ? item.purchasePrice : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Satış Qiyməti</label>
                    <input type="number" class="form-input" name="salePrice" min="0" step="0.01" value="${isEdit ? item.salePrice : ''}" required>
                </div>

                <!-- Creator Field -->
                <div class="form-group">
                    <label class="form-label">Qeyd edən</label>
                    <input type="text" class="form-input" value="${displayStaffName}" readonly>
                    <input type="hidden" name="createdBy" value="${selectedStaffId}">
                </div>
                <!-- END Creator Field -->

                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label">Təsvir</label>
                    <textarea class="form-textarea" name="description" rows="3">${isEdit ? item.description || '' : ''}</textarea>
                </div>
            </form>
        `;
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

    async submit(itemId = null) {
        try {
            const form = document.getElementById('inventoryForm');
            if (!form) {
                window.notificationManager?.showNotification('error', 'Form xətası', 'Form tapılmadı.');
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Validate required fields
            const requiredFields = ['name', 'category', 'quantity', 'minQuantity', 'unit', 'purchasePrice', 'salePrice'];
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

            data.quantity = parseInt(data.quantity) || 0;
            data.minQuantity = parseInt(data.minQuantity) || 0;
            data.purchasePrice = parseFloat(data.purchasePrice) || 0;
            data.salePrice = parseFloat(data.salePrice) || 0;

            if (itemId) {
                // Add permission check for edit
                if (!window.authManager.hasPermission('inventory', 'edit')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                // Update existing item
                await window.app.updateInventory(itemId, data);
            } else {
                // Add permission check for create
                if (!window.authManager.hasPermission('inventory', 'create')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                // Add new item
                await window.app.createInventory(data);
            }

            if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
                window.modalManager.hideModal();
            }
            
            // The create/update methods in app.js already handle refreshing.
            // No need to call loadModule here.
        } catch (error) {
            console.error('Error in inventory form submit:', error);
            window.notificationManager?.showNotification('error', 'Sistem xətası', 'Məhsul əlavə və ya yenilənməsi zamanı xəta baş verdi.');
        }
    }
}

// Ensure global availability
window.InventoryForm = InventoryForm;

// Initialize form instance immediately
window.inventoryForm = new InventoryForm();