/* global __ROLLBAR_POST_TOKEN__ */
import { app, BrowserWindow, Menu, shell, ipcMain, crashReporter } from 'electron';
import os from 'os';
import open from 'open';
import { autoUpdater } from 'electron-updater';
import * as chromeFinder from 'chrome-launcher/chrome-finder';
import { sync as syncActions } from './actions';
import debugMode from '../app/utils/debugMode';
import Rollbar from 'rollbar/src/server/rollbar';

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

console.log('Crash logs can be found in:',crashReporter.getCrashesDirectory());
console.log('Last crash report:', crashReporter.getLastCrashReport());

let menu;
let template;
let mainWindow = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support'); // eslint-disable-line
  sourceMapSupport.install();
}

if (process.env.NODE_ENV === 'development') {
  require('electron-debug')(); // eslint-disable-line global-require
  const path = require('path'); // eslint-disable-line
  const p = path.join(__dirname, '..', 'app', 'node_modules'); // eslint-disable-line
  require('module').globalPaths.push(p); // eslint-disable-line
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const installExtensions = async () => {
  if (process.env.NODE_ENV === 'development') {
    const installer = require('electron-devtools-installer'); // eslint-disable-line global-require

    const extensions = [
      'REACT_DEVELOPER_TOOLS',
      'REDUX_DEVTOOLS'
    ];

    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;

    // TODO: Use async interation statement.
    //       Waiting on https://github.com/tc39/proposal-async-iteration
    //       Promises will fail silently, which isn't what we want in development
    return Promise
      .all(extensions.map(name => installer.default(installer[name], forceDownload)))
      .catch(console.log);
  }
};

app.on('ready', async () => {
  await installExtensions();
  const resizable = (process.env.NODE_ENV === 'development');

  mainWindow = new BrowserWindow({
    show: false,
    width: 663,
    height: 769,
    resizable: resizable
  });

  mainWindow.loadURL(`file://${__dirname}/app.html`);

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    mainWindow.focus();
    checkUpdates();
  });

  mainWindow.webContents.on('new-window', function(event, url){
    event.preventDefault();
    let platform = os.platform();
    // TODO: remove this hack once GoogleChrome/chrome-launcher#20 is resolved
    if(platform === 'win32' && !process.env['PROGRAMFILES(X86)']){
      process.env['PROGRAMFILES(X86)'] = process.env.PROGRAMFILES;
    }
    let chromeInstalls = chromeFinder[platform]();
    if(chromeInstalls.length === 0){
      // no chrome installs found, open user's default browser
      open(url);
    } else {
      open(url, chromeInstalls[0], function(error){
        if(error){
          // couldn't open chrome, try OS default
          open(url);
        }
      });
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
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
      label: 'Tidepool Uploader',
      submenu: [{
        label: 'About Tidepool Uploader',
        selector: 'orderFrontStandardAboutPanel:'
      }, {
        label: 'Check for Updates',
        click() {
          manualCheck = true;
          autoUpdater.checkForUpdates();
        }
      }, {
        type: 'separator'
      }, {
        label: 'Hide Tidepool Uploader',
        accelerator: 'Command+H',
        selector: 'hide:'
      }, {
        label: 'Hide Others',
        accelerator: 'Command+Shift+H',
        selector: 'hideOtherApplications:'
      }, {
        label: 'Show All',
        selector: 'unhideAllApplications:'
      }, {
        type: 'separator'
      }, {
        label: 'Quit',
        accelerator: 'Command+Q',
        click() {
          app.quit();
        }
      }]
    }, {
      label: 'Edit',
      submenu: [{
        label: 'Undo',
        accelerator: 'Command+Z',
        selector: 'undo:'
      }, {
        label: 'Redo',
        accelerator: 'Shift+Command+Z',
        selector: 'redo:'
      }, {
        type: 'separator'
      }, {
        label: 'Cut',
        accelerator: 'Command+X',
        selector: 'cut:'
      }, {
        label: 'Copy',
        accelerator: 'Command+C',
        selector: 'copy:'
      }, {
        label: 'Paste',
        accelerator: 'Command+V',
        selector: 'paste:'
      }, {
        label: 'Select All',
        accelerator: 'Command+A',
        selector: 'selectAll:'
      }]
    }, {
      label: 'View',
      submenu: (process.env.NODE_ENV === 'development') ?
      [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click() {
            mainWindow.webContents.reload();
          }
        }, {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click() {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        }, {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click() {
            mainWindow.toggleDevTools();
          }
        }
      ] : [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click() {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        }, {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click() {
            mainWindow.toggleDevTools();
          }
        }
      ]
    }, {
      label: 'Window',
      submenu: [{
        label: 'Minimize',
        accelerator: 'Command+M',
        selector: 'performMiniaturize:'
      }, {
        label: 'Close',
        accelerator: 'Command+W',
        selector: 'performClose:'
      }, {
        type: 'separator'
      }, {
        label: 'Bring All to Front',
        selector: 'arrangeInFront:'
      }]
    }, {
      label: 'Help',
      submenu: [{
        label: 'Get Support',
        click() {
          shell.openExternal('http://support.tidepool.org/');
        }
      }, {
        label: 'Privacy Policy',
        click() {
          shell.openExternal('https://tidepool.org/legal/privacy-policy-2-0');
        }
      }, {
        label: 'Report an issue...',
        click() {
          shell.openExternal('https://github.com/tidepool-org/chrome-uploader/issues');
        }
      }]
    }];

    menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } else {
    template = [{
      label: '&File',
      submenu: [{
        label: '&Open',
        accelerator: 'Ctrl+O'
      }, {
        label: '&Close',
        accelerator: 'Ctrl+W',
        click() {
          mainWindow.close();
        }
      }]
    }, {
      label: '&View',
      submenu: (process.env.NODE_ENV === 'development') ? [{
        label: '&Reload',
        accelerator: 'Ctrl+R',
        click() {
          mainWindow.webContents.reload();
        }
      }, {
        label: 'Toggle &Full Screen',
        accelerator: 'F11',
        click() {
          mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
      }, {
        label: 'Toggle &Developer Tools',
        accelerator: 'Alt+Ctrl+I',
        click() {
          mainWindow.toggleDevTools();
        }
      }] : [{
        label: 'Toggle &Full Screen',
        accelerator: 'F11',
        click() {
          mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
      }, {
        label: 'Toggle &Developer Tools',
        accelerator: 'Alt+Ctrl+I',
        click() {
          mainWindow.toggleDevTools();
        }
      }]
    }, {
      label: 'Help',
      submenu: [{
        label: 'Get Support',
        click() {
          shell.openExternal('http://support.tidepool.org/');
        }
      }, {
        label: 'Check for Updates',
        click() {
          manualCheck = true;
          autoUpdater.checkForUpdates();
        }
      }, {
        label: 'Privacy Policy',
        click() {
          shell.openExternal('https://tidepool.org/legal/privacy-policy-2-0');
        }
      }, {
        label: 'Report an issue...',
        click() {
          shell.openExternal('https://github.com/tidepool-org/chrome-uploader/issues');
        }
      }]
    }];
    menu = Menu.buildFromTemplate(template);
    mainWindow.setMenu(menu);
  }
});

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
    "url":"https://github.com/tidepool-org/chrome-uploader/releases/download/v0.310.0-alpha/tidepool-uploader-dev-0.310.0-alpha-mac.zip",
    "releaseJsonUrl":"https://github.com//tidepool-org/chrome-uploader/releases/download/v0.310.0-alpha/latest-mac.json"
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
