import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const microserviceUrl = process.env.WHATSAPP_MICROSERVICE_URL || "http://localhost:3001";
  
  try {
    // Attempt ping to standalone microservice
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

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

    // Fallback status if standalone microservice is offline or using Cloud API
    const isCloudConfigured = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

    return NextResponse.json({
      success: true,
      microserviceConnected: false,
      microserviceUrl,
      status: isCloudConfigured ? "cloud_ready" : "ready_for_pairing",
      message: isCloudConfigured 
        ? "WhatsApp Cloud API aktivdir." 
        : "WhatsApp Mikroservis hazır vəziyyətdədir (QR kod və ya mikroservis başlatmaq lazımdır).",
      directWebFallbackAvailable: true,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err.message,
      microserviceConnected: false,
    }, { status: 500 });
  }
}
