/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2018, Tidepool Project
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
const isElectron = require('is-electron');
const { ipcRenderer, ipcMain } = require('electron');
let isRenderer = (process && process.type === 'renderer');

const PERIODS = {
  ALL: 1,
  DELTA: 2,
  FOUR_WEEKS: 3,
};

if (isRenderer) {
  let period = JSON.parse(localStorage.getItem('uploadDataPeriod')) ||
    PERIODS.ALL;

  const uploadDataPeriod = module.exports = {
    period,
    PERIODS,
    setPeriod: function(toPeriod) {
      ipcRenderer.send('setUploadDataPeriod', toPeriod);
      localStorage.setItem('uploadDataPeriod', toPeriod);
      uploadDataPeriod.period = toPeriod;
      return uploadDataPeriod.period;
    }
  };
} else {
  let period = PERIODS.ALL;

  if (isElectron()) {
    ipcMain.on('setUploadDataPeriod', (event, arg) => {
      uploadDataPeriod.period = arg;
    });
  }

  const uploadDataPeriod = module.exports = {
    period,
    PERIODS,
    setPeriod: function(toPeriod) {
      uploadDataPeriod.period = toPeriod;
      return uploadDataPeriod.period;
    }
  };
}
