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

var debug = require('./bows')('HidDevice');

module.exports = function(config) {
  config = config || {};
  var connection = null;
  var buffer = [];
  var packetBuffer = [];
  var packetHandler = null;
  var rawdata = null;

  // This is the object that is passed to the packet handler
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

  function portListener(data) {
    if (connection && data) {
      rawdata = data; // take a snapshot of raw data for receive() function
      var bufView = new Uint8Array(data);
      for (var i = 0; i < bufView.byteLength; i++) {
        buffer.push(bufView[i]);
      }

      // packet handler removes bytes from buffer and parses into an array of packets
      if (packetHandler) {
        var pkt = packetHandler(bufobj);
        while (pkt) {
          packetBuffer.push(pkt);
          pkt = packetHandler(bufobj);
        }
      }
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

    connection = new hid.HID(deviceInfo.vendorId, deviceInfo.productId);

    if (connection) {

      // Set up data listener
      connection.on('data', function(rawdata) {
        portListener(rawdata);
      });

      // Set up error listener
      connection.on('error', function(error) {
        debug('Error:', error);
        cb(error);
      });

      cb();
    } else {
      cb(new Error('Unable to connect to device'));
    }

  }

  function disconnect(deviceInfo, cb) {
    if (connection === null){
      return;
    }else{
      connection.close();
      console.log('disconnected from HIDDevice');
      cb();
    }
  }

  function discardBytes(discardCount) {
    buffer = buffer.slice(discardCount);
  }

  function receive(cb){
    if(rawdata) {
      cb(rawdata);
      rawdata = null;
    } else {
      return cb(null);
    }
  }

  function send(bytes, callback) {

    var buf = new Uint8Array(bytes);
    if (bytes == null) {
      debug('just tried to send nothing!');
    } else {
      connection.write(Array.from(buf));
      callback();
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
    debug('flushing buffers..');
    packetBuffer = [];
    buffer = [];
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
    packetBuffer: function(){return packetBuffer;}
  };

};
