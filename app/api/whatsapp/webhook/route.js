import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Webhook verification (for Meta WhatsApp Cloud API)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "hotel_pms_secret_token";

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification token mismatch" }, { status: 403 });
}

// Inbound messages & delivery receipts webhook
export async function POST(request) {
  try {
    const payload = await request.json();
    console.log("[WhatsApp Webhook] Inbound event:", JSON.stringify(payload).slice(0, 200));

    // Handle incoming messages (e.g. guest replies)
    return NextResponse.json({ success: true, received: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
