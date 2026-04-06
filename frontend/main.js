const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    // Настройка основного окна
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 960,
        minHeight: 680,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('login.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Выход при закрытии всех окон (кроме macOS)
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
