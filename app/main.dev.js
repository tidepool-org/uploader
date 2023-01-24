/* global __ROLLBAR_POST_TOKEN__ */
import _ from 'lodash';
import { app, BrowserWindow, Menu, shell, ipcMain, crashReporter, dialog, session, protocol } from 'electron';
import os from 'os';
import osName from 'os-name';
import open from 'open';
import { autoUpdater } from 'electron-updater';
import * as chromeFinder from 'chrome-launcher/dist/chrome-finder';
import { sync as syncActions } from './actions';
import debugMode from '../app/utils/debugMode';
import Rollbar from 'rollbar/src/server/rollbar';
import uploadDataPeriod from './utils/uploadDataPeriod';
import i18n from 'i18next';
import i18nextBackend from 'i18next-fs-backend';
import i18nextOptions from './utils/config.i18next';
import path from 'path';

global.i18n = i18n;

autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';
const remoteMain = require('@electron/remote/main');
remoteMain.initialize();

let rollbar;
if(process.env.NODE_ENV === 'production') {
  rollbar = new Rollbar({
    accessToken: __ROLLBAR_POST_TOKEN__,
    captureUncaught: true,
    captureUnhandledRejections: true,
    payload: {
        environment: 'electron_main_process'
    }
  });
}

crashReporter.start({
  productName: 'Uploader',
  companyName: 'Tidepool',
  submitURL: '',
  uploadToServer: false
});

console.log('Crash logs can be found in:', app.getPath('crashDumps'));
console.log('Last crash report:', crashReporter.getLastCrashReport());

const PROTOCOL_PREFIX = 'tidepooluploader';
const baseURL = `file://${__dirname}/app.html`;

let menu;
let template;
let mainWindow = null;

// Web Bluetooth should only be an experimental feature on Linux
app.commandLine.appendSwitch('enable-experimental-web-platform-features', true);

// SharedArrayBuffer (used by lzo-wasm) requires cross-origin isolation
// in Chrome 92+, but we can't do this for our Electron setup,
// so we have to enable it manually
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support'); // eslint-disable-line
  sourceMapSupport.install();
}

if (process.env.NODE_ENV === 'development') {
  require('electron-debug')(); // eslint-disable-line global-require
  const p = path.join(__dirname, '..', 'app', 'node_modules'); // eslint-disable-line
  require('module').globalPaths.push(p); // eslint-disable-line
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const installExtensions = async () => {
  if (process.env.NODE_ENV === 'development') {
    const { default: installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } = require('electron-devtools-installer');
    const options = {
      loadExtensionOptions: { allowFileAccess: true },
    };

    try {
      const name = await installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS], options);
      console.log(`Added Extension:  ${name}`);
    } catch (err) {
      console.log('An error occurred: ', err);
    }
  }
};

function addDataPeriodGlobalListener(menu) {
  ipcMain.on('setUploadDataPeriodGlobal', (event, arg) => {
    const item = _.find(menu.items, ['id', 'upload']);
    if (arg === uploadDataPeriod.PERIODS.ALL) {
      console.log('Uploading all data');
      item.submenu.items[0].checked = true;
    } else if (arg === uploadDataPeriod.PERIODS.DELTA) {
      console.log('Uploading only new records');
      item.submenu.items[1].checked = true;
    }
  });
};

const openExternalUrl = (url) => {
  let platform = os.platform();
  let chromeInstalls = chromeFinder[platform]();
  if(chromeInstalls.length === 0){
    // no chrome installs found, open user's default browser
    open(url);
  } else {
    open(url, {app: chromeInstalls[0]}, function(error){
      if(error){
        // couldn't open chrome, try OS default
        open(url);
      }
    });
  }
  return { action: 'deny' };
};

app.on('ready', async () => {
  await installExtensions();
  setLanguage();
});

function createWindow() {
  const resizable = (process.env.NODE_ENV === 'development');
  mainWindow = new BrowserWindow({
    show: false,
    width: 663,
    height: 769,
    resizable: resizable,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // so that we can access process from app.html
    }
  });

  protocol.registerHttpProtocol(PROTOCOL_PREFIX, (request, cb) => {
    const requestURL = new URL(request.url);
    if (requestURL.pathname.includes('keycloak-redirect')) {
      const requestHash = requestURL.hash;
      const { webContents } = mainWindow;
      // redirecting from the app html to app html with hash breaks devtools
      // just send and append the hash if we're already in the app html
      if (
        webContents.getURL().includes(baseURL) ||
        webContents.getURL().startsWith('tidepooluploader')
      ) {
        webContents.send('newHash', requestHash);
      } else {
        webContents.loadURL(`${baseURL}${requestHash}`);
      }
      return;
    }
  });

  remoteMain.enable(mainWindow.webContents);
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    console.log('Render process gone:', details.reason);
  });

  mainWindow.loadURL(baseURL);

  const { session: { webRequest } } = mainWindow.webContents;

  let keycloakRegistrationUrl = '';
  let keycloakUrl = '';
  let keycloakRealm = '';

  ipcMain.on('keycloakRegistrationUrl', (event, url) => {
    keycloakRegistrationUrl = url;
  });

  ipcMain.on('keycloakInfo', (event, info) => {
    keycloakUrl = info.url;
    keycloakRealm = info.realm;
    setRequestFilter();
  });

  let setRequestFilter = () => {
    let urls = ['http://localhost/keycloak-redirect*'];
    if (keycloakUrl && keycloakRealm) {
      urls.push(
        `${keycloakUrl}/realms/${keycloakRealm}/login-actions/registration*`
      );
    }
    webRequest.onBeforeRequest({ urls }, async (request, cb) => {
      const requestURL = new URL(request.url);

      // capture keycloak sign-in redirect
      if (requestURL.pathname.includes('keycloak-redirect')) {
        const requestHash = requestURL.hash;
        const { webContents } = mainWindow;
        // redirecting from the app html to app html with hash breaks devtools
        // just send and append the hash if we're already in the app html
        if (webContents.getURL().includes(baseURL)) {
          webContents.send('newHash', requestHash);
        } else {
          webContents.loadURL(`${baseURL}${requestHash}`);
        }
        return;
      }
      // capture keycloak registration navigation
      if (
        requestURL.href.includes(
          `${keycloakUrl}/realms/${keycloakRealm}/login-actions/registration`
        )
      ) {
        openExternalUrl(keycloakRegistrationUrl);
        return;
      }

      cb({ cancel: false });
    });
  };

  setRequestFilter();

  mainWindow.webContents.on('did-finish-load', async () => {
    if (osName() === 'Windows 7') {
      const options = {
        type: 'info',
        title: 'Please update to a modern operating system',
        message:
          `Windows 7 won't be patched for any new viruses or security problems
going forward.

While Windows 7 will continue to work, Microsoft recommends you
start planning to upgrade to Windows 10, or an alternative
operating system, as soon as possible.`,
        buttons: ['Continue']
      };
      await dialog.showMessageBox(options);
    }

    mainWindow.show();
    mainWindow.focus();
    checkUpdates();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    return openExternalUrl(details.url);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    console.log('Device list:', deviceList);
    let [result] = deviceList;
    global.bluetoothDeviceId = result.deviceId;
    if (!result) {
      callback('');
    } else {
      callback(result.deviceId);
    }
  });

  mainWindow.webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    console.log('Port list:', portList);
    const [selectedPort] = portList;
    if (!selectedPort) {
      callback('');
    } else {
      callback(selectedPort.portId);
    }
  });

  mainWindow.webContents.session.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    console.log('Device list:', details.deviceList);
    if (details.deviceList && details.deviceList.length > 0) {
      callback(details.deviceList[0].deviceId);
    } else {
      callback('');
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.openDevTools();
    mainWindow.webContents.on('context-menu', (e, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([{
        label: 'Inspect element',
        click() {
          mainWindow.inspectElement(x, y);
        }
      }]).popup(mainWindow);
    });
  }

  if (process.platform === 'darwin') {
    template = [{
      label: i18n.t('Tidepool Uploader'),
      submenu: [{
        label: i18n.t('About Tidepool Uploader'),
        selector: 'orderFrontStandardAboutPanel:'
      }, {
        label: i18n.t('Check for Updates'),
        click() {
          manualCheck = true;
          autoUpdater.checkForUpdates();
        }
      }, {
        type: 'separator'
      }, {
        label: i18n.t('Hide Tidepool Uploader'),
        accelerator: 'Command+H',
        selector: 'hide:'
      }, {
        label: i18n.t('Hide Others'),
        accelerator: 'Command+Shift+H',
        selector: 'hideOtherApplications:'
      }, {
        label: i18n.t('Show All'),
        selector: 'unhideAllApplications:'
      }, {
        type: 'separator'
      }, {
        label: i18n.t('Quit'),
        accelerator: 'Command+Q',
        click() {
          app.quit();
        }
      }]
    }, {
      label: i18n.t('Edit'),
      submenu: [{
        label: i18n.t('Undo'),
        accelerator: 'Command+Z',
        selector: 'undo:'
      }, {
        label: i18n.t('Redo'),
        accelerator: 'Shift+Command+Z',
        selector: 'redo:'
      }, {
        type: 'separator'
      }, {
        label: i18n.t('Cut'),
        accelerator: 'Command+X',
        selector: 'cut:'
      }, {
        label: i18n.t('Copy'),
        accelerator: 'Command+C',
        selector: 'copy:'
      }, {
        label: i18n.t('Paste'),
        accelerator: 'Command+V',
        selector: 'paste:'
      }, {
        label: i18n.t('Select All'),
        accelerator: 'Command+A',
        selector: 'selectAll:'
      }]
    }, {
      label: i18n.t('View'),
      submenu: (process.env.NODE_ENV === 'development') ?
      [
        {
          label: i18n.t('Reload'),
          accelerator: 'Command+R',
          click() {
            mainWindow.webContents.reload();
          }
        }, {
          label: i18n.t('Toggle Full Screen'),
          accelerator: 'Ctrl+Command+F',
          click() {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        }, {
          label: i18n.t('Toggle Developer Tools'),
          accelerator: 'Alt+Command+I',
          click() {
            mainWindow.toggleDevTools();
          }
        }
      ] : [
        {
          label: i18n.t('Toggle Full Screen'),
          accelerator: 'Ctrl+Command+F',
          click() {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        }, {
          label: i18n.t('Toggle Developer Tools'),
          accelerator: 'Alt+Command+I',
          click() {
            mainWindow.toggleDevTools();
          }
        }
      ]
    }, {
      label: i18n.t('&Upload'),
      id: 'upload',
      submenu: [{
        label: i18n.t('All data'),
        type: 'radio',
        click() {
          console.log('Uploading all data');
          uploadDataPeriod.setPeriodGlobal(
            uploadDataPeriod.PERIODS.ALL, mainWindow);
        }
      }, {
        label: i18n.t('Data since last upload'),
        type: 'radio',
        click() {
          console.log('Uploading only new records');
          uploadDataPeriod.setPeriodGlobal(
            uploadDataPeriod.PERIODS.DELTA, mainWindow);
        }
      }]
    }, {
      label: i18n.t('Window'),
      submenu: [{
        label: i18n.t('Minimize'),
        accelerator: 'Command+M',
        selector: 'performMiniaturize:'
      }, {
        label: i18n.t('Close'),
        accelerator: 'Command+W',
        selector: 'performClose:'
      }, {
        type: 'separator'
      }, {
        label: i18n.t('Bring All to Front'),
        selector: 'arrangeInFront:'
      }]
    }, {
      label: i18n.t('Help'),
      submenu: [{
        label: i18n.t('Get Support'),
        click() {
          shell.openExternal('http://support.tidepool.org/');
        }
      }, {
        label: i18n.t('Privacy Policy'),
        click() {
          shell.openExternal('https://developer.tidepool.org/privacy-policy/');
        }
      }]
    }];

    menu = Menu.buildFromTemplate(template);
    addDataPeriodGlobalListener(menu);
    Menu.setApplicationMenu(menu);
  } else {
    template = [{
      label: i18n.t('&File'),
      submenu: [{
        label: i18n.t('&Open'),
        accelerator: 'Ctrl+O'
      }, {
        label:  i18n.t('&Close'),
        accelerator: 'Ctrl+W',
        click() {
          mainWindow.close();
        }
      }]
    }, {
      label: i18n.t('&View'),
      submenu: (process.env.NODE_ENV === 'development') ? [{
        label: i18n.t('&Reload'),
        accelerator: 'Ctrl+R',
        click() {
          mainWindow.webContents.reload();
        }
      }, {
        label: i18n.t('Toggle &Full Screen'),
        accelerator: 'F11',
        click() {
          mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
      }, {
        label: i18n.t('Toggle &Developer Tools'),
        accelerator: 'Alt+Ctrl+I',
        click() {
          mainWindow.toggleDevTools();
        }
      }] : [{
        label: i18n.t('Toggle &Full Screen'),
        accelerator: 'F11',
        click() {
          mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
      }, {
        label: i18n.t('Toggle &Developer Tools'),
        accelerator: 'Alt+Ctrl+I',
        click() {
          mainWindow.toggleDevTools();
        }
      }]
    }, {
      label: i18n.t('&Upload'),
      id: 'upload',
      submenu: [{
        label: i18n.t('All data'),
        type: 'radio',
        click() {
          console.log('Uploading all data');
          uploadDataPeriod.setPeriodGlobal(
            uploadDataPeriod.PERIODS.ALL, mainWindow);
        }
      }, {
        label: i18n.t('Data since last upload'),
        type: 'radio',
        click() {
          console.log('Uploading only new records');
          uploadDataPeriod.setPeriodGlobal(
            uploadDataPeriod.PERIODS.DELTA, mainWindow);
        }
      }]
    }, {
      label: i18n.t('Help'),
      submenu: [{
        label: i18n.t('Get Support'),
        click() {
          shell.openExternal('http://support.tidepool.org/');
        }
      }, {
        label: i18n.t('Check for Updates'),
        click() {
          manualCheck = true;
          autoUpdater.checkForUpdates();
        }
      }, {
        label: i18n.t('Privacy Policy'),
        click() {
          shell.openExternal('https://developer.tidepool.org/privacy-policy/');
        }
      }]
    }];
    menu = Menu.buildFromTemplate(template);
    addDataPeriodGlobalListener(menu);
    mainWindow.setMenu(menu);
  }
}

function checkUpdates(){
  // in production NODE_ENV we check for updates, but not if NODE_ENV is 'development'
  // this prevents a Webpack build error that masks other build errors during local development
  if (process.env.NODE_ENV === 'production') {
    autoUpdater.checkForUpdates();
  }
}

setInterval(checkUpdates, 1000 * 60 * 60 * 24);

let manualCheck = false;

function sendAction(action) {
  mainWindow.webContents.send('action', action);
}

autoUpdater.on('checking-for-update', () => {
  if(manualCheck) {
    manualCheck = false;
    sendAction(syncActions.manualCheckingForUpdates());
  } else {
    sendAction(syncActions.autoCheckingForUpdates());
  }
});

autoUpdater.on('update-available', (ev, info) => {
  sendAction(syncActions.updateAvailable(info));
  /*
  Example `info`
  {
    "version":"0.310.0-alpha",
    "releaseDate":"2017-04-03T22:29:55.809Z",
    "url":"https://github.com/tidepool-org/uploader/releases/download/v0.310.0-alpha/tidepool-uploader-dev-0.310.0-alpha-mac.zip",
    "releaseJsonUrl":"https://github.com//tidepool-org/uploader/releases/download/v0.310.0-alpha/latest-mac.json"
  }
   */
});

autoUpdater.on('update-not-available', (ev, info) => {
  sendAction(syncActions.updateNotAvailable(info));
});

autoUpdater.on('error', (ev, err) => {
  sendAction(syncActions.autoUpdateError(err));
});

autoUpdater.on('update-downloaded', (ev, info) => {
  sendAction(syncActions.updateDownloaded(info));
});

ipcMain.on('autoUpdater', (event, arg) => {
  if(arg === 'checkForUpdates') {
    manualCheck = true;
  }
  autoUpdater[arg]();
});

if(!app.isDefaultProtocolClient('tidepoolupload')){
  app.setAsDefaultProtocolClient('tidepoolupload');
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  // for mac because, normally it's not common to recreate a window in the app
  if (mainWindow === null) {
    createWindow();
  }
});

function setLanguage() {
  if (process.env.I18N_ENABLED === 'true') {
    let lng = app.getLocale();
    // remove country in language locale
    if (_.includes(lng,'-'))
      lng = (_.split(lng,'-').length > 0) ? _.split(lng,'-')[0] : lng;

    i18nextOptions['lng'] = lng;
  }

  if (!i18n.Initialize) {
    i18n.use(i18nextBackend).init(i18nextOptions, function(err, t) {
      if (err) {
        console.log('An error occurred in i18next:', err);
      }

      global.i18n = i18n;
      createWindow();
    });
  }
}
