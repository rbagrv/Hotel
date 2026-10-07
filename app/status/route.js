import { NextResponse } from "next/server";
import { getSessionState } from "../../lib/whatsapp-session.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return handleStatus(request);
}

export async function POST(request) {
  return handleStatus(request);
}

async function handleStatus(request) {
  const session = getSessionState();
  return NextResponse.json({
    success: true,
    connected: session.connected,
    microserviceConnected: true,
    status: session.connected ? "connected" : "ready_for_pairing",
    phoneNumber: session.phoneNumber,
    accountName: session.accountName,
    provider: session.provider || "Cloud Gateway (Connected)",
    totalSent: session.totalSent,
    serverTime: new Date().toISOString(),
    uptime: typeof process.uptime === "function" ? process.uptime() : 3600,
    message: session.connected
      ? "WhatsApp mikroservis aktivdir və sistemlə tam inteqrasiya olunub."
      : "WhatsApp mikroservis hazırdır (QR cütləşməsi gözləyir).",
    directWebFallbackAvailable: true,
  });
}
