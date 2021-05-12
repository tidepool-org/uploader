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

import _ from 'lodash';
import sundial from 'sundial';

import annotate from '../../eventAnnotations';
import common from '../../commonFunctions';
import TZOUtil from '../../TimezoneOffsetUtil';
import structJs from '../../struct';
import crcCalculator from '../../crc';

const struct = structJs();
const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('GlucocardExpression') : console.log;

const OP_CODE = {
  PING: 0x00,
  READ_DATE_TIME: 0x07,
  SERIAL: 0x0F,
  READ_ALL: 0x10,
  WRITE_DATE_TIME: 0x16,
};

const START_BYTE = {
  PC: 0xAA,
  METER: 0xDD,
};

//
// const ERROR = {
//   TIMEOUT: { value: 'TOUT', name: 'Communication timeout' },
//   HEADER_VERIFY: { value: 'HEAD', name: 'Could not verify header packet' },
//   SIZE_VERIFY: { value: 'SIZE', name: 'Could not verify size of packet' },
//   CRC_VERIFY: { value: 'ECRC', name: 'Could not verify CRC of packet' },
//   COMMAND_VERIFY: { value: 'CMND', name: 'Could not verify packet command' },
// };
//
// const FLAGS = {
//   CONTROL_SOLUTION: { value: 0x01, name: 'Control Solution Test' },
//   POST_MEAL: { value: 0x02, name: 'Post-meal' },
//   LO: { value: 0x04, name: 'Low measurement result' },
//   HI: { value: 0x08, name: 'High measurement result' },
//   FASTING: { value: 0x10, name: 'Fasting measurement result' },
//   NORMAL: { value: 0x20, name: 'Normal measurement result with no flag' },
//   KETONE: { value: 0x40, name: 'Ketone measurement result' },
//   LOW_HIGH: { value: 0x80, name: 'Low High flags are available' },
// };
//
// const getStartAddress = (idx) => {
//   // eslint-disable-next-line no-restricted-syntax
//   for (const i in MODEL_CODES) {
//     if (MODEL_CODES[i].name === idx) {
//       return MODEL_CODES[i].startAddress;
//     }
//   }
//   return 'unknown';
// };
//
// const getMaxRecords = (idx) => {
//   // eslint-disable-next-line no-restricted-syntax
//   for (const i in MODEL_CODES) {
//     if (MODEL_CODES[i].name === idx) {
//       return MODEL_CODES[i].maxRecords;
//     }
//   }
//   return 'unknown';
// };
//
const READ_TIMEOUT = 2000; // in milliseconds
// const HEADER_SIZE = 6;
// const KETONE_VALUE_FACTOR = 10;
// const KETONE_HI = 8.0;
// const DATA_LENGTH = 0x0A; // for protocol 1

class GlucocardExpression {
  constructor(cfg) {
    this.cfg = cfg;
    this.serialDevice = this.cfg.deviceComms;
    this.retries = 0;
  }

  buildPacket(command, payload = []) {
    const buf = new ArrayBuffer(11);
    const bytes = new Uint8Array(buf);

    const checksum = command + payload.reduce((a, b) => a + b, 0);

    struct.pack(bytes, 0, 'bb8Bb', START_BYTE.PC, command, payload, checksum);
    debug('Sending:', common.bytes2hex(bytes));

    return buf;
  }

  extractPacketIntoMessages(bytes) {
    const response = struct.unpack(bytes, 0, 'bb8Bb', ['startByte', 'opCode', 'payload', 'checksum']);
    debug('Decoded:', response);

    const checksum = response.opCode + response.payload.reduce((a, b) => a + b, 0);
    if (checksum !== response.checksum) {
      debug('Checksum is', checksum, ', expected', response.checksum);
      throw new Error('Checksum mismatch');
    }

    return response;

    // if (this.protocol === 1) {
    //   let ctr = 0;
    //   const response = [];
    //
    //   while (ctr <= (bytes.length - 3)) {
    //     // data format: 0x8b 0x1X 0x2X
    //     // eslint-disable-next-line no-bitwise
    //     const byte = (((bytes[ctr + 1] & 0x0F) << 4) | (bytes[ctr + 2] & 0x0F));
    //     response.push(byte);
    //     ctr += 3;
    //   }
    //
    //   debug('Decoded:', common.bytes2hex(response));
    //   return response;
    // }
    //
    // const fields = CareSens.extractHeader(bytes);
    //
    // const response = struct.unpack(bytes, 6, `4z${fields.size - 7}BS`, ['command', 'data', 'crc']);
    // debug('Decoded:', response);
    //
    // if (response.command !== COMMAND.GLUCOSE_RESULT) { // glucose result does not use CRC :-O
    //   CareSens.verifyChecksum(bytes, response.crc);
    // }
    //
    // const err = common.getName(ERROR, response.command);
    // if (err !== 'unknown') {
    //   throw new Error(err);
    // } else {
    //   return response;
    // }
  }

  static extractPacket(bytes) {
    const packet = {
      bytes,
      packet_len: bytes.length,
    };

    return packet;
  }

  static packetHandler(buffer) {
    if (buffer.len() < 1) { // only empty buffer is no valid packet
      return false;
    }

    const packet = GlucocardExpression.extractPacket(buffer.bytes());
    if (packet.packet_len !== 0) {
      // cleanup the buffer data
      buffer.discard(packet.packet_len);
    }

    return packet;
  }

  listenForPacket(timeout, command, callback) {
    let listenTimer = null;

    const abortTimeout = () => {
      clearInterval(listenTimer);
      debug('TIMEOUT');
      callback('Timeout error. Is the meter switched on?', null);
    };

    let raw = [];
    let abortTimer = setTimeout(abortTimeout, timeout);
    const expectedLength = 11;

    listenTimer = setInterval(() => {
      if (this.serialDevice.hasAvailablePacket()) {
        // reset abort timeout
        clearTimeout(abortTimer);
        abortTimer = setTimeout(abortTimeout, timeout);

        const { bytes } = this.serialDevice.nextPacket();

        debug('Raw packet received:', common.bytes2hex(bytes));

        raw = raw.concat(Array.from(bytes));
        debug(`Received ${raw.length} of ${expectedLength} bytes`);

        if (raw.length >= expectedLength) {
          clearTimeout(abortTimer);
          clearInterval(listenTimer);
          debug('Packet:', common.bytes2hex(raw));

          try {
            return callback(null, this.extractPacketIntoMessages(raw));
          } catch (err) {
            return callback(err, null);
          }
        }

        return null;
      }
    }, 20);
  }

  async commandResponse(cmd, payload) {
    return new Promise((resolve, reject) => {
      try {
        this.serialDevice.writeSerial(this.buildPacket(cmd, payload), () => {
          this.listenForPacket(5000, cmd, (err, result) => {
            if (err) {
              reject(err);
            }
            resolve(result);
          });
        });
      } catch (e) {
        // exceptions inside Promise won't be thrown, so we have to
        // reject errors here (e.g. device unplugged during data read)
        reject(e);
      }
    });
  }

  async getSerialNumber() {
    // const result = await this.commandResponse(COMMAND.READ_SERIAL);
    //
    // if (this.protocol === 1) {
    //   // we currently only handle SN-1 format
    //   const fields = struct.unpack(result, 0, 'ssssb', ['productCount', 'massProductionCount', 'modelCode', 'programVersion', 'flag']);
    //   this.model = common.getName(MODEL_CODES, fields.modelCode);
    //   const massProductionCount = this.model === 'CVP' ? fields.massProductionCount.toString(16) : fields.massProductionCount;
    //   const serialNumber = this.model +
    //                  massProductionCount.toUpperCase().padStart(2, '0') +
    //                  String.fromCharCode(fields.programVersion + 65) +
    //                  fields.productCount.toString().padStart(5, '0');
    //
    //   return serialNumber;
    // }
    //
    // return String.fromCharCode.apply(null, _.dropRight(result.data)).trim();
  }

  async getDateTime() {
  //   const result = await this.commandResponse(COMMAND.READ_TIME);
  //   const fields = struct.unpack(result.data, 0, 'bbbbbb', ['year', 'month', 'day', 'hours', 'minutes', 'seconds']);
  //   fields.year += 2000;
  //   return sundial.buildTimestamp(fields);
  }

  async getNumberOfRecords() {
    // if (this.protocol === 1 && this.model === 'CVP') {
    //   debug('Retrieving the total number of records not supported on this device');
    //   return null;
    // }
    // const result = await this.commandResponse(COMMAND.CURRENT_INDEX);
    // return struct.extractBEShort(result.data, 0);
  }

  async getRecords(nrOfRecords) {
    // const records = [];
    //
    // if (this.protocol === 1) {
    //   let ctr = 0;
    //
    //   while ((ctr / 8) < getMaxRecords(this.model)) {
    //     debug('Reading adress', (getStartAddress(this.model) + ctr).toString(16));
    //     /* eslint-disable-next-line no-await-in-loop */ // requests to devices are sequential
    //     const result = await this.commandResponse(COMMAND.GLUCOSE_RESULT, ctr);
    //     if (result[0] === 0xFF && result[1] === 0xFF) {
    //       // CVP model stores 0xFFFF at the end of the log
    //       return records;
    //     }
    //
    //     ctr += 8;
    //
    //     const record = struct.unpack(result, 0, 'bbbbbbs', ['year', 'month', 'day', 'hours', 'minutes', 'seconds', 'value']);
    //     record.year += 2000;
    //     record.jsDate = sundial.buildTimestamp(record);
    //     record.flags = 0;
    //
    //     // order here is important, as a value can be marked as both post-meal and control solution
    //     /* eslint-disable no-bitwise */
    //     if (record.value > 20000) {
    //       record.value -= 20000;
    //       record.flags |= FLAGS.CONTROL_SOLUTION.value;
    //     }
    //
    //     if (record.value > 10000) {
    //       record.value -= 10000;
    //       record.flags |= FLAGS.POST_MEAL.value;
    //     }
    //
    //     if (record.value === 0x02BC) {
    //       record.flags |= FLAGS.HI.value;
    //     }
    //
    //     if (record.value === 0x0A) {
    //       record.flags |= FLAGS.LO.value;
    //     }
    //     /* eslint-enable no-bitwise */
    //
    //     records.push(record);
    //   }
    //
    //   return records;
    // }
    //
    // for (let startIndex = 1; startIndex <= nrOfRecords; startIndex += 27) {
    //   // eslint-disable-next-line no-bitwise
    //   const count = ((nrOfRecords - startIndex) >= 27) ? 27 : nrOfRecords - startIndex + 1;
    //   const buf = new ArrayBuffer(3);
    //   const bytes = new Uint8Array(buf);
    //
    //   debug(`Requesting from ${startIndex} to ${startIndex + count - 1} of ${nrOfRecords}`);
    //   struct.pack(bytes, 0, 'Sb', startIndex, count);
    //
    //   // requests to devices are sequential
    //   // eslint-disable-next-line no-await-in-loop
    //   const result = await this.commandResponse(COMMAND.GLUCOSE_RESULT, bytes);
    //   let ctr = 0;
    //
    //   for (let i = 0; i < count; i++) {
    //     const record = struct.unpack(result.data, ctr, 'bbbbbbbS', ['year', 'month', 'day', 'hours', 'minutes', 'seconds', 'flags', 'value']);
    //     record.year += 2000;
    //     record.jsDate = sundial.buildTimestamp(record);
    //     records.push(record);
    //     ctr += 9;
    //   }
    // }
    //
    // return records;
  }

  async setDateTime(dateTime) {
    // const buf = new ArrayBuffer(6);
    // const bytes = new Uint8Array(buf);
    // struct.pack(bytes, 0, 'bbbbbb', ...dateTime);
    // const result = await this.commandResponse(COMMAND.WRITE_TIME, bytes);
    // const newDateTime = Array.from(result.data);
    //
    // if (!_.isEqual(dateTime, newDateTime)) {
    //   debug('Set date/time:', dateTime);
    //   debug('Received date/time:', newDateTime);
    //   throw new Error('Error setting date/time.');
    // }
  }

  static probe(cb) {
    debug('not probing GLUCOCARD Expression');
    cb();
  }

  async ping() {
    const retry = async () => {
      if (this.retries <= 3) {
        debug('Retrying..');
        this.retries += 1;
        await this.ping();
      } else {
        this.retries = 0;
        throw new Error('Device not responding.');
      }
    };

    let result = null;
    try {
      result = await this.commandResponse(OP_CODE.PING);
    } catch(e) {
      await retry();
    }

    if (result.opCode !== OP_CODE.PING || result.payload[0] !== 0x01) {
      debug('Unexpected reponse');
      await retry();
    } else {
      this.retries = 0;
    }
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['Arkray'],
    model: 'GlucocardExpression',
  });

  const serialDevice = config.deviceComms;
  const driver = new GlucocardExpression(cfg);

  const hasFlag = (flag, v) => {
    // eslint-disable-next-line no-bitwise
    if (flag.value & v) {
      return true;
    }
    return false;
  };

  const buildBGRecords = (data) => {
    // _.forEach(data.records, (record, index) => {
    //   let { value } = record;
    //
    //   // According to spec, HI > 600 and LO < 20
    //   let annotation = null;
    //   if (hasFlag(FLAGS.HI, record.flags)) {
    //     value = 601;
    //     annotation = {
    //       code: 'bg/out-of-range',
    //       value: 'high',
    //       threshold: 600,
    //     };
    //   } else if (hasFlag(FLAGS.LO, record.flags)) {
    //     value = 19;
    //     annotation = {
    //       code: 'bg/out-of-range',
    //       value: 'low',
    //       threshold: 20,
    //     };
    //   } else {
    //     value = _.toInteger(value);
    //   }
    //
    //   if (!hasFlag(FLAGS.CONTROL_SOLUTION, record.flags)
    //       && !hasFlag(FLAGS.KETONE, record.flags)) {
    //     const recordBuilder = cfg.builder.makeSMBG()
    //       .with_value(value)
    //       .with_units('mg/dL') // values are always in 'mg/dL'
    //       .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
    //       .set('index', index);
    //
    //     cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.jsDate);
    //
    //     if (annotation) {
    //       annotate.annotateEvent(recordBuilder, annotation);
    //     }
    //
    //     const postRecord = recordBuilder.done();
    //     delete postRecord.index;
    //     data.post_records.push(postRecord);
    //   } else if (hasFlag(FLAGS.CONTROL_SOLUTION, record.flags)) {
    //     debug('Skipping BG control solution test');
    //   }
    // });
  };

  return {
    /* eslint no-param-reassign:
       [ "error", { "props": true, "ignorePropertyModificationsFor": ["data"] } ] */

    detect(deviceInfo, cb) {
      debug('no detect function needed', deviceInfo);
      cb(null, deviceInfo);
    },

    setup(deviceInfo, progress, cb) {
      debug('in setup!');
      progress(100);
      cb(null, { deviceInfo });
    },

    connect(progress, data, cb) {
      serialDevice.connect(data.deviceInfo, GlucocardExpression.packetHandler, (err) => {
        if (err) {
          return cb(err);
        }
        (async () => {
          await driver.ping();

          data.disconnect = false;
          progress(100);
          cb(null, data);
        })().catch((error) => cb(error));
      });
    },

    getConfigInfo(progress, data, cb) {
      debugger;
      progress(0);

      (async () => {
        cfg.deviceInfo.serialNumber = await driver.getSerialNumber();
        cfg.deviceInfo.deviceId = `${cfg.deviceInfo.driverId}-${cfg.deviceInfo.serialNumber}`;

        cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(await driver.getDateTime());
        debug('Config:', cfg);

        common.checkDeviceTime(
          cfg,
          (timeErr, serverTime) => {
            progress(100);
            if (timeErr) {
              if (timeErr === 'updateTime') {
                cfg.deviceInfo.annotations = 'wrong-device-time';

                (async () => {
                  const dateTime = [
                    sundial.formatInTimezone(serverTime, cfg.timezone, 'YY'),
                    sundial.formatInTimezone(serverTime, cfg.timezone, 'M'),
                    sundial.formatInTimezone(serverTime, cfg.timezone, 'D'),
                    sundial.formatInTimezone(serverTime, cfg.timezone, 'H'),
                    sundial.formatInTimezone(serverTime, cfg.timezone, 'm'),
                    sundial.formatInTimezone(serverTime, cfg.timezone, 's'),
                  ];
                  await driver.setDateTime(dateTime.map(Number));
                })().then(() => {
                  data.connect = true;
                  return cb(null, data);
                }).catch((error) => {
                  debug('Error in getConfigInfo: ', error);
                  return cb(error, null);
                });
              } else {
                cb(timeErr, null);
              }
            } else {
              data.connect = true;
              cb(null, data);
            }
          },
        );
      })().catch((error) => {
        debug('Error in getConfigInfo: ', error);
        return cb(error, null);
      });
    },

    fetchData(progress, data, cb) {
      (async () => {
        try {
          debug('in fetchData', data);

          data.nrOfRecords = await driver.getNumberOfRecords();

          if (data.nrOfRecords != null) {
            debug(`Found ${data.nrOfRecords} records..`);
          }

          data.records = await driver.getRecords(data.nrOfRecords);

          progress(100);
          return cb(null, data);
        } catch (error) {
          debug('Error in fetchData: ', error);
          return cb(error, null);
        }
      })();
    },

    processData(progress, data, cb) {
      progress(0);
      cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });
      data.post_records = [];

      // With no date & time settings changes available,
      // timezone is applied across-the-board
      cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

      buildBGRecords(data);

      debug('POST records:', data.post_records);

      if (data.post_records.length === 0) {
        debug('Device has no records to upload');
        return cb(new Error('Device has no records to upload'), null);
      }
      progress(100);
      return cb(null, data);
    },

    uploadData(progress, data, cb) {
      progress(0);

      const sessionInfo = {
        deviceTags: cfg.deviceInfo.tags,
        deviceManufacturers: cfg.deviceInfo.manufacturers,
        deviceModel: cfg.deviceInfo.model,
        deviceSerialNumber: cfg.deviceInfo.serialNumber,
        deviceTime: cfg.deviceInfo.deviceTime,
        deviceId: cfg.deviceInfo.deviceId,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version,
      };

      cfg.api.upload.toPlatform(
        data.post_records, sessionInfo, progress, cfg.groupId,
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
      if (!data.disconnect) {
        serialDevice.disconnect(() => {
          progress(100);
          data.cleanup = true;
          data.disconnect = true;
          cb(null, data);
        });
      } else {
        progress(100);
        cb();
      }
    },
  };
};
