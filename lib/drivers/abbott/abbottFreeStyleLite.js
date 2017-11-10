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

const debug = require('bows')('FreeStyleLiteDriver');

module.exports = function (config) {
  const cfg = _.clone(config);
  cfg.deviceData = null;
  const serialDevice = config.deviceComms;

  // With no date & time settings changes available,
  // timezone is applied across-the-board
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
      pattern: '^[0-9.]{4,13}',
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
      pattern: `^\s*([0-9HL][0-9OI][0-9 ])  ${dateTimePattern} [0-9A-Fa-f][0-9A-Fa-f] (0x[0-9A-Fa-f][0-9A-Fa-f])`,
      handler(match, packet) {
        const entry = {};
        const reading = match[1];

        const testType = match[3];

        if (testType[3] === '1') {
          debug('Marking as control test');
          entry.control = true;
        } else {
          entry.control = false;
        }

        // the HI/LO glucose range for all FreeStyle meters are 20-500 mg/dL according to spec
        if (reading == 'HI ') {
          entry.reading = 501;
          entry.annotations = [{
            code: 'bg/out-of-range',
            value: 'high',
            threshold: 500,
          }];
        } else if (reading == 'LO ') {
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
        packet.logEntries.push(entry);
      },
    },
    checksum: {
      pattern: '^(0x[0-9A-F]{4})  END',
      handler(match, packet) {
        packet.receivedChecksum = parseInt(match[1], 16);
      },
    },
  };
  const logEntry = 'logEntry';

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


    function stringFromBytes(bytes, start, end) {
      let s = '';
      for (let i = start; i < end; ++i) {
        s += String.fromCharCode(bytes[i]);
      }
      return s;
    }

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

    let checksumIndex = searchForSequence(bytes, [0x0D, 0x0A, 0x30, 0x78]);
    checksumIndex += 2;
    if (checksumIndex !== -1) {
      let sum = 0;
      for (let i = startIndex; i < checksumIndex; ++i) {
        sum += bytes[i];
      }
      packet.calculatedChecksum = sum & 0xFFFF;
    }

    packet.packet_len = endIndex;

    let startLine = startIndex;
    while (startLine < endIndex) {
      let endLine = _.indexOf(bytes, CR, startLine);
      if (endLine === -1) {
        endLine = endIndex - 1;
      }
      if (bytes[endLine + 1] != LF) {
        packet.packet_len = endLine;
        return packet;
      }

      const line = stringFromBytes(bytes, startLine, endLine);
      packet.lines.push(line);
      startLine = endLine + 2;
    }

    const patkeys = _.keys(patterns);
    _.remove(patkeys, k => k === logEntry);
    patkeys.unshift(logEntry);

    _.forEach(packet.lines, (line, index) => {
      let found = false;
      _.forEach(patkeys, (key) => {
        const m = line.trim().match(patterns[key].pattern);
        if (m) {
          found = true;
          patterns[key].handler(m, packet);
        }
      });
      if (!found && line !== '') {
        debug(`No pattern match found for "${line}"`);
      }
    });

    packet.valid = true;
    if (packet.receivedChecksum && packet.receivedChecksum != packet.calculatedChecksum) {
      debug('Failed checksum! rcv: ', packet.receivedChecksum, ' calc: ', packet.calculatedChecksum);
      packet.valid = false;
    }
    if (packet.numEntries && packet.logEntries.length !== packet.numEntries) {
      debug('Entry count failure! num: ', packet.numEntries, ' found: ', packet.logEntries.length);
      packet.valid = false;
    }
    if (packet.fail) {
      packet.valid = false;
    }
    return packet;
  };

  const freeStyleErrorHandler = function (info) {
    if (info.connectionId && info.error) {
      if (info.error == 'timeout') {
        return [ETX];
      }
    }
  };

  const freeStyleMessageHandler = function (buffer) {
    let discardCount = 0;
    while (buffer.len() > discardCount && buffer.get(0) == ETX) {
      ++discardCount;
    }

    if (discardCount) {
      buffer.discard(discardCount);
    }

    if (buffer.len() < 11) {
      return false;
    }

    const packet = extractPacket(buffer.bytes());
    if (packet.packet_len !== 0) {
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
      debug('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(() => {
      if (serialDevice.hasAvailablePacket()) {
        const pkt = serialDevice.nextPacket();
        clearTimeout(abortTimer);
        clearInterval(listenTimer);
        pkt.parsed_payload = parser(pkt);
        callback(null, pkt);
      }
    }, 100); // 100ms should be enough to be kind to older CPUs
  };

  const freeStyleCommandResponse = function (commandpacket, callback) {
    serialDevice.writeSerial(commandpacket.packet, (err) => {
      if (err) {
        callback(err, null);
      }
      listenForPacket(30000, commandpacket.parser, (err, result) => {
        if (err) {
          callback(err, null);
        } else {
          callback(err, result);
        }
      });
    });
  };

  const xGetData = function () {
    return {
      packet: struct.packString('mem'),
      parser(result) {
        return result;
      },
    };
  };

  const getAllData = function (obj, cb) {
    const cmd = xGetData();
    freeStyleCommandResponse(cmd, (err, result) => {
      if (err) {
        debug('Failure trying to talk to device.');
        debug(err);
        debug(result);
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
        debug('Discarding control');
        continue;
      }

      var smbg = cfg.builder.makeSMBG()
        .with_value(datum.reading)
        .with_deviceTime(datum.datetime.dev)
        .with_timezoneOffset(datum.datetime.timezoneOffset)
        .with_conversionOffset(datum.datetime.conversionOffset)
        .with_time(datum.datetime.utc)
        .with_units('mg/dL')
        .set('index', i)
        .done();
      if (datum.annotations) {
        _.each(datum.annotations, (ann) => {
          annotate.annotateEvent(smbg, ann);
        });
      }
      dataToPost.push(smbg);
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
      debug('in setup!');
      progress(100);
      cb(null, { deviceInfo });
    },

    connect(progress, data, cb) {
      debug('in connect!');
      const handlers = {
        packetHandler: freeStyleMessageHandler,
        errorHandler: freeStyleErrorHandler,
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
      debug('in fetchData');
      getAllData({}, (err, result) => {
        progress(100);
        data.connect = true;
        debug(result);
        _.extend(data, _.pick(result, 'serialNumber', 'softwareVersion', 'deviceTime'));

        if (data.serialNumber[0] === 'C') {
          // there are a wide variety of Abbott meters that start with C and D,
          // but this is the only way to distinguish the FreeStyle Freedom Lite
          // and the FreeStyle Lite as they use the same cable, so the USB PID/VID
          // is the same.
          data.model = 'AbbottFreeStyleFreedomLite';
        } else if (data.serialNumber[0] === 'D') {
          data.model = 'AbbottFreeStyleLite';
        } else {
          data.model = 'UnknownFreeStyle';
        }
        debug('Detected as: ', data.model);

        data.id = `${data.model} ${data.serialNumber}`;
        data.logEntries = result.logEntries;
        data.numEntries = result.numEntries;
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
      debug(data);
      cb(null, data);
    },

    uploadData(progress, data, cb) {
      progress(0);

      const sessionInfo = {
        deviceTags: ['bgm'],
        deviceManufacturers: ['Abbott'],
        deviceModel: data.model,
        deviceSerialNumber: data.serialNumber,
        deviceId: data.id,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version,
      };

      cfg.api.upload.toPlatform(data.post_records, sessionInfo, progress, cfg.groupId, (err, result) => {
        if (err) {
          debug(err);
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
        debug('progress: ', v);
      };
      const data = {};
      this.connect(progress, data, (err, result) => {
        debug('result:', result);
      });
    },
  };
};
