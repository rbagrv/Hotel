// cash-form.js
//
// Kassa əməliyyatı formu
//
// EXPORT: export default CashForm;
//

export default class CashForm {
    
    // NEW: Helper to calculate balances synchronously (Optimized Single Pass)
    _calculateAllAccountBalances() {
        const cashTransactions = window.app?.data?.cashTransactions || [];
        // Initialize structure
        const accountBalances = {
            main: { income: 0, expense: 0, balance: 0 },
            bank: { income: 0, expense: 0, balance: 0 },
            pos: { income: 0, expense: 0, balance: 0 },
            paypal: { income: 0, expense: 0, balance: 0 }
        };

        // Single pass O(N) calculation
        for (const t of cashTransactions) {
            const accId = t.accountId || 'main';
            if (accountBalances[accId]) {
                const amt = parseFloat(t.amount) || 0;
                if (t.type === 'income') {
                    accountBalances[accId].income += amt;
                    accountBalances[accId].balance += amt;
                } else if (t.type === 'expense') {
                    accountBalances[accId].expense += amt;
                    accountBalances[accId].balance -= amt;
                }
            }
        }
        return accountBalances;
    }

    render(type = 'income', transaction = null, reservationId = null, purchaseDocumentId = null) {
        const isEdit = transaction !== null;

        // --- FIX: Calculate accountBalances here ---
        const accountBalances = this._calculateAllAccountBalances();

        // Get current logged in user from auth manager
        const currentUser = window.authManager?.getCurrentUser();
        let currentStaffMember = null;
        if (currentUser) {
            // Find staff member by matching ID from auth
            currentStaffMember = window.app.data.staff.find(s => s.id == currentUser.uid);
        }
        
        // Determine the selected staff member for the form (Staff ID of the person performing the transaction)
        const selectedStaffId = isEdit 
            ? transaction.staffId 
            : (currentStaffMember ? currentStaffMember.id : (currentUser ? currentUser.uid : ''));
        // Find staff name for display
        const staffList = window.app.data.staff || [];
        const displayStaff = staffList.find(s => s.id === selectedStaffId);
        const displayStaffName = displayStaff ? `${displayStaff.name} - ${displayStaff.position || ''}` : 'Bilinmir';

        const formId = `cashForm_${Date.now()}`;

        // Get purchase document info if available
        let purchaseDoc = null;
        if (purchaseDocumentId) {
            purchaseDoc = window.app.data.purchaseDocuments.find(d => d.id === purchaseDocumentId);
        } else if (isEdit && transaction.purchaseDocumentId) {
            purchaseDoc = window.app.data.purchaseDocuments.find(d => d.id === transaction.purchaseDocumentId);
        }

        // --- NEW: Reservation pre-fill logic ---
        let prefillAmount = '';
        let prefillDescription = '';
        let prefillCategory = type === 'income' ? 'Digər gəlir' : 'Digər xərc'; // Default category

        let targetReservation = null;
        if (reservationId && !isEdit) { // Only pre-fill if it's a new transaction and reservationId is provided
            targetReservation = window.app.data.reservations.find(res => res.id === reservationId);
            if (targetReservation) {
                const financialSummary = window.app.getReservationFinancialSummary(targetReservation.id);
                // Use remainingBalance for amount
                prefillAmount = financialSummary.remainingBalance > 0 ? financialSummary.remainingBalance.toFixed(2) : '';
                prefillDescription = `Rezervasiya #${targetReservation.publicId || targetReservation.id} ödənişi - ${(window.app.data.guests.find(g => g.id === targetReservation.guestId)?.name || 'Qonaq')}`;
                prefillCategory = 'Rezervasiya ödənişi';
                type = 'income'; // Force type to income for reservation payments
            }
        } else if (isEdit) { // If it's an edit, use existing transaction data
            prefillAmount = transaction.amount;
            prefillDescription = transaction.description;
            prefillCategory = transaction.category;
            // Also set targetReservation if it's an edit of a reservation-linked transaction
            if (transaction.reservationId) {
                targetReservation = window.app.data.reservations.find(res => res.id === transaction.reservationId);
            }
        } else if (purchaseDoc) { // If it's a new transaction for a purchase document
             const paidForDoc = window.app.getPaidForPurchaseDocument(purchaseDoc.id);
             const debtForDoc = (purchaseDoc.totalAmount || 0) - paidForDoc;
             prefillAmount = debtForDoc > 0 ? debtForDoc.toFixed(2) : '';
             prefillDescription = `Alış sənədi #${purchaseDoc.publicId || purchaseDoc.documentNumber} ödənişi - ${purchaseDoc.supplierName}`;
             prefillCategory = 'Təchizat alışı';
             type = 'expense'; // Force type to expense for purchase payments
        }

        return `
            <form id="${formId}" class="form-grid">
                <div class="form-group">
                    <label class="form-label required">Əməliyyat Növü</label>
                    <select class="form-select" name="type" required onchange="window.cashForm.updateCategories(this.value, '${formId}')" ${isEdit || targetReservation || purchaseDoc ? 'disabled' : ''}>
                        <option value="income" ${type === 'income' ? 'selected' : ''}>Gəlir</option>
                        <option value="expense" ${type === 'expense' ? 'selected' : ''}>Xərc</option>
                    </select>
                    ${isEdit || targetReservation || purchaseDoc ? `<input type="hidden" name="type" value="${type}">` : ''}
                </div>

                <!-- Account Selection (with balance info) -->
                <div class="form-group">
                    <label class="form-label required">Hesab</label>
                    <select class="form-select" name="accountId" required onchange="window.cashForm.updateAccountBalance('${formId}', this.value)">
                        <option value="main" ${(!isEdit && !transaction?.accountId) || transaction?.accountId === 'main' ? 'selected' : ''}>
                            Əsas hesab (Nağd) [₼${(accountBalances["main"]?.balance || 0).toFixed(2)}]
                        </option>
                        <option value="bank" ${isEdit && transaction?.accountId === 'bank' ? 'selected' : ''}>
                            Bank hesabı [₼${(accountBalances["bank"]?.balance || 0).toFixed(2)}]
                        </option>
                        <option value="pos" ${isEdit && transaction?.accountId === 'pos' ? 'selected' : ''}>
                            POS terminal [₼${(accountBalances["pos"]?.balance || 0).toFixed(2)}]
                        </option>
                        <option value="paypal" ${isEdit && transaction?.accountId === 'paypal' ? 'selected' : ''}>
                            PayPal hesabı [₼${(accountBalances["paypal"]?.balance || 0).toFixed(2)}]
                        </option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label required">Kateqoriya</label>
                    <select class="form-select" name="category" required id="categorySelect_${formId}" onchange="window.cashForm.handleCategoryChange('${formId}')">
                        <option value="">Seçin</option>
                        ${type === 'income' ? 
                            (window.app?.getSetting('cashIncomeCategories') || ['Rezervasiya ödənişi', 'POS satış', 'Əlavə xidmət', 'Depozit', 'Bank daxilolma', 'Digər gəlir'])
                            .map(cat => `<option value="${cat}" ${prefillCategory === cat ? 'selected' : ''}>${cat}</option>`).join('')
                        : 
                            (window.app?.getSetting('cashExpenseCategories') || ['Maaş ödənişi', 'Təchizat alışı', 'Kommunal ödəniş', 'Təmir xərcləri', 'Təmizlik materialları', 'Bank xərci', 'Digər xərc'])
                            .map(cat => `<option value="${cat}" ${prefillCategory === cat ? 'selected' : ''}>${cat}</option>`).join('')
                        }
                    </select>
                </div>

                <!-- Salary Recipient Staff Selection (Required for salary payments) -->
                <div class="form-group" id="salaryRecipientWrapper_${formId}" style="display: none;">
                    <label class="form-label required" style="color: #10b981;">Maaş Alan İşçi</label>
                    <select class="form-select" name="salaryRecipientId" style="border-color: #10b981;" onchange="window.cashForm.handleSalaryRecipientChange('${formId}')">
                        <option value="">Seçin</option>
                        ${window.app.data.staff.map(employee => `
                            <option value="${employee.id}" 
                                ${isEdit && transaction.salaryRecipientId === employee.id ? 'selected' : ''}
                                data-salary="${employee.salary}">
                                ${employee.name} - ${employee.position}${employee.salary ? ` &middot; ₼<span style='color:#10b981;'>${parseFloat(employee.salary).toFixed(2)}</span>` : ''}
                            </option>
                        `).join('')}
                    </select>
                    <small style="color: #10b98b; font-size: 0.875rem;">Maaş ödəniləcək işçini seçin</small>
                </div>

                <!-- Responsible Staff Selection (Automatically set to current user) -->
                <div class="form-group" id="responsibleStaffWrapper_${formId}">
                    <label class="form-label">Məsul İşçi</label>
                    <input type="text" class="form-input" value="${displayStaffName}" readonly>
                    <input type="hidden" name="staffId" value="${selectedStaffId}">
                    <small style="color: #64748b; font-size: 0.875rem;">
                        Əməliyyatı yaradan işçi (dəyişdirilə bilməz).
                    </small>
                </div>

                <div class="form-group" id="reservationSelect_${formId}" style="display: none;">
                    <label class="form-label">Rezervasiya</label>
                    <input type="text" class="form-input" id="reservationSearch_${formId}" placeholder="Rezervasiya axtar: ID, qonaq, otaq..." autocomplete="off" style="margin-bottom: 0.5rem;">
                    <select class="form-select" name="reservationId" onchange="window.cashForm.updateReservationDebt('${formId}')">
                        <option value="">Rezervasiya seçin</option>
                        ${window.app.data.reservations.filter(res => res.status === 'confirmed' || res.status === 'occupied').map(reservation => {
                            const guest = window.app.data.guests.find(g => g.id === reservation.guestId);
                            const room = window.app.data.rooms.find(r => r.id === reservation.roomId);
                            const financialSummary = window.app.getReservationFinancialSummary(reservation.id);
                            const debt = financialSummary?.remainingBalance || 0;
                            const resPublicId = reservation.publicId || (window.app ? window.app.formatInternalId(reservation.id, 'RZ') : reservation.id); // Use publicId

                            return `
                                <option value="${reservation.id}" 
                                    data-total="${financialSummary?.totalAmount || 0}" 
                                    data-paid="${financialSummary?.totalPaid || 0}" 
                                    data-debt="${debt}"
                                    data-guest="${guest ? guest.name : 'N/A'}"
                                    data-room="${room ? room.number : 'N/A'}"
                                    data-publicid="${resPublicId}"
                                    data-search="${resPublicId} ${guest ? guest.name : 'N/A'} ${room ? room.number : 'N/A'}"
                                    ${(isEdit && transaction.reservationId == reservation.id) || (!isEdit && targetReservation && targetReservation.id == reservation.id) ? 'selected' : ''}>
                                    #${resPublicId} - ${guest ? guest.name : 'N/A'} - Otaq ${room ? room.number : 'N/A'} (Borc: ₼${debt.toFixed(2)})
                                </option>
                            `;
                        }).join('')}
                    </select>
                </div>

                <div class="form-group" id="reservationDebtInfo_${formId}" style="display: none; grid-column: 1 / -1;">
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #1e293b;">Rezervasiya Məlumatları</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; font-size: 0.875rem;">
                            <div><strong>Qonaq:</strong> <span id="reservationGuest_${formId}">-</span></div>
                            <div><strong>Otaq:</strong> <span id="reservationRoom_${formId}">-</span></div>
                            <div><strong>Ümumi məbləğ:</strong> <span id="reservationTotal_${formId}">₼0.00</span></div>
                            <div><strong>Ödənilən:</strong> <span id="reservationPaid_${formId}">₼0.00</span></div>
                            <div><strong>Qalan borc:</strong> <span id="reservationDebt_${formId}" style="color: #ef4444; font-weight: bold;">₼0.00</span></div>
                        </div>
                    </div>
                </div>

                <!-- New: Purchase Document selection -->
                <div class="form-group" id="purchaseDocSelect_${formId}" style="display: none;">
                    <label class="form-label">Alış Sənədi</label>
                    <select class="form-select" name="purchaseDocumentId" onchange="window.cashForm.updatePurchaseDocInfo('${formId}')">
                        <option value="">Alış sənədi seçin</option>
                        ${window.app.data.purchaseDocuments.map(doc => {
                            const paidForDoc = window.app.getPaidForPurchaseDocument(doc.id);
                            const debtForDoc = (doc.totalAmount || 0) - paidForDoc;
                            const docPublicId = doc.publicId || (window.app ? window.app.formatInternalId(doc.id, 'AS') : doc.id); // Use publicId
                            return `
                                <option value="${doc.id}" 
                                    data-total="${doc.totalAmount}" 
                                    data-paid="${paidForDoc}" 
                                    data-debt="${debtForDoc}"
                                    data-supplier="${doc.supplierName}"
                                    data-docnum="${doc.documentNumber}"
                                    data-publicid="${docPublicId}" <!-- Add publicId to dataset -->
                                    ${(isEdit && transaction.purchaseDocumentId == doc.id) || (!isEdit && purchaseDocumentId && purchaseDocumentId == doc.id) ? 'selected' : ''}>
                                    #${docPublicId} - ${doc.supplierName} (Borc: ₼${debtForDoc.toFixed(2)})
                                </option>
                            `;
                        }).join('')}
                    </select>
                </div>

                <div class="form-group" id="purchaseDocInfo_${formId}" style="display: none; grid-column: 1 / -1;">
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #1e293b;">Alış Sənədi Məlumatları</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; font-size: 0.875rem;">
                            <div><strong>Sənəd №:</strong> <span id="purchaseDocNum_${formId}">-</span></div>
                            <div><strong>Təchizatçı:</strong> <span id="purchaseDocSupplier_${formId}">-</span></div>
                            <div><strong>Ümumi məbləğ:</strong> <span id="purchaseDocTotal_${formId}">₼0.00</span></div>
                            <div><strong>Ödənilən:</strong> <span id="purchaseDocPaid_${formId}">₼0.00</span></div>
                            <div><strong>Qalan borc:</strong> <span id="purchaseDocDebt_${formId}" style="color: #ef4444; font-weight: bold;">₼0.00</span></div>
                            <div><strong>Sistem ID:</strong> <span id="purchaseDocPublicId_${formId}">-</span></div>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label required">Məbləğ (₼)</label>
                    <input type="number" class="form-input" name="amount" min="0" step="0.01" value="${prefillAmount}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Tarix</label>
                    <input type="date" class="form-input" name="date" value="${isEdit ? transaction.date : new Date().toISOString().split('T')[0]}" required>
                </div>

                <div class="form-group">
                    <label class="form-label required">Vaxt</label>
                    <input type="time" class="form-input" name="time" value="${isEdit ? transaction.time : new Date().toTimeString().slice(0,5)}" required>
                </div>

                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label required">Təsvir</label>
                    <textarea class="form-textarea" name="description" rows="3" required>${prefillDescription}</textarea>
                </div>
            </form>
            <div style="margin-top: 1rem; padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">
                <div style="color: #1e293b; margin-bottom: 0.5rem;">
                    <strong>Seçilmiş hesab qalığı:</strong>
                </div>
                <div id="accountBalance_${formId}" style="font-size: 1.1rem; font-weight: bold;">
                    ${this.renderAccountBalanceBlock(Object.keys(accountBalances)[0], accountBalances)} <!-- Show default main on initial render -->
                </div>
            </div>
        `;
    }

    renderAccountBalanceBlock(accountId, accountBalances) {
        // Defensive: always compute with fallback 0s
        const acc = accountBalances[accountId] || { income: 0, expense: 0, balance: 0 };
        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.7rem;">
                <div><span style="color: #10b981;">Gəlir: ₼${Number(acc.income || 0).toFixed(2)}</span></div>
                <div><span style="color: #ef4444;">Xərc: ₼${Number(acc.expense || 0).toFixed(2)}</span></div>
                <div>
                    <span style="color: ${acc.balance >= 0 ? '#10b981' : '#ef4444'};">
                        Qalıq: ₼${Number(acc.balance || 0).toFixed(2)}
                    </span>
                </div>
            </div>
        `;
    }

    async updateAccountBalance(formId, accountId) {
        const balanceDiv = document.getElementById(`accountBalance_${formId}`);
        if (!balanceDiv) return;

        // Compute per-account balances and re-render
        try {
            const accountBalances = this._calculateAllAccountBalances(); // Use the new helper
            balanceDiv.innerHTML = this.renderAccountBalanceBlock(accountId, accountBalances);
        } catch (error) {
            console.error('Error updating account balance:', error);
            balanceDiv.innerHTML = 'Xəta baş verdi';
        }
    }

    updateCategories(type, formId) {
        const categorySelect = document.getElementById(`categorySelect_${formId}`);
        if (!categorySelect) return;
        
        const incomeCategories = window.app?.getSetting('cashIncomeCategories') || ['Rezervasiya ödənişi', 'POS satış', 'Əlavə xidmət', 'Depozit', 'Bank daxilolma', 'Digər gəlir'];
        const expenseCategories = window.app?.getSetting('cashExpenseCategories') || ['Maaş ödənişi', 'Təchizat alışı', 'Kommunal ödəniş', 'Təmir xərcləri', 'Təmizlik materialları', 'Bank xərci', 'Digər xərc'];
        
        const categories = type === 'income' ? incomeCategories : expenseCategories;
        const currentValue = categorySelect.value; // Preserve any pre-selected category (e.g. when editing)
        categorySelect.innerHTML = '<option value="">Seçin</option>' + 
            categories.map(cat => `<option value="${window.escapeHtml(cat)}" ${currentValue === cat ? 'selected' : ''}>${window.escapeHtml(cat)}</option>`).join('');
        if (currentValue && !categories.includes(currentValue)) {
            // Keep the stale selection visible by re-adding it so editing doesn't silently lose it
            categorySelect.value = currentValue;
        }
        
        this.handleCategoryChange(formId);
    }

    handleCategoryChange(formId) {
        const categorySelect = document.getElementById(`categorySelect_${formId}`);
        const typeSelect = document.querySelector(`#${formId} [name="type"]`);
        if (!categorySelect || !typeSelect) return;

        const isSalaryPayment = typeSelect.value === 'expense' && categorySelect.value === 'Maaş ödənişi';
        const isReservationPayment = typeSelect.value === 'income' && categorySelect.value === 'Rezervasiya ödənişi';
        const isPurchasePayment = typeSelect.value === 'expense' && categorySelect.value === 'Təchizat alışı';

        const salaryWrapper = document.getElementById(`salaryRecipientWrapper_${formId}`);
        const salarySelect = salaryWrapper?.querySelector('select');
        const reservationWrapper = document.getElementById(`reservationSelect_${formId}`);
        const reservationInfo = document.getElementById(`reservationDebtInfo_${formId}`);
        const purchaseDocWrapper = document.getElementById(`purchaseDocSelect_${formId}`);
        const purchaseDocInfo = document.getElementById(`purchaseDocInfo_${formId}`);

        if (salaryWrapper) salaryWrapper.style.display = isSalaryPayment ? 'block' : 'none';
        if (salarySelect) salarySelect.required = isSalaryPayment;
        
        if (reservationWrapper) reservationWrapper.style.display = isReservationPayment ? 'block' : 'none';
        if (reservationInfo) reservationInfo.style.display = isReservationPayment ? 'block' : 'none';
        
        if (!isReservationPayment) {
            const reservationInput = document.querySelector(`#${formId} [name="reservationId"]`);
            if (reservationInput) reservationInput.value = '';
            this.updateReservationDebt(formId);
        }

        if (purchaseDocWrapper) purchaseDocWrapper.style.display = isPurchasePayment ? 'block' : 'none';
        if (purchaseDocInfo) purchaseDocInfo.style.display = isPurchasePayment ? 'block' : 'none';

        if (!isPurchasePayment) {
            const purchaseDocInput = document.querySelector(`#${formId} [name="purchaseDocumentId"]`);
            if (purchaseDocInput) purchaseDocInput.value = '';
            this.updatePurchaseDocInfo(formId);
        }
    }

    handleSalaryRecipientChange(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        const salarySelect = form.querySelector('[name="salaryRecipientId"]');
        const selected = salarySelect.options[salarySelect.selectedIndex];
        
        if (selected && selected.value) {
            const salary = selected.getAttribute('data-salary');
            if (salary && !isNaN(parseFloat(salary))) {
                const amtInput = form.querySelector('[name="amount"]');
                if (amtInput) amtInput.value = parseFloat(salary).toFixed(2);
            }
            
            const descInput = form.querySelector('[name="description"]');
            if (descInput && (!descInput.value || descInput.value.startsWith('Maaş'))) {
                const name = selected.textContent.split('-')[0].trim();
                descInput.value = `Maaş ödənişi - ${name}`;
            }
        }
    }
    
    updateReservationDebt(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        const reservationSelect = form.querySelector('[name="reservationId"]');
        const amountInput = form.querySelector('input[name="amount"]');
        const selectedOption = reservationSelect.options[reservationSelect.selectedIndex];

        const elements = {
            guest: document.getElementById(`reservationGuest_${formId}`),
            room: document.getElementById(`reservationRoom_${formId}`),
            total: document.getElementById(`reservationTotal_${formId}`),
            paid: document.getElementById(`reservationPaid_${formId}`),
            debt: document.getElementById(`reservationDebt_${formId}`)
        };

        if (selectedOption && selectedOption.value) {
            const debt = parseFloat(selectedOption.dataset.debt) || 0;
            if (elements.guest) elements.guest.textContent = selectedOption.dataset.guest || '-';
            if (elements.room) elements.room.textContent = selectedOption.dataset.room || '-';
            if (elements.total) elements.total.textContent = '₼' + (parseFloat(selectedOption.dataset.total) || 0).toFixed(2);
            if (elements.paid) elements.paid.textContent = '₼' + (parseFloat(selectedOption.dataset.paid) || 0).toFixed(2);
            if (elements.debt) elements.debt.textContent = '₼' + debt.toFixed(2);
            if (debt > 0 && amountInput) {
                amountInput.value = debt.toFixed(2);
            }
            const descriptionTextarea = form.querySelector('textarea[name="description"]');
            if (descriptionTextarea && (!descriptionTextarea.value || descriptionTextarea.value.includes('Rezervasiya #'))) {
                descriptionTextarea.value = 'Rezervasiya #' + (selectedOption.dataset.publicid || selectedOption.value) + ' ödənişi - ' + (selectedOption.dataset.guest || 'N/A'); // Use publicId
            }
        } else {
            Object.values(elements).forEach(el => {
                if (el) el.textContent = el.id.includes('reservation') && !el.id.includes('Guest') && !el.id.includes('Room') ? '₼0.00' : '-';
            });
            if (amountInput) amountInput.value = '';
        }
    }

    // New: Update Purchase Document Info
    updatePurchaseDocInfo(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        const purchaseDocSelect = form.querySelector('[name="purchaseDocumentId"]');
        const amountInput = form.querySelector('input[name="amount"]');
        const selectedOption = purchaseDocSelect.options[purchaseDocSelect.selectedIndex];

        const elements = {
            docNum: document.getElementById(`purchaseDocNum_${formId}`),
            supplier: document.getElementById(`purchaseDocSupplier_${formId}`),
            total: document.getElementById(`purchaseDocTotal_${formId}`),
            paid: document.getElementById(`purchaseDocPaid_${formId}`),
            debt: document.getElementById(`purchaseDocDebt_${formId}`),
            publicId: document.getElementById(`purchaseDocPublicId_${formId}`) // New publicId element
        };

        if (selectedOption && selectedOption.value) {
            const debt = parseFloat(selectedOption.dataset.debt) || 0;
            if (elements.docNum) elements.docNum.textContent = selectedOption.dataset.docnum || '-';
            if (elements.supplier) elements.supplier.textContent = selectedOption.dataset.supplier || '-';
            if (elements.total) elements.total.textContent = '₼' + (parseFloat(selectedOption.dataset.total) || 0).toFixed(2);
            if (elements.paid) elements.paid.textContent = '₼' + (parseFloat(selectedOption.dataset.paid) || 0).toFixed(2);
            if (elements.debt) elements.debt.textContent = '₼' + debt.toFixed(2);
            if (elements.publicId) elements.publicId.textContent = selectedOption.dataset.publicid || '-'; // Display publicId
            if (debt > 0 && amountInput) {
                amountInput.value = debt.toFixed(2);
            }
            const descriptionTextarea = form.querySelector('textarea[name="description"]');
            if (descriptionTextarea && (!descriptionTextarea.value || descriptionTextarea.value.includes('Alış sənədi #'))) {
                descriptionTextarea.value = `Alış sənədi #${selectedOption.dataset.publicid || selectedOption.dataset.docnum} ödənişi - ${selectedOption.dataset.supplier || 'N/A'}`; // Use publicId
            }
        } else {
            Object.values(elements).forEach(el => {
                if (el) el.textContent = el.id.includes('purchaseDoc') && !el.id.includes('Num') && !el.id.includes('Supplier') && !el.id.includes('PublicId') ? '₼0.00' : '-'; // Clear publicId too
            });
            if (amountInput) amountInput.value = '';
        }
    }

    // New method to attach all necessary event listeners and set initial states
    attachFormListeners(formId) {
        const form = document.getElementById(formId);
        if (!form || form.__listenersAttached) return; // Prevent multiple attachments
        form.__listenersAttached = true; // Mark as attached

        // Get initial values to trigger updates
        const initialType = form.querySelector('[name="type"]').value;
        const initialAccountId = form.querySelector('[name="accountId"]').value;
        const initialCategory = form.querySelector('[name="category"]').value; // This might be pre-filled via hidden input

        // Event listeners
        form.querySelector('[name="type"]').addEventListener('change', (e) => this.updateCategories(e.target.value, formId));
        form.querySelector('[name="accountId"]').addEventListener('change', (e) => this.updateAccountBalance(formId, e.target.value));
        form.querySelector('[name="category"]').addEventListener('change', () => this.handleCategoryChange(formId));

        const reservationSelect = form.querySelector('[name="reservationId"]');
        if (reservationSelect) {
            reservationSelect.addEventListener('change', () => this.updateReservationDebt(formId));

            // Reservation search: filter the dropdown by ID, guest name or room number.
            const reservationSearch = document.getElementById(`reservationSearch_${formId}`);
            if (reservationSearch) {
                const allOptions = Array.from(reservationSelect.options);
                reservationSearch.addEventListener('input', function() {
                    const term = this.value.toLowerCase();
                    allOptions.forEach(opt => {
                        if (!opt.value) { opt.hidden = false; return; } // keep placeholder visible
                        opt.hidden = term && !((opt.dataset.search || '').toLowerCase().includes(term));
                    });
                });
            }
        }

        const purchaseDocSelect = form.querySelector('[name="purchaseDocumentId"]');
        if (purchaseDocSelect) {
            purchaseDocSelect.addEventListener('change', () => this.updatePurchaseDocInfo(formId));
        }
        
        const salarySelect = form.querySelector('[name="salaryRecipientId"]');
        if (salarySelect) {
            salarySelect.addEventListener('change', () => this.handleSalaryRecipientChange(formId));
        }

        // Trigger initial updates based on the current form state
        this.updateCategories(initialType, formId);
        this.updateAccountBalance(formId, initialAccountId);
        
        // Explicitly trigger change for category as its display logic depends on it
        // This is important if category is pre-selected and its change event didn't fire naturally.
        form.querySelector('[name="category"]').dispatchEvent(new Event('change'));

        // If reservationId or purchaseDocumentId were pre-filled, trigger their change events.
        if (reservationSelect && reservationSelect.value) {
            this.updateReservationDebt(formId);
        }
        if (purchaseDocSelect && purchaseDocSelect.value) {
            this.updatePurchaseDocInfo(formId);
        }
    }

    async submit(type, transactionId = null) {
        try {
            const form = document.querySelector('form[id^="cashForm_"]');
            if (!form) {
                if (window.notificationManager) {
                    await window.notificationManager.notifyAction({
                        title: 'Form xətası',
                        message: 'Form tapılmadı.',
                        type: 'error',
                        sendToTelegramModule: 'cash',
                        forceAll: false // Obey matrix
                    });
                }
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            
            // Validate required fields
            if (!data.amount || !data.category || !data.description) {
                // Highlight fields
                const requiredFields = ['amount', 'category', 'description'];
                requiredFields.forEach(field => {
                    const input = form.querySelector(`[name="${field}"]`);
                    if (input && (!data[field] || data[field].toString().trim() === '')) {
                        input.style.borderColor = "#ef4444";
                        input.style.background = "#fee2e2";
                        // Add error message if not present
                        if (!input.parentElement.querySelector('.input-error-message')) {
                            const errorDiv = document.createElement('div');
                            errorDiv.className = "input-error-message";
                            let label = field === "amount" ? "Məbləği daxil edin" :
                                field === "category" ? "Kateqoriyanı seçin" :
                                field === "description" ? "Təsviri doldurun" : "Boş buraxmayın";
                            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${label}`;
                            input.parentElement.appendChild(errorDiv);
                        }
                    }
                });
                if (window.notificationManager) {
                    await window.notificationManager.notifyAction({
                        title: 'Məlumat xətası',
                        message: 'Bütün mütləq sahələri doldurun.',
                        type: 'error',
                        sendToTelegramModule: 'cash',
                        forceAll: false // Obey matrix
                    });
                }
                return;
            } else {
                form.querySelectorAll(".form-input, .form-select").forEach(input => {
                    input.style.borderColor = "";
                    input.style.background = "";
                });
                form.querySelectorAll(".input-error-message").forEach(el => el.remove());
            }

            if (data.category === "Maaş ödənişi" && !data.salaryRecipientId) {
                if (window.notificationManager) {
                    await window.notificationManager.notifyAction({
                        title: 'Məlumat xətası',
                        message: 'Maaş ödənişində mütləq maaş alan işçini seçməlisiniz.',
                        type: 'error',
                        sendToTelegramModule: 'cash',
                        forceAll: false // Obey matrix
                    });
                }
                return;
            }

            // Unset unused IDs
            if (data.category !== "Maaş ödənişi") {
                data.salaryRecipientId = null;
            }
            if (data.category !== "Rezervasiya ödənişi") {
                data.reservationId = null;
            }
            if (data.category !== "Təchizat alışı") {
                data.purchaseDocumentId = null;
            }

            data.amount = parseFloat(data.amount) || 0;
            
            // Unset salaryRecipientId if not a salary payment
            if (data.category !== "Maaş ödənişi") {
                data.salaryRecipientId = null;
            }
            
            if (transactionId) {
                // Add permission check for edit
                if (!window.authManager.hasPermission('cash', 'edit')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                // Update existing transaction
                data.id = transactionId; // Ensure ID is preserved
                await window.app.updateCashTransaction(transactionId, data);
            } else {
                // Add permission check for create based on type
                if (!window.authManager.hasPermission('cash', 'create')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                // Create new transaction
                await window.app.createCashTransaction(data);
            }

            // --- KEY PATCH: Immediately CLOSE modal after create or update! ---
            window.modalManager && window.modalManager.hideModal && window.modalManager.hideModal();

        } catch (error) {
            console.error('Error in cash form submit:', error);
            if (window.notificationManager) {
                await window.notificationManager.notifyAction({
                    title: 'Sistem xətası',
                    message: error.message || 'Kassa əməliyyatı zamanı xəta baş verdi.',
                    type: 'error',
                    sendToTelegramModule: 'cash',
                    forceAll: false // Obey matrix
                });
            }
        }
    }
}

// Ensure global availability
window.CashForm = CashForm;

// Initialize form instance immediately
window.cashForm = new CashForm();