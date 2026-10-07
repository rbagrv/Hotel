// Cash component with search and column filters in headers
class CashComponent {
    constructor() {
        if (typeof window !== 'undefined') {
            window.cashComponent = this;
        }
        this._prepared = null;
    }

    // Lets the main thread breathe between heavy chunks so the UI never freezes.
    _yield() {
        return new Promise(res => setTimeout(res, 0));
    }

    // Helper to get filter value from localStorage
    getFilter(key, defaultValue = '') {
        const storedValue = localStorage.getItem(`cashComponent_${key}`);
        // Treat explicit 'null'/'undefined' strings or actual null as default
        if (storedValue === null || storedValue === 'undefined' || storedValue === 'null') {
            return defaultValue;
        }
        return storedValue;
    }

    // Helper to set filter value in localStorage
    setFilter(key, value) {
        // Any filter change (other than page navigation) resets pagination to page 0
        if (key !== 'page') {
            localStorage.setItem('cashComponent_page', '0');
        }
        localStorage.setItem(`cashComponent_${key}`, value);
    }

    // Async, non-blocking render. Shows a loading placeholder immediately so the click handler returns
    // (menu closes, UI stays responsive), then computes everything in time-sliced chunks and fills the
    // content area. Results for the expensive dataset are cached so page changes / searches don't recompute.
    async renderAsync(data, container) {
        const allTransactions = data.cashTransactions || [];
        if (!container) return;

        // 1. Show loading only on the very first render; subsequent re-renders (search/page changes)
        // keep the existing content visible until the new one is ready, avoiding a flicker.
        const firstRender = !container.innerHTML.includes('cashTxTable');
        if (firstRender) {
            container.innerHTML = '<div class="loading">Kassa yüklənir...</div>';
        }
        await this._yield();

        // 2. Compute the expensive dataset once (cached by array reference).
        const prepared = await this._getPrepared(allTransactions);

        // 3. Filters (persisted).
        const searchVal = this.getFilter('searchVal');
        const typeVal = this.getFilter('typeVal');
        const accountVal = this.getFilter('accountVal');
        const categoryVal = this.getFilter('categoryVal');
        const staffVal = this.getFilter('staffVal');
        const dateVal = this.getFilter('dateVal');

        const staffOptions = Array.from(new Set((data.staff || []).map(s => s.name && s.id ? [s.id, s.name] : null).filter(Boolean)));
        const accountIds = ["main", "bank", "pos", "paypal"];
        const accountsMap = {
            main: "Əsas hesab",
            bank: "Bank hesabı",
            pos: "POS terminal",
            paypal: "PayPal hesabı"
        };

        // 4. Filter (time-sliced). Filtering preserves the pre-sorted order, so no re-sort is needed.
        const filtered = await this._filterChunked(prepared.sortedAll, {
            searchVal, typeVal, accountVal, categoryVal, staffVal, dateVal
        });

        // 5. Pagination: never render the whole dataset at once.
        const pageSize = 25;
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        let page = parseInt(localStorage.getItem('cashComponent_page') || '0', 10);
        if (isNaN(page) || page < 0) page = 0;
        if (page >= totalPages) page = totalPages - 1;
        localStorage.setItem('cashComponent_page', String(page));
        const startIdx = page * pageSize;
        const displayTransactions = filtered.slice(startIdx, startIdx + pageSize);

        // If the user navigated away while we were computing, do not overwrite the other module.
        if (window.app && window.app.currentModule !== 'cash') return;
        if (!container.isConnected) return;

        // Expose balances for renderTransactionRow (O(1) lookup).
        this.transactionBalances = prepared.balances;

        container.innerHTML = `
            ${this.renderTodayStats(prepared.todayIncome, prepared.todayExpense, prepared.todayBalance)}
            <div style="margin-top: 1.5rem;">
                <h3 class="table-title" style="margin-bottom: 1rem;">Hesablar üzrə Qalıqlar</h3>
                ${this.renderAccountBalancesCards(prepared.accounts)}
            </div>
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Kassa Əməliyyatları</h3>
                    <div style="display: flex; gap: 0.5rem;">
                        ${window.authManager.hasPermission('cash', 'create') ? `
                        <button class="btn btn-primary" onclick="if(window.modalManager&&window.modalManager.showCashForm) window.modalManager.showCashForm('income')">
                            <i class="fas fa-plus"></i> Gəlir Əlavə et
                        </button>
                        <button class="btn btn-secondary" onclick="if(window.modalManager&&window.modalManager.showCashForm) window.modalManager.showCashForm('expense')">
                            <i class="fas fa-minus"></i> Xərc Əlavə et
                        </button>
                        ` : ''}
                    </div>
                </div>
                <div style="overflow-x:auto;">
                <table class="data-table" id="cashTxTable">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th style="min-width: 150px;">
                                ID / Təsvir<br>
                                <input class="form-input" style="max-width:130px;" type="search" placeholder="ID, təsvir..." value="${searchVal}"
                                    id="cashSearchInput"
                                    oninput="this.value = this.value.replace(/[^0-9a-zA-Z-\s]/g, ''); window.cashComponent.setFilter('searchVal', this.value); window.app.loadModuleDebounced('cash');">
                            </th>
                            <th style="min-width: 120px;">
                                Tarix<br>
                                <input type="date" class="form-input" style="max-width:110px;" value="${dateVal}"
                                    onchange="window.cashComponent.setFilter('dateVal', this.value); window.app.loadModule('cash');">
                            </th>
                            <th style="min-width: 90px;">
                                Növ<br>
                                <select class="form-select" style="max-width:70px;" onchange="window.cashComponent.setFilter('typeVal', this.value); window.app.loadModule('cash');">
                                    <option value="">Hamısı</option>
                                    <option value="income" ${typeVal==='income'?'selected':''}>Gəlir</option>
                                    <option value="expense" ${typeVal==='expense'?'selected':''}>Xərc</option>
                                </select>
                            </th>
                            <th style="min-width: 120px;">
                                Hesab<br>
                                <select class="form-select" style="max-width:95px;" onchange="window.cashComponent.setFilter('accountVal', this.value); window.app.loadModule('cash');">
                                    <option value="">Hamısı</option>
                                    ${accountIds.map(aid => `<option value="${aid}" ${accountVal===aid?'selected':''}>${accountsMap[aid]}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 120px;">
                                Kateqoriya<br>
                                <select class="form-select" style="max-width:110px;" onchange="window.cashComponent.setFilter('categoryVal', this.value); window.app.loadModule('cash');">
                                    <option value="">Hamısı</option>
                                    ${prepared.categories.map(cat=>`<option value="${window.escapeHtml(cat)}" ${categoryVal===cat?'selected':''}>${window.escapeHtml(cat)}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 100px;">Məbləğ</th>
                            <th style="min-width: 100px;">
                                İcraçı<br>
                                <select class="form-select" style="max-width:100px;" onchange="window.cashComponent.setFilter('staffVal', this.value); window.app.loadModule('cash');">
                                    <option value="">Hamısı</option>
                                    ${staffOptions.map(([id, name]) => `<option value="${window.escapeHtml(id)}" ${staffVal===String(id)?'selected':''}>${window.escapeHtml(name)}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width:180px;">Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${displayTransactions.map((transaction, idx) => this.renderTransactionRow(transaction, data, (page * pageSize) + idx + 1)).join('')}
                    </tbody>
                </table>
                </div>
                <div style="margin:0.5em 0; color:#64748b;font-size:0.96em;">Əməliyyat sayı: <b>${filtered.length}</b></div>
                ${totalPages > 1 ? `
                  <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem; margin:1rem 0;">
                    <button class="btn btn-secondary" style="font-size:0.98em;" onclick="window.cashComponent.setFilter('page', '${Math.max(0, page - 1)}'); window.app.loadModule('cash');" ${page <= 0 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-left"></i> Əvvəlki
                    </button>
                    <span style="color:#64748b;font-size:0.96em;">Səhifə <b>${page + 1}</b> / ${totalPages}</span>
                    <button class="btn btn-secondary" style="font-size:0.98em;" onclick="window.cashComponent.setFilter('page', '${Math.min(totalPages - 1, page + 1)}'); window.app.loadModule('cash');" ${page >= totalPages - 1 ? 'disabled' : ''}>
                        Növbəti <i class="fas fa-chevron-right"></i>
                    </button>
                  </div>
                ` : ""}
                <button class="btn btn-secondary" style="margin-top:1em;" onclick="window.cashComponent.setFilter('searchVal', '');window.cashComponent.setFilter('typeVal', '');window.cashComponent.setFilter('accountVal', '');window.cashComponent.setFilter('categoryVal', '');window.cashComponent.setFilter('staffVal', '');window.cashComponent.setFilter('dateVal', '');window.app.loadModule('cash');">
                    <i class="fas fa-times"></i> Filtri sıfırla
                </button>
            </div>
        `;
    }

    // Loads (once, cached) the expensive derived data for the given transactions array.
    // Cache is keyed by the array reference: a data reload produces a new array and invalidates it.
    async _getPrepared(allTransactions) {
        if (this._prepared && this._prepared.txns === allTransactions) {
            return this._prepared;
        }

        // Newest-first sort (single pass; runs after the loading placeholder is already shown).
        const sortedAll = allTransactions.slice().sort((a, b) => {
            const dateA = a.createdAt || `${a.date}T${a.time || '00:00'}`;
            const dateB = b.createdAt || `${b.date}T${b.time || '00:00'}`;
            if (dateA > dateB) return -1;
            if (dateA < dateB) return 1;
            return 0;
        });

        const categories = Array.from(new Set(allTransactions.map(t => t.category).filter(Boolean)));

        const balances = await this._calculateBalancesChunked(sortedAll);
        const accounts = await this._calculateAccountStatsChunked(sortedAll);
        const today = await this._calculateTodayStatsChunked(sortedAll);

        this._prepared = {
            txns: allTransactions,
            sortedAll,
            categories,
            balances,
            accounts,
            todayIncome: today.income,
            todayExpense: today.expense,
            todayBalance: today.income - today.expense
        };
        return this._prepared;
    }

    // Time-sliced filter. Preserves the input (already sorted) order, so no re-sort is required.
    async _filterChunked(sortedAll, f) {
        const txt = (v) => (v || "").toLowerCase();
        const s = f.searchVal ? txt(f.searchVal) : '';
        const out = [];
        const chunk = 2000;
        for (let i = 0; i < sortedAll.length; i += chunk) {
            const end = Math.min(i + chunk, sortedAll.length);
            for (let j = i; j < end; j++) {
                const t = sortedAll[j];
                if (s &&
                    !(t.publicId && t.publicId.toLowerCase().includes(s)) &&
                    !(t.description && txt(t.description).includes(s)) &&
                    !(t.amount && String(t.amount).includes(s))) continue;
                if (f.typeVal !== '' && t.type !== f.typeVal) continue;
                if (f.accountVal !== '' && (t.accountId || "main") !== f.accountVal) continue;
                if (f.categoryVal !== '' && t.category !== f.categoryVal) continue;
                if (f.staffVal !== '' && String(t.staffId) !== f.staffVal) continue;
                if (f.dateVal !== '' && t.date !== f.dateVal) continue;
                out.push(t);
            }
            if (end < sortedAll.length) await this._yield();
        }
        return out;
    }

    // Running balances per account, computed in a single reverse pass (oldest-first) and time-sliced.
    async _calculateBalancesChunked(sortedAll) {
        const balanceMap = new Map();
        const running = {};
        const chunk = 2000;
        for (let i = sortedAll.length - 1; i >= 0; i -= chunk) {
            const start = Math.max(0, i - chunk + 1);
            for (let j = i; j >= start; j--) {
                const t = sortedAll[j];
                const accId = t.accountId || 'main';
                const amt = parseFloat(t.amount || 0);
                const sign = t.type === 'expense' ? -1 : 1;
                running[accId] = (running[accId] || 0) + sign * amt;
                balanceMap.set(t.id, running[accId]);
            }
            if (start > 0) await this._yield();
        }
        return balanceMap;
    }

    // Per-account income/expense totals + newest transaction, time-sliced (single pass).
    async _calculateAccountStatsChunked(sortedAll) {
        const stats = {
            main: { id: 'main', income: 0, expense: 0, lastTx: null, name: 'Əsas hesab', type: 'Nağd' },
            bank: { id: 'bank', income: 0, expense: 0, lastTx: null, name: 'Bank hesabı', type: 'Bank' },
            pos: { id: 'pos', income: 0, expense: 0, lastTx: null, name: 'POS terminal', type: 'Terminal' },
            paypal: { id: 'paypal', income: 0, expense: 0, lastTx: null, name: 'PayPal hesabı', type: 'Online' }
        };
        const chunk = 2000;
        for (let i = 0; i < sortedAll.length; i += chunk) {
            const end = Math.min(i + chunk, sortedAll.length);
            for (let j = i; j < end; j++) {
                const t = sortedAll[j];
                const acc = stats[t.accountId || 'main'] || stats.main;
                const amt = parseFloat(t.amount || 0);
                if (t.type === 'income') acc.income += amt;
                else if (t.type === 'expense') acc.expense += amt;
                // sortedAll is newest-first, so the first one seen is the newest for that account.
                if (!acc.lastTx) acc.lastTx = t;
            }
            if (end < sortedAll.length) await this._yield();
        }
        return Object.values(stats).map(s => {
            s.balance = s.income - s.expense; // expense stored as a positive amount
            return s;
        });
    }

    // Today's income/expense, time-sliced.
    async _calculateTodayStatsChunked(sortedAll) {
        const nowDate = new Date();
        const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
        let income = 0;
        let expense = 0;
        const chunk = 2000;
        for (let i = 0; i < sortedAll.length; i += chunk) {
            const end = Math.min(i + chunk, sortedAll.length);
            for (let j = i; j < end; j++) {
                const t = sortedAll[j];
                if (t.date === todayStr) {
                    const val = parseFloat(t.amount || 0);
                    if (t.type === 'income') income += val;
                    else if (t.type === 'expense') expense += val;
                }
            }
            if (end < sortedAll.length) await this._yield();
        }
        return { income, expense };
    }

    // Optimized Helper to calculate running balances for all transactions efficiently (O(N log N))
    calculateTransactionBalances(transactions) {
        const balanceMap = new Map();
        
        const accountGroups = {
            main: [],
            bank: [],
            pos: [],
            paypal: []
        };
        
        // Group by account (O(N))
        for (const t of transactions) {
            const accId = t.accountId || 'main';
            if (accountGroups[accId]) {
                accountGroups[accId].push(t);
            } else {
                accountGroups.main.push(t); // Default fallback
            }
        }
        
        // For each account, sort chronologically and compute running balance (O(N log N))
        Object.keys(accountGroups).forEach(accId => {
            const group = accountGroups[accId];
            group.sort((a, b) => {
                const dateA = a.createdAt || `${a.date}T${a.time || '00:00'}`;
                const dateB = b.createdAt || `${b.date}T${b.time || '00:00'}`;
                if (dateA < dateB) return -1;
                if (dateA > dateB) return 1;
                return 0;
            });
            
            let currentBalance = 0;
            for (const t of group) {
                const amt = parseFloat(t.amount || 0);
                if (t.type === 'income') currentBalance += amt;
                else if (t.type === 'expense') currentBalance -= amt;
                
                balanceMap.set(t.id, currentBalance);
            }
        });
        
        return balanceMap;
    }

    renderTransactionRow(transaction, data, rowIndex) {
        const staff = data.staff.find(s => s.id === transaction.staffId || s.firebaseUid === transaction.staffId);
        const safeId = transaction.id;
        const displayId = transaction.publicId || (window.app ? window.app.formatInternalId(transaction.id, 'KS') : transaction.id);

        let accountName = "Əsas hesab";
        let accountType = "Nağd";
        switch (transaction.accountId) {
            case "bank":
                accountName = "Bank hesabı";
                accountType = "Bank";
                break;
            case "pos":
                accountName = "POS terminal";
                accountType = "Terminal";
                break;
            case "paypal":
                accountName = "PayPal hesabı";
                accountType = "Online";
                break;
            default:
                accountName = "Əsas hesab";
                accountType = "Nağd";
        }
        
        // Retrieve pre-calculated balance from map (O(1)) instead of re-calculating (O(N))
        const rawBalance = this.transactionBalances.get(transaction.id) || 0;
        const accountBalance = rawBalance.toFixed(2);

        const formattedDate = (window.app && typeof window.app.formatDate === "function") ? window.app.formatDate(transaction.date) : (transaction.date || "");

        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${rowIndex || ''}</td>
                <td>
                    <strong>${window.escapeHtml(displayId)}</strong><br>
                    <span class="text-overflow-ellipsis" title="${window.escapeHtml(transaction.description)}">
                        ${window.escapeHtml((transaction.description || '').length > 30 ? ((transaction.description || '').substring(0, 27) + '…') : (transaction.description || ''))}
                    </span>
                </td>
                <td>
                    ${formattedDate} <br>
                    <small style="color:#64748b;">${window.escapeHtml(transaction.time || '')}</small>
                </td>
                <td>
                    <span class="status-badge status-${transaction.type === 'income' ? 'confirmed' : 'cancelled'}" 
                        title="${transaction.type === 'income' ? 'Gəlir' : 'Xərc'}">
                        <i class="fas fa-${transaction.type === 'income' ? 'arrow-up' : 'arrow-down'}"></i>
                        ${transaction.type === 'income' ? 'Gəlir' : 'Xərc'}
                    </span>
                </td>
                <td>
                    <span title="${window.escapeHtml(accountType)}">
                        <strong>${window.escapeHtml(accountName)}</strong>
                    </span>
                    <br><small style="color:#64748b;">${window.escapeHtml(accountType)}</small>
                    <br>
                    <small style="color:#10b981;">Qalıq: ₼${accountBalance}</small>
                </td>
                <td>
                    <span>${window.escapeHtml(transaction.category)}</span>
                </td>
                <td>
                    <strong style="color: ${transaction.type === 'income' ? '#10b981' : '#ef4444'};">
                        ${transaction.type === 'income' ? '+' : '-'}₼${(transaction.amount || 0).toFixed(2)}
                    </strong>
                </td>
                <td>
                    <span title="${window.escapeHtml(staff?.name || 'N/A')}">${window.escapeHtml(staff?.name?.split(' ')[0] || 'N/A')}</span>
                </td>
                <td style="width:120px;">
                    <div style="display: flex; gap: 0.23rem;">
                        <button class="btn btn-secondary" onclick="window.cashComponent && window.cashComponent.showTransactionDetails('${safeId}')" title="Ətraflı" style="padding:0.5rem;">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${window.authManager.hasPermission('cash', 'edit') ? `
                        <button class="btn btn-secondary" onclick="if(window.modalManager&&window.modalManager.showCashForm) window.modalManager.showCashForm('${transaction.type || ''}', '${safeId}')" title="Redaktə" style="padding:0.5rem;">
                            <i class="fas fa-edit"></i>
                        </button>
                        ` : ''}
                        ${window.authManager.hasPermission('cash', 'delete') ? `
                        <button class="btn btn-secondary" onclick="if(window.app&&window.app.deleteCashTransaction) window.app.deleteCashTransaction('${safeId}')" title="Sil" style="padding:0.5rem;">
                            <i class="fas fa-trash"></i>
                        </button>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="window.cashComponent && window.cashComponent.printTransaction('${safeId}')" title="Çap" style="padding:0.5rem;">
                            <i class="fas fa-print"></i>
                        </button>
                        <button class="btn btn-secondary" title="Şəkil kimi Telegram-a göndər" style="padding:0.5rem;"
                            onclick="window.notificationManager && window.notificationManager.sendCashTransactionScreenshotToTelegram('${safeId}')">
                            <i class="fas fa-image"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // Simple details popup using modalManager (extends functionality)
    showTransactionDetails(transactionId) {
        try {
            const transaction = window.app?.data?.cashTransactions.find(t => String(t.id) === String(transactionId));
            if (!transaction) {
                window.notificationManager?.showNotification('error', 'Xəta', 'Əməliyyat tapılmadı');
                return;
            }
            const displayId = transaction.publicId || (window.app ? window.app.formatInternalId(transaction.id, 'KS') : transaction.id);
            const staff = window.app?.data?.staff?.find(s => s.id === transaction.staffId || s.firebaseUid === transaction.staffId);
            let accountName = "Əsas hesab";
            let accountType = "Nağd";
            switch (transaction.accountId) {
                case "bank": accountName = "Bank hesabı"; accountType = "Bank"; break;
                case "pos": accountName = "POS terminal"; accountType = "Terminal"; break;
                case "paypal": accountName = "PayPal hesabı"; accountType = "Online"; break;
                default: accountName = "Əsas hesab"; accountType = "Nağd";
            }
            let salaryInfo = '';
            if (transaction.category === "Maaş ödənişi" && transaction.salaryRecipientId && window.app?.data?.staff) {
                const receiver = window.app.data.staff.find(s => s.id === transaction.salaryRecipientId || s.firebaseUid === transaction.salaryRecipientId);
                if (receiver) {
                    salaryInfo = `<div><strong>Maaş alan:</strong> ${window.escapeHtml(receiver.name)} (${window.escapeHtml(receiver.position || '')})</div>`;
                }
            }
            let reservationInfo = '';
            if (transaction.reservationId && window.app?.data?.reservations) {
                const reservation = window.app.data.reservations.find(r => r.id === transaction.reservationId);
                if (reservation) {
                    const guest = window.app.data.guests.find(g => g.id === reservation.guestId);
                    const resPublicId = reservation.publicId || (window.app ? window.app.formatInternalId(reservation.id, 'RZ') : reservation.id);
                    reservationInfo = `<div><strong>Rezervasiya:</strong> ${window.escapeHtml(resPublicId)} (${window.escapeHtml(guest?.name || 'N/A')})<br>Gecə:${window.escapeHtml(reservation.nights)}, Böyük:${window.escapeHtml(reservation.adults)}, Uşaq:${window.escapeHtml(reservation.children)}</div>`;
                }
            }
            let purchaseDocInfo = '';
            if (transaction.purchaseDocumentId && window.app?.data?.purchaseDocuments) {
                const purchaseDoc = window.app.data.purchaseDocuments.find(d => d.id === transaction.purchaseDocumentId);
                if (purchaseDoc) {
                    const docPublicId = purchaseDoc.publicId || (window.app ? window.app.formatInternalId(purchaseDoc.id, 'AS') : purchaseDoc.id);
                    purchaseDocInfo = `<div><strong>Alış Sənədi:</strong> ${window.escapeHtml(docPublicId)} (${window.escapeHtml(purchaseDoc.supplierName || 'N/A')})<br>№: ${window.escapeHtml(purchaseDoc.documentNumber || 'N/A')}, Məbləğ: ₼${(purchaseDoc.totalAmount || 0).toFixed(2)}</div>`;
                }
            }

            const amountStr = `${transaction.type === 'income' ? '+' : '-'}₼${(transaction.amount || 0).toFixed(2)}`;
            const formattedDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate(transaction.date) : (transaction.date || "");

            const printBtn = `
                <button class="btn btn-primary" onclick="window.cashComponent && window.cashComponent.printTransaction('${transactionId}')">
                    <i class="fas fa-print"></i> Çap et
                </button>
            `;
            const modalContent = `
                <div class="reservation-details">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
                        <div class="detail-section">
                            <h4 style="margin: 0 0 1rem 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">
                                <i class="fas fa-info-circle"></i> Əsas Məlumatlar
                            </h4>
                            <div class="detail-grid">
                                <div><strong>ID:</strong> ${displayId}</div>
                                <div><strong>Tarix:</strong> ${formattedDate} ${transaction.time || ''}</div>
                                <div><strong>Növ:</strong> <span style="font-weight:700; color:${transaction.type === 'income' ? '#10b981' : '#ef4444'};">${transaction.type === 'income' ? 'Gəlir' : 'Xərc'}</span></div>
                                <div><strong>Məbləğ:</strong> 
                                    <span style="color:${transaction.type === 'income' ? '#10b981' : '#ef4444'};font-weight:700;">
                                        ${amountStr}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="detail-section">
                            <h4 style="margin: 0 0 1rem 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">
                                <i class="fas fa-tags"></i> Təsnifat
                            </h4>
                            <div class="detail-grid">
                                <div><strong>Kateqoriya:</strong> ${window.escapeHtml(transaction.category)}</div>
                                <div><strong>Hesab:</strong> ${window.escapeHtml(accountName)} (${window.escapeHtml(accountType)})</div>
                                <div><strong>İcraçı:</strong> ${staff ? window.escapeHtml(staff.name) : 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                    <div class="detail-section" style="margin-top: 1.5rem;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem;">
                            <i class="fas fa-file-alt"></i> Təsvir və Əlaqəli Sənədlər
                        </h4>
                        <div class="detail-grid">
                            <div style="grid-column: 1/-1;"><strong>Təsvir:</strong> ${transaction.description}</div>
                            ${salaryInfo ? `<div style="grid-column: 1/-1;">${salaryInfo}</div>` : ''}
                            ${reservationInfo ? `<div style="grid-column: 1/-1;">${reservationInfo}</div>` : ''}
                            ${purchaseDocInfo ? `<div style="grid-column: 1/-1;">${purchaseDocInfo}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
            window.modalManager.showModal('Kassa Əməliyyatı', modalContent, `
                <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
                ${printBtn}
            `);
        } catch (e) {
            window.notificationManager?.showNotification('error', 'Xəta', 'Əməliyyat detalları göstərilmədi');
        }
    }

    // NEW: Official print layout for cash orders (income/expense) per instruction
    printTransaction(transactionId) {
        // === PATCHED: Print order with amount in words and cashier's full name ===
        const transaction = window.app?.data?.cashTransactions.find(t => String(t.id) === String(transactionId));
        if (!transaction) {
            window.notificationManager?.showNotification('error', 'Xəta', 'Əməliyyat tapılmadı');
            return;
        }
        const displayId = transaction.publicId || (window.app ? window.app.formatInternalId(transaction.id, 'KS') : transaction.id);
        // Find staff FULL name for icraçı (kassir) by staffId
        const staff = window.app?.data?.staff?.find(s => s.id === transaction.staffId || s.firebaseUid === transaction.staffId);
        const cashierName = staff ? staff.name : '-';

        let accountName = "Əsas hesab";
        let accountType = "Nağd";
        switch (transaction.accountId) {
            case "bank": accountName = "Bank hesabı"; accountType = "Bank"; break;
            case "pos": accountName = "POS terminal"; accountType = "Terminal"; break;
            case "paypal": accountName = "PayPal hesabı"; accountType = "Online"; break;
            default: accountName = "Əsas hesab"; accountType = "Nağd";
        }
        let salaryInfo = '';
        if (transaction.category === "Maaş ödənişi" && transaction.salaryRecipientId && window.app?.data?.staff) {
            const receiver = window.app.data.staff.find(s => s.id === transaction.salaryRecipientId || s.firebaseUid === transaction.salaryRecipientId);
            if (receiver) {
                salaryInfo = `<tr><td style="padding:2px 5px;"><strong>Maaş alan (Alıcı):</strong></td><td>${window.escapeHtml(receiver.name)} (${window.escapeHtml(receiver.position || '')})</td></tr>`;
            }
        }
        let reservationInfo = '';
        if (transaction.reservationId && window.app?.data?.reservations) {
            const reservation = window.app.data.reservations.find(r => r.id === transaction.reservationId);
            if (reservation) {
                const guest = window.app.data.guests.find(g => g.id === reservation.guestId);
                const resPublicId = reservation.publicId || (window.app ? window.app.formatInternalId(reservation.id, 'RZ') : reservation.id);
                reservationInfo = `<tr><td style="padding:2px 5px;"><strong>Rezervasiya:</strong></td><td>${window.escapeHtml(resPublicId)} (${window.escapeHtml(guest?.name || 'N/A')})<br>Gecə:${window.escapeHtml(reservation.nights)}, Böyük:${window.escapeHtml(reservation.adults)}, Uşaq:${window.escapeHtml(reservation.children)}</td></tr>`;
            }
        }
        const now = new Date();
        const orderType = transaction.type === 'income' ? 'Kassa Mədaxil Orderi' : 'Kassa Məxaric Orderi';
        const hotelInfo = window.app?.getHotelInfo?.() || {};
        const amountStr = `₼${(transaction.amount || 0).toFixed(2)}`;
        // Convert amount to words in AZ/Numeric ("₼123.45" -> "Yüz iyirmi üç manat qırx beş qəpik")
        const amountInWords = window.app.amountToWordsAz ? window.app.amountToWordsAz(transaction.amount || 0) : '';
        const amountDetails = `
            <div style="border: 1px dashed #8b5cf6; background:#f8fafc; border-radius:0.5em; padding:8px 14px; margin:11px 0 0 0; font-size: 1.12em;">
                <strong>Yazı ilə:</strong> <span style="color:#4f46e5;">${amountInWords || ''}</span>
            </div>
        `;
        // Kassa orderində icraçının adı tam şəkildə "kassirin adı və soyadı" kimi göstərilir
        // formda: Gəlir üçün Qəbul edən (Kassir): kassirin adı, xərclər üçün Verən (Vəsait gönd. şəxs): kassirin adı
        const signaturesTable = `
                <table class="signatures">
                    <tr>
                        <td class="center">${orderType === 'Kassa Mədaxil Orderi' ? 'Qəbul edən (Kassir)' : 'Verən (Vəsait gönd. şəxs)'}</td>
                        <td class="center">${orderType === 'Kassa Mədaxil Orderi' ? 'Verən (Vəsait alan şəxs)' : 'Alan (Vəsait alan şəxs)'}</td>
                        <td class="center">Baş Mühasib</td>
                        <td class="center">Direktor</td>
                    </tr>
                    <tr>
                        <td class="center" style="height:40px;vertical-align:bottom;">${cashierName}</td>
                        <td class="center"></td>
                        <td class="center"></td>
                        <td class="center"></td>
                    </tr>
                    <tr>
                        <td class="center">(imza)</td>
                        <td class="center">(imza)</td>
                        <td class="center">(imza)</td>
                        <td class="center">(imza)</td>
                    </tr>
                </table>
        `;

        const formattedDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate(transaction.date) : (transaction.date || "");

        const printHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${orderType}</title>
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; margin:0; padding:20px; color:#222; }
                    .print-header { text-align:center; margin-bottom:18px; }
                    .hotel-title { font-size:18px; color:#3b82f6; font-weight:600; }
                    .print-details { font-size:12px; color:#64748b; line-height:1.4; margin-top:5px; }
                    .print-table { width:100%; border-collapse:collapse; margin:15px 0; }
                    .print-table th, .print-table td { border:1px solid #b3b3b3; padding:7px; font-size:12px; }
                    .print-table th { background:#edf2fa; }
                    .main-title {font-size:17px;font-weight:800;margin:12px 0 20px 0;text-transform:uppercase;color:#2d2c3e;letter-spacing:1px;}
                    .right { text-align:right; }
                    .left { text-align:left; }
                    .center { text-align:center; }
                    .print-footer {margin-top:30px; font-size:13px;}
                    .signatures { margin-top:30px; width:100%; }
                    .signatures td { padding: 18px 10px 2px 10px; vertical-align: bottom; }
                    .order-no { float:right; font-size:12px; color:#64748b; margin-top:6px;}
                    @media print {.no-print {display:none;}}
                </style>
            </head>
            <body>
                <div class="print-header">
                    <div class="hotel-title">${hotelInfo.hotelName || "RB Hotel PMS"}</div>
                    <div class="print-details">
                        ${hotelInfo.address ? `Ünvan: ${hotelInfo.address}` : ''}
                        ${hotelInfo.phone ? ` | Tel: ${hotelInfo.phone}` : ''}
                        ${hotelInfo.email ? ` | Email: ${hotelInfo.email}` : ''}
                    </div>
                    <div class="main-title">${orderType}</div>
                    <div style="font-size:13px;color:#374151;">Tarix: ${formattedDate}, Saat: ${transaction.time || ''} <span class="order-no">№ ${displayId}</span></div>
                </div>
                <table class="print-table">
                    <tr>
                        <th class="left" style="width:40%;">${orderType === 'Kassa Mədaxil Orderi' ? 'Pulun qəbul edilməsi səbəbi' : 'Pulun verilməsi səbəbi'}</th>
                        <td>${transaction.description || '-'}</td>
                    </tr>
                    <tr>
                        <th class="left">Hesab / Növ</th>
                        <td>${accountName} (${accountType})</td>
                    </tr>
                    <tr>
                        <th class="left">Kateqoriya</th>
                        <td>${transaction.category || '-'}</td>
                    </tr>
                    <tr>
                        <th class="left">Məbləğ</th>
                        <td style="font-size:1.18em;font-weight:700;color:${transaction.type==='income'?'#10b981':'#ef4444'};">${amountStr}</td>
                    </tr>
                    ${salaryInfo}
                    ${reservationInfo}
                </table>
                ${amountDetails}
                ${signaturesTable}
                <div class="print-footer">
                    <span style="color:#64748b;">${orderType}</span> 
                    sistemi ilə hazırlanmışdır (<b>RB Hotel PMS</b>) &copy; ${new Date().getFullYear()}
                </div>
                <div class="no-print" style="text-align: center; margin-top: 20px;">
                    <button onclick="window.print()" style="padding:9px 18px;border-radius:7px;background:#3b82f6;color:white;border:none;font-size:1em;">Çap et</button>
                    <button onclick="window.close()" style="padding:9px 18px;border-radius:7px;margin-left:10px;background:#64748b;color:white;border:none;font-size:1em;">Bağla</button>
                </div>
                <script>window.onload = () => { setTimeout(()=>{window.print()},500); }</script>
            </body>
            </html>
        `;
        if (typeof window.printHtmlViaHiddenIframe === 'function') {
            window.printHtmlViaHiddenIframe(printHTML);
        } else {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(printHTML);
                printWindow.document.close();
            } else {
                window.notificationManager?.showNotification('error', 'Xəta', 'Çap pəncərəsi açıla bilmədi.');
            }
        }
    }

    getAccountBalances(transactions) {
        // Optimized O(N) single-pass calculation
        const stats = {
            main: { id: 'main', income: 0, expense: 0, lastTx: null, name: 'Əsas hesab', type: 'Nağd' },
            bank: { id: 'bank', income: 0, expense: 0, lastTx: null, name: 'Bank hesabı', type: 'Bank' },
            pos: { id: 'pos', income: 0, expense: 0, lastTx: null, name: 'POS terminal', type: 'Terminal' },
            paypal: { id: 'paypal', income: 0, expense: 0, lastTx: null, name: 'PayPal hesabı', type: 'Online' }
        };

        for (const t of transactions) {
            const accId = t.accountId || 'main';
            const acc = stats[accId] || stats.main; // Default to main if unknown
            
            const amt = parseFloat(t.amount || 0);
            if (t.type === 'income') acc.income += amt;
            else if (t.type === 'expense') acc.expense += amt;
            
            // Track last transaction (newest) - compare ISO strings directly
            const tDate = t.createdAt || `${t.date}T${t.time || '00:00'}`;
            const currentLastDate = acc.lastTx ? (acc.lastTx.createdAt || `${acc.lastTx.date}T${acc.lastTx.time || '00:00'}`) : '';
            
            if (!acc.lastTx || tDate > currentLastDate) {
                acc.lastTx = t;
            }
        }
        
        return Object.values(stats).map(s => {
            s.balance = s.income - s.expense;
            let lastTransactionDateFormatted = null;
            if (s.lastTx) {
                lastTransactionDateFormatted = window.app && typeof window.app.formatDate === "function" 
                    ? window.app.formatDate(s.lastTx.date) 
                    : s.lastTx.date || "";
                s.lastTransaction = `${lastTransactionDateFormatted} ${s.lastTx.time}`;
            } else {
                s.lastTransaction = null;
            }
            return s;
        });
    }

    renderTodayStats(todayIncome, todayExpense, todayBalance) {
        return `
            <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <div class="stat-card">
                    <div class="stat-card-header">
                        <div class="stat-card-title">Bugünkü Gəlir</div>
                        <div class="stat-card-icon" style="background-color: #10b981;">
                            <i class="fas fa-arrow-up"></i>
                        </div>
                    </div>
                    <div class="stat-card-value">₼${(todayIncome || 0).toFixed(2)}</div>
                    <div class="stat-card-change positive">Bu gün</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header">
                        <div class="stat-card-title">Bugünkü Xərc</div>
                        <div class="stat-card-icon" style="background-color: #ef4444;">
                            <i class="fas fa-arrow-down"></i>
                        </div>
                    </div>
                    <div class="stat-card-value">₼${(todayExpense || 0).toFixed(2)}</div>
                    <div class="stat-card-change negative">Bu gün</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header">
                        <div class="stat-card-title">Bugünkü Balans</div>
                        <div class="stat-card-icon" style="background-color: #3b82f6;">
                            <i class="fas fa-balance-scale"></i>
                        </div>
                    </div>
                    <div class="stat-card-value">₼${(todayBalance || 0).toFixed(2)}</div>
                    <div class="stat-card-change ${todayBalance >= 0 ? 'positive' : 'negative'}">Bu gün</div>
                </div>
            </div>
        `;
    }

    renderAccountBalancesCards(accounts) {
        const accountIcons = {
            main: 'fa-wallet',
            bank: 'fa-university',
            pos: 'fa-credit-card',
            paypal: 'fa-paypal'
        };
        const accountColors = {
            main: '#3b82f6',
            bank: '#8b5cf6',
            pos: '#10b981',
            paypal: '#0ea5e9'
        };

        return `
            <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
                ${accounts.map(account => `
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-title">${account.name}</div>
                            <div class="stat-card-icon" style="background-color: ${accountColors[account.id] || '#64748b'};">
                                <i class="fas ${accountIcons[account.id] || 'fa-question-circle'}"></i>
                            </div>
                        </div>
                        <div class="stat-card-value" style="color: ${account.balance >= 0 ? 'var(--text-color)' : 'var(--danger-color)'};">
                            ₼${(account.balance || 0).toFixed(2)}
                        </div>
                        <div class="stat-card-change">
                            <span class="positive" style="margin-right: 0.5rem;"><i class="fas fa-arrow-up"></i> ₼${(account.income || 0).toFixed(2)}</span>
                            <span class="negative"><i class="fas fa-arrow-down"></i> ₼${(account.expense || 0).toFixed(2)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

// Ensure global availability
window.CashComponent = CashComponent;
export default CashComponent;