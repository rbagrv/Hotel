import { NextResponse } from "next/server";

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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

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
      message: `WhatsApp mikroservis (${microserviceUrl}) əlçatan deyil və ya QR hazır deyil.`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
