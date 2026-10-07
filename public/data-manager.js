// data-manager.js

// Define the HybridDB class to manage local IndexedDB and online database synchronization.
class HybridDB {
    constructor() {
        this.db = null; // Placeholder for IndexedDB
        this.onlineDB = null; // Firebase, Supabase, PocketBase, or Neon client instance
        this.onlineDBType = null; // Stores the active online DB type (e.g., 'firebase', 'supabase')
        // Primary online base is Firebase Firestore (offline-first: local IndexedDB is
        // the working copy and syncs to Firestore whenever a connection is available).
        // This system uses ONLY Firestore + IndexedDB. The websim backend and other
        // online DBs (pocketbase/supabase/neon) are never used.
        this.preferredServerDB = 'firebase'; // Always Firestore, never websim/pocketbase/etc.
        this.syncQueue = JSON.parse(localStorage.getItem('syncQueue') || '[]'); // Operations waiting to be synced
        this.isSyncing = false; // Flag to prevent multiple concurrent syncs
        this.lastSyncTime = localStorage.getItem('lastSyncTime') || '0'; // Timestamp of the last successful sync
        this.isOnline = navigator.onLine; // Tracks browser's current online status
        this.hasOnlineDB = false; // Add this property to track DB connection status
        this.lastError = null; // Stores the last sync/connection error
        this.subscriptions = {}; // To hold realtime unsubscribe functions

        // Circuit breaker: cooldown timestamp when Firestore quota/timeout occurs
        this._onlineDisabledUntil = 0;

        // Tracks how many collections have been loaded into the system (for the
        // dashboard Firebase load-percentage circle).
        this.loadedCollections = new Set();
        this.totalCollections = [
            "guests", "rooms", "reservations", "services", "inventory",
            "staff", "maintenance", "cash_transactions", "invoices",
            "pos_sales", "reports", "settings", "audit_logs", "purchase_documents",
            "system_errors"
        ];

        // Backoff tracking to avoid hammering the server (e.g. on quota/network errors).
        this._syncBackoffAttempts = 0;

        // Flag to prevent multiple event listeners for connectivity
        this._connectivityListenersAttached = false; // <-- ADDED THIS FLAG

        // Realtime listeners are useful after the first screen is ready, but
        // opening all of them during startup creates a burst of Firebase
        // requests and can make the app feel unresponsive.
        window.addEventListener('app-ready', () => {
            if (this.canQueryOnline()) this.setupAllRealtimeListeners();
        });

        this.setupConnectivityListeners();
        this.dbReady = this.initializeLocalDB(); // Setup IndexedDB returns a promise
        this.initializeOnlineDB(); // Connect to the preferred online database
    }

    // Circuit breaker check: returns true only if online DB is confirmed working and not in cooldown
    canQueryOnline() {
        if (!this.isOnline || !this.onlineDB || !this.hasOnlineDB) return false;
        if (this._onlineDisabledUntil && Date.now() < this._onlineDisabledUntil) return false;
        return true;
    }

    // Sets up event listeners for online/offline status changes
    setupConnectivityListeners() {
        if (this._connectivityListenersAttached) { // <-- ADDED THIS GUARD
            return;
        }

        window.addEventListener('online', () => {
            this.isOnline = true;
            this.performSync(true); // Attempt to sync immediately when back online, force it
            this.updateConnectionStatusUI(); // Update UI indicator
            window.notificationManager?.showNotification('info', 'Bağlantı', 'İnternet bağlantısı bərpa olundu.', 2000);
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateConnectionStatusUI(); // Update UI indicator
            window.notificationManager?.showNotification('warning', 'Bağlantı', 'İnternet bağlantısı itirildi. Offline rejimdəsiniz.', 3000);
        });

        // NEW: Listen for auth-success to re-initialize online DB with authenticated user
        window.addEventListener('auth-success', async () => {
            console.log('HybridDB: Auth successful, re-initializing online DB connection...');
            await this.initializeOnlineDB(true); // Pass true to indicate it's a re-initialization
        });

        this._connectivityListenersAttached = true; // <-- SET FLAG
    }

    // Initializes the local IndexedDB database
    initializeLocalDB() {
        return new Promise((resolve, reject) => {
            console.log('HybridDB: Initializing IndexedDB...');
            const request = indexedDB.open('hotelPmsIndexedDB', 5); // Increment version to fix "requested version is less than existing version"

            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                // Use a hardcoded list of collections, as window.app might not be ready
                const collections = [
                    "guests", "rooms", "reservations", "services", "inventory",
                    "staff", "maintenance", "cash_transactions", "invoices",
                    "pos_sales", "reports", "settings", "audit_logs", "purchase_documents",
                    "system_errors" // NEW: Added system_errors collection
                ];
                console.log('HybridDB: onupgradeneeded triggered. Creating stores:', collections);
                collections.forEach(name => {
                    if (!this.db.objectStoreNames.contains(name)) {
                        this.db.createObjectStore(name, { keyPath: 'id' });
                    }
                });
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('HybridDB: IndexedDB initialized successfully.');
                resolve(); // Resolve the promise when DB is ready
            };

            request.onerror = (event) => {
                console.error('HybridDB: IndexedDB initialization error:', event.target.error);
                this.db = null;
                let errorMessage = 'IndexedDB açıla bilmədi. Məlumatlar lokal olaraq saxlanmayacaq. Zəhmət olmasa, brauzerinizin yaddaş və gizlilik ayarlarını yoxlayın. Səbəb: ' + event.target.error.message;
                if (event.target.error.name === 'QuotaExceededError') {
                    errorMessage = 'Cihazınızda yaddaş yeri doludur. IndexedDB işləyə bilmədi.';
                } else if (event.target.error.name === 'SecurityError' || (event.target.error.name === 'UnknownError' && event.target.error.message.includes('permission'))) {
                    errorMessage = 'Brauzerinizin təhlükəsizlik/gizlilik parametrləri IndexedDB istifadəsinə icazə vermir (məsələn, "Incognito" rejimi və ya "Üçüncü tərəf kukilərini blokla" ayarı).';
                }
                window.notificationManager?.showNotification('error', 'Lokal Baza Xətası', errorMessage, 15000); // Longer duration
                this.lastError = errorMessage; // Update lastError for general status
                this.updateConnectionStatusUI(); // Update UI if needed
                reject(new Error(errorMessage)); // Reject the promise on error
            };
        });
    }

    // Helper methods for IndexedDB operations
    _getStore(storeName, mode) {
        if (!this.db) {
            // No fallback to localStorage. Throw an error if IndexedDB is not available.
            throw new Error('Lokal baza (IndexedDB) mövcud deyil.');
        }
        try {
            const tx = this.db.transaction(storeName, mode);
            return tx.objectStore(storeName);
        } catch (e) {
             console.error(`HybridDB: Error getting store '${storeName}'. It might not exist.`, e);
             throw new Error(`'${storeName}' cədvəli lokal bazada tapılmadı.`);
        }
    }
    
    // Initializes the connection to the selected online database
    async initializeOnlineDB(isReinit = false) {
        const dbType = this.preferredServerDB; // Always 'firebase'

        // Initial load must NOT wait for the user to be signed in. Gating the online
        // DB behind authentication meant that on devices where the session/persistence
        // isn't restored yet (fresh install, mobile browser, private mode, storage
        // restrictions) the online DB stayed null, so getList() only read the empty
        // local cache and data appeared to "not load". Firestore and the sync layer
        // handle auth/rules themselves; we only need AuthManager to exist to rebuild
        // the connection after login (auth-success -> reinitializeOnlineDB).
        if (!isReinit && !window.authManager) {
            console.log('HybridDB: Waiting for AuthManager before initializing online DB.');
            this.lastError = 'Giriş gözlənilir...';
            this.updateConnectionStatusUI();
            return;
        }

        try {
            switch (dbType) {
                case 'firebase':
                    // Firebase SDK is initialized in index.html, directly assign global objects
                    // Ensure the SDK is ready and authenticated (if required by rules)
                    
                    // NEW: Poll for window.firestoreDb to be available
                    let retries = 0;
                    while (!window.firestoreDb && retries < 20) { // Max 2 seconds wait
                        await new Promise(resolve => setTimeout(resolve, 100));
                        retries++;
                    }

                    if (window.firebaseApp && window.firestoreDb) {
                        this.onlineDB = window.firestoreDb;
                        this.onlineDBType = 'firebase';
                        this.hasOnlineDB = false;
                        const isConnected = await this.checkFirebaseConnection();
                        this.hasOnlineDB = isConnected;
                    } else {
                        console.warn('HybridDB: Firebase SDK not fully initialized or config missing after polling.');
                        this.onlineDB = null;
                        this.onlineDBType = null;
                        this.hasOnlineDB = false;
                        this.lastError = 'Firebase SDK yüklənməyib və ya konfiqurasiyası yanlışdır.';
                    }
                    break;
                default: // Offline-only (no Firestore configured): local IndexedDB only
                    this.onlineDB = null;
                    this.onlineDBType = null;
                    this.hasOnlineDB = false;
                    this.lastError = null;
                    console.log('HybridDB: Operating in offline-only mode. No online DB configured.');
            }
        } catch (e) {
            console.error('HybridDB: Failed to initialize online DB:', e);
            this.onlineDB = null;
            this.onlineDBType = null;
            this.hasOnlineDB = false;
            this.lastError = 'Online baza qoşulmadı: ' + e.message;
            window.notificationManager?.showNotification('error', 'DB Xətası', 'Online baza qoşulmadı: ' + e.message);
        }
        this.updateConnectionStatusUI(); // Update UI based on new connection status
        this.performSync(); // Attempt sync after DB initialization
        // Defer the 15 realtime listeners until the first screen is usable.
        if (window.app?.isInitialized) {
            this.setupAllRealtimeListeners();
        }
    }

    // NEW: Clears all local data from IndexedDB and localStorage sync queue.
    async clearAllLocalData() {
        await this.dbReady;
        if (!this.db) {
            throw new Error("Lokal baza (IndexedDB) mövcud deyil.");
        }
        const storeNames = Array.from(this.db.objectStoreNames);
        const tx = this.db.transaction(storeNames, 'readwrite');
        const promises = storeNames.map(name => {
            return new Promise((resolve, reject) => {
                const request = tx.objectStore(name).clear();
                request.onsuccess = resolve;
                request.onerror = (e) => reject(e.target.error);
            });
        });
        await Promise.all(promises);
        localStorage.removeItem('syncQueue');
        localStorage.removeItem('deadLetterQueue');
        localStorage.removeItem('lastSyncTime');
        console.log("HybridDB: All local data cleared.");
    }

    // NEW: Sanitizer to remove undefined fields which can cause issues with some DBs
    _sanitizeDataForDB(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (obj instanceof Date) { // DBs like Firebase handle Date objects well
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this._sanitizeDataForDB(item));
        }
        const newObj = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                if (value !== undefined) { // Remove undefined fields
                    newObj[key] = this._sanitizeDataForDB(value);
                }
            }
        }
        return newObj;
    }

    // Classifies an error as transient/recoverable (network, quota, server busy,
    // "failed-precondition", "unavailable"). Such errors must KEEP the operation in
    // the sync queue (never dead-letter) so no local change is ever lost, and the
    // app should back off before retrying instead of hammering the server.
    _isRetryableError(error) {
        if (!error) return true;
        const msg = String(error.message || error.code || '');
        return /quota|resource.?exhausted|429|5\d\d|failed-precondition|unavailable|aborted|Failed to fetch|load failed|network|timeout|ECONN/i.test(msg);
    }

    // Connection checks for different database types
    async checkFirebaseConnection() {
        if (!this.onlineDB) {
            this.lastError = 'Firebase DB instansı boşdur.';
            this.hasOnlineDB = false;
            return false;
        }
        try {
            // Use window.firestoreDb for direct consistency if available
            const firestore = window.firestoreDb || this.onlineDB;
            const { collection, getDocs, limit, query } = await import('firebase/firestore');
            const q = query(collection(firestore, "settings"), limit(1)); // Query existing settings collection
            await Promise.race([
                getDocs(q),
                new Promise((_, reject) => setTimeout(() => {
                    const timeoutError = new Error('Firebase bağlantısı vaxt aşımına uğradı.');
                    timeoutError.code = 'deadline-exceeded';
                    reject(timeoutError);
                }, 6000))
            ]);

            console.log('HybridDB: Firebase connection successful.');
            this.lastError = null;
            this.hasOnlineDB = true; // Set to true on successful connection
            this._onlineDisabledUntil = 0;
            return true;
        } catch (e) {
            console.warn('HybridDB: Firebase connection failed or restricted:', e.message || e);
            let errorMessage = `Firebase xətası: ${e.message}`;
            if (e.code === 'permission-denied') {
                errorMessage = 'Giriş icazəsi yoxdur. Təhlükəsizlik qaydalarını yoxlayın.';
            } else if (e.code === 'resource-exhausted' || /quota|exhausted|429/i.test(e.message || '')) {
                errorMessage = 'Firebase gündəlik kvotası dolub (Quota Exceeded). Sistem lokal baza ilə işləyir.';
            } else if (e.code === 'unavailable' || e.code === 'failed-precondition') {
                errorMessage = 'Şəbəkə xətası və ya server əlçatmazdır.';
            }
            this.lastError = errorMessage;
            this.hasOnlineDB = false;
            // Cooldown for 2 minutes to prevent repeated hangs/timeouts on other collections
            this._onlineDisabledUntil = Date.now() + 120000;
            return false;
        }
    }

    // Updates the connection status icon and label in the UI header
    updateConnectionStatusUI() {
        const iconEl = document.getElementById('firebaseSyncIcon');
        const labelEl = document.getElementById('firebaseSyncLabel'); // Using Firebase-specific IDs for general sync status
        const statusButton = document.getElementById('firebaseSyncBtn'); // Get the button to set title attribute

        if (iconEl && labelEl && statusButton) {
            let tooltipText = '';

            if (this.isSyncing) {
                iconEl.innerHTML = '<i class="fas fa-sync fa-spin"></i>'; // Spinning icon for syncing
                iconEl.style.color = '#f59e0b'; // Orange for syncing
                tooltipText = 'Sinxronizasiya edilir...';
            } else if (this.isOnline && this.hasOnlineDB) {
                iconEl.innerHTML = '<i class="fas fa-cloud"></i>'; // Connected to online DB
                iconEl.style.color = '#10b981'; // Green
                tooltipText = `Sinxronizasiya: Online | Sonuncu: ${this.lastSyncTime !== '0' ? new Date(this.lastSyncTime).toLocaleString('az-AZ') : 'Heç vaxt'}`;
            } else if (this.isOnline && !this.hasOnlineDB) {
                iconEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i>'; // Online but DB connection error
                iconEl.style.color = '#f59e0b'; // Orange
                tooltipText = `Server Bazası: Mövcud deyil | Xəta: ${this.lastError || 'Bilinməyən xəta'}`;
            } else { // Offline
                iconEl.innerHTML = '<i class="fas fa-cloud-slash"></i>';
                iconEl.style.color = '#ef4444'; // Red
                tooltipText = 'Sinxronizasiya: Offline';
                if (this.lastError) {
                    tooltipText += ` | Son Xəta: ${this.lastError}`;
                }
            }
            statusButton.setAttribute('title', tooltipText);
            labelEl.setAttribute("aria-label", tooltipText); // Also set for accessibility
        }
    }

    // PATCHED: More robust sync logic to handle failing ("poison pill") operations
    async performSync(force = false) {
        if (force) {
            this.isSyncing = false; // Override lock if forcing
        }
        // Prevent sync if not online, no online DB is configured, or another sync is already in progress
        if (!this.isOnline || !this.onlineDB || this.isSyncing) {
            if (this.isSyncing) console.log('HybridDB: Sync skipped (already syncing).');
            return;
        }

        this.isSyncing = true;
        window.dispatchEvent(new CustomEvent('syncstart')); // Notify UI that sync has started
        this.updateConnectionStatusUI(); // Update UI to reflect syncing state

        try {
            // First, re-check online connection just before starting actual sync operation
            let isOnlineAndConnected = false;
            if (this.onlineDBType === 'firebase') {
                isOnlineAndConnected = await this.checkFirebaseConnection();
            }

            if (!isOnlineAndConnected) {
                throw new Error("Online baza əlçatan deyil və ya qoşulmaq alınmadı. Sinxronizasiya ləğv edildi.");
            }

            const queueToProcess = this.syncQueue.splice(0, this.syncQueue.length); // Empty the queue and get items to process

            for (const operation of queueToProcess) {
                // Defensive check to ensure operation is a valid object
                if (!operation || typeof operation !== 'object' || !operation.collectionName || !operation.type || !operation.id) {
                    console.warn('HybridDB: Skipping invalid or malformed operation in sync queue:', operation);
                    const deadQueue = JSON.parse(localStorage.getItem('deadLetterQueue') || '[]');
                    deadQueue.push({ operation, error: { message: 'Invalid or malformed operation object in queue (missing collectionName, type, or id)' }, time: new Date().toISOString() });
                    localStorage.setItem('deadLetterQueue', JSON.stringify(deadQueue));
                    this.lastError = 'Sinxronizasiya növbəsində yanlış əməliyyat aşkarlandı. Yenidən cəhd edilməyəcək.';
                    continue; // Skip this invalid operation and proceed with the next one
                }

                try {
                    await this._executeOnlineOperation(operation);
                    console.log(`HybridDB: Successfully processed operation for ${operation.collectionName}/${operation.id}`);
                } catch (error) {
                    console.error('HybridDB: Error during sync operation, re-queuing for next attempt:', operation, error);
                    
                    // Specific error handling for permission denied to avoid endless retries on rules issues
                    if (error.message && error.message.includes('permission-denied')) {
                        console.warn("HybridDB: Permission denied error. Not re-queuing, moving to dead-letter immediately.");
                        const deadQueue = JSON.parse(localStorage.getItem('deadLetterQueue') || '[]');
                        deadQueue.push({ operation, error: { message: error.message, stack: error.stack }, time: new Date().toISOString() });
                        localStorage.setItem('deadLetterQueue', JSON.stringify(deadQueue));
                        this.lastError = `Əməliyyat icazə xətası səbəbindən uğursuz oldu (${operation.collectionName}:${operation.type}). Firestore qaydalarını yoxlayın.`;
                        continue; // Skip re-queueing and move to next operation
                    }

                    // Transient errors (network, quota/429, server unavailable) must NEVER be
                    // dead-lettered — that would silently drop local changes. Keep them queued
                    // so they are retried once the server is reachable again.
                    if (this._isRetryableError(error)) {
                        this.syncQueue.push(operation);
                        this.lastError = `Əməliyyat keçici xəta səbəbindən təxirə salındı (${operation.collectionName}:${operation.type}). Yenidən cəhd ediləcək. (${error.message || error})`;
                        continue;
                    }

                    // Only truly permanent (non-recoverable) errors get a bounded retry count,
                    // then move to the dead-letter queue for manual inspection.
                    operation.retries = (operation.retries || 0) + 1;
                    if (operation.retries < 5) { // Limit retries to 5
                        this.syncQueue.push(operation); // Re-queue the failed operation
                        this.lastError = `Əməliyyat zamanı xəta (${operation.collectionName}:${operation.type}). Təkrar cəhd ediləcək.`;
                    } else {
                        // After max retries, move to a "dead letter" queue for inspection
                        console.error("HybridDB: Operation failed 5 times, discarding to dead-letter queue:", operation);
                        const deadQueue = JSON.parse(localStorage.getItem('deadLetterQueue') || '[]');
                        deadQueue.push({ operation, error: { message: error.message, stack: error.stack }, time: new Date().toISOString() });
                        localStorage.setItem('deadLetterQueue', JSON.stringify(deadQueue));
                        this.lastError = `Əməliyyat çox sayda uğursuz oldu (${operation.collectionName}:${operation.type}). Ölü növbəyə köçürüldü.`;
                    }
                }
            }

            localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue)); // Persist the new queue (with any re-queued items)

            // If we processed items and the queue is now empty, it was a fully successful sync.
            if (queueToProcess.length > 0 && this.syncQueue.length === 0) {
                this.lastError = null; // Clear any previous error
                this.lastSyncTime = new Date().toISOString();
                localStorage.setItem('lastSyncTime', this.lastSyncTime);
                console.log('HybridDB: Sync batch completed successfully.');

                // After pushing local changes, fetch latest data from server to ensure consistency
                if (window.app && typeof window.app.loadAllData === 'function') {
                    console.log('HybridDB: Pulling latest data from server...');
                    await window.app.loadAllData();
                    if (window.app.refreshCurrentModule && window.app.currentModule !== 'dashboard') {
                        window.app.refreshCurrentModule();
                    }
                }
            } else if (this.syncQueue.length > 0) {
                 console.log(`HybridDB: Sync batch finished with ${this.syncQueue.length} remaining items. Will retry.`);
            }

            window.dispatchEvent(new CustomEvent('syncend'));

        } catch (error) {
            console.error('HybridDB: Unrecoverable error in sync process:', error);
            this.lastError = error.message; // Capture overall sync error
        } finally {
            this.isSyncing = false; // Reset syncing flag
            this.updateConnectionStatusUI(); // Ensure UI reflects the final connection status

            // If there are still items in the queue, schedule another sync attempt with
            // exponential backoff. Do NOT schedule if the remaining errors are permission
            // based (they will never succeed without a rules change).
            if (this.syncQueue.length > 0 && this.isOnline && this.onlineDB
                && !(this.lastError && this.lastError.includes('icazə xətası'))) {
                const backoffMs = Math.min(5000 * Math.pow(2, this._syncBackoffAttempts), 60000);
                this._syncBackoffAttempts++;
                console.log(`HybridDB: Scheduling next sync attempt in ${backoffMs}ms (backoff #${this._syncBackoffAttempts}).`);
                setTimeout(() => this.performSync(), backoffMs);
            } else {
                this._syncBackoffAttempts = 0; // Reset backoff when queue is drained
            }
        }
    }

    // Adds an operation to the synchronization queue
    _queueOperation(operation) {
        this.syncQueue.push(operation);
        localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue)); // Persist the queue
        if (this.isOnline && this.onlineDB) {
            this.performSync(); // Attempt an immediate sync if conditions are met
        }
    }

    // Executes a single operation on the active online database
    async _executeOnlineOperation(operation) {
        const { collectionName, type, id, data } = operation; // Original data
        const sanitizedData = this._sanitizeDataForDB(data); // Sanitize before sending

        console.log(`[HybridDB:Sync] Executing online operation: type=${type}, collection=${collectionName}, id=${id}`);

        switch (this.onlineDBType) {
            case 'firebase':
                // For Firebase, ensure Firebase modules are loaded
                if (!window.firestoreDb || !window.firebaseApp) {
                    throw new Error("Firebase SDK not ready for operation.");
                }
                const { collection, doc, setDoc, deleteDoc } = await import('firebase/firestore');
                
                if (type === 'create') {
                    // Use set with doc(id) to explicitly set the document ID
                    await setDoc(doc(window.firestoreDb, collectionName, id), sanitizedData);
                } else if (type === 'update' || type === 'upsert') {
                    // For Firebase, 'upsert' typically means `set` with `merge: true`
                    await setDoc(doc(window.firestoreDb, collectionName, id), sanitizedData, { merge: true });
                } else if (type === 'delete') {
                    console.log(`[HybridDB:Firebase] Attempting to delete doc ${collectionName}/${id}`);
                    await deleteDoc(doc(window.firestoreDb, collectionName, id));
                    console.log(`[HybridDB:Firebase] Successfully deleted doc ${collectionName}/${id}`);
                }
                break;
            default:
                throw new Error('HybridDB: Unsupported online DB type for operation execution.');
        }
        this.lastError = null; // Clear error if operation was successful
    }

    // Reports how many collections have been loaded into the system (0-100).
    getFirebaseLoadPercentage() {
        const total = this.totalCollections.length || 1;
        return Math.round((this.loadedCollections.size / total) * 100);
    }

    // Dispatches an event so the dashboard circle can update live.
    _dispatchLoadProgress() {
        window.dispatchEvent(new CustomEvent('firebase-load-progress', {
            detail: { percent: this.getFirebaseLoadPercentage() }
        }));
    }

    // Resets the load tracker (e.g. on refresh) and dispatches progress.
    resetLoadProgress() {
        this.loadedCollections.clear();
        this._dispatchLoadProgress();
    }

    // NEW: Get local vs. online counts for all collections
    async getCollectionCounts() {
        const counts = {};
        const collectionNames = Object.values(window.app?.collections || {});

        for (const name of collectionNames) {
            // Get local count
            let localCount = 'Error';
            try {
                await this.dbReady; // Ensure IndexedDB is ready
                if (this.db) {
                    const store = this._getStore(name, 'readonly');
                    const request = store.count();
                    localCount = await new Promise((resolve, reject) => {
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = (e) => reject(e.target.error);
                    });
                } else {
                    // Fallback removed, IndexedDB is required.
                     localCount = 'Error';
                }
            } catch (e) {
                console.error(`Error getting local count for ${name}:`, e);
                localCount = 'Error';
            }

            // Get online count
            let onlineCount = 'N/A';
            if (this.isOnline && this.onlineDB) {
                try {
                    if (this.onlineDBType === 'firebase') {
                        const { collection, getCountFromServer, getDocs, query } = await import('firebase/firestore');
                        const collRef = collection(this.onlineDB, name);

                        try {
                            const snapshot = await getCountFromServer(collRef);
                            onlineCount = snapshot.data().count;
                        } catch (countError) {
                            console.warn(`getCountFromServer for '${name}' failed (likely security rules), falling back to getDocs().size. Error: ${countError.message}`);
                            const docsSnapshot = await getDocs(collRef);
                            onlineCount = docsSnapshot.size;
                        }
                    }
                } catch (e) {
                    console.error(`Error getting online count for ${name}:`, e);
                    onlineCount = 'Xəta';
                }
            }
            
            counts[name] = { localCount, onlineCount };
        }
        return counts;
    }

    // Provides an interface to interact with a specific collection, handling local storage and queuing for sync
    collection(name) {
        const self = this; // Capture `this` for inner methods

        const localDBActions = {
            get: async (id) => {
                await self.dbReady; // Ensure IndexedDB is ready
                try {
                    const store = self._getStore(name, 'readonly');
                    const request = store.get(id);
                    return await new Promise((resolve, reject) => {
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = (e) => reject(e.target.error);
                    });
                } catch (error) {
                    throw error;
                }
            },
            getAll: async () => {
                await self.dbReady; // Ensure IndexedDB is ready
                try {
                    const store = self._getStore(name, 'readonly');
                    const request = store.getAll();
                    return await new Promise((resolve, reject) => {
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = (e) => reject(e.target.error);
                    });
                } catch (error) {
                    throw error;
                }
            },
            put: async (data) => {
                await self.dbReady; // Ensure IndexedDB is ready
                try {
                    const store = self._getStore(name, 'readwrite');
                    const request = store.put(data);
                    return await new Promise((resolve, reject) => {
                        request.onsuccess = () => resolve();
                        request.onerror = (e) => reject(e.target.error);
                    });
                } catch (error) {
                    throw error;
                }
            },
            delete: async (id) => {
                await self.dbReady; // Ensure IndexedDB is ready
                try {
                    const store = self._getStore(name, 'readwrite');
                    const request = store.delete(id);
                    return await new Promise((resolve, reject) => {
                        request.onsuccess = () => resolve();
                        request.onerror = (e) => reject(e.target.error);
                    });
                } catch (error) {
                    throw error;
                }
            },
            clear: async () => {
                await self.dbReady; // Ensure IndexedDB is ready
                try {
                    const store = self._getStore(name, 'readwrite');
                    const request = store.clear();
                    return await new Promise((resolve, reject) => {
                        request.onsuccess = () => resolve();
                        request.onerror = (e) => reject(e.target.error);
                    });
                } catch (error) {
                    throw error;
                }
            },
        };

        return {
            // Get single document by ID from local DB
            get: localDBActions.get,

            // Creates a new document/record
            create: async (data) => {
                if (!data.id) {
                    console.error(`HybridDB: 'id' is required for creating a document in collection '${name}'.`);
                    throw new Error(`Verilənlərə ID əlavə edilməlidir.`);
                }
                try {
                    await localDBActions.put(data);
                    self._queueOperation({ collectionName: name, type: 'create', id: data.id, data }); // Pass id for sync
                    return data;
                } catch (error) {
                    console.error(`HybridDB: Failed to create in local DB for collection '${name}':`, error);
                    self.lastError = `Lokal baza xətası (${name}): ${error.message}`;
                    self.updateConnectionStatusUI();
                    throw new Error(`Lokal bazaya yazıla bilmədi: ${error.message}`); // Re-throw to propagate
                }
            },

            // Updates an existing document or creates it if not found (upsert)
            upsert: async (data) => {
                if (!data.id) throw new Error("Upsert requires an 'id' property.");
                try {
                    await localDBActions.put(data);
                    self._queueOperation({ collectionName: name, type: 'upsert', id: data.id, data });
                    return data;
                } catch (error) {
                    console.error(`HybridDB: Failed to upsert in local DB for collection '${name}':`, error);
                    self.lastError = `Lokal baza xətası (${name}): ${error.message}`;
                    self.updateConnectionStatusUI();
                    throw new Error(`Lokal bazaya yazıla bilmədi: ${error.message}`); // Re-throw to propagate
                }
            },

            // Update alias pointing to upsert for API consistency
            update: async (data) => {
                if (!data.id) throw new Error("Update requires an 'id' property.");
                try {
                    await localDBActions.put(data);
                    self._queueOperation({ collectionName: name, type: 'update', id: data.id, data });
                    return data;
                } catch (error) {
                    console.error(`HybridDB: Failed to update in local DB for collection '${name}':`, error);
                    self.lastError = `Lokal baza xətası (${name}): ${error.message}`;
                    self.updateConnectionStatusUI();
                    throw new Error(`Lokal bazaya yazıla bilmədi: ${error.message}`);
                }
            },

            // Deletes a document/record by its ID
            delete: async (id) => {
                try {
                    await localDBActions.delete(id);
                    self._queueOperation({ collectionName: name, type: 'delete', id });
                    return { id, success: true };
                } catch (error) {
                    console.error(`HybridDB: Failed to delete in local DB for collection '${name}':`, error);
                    self.lastError = `Lokal baza xətası (${name}): ${error.message}`;
                    self.updateConnectionStatusUI();
                    throw new Error(`Lokal bazadan silinə bilmədi: ${error.message}`); // Re-throw to propagate
                }
            },

            // Retrieves all documents/records from the collection
            getList: async () => {
                // Fast path: Check local IndexedDB first
                let cachedLocal = [];
                try {
                    await self.dbReady;
                    cachedLocal = await localDBActions.getAll();
                } catch (e) {
                    // Ignore local cache read error, will proceed to online or retry
                }

                // If local cache has records, return immediately for instant UI load!
                if (cachedLocal && cachedLocal.length > 0) {
                    self.loadedCollections.add(name);
                    self._dispatchLoadProgress();

                    // Background non-blocking sync with Firestore only if healthy and allowed
                    if (self.canQueryOnline() && self.onlineDBType === 'firebase') {
                        (async () => {
                            try {
                                const { collection, getDocs } = await import('firebase/firestore');
                                const snapshot = await getDocs(collection(self.onlineDB, name));
                                let onlineData = [];
                                snapshot.forEach(doc => onlineData.push({ id: doc.id, ...doc.data() }));
                                
                                await self.dbReady;
                                if (self.db && onlineData.length > 0) {
                                    const tx = self.db.transaction(name, 'readwrite');
                                    const store = tx.objectStore(name);
                                    onlineData.forEach(item => store.put(item));
                                    await new Promise((resolve, reject) => {
                                        tx.oncomplete = resolve;
                                        tx.onerror = () => reject(tx.error);
                                    });
                                }
                            } catch (bgErr) {
                                const msg = String(bgErr.message || bgErr.code || '');
                                if (/quota|exhausted|429|resource-exhausted/i.test(msg)) {
                                    self.hasOnlineDB = false;
                                    self._onlineDisabledUntil = Date.now() + 120000;
                                    self.lastError = 'Firebase kvotası dolub (Quota Exceeded). Lokal rejim aktivdir.';
                                    self.updateConnectionStatusUI();
                                }
                                console.warn(`HybridDB: Background sync for '${name}' non-critical error:`, bgErr.message);
                            }
                        })();
                    }
                    return cachedLocal;
                }

                // If local cache is empty:
                // Only attempt remote Firestore query if online DB is healthy and not in cooldown!
                if (self.canQueryOnline()) {
                    const withTimeout = (promise, ms) => new Promise((resolve) => {
                        const timer = setTimeout(() => resolve({ timedOut: true }), ms);
                        promise.then(
                            (value) => { clearTimeout(timer); resolve({ timedOut: false, value }); },
                            (error) => { clearTimeout(timer); resolve({ timedOut: false, error }); }
                        );
                    });

                    try {
                        let onlineData = [];
                        if (self.onlineDBType === 'firebase') {
                            const { collection, getDocs } = await import('firebase/firestore');
                            const result = await withTimeout(getDocs(collection(self.onlineDB, name)), 1500);
                            if (result.timedOut) {
                                console.warn(`HybridDB: Firestore read for '${name}' timed out. Circuit breaker activated: falling back to local.`);
                                self.hasOnlineDB = false;
                                self._onlineDisabledUntil = Date.now() + 60000;
                                self.lastError = 'Firebase bağlantısı vaxt aşımına uğradı.';
                                self.updateConnectionStatusUI();
                                return await localDBActions.getAll();
                            }
                            if (result.error) {
                                const errMsg = String(result.error.message || result.error.code || '');
                                if (/quota|exhausted|429|resource-exhausted/i.test(errMsg)) {
                                    console.warn(`HybridDB: Firestore quota exceeded. Circuit breaker activated.`);
                                    self.hasOnlineDB = false;
                                    self._onlineDisabledUntil = Date.now() + 120000;
                                    self.lastError = 'Firebase kvotası dolub (Quota Exceeded).';
                                    self.updateConnectionStatusUI();
                                }
                                throw result.error;
                            }
                            result.value.forEach(doc => onlineData.push({ id: doc.id, ...doc.data() }));
                        } else {
                            return await localDBActions.getAll();
                        }
                        
                        await self.dbReady;
                        if (self.db && onlineData.length > 0) {
                            const tx = self.db.transaction(name, 'readwrite');
                            const store = tx.objectStore(name);
                            onlineData.forEach(item => store.put(item));
                            await new Promise((resolve, reject) => {
                                tx.oncomplete = resolve;
                                tx.onerror = () => reject(tx.error);
                            });
                        }

                        self.loadedCollections.add(name);
                        self._dispatchLoadProgress();
                        self.lastError = null;
                        return await localDBActions.getAll();
                    } catch (error) {
                        console.warn(`HybridDB: Failed to fetch collection '${name}'. Circuit breaker activated: falling back to local. Error:`, error.message);
                        self.hasOnlineDB = false;
                        self._onlineDisabledUntil = Date.now() + 60000;
                        self.updateConnectionStatusUI();
                        return await localDBActions.getAll();
                    }
                } else {
                    // Instant offline/cached path - no remote network calls
                    try {
                        self.loadedCollections.add(name);
                        self._dispatchLoadProgress();
                        return await localDBActions.getAll();
                    } catch (error) {
                        console.error(`HybridDB: Failed to get list from local DB for collection '${name}':`, error);
                        self.lastError = `Lokal baza xətası (${name}): ${error.message}`;
                        self.updateConnectionStatusUI();
                        throw new Error(`Lokal bazadan oxuna bilmədi: ${error.message}`);
                    }
                }
            },

            // Filters documents/records based on provided criteria (from local storage)
            filter: async (criteria) => {
                try {
                    const localData = await localDBActions.getAll();
                    return localData.filter(item => {
                        // Simple equality check for all criteria properties
                        for (const key in criteria) {
                            if (item[key] !== criteria[key]) return false;
                        }
                        return true;
                    });
                } catch (error) {
                    console.error(`HybridDB: Failed to filter from local DB for collection '${name}':`, error);
                    self.lastError = `Lokal baza xətası (${name}): ${error.message}`;
                    self.updateConnectionStatusUI();
                    throw new Error(`Lokal bazadan oxuna bilmədi: ${error.message}`); // Re-throw to propagate
                }
            },

            // Subscribes to changes.
            // This now sets up the real-time listener but the app.js will initiate it.
            // The method itself just returns the function.
            getListener: (callback) => {
                if (!self.isOnline || !self.onlineDB) {
                    console.log(`HybridDB: Realtime subscription for '${name}' skipped (offline or no online DB).`);
                    return () => {}; // Return a no-op unsubscribe function
                }

                if (self.onlineDBType === 'firebase') {
                    return async () => {
                        const { collection, onSnapshot, query } = await import('firebase/firestore');
                        const q = query(collection(self.onlineDB, name));
                        return onSnapshot(q, async (querySnapshot) => {
                            console.log(`[REALTIME: ${name}] Received Firebase snapshot with ${querySnapshot.docChanges().length} changes.`);
                            
                            // NEW LOGIC: Process changes instead of replacing the whole collection
                            const changes = querySnapshot.docChanges();
                            for (const change of changes) {
                                const docData = { id: change.doc.id, ...change.doc.data() };
                                if (change.type === "added" || change.type === "modified") {
                                    await localDBActions.put(docData);
                                } else if (change.type === "removed") {
                                    await localDBActions.delete(change.doc.id);
                                }
                            }
                            
                            // After applying changes to IndexedDB, get the full updated list from there
                            // and pass it to the callback. This ensures local-only data is preserved until synced.
                            const updatedLocalData = await localDBActions.getAll();
                            callback(updatedLocalData); 

                        }, (error) => {
                            console.warn(`[REALTIME: ${name}] Firebase listener error:`, error.message || error);
                            const errMsg = String(error.message || error.code || '');
                            if (/quota|exhausted|429|resource-exhausted/i.test(errMsg)) {
                                self.hasOnlineDB = false;
                                self._onlineDisabledUntil = Date.now() + 120000;
                            }
                            self.lastError = `Realtime xətası (${name}): ${error.message}`;
                            self.updateConnectionStatusUI();
                        });
                    };
                }
                return () => {}; // No-op for unsupported types
            },
            // NEW: Expose clearLocal
            clearLocal: localDBActions.clear // Expose the local clear method
        };
    }
    
    // NEW: Setup all realtime listeners at once
    setupAllRealtimeListeners() {
        if (!window.app?.collections) return;
        if (!this.canQueryOnline()) return; // Circuit breaker guard
        
        // Unsubscribe from any existing listeners
        Object.values(this.subscriptions).forEach(unsub => typeof unsub === 'function' && unsub());
        this.subscriptions = {};

        console.log("HybridDB: Setting up all realtime listeners...");

        Object.entries(window.app.collections).forEach(async ([key, collectionName]) => {
            const listenerFactory = this.collection(collectionName).getListener((updatedData) => {
                // This is the callback that runs when data changes
                console.log(`[APP] Realtime update for ${collectionName}.`);
                if(window.app && window.app.data) {
                    // Guard: never let a premature/empty local read clobber a dataset that
                    // has already been loaded (e.g. during the initial-fetch race). Only
                    // overwrite with an empty list when we genuinely have nothing stored.
                    const current = window.app.data[key];
                    if (Array.isArray(updatedData) && updatedData.length === 0 &&
                        Array.isArray(current) && current.length > 0) {
                        return;
                    }
                    window.app.data[key] = updatedData;
                    // Trigger UI refresh for the current module if it's affected (Dashboard is kept stable and does not auto-refresh)
                    if (window.app?.currentModule === key && key !== 'dashboard') {
                        window.app?.refreshCurrentModule?.();
                    }
                    // NEW: If staff collection is updated, update AuthManager's internal cache
                    if (collectionName === 'staff' && window.authManager && typeof window.authManager?.updateStaffCache === 'function') {
                        window.authManager.updateStaffCache();
                        // AND refresh the current user's permissions
                        window.authManager.refreshCurrentUserPermissions();
                    }
                    // NEW: If settings are updated, re-apply them across the app
                    if (collectionName === 'settings') {
                        console.log('[Realtime] Settings updated. Re-applying all settings.');
                        window.app?.applySettings?.();
                    }
                }
            });
            
            // Execute the factory to get the actual listener and unsubscribe function
            const unsubscribe = await listenerFactory();
            this.subscriptions[collectionName] = unsubscribe;
        });
    }

    // Returns the current connection status of the hybrid database
    getConnectionStatus() {
        return {
            isOnline: this.isOnline,
            queueLength: this.syncQueue.length,
            lastSyncTime: this.lastSyncTime,
            hasOnlineDB: this.hasOnlineDB, // Whether an online DB is currently connected
            onlineDBType: this.onlineDBType, // Type of the connected online DB
            lastError: this.lastError // Last encountered error during sync/connection
        };
    }

    // Reinitializes the online database connection, typically called when settings change
    async reinitializeDatabase() {
        console.log('HybridDB: Reinitializing database connection and sync status...');
        this.preferredServerDB = 'firebase'; // Always Firestore; never websim/pocketbase/etc.
        this.isSyncing = false; // Reset sync state to allow a new sync
        // Clear existing online DB instance and unsubscribe from listeners
        Object.values(this.subscriptions).forEach(unsub => typeof unsub === 'function' && unsub());
        this.subscriptions = {};
        this.onlineDB = null;
        this.onlineDBType = null;
        this.hasOnlineDB = false;
        this.lastError = null;
        await this.initializeOnlineDB(true); // Re-establish connection
        
        // Force a full data reload in the main app after reinitialization
        if (window.app && typeof window.app?.loadAllData === "function") {
            await window.app?.loadAllData();
        }
        // Force current module to re-render to reflect any changes
        if (window.app && typeof window.app?.refreshCurrentModule === "function") {
            await window.app?.refreshCurrentModule();
        }
        window.notificationManager?.showNotification('info', 'Baza Yeniləndi', 'Baza konfiqurasiyası yeniləndi.', 3000);
    }

    // NEW: forceRemoveLocal - removes an item only from local IndexedDB without queuing for sync.
    // This is useful for manual conflict resolution by superadmins or for cleaning up orphaned data.
    async forceRemoveLocal(collectionName, id) {
        await this.dbReady; // Ensure IndexedDB is ready
        try {
            await this._getStore(collectionName, 'readwrite').delete(id);
            console.log(`HybridDB: Locally force-removed item '${id}' from collection '${collectionName}'. No sync attempted.`);
            return { id, success: true, localOnly: true };
        } catch (error) {
            console.error(`HybridDB: Failed to force remove locally item '${id}' from collection '${collectionName}':`, error);
            throw new Error(`Lokal bazadan məcburi silinmədi: ${error.message}`);
        }
    }
}

// Ensure HybridDB is globally available
window.HybridDB = HybridDB;

// PATCH: Provide `default` export and named export for compatibility with "import ... from './data-manager.js'"
export { HybridDB };
export default HybridDB;
