INSERT INTO public.guests (id, name, email, phone, passportNo, nationality, address, birthDate, gender, documentUrl, createdAt)
VALUES
('QN-00001', 'Rashad', 'r.bagrv1@gmail.com', '0558409394', 'Jkılk', 'Azərbaycan', 'M.A.Rssulzada 115', '2025-06-30', 'Kişi', 'https://api.websim.com/blobs/0197c00e-1cfa-7e01-bab7-9af4ecd36ea5.jpeg', '2025-06-30');

CREATE TABLE IF NOT EXISTS public.guests (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text,
    phone text,
    passportNo text,
    nationality text,
    address text,
    birthDate text,
    gender text,
    documentUrl text,
    createdAt text
);

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
      allow read: if true; // Allow unauthenticated read for staff cache sync

      // A newly authenticated user (request.auth.uid) can CREATE their own staff profile IF it doesn't exist yet,
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
      allow read: if true; // Allow unauthenticated read for hotel info loading
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
        collection in ['guests', 'rooms', 'reservations', 'services', 'inventory', 'cash_transactions', 'invoices', 'pos_sales', 'purchase_documents', 'maintenance', 'system_errors']
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