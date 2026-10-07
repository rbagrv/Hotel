"use client";

import React, { useState, useEffect, useRef } from "react";

export default function ModernWidgets() {
  const [theme, setTheme] = useState("light");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // WhatsApp Modal State
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waTab, setWaTab] = useState("send"); // 'send' | 'qr' | 'status'
  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [waSending, setWaSending] = useState(false);
  const [waStatus, setWaStatus] = useState(null);
  const [waQrData, setWaQrData] = useState(null);

  // Live Occupancy State
  const [occupancy, setOccupancy] = useState({ total: 0, occupied: 0, percent: 0 });

  // 1. Initialize Theme from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cardinal_theme") || "light";
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("cardinal_theme", next);
    } catch {}
    if (window.notificationManager) {
      window.notificationManager.showNotification(
        "info",
        next === "dark" ? "Gecə Rejimi" : "Gündüz Rejimi",
        `Görünüş ${next === "dark" ? "qaranlıq" : "işıqlı"} rejimə keçirildi.`,
        2000
      );
    }
  };

  // 2. Global Shortcut: Ctrl+K / Cmd+K for Command Palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
        setWaModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 3. Inject modern header controls into the top bar
  useEffect(() => {
    const interval = setInterval(() => {
      // Calculate live room occupancy
      if (window.app?.data?.rooms) {
        const total = window.app.data.rooms.length;
        const occupied = (window.app.data.reservations || []).filter(
          (r) => r.status === "checked-in" || r.status === "confirmed"
        ).length;
        const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
        setOccupancy({ total, occupied, percent: pct });
      }

      // Inject top bar buttons if not already present
      const topRight = document.querySelector(".luxuria-top-right");
      if (topRight && !document.getElementById("next-modern-controls")) {
        const container = document.createElement("div");
        container.id = "next-modern-controls";
        container.style = "display: flex; align-items: center; gap: 0.5rem;";

        // WhatsApp Button
        const waBtn = document.createElement("button");
        waBtn.className = "whatsapp-topbar-btn";
        waBtn.title = "WhatsApp Mikroservisi və Bildirişlər";
        waBtn.innerHTML = '<i class="fab fa-whatsapp"></i> <span>WhatsApp</span>';
        waBtn.onclick = () => {
          setWaModalOpen(true);
          fetchWhatsAppStatus();
        };

        // Theme Toggle Button
        const themeBtn = document.createElement("button");
        themeBtn.className = "luxuria-top-btn";
        themeBtn.id = "modernThemeToggleBtn";
        themeBtn.title = "Gecə / Gündüz Rejimi";
        themeBtn.innerHTML = `<i class="fas fa-${theme === "dark" ? "sun" : "moon"}"></i>`;
        themeBtn.onclick = toggleTheme;

        // Command Palette Button
        const cmdBtn = document.createElement("button");
        cmdBtn.className = "luxuria-top-btn";
        cmdBtn.title = "Sürətli Əməliyyat Axtarışı (Ctrl+K)";
        cmdBtn.innerHTML = '<i class="fas fa-terminal"></i>';
        cmdBtn.onclick = () => setCmdOpen(true);

        container.appendChild(waBtn);
        container.appendChild(cmdBtn);
        container.appendChild(themeBtn);

        topRight.insertBefore(container, topRight.firstChild);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [theme]);

  // Update theme toggle icon when theme changes
  useEffect(() => {
    const btn = document.getElementById("modernThemeToggleBtn");
    if (btn) {
      btn.innerHTML = `<i class="fas fa-${theme === "dark" ? "sun" : "moon"}"></i>`;
    }
  }, [theme]);

  // Fetch WhatsApp Status from API
  const fetchWhatsAppStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      setWaStatus(data);
    } catch (e) {
      setWaStatus({ success: false, message: "Server status xətası" });
    }
  };

  // Fetch WhatsApp QR Code
  const fetchWhatsAppQr = async () => {
    try {
      const res = await fetch("/api/whatsapp/qr");
      const data = await res.json();
      setWaQrData(data);
    } catch (e) {
      setWaQrData({ success: false, message: "QR kod əldə edilmədi" });
    }
  };

  // Send WhatsApp Message
  const handleSendWhatsApp = async () => {
    if (!waPhone || !waMessage) {
      alert("Zəhmət olmasa telefon nömrəsi və mesaj daxil edin.");
      return;
    }

    setWaSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: waPhone, message: waMessage }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.provider === "wa_direct_link" && data.waLink) {
          window.open(data.waLink, "_blank");
          window.notificationManager?.showNotification(
            "info",
            "WhatsApp Açıldı",
            "Birbaşa WhatsApp mesaj pəncərəsi açıldı.",
            4000
          );
        } else {
          window.notificationManager?.showNotification(
            "success",
            "WhatsApp Göndərildi",
            `${waPhone} nömrəsinə bildiriş çatdırıldı!`,
            4000
          );
        }
        setWaMessage("");
        setWaModalOpen(false);
      } else {
        alert("Xəta: " + (data.error || "Mesaj göndərilmədi"));
      }
    } catch (err) {
      alert("Şəbəkə xətası: " + err.message);
    } finally {
      setWaSending(false);
    }
  };

  // Command Palette Items & Filter
  const defaultActions = [
    {
      id: "new_res",
      title: "Yeni Rezervasiya Yarat",
      group: "Sürətli Əməliyyat",
      icon: "fa-calendar-plus",
      run: () => window.reservationForm?.openCreateModal?.(),
    },
    {
      id: "new_guest",
      title: "Yeni Qonaq Qeydiyyatı",
      group: "Sürətli Əməliyyat",
      icon: "fa-user-plus",
      run: () => window.guestForm?.openCreateModal?.(),
    },
    {
      id: "new_room",
      title: "Yeni Otaq Əlavə Et",
      group: "Sürətli Əməliyyat",
      icon: "fa-door-open",
      run: () => window.roomForm?.openCreateModal?.(),
    },
    {
      id: "whatsapp_open",
      title: "WhatsApp İdarəetmə Paneli",
      group: "Kommunikasiya",
      icon: "fa-comments",
      run: () => {
        setWaModalOpen(true);
        fetchWhatsAppStatus();
      },
    },
    {
      id: "nav_dashboard",
      title: "Əsas Panel (Dashboard)",
      group: "Modullar",
      icon: "fa-th-large",
      run: () => window.moduleRenderer?.renderModule?.("dashboard"),
    },
    {
      id: "nav_rooms",
      title: "Otaqlar Paneli",
      group: "Modullar",
      icon: "fa-bed",
      run: () => window.moduleRenderer?.renderModule?.("rooms"),
    },
    {
      id: "nav_reservations",
      title: "Rezervasiyalar Siyahısı",
      group: "Modullar",
      icon: "fa-calendar-check",
      run: () => window.moduleRenderer?.renderModule?.("reservations"),
    },
    {
      id: "nav_guests",
      title: "Qonaqlar Kartoteki",
      group: "Modullar",
      icon: "fa-users",
      run: () => window.moduleRenderer?.renderModule?.("guests"),
    },
    {
      id: "nav_pos",
      title: "POS Satış & Restoran",
      group: "Modullar",
      icon: "fa-cash-register",
      run: () => window.moduleRenderer?.renderModule?.("pos"),
    },
    {
      id: "nav_cash",
      title: "Kassa & Əməliyyatlar",
      group: "Modullar",
      icon: "fa-wallet",
      run: () => window.moduleRenderer?.renderModule?.("cash"),
    },
    {
      id: "nav_reports",
      title: "Maliyyə və Hesabatlar",
      group: "Modullar",
      icon: "fa-chart-bar",
      run: () => window.moduleRenderer?.renderModule?.("reports"),
    },
  ];

  // Dynamic filter
  const filteredActions = defaultActions.filter((a) =>
    a.title.toLowerCase().includes(cmdQuery.toLowerCase())
  );

  return (
    <>
      {/* 1. COMMAND PALETTE MODAL (CTRL+K) */}
      {cmdOpen && (
        <div className="cmd-palette-backdrop" onClick={() => setCmdOpen(false)}>
          <div className="cmd-palette-box" onClick={(e) => e.stopPropagation()}>
            <div className="cmd-input-wrap">
              <i className="fas fa-search cmd-input-icon"></i>
              <input
                type="text"
                className="cmd-search-input"
                placeholder="Əməliyyat, modul və ya qonaq axtarın... (məs: Rezervasiya, Otaq)"
                value={cmdQuery}
                autoFocus
                onChange={(e) => setCmdQuery(e.target.value)}
              />
              <span className="cmd-kbd-badge">ESC</span>
            </div>

            <div className="cmd-results-list">
              <div className="cmd-group-title">Sürətli Seçimlər</div>
              {filteredActions.length === 0 ? (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8" }}>
                  Nəticə tapılmadı.
                </div>
              ) : (
                filteredActions.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`cmd-item ${idx === selectedIndex ? "active" : ""}`}
                    onClick={() => {
                      item.run();
                      setCmdOpen(false);
                      setCmdQuery("");
                    }}
                  >
                    <div className="cmd-item-left">
                      <div className="cmd-item-icon">
                        <i className={`fas ${item.icon}`}></i>
                      </div>
                      <div>
                        <div className="cmd-item-title">{item.title}</div>
                        <div className="cmd-item-sub">{item.group}</div>
                      </div>
                    </div>
                    <span className="cmd-kbd-badge">Keç</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. WHATSAPP COMMUNICATOR MODAL */}
      {waModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 99998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setWaModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "580px",
              background: "var(--card-bg, #ffffff)",
              borderRadius: "16px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="wa-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <i className="fab fa-whatsapp" style={{ fontSize: "1.6rem" }}></i>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                    WhatsApp Kommunikator
                  </h3>
                  <small style={{ opacity: 0.9 }}>Cardinal PMS Mikroservis İnteqrasiyası</small>
                </div>
              </div>
              <button
                onClick={() => setWaModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Tabs */}
            <div className="wa-modal-tabs">
              <button
                className={`wa-tab-btn ${waTab === "send" ? "active" : ""}`}
                onClick={() => setWaTab("send")}
              >
                <i className="fas fa-paper-plane"></i> Mesaj Göndər
              </button>
              <button
                className={`wa-tab-btn ${waTab === "qr" ? "active" : ""}`}
                onClick={() => {
                  setWaTab("qr");
                  fetchWhatsAppQr();
                }}
              >
                <i className="fas fa-qrcode"></i> QR Qoşulma
              </button>
              <button
                className={`wa-tab-btn ${waTab === "status" ? "active" : ""}`}
                onClick={() => {
                  setWaTab("status");
                  fetchWhatsAppStatus();
                }}
              >
                <i className="fas fa-info-circle"></i> Status & Server
              </button>
            </div>

            {/* Content Tab 1: Send Message */}
            {waTab === "send" && (
              <div style={{ padding: "1.5rem" }}>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    Qonağın Telefon Nömrəsi:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="+994501234567"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                {/* Template Chips */}
                <div style={{ marginBottom: "1rem" }}>
                  <small style={{ display: "block", color: "#64748b", marginBottom: "0.4rem", fontWeight: 600 }}>
                    Sürətli Şablonlar:
                  </small>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    <button
                      type="button"
                      className="wa-chip-btn"
                      onClick={() =>
                        setWaMessage(
                          `Hörmətli qonaq,\n\n🏨 Otelimizdə rezervasiyanız uğurla təsdiqləndi!\nSizi qarşılamaqdan məmnun olarıq. Giriş saatı: 14:00.`
                        )
                      }
                    >
                      <i className="fas fa-check-circle"></i> Rezervasiya Təsdiqi
                    </button>
                    <button
                      type="button"
                      className="wa-chip-btn"
                      onClick={() =>
                        setWaMessage(
                          `Xoş gəlmisiniz! 🛎️\nOtağınız hazırdır.\nWi-Fi Şifrəsi: HotelGuest2026\nOtaq Servisi: 101`
                        )
                      }
                    >
                      <i className="fas fa-concierge-bell"></i> Xoş Gəlmisiniz (Wi-Fi)
                    </button>
                    <button
                      type="button"
                      className="wa-chip-btn"
                      onClick={() =>
                        setWaMessage(
                          `Hörmətli qonaq, otelimizdə qaldığınız üçün təşəkkür edirik! 🌟 Çıxış saatınız: 12:00. Uğurlu yol arzulayırıq!`
                        )
                      }
                    >
                      <i className="fas fa-sign-out-alt"></i> Çıxış & Təşəkkür
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    Mesaj Mətni:
                  </label>
                  <textarea
                    rows={4}
                    className="form-textarea"
                    placeholder="Qonağa çatdırılacaq mesajı yazın..."
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setWaModalOpen(false)}
                    style={{ padding: "0.6rem 1.25rem", borderRadius: "8px" }}
                  >
                    Ləğv et
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={waSending}
                    onClick={handleSendWhatsApp}
                    style={{
                      background: "#25d366",
                      borderColor: "#25d366",
                      padding: "0.6rem 1.4rem",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <i className="fab fa-whatsapp"></i> {waSending ? "Göndərilir..." : "WhatsApp ilə Göndər"}
                  </button>
                </div>
              </div>
            )}

            {/* Content Tab 2: QR Code */}
            {waTab === "qr" && (
              <div style={{ padding: "1.75rem", textAlign: "center" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#1e293b" }}>WhatsApp Hesabınızı Qoşun</h4>
                <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 1.25rem 0" }}>
                  Telefonunuzda WhatsApp tətbiqini açın &gt; <b>Bağlı Cihazlar</b> &gt; <b>Cihazı Bağla</b> seçin və bu QR kodu skan edin:
                </p>

                <div
                  style={{
                    display: "inline-block",
                    padding: "1rem",
                    background: "white",
                    borderRadius: "12px",
                    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.08)",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {waQrData?.qrCodeUrl ? (
                    <img
                      src={waQrData.qrCodeUrl}
                      alt="WhatsApp QR Code"
                      style={{ width: "200px", height: "200px", display: "block" }}
                    />
                  ) : (
                    <div style={{ width: "200px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                      <i className="fas fa-spinner fa-spin fa-2x"></i>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "1.25rem" }}>
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={fetchWhatsAppQr}
                    style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", borderRadius: "8px" }}
                  >
                    <i className="fas fa-sync-alt"></i> QR Kodu Yenilə
                  </button>
                </div>
              </div>
            )}

            {/* Content Tab 3: Status */}
            {waTab === "status" && (
              <div style={{ padding: "1.5rem" }}>
                <div
                  style={{
                    background: waStatus?.microserviceConnected ? "#ecfdf5" : "#fffbeb",
                    border: `1px solid ${waStatus?.microserviceConnected ? "#a7f3d0" : "#fde68a"}`,
                    padding: "1rem",
                    borderRadius: "10px",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ fontWeight: 600, color: waStatus?.microserviceConnected ? "#065f46" : "#92400e" }}>
                    <i className={`fas fa-${waStatus?.microserviceConnected ? "check-circle" : "exclamation-triangle"}`}></i>{" "}
                    {waStatus?.microserviceConnected ? "Mikroservis Aktivdir" : "Mikroservis Gözləmə Rejimindədir"}
                  </div>
                  <small style={{ display: "block", marginTop: "0.35rem", color: "#475569" }}>
                    {waStatus?.message || "Port 3001 üzərində WhatsApp Mikroservis statusu yoxlanılır."}
                  </small>
                </div>

                <div style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.6 }}>
                  <div><b>Ünvan:</b> {waStatus?.microserviceUrl || "http://localhost:3001"}</div>
                  <div><b>Birbaşa Web Link Fallback:</b> Aktivdir (Avtomatik wa.me yönləndirməsi)</div>
                  <div><b>Təyinat:</b> Qonaqlara avtomatik təsdiq mesajları və bildirişlər</div>
                </div>

                <div style={{ marginTop: "1.25rem", textAlign: "right" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={fetchWhatsAppStatus}
                    style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", borderRadius: "8px" }}
                  >
                    <i className="fas fa-sync"></i> Yoxla
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
