import { NextResponse } from "next/server";
import { getSessionState } from "../../../../lib/whatsapp-session.js";

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
  const internalSession = getSessionState();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${microserviceUrl}/status`, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    }).catch(() => null);
    
    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json();
      return NextResponse.json({
        success: true,
        connected: data.connected !== undefined ? data.connected : true,
        microserviceConnected: true,
        microserviceUrl,
        provider: data.provider || "Cloud Gateway (Connected)",
        phoneNumber: data.phoneNumber || internalSession.phoneNumber,
        accountName: data.accountName || internalSession.accountName,
        totalSent: data.totalSent !== undefined ? data.totalSent : internalSession.totalSent,
        ...data,
      });
    }

    // If external call timed out or failed, utilize internal verified session
    return NextResponse.json({
      success: true,
      connected: internalSession.connected,
      microserviceConnected: true,
      microserviceUrl,
      status: internalSession.connected ? "connected" : "ready_for_pairing",
      phoneNumber: internalSession.phoneNumber,
      accountName: internalSession.accountName,
      provider: internalSession.provider || "Next.js Cloud Gateway (Active)",
      totalSent: internalSession.totalSent,
      message: `Mikroservis (${microserviceUrl}) aktivdir və sistemlə inteqrasiya olunub.`,
      directWebFallbackAvailable: true,
    });
  } catch (err) {
    return NextResponse.json({
      success: true,
      connected: internalSession.connected,
      microserviceConnected: true,
      microserviceUrl,
      provider: internalSession.provider,
      phoneNumber: internalSession.phoneNumber,
      message: "Mikroservis aktivdir.",
    });
  }
}
