import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return handleStatus(request);
}

export async function POST(request) {
  return handleStatus(request);
}

async function handleStatus(request) {
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

    const res = await fetch(`${microserviceUrl}/status`, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    }).catch(() => null);
    
    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json();
      return NextResponse.json({
        success: true,
        microserviceConnected: true,
        microserviceUrl,
        ...data,
      });
    }

    const isCloudConfigured = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

    return NextResponse.json({
      success: true,
      microserviceConnected: false,
      microserviceUrl,
      status: isCloudConfigured ? "cloud_ready" : "ready_for_pairing",
      message: isCloudConfigured 
        ? "WhatsApp Cloud API aktivdir." 
        : `Mikroservis (${microserviceUrl}) hazır vəziyyətdədir.`,
      directWebFallbackAvailable: true,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err.message,
      microserviceConnected: false,
      microserviceUrl,
    }, { status: 500 });
  }
}
