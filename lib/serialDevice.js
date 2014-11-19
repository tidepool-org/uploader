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

var debug = require('bows')('SerialDevice');

var moduleCounter = 1;

module.exports = function(config) {
  var connected = false;
  var connection = null;
  var port = null;
  var buffer = [];
  var packetBuffer = [];
  var packetHandler = null;
  var moduleNumber = moduleCounter++;
  var portpattern = '/dev/cu.usb.+';
  var bitrate = 9600;
  var log = '';
  var logcount = 0;
  var loglimit = 400;
  var doLogging = (config && config.doLogging) || false;

  function init() {
    connected = false;
    connection = null;
    port = null;
    buffer = [];
    packetBuffer = [];
    packetHandler = null;
    log = '';
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
      // debug(log);
    }
  }, 1000);

  var emitLog = function(clearLog) {
    debug(log);
    if (clearLog) {
      log = '';
      logcount = 0;
    }
  };

  function portListener(info) {
    if (connected && info.connectionId == connection.connectionId && info.data) {
      var bufView=new Uint8Array(info.data);
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
  }

  // requires a packethandler
  function connect(packethandler, cb) {
    // add a listener for any serial traffic
    // do this first so that we don't lose anything (not that it's all that
    // likely, but it doesn't hurt)
    chrome.serial.onReceive.addListener(portListener);
    flush();

    // see what ports we have
    chrome.serial.getDevices(function(ports) {
      // this is our callback for a successful connection
      var fconnected = function(conn) {
        addlog(' conn\n');
        logdump();
        connection = conn;
        connected = true;
        debug('connected to ' + port.path);
        setPacketHandler(packethandler);
        cb();
      };
      // walk all the serial ports and look for the right one
      // log(ports);
      debug('Module #' + moduleNumber + ' searching for ' + portpattern);

      var foundPort = false;
      for (var i=0; i<ports.length; i++) {
        debug(portpattern + ' | ' + ports[i].path);
        if (ports[i].path.match(portpattern)) {
          foundPort = true;
          port = ports[i];
          chrome.serial.connect(port.path, { bitrate: bitrate }, fconnected);
          break;
        }
      }

      if (!foundPort) {
        cb(new Error('Could not connect to a matching port pattern ' + portpattern));
      }
    });
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
        debug('disconnected');
        debug('reconnecting on ' + port.path + ' at ' + bitrate);
        setTimeout(function() {
          chrome.serial.connect(port.path, { bitrate: bitrate }, function(conn) {
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
    var sendcheck = function(info) {
      // debug('Sent %d bytes', info.bytesSent);
      addlog(' xmit ');
      for (var i in bufView) {
        addlog(('00' + bufView[i].toString(16)).substr(-2) + ' ');
      }
      addlog('\n');
      logdump();

      if (l != info.bytesSent) {
        debug('Only ' + info.bytesSent + ' bytes sent out of ' + l);
      }
      else if (info.error) {
        debug('Serial send returned ' + info.error);
      }
      callback(info);
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
    debug('Module #' + moduleNumber + ' setting portpattern to ' + p);
    portpattern = p;
  }

  function setBitrate(br) {
    bitrate = br;
  }

  return {
    setPattern: setPattern,
    setBitrate: setBitrate,
    connect: connect,
    disconnect: disconnect,
    changeBitRate: changeBitRate,
    discardBytes: discardBytes,
    readSerial: readSerial,
    writeSerial: writeSerial,
    setPacketHandler: setPacketHandler,
    clearPacketHandler: clearPacketHandler,
    hasAvailablePacket: hasAvailablePacket,
    peekPacket: peekPacket,
    nextPacket: nextPacket,
    flush: flush,
    emitLog: emitLog
  };

};
