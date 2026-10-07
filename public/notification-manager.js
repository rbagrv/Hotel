// notification-manager.js
//
// Notification, Telegram, and sound handling
//

import RoomsComponent from './rooms-component.js'; // Import RoomsComponent

class NotificationManager {
    constructor() {
        this.notificationHistory = []; // Stores all notifications
        this.notificationIdCounter = 1; // Unique ID for each notification
        this.telegramBotToken = null;
        this.telegramChatId = null;
        this.isInitialized = false; // Flag to track if manager has been fully initialized
        
        // Audio properties
        this.audioContext = null;
        this.notificationSoundBuffer = null;
        this.htmlAudio = null;
        this.isMuted = localStorage.getItem('pms_sound_muted') === 'true';
        this.roomsComponent = new RoomsComponent(); // Initialize RoomsComponent instance here

        // Track the currently visible toast notification DOM element
        this.currentVisibleNotificationToast = null; 

        // Initial setup on construction.
        try {
            this.initAudio();
        } catch (e) {
            console.warn('NotificationManager: initAudio error suppressed:', e);
        }
        try {
            this.updateSoundToggleUI();
        } catch (e) {
            console.warn('NotificationManager: updateSoundToggleUI error suppressed:', e);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.updateSoundToggleUI();
            });
        }

        // Add a one-time listener for auth-success to complete the initialization.
        // This ensures the manager fully initializes with user/app data after login.
        if (!this._authSuccessListenerAdded) {
            window.addEventListener('auth-success', () => this.initializeAfterLogin(), { once: true });
            this._authSuccessListenerAdded = true;
        }

        this.maxTimeoutMillis = 5000; // 5 seconds API timeout

        console.log('NotificationManager constructor finished, waiting for full initialization.');
    }

    // This method is called once per `auth-success` event (due to {once:true} listener)
    // or manually if needed (but should use a guard to prevent re-running full setup).
    initializeAfterLogin() {
        if (this.isInitialized) {
            console.warn('NotificationManager already fully initialized. Skipping re-initialization after login.');
            return;
        }

        console.log('NotificationManager: Completing full initialization after login...');
        this.initTelegramBot(); // Get Telegram config after ENV is ready
        this.notificationSettings = window.app?.getSetting('telegramNotificationSettings') || {};
        this.isInitialized = true; // Mark as fully initialized
        console.log('NotificationManager: Full initialization completed.');
    }

    initAudio() {
        // Only initialize audio context once
        if (this.audioContext) return; 

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.audioContext = new AudioCtx();
                this.loadSound('/notification.mp3').then(buffer => {
                    this.notificationSoundBuffer = buffer;
                    console.log('Notification sound loaded successfully.');
                }).catch(e => {
                    console.warn("Failed to load notification sound via WebAudio API, falling back to HTMLAudioElement:", e);
                    // Fallback to HTMLAudioElement if WebAudio decode fails
                    this.htmlAudio = new Audio('/notification.mp3');
                    this.htmlAudio.load(); // Pre-load the audio
                    this.htmlAudio.addEventListener('error', (err) => {
                        console.error("HTMLAudioElement failed to load notification sound:", err);
                    });
                });
            } else {
                this.htmlAudio = new Audio('/notification.mp3');
                this.htmlAudio.load();
            }
        } catch(e) {
            console.warn("Web Audio API not directly accessible during initAudio, falling back:", e);
            try {
                this.htmlAudio = new Audio('/notification.mp3');
            } catch(_) {}
        }
        this.updateSoundToggleUI();
    }
    
    /**
     * Loads an audio file from a URL and decodes it into an AudioBuffer.
     * @param {string} url - The URL of the audio file.
     * @returns {Promise<AudioBuffer>} A promise that resolves with the decoded AudioBuffer.
     */
    async loadSound(url) {
        if (!this.audioContext) {
            throw new Error("AudioContext is not initialized.");
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Audio fetch failed: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        return await this.audioContext.decodeAudioData(arrayBuffer);
    }
    
    playSound(buffer) {
        if (!buffer && this.htmlAudio && !this.isMuted) {
            try { this.htmlAudio.currentTime = 0; this.htmlAudio.play(); } catch(_) {}
            return;
        }
        if (!buffer || this.isMuted || !this.audioContext || this.audioContext.state === 'suspended') {
            return;
        }
        // Resume context on user gesture if needed
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('pms_sound_muted', this.isMuted);
        this.updateSoundToggleUI();
        this.showNotification('info', `Bildiriş səsləri ${this.isMuted ? 'söndürüldü' : 'aktiv edildi'}.`);
    }

    updateSoundToggleUI() {
        try {
            const soundToggleBtn = document.getElementById('soundToggleBtn');
            if (!soundToggleBtn) return;

            // Handle Material Icons (Luxuria UI)
            const materialIcon = soundToggleBtn.querySelector('.material-icons-outlined, .material-icons');
            if (materialIcon) {
                materialIcon.textContent = this.isMuted ? 'volume_off' : 'volume_up';
                soundToggleBtn.title = this.isMuted ? 'Səsi aç' : 'Səsi bağla';
            }

            // Handle FontAwesome Icons
            const icon = soundToggleBtn.querySelector('i');
            if (icon) {
                if (this.isMuted) {
                    icon.classList.remove('fa-volume-up');
                    icon.classList.add('fa-volume-off');
                } else {
                    icon.classList.remove('fa-volume-off');
                    icon.classList.add('fa-volume-up');
                }
            }
        } catch (err) {
            console.warn('NotificationManager.updateSoundToggleUI error suppressed:', err);
        }
    }

    initTelegramBot() {
        // Telegram bot config should only be initialized once with ENV variables
        if (this.telegramBotToken) {
            console.warn('Telegram bot already initialized. Skipping initTelegramBot().');
            return;
        }

        // Initialize Telegram bot configuration from environment variables
        if (window.ENV) {
            this.telegramBotToken = window.ENV.TELEGRAM_BOT_TOKEN;
            this.telegramChatId = window.ENV.TELEGRAM_CHAT_ID;
        }
        // No hardcoded fallback. If window.ENV does not provide the tokens, Telegram features will be disabled.
        // Settings are now loaded from app.getSetting in initializeAfterLogin
    }

    /**
     * NEW: Private method to perform the API fetch with timeout and common error handling.
     * @param {string} endpoint - The Telegram method name (e.g., 'sendMessage', 'sendPhoto').
     * @param {object} payload - The JSON payload for the request.
     * @returns {Promise<object>} The JSON response body.
     */
    async _fetchTelegramApi(endpoint, payload) {
        if (!this.telegramBotToken) {
            throw new Error("Telegram Bot Token konfiqurasiya edilməyib.");
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.maxTimeoutMillis);
        const url = `https://api.telegram.org/bot${this.telegramBotToken}/${endpoint}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            // If HTTP error (e.g. 404, 500), read response body if possible to get Telegram description
            if (!response.ok) {
                let errorDetail = `HTTP Status ${response.status} ${response.statusText}`;
                try {
                     const errorJson = await response.json();
                     errorDetail = errorJson.description || errorDetail;
                } catch {} // Ignore parsing error if response isn't JSON

                if (errorDetail.toLowerCase().includes('chat not found')) {
                    errorDetail = 'Çat tapılmadı (Bad Request: chat not found). Telegram Bot yalnız botu başlatmış (/start etmiş) istifadəçilərə və rəqəmsal Chat ID (məsələn: 734378254) vasitəsilə mesaj göndərə bilər. Fərdi istifadəçi adları (@username) dəstəklənmir. Chat ID-nizi Telegram-da @userinfobot və ya @getmyid_bot vasitəsilə öyrənə bilərsiniz.';
                }

                throw new Error(`Telegram API xətası: ${errorDetail}`);
            }

            const result = await response.json();

            if (!result.ok) {
                // If API returned error structure (ok: false)
                let errorDetail = result.description || 'Bilinməyən Xəta';
                if (errorDetail.toLowerCase().includes('chat not found')) {
                    errorDetail = 'Çat tapılmadı (Bad Request: chat not found). Telegram Bot fərdi istifadəçi adlarına (@username) mesaj göndərə bilmir. Rəqəmsal Chat ID (məs: 734378254) istifadə edin və istifadəçinin bota /start yazdığından əmin olun.';
                }
                throw new Error(`Telegram API xətası: ${errorDetail}`);
            }

            return result;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Şəbəkə/API xətası: Qoşulma müddəti bitdi (${this.maxTimeoutMillis / 1000} saniyə).`);
            } else if (error.message.includes('Failed to fetch')) {
                // This is the error the user reported! Give a clear, direct message.
                throw new Error("Şəbəkə/API xətası: Telegram serverinə qoşulmaq mümkün olmadı (Failed to fetch). İnternet bağlantınızı yoxlayın.");
            }
            throw error; // Re-throw other errors
        }
    }
    
    /**
     * Escapes a value for safe embedding in an HTML parse_mode Telegram message.
     * User-generated content (names, descriptions, notes) may contain `&`, `<`, `>`,
     * which otherwise cause Telegram to reject the entire message ("can't parse entities").
     * @param {*} value
     * @returns {string}
     */
    _escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Normalizes a message before it is POSTed to Telegram: converts block-level HTML
     * leftovers to newlines and collapses excessive whitespace. Entities are NOT
     * un-escaped here because user content is already escaped via _escapeHtml().
     * @param {string} text
     * @returns {string}
     */
    _cleanupTelegramText(text) {
        return String(text)
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/&nbsp;/gi, ' ')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\n\n+/g, '\n\n')
            .trim();
    }

    /**
     * Resolves the unique set of Telegram chat IDs for a notification.
     * Share set of recipient logic between message and file sends.
     * Falls back to the general configured chat when the matrix matches nobody,
     * so a configured bot chat always receives the alert.
     * @param {string|null} specificStaffId
     * @param {string|null} type
     * @param {boolean} forceAll
     * @returns {string[]}
     */
    _resolveRecipients(specificStaffId = null, type = null, forceAll = false) {
        const allStaff = window.app?.data?.staff || [];
        const targetRecipientIds = new Set();

        if (specificStaffId) {
            const targetStaff = allStaff.find(s => s.id === specificStaffId || s.telegramId === specificStaffId);
            if (targetStaff?.telegramId) {
                targetRecipientIds.add(targetStaff.telegramId);
            } else if (/^\d+$/.test(specificStaffId) || specificStaffId.startsWith('@')) {
                targetRecipientIds.add(specificStaffId);
            }
        } else if (forceAll) {
            allStaff.forEach(s => {
                if (s.status === 'active' && s.telegramId && s.isSuperadmin) {
                    targetRecipientIds.add(s.telegramId);
                }
            });
        } else if (type && this.notificationSettings) {
            let settingKey;
            switch (type) {
                case 'reservations': settingKey = 'reservationNotifications'; break;
                case 'pos_sales': settingKey = 'posNotifications'; break;
                case 'maintenance': settingKey = 'maintenanceNotifications'; break;
                case 'inventory': settingKey = 'inventoryNotifications'; break;
                case 'cash_transactions': settingKey = 'cashNotifications'; break;
                case 'rooms': settingKey = 'roomNotifications'; break;
                default: settingKey = `${type}Notifications`;
            }
            (this.notificationSettings[settingKey] || []).forEach(staffId => {
                const staffMember = allStaff.find(s => s.id === staffId);
                if (staffMember?.telegramId) targetRecipientIds.add(staffMember.telegramId);
            });
            (this.notificationSettings[`${settingKey}_extra`] || []).forEach(id => {
                if (id) targetRecipientIds.add(id.trim());
            });
        }

        const recipientIds = Array.from(targetRecipientIds).filter(id => id);

        if (recipientIds.length === 0 && this.telegramChatId && /^\d+$/.test(this.telegramChatId)) {
            recipientIds.push(this.telegramChatId);
        }

        return recipientIds;
    }

    // NEW: Test Notification method
    async sendTelegramTestNotification() {
        if (!this.telegramBotToken) {
            this.showNotification('error', 'Test Uğursuz', 'Telegram Bot Token qeyd olunmayıb.', 5000);
            return;
        }

        const currentUser = window.app?.authManager?.getCurrentUser();
        const testMessage = `Test mesajı! Hazırkı vaxt: ${new Date().toLocaleString('az-AZ')}\nİstifadəçi: ${currentUser?.name || 'Anonim'}\nBot Token: ${this.telegramBotToken.substring(0, 10)}...`;

        let recipients = [];
        let successCount = 0;
        let failureDetails = []; // Store detailed failure messages

        try {
            // Create a temporary set of all recipients relevant to testing:
            const targetRecipientIds = new Set();
            
            // 1. Add general Telegram Chat ID (if it exists and is numeric)
            if (this.telegramChatId && /^\d+$/.test(this.telegramChatId)) {
                targetRecipientIds.add(this.telegramChatId);
            }

            // 2. Add current user ID (for confirmation)
            if (currentUser?.telegramId) {
                 targetRecipientIds.add(currentUser.telegramId);
            }
            
            // 3. Add all configured recipients across all setting categories
            if (this.notificationSettings) {
                // Get all keys ending with 'Notifications' (e.g., reservationNotifications)
                const settingKeys = Object.keys(this.notificationSettings).filter(key => key.endsWith('Notifications'));
                
                settingKeys.forEach(key => {
                    // Add staff IDs configured for notification
                    const staffIdsForType = this.notificationSettings[key] || [];
                    staffIdsForType.forEach(staffId => {
                         const staffMember = window.app.data.staff.find(s => s.id === staffId);
                         if (staffMember?.telegramId) {
                             targetRecipientIds.add(staffMember.telegramId);
                         }
                    });
                    
                    // Add extra IDs configured for notification
                    const extraKey = `${key}_extra`;
                    const extraIdsForType = this.notificationSettings[extraKey] || [];
                    extraIdsForType.forEach(id => {
                        if (id) targetRecipientIds.add(id.trim());
                    });
                });
            }

            const uniqueRecipients = Array.from(targetRecipientIds).filter(id => id);

            if (uniqueRecipients.length === 0) {
                this.showNotification('warning', 'Test Mesajı Göndərilmədi', 'Heç bir Telegram ID tapılmadı (nə chat, nə də istifadəçi). Tənzimləmələri yoxlayın.', 6000);
                return;
            }

            let sentCount = 0;
            // The message text uses HTML formatting implicitly via parse_mode: 'HTML' below.
            // FIX 1: Remove erroneous <br> tags. Use \n which Telegram supports in HTML mode.
            const rawTestMessage = `<b>Test Mesajı</b>\n${testMessage}`; 

            for (const chatId of uniqueRecipients) {
                 try {
                     if (String(chatId).trim().startsWith('@')) {
                         throw new Error(`Fərdi istifadəçi adı (${chatId}) qəbul edilmir. Telegram Bot yalnız rəqəmsal Chat ID (məsələn: 734378254) ilə mesaj göndərə bilər. İstifadəçi əvvəlcə botu açıb /start etməlidir. Chat ID-nizi öyrənmək üçün @userinfobot istifadə edin.`);
                     }
                     // Apply aggressive cleanup before sending
                     const telegramText = rawTestMessage
                        .replace(/<br\s*\/?>/gi, '\n') // Replace <br> tags (case insensitive)
                        .replace(/<p>/gi, '\n')        // Replace <p> tags
                        .replace(/<\/p>/gi, '\n')       // Replace </p> tags
                        .replace(/&nbsp;/gi, ' ')       // Replace &nbsp;
                        .replace(/&amp;/gi, '&')
                        .replace(/&gt;/gi, '>')
                        .replace(/&lt;/gi, '<')
                        .replace(/\s+/g, ' ')         // Collapse multiple spaces/newlines
                        .trim(); 

                    const result = await this._fetchTelegramApi('sendMessage', {
                        chat_id: chatId,
                        text: telegramText,
                        parse_mode: 'HTML' 
                    });
                    if (result.ok) {
                        successCount++;
                    } else {
                        // Should be caught by _fetchTelegramApi, but defensive check remains
                        const errorMsg = result.description || 'Naməlum Xəta';
                        failureDetails.push(`ID: ${chatId} (${errorMsg})`);
                        console.error(`Test failed for chat ID ${chatId}:`, result);
                    }
                 } catch (error) {
                    failureDetails.push(`ID: ${chatId} (${error.message.replace(/<br>/g, ' ')})`);
                    console.error(`Test failed for chat ID ${chatId}:`, error);
                 }
            }

            if (successCount > 0) {
                let failureMessage = '';
                if (failureDetails.length > 0) {
                    failureMessage = `<br>Xətalı üvanlar: ${failureDetails.length} (${failureDetails.slice(0, 3).join(', ')}${failureDetails.length > 3 ? '...' : ''})`;
                    this.showNotification('warning', 'Test Qismən Uğurlu', `Mesaj ${successCount} ünvana göndərildi.${failureMessage}`, 7000);
                } else {
                    this.showNotification('success', 'Test Uğurlu', `Mesaj ${successCount} ünvana uğurla göndərildi.`, 3000);
                }
            } else {
                let fullErrorMsg = 'Mesaj heç bir ünvana göndərilmədi.';
                let displayError = 'Telegram API xətası. Tokeni və ya Chat ID-ləri yoxlayın.';
                
                if (failureDetails.length > 0) {
                    const firstFailureDetail = failureDetails[0];
                    // Extract the error message from _fetchTelegramApi which is already formatted
                    const match = firstFailureDetail.match(/\(([^)]+)\)/);
                    const firstError = match ? match[1] : firstFailureDetail;
                    displayError = firstError;
                    fullErrorMsg += `<br>Xəta: ${failureDetails.join(', ')}`;
                }

                this.showNotification('error', 'Test Uğursuz', `${displayError}`, 7000);
            }
            
        } catch (error) {
            console.error("Critical test error:", error);
            // Catch errors from _fetchTelegramApi, which now includes "Şəbəkə/API xətası"
            const finalErrorMsg = error.message.includes('Telegram Bot Token konfiqurasiya edilməyib') ? error.message : error.message;
            this.showNotification('error', 'Kritik Test Xətası', finalErrorMsg, 7000);
        }
    }

    /**
     * Sends a WhatsApp notification to a guest or staff phone number via microservice or direct link.
     * @param {string} phone - Target phone number (e.g. +994501234567).
     * @param {string} message - Message body.
     * @returns {Promise<boolean>}
     */
    async sendWhatsAppNotification(phone, message) {
        if (!phone || !message) {
            this.showNotification('warning', 'WhatsApp Xətası', 'Telefon nömrəsi və ya mesaj mətni boşdur.');
            return false;
        }

        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, message })
            });

            const data = await res.json();
            if (data.success) {
                if (data.provider === 'wa_direct_link' && data.waLink) {
                    window.open(data.waLink, '_blank');
                    this.showNotification('info', 'WhatsApp Açıldı', 'Mesaj göndərmək üçün WhatsApp pəncərəsi açıldı.', 4000);
                } else {
                    this.showNotification('success', 'WhatsApp Göndərildi', `${phone} nömrəsinə bildiriş uğurla çatdırıldı.`, 4000);
                }
                return true;
            } else {
                throw new Error(data.error || 'WhatsApp xətası');
            }
        } catch (err) {
            console.warn('WhatsApp API sending error, falling back to direct link:', err.message);
            const clean = String(phone).replace(/[^\d]/g, '');
            const fallbackLink = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
            window.open(fallbackLink, '_blank');
            this.showNotification('info', 'WhatsApp Açıldı', 'Mesaj birbaşa WhatsApp linki ilə açıldı.', 4000);
            return true;
        }
    }

    /**
     * Formats and sends a WhatsApp reservation confirmation.
     */
    async sendWhatsAppReservationConfirmation(reservation, guest, room) {
        let hotelName = 'Hotel';
        try {
            const info = window.app?.getHotelInfo();
            if (info?.hotelName) hotelName = info.hotelName;
        } catch {}

        const guestName = guest?.name || guest?.fullName || 'Hörmətli qonaq';
        const phone = guest?.phone || reservation?.guestPhone || '';
        const roomNumber = room?.roomNumber || reservation?.roomNumber || 'Təyin edilməyib';
        const roomType = room?.type || reservation?.roomType || 'Standart';

        const message = 
`Hörmətli ${guestName},

🏨 *${hotelName}* otelində rezervasiyanız uğurla təsdiqləndi!

📌 *Rezervasiya ID:* #${reservation?.publicId || reservation?.id || ''}
🛏 *Otaq:* ${roomNumber} (${roomType})
📅 *Giriş tarixi:* ${reservation?.checkIn || ''} (14:00)
📅 *Çıxış tarixi:* ${reservation?.checkOut || ''} (12:00)
💰 *Ümumi məbləğ:* ${reservation?.totalPrice || 0} AZN

Sizi otelimizdə salamlamaqdan məmnun olarıq! Suallarınız olarsa bu nömrə ilə əlaqə saxlaya bilərsiniz.`;

        return await this.sendWhatsAppNotification(phone, message);
    }

    /**
     * REBUILT: Sends a Telegram message.
     * The logic for determining recipients is now more robust and centralized here.
     * @param {string} message - The HTML-formatted message to send.
     * @param {string|null} specificStaffId - If provided, sends only to this staff member's Telegram ID.
     * @param {string|null} type - The business module type (e.g., "reservations") to check notification settings against.
     * @param {boolean} forceAll - If true, sends to all active staff with a Telegram ID, ignoring settings.
     * @returns {Promise<boolean>} - True if the message was sent to at least one recipient.
     */
    async sendTelegramMessage(message, specificStaffId = null, type = null, forceAll = false) {
        if (!this.telegramBotToken) {
            console.log('Telegram not configured, skipping notification.');
            return false;
        }

        // 1. Resolve recipients via the shared logic (includes general chat fallback)
        const recipientIds = this._resolveRecipients(specificStaffId, type, forceAll);

        if (recipientIds.length === 0) {
            console.warn('Telegram notification not sent: No valid recipients found for:', { type, forceAll, specificStaffId });
            return false;
        }

        // 2. Prepend hotel name to the message (hotel name is user content -> escape it)
        let hotelName = "RB Hotel PMS";
        try {
            const info = window.app?.getHotelInfo();
            if (info?.hotelName) hotelName = info.hotelName;
        } catch {}
        const fullMessage = `🏨 <b>${this._escapeHtml(hotelName)}</b>\n${message}`;

        // 3. Send the message to all unique recipients
        console.log(`[Telegram] Sending message to recipients:`, recipientIds);
        let atLeastOneSent = false;
        let failureDetails = []; // Track failures for logging
        let lastTelegramText = ''; // Hoisted out of the loop so the failure handler can reference it

        for (const chatId of recipientIds) {
            try {
                lastTelegramText = this._cleanupTelegramText(fullMessage);

                const result = await this._fetchTelegramApi('sendMessage', {
                    chat_id: chatId,
                    text: lastTelegramText,
                    parse_mode: 'HTML'
                });
                
                if (result.ok) {
                    atLeastOneSent = true;
                } else {
                    // Should be caught by _fetchTelegramApi, but defensive check remains
                    console.error(`Telegram message failed for chat ID ${chatId}:`, result);
                }
            } catch (error) {
                // Catch network/API errors from _fetchTelegramApi
                failureDetails.push(`ID: ${chatId} (${error.message.replace(/<br>/g, ' ')})`);
                console.error(`Failed to send Telegram message to chat ID ${chatId}:`, error);
            }
        }
        
        // CRITICAL PATCH: If we tried to send but all failed, record a system error for Superadmin panel
        if (recipientIds.length > 0 && !atLeastOneSent) {
             const failureSummary = failureDetails.slice(0, 3).map(d => d.replace(/<br>/g, ' ')).join('; '); // Clean up for single line storage
             const errorSource = window.app.getModuleTitle(type) || 'Bilinmir';
             window.app?.recordSystemError?.('TelegramSendFail', `Telegram bildirişi çatmadı (Modul: ${errorSource}). Xəta: ${failureSummary}`, lastTelegramText, 'notification-manager.js', 'sendTelegramMessage');
             // Optionally, notify the user immediately about a critical failure (if they are still active and this isn't a background job)
             if (window.authManager?.isUserAuthenticated?.()) {
                 window.notificationManager?.showNotification('error', 'Telegram Xətası', `Bildiriş göndərilmədi: ${errorSource}. Xətalar Superadmin panelində qeyd olundu.`);
             }
        }

        return atLeastOneSent;
    }

    /**
     * REBUILT: Sends a document (e.g., PDF or PNG screenshot) via Telegram.
     * @param {string|Blob} fileUrlOrBlob - URL (PNG/JPG/PDF) or Blob object to upload.
     * @param {string} caption - Text caption for the document.
     * @param {string} type - Business module type (e.g., "reports", "invoices").
     * @param {boolean} forceAll - If true, sends to all active staff and superadmin for this type.
     * @param {"photo"|"document"} fileType - Prefer 'photo' to display as image in chat.
     * @returns {Promise<boolean>}
     */
    async sendTelegramFile(fileUrlOrBlob, caption = "", type = null, forceAll = false, fileType = "document") {
        if (!this.telegramBotToken || !fileUrlOrBlob) {
            console.warn('Telegram file send failed: missing token or file');
            return false;
        }

        let actualUrl = "";
        if (fileUrlOrBlob instanceof Blob) {
            const filename = `upload_${Date.now()}.${fileType === "photo" ? "png" : "pdf"}`;
            try {
                this.showNotification('info', 'Göndərilir...', 'Fayl bulud yaddaşına yüklənir...', 2000, false);
                actualUrl = await window.websim.upload(fileUrlOrBlob, filename);
            } catch(uploadError) {
                console.error("Failed to upload file to websim for Telegram:", uploadError);
                this.showNotification('error', 'Fayl Yüklənmədi', `Fayl Telegram-a göndərilmək üçün yüklənə bilmədi: ${uploadError.message}`);
                return false;
            }
        } else if (typeof fileUrlOrBlob === 'string') {
            actualUrl = fileUrlOrBlob;
        }

        if (!actualUrl) {
            this.showNotification('error', 'Sənəd göndərilmədi', 'Fayl bulud yaddaşına yüklənə bilmədi.');
            return false;
        }

        // --- Recipient logic is now identical to sendTelegramMessage (shared helper) ---
        const recipientIds = this._resolveRecipients(null, type, forceAll);
        if (recipientIds.length === 0) {
            console.warn('Telegram file not sent: No valid recipients found for:', { type, forceAll });
            return false;
        }
        
        // --- FIX: Prepend hotel name (escape it) and reuse the shared text cleaner ---
        let hotelName = "RB Hotel PMS";
        try {
            if (window.app && typeof window.app.getHotelInfo === "function") {
                const info = window.app.getHotelInfo();
                if (info && info.hotelName) hotelName = info.hotelName;
            }
        } catch {}

        const fullCaption = `🏨 <b>${this._escapeHtml(hotelName)}</b>\n${caption}`;
        const telegramCaption = this._cleanupTelegramText(fullCaption);

        let atLeastOneSent = false;
        for (const chatId of recipientIds) {
            try {
                const sendMethod = fileType === "photo" ? 'sendPhoto' : 'sendDocument';
                
                const payload = {
                    chat_id: chatId,
                    caption: telegramCaption,
                    parse_mode: 'HTML'
                };
                payload[fileType] = actualUrl;

                const result = await this._fetchTelegramApi(sendMethod, payload);
                
                if (result.ok) {
                    atLeastOneSent = true;
                } else {
                    // Should be caught by _fetchTelegramApi
                    console.error(`Telegram file send failed for chat ID ${chatId}:`, result);
                }
            } catch (error) {
                // Catch network/API errors from _fetchTelegramApi
                console.error(`Error sending Telegram document/photo to ${chatId}:`, error);
            }
        }

        return atLeastOneSent;
    }

    /**
     * Helper function to send documents via Telegram (for backward compatibility).
     * @param {string|Blob} fileUrlOrBlob 
     * @param {string} caption 
     * @param {string} type 
     * @param {boolean} forceAll 
     * @returns {Promise<boolean>}
     */
    async sendTelegramDocument(fileUrlOrBlob, caption = "", type = null, forceAll = false) {
        return this.sendTelegramFile(fileUrlOrBlob, caption, type, forceAll, 'document');
    }

    /**
     * Sends a screenshot of the cash transaction info as a Telegram image to admin.
     */
    async sendCashTransactionScreenshotToTelegram(transactionId) {
        try {
            // 1. Render the cash transaction modal as usual, but hidden or offscreen for capture.
            const transaction = window.app?.data?.cashTransactions.find(t => String(t.id) === String(transactionId));
            if (!transaction) {
                this.showNotification('error', 'Əməliyyat tapılmadı', 'Kassa əməliyyatı tapılmadı.');
                return;
            }
            const staff = window.app?.data?.staff?.find(s => s.id === transaction.staffId);
            let accountName = "Əsas hesab", accountType = "Nağd";
            switch (transaction.accountId) {
                case "bank": accountName = "Bank hesabı"; accountType = "Bank"; break;
                case "pos": accountName = "POS terminal"; accountType = "Terminal"; break;
                case "paypal": accountName = "PayPal hesabı"; accountType = "Online"; break;
            }
            let amountStr = `${transaction.type === 'income' ? '+' : '-'}₼${(transaction.amount || 0).toFixed(2)}`;
            let date = transaction.date || ""; let time = transaction.time || "";
            let staffName = staff?.name || 'N/A';

            // Create a hidden div with info (will be screenshotted)
            let div = document.createElement('div');
            div.style.position = 'fixed';
            div.style.left = '-9999px';
            div.style.top = '0';
            div.style.width = '375px';
            div.style.background = 'white';
            div.style.fontFamily = 'Inter, Arial, sans-serif';
            div.style.borderRadius = '22px';
            div.style.boxShadow = '0 4px 20px 0 #6366f122';
            div.style.padding = '1.5rem 1.6rem 1.2rem 1.6rem';
            div.innerHTML = `
                <div style="color:#3b82f6;margin-bottom:1.2rem;text-align:center;font-size:1.25em;font-weight:800;">Kassa Əməliyyatı Məlumatları</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 0.7rem;font-size:1em;">
                    <div style="color:#64748b;">ID:</div><div style="font-size:1em;line-height:1.2;word-break:break-word;"><strong>${transaction.publicId || transaction.id.includes('-') ? transaction.id : `KS-${String(transaction.id).padStart(5, '0')}`}</strong></div>
                    <div style="color:#64748b;">Tarix:</div><div style="font-size:1em;line-height:1.2;">${window.app?.formatDate?.(date)} ${time}</div>
                    <div style="color:#64748b;">Növ:</div><div style="font-size:1em;line-height:1.2;color:${transaction.type === 'income' ? '#10b981' : '#ef4444'};">${transaction.type === 'income' ? 'Gəlir' : 'Xərc'}</div>
                    <div style="color:#64748b;">Hesab:</div><div style="font-size:1em;line-height:1.2;">${accountName} (${accountType})</div>
                    <div style="color:#64748b;">Kateqoriya:</div><div style="font-size:1em;line-height:1.2;">${transaction.category}</div>
                    <div style="color:#64748b;">Məbləğ:</div><div style="font-size:1em;line-height:1.2;font-weight:700;color:${transaction.type === 'income' ? '#10b981' : '#ef4444'};">${amountStr}</div>
                    <div style="color:#64748b;">Təsvir:</div><div style="font-size:1em;line-height:1.2;word-break:break-word;overflow-wrap:break-word;">${transaction.description}</div>
                    <div style="color:#64748b;">İcraçı:</div><div style="font-size:1em;line-height:1.2;">${staffName}</div>
                </div>
            `;

            document.body.appendChild(div);

            // Wait for fonts to load
            await document.fonts.ready;

            // 2. Use html2canvas to screenshot the div
            let canvas;
            try {
                canvas = await window.html2canvas(div, { backgroundColor: "#fff", scale: 2 });
            } catch (e) {
                this.showNotification('error', 'Şəkil alınmadı', 'Şəkil screenshot zamanı xəta baş verdi.');
                document.body.removeChild(div); return;
            }

            // 3. Convert to Blob
            const blob = await new Promise(res => canvas.toBlob(res, "image/png"));

            // 4. Remove the dummy div
            document.body.removeChild(div);

            // 5. Send file (for cash, always to superadmin)
            const caption = `<b>Kassa Əməliyyatı</b>\nID: ${transaction.publicId || transaction.id}\nMəbləğ: ${amountStr}\nKassa əməliyyatı screenshot-u`;

            const ok = await this.sendTelegramFile(blob, caption, 'cash', true, 'photo');
            if (ok) {
                this.showNotification('success', 'Göndərildi', 'Kassa əməliyyatı şəkil olaraq adminə göndərildi.', 2000);
            } else {
                this.showNotification('error', 'Göndərilmədi', 'Kassa əməliyyatı şəkil olaraq göndərilə bilmədi.');
            }
        } catch (err) {
            this.showNotification('error', 'Screenshot xətası', err.message || 'Screenshot göndərilmədi.');
        }
    }

    // Helper for screenshot & Telegram sending (async, can be called after html2canvas loads)
    async _sendCashTransactionScreenshot(transaction) {
        try {
            // Repeat main property retrieval (defensive, in case data changed)
            const staff = window.app.data.staff.find(s => s.id === transaction.staffId);
            let accountName = "Əsas hesab", accountType = "Nağd";
            switch (transaction.accountId) {
                case "bank": accountName = "Bank hesabı"; accountType = "Bank"; break;
                case "pos": accountName = "POS terminal"; accountType = "Terminal"; break;
                case "paypal": accountName = "PayPal hesabı"; accountType = "Online"; break;
            }
            let amountStr = `${transaction.type === 'income' ? '+' : '-'}₼${(transaction.amount || 0).toFixed(2)}`;
            let date = transaction.date || ""; let time = transaction.time || "";
            let staffName = staff?.name || 'N/A';
            let reservationInfo = "";
            if (transaction.reservationId && window.app.data.reservations) {
                const reservation = window.app.data.reservations.find(r => r.id === transaction.reservationId);
                if (reservation) {
                    const guest = window.app.data.guests.find(g => g.id === reservation.guestId);
                    reservationInfo = `Rezervasiya: #${reservation.publicId || reservation.id} (${guest?.name || 'N/A'} | ${window.app.formatDate(reservation.checkIn)} → ${window.app.formatDate(reservation.checkOut)})`;
                }
            }
            let salaryInfo = "";
            if (transaction.category === "Maaş ödənişi" && transaction.salaryRecipientId && window.app.data.staff) {
                const receiver = window.app.data.staff.find(s => s.id === transaction.salaryRecipientId);
                if (receiver) {
                    salaryInfo = `Maaş alan: ${receiver.name} (${receiver.position || ''})`;
                }
            }
            // Screenshot div
            let div = document.createElement('div');
            div.style.position = 'fixed';
            div.style.left = '-9999px';
            div.style.top = '0';
            div.style.width = '375px';
            div.style.background = 'white';
            div.style.fontFamily = 'Inter, Arial, sans-serif';
            div.style.borderRadius = '22px';
            div.style.boxShadow = '0 4px 20px 0 #6366f122';
            div.style.padding = '1.5rem 1.6rem 1.2rem 1.6rem';
            div.innerHTML = `
                <div style="color:#3b82f6;margin-bottom:1.2rem;text-align:center;font-size:1.25em;font-weight:800;">Kassa Əməliyyatı Məlumatları</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 0.7rem;font-size:1em;">
                    <div style="color:#64748b;">ID:</div><div style="font-size:1em;line-height:1.2;word-break:break-word;"><strong>${transaction.id.includes('-') ? transaction.id : `KS-${String(transaction.id).padStart(5, '0')}`}</strong></div>
                    <div style="color:#64748b;">Tarix:</div><div style="font-size:1em;line-height:1.2;">${window.app?.formatDate?.(date)} ${time}</div>
                    <div style="color:#64748b;">Növ:</div><div style="font-size:1em;line-height:1.2;color:${transaction.type === 'income' ? '#10b981' : '#ef4444'};">${transaction.type === 'income' ? 'Gəlir' : 'Xərc'}</div>
                    <div style="color:#64748b;">Hesab:</div><div style="font-size:1em;line-height:1.2;">${accountName} (${accountType})</div>
                    <div style="color:#64748b;">Kateqoriya:</div><div style="font-size:1em;line-height:1.2;">${transaction.category}</div>
                    <div style="color:#64748b;">Məbləğ:</div><div style="font-size:1em;line-height:1.2;font-weight:700;color:${transaction.type === 'income' ? '#10b981' : '#ef4444'};">${amountStr}</div>
                    <div style="color:#64748b;">Təsvir:</div><div style="font-size:1em;line-height:1.2;word-break:break-word;overflow-wrap:break-word;">${transaction.description}</div>
                    <div style="color:#64748b;">İcraçı:</div><div style="font-size:1em;line-height:1.2;">${staffName}</div>
                </div>
                ${reservationInfo ? `<div style="margin-top:0.8em;color:#1e293b;font-size:1em;line-height:1.2;"><strong>${reservationInfo}</strong></div>` : ''}
                ${salaryInfo ? `<div style="margin-top:0.8em;color:#1e293b;font-size:1em;line-height:1.2;"><strong>${salaryInfo}</strong></div>` : ''}
            `;

            document.body.appendChild(div);

            // Add a small delay to allow browser to render content before screenshotting
            await new Promise(resolve => setTimeout(resolve, 50)); 
            
            await document.fonts.ready;
            const canvas = await window.html2canvas(div, { backgroundColor: "#fff", scale: 2 });
            const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
            document.body.removeChild(div);

            const caption = `<b>Kassa Əməliyyatı</b>\nID: ${transaction.id}\nMəbləğ: ${amountStr}\nKassa əməliyyatı screenshot-u`;
            await this.sendTelegramFile(blob, caption, 'cash', true, 'photo');
        } catch (err) {
            // Fail silently, or log if useful
            if (typeof console !== "undefined") console.warn("Kassa əməliyyatı screenshot göndərmə xətası:", err);
            // If the temporary div was added but not removed, try to clean it up
            const tempDiv = document.querySelector('div[style*="-9999px"]');
            if (tempDiv && tempDiv.parentElement) {
                tempDiv.remove();
            }
        }
    }

    // Maintenance notification (maintenance)
    async notifyMaintenanceCreated(task, room, staff, performingStaffName) {
        const roomText = room ? `Otaq ${room.number}` : 'Ümumi';
        const priorityText = task.priority === 'high' ? 'Yüksək' : (task.priority === 'medium' ? 'Orta' : 'Aşağı');
        const assignedStaffName = staff?.name || 'Təyin edilməyib';

        this.notifyAction({
            title: 'Yeni Təmir Tapşırığı',
            type: 'warning',
            sendToTelegramModule: "maintenance",
            performingStaffName: performingStaffName,
            details: {
                'ID': `#${task.publicId || task.id}`,
                'Növ': task.type,
                'Otaq': roomText,
                'Təsvir': task.description,
                'Prioritet': priorityText,
                'Məsul': assignedStaffName,
                'Son Tarix': window.app.formatDate(task.dueDate)
            }
        });
    }
    
    // NEW: Notify on Maintenance Update
    async notifyMaintenanceUpdated(task, room, staff, performingStaffName) {
        const roomText = room ? `Otaq ${room.number}` : 'Ümumi';
        const priorityText = task.priority === 'high' ? 'Yüksək' : (task.priority === 'medium' ? 'Orta' : 'Aşağı');
        const assignedStaffName = staff?.name || 'Təyin edilməyib';
        
        this.notifyAction({
            title: 'Təmir Tapşırığı Yeniləndiə',
            type: 'info',
            sendToTelegramModule: "maintenance",
            performingStaffName: performingStaffName,
            details: {
                'ID': `#${task.publicId || task.id}`,
                'Növ': task.type,
                'Otaq': roomText,
                'Təsvir': task.description,
                'Prioritet': priorityText,
                'Məsul': assignedStaffName,
                'Son Tarix': window.app.formatDate(task.dueDate),
                'Status': window.statusHelper.getMaintenanceStatus(task.status)
            }
        });
    }

    // NEW: Notify on Maintenance Delete
    async notifyMaintenanceDeleted(task, performingStaffName) {
        this.notifyAction({
            title: 'Təmir Tapşırığı Silindi',
            type: 'warning',
            sendToTelegramModule: "maintenance",
            performingStaffName: performingStaffName,
            details: {
                'ID': `#${task.publicId || task.id}`,
                'Növ': task.type,
                'Təsvir': task.description
            }
        });
    }

    // Room status change (room)
    notifyRoomStatusChanged(room, oldStatus, newStatus, performingStaffName) {
        const statusText = {
            'available': 'Boş',
            'occupied': 'Dolu',
            'maintenance': 'Təmir'
        };

        this.notifyAction({
            title: 'Otaq Statusu Dəyişdirildi',
            type: 'info',
            sendToTelegramModule: "room",
            performingStaffName: performingStaffName,
            details: {
                'Otaq': room.number,
                'Əvvəlki Status': statusText[oldStatus],
                'Yeni Status': statusText[newStatus]
            }
        });
    }

    // NEW: Notify on Room Created
    async notifyRoomCreated(room, performingStaffName) {
        const message =
            `Otaq nömrəsi: ${room.number}\n` +
            `Tip: ${room.type}\n` +
            `Kateqoriya: ${room.category}\n` +
            `Qiymət: ₼${room.price.toFixed(2)}`;
        this.notifyAction({
            title: 'Yeni Otaq Yaradıldı',
            message: message,
            type: 'success',
            sendToTelegramModule: "rooms",
            performingStaffName: performingStaffName
        });
    }

    // NEW: Notify on Room Updated
    async notifyRoomUpdated(room, performingStaffName) {
        const message =
            `Otaq nömrəsi: ${room.number} (#${room.id})\n` +
            `Tip: ${room.type}\n` +
            `Status: ${window.statusHelper.getRoomStatus(room.status)}`;
        this.notifyAction({
            title: 'Otaq Məlumatları Yeniləndi',
            message: message,
            type: 'info',
            sendToTelegramModule: "rooms",
            performingStaffName: performingStaffName
        });
    }

    // NEW: Notify on Room Deleted
    async notifyRoomDeleted(room, performingStaffName) {
        const message =
            `Otaq nömrəsi: ${room.number} (#${room.id})\n` +
            `Tip: ${room.type}`;
        this.notifyAction({
            title: 'Otaq Silindi',
            message: message,
            type: 'warning',
            sendToTelegramModule: "rooms",
            performingStaffName: performingStaffName
        });
    }

    // NEW: Notify on Service Created
    async notifyServiceCreated(service, performingStaffName) {
        const message =
            `Ad: ${service.name}\n` +
            `Kateqoriya: ${service.category}\n` +
            `Qiymət: ₼${service.price.toFixed(2)}`;
        this.notifyAction({
            title: 'Yeni Xidmət Yaradıldı',
            message: message,
            type: 'success',
            sendToTelegramModule: "services",
            performingStaffName: performingStaffName
        });
    }

    // NEW: Notify on Service Updated
    async notifyServiceUpdated(service, performingStaffName) {
        const message =
            `Ad: ${service.name} (#${service.id})\n` +
            `Kateqoriya: ${service.category}\n` +
            `Qiymət: ₼${service.price.toFixed(2)}\n` +
            `Status: ${service.status === 'active' ? 'Aktiv' : 'Deaktiv'}`;
        this.notifyAction({
            title: 'Xidmət Məlumatları Yeniləndi',
            message: message,
            type: 'info',
            sendToTelegramModule: "services",
            performingStaffName: performingStaffName
        });
    }

    // NEW: Notify on Service Deleted
    async notifyServiceDeleted(service, performingStaffName) {
        const message =
            `Ad: ${service.name} (#${service.id})\n` +
            `Kateqoriya: ${service.category}`;
        this.notifyAction({
            title: 'Xidmət Silindi',
            message: message,
            type: 'warning',
            sendToTelegramModule: "services",
            performingStaffName: performingStaffName
        });
    }

    // Inventory notification 
    notifyInventoryLow(item) {
        this.notifyAction({
            title: 'Anbar Xəbərdarlığı: Az Qalıq',
            type: 'warning',
            sendToTelegramModule: "inventory",
            details: {
                'Məhsul': item.name,
                'Qalıq': `${item.quantity} ${item.unit}`,
                'Minimum': `${item.minQuantity} ${item.unit}`
            }
        });
    }

    // NEW: Notify on Inventory Created
    async notifyInventoryCreated(item, performingStaffName) {
        const message =
            `Ad: ${item.name}\n` +
            `Kateqoriya: ${item.category}\n` +
            `Miqdar: ${item.quantity} ${item.unit}\n` +
            `Alış Qiyməti: ₼${item.purchasePrice.toFixed(2)}`;
        this.notifyAction({
            title: 'Yeni Anbar Məhsulu Yaradıldı',
            message: message,
            type: 'success',
            sendToTelegramModule: "inventory",
            performingStaffName: performingStaffName
        });
    }

    // NEW: Notify on Inventory Updated
    async notifyInventoryUpdated(item, performingStaffName) {
        const message =
            `Ad: ${item.name} (#${item.publicId || item.id})\n` + // Use publicId for consistency
            `Kateqoriya: ${item.category}\n` +
            `Miqdar: ${item.quantity} ${item.unit}\n` +
            `Status: ${item.quantity <= item.minQuantity ? 'Az qalıb' : 'Normal'}`;
        this.notifyAction({
            title: 'Anbar Məlumatları Yeniləndi',
            message: message,
            type: 'info',
            sendToTelegramModule: "inventory",
            performingStaffName: performingStaffName
        });
    }

    // NEW: Notify on Inventory Deleted
    async notifyInventoryDeleted(item, performingStaffName) {
        const message =
            `Ad: ${item.name} (#${item.publicId || item.id})\n` + // Use publicId
            `Kateqoriya: ${item.category}`;
        this.notifyAction({
            title: 'Anbar Məhsulu Silindi',
            message: message,
            type: 'warning',
            sendToTelegramModule: "inventory",
            performingStaffName: performingStaffName
        });
    }

    // NEW: Notify on Purchase Document Action (Create/Update/Delete)
    async notifyPurchaseDocumentAction(doc, actionType, performingStaffName) {
        let title = '';
        let message = '';
        let type = 'info';

        switch(actionType) {
            case 'created':
                title = 'Yeni Alış Sənədi Yaradıldı';
                message =
                    `Sənəd №: ${doc.documentNumber}\n` +
                    `Təchizatçı: ${doc.supplierName}\n` +
                    `Məbləğ: ₼${(doc.totalAmount || 0).toFixed(2)}`;
                type = 'success';
                break;
            case 'updated':
                title = 'Alış Sənədi Yeniləndi';
                message =
                    `Sənəd №: ${doc.documentNumber} (#${doc.publicId || doc.id})\n` + // Use publicId
                    `Təchizatçı: ${doc.supplierName}\n` +
                    `Məbləğ: ₼${(doc.totalAmount || 0).toFixed(2)}`;
                type = 'info';
                break;
            case 'deleted':
                title = 'Alış Sənədi Silindi';
                message =
                    `Sənəd №: ${doc.documentNumber} (#${doc.publicId || doc.id})\n` + // Use publicId
                    `Təchizatçı: ${doc.supplierName}`;
                type = 'warning';
                break;
        }

        // The details object is now automatically generated in app.js/_notifyEntityChange, 
        // so we don't need to manually create the details object here if we rely on the main flow.
        // However, for immediate in-place notification where we only have the object, we rely on the message.

        this.notifyAction({
            title: title,
            message: message,
            type: type,
            sendToTelegramModule: "purchase_documents",
            performingStaffName: performingStaffName,
            // Keep details minimal if we don't want to rely on message parsing in notifyAction (which is now robust)
            // But we pass the core data for the underlying _notifyEntityChange call
            details: {
                'Sənəd ID': `#${doc.publicId || doc.id}`,
                'Sənəd №': doc.documentNumber,
                'Təchizatçı': doc.supplierName,
                'Məbləğ': `₼${(doc.totalAmount || 0).toFixed(2)}`
            }
        });
    }

    // NEW: Notify on Invoice Action (Create/Delete)
    async notifyInvoiceAction(invoice, actionType, performingStaffName) {
        let title = '';
        let message = '';
        let type = 'info';

        switch(actionType) {
            case 'created':
                title = 'Yeni Faktura Yaradıldı';
                message =
                    `Faktura №: ${invoice.publicId || invoice.id}\n` +
                    `Rezervasiya ID: ${invoice.reservationId}\n` +
                    `Qonaq: ${invoice.guestName}\n` +
                    `Ümumi Məbləğ: ₼${(invoice.totalAmount || 0).toFixed(2)}`;
                type = 'success';
                break;
            case 'deleted':
                title = 'Faktura Silindi';
                message =
                    `Faktura №: ${invoice.publicId || invoice.id}\n` +
                    `Rezervasiya ID: ${invoice.reservationId}\n` +
                    `Qonaq: ${invoice.guestName}`;
                type = 'warning';
                break;
        }

        this.notifyAction({
            title: title,
            message: message,
            type: type,
            sendToTelegramModule: "invoices",
            performingStaffName: performingStaffName,
            details: {
                'Faktura ID': `#${invoice.publicId || invoice.id}`,
                'Rezervasiya ID': `${invoice.reservationId}`,
                'Qonaq': invoice.guestName,
                'Ümumi Məbləğ': `₼${(invoice.totalAmount || 0).toFixed(2)}`
            }
        });
    }

    // NEW: Guest Action Notification (Create/Update/Delete)
    async notifyGuestAction(guest, actionType, performingStaffName) {
        let title = '';
        let message = '';
        let type = 'info';

        switch(actionType) {
            case 'created':
                title = 'Yeni Qonaq Əlavə Edildi';
                message =
                    `Ad: ${guest.name}\n` +
                    `Telefon: ${guest.phone}\n` +
                    `Pasport: ${guest.passportNo || 'Yoxdur'}`;
                type = 'success';
                break;
            case 'updated':
                title = 'Qonaq Məlumatları Yeniləndi';
                message =
                    `Ad: ${guest.name} (#${guest.publicId || guest.id})\n` +
                    `Email: ${guest.email || 'Yoxdur'}\n` +
                    `Telefon: ${guest.phone}`;
                type = 'info';
                break;
            case 'deleted':
                title = 'Qonaq Silindi';
                message =
                    `Ad: ${guest.name} (#${guest.publicId || guest.id})\n` +
                    `Pasport: ${guest.passportNo || 'Yoxdur'}`;
                type = 'warning';
                break;
        }

        this.notifyAction({
            title: title,
            message: message,
            type: type,
            sendToTelegramModule: "guests",
            performingStaffName: performingStaffName,
            details: {
                'Qonaq ID': `#${guest.publicId || guest.id}`,
                'Ad': guest.name,
                'Telefon': guest.phone,
                'Pasport': guest.passportNo || 'Yoxdur'
            }
        });
    }

    // NEW: Staff Action Notification (Create/Update/Delete)
    async notifyStaffAction(staff, actionType, performingStaffName) {
        let title = '';
        let message = '';
        let type = 'info';

        switch(actionType) {
            case 'created':
                title = 'Yeni İşçi Əlavə Edildi';
                message =
                    `Ad: ${staff.name}\n` +
                    `Vəzifə: ${staff.position}\n` +
                    `Rol: ${staff.role}`;
                type = 'success';
                break;
            case 'updated':
                title = 'İşçi Məlumatları Yeniləndi';
                message =
                    `Ad: ${staff.name} (#${staff.publicId || staff.id})\n` +
                    `Vəzifə: ${staff.position}\n` +
                    `Rol: ${staff.role}\n` +
                    `Status: ${staff.status === 'active' ? 'Aktiv' : 'Deaktiv'}`;
                type = 'info';
                break;
            case 'deleted':
                title = 'İşçi Silindi';
                message =
                    `Ad: ${staff.name} (#${staff.publicId || staff.id})\n` +
                    `Vəzifə: ${staff.position}`;
                type = 'warning';
                break;
        }

        this.notifyAction({
            title: title,
            message: message,
            type: type,
            sendToTelegramModule: "staff",
            performingStaffName: performingStaffName,
            details: {
                'İşçi ID': `#${staff.publicId || staff.id}`,
                'Ad': staff.name,
                'Vəzifə': staff.position,
                'Rol': staff.role,
                'Status': staff.status === 'active' ? 'Aktiv' : 'Deaktiv'
            }
        });
    }

    // System integration notification (general info)
    async notifySystemIntegration(action, details) {
        this.notifyAction({
            title: "Sistem inteqrasiyası",
            message: `${action} - ${details}`,
            type: 'info',
            sendToTelegramModule: "dashboard",
            forceAll: true 
        });
    }

    // ==== STANDARD NOTIFICATIONS (UNCHANGED, but now use notifyAction in main app for all actions) =====

    initNotificationSystem() {
        if (!window.authManager || !window.authManager.isUserAuthenticated()) {
            return;
        }

        setTimeout(() => {
            // Initial system ready notification should now be handled by app.js during initialize()
        }, 1000);

        setInterval(() => {
            try {
                this.sendAllDataNotification();
            } catch (error) {
                console.error('Error in system status notification:', error);
            }
        }, 60 * 60 * 1000); // 1 hour

        setInterval(() => {
            try {
                this.checkUpcomingEvents();
            } catch (error) {
                console.error('Error in checkUpcomingEvents:', error);
            }
        }, 30000);
    }

    /**
     * Sends a comprehensive overview of the hotel's current status and key metrics to Telegram.
     * This is intended for periodic updates.
     */
    async sendAllDataNotification() {
        if (!window.app || !window.app.data) return;
        const data = window.app.data;
        const now = new Date();
        const today = window.app.getTodayDateString();
        const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const formatNumber = (num) => new Intl.NumberFormat('az-AZ').format(num);

        // --- Core Counts ---
        const roomsCount = (data.rooms ?? []).length;
        const guestsCount = (data.guests ?? []).length;
        const reservationsCount = (data.reservations ?? []).length;
        const staffCount = (data.staff ?? []).length;

        // --- Room Status (Dynamic Calculation) ---
        // Use RoomsComponent's parsing logic for consistency
        const todayDateObj = this.roomsComponent.parseDateAsUTC(today); 

        const roomsStatusCounts = {
            occupied: 0,
            available: 0,
            maintenance: 0, 
            dirty: 0,
            pending_reservation: 0 
        };

        (data.rooms || []).forEach(room => {
            const statusInfo = this.roomsComponent.getRoomStatusForDay(room, todayDateObj, data);
            if (roomsStatusCounts[statusInfo.status] !== undefined) {
                roomsStatusCounts[statusInfo.status]++;
            }
        });

        const totalRooms = (data.rooms || []).length;
        // Occupied: Only confirmed/checked-in status (which blocks room access)
        const confirmedOccupiedOnly = roomsStatusCounts.occupied; 
        const availableRooms = roomsStatusCounts.available; 
        // Unavailable (Maintenance/Dirty)
        const unavailableRooms = roomsStatusCounts.maintenance + roomsStatusCounts.dirty;
        
        // Occupancy Rate: (Confirmed occupied / Total rooms) * 100
        const availableInventoryForSale = totalRooms > 0 ? totalRooms - unavailableRooms : 0;
        const occupancyRate = availableInventoryForSale > 0 ? ((confirmedOccupiedOnly / availableInventoryForSale) * 100).toFixed(1) : 0;
        
        // --- Today's Arrivals & Departures (FILTERED TO TODAY) ---
        // Arrivals are guests checking in today (confirmed/pending)
        const todayArrivalsCount = data.reservations.filter(res => 
            res.checkIn === today && (res.status === 'confirmed' || res.status === 'pending')
        ).length;
        // Departures are guests whose checkOut is TODAY (confirmed/occupied/pending)
        const todayDeparturesCount = data.reservations.filter(res => 
            res.checkOut === today && (res.status === 'confirmed' || res.status === 'occupied' || res.status === 'pending')
        ).length;
        
        // --- Upcoming Guests (next 7 days) ---
        const upcomingArrivalsDetails = data.reservations.filter(res => 
            res.checkIn > today && res.checkIn <= next7Days && res.status === 'confirmed'
        );
        let upcomingGuestsInfo = '';
        if (upcomingArrivalsDetails.length > 0) {
            upcomingGuestsInfo = `\n🗓️ <b>Gələcək Girişlər (7 Gün)</b>: ${upcomingArrivalsDetails.length} rezervasiya`;
            upcomingArrivalsDetails.slice(0, 2).forEach(res => { // Show details for up to 2 upcoming
                const guest = data.guests.find(g => g.id === res.guestId);
                const room = data.rooms.find(rm => rm.id === res.roomId);
                upcomingGuestsInfo += `\n  • ${guest?.name || 'N/A'} - Otaq ${room?.number || 'N/A'} (${window.app.formatDate(res.checkIn)})`;
            });
            if (upcomingArrivalsDetails.length > 2) {
                upcomingGuestsInfo += `\n  ...və daha ${upcomingArrivalsDetails.length - 2} giriş`;
            }
        } else {
            upcomingGuestsInfo += `\n🗓️ <b>Gələcək Girişlər (7 Gün)</b>: Yoxdur`;
        }

        // --- Financial Summary for Today ---
        const todayCashIncome = data.cashTransactions
            .filter(t => t.type === 'income' && t.date === today)
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        const todayCashExpense = data.cashTransactions
            .filter(t => t.type === 'expense' && t.date === today)
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        const todayNetCash = todayCashIncome - todayCashExpense;

        // --- Operational Status ---
        const pendingMaintenance = data.maintenance.filter(m => 
            m.status === 'pending' || m.status === 'in_progress'
        ).length;
        const lowInventoryItems = data.inventory.filter(item => 
            (item.quantity || 0) <= (item.minQuantity || 0)
        ).length;

        const message =
            `📊 <b>GÜNLÜK OTEL İCMALI</b>\n\n` +
            `📅 Tarix: ${now.toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' })}\n\n` +
            `🏨 <b>Otaqlar</b>:\n` +
            `  Cəmi: ${totalRooms}\n` +
            `  Dolu (Təsdiqlənmiş): ${confirmedOccupiedOnly}\n` + 
            `  Boş (Rezervasiyasız): ${availableRooms}\n` + 
            `  Təmirdə/Çirki: ${unavailableRooms}\n` + 
            `  Doluluq: ${occupancyRate}%\n\n` +
            `➡️ <b>Bugünki Əməliyyatlar</b>:\n` +
            `  Giriş: ${todayArrivalsCount} qonaq\n` +
            `  Çıxış: ${todayDeparturesCount} qonaq\n\n` +
            `💰 <b>Kassa (Bugün)</b>:\n` +
            `  Gəlir: ₼${todayCashIncome.toFixed(2)}\n` +
            `  Xərc: ₼${todayCashExpense.toFixed(2)}\n` +
            `  Xalis: ₼${todayNetCash.toFixed(2)}\n\n` +
            `⚠️ <b>Xəbərdarlıqlar</b>:\n` +
            `  Az qalıq (anbar): ${lowInventoryItems}\n` +
            `  Gözləyən təmir: ${pendingMaintenance}\n` +
            `${upcomingGuestsInfo}\n\n` +
            `Generated: ${now.toLocaleTimeString('az-AZ')} by PMS`;

        await this.sendTelegramMessage(message, null, "dashboard", false); // Send to 'dashboard' module recipients, do not force all
    }

    // --- ADDED: Notify on system boot/login ---
    notifySystemStarted(performingStaffName) {
        const now = new Date();
        const uiMessage = `Sistem açıldı. Xoş gəlmisiniz, ${performingStaffName || 'İstifadəçi'}!`;
        const telegramDetails = {
            'Daxil olan': performingStaffName || 'Sistem İstifadəçisi',
            'Tarix': now.toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            'Vaxt': now.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })
        };
        
        // Send UI notification (this will also trigger the sound if not muted)
        this.showNotification('success', 'Uğurlu Giriş', uiMessage, 2000, true);

        // Send Telegram message (using notifyAction)
        // Delay Telegram send slightly to ensure local UI is updated first
        setTimeout(() => {
            this.notifyAction({
                title: 'Sistemə Giriş',
                details: telegramDetails,
                type: 'info',
                sendToTelegramModule: "dashboard",
                performingStaffName: performingStaffName,
                duration: 0,
                skipUi: true // Skip showing the UI toast redundantly
            });
        }, 500); // Small delay before sending Telegram message
    }

    checkUpcomingEvents() {
        try {
            // MODIFY/FIX: Do not show repeated notification for today's check-outs more than once per day
            // Instead, show only ONCE per day, and only if there are checkouts
            // Store a flag in localStorage keyed to the date to rate-limit

            if (!window.app || !window.app.getTodayDateString) return; // Defensive check for window.app availability
            
            const today = window.app.getTodayDateString();
            const localKey = 'notif_daily_checkout_reminder_' + today;

            // If already notified today, do not send again
            if (localStorage.getItem(localKey) === '1') return;

            const data = window.app?.data; // Use window.app.data
            if (!data) return;

            const todayCheckOuts = data.reservations?.filter(res => res.checkOut === today && res.status === 'confirmed');
            if (todayCheckOuts && todayCheckOuts.length > 0) {
                // Build a more detailed, but concise notification message, list up to 3 guests.
                let msg = `${todayCheckOuts.length} qonaq bu gün çıxacaq.`;
                if (todayCheckOuts.length <= 3) {
                    const guestNames = todayCheckOuts.map(res => {
                        let guest = data.guests?.find(g=>g.id === res.guestId);
                        let room = data.rooms?.find(r=>r.id === res.roomId);
                        return `${guest ? guest.name : '-'} (${room ? room.number : '-'})`;
                    });
                    msg += " " + guestNames.join(', ');
                }
                // Else, no details, just summary.

                this.notifyAction({
                    title: 'Bu gün çıxacaq qonaqlar',
                    details: { // NEW: Use structured details
                        'Qonaq Sayı': `${todayCheckOuts.length}`,
                        'Qonaqlar': guestNames ? guestNames.join('<br>') : 'Siyahı gizlədildi' // Use <br> here for consistency
                    },
                    type: 'warning',
                    sendToTelegramModule: "reservations",
                    forceAll: false // Matrix logic as before
                });
                // Mark as notified today
                localStorage.setItem(localKey, '1');
            }
        } catch (error) {
            console.log('Error checking upcoming events:', error);
        }
    }

    // NEW: Unified notification AND Telegram notification for all business actions, also allows "forceAll" to send to ALL staff.
    async notifyAction({title, message, details = null, type = "info", sendToTelegramModule = null, duration = 2000, forceAll = false, performingStaffName = null, skipUi = false}) {
        const uiMessage = message || (details ? Object.entries(details).map(([key, value]) => `${key}: ${value}`).join('\n') : title);
        
        if (!skipUi) {
            this.showNotification(type, title, uiMessage, duration);
        }
        
        // --- NEW: Message Builder for Telegram ---
        const buildTelegramMessage = () => {
            let hotelName = "RB Hotel PMS";
            try {
                if (window.app && typeof window.app.getHotelInfo === "function") {
                    const info = window.app.getHotelInfo();
                    if (info && info.hotelName) hotelName = info.hotelName;
                }
            } catch {}

            const iconMap = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️',
            };

            // FIX 2: Use \n consistently for structural line breaks instead of <br>
            let chatMessage = `🏨 <b>${this._escapeHtml(hotelName)}</b>\n\n`;
            chatMessage += `${iconMap[type] || 'ℹ️'} <b>${this._escapeHtml(title)}</b>\n`;
            chatMessage += `------------------------------------\n`;

            if (details) {
                for (const [key, value] of Object.entries(details)) {
                    if (value) { // Don't show empty/null details
                        // FIX 2: Ensure line breaks in detail values are converted to \n,
                        // then escape user content for Telegram HTML mode
                        const safeValue = this._escapeHtml(String(value).replace(/<br>/g, '\n'));
                        chatMessage += `<b>${this._escapeHtml(key)}:</b> ${safeValue}\n`;
                    }
                }
            } else if (message) {
                // FIX 2: Ensure message value's line breaks are \n, then escape user content
                chatMessage += `${this._escapeHtml(String(message).replace(/<br>/g, '\n'))}\n`;
            }

            chatMessage += `------------------------------------\n`;
            if (performingStaffName) {
                chatMessage += `👤 <b>İcraçı:</b> ${this._escapeHtml(performingStaffName)}\n`;
            }
            chatMessage += `📅 <b>Tarix:</b> ${new Date().toLocaleString('az-AZ')}`;
            // Clean up redundant newlines, but the string is now safe.
            return chatMessage.replace(/\n\n+/g, '\n\n').trim();
        };
        // --- END: Message Builder ---

        const telegramMessage = buildTelegramMessage();
        // The sendTelegramMessage function now contains its own logic to determine recipients.
        // We pass the module type, and it will resolve who should get the notification.
        // Pass specificStaffId as null so it uses the matrix.
        if (sendToTelegramModule) {
            await this.sendTelegramMessage(telegramMessage, null, sendToTelegramModule, forceAll);
        }
    }

    // showNotification now only handles UI display
    showNotification(type = 'info', title = '', message = '', duration = 5000, playSound = true) {
        // Don't show notifications during login
        if (!window.authManager || !window.authManager.isUserAuthenticated()) {
            return;
        }

        const notificationId = this.notificationIdCounter++;
        const notificationData = {
            id: notificationId,
            type,
            title,
            message,
            timestamp: new Date(),
            read: false // NEW: Add read status
        };
        // Add to history and update badge
        this.notificationHistory.push(notificationData);
        this.updateNotificationBadge();

        if (playSound) {
            this.playSound(this.notificationSoundBuffer);
        }

        const container = document.getElementById('notificationContainer');
        if (!container) return;

        // Ensure the container has the 'below-header' class for consistent positioning
        if (!container.classList.contains('below-header')) {
            container.classList.add('below-header');
        }

        // --- Core change: replace previous notification ---
        if (this.currentVisibleNotificationToast && this.currentVisibleNotificationToast.parentElement === container) {
            // Start slide-out animation for the current visible notification
            this.currentVisibleNotificationToast.classList.add('slide-out');
            // Remove it after the animation, then display the new one
            setTimeout(() => {
                if (this.currentVisibleNotificationToast && this.currentVisibleNotificationToast.parentElement) {
                    this.currentVisibleNotificationToast.remove();
                }
                this.currentVisibleNotificationToast = null; // Clear old reference

                // Proceed to display the new notification
                this._displayNotificationElement(container, notificationData, duration);
            }, 300); // Match CSS slide-out transition duration
        } else {
            // No previous notification or it was already removed, display the new one directly
            this._displayNotificationElement(container, notificationData, duration);
        }
    }

    // Helper method to actually create and display the notification DOM element
    _displayNotificationElement(container, notificationData, duration) {
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification ${notificationData.type}`;
        notificationEl.dataset.id = notificationData.id;
        
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle',
            cash: 'fas fa-dollar-sign'
        };

        notificationEl.innerHTML = `
            <div class="notification-icon">
                <i class="${iconMap[notificationData.type] || 'fas fa-info-circle'}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notificationData.title}</div>
                <div class="notification-message">${notificationData.message}</div>
            </div>
            <button class="notification-close" onclick="window.notificationManager.closeNotification(${notificationData.id})">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notificationEl);
        this.currentVisibleNotificationToast = notificationEl; // Store reference to the newly displayed one

        if (duration > 0) {
            // Set a timeout to close this specific notification after its duration
            setTimeout(() => {
                // Check if this notification is still the currently displayed one before closing automatically
                if (this.currentVisibleNotificationToast && this.currentVisibleNotificationToast.dataset.id == notificationData.id) {
                    this.closeNotification(notificationData.id);
                }
            }, duration);
        }
    }

    // NEW METHOD: Show notifications archive in a modal
    showNotificationsArchive() {
        // Sort by newest first
        const notifications = this.notificationHistory.slice().sort((a, b) => b.timestamp - a.timestamp);

        // Mark all as read when opening the archive
        this.notificationHistory.forEach(n => n.read = true);
        this.updateNotificationBadge(); // Update badge to reflect all read

        const content = `
            <div class="notification-archive-modal-content">
                ${notifications.length === 0 ? `
                    <div style="text-align: center; color: var(--text-light); padding: 2rem;">
                        <i class="fas fa-box-open" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p>Arxivdə bildiriş yoxdur.</p>
                    </div>
                ` : notifications.map(n => `
                    <div class="notification-archive-item ${n.read ? 'read' : ''}" data-id="${n.id}">
                        <div class="notification-archive-icon">
                            <i class="${this._getNotificationIconClass(n.type)}"></i>
                        </div>
                        <div class="notification-archive-details">
                            <div class="notification-archive-title">${n.title}</div>
                            <div class="notification-archive-message">${n.message}</div>
                            <div class="notification-archive-meta">
                                ${n.timestamp.toLocaleString('az-AZ')}
                            </div>
                        </div>
                        <div class="notification-archive-actions">
                            <button class="btn btn-secondary btn-xs" onclick="window.notificationManager.deleteNotificationFromArchive(${n.id})">
                                <i class="fas fa-trash"></i> Sil
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        const actions = `
            <button class="btn btn-secondary" onclick="window.modalManager.hideModal()">Bağla</button>
            <button class="btn btn-danger" onclick="window.notificationManager.clearNotificationsArchive()">
                <i class="fas fa-trash-alt"></i> Hamısını Sil
            </button>
        `;

        this.modalManager?.showModal('Bildiriş Arxivi', content, actions);
    }

    // Helper to get icon class based on type
    _getNotificationIconClass(type) {
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return iconMap[type] || 'fas fa-info-circle';
    }

    // Method to delete a single notification from archive
    deleteNotificationFromArchive(id) {
        const notificationEl = document.querySelector(`.notification-archive-item[data-id="${id}"]`);
        if (notificationEl) {
            notificationEl.remove();
        }
        this.notificationHistory = this.notificationHistory.filter(n => n.id !== id);
        this.updateNotificationBadge();
        if (this.notificationHistory.length === 0) {
            // Re-render modal content if empty
            this.showNotificationsArchive(); // This will re-open with empty message
        }
        this.showNotification('info', 'Silindi', 'Bildiriş arxivdən silindi.', 2000);
    }

    // Method to clear all notifications from archive
    clearNotificationsArchive() {
        this.notificationHistory = [];
        this.updateNotificationBadge();
        this.showNotification('info', 'Təmizləndi', 'Bildiriş arxivi təmizləndi.', 2000);
        this.showNotificationsArchive(); // Re-render modal to show empty state
    }

    // Helper for notification close
    closeNotification(id) {
        const notificationEl = document.querySelector(`.notification[data-id="${id}"]`);
        if (notificationEl) {
            notificationEl.classList.add('slide-out');
            setTimeout(() => {
                if (notificationEl.parentElement) {
                    notificationEl.remove();
                }
                // If the removed element was the one currently tracked as visible, clear the tracker
                if (this.currentVisibleNotificationToast && this.currentVisibleNotificationToast.dataset.id == id) {
                    this.currentVisibleNotificationToast = null;
                }
                // When a toast is dismissed, if it was part of history, mark it as read.
                // It should still exist in history, but won't contribute to unread count.
                const dismissedNotification = this.notificationHistory.find(n => n.id === id);
                if (dismissedNotification) {
                    dismissedNotification.read = true;
                }
                this.updateNotificationBadge(); // Re-calculate based on read status
            }, 300); // Match slide-out duration
        }
    }

    // Update notification badge logic to count UNREAD messages
    updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        // Safely check if the badge element exists before attempting to manipulate it
        if (!badge) {
            console.warn('Notification badge element not found. Skipping UI update.');
            return;
        }

        const unreadCount = this.notificationHistory.filter(n => !n.read).length; // Count only unread
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// maintain legacy global
window.NotificationManager = NotificationManager;

// --- PATCH: Remove html2canvas dependency from here, moved to index.html ---
export default NotificationManager;