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
var async = require('async');
var usb = require('usb');

if (!(process.env.NODE_ENV === 'test')) {
  // libusb is not available when testing on CI environments

  var UsbCdcAcm = require('usb-cdc-acm');
  var PL2303 = require('pl2303');
  var CP2102 = require('cp2102');
  // var TUSB3410 = require('tusb3410'); TODO: waiting on upstream fix: https://github.com/tessel/node-usb/issues/159
}
import SerialPort from 'serialport';

var debug = require('bows')('SerialDevice');

module.exports = function(config) {
  config = config || {};
  var connection = null;
  var connectionPort = null;
  var buffer = [];
  var packetBuffer = [];
  var packetHandler = null;
  var errorHandler = null;
  var bitrate = config.bitrate || 9600;
  var RETRIES = 8;
  var TIME_TO_WAIT = 2000;

  function init() {
    connection = null;
    connectionPort = null;
    buffer = [];
    packetBuffer = [];
    packetHandler = null;
  }

  init();

  // This is the object that is passed to the packetHandler
  // it lets us abstract away the details of the packetHandling
  var bufobj = {
    // get(x) -- returns char at x
    get : function(n) {return buffer[n]; },
    // len() -- returns length
    len : function() { return buffer.length; },
    // discard(n) -- deletes n chars at start of buffer
    discard : function(n) { discardBytes(n); },
    // bytes() -- returns entire buffer as a Uint8Array
    bytes : function() {
      return new Uint8Array(buffer);
    },
    contains : function(n) {
      return (buffer.indexOf(n) !== -1) ? true : false;
    }
  };

  function _receiveSomeBytes(bufView) {
    for (var i=0; i<bufView.byteLength; i++) {
      buffer.push(bufView[i]);
    }

    // we got some bytes, let's see if they make one or more packets
    if (packetHandler) {
      var pkt = packetHandler(bufobj);
      while (pkt) {
        packetBuffer.push(pkt);
        pkt = packetHandler(bufobj);
      }
    }
  }

  function portListener(data) {
    if (connection && data) {
      var bufView = new Uint8Array(data);
      _receiveSomeBytes(bufView);
    }
  }

  // if an errorHandler was specified, then we call it with every error.
  // If it returns anything, it should return either a string or an array
  // containing the bytes it wants to insert into the buffer.
  function errorListener(info) {
    if (info.error && errorHandler) {
      var bytes = errorHandler(info);
      var bufView = new Uint8Array(bytes.length);
      for (var i=0; i<bytes.length; i++) {
        if (_.isString(bytes)) {
          bufView[i] = bytes.charCodeAt(i);
        } else if (_.isArray(bytes)) {
          bufView[i] = bytes[i];
        }
      }
      _receiveSomeBytes(bufView);
    }
  }

  function connect(deviceInfo, handler, cb) {
    if (arguments.length != 3) {
      console.log('serial connect called with wrong number of arguments!');
    }

    // If the driver specifies a bitrate override, we have to use it
    if (!!deviceInfo.bitrate) {
      bitrate = deviceInfo.bitrate;
    }

    debug('in SerialDevice.connect, info ', deviceInfo);

    var connectopts = {
      baudRate: bitrate
    };

    function openPort(cb) {
      if (deviceInfo.path) {
        debug('Opening port', deviceInfo.path);
        connection = new SerialPort(deviceInfo.path, connectopts, function (err) {
          if (err) {
            debug('Trying again after receiving', err);
            return cb(err, null);
          }
          cb();
        });
      } else {
        debug('Connecting via user space driver');

        switch(deviceInfo.userSpaceDriver) {
          case 'pl2303':
            connection = new PL2303(connectopts);
            connection.on('ready', function () {
              return cb();
            });
            break;
          case 'cdc-acm':
            var device = usb.findByIds( deviceInfo.vendorId, deviceInfo.productId );
            device.open();
            connection = UsbCdcAcm.fromUsbDevice(device, connectopts);
            connection.cdcAcm = device;
            return cb();
            break;
          case 'cp2102':
            connection = new CP2102(deviceInfo.vendorId, deviceInfo.productId, connectopts);
            connection.on('ready', function () {
              return cb();
            });
            break;
            /* TODO: waiting on upstream fix, see top of file for details
          case 'tusb3410':
            connection = new TUSB3410(deviceInfo.vendorId, deviceInfo.productId, connectopts);
            connection.on('ready', function () {
              return cb();
            });
            break;
            */
          default:
            debug('User-space driver not yet implemented for this device.');
            return cb();
        }
      }
    }

    /*
    Due to a possible race condition that can occur in node-serialport (see
    https://github.com/node-serialport/node-serialport/issues/1565), we first
    need to make sure we can open the serial port. Can take multiple attempts.
    */
    async.retry({times: RETRIES, interval: TIME_TO_WAIT}, openPort, function(err) {

      if (err || connection == null) {
        return cb(new Error('Could not connect to the device: ' + err));
      }

      // add a listener for any serial traffic
      connection.on('data', function (data) {
        portListener(data);
      });

      if (_.isFunction(handler)) {
        setPacketHandler(handler);
      } else if (_.isObject(handler)) {
        setPacketHandler(handler.packetHandler);
        if (handler.errorHandler) {
          setErrorHandler(handler.errorHandler);
          connection.on('error', function (err) {
            errorListener(err);
          });
        }
      }

      if (deviceInfo.userSpaceDriver) {
        connection.userSpaceDriver = deviceInfo.userSpaceDriver;
      }

      debug('connected via ' + deviceInfo.path);
      if(deviceInfo.ctsFlowControl) {
        connection.set({ dtr : false, rts : true }, function(err){
          if(err) {
            return cb(err);
          }
          debug('successfully set flow control');
          return cb();
        });
      } else {
        return cb();
      }
    });
  }

  function disconnect(cb) {
    if (connection) {
      if (connection.cdcAcm) {
        connection.destroy();
        connection.cdcAcm.close();
        init();
        return cb();
      }
      connection.close(function(err) {
        init();
        if (cb) {
          cb(err);
        }
      });
    } else {
      if (cb) {
        cb(null);
      }
    }
  }

  // allows changing the bit rate of an existing connection -- it disconnects and
  // reconnects
  function changeBitRate(newrate, cb) {
    if (connection) {
      debug(' change bitrate to ' + newrate + '\n');
      bitrate = newrate;
      connection.update({ baudRate : bitrate });
    } else {
      if (cb) {
        cb(false);
      }
    }
  }

  function discardBytes(discardCount) {
    buffer = buffer.slice(discardCount);
  }

  function readSerial(bytes, timeout, callback) {
    var packet;
    if (buffer.length >= bytes) {
      packet = buffer.slice(0,bytes);
      buffer = buffer.slice(0 - bytes);
      callback(packet);
    } else if (timeout === 0) {
      packet = buffer;
      buffer = [];
      callback(packet);
    } else {
      setTimeout(function() {
        readSerial(bytes, 0, callback);
      }, timeout);
    }
  }

  function writeSerial(bytes, callback) {
    var bufView = new Uint8Array(bytes);

    if (bytes == null) {
      debug('just tried to send nothing!');
    } else {
      if(connection == null) {
        debug('No connection details available.');
        callback(new Error('No connection details available.'));
      } else {
        if (connection.userSpaceDriver === 'pl2303') {
          connection.send(Buffer.from(bytes));
          callback();
        } else {
          connection.write(Buffer.from(bytes), function(err) {
            if(err) {
              return callback(err);
            }
            callback();
          });
        }
      }
    }
  }

  // a handler should be a function that takes a parameter of a buffer
  // and tries to extract a packet from it; if it finds one, it should delete
  // the characters that make up the packet from the buffer, and return the
  // packet.
  function setPacketHandler(handler) {
    packetHandler = handler;
  }

  function clearPacketHandler() {
    packetHandler = null;
  }

  function setErrorHandler(handler) {
    errorHandler = handler;
  }

  function clearErrorHandler() {
    errorHandler = null;
  }

  function hasAvailablePacket() {
    return packetBuffer.length > 0;
  }

  function peekPacket() {
    if (hasAvailablePacket()) {
      return packetBuffer[0];
    } else {
      return null;
    }
  }

  function nextPacket() {
    if (hasAvailablePacket()) {
      return packetBuffer.shift();
    } else {
      return null;
    }
  }

  function flush() {
    debug('flushing buffers..');
    packetBuffer = [];
    buffer = [];
    if(connection) {

      if(process.platform === 'win32') {
        /* Flushing buffers is broken on Windows for now,
           see https://github.com/node-serialport/node-serialport/issues/1409
        */
        debug('but not on Windows for now.');
      } else if (!connection.userSpaceDriver) {
        connection.flush(function() {
          setPaused(false);
        });
      }
    }
  }

  function setBitrate(br) {
    bitrate = br;
  }

  function setPaused(paused) {
    if(connection && !connection.userSpaceDriver) {
      if(paused) {
        connection.pause(function() {});
      } else {
        connection.resume(function() {});
      }
    }
  }

  return {
    setBitrate: setBitrate,
    connect: connect,
    disconnect: disconnect,
    changeBitRate: changeBitRate,
    discardBytes: discardBytes,
    readSerial: readSerial,
    writeSerial: writeSerial,
    setPacketHandler: setPacketHandler,
    clearPacketHandler: clearPacketHandler,
    setErrorHandler: setErrorHandler,
    clearErrorHandler: clearErrorHandler,
    hasAvailablePacket: hasAvailablePacket,
    peekPacket: peekPacket,
    nextPacket: nextPacket,
    flush: flush,
    setPaused: setPaused
  };

};
