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
var localStore = require('./core/localStore');
var SerialPort = require('serialport');

// for tests
if (typeof localStore === 'function') {
  localStore = localStore({});
}

var DEVICEPORTS = 'devicePorts';

var debug = require('./bows')('SerialDevice');

var moduleCounter = 1;

var SEND_ERRORS = {
  'disconnected' : 'Disconnected. Reconnect the device.',
  'pending' : 'Serial send is still pending.',
  'timeout' : 'The serial send timed out.',
  'system_error' : 'A system error occurred. Reconnect the device.'
};

module.exports = function(config) {
  config = config || {};
  var connection = null;
  var connectionPort = null;
  var buffer = [];
  var packetBuffer = [];
  var packetHandler = null;
  var errorHandler = null;
  var moduleNumber = moduleCounter++;
  var bitrate = config.bitrate || 9600;
  var log = '';
  var logcount = 0;
  var loglimit = 400;
  var doLogging = (config && config.doLogging) || false;

  if (config.silent) {
    // debug = _.noop;
  }

  function init() {
    connection = null;
    connectionPort = null;
    buffer = [];
    packetBuffer = [];
    packetHandler = null;
    log = '';
    localStore.init(DEVICEPORTS, function() {});
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
  // According to chrome's docs, info will contain connectionId, and an
  // error member that can be any of "disconnected", "timeout", "device_lost", or "system_error"
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

  function do_probe(probe,done,port) {
    probe(function(err) {
      if (!err) {
        return done(port); // we found a port so abort the eachSerial
      } else {
        // it didn't work so disconnect
        port.close(function() {});  // don't care what the result is
        return done();
      }
    });
  }

  function connect(deviceInfo, handler, probe, cb) {
    if (arguments.length != 4) {
      console.log('serial connect called with wrong number of arguments!');
    }

    // If the driver specifies a bitrate override, we have to use it
    if (!!deviceInfo.bitrate) {
      bitrate = deviceInfo.bitrate;
    }

    debug('in SerialDevice.connect, info ', deviceInfo);

    SerialPort.list(function (err, ports) {

      // filter the list of ports if we can, using the path if we have one
      if (deviceInfo.path) {
        ports = _.filter(ports, function(p) {
          return p.comName.match(deviceInfo.path);
        });
      }

      // now sort that list based on index within the list of successful ports
      // we've used for this device
      var storedPorts = localStore.getItem(DEVICEPORTS);
      var allports = {};
      if (!_.isEmpty(storedPorts)) {
        allports = JSON.parse(storedPorts);
      }
      var successfulPorts = [];
      if (allports) {
        successfulPorts = allports[deviceInfo.driverId];
      }
      ports = _.sortBy(ports, function(port) {
        var i = _.indexOf(successfulPorts, port.comName);
        if (i < 0) {
          return 1000;
        } else {
          return i;
        }
      });

      // now walk all the matching serial ports and try each one
      // debug(ports);

      async.eachSeries(ports, function(port, done) {
        debug('now trying port ', port);
        var connectopts = {
          bitrate: bitrate,
          name: port.comName,
          sendTimeout: deviceInfo.sendTimeout || 1000,
          receiveTimeout: deviceInfo.receiveTimeout || 1000,
          ctsFlowControl: deviceInfo.ctsFlowControl || false
        };

        var port = new SerialPort(port.comName, { baudRate: bitrate} , function (err) {
          if (err) {
            return console.log('Error: ', err.message);
          }

          // add a listener for any serial traffic
          // do this first so that we don't lose anything (not that it's all that
          // likely, but it doesn't hurt)
          port.on('data', function (data) {
            portListener(data);
          });

          if (_.isFunction(handler)) {
            setPacketHandler(handler);
          } else if (_.isObject(handler)) {
            setPacketHandler(handler.packetHandler);
            if (handler.errorHandler) {
              setErrorHandler(handler.errorHandler);
              port.on('error', function (err) {
                errorListener(err);
              });
            }
          }
          flush();

          if(connectopts.ctsFlowControl) {
            port.set({dtr:false,rts:true}, function(){
              do_probe(probe,done,port);
            });
          }else{
            do_probe(probe,done,port);
          }
        });
      }, function(result) {
        if (result) {
          console.log("RESULT:", result);
          connection = result;
          connectionPort = connection.name;
          debug('connected to ' + connection.name);
          cb();
        } else {
          connection = null;
          clearPacketHandler();
          var deviceDebugInfo = 'driverId ' + deviceInfo.driverId + ', vendorId ' + deviceInfo.vendorId +
            ', productId ' + deviceInfo.productId +
            ', usbDevice ' + deviceInfo.usbDevice + ', path ' + deviceInfo.path;

          cb(new Error('Could not connect to the device: ' + deviceDebugInfo));
        }
      });
    });
  }

  function recordPort(deviceId) {
    var ap = localStore.getItem(DEVICEPORTS);
    var allports = ap ? JSON.parse(ap) : {};
    var successfulPorts = [];
    if (allports && allports[deviceId]) {
      successfulPorts = allports[deviceId];
    } else {
      allports = {};
    }
    if (_.indexOf(successfulPorts, connection.name) == -1) {
      successfulPorts.unshift(connection.name);
    }
    allports[deviceId] = successfulPorts;
    var s = JSON.stringify(allports);
    localStore.setItem(DEVICEPORTS, s);
  }

  function disconnect(cb) {
    if (connection) {
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
    var l = bufView.length;
    var sendcheck = function(info) {

      if (l != info.bytesSent) {
        debug('Only ' + info.bytesSent + ' bytes sent out of ' + l);
      }
      if (info.error) {
        debug('Serial send returned ' + info.error);
        var error = new Error(SEND_ERRORS[info.error]);
        error.name = info.error;
        return callback(error,null);
      }
      callback(null, info);
    };
    if (bytes == null) {
      debug('just tried to send nothing!');
    } else {
      if(connection == null) {
        debug('No connection details available.');
        callback(new Error('No connection details available.'),null);
      }else{
        connection.write(bytes, sendcheck);
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
      connection.flush(function() {
        setPaused(false);
      });
    }
  }

  function setBitrate(br) {
    bitrate = br;
  }

  function setPaused(paused) {
    if(connection) {
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
    recordPort: recordPort,
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
