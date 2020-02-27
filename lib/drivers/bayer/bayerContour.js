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
import { MODELS, ASCII_CONTROL, COMMANDS } from './bayerConstants';

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('BCDriver') : console.log;

const struct = structJs();

module.exports = (config) => {
  const cfg = _.clone(config);
  const serialDevice = config.deviceComms;
  // these thresholds values are not present into the header, but
  // we set these default values because they are explained into
  // the page 35 of "CONTOUR Meters 3rd party CIS rev K-01.pdf"
  const DEFAULT_CONTOUR_LOW_VALUE = 10;
  const DEFAULT_CONTOUR_HI_VALUE = 600;

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
    console.log(result);
    const tostr = _.map(result,
      (e) => String.fromCharCode(e)).join('');
    result.payload = tostr;
    return result;
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

      /*
      * Thresholds are not reported in the header!
      * these default values are taken from the doc
      * (CONTOUR Meters 3rd party CIS rev K-01.pdf page 34)
      * in that table (field #4) is specified the threshold HI/LO values for contour devices
      */
      const lowT = DEFAULT_CONTOUR_LOW_VALUE;
      const hiT = DEFAULT_CONTOUR_HI_VALUE;

      const devInfo = {
        model: pInfo[0],
        serialNumber: sNum,
        nrecs: records.length,
        recordA: recordAverage,
        rawrecords: records,
        ordRecords,
        lowT,
        hiT,
      };

      return devInfo;
    }
    return null;
  };

  const parseDataRecord = (str, callback) => {
    const data = verifyChecksum(str);
    if (data) {
      const result = data.trim().match(/^.*\d+R\|(\d+).*Glucose\|(\d+)\|(\w+\/\w+)\^\w*\|{2}(>|<|T|>\\T|<\\T|)\|(\w*)\|{4}(\d{12})$/).slice(1, 7);
      callback(null, result);
    } else {
      throw (new Error('Invalid record data'));
    }
  };

  const getAnnotations = (annotation, data) => {
    // we dont know if is necessary add the unreported thesholds annotation

    if (annotation.indexOf('>') !== -1) {
      return [{
        code: 'bg/out-of-range',
        threshold: data.hiT,
        value: 'high',
      }];
    } if (annotation.indexOf('<') !== -1) {
      return [{
        code: 'bg/out-of-range',
        threshold: data.lowT,
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
      const [nrec, glucose, units, annotations, control, timestamp] = r;
      const robj = {
        timestamp: parseInt(timestamp, 10),
        annotations: getAnnotations(annotations, data),
        control: isControl(control),
        units,
        glucose: parseInt(glucose, 10),
        nrec: parseInt(nrec, 10),
      };
      return callback(null, robj);
    });
  };

  const listenForPacket = (timeout, callback) => {
    let listenTimer = null;

    const abortTimer = setTimeout(() => {
      clearInterval(listenTimer);
      debug('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    const raw = [];

    listenTimer = setInterval(() => {
      if (serialDevice.hasAvailablePacket()) {
        const pkt = serialDevice.nextPacket();
        debug('Raw packet received:', common.bytes2hex(pkt.bytes));
        const startIndex = 0;
        const rec = struct.unpack(pkt.bytes, 0, 'b', ['TYPE']);
        const hasETB = _.indexOf(pkt.bytes, ASCII_CONTROL.ETB, startIndex);
        const hasETX = _.indexOf(pkt.bytes, ASCII_CONTROL.ETX, startIndex);
        const hasCRLF = _.isEqual(_.takeRight(pkt.bytes, 3), [ASCII_CONTROL.CR, ASCII_CONTROL.LF, ASCII_CONTROL.ACK]);
        debug(rec);
        _.map(pkt.bytes, (e) => { raw.push(e); });
        if (hasETB !== -1 || hasETX !== -1) {
          // send a new ACK
          const cmd = buildCmd(ASCII_CONTROL.ACK, 1);
          serialDevice.writeSerial(cmd, () => {
            debug('New ACK SENT');
          });
        } else if (rec.TYPE === ASCII_CONTROL.EOT || rec.TYPE === ASCII_CONTROL.ACK || rec.TYPE === ASCII_CONTROL.ENQ || hasCRLF) {
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
          resolve(commandpacket.parser(result));
        });
      });
    } catch (e) {
      // exceptions inside Promise won't be thrown, so we have to
      // reject errors here (e.g. device unplugged during data read)
      reject(e);
    }
  });

  const getDeviceInfo = (cb) => {
    debug('DEBUG: on getDeviceInfo');

    (async () => {
      const [eot] = await bcnCommandResponse(buildCmd(ASCII_CONTROL.NAK, 1));
      if (eot !== ASCII_CONTROL.EOT) {
        throw new Error('Expected EOT, got', eot);
      }

      const [ack] = await bcnCommandResponse(buildCmd(ASCII_CONTROL.ENQ, 1));
      if (ack !== ASCII_CONTROL.ACK) {
        throw new Error('Expected ACK, got', ack);
      }

      console.log(await bcnCommandResponse(buildCmd(COMMANDS.READ, 2)));
      const timePacket = await bcnCommandResponse(buildCmdWithParser(COMMANDS.TIME, 2));
      console.log(timePacket.payload);

      const cmd = buildCmdWithParser(ASCII_CONTROL.ACK, 1);
      const datatxt = await bcnCommandResponse(cmd);
      const header = parseHeader(datatxt);
      if (header) {
        cb(null, header);
      } else {
        debug('Invalid header data');
        throw (new Error('Invalid header data'));
      }
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
          _.assign(cfg.deviceInfo, result);
          cfg.deviceInfo.model = MODELS[data.model];
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
      );
    },

    disconnect(progress, data, cb) {
      debug('in disconnect');
      progress(100);
      cb(null, data);
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');
      if (!data.disconnect) {
        cfg.deviceComms.disconnect(() => {
          progress(100);
          data.cleanup = true;
          data.disconnect = true;
          cb(null, data);
        });
      } else {
        progress(100);
      }
    },
  };
};
