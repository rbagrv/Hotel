# Hotel PMS - Central Database Setup for Netlify

This README explains how the Hotel PMS ensures data consistency across multiple users and devices when deployed on platforms like Netlify.

[![Netlify Status](https://api.netlify.com/api/v1/badges/31c4f294-5342-4e41-a29c-8d25aa291340/deploy-status)](https://app.netlify.com/projects/cardinalotel/deploys)

## Central Database Strategy

The Hotel PMS uses a "Hybrid Database" approach, combining a local, offline-first database (LocalStorage/IndexedDB in the browser, SQLite in Electron) with a central, online cloud database.

This strategy ensures:
1.  **Offline Capability**: Users can continue working even without an internet connection.
2.  **Data Consistency**: All users see the same data across devices when online.
3.  **Automatic Synchronization**: Data is automatically synced between the local device and the central cloud database when an internet connection is available.

### Supported Central Databases:

The application can be configured to use one of the following as its central online database:

1.  **Firebase Firestore (Default)**:
    *   **Recommended for ease of setup.**
    *   The application includes default, public Firebase project keys in `app.js`. This means if you deploy to Netlify without any custom database settings, it will automatically connect to a shared Firebase project.
    *   This is the quickest way to get a live, central database working for your Netlify deploy.
    *   For a private, production setup, you should create your own Firebase project and configure its keys in the application's settings.

#### Firebase Firestore Security Rules (Tövsiyə olunan Qaydalar)

Məlumatlarınızın təhlükəsizliyini təmin etmək üçün Firebase Firestore qaydalarını aşağıdakı kimi təyin etmək tövsiyə olunur. Bu qaydalar, hər hansı bir əməliyyat üçün istifadəçinin sistemə daxil olmasını (autentifikasiyadan keçməsini) tələb edir və daha sonra `staff` kolleksiyasındakı roluna (`role`) və ya superadmin statusuna (`isSuperadmin`) əsasən oxumaq və yazmaq icazələri verir.

**Qeyd:** Bu qaydaların düzgün işləməsi üçün `staff` kolleksiyasında istifadəçilərinizin (Firebase Authenticated `uid` ilə eyni `id`-yə sahib olan) qeydləri olmalı və `role` (`staff`, `manager`, `admin`, `superadmin`) və `isSuperadmin` (boolean) sahələri düzgün təyin edilməlidir.

```firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 🔧 Helper funksiyalar
    function getStaff(uid) {
      return get(/databases/$(database)/documents/staff/$(uid));
    }

    function getRole(uid) {
      let doc = getStaff(uid);
      return doc != null ? doc.data.role : null;
    }

    function isAdmin(uid) {
      let doc = getStaff(uid);
      return doc != null && (doc.data.role == 'admin' || doc.data.isSuperadmin == true);
    }

    function isManager(uid) {
      return getRole(uid) == 'manager' || isAdmin(uid);
    }

    function isStaff(uid) {
      return getRole(uid) == 'staff' || isManager(uid);
    }

    function targetIsSuperadmin(uid) {
      let doc = getStaff(uid);
      return doc != null && doc.data.isSuperadmin == true;
    }

    // 1. 👤 Staff
    match /staff/{userId} {
      // Any authenticated user can read staff data. This is necessary for the app to
      // determine the user's role and permissions upon login.
      allow read: if request.auth != null;

      // A newly authenticated user (request.auth.uid) can CREATE their own staff profile IF it doesn't exist yet,
      // AND its ID matches their UID. This is crucial for initial setup.
      allow create: if request.auth != null && request.auth.uid == userId;

      // Superadmins can write (create/update) any staff profile, including other superadmins
      allow write: if request.auth != null && getStaff(request.auth.uid).data.isSuperadmin == true;

      // Admins can write (create/update) staff profiles, but NOT other superadmins
      allow write: if request.auth != null && isAdmin(request.auth.uid) && !targetIsSuperadmin(userId);

      // Users can update their own profile (e.g. phone, telegramId) IF their UID matches the target ID
      allow update: if request.auth != null && request.auth.uid == userId;

      // Superadmins can delete any staff profile
      allow delete: if request.auth != null && getStaff(request.auth.uid).data.isSuperadmin == true;
      // Admins can delete staff profiles, but NOT other superadmins
      allow delete: if request.auth != null && isAdmin(request.auth.uid) && !targetIsSuperadmin(userId);
    }

    // 2. ⚙️ Settings
    match /settings/{docId} {
      allow read: if request.auth != null;
      allow write, delete: if isAdmin(request.auth.uid);
    }

    // 3. 📋 Audit logs
    match /audit_logs/{docId} {
      allow read: if isAdmin(request.auth.uid); // Admins can read
      allow write, delete: if isAdmin(request.auth.uid); // Admins and above can write/delete
    }

    // 4. 📊 Reports
    match /reports/{docId} {
      allow read: if isManager(request.auth.uid); // Managers and above can read
      allow write, delete: if isAdmin(request.auth.uid); // Admins and above can write/delete
    }

    // 5. 🧪 Diagnostics
    match /diagnostics/{docId} {
      allow read: if true; // Public read for connection diagnostics
      allow write, delete: if request.auth != null; // Only authenticated users can write/delete diagnostics
    }

    // 6. 📦 Əsas kolleksiyalar - Granular permissions by role
    match /{collection}/{docId} {
      allow read: if request.auth != null;

      // Allow write (create/update) for Superadmins for all collections
      allow write: if isSuperadmin(request.auth.uid);

      // Allow write (create/update) for Admins for all core collections
      allow write: if isAdmin(request.auth.uid);

      // Allow write (create/update) for Managers for specific collections
      allow write: if isManager(request.auth.uid) && (
        collection in ['guests', 'rooms', 'reservations', 'services', 'inventory', 'cash_transactions', 'invoices', 'pos_sales', 'purchase_documents', 'maintenance', 'system_errors'] // NEW: Admins/Managers can create system errors
      );

      // Allow write (create/update) for Staff for specific collections
      allow write: if isStaff(request.auth.uid) && (
        collection in ['guests', 'rooms', 'reservations', 'services', 'inventory', 'cash_transactions', 'maintenance', 'pos_sales', 'reports', 'purchase_documents', 'system_errors']
      );

      // Allow delete for Superadmins for all collections
      allow delete: if isSuperadmin(request.auth.uid);

      // Allow delete for Admins for all core collections
      // NOTE: As per user request, Admins already have permission to delete all operations/documents
      // in all core collections via this rule.
      allow delete: if isAdmin(request.auth.uid);

      // Allow delete for Managers for specific transactional collections
      allow delete: if isManager(request.auth.uid) && (
        collection in ['pos_sales', 'maintenance', 'cash_transactions', 'system_errors']
      );
    }

    // 7. ❌ Default deny
    match /{path=**} {
      allow read, write: if false;
    }
  }
}
```