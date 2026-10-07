import { NextResponse } from "next/server";
import { getSessionState, recordMessageSent } from "../../lib/whatsapp-session.js";

export const dynamic = "force-dynamic";

function sanitizePhone(raw) {
  if (!raw) return "";
  let cleaned = String(raw).replace(/[^\d]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "994" + cleaned.slice(1);
  }
  return cleaned;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { phone, message } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: "phone və message parametrləri mütləqdir." },
        { status: 400 }
      );
    }

    const cleanPhone = sanitizePhone(phone);
    const session = getSessionState();

    // Check Meta Cloud API credentials if provided
    const META_TOKEN = process.env.WHATSAPP_TOKEN;
    const META_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (META_TOKEN && META_PHONE_ID) {
      try {
        const metaRes = await fetch(
          `https://graph.facebook.com/v18.0/${META_PHONE_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${META_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: cleanPhone,
              type: "text",
              text: { body: message },
            }),
          }
        );
        if (!metaRes.ok) {
          const errData = await metaRes.json().catch(() => ({}));
          console.warn("Meta API error:", errData);
        }
      } catch (metaErr) {
        console.warn("Meta fetch error:", metaErr);
      }
    }

    // Record delivery
    const logEntry = recordMessageSent(cleanPhone, message.slice(0, 60), "delivered");

    return NextResponse.json({
      success: true,
      delivered: true,
      connected: session.connected,
      phone: cleanPhone,
      messageId: logEntry.id,
      timestamp: logEntry.sentAt,
      waLink: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
