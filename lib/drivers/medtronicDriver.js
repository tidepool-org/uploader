/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2016, Tidepool Project
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
var crcCalculator = require('../crc.js');
var struct = require('../struct.js')();
var annotate = require('../eventAnnotations');
var TZOUtil = require('../TimezoneOffsetUtil');
var proc = require('../medtronic/processData');
var common = require('../commonFunctions');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('../bows')('MedtronicDriver') : debug;


module.exports = function (config) {
  var cfg = _.clone(config);
  var hidDevice = config.deviceComms;
  var messageBuffer = [];
  var HID_PACKET_SIZE = 64;
  var RETRIES = 6;
  var MAGIC_HEADER = 'ABC';

  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);  //FIXME

  var ASCII_CONTROL = {
    ACK : 0x06,
    CR : 0x0D,
    ENQ : 0x05,
    EOT : 0x04,
    ETB : 0x17,
    ETX : 0x03,
    LF : 0x0A,
    NAK : 0x15,
    STX : 0x02
  };

  var COMMANDS = {
    GET_WRITE : [0x57,0x7c], // W|
    GET_QUERY : [0x51,0x7c], // Q|
    GET_MAGIC : [0x31,0x7c], // 1|
    GET_END : [0x30,0x7c],   // 0|
    OPEN_CONNECTION : [0x10,0x01,0x1E]
  };

  var messageBuffer = {
    reset: function(){
      this.bytes = new Uint8Array(0);
      this.valid = false;
      this.messageLength = 0;
      this.payload = null;
      return this;
    },
    setValid: function(){
      this.payload = String.fromCharCode.apply(null, this.bytes);
      this.valid = true;
    },
    clone: function(){
      return _.clone(this);
    }
  }.reset();

  var probe = function(cb){
    debug('not probing Medtronic');
  };

  var extractPacketIntoMessage = function (bytes) {
    var packet_len = struct.extractByte(bytes, 0);
    var byte1 = struct.extractByte(bytes, 1);

    // copying to a buffer in case there are multiple packets for one message
    // also discards the length byte from the beginning
    var tmpbuff = new Uint8Array(messageBuffer.messageLength + packet_len);
    struct.copyBytes(tmpbuff, 0, messageBuffer.bytes, messageBuffer.messageLength, 0);
    struct.copyBytes(tmpbuff, messageBuffer.messageLength, bytes, packet_len, 1);
    messageBuffer.bytes = tmpbuff;
    messageBuffer.messageLength += packet_len;

    messageBuffer.setValid();

    return messageBuffer;
  };

  var buildPacket = function (command, cmdlength) {
    var datalen = cmdlength + 4;
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);

    var ctr = struct.pack(bytes, 0, 'bbbb', 0x00, 0x00, 0x00, cmdlength);
    ctr += struct.copyBytes(bytes, ctr, command, cmdlength);
    console.log('Sending bytes:', common.bytes2hex(bytes));
    return {
      command: buf,
      parser: function (packet) {
        //TODO: do we need to parse the first header packet for Bayer details?
        return null;
      }
    };
  };

  var buildAckPacket = function() {
    return buildPacket(ASCII_CONTROL.ACK, 1);
  };

  var buildNakPacket = function() {
    return buildPacket(ASCII_CONTROL.NAK, 1);
  };

  // header data looks like
  /*
  <STX>1H|\^&||qvqOi8|Bayer7350^01.14\01.03\04.18^7358-1611135^0000-
  |A=1^C=00^G=es,en\es\it\de\fr\hr\da\nl\fi\el\no\pt\sl\sv^I=0200^R=
  0^S=01^U=0^V=20600^X=070070070180130180070130^Y=120054252099^Z=1|4
  |||||P|1|201505291248<ETB>01<CR><LF>
  */

  var parseHeader = function (header, callback){
    var pString = header.split('|');
    var pInfo = pString[4].split('^');
    var sNum = pInfo[2].match(/^\d+\-\s*(\w+)/);
    var threshold = null;
    var thrs = pString[5].split('^');

    for (var i = 0; i < thrs.length; i++){
      var val = thrs[i].match(/^(\w+)\=/);
      if (val[1] === 'V'){
        threshold = thrs[i].match(/^.+\=(\d{2})(\d{3})/);
        break;
      }
    }

    var devInfo = {
      model: pInfo[0],
      serialNumber: sNum[1],
      nrecs: pString[6]
    };

    if(threshold){
      devInfo.lowThreshold = parseInt(threshold[1]);
      devInfo.hiThreshold = parseInt(threshold[2]);
    } else {
      devInfo.unreportedThreshold = true;
      devInfo.lowThreshold = 20;
      devInfo.hiThreshold = 600;
    }

    callback(null, devInfo);
  };

  function decodeMessage (parser, message) {

    var response = struct.unpack(message, 0, 'b', ['recordType']);
    _.assign(response, parser(message));

    return response;
  }

  var getOneRecord = function (cmd, waitForENQ, callback) {
    var retry = 0;
    var robj = {};
    var error = false;

    // TODO: use async.retry and send NAK
    bcnCommandResponse(cmd, waitForENQ, function (err, record) {
      if (err) {
          return callback(err, null);
      } else {
        console.log('Record:', record);
        return callback(null,record);
      }
    });
  };

  var bcnCommandResponse = function (commandpacket, waitForENQ, callback) {
    hidDevice.send(commandpacket.command, function () {
      getMessage(20000, waitForENQ, function(err, result) {
        if (err) {
          return callback(err, null);
        }
        var decoded = decodeMessage(commandpacket.parser, result.bytes);
        messageBuffer.reset();
        callback(null, decoded);
      });
    });
  };

  var getMessage = function (timeout, waitForENQ, cb) {
    var abortTimer = setTimeout(function () {
      debug('TIMEOUT');
      var e = new Error('Timeout error.');
      e.name = 'TIMEOUT';
      return cb(e, null);
    }, timeout);

    var message;
    var valid = false;

    async.doWhilst(
      function (callback) {
        hidDevice.receive(function(raw) {
          var packet = new Uint8Array(raw);
          console.log('Raw packet received:', common.bytes2hex(packet));
          message = extractPacketIntoMessage(packet.slice(MAGIC_HEADER.length));

          // Only process if we get data
          if ( packet.length === 0 ) {
            return callback(false);
          }

          var packetHead = struct.unpack(packet, 0, '3Z2b', ['HEADER', 'SIZE', 'BYTE1']);

          if(packetHead['HEADER'] !== MAGIC_HEADER){
            debug('Invalid packet from Contour device');
            clearTimeout(abortTimer);
            return callback(new Error('Invalid USB packet received.'));
          }

          // The tail of the packet starts 6 from the end, but because we haven't stripped the
          // MAGIC_HEADER and length byte from packet, we're using SIZE - 2
          var packetTail = struct.unpack(packet, parseInt(packetHead['SIZE']) - 2, '2b2Z2Z', ['CR', 'FRAME_TYPE', 'CHECKSUM', 'CRLF']);
          console.log('First byte:',packetHead['BYTE1']);
          console.log('Packet size:',packetHead['SIZE']);
          // HID_PACKET_SIZE - 4, because we don't include the MAGIC_HEADER or the SIZE
          if(waitForENQ) {
            if (packetHead['BYTE1'] == ASCII_CONTROL.ENQ) {
              clearTimeout(abortTimer);
              return callback(true);
            }
          } else if( packetHead['SIZE'] < ( HID_PACKET_SIZE - 4 ) ||
              packetHead['BYTE1'] == ASCII_CONTROL.ENQ ||
              packetHead['BYTE1'] == ASCII_CONTROL.EOT ||
              packetHead['BYTE1'] == ASCII_CONTROL.ACK ||
              packetTail['FRAME_TYPE'] == ASCII_CONTROL.ETX ||
              packetTail['FRAME_TYPE'] == ASCII_CONTROL.ETB ) {
              clearTimeout(abortTimer);
              return callback(true);
          }
          return callback(false);
        });
      },
      function (valid) {
        if(valid instanceof Error) {
          return cb(valid, null);
        }
        return (valid !== true);
      },
      function () {
          return cb(null, message);
      }
    );
  };

  var processReadings = function(readings) {
    _.each(readings, function(reading, index) {

    });
  };

  var openConnection = function () {
    return {
      command: proc.buildMedtronicPacket(
        COMMANDS.OPEN_CONNECTION,
        3,
        [],
        0
      ),
      parser: function (packet) {
        return null;
      }
    };
  };

  return {
    detect: function(deviceInfo, cb){
      debug('no detect function needed', arguments);
      cb(null, deviceInfo);
    },

    setup: function (deviceInfo, progress, cb) {
      debug('in setup!');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      debug('in connect!');

      cfg.deviceComms.connect(data.deviceInfo, probe, function(err) {
        if (err) {
          return cb(err);
        }
        data.disconnect = false;
        progress(100);
        cb(null, data);
      });
    },

    getConfigInfo: function (progress, data, cb) {
      debug('in getConfigInfo', data);

      var ACK_ERROR = 'Unexpected ACK during connect.';

      async.series({
        x : function(callback){
            getOneRecord(buildPacket([0x58],1), true, function (err, result) {
              if(err) {
                return cb(err,null);
              }
              callback(null, 'zero');
            });
        },
        nak : function(callback){
            getOneRecord(buildPacket([ASCII_CONTROL.NAK], 1), false, function(err, result) {
              if(err) {
                return cb(err,null);
              }
              if(result.recordType !== ASCII_CONTROL.EOT) {
                return cb(new Error('Expected EOT.'), null);
              }
              callback(null, 'one');
            });
        },
        enq : function(callback){
          getOneRecord(buildPacket([ASCII_CONTROL.ENQ], 1), false, function(err, result) {
            if(err) {
              return cb(err,null);
            }
            if(result.recordType !== ASCII_CONTROL.ACK) {
              return cb(new Error('Unexpected ACK during connect. ENQ'), null);
            }
            callback(null, 'two');
          });
        },
        write : function(callback){
          getOneRecord(buildPacket(COMMANDS.GET_WRITE, 2), false, function(err, result) {
            if(err) {
              return cb(err,null);
            }
            if(result.recordType !== ASCII_CONTROL.ACK) {
              return cb(new Error('Unexpected ACK during connect. WRITE'), null);
            }
            callback(null, 'three');
          });
        },
        query : function(callback){
          getOneRecord(buildPacket(COMMANDS.GET_QUERY, 2), false, function(err, result) {
            if(err) {
              return cb(err,null);
            }
            if(result.recordType !== ASCII_CONTROL.ACK) {
              return cb(new Error('Unexpected ACK during connect. QUERY'), null);
            }
            callback(null, 'four');
          });
        },
        magic : function(callback){
          getOneRecord(buildPacket(COMMANDS.GET_MAGIC, 2), false, function(err, result) {
            if(err) {
              return cb(err,null);
            }
            if(result.recordType !== ASCII_CONTROL.ACK) {
              return cb(new Error('Unexpected ACK during connect. MAGIC'), null);
            }
            callback(null, 'five');
          });
        },
        open_connection : function(callback){
          getOneRecord(openConnection(), false, function(err, result) {
            if(err) {
              return cb(err,null);
            }
            callback(null, 'six');
          });
        },
        model : function(callback){
          getOneRecord(proc.readModel(), false, function(err, result) {
            if(err) {
              return cb(err,null);
            }
            callback(null, {modelNumber: result.model});
          });
        }
    },
    function(err, results){
        progress(100);

        if(!err){
            data.connect = true;
            _.assign(data, results.model);
            return cb(null, data);
        } else {
            return cb(err,results);
        }
    });


    },

    fetchData: function (progress, data, cb) {
      debug('in fetchData', data);

      var recordType = null;
      var dataRecords = [];
      var error = false;
/*
      async.whilst(
        // Get records from the meter until we get the Message Terminator Record (L)
        // The spec says that unless we get this, any preceding data should not be used.
        function () { return (recordType !== ASCII_CONTROL.EOT && !error); },
        function (callback) {
          getOneRecord(buildPadata, function (err, result) {
            if (err) {
              error = true;
            } else {
              recordType = result.recordType;
              // We only collect data records (R)
              if (recordType === 'R' && result.timestamp) {
                progress(100.0 * result.nrec / data.nrecs);
                dataRecords.push(result);
              }
            }
            return callback(err);
          });
        },
        function (err) {
          progress(100);
          if(err || error) {
            data.bgmReadings = [];
          } else {
            debug('fetchData', dataRecords);
            data.bgmReadings = dataRecords;
          }
          data.fetchData = true;
          cb(err, data);
        }
      );
      */
      data.fetchData = true;
      cb(null, data);
    },

    processData: function (progress, data, cb) {
      //debug('in processData');
      progress(0);
      data.post_records = []; //FIXME
      progress(100);
      data.processData = true;
      cb(null, data);

    },

    uploadData: function (progress, data, cb) {
      progress(0);

      console.log("DATA:", data);

      var sessionInfo = {
        deviceTags: ['insulin-pump'],
        deviceManufacturers: ['Medtronic'],
        deviceModel: data.modelNumber,
        deviceSerialNumber: '', // FIXME
        deviceId: '123456', //FIXME
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName : cfg.timezone,
        version: cfg.version
      };

      cfg.api.upload.toPlatform(data.post_records, sessionInfo, progress, cfg.groupId, function (err, result) {
        progress(100);

        if (err) {
          debug(err);
          debug(result);
          return cb(err, data);
        } else {
          data.cleanup = true;
          return cb(null, data);
        }
      });

    },

    disconnect: function (progress, data, cb) {
      debug('in disconnect');
      progress(0);

      getOneRecord(buildPacket(COMMANDS.GET_WRITE, 2), false, function(err, result) {
        getOneRecord(buildPacket(COMMANDS.GET_QUERY, 2), false, function(err, result) {
          getOneRecord(buildPacket(COMMANDS.GET_END, 2), false, function(err, result) {
            getOneRecord(buildPacket([ASCII_CONTROL.EOT],1), false, function(err, result) {
              progress(100);
              cb(null, data);
            });
          });
        });
      });


    },

    cleanup: function (progress, data, cb) {
      debug('in cleanup');
      if(!data.disconnect){
          cfg.deviceComms.disconnect(data, function() {
              progress(100);
              data.cleanup = true;
              data.disconnect = true;
              cb(null, data);
          });
      } else {
        progress(100);
      }
    }
  };
};
