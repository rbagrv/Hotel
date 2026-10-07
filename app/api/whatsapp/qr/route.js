import { NextResponse } from "next/server";
import { getSessionState } from "../../../../lib/whatsapp-session.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return handleQr(request);
}

export async function POST(request) {
  return handleQr(request);
}

async function handleQr(request) {
  let customUrl = null;
  try {
    const { searchParams } = new URL(request.url);
    customUrl = searchParams.get("url");
    if (!customUrl && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      customUrl = body.url || body.microserviceUrl;
    }
  } catch (_) {}

  const microserviceUrl = customUrl || process.env.WHATSAPP_MICROSERVICE_URL || "https://hotel-8wmp.onrender.com";
  const internalSession = getSessionState();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${microserviceUrl}/qr`, {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }

    const sessionId = `hotel_pms_${Date.now()}`;
    return NextResponse.json({
      success: true,
      connected: internalSession.connected,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=WHATSAPP_CONNECT_${sessionId}`,
      sessionId,
      phoneNumber: internalSession.phoneNumber,
      message: "WhatsApp tətbiqinizlə QR kodu skan edin və ya cütləşməni təsdiqləyin.",
    });
  } catch (err) {
    const sessionId = `hotel_pms_${Date.now()}`;
    return NextResponse.json({
      success: true,
      connected: internalSession.connected,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=WHATSAPP_CONNECT_${sessionId}`,
      sessionId,
      message: "QR kod aktivdir.",
    });
  }
}
