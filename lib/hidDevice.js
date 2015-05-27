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

var debug = require('./bows')('HidDevice');

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
    connectionId = null;
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

  function connect(deviceInfo, _packetHandler_, probe, cb) {

    if (arguments.length != 4) {
      debug('hid connect called with wrong number of arguments!');
    }

    if (_.isFunction(_packetHandler_)){
        packetHandler = _packetHandler_;
    }

    debug('in HIDDevice.connect, info ', deviceInfo);

    chrome.hid.connect(deviceInfo.deviceId, function(connectInfo){

        connection = connectInfo;

        if (connectInfo && connectInfo.connectionId) {
          connectionId = connectInfo.connectionId;

          debug('connection Id ' + connectInfo.connectionId);
          connection = connectInfo;

          probe(function(err) {
            if (!err) {
              cb();
            } else {
              chrome.hid.disconnect(deviceInfo.connectionId, function() {});
              connection = null;
              var deviceDebugInfo = 'driverId ' + deviceInfo.driverId +
                  ', vendorId '+ deviceInfo.vendorId +
                  ', productId '+ deviceInfo.productId ;
              cb(new Error('Could not connect to device: '+ deviceDebugInfo));
            }
          });

          cb();
        } else {
          cb(new Error('Unable to connect to device'));
        }
    });

  }

  function disconnect(deviceInfo, cb) {
    if (connection === null){
      return;
    }else{
      chrome.hid.disconnect(connectionId, function(){
        cb();
        console.log('disconnected from HIDDevice');
        addlog(' done\n');
      });
    }
  }

  function discardBytes(discardCount) {
    addlog('discard ' + discardCount + '\n');
    logdump();
    buffer = buffer.slice(discardCount);
  }

  function receive(cb){
    chrome.hid.receive(connectionId, function(reportId, rawdata) {
      var packet;
      portListener({connectionId:connectionId, data: rawdata});
      cb(rawdata);
    });

  }

  function send(bytes, callback) {

    var bufView = new Uint8Array(bytes);
    if (bytes == null) {
      debug('just tried to send nothing!');
    } else {
      var reportId = 0;
      chrome.hid.send(connectionId, reportId, bytes, function(){
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
    disconnect: disconnect,
    discardBytes: discardBytes,
    receive: receive,
    send: send,
    hasAvailablePacket: hasAvailablePacket,
    peekPacket: peekPacket,
    nextPacket: nextPacket,
    flush: flush,
    emitLog: emitLog,
    packetBuffer: function(){return packetBuffer;}
  };

};
