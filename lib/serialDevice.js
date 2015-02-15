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

/* global chrome */

var _ = require('lodash');
var async = require('async');
var localStore = require('./core/localStore');
var DEVICEPORTS = 'devicePorts';

var debug = require('./bows')('SerialDevice');

var moduleCounter = 1;

module.exports = function(config) {
  config = config || {};
  var connection = null;
  var connectionPort = null;
  var buffer = [];
  var packetBuffer = [];
  var packetHandler = null;
  var errorHandler = null;
  var moduleNumber = moduleCounter++;
  var portPattern = '/dev/cu.usb.+';
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
    }
  };

  function addlog(s) {
    if (!doLogging) {
      return;
    }

    if (logcount < loglimit) {
      if (s.indexOf('\n') !== -1) {
        ++logcount;
      }
      log += s;
    }
  }

  var logdump = _.debounce(function() {
    if (doLogging) {
      debug(log);
    }
  }, 900);

  var emitLog = function(clearLog) {
    debug(log);
    if (clearLog) {
      log = '';
      logcount = 0;
    }
  };

  function _receiveSomeBytes(bufView) {
    for (var i=0; i<bufView.byteLength; i++) {
      buffer.push(bufView[i]);
    }

    addlog('  rcv ');
    for (i in bufView) {
      addlog(('00' + bufView[i].toString(16)).substr(-2) + ' ');
    }
    addlog('\n');
    logdump();

    // we got some bytes, let's see if they make one or more packets
    if (packetHandler) {
      var pkt = packetHandler(bufobj);
      while (pkt) {
        packetBuffer.push(pkt);
        pkt = packetHandler(bufobj);
      }
    }

  }

  function portListener(info) {
    if (connection && info.connectionId == connection.connectionId && info.data) {
      var bufView=new Uint8Array(info.data);
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

  function connect(deviceInfo, handler, probe, cb) {
    if (arguments.length != 4) {
      console.log('serial connect called with wrong number of arguments!');
    }

    // If the driver specifies a bitrate override, we have to use it
    if (!!deviceInfo.bitrate) {
      bitrate = deviceInfo.bitrate;
    }

    // add a listener for any serial traffic
    // do this first so that we don't lose anything (not that it's all that
    // likely, but it doesn't hurt)
    chrome.serial.onReceive.addListener(portListener);
    if (_.isFunction(handler)) {
      setPacketHandler(handler);
    } else if (_.isObject(handler)) {
      setPacketHandler(handler.packetHandler);
      if (handler.errorHandler) {
        setErrorHandler(handler.errorHandler);
        chrome.serial.onReceiveError.addListener(errorListener);
      }
    }
    flush();

    debug('in SerialDevice.connect, info ', deviceInfo);

    // generate a list of all the ports in the system
    chrome.serial.getDevices(function(ports) {
      // filter the list of ports if we can, using the portPattern if we have one
      if (deviceInfo.portPattern) {
        ports = _.filter(ports, function(p) {
          return p.path.match(deviceInfo.portPattern);
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
        var i = _.indexOf(successfulPorts, port.path);
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
          name: port.path,
          sendTimeout: deviceInfo.sendTimeout || 1000,
          receiveTimeout: deviceInfo.receiveTimeout || 1000,
          ctsFlowControl: deviceInfo.ctsFlowControl || false
        };

        chrome.serial.connect(port.path, connectopts, function(conn) {
          if (chrome.runtime.lastError !== undefined) {
            console.log('Error attempting to connect: ', chrome.runtime.lastError);
          }
          if (conn && conn.connectionId) {
            connection = conn;
            probe(function(err) {
              if (!err) {
                return done(conn); // we found a port so abort the eachSerial
              } else {
                // it didn't work so disconnect
                chrome.serial.disconnect(conn.connectionId, function() {});  // don't care what the result is
                return done();
              }
            });
          } else {
            done();
          }
        });
      }, function(result) {
        if (result) {
          addlog(' conn\n');
          logdump();
          connection = result;
          connectionPort = connection.name;
          debug('connected to ' + connection.name);
          cb();
        } else {
          connection = null;
          clearPacketHandler();
          cb(new Error('Could not connect to a matching device port ' + deviceInfo));
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
    chrome.serial.onReceive.removeListener(portListener);
    if (connection) {
      chrome.serial.disconnect(connection.connectionId, function(result) {
        addlog(' done\n');
        logdump();
        init();
        if (cb) {
          cb(result);
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
      addlog(' change bitrate to ' + newrate + '\n');
      bitrate = newrate;
      chrome.serial.disconnect(connection.connectionId, function(result) {
        debug('reconnecting on ' + connection.name + ' at ' + bitrate);
        setTimeout(function() {
          chrome.serial.connect(connection.name, { bitrate: bitrate }, function(conn) {
            debug('reconnected');
            connection = conn;
            if (cb) {
              cb(true);
            }
          });
        }, 500);
      });
    } else {
      if (cb) {
        cb(false);
      }
    }
  }

  function discardBytes(discardCount) {
    addlog('discard ' + discardCount + '\n');
    logdump();
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
    var timerId = setTimeout(function() {
      sendcheck({ bytesSent: 0, error: 'timeout' });
    }, 500);
    var sendcheck = function(info) {
      clearTimeout(timerId);
      // debug('Sent ', info.bytesSent,' bytes');
      addlog(' xmit ');
      for (var i in bufView) {
        addlog(('00' + bufView[i].toString(16)).substr(-2) + ' ');
      }
      addlog('\n');
      logdump();

      if (l != info.bytesSent) {
        debug('Only ' + info.bytesSent + ' bytes sent out of ' + l);
      }
      if (info.error) {
        debug('Serial send returned ' + info.error);
      }
      callback(info.error, info);
    };
    if (bytes == null) {
      debug('just tried to send nothing!');
    } else {
      chrome.serial.send(connection.connectionId, bytes, sendcheck);
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
    addlog('flush\n');
    logdump();
    packetBuffer = [];
  }

  function setPattern(p) {
    debug('Module #' + moduleNumber + ' setting portPattern to ' + p);
    portPattern = p;
  }

  function setBitrate(br) {
    bitrate = br;
  }

  return {
    setPattern: setPattern,
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
    emitLog: emitLog
  };

};
