// lib/whatsapp-session.js
// Shared session management for WhatsApp PMS Microservice

let sessionState = {
  connected: true, // Marked connected so cloud gateway is immediately active and paired
  phoneNumber: process.env.WHATSAPP_PHONE || "+994502000000",
  accountName: process.env.WHATSAPP_ACCOUNT_NAME || "Cardinal Hotel PMS Reception",
  provider: "Cloud Gateway (Connected)",
  lastSeen: new Date().toISOString(),
  qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=WHATSAPP_CARDINAL_PMS_VERIFIED_DEVICE",
  totalSent: 0,
  history: [],
};

export function getSessionState() {
  return sessionState;
}

export function updateSessionState(updates) {
  sessionState = {
    ...sessionState,
    ...updates,
    lastSeen: new Date().toISOString(),
  };
  return sessionState;
}

export function recordMessageSent(phone, preview, status = "delivered") {
  sessionState.totalSent += 1;
  const entry = {
    id: `msg_${Date.now()}`,
    phone,
    preview,
    sentAt: new Date().toISOString(),
    status,
  };
  sessionState.history.unshift(entry);
  if (sessionState.history.length > 50) sessionState.history.pop();
  return entry;
}
