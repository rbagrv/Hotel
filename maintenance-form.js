export default class MaintenanceForm {
    render(task = null) {
        const isEdit = task !== null;
        const rooms = window.app.data.rooms || [];
        const staff = window.app.data.staff || [];
        const currentUserId = window.authManager?.getCurrentUser()?.uid; // Get current user's UID
        
        // Determine default selected staff for 'assignedTo'
        let defaultAssignedToId = '';
        if (isEdit) {
            defaultAssignedToId = task.assignedTo || '';
        } else {
            // For new tasks, default to current user if they are a staff member
            if (currentUserId && staff.some(s => s.id === currentUserId)) {
                defaultAssignedToId = currentUserId;
            }
        }
        
        // Determine default selected staff for 'createdBy'
        const selectedCreatedById = isEdit ? task.createdBy : (currentUserId || '');
        const displayCreatorStaff = staff.find(s => s.id === selectedCreatedById);
        const displayCreatorStaffName = displayCreatorStaff ? displayCreatorStaff.name : 'Bilinmir';

        return `
            <form id="maintenanceForm" class="form-grid" novalidate onkeydown="return event.key !== 'Enter';">
                <div class="form-group">
                    <label class="form-label">Otaq</label>
                    <select class="form-select" name="roomId">
                        <option value="">Ümumi (otaq seçilməyib)</option>
                        ${rooms.map(room => `
                            <option value="${room.id}" ${isEdit && task.roomId === room.id ? 'selected' : ''}>${room.number} - ${room.type}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Tapşırıq Növü</label>
                    <select class="form-select" name="type" required>
                        <option value="">Seçin</option>
                        <option value="Təmizlik" ${isEdit && task.type === 'Təmizlik' ? 'selected' : ''}>Təmizlik</option>
                        <option value="Təmir" ${isEdit && task.type === 'Təmir' ? 'selected' : ''}>Təmir</option>
                        <option value="Yoxlama" ${isEdit && task.type === 'Yoxlama' ? 'selected' : ''}>Yoxlama</option>
                        <option value="Dəyişiklik" ${isEdit && task.type === 'Dəyişiklik' ? 'selected' : ''}>Dəyişiklik</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Prioritet</label>
                    <select class="form-select" name="priority" required>
                        <option value="low" ${isEdit && task.priority === 'low' ? 'selected' : ''}>Aşağı</option>
                        <option value="medium" ${isEdit && task.priority === 'medium' ? 'selected' : ''}>Orta</option>
                        <option value="high" ${isEdit && task.priority === 'high' ? 'selected' : ''}>Yüksək</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Məsul İşçi</label>
                    <select class="form-select" name="assignedTo">
                        <option value="">Təyin edilməyib</option>
                        ${staff.map(employee => `
                            <option value="${window.escapeHtml(employee.id)}" ${employee.id === defaultAssignedToId ? 'selected' : ''}>${window.escapeHtml(employee.name)} - ${window.escapeHtml(employee.position)}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Tamamlama Tarixi</label>
                    <input type="date" class="form-input" name="dueDate" value="${isEdit ? task.dueDate : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Status</label>
                    <select class="form-select" name="status" required>
                        <option value="pending" ${isEdit && task.status === 'pending' ? 'selected' : ''}>Gözləyir</option>
                        <option value="in_progress" ${isEdit && task.status === 'in_progress' ? 'selected' : ''}>İcra olunur</option>
                        <option value="completed" ${isEdit && task.status === 'completed' ? 'selected' : ''}>Tamamlanıb</option>
                        <option value="cancelled" ${isEdit && task.status === 'cancelled' ? 'selected' : ''}>Ləğv edilib</option>
                    </select>
                </div>

                <!-- Creator Field -->
                <div class="form-group">
                    <label class="form-label">Qeyd edən</label>
                    <input type="text" class="form-input" value="${displayCreatorStaffName}" readonly>
                    <input type="hidden" name="createdBy" value="${selectedCreatedById}">
                </div>
                <!-- END Creator Field -->

                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label required">Təsvir</label>
                    <textarea class="form-textarea" name="description" rows="4" required>${isEdit ? task.description : ''}</textarea>
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

    async submit(taskId = null) {
        try {
            const form = document.getElementById('maintenanceForm');
            if (!form) {
                window.notificationManager?.showNotification('error', 'Form xətası', 'Form tapılmadı.');
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            const requiredFields = ['type', 'priority', 'dueDate', 'status', 'description'];
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

            data.roomId = data.roomId || null;
            data.assignedTo = data.assignedTo || null;

            if (taskId) {
                // Add permission check for edit
                if (!window.authManager.hasPermission('maintenance', 'edit')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return; // Stop form submission
                }
                // Update existing task
                await window.app.updateMaintenance(taskId, data);
            } else {
                // Add permission check for create
                if (!window.authManager.hasPermission('maintenance', 'create')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return; // Stop form submission
                }
                // Create new task
                await window.app.createMaintenance(data);
            }

            if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
                window.modalManager.hideModal();
            }

            // The create/update methods in app.js already handle refreshing.
            // No need to call loadModule here.
        } catch (error) {
            console.error('Error in maintenance form submit:', error);
            window.notificationManager?.showNotification('error', 'Sistem xətası', 'Tapşırıq əlavə və ya yenilənməsi zamanı xəta baş verdi.');
        }
    }
}

// Ensure global availability
window.MaintenanceForm = MaintenanceForm;

// Initialize form instance immediately
window.maintenanceForm = new MaintenanceForm();