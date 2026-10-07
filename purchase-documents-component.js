export default class PurchaseDocumentsComponent {
    constructor() {
        // ...existing code...
    }

    // Helper to get filter value from localStorage
    getFilter(key, defaultValue = '') {
        const storedValue = localStorage.getItem(`purchaseDocumentsComponent_${key}`);
        // Treat explicit 'null'/'undefined' strings or actual null as default
        if (storedValue === null || storedValue === 'undefined' || storedValue === 'null') {
            return defaultValue;
        }
        return storedValue;
    }

    // Helper to set filter value in localStorage
    setFilter(key, value) {
        localStorage.setItem(`purchaseDocumentsComponent_${key}`, value);
    }

    render(data) {
        // Use localStorage for persistent filter states
        const searchVal = this.getFilter('searchVal');
        const supplierVal = this.getFilter('supplierVal');
        const dateFromVal = this.getFilter('dateFrom');
        const dateToVal = this.getFilter('dateTo');
        const staffVal = this.getFilter('staffVal');

        const docs = data.purchaseDocuments || [];
        const staff = data.staff || [];
        const uniqueSuppliers = Array.from(new Set(docs.map(doc => doc.supplierName).filter(Boolean)));
        const uniqueStaff = Array.from(new Set(staff.map(s => s.id).filter(Boolean)));

        let filtered = docs.slice();

        if (searchVal) {
            filtered = filtered.filter(doc =>
                (doc.documentNumber && doc.documentNumber.toLowerCase().includes(searchVal.toLowerCase())) ||
                (doc.notes && doc.notes.toLowerCase().includes(searchVal.toLowerCase())) ||
                (doc.publicId && doc.publicId.toLowerCase().includes(searchVal.toLowerCase())) || // Search by publicId
                (doc.id && doc.id.toString().toLowerCase().includes(searchVal.toLowerCase()))
            );
        }
        // Apply filters only if their value is not an empty string (or equivalent)
        if (supplierVal !== '') {
            filtered = filtered.filter(doc => doc.supplierName === supplierVal);
        }
        if (dateFromVal !== '') {
            filtered = filtered.filter(doc => doc.purchaseDate >= dateFromVal);
        }
        if (dateToVal !== '') {
            filtered = filtered.filter(doc => doc.purchaseDate <= dateToVal);
        }
        if (staffVal !== '') {
            filtered = filtered.filter(doc => doc.staffId === staffVal);
        }

        // Sort by purchaseDate, newest first
        filtered.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));

        return `
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Alış sənədləri</h3>
                    ${window.authManager.hasPermission('purchase_documents', 'create') ? `
                    <button class="btn btn-primary" onclick="window.modalManager.showPurchaseDocumentForm()">
                        <i class="fas fa-plus"></i>
                        Yeni Alış Sənədi
                    </button>
                    ` : ''}
                </div>
                <div style="overflow-x:auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th style="min-width: 180px;">
                                ID / Sənəd № / Qeyd<br>
                                <input class="form-input" style="max-width:140px;" type="search" placeholder="ID, sənəd №, qeyd..." value="${window.escapeHtml(searchVal)}"
                                    id="purchaseDocumentsSearchInput"
                                    oninput="window.purchaseDocumentsComponent.setFilter('searchVal', this.value); window.app.loadModuleDebounced('purchase_documents');">
                            </th>
                            <th style="min-width: 120px;">
                                Təchizatçı<br>
                                <select class="form-select" style="max-width:120px;" onchange="window.purchaseDocumentsComponent.setFilter('supplierVal', this.value); window.app.loadModule('purchase_documents');">
                                    <option value="">Hamısı</option>
                                    ${uniqueSuppliers.map(s => `<option value="${window.escapeHtml(s)}" ${supplierVal === s ? 'selected' : ''}>${window.escapeHtml(s)}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 240px;">
                                Alış Tarixi<br>
                                <input type="date" class="form-input" style="max-width:120px;" value="${dateFromVal}" 
                                    onchange="window.purchaseDocumentsComponent.setFilter('dateFrom', this.value); window.app.loadModule('purchase_documents');">
                                <input type="date" class="form-input" style="max-width:120px;" value="${dateToVal}" 
                                    onchange="window.purchaseDocumentsComponent.setFilter('dateTo', this.value); window.app.loadModule('purchase_documents');">
                            </th>
                            <th style="min-width: 100px;">Məbləğ</th>
                            <th style="min-width: 120px;">Məhsullar</th>
                            <th style="min-width: 80px;">Sənəd</th>
                            <th style="min-width: 120px;">
                                İcraçı<br>
                                <select class="form-select" style="max-width:120px;" onchange="window.purchaseDocumentsComponent.setFilter('staffVal', this.value); window.app.loadModule('purchase_documents');">
                                    <option value="">Hamısı</option>
                                    ${staff.map(s => `<option value="${window.escapeHtml(s.id)}" ${staffVal === s.id ? 'selected' : ''}>${window.escapeHtml(s.name)}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 150px;">Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map((doc, idx) => this.renderDocumentRow(doc, data, idx + 1)).join('')}
                    </tbody>
                </table>
                </div>
                <div style="margin:0.5em 0; color:#64748b;font-size:0.96em;">Sənəd sayı: <b>${filtered.length}</b></div>
                <button class="btn btn-secondary" style="margin-top:1em;" onclick="window.purchaseDocumentsComponent.setFilter('searchVal', '');window.purchaseDocumentsComponent.setFilter('supplierVal', '');window.purchaseDocumentsComponent.setFilter('dateFrom', '');window.purchaseDocumentsComponent.setFilter('dateTo', '');window.purchaseDocumentsComponent.setFilter('staffVal', '');window.app.loadModule('purchase_documents');">
                    <i class="fas fa-times"></i> Filtri sıfırla
                </button>
            </div>
        `;
    }

    renderDocumentRow(doc, data, rowIndex) {
        const esc = window.escapeHtml;
        const staff = (data.staff || []).find(s => s.id === doc.staffId || s.firebaseUid === doc.staffId);
        const itemSummary = doc.items && Array.isArray(doc.items) && doc.items.length > 0
            ? `${esc(doc.items.length)} məhsul (${esc(doc.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0))} ədəd)`
            : 'Məhsul yoxdur';

        const safeUrl = (doc.documentUrl || '').startsWith('javascript:') ? '' : doc.documentUrl;
        const docUrlHtml = safeUrl
            ? `<a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer" title="Sənədi aç" style="color:#10b981;font-size:1.18em;"><i class="fas fa-file-alt"></i></a>`
            : `<span style="color:#b4b4b4;opacity:0.7;" title="Sənəd yoxdur">—</span>`;

        const formatDate = (window.app && typeof window.app.formatDate === "function") ? window.app.formatDate : d => d;
        const displayId = doc.publicId || (window.app ? window.app.formatInternalId(doc.id, 'AS') : doc.id);

        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${rowIndex || ''}</td>
                <td><strong>${esc(displayId)}</strong><br>
                    Sənəd №: ${esc(doc.documentNumber || '—')}
                    ${doc.notes ? `<br><small style="color:#64748b; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; display: block; max-width: 180px;">${esc(doc.notes)}</small>` : ''}
                </td>
                <td><strong>${esc(doc.supplierName)}</strong></td>
                <td>${formatDate(doc.purchaseDate)}</td>
                <td><strong>₼${(Number(doc.totalAmount) || 0).toFixed(2)}</strong></td>
                <td>${itemSummary}</td>
                <td>${docUrlHtml}</td>
                <td>
                    <span title="${staff ? esc(staff.name) : 'N/A'}">${staff ? esc(staff.name) : 'N/A'}</span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-secondary" onclick="window.modalManager.showPurchaseDocumentDetails('${esc(doc.id)}')" title="Ətraflı bax">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${window.authManager.hasPermission('purchase_documents', 'edit') ? `
                        <button class="btn btn-secondary" onclick="window.modalManager.showPurchaseDocumentForm('${esc(doc.id)}')" title="Redaktə et">
                            <i class="fas fa-edit"></i>
                        </button>
                        ` : ''}
                        ${window.authManager.hasPermission('purchase_documents', 'delete') ? `
                        <button class="btn btn-secondary" onclick="window.app.deletePurchaseDocument('${esc(doc.id)}')" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }
}