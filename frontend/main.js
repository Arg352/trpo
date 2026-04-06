const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    // Настройки окна программы
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 960,
        minHeight: 680,
        autoHideMenuBar: true, // Прячем верхнее меню (Файл, Правка и т.д.)
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Какой файл открыть при запуске приложения? (начинаем с логина)
    mainWindow.loadFile('login.html');
}

// Когда Electron готов к работе - создаем окно
app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Закрываем программу полностью, если закрыты все окна (важно для Windows)
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
