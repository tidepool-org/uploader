/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2017, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */
import isElectron from 'is-electron';
import { ipcRenderer, ipcMain } from 'electron';
let isRenderer = (process && process.type === 'renderer');

if (isRenderer) {
  let isDebug = process.env.DEBUG_ERROR ||
    JSON.parse(localStorage.getItem('isDebug')) ||
    false;

  const debugMode = module.exports = {
    isDebug,
    setDebug: function(isDebug) {
      ipcRenderer.send('setDebug', isDebug);
      localStorage.setItem('isDebug', JSON.stringify(isDebug));
      debugMode.isDebug = isDebug;
      return debugMode.isDebug;
    }
  };
} else {
  let isDebug = process.env.DEBUG_ERROR || false;

  if (isElectron()) {
    ipcMain.on('setDebug', (event, arg) => {
      debugMode.isDebug = arg;
    });
  }

  const debugMode = module.exports = {
    isDebug,
    setDebug: function(isDebug) {
      debugMode.isDebug = isDebug;
      return debugMode.isDebug;
    }
  };
}
