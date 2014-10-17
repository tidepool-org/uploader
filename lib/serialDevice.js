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

module.exports = function(config) {
  var connected = false;
  var connection = null;
  var port = null;
  var buffer = [];
  var packetBuffer = [];
  var packetHandler = null;
  var portpattern = '/dev/cu.usb.+';
  var bitrate = 9600;

  function init() {
    connected = false;
    connection = null;
    port = null;
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
    }
  };

  function portListener(info) {
    if (connected && info.connectionId == connection.connectionId && info.data) {
      var bufView=new Uint8Array(info.data);
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
  }


  // requires a packethandler
  function connect(packethandler, connectedCB) {
    // add a listener for any serial traffic
    // do this first so that we don't lose anything (not that it's all that
    // likely, but it doesn't hurt)
    chrome.serial.onReceive.addListener(portListener);
    flush();

    // see what ports we have
    chrome.serial.getDevices(function(ports) {
      // this is our callback for a successful connection
      var fconnected = function(conn) {
        connection = conn;
        connected = true;
        console.log('connected to ' + port.path);
        setPacketHandler(packethandler);
        connectedCB();
      };
      // walk all the serial ports and look for the right one
      // console.log(ports);
      for (var i=0; i<ports.length; i++) {
        console.log(portpattern + ' | ' + ports[i].path);
        if (ports[i].path.match(portpattern)) {
          port = ports[i];
          chrome.serial.connect(port.path, { bitrate: bitrate }, fconnected);
          break;
        }
      }
    });
  }

  function disconnect(cb) {
    chrome.serial.onReceive.removeListener(portListener);
    chrome.serial.disconnect(connection.connectionId, function(result) {
      init();
      if (cb) {
        cb(result);
      }
    });
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
    var l = new Uint8Array(bytes).length;
    var sendcheck = function(info) {
      // console.log('Sent %d bytes', info.bytesSent);
      if (l != info.bytesSent) {
        console.log('Only ' + info.bytesSent + ' bytes sent out of ' + l);
      }
      else if (info.error) {
        console.log('Serial send returned ' + info.error);
      }
      callback(info);
    };
    chrome.serial.send(connection.connectionId, bytes, sendcheck);
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
    packetBuffer = [];
  }

  function setPattern(p) {
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
    discardBytes: discardBytes,
    readSerial: readSerial,
    writeSerial: writeSerial,
    setPacketHandler: setPacketHandler,
    clearPacketHandler: clearPacketHandler,
    hasAvailablePacket: hasAvailablePacket,
    peekPacket: peekPacket,
    nextPacket: nextPacket,
    flush: flush
  };

};
