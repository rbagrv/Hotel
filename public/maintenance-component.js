export default class MaintenanceComponent {
    constructor() {
        if (typeof window !== 'undefined') {
            window.maintenanceComponent = this;
        }
    }

    // Helper to get filter value from localStorage
    getFilter(key, defaultValue = '') {
        const storedValue = localStorage.getItem(`maintenanceComponent_${key}`);
        // Treat explicit 'null'/'undefined' strings or actual null as default
        if (storedValue === null || storedValue === 'undefined' || storedValue === 'null') {
            return defaultValue;
        }
        return storedValue;
    }

    // Helper to set filter value in localStorage
    setFilter(key, value) {
        localStorage.setItem(`maintenanceComponent_${key}`, value);
    }

    render(data) {
        // Use localStorage for persistent filter states
        const searchVal = this.getFilter('searchVal');
        const statusVal = this.getFilter('statusVal');
        const priorityVal = this.getFilter('priorityVal');
        const roomIdVal = this.getFilter('roomIdVal');
        const typeVal = this.getFilter('typeVal');
        const assignedToVal = this.getFilter('assignedToVal');
        const dueDateVal = this.getFilter('dueDateVal');

        const uniqueStatuses = ["pending","in_progress","completed","cancelled"];
        const uniquePriorities = ["low","medium","high"];
        const rooms = data.rooms || [];
        const maintenance = data.maintenance || [];
        const staff = data.staff || [];
        const uniqueRooms = Array.from(new Set(rooms.map(r => r.id).filter(Boolean)));
        const uniqueTypes = Array.from(new Set(maintenance.map(m => m.type).filter(Boolean)));
        const uniqueStaff = Array.from(new Set(staff.map(s => s.id).filter(Boolean)));

        let filtered = maintenance;
        if (searchVal) filtered = filtered.filter(t=> 
            (t.description && t.description.toLowerCase().includes(searchVal.toLowerCase())) ||
            (t.publicId && t.publicId.toLowerCase().includes(searchVal.toLowerCase())) || // Search by publicId
            (t.id && t.id.toString().includes(searchVal))
        );
        // Apply filters only if their value is not an empty string (or equivalent)
        if (statusVal !== '') filtered = filtered.filter(t=>t.status===statusVal);
        if (priorityVal !== '') filtered = filtered.filter(t=>t.priority===priorityVal);
        if (roomIdVal !== '') filtered = filtered.filter(t=>t.roomId===roomIdVal);
        if (typeVal !== '') filtered = filtered.filter(t=>t.type===typeVal);
        if (assignedToVal !== '') filtered = filtered.filter(t=>t.assignedTo===assignedToVal);
        if (dueDateVal !== '') filtered = filtered.filter(t=>t.dueDate===dueDateVal);

        return `
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Təmizlik və Təmir Tapşırıqları</h3>
                    ${window.authManager.hasPermission('maintenance', 'create') ? `
                    <button class="btn btn-primary" onclick="window.modalManager.showMaintenanceForm()">
                        <i class="fas fa-plus"></i>
                        Yeni Tapşırıq
                    </button>
                    `: ''}
                </div>
                <div style="overflow-x:auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th style="min-width: 180px;">
                                ID / Təsvir<br>
                                <input class="form-input" style="max-width:130px;" type="text" placeholder="ID, təsvir..." value="${window.escapeHtml(searchVal)}"
                                    id="maintenanceSearchInput"
                                    oninput="window.maintenanceComponent.setFilter('searchVal', this.value); window.app.loadModuleDebounced('maintenance');">
                            </th>
                            <th style="min-width: 100px;">
                                Otaq<br>
                                <select class="form-select" style="max-width:80px;" onchange="window.maintenanceComponent.setFilter('roomIdVal', this.value); window.app.loadModule('maintenance');">
                                    <option value="">Hamısı</option>
                                    ${rooms.map(r => `<option value="${window.escapeHtml(r.id)}" ${roomIdVal === r.id ? 'selected' : ''}>${window.escapeHtml(r.number)}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 100px;">
                                Növ<br>
                                <select class="form-select" style="max-width:90px;" onchange="window.maintenanceComponent.setFilter('typeVal', this.value); window.app.loadModule('maintenance');">
                                    <option value="">Hamısı</option>
                                    ${uniqueTypes.map(t => `<option value="${t}" ${typeVal === t ? 'selected' : ''}>${t}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 120px;">
                                Məsul İşçi<br>
                                <select class="form-select" style="max-width:110px;" onchange="window.maintenanceComponent.setFilter('assignedToVal', this.value); window.app.loadModule('maintenance');">
                                    <option value="">Hamısı</option>
                                    ${staff.map(s => `<option value="${window.escapeHtml(s.id)}" ${assignedToVal === s.id ? 'selected' : ''}>${window.escapeHtml(s.name)}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 120px;">Yaradan</th>
                            <th style="min-width: 100px;">
                                Prioritet<br>
                                <select class="form-select" style="max-width:80px;" onchange="window.maintenanceComponent.setFilter('priorityVal', this.value); window.app.loadModule('maintenance');">
                                    <option value="">Hamısı</option>
                                    ${uniquePriorities.map(p=>`<option value="${p}" ${priorityVal===p?'selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 120px;">
                                Son Tarix<br>
                                <input type="date" class="form-input" style="max-width:120px;" value="${dueDateVal}"
                                    onchange="window.maintenanceComponent.setFilter('dueDateVal', this.value); window.app.loadModule('maintenance');">
                            </th>
                            <th style="min-width: 100px;">
                                Status<br>
                                <select class="form-select" style="max-width:90px;" onchange="window.maintenanceComponent.setFilter('statusVal', this.value); window.app.loadModule('maintenance');">
                                    <option value="">Hamısı</option>
                                    ${uniqueStatuses.map(s=>`<option value="${s}" ${statusVal===s?'selected':''}>${window.statusHelper?.getMaintenanceStatus?.(s) || s}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 120px;">Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map((task, idx) => this.renderMaintenanceRow(task, data, idx + 1)).join('')}
                    </tbody>
                </table>
                </div>
                <div style="margin:0.5em 0; color:#64748b;font-size:0.96em;">Tapşırıq sayı: <b>${filtered.length}</b></div>
                <button class="btn btn-secondary" style="margin-top:1em;" onclick="window.maintenanceComponent.setFilter('searchVal', '');window.maintenanceComponent.setFilter('statusVal', '');window.maintenanceComponent.setFilter('priorityVal', '');window.maintenanceComponent.setFilter('roomIdVal', '');window.maintenanceComponent.setFilter('typeVal', '');window.maintenanceComponent.setFilter('assignedToVal', '');window.maintenanceComponent.setFilter('dueDateVal', '');window.app.loadModule('maintenance');">
                    <i class="fas fa-times"></i> Filtri sıfırla
                </button>
            </div>
        `;
    }

    renderMaintenanceRow(task, data, rowIndex) {
        const esc = window.escapeHtml;
        const rooms = data.rooms || [];
        const staff = data.staff || [];
        const room = rooms.find(r => r.id === task.roomId);
        const assigned = staff.find(s => s.id === task.assignedTo);
        const creator = staff.find(s => s.id === task.createdBy || s.firebaseUid === task.createdBy);
        const displayId = task.publicId || (window.app ? window.app.formatInternalId(task.id, 'TM') : task.id);
        
        // Date formatting:
        const formatDate = (window.app && typeof window.app.formatDate === "function") ? window.app.formatDate : d => d;

        // Overdue highlight: not completed/cancelled and dueDate is in the past
        const today = window.app.getTodayDateString ? window.app.getTodayDateString() : new Date().toISOString().split('T')[0];
        const isOverdue = task.dueDate && !['completed', 'cancelled'].includes(task.status) && String(task.dueDate) < today;
        const priorityClass = task.priority === 'high' ? 'cancelled' : task.priority === 'medium' ? 'pending' : 'confirmed';

        return `
            <tr ${isOverdue ? 'style="background: rgba(239,68,68,0.06);"' : ''}>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${rowIndex || ''}</td>
                <td><strong>${esc(displayId)}</strong><br>
                    <span class="text-overflow-ellipsis" title="${esc(task.description)}">${esc(task.description)}</span>
                </td>
                <td>${room ? esc(room.number) : 'Ümumi'}${isOverdue ? ' <i class="fas fa-exclamation-triangle" style="color:#ef4444;" title="Vaxtı keçib"></i>' : ''}</td>
                <td>${esc(task.type)}</td>
                <td>${assigned ? esc(assigned.name) : 'Təyin edilməyib'}</td>
                <td><small>${creator ? esc(creator.name) : (task.createdBy ? 'Bilinmir' : 'Sistem')}</small></td>
                <td><span class="status-badge status-${priorityClass}">${this.getPriorityText(task.priority)}</span></td>
                <td>${formatDate(task.dueDate)}</td>
                <td>
                    <span class="status-badge status-${esc(task.status)}">
                        ${window.statusHelper?.getMaintenanceStatus?.(task.status) || esc(task.status)}
                    </span>
                </td>
                <td>
                    ${window.authManager.hasPermission('maintenance', 'edit') ? `
                    <button class="btn btn-secondary" onclick="window.modalManager.showMaintenanceForm('${esc(task.id)}')" title="Redaktə et">
                        <i class="fas fa-edit"></i>
                    </button>
                    ` : ''}
                    ${window.authManager.hasPermission('maintenance', 'delete') ? `
                    <button class="btn btn-secondary" onclick="window.app.deleteMaintenance('${esc(task.id)}')" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }

    getPriorityText(priority) {
        const priorityMap = {
            'low': 'Aşağı',
            'medium': 'Orta',
            'high': 'Yüksək'
        };
        return priorityMap[priority] || priority;
    }
}