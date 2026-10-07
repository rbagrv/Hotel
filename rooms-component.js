// Rooms component - Table/List version for managing rooms with column filters in header!
export default class RoomsComponent {
    constructor() {
        // Initialize active tab for rooms view
        if (localStorage.getItem('roomsComponent_activeTab') === null) {
            localStorage.setItem('roomsComponent_activeTab', 'table'); // Default to table view
        }
        // NEW: Initialize calendar start date. Default to today (Local Time).
        if (localStorage.getItem('roomsComponent_calendarStartDate') === null) {
            // Use window.app helper if available, otherwise manual local date
            const todayStr = window.app && typeof window.app.getTodayDateString === 'function' 
                ? window.app.getTodayDateString() 
                : (() => {
                    const d = new Date();
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                })();
            localStorage.setItem('roomsComponent_calendarStartDate', todayStr);
        }

        if (localStorage.getItem('roomsComponent_calRoomTypeFilter') === null) {
            localStorage.setItem('roomsComponent_calRoomTypeFilter', 'Bütün Növlər');
        }
        if (localStorage.getItem('roomsComponent_calBuildingFilter') === null) {
            localStorage.setItem('roomsComponent_calBuildingFilter', 'Bütün Binalar');
        }
        if (localStorage.getItem('roomsComponent_calFloorFilter') === null) {
            localStorage.setItem('roomsComponent_calFloorFilter', 'Bütün Mərtəbələr');
        }
        if (localStorage.getItem('roomsComponent_calIsFilterOpen') === null) {
            localStorage.setItem('roomsComponent_calIsFilterOpen', 'false');
        }
    }

    // Helper to get filter value from localStorage
    getFilter(key, defaultValue = '') {
        const storedValue = localStorage.getItem(`roomsComponent_${key}`);
        // Treat explicit 'null'/'undefined' strings or actual null as default
        if (storedValue === null || storedValue === 'undefined' || storedValue === 'null') {
            return defaultValue;
        }
        return storedValue;
    }

    // Helper to set filter value in localStorage
    setFilter(key, value) {
        localStorage.setItem(`roomsComponent_${key}`, value);
    }

    render(data) {
        const activeTab = this.getFilter('activeTab', 'calendar');
        const isCalendarTab = activeTab === 'calendar';

        const tabNav = `
            <div style="display: flex; gap: 1em; margin-bottom: 1.7em; align-items:center;">
                <button class="btn btn-secondary${activeTab === 'table' ? ' btn-primary' : ''}" onclick="window.roomsComponent.setFilter('activeTab', 'table');window.app.loadModule('rooms')" style="min-width:110px;">Cədvəl</button>
                <button class="btn btn-secondary${activeTab === 'calendar' ? ' btn-primary' : ''}" onclick="window.roomsComponent.setFilter('activeTab', 'calendar');window.app.loadModule('rooms')" style="min-width:110px;">Təqvim</button>
            </div>
        `;

        if (isCalendarTab) {
            return tabNav + this.renderRoomsCalendar(data);
        } else {
            return tabNav + this.renderTable(data);
        }
    }

    renderTable(data) {
        // Use component's own getFilter/setFilter methods directly
        const searchVal = this.getFilter('searchVal');
        const typeVal = this.getFilter('typeVal');
        const categoryVal = this.getFilter('categoryVal');
        const statusVal = this.getFilter('statusVal');
        const floorVal = this.getFilter('floorVal');
        const buildingVal = this.getFilter('buildingVal');

        const uniqueTypes = Array.from(new Set(data.rooms.map(r => r.type).filter(Boolean)));
        const uniqueCategories = Array.from(new Set(data.rooms.map(r => r.category).filter(Boolean)));
        const uniqueBuildings = Array.from(new Set(data.rooms.map(r => r.building).filter(Boolean)));
        const uniqueFloors = Array.from(new Set(data.rooms.map(r => r.floor).filter(f => f !== null && f !== undefined))).sort((a, b) => a - b);
        const uniqueStatus = ["available", "occupied", "maintenance"];

        let filteredRooms = data.rooms || [];
        if (searchVal) {
            filteredRooms = filteredRooms.filter(r =>
                (r.number && r.number.toLowerCase().includes(searchVal.toLowerCase())) ||
                (r.type && r.type.toLowerCase().includes(searchVal.toLowerCase())) ||
                (r.category && r.category.toLowerCase().includes(searchVal.toLowerCase())) ||
                (r.building && r.building.toLowerCase().includes(searchVal.toLowerCase())) ||
                (r.id && r.id.toString().toLowerCase().includes(searchVal.toLowerCase()))
            );
        }
        if (typeVal !== '') filteredRooms = filteredRooms.filter(r => r.type === typeVal);
        if (categoryVal !== '') filteredRooms = filteredRooms.filter(r => r.category === categoryVal);
        if (statusVal !== '') filteredRooms = filteredRooms.filter(r => r.status === statusVal);
        if (floorVal !== '') filteredRooms = filteredRooms.filter(r => String(r.floor) === floorVal);
        if (buildingVal !== '') filteredRooms = filteredRooms.filter(r => r.building === buildingVal);

        return `
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Otaqların İdarə Edilməsi</h3>
                    ${window.authManager.hasPermission('rooms', 'create') ? `
                    <button class="btn btn-primary" onclick="window.modalManager.showRoomForm()">
                        <i class="fas fa-plus"></i>
                        Yeni Otaq
                    </button>
                    ` : ''}
                </div>
                <div style="overflow-x:auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th style="min-width: 100px;">
                                Nömrə<br>
                                <input class="form-input" style="max-width:90px;" type="search" placeholder="Nömrə..." value="${searchVal}"
                                    oninput="window.roomsComponent.setFilter('searchVal', this.value); window.app.loadModuleDebounced('rooms');">
                            </th>
                            <th style="min-width: 120px;">
                                Növ<br>
                                <select class="form-select" style="max-width:110px;" onchange="window.roomsComponent.setFilter('typeVal', this.value); window.app.loadModule('rooms');">
                                    <option value="">Hamısı</option>
                                    ${uniqueTypes.map(t => `<option value="${t}" ${typeVal === t ? 'selected' : ''}>${t}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 120px;">
                                Kateqoriya<br>
                                <select class="form-select" style="max-width:110px;" onchange="window.roomsComponent.setFilter('categoryVal', this.value); window.app.loadModule('rooms');">
                                    <option value="">Hamısı</option>
                                    ${uniqueCategories.map(c => `<option value="${c}" ${categoryVal === c ? 'selected' : ''}>${c}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 80px;">Tutum</th>
                            <th style="min-width: 100px;">Qiymət (₼)</th>
                            <th style="min-width: 100px;">
                                Bina<br>
                                <select class="form-select" style="max-width:80px;" onchange="window.roomsComponent.setFilter('buildingVal', this.value); window.app.loadModule('rooms');">
                                    <option value="">Hamısı</option>
                                    ${uniqueBuildings.map(b => `<option value="${b}" ${buildingVal === b ? 'selected' : ''}>${b}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 100px;">
                                Mərtəbə<br>
                                <select class="form-select" style="max-width:80px;" onchange="window.roomsComponent.setFilter('floorVal', this.value); window.app.loadModule('rooms');">
                                    <option value="">Hamısı</option>
                                    ${uniqueFloors.map(f => `<option value="${f}" ${floorVal === String(f) ? 'selected' : ''}>${f}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 100px;">
                                Status<br>
                                <select class="form-select" style="max-width:90px;" onchange="window.roomsComponent.setFilter('statusVal', this.value); window.app.loadModule('rooms');">
                                    <option value="">Hamısı</option>
                                    ${uniqueStatus.map(s => `<option value="${s}" ${statusVal === s ? 'selected' : ''}>${window.statusHelper.getRoomStatus(s)}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 150px;">Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredRooms.map((room, idx) => this.renderRoomRow(room, data, idx + 1)).join('')}
                    </tbody>
                </table>
                </div>
                <div style="margin:0.5em 0; color:#64748b;font-size:0.96em;">Otaq sayı: <b>${filteredRooms.length}</b></div>
                <button class="btn btn-secondary" style="margin-top:1em;" onclick="window.roomsComponent.setFilter('searchVal', '');window.roomsComponent.setFilter('typeVal', '');window.roomsComponent.setFilter('categoryVal', '');window.roomsComponent.setFilter('statusVal', '');window.roomsComponent.setFilter('floorVal', '');window.roomsComponent.setFilter('buildingVal', '');window.app.loadModule('rooms');">
                    <i class="fas fa-times"></i> Filtri sıfırla
                </button>
            </div>
        `;
    }

    renderRoomRow(room, data, rowIndex) {
        const roomType = room.type || 'N/A';
        const roomCategory = room.category || 'N/A';
        const roomNumber = room.number || 'N/A';
        const roomPrice = room.price || 0;
        const roomBuilding = room.building || 'N/A';
        const roomFloor = room.floor || 'N/A';
        const roomStatus = room.status || 'available';

        const actions = `
            <div style="display: flex; gap: 0.3rem;">
                ${window.authManager.hasPermission('rooms', 'edit') ? `
                    <button class="btn btn-secondary" onclick="window.modalManager.showRoomForm('${room.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                ` : ''}
                ${window.authManager.hasPermission('rooms', 'delete') ? `
                    <button class="btn btn-secondary" onclick="window.app.deleteRoom('${room.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        `;

        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${rowIndex || ''}</td>
                <td><strong>${room.number}</strong></td>
                <td>${roomType}</td>
                <td>${roomCategory}</td>
                <td>${roomStatus}</td>
                <td>₼${(roomPrice || 0).toFixed(2)}</td>
                <td>${roomBuilding}</td>
                <td>${roomFloor}</td>
                <td>
                    <div style="display: flex; gap: 0.3rem;">
                        ${actions}
                    </div>
                </td>
            </tr>
        `;
    }

    renderRoomsCalendar(data) {
        const daysToShow = 14; // Always show 14 days
        // Ensure fallback is local date
        const todayLocalStr = window.app ? window.app.getTodayDateString() : new Date().toLocaleDateString('az-AZ').split('.').reverse().join('-');
        const startDateString = this.getFilter('calendarStartDate', todayLocalStr);
        
        // Parsing strictly from the string to avoid browser timezone shifts on the Date object itself
        // startDateString is YYYY-MM-DD
        const [startYear, startMonth, startDay] = startDateString.split('-').map(Number);

        // Calculate days to display using UTC arithmetic to prevent DST/Timezone jumps
        const displayDates = [];
        const todayString = window.app.getTodayDateString(); 

        for (let i = 0; i < daysToShow; i++) {
            // Create UTC date at 00:00:00. 
            // Adding 'i' to the day handle overflow (e.g. Jan 32 -> Feb 1) automatically
            const date = new Date(Date.UTC(startYear, startMonth - 1, startDay + i));
            displayDates.push(date);
        }

        // Filter rooms based on settings filters
        const allRooms = (data.rooms || []).slice();
        const roomTypeFilter = this.getFilter('calRoomTypeFilter', 'Bütün Növlər');
        const buildingFilter = this.getFilter('calBuildingFilter', 'Bütün Binalar');
        const floorFilter = this.getFilter('calFloorFilter', 'Bütün Mərtəbələr');

        let filteredRooms = allRooms;
        if (roomTypeFilter !== 'Bütün Növlər') {
            filteredRooms = filteredRooms.filter(r => r.type === roomTypeFilter);
        }
        if (buildingFilter !== 'Bütün Binalar') {
            filteredRooms = filteredRooms.filter(r => r.building === buildingFilter);
        }
        if (floorFilter !== 'Bütün Mərtəbələr' && floorFilter !== '') {
            filteredRooms = filteredRooms.filter(r => String(r.floor) === floorFilter);
        }

        // Sort rooms by building, floor, then number
        filteredRooms.sort((a, b) => {
            if ((a.building || '') !== (b.building || '')) {
                return (a.building || '').localeCompare(b.building || '');
            }
            if ((a.floor || 0) !== (b.floor || 0)) {
                return (a.floor || 0) - (b.floor || 0);
            }
            return (a.number || '').localeCompare(b.number || '');
        });

        // Unique filter options for the filter dropdowns (collected from all rooms)
        const uniqueRoomTypes = ['Bütün Növlər', ...Array.from(new Set(allRooms.map(r => r.type).filter(Boolean)))];
        const uniqueBuildings = ['Bütün Binalar', ...Array.from(new Set(allRooms.map(r => r.building).filter(Boolean)))];
        const uniqueFloors = ['Bütün Mərtəbələr', ...Array.from(new Set(allRooms.map(r => r.floor).filter(f => f !== null && f !== undefined))).map(String).sort((a, b) => parseInt(a) - parseInt(b))];
        const isFilterOpen = this.getFilter('calIsFilterOpen') === 'true';

        // NEW: Calculate the date range string for display
        const rangeStart = displayDates[0] ? (window.app.formatDate(displayDates[0].toISOString().split('T')[0])) : 'N/A';
        const rangeEnd = displayDates[daysToShow - 1] ? (window.app.formatDate(displayDates[daysToShow - 1].toISOString().split('T')[0])) : 'N/A';

        // Calculate instant room status KPI counts for today
        const todayDateObj = this.parseDateAsUTC(todayString);
        let vacantCount = 0;
        let occupiedCount = 0;
        let reservedCount = 0;
        let outOfOrderCount = 0;

        allRooms.forEach(room => {
            const st = this.getRoomStatusForDay(room, todayDateObj, data);
            if (st.status === 'available') vacantCount++;
            else if (st.status === 'occupied') occupiedCount++;
            else if (st.status === 'pending_reservation') reservedCount++;
            else if (st.status === 'maintenance' || st.status === 'dirty') outOfOrderCount++;
        });

        // Current Month / Year string in English / Azerbaijani style
        const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const currentMonthYearHeader = `${monthNamesEn[startMonth - 1] || ''} ${startYear}`;

        const filterControls = `
            <!-- eZee FrontDesk Stay View Top Control Toolbar -->
            <div class="ezee-stayview-toolbar">
                <div class="ezee-stayview-left">
                    <div class="ezee-view-selector">
                        <select class="ezee-select-styled" onchange="if(this.value==='table'){window.roomsComponent.setFilter('activeTab', 'table');window.app.loadModule('rooms');}">
                            <option value="stayview" selected>Stay View</option>
                            <option value="table">Otaq Siyahısı (Cədvəl)</option>
                        </select>
                    </div>

                    <div class="ezee-date-picker-box">
                        <input type="date" class="ezee-date-input" value="${startDateString}" 
                               onchange="window.roomsComponent.setFilter('calendarStartDate', this.value); window.app.loadModule('rooms');">
                    </div>
                </div>

                <!-- Right Side Status KPI Counters (Vacant, Occupied, Reserved, Out of Order) -->
                <div class="ezee-kpi-counters">
                    <div class="ezee-kpi-item vacant">
                        <span class="ezee-kpi-label">Boş</span>
                        <div class="ezee-kpi-badge">
                            <i class="fas fa-bed"></i>
                            <strong>${vacantCount}</strong>
                        </div>
                    </div>
                    <div class="ezee-kpi-item occupied">
                        <span class="ezee-kpi-label">Dolu</span>
                        <div class="ezee-kpi-badge">
                            <i class="fas fa-bed"></i>
                            <strong>${occupiedCount}</strong>
                        </div>
                    </div>
                    <div class="ezee-kpi-item reserved">
                        <span class="ezee-kpi-label">Rezerv</span>
                        <div class="ezee-kpi-badge">
                            <i class="fas fa-calendar-check"></i>
                            <strong>${reservedCount}</strong>
                        </div>
                    </div>
                    <div class="ezee-kpi-item outoforder">
                        <span class="ezee-kpi-label">Təmir / Qeyri-aktiv</span>
                        <div class="ezee-kpi-badge">
                            <i class="fas fa-tools"></i>
                            <strong>${outOfOrderCount}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Month & Day Navigation Bar -->
            <div class="ezee-calendar-subbar">
                <div class="ezee-month-display">
                    <h2>${currentMonthYearHeader}</h2>
                </div>

                <div class="ezee-nav-button-group">
                    <button class="ezee-nav-btn" onclick="window.roomsComponent.changeCalendarPeriod(-7)" title="Əvvəlki həftə">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button class="ezee-nav-today-btn" onclick="window.roomsComponent.resetCalendarToToday()">
                        Today
                    </button>
                    <button class="ezee-nav-btn" onclick="window.roomsComponent.changeCalendarPeriod(7)" title="Növbəti həftə">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>

                <div class="ezee-filter-dropdowns">
                    <select class="ezee-filter-select" onchange="window.roomsComponent.setFilter('calRoomTypeFilter', this.value); window.app.loadModule('rooms');">
                        ${uniqueRoomTypes.map(t => `<option value="${t}" ${roomTypeFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;

        // Generate table header rows (Dates)
        const dateHeaders = displayDates.map(date => {
            // Since 'date' is constructed as UTC, we use UTC methods to get the visual date components
            const d = String(date.getUTCDate()).padStart(2, '0');
            const m = String(date.getUTCMonth() + 1).padStart(2, '0');
            const dayOfWeek = date.getUTCDay(); // 0 is Sun, 5 is Fri, 6 is Sat
            const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday & Saturday in eZee style
            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === todayString;
            
            const weekdayEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];

            return `<th class="date-header-col ${isWeekend ? 'weekend-header' : ''} ${isToday ? 'today-col' : ''}" style="text-align:center;">
                        <strong>${d}</strong><br>
                        <small>(${weekdayEn})</small>
                    </th>`;
        }).join('');

        // Generate table body rows (Rooms)
        let roomRows = filteredRooms.map(room => {
            const esc = window.escapeHtml;

            // Room status indicator color dot
            const roomSt = (room.status || 'available').toLowerCase();
            const dotColor = roomSt === 'available' ? '#22c55e' : (roomSt === 'occupied' ? '#1976d2' : (roomSt === 'maintenance' ? '#ef4444' : '#f59e0b'));

            const cells = displayDates.map(date => {
                const dateStr = date.toISOString().split('T')[0];
                const isToday = dateStr === todayString; 
                const dayOfWeek = date.getUTCDay();
                const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
                
                // Pass the date object in UTC MIDNIGHT format to the status checker
                const statusInfo = this.getRoomStatusForDay(room, date, data);
                const statusClass = statusInfo.status;
                const tooltipTitle = this.getRoomCellTitle(room, statusInfo, date);

                const hasDetails = statusInfo.details !== null;
                let cellContent = '';

                if (statusClass === 'dirty' || statusClass === 'maintenance') {
                    const activeMaintenanceTask = statusInfo.details;
                    cellContent = `<i class="fas fa-tools" style="margin-right:4px;"></i> ` + (activeMaintenanceTask?.type === 'Təmizlik' ? 'Təmizlik' : 'Təmir');
                } else if (statusClass === 'occupied') {
                    const guest = data.guests?.find(g => g.id === statusInfo.details.guestId);
                    const guestName = guest?.name ? guest.name.split(' ')[0] : 'Qonaq';
                    cellContent = `<i class="fas fa-user" style="margin-right:4px;font-size:0.7em;"></i> ${esc(guestName)}`;
                } else if (statusClass === 'pending_reservation') {
                    const guest = data.guests?.find(g => g.id === statusInfo.details.guestId);
                    const guestName = guest?.name ? guest.name.split(' ')[0] : 'Rezerv';
                    cellContent = `<i class="fas fa-clock" style="margin-right:4px;font-size:0.7em;"></i> ${esc(guestName)}`;
                }

                return `<td class="room-calendar-cell ${isWeekend ? 'weekend-cell' : ''} ${isToday ? 'today-column' : ''}" 
                            title="${esc(tooltipTitle)}" 
                            onclick="window.roomsComponent.showRoomStatusDetails('${esc(room.id)}', '${esc(dateStr)}', '${esc(statusClass)}')">
                            ${statusClass !== 'available' ? `
                                <div class="room-status-badge ${esc(statusClass)}">
                                    ${cellContent}
                                </div>
                            ` : ''}
                        </td>`;
            }).join('');

            return `
                <tr>
                    <td class="room-info-col" title="${esc(room.type)} (${esc(room.category || '')})">
                        <div class="room-num-badge">
                            <span class="room-status-indicator-dot" style="background-color: ${dotColor};"></span>
                            <strong>${esc(room.number)}</strong>
                        </div>
                        <div style="color:#64748b; font-size:0.72rem; margin-top:2px; font-weight:normal;">${esc(room.type)}</div>
                    </td>
                    ${cells}
                </tr>
            `;
        }).join('');
        
        if (filteredRooms.length === 0) {
            roomRows += `<tr><td colspan="${daysToShow + 1}" style="text-align:center;padding:2rem;color:#64748b;">
                            <i class="fas fa-search"></i> Filtrə uyğun otaq tapılmadı.
                        </td></tr>`;
        }

        return `
            <div class="rooms-calendar-container">
                ${filterControls}
                <div class="rooms-calendar-table-wrapper">
                    <table class="rooms-calendar-table">
                        <thead>
                            <tr>
                                <th class="room-info-col" style="text-align:left;">Otaq/Növ</th>
                                ${dateHeaders}
                            </tr>
                        </thead>
                        <tbody>
                            ${roomRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // NEW: Helper to parse YYYY-MM-DD string as UTC midnight (made public)
    parseDateAsUTC(dateString) {
        if (!dateString) return null;
        // Ensure dateString is only the YYYY-MM-DD part, remove any time component or timezone info
        const cleanDateString = dateString.split('T')[0];
        const [year, month, day] = cleanDateString.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day)); // Month is 0-indexed in Date.UTC
    }

    /**
     * Determines the status of a given room for a specific day based on reservations and maintenance tasks.
     * @param {object} room - The room object.
     * @param {Date} currentDayUtc - The specific Date object for the day to check, ALREADY IN UTC MIDNIGHT.
     * @param {object} data - The full application data (reservations, maintenance).
     * @returns {{status: string, details: object|null}} - The status ('available', 'occupied', 'maintenance', 'dirty', 'pending_reservation') and relevant details.
     */
    getRoomStatusForDay(room, currentDayUtc, data) {
        // 1. Check for active Maintenance tasks (including cleaning tasks)
        const activeMaintenanceTask = (data.maintenance || []).find(m => {
            // Check if the task is specific to this room or a general task (roomId is null/undefined for general tasks).
            if (m.roomId && m.roomId !== room.id) return false;
            
            // Maintenance task must be pending or in_progress to affect room status on the calendar.
            if (!['pending', 'in_progress'].includes(m.status)) return false;

            // Parse maintenance dates (stored as ISO strings) to UTC midnight
            const mCreatedAtUtc = this.parseDateAsUTC(m.createdAt);
            const mDueDateUtc = this.parseDateAsUTC(m.dueDate);
            if (!mCreatedAtUtc || !mDueDateUtc) return false; // Guard against missing dates

            // A task is 'active' for a specific `currentDayUtc` if its creation date is on or before `currentDayUtc`,
            // AND its due date is on or after `currentDayUtc`.
            return mCreatedAtUtc.getTime() <= currentDayUtc.getTime() && currentDayUtc.getTime() <= mDueDateUtc.getTime();
        });

        if (activeMaintenanceTask) {
            // Prioritize maintenance status over reservations if both exist for the same day.
            // If the task type is 'Təmizlik', mark as 'dirty'; otherwise, mark as 'maintenance'.
            if (activeMaintenanceTask.type === 'Təmizlik') {
                return { status: 'dirty', details: activeMaintenanceTask };
            } else {
                return { status: 'maintenance', details: activeMaintenanceTask };
            }
        }

        // 2. Check for active Reservations
        // An "active" reservation means the guest is *currently in the room* or expected to be.
        // This means check-in date is on or before `currentDayUtc`, and check-out date is *after* `currentDayUtc`.
        //
        // IMPORTANT CLARIFICATION: A room is considered 'occupied' ON THE CHECK-IN DAY
        // and for all subsequent nights, but it becomes 'available' on the CHECK-OUT DAY itself.
        // For example, a reservation from July 21st to July 24th means the room is occupied on July 21st, 22nd, 23rd.
        // On July 24th, the room is considered available for new guests, as the previous guests check out.
        const currentReservation = (data.reservations || []).find(res => {
            if (res.roomId !== room.id) return false;
            
            // Only 'confirmed' or 'occupied' reservations block a room's availability in the calendar.
            if (!['confirmed', 'occupied'].includes(res.status)) return false;

            // Parse existing reservation dates (stored as YYYY-MM-DD strings) to UTC midnight
            const resCheckInUtc = this.parseDateAsUTC(res.checkIn);
            const resCheckOutUtc = this.parseDateAsUTC(res.checkOut);
            if (!resCheckInUtc || !resCheckOutUtc) return false; // Guard against missing dates

            // Logic: `currentDayUtc` must be on or after check-in, AND strictly before check-out.
            return resCheckInUtc.getTime() <= currentDayUtc.getTime() && currentDayUtc.getTime() < resCheckOutUtc.getTime();
        });

        if (currentReservation) {
            return { status: 'occupied', details: currentReservation };
        }

        // NEW: 3. Check for pending reservations (if not occupied or under maintenance/dirty)
        // A 'pending' reservation for this room on this day should show as a 'pending_reservation' status
        const pendingReservation = (data.reservations || []).find(res => {
            if (res.roomId !== room.id) return false;
            if (res.status !== 'pending') return false; // Only pending reservations

            // Parse reservation dates (stored as YYYY-MM-DD strings) to UTC midnight
            const resCheckInUtc = this.parseDateAsUTC(res.checkIn);
            const resCheckOutUtc = this.parseDateAsUTC(res.checkOut);
            if (!resCheckInUtc || !resCheckOutUtc) return false; // Guard against missing dates

            // Same logic as active reservations: check if currentDayUtc is on or after check-in, and strictly before check-out
            return resCheckInUtc.getTime() <= currentDayUtc.getTime() && currentDayUtc.getTime() < resCheckOutUtc.getTime();
        });

        if (pendingReservation) {
            return { status: 'pending_reservation', details: pendingReservation };
        }

        // 4. If neither maintenance nor active reservation, the room is 'available'.
        return { status: 'available', details: null };
    }

    // Helper for icons
    getRoomStatusIcon(status) {
        switch (status) {
            case 'available': return '<i class="fas fa-door-open"></i>';
            case 'occupied': return '<i class="fas fa-bed"></i>';
            case 'maintenance': return '<i class="fas fa-tools"></i>'; // Icon for 'Təmir'
            case 'dirty': return '<i class="fas fa-broom"></i>'; // Icon for 'Çirki'
            case 'pending_reservation': return '<i class="fas fa-hourglass-half"></i>'; // Icon for pending reservation
            default: return '';
        }
    }

    // Helper for short text
    getRoomStatusShortText(status) {
        switch (status) {
            case 'available': return 'Boş';
            case 'occupied': return 'Dolu';
            case 'maintenance': return 'Təmir'; // Text for 'Təmir'
            case 'dirty': return 'Çirki'; // Text for 'Çirki'
            case 'pending_reservation': return 'Gözləyir'; // Text for pending reservation
            default: return '';
        }
    }

    // Helper for tooltip title
    getRoomCellTitle(room, statusInfo, day) {
        const dateString = (window.app && typeof window.app.formatDate === 'function') ? window.app.formatDate(day) : day.toLocaleDateString();
        let title = `${room.number || 'N/A'} (${room.type || 'N/A'}) - ${dateString}: ${this.getRoomStatusShortText(statusInfo.status)}`;

        if (statusInfo.details) {
            if (statusInfo.status === 'maintenance' || statusInfo.status === 'dirty') {
                title += `\nTapşırıq: ${statusInfo.details.description} (Prioritet: ${statusInfo.details.priority})`;
                if (statusInfo.details.assignedTo) {
                    const assignedStaff = window.app?.data?.staff?.find(s => s.id === statusInfo.details.assignedTo);
                    title += `\nMəsul: ${assignedStaff?.name || 'N/A'}`;
                }
            } else if (statusInfo.status === 'occupied' || statusInfo.status === 'pending_reservation') { // Include pending_reservation
                const guest = window.app?.data?.guests?.find(g => g.id === statusInfo.details.guestId);
                title += `\nQonaq: ${guest?.name || 'N/A'}\nStatus: ${window.statusHelper.getReservationStatus(statusInfo.details.status)}\nGiriş: ${(window.app && typeof window.app.formatDate === 'function') ? window.app.formatDate(statusInfo.details.checkIn) : statusInfo.details.checkIn || 'N/A'}\nÇıxış: ${(window.app && typeof window.app.formatDate === 'function') ? window.app.formatDate(statusInfo.details.checkOut) : statusInfo.details.checkOut || 'N/A'}`;
            }
        }
        return title;
    }

    // Show detailed information in a modal when a calendar cell is clicked
    // MODIFIED: Simplified parameters to just room ID, date string, and status.
    // It will now fetch the details from window.app.data.
    showRoomStatusDetails(roomId, dateString, status) {
        const room = window.app?.data?.rooms?.find(r => r.id === roomId);
        // CRITICAL FIX: Parse dateString as UTC midnight directly
        const dayUtcForDetails = this.parseDateAsUTC(dateString);

        if (!room) return;

        // Re-get the statusInfo and details directly from the data
        const statusInfo = this.getRoomStatusForDay(room, dayUtcForDetails, window.app.data);
        const details = statusInfo.details; // This will now be the actual object, or null.
        
        // --- ADDED DEBUG LOG ---
        const formattedDate = (window.app && typeof window.app.formatDate === 'function') ? window.app.formatDate(dayUtcForDetails) : dayUtcForDetails.toLocaleDateString();
        console.log(`[RoomCalendarDetail] Clicked room: ${room.number}, date: ${formattedDate}.`);
        console.log(`[RoomCalendarDetail] Evaluated Status: ${statusInfo.status}. Details object:`, details);
        // --- END ADDED DEBUG LOG ---

        let modalContent = `
            <h4 style="color:var(--primary-color);margin-bottom:1rem;"><i class="fas fa-info-circle"></i> Otaq "${room.number || 'N/A'}" (${formattedDate})</h4>
            <div class="detail-grid" style="font-size:0.95em;gap:0.8rem;">
                <div><strong>Otaq Tipi:</strong> ${room.type || 'N/A'}</div>
                <div><strong>Kateqoriya:</strong> ${room.category || 'N/A'}</div>
                <div><strong>Mərtəbə:</strong> ${room.floor || 'N/A'}</div>
                <div><strong>Qiymət:</strong> ₼${(room.price || 0).toFixed(2)}/gecə</div>
            </div>
            <div style="margin-top:1.5rem; border-top:1px solid var(--border-color); padding-top:1.5rem;">
                <h5 style="color:var(--text-color);margin-bottom:1rem;">Cari Status: <span class="status-badge ${statusInfo.status}" style="font-size:1em;">${this.getRoomStatusIcon(statusInfo.status)} ${this.getRoomStatusShortText(statusInfo.status)}</span></h5>
        `;
        
        if (statusInfo.status === 'occupied' || statusInfo.status === 'pending_reservation') { // Include pending_reservation
            if (details) { // Now use the directly retrieved 'details' object (which is the reservation)
                const guest = window.app?.data?.guests?.find(g => g.id === details.guestId);
                const resPublicId = details.publicId || (window.app ? window.app.formatInternalId(details.id, 'RZ') : details.id); // Use publicId

                // NEW: Handle missing guest more explicitly
                let guestDisplay = guest?.name || 'N/A';
                if (!guest && details.guestId) {
                    guestDisplay = `Qonaq tapılmadı (ID: ${details.guestId})`;
                    window.notificationManager?.showNotification('warning', 'Qonaq məlumatı yoxdur', `Rezervasiya #${resPublicId} üçün qonaq məlumatı tapılmadı.`, 5000);
                }

                modalContent += `
                    <p style="font-weight:600;margin-bottom:0.5rem;">Rezervasiya Məlumatları:</p>
                    <div class="detail-grid" style="font-size:0.9em;">
                        <div><strong>Qonaq:</strong> ${window.escapeHtml(guestDisplay)}</div>
                        <div><strong>Rez. ID:</strong> ${window.escapeHtml(resPublicId)}</div>
                        <div><strong>Giriş:</strong> ${(window.app && typeof window.app.formatDate === 'function') ? window.app.formatDate(details.checkIn) : details.checkIn || 'N/A'}</div>
                        <div><strong>Çıxış:</strong> ${(window.app && typeof window.app.formatDate === 'function') ? window.app.formatDate(details.checkOut) : details.checkOut || 'N/A'}</div>
                        <div><strong>Nəfər:</strong> ${details.adults || 0} böyük, ${details.children || 0} uşaq</div>
                        <div><strong>Status:</strong> <span class="status-badge status-${details.status}">${window.statusHelper.getReservationStatus(details.status)}</span></div>
                        <div><strong>Məbləğ:</strong> ₼${(details.totalAmount||0).toFixed(2)}</div>
                    </div>
                    <div style="margin-top:1rem;">
                        <button class="btn btn-secondary" onclick="window.modalManager.showReservationDetails('${window.escapeHtml(details.id)}')">
                            <i class="fas fa-eye"></i> Rezervasiya Detayları
                        </button>
                    </div>
                `;
            } else {
                 // Fallback if 'details' is unexpectedly null for 'occupied' or 'pending_reservation' status.
                 // This indicates a deeper data consistency issue beyond simple missing guest data.
                 modalContent += `<p style="color:#ef4444;">Rezervasiya tapılmadı.</p>`;
                 window.notificationManager?.showNotification('error', 'Kritik Xəta', `Otaq ${room.id} üçün rezervasiya detalları alınmadı.`, 7000);
                 window.app?.recordSystemError?.('RoomReservationDetailsError', `Could not retrieve details for room ${room.id} with status ${statusInfo.status}.`, 'rooms-component.js showRoomStatusDetails');
            }
        } else if (statusInfo.status === 'maintenance' || statusInfo.status === 'dirty') {
            // Use the directly passed 'details' object (which is the maintenance task)
            if (details) {
                const assignedTo = window.app?.data?.staff?.find(s => s.id === details.assignedTo);
                const taskPublicId = details.publicId || (window.app ? window.app.formatInternalId(details.id, 'TM') : details.id); // Use publicId
                modalContent += `
                    <p style="font-weight:600;margin-bottom:0.5rem;">Tapşırıq Məlumatları:</p>
                    <div class="detail-grid" style="font-size:0.9em;">
                        <div><strong>ID:</strong> ${window.escapeHtml(taskPublicId)}</div>
                        <div><strong>Növ:</strong> ${window.escapeHtml(details.type || 'N/A')}</div>
                        <div><strong>Prioritet:</strong> ${window.escapeHtml(details.priority || 'N/A')}</div>
                        <div><strong>Məsul:</strong> ${window.escapeHtml(assignedTo?.name || 'N/A')}</div>
                        <div><strong>Son Tarix:</strong> ${(window.app && typeof window.app.formatDate === 'function') ? window.app.formatDate(details.dueDate) : details.dueDate || 'N/A'}</div>
                        <div><strong>Təsvir:</strong> ${window.escapeHtml(details.description || 'N/A')}</div>
                        <div><strong>Status:</strong> <span class="status-badge status-${details.status}">${window.statusHelper?.getMaintenanceStatus?.(details.status) || window.escapeHtml(details.status)}</span></div>
                    </div>
                    <div style="margin-top:1rem;">
                        <button class="btn btn-secondary" onclick="window.modalManager.showMaintenanceForm('${window.escapeHtml(details.id)}')">
                            <i class="fas fa-edit"></i> Tapşırığı Redaktə et
                        </button>
                    </div>
                `;
            } else {
                modalContent += `<p style="color:#ef4444;">Dolu göstərilir, lakin təmir/təmizlik tapşırığı tapılmadı.</p>`;
            }
        } else if (statusInfo.status === 'available') {
            modalContent += `<p style="color:#64748b;">Bu otaq bu tarixdə boşdur və rezervasiya üçün hazırdır.</p>`;
            modalContent += `
                <div style="margin-top:1rem;">
                    <button class="btn btn-primary btn-sm" onclick="window.modalManager.showReservationForm()">
                        <i class="fas fa-plus"></i> Yeni Rezervasiya Yarat
                    </button>
                </div>
            `;
        }

        modalContent += `</div>`; // Close detail section wrapper

        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.modalManager.showRoomForm('${room.id}')">
                <i class="fas fa-edit"></i> Otağı Redaktə et
            </button>
        `;

        window.modalManager.showModal(`Otaq Statusu - ${room.number || 'N/A'}`, modalContent, actions);
    }

    // NEW: Method to change calendar view period
    changeCalendarPeriod(deltaInDays) {
        // Use local date string for fallback
        const todayLocalStr = window.app ? window.app.getTodayDateString() : new Date().toLocaleDateString('az-AZ').split('.').reverse().join('-');
        const currentFilter = this.getFilter('calendarStartDate', todayLocalStr);
        
        // Parse the current filter string (YYYY-MM-DD)
        const [y, m, d] = currentFilter.split('-').map(Number);
        
        // We process it as UTC to perform date arithmetic safely without timezone shifts on the date itself
        const currentDate = new Date(Date.UTC(y, m - 1, d));
        currentDate.setUTCDate(currentDate.getUTCDate() + deltaInDays);
        
        // Convert back to YYYY-MM-DD string
        const year = currentDate.getUTCFullYear();
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getUTCDate()).padStart(2, '0');
        
        this.setFilter('calendarStartDate', `${year}-${month}-${day}`);
        window.app.loadModule('rooms');
    }
    
    // NEW: Method to reset calendar view to today
    resetCalendarToToday() {
        // Use App's utility for reliable local date string
        const todayStr = window.app.getTodayDateString();
        this.setFilter('calendarStartDate', todayStr);
        window.app.loadModule('rooms');
    }

    changeMonth(delta) {
        // Use component's own getFilter/setFilter methods
        const currentDate = new Date(this.getFilter('calendarDate', new Date().toISOString()));
        currentDate.setMonth(currentDate.getMonth() + delta);
        this.setFilter('calendarDate', currentDate.toISOString());
        window.app.loadModule('reservations');
    }

    attachImportListeners() {
        // The main table's import button
        const reservationFileInput = document.getElementById('reservationFileInput');
        if (reservationFileInput && !reservationFileInput.__pmsImportAttached) {
            reservationFileInput.__pmsImportAttached = true;
            reservationFileInput.addEventListener('change', (e) => this.handleFileSelect(e, 'main_table'));
        }

        // The Booking.com tab's import button
        const bookingReservationFileInput = document.getElementById('bookingReservationFileInput');
        if (bookingReservationFileInput && !bookingReservationFileInput.__pmsImportAttached) {
            bookingReservationFileInput.__pmsImportAttached = true;
            bookingReservationFileInput.addEventListener('change', (e) => this.handleFileSelect(e, 'booking_tab'));
        }
    }

    async handleFileSelect(e, sourceTab) {
        const file = e.target.files[0];
        if (!file) return;

        const previewContainer = document.getElementById('importPreviewContainer');
        const tableContainer = document.getElementById('importPreviewTableContainer');
        const resultContainer = document.getElementById('importResultContainer');
        const previewTitle = document.getElementById('importPreviewTitle');

        previewContainer.style.display = 'block';
        previewTitle.textContent = `İdxal Önizləməsi (${file.name})`;
        tableContainer.innerHTML = '<div class="loading">Fayl oxunur və analiz edilir...</div>';
        resultContainer.innerHTML = '';

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (json.length < 2) throw new Error("Faylda məlumat yoxdur və ya formatı düzgün deyil.");

            const headers = json[0].map(h => String(h || "").trim());
            // NEW: Use the dynamically defined expectedHeaders
            const expectedHeaders = [
                // Primary identification fields
                { keys: ["Guest name(s)", "Guest name"], mapTo: "guestName" },
                { keys: ["Check-in", "Check in date", "checkIn"], mapTo: "checkIn" },
                { keys: ["Check-out", "Check out date", "checkOut"], mapTo: "checkOut" },
                { keys: ["Status"], mapTo: "status" },
                { keys: ["Adults"], mapTo: "adults" },
                { keys: ["Room number", "Room #", "Room No"], mapTo: "roomNumber" }, // Added flexible room number
                { keys: ["Room type", "Room type name", "roomTypeName"], mapTo: "roomTypeName" }, // Added flexible room type
                // Flexible keys for Price and Reservation number, prioritizing new user-provided keys
                { keys: ["Price", "Total amount", "totalAmount"], mapTo: "totalAmount" }, // Flexible Price
                { keys: ["Book number", "Booking number", "externalReference", "Confirmation number"], mapTo: "externalReference" }, // Flexible Booking Number
                // Other optional fields
                { keys: ["Booked on", "Booking date", "bookedOn"], mapTo: "bookedOn" },
                { keys: ["Children"], mapTo: "children" },
                { keys: ["Commission amount", "Commission"], mapTo: "commissionAmount" },
                { keys: ["Booker country", "Country", "Nationality"], mapTo: "bookerCountry" },
                { keys: ["Phone number", "Phone"], mapTo: "phoneNumber" },
                { keys: ["Remarks", "Notes"], mapTo: "remarks" },
                { keys: ["Address"], mapTo: "address" },
                { keys: ["Email"], mapTo: "email" }
            ];

            const colIndexes = {};
            const finalDisplayHeaders = []; 

            expectedHeaders.forEach(hDef => {
                let foundHeaderName = null; 
                let internalMappedName = null; 

                if (typeof hDef === 'string') { // This case is now for direct header matches
                    const idx = headers.findIndex(x => x.toLowerCase() === hDef.toLowerCase());
                    if (idx >= 0) {
                        colIndexes[hDef] = idx;
                        foundHeaderName = hDef;
                        internalMappedName = hDef;
                    }
                } else { // Flexible header object
                    for (const key of hDef.keys) {
                        const idx = headers.findIndex(x => x.toLowerCase() === key.toLowerCase());
                        if (idx >= 0) {
                            colIndexes[hDef.mapTo] = idx;
                            foundHeaderName = key;
                            internalMappedName = hDef.mapTo;
                            break; // Found, move to next hDef
                        }
                    }
                }
                if (foundHeaderName) {
                    finalDisplayHeaders.push({ original: foundHeaderName, mapped: internalMappedName });
                }
            });

            // Strictly required headers for a valid import record
            const strictlyRequiredKeys = ["guestName", "checkIn", "checkOut", "status", "adults", "totalAmount"];
            const missingRequiredCols = strictlyRequiredKeys.filter(key => colIndexes[key] === undefined);

            if (missingRequiredCols.length > 0) {
                const userFriendlyMissing = missingRequiredCols.map(key => {
                    // Map internal keys back to user-friendly names for error message
                    const headerDef = expectedHeaders.find(def => typeof def !== 'string' && def.mapTo === key);
                    return headerDef ? headerDef.keys[0] : key; // Use first key in array or the key itself
                });
                throw new Error(`Tələb olunan sütun başlıqları tapılmadı: ${userFriendlyMissing.join(', ')}. Zəhmət olmasa, faylın düzgün formatda olduğundan əmin olun.`);
            }
            
            const rowsData = json.slice(1).filter(r => r.length && (r[colIndexes.guestName] || r[colIndexes.externalReference]));
            if (rowsData.length === 0) {
                throw new Error("Faylda idxal ediləcək heç bir rezervasiya qeydi tapılmadı.");
            }

            this.renderPreviewTable(rowsData, finalDisplayHeaders, colIndexes);

            // Store data for the import function
            window._bookingImportData = { rows: rowsData, colIndexes, sourceTab };

        } catch (err) {
            tableContainer.innerHTML = `<div style="color:#ef4444; padding:1em;"><strong>Xəta:</strong> ${err.message}</div>`;
            resultContainer.innerHTML = '';
            e.target.value = ''; // Reset file input to allow re-selection of the same file
        }
    }

    renderPreviewTable(rows, finalDisplayHeaders, colIndexes) {
        const tableContainer = document.getElementById('importPreviewTableContainer');
        let tableHtml = '<div style="overflow-x:auto;"><table class="data-table" style="margin-bottom:1em; font-size:0.9em; min-width:600px;"><thead><tr>'
            + finalDisplayHeaders.map(h => `<th>${h.original}</th>`).join('')
            + '</tr></thead><tbody>';

        rows.slice(0, 5).forEach(row => { // Show first 5 rows
            tableHtml += '<tr>' + finalDisplayHeaders.map(h => {
                let cellValue = "";
                const idx = colIndexes[h.mapped]; // Use the mapped internal name to get index
                
                if (idx !== undefined && row[idx] !== undefined) {
                    cellValue = row[idx];
                }

                if (h.mapped.includes("Check-in") || h.mapped.includes("Check-out")) {
                    const parsedDate = this._parseDateForImport(cellValue, false);
                    cellValue = parsedDate ? window.app.formatDate(parsedDate) : String(cellValue || '');
                } else if (h.mapped.includes("Booked on")) {
                    const parsedDate = this._parseDateForImport(cellValue, true);
                    cellValue = parsedDate ? window.app.formatDate(parsedDate) : String(cellValue || '');
                } else if (h.mapped === "totalAmount" || h.mapped === "commissionAmount") {
                    const numericMatch = String(cellValue).replace(/[^0-9.,]/g, '');
                    const floatVal = parseFloat(numericMatch.replace(',', '.')) || 0; // Handle comma as decimal separator
                    cellValue = `₼${floatVal.toFixed(2)}`;
                } else if (h.mapped === "adults" || h.mapped === "children") {
                     cellValue = parseInt(cellValue) || 0;
                } else if (h.mapped === "status") {
                    const rawStatus = String(cellValue || "").toLowerCase();
                    if (rawStatus.includes("confirm") || rawStatus.includes("ok")) cellValue = "Təsdiqlənib";
                    else if (rawStatus.includes("cancel")) cellValue = "Ləğv edilib";
                    else if (rawStatus.includes("check") && (rawStatus.includes("out") || rawStatus.includes("çıxış"))) cellValue = "Çıxış edib";
                    else cellValue = "Gözləyir"; // Default for unknown statuses
                }
                return `<td>${String(cellValue)}</td>`;
            }).join('') + '</tr>';
        });

        tableHtml += '</tbody></table></div>'; // Close table and overflow div
        if (rows.length > 5) {
            tableHtml += `<div style="color:#64748b;font-size:0.96em;text-align:center;">Cəmi ${rows.length} sətir tapıldı, ilk 5 göstərildi.</div>`;
        }

        tableContainer.innerHTML = tableHtml;
        
        const resultContainer = document.getElementById('importResultContainer');
        resultContainer.innerHTML = `
            <button class="btn btn-primary" id="runImportBtn">
                <i class="fas fa-cloud-upload-alt"></i> ${rows.length} Rezervasiyanı İdxal Et
            </button>
        `;
        document.getElementById('runImportBtn').onclick = () => this.runImport();
    }

    async runImport() {
        const importBtn = document.getElementById('runImportBtn');
        const resultContainer = document.getElementById('importResultContainer');
        const fileInput = document.getElementById(window._bookingImportData.sourceTab === 'booking_tab' ? 'bookingReservationFileInput' : 'reservationFileInput');

        if (!window._bookingImportData) {
            resultContainer.innerHTML = `<div style="color:#ef4444;">İdxal üçün məlumat tapılmadı.</div>`;
            if (fileInput) fileInput.value = '';
            return;
        }

        importBtn.disabled = true;
        importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İdxal edilir...';

        const { rows, colIndexes } = window._bookingImportData;
        const result = await this._importBookingRowsAsReservations(rows, colIndexes);

        let html = `<div style="color:#10b981;font-weight:600;">${result.succeeded.length} rezervasiya uğurla idxal edildi.</div>`;
        if (result.failed && result.failed.length) {
            html += `<div style="color:#ef4444;margin-top:0.5rem;"><strong>${result.failed.length} xəta aşkarlandı:</strong><ul style="margin:0.5rem 0 0 1rem; max-height: 150px; overflow-y: auto;">`;
            result.failed.forEach(msg => html += `<li>${msg}</li>`);
            html += '</ul></div>';
        }
        resultContainer.innerHTML = html;

        // Clear the stored import data and reset file input
        delete window._bookingImportData;
        if (fileInput) fileInput.value = '';
        
        // RELIABILITY IMPROVEMENT: Force sync to online database after import
        if (window.app && window.app.ws && typeof window.app.ws.performSync === 'function') {
            console.log("Forcing sync after import...");
            await window.app.ws.performSync(true); // true to force immediate sync
        }

        // Reload reservations module to show new data
        setTimeout(() => window.app && window.app.loadModule('reservations'), 850);
    }

    async _importBookingRowsAsReservations(rows, colIndexes) {
        const failed = [], succeeded = [];
        if (!window.app || !Array.isArray(rows)) return { failed: ['Sistem hazır deyil.'], succeeded: [] };

        // Start with fresh data from the global app state
        let allGuests = [...window.app.data.guests];
        let allReservations = [...window.app.data.reservations];
        
        for (const [i, r] of rows.entries()) {
            const rowNum = i + 2; 
            let guestName = '';
            let reservationNumber = '';

            try {
                const guestNameCol = colIndexes.guestName;
                const checkInCol = colIndexes.checkIn;
                const checkOutCol = colIndexes.checkOut;
                const bookedOnCol = colIndexes.bookedOn;
                const statusCol = colIndexes.status;
                const adultsCol = colIndexes.adults;
                const childrenCol = colIndexes.children;
                const commissionAmountCol = colIndexes.commissionAmount;
                const bookerCountryCol = colIndexes.bookerCountry;
                const phoneNumberCol = colIndexes.phoneNumber;
                const totalAmountCol = colIndexes.totalAmount;
                const externalReferenceCol = colIndexes.externalReference;
                const addressCol = colIndexes.address;
                const remarksCol = colIndexes.remarks;
                const emailCol = colIndexes.email;
                const roomNumberCol = colIndexes.roomNumber; // NEW
                const roomTypeNameCol = colIndexes.roomTypeName; // NEW
                
                guestName = String(r[guestNameCol] || "").trim();
                reservationNumber = (externalReferenceCol !== undefined && r[externalReferenceCol] !== undefined) ? String(r[externalReferenceCol]).trim() : '';

                if (!guestName && !reservationNumber) {
                    throw new Error("Qonaq adı və ya rezervasiya nömrəsi boşdur.");
                }
                
                let checkIn = this._parseDateForImport(r[checkInCol], false);
                let checkOut = this._parseDateForImport(r[checkOutCol], false);
                let bookedOn = this._parseDateForImport(r[bookedOnCol], true);
                if (!bookedOn) bookedOn = new Date().toISOString(); 

                if (!checkIn || !checkOut) {
                    throw new Error("Giriş və ya çıxış tarixi tapılmadı və ya formatı düzgün deyil.");
                }

                // Check if an existing reservation with this externalReference already exists.
                // This ensures that duplicate reservations (based on Booking.com's external reference)
                // are not created. If found, the existing reservation will be updated instead.
                let existingReservation = allReservations.find(res => res.externalReference === reservationNumber);

                // --- LOGIC: Skip creating new 'cancelled' reservations if no existing record ---
                // If it's a new reservation (no existing one found) AND the status from the import is 'cancelled',
                // we skip adding it to avoid cluttering the system with irrelevant past cancellations.
                if (!existingReservation && status === 'cancelled') {
                    failed.push(`Sətir ${rowNum} (${guestName || reservationNumber}): Ləğv edilmiş rezervasiya mövcud olmadığı üçün idxal edilmədi.`);
                    continue; // Skip to the next row
                }
                // --- END LOGIC ---

                let guest = allGuests.find(g => g.name.trim().toLowerCase() === guestName.toLowerCase());
                
                if (!guest && this._needsTranslation(guestName)) {
                    const translatedName = this._transliterate(guestName);
                    guest = allGuests.find(g => g.name.toLowerCase().includes(translatedName.toLowerCase()));
                }

                const phoneNumber = (phoneNumberCol !== undefined && r[phoneNumberCol] !== undefined) ? String(r[phoneNumberCol] || '').trim() : '';
                const guestAddress = (addressCol !== undefined && r[addressCol] !== undefined) ? String(r[addressCol] || '').trim() : '';
                const guestNationality = (bookerCountryCol !== undefined && r[bookerCountryCol] !== undefined) ? String(r[bookerCountryCol] || '').trim() : '';
                const guestEmail = (emailCol !== undefined && r[emailCol] !== undefined) ? String(r[emailCol] || '').trim() : '';

                let guestId;
                if (!guest) {
                    let finalGuestName = guestName;
                    if (this._needsTranslation(guestName)) {
                        const translatedName = this._transliterate(guestName);
                        finalGuestName = `${guestName}${translatedName && translatedName.toLowerCase() !== guestName.toLowerCase() ? ` (${translatedName})` : ''}`;
                    }
                    // Ensure basic info like phone and passport (if available from excel) is added.
                    const newGuestData = {
                        name: finalGuestName,
                        phone: phoneNumber,
                        email: guestEmail,
                        passportNo: '', // Not typically in booking.com exports
                        nationality: guestNationality,
                        address: guestAddress,
                        birthDate: '',
                        gender: '', // Not typically in booking.com exports
                        createdAt: bookedOn
                    };
                    const createdGuest = await window.app.createGuest(newGuestData);
                    guestId = createdGuest.id;
                    // REFRESH allGuests to include the newly created guest for subsequent lookups in the same batch
                    allGuests = window.app.data.guests; 
                } else {
                    guestId = guest.id;
                    let guestUpdated = false;
                    const guestUpdates = {};
                    if (phoneNumber && !guest.phone) { guestUpdates.phone = phoneNumber; guestUpdated = true; }
                    if (guestNationality && !guest.nationality) { guestUpdates.nationality = guestNationality; guestUpdated = true; }
                    if (guestAddress && !guest.address) { guestUpdates.address = guestAddress; guestUpdated = true; }
                    if (guestEmail && !guest.email) { guestUpdates.email = guestEmail; guestUpdated = true; }
                    if (guestUpdates.email && !guest.email && guestUpdates.email.includes('@')) { guestUpdates.email = guestUpdates.email.toLowerCase(); guestUpdated = true; }

                    if (guestUpdated) {
                        await window.app.updateGuest(guest.id, guestUpdates);
                        // REFRESH allGuests to reflect the update for subsequent lookups in the same batch
                        allGuests = window.app.data.guests;
                    }
                }
                
                const nights = window.app.calculateNights(checkIn, checkOut);
                
                // --- LOGIC: Always set roomId to null for imported reservations. ---
                // Imported reservations generally don't have a room assignment at import,
                // or the assigned room might not match the hotel's internal room IDs.
                // Room assignments are handled manually after import.
                let roomId = null; 

                const reservationData = {
                    guestId,
                    roomId: roomId, // Always null for imported reservations
                    checkIn,
                    checkOut,
                    adults: parseInt(r[adultsCol]) || 1,
                    children: parseInt(r[childrenCol]) || 0,
                    status,
                    totalAmount,
                    nights,
                    roomTotal: totalAmount, 
                    servicesTotal: 0, // No services in typical Booking.com exports
                    selectedServices: [],
                    externalReference: reservationNumber, 
                    source: 'online', // Always 'online' for Booking.com imports
                    commissionAmount: commissionAmount,
                    createdAt: bookedOn
                };

                if (remarksCol !== undefined && r[remarksCol] !== undefined) {
                    reservationData.notes = String(r[remarksCol]).trim();
                }
                if (emailCol !== undefined && r[emailCol] !== undefined) {
                    reservationData.email = String(r[emailCol]).trim(); // Store email directly on reservation if available
                }
                if (phoneNumberCol !== undefined && r[phoneNumberCol] !== undefined) {
                    reservationData.phone = String(r[phoneNumberCol]).trim(); // Store phone directly on reservation if available
                }

                // If an existing reservation (by externalReference) is found, update it.
                // This ensures duplicate entries are avoided and status changes (e.g., from confirmed to cancelled)
                // or other updated fields in the import are applied to the existing record.
                if (existingReservation) {
                    await window.app.updateReservation(existingReservation.id, reservationData);
                    succeeded.push(`Sətir ${rowNum} (${reservationNumber} - ${guestName}): Güncəlləndi`);
                    // REFRESH allReservations to reflect the update for subsequent lookups in the same batch
                    allReservations = window.app.data.reservations;
                } else {
                    const createdReservation = await window.app.createReservation(reservationData, 'online');
                    succeeded.push(`Sətir ${rowNum} (${reservationNumber} - ${guestName}): Əlavə edildi`);
                    // REFRESH allReservations to include the newly created reservation for subsequent lookups in the same batch
                    allReservations = window.app.data.reservations; 
                }

            } catch (err) {
                const identifier = guestName || reservationNumber || `Sətir ${rowNum}`;
                failed.push(`Sətir ${rowNum} (${identifier}): ${err.message}`);
            }
        }
        return { failed, succeeded };
    }

    renderReservationRow(reservation, data, rowIndex) {
        const guest = data.guests.find(g => g.id === reservation.guestId);
        const room = data.rooms.find(rm => rm.id === reservation.roomId);
        
        // Calculate payment info using the new financial summary
        const financialSummary = (window.app && typeof window.app.getReservationFinancialSummary === 'function') ? window.app.getReservationFinancialSummary(reservation.id) : null;
        
        const totalAmountForDisplay = financialSummary?.totalAmountDue || (reservation.totalAmount || 0); 
        const paidAmount = financialSummary?.totalPaid || 0;
        const posSalesTotal = financialSummary?.posSalesAmount || 0;
        const debt = financialSummary?.remainingBalance || 0;
        const actualDiscountAmount = financialSummary?.actualDiscountAmount || 0;

        let discountText = "";
        if (actualDiscountAmount > 0) {
            discountText = `Endirim: -₼${actualDiscountAmount.toFixed(2)}`;
            if (financialSummary?.discountType === 'percent') {
                discountText += ` (${financialSummary.discountValue}%)`;
            }
        }
        
        let paymentStatus = debt <= 0 ? 'Ödənilib' : `Borc: ₼${debt.toFixed(2)}`;
        let paymentStatusClass = debt <= 0 ? 'status-confirmed' : 'status-pending';

        // OPTIMIZED: Only show limited data and compact actions on mobile
        const isMobile = window.innerWidth <= 800;

        // Format date fields with dd.mm.yyyy:
        const formatDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate : d => d;

        let minimalGuest = guest ? guest.name : 'N/A';
        let minimalRoom = room ? room.number : 'N/A';
        const displayId = reservation.publicId || (window.app ? window.app.formatInternalId(reservation.id, 'RZ') : reservation.id);

        const canChangeStatus = window.app?.authManager?.hasPermission?.('reservations', 'changeStatus');
        const reservationStatuses = ["pending", "confirmed", "checkout", "cancelled"];

        return `
            <tr>
                <td>${rowIndex}</td>
                <td>
                    <strong>${displayId}</strong>
                    ${reservation.externalReference ? `<br><small style="color:#64748b;">(#${reservation.externalReference})</small>` : ''}
                </td>
                <td>
                     <small style="color:#64748b;">
                        ${isMobile ? minimalGuest : guest ? guest.name : 'N/A'}<br>
                        (${reservation.source === 'online' ? 'Online' : 'Sistem'})
                    </small>
                </td>
                <td>${isMobile ? minimalRoom : `${room ? room.number : 'N/A'}<br><small>${room ? room.type : ''}</small>`}</td>
                <td>${formatDate(reservation.checkIn)}</td>
                <td>${formatDate(reservation.checkOut)}</td>
                <td>${reservation.adults}${reservation.children > 0 ? ' + ' + reservation.children + ' uşaq' : ''}</td>
                <td>${reservation.nights || 'N/A'}</td>
                <td>
                    <span class="status-badge ${reservation.source === 'online' ? 'status-pending' : 'status-confirmed'}">
                        ${reservation.source === 'online' ? 'Online' : 'Sistem'}
                    </span>
                </td>
                <td>
                    <strong style="color: ${debt > 0 ? '#ef4444' : '#10b981'}; cursor:pointer;" onclick="window.reservationsComponent.showReservationFinancialDetails('${reservation.id}')">
                        ₼${debt.toFixed(2)}
                    </strong>
                    ${actualDiscountAmount > 0 ? `<br><small style="color: #ef4444;">${discountText}</small>` : ''}
                    ${posSalesTotal > 0 ? `<br><small style="color: #64748b;">POS: ₼${posSalesTotal.toFixed(2)}</small>` : ''}
                    <br><small class="status-badge ${paymentStatusClass}" style="font-size: 0.7rem; padding: 0.125rem 0.375rem;">${paymentStatus}</small>
                </td>
                <td>
                    ${canChangeStatus ? `
                        <select class="form-select" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" 
                                onchange="window.app.promptChangeReservationStatus('${reservation.id}', this.value)">
                            ${reservationStatuses.map(status => `
                                <option value="${status}" ${reservation.status === status ? 'selected' : ''}>
                                    ${window.statusHelper.getReservationStatus(status)}
                                </option>
                            `).join('')}
                        </select>
                    ` : `
                        <span class="status-badge status-${reservation.status}">
                            ${window.statusHelper.getReservationStatus(reservation.status)}
                        </span>
                    `}
                </td>
                <td>
                    <div class="table-actions" style="display:flex;flex-flow:${isMobile?'row wrap':'nowrap'};gap:0.30rem;">
                        <button class="btn btn-secondary" onclick="window.modalManager.showReservationDetails('${reservation.id}')" title="Ətraflı bax" style="background-color: #3b82f6; color: white;padding:0.5em;">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="window.modalManager.showReservationForm('${reservation.id}')" title="Redaktə et" style="padding:0.5em;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="window.roomsComponent.showRelocateRoomModal('${reservation.id}')" title="Otağı dəyiş" style="padding:0.5em;">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                        ${debt > 0 && reservation.status !== 'cancelled' ? `
                        <button class="btn btn-secondary" onclick="window.modalManager.hideModal(); window.modalManager.showCashForm('income', null, '${reservation.id}')" title="Ödəniş qəbul et" style="background-color: #10b981; color: white;padding:0.5em;">
                            <i class="fas fa-money-bill-wave"></i>
                        </button>
                        ` : ''}
                        ${reservation.status !== 'cancelled' ? `
                        <button class="btn btn-secondary" onclick="window.app.generateInvoiceForReservation('${reservation.id}')" title="Faktura yarat / Bax" style="padding:0.5em;">
                            <i class="fas fa-file-invoice"></i>
                        </button>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="window.app.deleteReservation('${reservation.id}')" title="Sil" style="padding:0.5em;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // NEW: Function to show reservation financial details and payment history in a modal
    showReservationFinancialDetails(reservationId) {
        try {
            const reservation = window.app.data.reservations.find(r => r.id == reservationId);
            if (!reservation) {
                window.notificationManager?.showNotification('error', 'Xəta', 'Rezervasiya tapılmadı');
                return;
            }

            const guest = window.app.data.guests.find(g => g.id === reservation.guestId);
            const room = window.app.data.rooms.find(r => r.id === reservation.roomId);

            const financialSummary = window.app.getReservationFinancialSummary(reservation.id);
            const totalAmountDue = financialSummary?.totalAmountDue || 0;
            const paidAmount = financialSummary?.totalPaid || 0;
            const remainingDebt = financialSummary?.remainingBalance || 0;
            const posSalesTotal = financialSummary?.posSalesAmount || 0;
            const actualDiscountAmount = financialSummary?.actualDiscountAmount || 0;

            const payments = financialSummary?.payments || [];
            
            const formatDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate : d => d;
            const displayId = reservation.publicId || (window.app ? window.app.formatInternalId(reservation.id, 'RZ') : reservation.id);

            let paymentHistoryHtml = '';
            if (payments.length > 0) {
                paymentHistoryHtml = `
                    <h5 style="margin: 1.5rem 0 0.5rem 0; color: #1e293b;">Ödəniş Tarixçəsi:</h5>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Tarix</th>
                                <th>Növ</th>
                                <th>Məbləğ</th>
                                <th>Təsvir</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.map(p => {
                                const txDisplayId = p.publicId || (window.app ? window.app.formatInternalId(p.id, 'KS') : p.id);
                                return `
                                    <tr>
                                        <td>${formatDate(p.date || p.createdAt, true)}</td>
                                        <td>${p.category}</td>
                                        <td>₼${p.amount.toFixed(2)}</td>
                                        <td>${p.description || '-'} (ID: ${txDisplayId})</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                paymentHistoryHtml = `<p style="color:#64748b; margin-top:1.5rem;">Bu rezervasiya üçün heç bir ödəniş yoxdur.</p>`;
            }

            const content = `
                <div style="padding: 0.5rem 0;">
                    <h3 style="color: #3b82f6; margin: 0 0 1rem 0;">Rezervasiya Maliyyə Detalları</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.95em;">
                        <div><strong>Rezervasiya ID:</strong> ${displayId}</div>
                        <div><strong>Qonaq:</strong> ${guest?.name || 'N/A'}</div>
                        <div><strong>Otaq:</strong> ${room?.number || 'N/A'}</div>
                        <div><strong>Giriş:</strong> ${formatDate(reservation.checkIn)}</div>
                        <div><strong>Çıxış:</strong> ${formatDate(reservation.checkOut)}</div>
                        <div><strong>Otaq Məbləği:</strong> ₼${(reservation.roomTotal || 0).toFixed(2)}</div>
                        <div><strong>Xidmətlər Cəmi:</strong> ₼${(reservation.servicesTotal || 0).toFixed(2)}</div>
                        <div><strong>POS Satışları:</strong> ₼${posSalesTotal.toFixed(2)}</div>
                        <div><strong>Endirim:</strong> -₼${actualDiscountAmount.toFixed(2)}</div>
                        <div><strong>Ümumi Borc:</strong> ₼${totalAmountDue.toFixed(2)}</div>
                        <div><strong>Ödənilən:</strong> ₼${paidAmount.toFixed(2)}</div>
                        <div>
                            <strong>Qalıq Borc:</strong> 
                            <span style="color: ${remainingDebt > 0 ? '#ef4444' : '#10b981'}; font-weight: bold;">
                                ₼${remainingDebt.toFixed(2)}
                            </span>
                        </div>
                    </div>
                    ${paymentHistoryHtml}
                </div>
            `;
            const actions = `
                <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
                <button class="btn btn-primary" onclick="window.modalManager.showReservationDetails('${reservation.id}')">
                    <i class="fas fa-eye"></i> Ətraflı Bax
                </button>
                ${remainingDebt > 0 && reservation.status !== 'cancelled' ? `
                <button class="btn btn-secondary" onclick="window.modalManager.hideModal(); window.modalManager.showCashForm('income', null, '${reservation.id}')">
                    <i class="fas fa-money-bill-wave"></i> Ödəniş al
                </button>
                ` : ''}
            `;
            window.modalManager.showModal(`Rezervasiya Borc Detalları #${displayId}`, content, actions);

        } catch (error) {
            console.error('Error showing reservation financial details:', error);
            window.notificationManager?.showNotification('error', 'Modal Xətası', 'Maliyyə detalları göstərilmədi.');
        }
    }

    // NEW: Function to show room relocation modal
    showRelocateRoomModal(reservationId) {
        const reservation = window.app.data.reservations.find(r => r.id === reservationId);
        if (!reservation) {
            window.notificationManager?.showNotification('error', 'Xəta', 'Rezervasiya tapılmadı.');
            return;
        }

        const currentRoom = window.app.data.rooms.find(r => r.id === reservation.roomId);
        const guest = window.app.data.guests.find(g => g.id === reservation.guestId);

        // Get available rooms for the current reservation period, excluding its own current room
        const availableRooms = window.reservationForm.getAvailableRooms(
            window.app.data,
            reservation.checkIn,
            reservation.checkOut,
            reservation.id // Exclude the current reservation itself from conflicts
        );

        // Ensure the current room is an option (and selected) even if it conflicts with something else
        // This is important if it's the *only* option, but typically it should be handled by the exclusion in getAvailableRooms
        const isCurrentRoomStillAvailable = availableRooms.some(r => r.id === currentRoom?.id);
        
        let roomOptionsHtml = '';
        if (availableRooms.length === 0 && !currentRoom) {
            roomOptionsHtml = '<option value="" disabled>Bu tarixlər üçün uyğun otaq yoxdur</option>';
        } else {
            roomOptionsHtml += '<option value="">Otaq seçin</option>'; // Default empty option
            // Add current room as an option, always at the top if it exists
            if (currentRoom) {
                roomOptionsHtml += `<option value="${currentRoom.id}" 
                                            data-price="${currentRoom.price}" 
                                            ${currentRoom.id === reservation.roomId ? 'selected' : ''}>
                                            ${currentRoom.number} - ${currentRoom.type} (Hazırkı Otaq)
                                    </option>`;
            }
            // Add other available rooms
            availableRooms.filter(r => r.id !== currentRoom?.id).forEach(room => {
                roomOptionsHtml += `<option value="${room.id}" data-price="${room.price}">
                                            ${room.number} - ${room.type} (₼${room.price}/gecə)
                                    </option>`;
            });
        }
        
        const displayResId = reservation.publicId || (window.app ? window.app.formatInternalId(reservation.id, 'RZ') : reservation.id);
        const modalContent = `
            <form id="relocateRoomForm" data-reservation-id="${reservation.id}">
                <div class="form-group">
                    <label class="form-label">Rezervasiya ID:</label>
                    <input type="text" class="form-input" value="${displayResId}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Qonaq:</label>
                    <input type="text" class="form-input" value="${guest?.name || 'N/A'}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Giriş Tarixi:</label>
                    <input type="text" class="form-input" value="${window.app.formatDate(reservation.checkIn)}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Çıxış Tarixi:</label>
                    <input type="text" class="form-input" value="${window.app.formatDate(reservation.checkOut)}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Hazırkı Otaq:</label>
                    <input type="text" class="form-input" value="${currentRoom?.number || 'N/A'}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label required">Yeni Otaq Seçin</label>
                    <select class="form-select" name="newRoomId" id="newRoomId" required>
                        ${roomOptionsHtml}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Yeni Gecəlik Qiymət (₼)</label>
                    <input type="number" class="form-input" name="newRoomPrice" id="newRoomPrice" min="0" step="0.01" 
                           value="${currentRoom?.price || 0}" required>
                </div>
            </form>
            <script>
                // Update newRoomPrice field when a new room is selected
                document.getElementById('newRoomId').addEventListener('change', function() {
                    const selectedOption = this.options[this.selectedIndex];
                    const newRoomPriceInput = document.getElementById('newRoomPrice');
                    if (selectedOption && selectedOption.value) {
                        const price = parseFloat(selectedOption.dataset.price);
                        if (!isNaN(price)) {
                            newRoomPriceInput.value = price.toFixed(2);
                        }
                    } else {
                        newRoomPriceInput.value = '';
                    }
                });
            </script>
        `;

        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Ləğv et</button>
            <button class="btn btn-primary" onclick="window.roomsComponent.changeReservationRoom('${reservation.id}')">
                <i class="fas fa-exchange-alt"></i> Otağı Dəyiş
            </button>
        `;

        window.modalManager.showModal('Otağın Yerdəyişməsi', modalContent, actions);
    }

    // NEW: Function to handle room change for a reservation
    async changeReservationRoom(reservationId) {
        const form = document.getElementById('relocateRoomForm');
        if (!form) {
            window.notificationManager?.showNotification('error', 'Form xətası', 'Relocate form tapılmadı.');
            return;
        }

        const newRoomId = form.newRoomId.value;
        const newRoomPrice = parseFloat(form.newRoomPrice.value); // This is the price per night of the NEW room

        if (!newRoomId) {
            window.notificationManager?.showNotification('error', 'Məlumat xətası', 'Yeni otaq seçilməyib.');
            return;
        }
        if (isNaN(newRoomPrice) || newRoomPrice < 0) {
            window.notificationManager?.showNotification('error', 'Məlumat xətası', 'Qiymət düzgün deyil.');
            return;
        }

        const reservation = window.app.data.reservations.find(r => r.id === reservationId);
        if (!reservation) {
            window.notificationManager?.showNotification('error', 'Xəta', 'Rezervasiya tapılmadı.');
            return;
        }

        // Check if the new room is actually available for the given dates
        const availableRooms = window.reservationForm.getAvailableRooms(
            window.app.data,
            reservation.checkIn,
            reservation.checkOut,
            reservation.id // Exclude the current reservation itself from conflicts
        );
        const selectedNewRoom = availableRooms.find(r => r.id === newRoomId);

        if (!selectedNewRoom && newRoomId !== reservation.roomId) { // If it's not the old room, and not available
            window.notificationManager?.showNotification('warning', 'Otaq doludur', 'Seçilmiş otaq bu tarixlərdə mövcud deyil.');
            return;
        }
        
        // As per user's request: "rezervasiya məbləği, ödənişlər, xidmətlər və s. Dəyişməsin"
        // This means the financial fields (totalAmount, roomTotal, servicesTotal, discount) should remain
        // exactly as they were on the original reservation, even if the room's base price differs.
        const updatedData = {
            ...reservation, // Keep all original reservation data (including totalAmount, roomTotal, servicesTotal)
            roomId: newRoomId, // ONLY update the room ID
            // We do NOT recalculate roomTotal or totalAmount here.
            // The original financial terms of the reservation are preserved.
        };

        try {
            await window.app.updateReservation(reservationId, updatedData);
            window.modalManager.hideModal();
            window.notificationManager?.showNotification('success', 'Uğurlu', 'Otaq uğurla dəyişdirildi.');
        } catch (error) {
            window.notificationManager?.showNotification('error', 'Otaq Dəyişmə Xətası', error.message || 'Otağı dəyişmək mümkün olmadı.');
        }
    }
}