// payment-form.js
export default class PaymentForm {
    render(cartItems, total) {
        // Show only confirmed and occupied reservations for account payment
        const reservations = window.app.data.reservations.filter(res => res.status === 'confirmed' || res.status === 'occupied');

        // Default: don't show guest/reservation selects unless 'account' is selected
        // Add event-driven logic for paymentType select
        const formId = `paymentForm_${Date.now()}`; // ensure unique for multiple modals

        return `
            <form id="${formId}" onsubmit="return false;">
                <div class="form-group">
                    <label class="form-label required">Ödəniş Növü</label>
                    <select class="form-select" name="paymentType" required data-formid="${formId}">
                        <option value="cash">Nağd</option>
                        <option value="card">Kart</option>
                        <option value="paypal">PayPal</option>
                        <option value="account">Hesaba yaz</option>
                    </select>
                </div>

                <!-- Add account selection for cash/card payments -->
                <div class="form-group" id="accountSelect_${formId}">
                    <label class="form-label required">Hesab</label>
                    <select class="form-select" name="accountId" required>
                        <option value="main">Əsas hesab (Nağd)</option>
                        <option value="bank">Bank hesabı</option>
                        <option value="pos">POS terminal</option>
                        <option value="paypal">PayPal hesabı</option>
                    </select>
                </div>

                <div class="form-group" id="guestSelect_${formId}" style="display: none;">
                    <label class="form-label">Qonaq</label>
                    <input type="text" class="form-input" id="guestSearch_${formId}" placeholder="Qonaq axtar: ad, telefon, pasport nömrəsi..." autocomplete="off" style="margin-bottom: 0.5rem;">
                    <select class="form-select" name="guestId" id="guestSelectId_${formId}">
                        <option value="">Qonaq seçin</option>
                        ${window.app.data.guests.map(guest => `
                            <option value="${guest.id}" data-search="${(guest.name || '')} ${guest.phone || ''} ${guest.passportNumber || ''} ${guest.passport || ''}" data-phone="${guest.phone || ''}">${guest.name}${guest.phone ? '  ·  ' + guest.phone : ''}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group" id="reservationSelect_${formId}" style="display: none;">
                    <label class="form-label">Rezervasiya</label>
                    <select class="form-select" name="reservationId" id="reservationSelectId_${formId}" data-formid="${formId}">
                        <option value="">Rezervasiya seçin</option>
                        ${reservations.map(reservation => {
                            const guest = window.app.data.guests.find(g => g.id === reservation.guestId);
                            const room = window.app.data.rooms.find(r => r.id === reservation.roomId);
                            
                            // Use the comprehensive financial summary for up-to-date data
                            const financialSummary = window.app.getReservationFinancialSummary(reservation.id);
                            const totalAmountDue = financialSummary?.totalAmountDue || 0;
                            const paidAmount = financialSummary?.totalPaid || 0;
                            const posSalesTotal = financialSummary?.posSalesAmount || 0;
                            const debt = financialSummary?.remainingBalance || 0;
                            const resPublicId = reservation.publicId || (window.app ? window.app.formatInternalId(reservation.id, 'RZ') : reservation.id); // Get public ID

                            return `
                                <option value="${reservation.id}" 
                                    data-guest="${guest ? guest.name : 'N/A'}" 
                                    data-guestid="${reservation.guestId}"
                                    data-room="${room ? room.number : 'N/A'}"
                                    data-total="${totalAmountDue}"
                                    data-pos="${posSalesTotal}"
                                    data-paid="${paidAmount}"
                                    data-debt="${debt}"
                                    data-publicid="${resPublicId}"> <!-- Add publicId to dataset -->
                                    #${resPublicId} - ${guest ? guest.name : 'N/A'} - Otaq ${room ? room.number : 'N/A'} (Borc: ₼${debt.toFixed(2)})
                                </option>
                            `;
                        }).join('')}
                    </select>
                </div>

                <div class="form-group" id="reservationInfo_${formId}" style="display: none; grid-column: 1 / -1;">
                    <div class="info-box">
                        <h4 class="info-box-title">Rezervasiya Məlumatları</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; font-size: 0.875rem;">
                            <div><strong>Qonaq:</strong> <span id="selectedGuestName_${formId}">-</span></div>
                            <div><strong>Otaq:</strong> <span id="selectedRoomNumber_${formId}">-</span></div>
                            <div><strong>Cəmi məbləğ:</strong> <span id="selectedReservationTotal_${formId}">₼0.00</span></div>
                            <div><strong>Ödənilən:</strong> <span id="selectedReservationPaid_${formId}">₼0.00</span></div>
                            <div><strong>Əvvəlki POS satış:</strong> <span id="selectedPOSTotal_${formId}" style="color: #3b82f6; font-weight: bold;">₼0.00</span></div>
                            <div><strong>Mövcud borc:</strong> <span id="selectedReservationDebt_${formId}" style="color: #ef4444; font-weight: bold;">₼0.00</span></div>
                            <div><strong>Yeni borc:</strong> <span id="newTotalDebt_${formId}" style="color: #f59e0b; font-weight: bold;">₼${total.toFixed(2)}</span></div>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label required">Alınan Məbləğ</label>
                    <input type="number" class="form-input" name="receivedAmount" min="0" step="0.01" value="${total}" required>
                </div>

                <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
                    <h4>Alış Detalları:</h4>
                    ${cartItems.map(item => `
                        <div style="display: flex; justify-content: space-between; margin: 0.5rem 0;">
                            <span>${item.name} x${item.quantity}</span>
                            <span>₼${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    `).join('')}
                    <hr>
                    <div style="display: flex; justify-content: space-between; font-weight: bold;">
                        <span>Cəmi:</span>
                        <span>₼${total.toFixed(2)}</span>
                    </div>
                </div>

                <div class="form-group" style="margin-top: 0.5rem; padding: 0.75rem 1rem; background: rgba(37, 211, 102, 0.08); border: 1px solid rgba(37, 211, 102, 0.35); border-radius: 8px;">
                    <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; margin: 0; font-weight: 600; color: #065f46;">
                        <input type="checkbox" name="notifyWhatsApp" id="posNotifyWhatsApp_${formId}" checked style="width: 1.15rem; height: 1.15rem; accent-color: #25D366;">
                        <span><i class="fab fa-whatsapp" style="color: #25D366; font-size: 1.2rem;"></i> Müştəriyə WhatsApp ilə qəbz / bildiriş göndər</span>
                    </label>
                    <small style="display: block; margin-top: 0.25rem; margin-left: 1.9rem; color: #475569;">
                        Satış tamamlanan kimi və ya otaq hesabına yazılan kimi müştəriyə WhatsApp qəbzi göndəriləcək.
                    </small>
                </div>
            </form>
        `;
    }

    /**
     * NEW: Renders a dedicated payment form for a specific reservation.
     * @param {object} reservation - The reservation object to take payment for.
     * @returns {string} HTML content for the modal.
     */
    renderForReservation(reservation) {
        if (!reservation) return '<p>Rezervasiya tapılmadı.</p>';

        const formId = `reservationPaymentForm_${Date.now()}`;
        const financialSummary = window.app.getReservationFinancialSummary(reservation.id);
        const guest = window.app.data.guests.find(g => g.id === reservation.guestId);
        const room = window.app.data.rooms.find(r => r.id === reservation.roomId);

        const remainingDebt = financialSummary?.remainingBalance || 0;
        const totalAmountDue = financialSummary?.totalAmountDue || 0;
        const paidAmount = financialSummary?.totalPaid || 0;

        return `
            <form id="${formId}" onsubmit="return false;" class="form-grid">
                <input type="hidden" name="reservationId" value="${reservation.id}">

                <div class="form-group" style="grid-column: 1 / -1;">
                    <div class="info-box">
                        <h4 class="info-box-title">Rezervasiya Məlumatları</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.5rem; font-size: 0.9em;">
                            <div><strong>Qonaq:</strong> <span>${guest?.name || 'N/A'}</span></div>
                            <div><strong>Otaq:</strong> <span>${room?.number || 'N/A'}</span></div>
                            <div><strong>Ümumi Məbləğ:</strong> <span>₼${totalAmountDue.toFixed(2)}</span></div>
                            <div><strong>Ödənilib:</strong> <span style="color: #10b981; font-weight: bold;">₼${paidAmount.toFixed(2)}</span></div>
                            <div><strong>Qalıq Borc:</strong> <span style="color: #ef4444; font-weight: bold;">₼${remainingDebt.toFixed(2)}</span></div>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label required">Ödəniş Məbləği (₼)</label>
                    <input type="number" class="form-input" name="amount" value="${remainingDebt.toFixed(2)}" min="0.01" step="0.01" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label required">Hesab</label>
                    <select class="form-select" name="accountId" required>
                        <option value="main">Əsas hesab (Nağd)</option>
                        <option value="bank">Bank hesabı</option>
                        <option value="pos">POS terminal</option>
                        <option value="paypal">PayPal hesabı</option>
                    </select>
                </div>

                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label">Təsvir / Qeyd</label>
                    <textarea class="form-textarea" name="description" rows="2" placeholder="Ödəniş üçün əlavə qeydlər...">${`Rezervasiya #${reservation.publicId || reservation.id} üçün ödəniş`}</textarea>
                </div>

                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label required">Tarix və Vaxt</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="date" class="form-input" name="date" value="${new Date().toISOString().split('T')[0]}" required>
                        <input type="time" class="form-input" name="time" value="${new Date().toTimeString().slice(0, 5)}" required>
                    </div>
                </div>

                <div class="form-group" style="grid-column: 1 / -1; margin-top: 0.5rem; padding: 0.75rem 1rem; background: rgba(37, 211, 102, 0.08); border: 1px solid rgba(37, 211, 102, 0.35); border-radius: 8px;">
                    <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; margin: 0; font-weight: 600; color: #065f46;">
                        <input type="checkbox" name="notifyWhatsApp" id="resPaymentNotifyWhatsApp_${formId}" checked style="width: 1.15rem; height: 1.15rem; accent-color: #25D366;">
                        <span><i class="fab fa-whatsapp" style="color: #25D366; font-size: 1.2rem;"></i> Müştəriyə WhatsApp ilə ödəniş qəbzi göndər</span>
                    </label>
                    <small style="display: block; margin-top: 0.25rem; margin-left: 1.9rem; color: #475569;">
                        Ödəniş qeydə alınan kimi qonağın telefon nömrəsinə təsdiq mesajı göndəriləcək.
                    </small>
                </div>

            </form>
        `;
    }

    /**
     * Attaches event listeners for the reservation payment form.
     * @param {HTMLElement} formNode - The form element.
     */
    attachReservationFormListeners(formNode) {
        // Currently no complex listeners are needed for this simpler form,
        // but this function is here for future enhancements.
    }
    
    /**
     * Processes the payment for a reservation from the dedicated form.
     * @param {string} reservationId - The ID of the reservation being paid.
     */
    async processReservationPayment(reservationId) {
        const form = document.querySelector('form[id^="reservationPaymentForm_"]');
        if (!form) {
            window.notificationManager?.showNotification('error', 'Form xətası', 'Ödəniş formu tapılmadı.');
            return;
        }

        try {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            const amount = parseFloat(data.amount);
            if (!amount || isNaN(amount) || amount <= 0) {
                window.notificationManager?.showNotification('error', 'Məbləğ xətası', 'Düzgün müsbət məbləğ daxil edin.');
                return;
            }

            // PERMISSION CHECK
            if (!window.authManager.hasPermission('cash', 'create')) {
                window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Kassa mədaxili yaratmaq üçün icazəniz yoxdur.');
                return;
            }

            const reservation = window.app.data.reservations.find(r => r.id === reservationId);
            const guest = window.app.data.guests.find(g => g.id === reservation?.guestId);

            const cashTransactionData = {
                type: 'income',
                category: 'Rezervasiya ödənişi',
                amount: amount,
                description: data.description || `Rezervasiya #${reservation?.publicId || reservationId} (${guest?.name || ''}) üçün ödəniş`,
                date: data.date,
                time: data.time,
                staffId: window.authManager?.getCurrentUser()?.uid || null,
                reservationId: reservationId,
                accountId: data.accountId || 'main'
            };

            await window.app.createCashTransaction(cashTransactionData);
            
            // WhatsApp Notification for reservation payment
            const notifyWhatsApp = form.querySelector('[name="notifyWhatsApp"]')?.checked;
            if (notifyWhatsApp && guest && guest.phone) {
                try {
                    const hotelInfo = window.app.getHotelInfo();
                    const hotelName = hotelInfo?.hotelName || 'Otel';
                    const resCode = reservation?.publicId || (window.app ? window.app.formatInternalId(reservationId, 'RZ') : reservationId);
                    const msg = `Hörmətli ${guest.name}, ${hotelName} otelində #${resCode} nömrəli rezervasiyanız üzrə ₼${amount.toFixed(2)} məbləğində ödənişiniz qəbul edildi.\n` +
                        `💳 Hesab: ${data.accountId || 'Kassa'}\n` +
                        `📅 Tarix: ${data.date} ${data.time}\n` +
                        `Təşəkkür edirik!`;
                    window.sendWhatsAppNotification?.(guest.phone, msg);
                } catch (waErr) {
                    console.warn('WhatsApp payment receipt error:', waErr);
                }
            }

            window.notificationManager?.showNotification('success', 'Ödəniş Qəbul Edildi', `₼${amount.toFixed(2)} məbləğində ödəniş uğurla qeydə alındı.`);
            window.modalManager.hideModal();
            
            // Refresh reservations to show updated debt
            if (window.app.currentModule === 'reservations') {
                await window.app.refreshData('reservations');
                window.app.refreshCurrentModule();
            }

        } catch (error) {
            console.error('Error processing reservation payment:', error);
            window.notificationManager?.showNotification('error', 'Ödəniş Xətası', `Ödəniş zamanı xəta baş verdi: ${error.message}`);
        }
    }

    // New method to attach all necessary event listeners for the payment form
    attachEventListeners(formNode, cartItems, total) {
        if (!formNode || formNode.__payment_event_attached) return;
        formNode.__payment_event_attached = true;

        const formId = formNode.id;
        const currentCartTotal = total; // Use the passed total

        // Payment type onchange
        formNode.paymentType &&
        formNode.paymentType.addEventListener('change', function() {
            const accountSelect = document.getElementById('accountSelect_' + formId);
            const guestSelect = document.getElementById('guestSelect_' + formId);
            const reservationSelect = document.getElementById('reservationSelect_' + formId);
            const reservationInfo = document.getElementById('reservationInfo_' + formId);

            if (this.value === 'account') {
                accountSelect.style.display = 'none';
                guestSelect.style.display = 'block';
                reservationSelect.style.display = 'block';
                reservationInfo.style.display = 'block';
            } else {
                accountSelect.style.display = 'block';
                guestSelect.style.display = 'none';
                reservationSelect.style.display = 'none';
                reservationInfo.style.display = 'none';
            }
        });

        // Guest search: filter the guest dropdown options by text/phone/passport
        const guestSearch = document.getElementById('guestSearch_' + formId);
        const guestSelect = formNode.querySelector('select[name="guestId"]');
        const reservationSelect = formNode.querySelector('select[name="reservationId"]');
        const allReservationOptions = reservationSelect ? Array.from(reservationSelect.options) : [];

        const filterReservationsByGuest = (guestId) => {
            if (!reservationSelect) return;
            const currentSelection = reservationSelect.value;
            allReservationOptions.forEach(opt => {
                // Keep the placeholder option always visible
                opt.hidden = opt.value && (guestId ? opt.dataset.guestid !== guestId : false);
            });
            // If the current selection no longer belongs to the selected guest, reset it
            if (guestId && currentSelection) {
                const selectedOpt = reservationSelect.options[reservationSelect.selectedIndex];
                if (selectedOpt && selectedOpt.dataset.guestid !== guestId) {
                    reservationSelect.value = '';
                }
            }
            reservationSelect.dispatchEvent(new Event('change'));
        };

        if (guestSearch && guestSelect) {
            guestSearch.addEventListener('input', function() {
                const term = this.value.toLowerCase();
                Array.from(guestSelect.options).forEach(opt => {
                    if (!opt.value) { opt.hidden = false; return; } // keep placeholder
                    const haystack = (opt.dataset.search || '').toLowerCase();
                    opt.hidden = term && !haystack.includes(term);
                });
                // Re-filter reservations according to currently selected guest
                filterReservationsByGuest(guestSelect.value);
            });

            guestSelect.addEventListener('change', function() {
                // When a guest is chosen, hide the search field focus and filter reservations
                filterReservationsByGuest(this.value);
                if (guestSearch) guestSearch.value = '';
                Array.from(guestSelect.options).forEach(opt => opt.hidden = false);
            });
        }

        // Payment type onchange needs to reset guest/reservation filtering when switching to 'account'
        formNode.paymentType && formNode.paymentType.addEventListener('change', function() {
            if (this.value === 'account' && guestSearch) guestSearch.value = '';
        });

        // Reservation select onchange
        if (reservationSelect && !reservationSelect.__account_filter_attached) {
        reservationSelect.__account_filter_attached = true;
            reservationSelect.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                const newTotalDebtEl = document.getElementById('newTotalDebt_' + formId);

                if (selectedOption && selectedOption.value) {
                    const guestName = selectedOption.dataset.guest;
                    const roomNumber = selectedOption.dataset.room;
                    const totalAmountDue = parseFloat(selectedOption.dataset.total) || 0;
                    const posTotal = parseFloat(selectedOption.dataset.pos) || 0;
                    const paid = parseFloat(selectedOption.dataset.paid) || 0;
                    const currentDebt = parseFloat(selectedOption.dataset.debt) || 0;
                    const newTotalDebt = currentDebt + currentCartTotal; // Debt from reservation + current cart total

                    document.getElementById('selectedGuestName_' + formId).textContent = guestName;
                    document.getElementById('selectedRoomNumber_' + formId).textContent = roomNumber;
                    document.getElementById('selectedReservationTotal_' + formId).textContent = '₼' + totalAmountDue.toFixed(2);
                    document.getElementById('selectedPOSTotal_' + formId).textContent = '₼' + posTotal.toFixed(2);
                    document.getElementById('selectedReservationPaid_' + formId).textContent = '₼' + paid.toFixed(2);
                    document.getElementById('selectedReservationDebt_' + formId).textContent = '₼' + currentDebt.toFixed(2);
                    if (newTotalDebtEl) newTotalDebtEl.textContent = '₼' + newTotalDebt.toFixed(2);
                } else {
                    document.getElementById('selectedGuestName_' + formId).textContent = '-';
                    document.getElementById('selectedRoomNumber_' + formId).textContent = '-';
                    document.getElementById('selectedReservationTotal_' + formId).textContent = '₼0.00';
                    document.getElementById('selectedPOSTotal_' + formId).textContent = '₼0.00';
                    document.getElementById('selectedReservationPaid_' + formId).textContent = '₼0.00';
                    document.getElementById('selectedReservationDebt_' + formId).textContent = '₼0.00';
                    if (newTotalDebtEl) newTotalDebtEl.textContent = '₼' + currentCartTotal.toFixed(2); // Revert to cartTotal
                }
            });
        }
        
        // Trigger initial payment type selection after listeners are attached
        if (formNode.paymentType) {
            formNode.paymentType.dispatchEvent(new Event('change'));
        }
    }

    processPayment() {
        try {
            // Find the modal form (might have dynamic id)
            const formNode = document.querySelector('.modal-body form[id^="paymentForm"]');
            if (!formNode) return;
            
            const form = formNode;
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            const paymentType = data.paymentType;
            const accountId = data.accountId || 'main';
            const guestId = data.guestId || null;
            const reservationId = data.reservationId || null;
            const receivedAmount = parseFloat(data.receivedAmount);

            // Use currently presented cart:
            const cart = window.posComponent.cart;
            const cartTotal = window.posComponent.cartTotal;

            // Simple validation
            if (!receivedAmount || isNaN(receivedAmount) || receivedAmount < 0) {
                window.notificationManager?.showNotification('error', 'Məbləğ xətası', 'Düzgün məbləğ daxil edin.');
                return;
            }

            if (paymentType === 'account' && (!guestId || !reservationId)) {
                window.notificationManager?.showNotification('error', 'Məlumat xətası', 'Hesaba yazmaq üçün qonaq və rezervasiya seçin.');
                return;
            }

            // The processPOSSale method now contains its own permission check.
            window.app.processPOSSale(cart, cartTotal, {
                paymentType: paymentType,
                accountId: accountId,
                guestId: guestId,
                reservationId: reservationId, // Always pass reservationId if selected, regardless of payment type
                receivedAmount: receivedAmount,
                // ADDED: Pass the current logged-in user's UID as staffId
                staffId: window.authManager?.getCurrentUser()?.uid || null 
            });

            // WhatsApp Notification for POS sale
            const notifyWhatsApp = form.querySelector('[name="notifyWhatsApp"]')?.checked;
            if (notifyWhatsApp) {
                try {
                    let targetGuest = null;
                    let roomNumber = '';
                    if (reservationId) {
                        const res = window.app.data.reservations.find(r => r.id === reservationId);
                        targetGuest = window.app.data.guests.find(g => g.id === res?.guestId);
                        const rm = window.app.data.rooms.find(r => r.id === res?.roomId);
                        roomNumber = rm ? rm.number : '';
                    } else if (guestId) {
                        targetGuest = window.app.data.guests.find(g => g.id === guestId);
                    }

                    if (targetGuest && targetGuest.phone) {
                        const hotelInfo = window.app.getHotelInfo();
                        const hotelName = hotelInfo?.hotelName || 'Otel';
                        const itemsSummary = cart.map(i => `${i.name} (${i.quantity} ədəd)`).join(', ');
                        const isAccount = paymentType === 'account';
                        const actionDesc = isAccount ? (roomNumber ? `№${roomNumber} otaq hesabınıza yazıldı` : 'hesabınıza əlavə edildi') : 'ödənişi qeydə alındı';
                        const msg = `Hörmətli ${targetGuest.name}, ${hotelName} otelində POS satış üzrə ₼${cartTotal.toFixed(2)} məbləğində xərc ${actionDesc}.\n` +
                            `🛒 Məhsullar: ${itemsSummary}\n` +
                            `Təşəkkür edirik!`;
                        window.sendWhatsAppNotification?.(targetGuest.phone, msg);
                    }
                } catch (waErr) {
                    console.warn('WhatsApp POS notification error:', waErr);
                }
            }

            // Clear POS cart after sale
            window.posComponent.clearCart();

            window.modalManager.hideModal();

            // Refresh POS view
            if (window.app.currentModule === 'pos') {
                window.app.loadModule('pos');
            }
        } catch (error) {
            console.error('Error processing payment:', error);
            window.notificationManager?.showNotification('error', 'Ödəniş xətası', 'Ödəniş zamanı xəta baş verdi.');
        }
    }
}