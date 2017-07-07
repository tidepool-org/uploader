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
 * communication and data format according to specification document "DOC33891_rev-A.docx":
 * SPECIFICATION, SERIAL COMMANDS FOR EXTERNAL VENDOR, FREESTYLE LIBRE, PROJECT 22175 READER
 * */


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
  var cfg = _.clone(config);
  var hidDevice = config.deviceComms;
  var messageBuffer = [];
  
  var HID_PACKET_SIZE = 64;
  var NUM_RETRIES = 6;
  var READ_TIMEOUT = 5000;

  // With no date & time settings changes available,
  // timezone is applied across-the-board
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

  var DEVICE_MODEL_NAME = 'FreeStyle Libre';
  var TEXT_COMMAND = 0x60;
  var TEXT_RESPONSE_FORMAT = new RegExp('^(.*\r\n)CKSM:([0-9A-F]{8})\r\nCMD (OK|Fail!)\r\n', 'm');

  var ASCII_CONTROL = {
    EOT : 0x04
  };

  var readResponse = function (commandType, timeout, cb) {
    var abortTimer = setTimeout(function () {
      debug('readResponse: TIMEOUT');
      var e = new Error('Timeout error.');
      e.name = 'TIMEOUT';
      return cb(e, null);
    }, timeout);

    var message = [];

    async.doWhilst(
      function (callback) {
        hidDevice.receive(function(raw) {
          // Only process if we get data
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

          message += raw.slice(packetHeadLength, packetHeadLength + packetHead['dataLen']);

          if (packetHead['dataLen'] <= HID_PACKET_SIZE - packetHeadLength) {
              clearTimeout(abortTimer);
              return callback(true);
          }
          return callback(false);
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
      });

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

  var sendCommand = function (command, response, data, cb) {
      debug('sendCommand: Sending command: ', command, ', data: ', data);
      hidDevice.send(buildPacket(command, data), function() {
        readResponse(response, READ_TIMEOUT, cb);
      });
  };

  var parseTextResponse = function(response) {
    var match = TEXT_RESPONSE_FORMAT.exec(response);
    if (!match) {
      return new Error('Invalid response format.');
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
      return new Error('Device response was not "OK", but "' + result + '"');
    }
  };

  var requestTextResponse = function(data, successCallback, errorCallback) {
      sendCommand(TEXT_COMMAND, TEXT_COMMAND, data, function (err, response) {
          if (err) {
            debug('requestTextResponse: error: ', err);
            return errorCallback(err, response);
          }

          debug('requestTextResponse: response: "' + response + '"');
          data = parseTextResponse(response);
          if (data instanceof Error) {
            return errorCallback(data, response);
          }
          return successCallback(data.replace(/\r\n$/, ''));
      });
  };

  var getDBRecordNumber = function(cb) {
      requestTextResponse('$dbrnum?', function (data) {
        var dbRecordNumberFormat = new RegExp('^DB Record Number = ([0-9]+)$');
        var match = dbRecordNumberFormat.exec(data);
        if (!match) {
          return cb(new Error('Invalid dbrnum response.'), data);
        }
        var dbRecordNumber = parseInt(match[1]);
        
        return cb(null, { dbRecordNumber: dbRecordNumber });
      }, cb);
  };

  var getFirmwareVersion = function(cb) {
      requestTextResponse('$swver?', function (data) {
        return cb(null, { firmwareVersion: data });
      }, cb);
  };

  var getSerialNumber = function(cb) {
      requestTextResponse('$sn?', function (data) {
        return cb(null, { serialNumber: data });
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

          //debug('getConfigInfo: result: ', result);
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
      cb(new Error('not yet implemented'), data);
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
