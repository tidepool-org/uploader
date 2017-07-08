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

/*
*** FreeStyle Libre communication via USB HID ***

*** HID DATA TRANSFER ***
- HID reports are used to encapsulate the text and the binary protocol
- HID report frames always have 64 bytes

2 bytes HEADER: 
  1 byte COMMAND
  1 byte DATA_LENGTH (excluding header size, so valid range is 0-62)

62 bytes DATA:
  DATA_LENGTH bytes actual data
  (62 - DATA_LENGTH) bytes to fill the rest of the frame (may contain garbage)


*** TEXT PROTOCOL ***

TEXT REQUEST:
- requests start with COMMAND = 0x60
COMMAND DATA_LENGTH DATA
|-      |-          |----------------
0x60    0xll        MESSAGE       SEP
                    |--------     |--' + '
                    $command?     \r\n

TEXT RESPONSE:
- start with COMMAND = 0x60
- can span multiple HID frames, ending with STATUS ("CMD OK" or "CMD Fail!")
- lines are separated by SEP: "\r\n" (0x0a 0x0d)
- MESSAGE is followed by CHECKSUM and STATUS, each in its one line
- all bytes after (2 + DATA_LENGTH) bytes need to be ignored, as it can contain garbage from previous messages
COMMAND DATA_LENGTH DATA
|-      |-          |------------------------------------------------------------------------
0x60    0xll        MESSAGE       SEP   CHECKSUM            SEP   STATUS                  SEP
                    |--------     |--   |-------------      |--   |------                 |--
                    message...    \r\n  "CKSM:[0-9A-F]{8}"  \r\n  "CMD OK" or "CMD Fail!" \r\n


*** BINARY PROTOCOL ***

- ABMP: ADC Binary 22175 communication Meter Protocol
  - ATP:  ABMP Transport Protocol
    - AAP:  ABMP Application Protocol

ATP frames:
- can contain multiple AAP frames of only parts of one

AAP frames:
- PAYLOAD_LENGTH: 1 to 3 bytes 
  - if high bit is set, the lower 7 bits are of the length -> max 21 bits for length
  - if not, this byte is already the command byte
- COMMAND: 1 byte (high bit is 0)
- PAYLOAD_DATA: up to 2MB spread over multiple ATP frames

BINARY REQUEST:
- exactly one AAP frame

BINARY RESPONSE:
- can span multiple AAP frames

*/


var _ = require('lodash');
var async = require('async');
var sundial = require('sundial');
var crcCalculator = require('../../crc.js');
var struct = require('../../struct.js')();
var annotate = require('../../eventAnnotations');

var TZOUtil = require('../../TimezoneOffsetUtil');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('bows')('FreeStyleLibreDriver') : console.log;

module.exports = function (config) {
  var DEVICE_MODEL_NAME = 'FreeStyle Libre';

  var cfg = _.clone(config);
  var hidDevice = config.deviceComms;
  var messageBuffer = [];
  
  var HID_PACKET_SIZE = 64;
  var NUM_RETRIES = 6;
  var READ_TIMEOUT = 5000;

  // With no date & time settings changes available,
  // timezone is applied across-the-board
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

  //
  // regular expressions for matching text protocol responses
  //
  var TEXT_CHECKSUM_FORMAT = 'CKSM:([0-9A-F]{8})\r\n';
  var TEXT_STATUS_FORMAT = 'CMD (OK|Fail!)\r\n';
  var TEXT_STATUS_REGEX = new RegExp(TEXT_STATUS_FORMAT);
  // in javascript RegExp "[^]*" has to be used instead of ".*" to match all chars over multiple lines
  // the multiline flag /s/ does not exist, so ".*" will never match newlines
  var TEXT_RESPONSE_REGEX = new RegExp('^([^]*)' + TEXT_CHECKSUM_FORMAT + TEXT_STATUS_FORMAT);

  var DB_RECORD_NUMBER_REGEX = new RegExp('^DB Record Number = ([0-9]+)\r\n$');

  // after db record responses (e.g. $arresult?, $history?) an additional line is send,
  // containing the record count and an additional checksum of just the records:
  // COUNT,RECORD_CHECKSUM\r\n
  var DB_RECORDS_REGEX = new RegExp('^([^]*\r\n)([0-9]+),([0-9A-F]{8})\r\n$');

  var COMMAND = {
    TEXT : 0x60
  };

  var ASCII_CONTROL = {
    EOT : 0x04
  };

  var readResponse = function (commandType, timeout, cb) {
    var abortTimer = null;
    var resetTimeout = function() {
      if (abortTimer !== null) {
        clearTimeout(abortTimer);
      }
      abortTimer = setTimeout(function () {
        debug('readResponse: TIMEOUT');
        var e = new Error('Timeout error.');
        e.name = 'TIMEOUT';
        return cb(e, null);
      }, timeout);
    };

    var message = '';

    async.doWhilst(
      function (callback) {
        resetTimeout();
        hidDevice.receive(function(raw) {
          // if we did not get any data, continue receiving
          if (raw === undefined || raw.length === 0) {
            return callback(false);
          }
          debug('readResponse: received: ' + raw.length + ': "' + raw + '"');

          var packetHeadStruct = 'bb';
          var packetHeadLength = struct.structlen(packetHeadStruct);
          var packetHead = struct.unpack(raw, 0, packetHeadStruct, ['commandType', 'dataLen']);
          debug('readResponse: packetHead: type: ' + packetHead['commandType'] + ', len: ' + packetHead['dataLen']);

          if (commandType !== null && packetHead['commandType'] !== commandType) {
            debug('readResponse: Invalid packet from ' + DEVICE_MODEL_NAME);
            clearTimeout(abortTimer);
            return callback(new Error('Invalid USB packet received.'));
          }

          // append newly received data to message string
          message += raw.slice(packetHeadLength, packetHeadLength + packetHead['dataLen']);

          // if this was a text command and the status line is not in the received data yet, continue receiving
          if (commandType === COMMAND.TEXT && !TEXT_STATUS_REGEX.exec(message)) {
            return callback(false);
          }

          // data reception is complete
          clearTimeout(abortTimer);
          return callback(true);
        });
      },
      function (isValid) {
        if (isValid instanceof Error) {
          return cb(isValid, null);
        }
        return (isValid !== true);
      },
      function () {
        return cb(null, message);
      }
    );
  };

  var validateChecksum = function(data, expectedChecksum) {
    var calculatedChecksum = data.split('')
      .reduce(function(a, b) { return a + b.charCodeAt(0); }, 0);
    debug('validateChecksum: checksum: ' + calculatedChecksum + ' ?= ' + expectedChecksum);
    return calculatedChecksum == expectedChecksum;
  };

  var buildPacket = function (commandType, data) {
    var packetLen = 2 + data.length;
    var buf = new ArrayBuffer(HID_PACKET_SIZE);
    var bytes = new Uint8Array(buf, 0, HID_PACKET_SIZE);
    var counter = struct.pack(bytes, 0, 'bb', commandType, data.length);
    if (data.length) {
      counter += struct.pack(bytes, counter, data.length + 'Z', data);
    }
    return buf;
  };

  var sendCommand = function (command, responseData, data, cb) {
    debug('sendCommand: Sending command: ', command, ', data: ', data);
    hidDevice.send(buildPacket(command, data), function() {
      readResponse(responseData, READ_TIMEOUT, cb);
    });
  };

  var parseTextResponse = function(responseData) {
    var match = TEXT_RESPONSE_REGEX.exec(responseData);
    if (!match) {
      return new Error('Invalid text responseData format.');
    }
    var data = match[1];
    var checksum = parseInt(match[2], 16);
    var result = match[3];

    if (result === 'OK') {
      if (validateChecksum(data, checksum)) {
        return data;
      } else {
        return new Error('Invalid checksum.');
      }
    } else {
      return new Error('Device responseData was not "OK", but "' + result + '"');
    }
  };

  var requestTextResponse = function(command, successCallback, errorCallback) {
    sendCommand(COMMAND.TEXT, COMMAND.TEXT, command + '\r\n', function (err, responseData) {
      if (err) {
        debug('requestTextResponse: error: ', err);
        return errorCallback(err, responseData);
      }

      debug('requestTextResponse: responseData: "' + responseData + '"');
      var data = parseTextResponse(responseData);
      if (data instanceof Error) {
        return errorCallback(data, responseData);
      }
      return successCallback(data);
    });
  };

  var getDBRecords = function(command, successCallback, errorCallback) {
    debug('getDBRecords: ' + command);
    requestTextResponse(command, function (data) {
      var match = DB_RECORDS_REGEX.exec(data);
      if (!match) {
        return errorCallback(new Error('Invalid response format for database records.'), data);
      }
      var dbRecords = match[1];
      var dbRecordCount = parseInt(match[2]);
      var dbRecordChecksum = parseInt(match[3], 16);

      if (!validateChecksum(dbRecords, dbRecordChecksum)) {
        return errorCallback(new Error('Invalid database record checksum.'), data);
      }

      dbRecords = dbRecords.replace(/\r\n$/, '').split('\r\n');

      if (dbRecordCount != dbRecords.length) {
        return errorCallback(new Error('Invalid database record count: ' + dbRecordCount + ' != ' + dbRecords.length), data);
      }

      successCallback(null, dbRecords);
    }, errorCallback);
  };

  var getReaderResultData = function(cb) {
    getDBRecords('$arresult?', function (data) {
      cb(null, { readerResultData: data });
    }, cb);
  };

  var getHistoricalScanData = function(cb) {
    getDBRecords('$history?', function (data) {
      cb(null, { historicalScanData: data });
    }, cb);
  };

  var getDBRecordNumber = function(cb) {
    var command = '$dbrnum?';
    requestTextResponse(command, function (data) {
      var match = DB_RECORD_NUMBER_REGEX.exec(data);
      if (!match) {
        return cb(new Error('Invalid response format for database record number.'), data);
      }
      var dbRecordNumber = parseInt(match[1]);
      
      cb(null, { dbRecordNumber: dbRecordNumber });
    }, cb);
  };

  var getFirmwareVersion = function(cb) {
    requestTextResponse('$swver?', function (data) {
      cb(null, { firmwareVersion: data.replace(/\r\n$/, '') });
    }, cb);
  };

  var getSerialNumber = function(cb) {
    requestTextResponse('$sn?', function (data) {
      cb(null, { serialNumber: data.replace(/\r\n$/, '') });
    }, cb);
  };

  var initCommunication = function(cb) {
    var initFunctions = [
      function(cb) { sendCommand(0x04, null, '', cb); },
      function(cb) { sendCommand(0x05, null, '', cb); },
      function(cb) { sendCommand(0x15, null, '', cb); },
      function(cb) { sendCommand(0x01, null, '', cb); },
    ];
    async.series(initFunctions, function(err, result) {
      cb(err, result);
    });
  };

  var probe = function(cb){
    debug('probe: not using probe for ' + DEVICE_MODEL_NAME);
    cb();
  };

  return {
    detect: function(deviceInfo, cb){
      debug('detect: no detect function needed', arguments);
      cb(null, deviceInfo);
    },

    setup: function (deviceInfo, progress, cb) {
      debug('in setup');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      debug('in connect');

      cfg.deviceComms.connect(data.deviceInfo, probe, function(err) {
        if (err) {
          return cb(err);
        }
        initCommunication(function(err, result) {
          // ignore results of init as it seems not to be relevant to the following communication
          data.disconnect = false;
          progress(100);
          cb(null, data);
        });
      });
    },

    getConfigInfo: function (progress, data, cb) {
      debug('in getConfigInfo');
      progress(0);

      var getterFunctions = [
        getSerialNumber, 
        getFirmwareVersion, 
        getDBRecordNumber
      ];
      var counter = 0;
      async.series(getterFunctions, function(err, result) {
        counter += 1;
        progress(100 * (counter / getterFunctions.length));

        if (err) {
          debug('getConfigInfo: ', err);
          return cb(err, null);
        }
        data.connect = true;
        result.forEach(function(element) {
          if (typeof element === 'object') {
            debug('getConfigInfo: result object: ', element);
            _.assign(data.deviceInfo, element);
          }
        }, this);
        debug('getConfigInfo: data: ', data);

        cb(null, data);
      });
    },

    fetchData: function (progress, data, cb) {
      debug('in fetchData');
      progress(0);

      var getterFunctions = [
        getReaderResultData,
        //getHistoricalScanData
      ];

      data.dbRecords = {};
      var counter = 0;
      async.series(getterFunctions, function (err, results) {
        counter += 1;
        progress(100 * (counter / getterFunctions.length));

        if (err) {
          debug('fetchData: error: ', err);
          return cb(err, data);
        }
        results.forEach(function(element) {
          if (typeof element === 'object') {
            debug('fetchData: result object: ' + element);
            _.assign(data.dbRecords, element);
          }
        }, this);
        return cb(null, data);
      });
    },

    processData: function (progress, data, cb) {
      debug('in processData');
      progress(0);
      cb(new Error('not yet implemented'), data);
    },

    uploadData: function (progress, data, cb) {
      debug('in uploadData');
      progress(0);

      // TODO: enable acutal upload
      cb(new Error('not yet implemented'), data);
      /*
      var sessionInfo = {
        deviceTags: ['bgm', 'cgm'],
        deviceManufacturers: ['Abbott'],
        deviceModel: DEVICE_MODEL_NAME,
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
      */
    },

    disconnect: function (progress, data, cb) {
      debug('in disconnect');
      cfg.deviceComms.removeListeners();
      // Due to an upstream bug in HIDAPI on Windoze, we have to send a command
      // to the device to ensure that the listeners are removed before we disconnect
      // For more details, see https://github.com/node-hid/node-hid/issues/61
      hidDevice.send(buildPacket([ASCII_CONTROL.EOT], 1), function(err, result) {
        progress(100);
        cb(null, data);
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
