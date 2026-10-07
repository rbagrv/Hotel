// dashboard-component.js
//
// Modernized, streamlined Hotel PMS Executive Dashboard
// Redundant widgets removed, fast rendering, no automatic reloading loops
//

import RoomsComponent from './rooms-component.js';

export default class DashboardComponent {
    constructor() {
        this.roomsComponent = new RoomsComponent();
        this.clockInterval = null;
    }

    render(data) {
        const today = window.app.getTodayDateString();
        
        const allRooms = data.rooms || [];
        const roomsStatusCounts = {
            occupied: 0,
            available: 0,
            maintenance: 0, 
            dirty: 0,
            pending_reservation: 0
        };

        const todayDateObj = this.roomsComponent.parseDateAsUTC(today); 

        allRooms.forEach(room => {
            const statusInfo = this.roomsComponent.getRoomStatusForDay(room, todayDateObj, data);
            if (roomsStatusCounts[statusInfo.status] !== undefined) {
                roomsStatusCounts[statusInfo.status]++;
            }
        });
        
        const totalRoomsCounted = allRooms.length; 
        const availableInventoryForSale = totalRoomsCounted - (roomsStatusCounts.maintenance + roomsStatusCounts.dirty);
        const occupancyRateCalculated = availableInventoryForSale > 0 ? Math.round((roomsStatusCounts.occupied / availableInventoryForSale) * 100) : 0;
        
        // Today's arrivals, departures and stay-overs
        const todayArrivals = (data.reservations || []).filter(res => 
            res.checkIn === today && (res.status === 'confirmed' || res.status === 'pending')
        );
        const todayDepartures = (data.reservations || []).filter(res => 
            res.checkOut === today && (res.status === 'confirmed' || res.status === 'occupied')
        );

        const activeGuests = (data.reservations || []).filter(res => 
            (res.status === 'occupied' || (res.status === 'confirmed' && res.checkIn <= today)) 
            && res.checkOut > today
        );
        
        const currentGuestsCount = activeGuests.reduce((sum, res) => sum + (res.adults || 0) + (res.children || 0), 0);

        // Revenue & ADR
        const occupiedReservationsActiveTonight = (data.reservations || []).filter(res => 
            res.status === 'occupied' && res.checkIn <= today && res.checkOut > today
        );
        const totalRoomRevenueToday = occupiedReservationsActiveTonight.reduce((sum, res) => {
            const nightlyRate = (res.roomTotal || 0) / (res.nights || 1);
            return sum + nightlyRate;
        }, 0);
        
        const occupiedRoomsCount = roomsStatusCounts.occupied;
        const adr = occupiedRoomsCount > 0 ? (totalRoomRevenueToday / occupiedRoomsCount) : 0;
        const revpar = totalRoomsCounted > 0 ? (totalRoomRevenueToday / totalRoomsCounted) : 0;
        
        const todayCashIncome = (data.cashTransactions || [])
            .filter(t => t.type === 'income' && t.date === today)
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        // Operational alerts
        const pendingMaintenance = (data.maintenance || []).filter(m => 
            m.status === 'pending' || m.status === 'in_progress'
        ).length;
        const lowInventoryItems = (data.inventory || []).filter(item => 
            item.quantity <= item.minQuantity
        ).length;
        const guestsWithDebt = (data.reservations || []).filter(res => {
            if (res.status !== 'occupied' && res.checkOut !== today) return false;
            const summary = window.app?.getReservationFinancialSummary?.(res.id);
            return summary && summary.remainingBalance > 0;
        });

        // Birthdays among active guests
        const todayBirthdays = [];
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentDay = now.getDate();
        activeGuests.forEach(res => {
            const guest = (data.guests || []).find(g => g.id === res.guestId);
            if (guest && guest.birthDate) {
                const parts = guest.birthDate.split('-');
                if (parts.length >= 3) {
                    const m = parseInt(parts[1], 10);
                    const d = parseInt(parts[2], 10);
                    if (m === currentMonth && d === currentDay) {
                        const room = (data.rooms || []).find(r => r.id === res.roomId);
                        todayBirthdays.push({ name: guest.name, roomNumber: room?.number || 'N/A' });
                    }
                }
            }
        });
        
        // Prepare data for charts
        const chartData = this.prepareChartData(data, roomsStatusCounts);
        
        // Render charts once DOM is ready
        setTimeout(() => {
            if (window.chartManager && typeof window.chartManager.initDashboardCharts === 'function') {
                window.chartManager.initDashboardCharts(chartData);
            }
            this.initTeamNotes();
        }, 80);

        return `
            <div class="dashboard-overview" style="display:flex; flex-direction:column; gap:1.25rem;">
                <!-- Modern Quick Action Ribbon with Manual Refresh -->
                <div class="dashboard-quick-actions-bar" style="display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center;">
                    <button class="quick-action-pill primary" onclick="window.modalManager.showReservationForm()">
                        <i class="fas fa-calendar-plus"></i> <span>+ Yeni Rezervasiya</span>
                    </button>
                    <button class="quick-action-pill" onclick="window.guestForm?.openCreateModal ? window.guestForm.openCreateModal() : window.modalManager.showGuestForm()">
                        <i class="fas fa-user-plus"></i> <span>+ Qonaq Qeydiyyatı</span>
                    </button>
                    <button class="quick-action-pill" onclick="window.app.loadModule('rooms')">
                        <i class="fas fa-bed"></i> <span>Otaqlar Paneli</span>
                    </button>
                    <button class="quick-action-pill" onclick="window.app.loadModule('pos')">
                        <i class="fas fa-cash-register"></i> <span>POS Satış</span>
                    </button>
                    <button class="quick-action-pill" onclick="window.modalManager.showCashTransactionForm()">
                        <i class="fas fa-wallet"></i> <span>Kassa Əməliyyatı</span>
                    </button>
                    <button class="quick-action-pill" onclick="window.app.loadModule('reports')">
                        <i class="fas fa-chart-line"></i> <span>Maliyyə Hesabatı</span>
                    </button>
                    <button class="quick-action-pill" style="margin-left:auto; background:#f1f5f9; border-color:#cbd5e1; color:#334155;" onclick="window.dashboardComponent.manualRefresh()" title="Panel məlumatlarını təzələ">
                        <i class="fas fa-sync-alt"></i> <span>Yenilə</span>
                    </button>
                </div>

                <!-- 4 High-Level Key Performance Indicators (No Duplication) -->
                <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
                    <!-- 1. Otaq Doluluğu -->
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-title">Otaq Doluluğu</div>
                            <div class="stat-card-icon" style="background-color: #e0f2fe; color: #0284c7;">
                                <i class="fas fa-bed"></i>
                            </div>
                        </div>
                        <div class="stat-card-value">${occupancyRateCalculated}%</div>
                        <div class="stat-card-change positive" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:#0369a1; font-weight:500;">
                            <i class="fas fa-check-circle"></i>
                            ${roomsStatusCounts.occupied} / ${totalRoomsCounted} otaq dolu
                        </div>
                    </div>

                    <!-- 2. Bugünkü Hərəkət -->
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-title">Bugünkü Hərəkət</div>
                            <div class="stat-card-icon" style="background-color: #fef3c7; color: #d97706;">
                                <i class="fas fa-exchange-alt"></i>
                            </div>
                        </div>
                        <div class="stat-card-value" style="font-size:1.45rem;">
                            <span style="color:#16a34a;">${todayArrivals.length} Giriş</span>
                            <span style="color:#64748b; font-size:1.1rem; margin:0 4px;">•</span>
                            <span style="color:#ea580c;">${todayDepartures.length} Çıxış</span>
                        </div>
                        <div class="stat-card-change positive" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:#475569; font-weight:500;">
                            <i class="fas fa-users"></i>
                            ${activeGuests.length} otaqda ${currentGuestsCount} qonaq qalır
                        </div>
                    </div>

                    <!-- 3. Bugünkü Kassa & Maliyyə -->
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-title">Kassa & Gəlirlilik</div>
                            <div class="stat-card-icon" style="background-color: #dcfce7; color: #16a34a;">
                                <i class="fas fa-wallet"></i>
                            </div>
                        </div>
                        <div class="stat-card-value">₼${todayCashIncome.toFixed(2)}</div>
                        <div class="stat-card-change positive" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:#15803d; font-weight:500;">
                            <i class="fas fa-chart-pie"></i>
                            ADR: ₼${adr.toFixed(2)} | RevPAR: ₼${revpar.toFixed(2)}
                        </div>
                    </div>

                    <!-- 4. Mövcud Otaqlar -->
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-title">Mövcud Otaqlar</div>
                            <div class="stat-card-icon" style="background-color: #f3e8ff; color: #7c3aed;">
                                <i class="fas fa-door-open"></i>
                            </div>
                        </div>
                        <div class="stat-card-value">${roomsStatusCounts.available} Boş</div>
                        <div class="stat-card-change ${roomsStatusCounts.maintenance + roomsStatusCounts.dirty > 0 ? 'negative' : 'positive'}" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:${roomsStatusCounts.maintenance + roomsStatusCounts.dirty > 0 ? '#b91c1c' : '#15803d'}; font-weight:500;">
                            <i class="fas fa-${roomsStatusCounts.maintenance + roomsStatusCounts.dirty > 0 ? 'tools' : 'check'}"></i>
                            ${roomsStatusCounts.maintenance + roomsStatusCounts.dirty > 0 ? `${roomsStatusCounts.maintenance + roomsStatusCounts.dirty} otaq təmirdə/təmizlikdə` : 'Bütün otaqlar hazır'}
                        </div>
                    </div>
                </div>

                <!-- Main Split Layout: Left (Operations & Trend), Right (Status, Alerts & Logbook) -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.25rem; align-items:start;">
                    
                    <!-- LEFT COLUMN: Today's Operational Events & Trend -->
                    <div style="display:flex; flex-direction:column; gap:1.25rem;">
                        ${this.renderTodayEvents(todayArrivals, todayDepartures, activeGuests, data)}
                        
                        <div class="operational-card chart-card">
                            <div class="card-header">
                                <h5 class="card-title"><i class="fas fa-chart-line" style="color:#0284c7; margin-right:0.4rem;"></i> Rezervasiya Dinamikası (Son 6 Ay)</h5>
                            </div>
                            <div class="chart-container" style="height: 270px;">
                                <canvas id="reservationsChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT COLUMN: Room Occupancy Doughnut, Operational Alerts & Logbook -->
                    <div style="display:flex; flex-direction:column; gap:1.25rem;">
                        <!-- Room Status Doughnut -->
                        <div class="operational-card chart-card">
                            <div class="card-header">
                                <h5 class="card-title"><i class="fas fa-pie-chart" style="color:#16a34a; margin-right:0.4rem;"></i> Cari Otaq Statusu</h5>
                            </div>
                            <div class="chart-container" style="height: 220px;">
                                <canvas id="occupancyChart"></canvas>
                            </div>
                        </div>

                        <!-- Operational Alerts -->
                        <div class="operational-card">
                            <div class="card-header">
                                <h5 class="card-title"><i class="fas fa-bell" style="color:#d97706; margin-right:0.4rem;"></i> Əməliyyat Xəbərdarlıqları</h5>
                            </div>
                            <div class="alert-list" style="display:flex; flex-direction:column; gap:0.5rem;">
                                <div class="alert-item" onclick="window.app.loadModule('maintenance')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <i class="fas fa-tools alert-icon warning" style="color:#d97706;"></i>
                                        <span style="font-size:0.875rem; font-weight:500;">Gözləyən Təmir / Təmizlik</span>
                                    </div>
                                    <span class="alert-count warning" style="background:#fef3c7; color:#92400e; padding:0.2rem 0.6rem; border-radius:9999px; font-weight:700; font-size:0.8rem;">${pendingMaintenance}</span>
                                </div>

                                <div class="alert-item" onclick="window.app.loadModule('inventory')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <i class="fas fa-boxes alert-icon danger" style="color:#dc2626;"></i>
                                        <span style="font-size:0.875rem; font-weight:500;">Bitmək Üzrə Olan Məhsullar</span>
                                    </div>
                                    <span class="alert-count danger" style="background:#fee2e2; color:#991b1b; padding:0.2rem 0.6rem; border-radius:9999px; font-weight:700; font-size:0.8rem;">${lowInventoryItems}</span>
                                </div>

                                <div class="alert-item" onclick="window.app.loadModule('reservations')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <i class="fas fa-file-invoice-dollar alert-icon danger" style="color:#dc2626;"></i>
                                        <span style="font-size:0.875rem; font-weight:500;">Borclu Çıxışlar / Qonaqlar</span>
                                    </div>
                                    <span class="alert-count danger" style="background:#fee2e2; color:#991b1b; padding:0.2rem 0.6rem; border-radius:9999px; font-weight:700; font-size:0.8rem;">${guestsWithDebt.length}</span>
                                </div>

                                ${todayBirthdays.length > 0 ? `
                                    <div class="alert-item" onclick="window.app.loadModule('guests')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; border-radius:8px; background:#fdf2f8; border:1px solid #fbcfe8;">
                                        <div style="display:flex; align-items:center; gap:0.6rem;">
                                            <i class="fas fa-birthday-cake" style="color:#db2777;"></i>
                                            <span style="font-size:0.875rem; font-weight:600; color:#9d174d;">Bugün Ad Günü Olan Qonaq:</span>
                                        </div>
                                        <span style="font-size:0.8rem; color:#831843; font-weight:700;">${todayBirthdays.map(b => `${b.name} (${b.roomNumber})`).join(', ')} 🎂</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Team Notes (Logbook) -->
                        <div class="operational-card">
                            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                                <h5 class="card-title"><i class="fas fa-clipboard" style="color:#7c3aed; margin-right:0.4rem;"></i> Növbə Qeydləri (Logbook)</h5>
                                <button class="btn btn-primary btn-sm" onclick="window.dashboardComponent.saveTeamNotes()" style="padding:0.25rem 0.6rem; font-size:0.75rem;">Yadda saxla</button>
                            </div>
                            <textarea id="dashboardTeamNotes" class="form-textarea" rows="3" placeholder="Növbə üçün qeydlər..." style="resize:vertical; border-color: #e2e8f0; width:100%; font-size:0.85rem; padding:0.5rem;"></textarea>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    manualRefresh() {
        if (window.app) {
            window.app.loadModule('dashboard', { fromHistory: true });
            window.notificationManager?.showNotification('info', 'Yeniləndi', 'Əsas panel məlumatları yeniləndi.', 2000);
        }
    }

    prepareChartData(data, roomsStatusCounts) {
        const occupancyData = {
            labels: ['Dolu', 'Boş', 'Təmir/Təmizlik'],
            data: [
                roomsStatusCounts.occupied, 
                roomsStatusCounts.available, 
                roomsStatusCounts.maintenance + roomsStatusCounts.dirty
            ]
        };

        const reservations = data.reservations || [];
        const monthLabels = [];
        const reservationCounts = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const month = date.toLocaleString('az-AZ', { month: 'short' });
            const year = date.getFullYear();
            monthLabels.push(`${month} ${year}`);

            const count = reservations.filter(res => {
                const resDate = new Date(res.createdAt || res.checkIn);
                return resDate.getFullYear() === year && resDate.getMonth() === date.getMonth();
            }).length;
            reservationCounts.push(count);
        }

        const reservationsTrendData = {
            labels: monthLabels,
            data: reservationCounts
        };
        
        return { occupancyData, reservationsTrendData };
    }

    renderTodayEvents(todayArrivals, todayDepartures, activeGuests, data) {
        const renderList = (items, type) => {
            if (items.length === 0) {
                return `<p class="no-data" style="text-align:center; padding:1.5rem; color:#64748b; font-size:0.875rem;">Bu gün ${type === 'arrival' ? 'giriş' : type === 'departure' ? 'çıxış' : 'qalan qonaq'} yoxdur.</p>`;
            }
            return items.slice(0, 6).map(res => {
                const guest = (data.guests || []).find(g => g.id === res.guestId);
                const room = (data.rooms || []).find(rm => rm.id === res.roomId);
                const financialSummary = window.app?.getReservationFinancialSummary?.(res.id);
                const debt = financialSummary?.remainingBalance || 0;
                return `
                    <div class="event-item" onclick="window.modalManager.showReservationDetails('${window.escapeHtml(res.id)}')" style="display:flex; justify-content:space-between; align-items:center; padding:0.65rem 0.85rem; border-bottom:1px solid #f1f5f9; cursor:pointer;">
                        <div class="event-guest-info" style="display:flex; flex-direction:column;">
                            <span class="guest-name" style="font-weight:600; color:#1e293b; font-size:0.9rem;">${window.escapeHtml(guest?.name || 'N/A')}</span>
                            <span class="room-info" style="color:#64748b; font-size:0.78rem;">Otaq ${window.escapeHtml(room?.number || 'N/A')} • ${res.checkIn} - ${res.checkOut}</span>
                        </div>
                        <div class="event-status">
                            ${debt > 0 ? `<span class="debt-badge" style="background:#fee2e2; color:#991b1b; padding:0.2rem 0.5rem; border-radius:6px; font-size:0.75rem; font-weight:600;">Borc: ₼${debt.toFixed(2)}</span>` : `<span class="paid-badge" style="background:#dcfce7; color:#166534; padding:0.2rem 0.5rem; border-radius:6px; font-size:0.75rem; font-weight:600;">Ödənilib</span>`}
                        </div>
                    </div>
                `;
            }).join('');
        };
        
        return `
            <div class="operational-card">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:0.75rem;">
                    <h5 class="card-title"><i class="fas fa-calendar-day" style="color:#0284c7; margin-right:0.4rem;"></i> Bugünkü Əməliyyat Axını</h5>
                </div>
                <div class="tabs" style="display:flex; gap:0.4rem; padding:0.6rem 0.75rem; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                    <button class="tab-button active" data-tab="arrivals" onclick="window.dashboardComponent.switchTab('arrivals')" style="padding:0.35rem 0.75rem; font-size:0.8rem; font-weight:600; border-radius:6px; border:none; cursor:pointer;">Girişlər (${todayArrivals.length})</button>
                    <button class="tab-button" data-tab="departures" onclick="window.dashboardComponent.switchTab('departures')" style="padding:0.35rem 0.75rem; font-size:0.8rem; font-weight:600; border-radius:6px; border:none; cursor:pointer;">Çıxışlar (${todayDepartures.length})</button>
                    <button class="tab-button" data-tab="active" onclick="window.dashboardComponent.switchTab('active')" style="padding:0.35rem 0.75rem; font-size:0.8rem; font-weight:600; border-radius:6px; border:none; cursor:pointer;">Hazırda Qalanlar (${activeGuests.length})</button>
                </div>
                <div class="tab-content active" id="arrivals-content">
                    ${renderList(todayArrivals, 'arrival')}
                </div>
                <div class="tab-content" id="departures-content" style="display:none;">
                    ${renderList(todayDepartures, 'departure')}
                </div>
                <div class="tab-content" id="active-content" style="display:none;">
                    ${renderList(activeGuests, 'active')}
                </div>
            </div>
        `;
    }

    switchTab(tabKey) {
        document.querySelectorAll('.dashboard-overview .tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabKey);
            btn.style.background = btn.dataset.tab === tabKey ? '#0284c7' : 'transparent';
            btn.style.color = btn.dataset.tab === tabKey ? '#ffffff' : '#475569';
        });
        const tabs = ['arrivals', 'departures', 'active'];
        tabs.forEach(t => {
            const el = document.getElementById(`${t}-content`);
            if (el) el.style.display = (t === tabKey) ? 'block' : 'none';
        });
    }

    initTeamNotes() {
        const textarea = document.getElementById('dashboardTeamNotes');
        if (textarea) {
            const notes = window.app?.getSetting?.('dashboardNotes') || '';
            textarea.value = notes;
        }
    }

    async saveTeamNotes() {
        const textarea = document.getElementById('dashboardTeamNotes');
        if (!textarea) return;
        const notes = textarea.value;
        try {
            await window.app?.saveSetting?.('dashboardNotes', notes);
            window.notificationManager?.showNotification('success', 'Qeyd saxlandı', 'Komanda qeydləri yeniləndi.');
        } catch (e) {
            window.notificationManager?.showNotification('error', 'Xəta', 'Qeydlər saxlanmadı: ' + e.message);
        }
    }
}

window.DashboardComponent = DashboardComponent;