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

/* HID Device module for conversation, IOET version */

/* global chrome */

var _ = require('lodash');
var async = require('async');
var localStore = require('./core/localStore');

// for tests
if (typeof localStore === 'function') {
  localStore = localStore({});
}

var DEVICEPORTS = 'hidPorts';

var debug = require('./bows')('HIDDevice');

var moduleCounter = 1;

module.exports = function(config) {
  config = config || {};
  var connection = null;
  var buffer = [];
  var packetBuffer = [];
  var packetHandler = null;
  var errorHandler = null;
  var moduleNumber = moduleCounter++;
  var log = '';
  var logcount = 0;
  var loglimit = 400;
  var doLogging = (config && config.doLogging) || false;
  var connectionId;

  function init() {
    connection = null;
    buffer = [];
    packetBuffer = [];
    packetHandler = null;
    log = '';
    connectionId = null,
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

  function connect(deviceInfo, probe, cb) {
    if (arguments.length != 3) {
      console.log('hid connect called with wrong number of arguments!');
    }

    debug('in HIDDevice.connect, info ', deviceInfo);

    //TODO: verificar si podemos en deviceInfo tener el deviceId
    chrome.hid.connect(deviceInfo.deviceId, function(connectInfo){
      //TODO: arreglar esto para que tenga una validación
      if(!connectInfo){
          console.warn("Unable to connect to device")
       }
      connectionId = connectedInfo.connectionId;
      debug('connected to ' + connectInfo);
      //TODO: aqui hacer algo con el probe antes de llamar al callback final
        if (connectInfo && connectInfo.connectionId) {
            connection = connectInfo;
            probe(function(err) {
        if (!err) {
              return done(connectInfo);
            } else {
             chrome.hid.disconnect(deviceInfo.connectionId, function() {});
              return done();
              }
            });
          } else {
            done();
          }
      cb();
    });

  }

  //TODO verificar en donde se usa este recordPort
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

  function disconnect(deviceInfo, cb) {
    chrome.hid.disconnect(deviceInfo.connectionId, function(){
      //TODO: decir algo aqui antes de llamar al cb
      addlog(' done\n');
    })
  }

  function discardBytes(discardCount) {
    addlog('discard ' + discardCount + '\n');
    logdump();
    buffer = buffer.slice(discardCount);
  }

  function receive(bytes, timeout, cb){
    chrome.hid.receive(connectionId, function (reportId, data){
      var packet = data;
      cb(packet);

    })

    //TODO: tal vez ya no se necesita esto si lo de arriba funciona bien
    //      y si ese es el caso hay que eliminar timeout
    //var packet;
    //if (buffer.length >= bytes) {
    //  packet = buffer.slice(0,bytes);
    //  buffer = buffer.slice(0 - bytes);
    //  callback(packet);
    //} else if (timeout === 0) {
    //  packet = buffer;
    //  buffer = [];
    //  callback(packet);
    //} else {
    //  setTimeout(function() {
    //    receive(bytes, 0, callback);
    //  }, timeout);
    //}
  }

  function send(bytes, callback) {

    var bufView = new Uint8Array(bytes);
    //TODO: maybe not needed at all
    //var l = bufView.length;
    //var timerId = setTimeout(function() {
    //  sendcheck({ bytesSent: 0, error: 'timeout' });
    //}, 500);
    //var sendcheck = function(info) {
    //  clearTimeout(timerId);
    //  // debug('Sent ', info.bytesSent,' bytes');
    //  addlog(' xmit ');
    //  for (var i in bufView) {
    //    addlog(('00' + bufView[i].toString(16)).substr(-2) + ' ');
    //  }
    //  addlog('\n');
    //  logdump();

    //  if (l != info.bytesSent) {
    //    debug('Only ' + info.bytesSent + ' bytes sent out of ' + l);
    //  }
    //  if (info.error) {
    //    debug('Serial send returned ' + info.error);
    //  }
    //  callback(info.error, info);
    //};
    if (bytes == null) {
      debug('just tried to send nothing!');
    } else {
      //TODO: reportId seteado a 0 por probar
      var reportId = 0;
      chrome.hid.send(connectionId, reportId, data, function(){
          callback();
      });
    }
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

  return {
    connect: connect,
    recordPort: recordPort,
    disconnect: disconnect,
    discardBytes: discardBytes,
    receive: receive,
    send: send,
    clearPacketHandler: clearPacketHandler,
    hasAvailablePacket: hasAvailablePacket,
    peekPacket: peekPacket,
    nextPacket: nextPacket,
    flush: flush,
    emitLog: emitLog
  };

};
