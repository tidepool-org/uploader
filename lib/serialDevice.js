module.exports = function(config) {
  var connected = false;
  var connection = null;
  var port = null;
  var buffer = [];
  var packetBuffer = [];
  var portprefix = config.portprefix || '/dev/cu.usb';
  var bitrate = config.bitrate || 9600;
  var packetHandler = null;

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


  var connect = function(connectedCB) {
    chrome.serial.getDevices(function(ports) {
      var fconnected = function(conn) {
        connection = conn;
        connected = true;
        console.log('connected to ' + port.path);
        connectedCB();
      };
      for (var i=0; i<ports.length; i++) {
        console.log(ports[i].path);
        if (ports[i].path.slice(0, portprefix.length) == portprefix) {
          port = ports[i];
          chrome.serial.connect(port.path, { bitrate: bitrate }, fconnected);
        }
      }
    });

    chrome.serial.onReceive.addListener(function(info) {
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
    });
  };

  var discardBytes = function(discardCount) {
    buffer = buffer.slice(discardCount);
  };

  var readSerial = function(bytes, timeout, callback) {
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
  };

  var writeSerial = function(bytes, callback) {
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
  };

  // a handler should be a function that takes a parameter of a buffer
  // and tries to extract a packet from it; if it finds one, it should delete
  // the characters that make up the packet from the buffer, and return the
  // packet.
  var setPacketHandler = function(handler) {
    packetHandler = handler;
  };

  var clearPacketHandler = function() {
    packetHandler = null;
  };

  var hasAvailablePacket = function() {
    return packetBuffer.length > 0;
  };

  var peekPacket = function() {
    if (hasAvailablePacket()) {
      return packetBuffer[0];
    } else {
      return null;
    }
  };

  var nextPacket = function() {
    if (hasAvailablePacket()) {
      return packetBuffer.shift();
    } else {
      return null;
    }
  };

  var flush = function() {
    packetBuffer = [];
  };

  return {
    buffer: buffer, // get rid of this public member
    connect: connect,
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
