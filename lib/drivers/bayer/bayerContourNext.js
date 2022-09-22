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
 * Packet message format <STX> FN text <ETX> C1 C2 <CR> <LF>
 * */
var _ = require('lodash');
var async = require('async');
var sundial = require('sundial');
var crcCalculator = require('../../crc');
var struct = require('../../struct')();
var annotate = require('../../eventAnnotations');
var common = require('../../commonFunctions');
var debugMode = require('../../../app/utils/debugMode');
var constants = require('./bayerConstants');

var TZOUtil = require('../../TimezoneOffsetUtil');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('bows')('BCNextDriver') : debug;

module.exports = function (config) {
  var cfg = _.clone(config);
  var hidDevice = config.deviceComms;
  var HID_PACKET_SIZE = 64;
  var HEADER_SIZE = 3;
  var RETRIES = 6;
  // With no date & time settings changes available,
  // timezone is applied across-the-board
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);
  _.assign(cfg.deviceInfo, {
    tags : ['bgm'],
    manufacturers : ['Bayer', 'Ascensia']
  });

  var messageBuffer = {
    reset: function() {
      this.bytes = new Uint8Array(0);
      this.messageLength = 0;
      return this;
    },
    clone: function() {
      return _.clone(this);
    }
  }.reset();

  var probe = function(cb) {
    debug('attempting probe of Bayer Contour Next');
  };

  var extractPacketIntoMessage = function (bytes) {
    var packet_len = struct.extractByte(bytes, 0);
    var bytes_len = bytes.length - 1;
    if (bytes_len < packet_len) {
      packet_len = bytes_len;
    }
    if(debugMode.isDebug) {
      debug('Packet length:', packet_len);
    }

    // copying to a buffer in case there are multiple packets for one message
    // also discards the length byte from the beginning
    var tmpbuff = new Uint8Array(messageBuffer.messageLength + packet_len);
    struct.copyBytes(tmpbuff, 0, messageBuffer.bytes, messageBuffer.messageLength, 0);
    struct.copyBytes(tmpbuff, messageBuffer.messageLength, bytes, packet_len, 1);
    messageBuffer.bytes = tmpbuff;
    messageBuffer.messageLength += packet_len;
    messageBuffer.lastPacketSize = packet_len;

    return messageBuffer;
  };

  var buildPacket = function (command, cmdlength) {
    var datalen = cmdlength + 4; // we use 4 bytes because we add 3 bytes for
                                 // the header and 1 byte for the length of
                                 // the payload
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);
    var ctr = HEADER_SIZE; // skip header which can be left blank
    if (cmdlength) {
      ctr += struct.pack(bytes, ctr, 'b', cmdlength);
      ctr += struct.copyBytes(bytes, ctr, command, cmdlength);
    }
    debug('Sending bytes:', common.bytes2hex(bytes));

    return buf;
  };

  var buildAckPacket = function() {
    return buildPacket([constants.ASCII_CONTROL.ACK], 1);
  };

  var buildNakPacket = function() {
    return buildPacket([constants.ASCII_CONTROL.NAK], 1);
  };

  // header data looks like
  /*
  <STX>1H|\^&||qvqOi8|Bayer7350^01.14\01.03\04.18^7358-1611135^0000-
  |A=1^C=00^G=es,en\es\it\de\fr\hr\da\nl\fi\el\no\pt\sl\sv^I=0200^R=
  0^S=01^U=0^V=20600^X=070070070180130180070130^Y=120054252099^Z=1|4
  |||||P|1|201505291248<ETB>01<CR><LF>
  */

  var parseHeader = function (header, callback) {
    var pString = header.split('|');
    var pInfo = pString[4].split('^');

    // serial number can be in two formats:
    // 6301-1C2CF8C -> C2CF8C
    // 7830H5001733 -> 5001733
    var sNum = pInfo[2].match(/^\d+[\w-]\s*(\w+)/);
    var threshold = null;
    var units = null;
    var thrs = pString[5].split('^');

    for (var i = 0; i < thrs.length; i++) {
      var val = thrs[i].match(/^(\w+)\=/);
      if (val[1] === 'V') {
        threshold = thrs[i].match(/^.+\=(\d{2})(\d{3})/);
        break;
      }
      if (val[1] === 'U') {
        units = parseInt(thrs[i][2], 10);
      }
    }

    var jsDate = sundial.parseFromFormat(pString[13], 'YYYYMMDDhhmmss');

    var devInfo = {
      model: pInfo[0],
      serialNumber: sNum[1],
      nrecs: pString[6],
      deviceTime: sundial.formatDeviceTime(jsDate)
    };

    if(threshold) {
      devInfo.lowThreshold = parseInt(threshold[1], 10);
      devInfo.hiThreshold = parseInt(threshold[2], 10);
    } else {
      devInfo.unreportedThreshold = true;
      devInfo.lowThreshold = 20;
      devInfo.hiThreshold = 600;
    }

    if (units == 1) {
      // thresholds must always be in mg/dL
      devInfo.lowThreshold = common.convertToMgDl(devInfo.lowThreshold / 10.0);
      devInfo.hiThreshold = common.convertToMgDl(devInfo.hiThreshold / 10.0);
    }

    callback(null, devInfo);
  };

  /**
   * Calculates checksum for specified ASTM Frame.
   * @param {string} frame - The ASTM Frame to checksum
   * @return {string} Checksum value returned as a byte sized integer in hex base
   */
  function makeChecksum (frame) {
    var sum = frame.split('').reduce(function (previousValue, currentValue, currentIndex, array) {
      return (currentIndex == 1 ? previousValue.charCodeAt(0) : previousValue) + currentValue.charCodeAt(0);
    });
    return ('00' + (sum % 256).toString(16).toUpperCase()).substr(-2);
  }

  /**
   * Decodes complete ASTM message that is sent or received due
   * communication routines. It should contains checksum to be verified.
   * @param {string} message - The ASTM Message to decode
   * @return {Object} Object with the format:
   * {
   *  sequenceNumber: int,
   *  frame: string,
   *  checksum: string,
   * }
   * @throws {Error} if ASTM message is malformed or checksum verification fails.
   * TODO - return a listOfRecords, rather than a string with the whole frame? This would let us
   * dispense will all the RegExp parsing later on.
   */
  function decodeMessage (message) {

    debug('Message:', common.bytes2hex(message));

    var frameLength = message.length - 6; // Would normally be - 5, but we'll unpack the sequence number directly
    var response = struct.unpack(message, 0, 'bb'+frameLength+'Z2Z2Z', ['messageType', 'sequenceNumber', 'frame', 'checksum', 'CRLF']);
    if(response.messageType === constants.ASCII_CONTROL.STX) {
      // Turn sequenceNumber into an integer by subtracting ASCII ZERO (ie, 48) from it.
      response.sequenceNumber -= 48;
      var calculatedChecksum = makeChecksum(response.sequenceNumber + response.frame);
      if (calculatedChecksum !== response.checksum) {
        throw(new Error('Checksum failed. Expected ' + response.checksum + ', calculated ' + calculatedChecksum));
      }
    }

    // Discard the unnecessary response elements.
    delete response.CRLF;

    return response;
  }

  /* Record data looks like
  <STX>5R|3|^^^Glucose|93|mg/dL^P||A/M0/T1||201505261150<CR><ETB>74<CR><LF>
  */
  var parseDataRecord = function (data, callback) {
    // TODO - The NextLink 2.4 also includes seconds in its timestamp (14 digits)
    var result = data.match(/^R\|(\d+)\|\^\^\^Glucose\|([0-9.]+)\|(\w+\/\w+).*\|{2}(.*)\|{2}(\d{12}).*/);
    if (result != null) {
      result = result.slice(1, 6);
    }
    callback(null, result);
  };

  var getAnnotations = function (annotation, data) {
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
    var retry = 0;
    var robj = {};
    var cmd = buildAckPacket();
    var error = false;

    async.doWhilst(
      function (whilstCb) {
        bcnCommandResponse(cmd, false, function (err, record) {
          if (err) {
            if (err.name === 'TIMEOUT' || err.name === 'TypeError') {
              error = true;
              return whilstCb(err, null);
            } else {
              debug('Retrying..');
              retry++;
              cmd = buildNakPacket();
              return whilstCb(null);
            }
          } else {
            if  (record.messageType === constants.ASCII_CONTROL.ENQ) {
              debug('ENQ received, sending ACK..');
              return whilstCb(null);
            }
            var recordType = (record.messageType === constants.ASCII_CONTROL.STX) ?
              struct.extractByte(record.frame, 0) : record.messageType;

            robj.recordType = recordType;

            switch (recordType) {
              case 'R':
                parseDataRecord(record.frame, function(err, r) {
                  if (err) {
                    debug('Failure trying to read record', record.frame);
                    debug(err);
                    return whilstCb(err);
                  } else {
                    if(r) {
                      robj.timestamp = parseInt(r[4], 10);
                      robj.annotations = getAnnotations(r[3], data);
                      robj.control = isControl(r[3]);
                      robj.units = r[2];
                      if(robj.units === 'mmol/L') {
                        robj.glucose = parseFloat(r[1]);
                      } else {
                        robj.glucose = parseInt(r[1], 10);
                      }
                      robj.nrec = parseInt(r[0], 10);
                    }
                    return whilstCb(null);
                  }
                });
              break;
              case 'H':
                robj.header = record.frame;
                parseHeader(record.frame, function(err, result) {
                  if (err) {
                    debug('Invalid header data');
                    return whilstCb(new Error('Invalid header data'), null);
                  } else {
                    _.assign(robj, result);
                    return whilstCb(null);
                  }
                });
              break;
              case 'P':
              case 'L':
              case constants.ASCII_CONTROL.EOT:
              default:
                return whilstCb(null);
            }
          }
        });
      },
      function () { return (Object.getOwnPropertyNames(robj).length === 0 && retry < RETRIES) && !error; },
      function (err) {
        if (retry === RETRIES) {
          err = new Error('Communication retry limit reached');
        }
        if (err) {
          error = true;
          debug('Failure trying to talk to device.');
          debug(err);
          return callback(err, null);
        } else {
          callback(null, robj);
        }
      }
    );
  };

  var bcnCommandResponse = function (commandpacket, waitForENQ, callback) {
    hidDevice.send(commandpacket, function (err) {
      if (err) {
        return callback(err, null);
      }
      getMessage(5000, waitForENQ, function(err, result) {
        if (err) {
          messageBuffer.reset();
          return callback(err, null);
        } else {
            var message = null;
            try {
              message = decodeMessage(result.bytes);
            } catch (err) {
              messageBuffer.reset();
              debug('Error:', err);
              return callback(err, null);
            }
            messageBuffer.reset();
            callback(null, message);
        }
      });
    });
  };

  var getMessage = function (timeout, waitForENQ, cb) {
    var done = false;

    var abortTimer = setTimeout(function () {
      debug('TIMEOUT');
      var e = new Error('Timeout error.');
      done = true;
      e.name = 'TIMEOUT';
      return cb(e, null);
    }, timeout);

    var message;

    async.doWhilst(
      function (callback) {
        var processPacket = function(packet) {
          // Only process if we get data
          if (packet.length === 0) {
            return callback(false);
          }

          if(debugMode.isDebug) {
            debug('Raw packet received:', common.bytes2hex(packet));
          }
          message = extractPacketIntoMessage(packet.slice(HEADER_SIZE));

          var packetHead = struct.unpack(packet, 0, '3Z2b', ['HEADER', 'SIZE', 'BYTE1']);

          // The tail of the packet starts 6 from the end, but because we haven't stripped the
          // header and length byte from packet, we're using SIZE - 2
          var packetTail = struct.unpack(packet, parseInt(packetHead.SIZE, 10) - 2, '2b2Z2Z', ['CR', 'FRAME_TYPE', 'CHECKSUM', 'CRLF']);
          // HID_PACKET_SIZE - 4, because we don't include the header or size
          if(waitForENQ) {
            if (packetHead.BYTE1 == constants.ASCII_CONTROL.ENQ) {
              clearTimeout(abortTimer);
              return callback(true);
            }
          } else if(packetHead.SIZE < (HID_PACKET_SIZE - 4) ||
              packetHead.BYTE1 == constants.ASCII_CONTROL.ENQ ||
              packetHead.BYTE1 == constants.ASCII_CONTROL.EOT ||
              packetHead.BYTE1 == constants.ASCII_CONTROL.ACK ||
              packetTail.FRAME_TYPE == constants.ASCII_CONTROL.ETX ||
              packetTail.FRAME_TYPE == constants.ASCII_CONTROL.ETB) {
              clearTimeout(abortTimer);
              return callback(true);
          }
          return callback(false);
        };

        var packet = null;

        hidDevice.receive(function(err, raw) {
          if (err) {
            clearTimeout(abortTimer);
            return cb(err, null);
          }
          packet = new Uint8Array(raw);
          processPacket(packet);
        });
      },
      function (valid) {
        return (valid !== true && done !== true);
      },
      function () {
        if(done) {
          // callback has already been called, just return
          return;
        }
        return cb(null, message);
      }
    );
  };

  var processReadings = function(readings) {
    _.each(readings, function(reading, index) {
      var dateTime = sundial.parseFromFormat(reading.timestamp, 'YYYYMMDDHHmm');
      readings[index].displayTime = sundial.formatDeviceTime(new Date(dateTime).toISOString());
      var utcInfo = cfg.tzoUtil.lookup(dateTime);
      readings[index].displayUtc = utcInfo.time;
      readings[index].timezoneOffset = utcInfo.timezoneOffset;
      readings[index].conversionOffset = utcInfo.conversionOffset;
    });
  };

  var prepBGData = function (progress, data) {
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

  var setDateTime = function(serverTime, cb) {
    var ACK_ERROR = 'Expected ACK during connect:';

    async.series({

      ack: function(callback) {
        // at least one meter (Contour Next One) does not reply with an ACK
        // here, so we don't wait for a response
        hidDevice.send(buildPacket([constants.ASCII_CONTROL.ACK], 1), function (err) {
          if (err) {
            return callback(err, null);
          }
          callback(null, 'ack');
        });
      },
      eot: function(callback) {
        // The Contour Next/Plus One and Ascensia Contour Next meters do not expect EOT here
        if ((cfg.deviceInfo.model !== 'Contour Next One') &&
            (cfg.deviceInfo.model !== 'Contour Plus One') &&
            (cfg.deviceInfo.modelNumber !== 'Contour7900')) {
          bcnCommandResponse(buildPacket([constants.ASCII_CONTROL.EOT], 1), false, function (err, result) {
            if(err) {
              return cb(err, null);
            }
            callback(null, 'eot');
          });
        } else {
          callback(null, 'eot');
        }
      },
      nak: function(callback) {
        function sendNAK(cb) {
          bcnCommandResponse(buildPacket([constants.ASCII_CONTROL.NAK], 1), false, function(err, result) {
            if(err) {
              return cb(err, null);
            }
            if(result.messageType !== constants.ASCII_CONTROL.EOT) {
              return cb(new Error('Expected EOT.'), null);
            }
            cb(null, 'nak');
          });
        }

        async.retry({times: RETRIES, interval: 2000}, sendNAK, function(err, result) {
          callback(err, result);
        });
      },
      enq: function(callback) {
        bcnCommandResponse(buildPacket([constants.ASCII_CONTROL.ENQ], 1), false, function(err, result) {
          if(err) {
            return cb(err, null);
          }
          if(result.messageType !== constants.ASCII_CONTROL.ACK) {
            return cb(new Error(ACK_ERROR + 'ENQ'), null);
          }
          callback(null, 'enq');
        });
      },
      write: function(callback) {
        bcnCommandResponse(buildPacket(constants.COMMANDS.WRITE, 2), false, function(err, result) {
          if(err) {
            return cb(err, null);
          }
          if(result.messageType !== constants.ASCII_CONTROL.ACK) {
            return cb(new Error(ACK_ERROR + 'WRITE'), null);
          }
          callback(null, 'write');
        });
      },
      date: function(callback) {
        bcnCommandResponse(buildPacket(constants.COMMANDS.DATE, 2), false, function(err, result) {
          if(err) {
            return cb(err, null);
          }
          if(result.messageType !== constants.ASCII_CONTROL.ACK) {
            return cb(new Error(ACK_ERROR + 'DATE'), null);
          }
          callback(null, 'date');
        });
      },
      setDate: function(callback) {
        var newDate = [];
        struct.storeString(sundial.formatInTimezone(serverTime, cfg.timezone, 'YYMMDD|') + '\r', newDate, 0);
        bcnCommandResponse(buildPacket(newDate, 8), false, function(err, result) {
          if(err) {
            return cb(err, null);
          }
          if(result.messageType !== constants.ASCII_CONTROL.ACK) {

            if (result.messageType === constants.ASCII_CONTROL.NAK && cfg.deviceInfo.model.indexOf('Next Link') > 0) {
              debug('Device date/time controlled by pump');
              return cb('E_DATETIME_SET_BY_PUMP');
            }
            return cb(new Error(ACK_ERROR + 'SETDATE'), null);
          }
          callback(null, 'setDate');
        });
      },
      write2: function(callback) {
        bcnCommandResponse(buildPacket(constants.COMMANDS.WRITE, 2), false, function(err, result) {
          if(err) {
            return cb(err, null);
          }
          if(result.messageType !== constants.ASCII_CONTROL.ACK) {
            return cb(new Error(ACK_ERROR + 'WRITE2'), null);
          }
          callback(null, 'write2');
        });
      },
      time: function(callback) {
        bcnCommandResponse(buildPacket(constants.COMMANDS.TIME, 2), false, function(err, result) {
          if(err) {
            return cb(err, null);
          }
          if(result.messageType !== constants.ASCII_CONTROL.ACK) {
            return cb(new Error(ACK_ERROR + 'TIME'), null);
          }
          callback(null, 'date');
        });
      },
      setTime: function(callback) {
        var newTime = [];
        struct.storeString(sundial.formatInTimezone(serverTime, cfg.timezone, 'HHmm|') + '\r', newTime, 0);
        bcnCommandResponse(buildPacket(newTime, 6), false, function(err, result) {
          if(err) {
            return cb(err, null);
          }
          if(result.messageType !== constants.ASCII_CONTROL.ACK) {
            return cb(new Error(ACK_ERROR + 'SETTIME'), null);
          }
          callback(null, 'setTime');
        });
      }
    },
    function(err, results) {
      return cb(err, results);
    });
  };

  return {
    detect: function(deviceInfo, cb) {
      debug('no detect function needed');
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
      getOneRecord(data, function (err, result) {
          progress(100);
          if (!err) {
            data.connect = true;
            _.assign(data, result);
            return cb(null, data);
          } else {
            return cb(err, result);
          }
      });
    },

    fetchData: function (progress, data, cb) {
      debug('in fetchData', data);

      var recordType = null;
      var dataRecords = [];
      var error = false;

      async.whilst(
        // Get records from the meter until we get the Message Terminator Record (L)
        // The spec says that unless we get this, any preceding data should not be used.
        function () { return (recordType !== constants.ASCII_CONTROL.EOT && recordType !== 'L' && !error); },
        function (callback) {
          getOneRecord(data, function (err, result) {
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
            return cb(err, null);
          } else {
            cfg.deviceInfo.model = constants.MODELS[data.model];
            cfg.deviceInfo.modelNumber = data.model;
            if(cfg.deviceInfo.model == null) {
              cfg.deviceInfo.model = 'Unknown Bayer model';
            }
            if (cfg.deviceInfo.driverId === 'ContourPlus' && cfg.deviceInfo.model === 'Contour Next One') {
              // Contour Next One and Contour Plus One share the same model number,
              // so we distinguish between the two use the driver ID
              cfg.deviceInfo.model = 'Contour Plus One';
            }
            debug('Detected as: ', cfg.deviceInfo.model);

            debug('fetchData', dataRecords);
            // we have to read all the data before we can check the device time,
            // as in data transfer mode the meter will send everything it has
            cfg.deviceInfo.deviceTime = data.deviceTime;
            cfg.deviceInfo.serialNumber = data.serialNumber;
            cfg.deviceInfo.deviceId = data.model + '-' + data.serialNumber;
            cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId});
            common.checkDeviceTime(cfg, function(err2, serverTime) {
              if (err2) {
                if (err2 === 'updateTime') {
                  cfg.deviceInfo.annotations = 'wrong-device-time';
                  setDateTime(serverTime, function (err3) {
                    data.fetchData = true;
                    data.bgmReadings = dataRecords;
                    return cb(err3, data);
                  });
                } else {
                  cfg.deviceComms.removeListeners();
                  hidDevice.send(buildAckPacket(), function(err, result) {
                    progress(100);
                    return cb(err2, data);
                  });
                }
              } else {
                data.fetchData = true;
                data.bgmReadings = dataRecords;
                cb(err, data);
              }
            });
          }
        }
      );
    },

    processData: function (progress, data, cb) {
      debug('in processData');
      progress(0);
      data.bg_data = processReadings(data.bgmReadings);
      try {
        data.post_records = prepBGData(progress, data);
        var ids = {};
        for (var i = 0; i < data.post_records.length; ++i) {
          delete data.post_records[i].index; // Remove index as Jaeb study uses logIndices instead
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
      } catch(err) {
        cb(new Error(err), null);
      }
    },

    uploadData: function (progress, data, cb) {

      progress(0);
      var sessionInfo = {
        deviceTags: cfg.deviceInfo.tags,
        deviceManufacturers: cfg.deviceInfo.manufacturers,
        deviceModel: cfg.deviceInfo.model,
        deviceTime: cfg.deviceInfo.deviceTime,
        deviceSerialNumber: cfg.deviceInfo.serialNumber,
        deviceId: cfg.deviceInfo.deviceId,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName : cfg.timezone,
        version: cfg.version
      };

      if (cfg.deviceInfo.annotations) {
        annotate.annotateEvent(sessionInfo, cfg.deviceInfo.annotations);
      }

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
      cfg.deviceComms.removeListeners();
      // Due to an upstream bug in HIDAPI on Windoze, we have to send a command
      // to the device to ensure that the listeners are removed before we disconnect
      // For more details, see https://github.com/node-hid/node-hid/issues/61
      hidDevice.send(buildAckPacket(), function(err, result) {
        progress(100);
        cb(null, data);
      });
    },

    cleanup: function (progress, data, cb) {
      debug('in cleanup');
      if (!data.disconnect) {
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
