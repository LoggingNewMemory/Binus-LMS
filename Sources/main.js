// Forked from: https://github.com/LoggingNewMemory/notion-linux-electron

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

const STORAGE_FILE = path.join(app.getPath('userData'), 'last_url.txt');

function saveLastURL(url) {
    fs.writeFileSync(STORAGE_FILE, url, 'utf-8');
}

function getLastURL() {
    if (fs.existsSync(STORAGE_FILE)) {
        return fs.readFileSync(STORAGE_FILE, 'utf-8');
    }
    return 'https://www.notion.so/desktop'; 
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            partition: 'persist:main-session' 
        },
        icon: path.join(__dirname, 'logo/notion.png')
    });

    win.loadURL(getLastURL());

    win.webContents.on('did-navigate', (_, url) => {
        saveLastURL(url);
    });

    win.webContents.on('will-navigate', (_, url) => {
        saveLastURL(url);
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});