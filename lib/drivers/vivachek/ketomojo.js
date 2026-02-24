/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2026, Tidepool Project
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

/* global BluetoothUUID */
/* eslint no-restricted-syntax: [0, "ForInStatement"] */
/* eslint-disable global-require, no-global-assign, guard-for-in, no-param-reassign */

import _ from 'lodash';
import sundial from 'sundial';

import TZOUtil from '../../TimezoneOffsetUtil';
import annotate from '../../eventAnnotations';
import crcCalculator from '../../crc';
import env from '../../../app/utils/env';
import structJs from '../../struct';

const struct = structJs();

// eslint-disable-next-line no-console
const debug = env.browser ? require('bows')('KetoMojo') : console.log;

let remote;
if (env.electron) {
  remote = require('@electron/remote');
}

const KETO_SERVICE = '0003cdd0-0000-1000-8000-00805f9b0131';
const KETO_NOTIFICATION = '0003cdd1-0000-1000-8000-00805f9b0131';
const KETO_WRITE = '0003cdd2-0000-1000-8000-00805f9b0131';

const KETO2_SERVICE = '0000fee7-0000-1000-8000-00805f9b34fb';
const KETO2_WRITE = '0000fec7-0000-1000-8000-00805f9b34fb';
const KETO2_INDICATE = '0000fec8-0000-1000-8000-00805f9b34fb';
const KETO2_READ = '0000fec9-0000-1000-8000-00805f9b34fb';

const BEGIN = 0x7b;
const END = 0x7d;
const TARGET_CODE = 0x20;
const SOURCE_CODE = 0x10;

const COMMAND_READ_SERIAL = 0x77;
const COMMAND_SET_DATETIME = 0x44;
const COMMAND_READ_NROFRECORDS = 0xDB;
const COMMAND_GET_RECORDS = 0x16;
const EXTENDED_CODE_READ = 0x55;
const EXTENDED_CODE_WRITE = 0x66;

const TIMEOUT = 3000;

const MEAL_FLAG = {
  0: 'none',
  1: 'before',
  2: 'after',
};

const SAMPLE_TYPE = {
  0x11: 'glucose',
  0x22: 'glucoseControl',
  0x55: 'ketone',
  0x66: 'ketoneControl',
};


const options = {
  filters: [
    {
      namePrefix: 'Keto-Mojo',
    },
  ],
  optionalServices: ['device_information', KETO_SERVICE],
};

let self = null;

export class KetoMojo extends EventTarget {
  constructor() {
    super();
    this.records = [];
    this.retries = 0;
    this.buffer = [];
    self = this; // so that we can access it from event handler
  }

  static timeout(delay) {
    return new Promise((resolve, reject) => setTimeout(reject, delay, new Error('Timeout error')));
  }

  // CRC 0xABCD → nibbles [0x0C, 0x0D, 0x0A, 0x0B] (low byte first)
  /* eslint-disable no-bitwise */
  static encodeCRC(crc) {
    const lo = crc & 0xFF;
    const hi = (crc >> 8) & 0xFF;
    return [lo >> 4, lo & 0x0F, hi >> 4, hi & 0x0F];
  }

  // Nibbles [0x0C, 0x0D, 0x0A, 0x0B] → CRC 0xABCD
  static decodeCRC(nibbles) {
    const lo = (nibbles[0] << 4) | nibbles[1];
    const hi = (nibbles[2] << 4) | nibbles[3];
    return (hi << 8) | lo;
  }
  /* eslint-enable no-bitwise */

  static parsePacket(bytes) {
    if (bytes[0] !== BEGIN || bytes[bytes.length - 1] !== END) {
      throw new Error('Invalid packet framing');
    }

    const body = bytes.slice(1, bytes.length - 5);
    const crcNibbles = bytes.slice(bytes.length - 5, bytes.length - 1);
    const expectedCRC = KetoMojo.decodeCRC(crcNibbles);
    const actualCRC = crcCalculator.calcCRC16Modbus(body);

    if (expectedCRC !== actualCRC) {
      debug(`CRC mismatch: expected 0x${expectedCRC.toString(16)}, got 0x${actualCRC.toString(16)}`);
    }
    
    const fields = struct.unpack(body, 1, 'b.bbbSb', ['src', 'tgt', 'cmd', 'ext', 'size']);
    fields.data = body.slice(8);
    return fields;
  }

  static parseHistoryRecord(data, seqNum) {
    if (data.length < 9) {
      debug('Unexpected history record length, not parsing.');
      return null;
    }
    
    const fields = struct.unpack(data, 0, '9b', [
      'yearOffset', 'month', 'day', 'hour', 'minute', 'rawHi', 'rawLo', 'meal', 'sampleType',
    ]);
    fields.year = 2000 + fields.yearOffset;
    const raw = fields.rawHi * 100 + fields.rawLo;
    /* eslint-disable no-bitwise */
    const mealNibble = (fields.meal >> 4) & 0x0F;
    /* eslint-enable no-bitwise */

    const jsDate = new Date(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute);
    const isKetone = fields.sampleType === 0x55 || fields.sampleType === 0x66;
    const value = raw === 0 ? 0 : raw / (isKetone ? 100.0 : 10.0);
    // TODO: units are not encoded per-record; need to query device configuration
    const units = isKetone ? 'mmol/L' : 'mmol/L';

    return {
      jsDate,
      value,
      units,
      mealFlag: MEAL_FLAG[mealNibble] || 'unknown',
      sampleType: SAMPLE_TYPE[fields.sampleType] || 'unknown',
      isControl: fields.sampleType === 0x22 || fields.sampleType === 0x66,
      seqNum,
    };
  }

  static parseHistoryRecords(data) {
    const records = [];
    for (let i = 0; i + 9 <= data.length; i += 9) {
      const record = KetoMojo.parseHistoryRecord(
        data.slice(i, i + 9),
        records.length,
      );
      if (record) records.push(record);
    }
    return records;
  }

  async scan() {
    debug('Requesting Bluetooth Device...');
    debug(`with  ${JSON.stringify(options)}`);

    if (typeof navigator !== 'undefined') {
      this.device = await Promise.race([
        KetoMojo.timeout(15000),
        navigator.bluetooth.requestDevice(options),
      ]);

      debug(`Name: ${this.device.name}`);
      debug(`Id: ${this.device.id}`);
      debug(`Connected: ${this.device.gatt.connected}`);
    } else {
      self.dispatchEvent(new ErrorEvent('KetoMojoError', {
        error: new Error('navigator not available.'),
      }));
    }
  }

  async connectTimeout(timeout = 40000) {
    await Promise.race([
      this.connect(),
      KetoMojo.timeout(timeout),
    ]).catch((err) => {
      debug('Error:', err);
      self.dispatchEvent(new ErrorEvent('KetoMojoError', {
        error: err,
      }));
    });
  }

  async connect() {
    try {
      this.server = await this.device.gatt.connect();
      debug('Connected.');

      this.deviceInfoService = await this.server.getPrimaryService('device_information');
      this.ketoService = await this.server.getPrimaryService(KETO_SERVICE);
      debug('Retrieved services.');

      this.notifyCharacteristic = await this.ketoService.getCharacteristic(KETO_NOTIFICATION);
      await this.notifyCharacteristic.startNotifications();
      debug('Notifications started.');

      this.notifyCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotifications);
      debug('Event listener added.');

      debug('Getting Write Characteristic...');
      this.writeCharacteristic = await this.ketoService.getCharacteristic(KETO_WRITE);
    } catch (error) {
      debug(`Error: ${error}`);
      self.dispatchEvent(new ErrorEvent('KetoMojoError', {
        error,
      }));
    }
  }

  async disconnect() {
    if (!this.device) {
      return;
    }
    debug('Stopping notifications and removing event listeners...');
    if (this.notifyCharacteristic) {
      await this.notifyCharacteristic.stopNotifications();
      this.notifyCharacteristic.removeEventListener(
        'characteristicvaluechanged',
        this.handleNotifications,
      );
      this.notifyCharacteristic = null;
    }
    debug('Notifications and event listener stopped.');
    debug('Disconnecting from Bluetooth Device...');
    if (_.get(this, 'device.gatt.connected', false)) {
      this.device.gatt.disconnect();
    } else {
      debug('Bluetooth Device is already disconnected');
    }
  }

  static buildPacket(cmd, ext, data = []) {
    const buf = new ArrayBuffer(8 + data.length);
    const body = new Uint8Array(buf);
    let ctr = struct.pack(body, 0, 'bbbbbbS', 0x01, SOURCE_CODE, 0x01, TARGET_CODE, cmd, ext, data.length);
    if (data.length > 0) {
      ctr += struct.copyBytes(body, ctr, data, data.length);
    }
    const crc = crcCalculator.calcCRC16Modbus(body);
    const crcNibbles = KetoMojo.encodeCRC(crc);
    const packet = new Uint8Array([BEGIN, ...body, ...crcNibbles, END]);

    debug('Sending:', KetoMojo.buf2hex(packet));
    return packet;
  }

  async getDeviceInfo() {
    debug('Getting Device Information Characteristics...');
    const characteristics = await this.deviceInfoService.getCharacteristics();
    self.deviceInfo = {
      setTimeOnly: true,
    };

    const decoder = new TextDecoder('utf-8');

    /* eslint-disable no-await-in-loop */
    for (let i = 0; i < characteristics.length; i += 1) {
      switch (characteristics[i].uuid) {
        case BluetoothUUID.getCharacteristic('manufacturer_name_string'):
          self.deviceInfo.manufacturers = [decoder.decode(await characteristics[i].readValue())];
          break;

        case BluetoothUUID.getCharacteristic('model_number_string'):
          self.deviceInfo.model = decoder.decode(await characteristics[i].readValue());
          break;

          // unfortunately serial_number_string is blacklisted by WebBluetooth:
          // https://github.com/WebBluetoothCG/registries/issues/2

        default:
          break;
      }
    }
    /* eslint-enable no-await-in-loop */

    return self.deviceInfo;
  }

  async getSerial() {
    debug('Getting serial number..');
    await this.writeCharacteristic.writeValue(
      KetoMojo.buildPacket(COMMAND_READ_SERIAL, EXTENDED_CODE_READ),
    );
  }

  async getNumberOfRecords() {
    debug('Getting number of records..');
    await this.writeCharacteristic.writeValue(
      KetoMojo.buildPacket(COMMAND_READ_NROFRECORDS, EXTENDED_CODE_READ),
    );
  }

  async getRecords(count) {
    debug(`Getting ${count} records..`);
    const countBytes = new Uint8Array(2);
    struct.storeBEShort(count, countBytes, 0);
    await this.writeCharacteristic.writeValue(
      KetoMojo.buildPacket(COMMAND_GET_RECORDS, EXTENDED_CODE_READ, countBytes),
    );
  }

  async setDateTime(serverTime) {
    await this.writeCharacteristic.writeValue(
      KetoMojo.buildPacket(COMMAND_SET_DATETIME, EXTENDED_CODE_WRITE, [
        serverTime.getFullYear() - 2000,
        serverTime.getMonth() + 1,
        serverTime.getDate(),
        serverTime.getHours(),
        serverTime.getMinutes(),
        serverTime.getSeconds(),
      ]),
    );
  }

  /* eslint-disable-next-line class-methods-use-this */
  async handleNotifications(event) {
    const { value } = event.target;
    debug('Raw:', KetoMojo.buf2hex(value.buffer));
    clearTimeout(self.abortTimer);

    for (let i = 0; i < value.byteLength; i++) {
      self.buffer.push(value.getUint8(i));
    }

    // Wait until we have a complete packet (last byte is END marker)
    if (self.buffer[self.buffer.length - 1] !== END) {
      return;
    }

    const packet = self.buffer;
    self.buffer = [];

    try {
      const parsed = KetoMojo.parsePacket(packet);
      /* eslint-disable no-bitwise */
      debug(`Response cmd=0x${parsed.cmd.toString(16)} ext=0x${parsed.ext.toString(16)} size=${parsed.size} data=[${parsed.data.map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`);

      switch (parsed.cmd) {
        case COMMAND_READ_SERIAL: {
          // First data byte is a prefix/status byte; serial ASCII starts at [1]
          const serial = String.fromCharCode(...parsed.data.slice(1));
          debug('Serial:', serial);
          self.dispatchEvent(new CustomEvent('serial', { detail: serial }));
          break;
        }

        case COMMAND_READ_NROFRECORDS: {
          const count = struct.extractBEShort(parsed.data, 0);
          debug(`Number of records: ${count}`);
          self.dispatchEvent(new CustomEvent('nrOfRecords', { detail: count }));
          break;
        }

        case COMMAND_GET_RECORDS: {
          // Each response packet contains one 9-byte record;
          // the last packet may have trailing data after the record
          const record = KetoMojo.parseHistoryRecord(
            parsed.data.slice(0, 9),
            self.records.length,
          );
          if (record) {
            debug('Record:', record);
            if (parsed.data.length > 9) {
              debug('Trailing data after record:', KetoMojo.buf2hex(parsed.data.slice(9)));
            }
            self.dispatchEvent(new CustomEvent('data', { detail: record }));
          }
          break;
        }

        case COMMAND_SET_DATETIME:
          debug('DateTime set acknowledged');
          self.dispatchEvent(new CustomEvent('dateTimeSet'));
          break;

        default:
          debug(`Unhandled command: 0x${parsed.cmd.toString(16)}`);
      }
      /* eslint-enable no-bitwise */
    } catch (err) {
      debug('Packet parse error:', err.message);
    }
  }

  static buf2hex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
  }
}

export default (config) => {
  const cfg = _.clone(config);
  cfg.deviceTags = ['bgm'];
  let handleError = null;
  let handleData = null;

  // With no date & time settings changes available,
  // timezone is applied across-the-board
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

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
      debug('in connect!');

      (async () => {
        await cfg.deviceComms.ble.connectTimeout();
      })().then(() => cb(null, data)).catch((error) => {
        debug('Error in connect: ', error);
        return cb(error, null);
      });
    },

    getConfigInfo(progress, data, cb) {
      self.abortTimer = setTimeout(() => {
        debug('TIMEOUT');
        cb(new Error('Timeout error'), null);
      }, TIMEOUT);
      debug('in getConfigInfo', data);
      progress(0);

      (async () => {
        _.assign(cfg.deviceInfo, await cfg.deviceComms.ble.getDeviceInfo());

        const serialPromise = new Promise((resolve) => {
          cfg.deviceComms.ble.addEventListener('serial', (event) => {
            clearTimeout(self.abortTimer);
            resolve(event.detail);
          }, { once: true });
        });
        
        await cfg.deviceComms.ble.getSerial();
        return serialPromise;
      })().then((serial) => {
        debug('Device serial number:', serial);
        cfg.deviceTags = ['bgm'];
        cfg.deviceInfo.deviceId = `${cfg.deviceInfo.driverId}-${_.trimStart(serial, '0')}`;
        data.deviceModel = cfg.deviceInfo.model; // for metrics
        cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });

        
        cfg.api.getTime(function (err, result) {
          if (err) {
            return cb(err);
          }
          const serverTime = sundial.parseFromFormat(result);
          debug('Server time:', serverTime);

          // FIXME cfg.displayTimeModal(function (error) {
          //  if (error === 'deviceTimePromptClose') {
          //    return cb(error, null);
          //}

            //cfg.deviceComms.ble.setDateTime(serverTime).then((err) => {
              cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(serverTime);
              data.connect = true;
              progress(100);
              cb(err, data);
            //}).catch((err) => {
            //  return cb(err);
            //sys});
          // }, cfg, { serverTime, deviceTime: null });
        });
      }).catch((error) => {
        debug('Error in getConfigInfo: ', error);
        return cb(error, null);
      });
    },

    fetchData(progress, data, cb) {
      debug('in fetchData', data);
      progress(0);

      handleError = (event) => cb(event.error, null);
      cfg.deviceComms.ble.addEventListener('KetoMojoError', handleError);

      const nrPromise = new Promise((resolve) => {
        cfg.deviceComms.ble.addEventListener('nrOfRecords', (event) => {
          resolve(event.detail);
        }, { once: true });
      });

      cfg.deviceComms.ble.getNumberOfRecords().then(async () => {
        const count = await nrPromise;
        debug(`Requesting ${count} records`);

        if (count === 0) {
          data.records = [];
          progress(100);
          return cb(null, data);
        }

        self.abortTimer = setTimeout(() => {
          debug('TIMEOUT waiting for records');
          cb(new Error('Timeout error'), null);
        }, TIMEOUT + (count * 1000));

        const allRecords = [];
        handleData = (event) => {
          allRecords.push(event.detail);
          debug(`Received ${allRecords.length}/${count} records`);
          progress(Math.round((allRecords.length / count) * 100));

          if (allRecords.length >= count) {
            clearTimeout(self.abortTimer);
            cfg.deviceComms.ble.removeEventListener('data', handleData);
            // Filter out control solution tests
            data.records = allRecords.filter((r) => !r.isControl);
            debug(`Total: ${allRecords.length}, non-control: ${data.records.length}`);
            progress(100);
            cb(null, data);
          }
        };
        cfg.deviceComms.ble.addEventListener('data', handleData);

        await cfg.deviceComms.ble.getRecords(count);
      }).catch((error) => {
        debug('Error in fetchData:', error);
        cb(error, null);
      });
    },

    processData(progress, data, cb) {
      progress(0);
      data.post_records = [];

      _.forEach(data.records, (record) => {
        let postRecord;

        let annotation = null;

        if (record.sampleType === 'ketone') {
          if (record.value > 8.0) {
            record.value = 8.1;
            annotation = {
              code: 'ketone/out-of-range',
              threshold: 8.0,
              value: 'high',
            };
          }

          postRecord = cfg.builder.makeBloodKetone()
            .with_value(record.value)
            .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
            .set('index', record.seqNum);
        } else {
          const isMMOL = record.units === 'mmol/L';

          if (isMMOL) {
            if (record.value > 38.89) {
              record.value = 38.90;
              annotation = {
                code: 'bg/out-of-range',
                threshold: 38.89,
                value: 'high',
              };
            } else if (record.value < 0.56) {
              record.value = 0.55;
              annotation = {
                code: 'bg/out-of-range',
                threshold: 0.56,
                value: 'low',
              };
            }
          } else {
            if (record.value > 700) {
              record.value = 701;
              annotation = {
                code: 'bg/out-of-range',
                threshold: 700,
                value: 'high',
              };
            } else if (record.value < 10) {
              record.value = 9;
              annotation = {
                code: 'bg/out-of-range',
                threshold: 10,
                value: 'low',
              };
            }
          }

          postRecord = cfg.builder.makeSMBG()
            .with_value(record.value)
            .with_units(record.units)
            .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
            .set('index', record.seqNum);
        }

        if (annotation) {
          annotate.annotateEvent(postRecord, annotation);
        }

        cfg.tzoUtil.fillInUTCInfo(postRecord, record.jsDate);
        delete postRecord.index;

        data.post_records.push(postRecord.done());
      });

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
        deviceTags: cfg.deviceTags,
        deviceManufacturers: cfg.deviceInfo.manufacturers,
        deviceModel: cfg.deviceInfo.model,
        deviceId: cfg.deviceInfo.deviceId,
        deviceSerialNumber: cfg.deviceInfo.serial,
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
      // performing disconnect in cleanup
      data.disconnect = true;
      cb(null, data);
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');

      (async () => {
        if (handleData) {
          cfg.deviceComms.ble.removeEventListener('data', handleData);
        }
        if (handleError) {
          cfg.deviceComms.ble.removeEventListener('KetoMojoError', handleError);
        }
        await cfg.deviceComms.ble.disconnect();
      })().then(() => {
        progress(100);
        data.cleanup = true;
        return cb();
      }).catch((error) => {
        debug('Error during disconnect: ', error);
        return cb();
      });
    },
  };
};
