// purchase-document-form.js
//
// Alış Sənədi Formu - Supplier name autocomplete with free entry, dynamic suggestions as user types.

export default class PurchaseDocumentForm {
    constructor() {
        this.supplierList = [];
        this._boundShowSupplierSuggestions = this.showSupplierSuggestions.bind(this);
        this._boundSelectSupplierSuggestion = this.selectSupplierSuggestion.bind(this);
        this._boundSupplierBlur = this._supplierBlur.bind(this);
    }

    // Renders the purchase document form (doc = null for create)
    render(doc = null) {
        const isEdit = !!doc;
        const staffList = window.app?.data?.staff || [];
        const currentUserId = window.authManager?.getCurrentUser()?.uid; // Get current user's UID
        
        // Determine default selected staff for 'staffId' field
        let defaultStaffId = '';
        if (isEdit) {
            defaultStaffId = doc.staffId || ''; // For edit, use existing staffId
        } else {
            // For new documents, default to current user if they are in the staff list
            if (currentUserId && staffList.some(s => s.id === currentUserId)) {
                defaultStaffId = currentUserId;
            }
        }
        // Find staff name for display
        const displayStaff = staffList.find(s => s.id === defaultStaffId);
        const displayStaffName = displayStaff ? `${displayStaff.name} - ${displayStaff.position || 'İşçi'}` : 'Bilinmir';
        
        // Supplier names - get unique ones from existing documents + demo/fixed values
        let supplierList = [];
        try {
            supplierList = Array.from(new Set((window.app?.data?.purchaseDocuments || [])
                .map(d => d.supplierName)
                .filter(Boolean)
            ));
        } catch {}
        supplierList = supplierList.concat(['Bakı Təchizat', 'Quba Təchizat', 'Import Co', 'Anbar Təchizat']);
        supplierList = Array.from(new Set(supplierList.filter(Boolean))).sort();

        // Inventory product names for select input, include purchasePrice and unit
        const inventoryProducts = (window.app?.data?.inventory || []).map(i => ({ id: i.id, name: i.name, unit: i.unit, purchasePrice: i.purchasePrice }));

        // Items from doc or default one row
        const items = isEdit && Array.isArray(doc.items) ? doc.items : [{ inventoryId: '', name: '', quantity: 1, unit: '', unitPrice: 0 }];

        // Date
        const today = new Date().toISOString().split('T')[0];

        // Row HTML for product selection with select for inventory items
        // The data-index attribute is crucial for tracking rows after add/remove
        const itemsRowsHtml = items.map((item, i) => `
            <tr data-index="${i}" id="item-row-${i}">
                <td>
                    <select class="form-select purchase-item-select" name="item_inventoryId_${i}" onchange="window.purchaseDocumentForm.handleItemChange(${i})" required>
                        <option value="">Məhsul seçin</option>
                        ${inventoryProducts.map(prod =>
                            `<option value="${prod.id}" data-unit="${prod.unit || ''}" data-purchase-price="${prod.purchasePrice || 0}" ${item.inventoryId === prod.id ? 'selected' : ''}>${prod.name}</option>`
                        ).join('')}
                        <option value="custom" ${item.inventoryId === "custom" || (!item.inventoryId && !inventoryProducts.some(p => p.name === item.name)) ? "selected" : ""}>Digər (əllə yaz)</option>
                    </select>
                    <input type="text" name="item_name_${i}" value="${item.name || ''}" class="form-input purchase-item-name" ${item.inventoryId && item.inventoryId !== "custom" ? "readonly" : ""} placeholder="Ad..." required style="min-width:90px;margin-top:0.2em;">
                    <div class="input-error-message" style="display:none;"></div>
                </td>
                <td>
                    <input type="number" name="item_quantity_${i}" value="${item.quantity ?? 1}" min="1" class="form-input purchase-item-qty" style="width:65px;" required>
                    <div class="input-error-message" style="display:none;"></div>
                </td>
                <td>
                    <input type="text" name="item_unit_${i}" value="${item.unit || 'ədəd'}" class="form-input purchase-item-unit" style="width:60px;">
                </td>
                <td>
                    <span id="item_total_${i}">₼${((item.unitPrice||0) * (item.quantity||0)).toFixed(2)}</span>
                </td>
                <td>
                    <input type="number" name="item_unitPrice_${i}" value="${item.unitPrice || 0}" min="0" step="0.01" class="form-input purchase-item-price" style="width:85px;" required>
                    <div class="input-error-message" style="display:none;"></div>
                </td>
                <td>
                    <button type="button" class="btn btn-secondary btn-xs" onclick="window.purchaseDocumentForm.removeItemRow(${i})" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Actions for view/edit: baxış, çap, ödəniş, screeshot düymələri (appear only on edit)
        const afterFormBtns = isEdit ? `
            <div class="modal-footer" style="border-top:none;padding-top:0;">
                <button type="button" class="btn btn-secondary" onclick="window.modalManager.showPurchaseDocumentDetails('${doc.id}')"><i class="fas fa-eye"></i> Baxış</button>
                <button type="button" class="btn btn-secondary" onclick="window.purchaseDocumentForm.printPurchaseDocument('${doc.id}')"><i class="fas fa-print"></i> Çap et</button>
                <button type="button" class="btn btn-secondary" onclick="window.modalManager.hideModal(); window.modalManager.showCashForm('expense', null, null, '${doc.id}')"><i class="fas fa-money-bill-wave"></i> Ödəniş Yarat</button>
                <button type="button" class="btn btn-secondary" onclick="window.purchaseDocumentForm.sendPurchaseDocumentScreenshot('${doc.id}')"><i class="fas fa-image"></i> Screenşot Paylaş</button>
            </div>
        ` : '';

        // --- Supplier auto-suggest (autocomplete-like) field ---
        // We'll use a custom <div> for suggestions, focusing on mobile friendliness and native UX
        // - User can either select from suggestions or type a new name

        // Save supplier list on the class instance for binding in attachSupplierAutocomplete
        this.supplierList = supplierList;

        setTimeout(() => {
            if (window.purchaseDocumentForm) {
                window.purchaseDocumentForm.attachSupplierAutocomplete();
                window.purchaseDocumentForm.attachItemListeners();
                window.purchaseDocumentForm.updateTotal();
            }
        }, 120);

        return `
            <form id="purchaseDocumentForm" class="form-grid" autocomplete="off" onsubmit="return false;" novalidate onkeydown="return event.key !== 'Enter';" style="margin-bottom:0.8rem;padding-bottom:0.8rem;border-bottom:1px solid var(--border-color);">
                ${isEdit ? `
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label">Sənəd ID (Sistem):</label>
                    <input type="text" class="form-input" value="${doc.publicId || window.app.formatInternalId(doc.id, 'AS')}" readonly>
                </div>
                ` : ''}
                <div class="form-group">
                    <label class="form-label required">Sənəd №</label>
                    <input type="text" class="form-input" name="documentNumber" value="${isEdit ? (doc.documentNumber || '') : ''}" required>
                </div>
                <div class="form-group" style="position: relative;">
                    <label class="form-label required">Təchizatçı</label>
                    <input type="text" 
                        class="form-input" 
                        name="supplierName" 
                        id="supplierNameInput"
                        value="${isEdit ? (doc.supplierName || '') : ''}" 
                        placeholder="Təchizatçı adı"
                        autocomplete="off" 
                        required
                    >
                    <div id="supplierSuggestions" style="display:none; position:absolute; z-index:50; background:white; border:1px solid #e1e5ed; border-radius:0.5em; box-shadow:0 2px 16px rgba(59,130,246,0.08); left:0; right:0; max-height:190px; overflow-y:auto;">
                        <!-- Suggestions will be dynamically added here -->
                    </div>
                    <div class="input-error-message" style="display:none;"></div>
                </div>
                <div class="form-group">
                    <label class="form-label required">Alış Tarixi</label>
                    <input type="date" class="form-input" name="purchaseDate" value="${isEdit ? (doc.purchaseDate || today) : today}" required>
                    <div class="input-error-message" style="display:none;"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">Sənəd Faylı (PDF, JPG, PNG)</label>
                    <input type="file" class="form-input" accept=".pdf,.jpg,.jpeg,.png" name="documentFile" id="purchaseDocFile">
                    ${isEdit && doc.documentUrl ? `
                        <div style="margin-top:0.4em;">
                            <a href="${doc.documentUrl}" target="_blank" style="color:#3b82f6;font-size:1.1em;"><i class="fas fa-file-alt"></i> Mövcud sənəd</a>
                        </div>
                    ` : ''}
                    <div id="uploadProgress" style="display: none; margin-top: 0.5rem;">
                        <div style="background: #f1f5f9; border-radius: 0.5rem; overflow: hidden;">
                            <div id="progressBar" style="height: 6px; background: #3b82f6; width: 0%; transition: width 0.3s ease;"></div>
                        </div>
                        <small style="color: #64748b; margin-top: 0.25rem; display: block;">Yüklənir...</small>
                    </div>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label">Mallar / Məhsullar</label>
                    <div class="table-responsive" style="margin-bottom:0.75rem;">
                        <table style="width:100%; font-size:0.95em; min-width:600px;" id="itemsTable" class="data-table">
                            <thead>
                                <tr>
                                    <th style="width:35%;">Məhsul adı <small style="font-weight:normal;color:#64748b;">(Anbar artımı üçün siyaıdan seçin)</small></th>
                                    <th style="width:15%;">Miqdar</th>
                                    <th style="width:15%;">Vahid</th>
                                    <th style="width:10%;">Cəmi</th>
                                    <th style="width:20%;">Birim qiymət</th>
                                    <th style="width:5%;"> </th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsRowsHtml}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.purchaseDocumentForm.addItemRow()">
                        <i class="fas fa-plus"></i> Məhsul əlavə et
                    </button>
                    <div class="input-error-message" id="itemsTableError" style="display:none;"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">Əlavə qeyd</label>
                    <textarea name="notes" class="form-textarea" rows="3" placeholder="Sənədlə bağlı əlavə qeydlər">${isEdit ? (doc.notes || '') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Qeyd edən işçi</label>
                    <input type="text" class="form-input" value="${displayStaffName}" readonly>
                    <input type="hidden" name="staffId" value="${defaultStaffId}">
                    <small class="form-help">Sənədi qeyd edən işçi (dəyişdirilə bilməz).</small>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label class="form-label" style="font-weight:700;font-size:1.1rem;">Cəmi məbləğ</label>
                    <input type="text" class="form-input" name="totalAmount" style="font-weight:900;font-size:1.2rem;color:var(--primary-color);" value="₼0.00" readonly id="purchaseDocTotalAmount">
                </div>
            </form>
            ${afterFormBtns}
        `;
    }

    // --- Supplier autocomplete logic, attaches all relevant listeners ---
    attachSupplierAutocomplete() {
        const input = document.getElementById('supplierNameInput');
        const dropdown = document.getElementById('supplierSuggestions');
        if (!input || !dropdown) return;

        // Remove any previously attached events (defensive)
        input.onfocus = null;
        input.oninput = null;
        input.onblur = null;

        // Attach events
        input.addEventListener('focus', this._boundShowSupplierSuggestions);
        input.addEventListener('input', this._boundShowSupplierSuggestions);
        input.addEventListener('blur', this._boundSupplierBlur);

        // Bind selection function globally for use from HTML event handlers (needed for dropdown click)
        window.purchaseDocumentFormSelectSuggestion = this._boundSelectSupplierSuggestion;
    }

    // Show supplier suggestions (used as event handler for oninput/onfocus)
    showSupplierSuggestions(evt) {
        let val = evt && evt.target ? evt.target.value : (typeof evt === "string" ? evt : "");
        const input = document.getElementById('supplierNameInput');
        const dropdown = document.getElementById('supplierSuggestions');
        if (!input || !dropdown) return;

        val = typeof val === "string" ? val : (input?.value || "");
        const v = val.trim().toLowerCase();
        let matches = this.supplierList.filter(s => s.toLowerCase().includes(v));
        if (!v) {
            matches = this.supplierList.slice(0, 6);
        }
        // No suggestions if no matches or exact match
        if (matches.length === 1 && matches[0].toLowerCase() === v) matches = [];
        if (matches.length === 0) {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
            return;
        }
        // Build suggestion list; select via window.purchaseDocumentFormSelectSuggestion for global
        dropdown.innerHTML = matches.map(s =>
            `<div class="supplier-suggestion-item" tabindex="0"
                 style="padding:0.5em 1em;cursor:pointer;font-size:1em;color:#1e293b;"
                 onclick="window.purchaseDocumentFormSelectSuggestion('${s.replace(/'/g, "\\'")}')"
                 onkeydown="if(event.key==='Enter'){window.purchaseDocumentFormSelectSuggestion('${s.replace(/'/g, "\\'")}')}"
            >${s}</div>`
        ).join('');
        dropdown.style.display = 'block';
    }

    // Dropdown blur, hide after a brief delay to allow selection with mouse/touch
    _supplierBlur() {
        setTimeout(() => {
            const dropdown = document.getElementById('supplierSuggestions');
            if (dropdown) dropdown.style.display = 'none';
        }, 180);
    }

    // selectSupplierSuggestion callback from HTML
    selectSupplierSuggestion(supplier) {
        const input = document.getElementById('supplierNameInput');
        const dropdown = document.getElementById('supplierSuggestions');
        if (input) input.value = supplier;
        if (dropdown) dropdown.style.display = 'none';
        input && input.focus();
    }

    // Generates a human-friendly purchase doc "id" for visual reference (not for DB). Use prefix+sequence as in app.
    generateAltId() {
        if (!window.app?.generatePrefixedId) return `AS-${Date.now().toString().slice(-6)}`;
        return window.app.generatePrefixedId('purchase_documents');
    }

    addItemRow() {
        console.log('PDC_FORM: addItemRow START. Modal exists?', !!document.getElementById('modalOverlay'));
        const table = document.querySelector('#itemsTable tbody');
        if (!table) { console.error('PDC_FORM: itemsTable tbody not found!'); return; }
        const currentRows = table.querySelectorAll('tr');
        const idx = currentRows.length; // Use current length as new index

        const inventoryProducts = (window.app?.data?.inventory || []).map(i => ({ id: i.id, name: i.name, unit: i.unit, purchasePrice: i.purchasePrice }));
        const row = document.createElement('tr');
        row.dataset.index = idx; // Store index for easier lookup later
        row.id = `item-row-${idx}`; // Add ID for direct access if needed
        row.innerHTML = `
            <td>
                <select class="form-select purchase-item-select" name="item_inventoryId_${idx}" onchange="window.purchaseDocumentForm.handleItemChange(${idx})" required>
                    <option value="">Məhsul seçin</option>
                    ${inventoryProducts.map(prod => `<option value="${prod.id}" data-unit="${prod.unit || ''}" data-purchase-price="${prod.purchasePrice || 0}">${prod.name}</option>`).join('')}
                    <option value="custom">Digər (əllə yaz)</option>
                </select>
                <input type="text" name="item_name_${idx}" class="form-input purchase-item-name" placeholder="Ad..." required style="min-width:90px;margin-top:0.2em;">
                <div class="input-error-message" style="display:none;"></div>
            </td>
            <td>
                <input type="number" name="item_quantity_${idx}" value="1" min="1" class="form-input purchase-item-qty" style="width:65px;" required>
                <div class="input-error-message" style="display:none;"></div>
            </td>
            <td>
                <input type="text" name="item_unit_${idx}" value="ədəd" class="form-input purchase-item-unit" style="width:60px;">
            </td>
            <td>
                <span id="item_total_${idx}">₼0.00</span>
            </td>
            <td>
                <input type="number" name="item_unitPrice_${idx}" value="0" min="0" step="0.01" class="form-input purchase-item-price" style="width:85px;" required>
                <div class="input-error-message" style="display:none;"></div>
            </td>
            <td>
                <button type="button" class="btn btn-secondary btn-xs" onclick="window.purchaseDocumentForm.removeItemRow(${idx})" title="Sil">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        table.appendChild(row);
        this.attachItemListeners(); // Re-attach listeners for new row
        this.updateTotal(); // Recalculate total
        console.log('PDC_FORM: addItemRow END. Modal exists?', !!document.getElementById('modalOverlay'), 'Total rows:', table.querySelectorAll('tr').length);
    }

    removeItemRow(idx) {
        console.log('PDC_FORM: removeItemRow START. Index:', idx, 'Modal exists?', !!document.getElementById('modalOverlay'));
        const table = document.querySelector('#itemsTable tbody');
        if (!table) return;
        const rowToRemove = table.querySelector(`tr[data-index="${idx}"]`);
        if (rowToRemove) table.removeChild(rowToRemove);

        // Re-index rows after removal to maintain correct naming and data-index
        Array.from(table.children).forEach((row, newIdx) => {
            row.dataset.index = newIdx; // Store index for easier lookup later
            row.id = `item-row-${newIdx}`; // Add ID for direct access if needed
            row.querySelectorAll('select, input').forEach(input => {
                if (input.name) {
                    input.name = input.name.replace(/_(\d+)$/, `_${newIdx}`);
                }
            });
            const totalSpan = row.querySelector(`[id^="item_total_"]`);
            if (totalSpan) {
                totalSpan.id = `item_total_${newIdx}`;
            }
            // Update onclick for remove button
            const removeBtn = row.querySelector('.fa-trash')?.closest('button');
            if (removeBtn) {
                removeBtn.setAttribute('onclick', `window.purchaseDocumentForm.removeItemRow(${newIdx})`);
            }
        });

        this.attachItemListeners(); // Re-attach listeners for all rows
        this.updateTotal(); // Recalculate total
        console.log('PDC_FORM: removeItemRow END. Modal exists?', !!document.getElementById('modalOverlay'));
    }

    handleItemChange(idx) {
        const table = document.querySelector('#itemsTable');
        const row = table?.querySelector(`tbody tr[data-index="${idx}"]`);
        if (!row) return;
        const select = row.querySelector(`[name="item_inventoryId_${idx}"]`);
        const nameInput = row.querySelector(`[name="item_name_${idx}"]`);
        const unitInput = row.querySelector(`[name="item_unit_${idx}"]`);
        const unitPriceInput = row.querySelector(`[name="item_unitPrice_${idx}"]`);

        if (!select || !nameInput || !unitInput || !unitPriceInput) return;

        const selectedInvId = select.value;
        if (selectedInvId && selectedInvId !== "custom") {
            const selectedOption = select.options[select.selectedIndex];
            const prodName = selectedOption.textContent.split(' (')[0].trim();
            const prodUnit = selectedOption.dataset.unit;
            const prodPurchasePrice = parseFloat(selectedOption.dataset.purchasePrice);

            nameInput.value = prodName;
            nameInput.setAttribute("readonly", "readonly");
            unitInput.value = prodUnit || "ədəd";
            unitPriceInput.value = prodPurchasePrice.toFixed(2);
        } else {
            nameInput.value = "";
            nameInput.removeAttribute("readonly");
            unitInput.value = "ədəd";
            unitPriceInput.value = "0.00";
        }
        this.updateTotal(); // Recalculate total on item change
    }

    attachItemListeners() {
        // Watch any input change in items table
        const table = document.querySelector('#itemsTable');
        if (!table) return;
        table.querySelectorAll('.purchase-item-qty, .purchase-item-price, .purchase-item-name, .purchase-item-select, .purchase-item-unit').forEach(input => {
            // Remove previous listeners to avoid duplicates
            input.removeEventListener('input', this._boundUpdateTotal);
            input.removeEventListener('change', this._boundHandleItemChange);

            // Add new listeners
            if (input.type === 'number' || input.type === 'text') { // input for text, number inputs
                input.addEventListener('input', this._boundUpdateTotal || (this._boundUpdateTotal = this.updateTotal.bind(this)));
            }
            if (input.tagName === "SELECT" && input.name.startsWith('item_inventoryId_')) { // change for select
                input.addEventListener('change', this._boundHandleItemChange || (this._boundHandleItemChange = (e) => this.handleItemChange(+e.target.name.split('_').at(-1))));
            }
        });
        this.updateTotal(); // Initial calculation
    }

    updateTotal() {
        // Read all items and compute total
        const table = document.querySelector('#itemsTable');
        let total = 0;
        if (!table) return;
        Array.from(table.querySelectorAll('tbody tr')).forEach((tr) => {
            // Use data-index to get the correct current index, instead of actual index `i` (which can change after deletion)
            const rowIdx = tr.dataset.index;
            const q = parseFloat(tr.querySelector(`[name="item_quantity_${rowIdx}"]`)?.value || "0");
            const up = parseFloat(tr.querySelector(`[name="item_unitPrice_${rowIdx}"]`)?.value || "0");
            const itemTotal = q * up;
            total += itemTotal;
            const span = tr.querySelector(`#item_total_${rowIdx}`);
            if (span) span.textContent = `₼${itemTotal.toFixed(2)}`;
        });
        const totalInput = document.getElementById('purchaseDocTotalAmount');
        if (totalInput) totalInput.value = `₼${total.toFixed(2)}`;
    }

    // --- Client-side validation ---
    validateForm() {
        const form = document.getElementById('purchaseDocumentForm');
        if (!form) return false;

        this.clearInvalidHighlight(form); // Clear previous errors

        let isValid = true;
        const requiredFields = ['supplierName', 'purchaseDate', 'documentNumber']; // documentNumber is also required
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // Validate main form fields
        requiredFields.forEach(field => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input && (!data[field] || String(data[field]).trim() === '')) {
                this.highlightInvalidField(input, 'Bu sahə mütləq doldurulmalıdır.');
                isValid = false;
            }
        });

        // Validate items table
        const itemsTable = document.querySelector('#itemsTable tbody');
        if (!itemsTable) {
            this.highlightInvalidField(form.querySelector('[name="notes"]')?.closest('.form-group') || form, 'Məhsul siyahısı tapılmadı.');
            isValid = false;
        } else {
            const itemRows = itemsTable.querySelectorAll('tr');
            if (itemRows.length === 0) {
                this.highlightInvalidField(document.getElementById('itemsTableError'), 'Ən azı bir məhsul əlavə edin.');
                isValid = false;
            } else {
                Array.from(itemRows).forEach(row => {
                    const rowIdx = row.dataset.index;
                    const nameInput = row.querySelector(`[name="item_name_${rowIdx}"]`);
                    const quantityInput = row.querySelector(`[name="item_quantity_${rowIdx}"]`);
                    const unitPriceInput = row.querySelector(`[name="item_unitPrice_${rowIdx}"]`);

                    if (nameInput && (!nameInput.value || nameInput.value.trim() === '')) {
                        this.highlightInvalidField(nameInput, 'Məhsul adı mütləqdir.');
                        isValid = false;
                    }
                    if (quantityInput && (isNaN(parseFloat(quantityInput.value)) || parseFloat(quantityInput.value) <= 0)) {
                        this.highlightInvalidField(quantityInput, 'Miqdar 0-dan böyük olmalıdır.');
                        isValid = false;
                    }
                    if (unitPriceInput && (isNaN(parseFloat(unitPriceInput.value)) || parseFloat(unitPriceInput.value) < 0)) {
                        this.highlightInvalidField(unitPriceInput, 'Birim qiymət sıfırdan az olmamalıdır.');
                        isValid = false;
                    }
                });
            }
        }

        return isValid;
    }

    highlightInvalidField(inputElement, message) {
        if (!inputElement) return;

        inputElement.style.borderColor = "#ef4444";
        inputElement.style.background = "#fee2e2";

        let errorDiv = inputElement.nextElementSibling; // Assuming error div is next sibling
        if (errorDiv && errorDiv.classList.contains('input-error-message')) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        } else { // Create if not existing
            errorDiv = document.createElement('div');
            errorDiv.className = "input-error-message";
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
            inputElement.parentNode.insertBefore(errorDiv, inputElement.nextSibling);
            errorDiv.style.display = 'block';
        }
    }

    clearInvalidHighlight(form) {
        form.querySelectorAll(".form-input, .form-select").forEach(input => {
            input.style.borderColor = "";
            input.style.background = "";
        });
        form.querySelectorAll(".input-error-message").forEach(el => el.style.display = 'none');
    }

    // --- File upload progress feedback ---
    showUploadProgress() {
        const progressContainer = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        if (progressContainer && progressBar) {
            progressContainer.style.display = 'block';
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress >= 90) { // Stop at 90% and wait for actual upload to complete
                    progress = 90;
                    clearInterval(interval);
                }
                progressBar.style.width = progress + '%';
            }, 200);
            this._progressInterval = interval;
        }
    }

    hideUploadProgress(success = true) {
        const progressContainer = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = success ? '100%' : '0%';
            progressBar.style.background = success ? '#10b981' : '#ef4444'; // Green for success, red for error
        }
        if (this._progressInterval) clearInterval(this._progressInterval);
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
            if (progressBar) progressBar.style.background = '#3b82f6'; // Reset color
        }, 500); // Small delay to show 100% or error color
    }

    // SAVE/SUBMIT: Will update inventory, calculate new avg cost, handle create vs edit
    async submit(docId = null) {
        try {
            const form = document.getElementById('purchaseDocumentForm');
            if (!form) {
                window.notificationManager?.showNotification('error', 'Forma xətası', 'Form tapılmadı.');
                return;
            }

            // Perform client-side validation first
            if (!this.validateForm()) {
                window.notificationManager?.showNotification('error', 'Məlumat xətası', 'Xahiş edirik, bütün mütləq sahələri doldurun və səhvləri düzəldin.');
                return;
            }

            // Read fields
            const f = form;
            const supplierName = f.supplierName.value.trim();
            const documentNumber = f.documentNumber.value.trim();
            const purchaseDate = f.purchaseDate.value;
            const notes = f.notes.value;
            const staffId = f.staffId.value; // Get selected staffId from the dropdown

            // Items (support both select/inventory & custom)
            const table = document.querySelector('#itemsTable');
            if (!table) {
                window.notificationManager?.showNotification('error', 'Forma xətası', 'Məhsul siyahısı tapılmadı.');
                return;
            }
            const items = [];
            // Use more robust selection strategy: query inputs within rows directly by class
            Array.from(table.querySelectorAll('tbody tr')).forEach((tr) => {
                // Use class selectors to find inputs within the row context, insensitive to index naming issues
                const select = tr.querySelector('.purchase-item-select');
                const nameInput = tr.querySelector('.purchase-item-name');
                const qtyInput = tr.querySelector('.purchase-item-qty');
                const unitInput = tr.querySelector('.purchase-item-unit');
                const priceInput = tr.querySelector('.purchase-item-price');

                // Fix: Capture the value correctly
                const inventoryId = select ? select.value : '';
                const name = nameInput ? nameInput.value.trim() : '';
                const quantity = parseFloat(qtyInput ? qtyInput.value : "0");
                const unit = unitInput ? unitInput.value.trim() : '';
                const unitPrice = parseFloat(priceInput ? priceInput.value : "0");
                
                // Validate basic requirements for a row
                if (name && quantity > 0) {
                    // Push the item. inventoryId will be 'custom' or an ID string.
                    // app.js logic will filter out 'custom' or empty inventoryIds when adjusting stock.
                    items.push({ inventoryId, name, quantity, unit, unitPrice });
                }
            });

            const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

            // Document file upload (optional)
            let documentUrl = docId ? (window.app?.data?.purchaseDocuments?.find(d => d.id == docId)?.documentUrl || null) : null;
            const documentFile = form.documentFile.files[0];
            if (documentFile) {
                try {
                    this.showUploadProgress();
                    documentUrl = await websim.upload(documentFile);
                    this.hideUploadProgress(true); // Indicate success
                } catch (e) {
                    this.hideUploadProgress(false); // Indicate failure
                    window.notificationManager?.showNotification('error', 'Fayl yüklənməsi xətası', 'Sənəd yüklənmədi. Təkrar cəhd edin.');
                    return; // Prevent form submission on upload failure
                }
            }
            // Compose data
            const data = {
                documentNumber,
                supplierName,
                purchaseDate,
                totalAmount,
                items,
                documentUrl,
                staffId,
                createdAt: new Date().toISOString()
            };
            if (docId) data.id = docId;

            // Update or create document DB entry
            let savedDoc;
            if (docId) {
                // CLIENT-SIDE PERMISSION CHECK
                if (!window.authManager.hasPermission('purchase_documents', 'edit')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                savedDoc = await window.app.updatePurchaseDocument(docId, data);
            } else {
                // CLIENT-SIDE PERMISSION CHECK
                if (!window.authManager.hasPermission('purchase_documents', 'create')) {
                    window.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                    return;
                }
                savedDoc = await window.app.createPurchaseDocument(data);
            }

            // Immediately close the modal upon successful submission, as requested by the user.
            // This is located after the document has been successfully created/updated in the database.
            window.modalManager.hideModal();

            // The create/update methods in app.js now handle refreshing.

        } catch (error) {
            window.notificationManager?.showNotification('error', 'Sistem xətası', error.message || 'Sənəd əlavə edilərkən xəta baş verdi.');
            this.hideUploadProgress(false); // Hide progress on overall submission error
        }
    }

    // Çap et: print dialog with minimalist format for the current purchase document
    printPurchaseDocument(docId) {
        const doc = window.app?.data?.purchaseDocuments?.find(d => d.id == docId);
        if (!doc) return window.notificationManager?.showNotification('error', 'Xəta', 'Sənəd tapılmadı');
        const staff = window.app?.data?.staff?.find(s => s.id === doc.staffId);
        const itemsRows = (doc.items || []).map(item => `
            <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${item.unit || ''}</td>
                <td>₼${(item.unitPrice || 0).toFixed(2)}</td>
                <td>₼${((item.quantity || 0)*(item.unitPrice || 0)).toFixed(2)}</td>
            </tr>
        `).join('');

        const formattedDate = (window.app && typeof window.app.formatDate === "function") ? window.app.formatDate(doc.purchaseDate) : d => d;
        const hotelInfo = window.app?.getHotelInfo?.() || {};
        const displayPublicId = doc.publicId || (window.app ? window.app.formatInternalId(doc.id, 'AS') : doc.id); // Use publicId

        const printHTML = `
            <html><head>
                <title>Alış Sənədi #${displayPublicId}</title>
                <style>
                body { font-family: 'Inter', sans-serif; color:#181b2c; background:#fff; padding:32px 18px;}
                h1 {color:#3b82f6; font-size:20px; }
                table { width:100%; border-collapse:collapse; margin-top:18px; font-size: 12.3px;}
                th, td { border:1px solid #e5e7eb; padding:7px 8px; text-align:left; }
                th { background:#f8fafc;color:#3b82f6;}
                .totals {margin-top:1em; }
                .footer {margin-top:2em; font-size:11px; color:#8392a6;}
                @media print {.no-print {display:none;}}
                </style>
            </head>
            <body>
                <div class="print-header">
                    <div class="hotel-title">${hotelInfo.hotelName || "RB Hotel PMS"}</div>
                    <div>${hotelInfo.address || ""}${hotelInfo.phone ? " | " + hotelInfo.phone : ""}${hotelInfo.email ? " | " + hotelInfo.email : ""}</div>
                    <h1>Alış Sənədi - ${doc.documentNumber}</h1>
                </div>
                <div>
                    <strong>Sistem ID:</strong> ${displayPublicId}<br>
                    <strong>Təchizatçı:</strong> ${doc.supplierName}<br>
                    <strong>Tarix:</strong> ${formattedDate(doc.purchaseDate)}<br>
                    <strong>Qeyd:</strong> ${doc.notes || "—"}<br>
                    <strong>Əlavə edən İşçi:</strong> ${staff ? staff.name : ''}
                </div>
                <table>
                    <thead><tr>
                        <th style="width:180px">Məhsul</th>
                        <th>Miqdar</th>
                        <th>Vahid</th>
                        <th>₼Qiymət</th>
                        <th>₼Cəmi</th>
                    </tr></thead>
                    <tbody>${itemsRows}</tbody>
                </table>
                <div class="totals"><strong>Cəmi Məbləğ:</strong> ₼${doc.totalAmount.toFixed(2)}</div>
                <div class="footer">
                    Alış sənədi RB Hotel PMS sistemi ilə hazırlanmışdır.
                </div>
                <div class="no-print" style="text-align: center; margin-top: 20px;">
                    <button onclick="window.print()" style="padding:9px 18px;border-radius:7px;background:#3b82f6;color:white;border:none;font-size:1em;">Çap et</button>
                    <button onclick="window.close()" style="padding:9px 18px;border-radius:7px;margin-left:10px;background:#64748b;color:white;border:none;font-size:1em;">Bağla</button>
                </div>
                <script>
                window.onload = () => setTimeout(()=>window.print(),300);
                </script>
            </body></html>
        `;
        const win = window.open('', '_blank');
        win.document.write(printHTML);
        win.document.close();
    }

    // Ödəniş yarat: aç cash form modal for expense (təchizat alışı) with amount & desc filled
    showPaymentForPurchase(docId) {
        const doc = window.app?.data?.purchaseDocuments?.find(d => d.id == docId);
        if (!doc) return window.notificationManager?.showNotification('error', 'Xəta', 'Sənəd tapılmadı');
        // Open cash form for expense, category Təchizat alışı
        window.modalManager.showCashForm('expense', null, null, docId);
    }

    // Screenşot paylaşma: screenshot and send via Telegram
    async sendPurchaseDocumentScreenshot(docId) {
        const doc = window.app?.data?.purchaseDocuments?.find(d => d.id == docId);
        if (!doc) return window.notificationManager?.showNotification('error', 'Xəta', 'Sənəd tapılmadı');

        // Render a minimal HTML for screenshot
        let div = document.createElement('div');
        div.style.position = 'fixed';
        div.style.left = '-9999px';
        div.style.top = '0';
        div.style.width = '420px';
        div.style.background = '#fff';
        div.style.fontFamily = 'Inter, Arial, sans-serif';
        div.style.borderRadius = '20px';
        div.style.boxShadow = '0 4px 20px 0 #6366f122';
        div.style.padding = '1.5rem 1.6rem 1.3rem 1.6rem';

        const formattedPurchaseDate = window.app && typeof window.app.formatDate === "function" ? window.app.formatDate(doc.purchaseDate) : doc.purchaseDate;
        const displayPublicId = doc.publicId || (window.app ? window.app.formatInternalId(doc.id, 'AS') : doc.id); // Use publicId

        div.innerHTML = `
            <div style="color:#3b82f6;text-align:center;font-size:1.16em;font-weight:800;letter-spacing:.05em;line-height:1.2;margin-bottom:1.0em;">
                <div>Alış Sənədi</div>
                <div style="font-weight:400;font-size:0.93em;">№${doc.documentNumber}</div>
            </div>
            <div style="font-size:0.98em;color:#3b82f6;"><strong>Təchizatçı:</strong> <span style="color:#22223b;">${doc.supplierName}</span></div>
            <div style="margin-bottom:0.25em;color:#64748b;"><small>${formattedPurchaseDate}</small></div>
            <div style="margin-bottom:0.25em;color:#64748b;"><small>Sistem ID: ${displayPublicId}</small></div>
            <table style="width:100%;margin-top:0.8em;font-size:0.95em;">
                <thead>
                  <tr style="color:#3b82f6;">
                    <th>Məhsul</th><th>Miqdar</th><th>Vahid</th><th>₼Qiymət</th><th>₼Cəmi</th>
                  </tr>
                </thead>
                <tbody>
                  ${(doc.items || []).map(item =>
                    `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${item.unit || ""}</td><td>${(item.unitPrice || 0).toFixed(2)}</td><td>${((item.quantity || 0)*(item.unitPrice || 0)).toFixed(2)}</td></tr>`
                  ).join('')}
                </tbody>
            </table>
            <div style="font-weight:600;font-size:1.1em;margin:1em 0 0.5em 0;color:#10b981;">Cəmi: ₼${(doc.totalAmount || 0).toFixed(2)}</div>
            <div style="font-size:0.92em;color:#64748b;">İşçi: ${window.app?.data?.staff?.find(s => s.id === doc.staffId)?.name || ""}</div>
            <div style="margin-top:1em;font-size:0.91em;color:#64748b;">Sistem: RB Hotel PMS</div>
        `;
        document.body.appendChild(div);
        // Load html2canvas if not loaded
        if (!window.html2canvas) {
            const s = document.createElement('script');
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
            s.onload = proceed;
            document.head.appendChild(s);
        } else {
            proceed();
        }
        async function proceed() {
            await document.fonts.ready;
            const canvas = await window.html2canvas(div, { backgroundColor: "#fff", scale: 2 });
            const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
            document.body.removeChild(div);
            const caption = `<b>Alış Sənədi: ${doc.supplierName}</b>\n№${doc.documentNumber}, ₼${doc.totalAmount.toFixed(2)}\nSistem ID: ${displayPublicId}`; // Include publicId in caption
            window.notificationManager?.sendTelegramFile(blob, caption, "purchase_documents", true, "photo");
        }
    }
}

// Ensure global availability
window.PurchaseDocumentForm = PurchaseDocumentForm;
window.purchaseDocumentForm = new PurchaseDocumentForm();