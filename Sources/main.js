// Forked from: https://github.com/LoggingNewMemory/notion-linux-electron

const { app, BrowserWindow, session, Menu, Tray, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('max-connections-per-server', '32');
app.commandLine.appendSwitch('max-persistence-network-requests', '32');
app.commandLine.appendSwitch('enable-quic');
app.commandLine.appendSwitch('enable-features', 'ParallelDownloading,NetworkService,NetworkServiceInProcess');
app.commandLine.appendSwitch('disk-cache-size', '536870912');

let mainWindow;
let exitScreen;
let tray;
let isDarkModeEnabled = false; 
let darkModeCheckInterval;

const configPath = path.join(app.getPath('userData'), 'config.json');

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

function saveConfig() {
    try {
        const config = {
            isDarkModeEnabled: isDarkModeEnabled
        };
        
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
        autoHideMenuBar: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: 'persist:main-session',
            // Allow background processing for faster loads
            backgroundThrottling: false 
        },
        icon: path.join(__dirname, 'logo/LmsLogo.png')
    });

    createMenu();

    const loadingScreen = new BrowserWindow({
        width: 500,
        height: 400,
        frame: false,
        alwaysOnTop: true,
        transparent: false,
        backgroundColor: isDarkModeEnabled ? '#0f172a' : '#ffffff',
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    loadingScreen.center();

    loadingScreen.loadFile(path.join(__dirname, 'loading.html'));
    
    loadingScreen.webContents.once('did-finish-load', () => {
        loadingScreen.webContents.executeJavaScript(`
            document.body.classList.toggle('dark-mode', ${isDarkModeEnabled});
        `);
    });

    mainWindow.loadURL('https://lms.binus.ac.id/lms/dashboard');

    loadingScreen.show();

    mainWindow.once('ready-to-show', () => {
        setTimeout(() => {
            loadingScreen.close();
            mainWindow.show();
            
            mainWindow.setOpacity(0);
            mainWindow.show();
            
            let opacity = 0;
            const fadeIn = setInterval(() => {
                opacity += 0.05;
                mainWindow.setOpacity(opacity);
                if (opacity >= 1) {
                    clearInterval(fadeIn);
                }
            }, 16); 

            initializeDarkReaderSystem();
        }, 2000); 
    });

    mainWindow.webContents.on('did-navigate', () => {
        if (isDarkModeEnabled) {
            setTimeout(() => {
                applyDarkMode();
            }, 500); 
        }
    });

    mainWindow.webContents.on('did-navigate-in-page', () => {
        if (isDarkModeEnabled) {
            setTimeout(() => {
                applyDarkMode();
            }, 500);
        }
    });

    mainWindow.webContents.on('dom-ready', () => {
        if (isDarkModeEnabled) {
            applyDarkMode();
        }
    });

    mainWindow.on('close', (event) => {
        event.preventDefault();
        mainWindow.hide();
        
        if (tray) {
            tray.displayBalloon({
                iconType: 'info',
                title: 'BINUS LMS',
                content: 'Application is running in the system tray'
            });
        }
    });

    loadingScreen.on('closed', () => {
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
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

function initializeDarkReaderSystem() {
    mainWindow.webContents.executeJavaScript(`
        (function() {
            if (window.DarkReader) return;
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/darkreader@4.9.109/darkreader.min.js';
            script.onload = function() {
                console.log('Dark Reader loaded successfully');
                window.isDarkModeEnabled = ${isDarkModeEnabled};
                
                if (window.isDarkModeEnabled) {
                    applyDarkReaderSettings();
                }
            };
            script.onerror = function() {
                console.error('Failed to load Dark Reader');
            };
            document.head.appendChild(script);
            
            window.applyDarkReaderSettings = function() {
                if (typeof DarkReader !== 'undefined' && window.isDarkModeEnabled) {
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
                    console.log('Dark mode applied');
                }
            };
        })();
    `).catch(err => {
        console.error('Failed to inject Dark Reader script:', err);
    });

    if (isDarkModeEnabled) {
        startDarkModeMonitoring();
    }
}

function applyDarkMode() {
    mainWindow.webContents.executeJavaScript(`
        (async function() {
            if (typeof DarkReader === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/darkreader@4.9.109/darkreader.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            
            if (typeof DarkReader !== 'undefined') {
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
                console.log('Dark mode applied to current page');
            }
        })();
    `).catch(err => {
        console.error('Failed to apply dark mode:', err);
    });
}

function startDarkModeMonitoring() {
    if (darkModeCheckInterval) {
        clearInterval(darkModeCheckInterval);
    }
    
    darkModeCheckInterval = setInterval(() => {
        if (isDarkModeEnabled && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.executeJavaScript(`
                (function() {
                    if (typeof DarkReader !== 'undefined' && window.isDarkModeEnabled) {
                        if (!DarkReader.isEnabled()) {
                            console.log('Dark mode not enabled, reapplying...');
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
                        }
                    }
                })();
            `).catch(() => {
            });
        }
    }, 2000);
}

function stopDarkModeMonitoring() {
    if (darkModeCheckInterval) {
        clearInterval(darkModeCheckInterval);
        darkModeCheckInterval = null;
    }
}

function toggleDarkMode() {
    mainWindow.webContents.executeJavaScript(`
        (async function() {
            if (typeof DarkReader === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/darkreader@4.9.109/darkreader.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            
            if (typeof DarkReader === 'undefined') {
                alert('Failed to load Dark Reader. Please try again.');
                return window.isDarkModeEnabled || false;
            }

            if (window.isDarkModeEnabled) {
                DarkReader.disable();
                window.isDarkModeEnabled = false;
            } else {
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
            }
            return window.isDarkModeEnabled;
        })();
    `).then(result => {
        isDarkModeEnabled = result;
        saveConfig();
        createMenu();
        
        if (isDarkModeEnabled) {
            startDarkModeMonitoring();
        } else {
            stopDarkModeMonitoring();
        }
    }).catch(err => {
        console.error('Failed to toggle dark mode:', err);
        dialog.showErrorBox('Dark Mode Error', 'Failed to toggle dark mode. Please try reloading the page.');
    });
}

function createTray() {
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
    mainWindow.hide();
    stopDarkModeMonitoring();
    
    exitScreen = new BrowserWindow({
        width: 500,
        height: 400,
        frame: false,
        alwaysOnTop: true,
        transparent: false,
        backgroundColor: isDarkModeEnabled ? '#0f172a' : '#F8FAFC',
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    exitScreen.center();

    exitScreen.loadFile(path.join(__dirname, 'exit.html'));
    
    exitScreen.webContents.once('did-finish-load', () => {
        exitScreen.webContents.executeJavaScript(`
            document.body.classList.toggle('dark-mode', ${isDarkModeEnabled});
        `);
    });

    exitScreen.show();

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
    }, 2500);
}

app.whenReady().then(() => {
    loadConfig();
    createWindow();
    createTray();
});

app.on('window-all-closed', () => {
    stopDarkModeMonitoring();
});

app.on('before-quit', (event) => {
    if (exitScreen) {
        return;
    }
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        event.preventDefault();
        showExitAnimation();
    }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}