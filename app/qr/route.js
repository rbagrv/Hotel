import { NextResponse } from "next/server";
import { getSessionState } from "../../lib/whatsapp-session.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return handleQr(request);
}

export async function POST(request) {
  return handleQr(request);
}

async function handleQr(request) {
  const session = getSessionState();
  const sessionId = `hotel_pms_${Date.now()}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=WHATSAPP_CARDINAL_PMS_${sessionId}`;

  return NextResponse.json({
    success: true,
    connected: session.connected,
    qrCodeUrl: qrCodeUrl,
    sessionId: sessionId,
    phoneNumber: session.phoneNumber,
    message: session.connected
      ? "WhatsApp hesabı artıq qoşulub və aktivdir."
      : "WhatsApp tətbiqinizlə QR kodu skan edin və ya cütləşməni təsdiqləyin.",
  });
}
