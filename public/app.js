import DashboardComponent from './dashboard-component.js';
import QuickSearch from './quick-search.js';

class HotelPMS {
    constructor() {
        console.log('HotelPMS instance is being created...');

        // --- 1. State Management ---
        this.isInitialized = false; // Full app init (data loaded, modules rendered)
        this._coreInitialized = false; // NEW: Minimal app init (DB ready, staff loaded for auth check)
        this.currentModule = 'dashboard';
        // Keep the active module in the browser URL so a reload restores the
        // same screen and the browser Back/Forward buttons work as expected.
        this._navigationModules = new Set([
            'dashboard',
            'reservations',
            'guests',
            'rooms',
            'services',
            'invoices',
            'pos',
            'cash',
            'inventory',
            'purchase_documents',
            'maintenance',
            'staff',
            'reports',
            'settings',
            'superadmin_panel'
        ]);
        this._handlingHistoryNavigation = false;
        this.data = {}; // Will be populated by loadAllData

        // --- 2. Core Managers (DEFERRED INITIALIZATION) ---
        // These will be assigned in the init() method after the window.app instance is created.
        this.ws = null;
        this.authManager = null;
        this.modalManager = null;
        this.notificationManager = null;
        this.moduleRenderer = null;
        this.quickSearch = null;

        // NEW: Debounced version of loadModule for input fields
        this.loadModuleDebounced = this._debounce(this.loadModule.bind(this), 300); // 300ms debounce delay

        // --- 3. Data Collections Mapping ---
        this.collections = {
            guests: 'guests',
            rooms: 'rooms',
            reservations: 'reservations',
            services: 'services',
            inventory: 'inventory',
            staff: 'staff',
            maintenance: 'maintenance',
            cashTransactions: 'cash_transactions',
            invoices: 'invoices',
            posSales: 'pos_sales',
            reports: 'reports',
            settings: 'settings',
            auditLogs: 'audit_logs',
            purchaseDocuments: 'purchase_documents',
            systemErrors: 'system_errors'
        };
        // Initialize data storage object based on collections
        Object.keys(this.collections).forEach(key => this.data[key] = []);

        // NEW: Map internal collection keys (this.data keys) to the short permission module name
        this.permissionModuleMap = {
            guests: 'guests',
            rooms: 'rooms',
            reservations: 'reservations',
            services: 'services',
            inventory: 'inventory',
            staff: 'staff',
            maintenance: 'maintenance',
            cashTransactions: 'cash',
            invoices: 'invoices',
            posSales: 'pos',
            reports: 'reports',
            settings: 'settings',
            auditLogs: 'audit_logs', // Used in rules/auth-manager.js for permissions check
            purchaseDocuments: 'purchase_documents',
            systemErrors: 'system_errors' // Used in rules/auth-manager.js for permissions check
        };

        // --- 4. Initialization ---
        // The main init() method is called after the instance is created.
    }
    
    /**
     * NEW: Orchestrates the entire application startup sequence
     */
    async init() {
        console.log('HotelPMS: Starting overall initialization sequence...');
        if (window.updateSplashProgress) window.updateSplashProgress(5, 'Başlanğıc...');

        // Wait only for the local managers. Firebase is an online enhancement and
        // must not prevent the login screen/local cache from opening.
        let retries = 0;
        while ((!window.authManager || !window.hybridDB) && retries < 30) {
            console.warn(`HotelPMS.init: Waiting for local core services... (Attempt ${retries + 1})`);
            await new Promise(resolve => setTimeout(resolve, 50));
            retries++;
        }
        if (!window.authManager || !window.hybridDB) {
            console.error("CRITICAL: Local core services are not available after waiting. PMS initialization cannot proceed.");
            this.notificationManager?.showNotification?.('error', 'Kritik Sistem Xətası', 'Əsas modullar yüklənmədi. Səhifəni yeniləyin.');
            return; // Stop initialization
        }

        // 1. Assign global managers to `this` instance
        this._assignManagers();

        // 2. Setup core application-level event listeners and configurations
        this._setupCoreAppServices();

        // 3. Start Firebase Auth when it is ready, but do not wait for it here.
        // The local login screen and IndexedDB can open while Firebase connects.
        this.authManager.initFirebaseAuth();
        const initializeFirebaseAuthWhenReady = () => {
            if (!this.authManager?.firebaseAuth && window.firebaseAuth) {
                this.authManager.initFirebaseAuth();
            }
        };
        if (!this.authManager.firebaseAuth) {
            window.addEventListener('firebase-ready', initializeFirebaseAuthWhenReady, { once: true });
        }
        if (window.updateSplashProgress) window.updateSplashProgress(15, 'Autentifikasiya yoxlanılır...');

        // 4. NEW: Perform core data loading BEFORE showing any UI (login screen or app).
        // This is crucial for the logged-out state, so staff data is available for login checks.
        try {
            await this.coreInitialize();
            if (window.updateSplashProgress) window.updateSplashProgress(45, 'İnterfeys hazırlanır...');
        } catch (error) {
            console.error("CRITICAL: Failed during initial core data load. Cannot proceed to show UI.", error);
            // The splash screen should already show an error from within coreInitialize.
            return; // Stop execution to prevent showing a broken login screen.
        }

        // 5. NOW that core data is loaded, handle the initial UI.
        // onAuthStateChanged will have likely already fired, but calling this ensures the UI is correctly set
        // based on the auth state AND the now-available data (like hotel name).
        this.authManager.handleInitialAuthUI();
        
        console.log('HotelPMS: Overall initialization sequence finished. Application is ready for user interaction.');
    }

    /**
     * Renamed from original `init` to be more descriptive.
     * Assigns global manager instances to `this` to make them accessible.
     */
    _assignManagers() {
        console.log('HotelPMS: Assigning global manager instances...');

        // Defensive checks to ensure global managers are available
        if (!window.hybridDB) console.error('CRITICAL: window.hybridDB is undefined!');
        if (!window.authManager) console.error('CRITICAL: window.authManager is undefined!');
        if (!window.modalManager) console.error('CRITICAL: window.modalManager is undefined!');
        if (!window.notificationManager) console.error('CRITICAL: window.notificationManager is undefined!');
        if (!window.moduleRenderer) console.error('CRITICAL: window.moduleRenderer is undefined!');

        this.ws = window.hybridDB;
        this.authManager = window.authManager;
        this.modalManager = window.modalManager;
        this.notificationManager = window.notificationManager;
        this.moduleRenderer = window.moduleRenderer;
        this.quickSearch = new QuickSearch();

        // Instantiate DashboardComponent here, NOT in dashboard-component.js (if not already done)
        if (!window.dashboardComponent) {
            window.dashboardComponent = new DashboardComponent();
        }
    }

    /**
     * NEW: Centralized setup for core application services (formerly part of `init`)
     */
    _setupCoreAppServices() {
        console.log('HotelPMS: Setting up core app services...');
        this.setupEventListeners();
        this.initDarkMode();
        this.setupGlobalErrorHandling();
        // The auth state listener in AuthManager will now handle triggering coreInitialize and initialize.
    }
    
    /**
     * Private helper function to debounce calls.
     * @param {Function} func - The function to debounce.
     * @param {number} delay - The delay in milliseconds.
     * @returns {Function} A debounced version of the function.
     */
    _debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    /**
     * NEW: Performs minimal core initialization, loading only essential data for auth checks.
     */
    async coreInitialize() {
        if (this._coreInitialized) return;
        console.log('HotelPMS: Performing core initialization...');
        if (window.updateSplashProgress) window.updateSplashProgress(20, 'Əsas məlumatlar yüklənir...');
        const splashMessage = document.getElementById('splashStatusMessage');
        try {
            if (splashMessage) splashMessage.textContent = 'Əsas məlumatlar yüklənir...';
            // Ensure this.ws is available before calling collection method
            if (!this.ws || typeof this.ws.collection !== 'function') {
                throw new Error("Verilənlər bazası servisi hazır deyil.");
            }
            this.data.staff = await this.ws.collection('staff').getList();
            this.data.settings = await this.ws.collection('settings').getList(); // Settings needed for hotel info
            
            if (window.updateSplashProgress) window.updateSplashProgress(40, 'İstifadəçi profili yoxlanılır...');
            
            this.authManager?.updateStaffCache?.(); // Ensure auth manager has the latest staff list
            this.updateHotelNameInUI(); // Update hotel name based on initial settings

            this._coreInitialized = true;
            console.log('HotelPMS core initialized successfully.');
        } catch (error) {
            console.error('CRITICAL: HotelPMS core initialization failed.', error);
            if (splashMessage) {
                splashMessage.textContent = `Sistem xətası: ${error.message}`;
                splashMessage.style.color = '#FFD2D2';
            }
            this.notificationManager?.showNotification('error', 'Başlatma Xətası', `Sistem yüklənə bilmədi: ${error.message}.`);
            // Use window.app here for safety, as 'this' context might be uncertain in deep error handlers.
            // This call to recordSystemError needs the defensive check for this.ws too.
            window.app.recordSystemError('CoreInitError', error.message, error.stack, error.fileName, error.lineNumber, error.columnNumber);
            throw error;
        }
    }

    /**
     * Main initialization function, called after successful user login *and* status check.
     * Loads all remaining data and sets up the main application UI.
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn('HotelPMS already fully initialized. Skipping re-initialization.');
            return;
        }
        if (!this._coreInitialized) {
            // This should ideally not be hit as authManager.onAuthStateChanged ensures coreInitialize runs first.
            // But defensive check is good.
            await this.coreInitialize(); 
        }

        console.log('HotelPMS: Initializing full application...');
        const splashMessage = document.getElementById('splashStatusMessage');
        try {
            if (splashMessage) splashMessage.textContent = 'Bütün məlumatlar yüklənir...';
            if (window.updateSplashProgress) window.updateSplashProgress(50, 'Bütün məlumatlar yüklənir...');
            
            await this.loadAllData(true); // Pass true to skip staff and settings
            
            if (splashMessage) splashMessage.textContent = 'İnterfeys qurulur...';
            if (window.updateSplashProgress) window.updateSplashProgress(90, 'İnterfeys qurulur...');
            this.updateAppVersionDisplay();
            // Restore the last module from the URL. If there is no valid route
            // yet, dashboard becomes the initial route without adding a new
            // browser history entry.
            this.loadModule(this.getModuleFromLocation(), { replaceHistory: true });

            this.isInitialized = true;
            window.dispatchEvent(new CustomEvent('app-ready'));
            if (window.updateSplashProgress) window.updateSplashProgress(100, 'Sistem Hazırdır!');
            console.log('HotelPMS fully initialized successfully.');

            // Apply settings after full initialization
            this.applySettings();

            this.notificationManager?.notifySystemStarted(this.authManager?.getCurrentUser()?.name || 'Sistem');
            this.checkOverdueReservations();
            setInterval(() => this.checkOverdueReservations(), 60 * 60 * 1000); // Check every hour instead of 6

        } catch (error) {
            console.error('CRITICAL: HotelPMS full initialization failed.', error);
            if (splashMessage) {
                splashMessage.textContent = `Sistem xətası: ${error.message}`;
                splashMessage.style.color = '#FFD2D2';
            }
            this.notificationManager?.showNotification('error', 'Başlatma Xətası', `Sistem yüklənə bilmədi: ${error.message}.`);
            window.app.recordSystemError('FullInitError', error.message, error.stack, error.fileName, error.lineNumber, error.columnNumber);
            throw error;
        }
    }

    /**
     * NEW: Checks for reservations where checkout date has passed but status is still confirmed/occupied.
     * Automatically updates their status to 'checkout'.
     * 
     * NOTE: Logic disabled as per user request to prevent auto-checkout of paid reservations.
     */
    async checkOverdueReservations() {
        console.log('Automatic checkout check skipped (Feature disabled).');
        return;
        
        /* 
        // Original logic preserved for reference:
        console.log('Checking for overdue reservations...');
        const today = new Date().toISOString().split('T')[0];
        
        const overdueReservations = (this.data.reservations || []).filter(res => {
            if (res.checkOut >= today || (res.status !== 'confirmed' && res.status !== 'occupied')) {
                return false;
            }
            const financialSummary = this.getReservationFinancialSummary(res.id);
            return financialSummary && financialSummary.remainingBalance <= 0;
        });

        if (overdueReservations.length > 0) {
            // ... (Auto update logic)
        }
        */
    }

    /**
     * NEW: Updates the application version display in the UI.
     * It prioritizes a custom version from localStorage, then Electron API, then a fallback.
     */
    async updateAppVersionDisplay() {
        try {
            let version = '15.2.2'; // Updated Fallback version
            let finalVersion;

            // 1. Check for Electron API version first
            if (window.electronAPI && typeof window.electronAPI.getAppVersion === 'function') {
                try {
                    version = await window.electronAPI.getAppVersion();
                } catch (e) {
                    console.warn("Could not get version from Electron API, using fallback.", e);
                }
            }

            // 2. Check for custom version from localStorage, which overrides others
            const customVersion = localStorage.getItem('customAppVersion');
            if (customVersion) {
                finalVersion = customVersion;
            } else {
                finalVersion = version;
            }
            
            // 3. Update the UI element
            const versionElement = document.getElementById('footerAppVersionText');
            if (versionElement) {
                versionElement.innerHTML = `RB Hotel &middot; Otel PMS | Versiya: ${finalVersion}`;
            }

            // 4. Also update the Electron window title if applicable
            if (window.electronUpdater && typeof window.electronUpdater.setAppTitle === 'function') {
                // Get the current module title, default to the hotel name if not available
                const moduleTitle = document.getElementById('pageTitle')?.textContent || this.getHotelInfo()?.hotelName || 'Otel PMS';
                window.electronUpdater.setAppTitle(`RB Hotel - ${moduleTitle}`);
            }

        } catch (error) {
            console.error('Error updating app version display:', error);
            // Don't record this as a system error as it's non-critical UI.
        }
    }

    /**
     * Updates the hotel name on the login screen and sidebar.
     * This is the single source of truth for updating branding elements.
     */
    updateHotelNameInUI() {
        try {
            // Defensively get hotel name from settings or cache, fallback to a default.
            let cachedName = null;
            try { cachedName = localStorage.getItem('cached_hotel_name'); } catch(_) {}
            const hotelName = this.getSetting('hotelInfo')?.hotelName || cachedName || 'RB Hotel PMS';
            try { localStorage.setItem('cached_hotel_name', hotelName); } catch(_) {}
            const year = new Date().getFullYear();

            // 1. Document title
            document.title = `${hotelName} - Otel PMS`;

            // 2. Top Bar Brand Title
            const ezeeHotelTitle = document.getElementById('ezeeHotelTitle');
            if (ezeeHotelTitle) ezeeHotelTitle.textContent = hotelName;

            // 3. Sidebar Brand Labels
            document.querySelectorAll('.luxuria-hotel-label').forEach(el => {
                el.textContent = hotelName;
            });
            const sidebarHotelName = document.getElementById('sidebarHotelName');
            if (sidebarHotelName) sidebarHotelName.textContent = hotelName;

            // 4. Splash Screen Hotel Name
            const splashHotelName = document.getElementById('splashHotelName');
            if (splashHotelName) splashHotelName.textContent = hotelName;
            document.querySelectorAll('.splash-title span').forEach(el => {
                el.textContent = hotelName;
            });

            // 5. Login screen elements
            const loginHotelName = document.getElementById('loginHotelName');
            if (loginHotelName) loginHotelName.textContent = hotelName;

            const loginCopyright = document.getElementById('loginCopyright');
            if (loginCopyright) loginCopyright.textContent = `© ${year} ${hotelName}. Bütün hüquqlar qorunur.`;

            // 6. Pending approval screen elements
            const pendingHotelName = document.getElementById('pendingApprovalScreen_HotelName');
            if (pendingHotelName) pendingHotelName.textContent = hotelName;

            // 7. Footer Version Text
            const footerAppVersion = document.getElementById('footerAppVersionText');
            if (footerAppVersion) {
                footerAppVersion.innerHTML = `${hotelName} &middot; Otel PMS | Versiya: 15.2.2`;
            }

            // 8. Dispatch event for any other subscribers
            window.dispatchEvent(new CustomEvent('hotelname-changed', { detail: { hotelName } }));

        } catch (error) {
            console.error('Error in updateHotelNameInUI:', error);
            if (this.recordSystemError && typeof this.recordSystemError === 'function') {
                this.recordSystemError('UIUpdateError', error.message, error.stack);
            }
        }
    }

    /**
     * Records a system error to the database.
     * @param {string} errorType - A category for the error (e.g., 'DBError', 'ModuleRenderError').
     * @param {string} message - The error message.
     * @param {string} stack - The stack trace.
     * @param {string} [filename] - The file where the error occurred.
     * @param {number} [lineno] - The line number.
     * @param {number} [colno] - The column number.
     */
    async recordSystemError(errorType, message, stack, filename, lineno, colno) {
        try {
            if (errorType === 'SystemErrorLoggingError') {
                console.error("Met-error while logging system error. Aborting to prevent loop.", { message, stack });
                return;
            }

            console.error(`[System Error Recorded] Type: ${errorType}, Message: ${message}`, { stack, filename, lineno, colno });

            // Defensive check for this.ws and its collection method
            // This is the CRITICAL PATCH to prevent the error reporter from crashing itself.
            if (!this.ws || typeof this.ws.collection !== 'function') {
                console.error("Cannot record system error: Database manager (this.ws) or its collection method is not available. Error details not stored to DB.", { errorType, message, stack });
                // Attempt to notify user directly via notificationManager if available, without DB interaction
                if (this.notificationManager && typeof this.notificationManager.showNotification === 'function') {
                    this.notificationManager.showNotification('error', 'Kritik Sistem Xətası', `Sistem xətası qeydə alına bilmədi: ${message.substring(0, 100)}. Baza bağlantısını yoxlayın.`, 10000);
                }
                return; // Abort DB logging
            }

            const errorData = {
                id: self.crypto.randomUUID(),
                publicId: this.generateSequentialPublicId('system_errors'),
                timestamp: new Date().toISOString(),
                errorType,
                message,
                stack,
                filename: filename || (error?.fileName), // Assuming 'error' might be passed as an argument directly
                lineno: lineno || (error?.lineNumber),
                colno: colno || (error?.columnNumber),
                resolved: false,
                performedBy: this.authManager?.getCurrentUser()?.name || 'System (pre-auth)'
            };

            await this.ws.collection('system_errors').create(errorData);

        } catch (e) {
            console.error('CRITICAL: Failed to record system error (secondary error). This may be a database connection issue.', e);
            this.notificationManager?.showNotification('error', 'Kritik Sistem Xətası', 'Sistem xətası qeydə alına bilmədi. Baza bağlantısını yoxlayın.');
        }
    }

    /**
     * Records an action to the audit log.
     * @param {string} action - The action performed (e.g., 'create', 'update', 'delete', 'login').
     * @param {string} entityType - The type of entity being acted upon (e.g., 'guest', 'reservation').
     * @param {string} entityId - The ID of the entity.
     * @param {object} [changes={}] - An object detailing the changes, e.g., { oldData, newData }.
     * @param {string|null} [performedBy=null] - The name of the user who performed the action. Defaults to the current user.
     */
    async recordAuditLog(action, entityType, entityId, changes = {}, performedBy = null) {
        try {
            if (!this.authManager || !this.ws) return;
            const currentUser = this.authManager.getCurrentUser();
            const performedByName = performedBy || currentUser?.name || 'System';

            const deviceInfo = {
                userAgent: window.navigator.userAgent,
                platform: window.navigator.platform,
                language: window.navigator.language
            };

            const logData = {
                id: self.crypto.randomUUID(),
                action, // e.g., 'create', 'update', 'delete', 'login'
                entityType, // e.g., 'guest', 'reservation'
                entityId,
                changes, // { oldData: {...}, newData: {...} } or { info: '...' }
                performedBy: performedByName,
                createdAt: new Date().toISOString(),
                deviceInfo,
                loginIp: 'N/A'
            };

            await this.ws.collection('audit_logs').create(logData);
            // No need to refresh audit log data in the main app data cache
            // It's usually just write-only for performance.
        } catch (error) {
            console.error('Failed to record audit log:', error);
            // Do not show a UI notification for this, as it's a background task.
            // Just log it to system errors.
            this.recordSystemError('AuditLogError', error.message, error.stack);
        }
    }

    /**
     * Specifically records a login event to the audit log.
     * @param {string} userId - The ID of the user who logged in.
     * @param {string} userName - The name of the user.
     * @param {string} userEmail - The email of the user.
     */
    async recordLoginAudit(userId, userName, userEmail) {
        // This is a specific wrapper for recordAuditLog for login events.
        // The deviceInfo is now automatically added within recordAuditLog.
        try {
            await this.recordAuditLog('login', 'staff', userId, { info: `User ${userName} (${userEmail}) logged in.` }, userName);
        } catch (error) {
            console.error('Failed to record login audit:', error);
            // Don't show UI error, but log to system errors
            this.recordSystemError('LoginAuditError', error.message, error.stack);
        }
    }

    /**
     * Helper to retrieve staff name by ID.
     * @param {string} staffId - The ID of the staff member (usually firebaseUid or staff.id).
     * @returns {string} The staff member's name or 'N/A' if not found.
     */
    getStaffNameById(staffId) {
        if (!staffId || !this.data || !this.data.staff) return 'N/A';
        const staff = this.data.staff.find(s => s.id === staffId);
        return staff?.name || staffId;
    }
    
    /**
     * Sets up global event listeners for the application.
     */
    setupEventListeners() {
        const searchTrigger = document.getElementById('globalSearchTrigger');
        searchTrigger?.addEventListener('click', () => this.quickSearch?.toggle());

        // Handle browser Back/Forward and direct hash changes. The route is
        // intentionally kept in the hash because this app is served as a
        // static single-page application and does not need server rewrites.
        const handleLocationNavigation = () => {
            const moduleName = this.getModuleFromLocation();
            if (moduleName === this.currentModule) return;

            this._handlingHistoryNavigation = true;
            try {
                this.loadModule(moduleName, { fromHistory: true });
            } finally {
                this._handlingHistoryNavigation = false;
            }
        };
        window.addEventListener('popstate', handleLocationNavigation);
        window.addEventListener('hashchange', handleLocationNavigation);

        // Sidebar navigation
        document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const moduleName = e.currentTarget.dataset.module;
                this.loadModule(moduleName);
            });
        });

        // Mobile & Top menu toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const sidebar = document.getElementById('sidebar');

        const toggleSidebar = () => {
            sidebar.classList.toggle('show');
            sidebarOverlay.classList.toggle('show');
        };

        if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);
        if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);
        if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

        // Scroll-to-top button visibility
        const mainContent = document.querySelector('.main-content');
        const scrollToTopBtn = document.querySelector('.scroll-to-top-container');
        if (mainContent && scrollToTopBtn) {
            mainContent.addEventListener('scroll', () => {
                if (mainContent.scrollTop > 200) {
                    scrollToTopBtn.classList.add('show');
                } else {
                    scrollToTopBtn.classList.remove('show');
                }
            });
        }
        
        // Electron menu actions
        if (window.electronAPI) {
            window.electronAPI.onMenuAction((action) => {
                switch (action) {
                    case 'new-reservation': this.modalManager.showReservationForm(); break;
                    case 'new-guest': this.modalManager.showGuestForm(); break;
                }
            });
            window.electronAPI.onExportData((filePath) => this.exportAllData(filePath));
            window.electronAPI.onImportData((filePath) => this.importAllData(filePath));
        }
    }

    /**
     * Initializes dark mode based on user preference or system setting.
     */
    initDarkMode() {
        const theme = localStorage.getItem('pms_theme');
        if (theme) {
            document.documentElement.setAttribute('data-theme', theme);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

    /**
     * Sets up global error handling to catch and record unhandled exceptions.
     */
    setupGlobalErrorHandling() {
        window.onerror = (message, source, lineno, colno, error) => {
            window.app.recordSystemError(
                'UnhandledError',
                `Uncaught ${error ? error.constructor.name : 'Error'}: ${message}`,
                error?.stack || 'No stack trace available.',
                source, lineno, colno
            );
            return false; // Let default handler run
        };

        window.onunhandledrejection = (event) => {
            window.app.recordSystemError(
                'UnhandledRejection',
                `Unhandled promise rejection: ${event.reason?.message || event.reason}`,
                event.reason?.stack || 'No stack trace available.'
            );
        };
    }
    
    /**
     * Refreshes the data for a specific collection from the database and updates the local cache.
     */
    async refreshData(collectionKey) {
        try {
            let key = collectionKey;
            let collectionName = this.collections[key];
            if (!collectionName) {
                // If passed snake_case (e.g. 'cash_transactions', 'pos_sales'), resolve corresponding camelCase key
                const matchEntry = Object.entries(this.collections).find(([k, v]) => v === collectionKey);
                if (matchEntry) {
                    key = matchEntry[0];
                    collectionName = matchEntry[1];
                }
            }
            if (!collectionName) {
                console.warn(`Attempted to refresh unknown collectionKey: ${collectionKey}.`);
                return;
            }
            this.data[key] = await this.ws.collection(collectionName).getList();
            if (key === 'staff') {
                this.authManager?.updateStaffCache?.();
                // NEW: Refresh current user's permissions if they are logged in and their record might have changed.
                this.authManager?.refreshCurrentUserPermissions?.();
            }
            if (key === 'settings') this.updateHotelNameInUI();
        } catch (error) {
            console.error(`Failed to refresh data for ${collectionKey}:`, error);
            this.notificationManager?.showNotification('error', 'Məlumat Yenilənmədi', `${collectionKey} məlumatları yenilənərkən xəta baş verdi.`);
            window.app.recordSystemError('DataRefreshError', error.message, error.stack, error.fileName, error.lineNumber, error.columnNumber);
            throw error;
        }
    }

    /**
     * Fetches all data from the database.
     */
    async loadAllData(skipCore = false) {
        console.log('Loading all data from database...');
        this.ws?.resetLoadProgress?.();
        try {
            const collectionsToLoad = Object.entries(this.collections)
                .filter(([key]) => !(skipCore && (key === 'staff' || key === 'settings')));
            
            const totalSteps = collectionsToLoad.length;
            let currentStep = 0;

            // The 'reservations' collection is typically the largest and slowest to read.
            // Load it in the background so a slow reservation read never blocks app startup;
            // it will populate as soon as it completes (and refresh the UI if reservations
            // is the current module).
            const RESERVATIONS_KEY = 'reservations';
            let reservationsPromise = null;
            const dataPromises = collectionsToLoad.map(async ([key, name]) => {
                if (key === RESERVATIONS_KEY) {
                    reservationsPromise = this.ws.collection(name).getList().then((list) => {
                        this.data[key] = list;
                        if (this.currentModule === RESERVATIONS_KEY || this.currentModule === 'dashboard') {
                            this.loadModule(this.currentModule, { fromHistory: true });
                        }
                        return list;
                    }).catch((err) => {
                        console.warn(`Background load of '${name}' failed, keeping current cache.`, err);
                        this.data[key] = this.data[key] || [];
                    });
                    return; // Don't let the slow reservations read block the Promise.all blow
                }
                this.data[key] = await this.ws.collection(name).getList();
                currentStep++;
                const progress = 50 + (currentStep / totalSteps) * 40; // Progress from 50% to 90%
                if(window.updateSplashProgress) window.updateSplashProgress(progress, `${name} yükləndi...`);
            });
            await Promise.all(dataPromises);
            // Non-blocking: reservations continue loading in background if not already finished
            
            console.log('All core data loaded and cached.');
            this.authManager?.updateStaffCache?.(); // Ensure auth manager has the latest staff list
            this.applySettings(); // NEW: Apply settings after loading them
        } catch (error) {
            console.error('Failed to load all data:', error);
            this.notificationManager?.showNotification('error', 'Məlumat Yüklənmədi', `Bütün məlumatlar yüklənə bilmədi: ${error.message}.`);
            window.app.recordSystemError('DataLoadError', error.message, error.stack, error.fileName, error.lineNumber, error.columnNumber);
            throw error;
        }
    }

    /**
     * Returns the current local date string in 'YYYY-MM-DD' format,
     * safely avoiding timezone issues related to toISOString().
     * @returns {string} The local date string.
     */
    getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Returns the next local date string in 'YYYY-MM-DD' format.
     * @returns {string} The local date string for tomorrow.
     */
    getTomorrowDateString() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const year = tomorrow.getFullYear();
        const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const day = String(tomorrow.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Loads and renders a specific module in the main content area.
     */
    /**
     * Reads the active module from the URL, falling back to the dashboard for
     * an empty, malformed, or unsupported route.
     */
    getModuleFromLocation() {
        const rawRoute = window.location.hash.replace(/^#/, '').trim();
        let moduleName = 'dashboard';
        try {
            moduleName = rawRoute ? decodeURIComponent(rawRoute) : 'dashboard';
        } catch (error) {
            console.warn('Invalid module route in URL. Falling back to dashboard.');
        }
        return this._navigationModules.has(moduleName) ? moduleName : 'dashboard';
    }

    /**
     * Writes a module route without causing a full page reload.
     */
    updateModuleHistory(moduleName, { fromHistory = false, replaceHistory = false } = {}) {
        if (fromHistory || this._handlingHistoryNavigation) return;

        // Re-rendering the active module (for example after changing a filter
        // or saving data) must not create a duplicate Back-button entry.
        const canonicalHash = `#${encodeURIComponent(moduleName)}`;
        if (!replaceHistory && this.currentModule === moduleName && window.location.hash === canonicalHash) return;

        const nextUrl = `${window.location.pathname}${window.location.search}#${encodeURIComponent(moduleName)}`;
        const historyMethod = replaceHistory ? 'replaceState' : 'pushState';
        window.history[historyMethod]({ module: moduleName }, '', nextUrl);
    }

    loadModule(moduleName, options = {}) {
        console.log(`Loading module: ${moduleName}`);
        if (!this._navigationModules.has(moduleName)) {
            console.warn(`Unknown module route "${moduleName}". Falling back to dashboard.`);
            moduleName = 'dashboard';
        }

        this.updateModuleHistory(moduleName, options);
        this.currentModule = moduleName;
        const currentTitle = this.getModuleTitle(moduleName);
        const pageTitleEl = document.getElementById('pageTitle');
        const breadcrumbEl = document.getElementById('breadcrumbModule');
        if (pageTitleEl) pageTitleEl.textContent = currentTitle;
        if (breadcrumbEl) breadcrumbEl.textContent = currentTitle;

        document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.module === moduleName);
        });

        this.moduleRenderer.renderModule(moduleName, this.data);
        
        if (window.electronUpdater?.setAppTitle) {
            window.electronUpdater.setAppTitle(`RB Hotel - ${this.getModuleTitle(moduleName)}`);
        }

        window.dispatchEvent(new CustomEvent('module-loaded', { detail: moduleName }));
    }

    /**
     * Refreshes and re-renders the currently active module safely (debounced).
     */
    refreshCurrentModule() {
        if (!this.currentModule) return;
        if (this._moduleRefreshDebounce) {
            clearTimeout(this._moduleRefreshDebounce);
        }
        this._moduleRefreshDebounce = setTimeout(() => {
            this._moduleRefreshDebounce = null;
            try {
                this.loadModule(this.currentModule, { fromHistory: true });
                console.log(`Module ${this.currentModule} re-rendered successfully.`);
            } catch (error) {
                console.error(`Failed to refresh module ${this.currentModule}:`, error);
            }
        }, 150);
    }
    
    /**
     * Gets the display title for a given module name.
     */
    getModuleTitle(moduleName) {
        const titles = {
            dashboard: 'Əsas Panel',
            reservations: 'Rezervasiyalar',
            guests: 'Qonaqlar',
            rooms: 'Otaqlar',
            services: 'Xidmətlər',
            pos: 'POS Satış',
            cash: 'Kassa',
            inventory: 'Anbar',
            invoices: 'Hesab-Fakturalar',
            staff: 'İşçilər',
            maintenance: 'Təmizlik/Təmir',
            reports: 'Hesabatlar',
            settings: 'Tənzimləmələr',
            superadmin_panel: 'Superadmin Panel',
            purchase_documents: 'Alış Sənədləri'
        };
        return titles[moduleName] || 'Otel PMS';
    }

    /**
     * Scrolls the main content area to the top.
     */
    scrollToTop() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // --- Data Manipulation Methods (CRUD operations) ---
    // These methods handle data validation, calling HybridDB,
    // and then refreshing the UI and sending notifications.

    async _createEntity(collectionKey, data, prefix) {
        try {
            // Determine the permission module name based on the collectionKey
            const permissionModule = this.permissionModuleMap[collectionKey] || collectionKey;

            // BACKEND-LIKE PERMISSION CHECK
            if (!this.authManager.hasPermission(permissionModule, 'create')) {
                throw new Error(`Bu əməliyyat üçün icazəniz yoxdur: ${prefix} yaratmaq.`);
            }

            data.id = self.crypto.randomUUID();
            data.publicId = this.generateSequentialPublicId(this.collections[collectionKey]);
            data.createdAt = new Date().toISOString();
            // MODIFIED: Use 'createdBy' from form data if it exists, otherwise use current user.
            data.createdBy = data.createdBy || this.authManager?.getCurrentUser()?.uid || null;

            const newEntity = await this.ws.collection(this.collections[collectionKey]).create(data);
            
            this.recordAuditLog('create', this.collections[collectionKey], newEntity.id, { newData: newEntity });
            this._notifyEntityChange('create', collectionKey, newEntity, null);

            if (collectionKey === 'reservations') {
                window.doorCardSystem?.handleReservationCreate(newEntity).catch(e => console.error('[DoorCard] create', e));
            };

            await this.refreshData(collectionKey);
            if (this.currentModule === collectionKey) this.refreshCurrentModule();
            
            return newEntity;
        } catch (error) {
            this.notificationManager?.showNotification('error', `${prefix} Yaratma Xətası`, error.message);
            window.app.recordSystemError(`Create${prefix}Error`, error.message, error.stack, error.fileName, error.lineNumber, error.columnNumber);
            throw error;
        }
    }

    async _updateEntity(collectionKey, entityId, data, prefix, isSilent = false, skipPermission = false) {
        try {
            // Determine the permission module name based on the collectionKey
            const permissionModule = this.permissionModuleMap[collectionKey] || collectionKey;
            
            // BACKEND-LIKE PERMISSION CHECK
            if (!skipPermission && !this.authManager.hasPermission(permissionModule, 'edit')) {
                throw new Error(`Bu əməliyyat üçün icazəniz yoxdur: ${prefix} yeniləmək.`);
            }

            const oldEntity = this.data[collectionKey]?.find(e => e.id === entityId);
            const updatedEntity = await this.ws.collection(this.collections[collectionKey]).upsert({ ...data, id: entityId });

            this.recordAuditLog('update', this.collections[collectionKey], entityId, { oldData: oldEntity || null, newData: updatedEntity });
            this._notifyEntityChange('update', collectionKey, updatedEntity, oldEntity, isSilent);

            if (collectionKey === 'reservations') {
                window.doorCardSystem?.handleReservationUpdate(updatedEntity, oldEntity || updatedEntity).catch(e => console.error('[DoorCard] update', e));
            }

            // We only refresh and re-render if the update is NOT silent (i.e., not a sub-operation like inventory adjustment)
            if (!isSilent) {
                await this.refreshData(collectionKey);
                if (this.currentModule === collectionKey) this.refreshCurrentModule();
            } else {
                // For silent updates, update the local memory cache directly 
                // to ensure subsequent local reads (like the final refreshData('inventory')) 
                // receive the correct temporary data.
                const index = this.data[collectionKey].findIndex(e => e.id === entityId);
                if (index !== -1) {
                    this.data[collectionKey][index] = updatedEntity;
                }
            }
            
            return updatedEntity;
        } catch (error) {
            this.notificationManager?.showNotification('error', `${prefix} Yeniləmə Xətası`, error.message);
            window.app.recordSystemError(`Update${prefix}Error`, error.message, error.stack, error.fileName, error.lineNumber, error.columnNumber);
            throw error;
        }
    }

    async _deleteEntity(collectionKey, entityId, prefix, confirmTitle, confirmMessage, isSilent = false) {
        try {
            // Determine the permission module name based on the collectionKey
            const permissionModule = this.permissionModuleMap[collectionKey] || collectionKey;

            // Permission check before showing confirmation
            if (!this.authManager.hasPermission(permissionModule, 'delete')) {
                this.notificationManager.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                return false;
            }

            if (await this.modalManager.confirmDelete(confirmTitle, confirmMessage)) {
                const entityToDelete = this.data[collectionKey]?.find(e => e.id === entityId);

                await this.ws.collection(this.collections[collectionKey]).delete(entityId);

                if (entityToDelete) {
                    this.recordAuditLog('delete', this.collections[collectionKey], entityId, { oldData: entityToDelete });
                    this._notifyEntityChange('delete', collectionKey, null, entityToDelete, isSilent);

                    if (collectionKey === 'reservations') {
                        window.doorCardSystem?.handleReservationDelete(entityToDelete).catch(e => console.error('[DoorCard] delete', e));
                    }
                }

                await this.refreshData(collectionKey);
                if (this.currentModule === collectionKey) this.refreshCurrentModule();
                this.notificationManager?.showNotification('success', 'Silindi', `${prefix} uğurla silindi.`);
                return true;
            }
            return false;
        } catch (error) {
            this.notificationManager?.showNotification('error', `${prefix} Silmə Xətası`, error.message);
            window.app.recordSystemError(`Delete${prefix}Error`, error.message, error.stack, error.fileName, error.lineNumber, error.columnNumber);
            throw error;
        }
    }

    /**
     * Generates a sequential, human-readable public ID (e.g., RZ-00001).
     * @param {string} collectionName - The name of the collection (e.g., 'reservations').
     * @returns {string} The new public ID.
     */
    generateSequentialPublicId(collectionName) {
        const prefixMap = {
            'guests': 'QN',
            'rooms': 'OT',
            'reservations': 'RZ',
            'services': 'XD',
            'inventory': 'AN',
            'staff': 'IS',
            'maintenance': 'TM',
            'cash_transactions': 'KS',
            'invoices': 'FQ',
            'pos_sales': 'PS',
            'purchase_documents': 'AS', // Fixed key to match collection name
            'system_errors': 'SR'
        };

        const prefix = prefixMap[collectionName] || 'ID';

        let collectionKey;
        for (const [key, value] of Object.entries(this.collections)) {
            if (value === collectionName) {
                collectionKey = key;
                break;
            }
        }

        if (!collectionKey || !this.data || !this.data[collectionKey]) {
            // Fallback if data is not loaded yet or collection doesn't exist in data map
            const count = 1;
            return `${prefix}-${String(count).padStart(5, '0')}`;
        }
        
        const collectionData = this.data[collectionKey];
        let maxNum = 0;
        if (Array.isArray(collectionData)) {
            for (const item of collectionData) {
                if (item && item.publicId) {
                    const parts = String(item.publicId).split('-');
                    if (parts.length > 1) {
                        const num = parseInt(parts[1], 10);
                        if (!isNaN(num) && num > maxNum) {
                            maxNum = num;
                        }
                    }
                }
            }
            if (maxNum === 0 && collectionData.length > 0) {
                maxNum = collectionData.length;
            }
        }
        const nextId = maxNum + 1;
        return `${prefix}-${String(nextId).padStart(5, '0')}`;
    }

    /**
     * Alias for generateSequentialPublicId for components using generatePrefixedId.
     */
    generatePrefixedId(collectionName) {
        return this.generateSequentialPublicId(collectionName);
    }

    /**
     * Formats a long internal UUID for display purposes when a publicId is not available.
     * @param {string} internalId - The UUID.
     * @param {string} prefix - The prefix for the entity (e.g., 'RZ', 'QN').
     * @returns {string} A formatted string like 'RZ-...A1B2C3'.
     */
    formatInternalId(internalId, prefix = 'ID') {
        if (!internalId || typeof internalId !== 'string') {
            return `${prefix}-...`;
        }
        // Use last 6 characters of the ID for a short, recognizable representation
        const shortId = internalId.slice(-6).toUpperCase();
        return `${prefix}-...${shortId}`;
    }

    _getChangeDetails(collectionKey, newData, oldData) {
        const details = {};
        const commonFields = {
            'guests': ['name', 'phone', 'email', 'passportNo', 'nationality', 'createdBy'],
            'reservations': ['guestId', 'roomId', 'checkIn', 'checkOut', 'status', 'totalAmount', 'adults', 'children', 'nights', 'source', 'createdBy'],
            'rooms': ['number', 'type', 'status', 'price', 'capacity', 'building', 'floor'],
            'services': ['name', 'price', 'status', 'serviceType', 'category'],
            'inventory': ['name', 'quantity', 'minQuantity', 'unit', 'purchasePrice', 'salePrice'],
            'staff': ['name', 'position', 'role', 'status', 'department', 'telegramId'],
            'maintenance': ['type', 'description', 'status', 'priority', 'assignedTo', 'roomId', 'createdBy'],
            'cashTransactions': ['category', 'amount', 'description', 'staffId', 'reservationId', 'accountId', 'date', 'time'],
            'invoices': ['guestName', 'totalAmount', 'reservationId', 'createdBy'],
            'posSales': ['totalAmount', 'paymentType', 'staffId', 'reservationId', 'items'],
            'purchaseDocuments': ['documentNumber', 'supplierName', 'totalAmount', 'staffId', 'purchaseDate', 'items']
        };
    
        const entity = newData || oldData;
        const fieldsToShow = commonFields[collectionKey] || ['name', 'id', 'publicId', 'description'];
    
        // Add public ID to the fields to display if it exists, but don't duplicate it if already named 'id'
        if (entity.publicId && !fieldsToShow.includes('publicId') && !fieldsToShow.includes('id')) {
            fieldsToShow.unshift('publicId');
        } else if (!entity.publicId && entity.id && !fieldsToShow.includes('id')) {
             fieldsToShow.unshift('id');
        }

        const accountMap = { 'main': 'Əsas (Nağd)', 'bank': 'Bank', 'pos': 'POS Terminal', 'paypal': 'PayPal' };
    
        fieldsToShow.forEach(field => {
            if (entity[field] !== undefined && field !== 'id' && field !== 'publicId') {
                let value = entity[field];
                let keyName = field.charAt(0).toUpperCase() + field.slice(1);

                if (field === 'guestId') {
                    value = this.data.guests.find(g => g.id === value)?.name || value;
                    keyName = 'Qonaq';
                }
                else if (field === 'roomId') {
                    value = this.data.rooms.find(r => r.id === value)?.number || value;
                    keyName = 'Otaq';
                }
                else if (field === 'status') {
                    value = window.statusHelper?.getReservationStatus?.(value) || window.statusHelper?.getMaintenanceStatus?.(value) || value;
                    keyName = 'Status';
                }
                else if (field.toLowerCase().includes('amount') || field.toLowerCase().includes('price') || field === 'salary') {
                    value = `₼${Number(value).toFixed(2)}`;
                }
                else if (field === 'createdBy' || field === 'staffId' || field === 'assignedTo') {
                    value = this.getStaffNameById(value);
                    keyName = field === 'createdBy' ? 'Yaradan' : (field === 'staffId' ? 'İcraçı' : 'Məsul');
                }
                else if (field === 'reservationId') {
                    const res = this.data.reservations.find(r => r.id === value);
                    value = res?.publicId || value;
                    keyName = 'Rezervasiya ID';
                }
                else if (field === 'accountId') {
                    value = accountMap[value] || value;
                    keyName = 'Hesab';
                }
                
                details[keyName] = value;
            }
        });

        // Add public ID explicitly if available
        if (entity.publicId) {
             details['Public ID'] = entity.publicId; 
        } else if (entity.id) {
             details['Internal ID'] = entity.id;
        }
    
        return details;
    }
    
    _notifyEntityChange(action, collectionKey, newData, oldData, isSilent = false) {
        if (isSilent) {
            console.log(`Silent notification for ${collectionKey} ${action}.`);
            return; // Skip notification if silent flag is true
        }
        
        // Suppress notification for normal workflow of occupied -> checkout
        if (
            action === 'update' &&
            collectionKey === 'reservations' &&
            oldData?.status === 'occupied' &&
            newData?.status === 'checkout'
        ) {
            const performedBy = this.authManager?.getCurrentUser()?.name || 'Sistem';
            if (performedBy === 'Sistem') {
                 console.log(`Suppressing automatic occupied->checkout notification.`);
                 return;
            }
        }

        const titleMap = {
            'create': { 'guests': 'Yeni Qonaq Əlavə Edildi', 'reservations': 'Yeni Rezervasiya Yaradıldı', 'default': 'Yeni Qeyd Yaradıldı' },
            'update': { 'guests': 'Qonaq Məlumatları Yeniləndiə', 'reservations': 'Rezervasiya Yeniləndi', 'default': 'Qeyd Yeniləndi' },
            'delete': { 'guests': 'Qonaq Silindi', 'reservations': 'Rezervasiya Ləğv Edildi', 'default': 'Qeyd Silindi' }
        };
        const typeMap = { 'create': 'success', 'update': 'info', 'delete': 'warning' };
    
        const entity = newData || oldData;
        const title = titleMap[action][collectionKey] || titleMap[action]['default'];
        const details = this._getChangeDetails(collectionKey, newData, oldData);
        details['ID'] = entity.publicId || entity.id;

        this.notificationManager.notifyAction({
            title: title,
            details: details,
            type: typeMap[action],
            sendToTelegramModule: this.collections[collectionKey], // e.g., 'reservations'
            performingStaffName: this.authManager?.getCurrentUser()?.name || 'Sistem'
        });
    }

    // Guest Methods
    async createGuest(data) {
        return await this._createEntity('guests', data, 'Qonaq');
    }
    async updateGuest(id, data) { return await this._updateEntity('guests', id, data, 'Qonaq'); }
    async deleteGuest(id) { 
        return await this._deleteEntity('guests', id, 'Qonaq', 'Bu qonağı və əlaqəli məlumatları silməyə əminsiniz?'); 
    }
    
    // Room Methods
    async createRoom(data) { return await this._createEntity('rooms', data, 'Otaq'); }
    async updateRoom(id, data) { return await this._updateEntity('rooms', id, data, 'Otaq'); }
    async deleteRoom(id) { 
        return await this._deleteEntity('rooms', id, 'Otaq', 'Bu otağı silməyə əminsiniz? Bu otaqla bağlı rezervasiyalar varsa, problem yarana bilər.'); 
    }

    // Reservation Methods
    async createReservation(data) { return await this._createEntity('reservations', data, 'Rezervasiya'); }
    async updateReservation(id, data, isSilent = false) { 
        // Add isSilent parameter to pass to _updateEntity
        return await this._updateEntity('reservations', id, data, 'Rezervasiya', isSilent); 
    }
    async deleteReservation(id) { 
        return await this._deleteEntity('reservations', id, 'Rezervasiya', 'Rezervasiyanı Sil', 'Bu rezervasiyanı silməyə əminsiniz?'); 
    }

    /**
     * NEW: Prompts for cancellation reason if necessary and updates reservation status.
     * @param {string} reservationId - The ID of the reservation to update.
     * @param {string} newStatus - The new status to set.
     */
    async promptChangeReservationStatus(reservationId, newStatus) {
        try {
            const reservation = this.data.reservations.find(r => r.id === reservationId);
            if (!reservation) {
                this.notificationManager.showNotification('error', 'Xəta', 'Rezervasiya tapılmadı.');
                return;
            }

            if (reservation.status === newStatus) {
                return; // No change needed
            }

            let updatedData = { ...reservation, status: newStatus };

            if (newStatus === 'cancelled') {
                const reason = await this.modalManager.showPromptModal(
                    'Rezervasiyanı Ləğv Et',
                    `"${reservation.publicId || reservation.id}" nömrəli rezervasiyanı ləğv etmək üçün səbəb daxil edin:`,
                    '',
                    'text'
                );

                if (reason === null) { // User cancelled the prompt
                    this.refreshCurrentModule(); // Re-render to revert select box change in UI
                    return;
                }
                updatedData.cancellationReason = reason || 'Səbəb göstərilməyib';

                // Send WhatsApp cancellation notification to guest
                try {
                    const guest = this.data.guests.find(g => g.id === reservation.guestId);
                    if (guest && guest.phone) {
                        const hotelInfo = this.getHotelInfo();
                        const hotelName = hotelInfo?.hotelName || 'Otel';
                        const cancelMsg = `Hörmətli ${guest.name}, ${hotelName} otelində #${reservation.publicId || reservation.id} nömrəli rezervasiyanız ləğv edildi.\n` +
                            `Səbəb: ${updatedData.cancellationReason}\n` +
                            `Əlavə suallarınız üçün bizimlə əlaqə saxlaya bilərsiniz: ${hotelInfo?.phone || ''}`;
                        window.sendWhatsAppNotification?.(guest.phone, cancelMsg);
                    }
                } catch (waErr) {
                    console.warn('Could not send WhatsApp cancellation notification:', waErr);
                }
            }

            await this.updateReservation(reservationId, updatedData);

            // The notification is already handled by _notifyEntityChange in _updateEntity
            // this.notificationManager.showNotification('success', 'Status Dəyişdirildi', `Rezervasiya statusu "${window.statusHelper.getReservationStatus(newStatus)}" olaraq dəyişdirildi.`);

        } catch (error) {
            console.error('Error changing reservation status:', error);
            this.notificationManager.showNotification('error', 'Xəta', `Status dəyişdirilərkən xəta baş verdi: ${error.message}`);
            this.refreshCurrentModule(); // Revert UI on error
        }
    }

    // Service Methods
    async createService(data) { return await this._createEntity('services', data, 'Xidmət'); }
    async updateService(id, data) { return await this._updateEntity('services', id, data, 'Xidmət'); }
    async deleteService(id) { 
        return await this._deleteEntity('services', id, 'Xidmət', 'Xidməti Sil', 'Bu xidməti silməyə əminsiniz?'); 
    }

    // Inventory Methods
    async createInventory(data) { return await this._createEntity('inventory', data, 'Məhsul'); }
    async updateInventory(id, data, isSilent = false) { return await this._updateEntity('inventory', id, data, 'Məhsul', isSilent); }
    async deleteInventoryItem(id) { 
        return await this._deleteEntity('inventory', id, 'Məhsul', 'Məhsulu Sil', 'Bu anbar məhsulunu silməyə əminsiniz?'); 
    }

    // Staff Methods
    async createStaff(data) {
        try {
            if (!this.authManager.hasPermission('staff', 'create')) {
                this.notificationManager.showNotification('error', 'İcazə Yoxdur', 'Bu əməliyyat üçün icazəniz yoxdur.');
                return null;
            }
            const { email, password, ...staffData } = data;

            // Local mode (websim / no Firebase): create the staff record directly.
            if (this.authManager.useLocalAuth) {
                const passwordHash = password ? await this.authManager._hashPassword(password) : undefined;
                const record = {
                    ...staffData,
                    id: staffData.id && !String(staffData.id).startsWith('IS-')
                        ? staffData.id
                        : ('st_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
                    publicId: this.generateSequentialPublicId('staff'),
                    createdAt: new Date().toISOString(),
                    createdBy: staffData.createdBy || this.authManager?.getCurrentUser()?.uid || null,
                    passwordHash,
                };
                const newStaff = await this.ws.collection('staff').create(record);
                this._notifyEntityChange('create', 'staff', newStaff, null);
                await this.refreshData('staff');
                if (this.currentModule === 'staff') this.refreshCurrentModule();
                return newStaff;
            }

            // First, create the user in Firebase Authentication
            const userCredential = await this.authManager.register(email, password, staffData.name);
            const user = userCredential.user;

            // Now create the staff record in Firestore with the UID from Firebase Auth
            staffData.id = user.uid; // Use Firebase UID as the primary ID
            staffData.firebaseUid = user.uid;
            staffData.publicId = this.generateSequentialPublicId('staff');
            staffData.createdAt = new Date().toISOString();

            const newStaff = await this.ws.collection('staff').create(staffData);
            this._notifyEntityChange('create', 'staff', newStaff, null);
            await this.refreshData('staff');
            if (this.currentModule === 'staff') this.refreshCurrentModule();
            
            return newStaff;
        } catch (error) {
            this.notificationManager?.showNotification('error', 'İşçi Yaratma Xətası', error.message);
            window.app.recordSystemError('CreateStaffError', error.message, error.stack, error.fileName, error.lineNumber, error.columnNumber);
            throw error;
        }
    }
    async updateStaff(id, data) { return await this._updateEntity('staff', id, data, 'İşçi'); }
    async deleteStaff(id) { 
        return await this._deleteEntity('staff', id, 'İşçi', 'Bu işçini silməyə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.'); 
    }

    // Maintenance Methods
    async createMaintenance(data) { return await this._createEntity('maintenance', data, 'Tapşırıq'); }
    async updateMaintenance(id, data) { return await this._updateEntity('maintenance', id, data, 'Tapşırıq'); }
    async deleteMaintenance(id) { 
        return await this._deleteEntity('maintenance', id, 'Tapşırıq', 'Tapşırığı Sil', 'Bu təmir/təmizlik tapşırığını silməyə əminsiniz?'); 
    }
    
    // Cash Transaction Methods
    async createCashTransaction(data) { return await this._createEntity('cashTransactions', data, 'Kassa Əməliyyatı'); }
    async updateCashTransaction(id, data) { return await this._updateEntity('cashTransactions', id, data, 'Kassa Əməliyyatı'); }
    async deleteCashTransaction(id) { 
        return await this._deleteEntity('cashTransactions', id, 'Kassa əməliyyatı', 'Kassa Əməliyyatını Sil', 'Bu kassa əməliyyatını silməyə əminsiniz?'); 
    }

    // Invoice Methods
    async createInvoice(data) { return await this._createEntity('invoices', data, 'Faktura'); }
    async deleteInvoice(id) { 
        return await this._deleteEntity('invoices', id, 'Faktura', 'Fakturanı Sil', 'Bu fakturanı silməyə əminsiniz?'); 
    }
    
    async generateInvoiceForReservation(reservationId) {
        try {
            if (!this.authManager.hasPermission('invoices', 'create')) {
                this.notificationManager.showNotification('error', 'İcazə Yoxdur', 'Faktura yaratmaq üçün icazəniz yoxdur.');
                return;
            }
            let invoice = this.data.invoices.find(inv => inv.reservationId === reservationId);

            if (invoice) {
                this.notificationManager?.showNotification('info', 'Faktura Mövcuddur', `Bu rezervasiya üçün faktura artıq yaradılıb (ID: ${invoice.publicId || invoice.id}).`, 3000);
            } else {
                const reservation = this.data.reservations.find(res => res.id === reservationId);
                if (!reservation) throw new Error('Rezervasiya tapılmadı.');

                const guest = this.data.guests.find(g => g.id === reservation.guestId);
                const room = this.data.rooms.find(r => r.id === reservation.roomId);
                const financialSummary = this.getReservationFinancialSummary(reservationId);

                const invoiceData = {
                    reservationId: reservation.id,
                    guestName: guest?.name || 'N/A',
                    roomNumber: room?.number || 'N/A',
                    totalAmount: financialSummary.totalAmountDue,
                    // createdBy and createdAt will be set by _createEntity
                };

                invoice = await this.createInvoice(invoiceData);
                this.notificationManager?.showNotification('success', 'Faktura Yaradıldı', `Yeni faktura yaradıldı (ID: ${invoice.publicId || invoice.id}).`);
            }

            // After creating or finding, print it.
            this.printInvoice(invoice.id);

        } catch (error) {
            console.error('Error generating invoice for reservation:', error);
            this.notificationManager?.showNotification('error', 'Faktura Xətası', `Faktura yaradıla bilmədi: ${error.message}`);
        }
    }

    printInvoice(invoiceId) {
        const invoice = this.data.invoices.find(inv => inv.id === invoiceId);
        if (!invoice) {
            this.notificationManager?.showNotification('error', 'Xəta', 'Faktura tapılmadı.');
            return;
        }

        const reservation = this.data.reservations.find(res => res.id === invoice.reservationId);
        if (!reservation) {
            this.notificationManager?.showNotification('error', 'Xəta', 'Fakturaya bağlı rezervasiya tapılmadı.');
            return;
        }

        const guest = this.data.guests.find(g => g.id === reservation.guestId);
        const room = this.data.rooms.find(r => r.id === reservation.roomId);
        const financialSummary = this.getReservationFinancialSummary(reservation.id);
        const hotelInfo = this.getHotelInfo();

        const items = [];
        // Room charge
        items.push({
            description: `Otaq ${room?.number || ''} (${this.formatDate(reservation.checkIn)} - ${this.formatDate(reservation.checkOut)})`,
            quantity: reservation.nights,
            unit: 'gecə',
            unitPrice: (reservation.roomTotal / (reservation.nights || 1)),
            total: reservation.roomTotal
        });

        // Services
        (reservation.selectedServices || []).forEach(serviceId => {
            const service = this.data.services.find(s => s.id === serviceId);
            if (service) {
                const quantity = service.serviceType === 'daily' ? reservation.nights : 1;
                const unit = service.serviceType === 'daily' ? 'gün' : 'ədəd';
                const total = service.price * quantity;
                items.push({
                    description: service.name,
                    quantity: quantity,
                    unit: unit,
                    unitPrice: service.price,
                    total: total
                });
            }
        });

        // POS Sales
        const posSales = this.data.posSales.filter(sale => sale.reservationId === reservation.id);
        posSales.forEach(sale => {
             sale.items.forEach(item => {
                items.push({
                    description: `POS: ${item.name}`,
                    quantity: item.quantity,
                    unit: item.unit || 'ədəd',
                    unitPrice: item.price,
                    total: item.price * item.quantity
                });
             });
        });

        const itemsHtml = items.map(item => `
            <tr>
                <td>${item.description}</td>
                <td class="text-center">${item.quantity} ${item.unit}</td>
                <td class="text-right">₼${item.unitPrice.toFixed(2)}</td>
                <td class="text-right">₼${item.total.toFixed(2)}</td>
            </tr>
        `).join('');

        const subtotal = financialSummary.totalAmountDue + financialSummary.actualDiscountAmount;
        
        // Tax Calculation
        const taxEnabled = hotelInfo.taxEnabled === true;
        const taxRate = hotelInfo.taxRate || 0;
        let taxAmount = 0;
        let totalWithTax = financialSummary.totalAmountDue;
        if (taxEnabled && taxRate > 0) {
            taxAmount = financialSummary.totalAmountDue * (taxRate / 100);
            totalWithTax += taxAmount;
        }

        const finalBalanceDue = totalWithTax - financialSummary.totalPaid;

        const paymentsHtml = (financialSummary.payments || []).map(p => `
            <tr>
                <td>${this.formatDate(p.date, true)}</td>
                <td>${p.category}</td>
                <td>${p.description}</td>
                <td class="text-right">₼${p.amount.toFixed(2)}</td>
            </tr>
        `).join('');
        
        const printHTML = `
            <!DOCTYPE html>
            <html lang="az">
            <head>
                <meta charset="UTF-8">
                <title>Faktura #${invoice.publicId}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; background-color: #f9fafb; color: #1f2937; -webkit-print-color-adjust: exact; }
                    .invoice-container { max-width: 800px; margin: auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
                    .hotel-info .logo { max-width: 150px; margin-bottom: 10px; }
                    .hotel-info h2 { margin: 0; font-size: 24px; color: #111827; }
                    .hotel-info p { margin: 2px 0; font-size: 12px; color: #4b5563; }
                    .invoice-details { text-align: right; }
                    .invoice-details h1 { margin: 0; font-size: 28px; color: #3b82f6; }
                    .invoice-details p { margin: 2px 0; font-size: 12px; color: #4b5563; }
                    .bill-info { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 13px; }
                    .bill-info div { flex-basis: 48%; }
                    .bill-info h3 { font-size: 14px; color: #4b5563; margin-top: 0; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
                    .bill-info p { margin: 2px 0; }
                    .reservation-summary { background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin-bottom: 30px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; font-size: 13px; }
                    .summary-item strong { color: #111827; }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    table th, table td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
                    table th { background-color: #f9fafb; font-weight: 500; color: #4b5563; text-transform: uppercase; font-size: 11px; }
                    .items-table tbody tr:last-child td { border-bottom: none; }
                    .financial-summary { display: flex; justify-content: flex-end; margin-top: 20px; }
                    .financial-summary table { width: 45%; max-width: 350px; }
                    .financial-summary td { padding: 8px 10px; }
                    .financial-summary tr.balance-due td { font-size: 16px; font-weight: 700; background-color: #eef2ff; color: #3b82f6; border-top: 2px solid #3b82f6; }
                    .payment-history { margin-top: 30px; }
                    .payment-history h3 { font-size: 16px; margin-bottom: 10px; }
                    footer { margin-top: 40px; text-align: center; font-size: 12px; color: #6b717f; }
                    .footer-seal { max-height: 80px; margin-top: 10px; opacity: 0.8; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .positive { color: #10b981; }
                    .negative { color: #ef4444; }
                    .no-print { text-align: center; margin-top: 20px; }
                    @media print {
                        body { background-color: #fff; padding: 0; }
                        .invoice-container { box-shadow: none; border-radius: 0; padding: 20px 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    <header>
                        <div class="hotel-info">
                            ${hotelInfo.logoUrl ? `<img src="${hotelInfo.logoUrl}" alt="Hotel Logo" class="logo">` : `<h2>${hotelInfo.hotelName}</h2>`}
                            <p>${hotelInfo.address}</p>
                            <p>${hotelInfo.phone} | ${hotelInfo.email}</p>
                        </div>
                        <div class="invoice-details">
                            <h1>FAKTURA</h1>
                            <p><strong>Faktura №:</strong> ${invoice.publicId}</p>
                            <p><strong>Tarix:</strong> ${this.formatDate(invoice.createdAt)}</p>
                            <p><strong>Rezervasiya №:</strong> ${reservation.publicId}</p>
                        </div>
                    </header>
                    <main>
                        <section class="bill-info">
                            <div>
                                <h3>OTEL MƏLUMATLARI</h3>
                                <p><strong>${hotelInfo.hotelName}</strong></p>
                                <p>${hotelInfo.address}</p>
                                <p>${hotelInfo.phone}</p>
                                <p>${hotelInfo.email}</p>
                            </div>
                            <div>
                                <h3>QONAQ MƏLUMATLARI</h3>
                                <p><strong>${guest?.name || 'N/A'}</strong></p>
                                <p>${guest?.address || 'N/A'}</p>
                                <p>${guest?.phone || 'N/A'}</p>
                                <p>${guest?.email || 'N/A'}</p>
                            </div>
                        </section>
                        <section class="reservation-summary">
                            <div class="summary-item"><strong>Giriş:</strong> ${this.formatDate(reservation.checkIn)}</div>
                            <div class="summary-item"><strong>Çıxış:</strong> ${this.formatDate(reservation.checkOut)}</div>
                            <div class="summary-item"><strong>Gecə:</strong> ${reservation.nights}</div>
                            <div class="summary-item"><strong>Otaq:</strong> ${room?.number || 'N/A'} (${room?.type || 'N/A'})</div>
                        </section>
                        <section class="items-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Təsvir</th>
                                        <th class="text-center">Miqdar/Vahid</th>
                                        <th class="text-right">Vahid Qiyməti</th>
                                        <th class="text-right">Cəmi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                            </table>
                        </section>
                        <section class="financial-summary">
                            <table>
                                <tbody>
                                    <tr>
                                        <td>Ara Cəm:</td>
                                        <td class="text-right">₼${subtotal.toFixed(2)}</td>
                                    </tr>
                                    ${financialSummary.actualDiscountAmount > 0 ? `
                                    <tr>
                                        <td>Endirim:</td>
                                        <td class="text-right negative">- ₼${financialSummary.actualDiscountAmount.toFixed(2)}</td>
                                    </tr>
                                    ` : ''}
                                    ${taxEnabled && taxRate > 0 ? `
                                    <tr>
                                        <td>Vergi (${taxRate}%):</td>
                                        <td class="text-right">₼${taxAmount.toFixed(2)}</td>
                                    </tr>
                                    ` : ''}
                                    <tr style="font-weight: bold; border-top: 1px solid #e5e7eb;">
                                        <td>Yekun Məbləğ:</td>
                                        <td class="text-right">₼${totalWithTax.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td>Ödənilib:</td>
                                        <td class="text-right positive">- ₼${financialSummary.totalPaid.toFixed(2)}</td>
                                    </tr>
                                    <tr class="balance-due">
                                        <td>Qalıq Borc:</td>
                                        <td class="text-right">₼${finalBalanceDue.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </section>
                        ${financialSummary.payments.length > 0 ? `
                        <section class="payment-history">
                            <h3>Ödəniş Tarixçəsi</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Tarix</th>
                                        <th>Növ</th>
                                        <th>Təsvir</th>
                                        <th class="text-right">Məbləğ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${paymentsHtml}
                                </tbody>
                            </table>
                        </section>
                        ` : ''}
                    </main>
                    <footer>
                        <p>Fakturanız üçün təşəkkür edirik. Yenidən görüşənədək!</p>
                        ${hotelInfo.sealUrl ? `<img src="${hotelInfo.sealUrl}" alt="Hotel Seal" class="footer-seal">` : ''}
                    </footer>
                </div>
                <div class="no-print">
                    <button onclick="window.print()">Çap et</button>
                    <button onclick="window.close()">Bağla</button>
                </div>
                <script>window.onload = () => { setTimeout(() => window.print(), 500); }</script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        if (!win) {
            this.notificationManager?.showNotification('warning', 'Pəncərə Bloklandı', 'Zəhmət olmasa, çap üçün brauzerdə popup pəncərələrə icazə verin.');
            return;
        }
        win.document.write(printHTML);
        win.document.close();
    }

    printPOSReceipt(saleId) {
        const sale = this.data.posSales.find(s => s.id === saleId);
        if (!sale) {
            this.notificationManager?.showNotification('error', 'Xəta', 'Satış tapılmadı.');
            return;
        }

        const paymentLabels = { cash: 'Nağd', card: 'Kart', paypal: 'PayPal', account: 'Hesab' };
        const hotelInfo = this.getHotelInfo();
        const staff = this.data.staff.find(s => s.id === sale.staffId);
        const reservation = sale.reservationId ? this.data.reservations.find(r => r.id === sale.reservationId) : null;
        const displayId = sale.publicId || this.formatInternalId(sale.id, 'PS');

        const itemsHtml = (sale.items || []).map(item => `
            <tr>
                <td>${item.name}</td>
                <td class="text-center">${item.quantity} ${item.unit || 'ədəd'}</td>
                <td class="text-right">₼${(item.price || 0).toFixed(2)}</td>
                <td class="text-right">₼${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
            </tr>
        `).join('');

        const taxEnabled = hotelInfo.taxEnabled === true;
        const taxRate = hotelInfo.taxRate || 0;
        let taxAmount = 0;
        let totalWithTax = sale.totalAmount || 0;
        if (taxEnabled && taxRate > 0) {
            taxAmount = totalWithTax * (taxRate / 100);
            totalWithTax += taxAmount;
        }

        const printHTML = `
            <!DOCTYPE html>
            <html lang="az">
            <head>
                <meta charset="UTF-8">
                <title>POS Qəbzi #${displayId}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; background-color: #f9fafb; color: #1f2937; -webkit-print-color-adjust: exact; }
                    .receipt { max-width: 340px; margin: auto; background: white; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .header { text-align: center; border-bottom: 1px dashed #e5e7eb; padding-bottom: 12px; margin-bottom: 12px; }
                    .header .logo { max-width: 120px; margin-bottom: 8px; }
                    .header h2 { margin: 0; font-size: 18px; color: #111827; }
                    .header p { margin: 2px 0; font-size: 11px; color: #4b5563; }
                    .meta { font-size: 11px; color: #4b5563; margin-bottom: 12px; }
                    .meta div { display: flex; justify-content: space-between; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
                    table th, table td { padding: 6px 2px; text-align: left; border-bottom: 1px dotted #e5e7eb; }
                    table th { font-weight: 500; color: #4b5563; height : 0; text-transform: uppercase; font-size: 10px; }
                    tfoot td { border-bottom: none; padding-top: 4px; }
                    .total-row td { font-size: 14px; font-weight: 700; border-top: 1px solid #111827; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .footer { text-align: center; font-size: 10px; color: #6b717f; margin-top: 12px; border-top: 1px dashed #e5e7eb; padding-top: 10px; }
                    .no-print { text-align: center; margin-top: 16px; }
                    @media print {
                        body { background-color: #fff; padding: 0; }
                        .receipt { box-shadow: none; border-radius: 0; padding: 8px; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="header">
                        ${hotelInfo.logoUrl ? `<img src="${hotelInfo.logoUrl}" alt="Hotel Logo" class="logo">` : `<h2>${hotelInfo.hotelName || 'Otel'}</h2>`}
                        <p>${hotelInfo.address || ''}</p>
                        <p>${hotelInfo.phone || ''} ${hotelInfo.email ? '| ' + hotelInfo.email : ''}</p>
                    </div>
                    <div class="meta">
                        <div><span>Qəbz №:</span><span><strong>${displayId}</strong></span></div>
                        <div><span>Tarix:</span><span>${this.formatDate(sale.createdAt, true)}</span></div>
                        <div><span>Ödəniş:</span><span>${paymentLabels[sale.paymentType] || sale.paymentType}</span></div>
                        ${reservation ? `<div><span>Rezervasiya:</span><span>${reservation.publicId || reservation.id}</span></div>` : ''}
                        ${staff ? `<div><span>İcraçı:</span><span>${staff.name}</span></div>` : ''}
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Məhsul</th>
                                <th class="text-center">Say</th>
                                <th class="text-right">Qiymət</th>
                                <th class="text-right">Cəmi</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                        <tfoot>
                            <tr><td colspan="4"></td></tr>
                            <tr class="total-row"><td colspan="3">Yekun</td><td class="text-right">₼${sale.totalAmount.toFixed(2)}</td></tr>
                            ${taxEnabled && taxRate > 0 ? `<tr><td colspan="3">Vergi (${taxRate}%)</td><td class="text-right">₼${taxAmount.toFixed(2)}</td></tr>
                            <tr class="total-row"><td colspan="3">Ümumi</td><td class="text-right">₼${totalWithTax.toFixed(2)}</td></tr>` : ''}
                        </tfoot>
                    </table>
                    <div class="footer">
                        <p>Alış-veriş üçün təşəkkür edirik!</p>
                        ${hotelInfo.sealUrl ? `<img src="${hotelInfo.sealUrl}" alt="Hotel Seal" class="footer-seal" style="max-height:60px; margin-top:6px; opacity:0.8;">` : ''}
                    </div>
                    <div class="no-print">
                        <button onclick="window.print()">Çap et</button>
                        <button onclick="window.close()">Bağla</button>
                    </div>
                </div>
                <script>window.onload = () => { setTimeout(() => window.print(), 500); }</script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(printHTML);
        win.document.close();
    }

    // Purchase Document Methods
    async createPurchaseDocument(data) { 
        // Step 1: Create the purchase document entry
        const newDoc = await this._createEntity('purchaseDocuments', data, 'Alış Sənədi');
        
        // Step 2: Update inventory quantities (Mədaxil)
        // Ensure this happens after the purchase document itself is created, as the audit log uses the newDoc ID.
        if (newDoc && Array.isArray(newDoc.items) && newDoc.items.length > 0) {
            await this._adjustInventoryStock(newDoc.items, 'increase');
        }
        
        // Step 3: Update local inventory data cache after stock movement
        // REMOVED: refreshData('inventory') causes stale data overwrite from server before sync completes. 
        // The local cache is already updated by _adjustInventoryStock via _updateEntity(silent=true).
        // await this.refreshData('inventory');

        // Re-render required modules: Inventory and Dashboard (for alerts)
        if (this.currentModule === 'inventory' || this.currentModule === 'dashboard') {
            this.loadModule(this.currentModule);
        }

        return newDoc;
    }

    async updatePurchaseDocument(id, data) {
        // NEW LOGIC: Only update the document data and associated notifications. No automatic inventory reversal/adjustment on *edit*.
        // This prevents double-counting or complex rollback logic.
        return await this._updateEntity('purchaseDocuments', id, data, 'Alış Sənədi');
    }
    
    async deletePurchaseDocument(id) { 
        const docToDelete = this.data.purchaseDocuments?.find(d => d.id === id);
        const hasItems = docToDelete && (docToDelete.items || []).length > 0;
        const confirmMessage = hasItems
            ? 'Bu alış sənədini silməyə əminsiniz? Sənəddəki məhsulların anbardan çıxarılması avtomatik aparılmayacaq (əl ilə düzəliş tələb olunur).'
            : 'Bu alış sənədini silməyə əminsiniz?';

        return await this._deleteEntity('purchaseDocuments', id, 'Alış Sənədi', 'Alış Sənədini Sil', confirmMessage); 
    }

    /**
     * Internal function to increase or decrease inventory based on a list of purchased items.
     * @param {Array} items - Array of { inventoryId, quantity, unitPrice }
     * @param {'increase'|'decrease'} direction
     */
    async _adjustInventoryStock(items, direction) {
        console.log(`[Inventory] Adjusting stock: ${direction}`, items);
        
        const inventoryUpdates = items
            .filter(i => i.inventoryId && i.inventoryId !== 'custom') // Only update items linked to inventory
            .map(async item => {
                const targetId = String(item.inventoryId).trim();
                
                // 1. Try to find in local memory cache first
                let currentInventory = this.data.inventory.find(i => i.id === targetId);
                
                // 2. If not found or to ensure freshness, try getting from local DB
                if (!currentInventory) {
                    try {
                         currentInventory = await this.ws.collection('inventory').get(targetId);
                    } catch(e) {
                        console.warn(`[Inventory] Failed to retrieve item ${targetId} from local DB.`, e);
                    }
                }

                if (!currentInventory) {
                    console.warn(`[Inventory] Item ID ${targetId} not found. Skipping stock adjustment.`);
                    return;
                }

                const quantityChange = Number(item.quantity) || 0;
                let oldQuantity = Number(currentInventory.quantity || 0);
                let oldPurchasePrice = Number(currentInventory.purchasePrice || 0);
                let newPurchasePrice = Number(item.unitPrice || 0);

                let newQuantity = oldQuantity;
                let updatedPurchasePrice = oldPurchasePrice; 

                if (direction === 'increase') {
                    newQuantity = oldQuantity + quantityChange;

                    // Calculate Weighted Average Cost (WAC)
                    // Formula: ((Old Qty * Old Price) + (New Qty * New Price)) / Total Qty
                    if (newQuantity > 0 && quantityChange > 0) {
                        const totalOldValue = oldQuantity * oldPurchasePrice;
                        const totalNewValue = quantityChange * newPurchasePrice;
                        updatedPurchasePrice = (totalOldValue + totalNewValue) / newQuantity;
                    } else if (newQuantity === 0) {
                        updatedPurchasePrice = 0; // Reset if stock hits 0 (though unlikely on increase)
                    }
                    // If quantityChange is 0, price doesn't change.

                } else if (direction === 'decrease') {
                    newQuantity = oldQuantity - quantityChange;
                    // Purchase price remains the same when decreasing stock (sale)
                    // Unless new quantity is 0? No, keep last known cost.
                }
                
                if (newQuantity < 0) {
                     console.warn(`[Inventory] Negative stock detected for ${currentInventory.name}. Clamping to 0.`);
                     newQuantity = 0;
                }
                
                // Rounding removed for quantity, keep purchasePrice to 2 decimals
                // PATCH: Removed toFixed(4) for quantity calculation to maintain float precision.
                updatedPurchasePrice = Number(updatedPurchasePrice.toFixed(2));

                const updatedInventoryData = {
                    ...currentInventory,
                    quantity: newQuantity,
                    purchasePrice: updatedPurchasePrice
                };

                // CRITICAL DEBUG: Log before update to confirm calculated quantity
                console.log(`[Inventory] DEBUG UPDATE: ${currentInventory.name} (ID: ${currentInventory.id}). Old Qty: ${oldQuantity}, Change: ${quantityChange}, New Qty Calculated: ${newQuantity}, New Price: ${updatedPurchasePrice}`);

                // Use _updateEntity with isSilent=true.
                // This updates Local DB + Sync Queue + this.data.inventory (memory).
                // It DOES NOT trigger a server fetch, preventing race conditions.
                await this._updateEntity('inventory', currentInventory.id, updatedInventoryData, 'Məhsul', true, true);
            });

        await Promise.all(inventoryUpdates);
        
        // Force a UI refresh of the active module if it depends on inventory data (like POS or Inventory)
        // This ensures the user sees the new stock immediately without waiting for a sync round-trip.
        if (this.currentModule === 'inventory' || this.currentModule === 'pos') {
            if (window.inventoryComponent) window.inventoryComponent.render(this.data);
            if (window.posComponent) window.posComponent.render(this.data); // Re-render POS to update stock display
        }
    }

    // POS Sale Methods
    async createPOSSale(data) { return await this._createEntity('posSales', data, 'POS Satış'); }
    async deletePOSSale(id) { 
        return await this._deleteEntity('posSales', id, 'POS Satış', 'Satışı Sil', 'Bu satışı silməyə əminsiniz? Anbar qalığı bərpa olunmayacaq.'); 
    }

    /**
     * Processes a POS sale, creating sale and cash transaction records, and adjusting inventory.
     * @param {Array} cartItems - [{ id: inventoryId, name, price, quantity, unit }]
     * @param {number} total - Total sale amount.
     * @param {object} paymentDetails - { paymentType, accountId, reservationId, staffId }
     */
    async processPOSSale(cartItems, total, paymentDetails) {
        try {
            const { paymentType, accountId, reservationId, staffId, receivedAmount } = paymentDetails;
            
            // 1. Create the POS Sale record
            const posSaleData = {
                items: cartItems.map(item => ({ 
                    id: item.id, // Inventory ID
                    name: item.name, 
                    quantity: item.quantity, 
                    price: item.price, 
                    unit: item.unit 
                })),
                totalAmount: total,
                paymentType: paymentType,
                reservationId: reservationId,
                staffId: staffId,
            };
            const newPosSale = await this.createPOSSale(posSaleData);
            
            // 2. Create Cash Transaction (if not an account charge)
            if (paymentType !== 'account') {
                const cashData = {
                    type: 'income',
                    category: 'POS satış',
                    amount: receivedAmount || total,
                    description: `POS Satış (${paymentType}): #${newPosSale.publicId || newPosSale.id}`,
                    date: this.getTodayDateString(),
                    time: new Date().toTimeString().slice(0, 5),
                    staffId: staffId,
                    posSaleId: newPosSale.id,
                    accountId: paymentType === 'card' ? 'pos' : (paymentType === 'paypal' ? 'paypal' : 'main'), // Default to pos/paypal/main
                };
                await this.createCashTransaction(cashData);
            }
            
            // 3. Update Inventory (DECREASE)
            if (cartItems && cartItems.length > 0) {
                const inventoryUpdates = cartItems.map(item => ({
                    inventoryId: item.id,
                    quantity: item.quantity,
                }));
                await this._adjustInventoryStock(inventoryUpdates, 'decrease');
            }
            
            // 4. Refresh cash and pos sales to show new records.
            // IMPORTANT: Do NOT refresh inventory here. _adjustInventoryStock handles it silently/optimistically.
            await this.refreshData('cash_transactions');
            await this.refreshData('pos_sales');
            
            // 5. Refresh inventory data and related modules after stock adjustment (DECREASE)
            // REMOVED: refreshData('inventory') causes stale data overwrite.
            // await this.refreshData('inventory');
            
            if (this.currentModule === 'inventory' || this.currentModule === 'dashboard' || this.currentModule === 'pos') {
                 this.loadModule(this.currentModule);
            }
            
            return newPosSale;

        } catch (error) {
            this.notificationManager?.showNotification('error', `POS Satış Xətası`, error.message);
            window.app.recordSystemError(`ProcessPOSSaleError`, error.message, error.stack, error.fileName, error.lineNumber, error.columnNumber);
            throw error;
        }
    }

    /**
     * NEW: Toggles the `isSuperadmin` status for a staff member. Only a superadmin can do this.
     * @param {string} staffId - The ID of the staff member to modify.
     * @param {boolean} isSuperadmin - The new superadmin status.
     */
    async toggleSuperadminStatus(staffId, isSuperadmin) {
        if (!this.isSuperadmin()) {
            this.notificationManager.showNotification('error', 'İcazə Yoxdur', 'Yalnız Superadmin bu əməliyyatı edə bilər.');
            this.refreshCurrentModule(); // Revert UI change
            return;
        }
        const staff = this.data.staff.find(s => s.id === staffId);
        if (staff) {
            if (staff.isSuperadmin && !isSuperadmin) {
                const superadmins = this.data.staff.filter(s => s.isSuperadmin);
                if (superadmins.length <= 1) {
                    this.notificationManager.showNotification('error', 'Əməliyyat Mümkün Deyil', 'Sistemdə ən az bir superadmin qalmalıdır. Superadmin statusunu silmək mümkün deyil.');
                    this.refreshCurrentModule();
                    return;
                }
            }
            await this.updateStaff(staffId, { ...staff, isSuperadmin });
            this.notificationManager.showNotification('success', 'Uğurlu', `${staff.name} üçün Superadmin statusu ${isSuperadmin ? 'aktiv' : 'deaktiv'} edildiə.`);
        }
    }

    /**
     * NEW: Changes a user's active/inactive status.
     * @param {string} staffId - The ID of the staff member to modify.
     * @param {string} status - The new status ('active' or 'inactive').
     */
    async changeUserStatus(staffId, status) {
        if (!this.isSuperadmin() && this.authManager.currentUser.role !== 'admin') {
            this.notificationManager.showNotification('error', 'İcazə Yoxdur', 'Yalnız Admin və ya Superadmin bu əməliyyatı edə bilər.');
            this.refreshCurrentModule(); // Revert UI change
            return;
        }
        const staff = this.data.staff.find(s => s.id === staffId);
        if (staff) {
            if (staff.isSuperadmin && !this.isSuperadmin()) {
                this.notificationManager.showNotification('error', 'İcazə Yoxdur', 'Superadminin statusunu dəyişə bilməzsiniz.');
                this.refreshCurrentModule(); // revert select change
                return;
            }
            await this.updateStaff(staffId, { ...staff, status });
            this.notificationManager.showNotification('success', 'Uğurlu', `${staff.name} statusu ${status === 'active' ? 'aktiv' : 'deaktiv'} edildi.`);
        }
    }

    /**
     * NEW: Clears all local data from IndexedDB and relevant localStorage items.
     */
    async clearLocalData() {
        if (!this.isSuperadmin()) {
            this.notificationManager.showNotification('error', 'İcazə Yoxdur', 'Yalnız Superadmin bu əməliyyatı edə bilər.');
            return;
        }
        const confirmed = await this.modalManager.confirmDelete('Lokal Məlumatları Sil', 'Bütün lokal məlumatları silmək istədiyinizə əminsiniz? Bu əməliyyat server məlumatlarına təsir etməyəcək və səhifə yenilənəcək.');
        if (confirmed) {
            await this.ws.clearAllLocalData();
            this.notificationManager.showNotification('success', 'Təmizləndi', 'Bütün lokal məlumatlar silindi. Səhifə yenilənir...');
            setTimeout(() => window.location.reload(), 2000);
        }
    }

    /**
     * NEW: Gets a list of superadmin users.
     * @returns {Array} An array of staff objects who are superadmins.
     */
    getSuperadminList() {
        return this.data.staff.filter(s => s.isSuperadmin);
    }
    
    /**
     * NEW: Calculates the total amount paid for a specific purchase document.
     * @param {string} purchaseDocumentId - The ID of the purchase document.
     * @returns {number} The total amount paid.
     */
    getPaidForPurchaseDocument(purchaseDocumentId) {
        if (!this.data || !this.data.cashTransactions) {
            return 0;
        }
        return this.data.cashTransactions
            .filter(tx => tx.purchaseDocumentId === purchaseDocumentId && tx.type === 'expense')
            .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    }

    /**
     * NEW: Calculates a comprehensive financial summary for a given reservation.
     * @param {string} reservationId - The ID of the reservation.
     * @returns {object} An object containing totalAmountDue, totalPaid, remainingBalance, etc.
     */
    getReservationFinancialSummary(reservationId) {
        const result = {
            totalAmountDue: 0,
            totalPaid: 0,
            remainingBalance: 0,
            posSalesAmount: 0,
            actualDiscountAmount: 0,
            payments: [],
            discountType: 'fixed',
            discountValue: 0
        };

        if (!this.data || !this.data.reservations) {
            return result;
        }

        const reservation = this.data.reservations.find(r => r.id === reservationId);
        if (!reservation) {
            return result;
        }

        const roomTotal = reservation.roomTotal || 0;
        const servicesTotal = reservation.servicesTotal || 0;

        // Calculate POS sales linked to the reservation
        const posSalesAmount = (this.data.posSales || [])
            .filter(sale => sale.reservationId === reservationId)
            .reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
        result.posSalesAmount = posSalesAmount;

        const subtotal = roomTotal + servicesTotal + posSalesAmount;

        // Calculate discount amount
        const discountValue = reservation.discountValue || 0;
        const discountType = reservation.discountType || 'fixed';
        result.discountType = discountType;
        result.discountValue = discountValue;

        if (discountValue > 0) {
            if (discountType === 'percent') {
                // Discount is typically applied to room and services, not POS sales
                result.actualDiscountAmount = (roomTotal + servicesTotal) * (discountValue / 100);
            } else {
                result.actualDiscountAmount = discountValue;
            }
        }

        result.totalAmountDue = subtotal - result.actualDiscountAmount;

        // Calculate total paid from cash transactions
        const payments = (this.data.cashTransactions || [])
            .filter(tx => tx.reservationId === reservationId && tx.type === 'income');
        result.payments = payments;

        result.totalPaid = payments.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        
        result.remainingBalance = result.totalAmountDue - result.totalPaid;

        return result;
    }

    formatDate(dateString, includeTime = false) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
            if (includeTime) {
                options.hour = '2-digit';
                options.minute = '2-digit';
            }
            return date.toLocaleDateString('az-AZ', options);
        } catch (e) {
            return dateString;
        }
    }

    /**
     * Calculates the number of nights between two dates.
     * Uses UTC normalization to avoid timezone issues.
     * @param {string} checkIn - YYYY-MM-DD
     * @param {string} checkOut - YYYY-MM-DD
     * @returns {number}
     */
    calculateNights(checkIn, checkOut) {
        if (!checkIn || !checkOut) return 0;
        
        // Parse dates as UTC midnight
        const parseAsUTC = (dateStr) => {
            const parts = dateStr.split('T')[0].split('-');
            if (parts.length !== 3) return null;
            return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        };

        const start = parseAsUTC(checkIn);
        const end = parseAsUTC(checkOut);

        if (!start || !end) return 0;

        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays > 0 ? diffDays : 0;
    }

    /**
     * Checks if the current user is a superadmin.
     * @returns {boolean}
     */
    isSuperadmin() {
        return this.authManager?.getCurrentUser()?.isSuperadmin === true;
    }

    // Other app-specific methods like getHotelInfo, getSetting, saveSetting, etc.
    getHotelInfo() {
        return this.getSetting('hotelInfo') || {};
    }

    getSetting(key) {
        const setting = this.data.settings.find(s => s.key === key);
        return setting ? setting.value : null;
    }

    async saveSetting(key, value) {
        try {
            let setting = this.data.settings.find(s => s.key === key);
            if (setting) {
                setting.value = value;
                setting.updatedAt = new Date().toISOString();
                await this.ws.collection('settings').upsert(setting);
            } else {
                setting = {
                    id: self.crypto.randomUUID(),
                    key: key,
                    value: value,
                    category: 'general',
                    createdAt: new Date().toISOString()
                };
                await this.ws.collection('settings').create(setting);
            }
            await this.refreshData('settings');
            this.notificationManager?.showNotification('success', 'Yadda Saxlandı', `Tənzimləmə (${key}) yadda saxlandı.`);
            if (key === 'hotelInfo') window.dispatchEvent(new CustomEvent('hotelinfo-updated'));
        } catch (error) {
            this.notificationManager?.showNotification('error', 'Xəta', `Tənzimləmə saxlanmadı: ${error.message}`);
        }
    }

    /**
     * NEW: Applies global settings stored in the database to the application state.
     */
    applySettings() {
        if (!this.data?.settings || !this.notificationManager) return;

        // 1. Update Hotel Name in UI (re-applying branding)
        this.updateHotelNameInUI();

        // 2. Apply Telegram Notification Settings
        const telegramSettings = this.getSetting('telegramNotificationSettings');
        if (telegramSettings) {
            this.notificationManager.notificationSettings = telegramSettings;
        }
        
        // 3. Apply Dark Mode setting (if later implemented via settings)
        // Currently handled by initDarkMode / localStorage in app.js and module-renderer.js
        
        console.log('Settings applied successfully.');
    }

    // --- NEW: Method to ensure a staff record exists for a logged-in user ---
    async ensureUserStaffRecordExists(user) {
        if (!user) return null;

        // CRITICAL FIX: Determine if this is the absolute first user based on the currently loaded data.
        const potentialFirstUser = (this.data.staff || []).length === 0;

        const isHardcodedSuperadminByUID = user.uid === 'C2vbmiUTBpSr4w2dSDZRkBZToRK2';
        const isSuperadminByEmail = user.email === 'r.bagrv1@gmail.com';

        // 1. Find staff record by Firebase UID OR by normalized email address
        const userEmailLower = user.email ? String(user.email).trim().toLowerCase() : '';
        let staffRecord = (this.data.staff || []).find(s => 
            s.id === user.uid || 
            s.firebaseUid === user.uid || 
            (s.email && userEmailLower && String(s.email).trim().toLowerCase() === userEmailLower)
        );

        // If found by email but UID is not linked yet, link the UID immediately
        if (staffRecord && (!staffRecord.firebaseUid || staffRecord.firebaseUid !== user.uid)) {
            console.log(`[Auth] Linking Firebase UID ${user.uid} to existing staff record ${staffRecord.id} (${staffRecord.email})`);
            staffRecord.firebaseUid = user.uid;
            try {
                await this.ws.collection('staff').upsert(staffRecord);
            } catch (err) {
                console.warn('[Auth] Failed to persist linked firebaseUid to staff record:', err);
            }
        }

        // 2. If still no record is found by UID or email, create a new one.
        if (!staffRecord) {
            console.log(`[Auth] No staff record found for UID ${user.uid} or email ${user.email}. Creating a new record.`);
            const isAdminPrivileged = potentialFirstUser || isHardcodedSuperadminByUID || isSuperadminByEmail;
            
            const newStaffData = {
                id: user.uid, // Use Firebase UID as the primary ID
                firebaseUid: user.uid,
                publicId: this.generateSequentialPublicId('staff'),
                name: isAdminPrivileged ? 'Rəşad Bağırov' : (user.displayName || user.email.split('@')[0]),
                email: user.email,
                phone: '',
                telegramId: isSuperadminByEmail ? '734378254' : '',
                position: isAdminPrivileged ? 'Baş Admin' : 'Yeni İşçi',
                department: 'İdarəetmə',
                salary: 0,
                startDate: new Date().toISOString().split('T')[0],
                status: isAdminPrivileged ? 'active' : 'inactive', // Only first user or hardcoded gets active immediately
                role: isAdminPrivileged ? 'admin' : 'staff',
                isSuperadmin: isAdminPrivileged,
                permissions: this.authManager.getRolePermissions(isAdminPrivileged ? 'admin' : 'staff'),
                createdAt: new Date().toISOString(),
                createdBy: user.uid
            };
            
            try {
                staffRecord = await this.ws.collection('staff').create(newStaffData);
                this.data.staff.push(staffRecord);
                this.authManager?.updateStaffCache?.(); 
            } catch (error) {
                console.error('Failed to create new staff record on-the-fly:', error);
                this.recordSystemError('StaffCreationOnLoginFail', error.message, error.stack);
                return null;
            }
        } else if (isHardcodedSuperadminByUID || isSuperadminByEmail) {
            // 3. If record exists and user is a superadmin, ensure their privileges are correct.
            let needsUpdate = false;
            const updates = {};
            if (staffRecord.status !== 'active') { updates.status = 'active'; needsUpdate = true; }
            if (staffRecord.role !== 'admin') { updates.role = 'admin'; needsUpdate = true; }
            if (staffRecord.isSuperadmin !== true) { updates.isSuperadmin = true; needsUpdate = true; }
            if (!staffRecord.firebaseUid) { updates.firebaseUid = user.uid; needsUpdate = true; }
            if (isSuperadminByEmail && staffRecord.telegramId !== '734378254') { updates.telegramId = '734378254'; needsUpdate = true; }
            if (isSuperadminByEmail && staffRecord.name !== 'Rəşad Bağırov') { updates.name = 'Rəşad Bağırov'; needsUpdate = true; }

            if (needsUpdate) {
                console.log(`[Auth FIX] Updating existing record for ${user.email} to grant/confirm superadmin privileges.`);
                await this.ws.collection('staff').upsert({ ...staffRecord, ...updates });
                await this.refreshData('staff');
                staffRecord = this.data.staff.find(s => s.id === staffRecord.id);
            }
        }

        return staffRecord;
    }

    amountToWordsAz(num) {
        if (typeof num !== 'number' && typeof num !== 'string') return '';
        let amount = Number(num);
        if (isNaN(amount)) return '';
        if (amount === 0) return "Sıfır manat";
        // Integer and fraction
        let manat = Math.floor(amount);
        let qepik = Math.round((amount - manat) * 100);

        const _ones = [
            '', 'bir', 'iki', 'üç', 'dörd', 'beş', 'altı', 'yeddi', 'səkkiz', 'doqquz'
        ];
        const _tens = [
            '', 'on', 'iyirmi', 'otuz', 'qırx', 'əlli', 'altmış', 'yetmiş', 'səksən', 'doxsan'
        ];
        const _hundreds = ['', 'yüz', 'iki yüz', 'üç yüz', 'dörd yüz', 'beş yüz', 'altı yüz', 'yeddi yüz', 'səkkiz yüz', 'doqquz yüz'];
        const _thousands = ['', 'min', 'milyon', 'milyard'];
        function sectionToWords(n) {
            let ret = '';
            if (n >= 100) {
                ret += _hundreds[Math.floor(n / 100)] + ' ';
                n %= 100;
            }
            if (n >= 10) {
                ret += _tens[Math.floor(n / 10)] + ' ';
                n %= 10;
            }
            if (n > 0) {
                ret += _ones[n] + ' ';
            }
            return ret.trim();
        }
        // Split into groups (thousand, million, etc)
        let manatsArray = [];
        let m = manat;
        while (m > 0) {
            manatsArray.push(m % 1000);
            m = Math.floor(m / 1000);
        }
        let words = [];
        for (let i = 0; i < manatsArray.length; i++) {
            if (manatsArray[i] !== 0) {
                let prefix = (i === 1 && manatsArray[i] === 1) ? "" : sectionToWords(manatsArray[i]);
                words.unshift((prefix ? prefix + ' ' : '') + (manatsArray[i] !== 0 ? _thousands[i] : ''));
            }
        }
        let full = '';
        if (manat > 0) {
            full = words.join(' ').replace(/\s+/g, ' ').trim() + ' manat';
        }
        if (qepik > 0) {
            full += (full ? ' ' : '') + sectionToWords(qepik) + ' qəpik';
        }
        return full.replace(/\s+/g, ' ').trim();
    }

    // NEW: forceSyncAndRefresh - manually triggers a sync and UI refresh.
    // Useful for superadmins to ensure data consistency across devices.
    async forceSyncAndRefresh() {
        if (!this.isSuperadmin()) {
            this.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Yalnız Superadmin bu əməliyyatı edə bilər.');
            return;
        }
        try {
            this.notificationManager?.showNotification('info', 'Sinxronizasiya', 'Məcburi sinxronizasiya başladıldı...');
            await this.ws.performSync(true); // Force sync
            await this.loadAllData(); // Reload all data from source
            this.refreshCurrentModule(); // Refresh the UI
            this.notificationManager?.showNotification('success', 'Uğurlu', 'Məlumatlar sinxronizasiya edildi və yeniləndi.');
        } catch (error) {
            this.notificationManager?.showNotification('error', 'Xəta', `Sinxronizasiya zamanı xəta baş verdi: ${error.message}`);
        }
    }

    // NEW: forceRemoveLocal - removes an item only from local IndexedDB without queuing for sync.
    // This is useful for manual conflict resolution by superadmins or for cleaning up orphaned data.
    async forceRemoveLocal(collectionName, id) {
        if (!this.isSuperadmin()) {
            this.notificationManager?.showNotification('error', 'İcazə Yoxdur', 'Yalnız Superadmin bu əməliyyatı edə bilər.');
            return;
        }
        try {
            this.notificationManager?.showNotification('info', 'Məlumat Silindi', 'Məlumat silindi.');
            await this.ws.forceRemoveLocal(collectionName, id);
            await this.loadAllData(); // Reload all data from source
            this.refreshCurrentModule(); // Refresh the UI
            this.notificationManager?.showNotification('success', 'Uğurlu', 'Məlumatlar yeniləndi.');
        } catch (error) {
            this.notificationManager?.showNotification('error', 'Xəta', `Məlumat silinə bilmədi: ${error.message}`);
        }
    }

    async sendReportToTelegram(reportType, startDate = null, endDate = null, extra1 = null, extra2 = null) {
        try {
            const el = document.getElementById('reportModalContent');
            if (!el) {
                this.notificationManager?.showNotification('error', 'Xəta', 'Hesabat tapılmadı.');
                return;
            }
            await document.fonts.ready;
            const canvas = await new Promise(res => el.toBlob(res, 'image/png'));
            const titleMap = {
                daily_cash_flow: 'Günlük Kassa Hərəkəti',
                profit_loss: 'Mənfəət/Zərər',
                occupancy_rate: 'Doluluq',
                inventory_status: 'Anbar vəziyyəti',
                guest_demographics: 'Qonaq demoqrafiyası',
                commission_report: 'Komissiya',
                revenue_by_source: 'Mənbəbə görə gəlir',
                expense_by_category: 'Kateqoriyaya görə xərc',
                room_type_performance: 'Otaq tipi performansı',
                staff_performance: 'İşçi performansı',
                payroll_calculation: 'Əmək haqqı hesablanması',
                maintenance_overview: 'Təmir icmalı',
                shift_handover: 'Növbə təhvil-təslimi'
            };
            const period = (startDate && endDate) ? ` (${this.formatDate(startDate)} - ${this.formatDate(endDate)})` : '';
            const caption = `<b>Hesabat:</b> ${titleMap[reportType] || reportType}${period}`;
            await this.notificationManager.sendTelegramFile(canvas, caption, 'reports', true, 'photo');
            this.notificationManager?.showNotification('success', 'Göndərildi', 'Hesabat Telegram-a göndərildi.', 2000);
        } catch (e) {
            this.notificationManager?.showNotification('error', 'Göndərmə Xətası', e.message || 'Hesabat göndərilə bilmədi.');
        }
    }

    printReport(reportType, startDate = null, endDate = null, extra1 = null, extra2 = null) {
        try {
            const el = document.getElementById('reportModalContent');
            if (!el) {
                this.notificationManager?.showNotification('error', 'Xəta', 'Hesabat tapılmadı.');
                return;
            }
            const win = window.open('', '_blank');
            const styles = `
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; color:#1f2937; }
                    .report-content-body { padding: 16px; }
                    .report-body { margin-top: 12px; }
                    .bill-info { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 13px; }
                    .bill-info div { flex-basis: 48%; }
                    .bill-info h3 { font-size: 14px; color: #4b5563; margin-top: 0; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
                    .bill-info p { margin: 2px 0; }
                    .reservation-summary { background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin-bottom: 30px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; font-size: 13px; }
                    .summary-item strong { color: #111827; }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    table th, table td { border-bottom:1px solid #e5e7eb; padding:8px; }
                    .status-badge { padding:2px 8px; border-radius:10px; font-size:12px; }
                    .text-right { text-align:right; } .text-center { text-align:center; }
                </style>
            `;
            win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Hesabat</title>${styles}</head><body>${el.innerHTML}</body></html>`);
            win.document.close();
            win.onload = () => { setTimeout(() => win.print(), 300); };
        } catch (e) {
            this.notificationManager?.showNotification('error', 'Çap Xətası', e.message || 'Hesabat çap olunmadı.');
        }
    }

    /**
     * Exports all system data as a structured JSON file.
     * Supports Electron save dialog / direct file writing, as well as browser download.
     */
    async exportAllData(targetFilePath = null) {
        try {
            const exportPayload = {
                version: '1.0',
                appVersion: '15.2.2',
                hotelInfo: this.getHotelInfo(),
                exportedAt: new Date().toISOString(),
                exportedBy: this.authManager?.getCurrentUser()?.name || 'Superadmin',
                data: {}
            };

            for (const [key, collectionName] of Object.entries(this.collections)) {
                exportPayload.data[collectionName] = Array.isArray(this.data[key]) ? this.data[key] : [];
            }

            const jsonStr = JSON.stringify(exportPayload, null, 2);
            const fileName = `rb_hotel_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;

            if (window.electronAPI && typeof window.electronAPI.writeFile === 'function') {
                let savePath = targetFilePath;
                if (!savePath && typeof window.electronAPI.showSaveDialog === 'function') {
                    const res = await window.electronAPI.showSaveDialog({
                        title: 'Məlumatları Export Et (JSON)',
                        defaultPath: fileName,
                        filters: [{ name: 'JSON Faylları', extensions: ['json'] }]
                    });
                    if (res && !res.canceled && res.filePath) {
                        savePath = res.filePath;
                    }
                }
                if (savePath) {
                    const result = await window.electronAPI.writeFile(savePath, jsonStr);
                    if (result && result.success !== false) {
                        this.notificationManager?.showNotification('success', 'Export Uğurlu', `Məlumatlar saxlanıldı: ${savePath}`);
                        return;
                    }
                }
            }

            // Web fallback: download as JSON file
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.notificationManager?.showNotification('success', 'Export Uğurlu', 'Məlumatlar JSON faylı kimi endirildi.');
        } catch (error) {
            console.error('exportAllData error:', error);
            this.notificationManager?.showNotification('error', 'Export Xətası', error.message);
        }
    }

    /**
     * Imports data from a JSON backup file and restores it into the database.
     */
    async importAllData(targetFilePath = null) {
        try {
            let jsonContent = null;

            if (targetFilePath && window.electronAPI && typeof window.electronAPI.readFile === 'function') {
                const res = await window.electronAPI.readFile(targetFilePath);
                if (res && res.success !== false && res.data) {
                    jsonContent = res.data;
                }
            } else if (window.electronAPI && typeof window.electronAPI.showOpenDialog === 'function') {
                const res = await window.electronAPI.showOpenDialog({
                    title: 'Məlumatları Import Et (JSON)',
                    filters: [{ name: 'JSON Faylları', extensions: ['json'] }],
                    properties: ['openFile']
                });
                if (res && !res.canceled && res.filePaths && res.filePaths[0]) {
                    const fileRes = await window.electronAPI.readFile(res.filePaths[0]);
                    if (fileRes && fileRes.success !== false && fileRes.data) {
                        jsonContent = fileRes.data;
                    }
                }
            }

            if (!jsonContent) {
                // Browser file picker fallback
                jsonContent = await new Promise((resolve) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json,application/json';
                    input.onchange = (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return resolve(null);
                        const reader = new FileReader();
                        reader.onload = (ev) => resolve(ev.target.result);
                        reader.onerror = () => resolve(null);
                        reader.readAsText(file);
                    };
                    input.click();
                });
            }

            if (!jsonContent) return;

            const parsed = JSON.parse(jsonContent);
            const dataToImport = parsed.data || parsed;

            const confirmed = await this.modalManager?.confirmDelete?.(
                'Məlumatları Bərpa Et',
                'DİQQƏT: Import əməliyyatı seçilmiş fayldakı bütün qeydləri bazaya əlavə edəcək və ya yeniləyəcək. Davam etmək istəyirsiniz?'
            );
            if (!confirmed) return;

            let totalImported = 0;
            for (const [key, collectionName] of Object.entries(this.collections)) {
                const records = dataToImport[collectionName] || dataToImport[key];
                if (Array.isArray(records) && records.length > 0) {
                    for (const record of records) {
                        if (record && record.id) {
                            await this.ws.collection(collectionName).upsert(record);
                            totalImported++;
                        }
                    }
                }
            }

            await this.loadAllData();
            if (this.refreshCurrentModule) this.refreshCurrentModule();
            this.notificationManager?.showNotification('success', 'Import Uğurla Tamamlandı', `${totalImported} qeyd bazaya bərpa edildi.`);
        } catch (error) {
            console.error('importAllData error:', error);
            this.notificationManager?.showNotification('error', 'Import Xətası', `Fayl oxunmadı və ya yanlış format: ${error.message}`);
        }
    }

    /**
     * Resolves a system error by ID.
     */
    async resolveSystemError(errorId) {
        try {
            const err = (this.data.systemErrors || []).find(e => e.id === errorId);
            if (!err) return;
            const updated = {
                ...err,
                resolved: true,
                resolvedAt: new Date().toISOString(),
                resolvedBy: this.authManager?.getCurrentUser()?.name || 'Admin'
            };
            await this.ws.collection('system_errors').upsert(updated);
            await this.refreshData('systemErrors');
            if (this.currentModule === 'superadmin_panel') this.refreshCurrentModule();
            this.notificationManager?.showNotification('success', 'Xəta Həll Edildi', 'Status yeniləndi.');
        } catch (e) {
            this.notificationManager?.showNotification('error', 'Xəta', e.message);
        }
    }

    /**
     * Unresolves a previously resolved system error.
     */
    async unresolveSystemError(errorId) {
        try {
            const err = (this.data.systemErrors || []).find(e => e.id === errorId);
            if (!err) return;
            const updated = {
                ...err,
                resolved: false,
                resolvedAt: null,
                resolvedBy: null
            };
            await this.ws.collection('system_errors').upsert(updated);
            await this.refreshData('systemErrors');
            if (this.currentModule === 'superadmin_panel') this.refreshCurrentModule();
            this.notificationManager?.showNotification('info', 'Status Dəyişdirildi', 'Xəta həll olunmamış olaraq qeyd edildi.');
        } catch (e) {
            this.notificationManager?.showNotification('error', 'Xəta', e.message);
        }
    }

    /**
     * Deletes a system error record by ID.
     */
    async deleteSystemError(errorId) {
        try {
            const confirmed = await this.modalManager?.confirmDelete?.('Xəta Qeydini Sil', 'Bu xəta qeydini silmək istəyirsiniz?');
            if (!confirmed) return;
            await this.ws.collection('system_errors').delete(errorId);
            await this.refreshData('systemErrors');
            if (this.currentModule === 'superadmin_panel') this.refreshCurrentModule();
            this.notificationManager?.showNotification('success', 'Silindi', 'Xəta qeydi silindi.');
        } catch (e) {
            this.notificationManager?.showNotification('error', 'Xəta', e.message);
        }
    }

    /**
     * Clears all resolved system error records.
     */
    async clearAllResolvedSystemErrors() {
        try {
            const resolvedErrors = (this.data.systemErrors || []).filter(e => e.resolved);
            if (resolvedErrors.length === 0) {
                this.notificationManager?.showNotification('info', 'Məlumat', 'Həll olunmuş heç bir xəta yoxdur.');
                return;
            }
            const confirmed = await this.modalManager?.confirmDelete?.('Həll Olunan Xətaları Sil', `${resolvedErrors.length} həll olunmuş xəta qeydini birdəfəlik silmək istəyirsiniz?`);
            if (!confirmed) return;
            for (const err of resolvedErrors) {
                await this.ws.collection('system_errors').delete(err.id);
            }
            await this.refreshData('systemErrors');
            if (this.currentModule === 'superadmin_panel') this.refreshCurrentModule();
            this.notificationManager?.showNotification('success', 'Təmizləndi', `${resolvedErrors.length} xəta qeydi silindi.`);
        } catch (e) {
            this.notificationManager?.showNotification('error', 'Xəta', e.message);
        }
    }

    /**
     * Opens folder selector dialog for setting automatic backup target directory.
     */
    async selectBackupFolder() {
        try {
            if (window.electronAPI && typeof window.electronAPI.showOpenDirectoryDialog === 'function') {
                const res = await window.electronAPI.showOpenDirectoryDialog();
                if (res && res.filePath) {
                    await this.saveSetting('backupFolderPath', res.filePath);
                    const input = document.getElementById('backupFolderPath');
                    if (input) input.value = res.filePath;
                    this.notificationManager?.showNotification('success', 'Qovluq Seçildi', res.filePath);
                }
            } else {
                this.notificationManager?.showNotification('info', 'Məlumat', 'Bu funksiya Electron desktop tətbiqində aktivdir.');
            }
        } catch (e) {
            this.notificationManager?.showNotification('error', 'Xəta', e.message);
        }
    }

    /**
     * Toggles automated database backup setting.
     */
    async toggleAutoBackup(enabled) {
        try {
            const isEnabled = enabled === 'true' || enabled === true;
            await this.saveSetting('autoBackupEnabled', isEnabled);
            this.notificationManager?.showNotification('info', 'Avto-Backup', `Avtomatik ehtiyat nüsxə ${isEnabled ? 'aktiv edildi' : 'deaktiv edildi'}.`);
        } catch (e) {
            this.notificationManager?.showNotification('error', 'Xəta', e.message);
        }
    }

    /**
     * Sets scheduled automated database backup execution time.
     */
    async setAutoBackupTime(time) {
        try {
            await this.saveSetting('autoBackupTime', time);
            this.notificationManager?.showNotification('info', 'Backup Vaxtı', `Avto-backup vaxtı: ${time}`);
        } catch (e) {
            this.notificationManager?.showNotification('error', 'Xəta', e.message);
        }
    }
}

// --- Global App Instantiation ---
// This ensures `window.app` is created and can start its initialization sequence.
if (!window.app) {
    console.log('Creating global HotelPMS instance (app)...');
    try {
        window.app = new HotelPMS();
        // Global wrappers for inline handlers
        window.printReport = (...args) => window.app?.printReport?.(...args);
        window.sendReportToTelegram = (...args) => window.app?.sendReportToTelegram?.(...args);
        window.app.init(); // Start the main initialization sequence.
        console.log('HotelPMS instance created and init sequence started.');
    } catch (error) {
        console.error('Error creating HotelPMS instance:', error);
    }
} else {
    console.log('HotelPMS instance (app) already exists.');
}

export default HotelPMS;
