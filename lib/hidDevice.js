/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
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

/* eslint-disable no-param-reassign, no-use-before-define */

import { promisify } from 'util';

const debug = require('bows')('HidDevice');

module.exports = (config) => {
  // eslint-disable-next-line no-param-reassign
  config = config || {};
  let webHid = null;
  const packets = [];

  function readListener(event) {
    packets.push(new Uint8Array(event.data.buffer));
    webHid.dispatchEvent(new Event('data'));
  }

  function connect(deviceInfo, probe, cb) {
    if (arguments.length !== 3) {
      debug('hid connect called with wrong number of arguments!');
    }

    debug('in HIDDevice.connect, info ', deviceInfo);
    config.deviceInfo = deviceInfo;

    (async () => {
      debug('Connecting using Web HID API');
      webHid = deviceInfo.hidDevice;
      await webHid.open();
      webHid.addEventListener('inputreport', readListener);
    })().then(() => cb()).catch(async (error) => {
      debug('Error during Web HID API connect:', error);
      return cb(error, null);
    });
  }

  function removeListeners() {
    webHid.removeEventListener('inputreport', readListener);
  }

  function disconnect(deviceInfo, cb) {
    if (webHid == null) {
      cb();
    } else {
      webHid.close();
      debug('disconnected from HIDDevice');
      cb();
    }
  }

  async function receive(cb) {
    if (packets.length > 0) {
      return cb(null, packets.shift());
    }

    const response = new Promise((resolve) => {
      webHid.addEventListener('data', () => {
        if (packets.length === 0) {
          return resolve([]);
        } else {
          return resolve(packets.shift());
        }
      }, { once: true });
    });

    // no packet yet, let's wait
    return cb(null, await response);
  }

  async function receiveTimeout(timeout) {
    if (packets.length > 0) {
      return Array.from(packets.shift());
    }

    const response = new Promise((resolve) => {
      const getData = () => {
        clearTimeout(abortTimer);
        if (packets.length === 0) {
          return resolve([]);
        } else {
          return resolve(Array.from(packets.shift()));
        }
      };

      const abortTimer = setTimeout(() => {
        webHid.removeEventListener('data', getData);
        return resolve([]);
      }, timeout);

      webHid.addEventListener('data', getData, { once: true });
    });

    // no packet yet, let's wait
    return await response;
  }

  async function send(bytes, callback) {
    const buf = new Uint8Array(bytes);
    if (bytes == null) {
      debug('just tried to send nothing!');
    } else {
        try {
          // The CareSens driver is so far the only one to make use of report IDs,
          // as it implements serial over HID using a CP2110 chip
          if (config.deviceInfo.driverId === 'CareSens') {
            await webHid.sendReport(buf[0], buf.slice(1));
          } else if (config.deviceInfo.driverId === 'GlucocardShineHID') {
            // Glucocard Shine Connex & Express uses report ID 1
            await webHid.sendReport(0x01, buf);
          } else {
            await webHid.sendReport(0x00, buf);
          }
          callback();
        } catch (err) {
          debug('Error:', err);
          callback(err);
        }
    }
  }

  async function sendFeatureReport(bytes) {
    const buf = new Uint8Array(bytes);

    await webHid.sendFeatureReport(buf[0], buf.slice(1));
  }

  return {
    connect,
    disconnect,
    removeListeners,
    receive,
    receiveTimeout,
    sendPromisified: promisify(send),
    send,
    sendFeatureReport,
  };
};
