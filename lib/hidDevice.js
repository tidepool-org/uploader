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
var _ = require('lodash');
import {promisify} from 'util';
import common from './commonFunctions';

var debug = require('bows')('HidDevice');

module.exports = function(config) {
  config = config || {};
  var connection = null;
  var webHid = null;
  var packets = [];

  function connect(deviceInfo, probe, cb) {

    if (arguments.length != 3) {
      debug('hid connect called with wrong number of arguments!');
    }

    debug('in HIDDevice.connect, info ', deviceInfo);
    config.deviceInfo = deviceInfo;

    if (deviceInfo.hidDevice) {
      (async () => {
        debug('Connecting using Web HID API');
        webHid = deviceInfo.hidDevice;
        await webHid.open();

        webHid.addEventListener('inputreport', readListener);

      })().then(() => {
          return cb();
        }).catch(async (error) => {
          debug('Error during Web HID API connect:', error);
          // TODO: close connection
          return cb(error, null);
        });
    } else {
      connection = new hid.HID(deviceInfo.vendorId, deviceInfo.productId);

      if (connection) {
        // Set up error listener
        connection.on('error', function(error) {
          debug('Error:', error);
          return cb(error);
        });

        cb();
      } else {
        cb(new Error('Unable to connect to device'));
      }
    }
  }

  function removeListeners() {
    if (webHid) {
      webHid.removeEventListener('inputreport', readListener);
    } else {
      connection.removeAllListeners('error');
    }
  }

  function disconnect(deviceInfo, cb) {
    if (connection === null && webHid === null){
      return cb();
    }else{
      if (webHid) {
        webHid.close();
      } else {
        connection.close();
      }
      console.log('disconnected from HIDDevice');
      cb();
    }
  }

  function readListener(event) {
    const { data, device, reportId } = event;
    packets.push(new Uint8Array(event.data.buffer));
  }

  function receive(cb){
    if (webHid) {

      var abortTimer = setTimeout(function () {
        clearInterval(listenTimer);
        debug('TIMEOUT');
        cb(new Error('Timeout error'), null);
      }, 2000);

      var listenTimer = setInterval(function () {
        if (packets.length > 0) {
          clearTimeout(abortTimer);
          clearInterval(listenTimer);
          cb(null, packets.shift());
        }
      }, 20);
    } else {
      connection.read(function(err, data) {
        if(err) {
          debug('HID Error:', err);
        }
        cb(err, data);
      });
    }
  }

  function receiveTimeout(timeout) {
    return new Promise((resolve, reject) => {
      if (webHid) {
        var abortTimer = setTimeout(function () {
          clearInterval(listenTimer);
          resolve([]);
        }, timeout);

        var listenTimer = setInterval(function () {
          if (packets.length > 0) {
            clearTimeout(abortTimer);
            clearInterval(listenTimer);
            resolve(Array.from(packets.shift()));
          }
        }, 20);
      } else {
        process.nextTick(() => {
          try {
            resolve(connection.readTimeout(timeout));
          } catch (e) {
            // exceptions inside Promise won't be thrown, so we have to
            // reject errors here (e.g. device unplugged during data read)
            reject(e);
          }
        });
      }
    });
  }

  async function send(bytes, callback) {
    var buf = new Uint8Array(bytes);
    if (bytes == null) {
      debug('just tried to send nothing!');
    } else {

      if (webHid) {
        if (config.deviceInfo.driverId === 'CareSens') {
          await webHid.sendReport(buf[0], buf.slice(1));
        } else {
          await webHid.sendReport(0x00, buf);
        }
        return callback();
      }
      var arr = Array.from(buf);
      // The CareSens driver is so far the only one to make use of report IDs,
      // as it implements serial over HID using a CP2110 chip
      if (config.deviceInfo.driverId !== 'CareSens') {
        if (config.deviceInfo.driverId === 'GlucocardShineHID') {
          arr.unshift(1); // Glucocard Shine Connex & Express uses report ID 1
        } else {
          arr.unshift(0); // The first byte of arr must contain the Report ID.
                          // As we only work with a single report, this is set to 0x00.
        }
      }
      try {
        var bytesWritten = connection.write(arr);
      } catch (err) {
        return callback(err, null);
      }
      callback(null, bytesWritten);
    }
  }

  async function sendFeatureReport(bytes) {
    var buf = new Uint8Array(bytes);

    if (webHid) {
      await webHid.sendFeatureReport(buf[0], buf.slice(1));
    } else {
      return new Promise((resolve, reject) => {
        try {
          var arr = Array.from(buf);
          resolve(connection.sendFeatureReport(arr));
        } catch (e) {
          reject(e);
        }
      });
    }
  }

  return {
    connect: connect,
    disconnect: disconnect,
    removeListeners: removeListeners,
    receive: receive,
    receiveTimeout: receiveTimeout,
    sendPromisified: promisify(send),
    send: send,
    sendFeatureReport: sendFeatureReport,
  };

};
