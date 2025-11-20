/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2025, Tidepool Project
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
const debug = isBrowser ? require('bows')('AutocodeDriver') : console.log;

const READ_TIMEOUT = 3000;

const COMMAND = {
  READ_RECORDS: 0x05,
  // READ_RECORD: 0x01,
  // WRITE_TIME: 0x04,
  // READ_SERIAL: 0x09,
  // POWER_OFF: 0x0B,
};

const ETX = 0x03;
const EOT = 0x04;


const UART_CONFIG = {
  reportId: 0,
  set: 1,
  baud: 57600,
  parity: 0,
  flowControl: 0,
  dataBits: 8,
};

const EVENT = {
  NORMAL: 0x00,
  AFTER_MEAL: 0x01,
  BEFORE_MEAL: 0x02,
  CONTROL: 0x03,
};

class Autocode {
  constructor(cfg) {
    this.cfg = cfg;
    this.hidDevice = this.cfg.deviceComms;
  }

  buildPacket(command, data = []) {
    const buf = new ArrayBuffer(33);
    const bytes = new Uint8Array(buf);
    const size = data.length + 1;

    let ctr = struct.pack(bytes, 0, 'bbb', 0x00, size, command);

    // if (data.length > 0) {
    //   ctr += struct.copyBytes(bytes, ctr, data, data.length);
    // }

    // const checksum = this.calculateChecksum(command, data, size);
    // ctr += struct.pack(bytes, ctr, 'bb', checksum.low, checksum.high);

    debug('Sending bytes:', common.bytes2hex(bytes));
    return bytes;
  }

  // calculateChecksum(command, data = [], size) {
  //   const ckl = ~(STX ^ ~size ^ data.filter((_, i) => i % 2 === 0).reduce((acc, val) => acc ^ val, 0));
  //   const ckh = ~(size ^ command ^ data.filter((_, i) => i % 2 !== 0).reduce((acc, val) => acc ^ val, 0));

  //   return {
  //     low: ckl & 0xFF,
  //     high: ckh & 0xFF,
  //   };
  // }

  static wait(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async commandResponse(cmd, payload) {
    const bytes = this.buildPacket(cmd, payload);
    await this.hidDevice.sendPromisified(bytes);

    const buffer = [];
    let result = [];
    let complete = false;

    // eslint-disable-next-line no-await-in-loop
    while (!complete) {
      result = await this.hidDevice.receiveTimeout(READ_TIMEOUT);
      debug('Incoming bytes:', common.bytes2hex(result));

      const [length] = result;

      // Extract payload bytes
      for (let i = 1; i <= length && i < result.length; i++) {
        const byte = result[i];
        buffer.push(byte);

        if (buffer.at(-1) === EOT && buffer.at(-2) === ETX) {
          complete = true;
        }
      }
    }

    const message = String.fromCharCode(...buffer);
    debug('Received:', message);

    return message;
  }

//   async getRecords(nrOfRecords) {
//     const records = [];

//     for (let startIndex = 0; startIndex < nrOfRecords; startIndex++) {
//       const index = [];
//       const record = {};
//       struct.storeBEShort(startIndex, index, 0);
//       // requests to devices are sequential
//       // eslint-disable-next-line no-await-in-loop
//       const result = await this.commandResponse(COMMAND.READ_RECORD, index);

//       const time = {
//         year: 2000 + _.toInteger((result.payload[2] & 0b11111110) >> 1),
//         month: ((result.payload[2] & 0x01) << 3) | ((result.payload[3] & 0b11100000) >> 5),
//         day: result.payload[3] & 0b00011111,
//         hours: ((result.payload[6] & 0b00000111) << 2) | ((result.payload[7] & 0b11000000) >> 6),
//         minutes: result.payload[7] & 0b00111111,
//         seconds: 0,
//       };

//       record.index = struct.extractBEShort(result.payload, 0);
//       record.jsDate = sundial.buildTimestamp(time);
//       record.value = ((result.payload[4] & 0b00000011) << 8) | result.payload[5];
//       record.event = ((result.payload[6] & 0b11000000) >> 6);
//       records.push(record);
//     }

//     return records;
//   }

//   async setDateTime(serverTime) {

//     const buf = new ArrayBuffer(6);
//     const bytes = new Uint8Array(buf);

//     const dateTime = {
//       year: _.toInteger(sundial.formatInTimezone(serverTime, this.cfg.timezone, 'YY')),
//       month: _.toInteger(sundial.formatInTimezone(serverTime, this.cfg.timezone, 'M')),
//       day: _.toInteger(sundial.formatInTimezone(serverTime, this.cfg.timezone, 'D')),
//       hours: _.toInteger(sundial.formatInTimezone(serverTime, this.cfg.timezone, 'H')),
//       minutes: _.toInteger(sundial.formatInTimezone(serverTime, this.cfg.timezone, 'm')),
//       seconds: _.toInteger(sundial.formatInTimezone(serverTime, this.cfg.timezone, 's')),
//     };

//     let ctr = struct.pack(bytes, 0, 'bbbbbb',
//       dateTime.year, dateTime.month, dateTime.day,
//       dateTime.hours, dateTime.minutes, dateTime.seconds,
//     );

//     const result = await this.commandResponse(COMMAND.WRITE_TIME, bytes);
//     const newDateTime = struct.unpack(result.payload, 0, 'bbbbb', [
//       'year', 'month', 'day', 'hours', 'minutes',
//     ]);
//     delete dateTime.seconds;

//     if (!_.isEqual(dateTime, newDateTime)) {
//       debug('Set date/time:', dateTime);
//       debug('Received date/time:', newDateTime);
//       throw new Error('Error setting date/time.');
//     }
//   }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['Prodigy'],
    model: 'Autocode',
  });

  const hidDevice = config.deviceComms;
  const driver = new Autocode(cfg);

  function buildBGRecords(data) {
    _.forEach(data.records, (record) => {
      let annotation = null;
      if (record.value === 601) {
        annotation = {
          code: 'bg/out-of-range',
          value: 'high',
          threshold: 600,
        };
      } else if (record.value === 19) {
        annotation = {
          code: 'bg/out-of-range',
          value: 'low',
          threshold: 20,
        };
      }

      if (record.event !== EVENT.CONTROL) {
        const recordBuilder = cfg.builder.makeSMBG()
          .with_value(record.value)
          .with_units('mg/dL') // values are always in 'mg/dL'
          .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
          .set('index', record.index);

        cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.jsDate);

        if (annotation) {
          annotate.annotateEvent(recordBuilder, annotation);
        }

        const postRecord = recordBuilder.done();
        delete postRecord.index;
        data.post_records.push(postRecord);
      } else {
        debug('Skipping BG control solution test');
      }
    });
  }

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
      hidDevice.connect(cfg.deviceInfo, Autocode.getRecords, async (err) => {
        if (err) {
          return cb(err);
        }

        const buf = new ArrayBuffer(9);
        const bytes = new Uint8Array(buf);

        struct.pack(bytes, 0, 'bbibbb',
          UART_CONFIG.reportId,
          UART_CONFIG.set,
          UART_CONFIG.baud,
          UART_CONFIG.parity,
          UART_CONFIG.flowControl,
          UART_CONFIG.dataBits
        );

        debug('Configuring UART..');
        await hidDevice.sendFeatureReport(buf);
        data.disconnect = false;
        progress(100);
        return cb(null, data);
      });
    },

    getConfigInfo(progress, data, cb) {
      progress(0);
      data.connect = true;
      cb(null, data);

      // (async () => {
      //   data.nrOfRecords = await driver.getNumberOfRecords();

      //   cfg.deviceInfo.serialNumber = await driver.getSerialNumber();
      //   cfg.deviceInfo.deviceId = `${cfg.deviceInfo.driverId}-${cfg.deviceInfo.serialNumber}`;
      // })().then(() => {

      //   cfg.api.getTime(function (err, result) {
      //     if (err) {
      //       return cb(err);
      //     }
      //     const serverTime = sundial.parseFromFormat(result);
      //     debug('Server time:', serverTime);

      //     cfg.displayTimeModal(function (error) {
      //       if (error === 'deviceTimePromptClose') {
      //         return cb(error, null);
      //       }

      //       driver.setDateTime(serverTime).then((err) => {
      //         cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(serverTime);
      //         data.connect = true;
      //         cb(err, data);
      //       }).catch((err) => {
      //         return cb(err);
      //       });
      //     }, cfg, { serverTime, deviceTime: null });
      //   });
      // }).catch((error) => {
      //   debug('Error in getConfigInfo: ', error);
      //   return cb(error, null);
      // });
    },

    fetchData(progress, data, cb) {
      (async () => {
        try {
          debug('in fetchData', data);
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
      data.deviceModel = cfg.deviceInfo.model; // for metrics
      data.post_records = [];

      if (data.records.length > 0) {
        const mostRecent = sundial.applyTimezone(data.records[0].jsDate, cfg.timezone).toISOString();
        cfg.tzoUtil = new TZOUtil(cfg.timezone, mostRecent, data.post_records);
      }

      buildBGRecords(data);

      debug('POST records:', data.post_records);

      if (data.post_records.length === 0) {
        debug('Device has no records to upload');
        const err = new Error('No records to upload');
        err.code = 'E_NO_RECORDS';
        return cb(err, null);
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
      driver.turnOff().then((result) => {
        debug('in disconnect');
        progress(100);
        cb(null, data);
      }).catch((err) => {
        console.log(err);
      });
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');
      if (!data.disconnect) {
        cfg.deviceComms.removeListeners();
        cfg.deviceComms.disconnect(data, () => {
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
