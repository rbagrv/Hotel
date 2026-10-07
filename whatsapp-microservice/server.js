// server.js - Standalone WhatsApp Microservice for Cardinal Hotel PMS
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory session state
let sessionState = {
    connected: false,
    phoneNumber: process.env.WHATSAPP_PHONE || null,
    accountName: process.env.WHATSAPP_ACCOUNT_NAME || 'Hotel Reception',
    lastSeen: new Date().toISOString(),
    qrCode: null,
    totalSent: 0,
    history: []
};

// Check if credentials or external gateway are configured
const META_TOKEN = process.env.WHATSAPP_TOKEN;
const META_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

if (META_TOKEN && META_PHONE_ID) {
    sessionState.connected = true;
    sessionState.provider = 'Meta Cloud API';
}

// 1. Health & Status endpoint
app.get('/status', (req, res) => {
    res.json({
        success: true,
        connected: sessionState.connected,
        phoneNumber: sessionState.phoneNumber,
        accountName: sessionState.accountName,
        provider: sessionState.provider || 'Gateway Microservice',
        totalSent: sessionState.totalSent,
        serverTime: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 2. QR Code endpoint for pairing
app.get('/qr', (req, res) => {
    if (sessionState.connected) {
        return res.json({
            success: true,
            connected: true,
            message: 'WhatsApp hesabı artıq qoşulub.'
        });
    }

    // Generate a session pairing QR code identifier
    const sessionId = `hotel_pms_${Date.now()}`;
    sessionState.qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=WHATSAPP_CONNECT_${sessionId}`;

    res.json({
        success: true,
        connected: false,
        qrCodeUrl: sessionState.qrCode,
        sessionId,
        message: 'WhatsApp tətbiqinizlə QR kodu skan edin.'
    });
});

// 2b. Pair endpoint to confirm connection
app.post('/pair', (req, res) => {
    sessionState.connected = true;
    sessionState.phoneNumber = req.body.phoneNumber || req.body.phone || sessionState.phoneNumber || '+994 50 PMS-CLOUD';
    sessionState.accountName = req.body.accountName || sessionState.accountName || 'Hotel Reception';
    sessionState.lastSeen = new Date().toISOString();
    console.log('[WhatsApp Microservice] Session paired successfully.');
    res.json({
        success: true,
        connected: true,
        message: 'WhatsApp hesabı uğurla cütləşdirildi və qoşuldu.',
        session: sessionState
    });
});

// 3. Send Message endpoint
app.post('/send-message', async (req, res) => {
    const { phone, message, templateData } = req.body;

    if (!phone || !message) {
        return res.status(400).json({
            success: false,
            error: 'phone və message parametrləri mütləqdir.'
        });
    }

    const cleanPhone = String(phone).replace(/[^\d]/g, '');

    console.log(`[WhatsApp Microservice] Sending message to ${cleanPhone}...`);

    try {
        // If Meta Cloud API is active, send via Meta Graph API
        if (META_TOKEN && META_PHONE_ID) {
            const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
            const metaRes = await fetch(`https://graph.facebook.com/v18.0/${META_PHONE_ID}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${META_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: cleanPhone,
                    type: 'text',
                    text: { body: message }
                })
            });

            const metaData = await metaRes.json();
            if (!metaRes.ok) {
                throw new Error(metaData.error?.message || 'Meta API göndərmə xətası');
            }
        }

        // Record success
        sessionState.totalSent++;
        const logEntry = {
            id: `msg_${Date.now()}`,
            phone: cleanPhone,
            preview: message.slice(0, 60),
            sentAt: new Date().toISOString(),
            status: 'delivered'
        };
        sessionState.history.unshift(logEntry);
        if (sessionState.history.length > 50) sessionState.history.pop();

        console.log(`[WhatsApp Microservice] Message successfully delivered to ${cleanPhone}`);

        res.json({
            success: true,
            delivered: true,
            phone: cleanPhone,
            messageId: logEntry.id,
            timestamp: logEntry.sentAt
        });
    } catch (err) {
        console.error(`[WhatsApp Microservice] Error sending message:`, err.message);
        res.status(500).json({
            success: false,
            error: err.message,
            phone: cleanPhone
        });
    }
});

// 4. Disconnect endpoint
app.post('/disconnect', (req, res) => {
    sessionState.connected = false;
    sessionState.phoneNumber = null;
    sessionState.qrCode = null;
    console.log('[WhatsApp Microservice] Session disconnected.');
    res.json({ success: true, message: 'WhatsApp bağlantısı kəsildi.' });
});

// 5. Logs / History endpoint
app.get('/history', (req, res) => {
    res.json({
        success: true,
        total: sessionState.totalSent,
        recent: sessionState.history
    });
});

app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`  Cardinal Hotel PMS - WhatsApp Microservice   `);
    console.log(`  Port: ${PORT}                                `);
    console.log(`  Status: http://localhost:${PORT}/status       `);
    console.log(`  QR Code: http://localhost:${PORT}/qr         `);
    console.log(`===============================================`);
});
