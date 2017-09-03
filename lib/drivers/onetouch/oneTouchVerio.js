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

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('OneTouchVerio') : console.log;

export default function () {
  return {
    /* eslint no-param-reassign:
       [ "error", { "props": true, "ignorePropertyModificationsFor": ["data"] } ] */
    detect(deviceInfo, cb) {
      cb(null, deviceInfo);
    },

    setup(deviceInfo, progress, cb) {
      progress(100);
      cb(null, { deviceInfo });
    },

    connect(progress, data, cb) {
      progress(100);
      return cb(null, data);
    },

    getConfigInfo(progress, data, cb) {
      progress(100);
      return cb(null, data);
    },

    fetchData(progress, data, cb) {
      progress(100);
      return cb(null, data);
    },

    processData(progress, data, cb) {
      progress(100);
      data.processData = true;
      return cb(null, data);
    },

    uploadData(progress, data, cb) {
      progress(100);
      data.cleanup = true;
      return cb(null, data);
    },

    disconnect(progress, data, cb) {
      progress(100);
      cb(null, data);
    },

    cleanup(progress, data, cb) {
      progress(100);
      cb(null, data);
    },
  };
}
