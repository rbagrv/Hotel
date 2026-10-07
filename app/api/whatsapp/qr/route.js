import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const microserviceUrl = process.env.WHATSAPP_MICROSERVICE_URL || "http://localhost:3001";

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

    return NextResponse.json({
      success: false,
      connected: false,
      message: "WhatsApp mikroservisi əlçatan deyil. Zəhmət olmasa, mikroservisi işə salın (whatsapp-microservice).",
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
