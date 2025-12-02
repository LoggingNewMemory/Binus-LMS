const { app, BrowserWindow, session, Menu, Tray, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Optimizations for slow internet
app.commandLine.appendSwitch('max-connections-per-server', '64');
app.commandLine.appendSwitch('max-persistence-network-requests', '64');
app.commandLine.appendSwitch('enable-quic');
app.commandLine.appendSwitch('enable-tcp-fast-open');
app.commandLine.appendSwitch('enable-features', 'ParallelDownloading,NetworkService,NetworkServiceInProcess,VaapiVideoDecoder,CanvasOopRasterization');
app.commandLine.appendSwitch('disk-cache-size', '2147483648');
app.commandLine.appendSwitch('disable-http-cache', 'false');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

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

app.on('web-contents-created', (event, contents) => {
    if (contents.getType() === 'window') {
        
        contents.on('did-navigate', () => {
            if (isDarkModeEnabled) applyDarkMode(contents);
        });

        contents.on('did-navigate-in-page', () => {
            if (isDarkModeEnabled) applyDarkMode(contents);
        });
        
        contents.on('dom-ready', () => {
            if (isDarkModeEnabled) applyDarkMode(contents);
        });
    }
});

function setupAggressiveCaching() {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = Object.assign({}, details.responseHeaders);
        
        if (details.resourceType === 'image' || 
            details.resourceType === 'stylesheet' || 
            details.resourceType === 'script' || 
            details.resourceType === 'font') {
            
            responseHeaders['cache-control'] = ['public, max-age=2592000'];
            delete responseHeaders['expires'];
            delete responseHeaders['pragma'];
        }

        callback({ responseHeaders });
    });
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
            autoplayPolicy: 'no-user-gesture-required',
            devTools: true
        },
        icon: path.join(__dirname, 'logo/LmsLogo.png')
    });

    createMenu();
    setupAggressiveCaching();

    const loadingScreen = new BrowserWindow({
        width: 500,
        height: 400,
        frame: false,
        alwaysOnTop: false,
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
            applyDarkMode(mainWindow.webContents);
        }
    };

    mainWindow.webContents.once('dom-ready', showMain);

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
        // "Account" menu removed
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
                // "Minimize" removed
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
    if (isDarkModeEnabled) {
        startDarkModeMonitoring();
    }
}

function applyDarkMode(targetContents) {
    if (!targetContents || targetContents.isDestroyed()) return;

    const url = targetContents.getURL();
    if (url.includes('loading.html') || url.includes('exit.html')) return;

    if (localDarkReaderScript) {
        targetContents.executeJavaScript(localDarkReaderScript)
            .then(() => {
                targetContents.executeJavaScript(`
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
        targetContents.executeJavaScript(`
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

function disableDarkModeFor(targetContents) {
    if (!targetContents || targetContents.isDestroyed()) return;
    
    targetContents.executeJavaScript(`
        if (typeof DarkReader !== 'undefined') {
            DarkReader.disable();
            window.isDarkModeEnabled = false;
        }
    `).catch(() => {});
}

function startDarkModeMonitoring() {
    if (darkModeCheckInterval) {
        clearInterval(darkModeCheckInterval);
    }
    
    darkModeCheckInterval = setInterval(() => {
        BrowserWindow.getAllWindows().forEach(win => {
            if (isDarkModeEnabled && win && !win.isDestroyed()) {
                 const url = win.webContents.getURL();
                 if (url.includes('loading.html') || url.includes('exit.html')) return;

                win.webContents.executeJavaScript(`
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
        });
    }, 5000);
}

function stopDarkModeMonitoring() {
    if (darkModeCheckInterval) {
        clearInterval(darkModeCheckInterval);
        darkModeCheckInterval = null;
    }
}

function toggleDarkMode() {
    isDarkModeEnabled = !isDarkModeEnabled;
    saveConfig();
    createMenu();
    
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
        if (isDarkModeEnabled) {
            applyDarkMode(win.webContents);
        } else {
            disableDarkModeFor(win.webContents);
        }
    });
    
    if (isDarkModeEnabled) {
        startDarkModeMonitoring();
    } else {
        stopDarkModeMonitoring();
    }
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

function showExitAnimation() {
    mainWindow.hide();
    stopDarkModeMonitoring();
    
    exitScreen = new BrowserWindow({
        width: 500,
        height: 400,
        frame: false,
        alwaysOnTop: false,
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