const { app, BrowserWindow, session, Menu, Tray, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('max-connections-per-server', '32');
app.commandLine.appendSwitch('max-persistence-network-requests', '32');
app.commandLine.appendSwitch('enable-quic');
app.commandLine.appendSwitch('enable-features', 'ParallelDownloading,NetworkService,NetworkServiceInProcess');
app.commandLine.appendSwitch('disk-cache-size', '1073741824');
app.commandLine.appendSwitch('disable-http-cache', 'false');

let mainWindow;
let exitScreen;
let tray;
let isDarkModeEnabled = false; 
let darkModeCheckInterval;
let localDarkReaderScript = null;

const configPath = path.join(app.getPath('userData'), 'config.json');
const darkReaderPath = path.join(__dirname, 'darkreader.js');

try {
    if (fs.existsSync(darkReaderPath)) {
        localDarkReaderScript = fs.readFileSync(darkReaderPath, 'utf8');
    }
} catch (error) {
    console.error(error);
}

function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            isDarkModeEnabled = config.isDarkModeEnabled || false;
        }
    } catch (error) {
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
    } catch (error) {
        console.error(error);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        autoHideMenuBar: false,
        show: false,
        backgroundColor: isDarkModeEnabled ? '#181a1b' : '#ffffff',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: 'persist:main-session',
            backgroundThrottling: false,
            autoplayPolicy: 'no-user-gesture-required'
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

    let isMainLoaded = false;

    const showMain = () => {
        if (isMainLoaded) return;
        isMainLoaded = true;
        
        loadingScreen.close();
        mainWindow.show();
        mainWindow.setOpacity(0);
        
        let opacity = 0;
        const fadeIn = setInterval(() => {
            opacity += 0.1; 
            mainWindow.setOpacity(opacity);
            if (opacity >= 1) {
                clearInterval(fadeIn);
            }
        }, 16);

        if (isDarkModeEnabled) {
            applyDarkMode();
        }
    };

    mainWindow.webContents.once('dom-ready', showMain);

    mainWindow.webContents.on('did-navigate', () => {
        if (isDarkModeEnabled) {
            applyDarkMode();
        }
    });

    mainWindow.webContents.on('did-navigate-in-page', () => {
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
    applyDarkMode();
    if (isDarkModeEnabled) {
        startDarkModeMonitoring();
    }
}

function applyDarkMode() {
    if (localDarkReaderScript) {
        mainWindow.webContents.executeJavaScript(localDarkReaderScript)
            .then(() => {
                mainWindow.webContents.executeJavaScript(`
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
                    }
                `);
            })
            .catch(err => console.error(err));
    } else {
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
                }
            })();
        `).catch(err => console.error(err));
    }
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
            `).catch(() => {});
        }
    }, 3000);
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
                 // Try loading if missing
             }
             if (window.isDarkModeEnabled) {
                 if (typeof DarkReader !== 'undefined') DarkReader.disable();
                 window.isDarkModeEnabled = false;
             } else {
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
                 }
                 window.isDarkModeEnabled = true;
             }
             return window.isDarkModeEnabled;
        })();
    `).then(result => {
        isDarkModeEnabled = result;
        if (isDarkModeEnabled && !result) { 
             applyDarkMode(); 
             isDarkModeEnabled = true;
        }
        
        saveConfig();
        createMenu();
        
        if (isDarkModeEnabled) {
            startDarkModeMonitoring();
        } else {
            stopDarkModeMonitoring();
        }
    }).catch(err => {
        console.error(err);
        dialog.showErrorBox('Dark Mode Error', 'Failed to toggle dark mode.');
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
        if (exitScreen) exitScreen.close();
        if (mainWindow) mainWindow.destroy();
        if (tray) tray.destroy();
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
    if (exitScreen) return;
    
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