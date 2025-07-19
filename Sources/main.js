// Forked from: https://github.com/LoggingNewMemory/notion-linux-electron

const { app, BrowserWindow, session, Menu, Tray, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let exitScreen;
let tray;
let isDarkModeEnabled = false;

// Configuration file path
const configPath = path.join(app.getPath('userData'), 'config.json');

// Load configuration from file
function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            isDarkModeEnabled = config.isDarkModeEnabled || false;
            console.log('Configuration loaded:', config);
        } else {
            console.log('No configuration file found, using defaults');
        }
    } catch (error) {
        console.error('Error loading configuration:', error);
        isDarkModeEnabled = false;
    }
}

// Save configuration to file
function saveConfig() {
    try {
        const config = {
            isDarkModeEnabled: isDarkModeEnabled
        };
        
        // Ensure the directory exists
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('Configuration saved:', config);
    } catch (error) {
        console.error('Error saving configuration:', error);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        autoHideMenuBar: false, // Show menu bar
        show: false, // Don't show window initially
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: 'persist:main-session' 
        },
        icon: path.join(__dirname, 'logo/LmsLogo.png')
    });

    // Menu Bar - Initialize with current dark mode state
    createMenu();

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
    mainWindow.loadURL('https://lms.binus.ac.id/lms/dashboard');

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

            // Initialize Dark Reader after page loads
            initializeDarkReader();
        }, 2000); // Show loading screen for 2 seconds minimum
    });

    // Handle main window close event - now minimizes to tray instead of closing
    mainWindow.on('close', (event) => {
        event.preventDefault();
        mainWindow.hide();
        
        // Show notification that app is running in tray
        if (tray) {
            tray.displayBalloon({
                iconType: 'info',
                title: 'BINUS LMS',
                content: 'Application is running in the system tray'
            });
        }
    });

    // Handle loading screen close
    loadingScreen.on('closed', () => {
        // Loading screen closed
    });
}

function createMenu() {
    const menuTemplate = [
        {
            label: 'Account',
            submenu: [
                {
                    label: 'Clear Local Account',
                    click: () => {
                        ClearAccount();
                    }
                },
            ]
        },
        {
            label: 'Web Controls',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        mainWindow.reload();
                    }
                },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: 'F12',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: isDarkModeEnabled ? 'Disable Dark Mode' : 'Enable Dark Mode',
                    accelerator: 'CmdOrCtrl+D',
                    click: () => {
                        toggleDarkMode();
                    }
                }
            ]
        },
        {
            label: 'App Controls',
            submenu: [
                {
                    label: 'Minimize',
                    accelerator: 'CmdOrCtrl+M',
                    click: () => {
                        mainWindow.minimize();
                    }
                },
                {
                    label: 'Hide to System Tray',
                    accelerator: 'CmdOrCtrl+H',
                    click: () => {
                        mainWindow.hide();
                    }
                },
                {
                    label: 'Quit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        showExitAnimation();
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

function initializeDarkReader() {
    // Inject Dark Reader into the page
    // Yamada Note: I better use streamed from CDN (Makes it easier if Dark Reader updates dawg)
    mainWindow.webContents.executeJavaScript(`
        (function() {
            // Check if Dark Reader is already loaded
            if (window.DarkReader) return;
            
            // Load Dark Reader from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/darkreader@4.9.109/darkreader.min.js';
            script.onload = function() {
                console.log('Dark Reader loaded successfully');
                // Store the initial state and apply saved preference
                window.isDarkModeEnabled = ${isDarkModeEnabled};
                
                // Apply dark mode if it was previously enabled
                if (window.isDarkModeEnabled) {
                    DarkReader.enable({
                        brightness: 100,
                        contrast: 90,
                        sepia: 10
                    }, {
                        invert: ['.logo', '.icon', 'img[src*="logo"]'],
                        css: '',
                        ignoreInlineStyle: ['.react-datepicker__input-container'],
                        ignoreImageAnalysis: ['.logo', '.icon']
                    });
                    console.log('Dark mode applied from saved preference');
                }
            };
            script.onerror = function() {
                console.error('Failed to load Dark Reader');
            };
            document.head.appendChild(script);
        })();
    `).catch(err => {
        console.error('Failed to inject Dark Reader script:', err);
    });
}

function toggleDarkMode() {
    mainWindow.webContents.executeJavaScript(`
        (function() {
            if (typeof DarkReader === 'undefined') {
                alert('Dark Reader is not loaded yet. Please try again in a moment.');
                return false;
            }
            
            if (window.isDarkModeEnabled) {
                // Disable dark mode
                DarkReader.disable();
                window.isDarkModeEnabled = false;
                console.log('Dark mode disabled');
                return false;
            } else {
                // Enable dark mode with custom settings
                DarkReader.enable({
                    brightness: 100,
                    contrast: 90,
                    sepia: 10
                }, {
                    invert: ['.logo', '.icon', 'img[src*="logo"]'],
                    css: '',
                    ignoreInlineStyle: ['.react-datepicker__input-container'],
                    ignoreImageAnalysis: ['.logo', '.icon']
                });
                window.isDarkModeEnabled = true;
                console.log('Dark mode enabled');
                return true;
            }
        })();
    `).then(result => {
        isDarkModeEnabled = result;
        
        // Save the preference to file
        saveConfig();
        
        // Update menu to reflect current state
        createMenu();
    }).catch(err => {
        console.error('Failed to toggle dark mode:', err);
        dialog.showErrorBox('Dark Mode Error', 'Failed to toggle dark mode. Please try reloading the page.');
    });
}

function createTray() {
    // Create system tray
    tray = new Tray(path.join(__dirname, 'logo/LmsLogo.png'));
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show BINUS LMS',
            click: () => {
                mainWindow.show();
                mainWindow.focus();
            }
        },
        {
            label: 'Hide BINUS LMS',
            click: () => {
                mainWindow.hide();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            click: () => {
                showExitAnimation();
            }
        }
    ]);

    tray.setToolTip('BINUS LMS');
    tray.setContextMenu(contextMenu);

    // Double-click to show/hide window
    tray.on('double-click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function ClearAccount() {
    const response = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['Clear', 'Cancel'],
        defaultId: 1,
        title: 'Clear Account',
        message: 'Are you sure you want to clear your saved local account?',
        detail: 'You will need to log in again.'
    });

    if (response === 0) {
        // Clear session data
        session.fromPartition('persist:main-session').clearStorageData({
            storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
        }).then(() => {
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Account Cleared',
                message: 'Local account cleared sucessfully',
                detail: 'The application will restart now.'
            }).then(() => {
                mainWindow.reload();
            });
        }).catch((error) => {
            dialog.showErrorBox('Error', `Failed to clear account data: ${error.message}`);
        });
    }
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
        if (tray) {
            tray.destroy();
        }
        app.quit();
    }, 2500); // Wait for animation to complete
}

app.whenReady().then(() => {
    // Load configuration before creating the window
    loadConfig();
    createWindow();
    createTray();
});

app.on('window-all-closed', () => {
    // Don't quit on window close, keep running in tray
    // App will only quit when explicitly requested
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

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// With 1.2.0, I Don't want to work with a fckin Digital Business Ahh Student
// I rather work with my Lab or my own Community
// That nigga literally think this techincal testing is some kind of romantic ahh novel
// Nigga you make me hate Digital Business Again dawg +_+

// Update: I forgive You Shanna, but I... I don't know, I lost my feelings for you, I'm Sorry