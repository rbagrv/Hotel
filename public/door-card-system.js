// door-card-system.js
//
// Universal door-lock / room-card integration.
//
// The system is provider-driven so any device can be supported by adding a driver
// to the provider registry. A built-in generic REST driver covers the common case:
// each lock brand exposes an HTTP API, and this module programs a time-restricted
// key (from check-in to check-out) and then revokes it once the guest leaves.
//
// Responsibilities:
//   - Superadmin can configure the provider + connection parameters and test it.
//   - On reservation create/update, program a time-based key for the room.
//   - On reservation checkout/cancel, revoke (lock) the key.

const PROVIDER_REGISTRY = {
  hune: {
    label: 'Hune Ağıllı Kilid',
    description: 'Hune kilid serveri ilə inteqrasiya. /status, /issue və /lock əmrləri istifadə olunur.',
    fields: ['apiUrl'],
    configDefaults: { apiUrl: '' }
  },
  generic: {
    label: 'Universal (REST)',
    description: 'İstənilən REST API üçün ümumi proqram. Endpointləri və API açarını özünüz konfiqurasiya edin.',
    fields: ['apiUrl', 'apiKey', 'issuePath', 'lockPath', 'requestMethod', 'doorId'],
    configDefaults: {
      apiUrl: '',
      apiKey: '',
      issuePath: '/issue',
      lockPath: '/lock',
      requestMethod: 'POST',
      doorId: ''
    }
  }
};

// Driver contract:
//   testConnection(cfg, request) -> { ok, error?, detail? }
//   issueKey(cfg, ctx, request)  -> response object (ok flag understood)
//   lockKey(cfg, ctx, request)   -> response object
// where `request(url, { method, body, token })` performs an HTTP call with timeout
// and throws a user-friendly error on failure.
const PROVIDER_DRIVERS = {
  hune: {
    async testConnection(cfg, request) {
      await request(cfg.apiUrl + '/status', { method: 'GET', token: cfg.apiKey });
      return { ok: true };
    },
    async issueKey(cfg, ctx, request) {
      return request(cfg.apiUrl + '/issue', {
        method: 'POST',
        token: cfg.apiKey,
        body: { room: ctx.room.number, roomId: ctx.room.id, from: ctx.from, to: ctx.to }
      });
    },
    async lockKey(cfg, ctx, request) {
      return request(cfg.apiUrl + '/lock', {
        method: 'POST',
        token: cfg.apiKey,
        body: { room: ctx.room.number, roomId: ctx.room.id }
      });
    }
  },

  generic: {
    async testConnection(cfg, request) {
      await request(cfg.apiUrl, { method: 'GET', token: cfg.apiKey });
      return { ok: true };
    },
    async issueKey(cfg, ctx, request) {
      const method = (cfg.requestMethod || 'POST').toUpperCase();
      return request((cfg.apiUrl || '') + (cfg.issuePath || '/issue'), {
        method,
        token: cfg.apiKey,
        body: {
          roomId: ctx.room.id,
          roomNumber: ctx.room.number,
          doorId: cfg.doorId || ctx.room.id,
          from: ctx.from,
          to: ctx.to,
          action: 'issue'
        }
      });
    },
    async lockKey(cfg, ctx, request) {
      const method = (cfg.requestMethod || 'POST').toUpperCase();
      return request((cfg.apiUrl || '') + (cfg.lockPath || '/lock'), {
        method,
        token: cfg.apiKey,
        body: {
          roomId: ctx.room.id,
          roomNumber: ctx.room.number,
          doorId: cfg.doorId || ctx.room.id,
          action: 'lock'
        }
      });
    }
  }
};

class DoorCardSystem {
    constructor() {
        this.maxTimeoutMillis = 8000;
    }

    // ----- Config helpers -----
    getConfig() {
        return window.app?.getSetting?.('doorCardSettings') || {};
    }

    isEnabled() {
        return this.getConfig().enabled === true;
    }

    _providerId() {
        return this.getConfig().provider || 'hune';
    }

    _driver() {
        return PROVIDER_DRIVERS[this._providerId()] || null;
    }

    // ----- Low-level HTTP with timeout + user-friendly errors -----
    _request = async (url, { method = 'GET', token = null, body = null } = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.maxTimeoutMillis);

        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers.Authorization = 'Bearer ' + (token.startsWith('Bearer ') ? token.slice(7) : token);
        }

        try {
            const response = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const text = await response.text();
            let json = {};
            try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON body */ }

            if (!response.ok) {
                const detail = json.message || json.error || json.description || `HTTP ${response.status} ${response.statusText}`;
                throw new Error(detail);
            }
            return json;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Connect müddəti bitdi (${this.maxTimeoutMillis / 1000} saniyə).`);
            }
            if (error.name === 'TypeError' || (error.message && error.message.includes('Failed to fetch'))) {
                throw new Error('Şəbəkə xətası və ya serverə çatmaq mümkün olmadı. URL və şəbəkəni yoxlayın.');
            }
            throw error;
        }
    };

    // ----- Test connection (SuperAdmin) -----
    async testConnection() {
        const cfg = this.getConfig();
        const driver = this._driver();
        if (!driver) return { ok: false, error: 'Bilinməyən qurğu tipi seçilib.' };
        if (!cfg.apiUrl) return { ok: false, error: 'API URL daxil edilməyib.' };
        if (!driver.testConnection) return { ok: false, error: 'Bu qurğu tipi üçün test dəstəklənmir.' };

        try {
            await driver.testConnection(cfg, this._request);
            return { ok: true };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    // ----- Reservation lifecycle hooks -----
    async handleReservationCreate(reservation) {
        if (!this.isEnabled() || !this._issuable(reservation)) return;
        await this._program(reservation);
    }

    async handleReservationUpdate(newRes, oldRes) {
        if (!this.isEnabled() || !newRes) return;

        const roomChanged = oldRes && newRes.roomId !== oldRes.roomId;
        const datesChanged = oldRes && (newRes.checkIn !== oldRes.checkIn || newRes.checkOut !== oldRes.checkOut);
        const statusChanged = oldRes && newRes.status !== oldRes.status;

        // Guest left / cancelled -> close the previous key.
        if (statusChanged && this._revocable(newRes)) {
            await this._revoke(oldRes || newRes);
            return;
        }

        // Room or dates changed while still active -> reprogram the window.
        if ((roomChanged || datesChanged) && this._issuable(newRes)) {
            await this._revoke(oldRes);
            await this._program(newRes);
            return;
        }

        // Status progressed into an active state (e.g. confirmed) with no prior key.
        if (statusChanged && this._issuable(newRes) && (!oldRes || !this._issuable(oldRes))) {
            await this._program(newRes);
        }
    }

    async handleReservationDelete(reservation) {
        if (!this.isEnabled()) return;
        await this._revoke(reservation);
    }

    // ----- Key programming logic -----
    _issuable(reservation) {
        if (!reservation?.roomId) return false;
        return ['pending', 'confirmed', 'occupied'].includes(reservation.status);
    }

    _revocable(reservation) {
        return ['cancelled', 'checkout'].includes(reservation.status);
    }

    _resolveRoom(reservation) {
        return (window.app?.data?.rooms || []).find(r => r.id === reservation?.roomId) || null;
    }

    async _program(reservation) {
        const room = this._resolveRoom(reservation);
        const driver = this._driver();
        if (!driver?.issueKey) {
            this._report('Kart açar yaradıla bilmədi: seçilmiş qurğu üçün driver yoxdur.', false);
            return;
        }
        try {
            const w = this._timeWindow(reservation);
            await driver.issueKey(this.getConfig(), { reservation, room, from: w.from, to: w.to }, this._request);
            this._report(`Qapı kartı açdıldı (${room ? 'Otaq ' + room.number : 'Rezervasiya ' + (reservation.publicId || reservation.id)})`, true);
        } catch (error) {
            this._report(`Qapı kartı hazırlanması xətası: ${error.message}`, false);
        }
    }

    async _revoke(reservation) {
        if (!reservation?.roomId) return;
        const room = this._resolveRoom(reservation);
        const driver = this._driver();
        if (!driver?.lockKey) {
            this._report('Kart bağlana bilmədi: seçilmiş qurğu üçün driver yoxdur.', false);
            return;
        }
        try {
            await driver.lockKey(this.getConfig(), { room, roomId: reservation.roomId, roomNumber: room ? room.number : reservation.roomId }, this._request);
            this._report(`Qapı kartı bağlandı (${room ? 'Otaq ' + room.number : 'Rezervasiya ' + (reservation.publicId || reservation.id)})`, true);
        } catch (error) {
            this._report(`Qapı kartı bağlanması xətası: ${error.message}`, false);
        }
    }

    _timeWindow(reservation) {
        const from = reservation.checkIn ? new Date(reservation.checkIn) : new Date();
        const to = reservation.checkOut ? new Date(reservation.checkOut) : from;
        return { from: from.toISOString(), to: to.toISOString() };
    }

    _report(message, ok) {
        if (ok) {
            window.notificationManager?.showNotification?.('success', 'Qapı Kartı', message);
        } else {
            console.error('[DoorCard]', message);
            window.app?.recordSystemError?.('DoorCardError', message, null, 'door-card-system.js', 'handleReservation');
            window.notificationManager?.showNotification?.('error', 'Qapı Kartı Xətası', message);
        }
    }
}

window.DoorCardSystem = DoorCardSystem;

export default DoorCardSystem;