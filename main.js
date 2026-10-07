// main.js - Electron main process

const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let log;
try {
    log = require('electron-log');
    log.transports.file.level = 'debug';
} catch (err) {
    log = {
        info: console.log,
        error: console.error,
        warn: console.warn,
        debug: console.debug
    };
}

// Load environment variables from .env file in development.
// In a packaged app, these should be set via build-time environment variables for security.
if (process.env.NODE_ENV !== 'production') {
    try {
        require('dotenv').config();
    } catch (err) {
        log.warn("dotenv not found or not needed in production build");
    }
}

// Configuration is prioritized from environment variables, with fallbacks for ease of setup.
// For a secure production environment, it is strongly recommended to use environment variables
// injected at build time rather than hardcoding secrets.
const APP_CONFIG = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '7849692173:AAGc9EvrywMa6hOcYh7EvqTaNqOEXW4G_Gk',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '734378254',
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || 'AIzaSyD-jdQPgIQOjRlaHlSkrxf-hkiJu6-kySk',
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || 'hotelpms-d0871.firebaseapp.com',
    FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || 'https://hotelpms-d0871-default-rtdb.firebaseio.com',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'hotelpms-d0871',
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || 'hotelpms-d0871.appspot.com',
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || '118813173579',
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || '1:118813173579:web:c36b32052a58a4d7c86ace',
    FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID || ''
};

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

let mainWindow;

// Create browser window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 360,
        minHeight: 500,
        icon: path.join(__dirname, 'assets/appicon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
            devTools: process.env.NODE_ENV !== 'production' || process.argv.includes('--dev')
        },
        titleBarStyle: 'default',
        // Show the window immediately; the in-page splash screen covers the
        // short renderer startup while Firebase and optional libraries load.
        // Waiting for ready-to-show made a slow network look like a frozen app.
        show: true,
        backgroundColor: '#f8f9fa' // Matches body bg for smoother visual loading
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        if (process.platform === 'darwin') {
            mainWindow.focus();
        }
        // Open the window maximized by default
        mainWindow.maximize();
    });

    mainWindow.setTitle('RB Hotel');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url === 'about:blank' || url.startsWith('about:blank')) {
            return { action: 'allow' };
        }
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Only open dev tools in development mode or if flag is passed
    if (process.argv.includes('--dev') || process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    } else {
        // In production, prevent devtools via keyboard shortcuts for security
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
                event.preventDefault();
            }
            if (input.key === 'F12') {
                event.preventDefault();
            }
        });
    }

    createMenu();
}

// IPC handler to get application configuration
ipcMain.handle('get-app-config', () => {
    return APP_CONFIG;
});

// IPC handlers
ipcMain.handle('write-file', async (event, filePath, data) => {
    try {
        // Ensure path.join is used to prevent directory traversal vulnerabilities
        // and ensure the path is within a safe, expected directory if possible.
        // For backup/export, we assume the user picks a safe directory.
        // A real-world app would apply more stringent path validation.
        const normalizedPath = path.normalize(filePath);
        fs.writeFileSync(normalizedPath, data, 'utf8');
        return { success: true };
    } catch (error) {
        log.error('Write file error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        // As with 'write-file', ensure proper path handling.
        const normalizedPath = path.normalize(filePath);
        const data = fs.readFileSync(normalizedPath, 'utf8');
        return { success: true, data };
    } catch (error) {
        log.error('Read file error:', error);
        return { success: false, error: error.message };
    }
});

// NEW: IPC handler to show open directory dialog
ipcMain.handle('show-open-directory-dialog', async (event) => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory', 'createDirectory'],
            title: 'Yedəkləmə Qovluğunu Seçin'
        });
        if (!result.canceled && result.filePaths.length > 0) {
            // FIX: Return the correct structure with the path
            return { success: true, canceled: false, path: result.filePaths[0] };
        }
        return { success: true, canceled: true, path: null };
    } catch (error) {
        log.error('Show open directory dialog error:', error);
        return { success: false, error: error.message };
    }
});

// NEW: IPC handler to save backup file to a specific path
ipcMain.handle('save-backup-file', async (event, folderPath, fileName, data) => {
    try {
        const fullPath = path.join(folderPath, fileName); // Combine folder and file name
        fs.writeFileSync(fullPath, data, 'utf8');
        return { success: true };
    } catch (error) {
        log.error('Save backup file error:', error);
        return { success: false, error: error.message };
    }
});

// Basic app info
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-app-name', () => app.getName());

// Dialog handlers
ipcMain.handle('show-message-box', async (event, options) => {
    return await dialog.showMessageBox(mainWindow, options);
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    return await dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    return await dialog.showOpenDialog(mainWindow, options);
});

// NEW: Listen for title change requests from the renderer process
ipcMain.on('set-app-title', (event, title) => {
    if (mainWindow && typeof title === 'string') {
        mainWindow.setTitle(title);
    }
});

// Enhanced data export
async function exportData() {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Verilənləri Export Et',
            defaultPath: `rb-hotel-backup-${new Date().toISOString().split('T')[0]}.json`,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled && result.filePath) {
            mainWindow?.webContents.send('export-data', result.filePath);
        }
    } catch (error) {
        log.error('Error in export dialog:', error);
        dialog.showErrorBox('Export Xətətası', 'Verilənlər export edilmədi: ' + error.message);
    }
}

// Enhanced data import 
async function importData() {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Verilənləri Import Et',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });

        if (!result.canceled && result.filePaths.length > 0) {
            mainWindow?.webContents.send('import-data', result.filePaths[0]);
        }
    } catch (error) {
        log.error('Error in import dialog:', error);
        dialog.showErrorBox('Import Xətası', 'Verilənlər import edilmədi: ' + error.message);
    }
}

// Main menu setup with localization
function createMenu() {
    const template = [
        {
            label: 'Fayl',
            submenu: [
                {
                    label: 'Yeni Rezervasiya',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => mainWindow?.webContents.send('menu-action', 'new-reservation')
                },
                {
                    label: 'Yeni Qonaq',
                    accelerator: 'CmdOrCtrl+G',
                    click: () => mainWindow?.webContents.send('menu-action', 'new-guest')
                },
                { type: 'separator' },
                {
                    label: 'Verilənləri Export Et',
                    click: () => exportData()
                },
                {
                    label: 'Verilənləri Import Et',
                    click: () => importData()
                },
                { type: 'separator' },
                {
                    label: 'Hesabat Export Et',
                    submenu: [
                        {
                            label: 'PDF Hesabat',
                            click: () => mainWindow?.webContents.send('export-report', 'pdf')
                        },
                        {
                            label: 'Excel Hesabat',
                            click: () => mainWindow?.webContents.send('export-report', 'excel')
                        }
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Çıxış',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Redaktə',
            submenu: [
                { role: 'undo', label: 'Geri Al' },
                { role: 'redo', label: 'Təkrar Et' },
                { type: 'separator' },
                { role: 'cut', label: 'Kəs' },
                { role: 'copy', label: 'Kopyala' },
                { role: 'paste', label: 'Yapışdır' },
                { role: 'selectall', label: 'Hamısını Seç' }
            ]
        },
        {
            label: 'Baxış',
            submenu: [
                { role: 'reload', label: 'Yenilə' },
                { role: 'forceReload', label: 'Zorla Yenilə' },
                { role: 'toggleDevTools', label: 'Developer Tools' },
                { type: 'separator' },
                { role: 'resetZoom', label: 'Zoom Sıfırla' },
                { role: 'zoomIn', label: 'Böyüt' },
                { role: 'zoomOut', label: 'Kiçilt' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Tam Ekran' }
            ]
        },
        {
            label: 'Kömək',
            submenu: [
                {
                    label: 'Haqqında',
                    click: () => dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'RB Hotel Haqqında',
                        message: 'RB Hotel Property Management System',
                        detail: `Versiya: ${app.getVersion()}\nElectron ilə hazırlanmışdır`
                    })
                }
            ]
        }
    ];

    // Mac-specific menu items
    if (process.platform === 'darwin') {
        template.unshift({
            label: "RB Hotel",
            submenu: [
                { role: 'about', label: 'Haqqında RB Hotel' },
                { type: 'separator' },
                { role: 'services', label: 'Xidmətlər' },
                { type: 'separator' },
                { role: 'hide', label: 'Gizlət RB Hotel' },
                { role: 'hideothers', label: 'Digərlərini Gizlət' },
                { role: 'unhide', label: 'Hamısını Göstər' },
                { type: 'separator' },
                { role: 'quit', label: 'Çıxış RB Hotel' }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// App events with better error handling
app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}).catch(error => {
    log.error('App initialization error:', error);
    dialog.showErrorBox('Başlatma Xətası', 'Proqram başladıla bilmədi: ' + error.message);
    app.quit();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error);
    dialog.showErrorBox('Sistem Xətası', 'Gözlənilməz xəta: ' + error.message);
    app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Rejection:', reason);
    dialog.showErrorBox('Sistem Xətası', 'Gözlənilməz xəta: ' + reason);
});
