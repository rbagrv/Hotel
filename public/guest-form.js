// Guest form component
class GuestForm {
    // List of countries for the nationality select
    getNationalitiesList() {
        // Most common countries, sorted so that Azerbaijan is first, rest alphabetically
        return [
            "Azərbaycan",
            "Türkiyə",
            "Rusiya",
            "Gürcüstan",
            "İran",
            "Ukrayna",
            "Qazaxıstan",
            "Qırğızıstan",
            "Özbəkistan",
            "Türkmənistan",
            "Tacikistan",
            "Almaniya",
            "Fransa",
            "İtaliya",
            "İngiltərə",
            "ABŞ",
            "İspaniya",
            "Misir",
            "BƏƏ",
            "Hindistan",
            "Çin",
            "Pakistan",
            "Səudiyyə Ərəbistanı",
            "Əfqanıstan",
            "İsrail",
            "Polşa",
            "Litva",
            "Latviya",
            "Estoniya",
            "Norveç",
            "Finlandiya",
            "Danimarka",
            "İsveç",
            "İsveçrə",
            "Yaponiya",
            "Cənubi Koreya",
            "Avstraliya",
            "Kanada",
            "Meksika",
            "Braziliya",
            "Argentina",
            "Cənubi Afrika",
            "Nigeriya",
            "İraq",
            // ...add more as needed
            "Başqa"
        ];
    }

    render(guest = null) {
        const isEdit = guest !== null;
        // Add unique form ID
        const formId = `guestForm_${Date.now()}`;

        // Get unique nationalities from existing data (for convenience)
        let existingNationalities = [];
        try {
            if (window.app && window.app.data && Array.isArray(window.app.data.guests)) {
                existingNationalities = window.app.data.guests
                    .map(g => g.nationality)
                    .filter((n, i, arr) => !!n && arr.indexOf(n) === i && n !== "Azərbaycan" && n !== "Başqa");
            }
        } catch {}

        // Merge nationalities for select dropdown: Azərbaycan (always first), rest from list (then unique from data), Başqa always last
        let countryList = this.getNationalitiesList().filter(c => c !== "Azərbaycan" && c !== "Başqa");
        countryList = [
            "Azərbaycan",
            ...countryList,
            ...existingNationalities.filter(n => !countryList.includes(n)),
            "Başqa"
        ];

        // Remove duplicates (except Azərbaycan and Başqa duplicates)
        countryList = countryList.filter((c, i, arr) =>
            i === arr.findIndex(x => x.toLowerCase() === c.toLowerCase()) ||
            c === "Azərbaycan" ||
            c === "Başqa"
        );

        // NEW: Get current user info for creation tracking
        const staffList = window.app.data.staff || [];
        const currentUser = window.authManager.getCurrentUser();
        const selectedStaffId = isEdit ? guest.createdBy : (currentUser ? currentUser.uid : '');
        const displayStaff = staffList.find(s => s.id === selectedStaffId);
        const displayStaffName = displayStaff ? displayStaff.name : 'Bilinmir';

        return `
            <form id="${formId}" class="form-grid" novalidate onkeydown="return event.key !== 'Enter';">
                <div class="form-group">
                    <label class="form-label required">Ad Soyad</label>
                    <input type="text" class="form-input" name="name" value="${isEdit ? guest.name : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-input" name="email" value="${isEdit ? guest.email : ''}">
                </div>

                <div class="form-group">
                    <label class="form-label required">Telefon</label>
                    <input type="tel" class="form-input" name="phone" value="${isEdit ? guest.phone : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Pasport Nömrəsi</label>
                    <input type="text" class="form-input" name="passportNo" value="${isEdit ? guest.passportNo : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Milliyyəti</label>
                    <select class="form-select" name="nationality" required>
                        ${countryList.map(c => `
                            <option value="${c.replace(/"/g, "&quot;")}" ${isEdit && guest.nationality === c ? "selected" : ""}>${c}</option>
                        `).join("")}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Ünvan</label>
                    <input type="text" class="form-input" name="address" value="${isEdit ? guest.address : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Doğum Tarihi</label>
                    <input type="date" class="form-input" name="birthDate" value="${isEdit ? guest.birthDate : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Cins</label>
                    <select class="form-select" name="gender" required>
                        <option value="">Seçin</option>
                        <option value="Kişi" ${isEdit && guest.gender === 'Kişi' ? 'selected' : ''}>Kişi</option>
                        <option value="Qadın" ${isEdit && guest.gender === 'Qadın' ? 'selected' : ''}>Qadın</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Kateqoriya / Status</label>
                    <select class="form-select" name="status" required>
                        <option value="Normal" ${!isEdit || guest.status === 'Normal' ? 'selected' : ''}>Normal</option>
                        <option value="VIP" ${isEdit && guest.status === 'VIP' ? 'selected' : ''}>VIP</option>
                        <option value="Blacklist" ${isEdit && guest.status === 'Blacklist' ? 'selected' : ''}>Qara Siyahı (Blacklist)</option>
                    </select>
                    <small class="form-help">VIP və ya Qara Siyahıdakı qonaqlar rezervasiya zamanı xüsusi qeyd olunacaq.</small>
                </div>

                <!-- NEW: Creator Field -->
                <div class="form-group">
                    <label class="form-label">Qeyd edən</label>
                    <input type="text" class="form-input" value="${displayStaffName}" readonly>
                    <input type="hidden" name="createdBy" value="${selectedStaffId}">
                </div>
                <!-- END NEW -->

                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label">Sənəd Yüklənməsi</label>
                    <input type="file" class="form-input" name="document" accept=".pdf,.jpg,.jpeg,.png" id="documentUpload">
                    <small style="color: #64748b; font-size: 0.75rem; margin-top: 0.25rem; display: block;">
                        Pasport, şəxsiyyət vəsiqəsi və ya digər sənədlər (PDF, JPG, PNG)
                    </small>
                    ${isEdit && guest.documentUrl ? `
                        <div style="margin-top: 0.5rem; padding: 0.5rem; background: #f8fafc; border-radius: 0.5rem; border: 1px solid #e2e8f0;">
                            <small style="color: #10b981;">
                                <i class="fas fa-file-check"></i> 
                                Mövcud sənəd var
                            </small>
                        </div>
                    ` : ''}
                    <div id="uploadProgress" style="display: none; margin-top: 0.5rem;">
                        <div style="background: #f1f5f9; border-radius: 0.5rem; overflow: hidden;">
                            <div id="progressBar" style="height: 6px; background: #3b82f6; width: 0%; transition: width 0.3s ease;"></div>
                        </div>
                        <small style="color: #64748b; margin-top: 0.25rem; display: block;">Yüklənir...</small>
                    </div>
                </div>
            </form>
        `;
    }

    // Highlight invalid required fields and show error message
    highlightInvalidFields(form, missingFields) {
        // Remove previous errors
        form.querySelectorAll(".input-error-message").forEach(el => el.remove());
        form.querySelectorAll(".form-input, .form-select").forEach(input => {
            input.style.borderColor = "";
            input.style.background = "";
        });

        // For each missing field, mark accordingly and show an error under it
        missingFields.forEach(field => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.style.borderColor = "#ef4444";
                input.style.background = "#fee2e2";
                // Only show error for inputs in a visible form group
                const formGroup = input.closest('.form-group');
                if (formGroup && !formGroup.querySelector('.input-error-message')) {
                    let label = '';
                    switch (field) {
                        case 'name': label = 'Ad Soyad'; break;
                        case 'phone': label = 'Telefon nömrəsini daxil edin'; break;
                        case 'passportNo': label = 'Pasport nömrəsini daxil edin'; break;
                        case 'nationality': label = 'Milliyyət daxil edin'; break;
                        case 'address': label = 'Ünvan daxil edin'; break;
                        case 'birthDate': label = 'Doğum tarixini seçin'; break;
                        case 'gender': label = 'Cinsi seçin'; break;
                        default: label = 'Bu sahə mütləq doldurulmalıdır';
                    }
                    const errorDiv = document.createElement('div');
                    errorDiv.className = "input-error-message";
                    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${label}`;
                    formGroup.appendChild(errorDiv);
                }
            }
        });
    }

    // Remove styles for all required fields
    clearInvalidHighlight(form) {
        form.querySelectorAll(".form-input, .form-select").forEach(input => {
            input.style.borderColor = "";
            input.style.background = "";
        });
        form.querySelectorAll(".input-error-message").forEach(el => el.remove());
    }

    async submit(guestId = null) {
        try {
            // Find the form using the dynamically generated ID
            const form = document.querySelector('form[id^="guestForm_"]');
            if (!form) {
                if (window.notificationManager) {
                    await window.notificationManager.notifyAction({
                        title: 'Form xətası',
                        message: 'Form tapılmadı',
                        type: 'error',
                        sendToTelegramModule: 'guests'
                    });
                }
                throw new Error('Form tapılmadı');
            }

            // Required fields only (email not required)
            const requiredFields = ['name', 'phone', 'passportNo', 'nationality', 'address', 'birthDate', 'gender'];
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Default status if missing
            if (!data.status) data.status = 'Normal';

            // List missing fields (empty, undefined, or whitespace)
            const missingFields = requiredFields.filter(field => !data[field] || data[field].trim() === '');
            if (missingFields.length > 0) {
                this.highlightInvalidFields(form, missingFields);
                const firstInvalid = form.querySelector(`[name="${missingFields[0]}"]`);
                if (firstInvalid) {
                    firstInvalid.focus();
                }
                // Notify user specifically about validation error
                if (window.notificationManager) {
                    await window.notificationManager.notifyAction({
                        title: 'Məlumat xətası',
                        message: 'Xahiş edirik, bütün mütləq sahələri doldurun.',
                        type: 'error',
                        sendToTelegramModule: 'guests'
                    });
                }
                // STOP: do NOT leave form or close, stay on modal until fully valid
                return;
            } else {
                this.clearInvalidHighlight(form);
            }

            // Handle document upload if file is selected
            const documentFile = form.querySelector('#documentUpload').files[0];
            if (documentFile) {
                try {
                    this.showUploadProgress();
                    // Ensure websim is available before calling
                    if (!window.websim || typeof window.websim.upload !== 'function') {
                         throw new Error('Fayl yükləmə xidməti tapılmadı.');
                    }
                    const documentUrl = await window.websim.upload(documentFile);
                    data.documentUrl = documentUrl;
                } catch (uploadError) {
                    this.hideUploadProgress(false); // Indicate failure
                    this.highlightInvalidFields(form, []); // Reset highlight
                    if (window.notificationManager) {
                        await window.notificationManager.notifyAction({
                            title: 'Sənəd xətası',
                            message: `Sənəd yüklənmədi: ${uploadError.message || 'bilinməyən xəta'}. Təkrar cəhd edin.`,
                            type: 'error',
                            sendToTelegramModule: 'guests'
                        });
                    }
                    return; // Stop form submission on upload failure
                }
            }

            // Check if window.app and its data are initialized properly
            if (!window.app || !window.app.isInitialized || !window.app.data) {
                if (window.notificationManager) {
                    await window.notificationManager.notifyAction({
                        title: 'Sistem yüklənir',
                        message: 'Sistem hələ tam yüklənməyib. Bir az gözləyin və təkrar cəhd edin.',
                        type: 'warning',
                        sendToTelegramModule: 'guests'
                    });
                }
                // Do not throw, just stop submission gracefully, allowing retry
                return;
            }
            if (!data.createdAt) {
                data.createdAt = new Date().toISOString();
            }

            const isEdit = guestId && guestId !== '' && guestId !== 'null';
            let saveActionPromise;
            if (isEdit) {
                // Add permission check for edit
                if (!window.authManager.hasPermission('guests', 'edit')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return; // Stop form submission
                }
                saveActionPromise = window.app.updateGuest(guestId, data);
                window.notificationManager?.showNotification('success', 'Uğurlu', 'Qonaq məlumatları yeniləndi.');
            } else {
                // Add permission check for create
                if (!window.authManager.hasPermission('guests', 'create')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return; // Stop form submission
                }
                saveActionPromise = window.app.createGuest(data);
                window.notificationManager?.showNotification('success', 'Uğurlu', 'Yeni qonaq əlavə edildi.');
            }

            // Await the save action and handle potential errors during DB operation
            await saveActionPromise;

            // Yeni əlavə: Modalı dərhal bağla (form bağlansın)
            if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
                window.modalManager.hideModal();
            }

            // The create/update methods in app.js now handle the refresh. No need for extra calls here.

            // Optionally, focus/scroll to the newly added guest (might be at top of list due to sorting)
            setTimeout(() => {
                // Re-fetch rows AFTER re-rendering, could be new data
                const guestsListContainer = document.getElementById('guestsTableBody'); // Specific tbody ID
                if (guestsListContainer) {
                    const rows = guestsListContainer.querySelectorAll('tr');
                    if (rows && rows.length > 0) {
                        rows[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }, 200);

        } catch (error) {
            // Error notification already handled by window.app.updateGuest/createGuest, but keep this fallback
            if (window.notificationManager) {
                await window.notificationManager.notifyAction({
                    title: 'Form Xətası',
                    message: error.message || 'Qonaq əlavə və ya yenilənməsi zamanı xəta baş verdi.',
                    type: 'error',
                    sendToTelegramModule: 'guests'
                });
            }
        } finally {
            this.hideUploadProgress();
        }
    }

    showUploadProgress() {
        const progressContainer = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        if (progressContainer && progressBar) {
            progressContainer.style.display = 'block';
            // Simulate progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress >= 90) {
                    progress = 90;
                    clearInterval(interval);
                }
                progressBar.style.width = progress + '%';
            }, 200);
            this._progressInterval = interval;
        }
    }

    hideUploadProgress(success = true) {
        const progressContainer = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = success ? '100%' : '0%';
            progressBar.style.background = success ? '#10b981' : '#ef4444'; // Green for success, red for error
        }
        if (this._progressInterval) clearInterval(this._progressInterval);
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
            if (progressBar) progressBar.style.background = '#3b82f6'; // Reset color
        }, 500); // Small delay to show 100% or error color
    }
}

// Ensure global availability 
window.GuestForm = GuestForm;

// Initialize form instance immediately
window.guestForm = new GuestForm();
export default GuestForm;