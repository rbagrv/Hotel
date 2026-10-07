// Reservations component with Booking.com import (Demo) - Updated for Booking.com columns
export default class ReservationsComponent {
    constructor() {
        // Initialize active tab for rooms view
        if (localStorage.getItem('reservationsComponent_activeTab') === null) {
            localStorage.setItem('reservationsComponent_activeTab', 'main'); // Default to main (table) view
        }
        if (localStorage.getItem('reservationsComponent_calendarDate') === null) {
            localStorage.setItem('reservationsComponent_calendarDate', new Date().toISOString());
        }
        if (localStorage.getItem('reservationsComponent_calRoomTypeFilter') === null) {
            localStorage.setItem('reservationsComponent_calRoomTypeFilter', 'Bütün Növlər');
        }
        if (localStorage.getItem('reservationsComponent_calIsFilterOpen') === null) {
            localStorage.setItem('reservationsComponent_calIsFilterOpen', 'false');
        }
    }

    // Helper to get filter value from localStorage
    getFilter(key, defaultValue = '') {
        const storedValue = localStorage.getItem(`reservationsComponent_${key}`);
        // Treat explicit 'null'/'undefined' strings or actual null as default
        if (storedValue === null || storedValue === 'undefined' || storedValue === 'null') {
            return defaultValue;
        }
        return storedValue;
    }

    // Helper to set filter value in localStorage
    setFilter(key, value) {
        localStorage.setItem(`reservationsComponent_${key}`, value);
    }

    _transliterationMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
        'з': 'z', 'и': 'i', 'y': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
        'п': 'p', 'р': 'p', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': "'", 'э': 'e', 'ю': 'yu',
        'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
        'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
        'П': 'P', 'Р': 'P', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
        'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': "'", 'Э': 'E', 'Ю': 'Yu',
        'Я': 'Ya',
        // Azerbaijani specific letters
        'ə': 'a', 'Ə': 'A', 'ç': 'ch', 'Ç': 'Ch', 'ğ': 'gh', 'Ğ': 'Gh', 'ı': 'i', 'I': 'I',
        'ö': 'o', 'Ö': 'O', 'ş': 'sh', 'Ş': 'Sh', 'ü': 'u', 'Ü': 'U'
    };

    _transliterate(text) {
        return text.split('').map(char => this._transliterationMap[char] || char).join('');
    }

    _needsTranslation(name) {
        // Simple check for non-latin characters (e.g., Cyrillic, Arabic)
        return /[^\u0000-\u007F]/.test(name);
    }
    
    // NEW: Add a robust date parser for import
    _parseDateForImport(dateInput, returnFullISO = false) {
        if (!dateInput) return null;

        // 1. Handle Excel's numeric date format
        if (typeof dateInput === 'number') {
            const date = XLSX.SSF.parse_date_code(dateInput);
            if (date && date.y && date.m && date.d) {
                const year = date.y;
                const month = String(date.m).padStart(2, '0');
                const day = String(date.d).padStart(2, '0');
                if (returnFullISO && date.t) { // If time component is also present
                    const hours = String(date.H || 0).padStart(2, '0');
                    const minutes = String(date.M || 0).padStart(2, '0');
                    const seconds = String(date.S || 0).padStart(2, '0');
                    // Excel dates are often UTC-related. Using Date.UTC to avoid timezone issues during parsing.
                    const d = new Date(Date.UTC(year, date.m - 1, day, hours, minutes, seconds));
                    return d.toISOString(); // ISO format
                }
                return `${year}-${month}-${day}`;
            }
        }

        const dateStr = String(dateInput).trim();

        // 2. Check for YYYY-MM-DD HH:mm:ss or YYYY-MM-DD format
        const isoLikeMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?$/);
        if (isoLikeMatch) {
            const datePart = isoLikeMatch[1];
            const timePart = isoLikeMatch[2] || '00:00:00';
            const d = new Date(`${datePart}T${timePart}`);
            if (!isNaN(d)) {
                return returnFullISO ? d.toISOString() : datePart;
            }
        }

        // 3. Check for DD.MM.YYYY format
        const dmyMatch = dateStr.match(/^(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})$/);
        if (dmyMatch) {
            let day = dmyMatch[1];
            let month = dmyMatch[2];
            let year = dmyMatch[3];
            if (year.length === 2) {
                year = parseInt(year) < 50 ? `20${year}` : `19${year}`; // Heuristic for 2-digit years
            }
            const d = new Date(`${year}-${month}-${day}`);
            if (!isNaN(d)) {
                 return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }

        // 4. Try parsing with new Date() for more lenient formats (e.g., "2 July 2025")
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate)) {
            const year = parsedDate.getFullYear();
            const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
            const day = String(parsedDate.getDate()).padStart(2, '0');
            if (returnFullISO) {
                return parsedDate.toISOString();
            }
            return `${year}-${month}-${day}`;
        }

        return null; // Return null if no format matches
    }

    goToPage(pageNumber) {
        this.setFilter('currentPage', pageNumber);
        window.app.loadModule('reservations');
    }

    renderPaginationControls(currentPage, totalPages) {
        if (totalPages <= 1) return '';

        let pages = [];
        const maxPagesToShow = 5;

        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            let startPage, endPage;
            if (currentPage <= Math.ceil(maxPagesToShow / 2)) {
                startPage = 1;
                endPage = Math.min(totalPages, maxPagesToShow);
            } else if (currentPage + Math.floor(maxPagesToShow / 2) >= totalPages) {
                startPage = totalPages - maxPagesToShow + 1;
                endPage = totalPages;
            } else {
                startPage = currentPage - Math.floor(maxPagesToShow / 2);
                endPage = currentPage + Math.floor(maxPagesToShow / 2);
            }

            if (startPage > 1) {
                pages.push(1, '...');
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }

            if (endPage < totalPages) {
                pages.push('...', totalPages);
            }
        }

        const paginationHtml = pages.map(page => {
            if (page === '...') {
                return `<span class="pagination-item ellipsis">...</span>`;
            }
            return `<button class="pagination-item ${page === currentPage ? 'active' : ''}" onclick="window.reservationsComponent.goToPage(${page})">${page}</button>`;
        }).join('');

        return `
            <div class="pagination-container">
                <button class="pagination-item" ${currentPage === 1 ? 'disabled' : ''} onclick="window.reservationsComponent.goToPage(${currentPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                </button>
                ${paginationHtml}
                <button class="pagination-item" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.reservationsComponent.goToPage(${currentPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <style>
                .pagination-container { display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 1.5rem; }
                .pagination-item {
                    background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem;
                    min-width: 36px; height: 36px; padding: 0 0.75rem;
                    cursor: pointer; transition: all 0.2s; font-weight: 500;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .pagination-item:hover:not(:disabled) { background: #f1f5f9; border-color: #cbd5e1; }
                .pagination-item.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }
                .pagination-item:disabled { opacity: 0.5; cursor: not-allowed; }
                .pagination-item.ellipsis { border: none; background: none; cursor: default; }
            </style>
        `;
    }
    
    render(data) {
        // --- ADDED: Make sure import listeners are always attached after render ---
        setTimeout(() => this.attachImportListeners(), 100);

        // --- Column filters in header ---
        // Use component's own getFilter/setFilter methods
        const searchVal = this.getFilter('searchVal');
        const roomSearchVal = this.getFilter('roomSearchVal');
        const checkInDateVal = this.getFilter('checkInDateVal');
        const checkOutDateVal = this.getFilter('checkOutDateVal');
        const sourceVal = this.getFilter('sourceVal');
        const statusVal = this.getFilter('statusVal');
        const staffVal = this.getFilter('staffVal'); // NEW: Get staff filter value

        const guests = data.guests || [];
        const rooms = data.rooms || [];
        const staffList = data.staff || []; // NEW: Get staff list for filter dropdown
        const statuses = ["pending","confirmed","checkout","cancelled"];
        const sources = ["system", "online"]; // Define sources for filter options

        let filtered = data.reservations || [];
        if (searchVal) {
            filtered = filtered.filter(r => {
                const guest = guests.find(g => g.id === r.guestId);
                return (
                    (guest && guest.name.toLowerCase().includes(searchVal.toLowerCase())) ||
                    (r.externalReference && r.externalReference.toLowerCase().includes(searchVal.toLowerCase())) ||
                    (r.publicId && r.publicId.toLowerCase().includes(searchVal.toLowerCase())) || // Search by publicId
                    (r.id && r.id.toString().includes(searchVal))
                );
            });
        }
        if (roomSearchVal) {
             filtered = filtered.filter(r => {
                const room = rooms.find(rm => rm.id === r.roomId);
                return (room && room.number && room.number.toLowerCase().includes(roomSearchVal.toLowerCase()));
             });
        }
        // Apply filters only if their value is not an empty string (or equivalent)
        if (checkInDateVal !== '') filtered = filtered.filter(r => r.checkIn === checkInDateVal);
        if (checkOutDateVal !== '') filtered = filtered.filter(r => r.checkOut === checkOutDateVal);
        if (sourceVal !== '') filtered = filtered.filter(r => r.source === sourceVal); // Apply source filter
        if (statusVal !== '') filtered = filtered.filter(r => r.status === statusVal);
        if (staffVal !== '') filtered = filtered.filter(r => r.createdBy === staffVal); // NEW: Apply staff filter

        // OPTIMIZATION: Sort by newest check-in first (descending), then by ID. 
        filtered = filtered.slice().sort((a, b) => {
            const statusOrder = {
                'confirmed': 1,
                'pending': 2,
                'checkout': 4,
                'cancelled': 5
            };

            const statusA = statusOrder[a.status] || 3; // Default to 3 for any other status
            const statusB = statusOrder[b.status] || 3;

            if (statusA !== statusB) {
                return statusA - statusB;
            }
            
            if (a.checkIn !== b.checkIn) {
                return (b.checkIn || '').localeCompare(a.checkIn || '');
            }
            return (b.id || '').localeCompare(a.id || '');
        });

        // Pagination logic
        const totalItems = filtered.length;
        const pageSize = 10;
        const totalPages = Math.ceil(totalItems / pageSize);
        let currentPage = parseInt(this.getFilter('currentPage', '1'));

        if (currentPage > totalPages && totalPages > 0) {
            currentPage = totalPages;
        }
        this.setFilter('currentPage', currentPage);
        
        const startIndex = (currentPage - 1) * pageSize;
        const paginatedData = filtered.slice(startIndex, startIndex + pageSize);

        const isBookingTab = this.getFilter('activeTab') === 'booking';
        const isCalendarTab = this.getFilter('activeTab') === 'calendar';
        // Top tab navigation
        let tabNav = `
            <div style="display: flex; gap: 1em; margin-bottom: 1.7em; align-items:center;">
                <button class="btn btn-secondary${!isBookingTab && !isCalendarTab ? ' btn-primary' : ''}" onclick="window.reservationsComponent.setFilter('activeTab', 'main');window.app.loadModule('reservations')" style="min-width:110px;">Cədvəl</button>
                <button class="btn btn-secondary${isCalendarTab ? ' btn-primary' : ''}" onclick="window.reservationsComponent.setFilter('activeTab', 'calendar');window.app.loadModule('reservations')" style="min-width:110px;">Təqvim</button>
                <button class="btn btn-secondary${isBookingTab ? ' btn-primary' : ''}" onclick="window.reservationsComponent.setFilter('activeTab', 'booking');window.app.loadModule('reservations')" style="min-width:140px;">
                    <i class="fas fa-link"></i> Booking.com</button>
            </div>
        `;

        if (isCalendarTab) {
            const stayViewCalendar = window.roomsComponent && typeof window.roomsComponent.renderRoomsCalendar === 'function'
                ? window.roomsComponent.renderRoomsCalendar(data)
                : this.renderCalendarView(data);
            return `
                ${tabNav}
                ${stayViewCalendar}
            `;
        }
        
        if (isBookingTab) {
            // Re-attach listeners after rendering
            setTimeout(() => this.attachImportListeners(), 100);
            return `
                ${tabNav}
                <div class="table-container">
                    <div class="table-header">
                        <h3 class="table-title">Booking.com Rezervasiyaları</h3>
                        <div style="display:flex; gap: 0.5rem;">
                            <label class="btn btn-primary" style="margin:0;">
                               <i class="fas fa-file-excel"></i> Booking.com XLS İdxal et
                               <input type="file" id="bookingReservationFileInput" accept=".xls,.xlsx" style="display:none;">
                            </label>
                            <button class="btn btn-secondary" onclick="window.modalManager && window.modalManager.showBookingIntegration && window.modalManager.showBookingIntegration()">
                                <i class="fas fa-cog"></i> Booking.com Tənzimləmələri
                            </button>
                        </div>
                    </div>
                    <div id="importPreviewContainer" style="margin-top: 1rem; padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: 0.75rem; display: none;">
                        <h4 id="importPreviewTitle" style="margin: 0 0 1rem 0;">İdxal Önizləməsi</h4>
                        <div id="importPreviewTableContainer"></div>
                        <div id="importResultContainer" style="margin-top: 1.5rem;"></div>
                    </div>
                    <div style="margin:1em 1.5rem; color:#64748b;">
                        <i class="fas fa-info-circle"></i> Bu bölmə Booking.com-dan yüklənən Excel fayllarını (məsələn, "Report: Reservations") idxal etmək üçündür.
                        API inteqrasiyası ayrıca tənzimləmələr bölməsində qurulmalıdır.
                    </div>
                    <div style="padding: 1.5rem;">
                       <!-- Placeholder for Booking.com specific content or import history, if any -->
                       ${this.renderBookingIntegrationContent()}
                    </div>
                </div>
            `;
        }

        // ---- EXISTING CLASSIC SYSTEM RESERVATIONS TABLE ----
        return `
            ${tabNav}
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Rezervasiyaların İdarə Edilməsi</h3>
                    <div style="display:flex; gap: 0.5rem;">
                        <label class="btn btn-secondary" style="margin:0;">
                           <i class="fas fa-file-excel"></i> Rezervasiya İdxal et (XLS)
                           <input type="file" id="reservationFileInput" accept=".xls,.xlsx" style="display:none;">
                        </label>
                        <button class="btn btn-primary" onclick="window.modalManager.showReservationForm()">
                            <i class="fas fa-plus"></i>
                            Yeni Rezervasiya
                        </button>
                    </div>
                </div>
                <div id="importPreviewContainer" style="margin-top: 1rem; padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: 0.75rem; display: none;">
                    <h4 id="importPreviewTitle" style="margin: 0 0 1rem 0;">İdxal Önizləməsi</h4>
                    <div id="importPreviewTableContainer"></div>
                    <div id="importResultContainer" style="margin-top: 1.5rem;"></div>
                </div>
                <div style="overflow-x:auto;">
                <table class="data-table compact-table" style="min-width:0;"> 
                    <thead>
                        <tr>
                            <th style="min-width: 50px;">Sıra №</th>
                            <th style="min-width: 180px;">
                                ID<br>
                                <input class="form-input" style="max-width:130px;" type="text" placeholder="ID, qonaq, ref..." value="${searchVal}"
                                    id="reservationsSearchInput"
                                    oninput="window.reservationsComponent.setFilter('searchVal', this.value); window.reservationsComponent.setFilter('currentPage', 1); window.app.loadModuleDebounced('reservations');">
                            </th>
                             <th style="min-width: 180px;">Qonaq</th>
                            <th style="min-width: 100px;">
                                Otaq<br>
                                <input class="form-input" style="max-width:80px;" type="text" placeholder="Otaq №..." value="${roomSearchVal}"
                                    id="reservationsRoomSearchInput"
                                    oninput="window.reservationsComponent.setFilter('roomSearchVal', this.value); window.reservationsComponent.setFilter('currentPage', 1); window.app.loadModule('reservations');">
                            </th>
                            <th style="min-width: 120px;">
                                Giriş Tarixi<br>
                                <input type="date" class="form-input" style="max-width:120px;" value="${checkInDateVal}"
                                    onchange="window.reservationsComponent.setFilter('checkInDateVal', this.value); window.reservationsComponent.setFilter('currentPage', 1); window.app.loadModule('reservations');">
                            </th>
                            <th style="min-width: 120px;">
                                Çıxış Tarixi<br>
                                <input type="date" class="form-input" style="max-width:120px;" value="${checkOutDateVal}"
                                    onchange="window.reservationsComponent.setFilter('checkOutDateVal', this.value); window.reservationsComponent.setFilter('currentPage', 1); window.app.loadModule('reservations');">
                            </th>
                            <th style="min-width: 80px;">Nəfər</th>
                            <th style="min-width: 80px;">Gecə</th>
                            <th style="min-width: 150px;">
                                Mənbə<br>
                                <select class="form-select" style="max-width:80px;" onchange="window.reservationsComponent.setFilter('sourceVal', this.value); window.reservationsComponent.setFilter('currentPage', 1); window.app.loadModule('reservations');">
                                    <option value="">Hamısı</option>
                                    ${sources.map(s => `<option value="${s}" ${sourceVal === s ? 'selected' : ''}>${s === 'system' ? 'Sistem' : 'Online'}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 150px;">
                                Qalan Borc
                            </th>
                            <th style="min-width: 120px;">
                                Status<br>
                                <select class="form-select" style="max-width:80px;" onchange="window.reservationsComponent.setFilter('statusVal', this.value); window.reservationsComponent.setFilter('currentPage', 1); window.app.loadModule('reservations');">
                                    <option value="">Hamısı</option>
                                    ${statuses.map(s=>`<option value="${s}" ${statusVal===s?'selected':''}>${window.statusHelper.getReservationStatus(s)}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 120px;">
                                İcraçı<br>
                                <select class="form-select" style="max-width:120px;" onchange="window.reservationsComponent.setFilter('staffVal', this.value); window.reservationsComponent.setFilter('currentPage', 1); window.app.loadModule('reservations');">
                                    <option value="">Hamısı</option>
                                    ${staffList.map(s => `<option value="${window.escapeHtml(s.id)}" ${staffVal === s.id ? 'selected' : ''}>${window.escapeHtml(s.name)}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 200px;">Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedData.map((reservation, index) => this.renderReservationRow(reservation, data, startIndex + index + 1)).join('')}
                    </tbody>
                </table>
                </div>
                <div style="margin:0.5em 0; color:#64748b;font-size:0.96em;">Rezervasiya sayı: <b>${totalItems}</b></div>
                ${this.renderPaginationControls(currentPage, totalPages)}
                <button class="btn btn-secondary" style="margin-top:1em;" onclick="window.reservationsComponent.setFilter('searchVal', '');window.reservationsComponent.setFilter('roomSearchVal', '');window.reservationsComponent.setFilter('checkInDateVal', '');window.reservationsComponent.setFilter('checkOutDateVal', '');window.reservationsComponent.setFilter('sourceVal', '');window.reservationsComponent.setFilter('statusVal', '');window.reservationsComponent.setFilter('staffVal', '');window.reservationsComponent.setFilter('currentPage', '');window.app.loadModule('reservations');">
                    <i class="fas fa-times"></i> Filtri sıfırla
                </button>
            </div>
        `;
    }

    // New helper to render the main content of the Booking.com tab
    renderBookingIntegrationContent() {
        // Here you might list past imports or show API status from settings
        return `
            <h4 style="margin-top: 0; color: var(--text-color);">Son İdxallar (Demo)</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Tarix</th>
                        <th>Fayl</th>
                        <th>Uğurlu</th>
                        <th>Xətalı</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>2024-07-20</td><td>booking_report_July.xlsx</td><td>15</td><td>2</td></tr>
                    <tr><td>2024-06-15</td><td>June_reservations.xlsx</td><td>20</td><td>0</td></tr>
                </tbody>
            </table>
        `;
    }

    renderCalendarView(data) {
        // Use component's own getFilter/setFilter methods
        const date = new Date(this.getFilter('calendarDate', new Date().toISOString()));
        const year = date.getFullYear();
        const month = date.getMonth();

        const monthNames = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
        const daysOfWeek = ["B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş.", "B."];

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        // Filter rooms based on selected room type filter
        const allRooms = data.rooms || [];
        const roomTypeFilter = this.getFilter('calRoomTypeFilter');
        
        const roomTypes = ['Bütün Növlər', ...Array.from(new Set(allRooms.map((r) => r.type)))];

        // Get today's local date object and normalize it for consistent comparison
        const todayLocal = new Date();
        todayLocal.setHours(0, 0, 0, 0);

        // --- Start of new calendar structure HTML ---
        let calendarHtml = `
            <div class="card table-container">
                <div class="card-header table-header">
                    <div>
                        <h3 class="table-title">Rezervasiya Təqvimi</h3>
                        <p class="text-light" style="font-size:0.9em; margin-top:0.3em;">Otaqların vəziyyətinə və rezervasiyalara baxın.</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <button class="btn btn-secondary sm-hidden" onclick="window.reservationsComponent.setFilter('calIsFilterOpen', !(window.reservationsComponent.getFilter('calIsFilterOpen') === 'true')); window.app.loadModule('reservations');">
                            <i class="fas fa-filter"></i> Otaq Növü
                        </button>
                        <select class="form-select w-full sm-visible" style="min-width:180px;" onchange="window.reservationsComponent.setFilter('calRoomTypeFilter', this.value); window.app.loadModule('reservations');">
                            <option value="Bütün Növlər" ${roomTypeFilter === 'Bütün Növlər' ? 'selected' : ''}>Bütün Növlər</option>
                            ${roomTypes.filter(t => t !== 'Bütün Növlər').map(type => `
                                <option value="${type}" ${roomTypeFilter === type ? 'selected' : ''}>${type}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="collapsible-filter-content ${this.getFilter('calIsFilterOpen') === 'true' ? 'open' : ''} sm-hidden" style="padding:1rem;">
                    <select class="form-select w-full" onchange="window.reservationsComponent.setFilter('calRoomTypeFilter', this.value); window.app.loadModule('reservations');">
                        <option value="Bütün Növlər" ${roomTypeFilter === 'Bütün Növlər' ? 'selected' : ''}>Bütün Növlər</option>
                        ${roomTypes.filter(t => t !== 'Bütün Növlər').map(type => `
                            <option value="${type}" ${roomTypeFilter === type ? 'selected' : ''}>${type}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="calendar-nav-controls" style="display:flex; justify-content:space-between; align-items:center; padding:1em 1.5em; border-bottom:1px solid var(--border-color);">
                    <button class="btn btn-secondary" onclick="window.reservationsComponent.changeMonth(-1)"><i class="fas fa-chevron-left"></i></button>
                    <h2 style="margin:0; font-size:1.25rem;">${monthNames[month]} ${year}</h2>
                    <button class="btn btn-secondary" onclick="window.reservationsComponent.changeMonth(1)"><i class="fas fa-chevron-right"></i></button>
                </div>
                <div class="calendar-grid-container" style="padding:1.5em;">
                    <div class="calendar-grid">
                        ${daysOfWeek.map(day => `<div class="calendar-day-name">${day}</div>`).join('')}
            `;

        // Fill leading empty days
        const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0, Sunday = 6
        for (let i = 0; i < startDayOfWeek; i++) {
            calendarHtml += `<div class="calendar-day empty"></div>`;
        }

        // Fill days of the month
        for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
            const currentDate = new Date(year, month, day);
            // Normalize current calendar day to start of day for comparison
            currentDate.setHours(0, 0, 0, 0);

            // Compare local date objects directly for 'isToday'
            const isToday = currentDate.getTime() === todayLocal.getTime();

            const reservationsForDay = data.reservations.filter(res => {
                if (!['confirmed', 'pending'].includes(res.status)) return false; // Show confirmed and pending
                const checkIn = this._parseDateAsUTC(res.checkIn);
                const checkOut = this._parseDateAsUTC(res.checkOut);
                if (!checkIn || !checkOut) return false; // Guard against missing/invalid dates

                // Filter by room type if selected
                const room = allRooms.find(r => r.id === res.roomId);
                if (roomTypeFilter !== 'Bütün Növlər' && (!room || room.type !== roomTypeFilter)) {
                    return false;
                }

                // Logic for "occupied" status for the visual calendar cell: checkIn <= currentDate < checkOut
                // This means the room is occupied *for the night* before checkout.
                return checkIn.getTime() <= currentDate.getTime() && currentDate.getTime() < checkOut.getTime();
            });

            // Manually construct YYYY-MM-DD string from local date components to avoid UTC offset shift
            const localDateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

            calendarHtml += `
                <div class="calendar-day ${isToday ? 'today' : ''}" 
                     onclick="window.reservationsComponent.showReservationsForDay('${localDateString}')"> <!-- Make day clickable with correct local date -->
                    <div class="day-number">${day}</div>
                    <div class="reservations-on-day">
                        ${reservationsForDay.map(res => {
                            const guest = data.guests.find(g => g.id === res.guestId);
                            const room = data.rooms.find(rm => rm.id === res.roomId);
                            const guestName = guest ? (guest.name || '').split(' ')[0] : 'Qonaq';
                            const roomNumber = room ? room.number : 'N/A';
                            const resPublicId = res.publicId || (window.app ? window.app.formatInternalId(res.id, 'RZ') : res.id);
                            const title = `${window.escapeHtml(guest?.name || '')} - Otaq ${window.escapeHtml(roomNumber)} (${window.app.formatDate(res.checkIn)} - ${window.app.formatDate(res.checkOut)}) - ${window.statusHelper.getReservationStatus(res.status)} (ID: ${resPublicId})`;
                            const statusClass = res.status; // 'confirmed' or 'pending'

                            return `<div class="reservation-cal-item ${statusClass}" title="${window.escapeHtml(title)}">
                                ${window.escapeHtml(roomNumber)}: ${window.escapeHtml(guestName)}
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
        }

        calendarHtml += `</div></div></div>`; // Close calendar-grid, calendar-grid-container, and card
        return calendarHtml;
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

                if (h.mapped === "checkIn" || h.mapped === "checkOut") {
                    const parsedDate = this._parseDateForImport(cellValue, false);
                    cellValue = parsedDate ? window.app.formatDate(parsedDate) : String(cellValue || '');
                } else if (h.mapped === "bookedOn") {
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
                return `<td>${window.escapeHtml(cellValue)}</td>`;
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
                
                const statusText = String(r[statusCol] || 'pending').toLowerCase();
                let status = 'pending';
                if (statusText.includes('confirm')) status = 'confirmed';
                else if (statusText.includes('cancel')) status = 'cancelled';
                else if (statusText.includes('check') && (statusText.includes('out') || statusText.includes('çıxış'))) status = 'checkout';

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

                const totalAmountText = String(r[totalAmountCol] || '0').replace(/[^0-9.,]/g, '').replace(',', '.');
                const totalAmount = parseFloat(totalAmountText) || 0;

                const commissionAmountText = String(r[commissionAmountCol] || '0').replace(/[^0-9.,]/g, '').replace(',', '.');
                const commissionAmount = parseFloat(commissionAmountText) || 0;

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
                    <h5 style="margin-top: 1.5rem; color: #1e293b;">Ödəniş Tarixçəsi:</h5>
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
                                        <td>${window.escapeHtml(p.category)}</td>
                                        <td>₼${(Number(p.amount) || 0).toFixed(2)}</td>
                                        <td>${window.escapeHtml(p.description || '-')} (ID: ${window.escapeHtml(txDisplayId)})</td>
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
                        <div><strong>Rezervasiya ID:</strong> ${window.escapeHtml(displayId)}</div>
                        <div><strong>Qonaq:</strong> ${window.escapeHtml(guest?.name || 'N/A')}</div>
                        <div><strong>Otaq:</strong> ${window.escapeHtml(room?.number || 'N/A')}</div>
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
                <button class="btn btn-secondary" onclick="window.modalManager.showReservationPaymentForm('${reservation.id}')">
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

    // --- NEW: Re-adding the missing renderReservationRow method to fix the TypeError ---
    renderReservationRow(reservation, data, rowIndex) {
        const guest = data.guests.find(g => g.id === reservation.guestId);
        const room = data.rooms.find(rm => rm.id === reservation.roomId);
        const creator = data.staff.find(s => s.id === reservation.createdBy);

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
                discountText += ` (${Number(financialSummary.discountValue) || 0}%)`;
            }
        }
        
        let paymentStatus = debt <= 0 ? 'Ödənilib' : `Borc: ₼${debt.toFixed(2)}`;
        let paymentStatusClass = debt <= 0 ? 'status-confirmed' : 'status-pending';

        // OPTIMIZED: Only show limited data and compact actions on mobile
        const isMobile = window.innerWidth <= 800;

        const formatDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate : d => d;

        let minimalGuest = guest ? guest.name : 'N/A';
        let minimalRoom = room ? room.number : 'N/A';
        const displayId = reservation.publicId || (window.app ? window.app.formatInternalId(reservation.id, 'RZ') : reservation.id);
        const esc = window.escapeHtml;

        const canChangeStatus = window.app?.authManager?.hasPermission?.('reservations', 'edit');
        const reservationStatuses = ["pending", "confirmed", "occupied", "checkout", "cancelled"];

        return `
            <tr>
                <td>${rowIndex}</td>
                <td>
                    <strong>${esc(displayId)}</strong>
                    ${reservation.externalReference ? `<br><small style="color:#64748b;">(#${esc(reservation.externalReference)})</small>` : ''}
                </td>
                <td>
                     <small style="color:#64748b;">
                        ${isMobile ? esc(minimalGuest) : guest ? esc(guest.name) : 'N/A'}
                    </small>
                </td>
                <td>${isMobile ? esc(minimalRoom) : `${esc(room ? room.number : 'N/A')}<br><small>${esc(room ? room.type : '')}</small>`}</td>
                <td>${formatDate(reservation.checkIn)}</td>
                <td>${formatDate(reservation.checkOut)}</td>
                <td>${esc(reservation.adults)}${reservation.children > 0 ? ' + ' + esc(reservation.children) + ' uşaq' : ''}</td>
                <td>${esc(reservation.nights) || 'N/A'}</td>
                <td>
                    <span class="status-badge ${reservation.source === 'online' ? 'status-pending' : 'status-confirmed'}">
                        ${reservation.source === 'online' ? 'Online' : 'Sistem'}
                    </span>
                </td>
                <td>
                    <strong style="color: ${debt > 0 ? '#ef4444' : '#10b981'}; cursor:pointer;" onclick="window.reservationsComponent.showReservationFinancialDetails('${esc(reservation.id)}')">
                        ₼${debt.toFixed(2)}
                    </strong>
                    ${actualDiscountAmount > 0 ? `<br><small style="color: #ef4444;">${esc(discountText)}</small>` : ''}
                    ${posSalesTotal > 0 ? `<br><small style="color: #64748b;">POS: ₼${posSalesTotal.toFixed(2)}</small>` : ''}
                    <br><small class="status-badge ${paymentStatusClass}" style="font-size: 0.7rem; padding: 0.125rem 0.375rem;">${esc(paymentStatus)}</small>
                </td>
                <td>
                    ${canChangeStatus ? `
                        <select class="form-select" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" 
                                onchange="window.app.promptChangeReservationStatus('${esc(reservation.id)}', this.value)">
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
                <td><small>${creator ? esc(creator.name) : (reservation.createdBy ? 'Bilinmir' : 'Sistem')}</small></td>
                <td>
                    <div class="table-actions" style="display:flex;align-items:center;justify-content:flex-end;gap:0.22rem;flex-wrap:nowrap;">
                        <button class="btn btn-secondary" onclick="window.modalManager.showReservationDetails('${reservation.id}')" title="Ətraflı bax" style="background-color: #0088cc; color: white; padding: 0.3rem 0.5rem; font-size: 0.78rem;">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="window.modalManager.showReservationForm('${reservation.id}')" title="Redaktə et" style="padding: 0.3rem 0.5rem; font-size: 0.78rem;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="window.reservationsComponent.showRelocateRoomModal('${reservation.id}')" title="Otağı dəyiş" style="padding: 0.3rem 0.5rem; font-size: 0.78rem;">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                        ${debt > 0 && reservation.status !== 'cancelled' ? `
                        <button class="btn btn-secondary" onclick="window.modalManager.showReservationPaymentForm('${reservation.id}')" title="Ödəniş qəbul et" style="background-color: #22c55e; color: white; padding: 0.3rem 0.5rem; font-size: 0.78rem;">
                            <i class="fas fa-money-bill-wave"></i>
                        </button>
                        ` : ''}
                        ${reservation.status !== 'cancelled' ? `
                        <button class="btn btn-secondary" onclick="window.app.generateInvoiceForReservation('${reservation.id}')" title="Faktura yarat / Bax" style="padding: 0.3rem 0.5rem; font-size: 0.78rem;">
                            <i class="fas fa-file-invoice"></i>
                        </button>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="window.app.deleteReservation('${reservation.id}')" title="Sil" style="color: #ef4444; padding: 0.3rem 0.5rem; font-size: 0.78rem;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
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
                    <input type="text" class="form-input" value="${window.escapeHtml(guest?.name || 'N/A')}" readonly>
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
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label required">Yeni Otaq Seçin</label>
                    <select class="form-select" name="newRoomId" id="newRoomId" required>
                        ${roomOptionsHtml}
                    </select>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label">Yeni Otağın Standart Qiyməti (Məlumat üçün)</label>
                    <input type="text" class="form-input" id="newRoomPriceInfo" value="₼${(currentRoom?.price || 0).toFixed(2)}" readonly>
                    <small class="form-help" style="color:var(--warning-color); font-weight:500;">Qeyd: Otaq dəyişikliyi rezervasiyanın ümumi məbləğini dəyişməyəcək.</small>
                </div>
            </form>
            <script>
                // Update newRoomPriceInfo field when a new room is selected
                document.getElementById('newRoomId').addEventListener('change', function() {
                    const selectedOption = this.options[this.selectedIndex];
                    const newRoomPriceInfo = document.getElementById('newRoomPriceInfo');
                    if (selectedOption && selectedOption.value) {
                        const price = parseFloat(selectedOption.dataset.price);
                        if (!isNaN(price)) {
                            newRoomPriceInfo.value = '₼' + price.toFixed(2);
                        }
                    } else {
                        newRoomPriceInfo.value = '₼0.00';
                    }
                });
            </script>
        `;

        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Ləğv et</button>
            <button class="btn btn-primary" onclick="window.reservationsComponent.changeReservationRoom('${reservation.id}')">
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

        if (!newRoomId) {
            window.notificationManager?.showNotification('error', 'Məlumat xətası', 'Yeni otaq seçilməyib.');
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

    // NEW: Function to show all reservations for a specific date in a modal
    showReservationsForDay(dateString) {
        // IMPORTANT: Parse dateString as UTC midnight for consistent filtering
        const selectedDay = this._parseDateAsUTC(dateString);
        if (!selectedDay) {
            window.notificationManager?.showNotification('error', 'Xəta', 'Yanlış tarix formatı.');
            return;
        }

        const reservationsForThisDay = window.app.data.reservations.filter(res => {
            // Filter out cancelled reservations
            if (res.status === 'cancelled') return false;

            // Normalize reservation dates to UTC midnight for comparison
            const checkIn = this._parseDateAsUTC(res.checkIn);
            const checkOut = this._parseDateAsUTC(res.checkOut);
            if (!checkIn || !checkOut) return false; // Guard against missing/invalid dates

            // A reservation is active on the selected day if:
            // The selected day is on or after check-in, AND on or before check-out.
            // This captures all events occurring *on* that day, including check-ins and check-outs.
            return checkIn.getTime() <= selectedDay.getTime() && checkOut.getTime() >= selectedDay.getTime();
        }).sort((a, b) => {
            // Sort by room number first, then by check-in time
            const roomA = window.app.data.rooms.find(r => r.id === a.roomId)?.number || '';
            const roomB = window.app.data.rooms.find(r => r.id === b.roomId)?.number || '';
            
            if (roomA !== roomB) {
                return String(roomA).localeCompare(String(roomB), undefined, { numeric: true, sensitivity: 'base' });
            }
            return (this._parseDateAsUTC(a.checkIn).getTime() - this._parseDateAsUTC(b.checkIn).getTime());
        });

        const formatDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate : d => d;
        const formattedDay = formatDate(selectedDay);

        let content = '';
        if (reservationsForThisDay.length === 0) {
            content = `<p style="text-align:center; color:#64748b; padding:2rem;">${formattedDay} tarixinə heç bir rezervasiya tapılmadı.</p>`;
        } else {
            content = `
                <div style="max-height: 70vh; overflow-y: auto; padding: 0 0.5rem;">
                    <table class="data-table" style="font-size:0.92em; min-width: 700px;">
                        <thead>
                            <tr>
                                <th>Rez. ID</th>
                                <th>Qonaq</th>
                                <th>Otaq</th>
                                <th>Giriş</th>
                                <th>Çıxış</th>
                                <th>Status</th>
                                <th>Məbləğ</th>
                                <th>Əməliyyatlar</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reservationsForThisDay.map(res => {
                                const guest = window.app.data.guests.find(g => g.id === res.guestId);
                                const room = window.app.data.rooms.find(rm => rm.id === res.roomId);
                                const displayId = res.publicId || (window.app ? window.app.formatInternalId(res.id, 'RZ') : res.id);
                                const debt = window.app.getReservationFinancialSummary(res.id)?.remainingBalance || 0;

                                return `
                                    <tr>
                                        <td><strong>${window.escapeHtml(displayId)}</strong></td>
                                        <td>${window.escapeHtml(guest?.name || 'N/A')}</td>
                                        <td>${window.escapeHtml(room?.number || 'N/A')}</td>
                                        <td>${formatDate(res.checkIn)}</td>
                                        <td>${formatDate(res.checkOut)}</td>
                                        <td>
                                            <span class="status-badge status-${res.status}">
                                                ${window.statusHelper.getReservationStatus(res.status)}
                                            </span>
                                        </td>
                                        <td>
                                            <strong style="color: ${debt > 0 ? '#ef4444' : '#10b981'};">
                                                ₼${debt.toFixed(2)}
                                            </strong>
                                        </td>
                                        <td>
                                            <button class="btn btn-secondary btn-xs" onclick="window.modalManager.showReservationDetails('${res.id}')" title="Ətraflı bax">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            <button class="btn btn-secondary btn-xs" onclick="window.modalManager.showReservationForm('${res.id}')" title="Redaktə et">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
        `;

        window.modalManager.showModal(`Rezervasiyalar - ${formattedDay}`, content, actions);
    }

    // This helper correctly parses YYYY-MM-DD string as UTC midnight
    _parseDateAsUTC(dateString) {
        if (!dateString) return null;
        const cleanDateString = dateString.split('T')[0];
        const [year, month, day] = cleanDateString.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day)); // Month is 0-indexed in Date.UTC
    }
}