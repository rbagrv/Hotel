// Status text helper utilities
export default class StatusHelper {
    getReservationStatus(status) {
        const statusMap = {
            'confirmed': 'Təsdiqlənib',
            'pending': 'Gözləyir',
            'cancelled': 'Ləğv edilib',
            'checkout': 'Çıxış edib',
            'occupied': 'Dolu' 
        };
        return statusMap[status] || status;
    }

    getRoomStatus(status) {
        const statusMap = {
            'available': 'Boş',
            'occupied': 'Dolu',
            'maintenance': 'Təmir'
        };
        return statusMap[status] || status;
    }

    getConnectionStatus() {
        let status = { isOnline: false, queueLength: 0 };
        
        try {
            if (window.app && window.app.ws) {
                status = {
                    isOnline: window.navigator.onLine && window.app.ws.isOnline,
                    queueLength: (window.app.ws.syncQueue || []).length,
                    lastSyncTime: window.app.ws.lastSyncTime,
                    hasOnlineDB: !!window.app.ws.onlineDB
                };
            }
        } catch (error) {
            console.error('Error getting connection status:', error);
        }

        // Update status indicator in header
        const statusBtn = document.getElementById('firebaseSyncBtn'); 
        const statusIcon = document.getElementById('firebaseSyncIcon'); 
        
        if (statusBtn && statusIcon) {
            // The UI update is now primarily handled by the polling function in index.html
            // This function's direct manipulation is redundant and potentially conflicting.
            // Removing direct manipulation, relying on index.html's polling.
        }

        return status;
    }

    // NEW: Get Maintenance Status
    getMaintenanceStatus(status) {
        const statusMap = {
            'pending': 'Gözləyir',
            'in_progress': 'İcra olunur',
            'completed': 'Tamamlanıb',
            'cancelled': 'Ləğv edilib'
        };
        return statusMap[status] || status;
    }
}