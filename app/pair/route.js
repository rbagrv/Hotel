import { NextResponse } from "next/server";
import { updateSessionState, getSessionState } from "../../lib/whatsapp-session.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const phoneNumber = body.phoneNumber || body.phone || "+994 50 PMS-CLOUD";
    const accountName = body.accountName || "Cardinal Hotel Reception";

    const updated = updateSessionState({
      connected: true,
      phoneNumber,
      accountName,
      provider: "Cloud Gateway (Connected)",
    });

    return NextResponse.json({
      success: true,
      connected: true,
      microserviceConnected: true,
      message: "WhatsApp hesabı uğurla cütləşdirildi və aktivləşdirildi.",
      session: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  const session = getSessionState();
  return NextResponse.json({
    success: true,
    connected: session.connected,
    session,
  });
}
