// reports-component.js
export default class ReportsComponent {
    constructor() {
        // Initialize active tab for reports
        if (localStorage.getItem('reportsComponent_activeTab') === null) {
            localStorage.setItem('reportsComponent_activeTab', 'financial');
        }
        // Initialize default date filters for reports (current month)
        if (localStorage.getItem('reportsComponent_filterDates') === null) {
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
            localStorage.setItem('reportsComponent_filterDates', JSON.stringify({
                startDate: firstDayOfMonth,
                endDate: lastDayOfMonth
            }));
        }
        // Initialize staff selections for handover report
        if (localStorage.getItem('reportsComponent_handoverStaffSelection') === null) {
            localStorage.setItem('reportsComponent_handoverStaffSelection', JSON.stringify({
                recipientId: '',
                managerId: ''
            }));
        }
    }

    render(data) {
        const activeTab = localStorage.getItem('reportsComponent_activeTab') || 'financial';

        // Determine if on mobile for responsive rendering
        const isMobile = window.innerWidth <= 800;

        // NEW: Add a unique ID to the container for event delegation
        const componentId = `reportsComponent_${Date.now()}`;

        // Defer attachment of event listeners until after the DOM is rendered
        setTimeout(() => {
            this.attachEventListeners(componentId);
        }, 0);

        // Executive KPI Metrics Calculation
        const transactions = data?.cashTransactions || [];
        const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const netProfit = totalIncome - totalExpense;

        const rooms = data?.rooms || [];
        const totalRooms = rooms.length;
        const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
        const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

        return `
            <div class="reports-container table-container" id="${componentId}">
                <div class="table-header">
                    <h3 class="table-title">Hesabatlar və Analitika Paneli</h3>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn btn-secondary" onclick="window.reportsComponent.showReportModal('daily_cash_flow', 'Günlük Kassa Hərəkəti')">
                            <i class="fas fa-chart-line"></i> Kassa Hesabatı
                        </button>
                        <button class="btn btn-primary" onclick="window.reportsComponent.showReportModal('profit_loss', 'Mənfəət və Zərər')">
                            <i class="fas fa-balance-scale"></i> Mənfəət/Zərər
                        </button>
                    </div>
                </div>

                <!-- Executive Summary KPI Cards -->
                <div class="reports-kpi-summary" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:1rem;margin:1rem 0 1.5rem 0;">
                    <div style="background:var(--card-bg, #fff);border:1px solid var(--border-color, #e2e8f0);border-radius:12px;padding:1.1rem;box-shadow:0 1px 3px rgba(0,0,0,0.04);display:flex;align-items:center;gap:0.9rem;">
                        <div style="width:46px;height:46px;border-radius:10px;background:rgba(16,185,129,0.12);color:#10b981;display:flex;align-items:center;justify-content:center;font-size:20px;">
                            <i class="fas fa-arrow-down"></i>
                        </div>
                        <div>
                            <div style="font-size:0.82em;color:#64748b;font-weight:500;">Ümumi Gəlir</div>
                            <div style="font-size:1.3em;font-weight:700;color:#10b981;">₼${totalIncome.toFixed(2)}</div>
                        </div>
                    </div>

                    <div style="background:var(--card-bg, #fff);border:1px solid var(--border-color, #e2e8f0);border-radius:12px;padding:1.1rem;box-shadow:0 1px 3px rgba(0,0,0,0.04);display:flex;align-items:center;gap:0.9rem;">
                        <div style="width:46px;height:46px;border-radius:10px;background:rgba(239,68,68,0.12);color:#ef4444;display:flex;align-items:center;justify-content:center;font-size:20px;">
                            <i class="fas fa-arrow-up"></i>
                        </div>
                        <div>
                            <div style="font-size:0.82em;color:#64748b;font-weight:500;">Ümumi Xərc</div>
                            <div style="font-size:1.3em;font-weight:700;color:#ef4444;">₼${totalExpense.toFixed(2)}</div>
                        </div>
                    </div>

                    <div style="background:var(--card-bg, #fff);border:1px solid var(--border-color, #e2e8f0);border-radius:12px;padding:1.1rem;box-shadow:0 1px 3px rgba(0,0,0,0.04);display:flex;align-items:center;gap:0.9rem;">
                        <div style="width:46px;height:46px;border-radius:10px;background:rgba(59,130,246,0.12);color:#3b82f6;display:flex;align-items:center;justify-content:center;font-size:20px;">
                            <i class="fas fa-wallet"></i>
                        </div>
                        <div>
                            <div style="font-size:0.82em;color:#64748b;font-weight:500;">Xalis Balans</div>
                            <div style="font-size:1.3em;font-weight:700;color:${netProfit >= 0 ? '#10b981' : '#ef4444'};">₼${netProfit.toFixed(2)}</div>
                        </div>
                    </div>

                    <div style="background:var(--card-bg, #fff);border:1px solid var(--border-color, #e2e8f0);border-radius:12px;padding:1.1rem;box-shadow:0 1px 3px rgba(0,0,0,0.04);display:flex;align-items:center;gap:0.9rem;">
                        <div style="width:46px;height:46px;border-radius:10px;background:rgba(245,158,11,0.12);color:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:20px;">
                            <i class="fas fa-bed"></i>
                        </div>
                        <div>
                            <div style="font-size:0.82em;color:#64748b;font-weight:500;">Otaq Doluluğu</div>
                            <div style="font-size:1.3em;font-weight:700;color:#f59e0b;">${occupancyRate}% <small style="font-size:0.7em;font-weight:normal;color:#64748b;">(${occupiedRooms}/${totalRooms})</small></div>
                        </div>
                    </div>
                </div>
                
                <div class="reports-nav">
                    <div class="report-category-links">
                        <button class="report-nav-btn ${activeTab === 'financial' ? 'active' : ''}" data-tab="financial">
                            <i class="fas fa-money-bill-wave"></i> Maliyyə Hesabatları
                        </button>
                        <button class="report-nav-btn ${activeTab === 'operational' ? 'active' : ''}" data-tab="operational">
                            <i class="fas fa-cogs"></i> Operativ Hesabatlar
                        </button>
                        <button class="report-nav-btn ${activeTab === 'guests' ? 'active' : ''}" data-tab="guests">
                            <i class="fas fa-users"></i> Qonaq Hesabatları
                        </button>
                        <button class="report-nav-btn ${activeTab === 'rooms' ? 'active' : ''}" data-tab="rooms">
                            <i class="fas fa-bed"></i> Otaq Hesabatları
                        </button>
                    </div>
                </div>

                <div class="reports-content">
                    ${this.renderContentForTab(activeTab, data)}
                </div>
            </div>
        `;
    }

    // NEW: Attach event listeners programmatically
    attachEventListeners(componentId) {
        const componentElement = document.getElementById(componentId);
        if (!componentElement) return;

        // Event listener for tab buttons
        componentElement.querySelectorAll('.report-nav-btn').forEach(button => {
            // Remove existing listeners to prevent duplicates
            if (button._eventListener) {
                button.removeEventListener('click', button._eventListener);
            }
            const listener = (event) => {
                this.setActiveTab(event.currentTarget.dataset.tab);
            };
            button.addEventListener('click', listener);
            button._eventListener = listener; // Store reference to listener
        });

        // NEW: Attach event listeners for report cards
        componentElement.querySelectorAll('.report-card').forEach(card => {
            // Remove existing listeners to prevent duplicates
            if (card._eventListener) {
                card.removeEventListener('click', card._eventListener);
            }
            const listener = (event) => {
                const reportType = event.currentTarget.dataset.reportType;
                const reportTitle = event.currentTarget.dataset.reportTitle;

                if (reportType === 'shift_handover') {
                    this.showShiftHandoverReportModal();
                } else if (reportType === 'payroll_calculation') {
                    this.showPayrollCalculationModal();
                } else {
                    this.showReportModal(reportType, reportTitle);
                }
            };
            card.addEventListener('click', listener);
            card._eventListener = listener; // Store reference to listener
        });
    }

    setActiveTab(tabName) {
        localStorage.setItem('reportsComponent_activeTab', tabName);
        window.app.loadModule('reports'); // Re-render the module to show new tab content
    }

    renderContentForTab(tab, data) {
        switch (tab) {
            case 'financial':
                return this.renderFinancialReports(data);
            case 'operational':
                return this.renderOperationalReports(data);
            case 'guests':
                return this.renderGuestReports(data);
            case 'rooms':
                return this.renderRoomReports(data);
            default:
                return `<div style="padding: 2rem; text-align: center; color: var(--text-light);">
                            <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                            <p>Hesabat növü seçin.</p>
                        </div>`;
        }
    }

    renderFinancialReports(data) {
        return `
            <div class="report-section">
                <h4>Maliyyə Hesabatları</h4>
                <div class="report-grid">
                    <div class="report-card" data-report-type="daily_cash_flow" data-report-title="Günlük Kassa Hərəkəti Hesabatı">
                        <i class="fas fa-chart-line report-icon financial"></i>
                        <h5>Günlük Kassa Hərəkəti Hesabatı</h5>
                        <p>Hər gün üçün gəlir və xərcləri göstərir.</p>
                    </div>
                    <div class="report-card" data-report-type="profit_loss" data-report-title="Mənfəət və Zərər Hesabatı">
                        <i class="fas fa-balance-scale report-icon financial"></i>
                        <h5>Mənfəət və Zərər Hesabatı</h5>
                        <p>Dövr üzrə ümumi gəlir və xərclər, yekun mənfəət/zərər.</p>
                    </div>
                    <div class="report-card" data-report-type="revenue_by_source" data-report-title="Mənbəyə Görə Gəlir Hesabatı">
                        <i class="fas fa-chart-pie report-icon financial"></i>
                        <h5>Mənbəyə Görə Gəlir Hesabatı</h5>
                        <p>Gəlirləri rezervasiya mənbəyinə görə təhlil edir.</p>
                    </div>
                    <div class="report-card" data-report-type="expense_by_category" data-report-title="Kateqoriyaya Görə Xərc Hesabatı">
                        <i class="fas fa-money-bill-alt report-icon financial"></i>
                        <h5>Kateqoriyaya Görə Xərc Hesabatı</h5>
                        <p>Xərcləri kateqoriyalar üzrə təhlil edir.</p>
                    </div>
                    <div class="report-card" data-report-type="commission_report" data-report-title="Komissiya Hesabatı">
                        <i class="fas fa-hand-holding-usd report-icon financial"></i>
                        <h5>Komissiya Hesabatı</h5>
                        <p>Online rezervasiyalardan ödənilən komissiyaları göstərir.</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderOperationalReports(data) {
        return `
            <div class="report-section">
                <h4>Operativ Hesabatlar</h4>
                <div class="report-grid">
                    <div class="report-card" data-report-type="inventory_status" data-report-title="Anbar Vəziyyəti Hesabatı">
                        <i class="fas fa-boxes report-icon operational"></i>
                        <h5>Anbar Vəziyyəti Hesabatı</h5>
                        <p>Mövcud anbar qalıqları və minimum hədləri.</p>
                    </div>
                    <div class="report-card" data-report-type="maintenance_overview" data-report-title="Təmir/Təmizlik İcmalı Hesabatı">
                        <i class="fas fa-tools report-icon operational"></i>
                        <h5>Təmir/Təmizlik İcmalı Hesabatı</h5>
                        <p>Tamamlanmış və gözləyən tapşırıqlar.</p>
                    </div>
                    <div class="report-card" data-report-type="staff_performance" data-report-title="İşçi Performansı Hesabatı">
                        <i class="fas fa-user-tie report-icon operational"></i>
                        <h5>İşçi Performansı Hesabatı</h5>
                        <p>İşçilərin fəaliyyət statistikası.</p>
                    </div>
                    <div class="report-card" data-report-type="shift_handover" data-report-title="Növbə Təhvil-Təslimi Hesabatı">
                        <i class="fas fa-handshake report-icon operational"></i>
                        <h5>Növbə Təhvil-Təslimi Hesabatı</h5>
                        <p>Növbə dəyişmə zamanı ümumi vəziyyət hesabatı.</p>
                    </div>
                    <div class="report-card" data-report-type="payroll_calculation" data-report-title="Əmək haqqı hesablanması">
                        <i class="fas fa-money-check-alt report-icon operational"></i>
                        <h5>Əmək haqqı hesablanması</h5>
                        <p>İşçilərin əmək haqqı, bonus və kəsilmələr üzrə hesablanması.</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderGuestReports(data) {
        return `
            <div class="report-section">
                <h4>Qonaq Hesabatları</h4>
                <div class="report-grid">
                    <div class="report-card" data-report-type="guest_demographics" data-report-title="Qonaq Demoqrafiyası Hesabatı">
                        <i class="fas fa-globe report-icon guests"></i>
                        <h5>Qonaq Demoqrafiyası Hesabatı</h5>
                        <p>Qonaqların milliyyəti və cinsinə görə paylanması.</p>
                    </div>
                    <div class="report-card" data-report-type="loyal_guests" data-report-title="Loyal Qonaqlar Hesabatı">
                        <i class="fas fa-star report-icon guests"></i>
                        <h5>Loyal Qonaqlar Hesabatı</h5>
                        <p>Təkrar rezervasiya edən qonaqların siyahısı.</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderRoomReports(data) {
        return `
            <div class="report-section">
                <h4>Otaq Hesabatları</h4>
                <div class="report-grid">
                    <div class="report-card" data-report-type="occupancy_rate" data-report-title="Doluluq Faizi Hesabatı">
                        <i class="fas fa-chart-area report-icon rooms"></i>
                        <h5>Doluluq Faizi Hesabatı</h5>
                        <p>Müəyyən edilmiş dövr üzrə otaq doluluğu faizi.</p>
                    </div>
                    <div class="report-card" data-report-type="room_type_performance" data-report-title="Otaq Tipi Performansı Hesabatı">
                        <i class="fas fa-hotel report-icon rooms"></i>
                        <h5>Otaq Tipi Performansı Hesabatı</h5>
                        <p>Otaq tiplərinin gəlir gətirmə qabiliyyəti.</p>
                    </div>
                </div>
            </div>
        `;
    }

    // New function to update the report content in the modal without re-opening it
    updateReportModalContent(reportType, reportTitle) {
        const data = window.app.data;
        const reportContentDiv = document.getElementById('reportModalContent');
        if (!reportContentDiv) return;

        let content;
        const reportBodyDiv = reportContentDiv.querySelector('.report-body');
        if (!reportBodyDiv) return; // Should always exist after showReportModal

        if (reportType === 'shift_handover') {
            const handoverRecipientSelect = document.getElementById('handoverRecipientSelect');
            const managerSignatureSelect = document.getElementById('managerSignatureSelect');
            
            const giverId = window.authManager?.getCurrentUser()?.uid || window.authManager?.getCurrentUser()?.email;
            const recipientId = handoverRecipientSelect?.value || '';
            const managerId = managerSignatureSelect?.value || '';

            // Store selected IDs globally
            localStorage.setItem('reportsComponent_handoverStaffSelection', JSON.stringify({ recipientId, managerId }));
            
            content = this.generateShiftHandoverReport(data, giverId, recipientId, managerId);
        } else {
            const startDate = document.getElementById('reportStartDate')?.value;
            const endDate = document.getElementById('reportEndDate')?.value;
            // Update stored filter dates
            localStorage.setItem('reportsComponent_filterDates', JSON.stringify({ startDate, endDate }));

            if (reportType === 'daily_cash_flow') {
                content = this.generateDailyCashFlowReport(data, startDate, endDate);
            } else if (reportType === 'profit_loss') {
                content = this.generateProfitLossReport(data, startDate, endDate);
            } else if (reportType === 'occupancy_rate') {
                content = this.generateOccupancyRateReport(data, startDate, endDate);
            } else if (reportType === 'inventory_status') {
                 content = this.generateInventoryStatusReport(data);
            } else if (reportType === 'guest_demographics') {
                content = this.generateGuestDemographicsReport(data);
            } else if (reportType === 'commission_report') {
                content = this.generateCommissionReport(data, startDate, endDate);
            } else if (reportType === 'revenue_by_source') {
                 content = this.generateRevenueBySourceReport(data, startDate, endDate);
            } else if (reportType === 'expense_by_category') {
                content = this.generateExpenseByCategoryReport(data, startDate, endDate);
            } else if (reportType === 'room_type_performance') {
                content = this.generateRoomTypePerformanceReport(data, startDate, endDate);
            } else if (reportType === 'staff_performance') {
                content = this.generateStaffPerformanceReport(data, startDate, endDate);
            } else if (reportType === 'payroll_calculation') {
                content = this.generatePayrollCalculationReport(data, startDate, endDate, document.getElementById('payrollStaffSelect')?.value);
            }
            else {
                content = `<div style="text-align: center; padding: 1.5rem; color: var(--text-light);">
                            <i class="fas fa-flask" style="font-size: 3rem; margin-bottom: 1rem; color: var(--primary-color);"></i>
                            <p>Bu hesabat ${reportTitle} hazırlanma mərhələsindədir. Tezliklə aktiv olacaq!</p>
                        </div>`;
            }
        }
        
        reportBodyDiv.innerHTML = content;
    }

    // --- Report Generation Functions (simplified data presentation) ---
    // Note: These methods are now intended to be called by app.js or internally by this component,
    // they should return HTML string, not directly render to DOM.
    // They now expect `window.app.formatDate` to be available.
    // Ensure all data accesses are defensive (`data?.collectionName`) as app.js passes the full data object.
    
    generateDailyCashFlowReport(data, startDate, endDate) {
        let transactions = data.cashTransactions || [];

        const accountLabels = {
            main: 'Əsas',
            bank: 'Bank',
            pos: 'POS',
            paypal: 'PayPal'
        };
        const allAccounts = [
            { id: 'main', name: 'Əsas hesab', type: 'Nağd' },
            { id: 'bank', name: 'Bank hesabı', type: 'Bank' },
            { id: 'pos', name: 'POS terminal', type: 'Terminal' },
            { id: 'paypal', name: 'PayPal hesabı', type: 'Online' }
        ];

        const reportRows = [];

        // 1. Calculate balances *before* the start date for initial summary
        let balancesBeforeStartDate = {};
        allAccounts.forEach(acc => balancesBeforeStartDate[acc.id] = 0);

        transactions.forEach(tx => {
            if (tx.date < startDate) {
                const accountId = tx.accountId || 'main';
                if (tx.type === 'income') {
                    balancesBeforeStartDate[accountId] += tx.amount;
                } else {
                    balancesBeforeStartDate[accountId] -= tx.amount;
                }
            }
        });

        // 2. Iterate through each day in the report range
        let currentDayIterator = new Date(startDate);
        const endDateObj = new Date(endDate);
        
        let totalIncomeForPeriod = 0; // For overall averages
        let totalExpenseForPeriod = 0; // For overall averages

        let currentRunningBalances = { ...balancesBeforeStartDate };

        const dayDiff = Math.ceil(Math.abs(endDateObj - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1; // Number of days in period

        while (currentDayIterator.toISOString().split('T')[0] <= endDateObj.toISOString().split('T')[0]) {
            const dayStr = currentDayIterator.toISOString().split('T')[0];
            const transactionsForDay = transactions.filter(tx => tx.date === dayStr);

            let dailyIncome = 0;
            let dailyExpense = 0;
            let accountsForThisDay = {};

            allAccounts.forEach(acc => {
                accountsForThisDay[acc.id] = {
                    openingBalance: currentRunningBalances[acc.id],
                    closingBalance: currentRunningBalances[acc.id]
                };
            });

            transactionsForDay.forEach(tx => {
                const accountId = tx.accountId || 'main';
                if (tx.type === 'income') {
                    dailyIncome += tx.amount;
                    accountsForThisDay[accountId].closingBalance += tx.amount;
                } else {
                    dailyExpense += tx.amount;
                    accountsForThisDay[accountId].closingBalance -= tx.amount;
                }
            });

            reportRows.push({
                day: dayStr,
                dailyIncome,
                dailyExpense,
                accounts: accountsForThisDay
            });

            totalIncomeForPeriod += dailyIncome;
            totalExpenseForPeriod += dailyExpense;

            allAccounts.forEach(acc => {
                currentRunningBalances[acc.id] = accountsForThisDay[acc.id].closingBalance;
            });

            currentDayIterator.setDate(currentDayIterator.getDate() + 1);
        }

        const averageDailyIncome = dayDiff > 0 ? (totalIncomeForPeriod / dayDiff) : 0;
        const averageDailyExpense = dayDiff > 0 ? (totalExpenseForPeriod / dayDiff) : 0;

        // Generate HTML for initial balances
        const initialBalancesHtml = `
            <h4 style="margin-top: 0; margin-bottom: 0.8rem; color: #3b82f6;">Dövrün Başlanğıc Balansları (${window.app.formatDate(startDate)})</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
                ${allAccounts.map(acc => `
                    <div style="background: var(--background-color); padding: 0.8rem; border-radius: 0.5rem; text-align: center; flex: 1; min-width: 150px; border: 1px solid var(--border-color);">
                        <strong style="color:var(--text-color);">${accountLabels[acc.id]} Hesabı</strong><br>
                        <span style="font-size: 1.1em; font-weight: bold; color: ${balancesBeforeStartDate[acc.id] >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                            ₼${(balancesBeforeStartDate[acc.id] || 0).toFixed(2)}
                        </span>
                    </div>
                `).join('')}
            </div>
        `;

        // Generate HTML for average daily flows
        const averageFlowsHtml = `
            <h4 style="margin-top: 0; margin-bottom: 0.8rem; color: #3b82f6;">Dövr Üzrə Orta Gündəlik Hərəkət</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
                <div style="background: var(--background-color); padding: 0.8rem; border-radius: 0.5rem; text-align: center; flex: 1; min-width: 150px; border: 1px solid var(--border-color);">
                    <strong style="color:var(--text-color);">Orta Gündəlik Gəlir</strong><br>
                    <span style="font-size: 1.1em; font-weight: bold; color: var(--success-color);">
                        ₼${averageDailyIncome.toFixed(2)}
                    </span>
                </div>
                <div style="background: var(--background-color); padding: 0.8rem; border-radius: 0.5rem; text-align: center; flex: 1; min-width: 150px; border: 1px solid var(--border-color);">
                    <strong style="color:var(--text-color);">Orta Gündəlik Xərc</strong><br>
                    <span style="font-size: 1.1em; font-weight: bold; color: var(--danger-color);">
                        ₼${averageDailyExpense.toFixed(2)}
                    </span>
                </div>
            </div>
        `;

        // Generate table headers for dynamic columns
        const dynamicHeaders = allAccounts.map(acc => `
            <th class="text-right">${accountLabels[acc.id]} (Əvvəl)</th>
            <th class="text-right">${accountLabels[acc.id]} (Son)</th>
        `).join('');

        const rowsHtml = reportRows.map((row, idx) => {
            const accountBalancesHtml = allAccounts.map(acc => {
                const openingClass = row.accounts[acc.id].openingBalance >= 0 ? 'positive' : 'negative';
                const closingClass = row.accounts[acc.id].closingBalance >= 0 ? 'positive' : 'negative';
                return `
                    <td class="text-right ${openingClass}">₼${row.accounts[acc.id].openingBalance.toFixed(2)}</td>
                    <td class="text-right ${closingClass}">₼${row.accounts[acc.id].closingBalance.toFixed(2)}</td>
                `;
            }).join('');

            const dailyBalance = row.dailyIncome - row.dailyExpense;
            const dailyBalanceClass = dailyBalance >= 0 ? 'positive' : 'negative';

            return `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                    <td>${window.app.formatDate(row.day)}</td>
                    <td class="text-right">₼${row.dailyIncome.toFixed(2)}</td>
                    <td class="text-right">₼${row.dailyExpense.toFixed(2)}</td>
                    <td class="text-right ${dailyBalanceClass}">₼${dailyBalance.toFixed(2)}</td>
                    ${accountBalancesHtml}
                </tr>
            `;
        }).join('');

        // Generate HTML for final balances
        const finalBalancesHtml = `
            <h4 style="margin-top: 2rem; margin-bottom: 0.8rem; color: #3b82f6;">Dövrün Son Balansları (${window.app.formatDate(endDate)})</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
                ${allAccounts.map(acc => `
                    <div style="background: var(--background-color); padding: 0.8rem; border-radius: 0.5rem; text-align: center; flex: 1; min-width: 150px; border: 1px solid var(--border-color);">
                        <strong style="color:var(--text-color);">${accountLabels[acc.id]} Hesabı</strong><br>
                        <span style="font-size: 1.1em; font-weight: bold; color: ${currentRunningBalances[acc.id] >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                            ₼${(currentRunningBalances[acc.id] || 0).toFixed(2)}
                        </span>
                    </div>
                `).join('')}
            </div>
        `;

        return `
            <p class="report-description">Bu hesabat müəyyən edilmiş dövr ərzində gündəlik gəlir və xərcləri, hər bir hesab üzrə açılış və bağlanış qalıqlarını təqdim edir.</p>
            <div class="report-body">
                ${initialBalancesHtml}
                ${averageFlowsHtml}
                <table class="data-table" style="min-width: 900px;"> <!-- Ensure minimum width for wide table -->
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th>Tarix</th>
                            <th class="text-right">Gəlir</th>
                            <th class="text-right">Xərc</th>
                            <th class="text-right">Günün Balansı</th>
                            ${dynamicHeaders}
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml.length ? rowsHtml : '<tr><td colspan="' + (5 + allAccounts.length * 2) + '" class="text-center">Məlumat yoxdur.</td></tr>'}
                    </tbody>
                </table>
                ${finalBalancesHtml}
            </div>
            <style>
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .positive { color: var(--success-color); }
                .negative { color: var(--danger-color); }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
                .report-filters { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
                .report-filters .form-label { flex-direction: row; align-items: center; gap: 0.5rem; font-weight: normal; }
                .report-filters .form-input { max-width: 150px; }
                /* Adjust table width for new columns */
                .modal .report-body table {
                    min-width: 500px; /* Adjust as needed to ensure content fits */
                }
            </style>
        `;
    }

    generateProfitLossReport(data, startDate, endDate) {
        let transactions = data.cashTransactions || [];

        // Filter by date range
        if (startDate && endDate) {
            transactions = transactions.filter(t => t.date >= startDate && t.date <= endDate);
        }

        const incomeTransactions = transactions.filter(t => t.type === 'income');
        const expenseTransactions = transactions.filter(t => t.type === 'expense');

        let totalIncome = incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        let totalExpense = expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

        const profitLoss = totalIncome - totalExpense;
        const profitLossClass = profitLoss >= 0 ? 'positive' : 'negative';

        const incomeRows = incomeTransactions.map((t, idx) => `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                <td>${window.app.formatDate(t.date || t.createdAt)}</td>
                <td>${t.category}</td>
                <td>${t.description || '—'}</td>
                <td class="text-right">₼${(t.amount || 0).toFixed(2)}</td>
            </tr>
        `).join('');

        const expenseRows = expenseTransactions.map((t, idx) => `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                <td>${window.app.formatDate(t.date || t.createdAt)}</td>
                <td>${t.category}</td>
                <td>${t.description || '—'}</td>
                <td class="text-right">₼${(t.amount || 0).toFixed(2)}</td>
            </tr>
        `).join('');

        return `
            <p class="report-description">Bu hesabat seçilmiş dövr üzərə ümumi gəlirləri, xərcləri və yekun mənfəət/zərər rəqəmini göstərir.</p>
            <div class="report-body">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div>
                        <h4>Gəlirlər</h4>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 45px; text-align: center;">№</th>
                                    <th>Tarix</th>
                                    <th>Kateqoriya</th>
                                    <th>Təsvir</th>
                                    <th class="text-right">Məbləğ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${incomeRows.length ? incomeRows : '<tr><td colspan="5" class="text-center">Gəlir yoxdur.</td></tr>'}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="4" class="text-right"><strong>Cəmi Gəlir:</strong></td>
                                    <td class="text-right positive"><strong>₼${totalIncome.toFixed(2)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <div>
                        <h4>Xərclər</h4>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width: 45px; text-align: center;">№</th>
                                    <th>Tarix</th>
                                    <th>Kateqoriya</th>
                                    <th>Təsvir</th>
                                    <th class="text-right">Məbləğ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${expenseRows.length ? expenseRows : '<tr><td colspan="5" class="text-center">Xərc yoxdur.</td></tr>'}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="4" class="text-right"><strong>Cəmi Xərc:</strong></td>
                                    <td class="text-right negative"><strong>₼${totalExpense.toFixed(2)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                <div style="margin-top:2rem; padding:1.5rem; border-radius:0.75rem; background:var(--primary-light); text-align:center; box-shadow:var(--shadow-sm);">
                    <h3 style="margin:0; color:var(--text-color);">Yekun Mənfəət / Zərər:</h3>
                    <div style="font-size:2.5rem; font-weight:700; color:${profitLossClass === 'positive' ? 'var(--success-color)' : 'var(--danger-color)'};">
                        ₼${profitLoss.toFixed(2)}
                    </div>
                </div>
            </div>
            <style>
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .positive { color: var(--success-color); }
                .negative { color: var(--danger-color); }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
                .report-filters { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
                .report-filters .form-label { flex-direction: row; align-items: center; gap: 0.5rem; font-weight: normal; }
                .report-filters .form-input { max-width: 150px; }
            </style>
        `;
    }

    generateOccupancyRateReport(data, startDate, endDate) {
        const rooms = data.rooms || [];
        const reservations = data.reservations || [];
        
        // Ensure start and end dates are Date objects normalized to start of day
        const start = startDate ? new Date(startDate) : new Date();
        start.setHours(0, 0, 0, 0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        // If no specific dates selected, default to last 6 months for trend
        if (!startDate || !endDate) {
            start.setMonth(start.getMonth() - 5); // Start 5 months ago for a 6-month view
            start.setDate(1); // Start from the first day of that month
            end.setHours(23, 59, 59, 999); // Ensure end of current day
        }

        // Calculate current occupancy (snapshot of actual room status)
        const totalRooms = rooms.length;
        
        // --- NEW: Calculate Instantaneous Snapshot using getRoomStatusForDay logic ---
        const today = window.app.getTodayDateString();
        const roomsComp = window.roomsComponent || new window.RoomsComponent();
        const todayDateObj = roomsComp.parseDateAsUTC(today); 
        
        const roomsStatusCounts = {
            occupied: 0, // Confirmed/Checked-in reservation blocks
            available: 0, // Truly empty and clean
            maintenance: 0, 
            dirty: 0,
            pending_reservation: 0 // Blocked by pending reservation
        };

        rooms.forEach(room => {
            const statusInfo = roomsComp.getRoomStatusForDay(room, todayDateObj, data);
            // Since all possible statuses are initialized to 0, this is safe:
            if (roomsStatusCounts[statusInfo.status] !== undefined) {
                roomsStatusCounts[statusInfo.status]++;
            }
        });

        // Occupancy Rate Calculation: (Occupied / (Total - Maintenance - Dirty)) * 100
        const confirmedOccupiedOnly = roomsStatusCounts.occupied;
        const roomsUnavailableForSale = roomsStatusCounts.maintenance + roomsStatusCounts.dirty;
        const availableInventoryForSale = totalRooms - roomsUnavailableForSale;
        
        const occupiedRooms = confirmedOccupiedOnly;
        const availableRooms = roomsStatusCounts.available;
        const maintenanceRooms = roomsUnavailableForSale; // Combined maintenance/dirty for display

        const occupancyPercentage = availableInventoryForSale > 0 ? 
            ((occupiedRooms / availableInventoryForSale) * 100).toFixed(2) : 0;

        // Calculate monthly occupancy
        const monthlyOccupancyData = {};
        let currentMonthIterator = new Date(start.getFullYear(), start.getMonth(), 1);

        while (currentMonthIterator <= end) {
            const monthKey = `${currentMonthIterator.getFullYear()}-${String(currentMonthIterator.getMonth() + 1).padStart(2, '0')}`;
            const daysInMonth = new Date(currentMonthIterator.getFullYear(), currentMonthIterator.getMonth() + 1, 0).getDate();
            
            let totalRoomNights = totalRooms * daysInMonth;
            let occupiedRoomNights = 0;

            // Iterate through reservations that overlap with the current month
            reservations.forEach(res => {
                const resCheckIn = new Date(res.checkIn);
                const resCheckOut = new Date(res.checkOut);

                // Determine overlap period for this reservation within the current month
                const overlapStart = new Date(Math.max(resCheckIn.getTime(), currentMonthIterator.getTime()));
                const overlapEnd = new Date(Math.min(resCheckOut.getTime(), new Date(currentMonthIterator.getFullYear(), currentMonthIterator.getMonth() + 1, 0).getTime()));

                if (overlapStart < overlapEnd) {
                    // Number of days in the overlap period
                    const nightsInOverlap = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
                    occupiedRoomNights += nightsInOverlap;
                }
            });

            // Exclude rooms under maintenance for the whole month from totalRoomNights
            const roomsAlwaysUnderMaintenance = rooms.filter(r => {
                return data.maintenance.some(m => 
                    m.roomId === r.id && 
                    ['pending', 'in_progress'].includes(m.status) &&
                    new Date(m.createdAt).getFullYear() <= currentMonthIterator.getFullYear() &&
                    new Date(m.createdAt).getMonth() <= currentMonthIterator.getMonth() &&
                    new Date(m.dueDate).getFullYear() >= currentMonthIterator.getFullYear() &&
                    new Date(m.dueDate).getMonth() >= currentMonthIterator.getMonth()
                );
            }).length;
            
            totalRoomNights -= roomsAlwaysUnderMaintenance * daysInMonth;
            totalRoomNights = Math.max(0, totalRoomNights); // Ensure no negative room nights

            const monthlyRate = totalRoomNights > 0 ? ((occupiedRoomNights / totalRoomNights) * 100).toFixed(2) : 0;

            monthlyOccupancyData[monthKey] = {
                month: window.app.formatDate(currentMonthIterator, false),
                rate: parseFloat(monthlyRate),
                occupied: occupiedRoomNights,
                total: totalRoomNights
            };

            currentMonthIterator.setMonth(currentMonthIterator.getMonth() + 1);
        }
        
        const monthlyRows = Object.values(monthlyOccupancyData).map((m, idx) => `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                <td>${m.month}</td>
                <td class="text-right">${m.occupied}</td>
                <td class="text-right">${m.total}</td>
                <td class="text-right">${String(m.rate)}%</td>
            </tr>
        `).join('');

        return `
            <p class="report-description">Bu hesabat otelin cari doluluq faizini və seçilmiş dövr üzrə aylıq icmalını təqdim edir.</p>
            <div class="report-body">
                <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
                    <div style="background: var(--primary-light); padding: 1rem; border-radius: 0.5rem; text-align: center; flex: 1; min-width: 180px;">
                        <strong>Cari Doluluq:</strong> <span style="font-size: 1.2em; font-weight: bold; color: var(--primary-color);">${String(occupancyPercentage)}%</span>
                    </div>
                    <div style="background: var(--success-color-light); padding: 1rem; border-radius: 0.5rem; text-align: center; flex: 1; min-width: 180px;">
                        <strong>Boş Otaqlar:</strong> <span style="font-size: 1.2em; font-weight: bold; color: var(--success-color);">${availableRooms}</span>
                    </div>
                    <div style="background: var(--danger-color-light); padding: 1rem; border-radius: 0.5rem; text-align: center; flex: 1; min-width: 180px;">
                        <strong>Dolu Otaqlar:</strong> <span style="font-size: 1.2em; font-weight: bold; color: var(--danger-color);">${occupiedRooms}</span>
                    </div>
                </div>

                <h4>Aylıq Doluluq İcmalı (${window.app.formatDate(start)} - ${window.app.formatDate(end)})</h4>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th>Ay</th>
                            <th class="text-right">Dolu Gecə</th>
                            <th class="text-right">Mövcud Gecə</th>
                            <th class="text-right">Doluluq Faizi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthlyRows.length ? monthlyRows : '<tr><td colspan="5" class="text-center">Məlumat yoxdur.</td></tr>'}
                    </tbody>
                </table>
            </div>
            <style>
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
                .report-filters { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
                .report-filters .form-label { flex-direction: row; align-items: center; gap: 0.5rem; font-weight: normal; }
                .report-filters .form-input { max-width: 150px; }
            </style>
        `;
    }

    generateInventoryStatusReport(data) {
        const inventoryItems = data.inventory || [];

        // Group by category for better readability
        const categorizedItems = inventoryItems.reduce((acc, item) => {
            (acc[item.category] = acc[item.category] || []).push(item);
            return acc;
        }, {});

        let reportContent = '';
        Object.keys(categorizedItems).sort().forEach(category => {
            reportContent += `
                <h4>${category}</h4>
                <table class="data-table" style="margin-bottom: 1.5rem;">
                    <thead>
                        <tr>
                            <th style="width: 45px; text-align: center;">№</th>
                            <th>Məhsul Adı</th>
                            <th>Miqdar</th>
                            <th>Min. Miqdar</th>
                            <th>Vahid</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categorizedItems[category].map((item, idx) => {
                            const status = (item.quantity <= item.minQuantity) ? 'Az qalıb' : 'Normal';
                            const statusClass = (item.quantity <= item.minQuantity) ? 'status-cancelled' : 'status-confirmed';
                            return `
                                <tr>
                                    <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                                    <td>${window.escapeHtml(item.name)}</td>
                                    <td>${item.quantity}</td>
                                    <td>${item.minQuantity}</td>
                                    <td>${item.unit}</td>
                                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        });

        return `
            <p class="report-description">Bu hesabat anbarda olan məhsulların cari vəziyyətini və minimum qalıqlarını göstərir.</p>
            <div class="report-body">
                ${reportContent || '<p class="text-center">Anbar məlumatları yoxdur.</p>'}
            </div>
            <style>
                .text-center { text-align: center; }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
            </style>
        `;
    }

    generateGuestDemographicsReport(data) {
        const guests = data.guests || [];
        const nationalities = {};
        const genders = { 'Kişi': 0, 'Qadın': 0, 'Digər': 0 };

        guests.forEach(g => {
            nationalities[g.nationality] = (nationalities[g.nationality] || 0) + 1;
            if (g.gender === 'Kişi') {
                genders['Kişi']++;
            } else if (g.gender === 'Qadın') {
                genders['Qadın']++;
            } else {
                genders['Digər']++;
            }
        });

        const sortedNationalities = Object.entries(nationalities).sort((a, b) => b[1] - a[1]); // Sort by count descending

        const nationalityRows = sortedNationalities.map(([country, count], idx) => `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                <td>${country}</td>
                <td class="text-right">${count}</td>
                <td class="text-right">${String(((count / guests.length) * 100).toFixed(2))}%</td>
            </tr>
        `).join('');

        const genderRows = Object.entries(genders).map(([gender, count], idx) => `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                <td>${gender}</td>
                <td class="text-right">${count}</td>
                <td class="text-right">${String(((count / guests.length) * 100).toFixed(2))}%</td>
            </tr>
        `).join('');

        return `
            <p class="report-description">Bu hesabat otel qonaqlarının demoqrafik məlumatlarını (milliyyət və cins) təqdim edir.</p>
            <div class="report-body">
                <h4>Milliyyət üzrə Paylanma</h4>
                <table class="data-table" style="margin-bottom: 1.5rem;">
                    <thead>
                        <tr>
                            <th style="width: 45px; text-align: center;">№</th>
                            <th>Milliyyət</th>
                            <th class="text-right">Sayı</th>
                            <th class="text-right">Faiz</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${nationalityRows.length ? nationalityRows : '<tr><td colspan="4" class="text-center">Məlumat yoxdur.</td></tr>'}
                    </tbody>
                </table>

                <h4>Cins üzrə Paylanma</h4>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 45px; text-align: center;">№</th>
                            <th>Cins</th>
                            <th class="text-right">Sayı</th>
                            <th class="text-right">Faiz</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${genderRows.length ? genderRows : '<tr><td colspan="4" class="text-center">Məlumat yoxdur.</td></tr>'}
                    </tbody>
                </table>
            </div>
            <style>
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
            </style>
        `;
    }

    generateCommissionReport(data, startDate, endDate) {
        let reservations = data.reservations || [];

        // Filter by date range
        if (startDate && endDate) {
            reservations = reservations.filter(res => res.checkIn >= startDate && res.checkIn <= endDate);
        }

        const commissionReservations = reservations.filter(res => res.commissionAmount > 0 && res.source === 'online');

        const rows = commissionReservations.map((res, idx) => {
            const guest = data.guests.find(g => g.id === res.guestId);
            const resPublicId = res.publicId || (window.app ? window.app.formatInternalId(res.id, 'RZ') : res.id);
            return `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                    <td>${window.escapeHtml(resPublicId)}</td>
                    <td>${window.escapeHtml(guest?.name || 'N/A')}</td>
                    <td>${window.escapeHtml(res.externalReference || '—')}</td>
                    <td>${window.app.formatDate(res.checkIn)}</td>
                    <td>₼${res.totalAmount.toFixed(2)}</td>
                    <td class="text-right">₼${res.commissionAmount.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const totalCommission = commissionReservations.reduce((sum, res) => sum + res.commissionAmount, 0);

        return `
            <p class="report-description">Bu hesabat online rezervasiyalardan ödənilən komissiya məbləğlərini göstərir.</p>
            <div class="report-body">
                <table class="data-table" style="margin-bottom: 1.5rem;">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th>Rezervasiya ID</th>
                            <th>Qonaq Adı</th>
                            <th>Xarici Referans</th>
                            <th>Giriş Tarixi</th>
                            <th>Ümumi Məbləğ</th>
                            <th class="text-right">Komissiya Məbləği</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows : '<tr><td colspan="7" class="text-center">Komissiya məlumatları yoxdur.</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="6" class="text-right"><strong>Ümumi Komissiya:</strong></td>
                            <td class="text-right"><strong>₼${totalCommission.toFixed(2)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <style>
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
            </style>
        `;
    }

    // NEW: Generate Expense by Category Report
    generateExpenseByCategoryReport(data, startDate, endDate) {
        let transactions = data.cashTransactions || [];

        // Filter by date range and type
        transactions = transactions.filter(t => t.type === 'expense');
        if (startDate && endDate) {
            transactions = transactions.filter(t => t.date >= startDate && t.date <= endDate);
        }

        const expenseByCategory = {};
        let totalExpense = 0;

        transactions.forEach(t => {
            expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
            totalExpense += t.amount;
        });

        const sortedCategories = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

        const rows = sortedCategories.map(([category, amount], idx) => `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                <td>${category}</td>
                <td class="text-right">₼${amount.toFixed(2)}</td>
                <td class="text-right">${String(((amount / totalExpense) * 100).toFixed(2))}%</td>
            </tr>
        `).join('');

        return `
            <p class="report-description">Bu hesabat seçilmiş dövr üzrə xərcləri kateqoriyalar üzrə təhlil edir.</p>
            <div class="report-body">
                <table class="data-table" style="margin-bottom: 1.5rem;">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th>Kateqoriya</th>
                            <th class="text-right">Ümumi Xərc</th>
                            <th class="text-right">Faiz</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows : '<tr><td colspan="4" class="text-center">Xərc məlumatları yoxdur.</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" class="text-right"><strong>Cəmi Xərc:</strong></td>
                            <td class="text-right"><strong>₼${totalExpense.toFixed(2)}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <style>
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
            </style>
        `;
    }

    // NEW: Generate Room Type Performance Report
    generateRoomTypePerformanceReport(data, startDate, endDate) {
        const rooms = data.rooms || [];
        let reservations = data.reservations || [];

        // Filter reservations by date range
        if (startDate && endDate) {
            reservations = reservations.filter(res => res.checkIn >= startDate && res.checkIn <= endDate);
        }

        const roomTypeSummary = {}; // type -> { totalRooms: count, totalRevenue: sum, occupiedNights: sum }

        // Initialize summary for each room type
        const uniqueRoomTypes = Array.from(new Set(rooms.map(r => r.type).filter(Boolean)));
        uniqueRoomTypes.forEach(type => {
            roomTypeSummary[type] = {
                totalRoomsOfType: rooms.filter(r => r.type === type).length,
                totalRevenue: 0,
                occupiedNights: 0
            };
        });

        // Calculate revenue and occupied nights from reservations
        reservations.forEach(res => {
            const room = rooms.find(r => r.id === res.roomId);
            if (room && room.type) {
                // For this report, 'totalAmount' from reservation represents the total revenue.
                // Assuming `roomTotal` represents the room-related revenue.
                roomTypeSummary[room.type].totalRevenue += (res.roomTotal || 0);
                roomTypeSummary[room.type].occupiedNights += (res.nights || 0);
            }
        });

        const rows = Object.entries(roomTypeSummary).map(([type, summary], idx) => {
            const avgRevenuePerRoom = summary.totalRoomsOfType > 0 ? (summary.totalRevenue / summary.totalRoomsOfType) : 0;
            const avgRevenuePerNight = summary.occupiedNights > 0 ? (summary.totalRevenue / summary.occupiedNights) : 0;

            return `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                    <td>${type}</td>
                    <td class="text-right">${summary.totalRoomsOfType}</td>
                    <td class="text-right">₼${summary.totalRevenue.toFixed(2)}</td>
                    <td class="text-right">₼${avgRevenuePerRoom.toFixed(2)}</td>
                    <td class="text-right">₼${avgRevenuePerNight.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const totalOverallRevenue = Object.values(roomTypeSummary).reduce((sum, s) => sum + s.totalRevenue, 0);

        return `
            <p class="report-description">Bu hesabat müəyyən edilmiş dövr ərzində otaq tiplərinin gəlir performansını təqdim edir.</p>
            <div class="report-body">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th>Otaq Tipi</th>
                            <th class="text-right">Cəmi Otaq</th>
                            <th class="text-right">Ümumi Gəlir (₼)</th>
                            <th class="text-right">Otaq Başına Gəlir (₼)</th>
                            <th class="text-right">Gecə Başına Gəlir (₼)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows : '<tr><td colspan="6" class="text-center">Məlumat yoxdur.</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" class="text-right"><strong>Cəmi Gəlir:</strong></td>
                            <td class="text-right"><strong>₼${totalOverallRevenue.toFixed(2)}</strong></td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <style>
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
            </style>
        `;
    }
    
    // NEW: Generate Staff Performance Report
    generateStaffPerformanceReport(data, startDate, endDate) {
        const staffList = data.staff || [];
        let posSales = data.posSales || [];
        let cashTransactions = data.cashTransactions || [];

        if (startDate && endDate) {
            posSales = posSales.filter(sale => sale.createdAt.split('T')[0] >= startDate && sale.createdAt.split('T')[0] <= endDate);
            cashTransactions = cashTransactions.filter(tx => tx.date >= startDate && tx.date <= endDate);
        }

        const rows = staffList.map((staff, idx) => {
            // Calculate total revenue from POS sales attributed to this staff member
            const staffPosSales = posSales.filter(s => s.staffId === staff.id);
            const totalPosRevenue = staffPosSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

            // Calculate cash transactions handled by this staff member
            const staffCashTx = cashTransactions.filter(tx => tx.staffId === staff.id);
            const cashIncomeHandled = staffCashTx.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + (tx.amount || 0), 0);
            const cashExpenseHandled = staffCashTx.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + (tx.amount || 0), 0);
            
            return `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                    <td>${window.escapeHtml(staff.name)}</td>
                    <td>${window.escapeHtml(staff.position)}</td>
                    <td class="text-right">₼${totalPosRevenue.toFixed(2)} (${staffPosSales.length})</td>
                    <td class="text-right">₼${cashIncomeHandled.toFixed(2)}</td>
                    <td class="text-right">₼${cashExpenseHandled.toFixed(2)}</td>
                    <td class="text-center">${staffCashTx.length}</td>
                </tr>
            `;
        }).join('');

        return `
            <p class="report-description">Bu hesabat seçilmiş dövr ərzində işçilərin maliyyə performansını təqdim edir.</p>
            <div class="report-body">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th>İşçi</th>
                            <th>Vəzifə</th>
                            <th class="text-right">POS Satışları (Say)</th>
                            <th class="text-right">Qəbul Edilən Kassa</th>
                            <th class="text-right">Ödənilən Kassa</th>
                            <th class="text-center">Ümumi Tranzaksiya</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows : '<tr><td colspan="7" class="text-center">Məlumat yoxdur.</td></tr>'}
                    </tbody>
                </table>
            </div>
            <style>
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
            </style>
        `;
    }

    // NEW: Generate Revenue by Source Report
    generateRevenueBySourceReport(data, startDate, endDate) {
        let reservations = data.reservations || [];
        let posSales = data.posSales || [];

        // Filter reservations by date range
        if (startDate && endDate) {
            reservations = reservations.filter(res => res.checkIn >= startDate && res.checkIn <= endDate);
            posSales = posSales.filter(sale => sale.createdAt.split('T')[0] >= startDate && sale.createdAt.split('T')[0] <= endDate);
        }

        const revenueBySource = {
            'Sistem': 0,
            'Online (Booking.com, etc.)': 0,
            'POS Satışlar': 0,
            'Digər Gəlirlər': 0
        };

        // Reservations revenue
        reservations.forEach(res => {
            if (res.source === 'system') {
                revenueBySource['Sistem'] += res.totalAmount || 0;
            } else if (res.source === 'online') {
                revenueBySource['Online (Booking.com, etc.)'] += res.totalAmount || 0;
            }
        });

        // POS sales revenue
        posSales.forEach(sale => {
            revenueBySource['POS Satışlar'] += sale.totalAmount || 0;
        });

        // Other income from cash transactions
        const otherIncome = (data.cashTransactions || [])
            .filter(tx => tx.type === 'income' && tx.category !== 'Rezervasiya ödənişi' && tx.category !== 'POS satış')
            .filter(tx => tx.date >= startDate && tx.date <= endDate);
        
        revenueBySource['Digər Gəlirlər'] = otherIncome.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        const totalRevenue = Object.values(revenueBySource).reduce((sum, val) => sum + val, 0);

        const rows = Object.entries(revenueBySource).map(([source, amount], idx) => `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                <td>${source}</td>
                <td class="text-right">₼${amount.toFixed(2)}</td>
                <td class="text-right">${totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(2) : 0}%</td>
            </tr>
        `).join('');

        return `
            <p class="report-description">Bu hesabat seçilmiş dövr ərzində otelin gəlirlərini mənbələr üzrə təqdim edir.</p>
            <div class="report-body">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th>Mənbə</th>
                            <th class="text-right">Ümumi Gəlir (₼)</th>
                            <th class="text-right">Faiz</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows : '<tr><td colspan="4" class="text-center">Məlumat yoxdur.</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" class="text-right"><strong>Cəmi Gəlir:</strong></td>
                            <td class="text-right"><strong>₼${totalRevenue.toFixed(2)}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <style>
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
            </style>
        `;
    }

    // NEW: Generate Maintenance Overview Report
    generateMaintenanceOverviewReport(data, startDate, endDate) {
        let tasks = data.maintenance || [];

        // Filter by date range (based on creation date)
        if (startDate && endDate) {
            tasks = tasks.filter(t => t.createdAt >= startDate && t.createdAt <= endDate);
        }

        const summary = {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            in_progress: tasks.filter(t => t.status === 'in_progress').length,
            completed: tasks.filter(t => t.status === 'completed').length,
        };

        const rows = tasks.map((task, idx) => {
            const room = data.rooms.find(r => r.id === task.roomId);
            const assignedStaff = data.staff.find(s => s.id === task.assignedTo);
            const statusText = window.statusHelper?.getMaintenanceStatus(task.status) || task.status;
            
            return `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                    <td>${task.publicId || task.id}</td>
                    <td>${room?.number || 'Ümumi'}</td>
                    <td>${window.escapeHtml(task.type)}</td>
                    <td>${window.escapeHtml(task.description)}</td>
                    <td>${window.escapeHtml(assignedStaff?.name || 'Təyin edilməyib')}</td>
                    <td>${window.app.formatDate(task.dueDate)}</td>
                    <td><span class="status-badge status-${task.status}">${statusText}</span></td>
                </tr>
            `;
        }).join('');

        return `
            <p class="report-description">Bu hesabat müəyyən edilmiş dövr ərzində təmir və təmizlik tapşırıqlarının ümumi icmalını təqdim edir.</p>
            <div class="report-body">
                <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
                    <div style="background: var(--primary-light); padding: 1rem; border-radius: 0.5rem; text-align: center; flex: 1; min-width: 150px;">
                        <strong>Cəmi Tapşırıq:</strong> <span style="font-size: 1.2em; font-weight: bold; color: var(--primary-color);">${summary.total}</span>
                    </div>
                    <div style="background: var(--warning-color-light-bg); padding: 1rem; border-radius: 0.5rem; text-align: center; flex: 1; min-width: 150px;">
                        <strong>Gözləyən:</strong> <span style="font-size: 1.2em; font-weight: bold; color: var(--warning-color);">${summary.pending}</span>
                    </div>
                    <div style="background: var(--info-color-light-bg); padding: 1rem; border-radius: 0.5rem; text-align: center; flex: 1; min-width: 150px;">
                        <strong>İcrada:</strong> <span style="font-size: 1.2em; font-weight: bold; color: var(--info-color);">${summary.in_progress}</span>
                    </div>
                    <div style="background: var(--success-color-light); padding: 1rem; border-radius: 0.5rem; text-align: center; flex: 1; min-width: 150px;">
                        <strong>Tamamlanmış:</strong> <span style="font-size: 1.2em; font-weight: bold; color: var(--success-color);">${summary.completed}</span>
                    </div>
                </div>

                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th>ID</th>
                            <th>Otaq</th>
                            <th>Növ</th>
                            <th>Təsvir</th>
                            <th>Məsul</th>
                            <th>Son Tarix</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows : '<tr><td colspan="8" class="text-center">Tapşırıq yoxdur.</td></tr>'}
                    </tbody>
                </table>
            </div>
            <style>
                .text-center { text-align: center; }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
            </style>
        `;
    }

    // NEW: Generate Loyal Guests Report
    generateLoyalGuestsReport(data, startDate, endDate) {
        let reservations = data.reservations || [];
        if (startDate && endDate) {
            reservations = reservations.filter(res => res.checkIn >= startDate && res.checkIn <= endDate);
        }

        const guestReservationCounts = reservations.reduce((acc, res) => {
            acc[res.guestId] = (acc[res.guestId] || 0) + 1;
            return acc;
        }, {});

        const loyalGuestIds = Object.keys(guestReservationCounts).filter(guestId => guestReservationCounts[guestId] > 1);

        const rows = loyalGuestIds.map((guestId, idx) => {
            const guest = data.guests.find(g => g.id === guestId);
            if (!guest) return '';

            const guestReservations = reservations.filter(res => res.guestId === guestId);
            const totalSpent = guestReservations.reduce((sum, res) => sum + (res.totalAmount || 0), 0);
            
            return `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                    <td>${window.escapeHtml(guest.name)}</td>
                    <td>${window.escapeHtml(guest.email || 'N/A')}</td>
                    <td>${window.escapeHtml(guest.phone || 'N/A')}</td>
                    <td class="text-center">${guestReservations.length}</td>
                    <td class="text-right">₼${totalSpent.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        return `
            <p class="report-description">Bu hesabat seçilmiş dövr ərzində birdən çox rezervasiya etmiş qonaqları göstərir.</p>
            <div class="report-body">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th>Qonaq Adı</th>
                            <th>Email</th>
                            <th>Telefon</th>
                            <th class="text-center">Rezervasiya Sayı</th>
                            <th class="text-right">Ümumi Xərclənən</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows : '<tr><td colspan="6" class="text-center">Loyal qonaq tapılmadı.</td></tr>'}
                    </tbody>
                </table>
            </div>
            <style>
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
            </style>
        `;
    }

    // NEW: Generate Payroll Calculation Report
    generatePayrollCalculationReport(data, startDate, endDate, staffId) {
        const staffList = data.staff || [];
        const cashTransactions = data.cashTransactions || [];

        const selectedStaff = staffList.find(s => s.id === staffId);

        if (!selectedStaff) {
            return `
                <div style="text-align: center; padding: 1.5rem; color: var(--text-light);">
                    <i class="fas fa-user-times" style="font-size: 3rem; margin-bottom: 1rem; color: var(--danger-color);"></i>
                    <p>Zəhmət olmasa, əmək haqqını hesablamaq üçün işçi seçin.</p>
                </div>
            `;
        }

        // Store selected staffId for persistence
        localStorage.setItem('reportsComponent_payrollStaffId', staffId);

        const start = new Date(startDate);
        const end = new Date(endDate);
        const totalDaysInPeriod = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        const monthlySalary = selectedStaff.salary || 0;
        const proratedSalary = (monthlySalary / 30) * totalDaysInPeriod; // Assuming 30 days in a month for simplicity

        // Get salary payments within the period
        const salaryPayments = cashTransactions.filter(tx => 
            tx.salaryRecipientId === staffId && tx.category === 'Maaş ödənişi' &&
            tx.date >= startDate && tx.date <= endDate
        );
        const totalPaidInPeriod = salaryPayments.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        // Allow manual input for bonus and deduction (these values won't be saved to DB)
        // Check for existing values from temporary storage if available
        const currentBonus = parseFloat(document.getElementById('payrollBonusInput')?.value) || 0;
        const currentDeduction = parseFloat(document.getElementById('payrollDeductionInput')?.value) || 0;

        const netPayout = (proratedSalary + currentBonus - currentDeduction);

        const paymentsRows = salaryPayments.map((tx, idx) => `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                <td>${window.app.formatDate(tx.date)}</td>
                <td>${tx.description}</td>
                <td>₼${tx.amount.toFixed(2)}</td>
            </tr>
        `).join('');

        return `
            <p class="report-description">Bu hesabat seçilmiş dövr üzrə işçinin əmək haqqını hesablayır, bonusları və kəsilmələr üzərə hesablanması.</p>
            <div class="report-body">
                <div style="background: var(--background-color); padding: 1.2rem; border-radius: 0.75rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">
                    <h4 style="margin-top: 0; color: var(--text-color);"><i class="fas fa-user-circle"></i> İşçi Məlumatları</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
                        <div><strong>Ad Soyad:</strong> ${window.escapeHtml(selectedStaff.name)}</div>
                        <div><strong>Vəzifə:</strong> ${window.escapeHtml(selectedStaff.position)}</div>
                        <div><strong>Şöbə:</strong> ${window.escapeHtml(selectedStaff.department)}</div>
                        <div><strong>Aylıq Əmək haqqı:</strong> ₼${monthlySalary.toFixed(2)}</div>
                        <div><strong>İşə başlama:</strong> ${window.app.formatDate(selectedStaff.startDate)}</div>
                    </div>
                </div>

                <div style="background: var(--primary-light); padding: 1.2rem; border-radius: 0.75rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">
                    <h4 style="margin-top: 0; color: var(--primary-color);"><i class="fas fa-calculator"></i> Hesablama Dövrü</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
                        <div><strong>Dövr:</strong> ${window.app.formatDate(startDate)} - ${window.app.formatDate(endDate)}</div>
                        <div><strong>Dövrdəki Gün Sayı:</strong> ${totalDaysInPeriod} gün</div>
                        <div><strong>Dövr üzrə Hesablanan Maaş:</strong> <span style="font-weight: bold; color: var(--success-color);">₼${proratedSalary.toFixed(2)}</span></div>
                    </div>
                </div>

                <div style="background: var(--warning-color-light); padding: 1.2rem; border-radius: 0.75rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">
                    <h4 style="margin-top: 0; color: var(--warning-color);"><i class="fas fa-plus"></i> Bonus və Kəsilmələr</h4>
                    <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label">Bonus (₼)</label>
                            <input type="number" class="form-input" id="payrollBonusInput" value="${currentBonus.toFixed(2)}" step="0.01" min="0" oninput="window.reportsComponent.updateReportModalContent('payroll_calculation', 'Əmək haqqı Hesablanması')">
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label">Kəsilmə (₼)</label>
                            <input type="number" class="form-input" id="payrollDeductionInput" value="${currentDeduction.toFixed(2)}" step="0.01" min="0" oninput="window.reportsComponent.updateReportModalContent('payroll_calculation', 'Əmək haqqı Hesablanması')">
                        </div>
                    </div>
                </div>

                <div style="background: var(--success-color-light); padding: 1.5rem; border-radius: 0.75rem; text-align: center; margin-bottom: 1.5rem; box-shadow: var(--shadow-md);">
                    <h3 style="margin: 0; color: var(--success-color);">Net Ödəniləcək Məbləğ:</h3>
                    <div style="font-size: 2.8rem; font-weight: 700; color: var(--success-color);">
                        ₼${netPayout.toFixed(2)}
                    </div>
                </div>

                <h4 style="margin-top: 2rem; margin-bottom: 0.8rem; color: var(--text-color);"><i class="fas fa-history"></i> Ödəniş Tarixçəsi (Dövr üzrə)</h4>
                <table class="data-table" style="margin-bottom: 1.5rem;">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th>Tarix</th>
                            <th>Təsvir</th>
                            <th class="text-right">Məbləğ (₼)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentsRows.length ? paymentsRows : '<tr><td colspan="4" class="text-center">Bu dövr üzrə ödəniş yoxdur.</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" class="text-right"><strong>Dövr üzrə Cəmi Ödənilmiş:</strong></td>
                            <td class="text-right"><strong>₼${totalPaidInPeriod.toFixed(2)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <style>
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .report-description { margin-bottom: 1.5rem; color: var(--text-light); }
                .report-filters { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
                .report-filters .form-label { flex-direction: row; align-items: center; gap: 0.5rem; font-weight: normal; }
                .report-filters .form-input { max-width: 150px; }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 0.75rem;
                }
                .summary-item {
                    padding: 0.8rem;
                    border-radius: 0.5rem;
                    text-align: center;
                    border: 1px solid var(--border-color);
                    box-shadow: var(--shadow-sm);
                }
                .summary-item strong {
                    display: block;
                    font-size: 1.2em;
                    margin-bottom: 0.2em;
                    color: var(--text-color);
                }
                .summary-item small {
                    color: var(--text-light);
                    font-size: 0.85em;
                }
                .data-table.compact th, .data-table.compact td {
                    padding: 0.5em 0.8em;
                    font-size: 0.9em;
                }
                .signatures-block {
                    display: flex;
                    justify-content: space-around;
                    margin-top: 3rem;
                    flex-wrap: wrap;
                    gap: 2rem;
                }
                .signature-item {
                    text-align: center;
                    flex: 1;
                    min-width: 150px;
                    max-width: 200px;
                }
                .signature-line {
                    border-bottom: 1px solid var(--border-color);
                    margin-top: 3em;
                    margin-bottom: 0.5em;
                }
                .signature-person {
                    font-weight: 600;
                    margin: 0;
                    color: var(--text-color);
                }
                .signature-label { font-size: 0.8em; color: var(--text-light); }
            </style>
        `;
    }

    // This method will be called by onclick events on report cards
    showReportModal(reportType, reportTitle) {
        // Use stored filter dates
        const reportFilterDates = JSON.parse(localStorage.getItem('reportsComponent_filterDates')) || { startDate: '', endDate: '' };
        let { startDate, endDate } = reportFilterDates;

        // Common filter controls for reports that need date ranges
        const filterControls = `
            <div class="report-filters" style="display:flex;flex-wrap:wrap;align-items:center;gap:0.75rem;margin-bottom:1.5rem;padding:0.9rem 1.1rem;background:var(--background-color, #f8fafc);border-radius:10px;border:1px solid var(--border-color, #e2e8f0);">
                <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="window.reportsComponent.setQuickFilter('today', '${reportType}', '${reportTitle}')">Bu gün</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.reportsComponent.setQuickFilter('week', '${reportType}', '${reportTitle}')">Bu həftə</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.reportsComponent.setQuickFilter('month', '${reportType}', '${reportTitle}')">Bu ay</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.reportsComponent.setQuickFilter('last_month', '${reportType}', '${reportTitle}')">Keçən ay</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.reportsComponent.setQuickFilter('year', '${reportType}', '${reportTitle}')">Bu il</button>
                </div>
                <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-left:auto;">
                    <label style="font-size:0.88em;color:#64748b;display:flex;align-items:center;gap:0.35rem;">
                        Başlanğıc: <input type="date" class="form-input" id="reportStartDate" value="${startDate}" style="padding:0.32rem 0.55rem;font-size:0.9em;max-width:135px;">
                    </label>
                    <label style="font-size:0.88em;color:#64748b;display:flex;align-items:center;gap:0.35rem;">
                        Son: <input type="date" class="form-input" id="reportEndDate" value="${endDate}" style="padding:0.32rem 0.55rem;font-size:0.9em;max-width:135px;">
                    </label>
                    <button class="btn btn-primary btn-sm" onclick="window.reportsComponent.updateReportModalContent('${reportType}', '${reportTitle}')">
                        <i class="fas fa-filter"></i> Yenilə
                    </button>
                </div>
            </div>
        `;

        let content = `<div style="text-align: center; padding: 1.5rem; color: var(--text-light);">
                           <i class="fas fa-flask" style="font-size: 3rem; margin-bottom: 1rem; color: var(--primary-color);"></i>
                           <p>Bu hesabat ${reportTitle} hazırlanma mərhələsindədir. Tezliklə aktiv olacaq!</p>
                       </div>`;
        
        // The report body where content will be rendered
        const reportBody = `<div class="report-body"></div>`;

        const fullContent = `
            <div class="report-content-body" id="reportModalContent">
                ${filterControls}
                ${reportBody}
            </div>
        `;

        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-secondary" onclick="window.reportsComponent.exportReportToExcel('${reportType}')" style="background:#10b981;color:white;border:none;">
                <i class="fas fa-file-excel"></i> Excel (XLSX)
            </button>
            <button class="btn btn-primary" onclick="window.printReport('${reportType}', document.getElementById('reportStartDate')?.value, document.getElementById('reportEndDate')?.value)">
                <i class="fas fa-print"></i> Çap et
            </button>
            <button class="btn btn-secondary" onclick="window.sendReportToTelegram('${reportType}', document.getElementById('reportStartDate')?.value, document.getElementById('reportEndDate')?.value)">
                <i class="fab fa-telegram"></i> Telegram
            </button>
        `;

        window.modalManager.showModal(reportTitle, fullContent, actions);

        // Initial render of the report content for non-handover reports
        this.updateReportModalContent(reportType, reportTitle);
    }

    setQuickFilter(period, reportType, reportTitle) {
        const today = new Date();
        let startDate, endDate;
        if (period === 'today') {
            startDate = today.toISOString().split('T')[0];
            endDate = startDate;
        } else if (period === 'week') {
            const firstDay = new Date(today);
            firstDay.setDate(today.getDate() - today.getDay() + 1);
            const lastDay = new Date(today);
            lastDay.setDate(today.getDate() - today.getDay() + 7);
            startDate = firstDay.toISOString().split('T')[0];
            endDate = lastDay.toISOString().split('T')[0];
        } else if (period === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        } else if (period === 'last_month') {
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
            endDate = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
        } else if (period === 'year') {
            startDate = `${today.getFullYear()}-01-01`;
            endDate = `${today.getFullYear()}-12-31`;
        }
        const sEl = document.getElementById('reportStartDate');
        const eEl = document.getElementById('reportEndDate');
        if (sEl) sEl.value = startDate;
        if (eEl) eEl.value = endDate;
        localStorage.setItem('reportsComponent_filterDates', JSON.stringify({ startDate, endDate }));
        this.updateReportModalContent(reportType, reportTitle);
    }

    exportReportToExcel(reportType) {
        const table = document.querySelector('#reportModalContent table');
        if (!table) {
            window.notificationManager?.showNotification('warning', 'İxrac Xətası', 'Hesabat cədvəli tapılmadı.');
            return;
        }
        if (typeof XLSX === 'undefined') {
            window.notificationManager?.showNotification('warning', 'İxrac Xətası', 'Excel ixrac kitabxanası hazır deyil.');
            return;
        }
        try {
            const wb = XLSX.utils.table_to_book(table, { sheet: "Hesabat" });
            const todayStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `${reportType}_hesabat_${todayStr}.xlsx`);
            window.notificationManager?.showNotification('success', 'Uğurlu', 'Hesabat Excel faylı olaraq yükləndi.');
        } catch (e) {
            console.error('exportReportToExcel error:', e);
            window.notificationManager?.showNotification('error', 'İxrac Xətası', e.message);
        }
    }

    // New: Specific modal for Shift Handover Report to handle staff selection
    showShiftHandoverReportModal() {
        const staff = window.app.data.staff || [];
        const currentUser = window.authManager?.getCurrentUser();
        const currentUserStaff = staff.find(s => s.id === currentUser?.uid || s.email === currentUser?.email);

        const managersAdmins = staff.filter(s => s.role === 'manager' || s.role === 'admin' || s.role === 'superadmin');
        const otherStaff = staff.filter(s => s.id !== currentUserStaff?.id);

        // Pre-select recipient/manager if previously set
        const handoverStaffSelection = JSON.parse(localStorage.getItem('reportsComponent_handoverStaffSelection')) || { recipientId: '', managerId: '' };
        const selectedRecipientId = handoverStaffSelection.recipientId;
        const selectedManagerId = handoverStaffSelection.managerId;

        const filterControls = `
            <div class="report-filters">
                <label class="form-label">Təhvil verən (İcraçı): 
                    <input type="text" class="form-input" id="handoverGiverName" value="${currentUserStaff?.name || currentUser?.email || 'N/A'}" readonly>
                </label>
                <label class="form-label">Təhvil alan: 
                    <select class="form-select" id="handoverRecipientSelect">
                        <option value="">Seçin</option>
                        ${otherStaff.map(s => `<option value="${window.escapeHtml(s.id)}" ${s.id === selectedRecipientId ? 'selected' : ''}>${window.escapeHtml(s.name)}</option>`).join('')}
                    </select>
                </label>
                <label class="form-label">Menecer (imza):
                    <select class="form-select" id="managerSignatureSelect">
                        <option value="">Seçin</option>
                        ${managersAdmins.map(s => `<option value="${s.id}" ${s.id === selectedManagerId ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                </label>
                <button class="btn btn-primary" onclick="window.reportsComponent.updateReportModalContent('shift_handover', 'Növbə Təhvil-Təslimi Hesabatı')">Filterlə</button>
            </div>
        `;

        const reportBody = `<div class="report-body"></div>`; // Placeholder for report content

        const fullContent = `
            <div class="report-content-body" id="reportModalContent">
                ${filterControls}
                ${reportBody}
            </div>
        `;

        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.printReport('shift_handover', null, null, 
                localStorage.getItem('reportsComponent_handoverStaffSelection') ? JSON.parse(localStorage.getItem('reportsComponent_handoverStaffSelection')).recipientId : '', 
                localStorage.getItem('reportsComponent_handoverStaffSelection') ? JSON.parse(localStorage.getItem('reportsComponent_handoverStaffSelection')).managerId : ''
            )">
                <i class="fas fa-print"></i> Çap et
            </button>
            <button class="btn btn-secondary" onclick="window.sendReportToTelegram('shift_handover', null, null, 
                localStorage.getItem('reportsComponent_handoverStaffSelection') ? JSON.parse(localStorage.getItem('reportsComponent_handoverStaffSelection')).recipientId : '', 
                localStorage.getItem('reportsComponent_handoverStaffSelection') ? JSON.parse(localStorage.getItem('reportsComponent_handoverStaffSelection')).managerId : ''
            )">
                <i class="fab fa-telegram"></i> Telegrama göndər
            </button>
        `;

        // Pass initial data to update content on first load
        window.modalManager.showModal('Növbə Təhvil-Təslimi Hesabatı', fullContent, actions);

        // Initial render of the report content
        this.updateReportModalContent('shift_handover', 'Növbə Təhvil-Təslimi Hesabatı');
    }

    // NEW: Specific modal for Payroll Calculation Report
    showPayrollCalculationModal() {
        const staff = window.app.data.staff || [];
        const reportFilterDates = JSON.parse(localStorage.getItem('reportsComponent_filterDates')) || { startDate: '', endDate: '' };
        const selectedStaffId = localStorage.getItem('reportsComponent_payrollStaffId') || '';

        const filterControls = `
            <div class="report-filters">
                <label class="form-label">Başlanğıc Tarix: <input type="date" class="form-input" id="reportStartDate" value="${reportFilterDates.startDate || ''}"></label>
                <label class="form-label">Son Tarix: <input type="date" class="form-input" id="reportEndDate" value="${reportFilterDates.endDate || ''}"></label>
                <label class="form-label">İşçi seçin: 
                    <select class="form-select" id="payrollStaffSelect">
                        <option value="">Hamısı</option>
                        ${staff.map(s => `<option value="${s.id}" ${s.id === selectedStaffId ? 'selected' : ''}>${s.name} (${s.position})</option>`).join('')}
                    </select>
                </label>
                <button class="btn btn-primary" onclick="window.reportsComponent.updateReportModalContent('payroll_calculation', 'Əmək haqqı Hesablanması')">Filterlə</button>
            </div>
        `;

        const reportBody = `<div class="report-body"></div>`; // Placeholder for report content

        const fullContent = `
            <div class="report-content-body" id="reportModalContent">
                ${filterControls}
                ${reportBody}
            </div>
        `;

        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.printReport('payroll_calculation', 
                document.getElementById('reportStartDate').value, 
                document.getElementById('reportEndDate').value,
                document.getElementById('payrollStaffSelect').value
            )">
                <i class="fas fa-print"></i> Çap et
            </button>
            <button class="btn btn-secondary" onclick="window.sendReportToTelegram('payroll_calculation', 
                document.getElementById('reportStartDate').value, 
                document.getElementById('reportEndDate').value,
                document.getElementById('payrollStaffSelect').value
            )">
                <i class="fab fa-telegram"></i> Telegrama göndər
            </button>
        `;

        window.modalManager.showModal('Əmək haqqı Hesablanması', fullContent, actions);

        // Initial render of the report content
        this.updateReportModalContent('payroll_calculation', 'Əmək haqqı Hesablanması');
    }

    // NEW: Generate Shift Handover Report
    generateShiftHandoverReport(data, giverStaffId, recipientStaffId, managerStaffId) {
        const staff = data.staff || [];
        const cashTransactions = data.cashTransactions || [];
        const reservations = data.reservations || [];
        const rooms = data.rooms || [];
        const maintenance = data.maintenance || [];
        const inventory = data.inventory || [];

        const giver = staff.find(s => s.id === giverStaffId);
        const recipient = staff.find(s => s.id === recipientStaffId);
        const manager = staff.find(s => s.id === managerStaffId);

        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);

        // Calculate overall current cash balance for 'main' account
        let overallMainCashBalance = 0;
        if (window.cashComponent && typeof window.cashComponent.getAccountBalances === 'function') {
            const allAccountBalances = window.cashComponent.getAccountBalances(cashTransactions);
            overallMainCashBalance = allAccountBalances.find(acc => acc.id === 'main')?.balance || 0;
        }

        // Summarize cash flow for today (since beginning of day up to now)
        const currentShiftTransactions = cashTransactions.filter(tx => 
            tx.date === today && new Date(`${tx.date}T${tx.time}`) <= now
        );
        const cashIn = currentShiftTransactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const cashOut = currentShiftTransactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const netCash = cashIn - cashOut;

        // Active guests and their total debt
        const activeGuests = reservations.filter(res => 
            res.status === 'confirmed' && res.checkIn <= today && res.checkOut > today
        );
        let totalActiveGuestDebt = 0;
        // Pre-calculate debt
        activeGuests.forEach(res => {
            const remainingBalance = window.app.getReservationFinancialSummary(res.id)?.remainingBalance || 0;
            totalActiveGuestDebt += remainingBalance;
        });

        // Today's arrivals and their total amount
        const todayArrivals = reservations.filter(res => 
            res.checkIn === today && res.status === 'confirmed'
        );
        let totalArrivalsAmount = 0;
        todayArrivals.forEach(res => { totalArrivalsAmount += (res.totalAmount || 0); });

        // Today's departures and their total debt
        const todayDepartures = reservations.filter(res => 
            res.checkOut === today && res.status === 'confirmed'
        );
        let totalDeparturesDebt = 0;
        todayDepartures.forEach(res => {
            const remainingBalance = window.app.getReservationFinancialSummary(res.id)?.remainingBalance || 0;
            totalDeparturesDebt += remainingBalance;
        });
        
        // Next day's breakfast count
        const tomorrowGuests = reservations.filter(res => {
            const checkIn = new Date(res.checkIn);
            checkIn.setHours(0,0,0,0);
            const checkOut = new Date(res.checkOut);
            checkOut.setHours(0,0,0,0);
            const tomorrowDate = new Date(tomorrow);
            tomorrowDate.setHours(0,0,0,0);
            return res.status === 'confirmed' && checkIn <= tomorrowDate && checkOut >= tomorrowDate;
        });
        const tomorrowAdultsCount = tomorrowGuests.reduce((sum, res) => sum + (res.adults || 0), 0);
        const tomorrowChildrenCount = tomorrowGuests.reduce((sum, res) => sum + (res.children || 0), 0);

        // Current room status counts
        const roomsStatusCounts = { occupied: 0, available: 0, maintenance: 0, dirty: 0 };
        const todayDateObj = new Date();
        todayDateObj.setHours(0,0,0,0);
        data.rooms.forEach(room => {
            const statusInfo = window.roomsComponent?.getRoomStatusForDay(room, todayDateObj, data);
            if (roomsStatusCounts[statusInfo.status] !== undefined) {
                roomsStatusCounts[statusInfo.status]++;
            } else if (statusInfo.status === 'pending_reservation') {
                 roomsStatusCounts.occupied++; // Treat pending as occupied for summary
            } else {
                 // Map unknown or detailed status to basic keys if needed
                 if(statusInfo.status === 'maintenance' || statusInfo.status === 'dirty') roomsStatusCounts[statusInfo.status]++;
                 else if (statusInfo.status === 'occupied') roomsStatusCounts.occupied++;
                 else roomsStatusCounts.available++;
            }
        });
        const totalRooms = data.rooms.length;

        // Pending maintenance tasks (no HTML generation yet)
        const pendingMaintenanceTasks = maintenance.filter(task => task.status === 'pending' || task.status === 'in_progress');
        // Low inventory items
        const lowInventoryList = inventory.filter(item => item.quantity <= item.minQuantity);

        return `
            <div class="shift-handover-report">
                <div class="report-header-grid">
                    <div class="header-item">
                        <span class="label">Təhvil Verən</span>
                        <span class="value">${giver?.name || 'N/A'}</span>
                    </div>
                    <div class="header-item">
                        <span class="label">Təhvil Alan</span>
                        <span class="value">${recipient?.name || 'N/A'}</span>
                    </div>
                    <div class="header-item">
                        <span class="label">Tarix</span>
                        <span class="value">${window.app.formatDate(today)}</span>
                    </div>
                    <div class="header-item">
                        <span class="label">Vaxt</span>
                        <span class="value">${currentTime}</span>
                    </div>
                     <div class="header-item">
                        <span class="label">Menecer</span>
                        <span class="value">${manager?.name || 'N/A'}</span>
                    </div>
                </div>

                <div class="report-section-box">
                    <h4 class="section-title"><i class="fas fa-money-bill-wave"></i> Maliyyə İcmalı</h4>
                    <table class="summary-table">
                        <tr>
                            <th>Kassa Qalıq (Əsas)</th>
                            <th>Növbə Gəlir</th>
                            <th>Növbə Xərc</th>
                            <th>Xalis Kassa</th>
                        </tr>
                        <tr>
                            <td style="font-size:1.2em; font-weight:bold;">₼${overallMainCashBalance.toFixed(2)}</td>
                            <td class="positive">₼${cashIn.toFixed(2)}</td>
                            <td class="negative">₼${cashOut.toFixed(2)}</td>
                            <td style="font-weight:bold; color:${netCash >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">₼${netCash.toFixed(2)}</td>
                        </tr>
                    </table>
                </div>

                <div class="report-section-box">
                    <h4 class="section-title"><i class="fas fa-bed"></i> Otaq Statusu</h4>
                    <table class="summary-table room-stats">
                        <tr>
                            <th>Cəmi Otaq</th>
                            <th>Dolu</th>
                            <th>Boş</th>
                            <th>Təmir/Çirkli</th>
                        </tr>
                        <tr>
                            <td>${totalRooms}</td>
                            <td>${roomsStatusCounts.occupied}</td>
                            <td>${roomsStatusCounts.available}</td>
                            <td>${roomsStatusCounts.maintenance + roomsStatusCounts.dirty}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="details-grid">
                    <div class="detail-column">
                        <h5 class="column-title">Cari Qonaqlar (${activeGuests.length})</h5>
                        ${activeGuests.length > 0 ? 
                            `<table class="detail-list-table">
                                <thead><tr><th style="width:30px; text-align:center;">№</th><th>Otaq</th><th>Qonaq</th><th class="text-right">Borc</th></tr></thead>
                                <tbody>
                                ${activeGuests.map((res, idx) => {
                                    const guest = data.guests.find(g => g.id === res.guestId);
                                    const room = rooms.find(r => r.id === res.roomId);
                                    const debt = window.app.getReservationFinancialSummary(res.id)?.remainingBalance || 0;
                                    return `<tr><td style="text-align:center; font-weight:600; color:#64748b;">${idx + 1}</td><td>${room?.number}</td><td>${guest?.name}</td><td class="text-right ${debt>0?'negative':''}">${debt.toFixed(2)}</td></tr>`;
                                }).join('')}
                                </tbody>
                            </table>
                            <div class="total-row text-right">Cəmi Borc: <span class="negative">₼${totalActiveGuestDebt.toFixed(2)}</span></div>`
                        : '<div class="no-data">Qonaq yoxdur</div>'}
                    </div>

                    <div class="detail-column">
                        <h5 class="column-title">Bugünkü Girişlər (${todayArrivals.length})</h5>
                         ${todayArrivals.length > 0 ? 
                            `<table class="detail-list-table">
                                <thead><tr><th style="width:30px; text-align:center;">№</th><th>Otaq</th><th>Qonaq</th><th class="text-right">Məbləğ</th></tr></thead>
                                <tbody>
                                ${todayArrivals.map((res, idx) => {
                                    const guest = data.guests.find(g => g.id === res.guestId);
                                    const room = rooms.find(r => r.id === res.roomId);
                                    return `<tr><td style="text-align:center; font-weight:600; color:#64748b;">${idx + 1}</td><td>${room?.number}</td><td>${guest?.name}</td><td class="text-right">${(res.totalAmount||0).toFixed(2)}</td></tr>`;
                                }).join('')}
                                </tbody>
                            </table>
                             <div class="total-row text-right">Cəmi: ₼${totalArrivalsAmount.toFixed(2)}</div>`
                        : '<div class="no-data">Giriş yoxdur</div>'}
                    </div>
                    
                    <div class="detail-column">
                        <h5 class="column-title">Bugünkü Çıxışlar (${todayDepartures.length})</h5>
                         ${todayDepartures.length > 0 ? 
                            `<table class="detail-list-table">
                                <thead><tr><th style="width:30px; text-align:center;">№</th><th>Otaq</th><th>Qonaq</th><th class="text-right">Borc</th></tr></thead>
                                <tbody>
                                ${todayDepartures.map((res, idx) => {
                                    const guest = data.guests.find(g => g.id === res.guestId);
                                    const room = rooms.find(r => r.id === res.roomId);
                                    const debt = window.app.getReservationFinancialSummary(res.id)?.remainingBalance || 0;
                                    return `<tr><td style="text-align:center; font-weight:600; color:#64748b;">${idx + 1}</td><td>${room?.number}</td><td>${guest?.name}</td><td class="text-right ${debt>0?'negative':''}">${debt.toFixed(2)}</td></tr>`;
                                }).join('')}
                                </tbody>
                            </table>
                             <div class="total-row text-right">Qalan Borc: <span class="negative">₼${totalDeparturesDebt.toFixed(2)}</span></div>`
                        : '<div class="no-data">Çıxış yoxdur</div>'}
                    </div>
                </div>

                <div class="report-section-box" style="margin-top:1rem;">
                     <h4 class="section-title"><i class="fas fa-utensils"></i> Sabah Səhər Yeməyi</h4>
                     <div style="padding:0.5rem; font-size: 0.95em;">
                        <strong>Böyük:</strong> ${tomorrowAdultsCount} nəfər &nbsp;|&nbsp; <strong>Uşaq:</strong> ${tomorrowChildrenCount} nəfər &nbsp;|&nbsp; <strong>Cəmi:</strong> ${tomorrowAdultsCount + tomorrowChildrenCount} nəfər
                     </div>
                </div>

                <div class="report-section-box warnings-box">
                    <h4 class="section-title"><i class="fas fa-exclamation-triangle"></i> Operativ Qeydlər</h4>
                    <div class="warnings-grid">
                        <div class="warning-col">
                            <h6>Gözləyən Tapşırıqlar (${pendingMaintenanceTasks.length})</h6>
                            ${pendingMaintenanceTasks.length > 0 ? 
                                `<ul class="warning-list">
                                    ${pendingMaintenanceTasks.map(t => `<li><b>${t.type}</b> (${rooms.find(r=>r.id===t.roomId)?.number || 'Ümumi'}): ${t.description}</li>`).join('')}
                                </ul>` 
                            : '<span class="no-issues">Tapşırıq yoxdur</span>'}
                        </div>
                        <div class="warning-col">
                            <h6>Az Qalıq Məhsullar (${lowInventoryList.length})</h6>
                            ${lowInventoryList.length > 0 ? 
                                `<ul class="warning-list">
                                    ${lowInventoryList.map(i => `<li>${i.name}: ${i.quantity} ${i.unit} (Min: ${i.minQuantity})</li>`).join('')}
                                </ul>` 
                            : '<span class="no-issues">Problem yoxdur</span>'}
                        </div>
                    </div>
                </div>

                <div class="signature-section">
                    <div class="signature-block">
                        <div class="sig-role">Təhvil Verən</div>
                        <div class="sig-line"></div>
                        <div class="sig-name">${giver?.name || '...................'}</div>
                    </div>
                    <div class="signature-block">
                        <div class="sig-role">Təhvil Alan</div>
                        <div class="sig-line"></div>
                        <div class="sig-name">${recipient?.name || '...................'}</div>
                    </div>
                    <div class="signature-block">
                        <div class="sig-role">Menecer</div>
                        <div class="sig-line"></div>
                        <div class="sig-name">${manager?.name || '...................'}</div>
                    </div>
                </div>
            </div>

            <style>
                /* Report Specific Styles */
                .shift-handover-report { font-family: 'Inter', sans-serif; color: #1f2937; max-width: 100%; margin: 0 auto; }
                
                .report-header-grid { 
                    display: grid; 
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); 
                    gap: 0.5rem; 
                    background: #f8fafc; 
                    padding: 1rem; 
                    border-radius: 8px; 
                    border: 1px solid #e2e8f0;
                    margin-bottom: 1.5rem;
                }
                .header-item { display: flex; flex-direction: column; }
                .header-item .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.2rem; }
                .header-item .value { font-weight: 600; font-size: 0.95rem; color: #111827; }

                .report-section-box { margin-bottom: 1.2rem; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; break-inside: avoid; }
                .section-title { margin: 0 0 0.8rem 0; color: #3b82f6; font-size: 1rem; font-weight: 600; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.4rem; display:flex; align-items:center; gap:0.5rem; }
                
                .summary-table { width: 100%; border-collapse: collapse; text-align: center; margin-top: 0.5rem; }
                .summary-table th { color: #64748b; font-size: 0.8em; font-weight: 600; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }
                .summary-table td { padding: 0.6rem 0.4rem; font-size: 1rem; }
                
                .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
                .detail-column { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.8rem; break-inside: avoid; }
                .column-title { margin: 0 0 0.8rem 0; font-size: 0.9rem; font-weight: 700; color: #374151; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.4rem; }
                
                .detail-list-table { width: 100%; font-size: 0.85rem; border-collapse: collapse; }
                .detail-list-table th { text-align: left; color: #64748b; padding: 4px; border-bottom: 1px solid #e2e8f0; font-weight: 600; }
                .detail-list-table td { padding: 5px 4px; border-bottom: 1px dashed #f1f5f9; vertical-align: top; }
                .detail-list-table tr:last-child td { border-bottom: none; }
                
                .total-row { margin-top: 0.5rem; font-weight: bold; font-size: 0.85rem; border-top: 1px solid #e2e8f0; padding-top: 0.4rem; }
                
                .warnings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .warning-col h6 { margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #ef4444; font-weight: 600; text-transform: uppercase; }
                .warning-list { margin: 0; padding-left: 1.2rem; font-size: 0.85rem; color: #374151; }
            </style>
        `;
    }
}