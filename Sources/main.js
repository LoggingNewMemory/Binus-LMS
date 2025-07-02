// Forked from: https://github.com/LoggingNewMemory/notion-linux-electron

const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            partition: 'persist:main-session' 
        },
        icon: path.join(__dirname, 'logo/LmsLogo.png')
    });

    win.loadURL('https://lms.binus.ac.id/');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Man... I actually have a crush on a Digital Business Student
// Shanna... If somehow... You managed to read this
// I want to say I like you, but I'm afraid to say that explicitly 
// I'm just a programmer, my main objectives is to code, not to love
// There's no loves for programmer. The one who receives one is either
// Not a programmer, or just so lucky 