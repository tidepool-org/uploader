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

/**
 * IOET's code start here
 * packet frame format <STX> FN text <ETX> C1 C2 <CR> <LF>
 * */
var _ = require('lodash');
var async = require('async');
var sundial = require('sundial');
var crcCalculator = require('../crc.js');
var struct = require('../struct.js')();
var annotate = require('../eventAnnotations');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('../bows')('BCNextDriver') : debug;


module.exports = function (config) {
  var cfg = _.clone(config);
  var hidDevice = config.deviceComms;
  var HID_PACKET_SIZE = 64;

  /*
   * TODO This info should be collected in the initial phase cause we can't assert if
   *      it is the same for all contour devices
   * */
  var REPORT_BYTES = {
    reportID: 0x41, // A
    //checksum: 0x00, // Checksum is not been used by bayer contour device
    hostID  : 0x42, // B
    deviceID: 0x43  // C
  };

  /* end */

  var ASCII_CONTROL = {
    ACK : 0x06,
    NAK : 0x15,
    ENQ : 0x05,
    STX : 0x02,
    ETB : 0x17,
    ETX : 0x03,
    EOT : 0x04,
    TER : 0x4c
  };

  var probe = function(cb){
    debug('attempting probe of Bayer Contour Next');
  };

  var bcnPacketHandler = function (buffer) {
    var discardCount = _.keys(REPORT_BYTES).length;
    buffer.discard(discardCount);

    if (buffer.len() === 0) { //empty buffer finish the data gathering
      return false;
    }

    var packet = extractPacket(buffer.bytes());
    if (packet.packet_len !== 0) {
      // cleanup the buffer data
      buffer.discard(HID_PACKET_SIZE - discardCount);
    }

    if (packet.valid) {
      return packet;
    } else {
      return null;
    }
  };

  var buildPacket = function (command, cmdlength) {
    var datalen = cmdlength + 4; // We need just 5 bytes for now
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);
    var ctr = struct.pack(bytes, 0, 'bbb', REPORT_BYTES.reportID,
                          REPORT_BYTES.hostID, REPORT_BYTES.deviceID);
    if (cmdlength) {
      ctr += struct.pack(bytes, ctr, 'bb', cmdlength, command);
    }
    return buf;
  };

  var packetParser = function(result){
    var tostr = _.map(result.bytes,
                      function(e){
                        return String.fromCharCode(e);
                      }).join('');
    result.payload = tostr;
    return tostr;
  };

  var buildAckPacket = function() {
    return buildPacket(ASCII_CONTROL.ACK, 1);
  };

  var extractPacket = function (bytes) {
    var packet = {
      bytes: bytes,
      valid: false,
      packet_len: 0,
      payload: null
    };

    var plen = bytes.length;
    var packet_len = struct.extractByte(bytes, 0);

    if (packet_len > plen) {
      return packet;
    }

    //discard the length byte from the begining
    var tmpbuff = new ArrayBuffer(packet_len);
    struct.copyBytes(tmpbuff, 0, bytes, packet_len, 1);
    packet.bytes = tmpbuff;
    packet.packet_len = packet_len;
    packet.valid = true;

    return packet;
  };


  var buildHeaderCmd = function() {
    return {
      packet: buildAckPacket(),
      parser: packetParser
    };
  };

    //header data looks like
  /*
  <STX>1H|\^&||qvqOi8|Bayer7350^01.14\01.03\04.18^7358-1611135^0000-
  |A=1^C=00^G=es,en\es\it\de\fr\hr\da\nl\fi\el\no\pt\sl\sv^I=0200^R=
  0^S=01^U=0^V=20600^X=070070070180130180070130^Y=120054252099^Z=1|4
  |||||P|1|201505291248<ETB>01<CR><LF>
  */

  var parseHeader = function (s){
    var data = s.split('\n').filter(function(e){ return e !== '';});
    var header = data.shift();

    if(verifyChecksum(header)){
      var patient = data.shift();
      var lineFeed = data.pop();
      var pString = header.split('|');
      var pInfo = pString[4].split('^');
      var sNum = pInfo[2].match(/^\d+\-\s*(\w+)/);
      var records = data;
      var threshold = pString[5].split('^')[7].match(/^.+\=(\d{2})(\d{3})/);

      var devInfo = {
        model: pInfo[0],
        serialNumber: sNum[1],
        nrecs: pString[6],
        rawrecords: records,
        lowT: parseInt(threshold[1]),
        hiT: parseInt(threshold[2])
      };

      return devInfo;
    }else{
      return null;
    }
  };

  function verifyChecksum(record){
      var str = record.trim();
      var data = str.split(String.fromCharCode(ASCII_CONTROL.ETB));
      var check = data[1];
      var sum = 0;
      var n = record.slice(0, record.length - 3);

      _.map(n, function(e){
          if(e.charCodeAt(0) !== ASCII_CONTROL.STX){
              sum += e.charCodeAt(0);
          }
      });

      if((sum % 256) !== parseInt(check, 16)){
          return null;
      }else{
          return data[0];
      }
  }

  /* Record data looks like
  <STX>5R|3|^^^Glucose|93|mg/dL^P||A/M0/T1||201505261150<CR><ETB>74<CR><LF>
  */
  var parseDataRecord = function (str, callback){
    var data = verifyChecksum(str);
    if(data){
      var result = data.trim().match(/^.*\d+R\|(\d+).*Glucose\|(\d+)\|(\w+\/\w+).*\|{2}(.*)\|{2}(\d{12})$/).slice(1,6);
      callback(null, result);
    }else{
      throw( new Error('Invalid record data') );
    }

  };

  var getAnnotations = function (annotation, data){
    if (annotation.indexOf('>') !== -1) {
      return [{
        code: 'bg/out-of-range',
        threshold: data.hiT,
        value: 'high'
      }];
    } else if (annotation.indexOf('<') !== -1) {
      return [{
        code: 'bg/out-of-range',
        threshold: data.lowT,
        value: 'low'
      }];
    } else {
      return null;
    }
  };

  var getOneRecord = function (record, data, callback) {
    parseDataRecord(record,function(err,r){
      var robj = {};
      if (err) {
          debug('Failure trying to read record', record);
          debug(err);
          return callback(err, null);
      } else {
          robj.timestamp = parseInt(r[4]);
          robj.annotations = getAnnotations(r[3], data);
          robj.units = r[2];
          robj.glucose = parseInt(r[1]);
          robj.nrec = parseInt(r[0]);
          return callback(null, robj);
      }
    });
  };

  var bcnCommandResponse = function (commandpacket, callback) {

    hidDevice.send(commandpacket.packet, function () {
        receivePacket(5000, commandpacket.parser, function(err, packet) {
            var rawtext = '';
            while(hidDevice.hasAvailablePacket()){
                var pkt = hidDevice.nextPacket();
                pkt.parsed_payload = commandpacket.parser(pkt);
                rawtext += pkt.parsed_payload;
            }

            if (err !== 'TIMEOUT') {
              callback(err, rawtext);
            }else{
              debug('receivePacket timed out');
              callback(err, null);
            }
        });
    });
  };

  var receivePacket = function (timeout, parser, callback) {
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      debug('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(function () {
      hidDevice.receive(function(raw) {
          var r = new Uint8Array(raw);
          var startIndex = 0;
          var rec = struct.unpack(r, 6, 'b', ['TYPE']);
          var hasETB = _.indexOf(r, ASCII_CONTROL.ETB, startIndex);
          debug(rec);
          if(hasETB !== -1){
              // send a new ACK
              var cmd = buildAckPacket();
              hidDevice.send(cmd, function () {
                  debug('New ACK SENT');
              });

          }else if(rec.TYPE == ASCII_CONTROL.TER){
              clearTimeout(abortTimer);
              clearInterval(listenTimer);
              callback(null, '');
          }
        });
      }, 200);
  };

  var getDeviceInfo = function (obj, cb) {
      debug('DEBUG: on getDeviceInfo');
      var cmd = buildHeaderCmd();
      bcnCommandResponse(cmd, function (err, datatxt) {
          if (err) {
              debug('Failure trying to talk to device.');
              debug(err);
              debug(datatxt);
              cb(null, null);
          } else {
              obj.header = datatxt;
              if(parseHeader(datatxt)){
                _.assign(obj, parseHeader(datatxt));
                cb(null, obj);
              }else{
                debug('Invalid header data');
                throw(new Error('Invalid header data'));
              }
          }
      });
  };

  var processReadings = function(readings) {
    _.each(readings, function(reading, index) {
      var dateTime = sundial.parseFromFormat(reading.timestamp, 'YYYYMMDD HHmm');
      readings[index].displayTime = sundial.formatDeviceTime(new Date(dateTime).toISOString());
      readings[index].displayUtc = sundial.applyTimezone(readings[index].displayTime, cfg.timezone).toISOString();
      readings[index].displayOffset = sundial.getOffsetFromZone(readings[index].displayUtc, cfg.timezone);
    });
  };

  var prepBGData = function (progress, data) {
    //build missing data.id
    data.id = data.model + '-' + data.serialNumber;
    cfg.builder.setDefaults({ deviceId: data.id});
    var dataToPost = [];
    if (data.bgmReadings.length > 0) {
      for (var i = 0; i < data.bgmReadings.length; ++i) {
        var datum = data.bgmReadings[i];
        var smbg = cfg.builder.makeSMBG()
          .with_value(datum.glucose)
          .with_deviceTime(datum.displayTime)
          .with_timezoneOffset(datum.displayOffset)
          .with_time(datum.displayUtc)
          .with_units(datum.units)
          .set('index', datum.nrec)
          .done();
          if (datum.annotations) {
            _.each(datum.annotations, function(ann) {
              annotate.annotateEvent(smbg, ann);
            });
          }
        dataToPost.push(smbg);
      }
    }else{
      debug('Device has no records to upload');
      throw(new Error('Device has no records to upload'));
    }

    return dataToPost;
  };

  return {
    detect: function(deviceInfo, cb){
      debug('no detect function needed', arguments);
      cb(null, deviceInfo);
    },

    setup: function (deviceInfo, progress, cb) {
      console.log('in setup!');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      debug('in connect!');

      cfg.deviceComms.connect(data.deviceInfo, bcnPacketHandler, probe, function(err) {
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

      getDeviceInfo({}, function (err, result) {
          progress(100);

          if(!err){
              data.connect = true;
              _.assign(data, result);

              cb(null, data);
          }else{
              cb(err,result);
          }
      });
    },

    fetchData: function (progress, data, cb) {
      debug('in fetchData', data);

      function getOneRecordWithProgress(recnum, cb) {
        var rec = data.rawrecords.shift();
        progress(100.0 * recnum / data.nrecs);
        setTimeout(function() {
          getOneRecord(rec, data, cb);
        }, 20);
      }

      async.timesSeries(data.nrecs, getOneRecordWithProgress, function(err, result) {
        if (err) {
          debug('fetchData failed');
          debug(err);
          debug(result);
        } else {
          debug('fetchData', result);
        }
        data.fetchData = true;
        data.bgmReadings = result;
        progress(100);
        cb(err, data);
      });
    },

    processData: function (progress, data, cb) {
        progress(0);
        data.bg_data = processReadings(data.bgmReadings);
        data.post_records = prepBGData(progress, data);
        var ids = {};
        for (var i = 0; i < data.post_records.length; ++i) {
            delete data.post_records[i].index; //Remove index as Jaeb study uses logIndices instead
            var id = data.post_records[i].time + '|' + data.post_records[i].deviceId;
            if (ids[id]) {
                debug('duplicate! %s @ %d == %d', id, i, ids[id] - 1);
                debug(data.post_records[ids[id] - 1]);
                debug(data.post_records[i]);
            } else {
                ids[id] = i + 1;
            }
        }
        progress(100);
        data.processData = true;
        cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      progress(0);
      var sessionInfo = {
        deviceTags: ['bgm'],
        deviceManufacturers: ['Bayer'],
        deviceModel: 'Contour Next',
        deviceSerialNumber: data.serialNumber,
        deviceId: data.id,
        start: sundial.utcDateString(),
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
      progress(100);
      cb(null, data);
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
      }else{
        progress(100);
      }
    }
  };
};
