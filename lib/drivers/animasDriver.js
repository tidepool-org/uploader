/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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
var sundial = require('sundial');
var annotate = require('../eventAnnotations');
var util = require('util');

var crcCalculator = require('../crc.js');
var struct = require('../struct.js')();

var animasSimulator = require('../animas/animasSimulator');

var TZOUtil = require('../TimezoneOffsetUtil');

var debug = require('../bows')('AnimasDriver');

module.exports = function (config) {
  var cfg = _.clone(config);
  debug('animas config: ', cfg);
  var serialDevice = config.deviceComms;
  var animasDeviceId = null;
  var simulator = null;

  if (config.silent) {
    // debug = _.noop;
  }

  var BOM_BYTE = 0xC0;
  var EOM_BYTE = 0xC1;
  var ADDRESS_CONNECT = 0xFF; //used to establish connection
  var ADDRESS_SET = 0x81; // 11000000b primary devices sets bit 0 (LSB), bit 1-7 is connection address
  var PRIMARY_ADDRESS = 0x01;

  var CMDS = {
    CONNECT: { value: 0x93, name: 'CONNECT'},
    DISCONNECT: { value: 0x53, name: 'DISCONNECT'},
    HANDSHAKE: {value: 0xBF, name: 'HANDSHAKE'},
    UA: {value: 0x73, name: 'Unnumbered Acknowledge'},
    RI: {value: 0x5249, name: 'RI message (Read)'},
    ACK: {value: 0x11, name: 'Acknowledge'}
  };

  var RECORD_TYPES = {
    SERIALNUMBER : {value: 8, name: 'SERIAL AND MODEL NUMBER'},
    SETTINGS: {value: 15, name: 'MISC. SETTINGS'},
    BOLUS: {value: 21, name: 'BOLUS HISTORY'},
    BASAL: {value: 26, name: 'BASAL HISTORY'},
    PRIME_REWIND: {value: 24, name: 'PRIME-REWIND HISTORY'},
    SUSPEND_RESUME: {value: 25, name: 'SUSPEND-RESUME HISTORY'}
  };

  var MODELS = {
    15 : 'IR1285',
    16: 'IR1295'
  };

  var BASAL_TYPES = {
    0 : 'scheduled',
    1 : 'temp'
  };

  var PRIMING_FLAGS = {
    0 : 'blank',
    1 : 'not primed',
    2 : 'tubing',
    3 : 'cannula'
  };

  var getCmdName = function (idx) {
    for (var i in CMDS) {
      if (CMDS[i].value == idx) {
        return CMDS[i].name;
      }
    }
    return 'UNKNOWN COMMAND!';
  };

  var counters = {
    sent : 0,
    received : 0
  };

  var bytes2hex = function(bytes) {
    var message = '';
    for(var i in bytes) {
      message += bytes[i].toString(16).toUpperCase() + ' ';
    }
    return message;
  };

  // builds a command in an ArrayBuffer
  // Byte 1: always 0xC0 (BOM - Beginning of Message),
  // Byte 2: address field; bit 0 is command/response bit (primary device sets this bit, secondary clears it)
  // Byte 3: control field; if bit 4 is clear sender retains transmit rights, if set receiver has transmit rights
  // Payload: 0-128 bytes
  // CRC bytes: 2 check bytes over bytes 2-3 and payload
  // EOM byte: always 0xC1 (signals end of message)

  var buildPacket = function (address, command, payloadLength, payload) {
    var datalen = payloadLength + 6;
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);
    var ctr = struct.pack(bytes, 0, 'bbb', BOM_BYTE, address,command);

    ctr += struct.copyBytes(bytes, ctr, escapeCharacters(payload), payloadLength);
    // checksum only over address field, control field and payload
    var crc = escapeCharacters(crcCalculator.calcCheckBytes(bytes.subarray(1,payloadLength+3), ctr));

    struct.pack(bytes, ctr, 'sb', crc, EOM_BYTE);

    debug('bytes sent:', bytes2hex(bytes));
    return buf;
  };

  var escapeCharacters = function(buf) {
    for(var i in buf) {
      var byte = buf[i];
      if(byte == BOM_BYTE || byte == EOM_BYTE || byte == 0x7D) {
        debug('Replacing special character');
        buf[i] = 0x7D;
        buf.splice(i, 0, byte ^ 0x20);
      }
    }
    return buf;
  };

  var setupConnection = function(destinationAddress) {
    var payload = new Uint8Array(9);
    var payloadlength = struct.pack(payload,0,'iib',PRIMARY_ADDRESS,destinationAddress,ADDRESS_SET);
    return {
      packet: buildPacket(
        ADDRESS_CONNECT, CMDS.CONNECT.value, payloadlength, payload
      ),
      parser: function (packet) {
        var data = {connected : (packet.command == CMDS.UA.value)};
        return data;
      }
    };
  };

  var handshake = function(iter) {
    return {
      packet: buildPacket(
        ADDRESS_CONNECT, CMDS.HANDSHAKE.value, 10, [0x01,0x00,0x00,0x00,0xFF,0xFF,0xFF,0xFF,0x02,iter]
      ),
      parser: function (packet) {
        var data = {
          destinationAddress : struct.extractInt(packet.payload, 0),
          serialNumber : struct.extractInt(packet.payload,10),
          description : struct.extractString(packet.payload,14,packet.length-1)
        };
        return data;
      }
    };
  };

  var getCounters = function() {
    // bit 5-7 : 3-bit receive counter
    // bit 4 : 1
    // bit 1-3 : 3-bit send counter
    // bit 0:  0
    var counter = (counters.received << 5) | 0x10;
    counter = (counters.sent << 1) | counter;
    console.log('Counter: ', counter.toString(2));
    return counter;
  };

  var incrementSentCounter = function() {
    counters.sent +=1;
    if(counters.sent == 7) {// counter is only 3 bits
      counters.sent = 0;
    }
  };

  var incrementReceivedCounter = function() {
    counters.received += 1;
    if(counters.received == 7) { // counter is only 3 bits
      counters.received = 0;
    }
  };

  var readDataPages = function (rectype, offset, numRecords) {

    var payload = new Uint8Array(8);
    var payloadlength = struct.pack(payload,0,'Ssss',CMDS.RI.value,rectype,offset,numRecords);

    return {
      packet: buildPacket(
        ADDRESS_SET,
        getCounters(),
        payloadlength,
        payload
      ),
      parser: function (packet) {
        return packet;
      }
    };
  };

  var requestPrimeRewind = function() {
    return{
      recordType: RECORD_TYPES.PRIME_REWIND.value,
      parser : function (payload) {
        var dt = decodeDate(struct.unpack(payload,4,'bbbb',['monthYear','day','hour','minute']));
        return {
          index : struct.extractByte(payload,2),
          jsDate : dt,
          deviceTime: sundial.formatDeviceTime(dt),
          deliveredAmount: struct.extractShort(payload,8)/100.0, // U x 100
          primeFlags: PRIMING_FLAGS[struct.extractByte(payload,10)]
        };
      }
    };
  };

  var requestSuspendResume = function() {
    return{
      recordType: RECORD_TYPES.SUSPEND_RESUME.value,
      parser : function (payload) {
        var suspenddt = decodeDate(struct.unpack(payload,4,'bbbb',['monthYear','day','hour','minute']));
        var resumedt = decodeDate(struct.unpack(payload,8,'bbbb',['monthYear','day','hour','minute']));
        return {
          index : struct.extractByte(payload,2),
          suspendJsDate : suspenddt,
          suspendDeviceTime: sundial.formatDeviceTime(suspenddt),
          resumeJsDate : resumedt,
          resumeDeviceTime: sundial.formatDeviceTime(resumedt)
        };
      }
    };
  };

  var requestBolus = function() {
    return{
      recordType: RECORD_TYPES.BOLUS.value,
      parser : function (payload) {
        var dt = decodeDate(struct.unpack(payload,4,'bbbb',['monthYear','day','hour','minute']));
        return {
          index : struct.extractByte(payload,2),
          jsDate : dt,
          deviceTime: sundial.formatDeviceTime(dt),
          deliveredAmount: struct.extractInt(payload,8)/10000.0, // U x 10,000
          requiredAmount: struct.extractShort(payload,12)/1000.0, // U x 1,000
          duration: struct.extractShort(payload,14), // N x 0.1Hr
          bolusType: getBolusType(struct.extractByte(payload,16))
        };
      }
    };
  };

  var requestBasal = function() {
    return{
      recordType: RECORD_TYPES.BASAL.value,
      parser : function (payload) {
        var dt = decodeDate(struct.unpack(payload,4,'bbbb',['monthYear','day','hour','minute']));
        return {
          index : struct.extractByte(payload,2),
          jsDate : dt,
          deviceTime: sundial.formatDeviceTime(dt),
          rate: struct.extractShort(payload,8)/1000.0, // U x 1,000
          basalType: BASAL_TYPES[parseInt(struct.extractByte(payload,10),10)]
        };
      }
    };
  };

  // accepts a stream of bytes and tries to find a packet
  // at the beginning of it.
  // returns a packet object; if valid == true it's a valid packet
  // if packet_len is nonzero, that much should be deleted from the stream
  // if valid is false and packet_len is nonzero, the previous packet
  // should be NAKed.
  var extractPacket = function (bytes) {
    var packet = {
      bytes: bytes,
      valid: false,
      packet_len: 0,
      command: 0,
      payload: null,
      crc: 0
    };

    if (bytes[0] != BOM_BYTE) {
      return packet;
    }

    // wait until we've received the end of message
    if (bytes[bytes.length-1] !== EOM_BYTE) {
      return packet;  // we're not done yet
    }

    debug('Raw packet: ', bytes2hex(bytes));

    //escape characters
    var fromIndex = 0;
    var index = 0;
    while((index = bytes.indexOf(0x7D,fromIndex)) > 0) {
        debug('Replacing escaped character');
        var buf = new Uint8Array(bytes.byteLength-1);
        var front = bytes.slice(0,index+1);
        var special = bytes[index+1] ^ 0x20;
        front[index] = special;
        if(special == 0x7D) {
          fromIndex = index+1; // previous escaped character was the escape character
        }
        buf.set(front,0);
        buf.set(bytes.slice(index+2),index+1);
        debug('Escaped bytes:', bytes2hex(buf));
        bytes = buf;
    }

    // calc the checksum
    packet.crc = struct.extractShort(bytes, bytes.length - 3);
    var crc = crcCalculator.calcCheckBytes(bytes.subarray(1,bytes.length-3));
    if (crc != packet.crc) {
      // if the crc is bad, we should discard the whole packet
      debug('Invalid CRC');
      return packet;
    }

    // command is the third byte, packet is remainder of data
    packet.command = bytes[2];
    packet.packet_len = bytes.length;

    if((packet.packet_len == 6) && (packet.command & CMDS.ACK.value)) {
      // This is a Receive Ready/NOP/Ack packet
      packet.ack = true;
      var nextPacket = struct.extractByte(bytes, 2);
      counters.received = nextPacket >> 5;
      packet.valid = true;
    }else{
      packet.payload = new Uint8Array(packet.packet_len-6);
      for (var i = 0; i < bytes.length - 6; ++i) {
        packet.payload[i] = bytes[i + 3];
      }
      packet.valid = true;
    }

    return packet;
  };

  var parsePayload = function (packet) {

    if (!packet.valid) {
      return {};
    }
    if (packet.command !== 1) {
      return {};
    }

    var len = packet.packet_len - 6;
    var data = null;
    if (len) {
      console.log(struct.extractString(packet.payload, 0, len));
    }
    return data;
  };

  var animasPacketHandler = function (buffer) {
    // for efficiency reasons, we're not going to bother to ask the driver
    // to decode things that can't possibly be a packet
    // first, discard bytes that can't start a packet
    var discardCount = 0;
    while (buffer.len() > discardCount && buffer.get(0) != BOM_BYTE) {
      ++discardCount;
    }
    if (discardCount) {
      buffer.discard(discardCount);
    }

    if (buffer.len() < 6) { // all complete packets must be at least this long
      return false;       // not enough there yet
    }

    // there's enough there to try, anyway
    var packet = extractPacket(buffer.bytes());
    if (packet.packet_len !== 0) {
      // remove the now-processed packet
      buffer.discard(packet.packet_len);
    }

    if (packet.valid) {
      return packet;
    } else {
      return null;
    }
  };

  var listenForPacket = function (timeout, commandpacket, callback) {
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      debug('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(function () {
      if (serialDevice.hasAvailablePacket()) {
        var pkt = serialDevice.nextPacket();
        debug('Received packet: ', pkt);
        // we always call the callback if we get a packet back,
        // so just cancel the timers if we do
        clearTimeout(abortTimer);
        clearInterval(listenTimer);
        // only attempt to parse the payload if it worked
        if (pkt.payload) {
          pkt.parsed_payload = commandpacket.parser(pkt);
        }
        callback(null, pkt);
      }
    }, 10);
  };

  var sendAck = function (obj,cb) {
    var cmd = {
      packet: buildPacket(
        ADDRESS_SET, CMDS.ACK.value | (counters.received << 5), 0, []
      ),
      parser: function (packet) {
        var data = {
          nextPacket : struct.extractByte(packet.payload, 0)
        };
        return data;
      }
    };

    animasCommandResponse(cmd, function (err, result) {
      if (err) {
        cb(err, null);
      } else {
        cb(null, result);
      }
    });
  };

  var animasCommandResponse = function (commandpacket, callback) {
    serialDevice.writeSerial(commandpacket.packet, function () {
      // once we've sent the command, start listening for a response
      listenForPacket(3000, commandpacket, callback);
    });
  };

  var animasCommandResponseAck = function (cmd, cb) {
    // This is for Information packets, where one ACK is received after the command is sent,
    // and an ACK is sent in response. When the payload is received, another ACK is sent.
    animasCommandResponse(cmd, function (err, result) {
      if (err) {
        cb(err, null);
      } else {
        if(result.ack) {
          incrementSentCounter();
          sendAck(true, function (err, result){
            incrementReceivedCounter();
            if(result.payload) {
              var payload = result.payload;
              //TODO: double-check extra checksum
              sendAck(true, function (err, result){
                cb(null,payload);
              });
            }else if(result.ack){
              //Retry
              debug('Retrying..');

              animasCommandResponse(cmd, function (err, result) {
                if (err) {
                  cb(err, null);
                } else {
                  if(result.ack) {
                    incrementSentCounter();
                    sendAck(true, function (err, result){
                      incrementReceivedCounter();
                      if(result.payload) {
                        var payload = result.payload;
                        //TODO: double-check extra checksum
                        sendAck(true, function (err, result){
                          cb(null,payload);
                        });
                      }
                    });
                  }
                }
              });
              
            }else{
              cb('Unknown packet received', null);
            }
          });
        }
      }
    });
  };

  var discoverDevice = function(obj,cb) {
    debug('discovering animas device');

    var i = 0;
    var handshakeInterval = setInterval(function() {
      debug('Polling slot ',i);
      var cmd = handshake(i);
      i++;
      if(i == 16) {
        clearInterval(handshakeInterval);
        debug('Did not find device.');
        cb(null,null);
      }

      animasCommandResponse(cmd, function (err, result) {
        if (err) {
          cb(null, null);
        } else {
          clearInterval(handshakeInterval);
          cb(null, result);
        }
      });

    }, 200);

  };

  var getConnection = function(obj, cb) {
    debug('connecting to animas');
    var i = 0;
    var connectInterval = setInterval(function() {
      debug('Attempt ',i);
      var cmd = setupConnection(obj.destinationAddress);
      i++;
      if(i == 8) {
        clearInterval(connectInterval);
        debug('Could not connect to device.');
        cb(null,null);
      }

      animasCommandResponse(cmd, function (err, result) {
        if (err) {
          cb(err, null);
        } else {
          clearInterval(connectInterval);
          cb(null, result);
        }
      });
    }, 200);
  };

  var resetConnection = function(obj, cb) {
    debug('reset connection to animas');

    var cmd = {
      packet: buildPacket(
        ADDRESS_SET, CMDS.DISCONNECT.value, 0, []
      ),
      parser: function (packet) {
        if (packet.command == CMDS.UA.value) {
          var data = {connected : false};
          return data;
        }
        return false;
      }
    };

    animasCommandResponse(cmd, function (err, result) {
      if (err) {
        cb(err, null);
      } else {

        getConnection(true, function(connectErr, obj) {
          if(connectErr) {
            cb(connectErr, obj);
          }else{
            cb(null, obj);
          }
        });
      }
    });
  };


  var readSerialandModelNumber = function(cb) {
    var cmd = readDataPages(RECORD_TYPES.SERIALNUMBER.value,0,1);
    animasCommandResponseAck(cmd, function (err, result) {
      if (err) {
        cb(err, null);
      } else {
        var model = struct.extractString(result,10,2);
        var data = {
          modelNumber : MODELS[parseInt(model,10)],
          serialNumber: struct.extractString(result,12,2).concat('-',struct.extractString(result,4,6),model),
          month: String.fromCharCode(struct.extractByte(result,14)), // hex month: 1=January .. C=December
          year: String.fromCharCode(struct.extractByte(result,15)) //hex year
        };
        cb(null, data);
      }
    });
  };

  //TODO: not used yet
  var readMiscSettings = function(cb) {
      var cmd = readDataPages(RECORD_TYPES.SETTINGS.value,0,1);
      animasCommandResponseAck(cmd, function (err, result) {
        if (err) {
          cb(err, null);
        } else {
          var data = {
            insulinSensitivity : struct.extractShort(result,10),
            bgTarget: struct.extractShort(result,8)
          };
          cb(null, data);
        }
      });
  };

  var getNumberOfRecords = function(rectype, cb) {
    var cmd = readDataPages(rectype,0,0);
    animasCommandResponseAck(cmd, function (err, result) {
      if (err) {
        cb(err, null);
      } else {
        var data = {
          numRecords : struct.extractShort(result,2),
          recordSize: struct.extractShort(result,4)
        };
        cb(null,data);
      }
    });
  };

  var getBolusType = function(byte) {
    var type = {};

    var name = byte & 0x03;
    switch (name) {
      case 1:
        type.name= 'normal';
        break;
      case 2:
        type.name = 'audio';
        break;
      case 3:
        type.name = 'combo';
        break;
      default:
        debug('Unhandled type!', name);
    }

    var status = (byte >> 2) & 0x03;
    switch (status) {
      case 3:
        type.status = 'completed';
        break;
      case 2:
        type.status = 'cancelled';
        break;
      default:
        debug('Unhandled type!', status);
    }

    return type;
  };

  var decodeDate = function(encoded) {
    var year = (encoded.monthYear & 0x0f) + 2007; // OneTouch Ping starts in year 2007 as 0
    // TODO: Animas Vibe starts in 2008
    var month = (encoded.monthYear >> 4); // January = 0
    var date = sundial.buildTimestamp({year:year,month:month+1,day:encoded.day,hours:encoded.hour,minutes:encoded.minute,seconds:0});
    return date;
  };

  var getRecords = function(request,numRecords,recordSize,cb) {

    var cmd = readDataPages(request.recordType,0,numRecords);

    animasCommandResponse(cmd, function (err, result) {
      if (err) {
        cb(err, null);
      } else {

        async.timesSeries(numRecords, function(n, next){

          sendAck(true, function (err, result){
            incrementReceivedCounter();
            if(result.payload) {
              var payload = result.payload;
              if(struct.extractInt(payload,4) === 0) {// empty date
                next('stop',null);
              }else{
                var datum = request.parser(payload);

                //TODO: double-check extra checksum
                sendAck(true, function (err, result){
                  next(err,datum);
                });
              }
            }
          });

        }, function(obj, result) {
          if(obj == 'stop') {
            result.pop(); //remove null element
          }
          cb(null,result);
        });
      }
    });
  };

  // this is the probe function passed to connect
  function probe(cb) {
    cb();
  }

  return {
     detect: function (obj, cb) {
       //TODO: look at putting default detect function back in
       debug('Animas not using detect function');
       cb(null,obj);
     },

    // this function starts the chain, so it has to create but not accept
    // the result (data) object; it's then passed down the rest of the chain
    setup: function (deviceInfo, progress, cb) {
      debug('STEP: setup');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      debug('STEP: connect');
      cfg.deviceComms.connect(data.deviceInfo, animasPacketHandler, probe, function(err) {
        if (err) {
          return cb(err,null);
        }

        discoverDevice(true, function(discoverErr, obj) {
          if(discoverErr) {
            cb(discoverErr, obj);
          }else{

            getConnection(true, function(connectErr, obj) {
              if(connectErr) {
                cb(connectErr, obj);
              }else{
                if(obj.parsed_payload.connected === true) {
                          // we're talking so tell the serial device to record this port
                          cfg.deviceComms.recordPort(data.deviceInfo.driverId);
                          // reset packet counters
                          counters.sent = 0;
                          counters.received = 0;

                          progress(100);
                          data.connect = true;
                          cb(null, data);
                }else{
                  debug('Not connected.');
                  cb(null,null);
                }
              }
            });
          }
        });
      });
    },

    getConfigInfo: function (progress, data, cb) {
      debug('STEP: getConfigInfo');

      readSerialandModelNumber(function (err, result) {
        if(err) {
          cb(err,null);
        }else{
          progress(100);
          data.settings = result;
          data.getConfigInfo = true;
          cb(null, data);
        }
      });
    },

    fetchData: function (progress, data, cb) {
      // a little helper to split up our progress bar segment
      var makeProgress = function (progfunc, start, end) {
        return function(x) {
          progfunc(start + (x/100.0)*(end-start));
        };
      };

      debug('STEP: fetchData');
      progress(0);

      async.series({
        bolusRecords : function(callback){
          getNumberOfRecords(RECORD_TYPES.BOLUS.value, function (err, result) {
            if(err) {
              callback(err,null);
            }else{
              debug('Number of bolus records:',result);

              getRecords(requestBolus(),result.numRecords,result.recordSize, function(err, result){
                progress(10);
                callback(null,result);
              });
            }
          });
        },
        basalRecords: function(callback){
          // If you don't disconnect and reconnect, the pump will try to send you all (even empty) records
          resetConnection(true, function(connectErr, obj) {
            if(connectErr) {
              cb(connectErr, obj);
            }else{
              counters.received = 0;
              counters.sent = 0;
              getNumberOfRecords(RECORD_TYPES.BASAL.value, function (err, result) {
                if(err) {
                  cb(err,null);
                }else{
                  debug('Number of basal records:',result);

                  getRecords(requestBasal(),result.numRecords,result.recordSize, function(err, result){
                    progress(20);
                    callback(null,result);
                  });
                }
              });
            }
          });
        },
        primeRewindRecords: function(callback){
          // If you don't disconnect and reconnect, the pump will try to send you all (even empty) records
          resetConnection(true, function(connectErr, obj) {
            if(connectErr) {
              cb(connectErr, obj);
            }else{
              counters.received = 0;
              counters.sent = 0;
              getNumberOfRecords(RECORD_TYPES.PRIME_REWIND.value, function (err, result) {
                if(err) {
                  cb(err,null);
                }else{
                  debug('Number of prime/rewind records:',result);

                  getRecords(requestPrimeRewind(),result.numRecords,result.recordSize, function(err, result){
                    progress(30);
                    callback(null,result);
                  });
                }
              });
            }
          });
        },
        suspendResumeRecords: function(callback){
          resetConnection(true, function(connectErr, obj) {
            if(connectErr) {
              cb(connectErr, obj);
            }else{
              counters.received = 0;
              counters.sent = 0;
              getNumberOfRecords(RECORD_TYPES.SUSPEND_RESUME.value, function (err, result) {
                if(err) {
                  cb(err,null);
                }else{
                  debug('Number of suspend/resume records:',result);

                  getRecords(requestSuspendResume(),result.numRecords,result.recordSize, function(err, result){
                    progress(40);
                    callback(null,result);
                  });
                }
              });
            }
          });
        }
      },
      function(err, results){
          progress(100);
          _.extend(data,results);
          cb(null, data);
      });

      //TODO: read the rest of the data

    },

    processData: function (progress, data, cb) {
      debug('STEP: processData');
      progress(0);
      console.log('Data:', data);

      animasDeviceId = data.settings.modelNumber + '-' + data.settings.serialNumber;
      cfg.builder.setDefaults({ deviceId: animasDeviceId});
      data.postrecords = [];
      var settings = [];
      settings.time = new Date().toISOString(); //TODO: UTC bootstrapping
      var changes = [];
      var tzoUtil = new TZOUtil(cfg.timezone, settings.time, changes);
      cfg.tzoUtil = tzoUtil;

      //TODO: fill in settings from pump
      /*
      data.postrecords = buildSettingsRecord(data, postrecords);
      if (!_.isEmpty(data.postrecords)) {
        settings = data.postrecords[0];
      }*/
      simulator = animasSimulator.make({settings: settings});

      var bolus = null;
      for(var b in data.bolusRecords) {
        var bolusdatum = data.bolusRecords[b];
        bolus = cfg.builder.makeNormalBolus()
          .with_normal(bolusdatum.deliveredAmount)
          .with_deviceTime(bolusdatum.deviceTime);
        cfg.tzoUtil.fillInUTCInfo(bolus, bolusdatum.jsDate);
        bolus = bolus.done();
        data.postrecords.push(bolus);
      }

      var deviceEvent = null;
      for(var d in data.primeRewindRecords) {
        var primedatum = data.primeRewindRecords[d];
        deviceEvent = cfg.builder.makeDeviceEventPrime()
          .with_deviceTime(primedatum.deviceTime)
          .with_primeTarget(primedatum.primeFlags)
          .with_volume(primedatum.deliveredAmount);
        cfg.tzoUtil.fillInUTCInfo(deviceEvent, primedatum.jsDate);
        deviceEvent = deviceEvent.done();
        data.postrecords.push(deviceEvent);
      }

      var suspend = null;
      var resume = null;
      for(var s in data.suspendResumeRecords) {
        var suspendresumedatum = data.suspendResumeRecords[d];

        suspend = cfg.builder.makeDeviceEventSuspend()
          .with_deviceTime(suspendresumedatum.suspendDeviceTime)
          .with_reason({suspended: 'manual'})
          .set('index', suspendresumedatum.log_index);
        cfg.tzoUtil.fillInUTCInfo(suspend, suspendresumedatum.suspendJsDate);
        suspend = suspend.done();
        data.postrecords.push(suspend);

        if(suspendresumedatum.resumeJsDate > suspendresumedatum.suspendJsDate) {
          // as the device needs to be in a suspended state to download data,
          // the last suspend/resume event will not have a valid "resume" timestamp
          resume = cfg.builder.makeDeviceEventResume()
            .with_deviceTime(suspendresumedatum.resumeDeviceTime)
            .with_reason({resumed: 'manual'})
            .set('index', suspendresumedatum.log_index);
          cfg.tzoUtil.fillInUTCInfo(resume, suspendresumedatum.resumeJsDate);
          data.postrecords.push(resume);
        }
      }

      // build first basal
      /*
      var basaldatum = data.basalRecords[0];
      var basal = cfg.builder.makeScheduledBasal()
        .with_scheduleName('DEFAULT') //TODO: get basal program name
        .with_duration(0) // we don't know the duration of the first basal until we get the second one
        .with_rate(basaldatum.rate)
        .with_deviceTime(basaldatum.deviceTime);
      cfg.tzoUtil.fillInUTCInfo(basal, basaldatum.jsDate);
      data.postrecords.push(basal);
*/
      // build the rest
      //TODO: BUILD SIMULATOR TO DO THIS PROPERLY!
      for(var i in data.basalRecords) {
//        if(i>0) {
          var basaldatum = data.basalRecords[i];
          var basal = cfg.builder.makeScheduledBasal()
            //.with_scheduleName(data.basalPrograms.names[data.basalPrograms.enabled_idx].name)
            .with_scheduleName('DEFAULT') //TODO: get basal program name
            //.with_duration(Date.parse(data.postrecords[data.postrecords.length-1].time) - Date.parse(basaldatum.deviceTime))
            .with_rate(basaldatum.rate)
            .with_deviceTime(basaldatum.deviceTime);
          cfg.tzoUtil.fillInUTCInfo(basal, basaldatum.jsDate);

//          var previous = _.omit(data.postrecords[data.postrecords.length-1] , 'previous');
//          basal.previous = previous;

          data.postrecords.push(basal);
//        }
      }

      //fix first basal duration
//      data.postrecords[0].duration = Date.parse(data.postrecords[1].time) - Date.parse(data.postrecords[0].time);

      // first sort by log index
      data.postrecords = _.sortBy(data.postrecords, function(d) { return d.index; });
      // finally sort by time, including indexed (history) and non-indexed records
      data.postrecords = _.sortBy(data.postrecords, function(d) { return d.time; });
      for (var j = 0; j < data.postrecords.length; ++j) {
        var datum = data.postrecords[j];
        switch (datum.type) {
          case 'basal':
            simulator.basal(datum);
            break;
          case 'bolus':
            simulator.bolus(datum);
            break;
          case 'deviceEvent':
            if (datum.subType === 'status') {
              if (datum.status === 'suspended') {
                simulator.suspend(datum);
              }
              else if (datum.status === 'resumed') {
                simulator.resume(datum);
              }
              else {
                debug('Unknown deviceEvent status!', datum.status);
              }
            }
            else if (datum.subType === 'alarm') {
              simulator.alarm(datum);
            }
            else if (datum.subType === 'reservoirChange') {
              simulator.changeReservoir(datum);
            }
            else if (datum.subType === 'timeChange') {
              simulator.changeDeviceTime(datum);
            }
            else {
              debug('deviceEvent of subType ', datum.subType, ' not passed to simulator!');
            }
            break;
          case 'pumpSettings':
            simulator.pumpSettings(datum);
            break;
          case 'smbg':
            simulator.smbg(datum);
            break;
          case 'wizard':
            simulator.wizard(datum);
            break;
          default:
            debug('[Hand-off to simulator] Unhandled type!', datum.type);
        }
      }
      simulator.finalBasal();

      console.log('getEvents:',simulator.getEvents());


      progress(100);
      data.processData = true;
      cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      debug('STEP: uploadData');
      progress(0);

      //TODO: uploadData
      var sessionInfo = {
        deviceTags: ['insulin-pump'],
        deviceManufacturers: ['Animas'],
        deviceModel: data.settings.modelNumber,
        deviceSerialNumber: data.settings.serialNumber,
        deviceId: animasDeviceId,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version
      };

      console.log('sessionInfo:', sessionInfo);

      var postrecords = _.sortBy(data.postrecords, function(d) { return d.time; });

      console.log('postrecords:', postrecords);

      cfg.api.upload.toPlatform(
        simulator.getEvents(),
        sessionInfo,
        progress,
        cfg.groupId,
        function (err, result) {
          if (err) {
            debug(err);
            progress(100);
            return cb(err, data);
          } else {
            progress(100);
            return cb(null, data);
          }
      });

      progress(100);
      return cb(null, data);

    },

    disconnect: function (progress, data, cb) {
      debug('STEP: disconnect');
      progress(100);
      data.disconnect = true;
      cb(null, data);
  },

    cleanup: function (progress, data, cb) {
      debug('STEP: cleanup');
      cfg.deviceComms.clearPacketHandler();
      cfg.deviceComms.disconnect(function() {
        progress(100);
        data.cleanup = true;
        cb(null, data);
      });
    }
  };
};
