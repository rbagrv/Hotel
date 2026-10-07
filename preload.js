const { contextBridge, ipcRenderer } = require('electron');

// Expose only safe methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App config
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppName: () => ipcRenderer.invoke('get-app-name'),

  // File operations
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  // NEW: File operations for backup
  showOpenDirectoryDialog: () => ipcRenderer.invoke('show-open-directory-dialog'),
  saveBackupFile: (folderPath, fileName, data) => ipcRenderer.invoke('save-backup-file', folderPath, fileName, data),

  // Dialog methods
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // App listeners
  onMenuAction: (callback) => {
    const eventHandler = (_, data) => callback(data);
    ipcRenderer.on('menu-action', eventHandler);
    return () => ipcRenderer.removeListener('menu-action', eventHandler);
  },

  onNavigateTo: (callback) => {
    const eventHandler = (_, module) => callback(module);
    ipcRenderer.on('navigate-to', eventHandler);
    return () => ipcRenderer.removeListener('navigate-to', eventHandler);
  },

  onExportData: (callback) => {
    const eventHandler = (_, filePath) => callback(filePath);
    ipcRenderer.on('export-data', eventHandler);
    return () => ipcRenderer.removeListener('export-data', eventHandler);
  },

  onImportData: (callback) => {
    const eventHandler = (_, filePath) => callback(filePath);
    ipcRenderer.on('import-data', eventHandler);
    return () => ipcRenderer.removeListener('import-data', eventHandler);
  },

  onExportReport: (callback) => {
    const eventHandler = (_, format) => callback(format);
    ipcRenderer.on('export-report', eventHandler);
    return () => ipcRenderer.removeListener('export-report', eventHandler);
  },

  // Clean up
  cleanup: () => {
    ipcRenderer.removeAllListeners('menu-action');
    ipcRenderer.removeAllListeners('navigate-to');
    ipcRenderer.removeAllListeners('export-data');
    ipcRenderer.removeAllListeners('import-data');
    ipcRenderer.removeAllListeners('export-report');
  }
});

// Platform detection for the renderer
contextBridge.exposeInMainWorld('platform', {
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  isElectron: true,
  version: process.versions.electron
});

// Database mode detection
contextBridge.exposeInMainWorld('dbMode', {
  isOfflineFirst: true, // Configure for offline-first approach
  isSQLite: process.platform === 'win32' // Use SQLite on Windows
});

// Expose update-related methods
contextBridge.exposeInMainWorld('electronUpdater', {
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (_, status) => callback(status));
        return () => ipcRenderer.removeListener('update-status', callback);
    },
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    // NEW: Expose method to set title, so renderer can request a title change
    setAppTitle: (title) => ipcRenderer.send('set-app-title', title)
});