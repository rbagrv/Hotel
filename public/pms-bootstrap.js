
function onReady(fn) {
  if (document.readyState === "interactive" || document.readyState === "complete") {
    setTimeout(fn, 10);
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}


// --- SECTION --- 
// Use an async function to load config to handle Electron/browser cases
        async function loadConfig() {
            // For Electron, get config from main process via preload script
            if (window.electronAPI && window.electronAPI.getAppConfig) {
                try {
                    const config = await window.electronAPI.getAppConfig();
                    window.ENV = config;
                    console.log('App config loaded from Electron main process.');
                } catch (e) {
                    console.error('Failed to get config from main process, using fallback public config.', e);
                    window.ENV = {
                        // Fallback keys for when Electron IPC fails.
                        TELEGRAM_BOT_TOKEN: "7849692173:AAGc9EvrywMa6hOcYh7EvqTaNqOEXW4G_Gk",
                        TELEGRAM_CHAT_ID: "734378254",
                        // Default Firebase config (client-side keys, secured by Firestore rules)
                        FIREBASE_API_KEY: "AIzaSyD-jdQPgIQOjRlaHlSkrxf-hkiJu6-kySk",
                        FIREBASE_AUTH_DOMAIN: "hotelpms-d0871.firebaseapp.com",
                        FIREBASE_PROJECT_ID: "hotelpms-d0871",
                        FIREBASE_STORAGE_BUCKET: "hotelpms-d0871.appspot.com",
                        FIREBASE_MESSAGING_SENDER_ID: "118813173579",
                        FIREBASE_APP_ID: "1:118813173579:web:c36b32052a58a4d7c86ace"
                    };
                }
            } else {
                // Fallback for browser environment (development/web).
                // NOTE: Hardcoding secrets here is for development/testing purposes in websim.
                // For production, use secure environment variables.
                console.log('Not in Electron, using fallback public config for development.');
                window.ENV = {
                    TELEGRAM_BOT_TOKEN: "7849692173:AAGc9EvrywMa6hOcYh7EvqTaNqOEXW4G_Gk",
                    TELEGRAM_CHAT_ID: "734378254",
                    // Default Firebase config (client-side keys, secured by Firestore rules)
                    FIREBASE_API_KEY: "AIzaSyD-jdQPgIQOjRlaHlSkrxf-hkiJu6-kySk",
                    FIREBASE_AUTH_DOMAIN: "hotelpms-d0871.firebaseapp.com",
                    FIREBASE_PROJECT_ID: "hotelpms-d0871",
                    FIREBASE_STORAGE_BUCKET: "hotelpms-d0871.appspot.com",
                    FIREBASE_MESSAGING_SENDER_ID: "118813173579",
                    FIREBASE_APP_ID: "1:118813173579:web:c36b32052a58a4d7c86ace"
                };
            }
            // Ensure AUTH_DOMAIN is derived if not explicitly provided, common Firebase setup
            if (window.ENV.FIREBASE_PROJECT_ID && !window.ENV.FIREBASE_AUTH_DOMAIN) {
                window.ENV.FIREBASE_AUTH_DOMAIN = `${window.ENV.FIREBASE_PROJECT_ID}.firebaseapp.com`;
            }
            console.log('Environment variables loaded:', window.ENV);
        }

        // Shared HTML-escape helper used by all components to prevent XSS.
        window.escapeHtml = function (value) {
            if (value === null || value === undefined) return '';
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        // Run the async config loader immediately
        loadConfig();
        
        // Check if running in Electron and on Windows
        window.isElectronWindows = window.platform?.isElectron && window.platform?.isWindows;
        if (window.isElectronWindows) {
            console.log('Running in Electron on Windows - SQLite database will be used');
        }

// --- SECTION --- 
// Ensure XLSX is globally available immediately after loading
        const exposeXlsx = () => {
            if (typeof XLSX !== 'undefined') window.XLSX = XLSX;
        };
        exposeXlsx();
        window.addEventListener('DOMContentLoaded', exposeXlsx, { once: true });

// --- SECTION --- 
// This mock 'websim' object simulates file upload functionality.
        // In a real production environment, this would be replaced with actual API calls
        // to a backend service (e.g., Firebase Storage, AWS S3, or a custom file server)
        // that handles secure file storage and provides real public URLs.
        if (!window.websim) {
            window.websim = {
                upload: async (fileBlob, fileName = 'uploaded_file.png', progressCallback = (p) => {}) => {
                    console.log(`[WEBSIM MOCK]: Simulating upload of file: ${fileName}, type: ${fileBlob.type}, size: ${fileBlob.size} bytes.`);
                    progressCallback(10); // Simulate start
                    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
                    progressCallback(50); // Simulate progress
                    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
                    progressCallback(90); // Simulate near completion
                    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate completion

                    // Return a dummy URL. In a real scenario, this would be a public URL of the uploaded file.
                    const dummyUrl = `https://example.com/mock-uploads/${fileName}?timestamp=${Date.now()}`;
                    console.log(`[WEBSIM MOCK]: Mock upload complete. Dummy URL: ${dummyUrl}`);
                    return dummyUrl;
                }
            };
            console.log('[WEBSIM MOCK]: Mock websim object initialized globally.');
        }

// --- SECTION --- 
onReady( function() {
        // Add visible button for superadmin to open Firebase settings modal for debugging/inpecting config
        function addFirebaseSettingsDebugBtn() {
          if (!window.app || !window.app.isSuperadmin || !window.app.isSuperadmin()) return;
          if (document.getElementById('debugFirebaseSettingsBtn')) return;
          const footer = document.getElementById('footerAppVersionText');
          if (!footer) return;
          const btn = document.createElement('a');
          btn.id = 'debugFirebaseSettingsBtn';
          btn.href = '#';
          btn.textContent = 'Firebase Tənzimləmələri';
          btn.style = 'font-size:0.92em;margin-left:1em;color:#8b5cf6;text-decoration:underline;cursor:pointer;';
          btn.onclick = function(e) {
            e.preventDefault();
            if (window.modalManager && window.modalManager.showFirebaseSettings) {
              window.modalManager.showFirebaseSettings();
            } else if (window.moduleRenderer && window.moduleRenderer.showFirebaseSettings) {
                window.moduleRenderer.showFirebaseSettings();
            } else {
              alert('Firebase tənzimləmələri modalı tapılmadı.');
            }
          };
          // REMOVED as per user instructions to move all settings to superadmin panel
          // footer.appendChild(btn);
        }
        setTimeout(addFirebaseSettingsDebugBtn, 3000);
        window.addEventListener('auth-success', () => setTimeout(addFirebaseSettingsDebugBtn, 800));
      });

// --- SECTION --- 
import { initializeApp, getApps, getApp } from "firebase/app";
      import { initializeFirestore, enableIndexedDbPersistence, collection, addDoc, getDocs, onSnapshot, doc, setDoc, getDoc, query, limit } from "firebase/firestore";
      import { getAuth } from "firebase/auth";

      let firebaseConfig = {
        apiKey: "AIzaSyD-jdQPgIQOjRlaHlSkrxf-hkiJu6-kySk",
        authDomain: "hotelpms-d0871.firebaseapp.com",
        projectId: "hotelpms-d0871",
        storageBucket: "hotelpms-d0871.appspot.com",
        messagingSenderId: "118813173579",
        appId: "1:118813173579:web:c36b32052a58a4d7c86ace"
      };

      // Defensive config override from localStorage if user has updated via settings
      try {
        const raw = localStorage.getItem('firebaseSettings');
        if (raw) {
          const parsed = JSON.parse(raw);
          // Apply from localStorage only if it's enabled and has key/projectID
          if (parsed.enabled !== false && parsed.apiKey && parsed.projectId) {
            firebaseConfig = { ...firebaseConfig, ...parsed };
            console.log('[Firebase CONFIG PATCH]: Firebase settings overridden from localStorage.');
          } else if (parsed.enabled === false) {
            console.warn('[Firebase CONFIG PATCH]: Firebase is disabled via localStorage settings. Default config will be used but connection may fail.');
          } else {
             console.warn('[Firebase CONFIG PATCH]: localStorage firebaseSettings found but incomplete or invalid. Using default config.');
          }
        }
      } catch(e) {
        console.warn('[Firebase CONFIG PATCH]: localStorage firebaseSettings parsing error or invalid JSON. Using default config.', e);
      }

      // NEW: Prioritize Firebase config from window.ENV if available and valid
      if (window.ENV && window.ENV.FIREBASE_API_KEY && window.ENV.FIREBASE_PROJECT_ID) {
          firebaseConfig = {
              apiKey: window.ENV.FIREBASE_API_KEY,
              authDomain: window.ENV.FIREBASE_AUTH_DOMAIN || `${window.ENV.FIREBASE_PROJECT_ID}.firebaseapp.com`,
              projectId: window.ENV.FIREBASE_PROJECT_ID,
              storageBucket: window.ENV.FIREBASE_STORAGE_BUCKET || `${window.ENV.FIREBASE_PROJECT_ID}.appspot.com`,
              messagingSenderId: window.ENV.FIREBASE_MESSAGING_SENDER_ID || '',
              appId: window.ENV.FIREBASE_APP_ID || '',
              measurementId: window.ENV.FIREBASE_MEASUREMENT_ID || ''
          };
          console.log('Firebase config loaded from window.ENV.');
      }

      // Only one Firebase app instance
      let firebaseApp;
      // Use the default app if it already exists, otherwise initialize it.
      if (getApps().length === 0) {
          firebaseApp = initializeApp(firebaseConfig);
          console.log(`[Firebase INIT]: Initialized new DEFAULT Firebase app with project ID ${firebaseConfig.projectId}`);
      } else {
          firebaseApp = getApp(); // Gets the default app instance
          console.log(`[Firebase INIT]: Re-using existing Firebase app with project ID ${firebaseApp.options.projectId}`);
      }

      // Expose instances globally
      window.firebaseApp = firebaseApp;
      // Long polling is considerably slower in a browser and used to make the
      // splash screen look frozen on slow connections. Keep it only for the
      // Electron build where it is sometimes needed.
      const firestoreOptions = window.platform?.isElectron
        ? { experimentalForceLongPolling: true }
        : {};
      window.firestoreDb = initializeFirestore(firebaseApp, firestoreOptions);
      window.firebaseAuth = getAuth(firebaseApp);
      window.dispatchEvent(new CustomEvent('firebase-ready'));
      
      // Initialize Analytics and Performance only if a measurementId is available,
      // and ensure they are attached to the default app instance.
      if (firebaseConfig.measurementId) {
          try {
            // These SDKs are optional telemetry; load them after the core app.
            const [{ getAnalytics }, { getPerformance }] = await Promise.all([
              import('firebase/analytics'),
              import('firebase/performance')
            ]);
            window.firebaseAnalytics = getAnalytics(firebaseApp);
            window.firebasePerformance = getPerformance(firebaseApp);
            console.log('Firebase Analytics & Performance Monitoring initialized, enabling telemetry.');
          } catch (e) {
            console.warn("Firebase Analytics/Performance could not be initialized. This might be due to ad-blockers or environment restrictions.", e);
            window.firebaseAnalytics = null;
            window.firebasePerformance = null;
          }
      } else {
          console.log('Firebase measurementId not found. Analytics & Performance Monitoring are disabled.');
          window.firebaseAnalytics = null;
          window.firebasePerformance = null;
      }
      
      console.log('Firebase instances exposed globally.');

      // Enable Firestore offline persistence.
      // Firestore IndexedDB persistence only applies to the desktop (Electron) build.
      // On web deployments the app relies on HybridDB's own IndexedDB + sync queue for
      // offline-first behaviour, so Firestore persistence is deliberately skipped here
      // and must not produce any console errors.
      const isDesktopApp = !!(window.platform && window.platform.isElectron);
      if (!isDesktopApp) {
        window.FIREBASE_UI_STATUS = 'OK (web)';
      } else if (window.firestoreDb && typeof enableIndexedDbPersistence === 'function') {
        enableIndexedDbPersistence(window.firestoreDb)
          .then(() => console.log("Firestore offline persistence enabled."))
          .catch(e => {
            console.warn("Firestore offline persistence could not be enabled:", e);
            let userMessage = "Offline rejim aktivləşdirilə bilmədi.";
            if (e.code === 'failed-precondition') {
              // Specifically handle scenarios where persistence is blocked
              if (e.message && e.message.includes('another tab')) {
                userMessage = "Offline rejim aktivləşdirilə bilmədi: Başqa bir pəncərə (tab) açılıb. Zəhmət olmasın, tətbiqin yalnız bir pəkəncədə (tabda) açıq olduğuna əmin olun.";
              } else if (e.message && e.message.includes('private mode')) {
                userMessage = "Offline rejim aktivləşdirilə bilmədi: Brauzeriniz 'Gizli' (Private) rejimdə ola bilər. Gizli rejimdə lokal yaddaşdan istifadə edilə bilməz.";
              } else {
                userMessage += " (Naməlum səbəb: pre-condition xətası).";
              }
            } else if (e.code === 'unimplemented') {
              userMessage += " (Brauzer dəstəkləmir).";
            } else if (e.code === 'unavailable') {
              userMessage += " (Server/şəbəkə bağlantısı yoxdur).";
            }
            if (window.notificationManager) {
                window.notificationManager.showNotification('error', 'Offline Rejim Xətası', userMessage, 10000); // Show for longer
            }
            window.app?.recordSystemError?.('FirebasePersistenceError', e.message, e.stack || e.toString());
          });
      } else if (window.notificationManager) {
        console.warn("Firestore persistence not available (desktop build).");
        window.notificationManager.showNotification('warning', 'Offline Rejim Xətası', 'Firebase lokal saxlama funksiyası yüklənmədi. Offline rejimdə işləyə bilməz.', 10000);
        window.app?.recordSystemError?.('FirebaseInitError', 'Firestore instance or enableIndexedDbPersistence not available.', 'N/A');
      }

      // Firebase connection diagnostics (modular syntax/corrected usage)
      onReady( function() {
        // Diagnostics are optional telemetry. Run them after the first paint so
        // a slow Firebase endpoint can never hold up the application UI.
        setTimeout(async () => {
        // On the websim web platform we do not use Firebase, so skip these
        // diagnostics entirely to avoid false "permission denied" alerts.
        if (!(window.platform && window.platform.isElectron)) {
          window.FIREBASE_UI_STATUS = 'OK (websim backend)';
          return;
        }
        // Remove the hardcoded security rules error div. Rely on notification-manager and overall connection status.
        const existingSecurityRulesErrorDiv = document.getElementById('firebaseSecurityRulesError');
        if (existingSecurityRulesErrorDiv) {
            existingSecurityRulesErrorDiv.remove();
        }

        try {
          if (!window.firestoreDb) {
            console.warn("Firestore DB instance not available.");
            window.FIREBASE_UI_STATUS = 'Firestore instansı yoxdur.';
            return;
          }
          window.firebaseDiagnosticsStatus = 'success';
          window.FIREBASE_UI_STATUS = 'Firestore hazırdır';
          document.body.setAttribute('data-firebase-status','success');
          console.info('[FIREBASE DIAGNOSTICS]: Firestore initialized successfully.');
        } catch (error) {
          console.warn('[FIREBASE DIAGNOSTICS]: Non-critical notice:', error);
        }
        }, 2500);
      });

      // Mock functions (can be removed if no longer needed)
      window.addHotelData = async function() { console.log('addHotelData mock'); };
      window.getHotels = async function() { console.log('getHotels mock'); };
      window.hotelsRealtimeUnsub = () => console.log('hotelsRealtimeUnsub mock');

      // Save config state to localStorage: ONLY FIREBASE SYNC
      // This part needs to happen *before* the HybridDB is initialized.
      // Move this to the script block *before* loading the DataManager module.

// --- SECTION --- 
(function() {
        try {
      // Data store is Firestore (Firebase) + local IndexedDB. The websim backend
      // is NEVER used as a database. Firebase is always the online sync target.
      localStorage.setItem('serverDBType', 'firebase');
      // Remove/disable all other server db configs so Firestore is the ONLY sync target.
      localStorage.removeItem('supabaseSettings');
      localStorage.removeItem('pocketbaseSettings');
      localStorage.removeItem('stackAuthSettings');
      localStorage.removeItem('supabaseSeeded');
      localStorage.removeItem('pocketbaseSeeded');
        } catch(e) {
          // Silently ignore
        }
      })();

// --- SECTION --- 
// Import and expose all managers and helpers globally ONCE
      import NotificationManager from './notification-manager.js';
      import DoorCardSystem from './door-card-system.js';
      import AuthManager from './auth-manager.js';
      import ModalManager from './modal-manager.js';
      import ModuleRenderer from './module-renderer.js';
      import ChartManager from './chart-manager.js';
      import StatusHelper from './status-helper.js';
      import HybridDB from './data-manager.js';

      window.NotificationManager = NotificationManager;
      try { window.notificationManager = new NotificationManager(); } catch(e) { console.error('Error instantiating NotificationManager:', e); }

      window.DoorCardSystem = DoorCardSystem;
      try { window.doorCardSystem = new DoorCardSystem(); } catch(e) { console.error('Error instantiating DoorCardSystem:', e); }
      
      window.AuthManager = AuthManager;
      try { window.authManager = new AuthManager(); } catch(e) { console.error('Error instantiating AuthManager:', e); }
      
      window.ModalManager = ModalManager;
      try { window.modalManager = new ModalManager(); } catch(e) { console.error('Error instantiating ModalManager:', e); }
      
      window.ModuleRenderer = ModuleRenderer;
      try { window.moduleRenderer = new ModuleRenderer(); } catch(e) { console.error('Error instantiating ModuleRenderer:', e); }
      
      window.ChartManager = ChartManager;
      try { window.chartManager = new ChartManager(); } catch(e) { console.error('Error instantiating ChartManager:', e); }
      
      window.StatusHelper = StatusHelper;
      try { window.statusHelper = new StatusHelper(); } catch(e) { console.error('Error instantiating StatusHelper:', e); }
      
      // PATCH for 'does not provide an export named 'default''
      const HybridDBClass = HybridDB.default || HybridDB;
      window.HybridDB = HybridDBClass;
      try { window.hybridDB = new HybridDBClass(); } catch(e) { console.error('Error instantiating HybridDB:', e); }

// --- SECTION --- 
import HotelPMS from './app.js';
        if (!window.app) {
            window.app = new HotelPMS();
            window.app.init(); // NEW: Call the new orchestrating init method
        }

// --- SECTION --- 
// CONSOLIDATED COMPONENT IMPORTS AND INSTANTIATION
        import DashboardComponent from './dashboard-component.js';
        import ReservationsComponent from './reservations-component.js';
        import GuestsComponent from './guests-component.js';
        import RoomsComponent from './rooms-component.js';
        import ServicesComponent from './services-component.js';
        import POSComponent from './pos-component.js';
        import CashComponent from './cash-component.js';
        import InventoryComponent from './inventory-component.js';
        import InvoicesComponent from './invoices-component.js';
        import StaffComponent from './staff-component.js';
        import MaintenanceComponent from './maintenance-component.js';
        import PurchaseDocumentsComponent from './purchase-documents-component.js';
        import ReportsComponent from './reports-component.js';

        // Expose Classes
        window.DashboardComponent = DashboardComponent;
        window.ReservationsComponent = ReservationsComponent;
        window.GuestsComponent = GuestsComponent;
        window.RoomsComponent = RoomsComponent;
        window.ServicesComponent = ServicesComponent;
        window.POSComponent = POSComponent;
        window.CashComponent = CashComponent;
        window.InventoryComponent = InventoryComponent;
        window.InvoicesComponent = InvoicesComponent;
        window.StaffComponent = StaffComponent;
        window.MaintenanceComponent = MaintenanceComponent;
        window.PurchaseDocumentsComponent = PurchaseDocumentsComponent;
        window.ReportsComponent = ReportsComponent;

        // Instantiate Globally (must happen synchronously outside DOMContentLoaded for moduleRenderer to find .render method immediately)
        window.dashboardComponent = window.dashboardComponent || new DashboardComponent();
        window.reservationsComponent = window.reservationsComponent || new ReservationsComponent();
        window.guestsComponent = window.guestsComponent || new GuestsComponent();
        window.roomsComponent = window.roomsComponent || new RoomsComponent();
        window.servicesComponent = window.servicesComponent || new ServicesComponent();
        window.posComponent = window.posComponent || new POSComponent();
        window.cashComponent = window.cashComponent || new CashComponent();
        window.inventoryComponent = window.inventoryComponent || new InventoryComponent();
        window.invoicesComponent = window.invoicesComponent || new InvoicesComponent();
        window.staffComponent = window.staffComponent || new StaffComponent();
        window.maintenanceComponent = window.maintenanceComponent || new MaintenanceComponent();
        window.purchaseDocumentsComponent = window.purchaseDocumentsComponent || new PurchaseDocumentsComponent();
        window.reportsComponent = window.reportsComponent || new ReportsComponent();
        console.log('All components instantiated globally.');

// --- SECTION --- 
import PaymentForm from './payment-form.js';
        window.PaymentForm = PaymentForm;
        window.paymentForm = window.paymentForm || new PaymentForm();

// --- SECTION --- 
import { createSunmiTaxForm } from './sunmi-tax-form.js';
        import { createHuneDoorLockForm } from './hune-door-lock-form.js';
        import { createDoorCardForm } from './door-card-form.js';
        window.createSunmiTaxForm = createSunmiTaxForm;
        window.createHuneDoorLockForm = createHuneDoorLockForm;
        window.createDoorCardForm = createDoorCardForm;

// --- SECTION --- 
// Import only necessary Forms classes for instantiation inside DOMContentLoaded if needed
        // Components are already globally instantiated above.

        import ReservationForm from './reservation-form.js';
        import GuestForm from './guest-form.js';
        import RoomForm from './room-form.js';
        import ServiceForm from './service-form.js';
        // duplicate PaymentForm import removed
        import CashForm from './cash-form.js';
        import InventoryForm from './inventory-form.js';
        import StaffForm from './staff-form.js';
        import MaintenanceForm from './maintenance-form.js';
        import PurchaseDocumentForm from './purchase-document-form.js';

        onReady( async function() {
            console.log('DOMContentLoaded fired.');
            window.addEventListener('auth-success', (event) => {
                const user = event.detail || {};
                if (window.FIREBASE_UI_STATUS && String(window.FIREBASE_UI_STATUS).toLowerCase().includes('xəta')) {
                    setTimeout(() => {
                        const nc = document.getElementById('notificationContainer');
                        if (nc && !document.getElementById('critical-system-start-msg')) {
                            const div = document.createElement('div');
                            div.className = 'notification error';
                            div.id = 'critical-system-start-msg';
                            div.innerHTML = `
                                <div class="notification-icon"><i class="fas fa-exclamation-triangle"></i></div>
                                <div class="notification-content">
                                    <div class="notification-title">Sistem Yüklənmədi</div>
                                    <div class="notification-message">Profil yüklənmədi. Məhdud icazələrlə offline rejimdə işləyirsiniz.<br>
                                    <span style="color:#ef4444; font-weight: 500;">Server Xətası: ${window.FIREBASE_UI_STATUS.replace('Firestore xətası:', '').replace('Firebase SDK/tətbiq xətası:', '')}</span>
                                    <br>
                                    <span style="font-size:0.85em;color:#6b7280;margin-top:0.5rem;display:block;">Zəhmət olmasın, <b>Firebase Təhlükəsizlik Qaydalarını (Security Rules)</b> yoxlayın.</span>
                                </div>
                                <button class="notification-close" onclick="this.parentElement.remove()">
                                    <i class="fas fa-times"></i>
                                </button>
                            `;
                            nc.appendChild(div);
                        }
                    }, 600);
                }
            });

            console.log('DOM loaded, initializing managers and components...');
            
            // Components are now instantiated globally in the module block above.
            // Only re-instantiate forms if necessary (using the OR logic keeps existing instance if module was imported early by another script)
            window.reservationForm = window.reservationForm || new ReservationForm();
            window.guestForm = window.guestForm || new GuestForm();
            window.roomForm = window.roomForm || new RoomForm();
            window.serviceForm = window.serviceForm || new ServiceForm();
            window.paymentForm = window.paymentForm || new PaymentForm();
            window.cashForm = window.cashForm || new CashForm();
            window.inventoryForm = window.inventoryForm || new InventoryForm();
            window.staffForm = window.staffForm || new StaffForm();
            window.maintenanceForm = window.maintenanceForm || new MaintenanceForm();
            window.purchaseDocumentForm = window.purchaseDocumentForm || new PurchaseDocumentForm();
            console.log('All forms initialized.');

            const registerForm = document.getElementById('registerForm');
            if (registerForm) {
                registerForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const registerBtn = document.getElementById('registerBtn');
                    if (registerBtn) registerBtn.disabled = true;
                    const name = document.getElementById('registerName').value.trim();
                    const email = document.getElementById('registerEmail').value.trim();
                    const password = document.getElementById('registerPassword').value;
                    try {
                        if (!email || !password || !name) return;
                        await window.authManager.register(email, password, name);
                    } catch (error) {
                    } finally {
                        if (registerBtn) registerBtn.disabled = false;
                        registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Qeydiyyatdan keç';
                    }
                });
            }

            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const email = document.getElementById('loginEmail').value;
                    const password = document.getElementById('loginPassword').value;
                    // The login function in authManager now handles its own errors and UI updates.
                    // No need for a try/catch block here that might swallow errors.
                    window.authManager.login(email, password);
                });
            }

            const loginFormContainer = document.getElementById('loginFormContainer');
            const registerFormContainer = document.getElementById('registerFormContainer');
            const showRegisterFormLink = document.getElementById('showRegisterForm');
            const showLoginFormLink = document.getElementById('showLoginForm');

            if (showRegisterFormLink && showLoginFormLink && loginFormContainer && registerFormContainer) {
                showRegisterFormLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    loginFormContainer.style.display = 'none';
                    registerFormContainer.style.display = 'block';
                });

                showLoginFormLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    loginFormContainer.style.display = 'block';
                    registerFormContainer.style.display = 'none';
                });
            }

            // NEW: Unified function to control sidebar visibility based on permissions
            function updateSidebarVisibilityBasedOnPermissions() {
                if (!window.authManager) return;

                const modules = {
                    'dashboard': document.querySelector('[data-module="dashboard"]'),
                    'reservations': document.querySelector('[data-module="reservations"]'),
                    'guests': document.querySelector('[data-module="guests"]'),
                    'rooms': document.querySelector('[data-module="rooms"]'),
                    'services': document.querySelector('[data-module="services"]'),
                    'invoices': document.querySelector('[data-module="invoices"]'),
                    'pos': document.querySelector('[data-module="pos"]'),
                    'cash': document.querySelector('[data-module="cash"]'),
                    'inventory': document.querySelector('[data-module="inventory"]'),
                    'purchase_documents': document.querySelector('[data-module="purchase_documents"]'),
                    'maintenance': document.querySelector('[data-module="maintenance"]'),
                    'staff': document.querySelector('[data-module="staff"]'),
                    'reports': document.querySelector('[data-module="reports"]'),
                    'settings': document.querySelector('[data-module="settings"]'),
                    'superadmin_panel': document.querySelector('[data-module="superadmin_panel"]')
                };

                for (const moduleName in modules) {
                    const link = modules[moduleName];
                    if (link) {
                        // The parent of the <a> tag is the <li>, which should be hidden.
                        const listItem = link.parentElement;
                        // Use the more explicit canViewModule method to determine visibility
                        const canView = window.authManager.canViewModule(moduleName);
                        if (listItem) {
                            listItem.style.display = canView ? '' : 'none';
                        }
                    }
                }
            }

            // Make the function globally accessible for real-time updates from other modules
            window.updateSidebarVisibilityBasedOnPermissions = updateSidebarVisibilityBasedOnPermissions;

            // Run the visibility check on load and after authentication succeeds.
            updateSidebarVisibilityBasedOnPermissions();
            window.addEventListener('auth-success', () => setTimeout(updateSidebarVisibilityBasedOnPermissions, 500));

            // Top Header Live Clock (HotelFriend style)
            function updateTopHeaderClock() {
                const now = new Date();
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const day = now.getDate();
                const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
                const month = months[now.getMonth()];

                const hoursEl = document.getElementById('topClockHours');
                const minutesEl = document.getElementById('topClockMinutes');
                const dateEl = document.getElementById('topClockDate');

                if (hoursEl) hoursEl.textContent = hours;
                if (minutesEl) minutesEl.textContent = minutes;
                if (dateEl) dateEl.textContent = `${day} ${month}`;
            }
            updateTopHeaderClock();
            setInterval(updateTopHeaderClock, 1000);
        });

// --- SECTION --- 
onReady( () => {
            const quickActions = [
                {
                    icon: 'calendar-plus',
                    label: 'Yeni Rezervasiya',
                    desc: 'Qonaq rezervasiyası əlavə et',
                    color: '#3b82f6',
                    class: 'reservation',
                    action: () => window.modalManager.showReservationForm()
                },
                {
                    icon: 'user-plus',
                    label: 'Yeni Qonaq',
                    desc: 'Yeni qonaq qeydiyyatı',
                    color: '#10b981',
                    class: 'guest',
                    action: () => window.modalManager.showGuestForm()
                },
                {
                    icon: 'money-bill-wave',
                    label: 'Ödəniş Qəbul Et',
                    desc: 'Kassa mədaxil (gəlir) əlavə et',
                    color: '#f59e0b',
                    class: 'payment',
                    action: () => window.modalManager.showCashForm('income')
                },
                {
                    icon: 'cash-register',
                    label: 'POS Satış',
                    desc: 'Məhsul sat, alış/satış',
                    color: '#8b5cf6',
                    class: 'pos',
                    action: () => window.app && window.app.loadModule('pos')
                },
                {
                    icon: 'tools',
                    label: 'Təmir Tapşırığı',
                    desc: 'Yaranmış təmir və ya təmizlik əlavə et',
                    color: '#ef4444',
                    class: 'maintenance',
                    action: () => window.modalManager.showMaintenanceForm()
                },
                {
                    icon: 'chart-bar',
                    label: 'Hesabatlar',
                    desc: 'Bütün hesabatlara bax',
                    color: '#6b7280',
                    class: 'reports',
                    action: () => window.app && window.app.loadModule('reports')
                }
            ];

            function positionQuickActions() {
                const menu = document.getElementById('quickActionsMenu');
                if (!menu) return;

                menu.innerHTML = '';

                quickActions.forEach((action) => {
                    const button = document.createElement('button');
                    button.className = `quick-action-list-btn ${action.class}`;
                    button.type = "button";
                    button.tabIndex = 0;
                    button.onclick = () => {
                        action.action();
                        closeQuickActions();
                    };
                    button.innerHTML = `
                        <span class="qa-circle" style="background:${action.color}11;">
                            <i class="fas fa-fw fa-${action.icon}" style="color:${action.color}" aria-hidden="true"></i>
                        </span>
                        <span>
                            <span class="qa-label">${action.label}</span>
                            <span class="qa-desc">${action.desc}</span>
                        </span>
                    `;
                    menu.appendChild(button);
                });
            }

            function toggleQuickActions() {
                const menu = document.getElementById('quickActionsMenu');
                const isShowing = menu.classList.contains('show');
                if (!isShowing) {
                    positionQuickActions();
                    menu.classList.add('show');
                    setTimeout(() => {
                        const btn = menu.querySelector('.quick-action-list-btn');
                        btn && btn.focus();
                    }, 80);
                    setTimeout(() => {
                        document.addEventListener('click', closeQuickActions, { capture: true });
                    }, 100);
                } else {
                    closeQuickActions();
                }
            }

            function closeQuickActions(e) {
                const menu = document.getElementById('quickActionsMenu');
                const trigger = document.querySelector('.quick-actions-trigger');
                if (!e || (!menu && !trigger)) {
                    if(menu) menu.classList.remove('show');
                    document.removeEventListener('click', closeQuickActions, { capture: true });
                    return;
                }
                if (!menu.contains(e.target) && !trigger.contains(e.target)) {
                    menu.classList.remove('show');
                    document.removeEventListener('click', closeQuickActions, { capture: true });
                }
            }
            
            window.positionQuickActions = positionQuickActions;
            window.toggleQuickActions = toggleQuickActions;
            window.closeQuickActions = closeQuickActions;

            window.addEventListener('module-loaded', (e) => {
                const menu = document.getElementById('quickActionsMenu');
                if(menu) menu.classList.remove('show');
                
                // NEW: Clear dashboard clock interval when navigating away
                if (e.detail !== 'dashboard' && window.dashboardComponent?.clockInterval) {
                    clearInterval(window.dashboardComponent.clockInterval);
                    window.dashboardComponent.clockInterval = null;
                }
            });
        });

// --- SECTION --- 
// This global updateLoginBranding function is now obsolete as the logic is moved to app.js
        // and called via window.app.updateHotelNameInUI().
        // Keeping it here with a no-op to avoid breaking old references immediately.
        function updateLoginBranding() {
            if (window.app && typeof window.app.updateHotelNameInUI === 'function') {
                window.app.updateHotelNameInUI();
            } else {
                // Fallback for very early calls before app is fully initialized
                let hotelName = 'Otel İdarəetmə Sistemi';
                const loginHotelName = document.getElementById('loginHotelName');
                if (loginHotelName) {
                    loginHotelName.textContent = hotelName;
                }
                const pendingHotelName = document.getElementById('pendingApprovalScreen_HotelName');
                if (pendingHotelName) {
                    pendingHotelName.textContent = hotelName;
                }
                const loginCopyright = document.getElementById('loginCopyright');
                if (loginCopyright) {
                    loginCopyright.textContent = `© ${new Date().getFullYear()} ${hotelName}. Bütün hüquqlar qorunur.`;
                }
            }
        }

        // The DOMContentLoaded listener will be handled by AuthManager's initial UI setup,
        // which will then call window.app.updateHotelNameInUI().
        // Remove direct call here to avoid redundant or premature execution.
        // onReady( updateLoginBranding);

        // Update the event listener for 'hotelinfo-updated' to directly call the app's method
        window.addEventListener('hotelinfo-updated', () => {
            if (window.app && typeof window.app.updateHotelNameInUI === 'function') {
                window.app.updateHotelNameInUI();
            }
        });

        // REMOVED: The interval check is no longer needed as the initialization order is fixed in app.js
        /*
        const checkApp = setInterval(() => {
            if (window.app && typeof window.app !== "function" && typeof window.app.updateHotelNameInUI === 'function') {
                window.app.updateHotelNameInUI();
                clearInterval(checkApp);
            }
        }, 100);
        */

// --- SECTION --- 
(async function() {
            try {
                let version = '15.2.1';
                if (window.electronAPI && window.electronAPI.getAppVersion) {
                    version = await window.electronAPI.getAppVersion();
                }
                const versionElement = document.getElementById('footerAppVersionText');
                if (versionElement) {
                    versionElement.innerHTML = `RB Hotel &middot; Otel PMS | Versiya: ${version}`;
                }
            } catch {}
        })();

// --- SECTION --- 
function updateFirebaseSyncStatusUI(status) {
            const iconEl = document.getElementById('firebaseSyncIcon');
            const labelEl = document.getElementById('firebaseSyncLabel');
            const statusButton = document.getElementById('firebaseSyncBtn'); 

            if (!iconEl || !labelEl || !statusButton) return;

            labelEl.textContent = "";
            labelEl.style.color = "#64748b";
            labelEl.style.fontSize = "0.01em";
            labelEl.style.position = "absolute";
            labelEl.style.width = "1px";
            labelEl.style.height = "1px";
            labelEl.style.overflow = "hidden";
            labelEl.style.clip = "rect(1px, 1px, 1px, 1px)";
            labelEl.style.clipPath = "inset(50%)";
            labelEl.setAttribute("aria-label", status.connected ? "Firebase online" : "Firebase offline");

            let tooltipText = '';

            if (status.isSyncing) {
                iconEl.innerHTML = '<i class="fas fa-sync fa-spin"></i>'; 
                iconEl.style.color = '#f59e0b'; 
                tooltipText = 'Sinxronizasiya edilir...';
            } else if (status.connected) {
                iconEl.innerHTML = '<i class="fas fa-cloud"></i>';
                iconEl.style.color = '#10b981'; 
                tooltipText = `Sinxronizasiya: Online | Sonuncu: ${status.lastSync ? new Date(status.lastSync).toLocaleString('az-AZ') : 'Heç vaxt'}`;
            } else {
                if (status.error) {
                    iconEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                    iconEl.style.color = "#f59e0b"; 
                    tooltipText = `Sinxronizasiya Xətası: ${status.error}`;
                } else {
                    iconEl.innerHTML = '<i class="fas fa-cloud-slash"></i>';
                    iconEl.style.color = '#ef4444'; 
                    tooltipText = 'Sinxronizasiya: Offline';
                }
            }
            statusButton.setAttribute('title', tooltipText);
        }

        let firebaseSyncPollInterval;
        function checkAppReadyAndPollFirebaseSync() {
            if (window.app && window.app.ws && typeof window.app.ws.getConnectionStatus === 'function') {
                console.log('App and HybridDB ready, starting Firebase sync polling.');
                pollFirebaseSyncStatus(); 
                if (!firebaseSyncPollInterval) {
                    firebaseSyncPollInterval = setInterval(pollFirebaseSyncStatus, 10000); 
                }
            } else {
                setTimeout(checkAppReadyAndPollFirebaseSync, 200);
            }
        }

        onReady( checkAppReadyAndPollFirebaseSync);
        window.addEventListener('auth-success', () => setTimeout(checkAppReadyAndPollFirebaseSync, 500)); 
        window.addEventListener('syncend', () => setTimeout(pollFirebaseSyncStatus, 1000));
        window.addEventListener('syncstart', () => {
            updateFirebaseSyncStatusUI({connected: false, lastSync: '', error: null, isSyncing: true});
        });

        function pollFirebaseSyncStatus() {
            let status = {connected: false, lastSync: '', error: null, isSyncing: false, queueLength: 0}; 
            try {
                if (window.app && window.app.ws && typeof window.app.ws.getConnectionStatus === "function") {
                    const cs = window.app.ws.getConnectionStatus();
                    status = {
                        connected: !!(window.app.ws.onlineDBType && cs.isOnline && cs.hasOnlineDB),
                        lastSync: cs.lastSyncTime,
                        error: cs.lastError,
                        isSyncing: cs.queueLength > 0,
                        queueLength: cs.queueLength
                    };
                }
            } catch (e) {
                console.warn('Error in pollFirebaseSyncStatus:', e);
                status.error = 'API xətası: ' + e.message; 
            }
            updateFirebaseSyncStatusUI(status);
        }

        window.debugFirebaseSync = async function() {
            try {
                let log = "";
                let status = {connected: false, lastSync: '', error: null, isSyncing: false, queueLength: 0};
                let syncQueue = [];
                let deadLetterQueue = []; 
                if (window.app && window.app.ws) {
                    if (typeof window.app.ws.getConnectionStatus === "function") {
                        const cs = window.app.ws.getConnectionStatus();
                        status = {
                            connected: !!(window.app.ws.onlineDBType && cs.isOnline && cs.hasOnlineDB),
                            lastSync: cs.lastSyncTime,
                            error: cs.lastError,
                            isSyncing: cs.queueLength > 0,
                            queueLength: cs.queueLength
                        };
                        syncQueue = window.app.ws.syncQueue || [];
                        deadLetterQueue = JSON.parse(localStorage.getItem('deadLetterQueue') || '[]'); 
                    }
                }
                log += `Aktiv DB: ${window.app?.ws?.onlineDBType || '-'}\n`;
                log += `Bağlantı: ${status.connected ? "Online" : "Offline"}\n`;
                log += `Son Sync: ${status.lastSync ? new Date(status.lastSync).toLocaleString('az-AZ') : 'Heç vaxt'}\n`;
                log += `Sync Queue: ${status.queueLength} əməliyyat\n`;
                if (status.error) log += `Xəta: ${status.error}\n`;
                if (deadLetterQueue.length > 0) log += `Ölü Növbə (Dead Letter Queue): ${deadLetterQueue.length} əməliyyat\n`;

                log += `\n<a href='#' style="font-size:0.96em;margin-right:1em" onclick="window.debugFirebaseSyncForceSync()">Məcburi Sync et</a>   `;
                log += `<a href='#' style="font-size:0.96em" onclick="window.debugFirebaseSyncShowQueue()">Əməliyyatları Aç</a>`;
                if (deadLetterQueue.length > 0) {
                    log += `<br><a href='#' style="font-size:0.96em;margin-top:0.5em;" onclick="window.debugFirebaseSyncShowDeadQueue()">Ölü Növbəni Aç</a>`;
                }

                window.modalManager?.showModal("Firebase Sinxronizasiya Debug", 
                   `<div style="font-family:monospace;white-space:pre-wrap;font-size:1.02em;color:#374151;">${log}</div>`,
                   `<button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>`);
            } catch(e) {
                alert("Debug Xətası: " + e.message);
            }
        };
        window.debugFirebaseSyncForceSync = async function() {
            try {
                if (window.app && window.app.ws && typeof window.app.ws.performSync === "function") {
                    window.modalManager?.showModal("Sinxronizasiya", `<div>Zəhmət olmasın, gözləyin... Məcburi məlumat göndərilir...</div>`);
                    await window.app.ws.performSync(true); 
                    setTimeout(()=>{ window.debugFirebaseSync(); }, 800);
                }
            } catch(e) {
                window.modalManager?.showModal("Xəta", "<div>Məcburi sinxronizasiya uğursuz oldu: "+e.message+"</div>");
            }
        };
        window.debugFirebaseSyncShowQueue = function() {
            try {
                let syncQueue = window.app?.ws?.syncQueue || [];
                window.modalManager?.showModal("Sinx Queue Əməliyyatları (" + syncQueue.length + ")",
                    `<div style="max-height:60vh;overflow-y:auto;font-family:monospace;"><pre>` +
                    JSON.stringify(syncQueue, null, 2) +
                    `</pre></div>`,
                    `<button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>`);
            } catch(e) {
                alert("Queue Açılmadı: " + e.message);
            }
        };
        window.debugFirebaseSyncShowDeadQueue = function() { 
            try {
                let deadQueue = JSON.parse(localStorage.getItem('deadLetterQueue') || '[]');
                window.modalManager?.showModal("Ölü Növbə Əməliyyatları (" + deadQueue.length + ")",
                    `<div style="max-height:60vh;overflow-y:auto;font-family:monospace;"><pre>` +
                    JSON.stringify(deadQueue, null, 2) +
                    `</pre></div>`,
                    `<button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
                     <button class="btn btn-danger" style="margin-left:0.5em;" onclick="localStorage.removeItem('deadLetterQueue'); window.debugFirebaseSync()">Ölü Növbəni Təmizlə</button>
                    `);
            } catch(e) {
                alert("Ölü Növbə Açıla bilmədi: " + e.message);
            }
        };

        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                window.debugFirebaseSync();
            }
        });

        // Add a listener to re-check for the footer button after the app has fully initialized and rendered a module
        // This ensures the button appears even with delayed UI rendering.
        const recheckFooterButton = () => {
            try {
                const footerEl = document.getElementById('appVersionFooter') || document.getElementById('footerAppVersionText');
                if (footerEl && window.app && window.app.isSuperadmin && window.app.isSuperadmin()) {
                    if (!document.getElementById('debugFirebaseSyncBtn')) {
                        let btn = document.createElement('a');
                        btn.href = "#";
                        btn.textContent = "Firebase Sync Debug";
                        btn.style = "font-size:0.92em;margin-left:1em;color:#3b82f6;text-decoration:underline;cursor:pointer;";
                        btn.id = "debugFirebaseSyncBtn";
                        btn.onclick = function(e){e.preventDefault();window.debugFirebaseSync();};
                        footerEl.appendChild(btn);
                    }
                }
            } catch {}
        };

        // Check initially and also after a module is loaded to ensure button appears reliably.
        setTimeout(recheckFooterButton, 1800);
        window.addEventListener('module-loaded', () => setTimeout(recheckFooterButton, 200));

// --- SECTION --- 
(function() {
        let splashMessage = document.getElementById('splashStatusMessage');
        let splash = document.getElementById('splashScreen');
        let splashErrorShown = false;
        let progressTimeout, splashTimeout;
        let checkInterval;

        window.updateSplashProgress = function(percentage, message) {
            const progressBar = document.getElementById('splashProgressBar');
            const progressText = document.getElementById('splashProgressText');
            const statusMessage = document.getElementById('splashStatusMessage');
            const spinner = document.querySelector('.splash-loading-spinner');

            if (progressBar && progressText && spinner) {
                progressBar.style.display = 'block';
                progressText.style.display = 'block';
                spinner.style.display = 'none';
            }

            if (progressBar) {
                progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
            }
            if (progressText) {
                progressText.textContent = `${Math.round(percentage)}%`;
            }
            if (statusMessage && message) {
                statusMessage.textContent = message;
            }
        };

        function setSplashStatus(msg, isError = false) {
            if (splashMessage) {
                splashMessage.innerHTML = msg; 
                splashMessage.style.color = isError ? '#FFD2D2' : 'white';
            }
        }

        window.dismissSplashScreen = function() {
            const splashEl = document.getElementById('splashScreen');
            if (splashEl && !splashEl.classList.contains('fade-out')) {
                splashEl.classList.add('fade-out');
                setTimeout(() => {
                    try { splashEl.remove(); } catch(e){}
                }, 400);
            }
            if (checkInterval) clearInterval(checkInterval);
            if (progressTimeout) clearTimeout(progressTimeout);
            if (splashTimeout) clearTimeout(splashTimeout);
        };

        function checkAppReady() {
            const mainApp = document.getElementById('mainApp');
            const loginScreen = document.getElementById('loginScreen');
            const pendingScreen = document.getElementById('pendingApprovalScreen');

            const isMainAppVisible = mainApp && (mainApp.style.display === 'flex' || mainApp.style.display === 'block');
            const isLoginScreenVisible = loginScreen && (loginScreen.style.display === 'flex' || loginScreen.style.display === 'block' || (document.body.classList.contains('login-active') && window.getComputedStyle(loginScreen).display === 'flex'));
            const isPendingVisible = pendingScreen && (pendingScreen.style.display === 'flex' || pendingScreen.style.display === 'block');

            if (isMainAppVisible || isLoginScreenVisible || isPendingVisible || window.app?.isInitialized) {
                window.dismissSplashScreen();
                return true;
            }
            return false;
        }

        function scheduleSplashProgress() {
            progressTimeout = setTimeout(() => {
                setSplashStatus('Məlumatlar yoxlanılır...');
            }, 1000);

            splashTimeout = setTimeout(() => {
                if (!checkAppReady() && !splashErrorShown) {
                    console.warn('Splash timer: Auto-dismissing to prevent startup hang.');
                    window.dismissSplashScreen();
                    if (!window.authManager?.isAuthenticated) {
                        const ls = document.getElementById('loginScreen');
                        if (ls) ls.style.display = 'flex';
                        document.body.classList.add('login-active');
                    }
                }
            }, 3000);
        }

        function showSplashError(errorMessage) {
            if (splashErrorShown) return;
            splashErrorShown = true;
            setSplashStatus(errorMessage, true);
            const spinner = document.querySelector('.splash-loading-spinner');
            const progressContainer = document.querySelector('.splash-progress-container');
            const progressText = document.querySelector('.splash-progress-text');
            if(spinner) spinner.style.display = 'none'; 
            if(progressContainer) progressContainer.style.display = 'none';
            if(progressText) progressText.style.display = 'none';

            if (!document.getElementById('splashReloadBtn')) {
                let btn = document.createElement('button');
                btn.id = 'splashReloadBtn';
                btn.className = 'btn btn-primary';
                btn.style = 'margin:1.2rem auto 0 auto;display:block;background:white;color:#3b82f6;';
                btn.innerHTML = '<i class="fas fa-arrow-right"></i> Giriş ekranına keç';
                btn.onclick = () => {
                    window.dismissSplashScreen();
                    document.getElementById('loginScreen')?.style.setProperty('display', 'flex');
                    document.body.classList.add('login-active');
                };
                splashMessage?.parentNode?.appendChild(btn);
            }
            if (progressTimeout) clearTimeout(progressTimeout);
            if (splashTimeout) clearTimeout(splashTimeout);
        }

        window.addEventListener('error', function(e) {
            if (splash && !checkAppReady() && !splashErrorShown) {
                showSplashError('Sistem xəta ilə yüklənmədi.<br>' + (e.message || 'Xəta baş verdi'));
            }
        });

        onReady( function() {
            scheduleSplashProgress();
            checkInterval = setInterval(() => {
                if (checkAppReady()) {
                    clearInterval(checkInterval);
                }
            }, 150);
        });
    })();