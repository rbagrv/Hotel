// Inventory component with search, filter, and STOCK MOVEMENT (transaction history) view

export default class InventoryComponent {
    constructor() {
        if (typeof window !== 'undefined') {
            window.inventoryComponent = this;
        }
    }

    // Helper to get filter value from localStorage
    getFilter(key, defaultValue = '') {
        const storedValue = localStorage.getItem(`inventoryComponent_${key}`);
        // Treat explicit 'null'/'undefined' strings or actual null as default
        if (storedValue === null || storedValue === 'undefined' || storedValue === 'null') {
            return defaultValue;
        }
        return storedValue;
    }

    // Helper to set filter value in localStorage
    setFilter(key, value) {
        localStorage.setItem(`inventoryComponent_${key}`, value);
    }

    render(data) {
        // Use localStorage for persistent filter states
        const searchVal = this.getFilter('searchVal');
        const categoryVal = this.getFilter('categoryVal');
        const statusVal = this.getFilter('statusVal');
        const unitVal = this.getFilter('unitVal');

        const inventoryList = data.inventory || [];
        const uniqueCategories = Array.from(new Set(inventoryList.map(i => i.category).filter(Boolean)));
        const uniqueUnits = Array.from(new Set(inventoryList.map(i => i.unit).filter(Boolean)));
        const uniqueStatuses = ["normal", "low"]; // based on stock

        let filtered = inventoryList;
        if (searchVal) filtered = filtered.filter(i =>
            (i.name && i.name.toLowerCase().includes(searchVal.toLowerCase())) ||
            (i.description && i.description.toLowerCase().includes(searchVal.toLowerCase())) ||
            (i.publicId && i.publicId.toLowerCase().includes(searchVal.toLowerCase())) || // Search by publicId
            (i.id && i.id.toString().includes(searchVal))
        );
        // Apply filters only if their value is not an empty string (or equivalent)
        if (categoryVal !== '') filtered = filtered.filter(i => i.category === categoryVal);
        if (statusVal !== '') { // This one handles it correctly, no need to change condition
            if (statusVal === 'low')
                filtered = filtered.filter(i => (i.quantity || 0) <= (i.minQuantity || 0));
            else
                filtered = filtered.filter(i => (i.quantity || 0) > (i.minQuantity || 0));
        }
        if (unitVal !== '') filtered = filtered.filter(i => i.unit === unitVal);

        // Calculate Totals based on filtered items
        const totalPurchaseValue = filtered.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.purchasePrice) || 0)), 0);
        const totalSaleValue = filtered.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.salePrice) || 0)), 0);
        const potentialProfit = totalSaleValue - totalPurchaseValue;

        return `
            <div class="table-container">
                <div class="table-header">
                    <h3 class="table-title">Anbar İdarəetməsi</h3>
                    ${window.authManager.hasPermission('inventory', 'create') ? `
                    <button class="btn btn-primary" onclick="window.modalManager.showInventoryForm()">
                        <i class="fas fa-plus"></i>
                        Yeni Məhsul
                    </button>
                    ` : ''}
                </div>

                <!-- Inventory Value Summary -->
                <div style="display: flex; gap: 2rem; margin-bottom: 1.5rem; padding: 1rem; background: var(--background-color); border-radius: var(--radius-md); border: 1px solid var(--border-color); flex-wrap: wrap; align-items: center;">
                    <div>
                        <small style="color: var(--text-light); font-weight: 600; text-transform: uppercase; font-size: 0.75rem; display: block; margin-bottom: 0.2rem;">Ümumi Alış Dəyəri</small>
                        <div style="font-size: 1.3rem; font-weight: 700; color: var(--text-color);">₼${totalPurchaseValue.toFixed(2)}</div>
                    </div>
                    <div style="width: 1px; background: var(--border-color); height: 30px; display: block;"></div>
                    <div>
                        <small style="color: var(--text-light); font-weight: 600; text-transform: uppercase; font-size: 0.75rem; display: block; margin-bottom: 0.2rem;">Ümumi Satış Dəyəri</small>
                        <div style="font-size: 1.3rem; font-weight: 700; color: var(--success-color);">₼${totalSaleValue.toFixed(2)}</div>
                    </div>
                    <div style="width: 1px; background: var(--border-color); height: 30px; display: block;"></div>
                    <div>
                        <small style="color: var(--text-light); font-weight: 600; text-transform: uppercase; font-size: 0.75rem; display: block; margin-bottom: 0.2rem;">Potensial Mənfəət</small>
                        <div style="font-size: 1.3rem; font-weight: 700; color: var(--primary-color);">₼${potentialProfit.toFixed(2)}</div>
                    </div>
                </div>

                <div style="overflow-x:auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">№</th>
                            <th style="min-width: 180px;">
                                Məhsul Adı<br>
                                <input class="form-input" style="max-width:130px;" type="text" placeholder="Ad, təsvir..." value="${searchVal}"
                                    id="inventorySearchInput"
                                    oninput="window.inventoryComponent.setFilter('searchVal', this.value); window.app.loadModuleDebounced('inventory');">
                            </th>
                            <th style="min-width: 120px;">ID</th>
                            <th style="min-width: 100px;">
                                Kateqoriya<br>
                                <select class="form-select" style="max-width:90px;" onchange="window.inventoryComponent.setFilter('categoryVal', this.value); window.app.loadModule('inventory');">
                                    <option value="">Hamısı</option>
                                    ${uniqueCategories.map(c => `<option value="${c}" ${categoryVal === c ? 'selected' : ''}>${c}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 120px;">Miqdar</th>
                            <th style="min-width: 80px;">
                                Vahid<br>
                                <select class="form-select" style="max-width:70px;" onchange="window.inventoryComponent.setFilter('unitVal', this.value); window.app.loadModule('inventory');">
                                    <option value="">Hamısı</option>
                                    ${uniqueUnits.map(u => `<option value="${u}" ${unitVal === u ? 'selected' : ''}>${u}</option>`).join('')}
                                </select>
                            </th>
                            <th style="min-width: 100px;">Alış Qiyməti</th>
                            <th style="min-width: 100px;">Satış Qiyməti</th>
                            <th style="min-width: 90px;">
                                Status<br>
                                <select class="form-select" style="max-width:70px;" onchange="window.inventoryComponent.setFilter('statusVal', this.value); window.app.loadModule('inventory');">
                                    <option value="">Hamısı</option>
                                    <option value="normal" ${statusVal === 'normal' ? 'selected' : ''}>Normal</option>
                                    <option value="low" ${statusVal === 'low' ? 'selected' : ''}>Az qalıb</option>
                                </select>
                            </th>
                            <th style="min-width: 120px;">Əlavə edən</th>
                            <th style="min-width: 120px;">Əməliyyatlar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map((item, idx) => this.renderInventoryRow(item, data, idx + 1)).join('')}
                    </tbody>
                </table>
                </div>
                <div style="margin:0.5em 0; color:#64748b;font-size:0.96em;">Məhsul sayı: <b>${filtered.length}</b></div>
                <button class="btn btn-secondary" style="margin-top:1em;" onclick="window.inventoryComponent.setFilter('searchVal', '');window.inventoryComponent.setFilter('categoryVal', '');window.inventoryComponent.setFilter('statusVal', '');window.inventoryComponent.setFilter('unitVal', '');window.app.loadModule('inventory');">
                    <i class="fas fa-times"></i> Filtri sıfırla
                </button>
            </div>
        `;
    }

    renderInventoryRow(item, data, rowIndex) {
        const esc = window.escapeHtml;
        const statusClass = (item.quantity || 0) <= (item.minQuantity || 0) ? 'status-cancelled' : 'status-confirmed';
        const statusText = (item.quantity || 0) <= (item.minQuantity || 0) ? 'Az qalıb' : 'Normal';
        const displayId = item.publicId || (window.app ? window.app.formatInternalId(item.id, 'AN') : item.id);
        const creator = (data.staff || []).find(s => s.id === item.createdBy || s.firebaseUid === item.createdBy);

        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${rowIndex || ''}</td>
                <td>
                    <strong>${esc(item.name)}</strong>
                    ${item.description ? `<br><small style="color: #64748b; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; display: block; max-width: 180px;">${esc(item.description)}</small>` : ''}
                </td>
                <td><small>${esc(displayId)}</small></td>
                <td>${esc(item.category)}</td>
                <td>
                    <span style="font-weight:bold;">${this.formatQuantity(item.quantity)}</span>
                    <button title="Stok hərəkətini göstər" class="btn btn-secondary btn-xs" style="margin-left:0.4em;padding:0.32em 0.52em;font-size:0.84em;background:#e0e7ff;font-weight:500; color:#3b82f6;"
                        onclick="window.inventoryComponent.showStockMovement('${esc(item.id)}')">
                        <i class="fas fa-list"></i>
                    </button>
                </td>
                <td>${esc(item.unit)}</td>
                <td>₼${(Number(item.purchasePrice) || 0).toFixed(2)}</td>
                <td>₼${(Number(item.salePrice) || 0).toFixed(2)}</td>
                <td><span class="status-badge ${statusClass}">${esc(statusText)}</span></td>
                <td><small>${creator ? esc(creator.name) : 'Sistem'}</small></td>
                <td>
                    ${window.authManager.hasPermission('inventory', 'edit') ? `
                    <button class="btn btn-secondary" onclick="window.modalManager.showInventoryForm('${esc(item.id)}')" title="Redaktə et">
                        <i class="fas fa-edit"></i>
                    </button>
                    ` : ''}
                    ${window.authManager.hasPermission('inventory', 'delete') ? `
                    <button class="btn btn-secondary" onclick="window.app.deleteInventoryItem('${esc(item.id)}')" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }

    // --- STOCK MOVEMENT / HISTORY MODAL ---
    showStockMovement(itemId) {
        try {
            const inv = window.app && window.app.data && Array.isArray(window.app.data.inventory)
                ? window.app.data.inventory.find(i => i.id == itemId)
                : null;
            if (!inv) {
                window.notificationManager?.showNotification('error', 'Məhsul tapılmadı', 'Secilən məhsul sistemdə aşkar edilmədi.');
                return;
            }
            const displayId = inv.publicId || (window.app ? window.app.formatInternalId(inv.id, 'AN') : inv.id);

            // 1. Get purchase documents movements (increase)
            const purchaseMovs = (window.app?.data?.purchaseDocuments || [])
                .filter(doc => Array.isArray(doc.items) && doc.items.some(it => it.inventoryId == itemId || it.name == inv.name))
                .flatMap(doc => {
                    // If item appears multiple times, list all
                    return doc.items
                        .filter(it => it.inventoryId == itemId || it.name == inv.name)
                        .map(it => ({
                            date: doc.purchaseDate || doc.createdAt || "",
                            type: 'in',
                            docType: 'purchase',
                            source: doc.supplierName,
                            quantity: Number(it.quantity),
                            unit: it.unit || inv.unit,
                            docNo: doc.publicId || window.app.formatInternalId(doc.id, 'AS'), 
                            price: it.unitPrice
                        }));
                });

            // 2. Get POS sales movements (decrease)
            const posMovs = (window.app?.data?.posSales || [])
                .filter(sale => Array.isArray(sale.items) && sale.items.some(it => it.id == itemId || it.name == inv.name))
                .flatMap(sale => sale.items.filter(it => it.id == itemId || it.name == inv.name).map(it => ({
                    date: sale.createdAt || "",
                    type: 'out',
                    docType: 'sale',
                    source: 'POS Satış',
                    quantity: Number(it.quantity),
                    unit: it.unit || inv.unit,
                    docNo: sale.publicId || window.app.formatInternalId(sale.id, 'PS'), 
                    price: it.price
                })));

            // 3. Get Creation/Initial Stock from Audit Logs
            let initialStock = 0;
            const auditLogs = window.app?.data?.auditLogs || [];
            const creationLog = auditLogs.find(log => log.entityType === 'inventory' && log.entityId === itemId && log.action === 'create');
            
            // Attempt to get initial quantity from the creation log
            if (creationLog && creationLog.changes && creationLog.changes.newData) {
                initialStock = Number(creationLog.changes.newData.quantity || 0);
            } 

            // 4. Compose all movements, sort by date desc
            const allMovs = [...purchaseMovs, ...posMovs].sort((a, b) => {
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                return dateB - dateA;
            });
            
            // Calculate expected quantity based on history: Initial + Purchases - Sales
            const totalPurchased = purchaseMovs.reduce((sum, m) => sum + m.quantity, 0);
            const totalSold = posMovs.reduce((sum, m) => sum + m.quantity, 0);
            const calculatedQty = initialStock + totalPurchased - totalSold;

            // Format movement rows
            const rowsHtml = allMovs.length ? allMovs.map(mov => `
                <tr>
                    <td>${window.app && window.app.formatDate ? window.app.formatDate(mov.date) : (mov.date || '')}</td>
                    <td>
                        <span class="status-badge ${mov.type === 'in' ? 'status-confirmed' : 'status-cancelled'}" style="font-weight:bold;">
                            ${mov.type === 'in' ? '<i class="fas fa-plus-circle"></i> Giriş' : '<i class="fas fa-minus-circle"></i> Çıxış'}
                        </span>
                    </td>
                    <td>${mov.docType === 'purchase'
                        ? `<span style="color:#3b82f6;">Alış Sənədi</span>`
                        : `<span style="color:#f59e0b;">Satış</span>`}</td>
                    <td>${mov.docNo || '--'}</td>
                    <td>${mov.source || '--'}</td>
                    <td>${this.formatQuantity(mov.quantity)} ${mov.unit || ''}</td>
                    <td>₼${mov.price !== undefined ? mov.price.toFixed(2) : '--'}</td>
                </tr>
            `).join('') : `
                <tr><td colspan="7" style="text-align:center;color:#64748b;">Stok hərəkəti tapılmadı</td></tr>
            `;
            
            // Check for discrepancy
            const mismatchWarning = Math.abs(inv.quantity - calculatedQty) > 0.01 
                ? `<div style="margin-top:1rem; padding:0.8rem; background:#fffbeb; border:1px solid #fbbf24; border-radius:0.5rem; color:#92400e;">
                     <i class="fas fa-exclamation-triangle"></i> <b>Diqqət:</b> Hesablanan qalıq (${this.formatQuantity(calculatedQty)}) ilə cari qalıq (${this.formatQuantity(inv.quantity)}) fərqlidir.<br>
                     <small>Səbəb: Əl ilə düzəlişlər, silinmiş sənədlər və ya sinxronizasiya xətası ola bilər.</small>
                     <div style="margin-top:0.5rem;">
                        <button class="btn btn-warning btn-sm" onclick="window.inventoryComponent.applyCalculatedStock('${inv.id}', ${calculatedQty})">
                            <i class="fas fa-sync"></i> Balansı Düzəlt (${this.formatQuantity(calculatedQty)})
                        </button>
                     </div>
                   </div>` 
                : '';

            const content = `
                <div style="padding:0.3rem 0;">
                    <h3 style="color:#3b82f6;margin:0 0 1rem 0;"><i class="fas fa-list"></i> Stok Hərəkəti — <span style="color:#1e293b;">${inv.name}</span></h3>
                    <div style="margin-bottom:1rem;">
                        <span class="status-badge status-confirmed" style="font-size:1.07em;">Cari Qalıq: <b>${this.formatQuantity(inv.quantity)}</b> ${inv.unit}</span>
                        <span style="margin-left:1em; color:#64748b;">Min. miqdar: ${inv.minQuantity}</span>
                        <div style="margin-top:0.5rem;font-size:0.9em;color:#64748b;">
                            İlkin Qalıq: <b>${this.formatQuantity(initialStock)}</b><br>
                            Cəmi Giriş: <b>+${this.formatQuantity(totalPurchased)}</b> | Cəmi Çıxış: <b>-${this.formatQuantity(totalSold)}</b>
                        </div>
                    </div>
                    ${mismatchWarning}
                    <div style="overflow-x:auto; margin-top:1rem;">
                        <table class="data-table" style="font-size:0.98em; min-width: 600px;">
                            <thead>
                                <tr>
                                    <th style="min-width: 90px;">Tarix</th>
                                    <th style="min-width: 90px;">Hərəkət</th>
                                    <th style="min-width: 90px;">Sənəd</th>
                                    <th style="min-width: 90px;">No</th>
                                    <th style="min-width: 120px;">Mənbə</th>
                                    <th style="min-width: 80px;">Miqdar</th>
                                    <th style="min-width: 80px;">Qiymət</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>
                    </div>
                </div>
            `;
            const actions = `
                <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            `;
            if (window.modalManager && typeof window.modalManager.showModal === 'function') {
                window.modalManager.showModal(`Stok Hərəkəti — ${inv.name} (${displayId})`, content, actions);
            }
        } catch (e) {
            console.error(e);
            window.notificationManager?.showNotification('error', 'Xəta', 'Stok hərəkəti baxışı açılmadı');
        }
    }
    
    async applyCalculatedStock(itemId, newQty) {
        try {
            if (!window.authManager.hasPermission('inventory', 'edit')) {
                 window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                 return;
            }
            const inv = window.app.data.inventory.find(i => i.id === itemId);
            if (!inv) return;
            
            await window.app.updateInventory(itemId, { ...inv, quantity: newQty });
            window.notificationManager?.showNotification('success', 'Uğurlu', 'Anbar qalığı yeniləndi.');
            window.modalManager.hideModal();
        } catch(e) {
            window.notificationManager?.showNotification('error', 'Xəta', 'Yeniləmə baş tutmadı.');
        }
    }

    /**
     * Formats quantity, showing up to 2 decimals if not an integer, otherwise showing integer.
     * @param {number} quantity
     * @returns {string} Formatted quantity string
     */
    formatQuantity(quantity) {
        quantity = Number(quantity) || 0;
        if (Number.isInteger(quantity)) {
            return quantity.toString();
        }
        return quantity.toFixed(2).replace(/\.00$/, ''); // Show max 2 decimals, hide trailing .00
    }
}