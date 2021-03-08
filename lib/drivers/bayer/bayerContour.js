/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2020, Tidepool Project
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

/* eslint-disable no-param-reassign */

import _ from 'lodash';
import async from 'async';
import sundial from 'sundial';

import structJs from '../../struct';
import annotate from '../../eventAnnotations';
import TZOUtil from '../../TimezoneOffsetUtil';
import common from '../../commonFunctions';
import {
  MODELS, ASCII_CONTROL, COMMANDS, METHODS, MARKS,
} from './bayerConstants';

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('BCDriver') : console.log;

const struct = structJs();

module.exports = (config) => {
  const cfg = _.clone(config);
  const serialDevice = config.deviceComms;
  let retries = 0;

  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['Bayer'],
  });

  const extractPacket = (bytes) => {
    // all packets passed the bcnPacketHandler validation are valid, the checksum is verified later
    const packet = {
      bytes,
      valid: false,
      packet_len: 0,
      payload: null,
    };

    const packetLength = bytes.length;
    packet.packet_len = packetLength;
    packet.valid = true;

    return packet;
  };

  const bcnPacketHandler = (buffer) => {
    if (buffer.len() < 1) { // only empty buffer is no valid packet
      return false;
    }

    const packet = extractPacket(buffer.bytes());
    if (packet.packet_len !== 0) {
      // cleanup the buffer data
      buffer.discard(packet.packet_len);
    }

    if (packet.valid) {
      return packet;
    }
    return null;
  };

  const buildPacket = (command, cmdlength) => {
    const datalen = cmdlength;
    const buf = new ArrayBuffer(datalen);
    const bytes = new Uint8Array(buf);

    if (cmdlength === 1) {
      struct.storeByte(command, bytes, 0);
    } else {
      const ctr = struct.copyBytes(bytes, 0, command, cmdlength);
      struct.storeByte(0x0D, bytes, ctr); // add carriage return
    }
    debug('Sending byte(s):', common.bytes2hex(bytes));
    return buf;
  };

  const packetParser = (result) => {
    if (result != null) {
      const tostr = _.map(result,
        (e) => String.fromCharCode(e)).join('');
      result.payload = tostr;
      return result;
    }
    return null;
  };

  const buildCmdWithParser = (cmd, length) => ({
    packet: buildPacket(cmd, length),
    parser: packetParser,
  });

  const buildCmd = (cmd, length) => ({
    packet: buildPacket(cmd, length),
    parser: (result) => result,
  });

  const verifyChecksum = (record) => {
    const str = record.trim();
    const data = str.split(String.fromCharCode(ASCII_CONTROL.ETB));
    const check = data[1];
    let sum = 0;
    const n = record.slice(0, record.length - 3);

    _.map(n, (e) => {
      if (e.charCodeAt(0) !== ASCII_CONTROL.STX) {
        sum += e.charCodeAt(0);
      }
    });

    if ((sum % 256) !== parseInt(check, 16)) {
      return null;
    }
    return data[0];
  };

  const parseHeader = (s) => {
    const data = s.split('\n').filter((e) => e.length > 1);
    const header = data.shift();

    if (verifyChecksum(header)) {
      data.shift(); // patient not used
      data.pop(); // remove linefeed
      const pString = header.split('|');
      const pInfo = pString[4].split('^');
      const sNum = pInfo[2];
      const records = data.filter((e) => e[2] === 'R');
      const recordAverage = records.shift(); // the first record means the average
      const ordRecords = data.filter((e) => e[2] === 'O');

      const devInfo = {
        model: pInfo[0],
        serialNumber: sNum,
        nrecs: records.length,
        recordA: recordAverage,
        rawrecords: records,
        ordRecords,
      };

      return devInfo;
    }
    return null;
  };

  const parseDataRecord = (str, callback) => {
    const data = verifyChecksum(str);
    if (data) {
      debug('Record:', data);
      const result = data.trim().match(/^.*\d+R\|(\d+).*Glucose\|(\d+\.?\d*)\|(\w+\/\w+)\^(\w*)\|\d*\|(>|<|T|>\\T|<\\T|)\|(\w*)\|(\w*)\|{3}(\d{12})$/);
      if (result != null) {
        return callback(null, result.slice(1, 10));
      }
    }
    return callback(new Error('Invalid record data'));
  };

  const getAnnotations = (annotation, value, units) => {
    if (annotation.indexOf('>') !== -1) {
      return [{
        code: 'bg/out-of-range',
        threshold: units === 'mg/dL' ? value - 1 : _.round(18 * (value - 0.05)),
        value: 'high',
      }];
    } if (annotation.indexOf('<') !== -1) {
      return [{
        code: 'bg/out-of-range',
        threshold: units === 'mg/dL' ? value + 1 : _.round(18 * (value + 0.05)),
        value: 'low',
      }];
    }
    return null;
  };

  const isControl = (markers) => {
    if (markers.indexOf('E') !== -1) {
      debug('Marking as control test');
      return true;
    }
    return false;
  };

  const getOneRecord = (record, data, callback) => {
    parseDataRecord(record, (err, r) => {
      if (err) {
        debug('Failure trying to read record', record);
        debug(err);
        return callback(err, null);
      }
      const [nrec, glucose, units, referenceMethod, annotations, userMarks, control, timestamp] = r;
      const value = units === 'mg/dL' ? parseInt(glucose, 10) : parseFloat(glucose);
      const robj = {
        timestamp: parseInt(timestamp, 10),
        annotations: getAnnotations(annotations, value, units),
        control: isControl(control),
        units,
        glucose: value,
        nrec: parseInt(nrec, 10),
        referenceMethod: METHODS[referenceMethod],
        userMarks: MARKS[userMarks],
      };
      return callback(null, robj);
    });
  };

  const listenForPacket = (timeout, callback) => {
    let listenTimer = null;

    const abortTimeout = () => {
      clearInterval(listenTimer);
      debug('TIMEOUT');
      callback('Timeout error. Is the meter switched on?', null);
    };

    const raw = [];
    let abortTimer = setTimeout(abortTimeout, timeout);

    listenTimer = setInterval(() => {
      if (serialDevice.hasAvailablePacket()) {
        // reset abort timeout
        clearTimeout(abortTimer);
        abortTimer = setTimeout(abortTimeout, timeout);

        const { bytes } = serialDevice.nextPacket();
        debug('Raw packet received:', common.bytes2hex(bytes));
        _.map(bytes, (e) => { raw.push(e); });

        if (_.endsWith(raw, [ASCII_CONTROL.CR, ASCII_CONTROL.LF])) {
          // send a new ACK
          const cmd = buildCmd(ASCII_CONTROL.ACK, 1);
          serialDevice.writeSerial(cmd.packet, () => {
            debug('ACK sent');
          });
        }

        if (bytes.includes(ASCII_CONTROL.EOT)
            || bytes.includes(ASCII_CONTROL.ACK)
            || bytes.includes(ASCII_CONTROL.ENQ)) {
          clearTimeout(abortTimer);
          clearInterval(listenTimer);
          callback(null, raw);
        }
      }
    }, 20);
  };

  const bcnCommandResponse = async (commandpacket) => new Promise((resolve, reject) => {
    try {
      serialDevice.writeSerial(commandpacket.packet, () => {
        listenForPacket(5000, (err, result) => {
          if (err) {
            reject(err);
          }
          const parsed = commandpacket.parser(result);
          resolve(parsed);
        });
      });
    } catch (e) {
      // exceptions inside Promise won't be thrown, so we have to
      // reject errors here (e.g. device unplugged during data read)
      reject(e);
    }
  });

  const getData = async () => {
    // exit remote command mode
    await bcnCommandResponse(buildCmd(ASCII_CONTROL.EOT, 1));

    const cmd = buildCmdWithParser(ASCII_CONTROL.ACK, 1);
    const datatxt = await bcnCommandResponse(cmd);
    const header = parseHeader(datatxt.payload);
    if (header) {
      return header;
    }
    debug('Invalid header data');
    throw (new Error('Invalid header data'));
  };

  const enterRemoteCommandMode = async () => {
    let response;
    try {
      [response] = await bcnCommandResponse(buildCmd(ASCII_CONTROL.NAK, 1));

      if (response === ASCII_CONTROL.ENQ) {
        // if we get an enq, send another nak, because we want an eot
        [response] = await bcnCommandResponse(buildCmd(ASCII_CONTROL.NAK, 1));
      }

      if (response !== ASCII_CONTROL.EOT) {
        throw new Error(`Expected EOT, got ${response.toString(16)}`);
      }

      const [ack] = await bcnCommandResponse(buildCmd(ASCII_CONTROL.ENQ, 1));
      if (ack !== ASCII_CONTROL.ACK) {
        throw new Error(`Expected ACK, got ${ack.toString(16)}`);
      }
    } catch (error) {
      if (retries === 3) {
        throw error;
      }
      debug('Trying again ...');
      retries += 1;
      await enterRemoteCommandMode();
    }
  };

  const setDateTime = async (serverTime) => {
    const newDate = [];
    struct.storeString(sundial.formatInTimezone(serverTime, cfg.timezone, 'YYMMDD|').concat('\r'), newDate, 0);
    const [ack1] = await bcnCommandResponse(buildCmd(COMMANDS.WRITE, 2));
    const [ack2] = await bcnCommandResponse(buildCmd(COMMANDS.DATE, 2));
    const [ack3] = await bcnCommandResponse(buildCmd(newDate, 8));
    if (ack1 !== ASCII_CONTROL.ACK || ack2 !== ASCII_CONTROL.ACK || ack3 !== ASCII_CONTROL.ACK) {
      if (retries === 0) {
        debug('Could not set date on meter, retrying..');
        await enterRemoteCommandMode();
        await setDateTime(serverTime);
      } else {
        throw new Error('Could not set date on meter');
      }
    }

    const newTime = [];
    struct.storeString(sundial.formatInTimezone(serverTime, cfg.timezone, 'HHmm|').concat('\r'), newTime, 0);
    const [ack4] = await bcnCommandResponse(buildCmd(COMMANDS.WRITE, 2));
    const [ack5] = await bcnCommandResponse(buildCmd(COMMANDS.TIME, 2));
    const [ack6] = await bcnCommandResponse(buildCmd(newTime, 6));
    if (ack4 !== ASCII_CONTROL.ACK || ack5 !== ASCII_CONTROL.ACK || ack6 !== ASCII_CONTROL.ACK) {
      throw new Error('Could not set time on meter');
    }
  };

  const getDeviceInfo = (cb) => {
    debug('DEBUG: on getDeviceInfo');

    (async () => {
      retries = 0;
      await enterRemoteCommandMode();

      // read time
      await bcnCommandResponse(buildCmd(COMMANDS.READ, 2));
      const timePacket = await bcnCommandResponse(buildCmdWithParser(COMMANDS.TIME, 2));
      const [, time] = _.split(timePacket.payload, '|');

      // read date
      await bcnCommandResponse(buildCmd(COMMANDS.READ, 2));
      const datePacket = await bcnCommandResponse(buildCmdWithParser(COMMANDS.DATE, 2));
      const [, date] = _.split(datePacket.payload, '|');

      cfg.deviceInfo.deviceTime = sundial.parseFromFormat(date.concat(' ', time), 'YYMMDD HHmm');

      common.checkDeviceTime(cfg, async (err, serverTime) => {
        try {
          if (err) {
            if (err === 'updateTime') {
              cfg.deviceInfo.annotations = 'wrong-device-time';
              retries = 0;
              await setDateTime(serverTime);
              cb(null, await getData());
            } else {
              cb(err, null);
            }
          } else {
            cb(null, await getData());
          }
        } catch (error) {
          cb(error, null);
        }
      });
    })().catch((error) => {
      debug('Error in getDeviceInfo: ', error);
      cb(error, null);
    });
  };

  const processReadings = (readings) => {
    _.each(readings, (reading, index) => {
      readings[index].jsDate = sundial.parseFromFormat(reading.timestamp, 'YYYYMMDD HHmm');
      readings[index].displayTime = sundial.formatDeviceTime(readings[index].jsDate);
    });
  };

  const prepBGData = (progress, data) => {
    // build missing data.id
    data.id = `${data.model}-${data.serialNumber}`;
    cfg.builder.setDefaults({ deviceId: data.id });
    const dataToPost = [];
    if (data.bgmReadings.length > 0) {
      for (let i = 0; i < data.bgmReadings.length; ++i) {
        const datum = data.bgmReadings[i];
        if (datum.control === true) {
          debug('Discarding control');
          // eslint-disable-next-line no-continue
          continue;
        }
        const smbg = cfg.builder.makeSMBG()
          .with_value(datum.glucose)
          .with_deviceTime(datum.displayTime)
          .with_units(datum.units)
          .set('index', datum.nrec);

        if (datum.annotations) {
          _.each(datum.annotations, (ann) => {
            annotate.annotateEvent(smbg, ann);
          });
        }

        cfg.tzoUtil.fillInUTCInfo(smbg, datum.jsDate);
        dataToPost.push(smbg.done());
      }
    } else {
      debug('Device has no records to upload');
      throw (new Error('Device has no records to upload'));
    }

    return dataToPost;
  };

  return {
    detect(deviceInfo, cb) {
      debug('no detect function needed');
      cb(null, deviceInfo);
    },

    setup(deviceInfo, progress, cb) {
      debug('in setup!');
      progress(100);
      cb(null, { deviceInfo });
    },

    connect(progress, data, cb) {
      debug('in connect!');
      cfg.deviceComms.connect(data.deviceInfo, bcnPacketHandler, (err) => {
        if (err) {
          return cb(err);
        }
        cfg.deviceComms.flush();
        progress(100);
        data.connect = true;
        return cb(null, data);
      });
    },

    getConfigInfo(progress, data, cb) {
      debug('in getConfigInfo', data);

      getDeviceInfo((err, result) => {
        progress(100);

        if (!err) {
          data.connect = true;
          _.assign(data, result);
          _.merge(cfg.deviceInfo, result);
          cfg.deviceInfo.model = MODELS[data.model];
          data.deviceModel = cfg.deviceInfo.model; // for metrics
          if (cfg.deviceInfo.model == null) {
            cfg.deviceInfo.model = 'Unknown Bayer model';
          }
          debug('Detected as: ', cfg.deviceInfo.model);
          cb(null, data);
        } else {
          cb(err, result);
        }
      });
    },

    fetchData(progress, data, cb) {
      debug('in fetchData', data);

      function getOneRecordWithProgress(recnum, callback) {
        const rec = data.rawrecords.shift();
        progress((100.0 * recnum) / data.nrecs);
        setTimeout(() => {
          getOneRecord(rec, data, callback);
        }, 20);
      }

      async.timesSeries(data.nrecs, getOneRecordWithProgress, (err, result) => {
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

    processData(progress, data, cb) {
      progress(0);
      data.bg_data = processReadings(data.bgmReadings);
      data.post_records = prepBGData(progress, data);
      const ids = {};
      for (let i = 0; i < data.post_records.length; ++i) {
        delete data.post_records[i].index;
        const id = `${data.post_records[i].time}|${data.post_records[i].deviceId}`;
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

    uploadData(progress, data, cb) {
      progress(0);
      const sessionInfo = {
        deviceTags: cfg.deviceInfo.tags,
        deviceManufacturers: cfg.deviceInfo.manufacturers,
        deviceModel: cfg.deviceInfo.model,
        deviceSerialNumber: cfg.deviceInfo.serialNumber,
        deviceId: data.id,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version,
      };

      debug('POST records:', data.post_records);

      cfg.api.upload.toPlatform(
        data.post_records,
        sessionInfo,
        progress,
        cfg.groupId,
        (err, result) => {
          progress(100);

          if (err) {
            debug(err);
            debug(result);
            return cb(err, data);
          }
          data.cleanup = true;
          return cb(null, data);
        },
        'dataservices',
      );
    },

    disconnect(progress, data, cb) {
      debug('in disconnect');
      progress(100);
      cb(null, data);
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');
      cfg.deviceComms.disconnect(() => {
        progress(100);
        data.cleanup = true;
        data.disconnect = true;
        cb(null, data);
      });
    },
  };
};
