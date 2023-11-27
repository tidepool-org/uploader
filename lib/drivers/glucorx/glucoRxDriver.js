/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2022, Tidepool Project
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

const struct = structJs();
const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('GlucoRxDriver') : console.log;

const COMMAND = {
  READ_TIME: 0x23,
  READ_MODEL: 0x24,
  READ_DATA_TIME: 0x25,
  READ_DATA_RESULT: 0x26,
  READ_SERIAL_1: 0x27,
  READ_SERIAL_2: 0x28,
  READ_NR_RECORDS: 0x2B,
  WRITE_TIME: 0x33,
  COMM_MODE: 0x54,
};

const CONTROL = {
  START: 0x51,
  GW_STOP: 0xA3,
  MD_STOP: 0xA5,
};

const REPORT_ID = {
  GET_SET_UART_ENABLE: 0x41,
  GET_VERSION_INFO: 0x46,
  GET_SET_UART_CONFIG: 0x50,
};

const PARITY = {
  NONE: 0,
  ODD: 1,
  EVEN: 2,
  MARK: 3,
  SPACE: 4,
};

const FLOW_CONTROL = {
  NONE: 0,
  HARDWARE: 1,
};

const DATA_BITS = {
  FIVE: 0x00,
  SIX: 0x01,
  SEVEN: 0x02,
  EIGHT: 0x03,
};

const STOP_BITS = {
  SHORT: 0x00,
  LONG: 0x01,
};

const PACKET_SIZE = 8;

const UART_CONFIG = {
  baud: 19200,
  parity: PARITY.NONE,
  flowControl: FLOW_CONTROL.NONE,
  dataBits: DATA_BITS.EIGHT,
  stopBits: STOP_BITS.SHORT,
};

const FLAGS = {
  AC: { value: 0x10, name: 'Before meal' },
  PC: { value: 0x20, name: 'After meal' },
  CONTROL_SOLUTION: { value: 0x30, name: 'Control solution'},
  HCT: { value: 0x06, name: 'Hematocrit' },
  KETONE: { value: 0x07, name: 'Ketone value' },
  URIC_ACID: { value: 0x08, name: 'Uric acid value' },
  CHOLESTEROL: { value: 0x09, name: 'Cholesterol value' },
  HB: { value: 0x0B, name: 'HB value' },
  LACTATE: { value: 0x0C, name: 'Lactate value' },
  TRIGLYCERIDES: { value: 0x0D, name: 'Triglycerides value' },
};

const MODELS = {
  4277: 'Nexus',
  4279: 'HCT',
  4141: 'Nexus Mini Ultra',
  4283: 'Go',
};

const READ_TIMEOUT = 2000; // in milliseconds
const KETONE_VALUE_FACTOR = 10;
const KETONE_HI = 8.0;

class GlucoRx {
  constructor(cfg) {
    this.cfg = cfg;
    this.hidDevice = this.cfg.deviceComms;
    this.retries = 0;
  }

  buildPacket(command, payload = [0, 0, 0, 0]) {
    const packetlen = PACKET_SIZE + 1;
    const buf = new ArrayBuffer(packetlen);
    const bytes = new Uint8Array(buf);
    let ctr = 0;

    // HID packets have packet size as first byte
    struct.storeByte(PACKET_SIZE, bytes, ctr);
    ctr += 1;

    ctr += struct.pack(bytes, ctr, 'bb4Bb', CONTROL.START, command, payload, CONTROL.GW_STOP);

    struct.storeByte(GlucoRx.calculateChecksum(bytes.slice(1), packetlen - 1), bytes, ctr);

    debug('Sending:', common.bytes2hex(bytes));

    return buf;
  }

  static async enableUART(hidDevice) {
    const buf = new ArrayBuffer(9);
    const bytes = new Uint8Array(buf);

    struct.pack(bytes, 0, 'bIbbbb', REPORT_ID.GET_SET_UART_CONFIG, UART_CONFIG.baud, UART_CONFIG.parity, UART_CONFIG.flowControl, UART_CONFIG.dataBits, UART_CONFIG.stopBits);

    debug('UART config:', common.bytes2hex(bytes));

    debug('Configuring and enabling UART..');
    await hidDevice.sendFeatureReport(buf);
    await hidDevice.sendFeatureReport([REPORT_ID.GET_SET_UART_ENABLE, 1]);
  }

  static calculateChecksum(bytes, packetlen) {
    let crc = 0;
    for (let i = 0; i < packetlen - 1; i++) {
      crc += bytes[i];
    }
    return crc & 0xFF;
  }

  static verifyChecksum(bytes, expected) {
    const calculated = GlucoRx.calculateChecksum(bytes, PACKET_SIZE);
    if (calculated !== expected) {
      debug('Checksum is', calculated.toString(16), ', expected', expected.toString(16));
      throw new Error('Checksum mismatch');
    }
  }

  static parseDateTime(result) {
    return {
      month: ((result.payload[1] & 0x01) << 3) | (result.payload[0] >> 5),
      day: result.payload[0] & 0x1F,
      year: (result.payload[1] >> 1) + 2000,
      hours: result.payload[3] & 0x1F,
      minutes: result.payload[2] & 0x3F,
      seconds: 0,
    };
  }

  extractPacketIntoMessages(bytes) {
    const response = struct.unpack(bytes, 0, '.b4B.b', ['command', 'payload', 'crc']);
    debug('Command:', response.command.toString(16));
    debug('Payload:', common.bytes2hex(response.payload));

    GlucoRx.verifyChecksum(bytes, response.crc);

    if (response.command === COMMAND.COMM_MODE) {
      debug('Notification for entering communication mode');
      return response.command;
    }

    return response;
  }

  async commandResponse(cmd, payload) {
    let message = '';

    await this.hidDevice.sendPromisified(this.buildPacket(cmd, payload));
    debug('Sent command.');

    let raw = [];
    let result;
    let foundStart = false;
    let foundEnd = false;
    let packetSize = 64;
    do {
      result = [];
      // requests to devices are sequential
      // eslint-disable-next-line no-await-in-loop
      result = await this.hidDevice.receiveTimeout(READ_TIMEOUT);
      debug('Incoming bytes:', common.bytes2hex(result));

      if (result.length > 0) {
        let bytes = null;
        if (result.length > 1) {
          if (result.slice(1).every(item => item === 0)) {
            // only first byte in array is valid
            bytes = [result[0]];
          } else {
            const [ length ] = result;
            bytes = result.slice(1, length + 1);
          }
        } else {
          bytes = result;
        }

        if (!foundStart) {
          if (bytes.includes(CONTROL.START)) {
            foundStart = true;
          }
        }

        if (foundStart) {
          raw = raw.concat(bytes);

          if (raw[raw.length-2] === CONTROL.MD_STOP && raw.length >= PACKET_SIZE) {
            foundEnd = true;
          }
        }
      }
    } while (!foundEnd);

    // Only process if we get data
    if (raw.length > 0) {
      message = this.extractPacketIntoMessages(raw);
    }

    if (message === COMMAND.COMM_MODE) {
      // try again
      return await this.commandResponse(cmd, payload);
    }

    return message;
  }

  async getModel() {
    const result = await this.commandResponse(COMMAND.READ_MODEL);
    return `${result.payload[1].toString(16)}${result.payload[0].toString(16)}`;
  }

  async getSerialNumber() {
    const serial1 = await this.commandResponse(COMMAND.READ_SERIAL_1);
    const serial2 = await this.commandResponse(COMMAND.READ_SERIAL_2);
    return common.bytes2hex(serial2.payload.reverse(), true).concat(common.bytes2hex(serial1.payload.reverse(), true));
  }

  async getDateTime() {
    const result = await this.commandResponse(COMMAND.READ_TIME);
    return sundial.buildTimestamp(GlucoRx.parseDateTime(result));
  }

  async getNumberOfRecords() {
    const result = await this.commandResponse(COMMAND.READ_NR_RECORDS);
    return struct.extractShort(result.payload, 0);
  }

  async getRecords(nrOfRecords) {
    const records = [];

    for (let startIndex = 0; startIndex < nrOfRecords; startIndex++) {
      const payload = [];
      const record = {};
      struct.storeShort(startIndex, payload, 0);
      // requests to devices are sequential
      // eslint-disable-next-line no-await-in-loop
      const rawTime = await this.commandResponse(COMMAND.READ_DATA_TIME, payload);
      record.jsDate = sundial.buildTimestamp(GlucoRx.parseDateTime(rawTime));

      const result = await this.commandResponse(COMMAND.READ_DATA_RESULT, payload);
      record.value = struct.extractShort(result.payload, 0);
      record.flags = struct.extractShort(result.payload, 2) >> 10;

      debug(`Record: ${sundial.formatDeviceTime(record.jsDate)} - ${record.value} (flags: 0x${record.flags.toString(16)})`);

      records.push(record);
    }

    return records;
  }

  async setDateTime(dateTime) {
    const bytes =[];

    bytes[0] = (dateTime.day & 0x1F) | ((dateTime.month & 0x07) << 5);
    bytes[1] = (dateTime.year << 1) | ((dateTime.month & 0x0F) >> 3);
    bytes[2] = dateTime.minutes & 0x3F;
    bytes[3] = dateTime.hours & 0x1F;

    const result = await this.commandResponse(COMMAND.WRITE_TIME, bytes);
    const newDateTime = GlucoRx.parseDateTime(result);
    newDateTime.year -= 2000;

    if (!_.isEqual(dateTime, newDateTime)) {
      debug('Set date/time:', dateTime);
      debug('Received date/time:', newDateTime);
      throw new Error('Error setting date/time.');
    }
  }

  static probe(cb) {
    debug('not probing GlucoRx');
    cb();
  }

  async ping() {
    await this.hidDevice.sendPromisified(this.buildPacket(COMMAND.READ_MODEL));
    debug('Sent ping.');
    const result = await this.hidDevice.receiveTimeout(READ_TIMEOUT);
    debug('Received:', common.bytes2hex(result));

    if (result.length === 0) {
      if (this.retries <= 3) {
        debug('Retrying..');
        this.retries += 1;
        await this.ping();
      } else {
        throw new Error('Device not responding.');
      }
    } else {
      this.retries = 0;
    }
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['GlucoRx'],
  });

  let hidDevice = config.deviceComms;

  const driver = new GlucoRx(cfg);

  const hasFlag = (flag, v) => {
    // eslint-disable-next-line no-bitwise
    if ((flag.value & v) === flag.value) {
      return true;
    }
    return false;
  };

  const buildBGRecords = (data) => {
    _.forEach(data.records, (record, index) => {
      let { value } = record;

      // According to spec, HI > 600 and LO < 20
      let annotation = null;
      if (value > 600) {
        value = 601;
        annotation = {
          code: 'bg/out-of-range',
          value: 'high',
          threshold: 600,
        };
      } else if (value < 20) {
        value = 19;
        annotation = {
          code: 'bg/out-of-range',
          value: 'low',
          threshold: 20,
        };
      } else {
        value = _.toInteger(value);
      }

      if (!hasFlag(FLAGS.CONTROL_SOLUTION, record.flags)
          && !hasFlag(FLAGS.KETONE, record.flags)
          && !hasFlag(FLAGS.HCT, record.flags)) {
        const recordBuilder = cfg.builder.makeSMBG()
          .with_value(value)
          .with_units('mg/dL') // values are always in 'mg/dL'
          .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
          .set('index', index);

        cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.jsDate);

        if (annotation) {
          annotate.annotateEvent(recordBuilder, annotation);
        }

        const postRecord = recordBuilder.done();
        delete postRecord.index;
        data.post_records.push(postRecord);
      }
    });
  };

  const buildKetoneRecords = (data) => {
    _.forEach(data.records, (record, index) => {
      if (hasFlag(FLAGS.KETONE, record.flags)) {
        let value = record.value / 30.0;

        // According to spec, HI > 8 mmol/L
        // there is no LO as values are between 0 and 8 mmol/L
        let annotation = null;
        if (value > 8.0) {
          value = KETONE_HI + (1 / KETONE_VALUE_FACTOR);
          annotation = {
            code: 'ketone/out-of-range',
            value: 'high',
            threshold: KETONE_HI,
          };
        } else {
          value = _.toInteger(value) / KETONE_VALUE_FACTOR;
        }

        if (!hasFlag(FLAGS.CONTROL_SOLUTION, record.flags)) {
          const recordBuilder = cfg.builder.makeBloodKetone()
            .with_value(value)
            .with_units('mmol/L') // values are always in 'mmol/L'
            .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
            .set('index', index);

          cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.jsDate);

          if (annotation) {
            annotate.annotateEvent(recordBuilder, annotation);
          }

          const postRecord = recordBuilder.done();
          delete postRecord.index;
          data.post_records.push(postRecord);
        } else {
          debug('Skipping ketone control solution test');
        }
      }
    });
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
      hidDevice.connect(cfg.deviceInfo, GlucoRx.probe, (err) => {
        if (err) {
          cb(err);
        } else {
          (async () => {
            // The CP2110 chip used implements serial over HID,
            // so we need to enable the UART first.
            // see https://www.silabs.com/documents/public/application-notes/AN434-CP2110-4-Interface-Specification.pdf
            await GlucoRx.enableUART(hidDevice);
            await driver.ping();

            data.disconnect = false;
            progress(100);
            cb(null, data);
          })().catch((error) => cb(error));
        }
      });
    },

    getConfigInfo(progress, data, cb) {
      progress(0);

      (async () => {
        data.model = await driver.getModel();
        cfg.deviceInfo.model = MODELS[data.model];
        if(cfg.deviceInfo.model == null) {
          cfg.deviceInfo.model = data.model; // if unknown, use model number instead
        }
        data.deviceModel = cfg.deviceInfo.model; // for metrics

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
                  const dateTime = {
                    year: _.toInteger(sundial.formatInTimezone(serverTime, cfg.timezone, 'YY')),
                    month: _.toInteger(sundial.formatInTimezone(serverTime, cfg.timezone, 'M')),
                    day: _.toInteger(sundial.formatInTimezone(serverTime, cfg.timezone, 'D')),
                    hours: _.toInteger(sundial.formatInTimezone(serverTime, cfg.timezone, 'H')),
                    minutes: _.toInteger(sundial.formatInTimezone(serverTime, cfg.timezone, 'm')),
                    seconds: 0,
                  };
                  await driver.setDateTime(dateTime);
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
      buildKetoneRecords(data);

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
        hidDevice.disconnect(data, () => {
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
