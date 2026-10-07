// POS component - Sale ONLY, with product search, category filters, and improved UI
export default class POSComponent {
    constructor() {
        // Cart is persisted to localStorage so it survives module re-renders/filter changes.
        this.cart = this.loadCart();
        this.cartTotal = this.cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
    }

    loadCart() {
        try {
            const raw = localStorage.getItem('posComponent_cart');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) { console.warn('Failed to load POS cart', e); }
        return [];
    }

    saveCart() {
        try {
            localStorage.setItem('posComponent_cart', JSON.stringify(this.cart));
        } catch (e) { console.warn('Failed to save POS cart', e); }
    }

    // --- LocalStorage based filters ---
    getFilter(key, defaultValue = '') {
        return localStorage.getItem(`posComponent_${key}`) || defaultValue;
    }

    setFilter(key, value) {
        localStorage.setItem(`posComponent_${key}`, value);
        window.app.loadModule('pos');
    }
    
    setSearchTerm(value) {
        localStorage.setItem(`posComponent_searchTerm`, value);
        window.app.loadModuleDebounced('pos');
    }
    
    // NEW: Set history filter without affecting product search
    setHistoryFilter(key, value) {
        localStorage.setItem(`posComponent_${key}`, value);
        window.app.loadModule('pos');
    }

    // NEW: Set history search term with debounce
    setHistorySearchTerm(value) {
        localStorage.setItem(`posComponent_historySearchTerm`, value);
        window.app.loadModuleDebounced('pos');
    }
    // --- End Filters ---

    render(data) {
        // Get filter values from localStorage
        const searchTerm = this.getFilter('searchTerm');
        const selectedCategory = this.getFilter('selectedCategory', 'Hamısı');

        // Prepare products: in stock, and get unique categories
        const allProducts = (data.inventory ?? []).filter(item => (item.quantity || 0) > 0);
        const categories = ['Hamısı', ...Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)))];

        // Apply filters
        let filteredProducts = allProducts;
        if (selectedCategory !== 'Hamısı') {
            filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
        }
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            filteredProducts = filteredProducts.filter(p => 
                p.name.toLowerCase().includes(lowerSearchTerm) ||
                (p.publicId && p.publicId.toLowerCase().includes(lowerSearchTerm))
            );
        }

        return `
            <div class="pos-container">
                <div class="pos-products-panel">
                    <div class="pos-products-header">
                        <input type="search" class="form-input" placeholder="Məhsul axtar..." value="${window.escapeHtml(searchTerm)}" 
                               oninput="window.posComponent.setSearchTerm(this.value)" id="posProductSearch">
                        <div class="pos-category-filters">
                            ${categories.map(cat => `
                                <button class="btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}" 
                                        onclick="window.posComponent.setFilter('selectedCategory', '${cat}')">
                                    ${cat}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="pos-products-grid">
                        ${filteredProducts.length > 0
                            ? filteredProducts.map(product => this.renderProductItem(product)).join('')
                            : `<div class="pos-no-products">
                                   <i class="fas fa-box-open"></i>
                                   <span>Axtarışa uyğun məhsul tapılmadı.</span>
                               </div>`
                        }
                    </div>
                </div>
                <div class="pos-cart-panel">
                    <div class="pos-cart-header">
                        <h3 class="table-title">Satış Səbəti</h3>
                        <div style="display:flex; gap:0.5rem;">
                            <button class="btn btn-secondary" onclick="window.posComponent.clearCart()" title="Səbəti təmizlə" ${this.cart.length === 0 ? 'disabled' : ''}>
                                <i class="fas fa-trash"></i>
                            </button>
                            <button class="btn btn-primary" onclick="window.posComponent.processSaleOrPurchase()" ${this.cart.length === 0 ? 'disabled' : ''}>
                                <i class="fas fa-shopping-cart"></i> Satışı Tamamla
                            </button>
                        </div>
                    </div>
                    <div id="posCart" class="pos-cart-body">
                        ${this.renderCart()}
                    </div>
                </div>
            </div>
            
            ${this.renderSalesHistory(data)}

            <style>
                .pos-container {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 1.5rem;
                    height: calc(100vh - 150px); /* Full height minus header/padding */
                }
                .pos-products-panel, .pos-cart-panel {
                    background: var(--card-bg);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-soft-ui);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .pos-products-header {
                    padding: 1rem;
                    border-bottom: 1px solid var(--border-color);
                }
                .pos-category-filters {
                    margin-top: 1rem;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                .pos-category-filters .btn {
                    padding: 0.5rem 1rem;
                    font-size: 0.85rem;
                }
                .pos-products-grid {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 1rem;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: 1rem;
                    align-content: start;
                }
                .pos-product-card {
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    padding: 1rem;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    background-color: var(--content-bg);
                }
                .pos-product-card:hover {
                    transform: translateY(-3px);
                    box-shadow: var(--shadow-md);
                    border-color: var(--primary-color);
                }
                .pos-product-card[disabled] {
                    opacity: 0.5;
                    cursor: not-allowed;
                    background-color: var(--background-color);
                }
                .pos-product-card .name {
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                    height: 40px; /* For consistent height */
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }
                .pos-product-card .price {
                    font-weight: bold;
                    color: var(--primary-color);
                    font-size: 1.1rem;
                    margin-bottom: 0.25rem;
                }
                .pos-product-card .stock {
                    font-size: 0.8rem;
                    color: var(--text-light);
                }
                .pos-no-products {
                    grid-column: 1 / -1;
                    text-align: center;
                    color: var(--text-light);
                    padding: 4rem 2rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                    font-size: 1.1rem;
                }
                .pos-no-products i {
                    font-size: 2.5rem;
                    opacity: 0.5;
                }
                .pos-cart-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    border-bottom: 1px solid var(--border-color);
                }
                .pos-cart-body {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 0.5rem 1rem;
                }
                @media (max-width: 900px) {
                    .pos-container {
                        grid-template-columns: 1fr;
                        height: auto;
                    }
                    .pos-products-panel {
                        min-height: 400px;
                    }
                    .pos-products-grid {
                        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                    }
                }
            </style>
        `;
    }

    renderProductItem(product) {
        let disabled = product.quantity <= 0 ? 'disabled' : '';
        const esc = window.escapeHtml;

        return `
            <div class="pos-product-card" ${disabled} 
                 onclick="${disabled ? '' : `window.posComponent.addToCartPrompt('${esc(product.id)}')`}">
                <div>
                    <div class="name" title="${esc(product.name)}">${esc(product.name)}</div>
                    <div class="price">₼${(Number(product.salePrice) || 0).toFixed(2)}</div>
                </div>
                <div class="stock">${esc(product.quantity)} ${esc(product.unit)} qalıb</div>
            </div>
        `;
    }

    renderCart() {
        if (this.cart.length === 0) {
            return `
                <div style="text-align: center; color: var(--text-light); padding: 4rem 2rem;">
                    <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>Səbət boşdur</p>
                </div>
            `;
        }

        const esc = window.escapeHtml;
        return `
            ${this.cart.map((item, index) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);">
                    <div>
                        <strong title="${esc(item.name)}">${esc(item.name.length > 20 ? item.name.substring(0, 18) + '...' : item.name)}</strong><br>
                        <span style="font-size:0.85em;color:var(--text-light);">${esc(item.quantity)} ${esc(item.unit || '')} x ₼${Number(item.price).toFixed(2)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.4rem;">
                        <div style="font-weight:bold;min-width:65px;text-align:right;">₼${(item.price * item.quantity).toFixed(2)}</div>
                        <button onclick="window.posComponent.adjustCartQuantity(${index}, -1)" class="btn btn-secondary btn-sm" style="padding:0.35rem 0.55rem;" title="Azalt">-</button>
                        <button onclick="window.posComponent.adjustCartQuantity(${index}, 1)" class="btn btn-secondary btn-sm" style="padding:0.35rem 0.55rem;" title="Artır">+</button>
                        <button onclick="window.posComponent.removeFromCart(${index})" class="btn btn-secondary btn-sm" style="padding:0.35rem 0.55rem; color: var(--danger-color);" title="Səbətdən sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid var(--text-color); font-size: 1.5rem; font-weight: bold; display: flex; justify-content: space-between;">
                <span>Cəmi:</span>
                <span>₼${this.cartTotal.toFixed(2)}</span>
            </div>
        `;
    }

    switchMode(mode) {
        // Disabled: Sale mode only
        // this.mode = 'sale';
        // this.cart = [];
        // this.cartTotal = 0;
        // if (window.app && window.app.currentModule === "pos") {
        //     window.app.loadModule("pos");
        // }
    }

    addToCartPrompt(productId) {
        // For a fast POS workflow, clicking a product adds 1 to the cart.
        // Quantity can be adjusted in the cart if needed.
        // Look up the product fresh from inventory so we don't inline untrusted data into onclick.
        const prod = window.app?.data?.inventory?.find(x => x.id == productId);
        if (!prod) {
            window.notificationManager?.showNotification('error', 'Xəta', 'Məhsul tapılmadı.');
            return;
        }
        this.addToCart(prod.id, prod.name || '', Number(prod.salePrice) || 0, 1, prod.quantity || 1000, prod.unit || "");
    }

    addToCart(productId, name, price, qty = 1, maxQty = 1000, unit = "") {
        if (window.app?.data?.inventory) {
            const prod = window.app.data.inventory.find(x => x.id == productId);
            maxQty = prod ? prod.quantity : 1000;
        }
        const existingItem = this.cart.find(item => item.id === productId && String(item.price) === String(price));

        if (existingItem) {
            if (existingItem.quantity < maxQty) {
                existingItem.quantity += qty;
            } else {
                window.notificationManager?.showNotification('warning', 'Stokda kifayət qədər məhsul yoxdur', `Anbarda cəmi ${maxQty} ədəd var.`);
            }
        } else {
            this.cart.push({ id: productId, name, price, quantity: qty, unit });
        }
        this.updateCartTotal();
        this.saveCart();
        this.updateCartDisplay();
    }

    adjustCartQuantity(index, change) {
        const item = this.cart[index];
        const stock = this.getStockOfProduct(item.id);

        if (change > 0 && (item.quantity + 1 > stock)) {
            window.notificationManager?.showNotification('warning', 'Stokda kifayət qədər məhsul yoxdur', `Anbarda cəmi ${stock} ədəd var.`);
            return;
        }
        
        item.quantity += change;

        if (item.quantity <= 0) {
            this.cart.splice(index, 1);
        }
        this.updateCartTotal();
        this.saveCart();
        this.updateCartDisplay();
    }

    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.updateCartTotal();
        this.saveCart();
        this.updateCartDisplay();
    }

    updateCartTotal() {
        this.cartTotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        // Also update the state of cart-related buttons
        const clearBtn = document.querySelector('.pos-cart-header .btn-secondary');
        const processBtn = document.querySelector('.pos-cart-header .btn-primary');
        if (clearBtn) clearBtn.disabled = this.cart.length === 0;
        if (processBtn) processBtn.disabled = this.cart.length === 0;
    }

    updateCartDisplay() {
        const cartElement = document.getElementById('posCart');
        if (cartElement) {
            cartElement.innerHTML = this.renderCart();
        }
    }

    getStockOfProduct(productId) {
        const inventoryItem = window.app?.data?.inventory?.find(i => i.id == productId);
        return inventoryItem ? inventoryItem.quantity : 0;
    }

    async processSaleOrPurchase() {
        if (this.cart.length === 0) {
            window.notificationManager?.showNotification('warning', 'Səbət boşdur', 'Əməliyyat üçün məhsul əlavə edin.');
            return;
        }
        // Sale mode is the only mode
        window.modalManager.showPaymentForm(this.cart, this.cartTotal);
    }

    clearCart() {
        this.cart = [];
        this.cartTotal = 0;
        this.saveCart();
        this.updateCartDisplay();
        this.updateCartTotal(); // Also update button states
        window.notificationManager?.showNotification('info', 'Səbət təmizləndi', '', 1500);
    }
    
    // NEW: Render the Sales History table below the main POS interface
    renderSalesHistory(data) {
        const sales = data.posSales || [];
        
        const historySearchTerm = this.getFilter('historySearchTerm', '');
        const historyDate = this.getFilter('historyDate', '');
        const historyPaymentType = this.getFilter('historyPaymentType', '');
        const historyStaffId = this.getFilter('historyStaffId', '');

        const staffList = data.staff || [];
        const uniquePaymentTypes = Array.from(new Set(sales.map(s => s.paymentType).filter(Boolean)));

        let filteredSales = sales.slice();

        if (historySearchTerm) {
            const lowerSearch = historySearchTerm.toLowerCase();
            filteredSales = filteredSales.filter(s =>
                (s.publicId && s.publicId.toLowerCase().includes(lowerSearch)) ||
                (s.items.some(item => item.name.toLowerCase().includes(lowerSearch)))
            );
        }
        if (historyDate) {
            filteredSales = filteredSales.filter(s => s.createdAt.split('T')[0] === historyDate);
        }
        if (historyPaymentType) {
            filteredSales = filteredSales.filter(s => s.paymentType === historyPaymentType);
        }
        if (historyStaffId) {
            filteredSales = filteredSales.filter(s => s.staffId === historyStaffId);
        }

        // Sort by date descending
        filteredSales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const formatDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate : d => d;

        return `
            <div class="table-container" style="margin-top: 2rem;">
                <div class="table-header">
                    <h3 class="table-title"><i class="fas fa-list-alt"></i> POS Satış Tarixçəsi</h3>
                </div>
                <div style="overflow-x:auto;">
                    <table class="data-table" style="min-width: 900px;">
                        <thead>
                            <tr>
                                <th style="min-width: 150px;">
                                    ID / Məhsullar<br>
                                    <input class="form-input" style="max-width:130px;" type="search" placeholder="ID, məhsul adı..." value="${window.escapeHtml(historySearchTerm)}"
                                        id="posHistorySearchInput"
                                        oninput="window.posComponent.setHistorySearchTerm(this.value);">
                                </th>
                                <th style="min-width: 120px;">
                                    Tarix<br>
                                    <input type="date" class="form-input" style="max-width:110px;" value="${historyDate}"
                                        onchange="window.posComponent.setHistoryFilter('historyDate', this.value);">
                                </th>
                                <th style="min-width: 100px;">Məbləğ</th>
                                <th style="min-width: 120px;">
                                    Ödəniş Növü<br>
                                    <select class="form-select" style="max-width:110px;" onchange="window.posComponent.setHistoryFilter('historyPaymentType', this.value);">
                                        <option value="">Hamısı</option>
                                        ${uniquePaymentTypes.map(p => `<option value="${window.escapeHtml(p)}" ${historyPaymentType===p?'selected':''}>${window.escapeHtml(this.getPaymentTypeLabel(p))}</option>`).join('')}
                                    </select>
                                </th>
                                <th style="min-width: 120px;">Əlaqəli Rezervasiya</th>
                                <th style="min-width: 120px;">
                                    İcraçı<br>
                                    <select class="form-select" style="max-width:110px;" onchange="window.posComponent.setHistoryFilter('historyStaffId', this.value);">
                                        <option value="">Hamısı</option>
                                        ${staffList.map(s => `<option value="${window.escapeHtml(s.id)}" ${historyStaffId===s.id?'selected':''}>${window.escapeHtml(s.name)}</option>`).join('')}
                                    </select>
                                </th>
                                <th style="min-width: 120px;">Əməliyyatlar</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredSales.map(sale => this.renderSalesHistoryRow(sale, data)).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="margin:0.5em 0; color:#64748b;font-size:0.96em;">Satış sayı: <b>${filteredSales.length}</b></div>
                <button class="btn btn-secondary" style="margin-top:1em;" onclick="window.posComponent.resetHistoryFilters();">
                    <i class="fas fa-times"></i> Filtri sıfırla
                </button>
            </div>
        `;
    }

    getPaymentTypeLabel(type) {
        const map = {
            cash: 'Nağd',
            card: 'Kart',
            paypal: 'PayPal',
            account: 'Hesab'
        };
        return map[type] || type;
    }

    renderSalesHistoryRow(sale, data) {
        const esc = window.escapeHtml;
        const staff = (data.staff || []).find(s => s.id === sale.staffId);
        const reservation = (data.reservations || []).find(r => r.id === sale.reservationId);
        const displayId = sale.publicId || (window.app ? window.app.formatInternalId(sale.id, 'PS') : sale.id);
        
        const itemsSummary = (sale.items || []).map(i => `${esc(i.name)} x${esc(i.quantity)}`).join(', ');
        const reservationLink = reservation 
            ? `<a href="#" onclick="window.modalManager.showReservationDetails('${esc(reservation.id)}')" title="Rezervasiyaya bax">${esc(reservation.publicId || reservation.id)}</a>`
            : '—';

        return `
            <tr>
                <td>
                    <strong>${esc(displayId)}</strong><br>
                    <small style="color:#64748b; max-width: 250px; display: block; overflow: hidden; text-overflow: ellipsis;" title="${esc(itemsSummary)}">${itemsSummary}</small>
                </td>
                <td>
                    ${window.app.formatDate(sale.createdAt)} <br>
                    <small style="color:#64748b;">${(sale.createdAt || '').split('T')[1]?.slice(0, 5) || ''}</small>
                </td>
                <td>
                    <strong>₼${(Number(sale.totalAmount) || 0).toFixed(2)}</strong>
                </td>
                <td>
                    <span class="status-badge status-${sale.paymentType === 'account' ? 'pending' : 'confirmed'}">
                        ${esc(this.getPaymentTypeLabel(sale.paymentType))}
                    </span>
                </td>
                <td>${reservationLink}</td>
                <td>${staff ? esc(staff.name) : 'N/A'}</td>
                <td>
                    <div style="display: flex; gap: 0.3rem;">
                        <button class="btn btn-secondary btn-xs" onclick="window.posComponent.showSaleDetails('${sale.id}')" title="Ətraflı">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-secondary btn-xs" onclick="window.app.printPOSReceipt('${sale.id}')" title="Qəbzi çap et">
                            <i class="fas fa-print"></i>
                        </button>
                         ${window.authManager.hasPermission('pos', 'delete') ? `
                        <button class="btn btn-secondary btn-xs" onclick="window.app.deletePOSSale('${sale.id}')" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    resetHistoryFilters() {
        localStorage.removeItem('posComponent_historySearchTerm');
        localStorage.removeItem('posComponent_historyDate');
        localStorage.removeItem('posComponent_historyPaymentType');
        localStorage.removeItem('posComponent_historyStaffId');
        window.app.loadModule('pos');
    }

    showSaleDetails(saleId) {
        const sale = window.app.data.posSales.find(s => s.id === saleId);
        if (!sale) {
            window.notificationManager?.showNotification('error', 'Xəta', 'Satış tapılmadı');
            return;
        }

        const staff = window.app.data.staff.find(s => s.id === sale.staffId);
        const reservation = sale.reservationId ? window.app.data.reservations.find(r => r.id === sale.reservationId) : null;
        const displayId = sale.publicId || (window.app ? window.app.formatInternalId(sale.id, 'PS') : sale.id);

        const itemsHtml = sale.items.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 0.3em 0;">
                <span>${window.escapeHtml(item.name)} (${window.escapeHtml(item.quantity)} ${window.escapeHtml(item.unit || 'ədəd')})</span>
                <strong>₼${((Number(item.price)||0) * (Number(item.quantity)||0)).toFixed(2)}</strong>
            </div>
        `).join('');

        const reservationInfoHtml = reservation 
            ? `<p><strong>Rezervasiya:</strong> ${window.escapeHtml(reservation.publicId || reservation.id)}</p>`
            : '';

        const content = `
            <div style="padding: 0.5rem 0;">
                <h3 style="color: #3b82f6; margin: 0 0 1rem 0;">POS Satış Detalları #${window.escapeHtml(displayId)}</h3>
                <div class="info-box" style="margin-bottom: 1rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.95em;">
                        <div><strong>Tarix:</strong> ${window.app.formatDate(sale.createdAt, true)}</div>
                        <div><strong>İcraçı:</strong> ${window.escapeHtml(staff?.name || 'N/A')}</div>
                        <div><strong>Ödəniş Növü:</strong> ${window.escapeHtml(this.getPaymentTypeLabel(sale.paymentType))}</div>
                        ${reservationInfoHtml}
                    </div>
                </div>

                <h4 style="margin: 1rem 0 0.5rem 0; color: var(--text-color);">Məhsullar:</h4>
                <div class="info-box" style="margin-bottom: 1rem;">
                    ${itemsHtml}
                </div>

                <div class="info-box" style="margin-top: 1rem; padding: 1rem; text-align: right;">
                    <h4 style="margin: 0; color: var(--text-color);">Yekun Məbləğ:</h4>
                    <div style="font-size: 2rem; font-weight: bold; color: var(--primary-color);">
                        ₼${sale.totalAmount.toFixed(2)}
                    </div>
                </div>
            </div>
        `;

        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-primary" onclick="window.app.printPOSReceipt('${sale.id}')"><i class="fas fa-print"></i> Qəbzi Çap Et</button>
            ${reservation ? `<button class="btn btn-secondary" onclick="window.modalManager.showReservationDetails('${reservation.id}')"><i class="fas fa-eye"></i> Rezervasiyaya Bax</button>` : ''}
        `;

        window.modalManager.showModal('POS Satış Detalları', content, actions);
    }
}