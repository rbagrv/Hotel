import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function sanitizePhone(raw) {
  if (!raw) return "";
  let cleaned = String(raw).replace(/[^\d]/g, "");
  // If starts with 0 (e.g. 0501234567 in Azerbaijan), convert to 994501234567
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "994" + cleaned.slice(1);
  }
  return cleaned;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { phone, message, templateData } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: "Telefon nömrəsi və mesaj mətni tələb olunur." },
        { status: 400 }
      );
    }

    const cleanNumber = sanitizePhone(phone);
    if (!cleanNumber || cleanNumber.length < 9) {
      return NextResponse.json(
        { success: false, error: "Düzgün telefon nömrəsi daxil edin (məs: +994501234567)." },
        { status: 400 }
      );
    }

    const microserviceUrl = body.url || body.microserviceUrl || process.env.WHATSAPP_MICROSERVICE_URL || "https://hotel-8wmp.onrender.com";
    let sentViaMicroservice = false;
    let microserviceError = null;

    // 1. Try sending via standalone WhatsApp Microservice
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const msRes = await fetch(`${microserviceUrl}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanNumber,
          message,
          templateData,
        }),
        signal: controller.signal,
      }).catch((e) => {
        microserviceError = e.message;
        return null;
      });

      clearTimeout(timeoutId);

      if (msRes && msRes.ok) {
        const msData = await msRes.json();
        return NextResponse.json({
          success: true,
          provider: "microservice",
          phone: cleanNumber,
          details: msData,
        });
      }
    } catch (e) {
      microserviceError = e.message;
    }

    // 2. Try sending via Meta Cloud API if configured
    const cloudToken = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (cloudToken && phoneId) {
      try {
        const metaRes = await fetch(
          `https://graph.facebook.com/v18.0/${phoneId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cloudToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: cleanNumber,
              type: "text",
              text: { body: message },
            }),
          }
        );

        const metaData = await metaRes.json();
        if (metaRes.ok) {
          return NextResponse.json({
            success: true,
            provider: "meta_cloud_api",
            phone: cleanNumber,
            details: metaData,
          });
        }
      } catch (cloudErr) {
        // Fall through to link generation
      }
    }

    // 3. Fallback: Generate wa.me universal direct link
    const waLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;

    return NextResponse.json({
      success: true,
      provider: "wa_direct_link",
      phone: cleanNumber,
      waLink,
      message: "Mikroservis oflayndır. Birbaşa WhatsApp linki təqdim edildi.",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
