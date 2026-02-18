const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;
let isFullScreen = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'src/assets/icon.ico'),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'public/electron-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));

  // تسجيل اختصار H لتبديل FullScreen
  mainWindow.once('ready-to-show', () => {
    globalShortcut.register('H', () => {
      isFullScreen = !isFullScreen;
      mainWindow.setFullScreen(isFullScreen);
      // أرسل حالة FullScreen للـ React App
      mainWindow.webContents.send('fullscreen-toggle', isFullScreen);
    });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
