// dashboard-component.js
//
// Dashboards
//
// EXPORT: export default DashboardComponent;
//

import RoomsComponent from './rooms-component.js'; // Import RoomsComponent

export default class DashboardComponent {
    constructor() {
        console.log('DashboardComponent instance is being created...');
        // The constructor is now simplified. All app-level initialization
        // has been moved to the HotelPMS class in app.js.
        this.roomsComponent = new RoomsComponent();
        this.clockInterval = null;
    }

    render(data) {
        // Use app's utility function to get today's date consistently
        const today = window.app.getTodayDateString();
        const tomorrow = window.app.getTomorrowDateString();
        
        const allRooms = data.rooms || [];
        const roomsStatusCounts = {
            occupied: 0,
            available: 0,
            maintenance: 0, 
            dirty: 0,
            pending_reservation: 0 // ADDED: Count rooms with pending reservations
        };

        // Use the authoritative logic from RoomsComponent.getRoomStatusForDay
        // FIX: Ensure the comparison date passed to getRoomStatusForDay is consistently generated 
        // using the UTC-based parsing logic from rooms-component.js to match how reservation dates are parsed.
        const todayDateObj = this.roomsComponent.parseDateAsUTC(today); 

        allRooms.forEach(room => {
            const statusInfo = this.roomsComponent.getRoomStatusForDay(room, todayDateObj, data);
            if (roomsStatusCounts[statusInfo.status] !== undefined) {
                roomsStatusCounts[statusInfo.status]++;
            }
        });
        
        const totalRoomsCounted = allRooms.length; 
        
        // Calculate the total rooms available for sale (excluding maintenance/dirty rooms)
        const availableInventoryForSale = totalRoomsCounted - (roomsStatusCounts.maintenance + roomsStatusCounts.dirty);
        
        // Occupancy Rate: (Confirmed occupied / Available Inventory for Sale) * 100
        const occupancyRateCalculated = availableInventoryForSale > 0 ? Math.round((roomsStatusCounts.occupied / availableInventoryForSale) * 100) : 0;
        
        // Today's arrivals and departures
        const todayArrivals = data.reservations.filter(res => 
            res.checkIn === today && (res.status === 'confirmed' || res.status === 'pending')
        );
        const todayDepartures = data.reservations.filter(res => 
            res.checkOut === today && (res.status === 'confirmed' || res.status === 'occupied')
        );

        // Active guests (stay-overs)
        // FIX: Broaden the definition of actively staying guests to include confirmed reservations
        // whose check-in date has passed or is today, and check-out is tomorrow or later.
        const activeGuests = data.reservations.filter(res => 
            (res.status === 'occupied' || (res.status === 'confirmed' && res.checkIn <= today)) 
            && res.checkOut > today
        );
        
        // --- NEW CALCULATIONS FOR NEW CARDS ---

        // 1. Current Guests Count
        const currentGuestsCount = activeGuests.reduce((sum, res) => sum + (res.adults || 0) + (res.children || 0), 0);

        // 2. Tomorrow's Breakfast Count
        const tomorrowGuestsForBreakfast = activeGuests; // Guests staying tonight need breakfast tomorrow
        const tomorrowAdults = tomorrowGuestsForBreakfast.reduce((sum, res) => sum + (res.adults || 0), 0);
        const tomorrowChildren = tomorrowGuestsForBreakfast.reduce((sum, res) => sum + (res.children || 0), 0);
        const tomorrowBreakfastTotal = tomorrowAdults + tomorrowChildren;

        // 3. ADR and RevPAR for Today
        const occupiedReservationsActiveTonight = data.reservations.filter(res => 
            res.status === 'occupied' && res.checkIn <= today && res.checkOut > today
        );
        
        const totalRoomRevenueToday = occupiedReservationsActiveTonight.reduce((sum, res) => {
            const nightlyRate = (res.roomTotal || 0) / (res.nights || 1);
            return sum + nightlyRate;
        }, 0);
        
        const occupiedRoomsCount = roomsStatusCounts.occupied;
        const adr = occupiedRoomsCount > 0 ? (totalRoomRevenueToday / occupiedRoomsCount) : 0;
        const revpar = totalRoomsCounted > 0 ? (totalRoomRevenueToday / totalRoomsCounted) : 0;
        
        // --- END NEW CALCULATIONS ---

        // Financial metrics
        const todayCashIncome = data.cashTransactions
            .filter(t => t.type === 'income' && t.date === today)
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        // Staff and operational metrics
        const activeStaff = data.staff.filter(s => s.status === 'active').length;
        const pendingMaintenance = data.maintenance.filter(m => 
            m.status === 'pending' || m.status === 'in_progress'
        ).length;
        const lowInventoryItems = data.inventory.filter(item => 
            item.quantity <= item.minQuantity
        ).length;
        
        // Prepare data for charts
        const chartData = this.prepareChartData(data, roomsStatusCounts);
        
        // Defer chart rendering until after this component has been added to the DOM
        setTimeout(() => {
            if (window.chartManager && typeof window.chartManager.initDashboardCharts === 'function') {
                window.chartManager.initDashboardCharts(chartData);
            }
            // Initialize Team Notes textarea
            this.initTeamNotes();
        }, 100);

        // Defer clock initialization until after render
        setTimeout(() => this.initClock(), 0);

        setTimeout(() => this.initFirebaseLoadCircle(), 0);

        const newReservationsCount = (data.reservations || []).filter(r => r.status === 'pending' || r.status === 'new').length;
        const confirmedReservationsCount = (data.reservations || []).filter(r => r.status === 'confirmed').length;
        const checkedInCount = roomsStatusCounts.occupied;
        const checkedOutCount = (data.reservations || []).filter(r => r.checkOut === today && r.status === 'checkout').length;
        const totalActiveReservations = (data.reservations || []).filter(r => r.status !== 'cancelled').length;

        return `
            <div class="dashboard-overview">
                <!-- HotelFriend Style Top Overview Banner -->
                <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.25rem;">
                    <!-- Reservations Ring Card -->
                    <div class="stat-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div class="stat-card-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:0.75rem;">
                            <span style="font-weight:700; font-size:1rem; color:#1e293b;">Rezervasiyalar</span>
                            <button class="btn btn-primary" onclick="window.modalManager.showReservationForm()" style="padding:0.25rem 0.6rem; font-size:0.8rem; border-radius:4px;">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:1rem 0; gap:1.5rem; flex-wrap:wrap;">
                            <div style="position:relative; width:110px; height:110px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                <svg viewBox="0 0 36 36" style="width:100%; height:100%; transform:rotate(-90deg);">
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" stroke-width="4.5"></circle>
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#0088cc" stroke-width="4.5" stroke-dasharray="${Math.min(100, (totalActiveReservations * 8))}, 100" stroke-linecap="round"></circle>
                                </svg>
                                <div style="position:absolute; text-align:center;">
                                    <span style="font-size:1.6rem; font-weight:800; color:#1e293b;">${totalActiveReservations}</span>
                                </div>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.6rem 1.2rem; flex:1; font-size:0.82rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span><i class="fas fa-circle" style="color:#f59e0b; font-size:0.5rem; margin-right:4px;"></i> Gözləyir</span>
                                    <strong>${newReservationsCount}</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span><i class="fas fa-circle" style="color:#0088cc; font-size:0.5rem; margin-right:4px;"></i> Təsdiqlənib</span>
                                    <strong>${confirmedReservationsCount}</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span><i class="fas fa-circle" style="color:#06b6d4; font-size:0.5rem; margin-right:4px;"></i> Giriş gözlənir</span>
                                    <strong>${todayArrivals.length}</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span><i class="fas fa-circle" style="color:#22c55e; font-size:0.5rem; margin-right:4px;"></i> Yerləşib</span>
                                    <strong>${checkedInCount}</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span><i class="fas fa-circle" style="color:#ef4444; font-size:0.5rem; margin-right:4px;"></i> Çıxış gözlənir</span>
                                    <strong>${todayDepartures.length}</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span><i class="fas fa-circle" style="color:#94a3b8; font-size:0.5rem; margin-right:4px;"></i> Çıxış edib</span>
                                    <strong>${checkedOutCount}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Guest Management Split Card -->
                    <div class="stat-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div class="stat-card-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:0.75rem;">
                            <span style="font-weight:700; font-size:1rem; color:#1e293b;">Qonaq İdarəetməsi</span>
                            <span style="font-size:0.78rem; color:#64748b;">Bugünkü statistika</span>
                        </div>
                        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.5rem; padding:0.8rem 0;">
                            <div style="border:1px solid #e2e8f0; border-radius:6px; padding:0.75rem; text-align:center; background:#fafafa;">
                                <div style="font-size:0.74rem; font-weight:600; color:#22c55e; margin-bottom:0.25rem;">
                                    <i class="fas fa-sign-in-alt"></i> Girişlər
                                </div>
                                <div style="font-size:1.4rem; font-weight:800; color:#1e293b;">${todayArrivals.length}</div>
                                <div style="font-size:0.7rem; color:#94a3b8;">${todayArrivals.length > 0 ? 'gözlənilən' : 'yoxdur'}</div>
                            </div>
                            <div style="border:1px solid #e2e8f0; border-radius:6px; padding:0.75rem; text-align:center; background:#fafafa;">
                                <div style="font-size:0.74rem; font-weight:600; color:#f59e0b; margin-bottom:0.25rem;">
                                    <i class="fas fa-sign-out-alt"></i> Çıxışlar
                                </div>
                                <div style="font-size:1.4rem; font-weight:800; color:#1e293b;">${todayDepartures.length}</div>
                                <div style="font-size:0.7rem; color:#94a3b8;">${todayDepartures.length > 0 ? 'gözlənilən' : 'yoxdur'}</div>
                            </div>
                            <div style="border:1px solid #e2e8f0; border-radius:6px; padding:0.75rem; text-align:center; background:#fafafa;">
                                <div style="font-size:0.74rem; font-weight:600; color:#0088cc; margin-bottom:0.25rem;">
                                    <i class="fas fa-bed"></i> Qalanlar
                                </div>
                                <div style="font-size:1.4rem; font-weight:800; color:#1e293b;">${activeGuests.length}</div>
                                <div style="font-size:0.7rem; color:#94a3b8;">${currentGuestsCount} qonaq</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Primary Stats Grid -->
                <div class="dashboard-grid">
                    ${this.renderPrimaryStats(totalRoomsCounted, roomsStatusCounts.occupied, roomsStatusCounts.available, roomsStatusCounts.maintenance + roomsStatusCounts.dirty, occupancyRateCalculated)}
                </div>

                <!-- NEW: Additional Statistics Grid -->
                <div class="dashboard-grid">
                    ${this.renderAdditionalStats(currentGuestsCount, tomorrowBreakfastTotal, adr, revpar, tomorrowAdults, tomorrowChildren)}
                </div>

                <div class="dashboard-grid" style="grid-template-columns: 1fr;">
                    <div class="operational-card">
                        <div class="card-header">
                            <h5 class="card-title"><i class="fas fa-clipboard"></i> Komanda Qeydləri (Logbook)</h5>
                        </div>
                        <textarea id="dashboardTeamNotes" class="form-textarea" rows="3" placeholder="Növbə üçün qeydləri bura yazın..." style="resize:vertical; border-color: #e2e8f0;"></textarea>
                        <div style="text-align:right; margin-top:0.5rem;">
                            <button class="btn btn-primary btn-sm" onclick="window.dashboardComponent.saveTeamNotes()">Yadda saxla</button>
                        </div>
                    </div>
                </div>

                <!-- Today's Events & Financials -->
                <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); align-items: flex-start;">
                    ${this.renderTodayEvents(todayArrivals, todayDepartures, activeGuests, data)}
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        ${this.renderFinancialSnapshot(todayCashIncome)}
                        ${this.renderAlerts(pendingMaintenance, lowInventoryItems, data)}
                    </div>
                </div>

                <!-- Birthday Notification Board -->
                ${this.renderBirthdayBoard(data, activeGuests)}

                <!-- Charts -->
                <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); align-items: flex-start;">
                    <div class="operational-card chart-card">
                         <div class="card-header">
                            <h5 class="card-title">Son 6 Ayın Rezervasiya Trendi</h5>
                        </div>
                        <div class="chart-container" style="height: 300px;">
                            <canvas id="reservationsChart"></canvas>
                        </div>
                    </div>
                     <div class="operational-card chart-card">
                        <div class="card-header">
                            <h5 class="card-title">Cari Otaq Vəziyyəti</h5>
                        </div>
                        <div class="chart-container" style="height: 300px;">
                            <canvas id="occupancyChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    initClock() {
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }
        this.updateClock(); // Initial call to display time immediately
        this.clockInterval = setInterval(() => this.updateClock(), 1000);
    }

    initFirebaseLoadCircle() {
        this.updateFirebaseLoadCircle();
        if (!this._loadCircleListener) {
            this._loadCircleListener = () => this.updateFirebaseLoadCircle();
            window.addEventListener('firebase-load-progress', this._loadCircleListener);
        }
    }

    updateFirebaseLoadCircle() {
        const fillEl = document.getElementById('firebaseLoadFill');
        const percentEl = document.getElementById('firebaseLoadPercent');
        if (!fillEl || !percentEl) return;

        let percent = 0;
        if (window.hybridDB && typeof window.hybridDB.getFirebaseLoadPercentage === 'function') {
            percent = window.hybridDB.getFirebaseLoadPercentage();
        }
        percent = Math.max(0, Math.min(100, percent));

        const circumference = 100.48; // 2 * PI * 16
        const offset = circumference * (1 - percent / 100);
        fillEl.style.strokeDasharray = `${circumference}`;
        fillEl.style.strokeDashoffset = `${offset}`;
        percentEl.textContent = `${percent}%`;
    }

    updateClock() {
        const timeEl = document.querySelector('#dashboard-clock .clock-time');
        const dateEl = document.querySelector('#dashboard-clock .clock-date');

        if (!timeEl || !dateEl) {
            if (this.clockInterval) clearInterval(this.clockInterval);
            return;
        }

        const now = new Date();
        const timeString = now.toLocaleTimeString('az-AZ', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const dateString = now.toLocaleDateString('az-AZ', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        timeEl.textContent = timeString;
        dateEl.textContent = dateString;
    }

    prepareChartData(data, roomsStatusCounts) {
        // 1. Occupancy Chart Data
        const occupancyData = {
            labels: ['Dolu', 'Boş', 'Təmir/Təmizlik'],
            data: [
                roomsStatusCounts.occupied, 
                roomsStatusCounts.available, 
                roomsStatusCounts.maintenance + roomsStatusCounts.dirty
            ]
        };

        // 2. Reservations Chart Data (Last 6 Months)
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

    renderPrimaryStats(totalRooms, occupiedRooms, availableRooms, maintenanceAndDirtyRooms, occupancyRate) {
        return `
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">Otaq Doluluğu</div>
                    <div class="stat-card-icon" style="background-color: #e8f0fe; color: #005cbb;">
                        <span class="material-icons-outlined">hotel</span>
                    </div>
                </div>
                <div class="stat-card-value">${String(occupancyRate)}%</div>
                <div class="stat-card-change positive" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:#1b873f; font-weight:500;">
                    <span class="material-icons-outlined" style="font-size:16px;">trending_up</span>
                    ${occupiedRooms}/${totalRooms} otaq dolu
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">Boş Otaqlar</div>
                    <div class="stat-card-icon" style="background-color: #e6f6ec; color: #1b873f;">
                        <span class="material-icons-outlined">meeting_room</span>
                    </div>
                </div>
                <div class="stat-card-value">${availableRooms}</div>
                <div class="stat-card-change positive" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:#1b873f; font-weight:500;">
                    <span class="material-icons-outlined" style="font-size:16px;">check_circle</span>
                    Rezerv üçün hazır
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">Təmir / Təmizlik</div>
                    <div class="stat-card-icon" style="background-color: #fef5ea; color: #e67e22;">
                        <span class="material-icons-outlined">cleaning_services</span>
                    </div>
                </div>
                <div class="stat-card-value">${maintenanceAndDirtyRooms}</div>
                <div class="stat-card-change ${maintenanceAndDirtyRooms > 0 ? 'negative' : 'positive'}" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:${maintenanceAndDirtyRooms > 0 ? '#ba1a1a' : '#1b873f'}; font-weight:500;">
                    <span class="material-icons-outlined" style="font-size:16px;">${maintenanceAndDirtyRooms > 0 ? 'warning' : 'check_circle'}</span>
                    ${maintenanceAndDirtyRooms > 0 ? 'Diqqət tələb edir' : 'Hamısı hazır'}
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">Cəmi Otaqlar</div>
                    <div class="stat-card-icon" style="background-color: #f3e8ff; color: #7c3aed;">
                        <span class="material-icons-outlined">apartment</span>
                    </div>
                </div>
                <div class="stat-card-value">${totalRooms}</div>
                <div class="stat-card-change positive" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:#565f71; font-weight:500;">
                    <span class="material-icons-outlined" style="font-size:16px;">info</span>
                    Ümumi hotel tutumu
                </div>
            </div>
        `;
    }

    renderAdditionalStats(currentGuests, breakfastTotal, adr, revpar, breakfastAdults, breakfastChildren) {
        return `
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">Cari Qonaq Sayı</div>
                    <div class="stat-card-icon" style="background-color: #e0f7fa; color: #006874;">
                        <span class="material-icons-outlined">groups</span>
                    </div>
                </div>
                <div class="stat-card-value">${currentGuests}</div>
                <div class="stat-card-change positive" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:#006874; font-weight:500;">
                    <span class="material-icons-outlined" style="font-size:16px;">person_pin</span>
                    Hazırda oteldə qalanlar
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">Sabahkı Səhər Yeməyi</div>
                    <div class="stat-card-icon" style="background-color: #fce4ec; color: #c2185b;">
                        <span class="material-icons-outlined">restaurant</span>
                    </div>
                </div>
                <div class="stat-card-value">${breakfastTotal}</div>
                <div class="stat-card-change positive" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:#565f71; font-weight:500;">
                    <span class="material-icons-outlined" style="font-size:16px;">free_breakfast</span>
                    Böyük: ${breakfastAdults}, Uşaq: ${breakfastChildren}
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">ADR (Orta Gecəlik)</div>
                    <div class="stat-card-icon" style="background-color: #fff3e0; color: #ef6c00;">
                        <span class="material-icons-outlined">payments</span>
                    </div>
                </div>
                <div class="stat-card-value">₼${adr.toFixed(2)}</div>
                <div class="stat-card-change positive" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:#565f71; font-weight:500;">
                    <span class="material-icons-outlined" style="font-size:16px;">equalizer</span>
                    Dolu otaq başına orta gəlir
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">RevPAR (Otaq Başına)</div>
                    <div class="stat-card-icon" style="background-color: #e8f5e9; color: #2e7d32;">
                        <span class="material-icons-outlined">query_stats</span>
                    </div>
                </div>
                <div class="stat-card-value">₼${revpar.toFixed(2)}</div>
                <div class="stat-card-change positive" style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:#2e7d32; font-weight:500;">
                    <span class="material-icons-outlined" style="font-size:16px;">trending_up</span>
                    Bütün otaqlar üzrə gəlirlilik
                </div>
        `;
    }

    renderTodayEvents(todayArrivals, todayDepartures, activeGuests, data) {
        const renderList = (items, type) => {
            if (items.length === 0) {
                return `<p class="no-data">Bu gün ${type === 'arrival' ? 'giriş' : type === 'departure' ? 'çıxış' : 'qalan qonaq'} yoxdur.</p>`;
            }
            return items.slice(0, 5).map(res => {
                const guest = data.guests.find(g => g.id === res.guestId);
                const room = data.rooms.find(rm => rm.id === res.roomId);
                const financialSummary = window.app.getReservationFinancialSummary(res.id);
                const debt = financialSummary?.remainingBalance || 0;
                return `
                    <div class="event-item" onclick="window.modalManager.showReservationDetails('${window.escapeHtml(res.id)}')">
                        <div class="event-guest-info">
                            <span class="guest-name">${window.escapeHtml(guest?.name || 'N/A')}</span>
                            <span class="room-info">Otaq ${window.escapeHtml(room?.number || 'N/A')}</span>
                        </div>
                        <div class="event-status">
                             ${debt > 0 ? `<span class="debt-badge">Borc: ₼${debt.toFixed(2)}</span>` : `<span class="paid-badge">Ödənilib</span>`}
                        </div>
                    </div>
                `;
            }).join('');
        };
        
        return `
            <div class="operational-card">
                <div class="card-header">
                    <h5 class="card-title">Bugünkü Hadisələr</h5>
                </div>
                <div class="tabs">
                    <button class="tab-button active" data-tab="arrivals" onclick="window.dashboardComponent.navigateToReservationsFiltered('arrivals')">Girişlər (${todayArrivals.length})</button>
                    <button class="tab-button" data-tab="departures" onclick="window.dashboardComponent.navigateToReservationsFiltered('departures')">Çıxışlar (${todayDepartures.length})</button>
                    <button class="tab-button" data-tab="active" onclick="window.dashboardComponent.navigateToReservationsFiltered('active')">Qalanlar (${activeGuests.length})</button>
                </div>
                <div class="tab-content active" id="arrivals-content">
                    ${renderList(todayArrivals, 'arrival')}
                </div>
                <div class="tab-content" id="departures-content">
                    ${renderList(todayDepartures, 'departure')}
                </div>
                 <div class="tab-content" id="active-content">
                    ${renderList(activeGuests, 'active')}
                </div>
            </div>
             <script>
                document.querySelectorAll('.dashboard-overview .tab-button').forEach(button => {
                    button.addEventListener('click', () => {
                        const tabId = button.dataset.tab;
                        document.querySelectorAll('.dashboard-overview .tab-button').forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                        document.querySelectorAll('.dashboard-overview .tab-content').forEach(content => {
                            if (content.id === tabId + '-content') {
                                content.classList.add('active');
                            } else {
                                content.classList.remove('active');
                            }
                        });
                    });
                });
            </script>
        `;
    }

    renderFinancialSnapshot(todayCashIncome) {
        return `
            <div class="operational-card">
                <div class="card-header">
                    <h5 class="card-title">Maliyyə Anlıq Görüntü</h5>
                </div>
                <div class="financial-item">
                    <span>Bugünkü Kassa Gəliri</span>
                    <strong class="positive">₼${(todayCashIncome || 0).toFixed(2)}</strong>
                </div>
                <button class="btn btn-secondary" style="width: 100%; margin-top: 1rem;" onclick="window.app.loadModule('cash')">
                    <i class="fas fa-cash-register"></i> Kassaya Bax
                </button>
            </div>
        `;
    }

    renderAlerts(pendingMaintenance, lowInventoryItems, data) {
         const guestsWithDebt = data.reservations.filter(res => {
            if (res.status !== 'occupied' && res.checkOut !== new Date().toISOString().split('T')[0]) return false;
            const summary = window.app.getReservationFinancialSummary(res.id);
            return summary && summary.remainingBalance > 0;
        });

        return `
            <div class="operational-card">
                <div class="card-header">
                    <h5 class="card-title">Xəbərdarlıqlar</h5>
                </div>
                <div class="alert-list">
                    <div class="alert-item" onclick="window.app.loadModule('maintenance')">
                        <i class="fas fa-tools alert-icon warning"></i>
                        <span>Gözləyən Təmir/Təmizlik</span>
                        <span class="alert-count warning">${pendingMaintenance}</span>
                    </div>
                    <div class="alert-item" onclick="window.app.loadModule('inventory')">
                        <i class="fas fa-boxes alert-icon danger"></i>
                        <span>Az Qalan Məhsullar</span>
                        <span class="alert-count danger">${lowInventoryItems}</span>
                    </div>
                     <div class="alert-item" onclick="window.app.loadModule('reservations')">
                        <i class="fas fa-file-invoice-dollar alert-icon danger"></i>
                        <span>Borclu Çıxışlar</span>
                        <span class="alert-count danger">${guestsWithDebt.length}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Builds a birthday notification board showing current guests' birthdays
     * (today, upcoming within 7 days, and rest of the month).
     */
    renderBirthdayBoard(data, activeGuests) {
        const todayStr = window.app.getTodayDateString();
        const now = new Date();
        const todayMonth = now.getMonth();
        const todayDay = now.getDate();

        const guestsByReservation = (data.reservations || [])
            .filter(res => res.status === 'occupied' || (res.status === 'confirmed' && res.checkIn <= todayStr && res.checkOut >= todayStr))
            .map(res => data.guests.find(g => g.id === res.guestId))
            .filter(Boolean);

        // De-duplicate by guest id
        const currentGuests = [];
        const seen = new Set();
        guestsByReservation.forEach(g => {
            if (!seen.has(g.id)) { seen.add(g.id); currentGuests.push(g); }
        });

        // Helper: days until the next occurrence of a birthday (month/day) relative to today
        const daysUntilBirthday = (month, day) => {
            const thisYear = new Date(now.getFullYear(), month - 1, day);
            let next = thisYear;
            if (thisYear < new Date(now.getFullYear(), todayMonth, todayDay)) {
                next = new Date(now.getFullYear() + 1, month - 1, day);
            }
            return Math.round((next - now) / 86400000);
        };

        const birthdayList = [];
        currentGuests.forEach(guest => {
            if (!guest || !guest.birthDate) return;
            const parts = guest.birthDate.split('-');
            if (parts.length < 3) return;
            const month = parseInt(parts[1], 10);
            const day = parseInt(parts[2], 10);
            if (isNaN(month) || isNaN(day)) return;

            const daysUntil = daysUntilBirthday(month, day);
            let category = null;
            if (daysUntil === 0) category = 'today';
            else if (daysUntil <= 7) category = 'soon';
            else if (month === todayMonth && day > todayDay) category = 'month';

            if (category) {
                const room = (data.reservations || []).find(res => res.guestId === guest.id && (res.status === 'occupied' || (res.status === 'confirmed' && res.checkIn <= todayStr && res.checkOut >= todayStr)));
                const roomNumber = room ? (data.rooms.find(r => r.id === room.roomId)?.number || 'N/A') : 'N/A';
                birthdayList.push({ guest, category, month, day, roomNumber, daysUntil });
            }
        });

        birthdayList.sort((a, b) => a.daysUntil - b.daysUntil);

        if (birthdayList.length === 0) {
            return `
                <div class="operational-card birthday-board">
                    <div class="card-header">
                        <h5 class="card-title"><i class="fas fa-birthday-cake"></i> Ad Günü Bildirişləri</h5>
                    </div>
                    <p class="no-data">Hazırda qalan qonaqlar arasında yaxınlaşan ad günü yoxdur.</p>
                </div>
            `;
        }

        const todayItems = birthdayList.filter(b => b.category === 'today');
        const soonItems = birthdayList.filter(b => b.category === 'soon');
        const monthItems = birthdayList.filter(b => b.category === 'month');

        const renderGroup = (label, items, emphasize) => `
            ${items.length ? `
                <div class="birthday-group-label ${emphasize ? 'birthday-today-label' : ''}">${label}</div>
                ${items.map(b => `
                    <div class="birthday-item ${b.category === 'today' ? 'birthday-today' : ''}" onclick="window.app.loadModule('guests')">
                        <div class="birthday-cake-icon ${b.category === 'today' ? 'celebrate' : ''}">
                            <i class="fas fa-${b.category === 'today' ? 'gift' : 'birthday-cake'}"></i>
                        </div>
                        <div class="birthday-guest-info">
                            <span class="guest-name">${window.escapeHtml(b.guest.name || 'N/A')}</span>
                            <span class="room-info">Otaq ${window.escapeHtml(b.roomNumber)} • ${String(b.day).padStart(2, '0')}.${String(b.month).padStart(2, '0')}</span>
                        </div>
                        <div class="birthday-status">
                            ${b.category === 'today' ? `<span class="birthday-badge today-badge">Bu gün 🎂</span>` : b.category === 'soon' ? `<span class="birthday-badge soon-badge">${b.daysUntil} gün sonra</span>` : `<span class="birthday-badge month-badge">Bu ay</span>`}
                        </div>
                    </div>
                `).join('')}
            ` : ''}
        `;

        return `
            <div class="operational-card birthday-board">
                <div class="card-header">
                    <h5 class="card-title"><i class="fas fa-birthday-cake"></i> Ad Günü Bildirişləri</h5>
                    <span class="birthday-count">${birthdayList.length} qonaq</span>
                </div>
                <div class="birthday-list">
                    ${renderGroup('Bu gün', todayItems, true)}
                    ${renderGroup('Yaxın 7 gün', soonItems)}
                    ${renderGroup('Bu ayın qalan hissəsi', monthItems)}
                </div>
            </div>
        `;
    }

    renderQuickActions() {
        return `
            <div class="operational-card">
                <div class="card-header">
                    <div class="card-title">Tez Əməliyyatlar</div>
                    <div class="card-icon" style="background-color: #3b82f6;">
                        <i class="fas fa-bolt"></i>
                    </div>
                </div>
                <div class="quick-actions-grid">
                    <button class="quick-action-btn" onclick="window.modalManager.showReservationForm()">
                        <div class="quick-action-icon" style="background-color: #3b82f6;">
                            <i class="fas fa-calendar-plus"></i>
                        </div>
                        <div class="quick-action-text">
                            <span>Yeni Rezervasiya</span>
                            <small>Qonaq rezervasiyası yarat</small>
                        </div>
                    </button>

                    <button class="quick-action-btn" onclick="window.modalManager.showGuestForm()">
                        <div class="quick-action-icon" style="background-color: #10b981;">
                            <i class="fas fa-user-plus"></i>
                        </div>
                        <div class="quick-action-text">
                            <span>Yeni Qonaq</span>
                            <small>Qonaq qeydiyyatı</small>
                        </div>
                    </button>

                    <button class="quick-action-btn" onclick="window.modalManager.showCashForm('income')">
                        <div class="quick-action-icon" style="background-color: #f59e0b;">
                            <i class="fas fa-money-bill-wave"></i>
                        </div>
                        <div class="quick-action-text">
                            <span>Ödəniş Qəbul Et</span>
                            <small>Kassa mədaxil</small>
                        </div>
                    </button>

                    <button class="quick-action-btn" onclick="window.app.loadModule('pos')">
                        <div class="quick-action-icon" style="background-color: #8b5cf6;">
                            <i class="fas fa-cash-register"></i>
                        </div>
                        <div class="quick-action-text">
                            <span>POS Satış</span>
                            <small>Məhsul satışı</small>
                        </div>
                    </button>

                    <button class="quick-action-btn" onclick="window.modalManager.showMaintenanceForm()">
                        <div class="quick-action-icon" style="background-color: #ef4444;">
                            <i class="fas fa-tools"></i>
                        </div>
                        <div class="quick-action-text">
                            <span>Təmir Tapşırığı</span>
                            <small>Təmir və təmizlik</small>
                        </div>
                    </button>

                    <button class="quick-action-btn" onclick="window.app.loadModule('reports')">
                        <div class="quick-action-icon" style="background-color: #6b7280;">
                            <i class="fas fa-chart-bar"></i>
                        </div>
                        <div class="quick-action-text">
                            <span>Hesabatlar</span>
                            <small>Bütün hesabatlar</small>
                        </div>
                    </button>
                </div>
            </div>
        `;
    }

    renderRecentActivity(data) {
        const recentTransactions = [...data.cashTransactions]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        const formatDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate : d => d;

        return `
            <div class="operational-card">
                <div class="card-header">
                    <div class="card-title">Son Əməliyyatlar</div>
                    <div class="card-icon" style="background-color: #8b5cf6;">
                        <i class="fas fa-history"></i>
                    </div>
                </div>
                <div class="guest-list">
                    ${recentTransactions.length > 0 ? recentTransactions.map(transaction => {
                        const staff = data.staff.find(s => s.id === transaction.staffId);
                        const displayId = transaction.publicId || window.app.formatInternalId(transaction.id, 'KS'); // Display publicId
                        return `
                            <div class="guest-item">
                                <div>
                                    <strong style="color: ${transaction.type === 'income' ? '#10b981' : '#ef4444'};">
                                        ${transaction.type === 'income' ? '+' : '-'}₼${(transaction.amount || 0).toFixed(2)}
                                    </strong>
                                    <div style="font-size: 0.875rem; color: #64748b;">
                                        ${window.escapeHtml(transaction.category)} • ${window.escapeHtml(staff ? staff.name : 'N/A')} (ID: ${window.escapeHtml(displayId)})
                                    </div>
                                </div>
                                <div style="text-align: right; font-size: 0.75rem; color: #64748b;">
                                    ${formatDate(transaction.date)}<br>${transaction.time}
                                </div>
                            </div>
                        `;
                    }).join('') : '<p style="text-align: center; color: #64748b; padding: 2rem;">Son əməliyyat yoxdur</p>'}
                </div>
            </div>
        `;
    }

    renderRecentReservations(data) {
        const formatDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate : d => d;
        return `
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Bu həftənin rezervasiyaları</h3>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Qonaq</th>
                            <th>Otaq</th>
                            <th>Giriş</th>
                            <th>Çıxış</th>
                            <th>Status</th>
                            <th>Məbləğ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.reservations.slice(0, 5).map(reservation => {
                            const guest = data.guests.find(g => g.id === reservation.guestId);
                            const room = data.rooms.find(r => r.id === reservation.roomId);
                            const displayId = reservation.publicId || window.app.formatInternalId(reservation.id, 'RZ'); // Use publicId
                            return `
                                <tr>
                                    <td>${window.escapeHtml(guest ? guest.name : 'N/A')} (${window.escapeHtml(displayId)})</td>
                                    <td>${window.escapeHtml(room ? room.number : 'N/A')}</td>
                                    <td>${formatDate(reservation.checkIn)}</td>
                                    <td>${formatDate(reservation.checkOut)}</td>
                                    <td><span class="status-badge status-${reservation.status}">${window.statusHelper.getReservationStatus(reservation.status)}</span></td>
                                    <td>₼${(reservation.totalAmount || 0).toFixed(2)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    /**
     * Navigates to the Reservations component and sets filters for today's events.
     * @param {'arrivals'|'departures'|'active'} type 
     */
    navigateToReservationsFiltered(type) {
        // 1. Clear existing filters in ReservationsComponent storage to ensure a clean filter set
        localStorage.removeItem('reservationsComponent_searchVal');
        localStorage.removeItem('reservationsComponent_roomSearchVal');
        localStorage.removeItem('reservationsComponent_checkInDateVal');
        localStorage.removeItem('reservationsComponent_checkOutDateVal');
        localStorage.removeItem('reservationsComponent_sourceVal');
        localStorage.removeItem('reservationsComponent_statusVal');
        localStorage.removeItem('reservationsComponent_staffVal');
        localStorage.setItem('reservationsComponent_currentPage', '1');

        const today = window.app.getTodayDateString();

        if (type === 'arrivals') {
            // Filter by Check-In date = Today
            localStorage.setItem('reservationsComponent_checkInDateVal', today);
            localStorage.removeItem('reservationsComponent_checkOutDateVal'); // Clear check-out filter
            localStorage.setItem('reservationsComponent_statusVal', 'confirmed'); // Only show confirmed/pending arrivals
        } else if (type === 'departures') {
            // Filter by Check-Out date = Today
            localStorage.setItem('reservationsComponent_checkOutDateVal', today);
            localStorage.removeItem('reservationsComponent_checkInDateVal'); // Clear check-in filter
            localStorage.setItem('reservationsComponent_statusVal', 'confirmed'); // Only confirmed departures are relevant for checkout
        } else if (type === 'active') {
            // For active guests: filter by confirmed or occupied status, without date constraints
            localStorage.removeItem('reservationsComponent_checkInDateVal');
            localStorage.removeItem('reservationsComponent_checkOutDateVal');
            localStorage.setItem('reservationsComponent_statusVal', 'occupied'); // Filter by occupied status (best proxy for active guests)
        }

        // 2. Navigate to the Reservations module
        window.app.loadModule('reservations');
    }

    initTeamNotes() {
        const textarea = document.getElementById('dashboardTeamNotes');
        if (textarea) {
            // Load from settings
            const notes = window.app.getSetting('dashboardNotes') || '';
            textarea.value = notes;
        }
    }

    async saveTeamNotes() {
        const textarea = document.getElementById('dashboardTeamNotes');
        if (!textarea) return;
        
        const notes = textarea.value;
        try {
            await window.app.saveSetting('dashboardNotes', notes);
            window.notificationManager?.showNotification('success', 'Qeyd saxlandı', 'Komanda qeydləri yeniləndi.');
        } catch (e) {
            console.error(e);
            window.notificationManager?.showNotification('error', 'Xəta', 'Qeydlər saxlanmadı.');
        }
    }
}

// Patch almost all date rendering in this file
window.DashboardComponent = DashboardComponent;