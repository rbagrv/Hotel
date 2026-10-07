export default class ServicesComponent {
    constructor() {
        if (typeof window !== 'undefined') {
            window.servicesComponent = this;
        }
    }

    // Helper to get filter value from localStorage
    getFilter(key, defaultValue = '') {
        const storedValue = localStorage.getItem(`servicesComponent_${key}`);
        // Treat explicit 'null'/'undefined' strings or actual null as default
        if (storedValue === null || storedValue === 'undefined' || storedValue === 'null') {
            return defaultValue;
        }
        return storedValue;
    }

    // Helper to set filter value in localStorage
    setFilter(key, value) {
        localStorage.setItem(`servicesComponent_${key}`, value);
    }

    render(data) {
        // Use localStorage for persistent filter states
        const searchVal = this.getFilter('searchVal');
        const statusVal = this.getFilter('statusVal');
        const typeVal = this.getFilter('typeVal');
        const categoryVal = this.getFilter('categoryVal');

        const services = data.services || [];

        const uniqueTypes = Array.from(new Set(services.map(s => s.serviceType).filter(Boolean)));
        const uniqueStatus = Array.from(new Set(services.map(s => s.status).filter(Boolean)));
        const uniqueCategories = Array.from(new Set(services.map(s => s.category).filter(Boolean))); // New unique list for categories

        let filtered = services;
        if (searchVal) filtered = filtered.filter(s=> (s.name && s.name.toLowerCase().includes(searchVal.toLowerCase())) || (s.description && s.description.toLowerCase().includes(searchVal.toLowerCase())) || (s.publicId && s.publicId.toLowerCase().includes(searchVal.toLowerCase())) || (s.id && s.id.toString().includes(searchVal)));
        // Apply filters only if their value is not an empty string (or equivalent)
        if (statusVal !== '') filtered = filtered.filter(s=>s.status===statusVal);
        if (typeVal !== '') filtered = filtered.filter(s=>s.serviceType===typeVal);
        if (categoryVal !== '') filtered = filtered.filter(s=>s.category===categoryVal); // Apply category filter

        return `
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Xidmətlərin İdarə Edilməsi</h3>
                    ${window.authManager.hasPermission('services', 'create') ? `
                    <button class="btn btn-primary" onclick="window.modalManager.showServiceForm()">
                        <i class="fas fa-plus"></i>
                        Yeni Xidmət
                    </button>
                    ` : ''}
                </div>
                <div style="overflow-x:auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th style="min-width: 120px;">ID</th>
                            <th style="min-width: 150px;">
                                Ad<br>
                                <input class="form-input" style="max-width:130px;" type="search" placeholder="Ad, təsvir..." value="${window.escapeHtml(searchVal)}"
                                    id="servicesSearchInput"
                                    oninput="window.servicesComponent.setFilter('searchVal', this.value); window.app.loadModuleDebounced('services');">
                            </th>
                            <th style="min-width: 100px;">
                                Kateqoriya<br>
                                <select class="form-select" style="max-width:90px;" onchange="window.servicesComponent.setFilter('categoryVal', this.value); window.app.loadModule('services');">
                                    <option value="">Hamısı</option>
                                    ${uniqueCategories.map(c=>`<option value="${c}" ${categoryVal===c?'selected':''}>${c}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 90px;">
                                Növ<br>
                                <select class="form-select" style="max-width:85px;" onchange="window.servicesComponent.setFilter('typeVal', this.value); window.app.loadModule('services');">
                                    <option value="">Hamısı</option>
                                    ${uniqueTypes.map(t=>`<option value="${t}" ${typeVal===t?'selected':''}>${t==='daily'?'Günlük':'Birdəfəlik'}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 100px;">Qiymət</th>
                            <th style="min-width: 200px;">Təsvir</th>
                            <th style="min-width: 90px;">
                                Status<br>
                                <select class="form-select" style="max-width:75px;" onchange="window.servicesComponent.setFilter('statusVal', this.value); window.app.loadModule('services');">
                                    <option value="">Hamısı</option>
                                    ${uniqueStatus.map(s=>`<option value="${s}" ${statusVal===s?'selected':''}>${s==='active'?'Aktiv':'Deaktiv'}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 120px;">Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map((service, idx) => this.renderServiceRow(service, idx + 1)).join('')}
                    </tbody>
                </table>
                </div>
                <div style="margin:0.5em 0; color:#64748b;font-size:0.96em;">Xidmət sayı: <b>${filtered.length}</b></div>
                <button class="btn btn-secondary" style="margin-top:1em;" onclick="window.servicesComponent.setFilter('searchVal', '');window.servicesComponent.setFilter('statusVal', '');window.servicesComponent.setFilter('typeVal', '');window.servicesComponent.setFilter('categoryVal', '');window.app.loadModule('services');">
                    <i class="fas fa-times"></i> Filtri sıfırla
                </button>
            </div>
        `;
    }

    renderServiceRow(service, rowIndex) {
        const esc = window.escapeHtml;
        const displayId = service.publicId || (window.app ? window.app.formatInternalId(service.id, 'XD') : service.id);
        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${rowIndex || ''}</td>
                <td>
                    <strong>${esc(displayId)}</strong>
                </td>
                <td>
                    ${esc(service.name)}
                </td>
                <td>${esc(service.category)}</td>
                <td>
                    <span class="status-badge ${service.serviceType === 'daily' ? 'status-pending' : 'status-confirmed'}">
                        ${service.serviceType === 'daily' ? 'Günlük' : 'Birdəfəlik'}
                    </span>
                </td>
                <td>₼${(Number(service.price) || 0).toFixed(2)}${service.serviceType === 'daily' ? '/gün' : ''}</td>
                <td><span class="text-overflow-ellipsis">${esc(service.description || '')}</span></td>
                <td><span class="status-badge status-${service.status === 'active' ? 'confirmed' : 'cancelled'}">${service.status === 'active' ? 'Aktiv' : 'Deaktiv'}</span></td>
                <td>
                    ${window.authManager.hasPermission('services', 'edit') ? `
                    <button class="btn btn-secondary" onclick="window.modalManager.showServiceForm('${esc(service.id)}')" title="Redaktə et">
                        <i class="fas fa-edit"></i>
                    </button>
                    ` : ''}
                    ${window.authManager.hasPermission('services', 'delete') ? `
                    <button class="btn btn-secondary" onclick="window.app.deleteService('${esc(service.id)}')" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }
}