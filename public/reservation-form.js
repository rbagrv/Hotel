// reservation-form.js
//
// Rezervasiya formu
//
// EXPORT: export default ReservationForm;
//

class ReservationForm {
    // Helper to parse YYYY-MM-DD string as UTC midnight
    _parseDateAsUTC(dateString) {
        if (!dateString) return null;
        // Ensure dateString is only the YYYY-MM-DD part, remove any time component or timezone info
        const cleanDateString = dateString.split('T')[0];
        const [year, month, day] = cleanDateString.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day)); // Month is 0-indexed in Date.UTC
    }

    // Helper to calculate available rooms given checkIn/checkOut + existing reservations + optional excludeReservationId (for edits)
    getAvailableRooms(data, checkIn, checkOut, excludeReservationId = null) {
        const allRooms = (data.rooms || []);
        
        // Filter out rooms that are permanently unavailable (e.g., under maintenance)
        let usableRooms = allRooms.filter(room => room.status !== 'maintenance');

        // If no specific dates are provided, return all usable rooms.
        // This is for the initial load of a new reservation form.
        if (!checkIn || !checkOut) {
            return usableRooms;
        }

        // Convert new reservation dates to UTC midnight for consistent comparison
        const newCheckInUtc = this._parseDateAsUTC(checkIn);
        const newCheckOutUtc = this._parseDateAsUTC(checkOut);

        if (!newCheckInUtc || !newCheckOutUtc) return usableRooms;

        // Find reservations that overlap with the given date range
        const overlappingRes = (data.reservations || []).filter(res => {
            // Check if reservation is active/blocking a room
            if (res.status !== 'confirmed' && res.status !== 'occupied' && res.status !== 'pending') return false; 
            // Exclude the reservation currently being edited
            if (excludeReservationId && res.id === excludeReservationId) return false;

            // Parse existing reservation dates to UTC midnight
            const resCheckInUtc = this._parseDateAsUTC(res.checkIn);
            const resCheckOutUtc = this._parseDateAsUTC(res.checkOut);
            
            if (!resCheckInUtc || !resCheckOutUtc) return false;

            // Overlap logic: (new_start < old_end) && (new_end > old_start)
            // This means the periods intersect.
            return (newCheckInUtc.getTime() < resCheckOutUtc.getTime()) && (newCheckOutUtc.getTime() > resCheckInUtc.getTime());
        });

        const reservedRoomIds = new Set(overlappingRes.map(r => r.roomId));

        // Return rooms that are usable (not maintenance) AND not reserved for the specified period.
        return usableRooms.filter(room => !reservedRoomIds.has(room.id));
    }

    render(reservation = null) {
        const guests = window.app.data.guests;
        const allRooms = window.app.data.rooms;
        const services = window.app.data.services.filter(s => s.status === 'active');
        const isEdit = reservation !== null;
        
        // NEW: Get staff list and current user for the 'createdBy' field
        const staffList = window.app.data.staff || [];
        const currentUser = window.authManager.getCurrentUser();
        const currentStaffMember = staffList.find(s => s.id === currentUser?.uid || s.firebaseUid === currentUser?.uid);
        
        // Determine the selected staff member for the form
        // On edit, use the reservation's creator. On new, use the current user.
        const selectedStaffId = isEdit ? reservation.createdBy : (currentStaffMember ? currentStaffMember.id : '');
        // Find staff name for display
        const displayStaff = staffList.find(s => s.id === selectedStaffId);
        const displayStaffName = displayStaff ? displayStaff.name : 'Bilinmir';

        // Reservation dates for filtering
        const selectedCheckIn = isEdit ? reservation.checkIn : '';
        const selectedCheckOut = isEdit ? reservation.checkOut : '';
        const excludeReservationId = isEdit ? reservation.id : null;

        // Filter available rooms
        let availableRooms;
        if (selectedCheckIn && selectedCheckOut) {
            availableRooms = this.getAvailableRooms(window.app.data, selectedCheckIn, selectedCheckOut, excludeReservationId);
        } else {
            // Show all available+not-in-maintenance rooms if dates not set
            availableRooms = allRooms.filter(r => r.status !== 'maintenance');
        }

        // Discount fields
        let discountValue = isEdit && reservation.discountValue ? reservation.discountValue : '';
        let discountType = isEdit && reservation.discountType ? reservation.discountType : 'fixed';

        const selectedGuest = isEdit ? guests.find(g => g.id === reservation.guestId) : null;
        const selectedGuestName = selectedGuest ? selectedGuest.name : '';

        return `
            <form id="reservationForm" class="form-grid" ${isEdit ? `data-reservation-id="${reservation.id}"` : ''} autocomplete="off">
                <div class="form-group" style="position: relative;">
                    <label class="form-label required">Qonaq</label>
                    <input type="text" class="form-input" id="guestSearchInput" placeholder="Qonaq axtar (Ad, Tel, Pasport)..." value="${selectedGuestName}" required autocomplete="off">
                    <input type="hidden" name="guestId" value="${isEdit ? reservation.guestId : ''}">
                    <div id="guestSuggestions" style="display:none; position:absolute; z-index:100; background:white; border:1px solid #e2e8f0; border-radius:0.5rem; width:100%; max-height:200px; overflow-y:auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></div>
                    <div id="guestStatusWarning" style="display:none; margin-top:0.3rem; font-size:0.85rem; font-weight:600;"></div>
                </div>

                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label required">Giriş və Çıxış Tarixləri</label>
                    <div id="reservationDateRangePicker" class="input-group">
                        <span class="input-group-text"><i class="fas fa-calendar-alt"></i></span>
                        <input type="text" class="form-input" name="checkIn" placeholder="Giriş Tarixi" value="${selectedCheckIn}" required autocomplete="off">
                        <span class="input-group-text">→</span>
                        <input type="text" class="form-input" name="checkOut" placeholder="Çıxış Tarixi" value="${selectedCheckOut}" required autocomplete="off">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label required">Otaq</label>
                    <select class="form-select" name="roomId" required>
                        <option value="">Otaq seçin</option>
                        ${availableRooms.length === 0 ? `<option value="">Uyğun otaq yoxdur</option>` : availableRooms.map(room => `
                            <option value="${room.id}" data-price="${room.price}" ${isEdit && reservation.roomId === room.id ? 'selected' : ''}>
                                ${room.number} - ${room.type} (₼${room.price}/gecə)
                                ${room.status === 'available' ? '' : `| ${room.status}`}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Gecəlik Otaq Qiyməti (₼)</label>
                    <input type="number" class="form-input" name="effectiveRoomPricePerNight" min="0" step="0.01" value="${isEdit && reservation.roomTotal && reservation.nights && reservation.nights > 0 ? (reservation.roomTotal / reservation.nights).toFixed(2) : '0.00'}" required>
                    <small class="form-help">Bu otağın gecəlik faktiki satış qiyməti.</small>
                </div>

                <div class="form-group">
                    <label class="form-label required">Böyük Sayı</label>
                    <input type="number" class="form-input" name="adults" min="1" value="${isEdit ? reservation.adults : '1'}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Uşaq Sayı</label>
                    <input type="number" class="form-input" name="children" min="0" value="${isEdit ? reservation.children : '0'}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Status</label>
                    <select class="form-select" name="status" required>
                        <option value="pending" ${isEdit && reservation.status === 'pending' ? 'selected' : ''}>Gözləyir</option>
                        <option value="confirmed" ${isEdit && reservation.status === 'confirmed' ? 'selected' : ''}>Təsdiqlənib</option>
                        <option value="cancelled" ${isEdit && reservation.status === 'cancelled' ? 'selected' : ''}>Ləğv edilib</option>
                    </select>
                </div>

                <!-- NEW: Creator (İcraçı) Field -->
                <div class="form-group">
                    <label class="form-label required">İcraçı</label>
                    <input type="text" class="form-input" value="${displayStaffName}" readonly>
                    <input type="hidden" name="createdBy" value="${selectedStaffId}">
                    <small class="form-help">Rezervasiyanı qeydiyyata alan işçi (dəyişdirilə bilməz).</small>
                </div>

                <!-- ADD DISCOUNT FIELDS START -->
                <div class="form-group">
                    <label class="form-label">Endirim</label>
                    <div style="display:flex; align-items: center; gap: 0.5rem;">
                        <input type="number" min="0" class="form-input" name="discountValue" placeholder="Ədəd" value="${discountValue}" style="max-width:80px;">
                        <select class="form-select" name="discountType" style="max-width:85px;">
                            <option value="fixed" ${discountType === 'fixed' ? 'selected' : ''}>₼</option>
                            <option value="percent" ${discountType === 'percent' ? 'selected' : ''}>%</option>
                        </select>
                    </div>
                    <small class="form-help">
                        Endirim məbləği (məs: 10₼ və ya 10%)
                    </small>
                </div>
                <!-- ADD DISCOUNT FIELDS END -->

                ${!isEdit ? `
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: var(--background-color); border-radius: 0.5rem; border: 1px solid var(--border-color);">
                        <input type="checkbox" name="createCashEntry" id="createCashEntry">
                        <span><strong>Avtomatik kassa mədaxili yarat</strong></span>
                    </label>
                    <div id="cashEntryOptions" style="display: none; margin-top: 0.5rem; padding: 1rem; background: var(--warning-color-light-bg); border-radius: 0.5rem; border: 1px solid var(--warning-color-light-border);">
                        <div class="form-group">
                            <label class="form-label">Ödəniş növü</label>
                            <select class="form-select" name="paymentType">
                                <option value="deposit">Depozit ödənişi</option>
                                <option value="full">Tam ödəniş</option>
                                <option value="partial">Qismən ödəniş</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ödəniş məbləği</label>
                            <input type="number" class="form-input" name="paymentAmount" min="0" step="0.01" placeholder="Məbləği daxil edin">
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label">Əlavə Xidmətlər</label>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; margin-top: 0.5rem;">
                        ${services.map(service => `
                            <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.5rem;">
                                <input type="checkbox" name="services" value="${service.id}" 
                                    data-price="${service.price}" 
                                    data-servicetype="${service.serviceType || 'onetime'}"
                                    ${isEdit && reservation.selectedServices && reservation.selectedServices.includes(service.id) ? 'checked' : ''}>
                                <span>
                                    ${service.name} 
                                    <strong>(₼${service.price}${service.serviceType === 'daily' ? '/gün' : ''})</strong>
                                    ${service.serviceType === 'daily' ? '<br><small class="form-help">Günlük xidmət - gecə sayına görə hesablanır</small>' : ''}
                                </span>
                            </label>
                        `).join('')}
                    </div>
                    <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--info-color-light-bg); border-radius: 0.5rem; border: 1px solid var(--info-color-light-border);">
                        <small style="color: var(--text-color);">
                            <i class="fas fa-info-circle"></i>
                            <strong>Qeyd:</strong>
                            Günlük xidmətlər rezervasiyadakı gecə sayına vurularaq hesablanır. Birdəfəlik xidmətlər isə bir dəfə hesablanır.
                        </small>
                    </div>
                </div>

                <div class="form-group" style="grid-column: 1 / -1;">
                    <div style="background: var(--background-color); padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--border-color);">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <label class="form-label">Gecə Sayı</label>
                                <input type="number" class="form-input" name="nights" readonly value="0">
                            </div>
                            <div>
                                <label class="form-label">Otaq Qiyməti</label>
                                <input type="form-input" class="form-input" name="roomTotal" readonly value="0">
                            </div>
                            <div>
                                <label class="form-label">Xidmətlər Cəmi</label>
                                <input type="form-input" class="form-input" name="servicesTotal" readonly value="0">
                            </div>
                            <div>
                                <label class="form-label"><strong>Ümumi Məbləğ</strong></label>
                                <input type="form-input" class="form-input" name="totalAmount" readonly value="0" style="font-weight: bold; background: var(--background-color);">
                            </div>
                        </div>
                        <div id="servicesBreakdown" style="display: none;"></div>
                    </div>
                </div>
            </form>
        `;
    }

    calculateTotal() {
        const form = document.getElementById('reservationForm');
        if (!form) return;
        
        const roomSelect = form.roomId;
        const checkIn = form.checkIn.value;
        const checkOut = form.checkOut.value;
        const serviceCheckboxes = form.querySelectorAll('input[name="services"]:checked');
        const effectiveRoomPricePerNightInput = form.querySelector('[name="effectiveRoomPricePerNight"]');
        
        let roomPricePerNight = parseFloat(effectiveRoomPricePerNightInput.value) || 0;
        let nights = 0;
        let servicesTotal = 0;
        let servicesBreakdown = [];
        
        if (checkIn && checkOut) {
            // Use _parseDateAsUTC for consistent calculation to avoid timezone issues
            const checkInDate = this._parseDateAsUTC(checkIn);
            const checkOutDate = this._parseDateAsUTC(checkOut);
            if (checkInDate && checkOutDate) {
                const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
                nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
                nights = nights > 0 ? nights : 0;
            }
        }
        
        // Calculate services total with daily service consideration and create breakdown
        serviceCheckboxes.forEach(checkbox => {
            const servicePrice = parseFloat(checkbox.dataset.price) || 0;
            const serviceType = checkbox.dataset.servicetype || 'onetime';
            const serviceNameSpan = checkbox.parentElement.querySelector('span');
            const serviceName = serviceNameSpan ? serviceNameSpan.textContent.split('(')[0].trim() : 'Bilinməyən xidmət';
            
            if (serviceType === 'daily' && nights > 0) {
                const totalServicePrice = servicePrice * nights;
                servicesTotal += totalServicePrice;
                servicesBreakdown.push(`${serviceName}: ₼${servicePrice} × ${nights} gecə = ₼${totalServicePrice.toFixed(2)}`);
            } else {
                servicesTotal += servicePrice;
                servicesBreakdown.push(`${serviceName}: ₼${servicePrice.toFixed(2)}`);
            }
        });
        
        const roomTotal = roomPricePerNight * nights;
        let subtotal = roomTotal + servicesTotal;

        // --- START: Apply discount ---
        let discountValue = parseFloat(form.discountValue ? form.discountValue.value : 0) || 0;
        let discountType = form.discountType ? form.discountType.value : "fixed";
        let discountAmount = 0;

        if (discountValue > 0) {
            if (discountType === "percent") {
                // Clamp max 100%
                if (discountValue > 100) discountValue = 100;
                discountAmount = subtotal * (discountValue / 100);
            } else {
                // Fixed amount, clamp to subtotal
                if (discountValue > subtotal) discountValue = subtotal;
                discountAmount = discountValue;
            }
        }

        // --- END: Apply discount ---

        const totalAmount = subtotal - discountAmount;
        
        // Update form fields
        if (form.nights) form.nights.value = nights;
        if (form.roomTotal) form.roomTotal.value = roomTotal.toFixed(2);
        if (form.servicesTotal) form.servicesTotal.value = servicesTotal.toFixed(2);

        // NEW: Add discount and total display
        const breakdownDiv = document.getElementById('servicesBreakdown');
        if (breakdownDiv) {
            let discountText = "";
            if (discountAmount > 0) {
                discountText = `
                    <div style="color: var(--danger-color); font-weight: bold; margin-top:0.4rem;">
                        Endirim: -₼${discountAmount.toFixed(2)}
                        <span style="color:var(--text-light);font-size:0.88em;">(${discountType === 'percent' ? discountValue + "%" : discountValue + "₼"})</span>
                    </div>
                `;
            }
            breakdownDiv.innerHTML = `
                <div style="background: var(--info-color-light-bg); padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--info-color-light-border); margin-top: 0.5rem;">
                    <strong style="color: var(--text-color);">Xidmətlər hesabı:</strong>
                    <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem; list-style-type: disc; color: var(--text-color);">
                        ${servicesBreakdown.map(item => `<li style="margin: 0.25rem 0;">${item}</li>`).join('')}
                    </ul>
                    ${discountText}
                </div>
            `;
            breakdownDiv.style.display = (servicesBreakdown.length > 0 || discountAmount > 0) ? 'block' : 'none';
        }

        if (form.totalAmount) form.totalAmount.value = totalAmount.toFixed(2);
        console.log("DEBUG calculateTotal: roomPricePerNight=", roomPricePerNight, "nights=", nights, "roomTotal=", roomTotal.toFixed(2));
    }

    // Add method to attach calculation event listeners
    attachCalculationListeners() {
        const form = document.getElementById('reservationForm');
        if (!form || form.hasAttribute('data-listeners-attached')) return; // Prevent re-attaching
        form.setAttribute('data-listeners-attached', 'true');
        console.log("DEBUG: attachCalculationListeners fired.");

        // --- ATTACH GUEST AUTOCOMPLETE ---
        this.attachGuestAutocomplete();

        const updateLogic = () => {
            console.log("DEBUG: updateLogic triggered.");
            this.updateAvailableRoomsOptions();
            this.calculateTotal();
        };

        // NEW: Initialize Date Range Picker
        const dateRangePickerEl = document.getElementById('reservationDateRangePicker');
        if (dateRangePickerEl && typeof window.DateRangePicker === 'function') { // Ensure DateRangePicker is loaded
            const datepicker = new DateRangePicker(dateRangePickerEl, {
                format: 'yyyy-mm-dd',
                autohide: true,
                todayHighlight: true,
                language: 'az',
                buttonClass: 'btn',
            });

            // The datepicker updates the inputs. We need to listen to its change event.
            // Note: Datepicker updates `checkIn` and `checkOut` elements directly.
            // The `changeDate` event from the datepicker fires when the selection changes.
            dateRangePickerEl.addEventListener('changeDate', updateLogic);
        } else {
             // Fallback for environments where datepicker might not load
            if (form.checkIn) form.checkIn.addEventListener('change', updateLogic);
            if (form.checkOut) form.checkOut.addEventListener('change', updateLogic);
        }

        // Update reactively when room selection changes for pricing
        if (form.roomId) {
            form.roomId.addEventListener('change', () => {
                const selectedOption = form.roomId.options[form.roomId.selectedIndex];
                const effectiveRoomPricePerNightInput = form.querySelector('[name="effectiveRoomPricePerNight"]');
                if (selectedOption && selectedOption.value) {
                    const priceFromRoom = parseFloat(selectedOption.dataset.price) || 0;
                    if (priceFromRoom === 0 && selectedOption.dataset.price !== '0') {
                        console.warn("DEBUG: priceFromRoom is 0 but dataset.price is not '0'", selectedOption.dataset.price);
                    }
                    effectiveRoomPricePerNightInput.value = priceFromRoom.toFixed(2);
                } else if (effectiveRoomPricePerNightInput) {
                    effectiveRoomPricePerNightInput.value = ''; // Clear if no room selected
                }
                this.calculateTotal(); // Recalculate after updating price per night
            });
        }

        // Add listener for changes to the editable room price per night
        const effectiveRoomPricePerNightInput = form.querySelector('[name="effectiveRoomPricePerNight"]');
        if (effectiveRoomPricePerNightInput) {
            effectiveRoomPricePerNightInput.addEventListener('input', () => this.calculateTotal());
        }

        // Also watch for discount changes
        if (form.discountValue) {
            form.discountValue.addEventListener('input', () => this.calculateTotal());
        }
        if (form.discountType) {
            form.discountType.addEventListener('change', () => this.calculateTotal());
        }

        // Attach listeners to service checkboxes
        const serviceCheckboxes = form.querySelectorAll('input[name="services"]');
        serviceCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.calculateTotal();
            });
        });

        // Checkbox for showing cash entry options
        const createCashEntry = form.querySelector('[name="createCashEntry"]');
        if (createCashEntry) {
            createCashEntry.addEventListener('change', () => {
                const cashEntryOptions = document.getElementById('cashEntryOptions');
                if (cashEntryOptions) {
                    cashEntryOptions.style.display = createCashEntry.checked ? 'block' : 'none';
                }
            });
        }

        // Initial calculation and room refresh
        this.updateAvailableRoomsOptions();
        this.calculateTotal();
    }

    // NEW: Guest Autocomplete Logic
    attachGuestAutocomplete() {
        const input = document.getElementById('guestSearchInput');
        const hiddenInput = document.querySelector('input[name="guestId"]');
        const suggestionsDiv = document.getElementById('guestSuggestions');
        const statusWarning = document.getElementById('guestStatusWarning');
        
        if (!input || !suggestionsDiv) return;

        const guests = window.app.data.guests || [];

        const filterGuests = (query) => {
            const lower = query.toLowerCase();
            return guests.filter(g => 
                (g.name && g.name.toLowerCase().includes(lower)) ||
                (g.phone && g.phone.includes(lower)) ||
                (g.passportNo && g.passportNo.toLowerCase().includes(lower)) ||
                (g.publicId && g.publicId.toLowerCase().includes(lower))
            ).slice(0, 8); // Limit suggestions
        };

        const showSuggestions = () => {
            const query = input.value.trim();
            if (query.length < 1) {
                suggestionsDiv.style.display = 'none';
                return;
            }
            
            const matches = filterGuests(query);
            
            if (matches.length === 0) {
                suggestionsDiv.innerHTML = `<div style="padding:0.5rem;color:#64748b;">Qonaq tapılmadı. <a href="#" onclick="window.modalManager.showGuestForm()" style="color:#3b82f6;">Yeni qonaq yarat</a></div>`;
                suggestionsDiv.style.display = 'block';
                return;
            }

            suggestionsDiv.innerHTML = matches.map(g => {
                let badge = '';
                if (g.status === 'VIP') badge = '<span class="status-badge" style="font-size:0.7em;background:#fef3c7;color:#d97706;">VIP</span>';
                if (g.status === 'Blacklist') badge = '<span class="status-badge" style="font-size:0.7em;background:#1f2937;color:#f87171;">Blacklist</span>';
                
                // Escape single quotes for the onclick handler
                const safeName = g.name.replace(/'/g, "\\'");
                const safeStatus = (g.status || 'Normal').replace(/'/g, "\\'");

                return `
                <div style="padding:0.5rem; cursor:pointer; border-bottom:1px solid #f1f5f9;" 
                     onclick="window.reservationForm.selectGuest('${g.id}', '${safeName}', '${safeStatus}')">
                    <div style="font-weight:600;">${g.name} ${badge}</div>
                    <div style="font-size:0.85em;color:#64748b;">${g.phone || ''} | ${g.passportNo || ''} | ${g.publicId || ''}</div>
                </div>
            `}).join('');
            suggestionsDiv.style.display = 'block';
        };

        input.addEventListener('input', () => {
            hiddenInput.value = ''; // Clear selected ID on typing
            statusWarning.style.display = 'none';
            showSuggestions();
        });

        input.addEventListener('focus', showSuggestions);

        // Hide on click outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !suggestionsDiv.contains(e.target)) {
                suggestionsDiv.style.display = 'none';
            }
        });
    }

    selectGuest(id, name, status) {
        const input = document.getElementById('guestSearchInput');
        const hiddenInput = document.querySelector('input[name="guestId"]');
        const suggestionsDiv = document.getElementById('guestSuggestions');
        const statusWarning = document.getElementById('guestStatusWarning');

        if (input) input.value = name;
        if (hiddenInput) hiddenInput.value = id;
        if (suggestionsDiv) suggestionsDiv.style.display = 'none';

        if (statusWarning) {
            if (status === 'Blacklist') {
                statusWarning.innerHTML = '<span style="color:#ef4444;"><i class="fas fa-exclamation-triangle"></i> DIQQƏT: Bu qonaq Qara Siyahıdadır!</span>';
                statusWarning.style.display = 'block';
                window.notificationManager?.showNotification('warning', 'Qara Siyahı', 'Seçilmiş qonaq Qara Siyahıdadır!');
            } else if (status === 'VIP') {
                statusWarning.innerHTML = '<span style="color:#d97706;"><i class="fas fa-crown"></i> VIP Qonaq</span>';
                statusWarning.style.display = 'block';
            } else {
                statusWarning.style.display = 'none';
            }
        }
    }

    // Dynamically update room options based on selected dates, preserving currently selected room if still available.
    updateAvailableRoomsOptions() {
        const form = document.getElementById('reservationForm');
        if (!form) return;

        const checkIn = form.checkIn.value;
        const checkOut = form.checkOut.value;
        // Retrieve reservationId directly from the form's dataset
        const excludeReservationId = form.dataset.reservationId || null;
        const currentSelectedRoom = form.roomId.value;

        // If both dates picked, update room options
        if (checkIn && checkOut) {
            const availableRooms = this.getAvailableRooms(window.app.data, checkIn, checkOut, excludeReservationId);
            
            // Check if the currently selected room (if any) is *still* available.
            // We need a fresh check against the dynamically calculated available rooms.
            const currentRoomIsStillAvailable = availableRooms.some(r => r.id === currentSelectedRoom);

            // Create options HTML
            let optionsHtml = '';
            
            // Add a default empty option
            optionsHtml += `<option value="">Otaq seçin</option>`;

            // Add the currently selected room if it's still available, or if it's the room being edited (and not part of a conflict).
            // It should be selected ONLY if it's available.
            if (currentSelectedRoom && currentRoomIsStillAvailable) {
                const roomData = window.app.data.rooms.find(r => r.id === currentSelectedRoom);
                if (roomData) {
                    optionsHtml += `<option value="${roomData.id}" data-price="${roomData.price}" selected>
                        ${roomData.number} - ${roomData.type} (₼${roomData.price}/gecə)
                    </option>`;
                }
            } else if (currentSelectedRoom && !currentRoomIsStillAvailable) {
                // If the previously selected room is now unavailable, display it as disabled but NOT selected.
                const roomData = window.app.data.rooms.find(r => r.id === currentSelectedRoom);
                if (roomData) {
                     optionsHtml += `<option value="${roomData.id}" data-price="${roomData.price}" disabled style="color:red;">
                        ${roomData.number} - ${roomData.type} (₼${roomData.price}/gecə) | DOLU
                    </option>`;
                }
            }

            // Add all other truly available rooms, excluding the one that might be already added as selected.
            availableRooms.filter(r => r.id !== currentSelectedRoom).forEach(room => {
                optionsHtml += `<option value="${room.id}" data-price="${room.price}">
                    ${room.number} - ${room.type} (₼${room.price}/gecə)
                </option>`;
            });

            // If no available rooms and no current selected room, add a disabled option
            if (availableRooms.length === 0 && (!currentSelectedRoom || !window.app.data.rooms.find(r => r.id === currentSelectedRoom))) {
                optionsHtml += `<option value="" disabled>Uyğun otaq yoxdur</option>`;
            }

            form.roomId.innerHTML = optionsHtml;

            // If the previously selected room is now unavailable, explicitly clear the select's value
            // so that "Otaq seçin" or the first available option is effectively selected.
            if (currentSelectedRoom && !currentRoomIsStillAvailable) {
                form.roomId.value = ""; // Force no selection if current is invalid
            }

        }
    }

    async submit(reservationId = null) {
        try {
            const form = document.getElementById('reservationForm');
            if (!form) {
                console.error('Form not found');
                window.notificationManager?.showNotification('error', 'Form xətası', 'Form tapılmadı.');
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Validate required fields
            const requiredFields = ['guestId', 'roomId', 'checkIn', 'checkOut', 'adults', 'children', 'status', 'effectiveRoomPricePerNight', 'createdBy'];
            const missingFields = requiredFields.filter(field => !data[field] || String(data[field]).trim() === '');
            if (missingFields.length > 0) {
                this.highlightInvalidFields(form, missingFields);
                const firstInvalid = form.querySelector(`[name="${missingFields[0]}"]`);
                if (firstInvalid) {
                    firstInvalid.focus();
                }
                return; // Stop execution to allow user to fill missing fields
            } else {
                this.clearInvalidHighlight(form);
            }

            // Double-check room is available (in case of race conditions)
            const availableRooms = this.getAvailableRooms(window.app.data, data.checkIn, data.checkOut, reservationId);
            if (!availableRooms.some(r => r.id === data.roomId)) {
                window.notificationManager?.showNotification('warning', 'Otaq doludur', 'Seçilmiş tarix üçün otaq artıq doludur və seçim mümkün deyil.');
                return;
            }

            data.adults = parseInt(data.adults) || 1;
            data.children = parseInt(data.children) || 0;
            data.totalAmount = parseFloat(data.totalAmount) || 0;
            data.nights = parseInt(data.nights) || 0;
            data.roomTotal = parseFloat(data.roomTotal) || 0; // This is the calculated total based on effectiveRoomPricePerNight
            data.servicesTotal = parseFloat(data.servicesTotal) || 0;

            // Get selected services
            const selectedServices = [];
            form.querySelectorAll('input[name="services"]:checked').forEach(checkbox => {
                selectedServices.push(checkbox.value);
            });
            data.selectedServices = selectedServices;
            data.createdAt = new Date().toISOString().split('T')[0];

            // --- ADD: Save discount fields ---
            data.discountValue = parseFloat(form.discountValue ? form.discountValue.value : 0) || 0;
            data.discountType = form.discountType ? form.discountType.value : "fixed";
            if (isNaN(data.discountValue) || data.discountValue <= 0) {
                delete data.discountValue;
                delete data.discountType;
            }

            let createdReservation;
            if (reservationId) {
                // Add permission check for edit
                if (!window.authManager.hasPermission('reservations', 'edit')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                // Update existing reservation
                createdReservation = await window.app.updateReservation(reservationId, data);
                window.notificationManager?.showNotification('success', 'Uğurlu', 'Rezervasiya yeniləndi.');
            } else {
                // Add permission check for create
                if (!window.authManager.hasPermission('reservations', 'create')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                // Create new reservation
                createdReservation = await window.app.createReservation(data);
                
                // Check if should create automatic cash entry
                const createCashEntry = form.querySelector('[name="createCashEntry"]');
                if (createCashEntry && createCashEntry.checked) {
                    const paymentType = form.querySelector('[name="paymentType"]')?.value;
                    const paymentAmount = parseFloat(form.querySelector('[name="paymentAmount"]')?.value) || 0;
                    
                    if (paymentAmount > 0) {
                        // Find current logged-in staff member or use a default if none selected or no staff exists.
                        const currentUser = window.authManager.getCurrentUser();
                        let staffIdForCash = null;
                        if (currentUser) {
                            const staffMember = window.app.data.staff.find(s => s.id === currentUser.id || s.telegramId === currentUser.id);
                            staffIdForCash = staffMember ? staffMember.id : null;
                        } else {
                             // Fallback to first staff member if no current user (unlikely in real app but for dev)
                            if (window.app.data.staff.length > 0) staffIdForCash = window.app.data.staff[0].id;
                        }

                        const cashData = {
                            type: 'income',
                            category: 'Rezervasiya ödənişi',
                            amount: paymentAmount,
                            description: `Rezervasiya #${createdReservation.id} ${paymentType === 'deposit' ? 'depozit' : paymentType === 'full' ? 'tam' : 'qismən'} ödənişi`,
                            date: new Date().toISOString().split('T')[0],
                            time: new Date().toTimeString().slice(0, 5),
                            reservationId: createdReservation.id,
                            staffId: staffIdForCash,
                            createdAt: new Date().toISOString()
                        };
                        
                        try {
                            await window.app.createCashTransaction(cashData);
                            window.notificationManager?.showNotification('success', 'Avtomatik ödəniş', `₼${paymentAmount.toFixed(2)} məbləğində avtomatik kassa mədaxili yaradıldı.`);
                        } catch (error) {
                            console.error('Error creating automatic cash entry:', error);
                            window.notificationManager?.showNotification('warning', 'Kassa xətası', 'Rezervasiya yaradıldı, amma avtomatik ödəniş mədaxili yaradılmadı.');
                        }
                    }
                }
            }

            if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
                window.modalManager.hideModal();
            }

            // The create/update methods in app.js already handle refreshing.
            // No need to call loadModule here.
        } catch (error) {
            console.error('Error in reservation form submit:', error);
            window.notificationManager?.showNotification('error', 'Sistem xətası', 'Rezervasiya əlavə və ya yenilənməsi zamanı xəta baş verdi.');
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
}

// Ensure global availability
window.ReservationForm = ReservationForm;

// Initialize form instance immediately
window.reservationForm = new ReservationForm();
export default ReservationForm;