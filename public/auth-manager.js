// auth-manager.js
//
// Authentication, Email/Password, session mgmt
//

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence, browserLocalPersistence, sendPasswordResetEmail, sendEmailVerification } from "firebase/auth";

export default class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.firebaseAuth = null;
        this.staffCache = [];
        this.notificationManager = window.notificationManager; // Reference to global notification manager
        this.allModules = [
            'dashboard', 'reservations', 'guests', 'rooms', 'services', 'pos', 'cash', 'inventory', 'invoices',
            'staff', 'maintenance', 'reports', 'settings', 'purchase_documents', 'system_errors'
        ];
        this.allActions = [ 'view', 'create', 'edit', 'delete' ];
        this.domReady = false; // Flag to track DOM readiness

        // Only use local/offline auth when the real websim platform (with its /api
        // backend) is present. On the desktop build and on the owner's own deployed
        // website there is no websim backend, so we use the normal Firebase Auth /
        // Firebase database flow instead.
        this.isWebsimPlatform = typeof window.websim === 'object' &&
            typeof window.websim.getUser === 'function';
        this.useLocalAuth = !!this.isWebsimPlatform;

        // DO NOT call initFirebaseAuth or handleInitialAuthUI directly in constructor or DOMContentLoaded.
        // These will be explicitly called by the main app.js initialization sequence
        // after all necessary global objects (firebaseAuth, window.app itself) are ready.

        // This ensures the manager fully initializes with user/app data after login.
        if (!this._authSuccessListenerAdded) {
            window.addEventListener('auth-success', (event) => this.initializeAfterLogin(event?.detail), { once: true });
            this._authSuccessListenerAdded = true;
        }

        this.maxSessionMillis = 3 * 60 * 60 * 1000; // 3 hours
        this.sessionTimer = null;
    }

    /**
     * Initializes Firebase Auth. Should be called only when window.firebaseAuth is guaranteed to be available.
     */
    initFirebaseAuth() {
        if (this.useLocalAuth) {
            console.log('AuthManager: running in websim mode, using local staff auth (no Firebase).');
            this.updateStaffCache();
            this._attemptLocalAuth(); // fire-and-forget; shows main app for the owner, else the login screen
            return;
        }
        if (this.firebaseAuth) {
            console.log('AuthManager: Firebase Auth already initialized.');
            return;
        }
        if (window.firebaseAuth) {
            this.firebaseAuth = window.firebaseAuth;
            console.log('AuthManager: Firebase Auth initialized from window object.');
            // After firebaseAuth is set, we can setup the listener.
            this.setupAuthStateListener();
            this.updateStaffCache(); // Update cache here for initial data, requires window.app.data.staff
        } else {
            // Firebase can still be downloading while the local app is ready.
            // Do not turn that normal transient state into a blocking error.
            console.warn('AuthManager: Firebase Auth is not ready yet; continuing with local startup.');
            this.showLoginScreen();
        }
    }

    /**
     * Completes AuthManager initialization after the main HotelPMS app is fully ready.
     * This method is called from app.js *after* app.ws is assigned.
     */
    initializeAfterAppReady() {
        // This method is primarily for setting up the auth state listener,
        // which itself will trigger the deeper initialization steps.
        // The `initFirebaseAuth()` should already have been called by this point.
        console.log('AuthManager: App is ready, auth state listener should be active.');
    }

    // Verify a plaintext password against the stored SHA-256 hash.
    async _hashPassword(password) {
        try {
            const data = new TextEncoder().encode('rbhotel-pms::' + password);
            const buf = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            // Fallback if crypto.subtle is unavailable.
            let h = 5381;
            const s = 'rbhotel-pms::' + password;
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
            return 'djb2' + (h >>> 0).toString(16);
        }
    }

    _loginError(msg) {
        this.displayLoginFormError(msg);
        this.notificationManager?.showNotification('error', 'Giriş Xətası', msg, 6000);
    }

    _registerError(msg) {
        this.displayRegisterFormError(msg);
        this.notificationManager?.showNotification('error', 'Qeydiyyat Xətası', msg, 6000);
    }

    // On websim, auto-sign-in the project owner (already authenticated by the platform).
    async _attemptLocalAuth() {
        try {
            const res = await fetch('/api/auth/whoami', { method: 'GET' });
            const type = (res.headers.get('content-type') || '').toLowerCase();
            if (!res.ok || !type.includes('application/json')) {
                // The websim backend is unavailable (e.g. running outside websim) —
                // silently fall back to the normal login flow.
                this.handleAuthUIUpdate();
                return;
            }
            const info = await res.json();
            if (info && info.isOwner && info.user_id) {
                console.log('AuthManager: project owner detected, signing in as superadmin.');
                await this._finalizeWebsimLogin(null, info.user_id, 'r.bagrv1@gmail.com');
                return;
            }
        } catch (e) {
            console.warn('AuthManager: websim owner auto-login check failed:', e);
        }
        this.handleAuthUIUpdate(); // Not the owner -> show the login form.
    }

    // No Firebase needed here - this is the whole post-login flow for the PNG UI.
    async _finalizeWebsimLogin(existingStaff, uid, email) {
        let appReadyRetries = 0;
        while (!window.app && appReadyRetries < 50) {
            await new Promise(r => setTimeout(r, 100));
            appReadyRetries++;
        }
        if (!window.app) {
            this.handleAuthUIUpdate();
            return;
        }
        try {
            if (!window.app._coreInitialized) await window.app.coreInitialize();

            const user = { uid, email, displayName: existingStaff?.name || 'İstifadəçi' };
            const staffRecord = await window.app.ensureUserStaffRecordExists(user);
            if (!staffRecord) throw new Error("İstifadəçi profili yaradıla bilmədi.");

            // Ensure the record is present in the local cache so it isn't overwritten later.
            if (window.app.data && Array.isArray(window.app.data.staff)) {
                if (!window.app.data.staff.some(s => s.id === staffRecord.id)) {
                    window.app.data.staff.push(staffRecord);
                }
            }
            this.updateStaffCache();

            const userRole = staffRecord?.role || 'staff';
            const defaultPerms = this.getRolePermissions(userRole);
            const customPerms = staffRecord.permissions || {};
            let basePermissions = defaultPerms;
            if ((userRole === 'admin' || userRole === 'superadmin') && staffRecord.permissions !== undefined && staffRecord.permissions !== null) {
                basePermissions = staffRecord.permissions;
            }
            const effectivePermissions = { ...basePermissions };
            if (userRole !== 'admin' && userRole !== 'superadmin' || staffRecord.permissions === undefined || staffRecord.permissions === null) {
                for (const module in customPerms) {
                    if (!effectivePermissions[module]) effectivePermissions[module] = [];
                    effectivePermissions[module] = Array.from(new Set([...effectivePermissions[module], ...customPerms[module]]));
                }
            }

            this.currentUser = {
                uid,
                email,
                name: staffRecord?.name || email,
                role: userRole,
                permissions: effectivePermissions,
                isSuperadmin: Boolean(staffRecord?.isSuperadmin) || email === 'r.bagrv1@gmail.com',
                loginTime: new Date().toISOString(),
                telegramId: staffRecord?.telegramId,
                status: staffRecord?.status || 'inactive'
            };

            if (this.currentUser.status === 'active') {
                this.isAuthenticated = true;
                localStorage.setItem('hotelPmsAuth', JSON.stringify({
                    uid,
                    email,
                    expiresAt: Date.now() + this.maxSessionMillis,
                    user: this.currentUser
                }));
                if (window.app?.recordLoginAudit) await window.app.recordLoginAudit(uid, this.currentUser.name, email);
                if (!window.app.isInitialized) await window.app.initialize();
                this.handleAuthUIUpdate();
                window.dispatchEvent(new CustomEvent('auth-success', { detail: this.currentUser }));
                window.app?.refreshCurrentModule?.();
                this.notificationManager?.initNotificationSystem();
                this.initializeAfterLogin(this.currentUser);
                this.startSessionTimer(this.currentUser.loginTime);
            } else {
                this.isAuthenticated = false;
                this.handleAuthUIUpdate();
                this.notificationManager?.showNotification('warning', 'Hesab Aktiv Deyil', 'Hesabınız administrator tərəfindən təsdiqlənməyi gözləyir. Zəhmət olmasa, admin ilə əlaqə saxlayın.', 10000);
            }
        } catch (error) {
            console.error("CRITICAL: Error during websim login flow.", error);
            this.isAuthenticated = false;
            this.displayLoginFormError(`Giriş prosesində xəta baş verdi: ${error.message}`);
            this.handleAuthUIUpdate();
        }
    }

    async _loginLocal(email, password) {
        this.updateStaffCache();
        const normEmail = (email || '').trim().toLowerCase();
        const staff = this.staffCache.find(s => s.email && String(s.email).toLowerCase() === normEmail);
        if (!staff) {
            this._loginError('Yanlış email və ya şifrə.');
            return;
        }
        if (staff.status !== 'active') {
            this._loginError('Hesabınız aktiv deyil. Administratorla əlaqə saxlayın.');
            return;
        }
        if (!staff.passwordHash) {
            this._loginError('Bu istifadəçi üçün şifrə təyin edilməyib. Administratorla əlaqə saxlayın.');
            return;
        }
        const hash = await this._hashPassword(password);
        if (hash !== staff.passwordHash) {
            this._loginError('Yanlış email və ya şifrə.');
            return;
        }
        await this._finalizeWebsimLogin(staff, staff.id || staff.email, staff.email || normEmail);
    }

    async _registerLocal(email, password, name) {
        await window.app?.coreInitialize?.();
        this.updateStaffCache();
        const normEmail = (email || '').trim().toLowerCase();
        const exists = this.staffCache.some(s => s.email && String(s.email).toLowerCase() === normEmail);
        if (exists) {
            this._registerError('Bu email artıq qeydiyyatdan keçib.');
            return;
        }
        const potentialFirstUser = (window.app?.data?.staff || []).length === 0;
        const newStaff = {
            id: 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            publicId: window.app?.generateSequentialPublicId ? window.app.generateSequentialPublicId('staff') : undefined,
            name: (name || email.split('@')[0]).trim(),
            email: normEmail,
            phone: '',
            telegramId: '',
            position: potentialFirstUser ? 'Baş Admin' : 'Yeni İşçi',
            department: 'İdarəetmə',
            salary: 0,
            startDate: window.app?.getTodayDateString ? window.app.getTodayDateString() : new Date().toISOString().split('T')[0],
            status: 'inactive',
            role: 'staff',
            isSuperadmin: false,
            permissions: this.getRolePermissions('staff'),
            passwordHash: await this._hashPassword(password),
            createdAt: new Date().toISOString(),
            createdBy: 'registration'
        };
        await window.app.ws.collection('staff').create(newStaff);
        window.app.data.staff.push(newStaff);
        this.updateStaffCache();
        this.notificationManager?.showNotification('success', 'Qeydiyyat Tamamlandı', 'Hesabınız yaradıldı. Administrator təsdiqlədikdə daxil ola bilərsiniz.', 8000);
    }

    // --- PATCH: Add method to update staff cache for local matching. This solves possible out-of-sync issues between staff modal and auth logic. ---
    updateStaffCache() {
        try {
            this.staffCache = [];
            // Rely ONLY on window.app.data.staff which is managed by HybridDB
            // Use optional chaining for nested properties for robustness
            if (window.app?.data?.staff && Array.isArray(window.app.data.staff)) {
                this.staffCache = window.app.data.staff;
            } else {
                console.warn('AuthManager: window.app.data.staff not available when updating staff cache. Cache might be empty or stale.');
            }
            // PATCH: Additionally, ensure 734378254 user is always present and superadmin by id, telegramId, or email.
            const superadminId = '734378254';
            const superadminEmail = 'r.bagrv1@gmail.com';
            
            // Check for existence of the hardcoded superadmin in various ways
            const alreadyHas = this.staffCache.find(s =>
                String(s.id) === superadminId ||
                (s.telegramId && String(s.telegramId) === superadminId) ||
                (s.email && String(s.email).toLowerCase() === superadminEmail)
            );
            
            if (!alreadyHas) {
                // Add both telegramId and email linkage
                this.staffCache.push({
                    id: superadminId,
                    firebaseUid: superadminId, // Ensure Firebase UID is set for this hardcoded superadmin
                    name: "Rəşad Bağırov",
                    email: superadminEmail,
                    phone: "+994558409394",
                    telegramId: superadminId,
                    position: "Baş Admin",
                    department: "İdarəetmə",
                    salary: 0,
                    startDate: new Date().toISOString().split('T')[0],
                    status: "active",
                    role: "admin",
                    permissions: this.getRolePermissions('admin'),
                    isSuperadmin: true,
                    createdAt: new Date().toISOString()
                });
            }
        } catch (e) {
            console.error('Failed to update staff cache:', e);
        }
    }

    handleAuthUIUpdate() {
        // Now using DOMContentLoaded to set this.domReady, but the primary call is from app.js init.
        // This method also ensures the call to updateHotelNameInUI is safe by checking window.app.
        window.app?.updateHotelNameInUI?.(); // The problematic call, now handled more defensively by app.js's orchestration.

        const firebaseUser = this.firebaseAuth?.currentUser;
        
        if (this.isAuthenticated && this.currentUser?.status === 'active') {
            this.showMainApp();
        } else if (firebaseUser && this.currentUser?.status === 'inactive') {
            // This case handles when a user is logged in via Firebase but is marked as inactive in our system
            this.showPendingApprovalScreen();
        } else if (firebaseUser && !this.currentUser) {
            // New case: User is logged in to Firebase, but we don't have a staff record for them yet.
            // This can happen during initial registration flow. We show the pending screen.
            this.showPendingApprovalScreen();
        }
        else {
            // This covers both "not logged in to Firebase" and any other inconsistent states.
            this.showLoginScreen();
        }
    }

    setupAuthStateListener() {
        // Ensure firebaseAuth is indeed available before proceeding
        if (!this.firebaseAuth) {
            console.error('AuthManager: Cannot set up auth state listener, firebaseAuth is not initialized.');
            return;
        }

        onAuthStateChanged(this.firebaseAuth, async (user) => {
            // Ensure window.app is available before trying to access its properties/methods
            let appReadyRetries = 0;
            const maxAppReadyRetries = 50; // Max 5 seconds wait
            while (!window.app && appReadyRetries < maxAppReadyRetries) {
                await new Promise(resolve => setTimeout(resolve, 100));
                appReadyRetries++;
            }
            if (!window.app) {
                console.error("CRITICAL: window.app not available after waiting. Cannot proceed with authentication logic.");
                await this.logout("Sistem yüklənmədi. Zəhmət olmasa, səhifəni yeniləyin.");
                return;
            }

            if (user) {
                console.log('Firebase: User signed in:', user.email, user.uid);

                try {
                    // This block contains the entire post-authentication flow.
                    // Any failure here will be caught and will trigger a logout with a specific error message.

                    if (!window.app._coreInitialized) {
                        await window.app.coreInitialize();
                    }

                    const staffRecord = await window.app.ensureUserStaffRecordExists(user);
                    
                    if (!staffRecord) {
                        throw new Error("İstifadəçi profili yaradıla bilmədi.");
                    }

                    // --- START FIX: Ensure created staff record is not overwritten by subsequent data load ---
                    // Before full initialization, make sure the current user's staff record is present in the local data cache.
                    // This prevents a race condition where `loadAllData` might fetch data before the new user's record is synced.
                    if (window.app && window.app.data && Array.isArray(window.app.data.staff)) {
                        const existsInCache = window.app.data.staff.some(s => s.id === staffRecord.id);
                        if (!existsInCache) {
                            window.app.data.staff.push(staffRecord);
                        }
                    }
                    // --- END FIX ---

                    this.updateStaffCache();

                    const userRole = staffRecord?.role || 'staff';
                    const defaultPerms = this.getRolePermissions(userRole);
                    const customPerms = staffRecord.permissions || {};
                    
                    let basePermissions = defaultPerms;

                    // NEW: If the user is an admin/superadmin AND has explicit custom permissions defined (i.e., staffRecord.permissions is not null/undefined),
                    // we use those custom permissions as the definitive set, overriding the 'full access' default, to enforce granular control.
                    if ((userRole === 'admin' || userRole === 'superadmin') && staffRecord.permissions !== undefined && staffRecord.permissions !== null) {
                        basePermissions = staffRecord.permissions;
                        console.log(`[AuthManager] ${userRole} found with explicit custom permissions. Overriding full access default for granular control.`);
                    }
                    
                    // Merge permissions: custom overrides/additions take precedence
                    const effectivePermissions = { ...basePermissions };
                    
                    // Standard merging only if we are NOT using custom permissions as the definitive source (i.e., for staff/manager roles, or unrestricted admins).
                    if (userRole !== 'admin' && userRole !== 'superadmin' || staffRecord.permissions === undefined || staffRecord.permissions === null) {
                        for (const module in customPerms) {
                            // Ensure module exists on effectivePermissions before merging
                            if (!effectivePermissions[module]) {
                                effectivePermissions[module] = [];
                            }
                            effectivePermissions[module] = Array.from(new Set([...effectivePermissions[module], ...customPerms[module]]));
                        }
                    }

                    this.currentUser = {
                        uid: user.uid,
                        email: user.email,
                        name: staffRecord?.name || user.email,
                        role: userRole,
                        permissions: effectivePermissions,
                        isSuperadmin: Boolean(staffRecord?.isSuperadmin) || (user.uid === 'C2vbmiUTBpSr4w2dSDZRkBZToRK2'),
                        loginTime: new Date().toISOString(),
                        telegramId: staffRecord?.telegramId,
                        status: staffRecord?.status || 'inactive'
                    };

                    if (this.currentUser.status === 'active') {
                        this.isAuthenticated = true;
                        const rememberMe = document.getElementById('rememberMeCheckbox')?.checked;
                        await setPersistence(this.firebaseAuth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

                        localStorage.setItem('hotelPmsAuth', JSON.stringify({
                            uid: user.uid,
                            email: user.email,
                            expiresAt: Date.now() + this.maxSessionMillis,
                            user: this.currentUser
                        }));

                        if (window.app?.recordLoginAudit) {
                            await window.app.recordLoginAudit(user.uid, this.currentUser.name, user.email);
                        }
                        
                        if (!window.app.isInitialized) {
                            await window.app.initialize();
                        }
                        this.handleAuthUIUpdate();
                        window.dispatchEvent(new CustomEvent('auth-success', { detail: this.currentUser }));
                        window.app?.refreshCurrentModule?.();
                        this.notificationManager?.initNotificationSystem();

                    } else {
                        this.isAuthenticated = false;
                        this.handleAuthUIUpdate(); // Show pending approval screen
                        this.notificationManager.showNotification('warning', 'Hesab Aktiv Deyil', 'Hesabınız administrator tərəfindən təsdiqlənməyi gözləyir. Zəhmət olmasa, admin ilə əlaqə saxlayın.', 10000);
                        return;
                    }

                } catch (error) {
                    console.error("CRITICAL: Error during post-authentication flow. Logging out.", error);
                    let specificError = `Giriş prosesində xəta baş verdi: ${error.message}`;
                    const errorMessageLower = error.message.toLowerCase();
                    if (errorMessageLower.includes('permission-denied') || errorMessageLower.includes('missing or insufficient permissions')) {
                         specificError = 'Giriş uğursuz oldu. İstifadəçi məlumatlarını oxumaq/yazmaq üçün icazə yoxdur. Zəhmət olmasa, Firebase Təhlükəsizlik Qaydalarını (Security Rules) yoxlayın.';
                    }
                    await this.logout(specificError);
                }

            } else {
                // User is signed out.
                console.log('Firebase: User signed out.');
                this.isAuthenticated = false;
                this.currentUser = null;
                localStorage.removeItem('hotelPmsAuth');
                // Handle UI update (show main app or login screen) only after DOM is ready
                this.handleAuthUIUpdate();
                if (this.sessionTimer) clearInterval(this.sessionTimer); // Clear session timer
                window.dispatchEvent(new CustomEvent('logout')); // Custom logout event
                
                // --- PATCH: When logging out, also reset isInitialized and _coreInitialized flags ---
                if (window.app) {
                    window.app.isInitialized = false;
                    window.app._coreInitialized = false;
                }
            }
        });
    }

    // This method is now solely called from app.js init() after DOM is ready and window.app is established.
    handleInitialAuthUI() {
        this.domReady = true; // Ensure this is set
        // Trigger the actual UI update logic based on current auth state
        this.handleAuthUIUpdate();
        // Call the consolidated branding update method from window.app
        // window.app?.updateHotelNameInUI?.(); // The primary call is now directly in handleAuthUIUpdate. This is redundant.
        this.setupAuthFormListeners(); // Setup event listeners for auth forms

        // Load remembered email if "Məni xatırla" was checked previously
        const loginEmailInput = document.getElementById('loginEmail');
        const rememberMeCheckbox = document.getElementById('rememberMeCheckbox');
        if (loginEmailInput && rememberMeCheckbox) {
            const rememberedEmail = localStorage.getItem('pms_remembered_email');
            if (rememberedEmail) {
                loginEmailInput.value = rememberedEmail;
                rememberMeCheckbox.checked = true;
            } else {
                rememberMeCheckbox.checked = true; // Default to checked if no email is remembered
            }
        }
    }

    async login(email, password) {
        const loginBtn = document.getElementById('loginBtn');
        if (this.useLocalAuth) {
            try {
                if (loginBtn) {
                    loginBtn.disabled = true;
                    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Daxil olunur...';
                }
                this.displayLoginFormError(''); // Clear previous error
                await this._loginLocal(email, password);
            } finally {
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Daxil ol';
                }
            }
            return;
        }
        try {
            // NEW: Add guard clause if firebaseAuth is not initialized
            if (!this.firebaseAuth) {
                console.error("AuthManager.login called, but firebaseAuth is not initialized.");
                this.displayLoginFormError("Authentication service is not ready. Please try again in a moment.");
                return;
            }

            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Daxil olunur...';
            }
            // Clear previous error messages on new attempt
            this.displayLoginFormError(''); // Clear previous error

            // Handle "Remember Me" persistence BEFORE sign-in
            const rememberMe = document.getElementById('rememberMeCheckbox')?.checked;
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            
            await setPersistence(this.firebaseAuth, persistence);
            
            if (rememberMe) {
                localStorage.setItem('pms_remembered_email', email);
            } else {
                localStorage.removeItem('pms_remembered_email');
            }

            const userCredential = await signInWithEmailAndPassword(this.firebaseAuth, email, password);

            // Cache password hash locally for seamless offline fallback
            try {
                const hash = await this._hashPassword(password);
                const normEmail = (email || '').trim().toLowerCase();
                const staffMember = (window.app?.data?.staff || []).find(s => s.email && String(s.email).toLowerCase() === normEmail);
                if (staffMember && window.app?.ws) {
                    staffMember.passwordHash = hash;
                    await window.app.ws.collection('staff').upsert(staffMember);
                }
            } catch (err) {
                console.warn('Could not cache offline password hash:', err);
            }

            // onAuthStateChanged listener will handle the rest (setting currentUser, showing app etc.)
            return userCredential.user;

        } catch (error) {
            console.error('Firebase Login Error:', error);

            // Offline / network failure fallback to local authentication
            const isNetworkError = !navigator.onLine || (error && (error.code === 'auth/network-request-failed' || String(error.message || '').toLowerCase().includes('network')));
            if (isNetworkError) {
                console.log('Firebase login offline/network error. Attempting local staff authentication fallback...');
                this.updateStaffCache();
                const normEmail = (email || '').trim().toLowerCase();
                const staff = this.staffCache.find(s => s.email && String(s.email).toLowerCase() === normEmail);
                if (staff) {
                    await this._loginLocal(email, password);
                    return;
                }
            }

            let errorMessage = 'Giriş uğursuz oldu. Zəhmət olmasa email və şifrəni yoxlayın.';
            
            // --- FIX: Add a defensive check for the error object ---
            if (error && error.code) {
                if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Yanlış email formatı.';
                } else if (error.code === 'auth/user-disabled') {
                    errorMessage = 'Hesabınız deaktiv edilib.';
                } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    errorMessage = 'Yanlış email və ya şifrə.';
                } else if (error.code === 'auth/too-many-requests') {
                    errorMessage = 'Çox sayda uğursuz cəhd. Zəhmət olmasa, bir azdan yenidən cəhd edin.';
                } else if (error.code === 'permission-denied') {
                    errorMessage = 'Firebase-ə qoşularkən icazə xətası. Təhlükəsizlik qaydalarını yoxlayın.';
                }
            } else if (error && error.message) {
                // If there's no code but there is a message, use that.
                errorMessage = error.message;
            }
            
            // Use NotificationManager for a general toast notification
            window.notificationManager?.showNotification('error', 'Giriş Xətası', errorMessage, 6000); 
            
            // Also display error message directly on the login form for immediate user feedback
            this.displayLoginFormError(errorMessage);

        } finally {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Daxil ol';
            }
        }
    }

    async register(email, password, name) {
        const registerBtn = document.getElementById('registerBtn');
        // Client-side password validation
        const registerPasswordInput = document.getElementById('registerPassword');
        const registerConfirmPasswordInput = document.getElementById('registerConfirmPassword');
        if (password.length < 6) {
            this.displayRegisterFormError('Şifrə ən azı 6 simvol uzunluğunda olmalıdır.');
            if (registerPasswordInput) registerPasswordInput.focus();
            return;
        }
        if (registerConfirmPasswordInput && password !== registerConfirmPasswordInput.value) {
            this.displayRegisterFormError('Şifrələr uyğun gəlmir.');
            registerConfirmPasswordInput.focus();
            return;
        }
        if (this.useLocalAuth) {
            try {
                if (registerBtn) {
                    registerBtn.disabled = true;
                    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Qeydiyyatdan keçir...';
                }
                this.displayRegisterFormError(''); // Clear previous error
                await this._registerLocal(email, password, name);
            } finally {
                if (registerBtn) {
                    registerBtn.disabled = false;
                    registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Qeydiyyatdan keç';
                }
            }
            return;
        }
        try {
            // Client-side password validation
            if (password.length < 6) {
                this.displayRegisterFormError('Şifrə ən azı 6 simvol uzunluğunda olmalıdır.');
                registerPasswordInput.focus();
                return;
            }
            if (password !== registerConfirmPasswordInput.value) {
                this.displayRegisterFormError('Şifrələr uyğun gəlmir.');
                registerConfirmPasswordInput.focus();
                return;
            }

            // Ensure window.app is available before proceeding.
            let appReadyRetries = 0;
            const maxAppReadyRetries = 50; 
            while (!window.app && appReadyRetries < maxAppReadyRetries) {
                await new Promise(resolve => setTimeout(resolve, 100));
                appReadyRetries++;
            }
            if (!window.app) {
                throw new Error("Sistem yüklənmir. Zəhmət olmasa, səhifəni yeniləyin.");
            }

            const userCredential = await createUserWithEmailAndPassword(this.firebaseAuth, email, password);
            const user = userCredential.user;

            // Send email verification
            await sendEmailVerification(user);
            window.notificationManager?.showNotification('info', 'E-poçtu təsdiqləyin', 'Qeydiyyatınız tamamlandı. Zəhmət olmasa, e-poçt ünvanınızı təsdiqləmək üçün göndərilən linki yoxlayın.', 8000);

            // The onAuthStateChanged listener will now handle subsequent logic including
            // calling ensureUserStaffRecordExists, loading data, and updating UI.

            if (window.notificationManager) {
                window.notificationManager.showNotification('success', 'Uğurlu Qeydiyyat', 'Hesabınız yaradıldı. Avtomatik olaraq daxil olacaqsınız.', 4500);
            }

            return user;

        } catch (error) {
            console.error('Firebase Registration Error:', error);
            let errorMessage = 'Qeydiyyat uğursuz oldu. Zəhmət olmasa məlumatları yoxlayın.';
            // --- FIX: Add a defensive check for the error object ---
            if (error && error.code) {
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'Bu email artıq qeydiyyatdan keçib.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Yanlış email formatı.';
                } else if (error.code === 'auth/weak-password') { // Firebase also checks weak password, but client-side also good.
                    errorMessage = 'Şifrə çox zəifdir (ən azı 6 simvol).';
                } else if (error.code === 'auth/network-request-failed') {
                    errorMessage = 'Şəbəkə bağlantısı problemi. İnternetinizi yoxlayın.';
                }
            } else if (error && error.message) {
                 if (error.message.includes("Sistem tam yüklənməyib")) { // Catch our custom error
                    errorMessage = error.message;
                } else {
                    errorMessage = error.message;
                }
            }

            window.notificationManager?.showNotification('error', 'Qeydiyyat Xətası', errorMessage, 6000);
            // Also display error message directly on the register form
            this.displayRegisterFormError(errorMessage);

            throw error;
        } finally {
            const registerBtn = document.getElementById('registerBtn');
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Qeydiyyatdan keç';
            }
        }
    }

    /**
     * NEW: Refreshes the currently logged-in user's permissions from the staff cache.
     * This should be called whenever the 'staff' data collection is updated.
     */
    refreshCurrentUserPermissions() {
        if (!this.currentUser) {
            return; // No user logged in, nothing to refresh
        }

        const staffRecord = this._findStaffForCurrentUser();

        if (staffRecord) {
            console.log(`[AuthManager] Refreshing permissions for current user: ${this.currentUser.email}`);

            const effectivePermissions = this._computeEffectivePermissions(staffRecord);
            const userRole = staffRecord.role || 'staff';

            // Update the live currentUser object
            this.currentUser.role = userRole;
            this.currentUser.permissions = effectivePermissions;
            this.currentUser.isSuperadmin = Boolean(staffRecord?.isSuperadmin);
            this.currentUser.status = staffRecord?.status || 'inactive';

            // After refreshing permissions, also re-evaluate sidebar visibility and check for status changes
            if (typeof window.updateSidebarVisibilityBasedOnPermissions === 'function') {
                window.updateSidebarVisibilityBasedOnPermissions();
            }

            // If user's status was changed to inactive, log them out.
            if (this.currentUser.status !== 'active') {
                this.logout("Hesabınız administrator tərəfindən deaktiv edildi.");
            }

        } else {
            // This case is problematic. The current user's staff record might have been deleted.
            // Forcing a logout is the safest action.
            console.warn(`[AuthManager] Could not find staff record for current user during permission refresh. Forcing logout.`);
            this.logout("Sizin istifadəçi profiliniz sistemdən silinib.");
        }
    }

    // New: Method to send password reset email
    async resetPassword(email) {
        try {
            if (this.useLocalAuth) {
                this.notificationManager?.showNotification('warning', 'Şifrə Bərpası', 'Şifrəni sıfırlamaq üçün administratorla əlaqə saxlayın.', 6000);
                return false;
            }
            if (!email) {
                throw new Error("E-poçt ünvanı daxil edin.");
            }
            await sendPasswordResetEmail(this.firebaseAuth, email);
            window.notificationManager?.showNotification('success', 'Şifrə Bərpası', 'Şifrəni sıfırlama linki e-poçtunuza göndərildi. Zəhmət olmasa inbox-unuzu yoxlayın.', 8000);
            return true;
        } catch (error) {
            console.error('Password Reset Error:', error);
            let errorMessage = 'Şifrə sıfırlamaq mümkün olmadı.';
            if (error && error.code) {
                if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Yanlış e-poçt formatı.';
                } else if (error.code === 'auth/user-not-found') {
                    errorMessage = 'Bu e-poçt ünvanı ilə istifadəçi tapılmadı.';
                } else if (error.code === 'auth/network-request-failed') {
                    errorMessage = 'Şəbəkə bağlantısı problemi. İnternetinizi yoxlayın.';
                }
            } else if (error && error.message) {
                errorMessage = error.message;
            }
            window.notificationManager?.showNotification('error', 'Şifrə Bərpası Xətası', errorMessage, 6000);
            throw error;
        }
    }

    // Utility to display login form errors
    displayLoginFormError(message) {
        const loginErrorMessageDiv = document.getElementById('loginErrorMessage');
        if (loginErrorMessageDiv) {
            if (message) {
                loginErrorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
                loginErrorMessageDiv.style.display = 'block';
            } else {
                loginErrorMessageDiv.style.display = 'none';
                loginErrorMessageDiv.innerHTML = '';
            }
        }
    }

    // Utility to display registration form errors
    displayRegisterFormError(message) {
        const registerErrorMessageDiv = document.getElementById('registerErrorMessage');
        if (registerErrorMessageDiv) {
            if (message) {
                registerErrorMessageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
                registerErrorMessageDiv.style.display = 'block';
            } else {
                registerErrorMessageDiv.style.display = 'none';
                registerErrorMessageDiv.innerHTML = '';
            }
        }
    }

    // New: Setup listeners for login/register form elements
    setupAuthFormListeners() {
        // "Forgot password" link
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', async (e) => {
                e.preventDefault();
                const emailInput = document.getElementById('loginEmail');
                const email = emailInput ? emailInput.value.trim() : '';

                const enteredEmail = await window.modalManager.showPromptModal(
                    'Şifrəni Bərpa Et',
                    'Şifrəni sıfırlamaq üçün e-poçt ünvanınızı daxil edin:',
                    email,
                    'email'
                );
                if (enteredEmail) {
                    await this.resetPassword(enteredEmail);
                }
            });
        }
    }

    async logout(message) {
        try {
            if (this.firebaseAuth) {
                await signOut(this.firebaseAuth);
            }
            // onAuthStateChanged listener will handle UI changes
            this.notificationManager?.showNotification('info', 'Çıxış', message || 'Sistemdən çıxış etdiniz', 4000, false);
            // NEW: Also display the logout reason on the login form for persistence
            if (message) {
                this.displayLoginFormError(message);
            }
        } catch (error) {
            console.error('Firebase Logout Error:', error);
            const errorMessage = error.message || 'Çıxış uğursuz oldu.';
            this.notificationManager?.showNotification('error', 'Çıxış Xətası', errorMessage, 3000, false);
            this.displayLoginFormError(errorMessage);
        }
    }

    showLoginScreen() {
        // Defensive checks for all elements
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        const notificationContainer = document.getElementById('notificationContainer');
        const pendingApprovalScreen = document.getElementById('pendingApprovalScreen'); // NEW
        
        const loginEmail = document.getElementById('loginEmail');
        const loginPassword = document.getElementById('loginPassword');
        const registerEmail = document.getElementById('registerEmail');
        const registerPassword = document.getElementById('registerPassword');
        const registerName = document.getElementById('registerName');
        const loginErrorMessageDiv = document.getElementById('loginErrorMessage');
        const registerErrorMessageDiv = document.getElementById('registerErrorMessage');
        const loginFormContainer = document.getElementById('loginFormContainer');
        const registerFormContainer = document.getElementById('registerFormContainer');
        const registerConfirmPassword = document.getElementById('registerConfirmPassword');

        if (loginScreen) {
            loginScreen.style.display = 'flex';
        }
        if (mainApp) { // defensive check
            mainApp.style.display = 'none';
        }
        if (pendingApprovalScreen) { // NEW
            pendingApprovalScreen.style.display = 'none';
        }

        document.body.classList.add('login-active');
        // Call the consolidated branding update method from window.app
        window.app?.updateHotelNameInUI?.(); // NEW: Call the app's method

        // Hide notifications container during login
        if (notificationContainer) { // defensive check
            notificationContainer.style.display = 'none';
        }

        // Clear input fields (defensive check for existence)
        if (loginEmail) loginEmail.value = '';
        if (loginPassword) loginPassword.value = '';
        if (registerEmail) registerEmail.value = '';
        if (registerPassword) registerPassword.value = '';
        if (registerConfirmPassword) registerConfirmPassword.value = ''; // Clear confirm password field as well
        if (registerName) registerName.value = '';

        // Hide login error message only if it wasn't just set by a logout
        if (loginErrorMessageDiv && !loginErrorMessageDiv.textContent.includes('Sistemdən çıxış etdiniz')) {
            // loginErrorMessageDiv.style.display = 'none'; // This was commented out, but it's better to clear it unless it's a specific logout message
        }
        // Hide registration error message
        if (registerErrorMessageDiv) registerErrorMessageDiv.style.display = 'none';

        // Show login form, hide registration form
        if (loginFormContainer) loginFormContainer.style.display = 'block';
        if (registerFormContainer) registerFormContainer.style.display = 'none';

        if (typeof window.dismissSplashScreen === 'function') {
            window.dismissSplashScreen();
        }
    }

    showMainApp() {
        // Defensive checks for all elements
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        const notificationContainer = document.getElementById('notificationContainer');
        const pendingApprovalScreen = document.getElementById('pendingApprovalScreen'); // NEW

        const userNameEl = document.getElementById('currentUserName');

        if (loginScreen) { // defensive check
            loginScreen.style.display = 'none';
        }
        if (mainApp) { // defensive check
            mainApp.style.display = 'flex';
        }
        if (pendingApprovalScreen) { // NEW
            pendingApprovalScreen.style.display = 'none';
        }

        document.body.classList.remove('login-active');

        if (typeof window.dismissSplashScreen === 'function') {
            window.dismissSplashScreen();
        }

        // Show notifications container in main app
        if (notificationContainer) { // defensive check
            notificationContainer.style.display = 'block';
        }
        
        // Update current user name in header
        if (userNameEl && this.currentUser) { // defensive check
            const firstName = (this.currentUser.name || '').split(' ')[0];
            userNameEl.textContent = firstName || this.currentUser.email || "İstifadəçi";
        }
    }

    /**
     * NEW: Displays the screen indicating that the user's account is pending approval.
     */
    showPendingApprovalScreen() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        const pendingApprovalScreen = document.getElementById('pendingApprovalScreen');
        const notificationContainer = document.getElementById('notificationContainer');

        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'none';
        if (pendingApprovalScreen) pendingApprovalScreen.style.display = 'flex'; // Show this screen
        
        document.body.classList.add('login-active'); // Keep login-active class for background styling
        
        if (notificationContainer) notificationContainer.style.display = 'none'; // Hide notifications
        
        // Call the consolidated branding update method from window.app
        window.app?.updateHotelNameInUI?.(); // NEW: Call the app's method
    }

    startSessionTimer(loginTimeIso) {
        if (this.sessionTimer) clearInterval(this.sessionTimer);
        const loginTime = typeof loginTimeIso === 'string' ? new Date(loginTimeIso).getTime() : Date.now();
        const maxMillis = this.maxSessionMillis;
        const sessionEnd = loginTime + maxMillis;

        this.sessionTimer = setInterval(() => {
            const now = Date.now();
            if (now >= sessionEnd) {
                clearInterval(this.sessionTimer);
                this.logout('3 saatlıq sessiya müddəti bitdi. Yenidən daxil olun.');
            }
        }, 10000); // Check every 10 seconds
    }

    showNotification(type, title, message, showUnderInput = false) {
        // Regular notification
        const container = document.getElementById('notificationContainer');
        if (!container) return;

        if (showUnderInput) {
            // Remove any existing error messages
            const existingError = document.querySelector('.input-error-message');
            if (existingError) {
                existingError.remove();
            }
            
            // This part of code needs to be adjusted based on the new login form fields if we want specific input errors.
            // For now, it will just show a general notification.
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const iconMap = {
            success: 'fas fa-check',
            error: 'fas fa-times',
            warning: 'fas fa-exclamation',
            info: 'fas fa-info'
        };

        notification.innerHTML = `
            <div class="notification-icon">
                <i class="${iconMap[type]}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
            // Also remove input error if exists
            if (showUnderInput) {
                const errorMsg = document.querySelector('.input-error-message');
                if (errorMsg) errorMsg.remove();
            }
        }, 5000);
    }

    getRolePermissions(role) {
        // Superadmin bypass - ALWAYS has all permissions (This check is done in hasPermission for specific user)
        // This method strictly returns default role definitions.
        
        // Default permissions by role
        const permissions = {
            admin: {}, // Admin has all permissions by default from allModules/allActions
            manager: {
                dashboard: ['view'],
                reservations: ['view', 'create', 'edit'],
                guests: ['view', 'create', 'edit'],
                rooms: ['view', 'create', 'edit'],
                services: ['view', 'create', 'edit'],
                pos: ['view', 'create'],
                cash: ['view', 'create', 'edit'],
                inventory: ['view', 'create', 'edit'],
                invoices: ['view', 'create'],
                staff: ['view', 'edit'],
                maintenance: ['view', 'create', 'edit'],
                reports: [],
                purchase_documents: ['view', 'create', 'edit', 'delete'],
                system_errors: ['view']
            },
            staff: {
                dashboard: ['view'],
                reservations: ['view', 'create', 'edit'],
                guests: ['view', 'create', 'edit'],
                rooms: ['view'],
                services: ['view'],
                pos: ['view', 'create'],
                cash: ['view', 'create'],
                inventory: ['view'], // Staff can only view inventory
                invoices: ['view'],
                staff: ['view'],
                maintenance: ['view', 'create', 'edit'],
                reports: [],
                purchase_documents: ['view', 'create'],
                system_errors: []
            }
        };

        if (role === 'admin' || role === 'superadmin') {
            const allAdminPermissions = {};
            this.allModules.forEach(module => {
                // Admins get all standard actions. Superadmin-only actions are handled separately.
                allAdminPermissions[module] = [...this.allActions];
            });
            // NEW: Explicitly grant superadmin_panel view to admins/superadmins
            allAdminPermissions['superadmin_panel'] = ['view'];
            return allAdminPermissions;
        }

        return permissions[role] || {};
    }

    // Add method to check if user has permission for a specific action
    hasPermission(module, action) {
        // Superadmin bypass - ALWAYS has all permissions
        if (this.currentUser && Boolean(this.currentUser.isSuperadmin)) {
            return true;
        }

        // Use current user's live permissions object, which is now the single source of truth
        if (!this.currentUser || !this.currentUser.permissions) {
            return false;
        }

        // Live permissions: recompute from the freshest staff record so that permission
        // changes made by an admin take effect immediately (no re-login required).
        let effective = this.currentUser.permissions;
        try {
            const staff = this._findStaffForCurrentUser();
            if (staff) {
                effective = this._computeEffectivePermissions(staff);
            }
        } catch (e) {
            console.warn('[AuthManager] Live permission recompute failed, using snapshot.', e);
        }

        const modulePermissions = effective[module];

        // Check if modulePermissions itself is an array. Custom perms can be an array of actions.
        if (Array.isArray(modulePermissions)) {
            const granted = modulePermissions.includes(action);
            return granted;
        }

        return false;
    }

    // Find the freshest staff record for the currently logged-in user.
    _findStaffForCurrentUser() {
        const cu = this.currentUser;
        if (!cu) return null;
        const email = (cu.email || '').toLowerCase();
        return (
            this.staffCache.find(s =>
                s.id === cu.uid ||
                (s.firebaseUid && s.firebaseUid === cu.uid) ||
                (s.email && String(s.email).toLowerCase() === email)
            ) || null
        );
    }

    // Build the merged permission set for a staff record: role defaults + custom additions.
    // Custom permissions always ADD to the role defaults (they never revoke them).
    _computeEffectivePermissions(staff) {
        const userRole = staff?.role || 'staff';
        const defaultPerms = this.getRolePermissions(userRole);
        const customPerms = staff?.permissions || {};

        let basePermissions = defaultPerms;
        // For admin/superadmin with an explicit custom set, the custom set is authoritative
        // (supports granular restriction), matching the login-flow behaviour.
        if ((userRole === 'admin' || userRole === 'superadmin') && staff.permissions !== undefined && staff.permissions !== null) {
            basePermissions = staff.permissions;
        }

        const effectivePermissions = { ...basePermissions };
        if (userRole !== 'admin' && userRole !== 'superadmin' || staff.permissions === undefined || staff.permissions === null) {
            for (const module in customPerms) {
                const custom = customPerms[module];
                if (!Array.isArray(custom)) continue; // defensive: ignore malformed entries
                if (!effectivePermissions[module]) effectivePermissions[module] = [];
                effectivePermissions[module] = Array.from(new Set([...effectivePermissions[module], ...custom]));
            }
        }
        return effectivePermissions;
    }

    /**
     * NEW: Checks if a user has any permissions for a module, implying they can see it in the sidebar.
     * Specifically checks for 'view' permission. If no permissions are defined for a module, it will be hidden.
     * @param {string} module - The name of the module.
     * @returns {boolean} - True if the user has 'view' permission for the module.
     */
    canViewModule(module) {
        if (!this.currentUser) return false;

        // Rely entirely on the permissions matrix/custom permissions for 'view' access.
        // hasPermission handles the superadmin bypass internally.
        return this.hasPermission(module, 'view');
    }

    // This method is no longer directly called from an auth-success listener because initFirebaseAuth() handles it.
    initializeAfterLogin(user) {
        if (this.isInitialized) {
            console.warn('AuthManager already fully initialized. Skipping re-initialization after login.');
            return;
        }

        console.log('AuthManager: Completing full initialization after login...');
        
        // Use the user object passed from the event detail or fallback to this.currentUser
        const userToStartSession = user || this.currentUser;
        if (userToStartSession) {
            if (!userToStartSession.loginTime) {
                userToStartSession.loginTime = new Date().toISOString();
            }
            if (this.currentUser && !this.currentUser.loginTime) {
                this.currentUser.loginTime = userToStartSession.loginTime;
            }
            this.startSessionTimer(userToStartSession.loginTime);
        } else {
            const fallbackLoginTime = new Date().toISOString();
            if (this.currentUser) {
                this.currentUser.loginTime = fallbackLoginTime;
            }
            this.startSessionTimer(fallbackLoginTime);
        }
        
        this.isInitialized = true; // Mark as fully initialized
        console.log('AuthManager: Full initialization completed.');
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isUserAuthenticated() {
        if (this.useLocalAuth) {
            return this.isAuthenticated;
        }
        // Check Firebase Auth state directly for the most reliable source of truth
        return !!this.firebaseAuth?.currentUser;
    }

    // EXTRA: Telegram OTP-integration for system login (NOT Firebase Auth)
    // Application-level OTP: After Firebase Auth (email/password), show modal to enter OTP sent via Telegram
    // To enable: on login, after Firebase Auth success, if staff record has telegramId, send OTP.

    async beginTelegramOTPFlow() {
        // Only run after successful Firebase Auth login, before showing main app

        // Find the telegramId from staff record via currentUser
        const staff = this.staffCache.find(s =>
            s.email === this.currentUser?.email ||
            s.id === this.currentUser?.uid ||
            s.telegramId === this.currentUser?.telegramId
        );

        // Only proceed if a telegramId is set (superadmin or ordinary staff!)
        if (!staff || !staff.telegramId || !/^\d+$/.test(staff.telegramId)) {
            // If not present, bypass OTP (legacy user, setup not completed)
            return true;
        }

        // Generate 6-digit OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        this._pendingTelegramOTP = otp;
        this._pendingTelegramStaffId = staff.id;

        // Send OTP code to Telegram (via NotificationManager)
        if (window.notificationManager && typeof window.notificationManager.sendTelegramMessage === 'function') {
            await window.notificationManager.sendTelegramMessage(
                `✅ <b>RB Hotel PMS OTP kodu</b>\nOTP: <b>${otp}</b>\nDaxil olmaq üçün bu kodu yazın.`,
                staff.telegramId,
                null,
                false
            );
        } else {
            alert("Telegram OTP göndərilə bilmədi (NotificationManager tapılmadı).");
        }

        // Show OTP entry modal
        return new Promise((resolve) => {
            // Modal with OTP entry input
            const otpModalHtml = `
                <form id="otpModalForm" style="display:flex;flex-direction:column;gap:1rem;align-items:center;">
                    <label style="font-weight:600;font-size:1.1em;">Telegram ilə göndərilmiş OTP kodunu daxil edin</label>
                    <input type="text" id="otpCodeInput" autocomplete="one-time-code" style="font-size:1.3em;padding:0.7em 1.2em;border-radius:0.7em;border:1.3px solid #3b82f6;letter-spacing:0.35em;text-align:center;width:8em;" maxlength="6" minlength="6" inputmode="numeric">
                    <div style="font-size:0.95em;color:#64748b;">Telefonunda Telegram yoxdursa və ya OTP gəlmirsə <a href="https://t.me/rbhoteladmin" target="_blank">adminlə əlaqə saxlayın</a></div>
                    <div id="otpErrorMsg" style="color:#ef4444;display:none;margin-top:0.45em;"></div>
                </form>
            `;
            window.modalManager.showModal(
                'Telegram ilə OTP Təsdiqi',
                otpModalHtml,
                `
                    <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Çıxış</button>
                    <button class="btn btn-primary" onclick="window.authManager.submitOtpFromModal()">Təsdiqlə</button>
                `,
                { allowEsc: false }
            );

            // Input handler for 6 digits
            setTimeout(() => {
                const input = document.getElementById('otpCodeInput');
                if (input) input.focus();
                if (input) input.addEventListener('input', () => {
                    input.value = input.value.replace(/\D/g, '').slice(0, 6);
                });
            }, 200);

            this._resolveOTPModal = (result) => {
                this._pendingTelegramOTP = null;
                this._pendingTelegramStaffId = null;
                window.modalManager.hideModal();
                resolve(result);
            };
        });
    }

    // Submit from modal button
    submitOtpFromModal() {
        const input = document.getElementById('otpCodeInput');
        const otp = this._pendingTelegramOTP;
        const errMsg = document.getElementById('otpErrorMsg');
        if (input && input.value === otp) {
            if (errMsg) errMsg.style.display = "none";
            if (typeof this._resolveOTPModal === "function") {
                this._resolveOTPModal(true);
            }
        } else {
            if (errMsg) {
                errMsg.textContent = "OTP kodu yalnışdır. Yenidən yoxlayın";
                errMsg.style.display = "block";
            }
        }
    }
}

// Global for backward compatibility
if (!window.authManager) {
    console.log('Creating global AuthManager instance...');
    try {
        window.authManager = new AuthManager();
        console.log('AuthManager instance created successfully');
    } catch (error) {
        console.error('Error creating AuthManager:', error);
    }
} else {
    console.log('AuthManager already exists');
}

// Export for module compatibility
window.AuthManager = AuthManager;

// Global event listener for hotel info updates
document.addEventListener('DOMContentLoaded', () => {
    // Listen for hotel info updates
    window.addEventListener('hotelinfo-updated', () => {
        if (window.app && typeof window.app.updateHotelNameInUI === 'function') {
            window.app.updateHotelNameInUI();
        }
    });
    
    // Also check periodically for app availability 
    const checkApp = setInterval(() => {
        // Wait for app.data.staff to be loaded and populate before updating cache.
        // `window.app.coreInitialize()` and `window.app.initialize()` should ensure this.
        if (window.app?.data?.staff && Array.isArray(window.app.data.staff)) { // Use optional chaining for safe access
            if (window.authManager?.staffCache && window.authManager.staffCache.length === 0) { // Use optional chaining for safe access
                window.authManager.updateStaffCache();
            }
            clearInterval(checkApp);
        }
    }, 100);
});
