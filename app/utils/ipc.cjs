const _ = require('lodash');
const env = require('./env.js');

let ipcRenderer = { send: _.noop, on: _.noop };
let ipcMain = { send: _.noop, on: _.noop };

if (env.electron) {
  let electron = require('electron');
  ipcRenderer = electron.ipcRenderer;
  ipcMain = electron.ipcMain;
}

module.exports = { ipcRenderer, ipcMain };
