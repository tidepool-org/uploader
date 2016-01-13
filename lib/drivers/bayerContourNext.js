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

var TZOUtil = require('../TimezoneOffsetUtil');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('../bows')('BCNextDriver') : debug;


module.exports = function (config) {
  var cfg = _.clone(config);
  var hidDevice = config.deviceComms;
  var frameBuffer = [];
  var HID_PACKET_SIZE = 64;
  // With no date & time settings changes available,
  // timezone is applied across-the-board
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

  /*
   * TODO This info should be collected in the initial phase cause we can't assert if
   *      it is the same for all contour devices
   * */
  var MAGIC_HEADER = 'ABC';

  /* end */

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

  var astmFrameBuffer = {
    reset: function(){
      this.bytes = new Uint8Array(0);
      this.valid = false;
      this.frame_len = 0;
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
    debug('attempting probe of Bayer Contour Next');
  };

  // This is being used to reconstuct ASTM Frames
  var bcnASTMFrameHandler = function (buffer) {
    // Remove the MAGIC_HEADER from the front of the packet
    var discardCount = MAGIC_HEADER.length;
    buffer.discard(discardCount);

    if (buffer.len() === 0) { // Empty buffer, finish the data gathering
      return false;
    }

    var astmFrame = extractPacketIntoFrame(buffer.bytes());
    if (astmFrame.packet_len !== 0) {
      // cleanup the buffer data
      buffer.discard(HID_PACKET_SIZE - discardCount);
    }

    if (astmFrame.valid) {
      return astmFrameBuffer.clone();
    } else {
      return null;
    }
  };

  var extractPacketIntoFrame = function (bytes) {
    var packet_len = struct.extractByte(bytes, 0);
    var byte1 = struct.extractByte(bytes, 1);
    switch(byte1){
      case ASCII_CONTROL.EOT:
      case ASCII_CONTROL.ENQ:
        astmFrameBuffer.reset();
        astmFrameBuffer.setValid();
        break;
      case ASCII_CONTROL.STX:
        astmFrameBuffer.reset();
        break;
    }

    // Copy to the Frame Buffer, discabrding the length byte from the begining
    var tmpbuff = new Uint8Array(astmFrameBuffer.frame_len + packet_len);
    struct.copyBytes(tmpbuff, 0, astmFrameBuffer.bytes, astmFrameBuffer.frame_len, 0);
    struct.copyBytes(tmpbuff, astmFrameBuffer.frame_len, bytes, packet_len, 1);
    astmFrameBuffer.bytes = tmpbuff;
    astmFrameBuffer.frame_len += packet_len;

    // We're only using FRAME_TYPE for now, but we could use the other items for extra checks
    var packetTail = struct.unpack(astmFrameBuffer.bytes, astmFrameBuffer.frame_len - 6, '2b2Z2Z', ['CR', 'FRAME_TYPE', 'CHECKSUM', 'CRLF']);

    switch(packetTail['FRAME_TYPE']) {
      case ASCII_CONTROL.ETX: // Last ASTM Frame
      case ASCII_CONTROL.ETB: // End of valid ASTM Frame
        astmFrameBuffer.setValid();
        break;
    }

    return astmFrameBuffer;
  };

  var buildPacket = function (command, cmdlength) {
    var datalen = cmdlength + 4; // we used 4 bytes because we add (0x41 0x42 0x43 length)
                                 // if this value is changed the driver always returns the header
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);
    var ctr = struct.pack(bytes, 0, '3Z', MAGIC_HEADER );
    if (cmdlength) {
      ctr += struct.pack(bytes, ctr, 'bb', cmdlength, command);
    }
    return buf;
  };

  var buildAckPacket = function() {
    return buildPacket(ASCII_CONTROL.ACK, 1);
  };

  // header data looks like
  /*
  <STX>1H|\^&||qvqOi8|Bayer7350^01.14\01.03\04.18^7358-1611135^0000-
  |A=1^C=00^G=es,en\es\it\de\fr\hr\da\nl\fi\el\no\pt\sl\sv^I=0200^R=
  0^S=01^U=0^V=20600^X=070070070180130180070130^Y=120054252099^Z=1|4
  |||||P|1|201505291248<ETB>01<CR><LF>
  */

  var parseHeader = function (header){
    if(verifyChecksum(header)){
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
        nrecs: pString[6],
        rawrecords: [],
      };

      if(threshold){
        devInfo.lowThreshold = parseInt(threshold[1]);
        devInfo.hiThreshold = parseInt(threshold[2]);
      } else {
        devInfo.unreportedThreshold = true;
        devInfo.lowThreshold = 20;
        devInfo.hiThreshold = 600;
      }

      return devInfo;
    } else {
      return null;
    }
  };

  function verifyChecksum(record){
      var buf = new Uint8Array(struct.packString(record));
      var packetTail = struct.unpack(buf, record.length - 6, '2b2Z2Z', ['CR', 'ETB_OR_ETX', 'CHECKSUM', 'CRLF']);
      var data = record.split(String.fromCharCode(packetTail['ETX_OR_ETB']));
      var check = parseInt(packetTail['CHECKSUM'], 16);

      var sum = 0;
      var n = record.slice(0, record.length - 4);

      _.map(n, function(e){
          if(e.charCodeAt(0) !== ASCII_CONTROL.STX){
              sum += e.charCodeAt(0);
          }
      });

      if((sum % 256) !== check){
          return null;
      } else {
          return data[0];
      }
  }

  /* Record data looks like
  <STX>5R|3|^^^Glucose|93|mg/dL^P||A/M0/T1||201505261150<CR><ETB>74<CR><LF>
  */
  var parseDataRecord = function (str, callback){
    var data = verifyChecksum(str);
    if(data){
      // TODO - The NextLink 2.4 also includes seconds in its timestamp (14 digits)
      var result = data.match(/^[\x02]\dR\|(\d+)\|\^\^\^Glucose\|([0-9.]+)\|(\w+\/\w+).*\|{2}(.*)\|{2}(\d{12}).*/).slice(1,6);
      callback(null, result);
    } else {
      throw( new Error('Invalid record data') );
    }
  };

  var getAnnotations = function (annotation, data){
    var annInfo = [];

    if (data.unreportedThreshold) {
      annInfo.push({
        code: 'bayer/smbg/unreported-hi-lo-threshold'
      });
    }
    if (annotation.indexOf('>') !== -1) {

      annInfo.push({
        code: 'bg/out-of-range',
        threshold: data.hiThreshold,
        value: 'high'
      });

      return annInfo;
    } else if (annotation.indexOf('<') !== -1) {

      annInfo.push({
        code: 'bg/out-of-range',
        threshold: data.lowThreshold,
        value: 'low'
      });

      return annInfo;
    } else {
      return null;
    }
  };

  var isControl = function(markers) {
    if(markers.indexOf('C') !== -1) {
      debug('Marking as control test');
      return true;
    } else {
      return false;
    }
  };

  var getOneRecord = function (data, callback) {
    var cmd = buildAckPacket();
    bcnCommandResponse(cmd, function (err, record) {
      // TODO - add error handling
      // Skip over the STX and the sequence number.
      var record_type = struct.extractByte(record, 2);

      if(record_type === 'R'){
        parseDataRecord(record,function(err,r){
          var robj = {};
          if (err) {
            debug('Failure trying to read record', record);
            debug(err);
            return callback(err, null);
          } else {
            robj.timestamp = parseInt(r[4]);
            robj.annotations = getAnnotations(r[3], data);
            robj.control = isControl(r[3]);
            robj.units = r[2];
            if(robj.units === 'mmol/L') {
              robj.glucose = parseFloat(r[1]);
            } else {
              robj.glucose = parseInt(r[1]);
            }
            robj.nrec = parseInt(r[0]);
            return callback(null, robj);
          }
        });
      } else {
        return callback(null, null);
      }
    });
  };

  var debugFrame = function (astmFrame) {
    var output = astmFrame
      .replace(/[\x02]/g, '<STX>')
      .replace(/[\x03]/g, '<ETX>')
      .replace(/[\x04]/g, '<EOT>')
      .replace(/[\x05]/g, '<ENQ>')
      .replace(/[\x06]/g, '<ACK>')
      .replace(/[\x0A]/g, '<LF>')
      .replace(/[\x0D]/g, '<CR>')
      .replace(/[\x15]/g, '<NAK>')
      .replace(/[\x17]/g, '<ETB>');
    return output;
  };

  var bcnCommandResponse = function (commandpacket, callback) {
    hidDevice.send(commandpacket, function () {
      getASTMFrame(5000, 3, function(err) {
        if (err !== null || !hidDevice.hasAvailablePacket()) {
          // TODO - we should do retries here, depending on the error
          callback(err, null);
        } else {
          // We're using the hidDevice as a message/frame buffer, not a USB packet buffer
          // to save on buffer copying. It could be refactored differently easily enough.
          var frame = hidDevice.nextPacket();
          // TODO - we should ideally check the validity of the ASTM frame (sequence number, checksum etc) here as well for retries
          //debug(debugFrame(frame.payload));
          callback(err, frame.payload);
        }
      });
    });
  };

  var getASTMFrame = function (timeout, retries, callback) {
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      debug('TIMEOUT');
      callback('TIMEOUT');
    }, timeout);

    var listenTimer = setInterval(function () {
      hidDevice.receive(function(raw) {
        var packet = new Uint8Array(raw);

        var packetHead = struct.unpack(packet, 0, '3Z2b', ['HEADER', 'SIZE', 'BYTE1']);

        if(packetHead['HEADER'] != MAGIC_HEADER){
          debug('Invalid packet from Contour device');
          callback('INVALID_USB_PACKET');
        }

        // The tail of the packet starts 6 from the end, but because we haven't stripped the
        // MAGIC_HEADER and length byte from packet, we're using SIZE - 2
        var packetTail = struct.unpack(packet, parseInt(packetHead['SIZE']) - 2, '2b2Z2Z', ['CR', 'FRAME_TYPE', 'CHECKSUM', 'CRLF']);

        // HID_PACKET_SIZE - 4, because we don't include the MAGIC_HEADER or the SIZE
        if( packetHead['SIZE'] < ( HID_PACKET_SIZE - 4 ) ||
            packetHead['BYTE1'] == ASCII_CONTROL.EOT ||
            packetHead['BYTE1'] == ASCII_CONTROL.ENQ ||
            packetTail['FRAME_TYPE'] == ASCII_CONTROL.ETX ||
            packetTail['FRAME_TYPE'] == ASCII_CONTROL.ETB ) {
            clearTimeout(abortTimer);
            clearInterval(listenTimer);
            callback(null);
        }
      });
    }, 20); // The Contour timeout is 15 seconds, but let's be slow enough to be kind to the CPU.
  };

  var getDeviceInfo = function (obj, cb) {
    debug('DEBUG: in getDeviceInfo');
    var cmd = buildAckPacket();
    bcnCommandResponse(cmd, function (err, datatxt) {
      if (err) {
        debug('Failure trying to talk to device.');
        debug(err);
        debug(datatxt);
        cb(null, null);
      } else {
        obj.header = datatxt;
        var header = parseHeader(datatxt);
        if(header){
          _.assign(obj, header);
          cb(null, obj);
        } else {
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
      var utcInfo = cfg.tzoUtil.lookup(dateTime);
      readings[index].displayUtc = utcInfo.time;
      readings[index].timezoneOffset = utcInfo.timezoneOffset;
      readings[index].conversionOffset = utcInfo.conversionOffset;
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
        if(datum.control === true) {
          debug('Discarding control');
          continue;
        }
        var smbg = cfg.builder.makeSMBG()
          .with_value(datum.glucose)
          .with_deviceTime(datum.displayTime)
          .with_timezoneOffset(datum.timezoneOffset)
          .with_conversionOffset(datum.conversionOffset)
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
    } else {
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

      cfg.deviceComms.connect(data.deviceInfo, bcnASTMFrameHandler, probe, function(err) {
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
          } else {
              cb(err,result);
          }
      });
    },

    fetchData: function (progress, data, cb) {
      debug('in fetchData', data);

      function getOneRecordWithProgress(recnum, cb) {
        progress(100.0 * recnum / data.nrecs);
        setTimeout(function() {
          getOneRecord(data, cb);
        }, 20);
      }

      // FIXME - We're adding +1 to skip the Patient Record (P)
      async.timesSeries(parseInt(data.nrecs)+1, getOneRecordWithProgress, function(err, result) {
        if (err) {
          debug('fetchData failed');
          debug(err);
          debug(result);
        } else {
          // FIXME - delete the null record at the front for the patient record.
          result.splice(0,1);
          debug('fetchData', result);
        }
        data.fetchData = true;
        data.bgmReadings = result;
        progress(100);
        cb(err, data);
      });
    },

    processData: function (progress, data, cb) {
        //debug('in processData');
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
      } else {
        progress(100);
      }
    }
  };
};
