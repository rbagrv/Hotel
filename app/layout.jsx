import React from "react";

export const metadata = {
  title: "Otel İdarəetmə Sistemi - Next.js PMS",
  description: "Müasir Otel İdarəetmə Sistemi (PMS)",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3b82f6",
};

export default function RootLayout({ children }) {
  const firebaseImportMap = {
    imports: {
      "firebase/app": "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js",
      "firebase/firestore": "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js",
      "firebase/auth": "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js",
      "firebase/analytics": "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js",
      "firebase/performance": "https://www.gstatic.com/firebasejs/11.10.0/firebase-performance.js"
    }
  };

  return (
    <html lang="az">
      <head>
        {/* Core Stylesheets */}
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/modern-theme.css" />

        {/* Fonts & Icons */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Outlined|Material+Icons+Round"
          rel="stylesheet"
        />
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/vanillajs-datepicker@1.3.4/dist/css/datepicker.min.css"
        />

        {/* External vendor CDN scripts */}
        <script src="https://cdn.jsdelivr.net/npm/chart.js" defer></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" defer></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js" defer></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" defer></script>
        <script src="https://cdn.jsdelivr.net/npm/vanillajs-datepicker@1.3.4/dist/js/datepicker-full.min.js" defer></script>
        <script src="https://cdn.jsdelivr.net/npm/vanillajs-datepicker@1.3.4/dist/js/locales/az.js" defer></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" defer></script>

        {/* Firebase Modular Import Map */}
        <script
          type="importmap"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(firebaseImportMap) }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
