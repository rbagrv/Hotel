// Staff form component
export default class StaffForm {
    render(staff = null) {
        const isEdit = staff !== null;

        // Fetch unique departments and roles from existing staff for dynamic dropdowns
        const allStaff = window.app?.data?.staff || [];
        const uniqueDepartments = Array.from(new Set(allStaff.map(s => s.department).filter(Boolean))).sort();
        const uniqueRoles = Array.from(new Set(allStaff.map(s => s.role).filter(Boolean))).sort();

        // "Qeyd edən" (creator) field: show who recorded this staff member.
        const currentUser = window.app?.authManager?.getCurrentUser?.();
        const selectedStaffId = (isEdit && staff.createdBy) || currentUser?.uid || '';
        let displayStaffName = '';
        if (isEdit && staff.createdBy) {
            const creator = allStaff.find(s => s.id === staff.createdBy || s.firebaseUid === staff.createdBy);
            displayStaffName = creator ? creator.name : 'Bilinmir';
        } else if (currentUser) {
            displayStaffName = currentUser.name || currentUser.email || '';
        }

        return `
            <form id="staffForm" class="form-grid" novalidate onkeydown="return event.key !== 'Enter';">
                ${isEdit ? `<input type="hidden" name="id" value="${staff.id}">` : ''}

                <div class="form-group">
                    <label class="form-label ${isEdit ? '' : 'required'}">Email</label>
                    <input type="email" class="form-input" name="email" value="${isEdit ? staff.email : ''}" ${isEdit ? 'readonly' : 'required'} ${isEdit && staff.firebaseUid ? 'readonly' : ''} autocomplete="new-password">
                    ${isEdit && staff.firebaseUid ? '<small class="form-help">Firebase ilə qeydiyyatdan keçən istifadəçinin email ünvanı dəyişdirilə bilməz.</small>' : ''}
                    ${!isEdit ? '<small class="form-help">Yeni işçi üçün email mütləqdir.</small>' : ''}
                </div>

                ${!isEdit ? `
                <div class="form-group">
                    <label class="form-label required">Şifrə</label>
                    <input type="password" class="form-input" name="password" required autocomplete="new-password" placeholder="Ən azı 6 simvol">
                    <small class="form-help">Yeni işçi üçün müvəqqəti şifrə. Ən azı 6 simvol olmalıdır.</small>
                </div>
                <div class="form-group">
                    <label class="form-label required">Şifrəni Təsdiqlə</label>
                    <input type="password" class="form-input" name="confirmPassword" required autocomplete="new-password" placeholder="Şifrəni təkrar daxil edin">
                </div>
                ` : ''}

                <div class="form-group">
                    <label class="form-label required">Ad Soyad</label>
                    <input type="text" class="form-input" name="name" value="${isEdit ? staff.name : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Telefon</label>
                    <input type="tel" class="form-input" name="phone" value="${isEdit ? staff.phone : ''}">
                </div>

                <div class="form-group">
                    <label class="form-label">Telegram Chat ID</label>
                    <input type="text" class="form-input" name="telegramId" value="${isEdit ? staff.telegramId || '' : ''}" 
                           placeholder="Məs: 734378254">
                    <small class="form-help">Rəqəmsal Chat ID (məs: <b>734378254</b>). İstifadəçi əvvəlcə botu açıb <b>/start</b> etməlidir. Chat ID-ni öyrənmək üçün Telegram-da <b>@userinfobot</b> istifadə edin.</small>
                </div>

                <div class="form-group">
                    <label class="form-label required">Vəzifə</label>
                    <input type="text" class="form-input" name="position" value="${isEdit ? staff.position : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Şöbə</label>
                    <select class="form-select" name="department" required>
                        <option value="">Seçin</option>
                        ${uniqueDepartments.map(department => `
                            <option value="${department}" ${isEdit && staff.department === department ? 'selected' : ''}>${department}</option>
                        `).join('')}
                        <option value="Resepsiya" ${isEdit && staff.department === 'Resepsiya' ? 'selected' : ''}>Resepsiya</option>
                        <option value="Təmizlik" ${isEdit && staff.department === 'Təmizlik' ? 'selected' : ''}>Təmizlik</option>
                        <option value="Mətbəx" ${isEdit && staff.department === 'Mətbəx' ? 'selected' : ''}>Mətbəx</option>
                        <option value="Texniki" ${isEdit && staff.department === 'Texniki' ? 'selected' : ''}>Texniki</option>
                        <option value="İdarəetmə" ${isEdit && staff.department === 'İdarəetmə' ? 'selected' : ''}>İdarəetmə</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Əmək haqqı</label>
                    <input type="number" class="form-input" name="salary" min="0" step="0.01" value="${isEdit ? staff.salary : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">İşə başlama tarixi</label>
                    <input type="date" class="form-input" name="startDate" value="${isEdit ? staff.startDate : new Date().toISOString().split('T')[0]}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Rol</label>
                    <select class="form-select" name="role" required>
                        <option value="">Seçin</option>
                        ${uniqueRoles.map(role => `
                            <option value="${role}" ${isEdit && staff.role === role ? 'selected' : ''}>${this.roleLabel(role)}</option>
                        `).join('')}
                        <option value="staff" ${isEdit && staff.role === 'staff' ? 'selected' : ''}>İşçi (məhdud icazələr)</option>
                        <option value="manager" ${isEdit && staff.role === 'manager' ? 'selected' : ''}>Menecer (əlavə icazələr)</option>
                        ${window.app?.isSuperadmin() ? `
                        <option value="admin" ${isEdit && staff.role === 'admin' ? 'selected' : ''}>Admin (tam icazələr)</option>
                        ` : ''}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Status</label>
                    <select class="form-select" name="status" required>
                        <option value="active" ${isEdit && staff.status === 'active' ? 'selected' : ''}>Aktiv</option>
                        <option value="inactive" ${isEdit && staff.status === 'inactive' ? 'selected' : ''}>Deaktiv</option>
                    </select>
                </div>
                
                <!-- NEW: Creator Field (Read-only, cannot be changed) -->
                <div class="form-group">
                    <label class="form-label">Qeyd edən</label>
                    <input type="text" class="form-input" value="${displayStaffName}" readonly>
                    <input type="hidden" name="createdBy" value="${selectedStaffId}">
                    <small class="form-help">Qeydiyyatı aparan istifadəçi (dəyişdirilə bilməz).</small>
                </div>
                <!-- END NEW -->
            </form>
        `;
    }

    // Highlight invalid fields
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

    roleLabel(role) {
        switch (role) {
            case 'staff':
                return 'İşçi (məhdud icazələr)';
            case 'manager':
                return 'Menecer (əlavə icazələr)';
            case 'admin':
                return 'Admin (tam icazələr)';
            default:
                return role;
        }
    }

    async submit(staffId = null) {
        try {
            const form = document.getElementById('staffForm');
            if (!form) throw new Error('Form tapılmadı');

            const isEdit = staffId !== null && staffId !== 'null';
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Validation for common required fields
            const commonRequiredFields = ['name', 'position', 'department', 'salary', 'startDate', 'role', 'status'];
            let missingFields = commonRequiredFields.filter(field => !data[field] || String(data[field]).trim() === '');

            // Specific validation for new staff (email, password)
            if (!isEdit) {
                if (!data.email || data.email.trim() === '') missingFields.push('email');
                if (!data.password || data.password.trim() === '') missingFields.push('password');
                if (!data.confirmPassword || data.confirmPassword.trim() === '') missingFields.push('confirmPassword');

                if (data.password && data.password.length < 6) {
                    window.notificationManager?.showNotification('error', 'Şifrə Xətası', 'Şifrə ən azı 6 simvol olmalıdır.');
                    this.highlightInvalidFields(form, ['password']); // Highlight password field
                    return;
                }
                if (data.password !== data.confirmPassword) {
                    window.notificationManager?.showNotification('error', 'Şifrə Xətası', 'Şifrələr uyğun gəlmir.');
                    this.highlightInvalidFields(form, ['password', 'confirmPassword']); // Highlight both password fields
                    return;
                }
            }

            if (missingFields.length > 0) {
                this.highlightInvalidFields(form, missingFields);
                const firstInvalid = form.querySelector(`[name="${missingFields[0]}"]`);
                if (firstInvalid) firstInvalid.focus();
                return;
            } else {
                this.clearInvalidHighlight(form);
            }

            // Normalize Telegram ID if provided
            if (data.telegramId) {
                let telegramId = data.telegramId.trim();
                // Strip leading @ if entered
                if (telegramId.startsWith('@')) {
                    telegramId = telegramId.replace(/^@+/, '');
                }
                data.telegramId = telegramId;
            } else {
                data.telegramId = '';
            }

            data.salary = parseFloat(data.salary) || 0;

            if (isEdit) {
                if (!window.authManager.hasPermission('staff', 'edit')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                console.log('[StaffForm] Submitting update for staffId:', staffId);
                const existingStaff = window.app.data.staff.find(s => s.id === staffId);
                if (!existingStaff) throw new Error('İşçi tapılmadı.');
                const currentUser = window.authManager?.getCurrentUser();

                // IMPORTANT: Merge onto the existing record so that fields the form does not
                // manage (custom `permissions`, `isSuperadmin`, `publicId`, `createdAt`,
                // `createdBy`, `firebaseUid`, `passwordHash`) are preserved. Otherwise the
                // IndexedDB `put`/upsert would replace the whole record and silently wipe them.
                const merged = {
                    ...existingStaff,
                    email: existingStaff.email,                 // email is not editable
                    firebaseUid: existingStaff.firebaseUid,     // preserve Firebase UID
                    name: data.name,
                    phone: data.phone || '',
                    telegramId: data.telegramId || '',
                    position: data.position,
                    department: data.department,
                    salary: parseFloat(data.salary) || 0,
                    startDate: data.startDate,
                    role: data.role,
                    status: data.status,
                    createdBy: existingStaff.createdBy || data.createdBy || currentUser?.uid || null,
                    isSuperadmin: existingStaff.isSuperadmin,
                };

                // Protect privileged accounts from being demoted by non-superadmins,
                // and never let a non-superadmin promote anyone to admin.
                if (existingStaff.isSuperadmin) {
                    merged.role = 'admin';
                    merged.isSuperadmin = true;
                } else if (!currentUser?.isSuperadmin) {
                    if (data.role === 'admin') merged.role = existingStaff.role || 'staff';
                    if (existingStaff.role === 'admin') merged.role = existingStaff.role;
                }

                delete merged.password;
                delete merged.confirmPassword;
                await window.app.updateStaff(staffId, merged);
                window.notificationManager?.showNotification('success', 'Uğurlu', 'İşçi məlumatları yeniləndi.');
            } else {
                if (!window.authManager.hasPermission('staff', 'create')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                console.log('[StaffForm] Submitting new staff creation.');
                // Delete the auto-generated ID from the form data if it's new staff
                // and rely on createStaff to generate one or use Firebase UID.
                if (data.id && data.id.startsWith('IS-')) { // Check if it's an auto-generated ID placeholder
                    delete data.id;
                }
                // Pass email and password to createStaff for Firebase user creation
                await window.app.createStaff(data); // `createStaff` handles Firebase user creation and uniqueness checks
                window.notificationManager?.showNotification('success', 'Uğurlu', 'Yeni işçi əlavə edildi.');
            }

            if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
                window.modalManager.hideModal();
            }

        } catch (error) {
            window.notificationManager?.showNotification('error', 'Xəta', error.message || 'İşçi əlavə və ya yenilənməsi zamanı xəta baş verdi');
        }
    }
}