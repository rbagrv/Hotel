export default class GuestsComponent {
    constructor() {
        if (typeof window !== 'undefined') {
            window.guestsComponent = this;
        }
    }
    // Helper to get filter value from localStorage
    getFilter(key, defaultValue = '') {
        const storedValue = localStorage.getItem(`guestsComponent_${key}`);
        // Treat explicit 'null'/'undefined' strings or actual null as default
        if (storedValue === null || storedValue === 'undefined' || storedValue === 'null') {
            return defaultValue;
        }
        return storedValue;
    }

    // Helper to set filter value in localStorage
    setFilter(key, value) {
        localStorage.setItem(`guestsComponent_${key}`, value);
    }

    render(data) {
        // Use component's own getFilter/setFilter methods directly
        const pageSize = 10;
        const searchVal = this.getFilter('searchVal');
        const genderVal = this.getFilter('genderVal');
        const nationalityVal = this.getFilter('nationalityVal');
        const birthDateVal = this.getFilter('birthDateVal');
        const createdAtVal = this.getFilter('createdAtVal');

        // For page state
        const totalGuests = (data.guests || []).length;
        let currentPage = parseInt(this.getFilter('currentPage', '1'));

        // Unique values for gender/nationality filters
        const guests = (data.guests || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const uniqueGenders = Array.from(new Set(guests.map(g => g.gender).filter(Boolean)));
        const uniqueNationalities = Array.from(new Set(guests.map(g => g.nationality).filter(Boolean)));

        // Apply search/filter
        let filteredGuests = guests;
        if (searchVal) {
            filteredGuests = filteredGuests.filter(g =>
                (g.name && g.name.toLowerCase().includes(searchVal.toLowerCase())) ||
                (g.phone && g.phone.includes(searchVal)) ||
                (g.passportNo && g.passportNo.includes(searchVal)) ||
                (g.email && g.email.toLowerCase().includes(searchVal.toLowerCase())) ||
                (g.address && g.address.toLowerCase().includes(searchVal.toLowerCase())) ||
                (g.publicId && g.publicId.toLowerCase().includes(searchVal.toLowerCase())) || // Search by publicId
                (g.id && g.id.toString().toLowerCase().includes(searchVal.toLowerCase()))
            );
        }
        // Apply filters only if their value is not an empty string (or equivalent)
        if (genderVal !== '') {
            filteredGuests = filteredGuests.filter(g => g.gender === genderVal);
        }
        if (nationalityVal !== '') {
            filteredGuests = filteredGuests.filter(g => g.nationality === nationalityVal);
        }
        if (birthDateVal !== '') {
            filteredGuests = filteredGuests.filter(g => g.birthDate && (g.birthDate.startsWith(birthDateVal) || g.birthDate === birthDateVal));
        }
        if (createdAtVal !== '') {
            filteredGuests = filteredGuests.filter(g => g.createdAt && g.createdAt.startsWith(createdAtVal));
        }

        // Pagination setup
        const totalItems = filteredGuests.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        this.setFilter('currentPage', currentPage); // Use class method directly

        // Slice for current page
        const startIndex = (currentPage - 1) * pageSize;
        const displayGuests = filteredGuests.slice(startIndex, startIndex + pageSize);

        return `
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Qonaqların İdarə Edilməsi</h3>
                    ${window.authManager.hasPermission('guests', 'create') ? `
                    <button class="btn btn-primary" onclick="window.modalManager&&window.modalManager.showGuestForm&&window.modalManager.showGuestForm();">
                        <i class="fas fa-user-plus"></i>
                        Yeni Qonaq
                    </button>
                    ` : ''}
                </div>
                <div style="overflow-x:auto;">
                <table class="data-table" style="min-width: 900px;">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th style="min-width: 150px;">
                                ID<br>
                                <input class="form-input" style="max-width:130px;" type="text" placeholder="ID, ad, tel, pasport..." value="${window.escapeHtml(searchVal)}" 
                                    id="guestsSearchInput"
                                    oninput="window.guestsComponent.setFilter('searchVal', this.value); window.guestsComponent.setFilter('currentPage', 1); window.app.loadModuleDebounced('guests');">
                            </th>
                            <th style="min-width: 150px;">Ad Soyad</th>
                            <th style="min-width: 100px;">
                                Cins<br>
                                <select class="form-select" style="max-width:70px;" onchange="window.guestsComponent.setFilter('genderVal', this.value); window.guestsComponent.setFilter('currentPage', 1); window.app.loadModule('guests');">
                                    <option value="">Hamısı</option>
                                    ${uniqueGenders.map(g => `<option value="${g}" ${genderVal===g?'selected':''}>${g}</option>`).join("")}
                                </select>
                            </th>
                            <th style="min-width: 120px;">Telefon</th>
                            <th style="min-width: 120px;">Pasport</th>
                            <th style="min-width: 120px;">
                                Doğum<br>
                                <input type="date" class="form-input" style="max-width:110px;" value="${birthDateVal}"
                                    onchange="window.guestsComponent.setFilter('birthDateVal', this.value); window.guestsComponent.setFilter('currentPage', 1); window.app.loadModule('guests');">
                            </th>
                            <th style="min-width: 120px;">
                                Milliyyət<br>
                                <select class="form-select" style="max-width:90px;" onchange="window.guestsComponent.setFilter('nationalityVal', this.value); window.guestsComponent.setFilter('currentPage', 1); window.app.loadModule('guests');">
                                    <option value="">Hamısı</option>
                                    ${uniqueNationalities.map(n => `<option value="${n}" ${nationalityVal===n?'selected':''}>${n}</option>`).join("")}
                                </select>
                            </th>
                            <th style="min-width: 120px;">
                                Qeydiyyat<br>
                                <input type="date" class="form-input" style="max-width:110px;" value="${createdAtVal}"
                                    onchange="window.guestsComponent.setFilter('createdAtVal', this.value); window.guestsComponent.setFilter('currentPage', 1); window.app.loadModule('guests');">
                            </th>
                            <th style="min-width: 100px;">Status</th>
                            <th style="min-width: 80px;">Sənəd</th>
                            <th style="min-width: 120px;">Qeyd edən</th>
                            <th style="min-width: 150px;">Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody id="guestsTableBody">
                        ${displayGuests.map((guest, idx) => this.renderGuestRow(guest, (currentPage - 1) * this.pageSize + idx + 1)).join('')}
                    </tbody>
                </table>
                </div>
                <div style="margin:0.5em 0; color:#64748b;font-size:0.96em;">Qonaq sayı: <b>${filteredGuests.length}</b></div>
                ${this.renderPaginationControls(currentPage, totalPages)}
                <button class="btn btn-secondary" style="margin-top:1em;" onclick="localStorage.removeItem('guestsComponent_searchVal');localStorage.removeItem('guestsComponent_genderVal');localStorage.removeItem('guestsComponent_nationalityVal');localStorage.removeItem('guestsComponent_birthDateVal');localStorage.removeItem('guestsComponent_createdAtVal');localStorage.removeItem('guestsComponent_currentPage');window.app.loadModule('guests');">
                    <i class="fas fa-times"></i> Filtri sıfırla
                </button>
            </div>
        `;
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
            return `<button class="pagination-item ${page === currentPage ? 'active' : ''}" onclick="window.guestsComponent.goToPage(${page})">${page}</button>`;
        }).join('');

        return `
            <div class="pagination-container">
                <button class="pagination-item" ${currentPage === 1 ? 'disabled' : ''} onclick="window.guestsComponent.goToPage(${currentPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                </button>
                ${paginationHtml}
                <button class="pagination-item" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.guestsComponent.goToPage(${currentPage + 1})">
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

    goToPage(pageNumber) {
        localStorage.setItem('guestsComponent_currentPage', pageNumber);
        window.app.loadModule('guests');
    }

    renderGuestRow(guest, rowIndex) {
        // Defensive date parse
        let dateStr = "";
        try {
            if (window.app && typeof window.app.formatDate === "function") {
                dateStr = guest.createdAt ? window.app.formatDate(guest.createdAt) : '';
            } else {
                dateStr = guest.createdAt ? new Date(guest.createdAt).toLocaleDateString('az-AZ') : '';
            }
        } catch { dateStr = String(guest.createdAt || ''); }

        let birthDateStr = "";
        try {
            if (window.app && typeof window.app.formatDate === "function") {
                birthDateStr = guest.birthDate ? window.app.formatDate(guest.birthDate) : '';
            } else {
                birthDateStr = guest.birthDate ? new Date(guest.birthDate).toLocaleDateString('az-AZ') : '';
            }
        } catch { birthDateStr = String(guest.birthDate || ''); }

        // File/document visual indicator (icon if exists)
        let docHtml = '';
        const safeUrl = guest.documentUrl && !guest.documentUrl.startsWith('javascript:') ? guest.documentUrl : '';
        if (safeUrl) {
            docHtml = `<a href="${window.escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" title="Sənədi aç" style="color:#10b981;font-size:1.18em;">
                <i class="fas fa-file-alt"></i>
            </a>`;
        } else {
            docHtml = `<span style="color:#b4b4b4;opacity:0.7;" title="Sənəd yoxdur">—</span>`;
        }

        // Render mini avatar from name
        let avatarInitials = guest.name ? guest.name.split(' ').map(part => part[0]).join('').substring(0,2).toUpperCase() : '';
        const colorChoices = ["#3b82f6","#8b5cf6","#f59e0b","#10b981","#ef4444","#64748b"];
        const colorIndex = Math.abs(guest.id.hashCode ? guest.id.hashCode() : guest.name ? guest.name.charCodeAt(0) : 0) % colorChoices.length;
        const color = colorChoices[colorIndex] || "#64748b";
        
        const displayId = guest.publicId || (window.app ? window.app.formatInternalId(guest.id, 'QN') : guest.id);
        const creator = (window.app.data.staff || []).find(s => s.id === guest.createdBy || s.firebaseUid === guest.createdBy);

        let statusBadge = `<span class="status-badge status-active">Normal</span>`;
        if (guest.status === 'VIP') {
            statusBadge = `<span class="status-badge" style="background:#fef3c7;color:#d97706;"><i class="fas fa-crown"></i> VIP</span>`;
        } else if (guest.status === 'Blacklist') {
            statusBadge = `<span class="status-badge" style="background:#1f2937;color:#f87171;"><i class="fas fa-ban"></i> Blacklist</span>`;
        } else if (guest.status && guest.status !== 'Normal') {
             statusBadge = `<span class="status-badge status-pending">${window.escapeHtml(guest.status)}</span>`;
        }
        const esc = window.escapeHtml;

        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${rowIndex || ''}</td>
                <td>
                    <strong>${esc(displayId)}</strong>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:0.55em;">
                        <span style="min-width:28px;min-height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:${color};color:white;font-size:1.05em;">
                            ${esc(avatarInitials) || 'Q'}
                        </span>
                        <span>
                            ${esc(guest.name)}
                        </span>
                    </div>
                </td>
                <td>
                    <span style="color:${guest.gender === 'Kişi' ? '#3b82f6' : guest.gender === 'Qadın' ? '#ef4444' : '#64748b'};">
                        ${esc(guest.gender || '')}
                    </span>
                </td>
                <td>
                    <a href="tel:${esc(guest.phone)}" style="color:#10b981;" title="Zəng et">
                        ${esc(guest.phone)}
                    </a>
                </td>
                <td><span style="font-family:monospace;">${esc(guest.passportNo)}</span></td>
                <td>
                    ${birthDateStr}
                </td>
                <td><span class="text-overflow-ellipsis" style="max-width:120px;">${esc(guest.nationality)}</span></td>
                <td>
                    <span style="color:#64748b; font-size:0.98em;">${dateStr}</span>
                </td>
                <td>${statusBadge}</td>
                <td>${docHtml}</td>
                <td><small>${creator ? esc(creator.name) : 'Sistem'}</small></td>
                <td>
                    <div class="table-actions" style="display:flex;gap:0.35rem;">
                        <button class="btn btn-secondary" onclick="if(window.modalManager && window.modalManager.showGuestDetails) window.modalManager.showGuestDetails('${esc(guest.id)}')" title="Bax" style="background-color: #3b82f6; color: white; padding:0.6em;">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${window.authManager.hasPermission('guests', 'edit') ? `
                        <button class="btn btn-secondary" onclick="window.modalManager.showGuestForm('${esc(guest.id)}')" title="Redaktə et" style="padding:0.6em;">
                            <i class="fas fa-edit"></i>
                        </button>
                        ` : ''}
                        ${window.authManager.hasPermission('guests', 'delete') ? `
                        <button class="btn btn-secondary" onclick="window.app.deleteGuest('${esc(guest.id)}')" title="Sil" style="padding:0.6em;">
                            <i class="fas fa-trash"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }
}

// Add a polyfill for String.hashCode for color picking
if (!String.prototype.hashCode) {
    String.prototype.hashCode = function() {
        var hash = 0, i, chr;
        if (this.length === 0) return hash;
        for (i = 0; i < this.length; i++) {
            chr   = this.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash;
    };
}