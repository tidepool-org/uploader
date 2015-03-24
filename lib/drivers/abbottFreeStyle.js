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
var async = require('async');
var sundial = require('sundial');
var struct = require('../struct.js')();
var annotate = require('../eventAnnotations');

module.exports = function (config) {
  var cfg = _.clone(config);
  cfg.deviceData = null;
  var serialDevice = config.deviceComms;

  var STX = 0x02;
  var ETX = 0x03;
  var CR = 0x0D;
  var LF = 0x0A;

  var dateTimePattern = '([A-Za-z ]{4} [0-3][0-9] [0-9]{4} ' +
                        '[012][0-9]:[0-5][0-9](?::[0-6][0-9])?)';
  function parseDateTime(match, index) {
    var fmt = 'MMMM DD YYYY HH:mm:ss';
    var parsed = sundial.parseFromFormat(match[index], fmt);
    var dev = sundial.formatDeviceTime(parsed);
    var utc = sundial.applyTimezone(dev, cfg.timezone).toISOString();
    var offset = sundial.getOffsetFromZone(utc, cfg.timezone);
    return { dev: dev, utc: utc, offset: offset };
  }

  var patterns = {
    serialNumber: {
      pattern: '^(?:[A-Z]-....-.....|[A-Z][A-Z][A-Z]....-.....|[XC][A-Z][GM]........)$',
      handler: function(match, packet) {
        packet.serialNumber = match[0];
      }
    },
    softwareVersion: {
      pattern: '^[0-9.]{4,13}$',
      handler: function(match, packet) {
        packet.softwareVersion = match[0];
      }
    },
    deviceTime: {
      pattern: '^' + dateTimePattern + '$',
      handler: function(match, packet) {
        var times = parseDateTime(match, 1);
        packet.deviceTime = times.dev;
        packet.time = times.utc;
      }
    },
    numEntries: {
      pattern: '^(?:[0-9]{3}|Log Empty)$',
      handler: function(match, packet) {
        packet.numEntries = parseInt(match[0], 10);
        if (_.isNaN(packet.numEntries)) {
          packet.numEntries = 0;
        }
      }
    },
    notFound: {
      pattern: '^Log Not Found$',
      handler: function(match, packet) {
        packet.notFound = true;
      }
    },
    end: {
      pattern: '^END$',
      handler: function(match, packet) {
        packet.end = true;
      }
    },
    ok: {
      pattern: '^CMD OK$',
      handler: function(match, packet) {
        packet.ok = true;
      }
    },
    fail: {
      pattern: '^CMD Fail!$',
      handler: function(match, packet) {
        packet.fail = true;
      }
    },
    logEntry: {
      pattern: '^([0-9HL][0-9OI][0-9 ])  ' + dateTimePattern + ' ([KG]) (0x[0-9A-Fa-f][0-9A-Fa-f])$',
      handler: function(match, packet) {
        var entry = {};
        var reading = match[1];

        var readingType = match[3];
        if (readingType === 'K') {
          entry.readingType = 'ketone';
        } else {
          entry.readingType = 'glucose';
        }

        if (reading == 'HI ') {
          if (readingType === 'K') {
            entry.reading = 180;  // this is a high of 10.0
            entry.annotations = [
              {code: 'ketone/out-of-range', value: 'high'},
              {code: 'ketone/unknown-value'}
            ];
          } else {
            entry.reading = 501;
            entry.annotations = [{
              code: 'bg/out-of-range',
              value: 'high',
              threshold: 500
            }];
          }
        } else if (reading == 'LO ') {
          // ketones can not be low
          entry.reading = 19;
          entry.annotations = [{
            code: 'bg/out-of-range',
            value: 'low',
            threshold: 20
          }];
        } else {
          entry.reading = parseInt(reading, 10);
        }

        entry.datetime = parseDateTime(match, 2);
        entry.status = parseInt(match[4], 16);   // this is in hex
        packet.logEntries.push(entry);
      }
    },
    checksum: {
      pattern: '^(0x[0-9A-F]{4})  END',
      handler: function(match, packet) {
        packet.receivedChecksum = parseInt(match[1], 16); // in hex
      }
    }
  };
  var logEntry = 'logEntry';


  // accepts a stream of bytes and tries to find a packet
  // at the beginning of it.
  // returns a packet object; if valid == true it's a valid packet
  // if packet_len is nonzero, that much should be deleted from the stream
  // if valid is false and packet_len is nonzero, the previous packet
  // should be NAKed.
  // don't call this if you don't have at least a few bytes available
  var extractPacket = function (bytes) {
    var packet = {
      bytes: bytes,
      valid: false,
      packet_len: 0,
      lcb: 0,
      lines: [],
      logEntries: []
    };

    // look for a terminating ETX
    var startIndex = 0;
    var endIndex = _.indexOf(bytes, ETX, startIndex + 1);
    if (endIndex === -1) {
      // didn't find end of packet, so bail for now
      return packet;
    }

    // we have what looks like a packet, so now's a good time to
    // calculate the checksum if we have one
    // first, we have to find the start of the checksum, if it exists.
    // let's convert the whole array to strings

    // I tried to do this with:
    // _.map(bytes, String.fromCharCode).join('');
    // but I kept getting semi-random characters in the resulting string, so I'm using this instead
    function stringFromBytes(bytes, start, end) {
      var s = '';
      for (var i=start; i<end; ++i) {
        s += String.fromCharCode(bytes[i]);
      }
      return s;
    }

    // this is a search for a fixed set of bytes within a larger block. It's not exactly
    // Boyer-Moore, but it'll do for now
    function searchForSequence(bytes, sequence) {
      var found = false;
      for (var ix=0; ix<bytes.length; ++ix) {
        found = true;
        for (var jx=0; jx<sequence.length; ++jx) {
          if (bytes[ix + jx] != sequence[jx]) {
            found = false;
            break;
          }
        }
        if (found) {
          return ix;
        }
      }
      return -1;
    }

    var checksumIndex = searchForSequence(bytes, [0x0D, 0x0A, 0x30, 0x78]); // \r\n0x
    checksumIndex += 2;   // we want the crlf in there
    if (checksumIndex !== -1) {
      var sum = 0;
      for (var i=startIndex; i<checksumIndex; ++i) {
        sum += bytes[i];
      }
      packet.calculatedChecksum = sum & 0xFFFF;   // it's a 16-bit sum
    }

    // record the length of the packet we found
    packet.packet_len = endIndex;

    // split up into lines by searching for '\r\n'
    var startLine = startIndex;
    while (startLine < endIndex) {
      var endLine = _.indexOf(bytes, CR, startLine);
      if (endLine === -1) {
        endLine = endIndex - 1;
      }
      if (bytes[endLine + 1] != LF) {
        // something borked, we should discard the packet
        console.log('hmmm...bad packet with CR but not LF', bytes);
        packet.packet_len = endLine;
        return packet;
      }

      // now we have the pointers around our line
      var line = stringFromBytes(bytes, startLine, endLine);
      packet.lines.push(line);
      startLine = endLine + 2;
    }

    // so now let's walk the array of lines looking for things we understand

    // put the logEntry pattern first so when we get to the list of log
    // entries, we don't waste a lot of time looking for other ones
    var patkeys = _.keys(patterns);
    _.remove(patkeys, function(k) { return k === logEntry; });
    patkeys.unshift(logEntry);

    // walk the lines in order, checking each possible pattern
    _.forEach(packet.lines, function(line, index) {
      var found = false;
      _.forEach(patkeys, function(key) {
        var m = line.match(patterns[key].pattern);
        if (m) {
          found = true;
          patterns[key].handler(m, packet);
        }
      });
      if (!found && line !== '') {
        console.log('No pattern match found for "' + line + '"');
      }
    });

    // now let's validate it
    packet.valid = true;
    if (packet.receivedChecksum && packet.receivedChecksum != packet.calculatedChecksum) {
      console.log('Failed checksum! rcv: ', packet.receivedChecksum, ' calc: ', packet.calculatedChecksum);
      packet.valid = false;
    }
    if (packet.numEntries && packet.logEntries.length !== packet.numEntries) {
      console.log('Entry count failure! num: ', packet.numEntries, ' found: ', packet.logEntries.length);
      packet.valid = false;
    }
    if (packet.fail) {
      packet.valid = false;
    }
    return packet;
  };

  var freeStyleErrorHandler = function(info) {
    if (info.connectionId && info.error) {
      if (info.error == 'timeout') {
        // whenever we get a timeout, we insert an ETX into the stream to separate packets
        return [ ETX ];    // this will never occur in a FreeStyle stream
      }
    }
  };

  // When you call this, it looks to see if a complete FreeStyle "packet" has
  // arrived and it calls the callback with it and strips it from the buffer.
  // It returns true if a packet was found, and false if not.
  var freeStyleMessageHandler = function (buffer) {
    // for efficiency reasons, we're not going to bother to ask the driver
    // to decode things that can't possibly be a packet
    // discard ETXs since they can never start a packet
    var discardCount = 0;
    while (buffer.len() > discardCount && buffer.get(0) == ETX) {
      ++discardCount;
    }

    if (discardCount) {
      buffer.discard(discardCount);
    }

    if (buffer.len() < 11) { // all complete packets must be at least this long
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

  var listenForPacket = function (timeout, parser, callback) {
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      console.log('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(function () {
      if (serialDevice.hasAvailablePacket()) {
        var pkt = serialDevice.nextPacket();
        // we always call the callback if we get a packet back,
        // so just cancel the timers if we do
        clearTimeout(abortTimer);
        clearInterval(listenTimer);
        pkt.parsed_payload = parser(pkt);
        callback(null, pkt);
      }
    }, 20);     // spin on this one quickly
  };

  // this sends a command, then waits for an ack and a response packet,
  // then calls the callback with the response packet
  var freeStyleCommandResponse = function (commandpacket, callback) {
    serialDevice.writeSerial(commandpacket.packet, function (err) {
      if (err) {
        callback(err, null);
      }
      // once we've sent the command, start listening for a response
      // but if we don't get one before the end of the timeout, give up
      // max timeout is 1000 * 32 bytes / 19200 baud / 10 bits/char == about 16 sec
      listenForPacket(18000, commandpacket.parser, function(err, result) {
        if (err === 'TIMEOUT') {
        } else {
          callback(err, result);
        }
      });
    });
  };

  var xtest = function() {
    return {
      packet: struct.packString('$xlog,1\r\n'),
      parser: function (result) {
        return result;
      }
    };
  };

  var xGetData = function() {
    return {
      packet: struct.packString('$xmem\r\n'),
      parser: function (result) {
        return result;
      }
    };
  };

  var getSerialNumber = function (obj, cb) {
    var cmd = xtest();
    freeStyleCommandResponse(cmd, function (err, result) {
      if (err) {
        console.log('Failure trying to talk to device.');
        console.log(err);
        console.log(result);
        cb(err, null);
      } else {
        _.assign(obj, _.pick(result, 'serialNumber', 'softwareVersion', 'deviceTime'));
        // we should add a serial number identification routine
        // that returns a better model ID (when we generalize this driver)
        obj.model = 'AbbFreePrecXtra';
        obj.id = obj.model + ' ' + obj.serialNumber;
        cb(null, obj);
      }
    });
  };

  var getAllData = function (obj, cb) {
    var cmd = xGetData();
    freeStyleCommandResponse(cmd, function (err, result) {
      if (err) {
        console.log('Failure trying to talk to device.');
        console.log(err);
        console.log(result);
        cb(err, null);
      } else {
        _.assign(obj, result);
        cb(null, obj);
      }
    });
  };

  var prepBGData = function (progress, data) {
    cfg.builder.setDefaults({ deviceId: data.id });
    var dataToPost = [];
    for (var i = 0; i < data.logEntries.length; ++i) {
      var datum = data.logEntries[i];
      if (datum.readingType === 'glucose') {
        var smbg = cfg.builder.makeSMBG()
          .with_value(datum.reading)
          .with_deviceTime(datum.datetime.dev)
          .with_timezoneOffset(datum.datetime.offset)
          .with_time(datum.datetime.utc)
          .with_units('mg/dL')
          .done();
        if (datum.annotations) {
          _.each(datum.annotations, function(ann) {
            annotate.annotateEvent(smbg, ann);
          });
        }
        dataToPost.push(smbg);
      } else if (datum.readingType === 'ketone') {
        // These meters store ketone values as 18 * the mmol/L value of the ketones
        // Because this is specific to these devices, we convert to mmol/L
        // in the driver, rounded to 2 decimal places.
        var ketoneValue = Math.round(100 * datum.reading / 18.0) / 100.0;
        var bloodKetone = cfg.builder.makeBloodKetone()
          .with_value(ketoneValue)
          .with_deviceTime(datum.datetime.dev)
          .with_timezoneOffset(datum.datetime.offset)
          .with_time(datum.datetime.utc)
          .done();
        if (datum.annotations) {
          _.each(datum.annotations, function(ann) {
            annotate.annotateEvent(smbg, ann);
          });
        }
        dataToPost.push(bloodKetone);
        console.log('ketone: ', bloodKetone);
      }
    }

    return dataToPost;
  };

  var probe = function (cb) {
    var cmd = xtest();
    freeStyleCommandResponse(cmd, function (err, result) {
      if (err) {
        console.log('Failure trying to talk to device.');
        console.log(err);
        console.log(result);
      }
      cb(err, result);
    });
  };

  return {
    // using the default detect for this driver
    // detect: function(cb) {
    // },

    // this function starts the chain, so it has to create but not accept
    // the result (data) object; it's then passed down the rest of the chain
    setup: function (deviceInfo, progress, cb) {
      console.log('in setup!');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      console.log('in connect!');
      var handlers = {
        packetHandler: freeStyleMessageHandler,
        errorHandler: freeStyleErrorHandler
      };

      cfg.deviceComms.connect(data.deviceInfo, handlers, probe, function(err) {
        if (err) {
          return cb(err);
        }
        getSerialNumber({}, function (err, result) {
          progress(100);
          data.connect = true;
          _.assign(data, result);
          console.log(data);
          cb(null, data);
        });
      });
    },

    getConfigInfo: function (progress, data, cb) {
      // get the number of records
      progress(100);
      cb(null, data);
    },


    fetchData: function (progress, data, cb) {
      console.log('in fetchData');
      getAllData({}, function (err, result) {
        progress(100);
        data.connect = true;
        console.log(result);
        data.logEntries = result.logEntries;
        data.numEntries = result.numEntries;
        cb(null, data);
      });
    },

    processData: function (progress, data, cb) {
      progress(0);
      data.post_records = prepBGData(progress, data);
      progress(100);
      data.processData = true;
      console.log(data);
      cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      progress(0);
      var sessionInfo = {
        deviceTags: ['bgm'],
        deviceManufacturers: ['Abbott'],
        deviceModel: 'FreeStyle Precision Xtra',
        deviceSerialNumber: data.serialNumber,
        deviceId: data.id,
        start: sundial.utcDateString(),
        tzName : cfg.timezone,
        version: cfg.version
      };

      cfg.api.upload.toPlatform(data.post_records, sessionInfo, progress, cfg.groupId, function (err, result) {
        if (err) {
          console.log(err);
          progress(100);
          return cb(err, data);
        } else {
          progress(100);
          return cb(null, data);
        }
      });
    },

    disconnect: function (progress, data, cb) {
      progress(100);
      data.disconnect = true;
      cb(null, data);
    },

    cleanup: function (progress, data, cb) {
      cfg.deviceComms.clearPacketHandler();
      cfg.deviceComms.clearErrorHandler();
      cfg.deviceComms.disconnect(function() {
        progress(100);
        data.cleanup = true;
        cb(null, data);
      });
    },

    testDriver: function(config) {
      var progress = function(v) {
        console.log('progress: ', v);
      };
      var data = {};
      this.connect(progress, data, function(err, result) {
        console.log('result:', result);
      });
    }
  };

};
