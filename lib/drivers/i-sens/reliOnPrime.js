/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2021, Tidepool Project
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
import sundial from 'sundial';

import structJs from '../../struct';
import annotate from '../../eventAnnotations';
import TZOUtil from '../../TimezoneOffsetUtil';
import common from '../../commonFunctions';
import {
  ASCII_CONTROL, COMMANDS, FLAGS,
} from './reliOnConstants';

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('ReliOnPrime') : console.log;

const struct = structJs();

module.exports = (config) => {
  const cfg = _.clone(config);
  const serialDevice = config.deviceComms;
  let retries = 0;

  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['Arkray'],
  });

  const extractPacket = (bytes) => {
    // all packets passed the packetHandler validation are valid, the checksum is verified later
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

  const hasFlag = (flag, v) => {
    // eslint-disable-next-line no-bitwise
    if (flag.value & v) {
      return true;
    }
    return false;
  };

  const packetHandler = (buffer) => {
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
      struct.copyBytes(bytes, 0, command, cmdlength);
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

  const verifyHeaderChecksum = (record) => {
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

  const verifyChecksum = (record) => {
    const str = record.trim();
    const data = str.split(String.fromCharCode(ASCII_CONTROL.ETB));
    const check = data[1];
    let sum = 0;
    const n = `D|${record.slice(0, record.length - 2)}`;

    _.map(n, (e) => {
      if (e.charCodeAt(0) !== ASCII_CONTROL.STX) {
        sum += e.charCodeAt(0);
      }
    });

    // eslint-disable-next-line no-bitwise
    if ((sum & 0xFF) !== parseInt(check, 16)) {
      return null;
    }
    return data[0];
  };

  const parseHeader = (s) => {
    const data = s.split('\n').filter((e) => e.length > 1);
    const header = data.shift();

    if (verifyHeaderChecksum(header)) {
      data.shift(); // patient not used
      data.pop(); // remove linefeed
      const pString = header.split('|');
      const pInfo = pString[4].split('^');
      const sNum = pInfo[2];

      const devInfo = {
        model: pInfo[0],
        serialNumber: sNum,
      };

      return devInfo;
    }
    return null;
  };

  const parseDataRecord = (str) => {
    const data = verifyChecksum(str);
    if (data) {
      debug('Record:', data);

      const result = {
        value: parseInt(data.slice(2, 4).concat(data.slice(0, 2)), 16),
        jsDate: sundial.parseFromFormat(data.slice(4, 14), 'mmHHDDMMYY'),
        flags: parseInt(data.slice(14, 16), 16),
      };

      return result;
    }
    throw new Error('Invalid record data');
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
        debug('Raw packet received:', common.bytes2hex(bytes), new TextDecoder().decode(bytes));
        _.map(bytes, (e) => { raw.push(e); });

        if (bytes[0] === ASCII_CONTROL.EOT
            || bytes[0] === ASCII_CONTROL.ACK
            || bytes[0] === ASCII_CONTROL.ENQ
            || bytes[0] === ASCII_CONTROL.NAK
            || _.endsWith(raw, [ASCII_CONTROL.CR, ASCII_CONTROL.LF])
            || raw[raw.length - 1] === ASCII_CONTROL.ACK) {
          clearTimeout(abortTimer);
          clearInterval(listenTimer);

          if (serialDevice.hasAvailablePacket()) {
            // flushing leftover bytes
            debug('Flushing:', common.bytes2hex(serialDevice.nextPacket().bytes));
          }

          callback(null, raw);
        }
      }
    }, 20);
  };

  const commandResponse = async (commandpacket) => new Promise((resolve, reject) => {
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

  const getNumberOfRecords = async () => {
    await commandResponse(buildCmd(COMMANDS.READ, 2));
    const dataPacket = await commandResponse(buildCmdWithParser(COMMANDS.NROFRECORDS, 2));
    const data = _.split(dataPacket.payload, '|');
    const nrOfRecords = Number(data[1]);
    debug('Number of records:', nrOfRecords);
    return nrOfRecords;
  };

  const getOneRecord = async (index) => {
    const recNumStr = index.toString(16).toUpperCase().padStart(3, '0');
    const recNum = [];

    for (let i = 0; i < recNumStr.length; i++) {
      recNum[i] = recNumStr.charCodeAt(i);
    }

    recNum.push(0x7c); // add delimiter "|"

    await commandResponse(buildCmd(COMMANDS.READ, 2));
    await commandResponse(buildCmd(COMMANDS.DATA, 2));
    const result = await commandResponse(buildCmdWithParser(recNum, 4));

    const data = _.split(result.payload, '|')[1];

    if (result[0] === ASCII_CONTROL.NAK) {
      debug('Requested result not available, moving on to the next result..');
      return null;
    }

    const record = parseDataRecord(data);
    record.index = index;
    return record;
  };

  const getHeader = async () => {
    // exit remote command mode
    await commandResponse(buildCmd(ASCII_CONTROL.EOT, 1));

    const cmd = buildCmdWithParser(ASCII_CONTROL.ACK, 1);
    let datatxt = await commandResponse(cmd);

    if (datatxt[0] === ASCII_CONTROL.ENQ) {
      datatxt = await commandResponse(cmd);
    }

    const header = parseHeader(datatxt.payload);
    if (header) {
      return header;
    }
    debug('Invalid header data');
    throw (new Error('Invalid header data'));
  };

  const enterActionReceptionMode = async () => {
    let [response] = await commandResponse(buildCmd(ASCII_CONTROL.ACK, 1));

    await commandResponse(buildCmd(ASCII_CONTROL.ACK, 1));

    response = await commandResponse(buildCmd(0x92, 1));

    if (response.length > 1) {
      await commandResponse(buildCmd(0x92, 1));
    }

    await commandResponse(buildCmd(ASCII_CONTROL.ENQ, 1));
  };

  const enterRemoteCommandMode = async () => {
    let response;
    try {
      [response] = await commandResponse(buildCmd(0x92, 1));

      if (response !== ASCII_CONTROL.EOT) {
        throw new Error(`Expected EOT, got ${response.toString(16)}`);
      }

      const [ack] = await commandResponse(buildCmd(ASCII_CONTROL.ENQ, 1));
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
    const [ack1] = await commandResponse(buildCmd(COMMANDS.WRITE, 2));
    const [ack2] = await commandResponse(buildCmd(COMMANDS.DATE, 2));
    const [ack3] = await commandResponse(buildCmd(newDate, 8));
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
    const [ack4] = await commandResponse(buildCmd(COMMANDS.WRITE, 2));
    const [ack5] = await commandResponse(buildCmd(COMMANDS.TIME, 2));
    const [ack6] = await commandResponse(buildCmd(newTime, 6));
    if (ack4 !== ASCII_CONTROL.ACK || ack5 !== ASCII_CONTROL.ACK || ack6 !== ASCII_CONTROL.ACK) {
      throw new Error('Could not set time on meter');
    }
  };

  const getDeviceInfo = (cb) => {
    debug('DEBUG: on getDeviceInfo');
    const info = {};

    (async () => {
      info.header = await getHeader();
      debug('Header:', info.header);

      retries = 0;
      await enterRemoteCommandMode();

      info.nrecs = await getNumberOfRecords();

      // read time
      await commandResponse(buildCmd(COMMANDS.READ, 2));
      const timePacket = await commandResponse(buildCmdWithParser(COMMANDS.TIME, 2));
      const [, time] = _.split(timePacket.payload, '|');

      // read date
      await commandResponse(buildCmd(COMMANDS.READ, 2));
      const datePacket = await commandResponse(buildCmdWithParser(COMMANDS.DATE, 2));
      const [, date] = _.split(datePacket.payload, '|');

      cfg.deviceInfo.deviceTime = sundial.parseFromFormat(date.concat(' ', time), 'YYMMDD HHmm');

      common.checkDeviceTime(cfg, async (err, serverTime) => {
        try {
          if (err) {
            if (err === 'updateTime') {
              cfg.deviceInfo.annotations = 'wrong-device-time';
              retries = 0;
              await setDateTime(serverTime);
              cb(null, info);
            } else {
              cb(err, null);
            }
          } else {
            cb(null, info);
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

  const prepBGData = (progress, data) => {
    // build missing data.id
    data.id = `${data.deviceInfo.driverId}-${data.header.serialNumber}`;
    cfg.builder.setDefaults({ deviceId: data.id });
    const dataToPost = [];
    if (data.bgmReadings.length > 0) {
      for (let i = 0; i < data.bgmReadings.length; ++i) {
        const datum = data.bgmReadings[i];
        if (hasFlag(FLAGS.CONTROL_SOLUTION, datum.flags)) {
          debug('Discarding control');
          // eslint-disable-next-line no-continue
          continue;
        }

        // According to spec, HI > 600 and LO < 20
        let annotation = null;
        if (hasFlag(FLAGS.HI, datum.flags)) {
          datum.value = 601;
          annotation = {
            code: 'bg/out-of-range',
            value: 'high',
            threshold: 600,
          };
        } else if (hasFlag(FLAGS.LO, datum.flags)) {
          datum.value = 19;
          annotation = {
            code: 'bg/out-of-range',
            value: 'low',
            threshold: 20,
          };
        }

        const smbg = cfg.builder.makeSMBG()
          .with_value(datum.value)
          .with_deviceTime(sundial.formatDeviceTime(datum.jsDate))
          .with_units('mg/dL') // hard-coded
          .set('index', datum.index);

        if (annotation) {
          annotate.annotateEvent(smbg, annotation);
        }

        cfg.tzoUtil.fillInUTCInfo(smbg, datum.jsDate);
        delete smbg.index;
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
      cfg.deviceComms.connect(data.deviceInfo, packetHandler, (err) => {
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
          cb(null, data);
        } else {
          cb(err, result);
        }
      });
    },

    fetchData(progress, data, cb) {
      debug('in fetchData', data);
      const results = [];

      (async () => {
        for (let i = data.nrecs - 1; i >= 0; i--) {
          // eslint-disable-next-line no-await-in-loop
          const result = await getOneRecord(i);
          if (result === null) {
            // we got a NAK, so have to re-enter command mode
            // eslint-disable-next-line no-await-in-loop
            await enterActionReceptionMode();
          } else {
            results.push(result);
          }
          progress((100.0 * (data.nrecs - i)) / data.nrecs);
        }
        debug('fetchData', results);
        data.fetchData = true;
        data.bgmReadings = results;
        progress(100);
        cb(null, data);
      })().catch((error) => {
        debug('Error in fetchData: ', error);
        cb(error, null);
      });
    },

    processData(progress, data, cb) {
      progress(0);
      data.post_records = prepBGData(progress, data);
      progress(100);
      data.processData = true;
      cb(null, data);
    },

    uploadData(progress, data, cb) {
      progress(0);
      const sessionInfo = {
        deviceTags: cfg.deviceInfo.tags,
        deviceManufacturers: cfg.deviceInfo.manufacturers,
        deviceModel: data.header.model,
        deviceSerialNumber: data.header.serialNumber,
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
