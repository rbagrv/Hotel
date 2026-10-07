export default class InvoicesComponent {
    constructor() {
        if (typeof window !== 'undefined') {
            window.invoicesComponent = this;
        }
    }

    // Helper to get filter value from localStorage
    getFilter(key, defaultValue = '') {
        const storedValue = localStorage.getItem(`invoicesComponent_${key}`);
        if (storedValue === null || storedValue === 'undefined' || storedValue === 'null') {
            return defaultValue;
        }
        return storedValue;
    }

    // Helper to set filter value in localStorage
    setFilter(key, value) {
        localStorage.setItem(`invoicesComponent_${key}`, value);
    }

    render(data) {
        const pageSize = 10;
        const searchVal = this.getFilter('searchVal');
        const statusVal = this.getFilter('statusVal');
        const dateFromVal = this.getFilter('dateFrom');
        const dateToVal = this.getFilter('dateTo');
        let currentPage = parseInt(this.getFilter('currentPage', '1'));

        let filteredInvoices = (data.invoices || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply filters
        if (searchVal) {
            const lowerSearchVal = searchVal.toLowerCase();
            filteredInvoices = filteredInvoices.filter(invoice => {
                const reservation = (data.reservations || []).find(r => r.id === invoice.reservationId);
                return (invoice.publicId && invoice.publicId.toLowerCase().includes(lowerSearchVal)) ||
                       (invoice.guestName && invoice.guestName.toLowerCase().includes(lowerSearchVal)) ||
                       (reservation?.publicId && reservation.publicId.toLowerCase().includes(lowerSearchVal));
            });
        }
        if (dateFromVal) {
            filteredInvoices = filteredInvoices.filter(invoice => (invoice.createdAt || '').split('T')[0] >= dateFromVal);
        }
        if (dateToVal) {
            filteredInvoices = filteredInvoices.filter(invoice => (invoice.createdAt || '').split('T')[0] <= dateToVal);
        }
        if (statusVal) {
            filteredInvoices = filteredInvoices.filter(invoice => {
                const summary = window.app.getReservationFinancialSummary(invoice.reservationId);
                if (!summary) return statusVal === 'unpaid';
                if (statusVal === 'paid') return (summary.remainingBalance || 0) <= 0;
                if (statusVal === 'partial') return (summary.remainingBalance || 0) > 0 && (summary.totalPaid || 0) > 0;
                if (statusVal === 'unpaid') return (summary.remainingBalance || 0) > 0 && (summary.totalPaid || 0) === 0;
                return true;
            });
        }

        // Pagination setup
        const totalItems = filteredInvoices.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        this.setFilter('currentPage', currentPage);

        const startIndex = (currentPage - 1) * pageSize;
        const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + pageSize);

        return `
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Hesab-Fakturalar</h3>
                    ${window.authManager.hasPermission('invoices', 'create') ? `
                    <button class="btn btn-primary" onclick="window.notificationManager.showNotification('info', 'Faktura yaradılması', 'Faktura rezervasiya üçün avtomatik yaradılır.')">
                        <i class="fas fa-file-invoice"></i>
                        Yeni Faktura
                    </button>
                    ` : ''}
                </div>
                <div style="overflow-x:auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th style="min-width: 180px;">
                                Faktura/Rezervasiya №<br>
                                <input class="form-input" style="max-width:140px;" type="search" placeholder="ID, qonaq adı..." value="${window.escapeHtml(searchVal)}"
                                    id="invoicesSearchInput"
                                    oninput="window.invoicesComponent.setFilter('searchVal', this.value); window.invoicesComponent.setFilter('currentPage', '1'); window.app.loadModuleDebounced('invoices');">
                            </th>
                            <th style="min-width: 150px;">Qonaq</th>
                            <th style="min-width: 240px;">
                                Tarix<br>
                                <input type="date" class="form-input" style="max-width:120px;" value="${window.escapeHtml(dateFromVal)}" 
                                    onchange="window.invoicesComponent.setFilter('dateFrom', this.value); window.invoicesComponent.setFilter('currentPage', '1'); window.app.loadModule('invoices');">
                                <input type="date" class="form-input" style="max-width:120px;" value="${window.escapeHtml(dateToVal)}" 
                                    onchange="window.invoicesComponent.setFilter('dateTo', this.value); window.invoicesComponent.setFilter('currentPage', '1'); window.app.loadModule('invoices');">
                            </th>
                            <th style="min-width: 100px;">Məbləğ</th>
                            <th style="min-width: 120px;">Endirim</th>
                            <th style="min-width: 140px;">
                                Status<br>
                                <select class="form-select" style="max-width:120px;" onchange="window.invoicesComponent.setFilter('statusVal', this.value); window.invoicesComponent.setFilter('currentPage', '1'); window.app.loadModule('invoices');">
                                    <option value="">Hamısı</option>
                                    <option value="paid" ${statusVal === 'paid' ? 'selected' : ''}>Ödənilib</option>
                                    <option value="partial" ${statusVal === 'partial' ? 'selected' : ''}>Qismən ödənilib</option>
                                    <option value="unpaid" ${statusVal === 'unpaid' ? 'selected' : ''}>Ödəniş gözləyir</option>
                                </select>
                            </th>
                            <th style="min-width: 120px;">İcraçı</th>
                            <th style="min-width: 150px;">Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedInvoices.map((invoice, idx) => this.renderInvoiceRow(invoice, data, (currentPage - 1) * this.pageSize + idx + 1)).join('')}
                    </tbody>
                </table>
                </div>
                <div style="margin:0.5em 0; color:#64748b;font-size:0.96em;">Faktura sayı: <b>${filteredInvoices.length}</b></div>
                ${this.renderPaginationControls(currentPage, totalPages)}
                <button class="btn btn-secondary" style="margin-top:1em;" onclick="window.invoicesComponent.setFilter('searchVal', '');window.invoicesComponent.setFilter('statusVal', '');window.invoicesComponent.setFilter('dateFrom', '');window.invoicesComponent.setFilter('dateTo', '');window.invoicesComponent.setFilter('currentPage', '1');window.app.loadModule('invoices');">
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
            return `<button class="pagination-item ${page === currentPage ? 'active' : ''}" onclick="window.invoicesComponent.goToPage(${page})">${page}</button>`;
        }).join('');

        return `
            <div class="pagination-container">
                <button class="pagination-item" ${currentPage === 1 ? 'disabled' : ''} onclick="window.invoicesComponent.goToPage(${currentPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                </button>
                ${paginationHtml}
                <button class="pagination-item" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.invoicesComponent.goToPage(${currentPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }

    goToPage(pageNumber) {
        this.setFilter('currentPage', pageNumber);
        window.app.loadModule('invoices');
    }

    renderInvoiceRow(invoice, data, rowIndex) {
        // Fetch reservation and related data to calculate financial summary
        const reservation = (data.reservations || []).find(r => r.id === invoice.reservationId);
        const guest = reservation ? (data.guests || []).find(g => g.id === reservation.guestId) : null;
        const room = reservation ? (data.rooms || []).find(r => r.id === reservation.roomId) : null;
        const creator = (data.staff || []).find(s => s.id === invoice.createdBy || s.firebaseUid === invoice.createdBy);
        
        // Calculate payment status dynamically including POS sales
        const financialSummary = (invoice.reservationId && window.app && typeof window.app.getReservationFinancialSummary === 'function') ? window.app.getReservationFinancialSummary(invoice.reservationId) : null;
        
        // Use values from the financial summary directly
        const totalAmountDue = financialSummary?.totalAmountDue || (invoice.totalAmount || 0); 
        const paidAmount = financialSummary?.totalPaid || 0;
        const remainingDebt = financialSummary?.remainingBalance || 0;
        const actualDiscountAmount = financialSummary?.actualDiscountAmount || 0;

        // ENDIRIM məlumatı
        let discountText = '';
        if (actualDiscountAmount > 0) {
            discountText = `-${actualDiscountAmount.toFixed(2)}₼`;
            if (financialSummary?.discountType === 'percent' && financialSummary.discountValue) {
                discountText += ` (${financialSummary.discountValue}%)`;
            }
        }
        
        let statusText = 'Ödənilib';
        let statusClass = 'confirmed';
        
        if (remainingDebt > 0) {
            if (paidAmount > 0) {
                statusText = 'Qismən ödənilib';
                statusClass = 'pending';
            } else {
                statusText = 'Ödəniş gözləyir';
                statusClass = 'cancelled';
            }
        }

        const invoiceDisplayId = invoice.publicId || window.app.formatInternalId(invoice.id, 'FQ');
        const reservationDisplayId = reservation?.publicId || (reservation ? window.app.formatInternalId(reservation.id, 'RZ') : 'N/A');

        const formatDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate : d => d;
        const esc = window.escapeHtml;

        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${rowIndex || ''}</td>
                <td>
                    <strong>${esc(invoiceDisplayId)}</strong><br>
                    <small>Rez: ${esc(reservationDisplayId)}</small>
                </td>
                <td>
                    ${guest ? esc(guest.name) : esc(invoice.guestName || 'N/A')}<br>
                    <small>${room ? `Otaq: ${esc(room.number)}` : ''}</small>
                </td>
                <td>${invoice.createdAt ? formatDate(invoice.createdAt) : 'N/A'}</td>
                <td>
                    <strong>₼${(Number(totalAmountDue) || 0).toFixed(2)}</strong>
                </td>
                <td>
                    ${discountText ? `<span style="color: #ef4444;font-weight:bold;">${esc(discountText)}</span>` : '<span style="color:#64748b;">—</span>'}
                </td>
                <td><span class="status-badge ${statusClass}">${esc(statusText)}</span></td>
                <td><small>${creator ? esc(creator.name) : 'Sistem'}</small></td>
                <td>
                    <button class="btn btn-secondary" onclick="window.modalManager.showReservationDetails('${esc(invoice.reservationId)}')" title="Bax">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-secondary" onclick="window.app.printInvoice('${esc(invoice.id)}')" title="Çap et">
                        <i class="fas fa-print"></i>
                    </button>
                    ${window.authManager.hasPermission('invoices', 'delete') ? `
                    <button class="btn btn-secondary" onclick="window.app.deleteInvoice('${esc(invoice.id)}')" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }
}