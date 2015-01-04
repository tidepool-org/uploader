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
var moment = require('moment-timezone');
var timeutils = require('./timeutils.js');
var crcCalculator = require('./crc.js');
var struct = require('./struct.js')();

module.exports = function (config) {
  var cfg = _.clone(config);
  cfg.deviceData = null;
  var serialDevice = config.deviceComms;

  var STX = 0x02;
  var ETX = 0x03;
  var CR = 0x0D;
  var LF = 0x0A;

  var dateTimePattern = '([A-Za-z ]{4}) ([0-3][0-9]) ([0-9]{4})' +
                        '([012][0-9]):([0-5][0-9])(?::([0-6][0-9]))*';
  function parseDateTime(match, offset) {
    var o = {};
    var months = ['Jan ', 'Feb ', 'Mar ', 'Apr ', 'May ', 'Jun ',
                  'Jul ', 'Aug ', 'Sept', 'Oct ', 'Nov ', 'Dec '];
    o.month = _.indexOf(months, match[offset+0]) + 1;
    o.day = parseInt(match[offset+1], 10);
    o.year = parseInt(match[offset+2], 10);
    o.hours = parseInt(match[offset+3], 10);
    o.minutes = parseInt(match[offset+4], 10);
    var sec = match[offset+5];
    if (sec === undefined) {
      o.seconds = 0;
    } else {
      o.seconds = parseInt(sec, 10);
    }
    // this isn't quite right because we haven't dealt with timezone yet
    return timeutils.buildMsec(o);
  }

  var patterns = {
    serialNumber: {
      pattern: '[A-Z]-....-.....|[A-Z][A-Z][A-Z]....-.....|[XC][A-Z][GM]........',
      handler: function(match, packet) {
        packet.serialNumber = match;
      }
    },
    softwareVersion: {
      pattern: '[0-9.]{5,13}',
      handler: function(match, packet) {
        packet.softwareVersion = match;
      }
    },
    deviceTime: {
      pattern: dateTimePattern,
      handler: function(match, packet) {
        packet.deviceTime = parseDateTime(match, 1);
      }
    },
    numEntries: {
      pattern: '[0-9]{3}|Log Empty',
      handler: function(match, packet) {
        packet.numEntries = parseInt(match, 10);
        if (_.isNaN(packet.numEntries)) {
          packet.numEntries = 0;
        }
      }
    },
    notFound: {
      pattern: 'Log Not Found',
      handler: function(match, packet) {
        packet.notFound = true;
      }
    },
    end: {
      pattern: '^END',
      handler: function(match, packet) {
        packet.end = true;
      }
    },
    ok: {
      pattern: 'CMD OK',
      handler: function(match, packet) {
        packet.ok = true;
      }
    },
    fail: {
      pattern: 'CMD Fail!',
      handler: function(match, packet) {
        packet.fail = true;
      }
    },
    logEntry: {
      pattern: '([0-9HL][0-9OI][0-9 ]) ' + dateTimePattern + ' ([KG]) (0x[0-9A-Fa-f][0-9A-Fa-f])',
      handler: function(match, packet) {
        var entry = {};
        var reading = match[1];
        if (reading == 'HI ') {
          entry.reading = 501;
        } else if (reading == 'LO ') {
          entry.reading = 20;
        } else {
          entry.reading = parseInt(reading, 10);
        }
        entry.datetime = parseDateTime(match, 2);
        var readingType = match[8];
        if (readingType === 'K') {
          entry.readingType = 'ketone';
        } else {
          entry.readingType = 'glucose';
        }
        entry.status = parseInt(match[9], 16);   // this is in hex
        packet.logEntries.push(entry);
      }
    },
    checksum: {
      pattern: '(0x[0-9A-Fa-f]{4})  END',
      handler: function(match, packet) {
        packet.receivedChecksum = parseInt(match[1], 16); // in hex
      }
    }
  };
  var logEntry = 'logEntry';

  var BASE_DATE_DEVICE = moment.utc('1970-01-01').valueOf();
  var BASE_DATE_UTC = moment.tz('1970-01-01', cfg.timezone).valueOf();
  var TZOFFSET = (BASE_DATE_DEVICE - BASE_DATE_UTC)/1000;
  console.log('timezone=' + cfg.timezone + ' Device=' + BASE_DATE_DEVICE + ' UTC=' + BASE_DATE_UTC);
  console.log('tzoffset = ', TZOFFSET);
  console.log(new Date(BASE_DATE_DEVICE));
  console.log(new Date(BASE_DATE_UTC));


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
    var bstring = _.map(bytes, String.fromCharCode).join('');
    var checksumIndex = bstring.search(patterns.checksum);
    if (checksumIndex !== -1) {
      var sum = 0;
      for (var i=startIndex; i<checksumIndex; ++i) {
        sum += bytes[i];
      }
      packet.calculatedChecksum = sum & 0xFFFF;   // it's a 16-bit sum
    }

    // split up into lines by searching for '\r\n'
    var startLine = startIndex;
    while (startLine <= endIndex) {
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

      // now we have brackets around our line
      var lineArray = bytes.slice(startLine, endLine);
      var line = _.map(lineArray, String.fromCharCode).join('');
      packet.lines.push(line);
      startLine = endLine + 2;
    }

    // now we should have all the lines in an array
    console.log(packet.lines);

    // so now let's walk the array of lines looking for things we understand

    // put the logEntry pattern first so when we get to the list of log
    // entries, we don't waste a lot of time looking for other ones
    var patkeys = _.keys(patterns);
    _.remove(patkeys, function(k) { return k === logEntry; });
    patkeys.unshift(logEntry);

    // walk the lines in order, checking each possible pattern
    _.forEach(packet.lines, function(line, index) {
      _.forEach(patkeys, function(key) {
        var m = line.match(patterns[key].pattern);
        if (m) {
          patterns[key].handler(m, packet);
        }
      });
    });

    // now let's validate it
    packet.valid = true;
    if (packet.receivedChecksum != packet.calculatedChecksum) {
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
        _.assign(obj, result);
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
    cfg.builder.setDefaults({
                              deviceId: 'OneTouch' + data.model + '-' + data.serialNumber,
                              source: 'device',
                              units: 'mg/dL'      // everything the OneTouch meter stores is in this unit
                            });
    var dataToPost = [];
    for (var i = 0; i < data.bgmReadings.length; ++i) {
      var datum = data.bgmReadings[i];
      var smbg = cfg.builder.makeSMBG()
        .with_value(datum.glucose)
        .with_deviceTime(datum.displayTime)
        .with_timezoneOffset(TZOFFSET / 60)
        .with_time(datum.displayUtc)
        .done();
      dataToPost.push(smbg);
    }

    return dataToPost;
  };

  var probe = function (cb) {
    console.log('attempting probe of oneTouch Mini');
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
      getAllData({}, function (err, result) {
        progress(100);
        data.connect = true;
        _.assign(data, result);
        cb(null, data);
      });
    },

    processData: function (progress, data, cb) {
      progress(0);
      //data.bg_data = processReadings(data.bgmReadings);
      data.post_records = prepBGData(progress, data);
      var ids = {};
      for (var i = 0; i < data.post_records.length; ++i) {
        var id = data.post_records[i].time + '|' + data.post_records[i].deviceId;
        if (ids[id]) {
          console.log('duplicate! %s @ %d == %d', id, i, ids[id] - 1);
          console.log(data.post_records[ids[id] - 1]);
          console.log(data.post_records[i]);
        } else {
          ids[id] = i + 1;
        }
      }
      progress(100);
      data.processData = true;
      cb('nopes', data);
    },

    uploadData: function (progress, data, cb) {
      progress(0);
      cfg.jellyfish.post(data.post_records, progress, function (err, result) {
        if (err) {
          console.log(err);
          console.log(result);
          progress(100);
          return cb(err, data);
        } else {
          progress(100);
          return cb(null, data);
        }
      });

      progress(100);
      data.cleanup = true;
      cb(null, data);

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
