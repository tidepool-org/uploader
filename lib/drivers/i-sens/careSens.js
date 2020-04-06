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

import _ from 'lodash';
import sundial from 'sundial';

// import annotate from '../../eventAnnotations';
import common from '../../commonFunctions';
import TZOUtil from '../../TimezoneOffsetUtil';
import structJs from '../../struct';
import crcCalculator from '../../crc';

const struct = structJs();
const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('CareSensDriver') : console.log;

const COMMAND = {
  HEADER: 'iSPc',
  GLUCOSE_RESULT: 'GLUE',
  CURRENT_INDEX: 'NCOT',
  READ_SERIAL: 'RSNB',
  READ_TIME: 'RTIM',
  WRITE_TIME: 'WTIM',
};

const ASCII_CONTROL = {
  STX: 0x02,
  ETX: 0x03,
};

const REPORT_ID = {
  GET_SET_UART_ENABLE: 0x41,
  // SET_PURGE_FIFOS: 0x43,
  GET_VERSION_INFO: 0x46,
  GET_SET_UART_CONFIG: 0x50,
};

// const PURGE_TYPE = {
//   TRANSMIT_FIFO: 0x01,
//   RECEIVE_FIFO: 0x02,
//   BOTH_FIFO: 0x03,
// };

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

// const ERROR = {
//   TIMEOUT: 'TOUT',
//   HEADER_VERIFY: 'HEAD',
//   SIZE_VERIFY: 'SIZE',
//   CRC_VERIFY: 'ECRC',
//   COMMAND_VERIFY: 'CMND',
// };

const READ_TIMEOUT = 2000; // in milliseconds

class CareSens {
  constructor(cfg) {
    this.cfg = cfg;
    this.hidDevice = this.cfg.deviceComms;
    this.retries = 0;
  }

  static buildPacket(command, payload = []) {
    const datalen = 7 + payload.length; // includes length of command, payload, CRC and ETX
    const packetlen = datalen + 7; // adds header, size and STX
    const buf = new ArrayBuffer(packetlen);
    const bytes = new Uint8Array(buf);

    let ctr = struct.pack(bytes, 0, 'bb4zb4z', 0x0D, ASCII_CONTROL.STX, COMMAND.HEADER, datalen, command);
    ctr += struct.copyBytes(bytes, ctr, payload, payload.length);
    struct.storeByte(ASCII_CONTROL.ETX, bytes, ctr); // to calculate CRC, overwritten below
    const crc = crcCalculator.calcCRC_A(bytes.slice(1), packetlen - 3);
    ctr += struct.pack(bytes, ctr, 'Sb', crc, ASCII_CONTROL.ETX);

    debug('Sending:', common.bytes2hex(bytes));

    return buf;
  }

  static buildUARTConfig(config) {
    const buf = new ArrayBuffer(9);
    const bytes = new Uint8Array(buf);

    struct.pack(bytes, 0, 'bIbbbb', REPORT_ID.GET_SET_UART_CONFIG, config.baud, config.parity, config.flowControl, config.dataBits, config.stopBits);

    debug('UART config:', common.bytes2hex(bytes));

    return buf;
  }

  static verifyChecksum(bytes, expected) {
    const buf = bytes.slice(2); // not using two bytes at beginning
    buf.splice(buf.length - 3, 2); // and removing two existing crc bytes
    const calculated = crcCalculator.calcCRC_A(buf, buf.length);
    if (calculated !== expected) {
      debug('Checksum is', calculated, ', expected', expected);
      throw new Error('Checksum mismatch');
    }
  }

  static extractPacketIntoMessages(bytes) {
    const fields = struct.unpack(bytes, 2, '.4zb', ['header', 'size']);
    debug('Fields:', fields);
    if (fields.header !== COMMAND.HEADER) {
      throw new Error('Header not found');
    }

    const response = struct.unpack(bytes, 8, `4z${fields.size - 7}zS`, ['command', 'data', 'crc']);
    debug('Decoded:', response);

    CareSens.verifyChecksum(bytes, response.crc);
    // const re = /\(([^)]*)\)(\w{2})/g;

    // let results;
    // const messages = [];
    //
    // // eslint-disable-next-line no-cond-assign
    // while ((results = re.exec(str)) !== null) {
    //   if (results != null) {
    //     if (TrueMetrix.verifyChecksum(results[1], results[2], CHECKSUM_TYPE.FRAME)) {
    //       messages.push(results[1]);
    //     }
    //   }
    // }
    // return messages;
  }

  async commandResponse(cmd, payload) {
    let message = '';

    const bytesWritten = await this.hidDevice.sendPromisified(CareSens.buildPacket(cmd, payload));
    debug('Sent', bytesWritten, 'bytes.');

    let raw = [];
    let result;
    do {
      result = [];
      // requests to devices are sequential
      // eslint-disable-next-line no-await-in-loop
      result = await this.hidDevice.receiveTimeout(READ_TIMEOUT);
      // const length = result[0];

      debug('Incoming bytes:', common.bytes2hex(result));

      if (result.length > 0) { // && length < 64) {
        raw = raw.concat(result.slice(1));
      }
    } while (result[result.length - 1] !== ASCII_CONTROL.ETX && result.length > 0);

    // Only process if we get data
    if (raw.length > 0) {
      debug('Packet:', String.fromCharCode.apply(null, raw));
      message = CareSens.extractPacketIntoMessages(raw);
    }
    debug('Message(s):', message);
    return message;
  }

  async getSerialNumber() {
    return this.commandResponse(COMMAND.READ_SERIAL);
  }

  async getDateTime() {
    const date = await this.commandResponse('$date?');
    const time = await this.commandResponse('$time?');

    const fmt = 'MM,DD,YY HH,mm';
    const ddate = `${date} ${time}`;
    return sundial.parseFromFormat(ddate, fmt);
  }

  async getRecords() {
    return new Promise((resolve, reject) => {
      this.protocol.getDBRecords('$result?', (result) => {
        resolve(result);
      },
      (err) => {
        debug('getRecords Error:', err);
        reject(err);
      });
    });
  }

  async setTime(newTime, newDate) {
    const timeResponse = await this.commandResponse(`$time,${newTime}`);
    const dateResponse = await this.commandResponse(`$date,${newDate}`);

    if (timeResponse || dateResponse) {
      throw new Error('Error setting date/time.');
    }
  }

  static probe(cb) {
    debug('not probing CareSens');
    cb();
  }

  async ping() {
    const bytesWritten = await this.hidDevice.sendPromisified([0x01, 0x80]);
    debug('Sent', bytesWritten, 'bytes.');
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
    manufacturers: ['Abbott'],
    model: 'Precision/Optium Neo',
  });

  const hidDevice = config.deviceComms;
  const driver = new CareSens(cfg);

  // function filterHistory(type, records) {
  //   return records.filter((record) => type === _.toInteger(record.split(',')[0]));
  // }

  function parseDateTime(fields) {
    const time = {
      month: _.toInteger(fields[2]),
      day: _.toInteger(fields[3]),
      year: _.toInteger(fields[4]) + 2000,
      hours: _.toInteger(fields[5]),
      minutes: _.toInteger(fields[6]),
      seconds: 0,
    };
    return sundial.buildTimestamp(time);
  }

  // function buildTimeChangeRecords(data) {
  //   _.forEach(filterHistory(RECORD_TYPE.TIME_CHANGE, data.records), (record) => {
  //     const fields = record.split(',');
  //
  //     const index = _.toInteger(fields[1]);
  //     const toDatum = parseDateTime(fields);
  //     const valid = _.toInteger(fields[7]);
  //
  //     const fromTime = {
  //       month: _.toInteger(fields[8]),
  //       day: _.toInteger(fields[9]),
  //       year: _.toInteger(fields[10]) + 2000,
  //       hours: _.toInteger(fields[11]),
  //       minutes: _.toInteger(fields[12]),
  //       seconds: 0,
  //     };
  //     const fromDatum = sundial.buildTimestamp(fromTime);
  //
  //     const timeChange = cfg.builder.makeDeviceEventTimeChange()
  //       .with_change({
  //         from: sundial.formatDeviceTime(fromDatum),
  //         to: sundial.formatDeviceTime(toDatum),
  //         agent: 'manual',
  //       })
  //       .with_deviceTime(sundial.formatDeviceTime(toDatum))
  //       .with_payload({ valid })
  //       .set('jsDate', toDatum)
  //       .set('index', index);
  //     data.post_records.push(timeChange);
  //   });
  // }
  //
  // function buildBGRecords(data) {
  //   const records = filterHistory(RECORD_TYPE.GLUCOSE, data.records);
  //
  //   _.forEach(records, (record) => {
  //     const fields = record.split(',');
  //
  //     const index = _.toInteger(fields[1]);
  //     let value = fields[8];
  //     // eslint-disable-next-line no-unneeded-ternary
  //     const isControlSolution = _.toInteger(fields[10]) ? false : true;
  //     const jsDate = parseDateTime(fields);
  //
  //     // According to spec, HI > 500 and LO < 20
  //     let annotation = null;
  //     if (value === 'HI') {
  //       value = 501;
  //       annotation = {
  //         code: 'bg/out-of-range',
  //         value: 'high',
  //         threshold: 500,
  //       };
  //     } else if (value === 'LO') {
  //       value = 19;
  //       annotation = {
  //         code: 'bg/out-of-range',
  //         value: 'low',
  //         threshold: 20,
  //       };
  //     } else {
  //       value = _.toInteger(value);
  //     }
  //
  //     if (isControlSolution === false) {
  //       const recordBuilder = cfg.builder.makeSMBG()
  //         .with_value(value)
  //         .with_units('mg/dL') // values are always in 'mg/dL'
  //         .with_deviceTime(sundial.formatDeviceTime(jsDate))
  //         .set('index', index);
  //
  //       cfg.tzoUtil.fillInUTCInfo(recordBuilder, jsDate);
  //
  //       if (annotation) {
  //         annotate.annotateEvent(recordBuilder, annotation);
  //       }
  //
  //       const postRecord = recordBuilder.done();
  //       delete postRecord.index;
  //       data.post_records.push(postRecord);
  //     } else {
  //       debug('Skipping BG control solution test');
  //     }
  //   });
  // }
  //
  // function buildKetoneRecords(data) {
  //   const records = filterHistory(RECORD_TYPE.KETONE, data.records);
  //
  //   _.forEach(records, (record) => {
  //     const fields = record.split(',');
  //
  //     const index = _.toInteger(fields[1]);
  //     let value = fields[8];
  //     // eslint-disable-next-line no-unneeded-ternary
  //     const isControlSolution = _.toInteger(fields[9]) ? false : true;
  //     const jsDate = parseDateTime(fields);
  //
  //     // According to spec, HI > 8 mmol/L
  //     // there is no LO as values are between 0 and 8 mmol/L
  //     let annotation = null;
  //     if (value === 'HI') {
  //       value = KETONE_HI + (1 / KETONE_VALUE_FACTOR);
  //       annotation = {
  //         code: 'ketone/out-of-range',
  //         value: 'high',
  //         threshold: KETONE_HI,
  //       };
  //     } else {
  //       value = _.toInteger(value) / KETONE_VALUE_FACTOR;
  //     }
  //
  //     if (isControlSolution === false) {
  //       const recordBuilder = cfg.builder.makeBloodKetone()
  //         .with_value(value)
  //         .with_units('mmol/L') // values are always in 'mmol/L'
  //         .with_deviceTime(sundial.formatDeviceTime(jsDate))
  //         .set('index', index);
  //
  //       cfg.tzoUtil.fillInUTCInfo(recordBuilder, jsDate);
  //
  //       if (annotation) {
  //         annotate.annotateEvent(recordBuilder, annotation);
  //       }
  //
  //       const postRecord = recordBuilder.done();
  //       delete postRecord.index;
  //       data.post_records.push(postRecord);
  //     } else {
  //       debug('Skipping ketone control solution test');
  //     }
  //   });
  // }

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
      hidDevice.connect(cfg.deviceInfo, CareSens.probe, (err) => {
        if (err) {
          cb(err);
        } else {
          const uartConfig = {
            baud: 9600,
            parity: PARITY.NONE,
            flowControl: FLOW_CONTROL.NONE,
            dataBits: DATA_BITS.EIGHT,
            stopBits: STOP_BITS.SHORT,
          };
          try {
            const report = CareSens.buildUARTConfig(uartConfig);
            debug('Configuring and enabling UART..');
            hidDevice.sendFeatureReport(report);
            hidDevice.sendFeatureReport([REPORT_ID.GET_SET_UART_ENABLE, 1]);
          } catch (error) {
            return cb(error);
          }

          driver.ping().then(() => {
            data.disconnect = false;
            progress(100);
            cb(null, data);
          }).catch((error) => cb(error));
        }
      });
    },

    getConfigInfo(progress, data, cb) {
      progress(0);

      (async () => {
        cfg.deviceInfo.serialNumber = await driver.getSerialNumber();
        cfg.deviceInfo.deviceId = `${cfg.deviceInfo.driverId}-${cfg.deviceInfo.serialNumber}`;
        return cb();
        // cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(await driver.getDateTime());
      })().then(() => {
        common.checkDeviceTime(
          cfg,
          (timeErr, serverTime) => {
            progress(100);
            if (timeErr) {
              if (timeErr === 'updateTime') {
                cfg.deviceInfo.annotations = 'wrong-device-time';
                const newTime = sundial.formatInTimezone(serverTime, cfg.timezone, 'HH,mm');
                const newDate = sundial.formatInTimezone(serverTime, cfg.timezone, 'MM,DD,YY');

                (async () => {
                  await driver.setTime(newTime, newDate);
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
      }).catch((error) => {
        debug('Error in getConfigInfo: ', error);
        return cb(error, null);
      });
    },

    fetchData(progress, data, cb) {
      (async () => {
        try {
          debug('in fetchData', data);
          data.records = await driver.getRecords();
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

      const mostRecent = sundial.applyTimezone(parseDateTime(data.records[0].split(',')), cfg.timezone).toISOString();
      // buildTimeChangeRecords(data);
      cfg.tzoUtil = new TZOUtil(cfg.timezone, mostRecent, data.post_records);

      // buildBGRecords(data);
      // buildKetoneRecords(data);

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
