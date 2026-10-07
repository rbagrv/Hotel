// Room form component
class RoomForm {
    render(room = null) {
        const isEdit = room !== null;

        // Fetch unique types and categories from settings or fallback to existing rooms data
        const allRooms = window.app?.data?.rooms || [];
        const uniqueTypes = window.app?.getSetting('roomTypes') || Array.from(new Set(allRooms.map(r => r.type).filter(Boolean))).sort();
        const uniqueCategories = window.app?.getSetting('roomCategories') || Array.from(new Set(allRooms.map(r => r.category).filter(Boolean))).sort();
        
        // NEW: Get current user info for creation tracking
        const staffList = window.app.data.staff || [];
        const currentUser = window.authManager.getCurrentUser();
        // If editing, try to find existing creator. If new, use current user.
        const selectedStaffId = isEdit ? room.createdBy : (currentUser ? currentUser.uid : '');
        const displayStaff = staffList.find(s => s.id === selectedStaffId);
        const displayStaffName = displayStaff ? displayStaff.name : 'Bilinmir';

        return `
            <form id="roomForm" class="form-grid" novalidate onkeydown="return event.key !== 'Enter';">
                <div class="form-group">
                    <label class="form-label required">Otaq Nömrəsi</label>
                    <input type="text" class="form-input" name="number" value="${isEdit ? room.number : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Otaq Növü</label>
                    <select class="form-select" name="type" required>
                        <option value="">Seçin</option>
                        ${uniqueTypes.map(type => `
                            <option value="${type}" ${isEdit && room.type === type ? 'selected' : ''}>${type}</option>
                        `).join('')}
                        ${!uniqueTypes.includes('Standart') ? `<option value="Standart">Standart</option>` : ''}
                        ${!uniqueTypes.includes('Deluxe') ? `<option value="Deluxe">Deluxe</option>` : ''}
                        ${!uniqueTypes.includes('Suite') ? `<option value="Suite">Suite</option>` : ''}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Kateqoriya</label>
                    <select class="form-select" name="category" required>
                        <option value="">Seçin</option>
                        ${uniqueCategories.map(category => `
                            <option value="${category}" ${isEdit && room.category === category ? 'selected' : ''}>${category}</option>
                        `).join('')}
                        ${!uniqueCategories.includes('Ekonom') ? `<option value="Ekonom">Ekonom</option>` : ''}
                        ${!uniqueCategories.includes('Komfort') ? `<option value="Komfort">Komfort</option>` : ''}
                        ${!uniqueCategories.includes('Lüks') ? `<option value="Lüks">Lüks</option>` : ''}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Tutum</label>
                    <input type="number" class="form-input" name="capacity" min="1" value="${isEdit ? room.capacity : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Qiymət (₼/gecə)</label>
                    <input type="number" class="form-input" name="price" min="0" step="0.01" value="${isEdit ? room.price : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Bina</label>
                    <input type="text" class="form-input" name="building" value="${isEdit ? room.building || '' : ''}" required placeholder="Məs: A, B, 1, 2">
                </div>

                <div class="form-group">
                    <label class="form-label required">Mərtəbə</label>
                    <input type="number" class="form-input" name="floor" min="1" value="${isEdit ? room.floor : ''}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Status</label>
                    <select class="form-select" name="status" required>
                        <option value="available" ${isEdit && room.status === 'available' ? 'selected' : ''}>Boş</option>
                        <option value="occupied" ${isEdit && room.status === 'occupied' ? 'selected' : ''}>Dolu</option>
                        <option value="maintenance" ${isEdit && room.status === 'maintenance' ? 'selected' : ''}>Təmir</option>
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
                    <label class="form-label">Əlavə imkanlar (vergüllə ayırın)</label>
                    <input type="text" class="form-input" name="amenities" value="${isEdit && room.amenities ? room.amenities.join(', ') : ''}" placeholder="WiFi, TV, Klimat">
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

    async submit(roomId = null) {
        try {
            const form = document.getElementById('roomForm');
            if (!form) {
                console.error('Room form not found');
                window.notificationManager?.showNotification('error', 'Form xətası', 'Form tapılmadı.');
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Validate required fields
            const requiredFields = ['number', 'type', 'category', 'capacity', 'price', 'building', 'floor', 'status'];
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

            // --- NEW: Prevent duplicate room number creation ---
            const allRooms = window.app?.data?.rooms || [];
            // Normalize current number to check against existing
            const currentNumber = String(data.number).trim().toLowerCase();
            const isDuplicate = allRooms.some(
                room => String(room.number).trim().toLowerCase() === currentNumber && room.id !== roomId
            );

            if (isDuplicate) {
                window.notificationManager?.showNotification('error', 'Təkrarlanan Otaq', `"${data.number}" nömrəli otaq artıq mövcuddur.`);
                this.highlightInvalidFields(form, ['number']);
                // Add specific error message to the input
                const numberInput = form.querySelector('[name="number"]');
                if (numberInput && !numberInput.nextElementSibling?.classList?.contains('input-error-message')) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = "input-error-message";
                    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Bu nömrə artıq istifadə olunur`;
                    numberInput.parentElement.appendChild(errorDiv);
                }
                return;
            }
            // --- END: Prevent duplicate room number ---

            data.capacity = parseInt(data.capacity) || 1;
            data.price = parseFloat(data.price) || 0;
            data.floor = parseInt(data.floor) || 1;
            data.amenities = data.amenities.split(',').map(a => a.trim()).filter(a => a);

            if (roomId) {
                // Add permission check for edit
                if (!window.authManager.hasPermission('rooms', 'edit')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                // Update existing room
                await window.app.updateRoom(roomId, data);
            } else {
                // Add permission check for create
                if (!window.authManager.hasPermission('rooms', 'create')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                // Add new room
                await window.app.createRoom(data);
            }

            if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
                window.modalManager.hideModal();
            }

            // The create/update methods in app.js already handle refreshing.
            // No need to call loadModule here.
        } catch (error) {
            console.error('Error in room form submit:', error);
            window.notificationManager?.showNotification('error', 'Sistem xətası', 'Otaq əlavə və ya yenilənməsi zamanı xəta baş verdi.');
        }
    }
}

// Ensure global availability
window.RoomForm = RoomForm;

// Initialize form instance immediately
window.roomForm = new RoomForm();

export default RoomForm;