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

const _ = require('lodash');
const async = require('async');
const sundial = require('sundial');
const struct = require('../../struct.js')();
const annotate = require('../../eventAnnotations');

const TZOUtil = require('../../TimezoneOffsetUtil');

module.exports = function (config) {
  const cfg = _.clone(config);
  cfg.deviceData = null;
  const serialDevice = config.deviceComms;
  // initialized with current date and no date & time settings changes
  // means we'll just apply the timezone across-the-board
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

  const STX = 0x02;
  const ETX = 0x03;
  const CR = 0x0D;
  const LF = 0x0A;

  const dateTimePattern = '([A-Za-z ]{4} [0-3][0-9] [0-9]{4} ' +
                        '[012][0-9]:[0-5][0-9](?::[0-6][0-9])?)';
  function parseDateTime(match, index) {
    const fmt = 'MMMM DD YYYY HH:mm:ss';
    const parsed = sundial.parseFromFormat(match[index], fmt);
    const dev = sundial.formatDeviceTime(parsed);
    const utcInfo = cfg.tzoUtil.lookup(parsed);
    return {
      dev,
      utc: utcInfo.time,
      timezoneOffset: utcInfo.timezoneOffset,
      conversionOffset: utcInfo.conversionOffset,
    };
  }

  const patterns = {
    serialNumber: {
      pattern: '^(?:[A-Z]-....-.....|[A-Z][A-Z][A-Z]....-.....|[XC][A-Z][GM]........)$',
      handler(match, packet) {
        packet.serialNumber = match[0];
      },
    },
    softwareVersion: {
      pattern: '^[0-9.]{4,13}$',
      handler(match, packet) {
        packet.softwareVersion = match[0];
      },
    },
    deviceTime: {
      pattern: `^${dateTimePattern}$`,
      handler(match, packet) {
        const times = parseDateTime(match, 1);
        packet.deviceTime = times.dev;
        packet.time = times.utc;
      },
    },
    numEntries: {
      pattern: '^(?:[0-9]{3}|Log Empty)$',
      handler(match, packet) {
        packet.numEntries = parseInt(match[0], 10);
        if (_.isNaN(packet.numEntries)) {
          packet.numEntries = 0;
        }
      },
    },
    notFound: {
      pattern: '^Log Not Found$',
      handler(match, packet) {
        packet.notFound = true;
      },
    },
    end: {
      pattern: '^END$',
      handler(match, packet) {
        packet.end = true;
      },
    },
    ok: {
      pattern: '^CMD OK$',
      handler(match, packet) {
        packet.ok = true;
      },
    },
    fail: {
      pattern: '^CMD Fail!$',
      handler(match, packet) {
        packet.fail = true;
      },
    },
    logEntry: {
      pattern: `^([0-9HL][0-9OI][0-9 ])  ${dateTimePattern} ([KG]) (0x[0-9A-Fa-f][0-9A-Fa-f])$`,
      handler(match, packet) {
        const entry = {};
        const reading = match[1];

        const testType = match[4]; // Bit 0: Control, Bit 1: Lost time
        if (testType[3] === '1') { // TODO: data model for control test
          console.log('Marking as control test');
          entry.control = true;
        } else {
          entry.control = false;
        }

        const readingType = match[3];
        if (readingType === 'K') {
          entry.readingType = 'ketone';
        } else {
          entry.readingType = 'glucose';
        }

        if (reading == 'HI ') {
          if (readingType === 'K') {
            entry.reading = 180; // this is a high of 10.0
            entry.annotations = [
              { code: 'ketone/out-of-range', value: 'high' },
              { code: 'ketone/unknown-value' },
            ];
          } else {
            entry.reading = 501;
            entry.annotations = [{
              code: 'bg/out-of-range',
              value: 'high',
              threshold: 500,
            }];
          }
        } else if (reading == 'LO ') {
          // ketones can not be low
          entry.reading = 19;
          entry.annotations = [{
            code: 'bg/out-of-range',
            value: 'low',
            threshold: 20,
          }];
        } else {
          entry.reading = parseInt(reading, 10);
        }

        entry.datetime = parseDateTime(match, 2);
        entry.status = parseInt(match[4], 16); // this is in hex
        packet.logEntries.push(entry);
      },
    },
    checksum: {
      pattern: '^(0x[0-9A-F]{4})  END',
      handler(match, packet) {
        packet.receivedChecksum = parseInt(match[1], 16); // in hex
      },
    },
  };
  const logEntry = 'logEntry';


  // accepts a stream of bytes and tries to find a packet
  // at the beginning of it.
  // returns a packet object; if valid == true it's a valid packet
  // if packet_len is nonzero, that much should be deleted from the stream
  // if valid is false and packet_len is nonzero, the previous packet
  // should be NAKed.
  // don't call this if you don't have at least a few bytes available
  const extractPacket = function (bytes) {
    const packet = {
      bytes,
      valid: false,
      packet_len: 0,
      lcb: 0,
      lines: [],
      logEntries: [],
    };

    const startIndex = 0;
    // the SerialPort library does not pass on STX and ETX, so we look for the
    // 'END' characters to determine when to stop
    let endIndex = searchForSequence(bytes, [0x45, 0x4E, 0x44]);
    if (endIndex === -1) {
      return packet;
    }
    endIndex += 2;


    // we have what looks like a packet, so now's a good time to
    // calculate the checksum if we have one
    // first, we have to find the start of the checksum, if it exists.
    // let's convert the whole array to strings

    // I tried to do this with:
    // _.map(bytes, String.fromCharCode).join('');
    // but I kept getting semi-random characters in the resulting string, so I'm using this instead
    function stringFromBytes(bytes, start, end) {
      let s = '';
      for (let i = start; i < end; ++i) {
        s += String.fromCharCode(bytes[i]);
      }
      return s;
    }

    // this is a search for a fixed set of bytes within a larger block. It's not exactly
    // Boyer-Moore, but it'll do for now
    function searchForSequence(bytes, sequence) {
      let found = false;
      for (let ix = 0; ix < bytes.length; ++ix) {
        found = true;
        for (let jx = 0; jx < sequence.length; ++jx) {
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

    let checksumIndex = searchForSequence(bytes, [0x0D, 0x0A, 0x30, 0x78]); // \r\n0x
    checksumIndex += 2; // we want the crlf in there
    if (checksumIndex !== -1) {
      let sum = 0;
      for (let i = startIndex; i < checksumIndex; ++i) {
        sum += bytes[i];
      }
      packet.calculatedChecksum = sum & 0xFFFF; // it's a 16-bit sum
    }

    // record the length of the packet we found
    packet.packet_len = endIndex;

    // split up into lines by searching for '\r\n'
    let startLine = startIndex;
    while (startLine < endIndex) {
      let endLine = _.indexOf(bytes, CR, startLine);
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
      const line = stringFromBytes(bytes, startLine, endLine);
      packet.lines.push(line);
      startLine = endLine + 2;
    }

    // so now let's walk the array of lines looking for things we understand

    // put the logEntry pattern first so when we get to the list of log
    // entries, we don't waste a lot of time looking for other ones
    const patkeys = _.keys(patterns);
    _.remove(patkeys, k => k === logEntry);
    patkeys.unshift(logEntry);

    // walk the lines in order, checking each possible pattern
    _.forEach(packet.lines, (line, index) => {
      let found = false;
      _.forEach(patkeys, (key) => {
        const m = line.match(patterns[key].pattern);
        if (m) {
          found = true;
          patterns[key].handler(m, packet);
        }
      });
      if (!found && line !== '') {
        console.log(`No pattern match found for "${line}"`);
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

  const pxErrorHandler = function (info) {
    if (info.connectionId && info.error) {
      if (info.error == 'timeout') {
        // whenever we get a timeout, we insert an ETX into the stream to separate packets
        return [ETX]; // this will never occur in a Precision Xtra stream
      }
    }
  };

  // When you call this, it looks to see if a complete Precision Xtra "packet" has
  // arrived and it calls the callback with it and strips it from the buffer.
  // It returns true if a packet was found, and false if not.
  const pxMessageHandler = function (buffer) {
    // for efficiency reasons, we're not going to bother to ask the driver
    // to decode things that can't possibly be a packet
    // discard ETXs since they can never start a packet
    let discardCount = 0;
    while (buffer.len() > discardCount && buffer.get(0) == ETX) {
      ++discardCount;
    }

    if (discardCount) {
      buffer.discard(discardCount);
    }

    if (buffer.len() < 11) { // all complete packets must be at least this long
      return false; // not enough there yet
    }

    // there's enough there to try, anyway
    const packet = extractPacket(buffer.bytes());
    if (packet.packet_len !== 0) {
      // remove the now-processed packet
      buffer.discard(packet.packet_len);
    }

    if (packet.valid) {
      return packet;
    }
    return null;
  };

  const listenForPacket = function (timeout, parser, callback) {
    const abortTimer = setTimeout(() => {
      clearInterval(listenTimer);
      console.log('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(() => {
      if (serialDevice.hasAvailablePacket()) {
        const pkt = serialDevice.nextPacket();
        // we always call the callback if we get a packet back,
        // so just cancel the timers if we do
        clearTimeout(abortTimer);
        clearInterval(listenTimer);
        pkt.parsed_payload = parser(pkt);
        callback(null, pkt);
      }
    }, 100); // 100ms should be enough to be kind to older CPUs
  };

  // this sends a command, then waits for an ack and a response packet,
  // then calls the callback with the response packet
  const pxCommandResponse = function (commandpacket, callback) {
    serialDevice.writeSerial(commandpacket.packet, (err) => {
      if (err) {
        callback(err, null);
      }
      // once we've sent the command, start listening for a response
      // but if we don't get one before the end of the timeout, give up
      // max timeout is 1000 * 32 bytes / 19200 baud / 10 bits/char == about 16 sec
      listenForPacket(10000, commandpacket.parser, (err, result) => {
        if (err === 'TIMEOUT') {
          callback('TIMEOUT', null);
        } else {
          callback(err, result);
        }
      });
    });
  };

  const xtest = function () {
    return {
      packet: struct.packString('$xlog,1\r\n'),
      parser(result) {
        return result;
      },
    };
  };

  const xGetData = function () {
    return {
      packet: struct.packString('$xmem\r\n'),
      parser(result) {
        return result;
      },
    };
  };

  const getAllData = function (obj, cb) {
    const cmd = xGetData();
    pxCommandResponse(cmd, (err, result) => {
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

  const prepBGData = function (progress, data) {
    cfg.builder.setDefaults({ deviceId: data.id });
    const dataToPost = [];
    for (let i = 0; i < data.logEntries.length; ++i) {
      const datum = data.logEntries[i];
      if (datum.control === true) {
        console.log('Discarding control');
        continue;
      }
      if (datum.readingType === 'glucose') {
        var smbg = cfg.builder.makeSMBG()
          .with_value(datum.reading)
          .with_deviceTime(datum.datetime.dev)
          .with_timezoneOffset(datum.datetime.timezoneOffset)
          .with_conversionOffset(datum.datetime.conversionOffset)
          .with_time(datum.datetime.utc)
          .with_units('mg/dL')
          // TODO: delete after conclusion of Jaeb study
          .set('index', i)
          // TODO: end deletion
          .done();
        if (datum.annotations) {
          _.each(datum.annotations, (ann) => {
            annotate.annotateEvent(smbg, ann);
          });
        }
        dataToPost.push(smbg);
      } else if (datum.readingType === 'ketone') {
        // These meters store ketone values as 18 * the mmol/L value of the ketones
        // Because this is specific to these devices, we convert to mmol/L
        // in the driver, rounded to 2 decimal places.
        const ketoneValue = Math.round(100 * datum.reading / 18.0) / 100.0;
        var bloodKetone = cfg.builder.makeBloodKetone()
          .with_value(ketoneValue)
          .with_deviceTime(datum.datetime.dev)
          .with_timezoneOffset(datum.datetime.timezoneOffset)
          .with_conversionOffset(datum.datetime.conversionOffset)
          .with_time(datum.datetime.utc)
          // TODO: delete after conclusion of Jaeb study
          .set('index', i)
          // TODO: end deletion
          .done();
        if (datum.annotations) {
          _.each(datum.annotations, (ann) => {
            annotate.annotateEvent(bloodKetone, ann);
          });
        }
        dataToPost.push(bloodKetone);
        console.log('ketone: ', bloodKetone);
      }
    }

    return dataToPost;
  };

  return {
    // using the default detect for this driver
    // detect: function(cb) {
    // },

    // this function starts the chain, so it has to create but not accept
    // the result (data) object; it's then passed down the rest of the chain
    setup(deviceInfo, progress, cb) {
      console.log('in setup!');
      progress(100);
      cb(null, { deviceInfo });
    },

    connect(progress, data, cb) {
      console.log('in connect!');
      const handlers = {
        packetHandler: pxMessageHandler,
        errorHandler: pxErrorHandler,
      };

      cfg.deviceComms.connect(data.deviceInfo, handlers, (err) => {
        if (err) {
          return cb(err);
        }
        progress(100);
        data.connect = true;
        cb(null, data);
      });
    },

    getConfigInfo(progress, data, cb) {
      progress(100);
      cb(null, data);
    },

    fetchData(progress, data, cb) {
      console.log('in fetchData');
      getAllData({}, (err, result) => {
        progress(100);
        console.log(result);
        _.assign(data, _.pick(result, 'logEntries', 'numEntries', 'serialNumber', 'softwareVersion', 'deviceTime'));
        data.model = 'AbbFreePrecXtra';
        data.id = `${data.model} ${data.serialNumber}`;
        cb(null, data);
      });
    },

    processData(progress, data, cb) {
      progress(0);
      data.post_records = _.map(prepBGData(progress, data), (d) => {
        delete d.index;
        return d;
      });
      progress(100);
      data.processData = true;
      console.log(data);
      cb(null, data);
    },

    uploadData(progress, data, cb) {
      progress(0);
      const sessionInfo = {
        deviceTags: ['bgm'],
        deviceManufacturers: ['Abbott'],
        deviceModel: 'Precision Xtra',
        deviceSerialNumber: data.serialNumber,
        deviceId: data.id,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version,
      };

      cfg.api.upload.toPlatform(data.post_records, sessionInfo, progress, cfg.groupId, (err, result) => {
        if (err) {
          console.log(err);
          progress(100);
          return cb(err, data);
        }
        progress(100);
        return cb(null, data);
      });
    },

    disconnect(progress, data, cb) {
      progress(100);
      data.disconnect = true;
      cb(null, data);
    },

    cleanup(progress, data, cb) {
      cfg.deviceComms.clearPacketHandler();
      cfg.deviceComms.clearErrorHandler();
      cfg.deviceComms.disconnect(() => {
        progress(100);
        data.cleanup = true;
        cb(null, data);
      });
    },

    testDriver(config) {
      const progress = function (v) {
        console.log('progress: ', v);
      };
      const data = {};
      this.connect(progress, data, (err, result) => {
        console.log('result:', result);
      });
    },
  };
};
