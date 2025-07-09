// Forked from: https://github.com/LoggingNewMemory/notion-linux-electron

const { app, BrowserWindow, session } = require('electron');
const path = require('path');

let mainWindow;
let exitScreen;

function createWindow() {
    mainWindow = new BrowserWindow({
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
    mainWindow.loadURL('https://lms.binus.ac.id/');

    // Show loading screen
    loadingScreen.show();

    // When main window is ready, show it and hide loading screen
    mainWindow.once('ready-to-show', () => {
        setTimeout(() => {
            loadingScreen.close();
            mainWindow.show();
            
            // Fade in animation for main window
            mainWindow.setOpacity(0);
            mainWindow.show();
            
            let opacity = 0;
            const fadeIn = setInterval(() => {
                opacity += 0.05;
                mainWindow.setOpacity(opacity);
                if (opacity >= 1) {
                    clearInterval(fadeIn);
                }
            }, 16); // ~60fps
        }, 2000); // Show loading screen for 2 seconds minimum
    });

    // Handle main window close event
    mainWindow.on('close', (event) => {
        event.preventDefault();
        showExitAnimation();
    });

    // Handle loading screen close
    loadingScreen.on('closed', () => {
        // Loading screen closed
    });
}

function showExitAnimation() {
    // Hide main window
    mainWindow.hide();
    
    // Create exit screen
    exitScreen = new BrowserWindow({
        width: 500,
        height: 400,
        frame: false,
        alwaysOnTop: true,
        transparent: false,
        backgroundColor: '#F8FAFC',
        resizable: false,
        webPreferences: {
            nodeIntegration: false
        }
    });

    // Center the exit screen
    exitScreen.center();

    // Load the exit screen HTML
    exitScreen.loadFile(path.join(__dirname, 'exit.html'));

    // Show exit screen
    exitScreen.show();

    // Close the app after animation completes
    setTimeout(() => {
        if (exitScreen) {
            exitScreen.close();
        }
        if (mainWindow) {
            mainWindow.destroy();
        }
        app.quit();
    }, 2500); // Wait for animation to complete
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', (event) => {
    // Allow quit if exit screen is already showing
    if (exitScreen) {
        return;
    }
    
    // If main window exists and is not destroyed, show exit animation
    if (mainWindow && !mainWindow.isDestroyed()) {
        event.preventDefault();
        showExitAnimation();
    }
});
