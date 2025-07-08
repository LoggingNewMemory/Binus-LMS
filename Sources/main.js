// Forked from: https://github.com/LoggingNewMemory/notion-linux-electron

const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        autoHideMenuBar: true,
        show: false, // Don't show window initially
        webPreferences: {
            nodeIntegration: false,
            partition: 'persist:main-session' 
        },
        icon: path.join(__dirname, 'logo/LmsLogo.png')
    });

    // Create loading screen with Linux-compatible settings
    const loadingScreen = new BrowserWindow({
        width: 500,
        height: 400,
        frame: false,
        alwaysOnTop: true,
        transparent: false, // Changed to false for Linux compatibility
        backgroundColor: '#ffffff', // Added background color
        resizable: false,
        webPreferences: {
            nodeIntegration: false
        }
    });

    // Center the loading screen
    loadingScreen.center();

    // Load the loading screen HTML
    loadingScreen.loadFile(path.join(__dirname, 'loading.html'));

    // Load main URL
    win.loadURL('https://lms.binus.ac.id/');

    // Show loading screen
    loadingScreen.show();

    // When main window is ready, show it and hide loading screen
    win.once('ready-to-show', () => {
        setTimeout(() => {
            loadingScreen.close();
            win.show();
            
            // Fade in animation for main window
            win.setOpacity(0);
            win.show();
            
            let opacity = 0;
            const fadeIn = setInterval(() => {
                opacity += 0.05;
                win.setOpacity(opacity);
                if (opacity >= 1) {
                    clearInterval(fadeIn);
                }
            }, 16); // ~60fps
        }, 2000); // Show loading screen for 2 seconds minimum
    });

    // Handle loading screen close
    loadingScreen.on('closed', () => {
        // Loading screen closed
    });
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