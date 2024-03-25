import _ from 'lodash';
import env from './env';

let ipcRenderer = { send: _.noop, on: _.noop };
let ipcMain = { send: _.noop, on: _.noop };

if (env.electron) {
  let electron = require('electron');
  ipcRenderer = electron.ipcRenderer;
  ipcMain = electron.ipcMain;
}

export { ipcRenderer, ipcMain };
