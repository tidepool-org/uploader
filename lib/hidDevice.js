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
import * as hid from 'node-hid';
import {promisify} from 'util';
import common from './commonFunctions';

var debug = require('bows')('HidDevice');

module.exports = function(config) {
  config = config || {};
  var connection = null;

  function connect(deviceInfo, probe, cb) {

    if (arguments.length != 3) {
      debug('hid connect called with wrong number of arguments!');
    }

    debug('in HIDDevice.connect, info ', deviceInfo);
    config.deviceInfo = deviceInfo;

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

  function removeListeners() {
    connection.removeAllListeners('error');
  }

  function disconnect(deviceInfo, cb) {
    if (connection === null){
      return cb();
    }else{
      connection.close();
      console.log('disconnected from HIDDevice');
      cb();
    }
  }

  function receive(cb){
    connection.read(function(err, data) {
      if(err) {
        debug('HID Error:', err);
      }
      cb(err, data);
    });
  }

  function receiveTimeout(timeout) {
    return new Promise((resolve, reject) => {
      process.nextTick(() => {
        try {
          resolve(connection.readTimeout(timeout));
        } catch (e) {
          // exceptions inside Promise won't be thrown, so we have to
          // reject errors here (e.g. device unplugged during data read)
          reject(e);
        }
      });
    });
  }

  function send(bytes, callback) {
    var buf = new Uint8Array(bytes);
    if (bytes == null) {
      debug('just tried to send nothing!');
    } else {
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

  function sendFeatureReport(bytes) {
    var buf = new Uint8Array(bytes);
    var arr = Array.from(buf);
    return connection.sendFeatureReport(arr);
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
