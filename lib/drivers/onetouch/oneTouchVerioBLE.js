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

/* global BluetoothUUID */
/* eslint no-restricted-syntax: [0, "ForInStatement"] */
/* eslint-disable global-require, no-global-assign, guard-for-in */

import _ from 'lodash';
import sundial from 'sundial';

import TZOUtil from '../../TimezoneOffsetUtil';
import annotate from '../../eventAnnotations';
import crcCalculator from '../../crc';
import common from '../../commonFunctions';
import env from '../../../app/utils/env';

// eslint-disable-next-line no-console
const debug = env.browser ? require('bows')('OneTouchVerioBLE') : console.log;

let remote;
if (env.electron) {
  remote = require('@electron/remote');
}

const VERIO_SERVICE = 'af9df7a1-e595-11e3-96b4-0002a5d5c51b';
const VERIO_NOTIFICATION = 'af9df7a3-e595-11e3-96b4-0002a5d5c51b';
const VERIO_WRITE = 'af9df7a2-e595-11e3-96b4-0002a5d5c51b';

const DATA_DELIMITER = 0x03;
const ACK = 0x81;
const TIME_OFFSET = 946684799;
const TIMEOUT = 40000;

const options = {
  filters: [
    {
      namePrefix: 'OneTouch',
    },
  ],
  optionalServices: ['device_information', VERIO_SERVICE],
};

let self = null;

export class VerioBLE extends EventTarget {
  constructor() {
    super();
    this.records = [];
    this.retries = 0;
    self = this; // so that we can access it from event handler
  }

  static timeout(delay) {
    return new Promise((resolve, reject) => setTimeout(reject, delay, new Error('Timeout error')));
  }

  async scan() {
    debug('Requesting Bluetooth Device...');
    debug(`with  ${JSON.stringify(options)}`);

    if (typeof navigator !== 'undefined') {
      this.device = await Promise.race([
        VerioBLE.timeout(15000),
        navigator.bluetooth.requestDevice(options),
      ]);

      debug(`Name: ${this.device.name}`);
      debug(`Id: ${this.device.id}`);
      debug(`Connected: ${this.device.gatt.connected}`);
    } else {
      self.dispatchEvent(new ErrorEvent('VerioBLEError', {
        error: new Error('navigator not available.'),
      }));
    }
  }

  async connectTimeout(timeout = 40000) {
    await Promise.race([
      this.connect(),
      VerioBLE.timeout(timeout),
    ]).catch((err) => {
      debug('Error:', err);
      self.dispatchEvent(new ErrorEvent('VerioBLEError', {
        error: err,
      }));
    });
  }

  async connect() {
    try {
      this.server = await this.device.gatt.connect();
      debug('Connected.');

      this.deviceInfoService = await this.server.getPrimaryService('device_information');
      this.verioService = await this.server.getPrimaryService(VERIO_SERVICE);
      debug('Retrieved services.');

      this.notifyCharacteristic = await this.verioService.getCharacteristic(VERIO_NOTIFICATION);
      await this.notifyCharacteristic.startNotifications();
      debug('Notifications started.');

      this.notifyCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotifications);
      debug('Event listener added.');

      debug('Getting Write Characteristic...');
      this.writeCharacteristic = await this.verioService.getCharacteristic(VERIO_WRITE);
    } catch (error) {
      debug(`Error: ${error}`);
      self.dispatchEvent(new ErrorEvent('VerioBLEError', {
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

  static buildPacket(payload) {
    const packetSize = payload.length + 8;
    const buf = new ArrayBuffer(packetSize);
    const bytes = new DataView(buf);

    bytes.setUint8(0, 0x01);
    bytes.setUint8(1, 0x02);
    bytes.setUint8(2, packetSize - 1);
    bytes.setUint8(3, 0x00);
    bytes.setUint8(4, DATA_DELIMITER);

    let ctr = 5;

    for (const i in payload) {
      bytes.setUint8(ctr, payload[i]);
      ctr += 1;
    }

    bytes.setUint8(ctr, DATA_DELIMITER);
    bytes.setUint16(ctr + 1, crcCalculator.calcCRC_A(new Uint8Array(buf, 1, packetSize - 3), packetSize - 3), true);

    console.log('Sending:', VerioBLE.buf2hex(bytes.buffer));

    return new Uint8Array(buf);
  }

  async getNextRecord() {
    self.abortTimer = setTimeout(() => {
      debug('Timeout while getting next record');
      if (self.readUntil && self.readUntil > 0) {
        if (self.retries < 5) {
          self.retries += 1;
          self.recordIndex += 1;
          debug(`Trying to read same record again.. (${self.retries})`);
          self.getNextRecord();
        } else {
          self.retries = 0;
          self.readUntil -= 1;

          if (self.recordIndex >= self.readUntil) {
            debug('Attempting to read next record');
            self.getNextRecord();
          }
        }
      } else {
        self.dispatchEvent(new ErrorEvent('VerioBLEError', {
          error: new Error('Timeout error'),
        }));
      }
    }, 2000);

    console.log('Requesting record', self.recordIndex);
    /* eslint-disable-next-line no-bitwise */
    await this.writeCharacteristic.writeValue(VerioBLE.buildPacket([0xB3, self.recordIndex & 0xFF, (self.recordIndex >> 8) & 0xFF]));
    self.recordIndex -= 1;
  }

  async getDeviceInfo() {
    debug('Getting Device Information Characteristics...');
    const characteristics = await this.deviceInfoService.getCharacteristics();
    self.deviceInfo = {};

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

  async getTime() {
    await this.writeCharacteristic.writeValue(VerioBLE.buildPacket([0x20, 0x02])); // get time
  }

  async getAllRecords(progress) {
    this.progress = progress;
    await this.writeCharacteristic.writeValue(VerioBLE.buildPacket([0x0a, 0x02, 0x06])); // T counter
  }

  /* eslint-disable-next-line class-methods-use-this */
  async handleNotifications(event) {
    const { value } = event.target;
    debug('Raw:', VerioBLE.buf2hex(value.buffer));
    clearTimeout(self.abortTimer);
    self.retries = 0;

    if (value.byteLength === 1) {
      /* eslint-disable-next-line no-bitwise */
      if ((value.getUint8(0) & ACK) === ACK) {
        debug('Received ACK');
      } else {
        self.dispatchEvent(new ErrorEvent('VerioBLEError', {
          error: new Error(`Invalid packet (${value.getUint8(0)})`),
        }));
      }
    } else {
      const result = new DataView(value.buffer, 5, value.byteLength - 8);

      try {
        if (result.getUint8(0) === 0x06) {
          await self.writeCharacteristic.writeValue(new Uint8Array([ACK]));
          debug('Sent ACK');
          debug('Result length:', result.byteLength);

          if (result.byteLength === 5) {
            const val = result.getInt32(1, true);
            if (val > 100000) {
              const meterTimestamp = (val + TIME_OFFSET) * 1000;
              self.dispatchEvent(new CustomEvent('dateTime', {
                detail: meterTimestamp,
              }));
            } else {
              self.recordCounter = val;
              debug('Record counter: ', self.recordCounter);

              await self.writeCharacteristic.writeValue(VerioBLE.buildPacket([0x27, 0x00])); // R counter
            }
          }

          if (result.byteLength === 3) {
            self.numberOfRecords = result.getUint16(1, true);
            debug('Number of records:', self.numberOfRecords);
            self.recordIndex = self.recordCounter;
            self.readUntil = self.recordCounter - self.numberOfRecords + 1;
            await self.getNextRecord();
          }

          if (result.byteLength === 12) {
            if (result.getUint16(5) === 0) {
              debug('Not a valid reading');

              if (self.readUntil > 0) {
                self.readUntil -= 1;
              }
            } else {
              const record = {};
              const controlSolutionFlag = result.getUint8(7);

              record.timestamp = (result.getInt32(1, true) + TIME_OFFSET) * 1000;
              debug('Reading time:', sundial.formatDeviceTime(record.timestamp));
              record.value = result.getInt16(5, true);
              debug('Reading:', record.value, 'mg/dL');

              if (controlSolutionFlag > 0) {
                debug('Control solution, skipping..');
              } else {
                record.jsDate = new Date(record.timestamp);
                record.seqNum = self.recordIndex;
                self.records.push(record);
              }
            }

            if (self.recordIndex >= self.readUntil) {
              self.getNextRecord();
              const percentage = 100 * ((self.numberOfRecords - (self.recordIndex - self.readUntil)) / self.numberOfRecords);
              self.progress(percentage);
            } else {
              self.dispatchEvent(new CustomEvent('data', {
                detail: self.records,
              }));
              self.records = [];
            }
          }
        } else {
          const err = `Invalid packet (${value.getUint8(0)})`;
          debug(err);
          if (self.readUntil && self.readUntil > 0) {
            self.readUntil -= 1;

            if (self.recordIndex >= self.readUntil) {
              debug('Attempting to read next record');
              self.getNextRecord();
            }
          } else {
            self.dispatchEvent(new ErrorEvent('VerioBLEError', {
              error: err,
            }));
          }
        }
      } catch (err) {
        self.dispatchEvent(new ErrorEvent('VerioBLEError', {
          error: err,
        }));
      }
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
  let handleDateTime = null;

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
      debug('in getConfigInfo', data);
      progress(0);

      (async () => {
        _.assign(cfg.deviceInfo, await cfg.deviceComms.ble.getDeviceInfo());
      })().then(() => {
        cfg.deviceTags = ['bgm'];
        cfg.deviceInfo.deviceId = `${[cfg.deviceInfo.manufacturers]}-${cfg.deviceInfo.model.replace(/\s+/g, '')}-${remote.getGlobal('bluetoothDeviceId')}`;
        data.deviceModel = cfg.deviceInfo.model; // for metrics
        cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });
        progress(100);
        return cb(null, data);
      }).catch((error) => {
        debug('Error in getConfigInfo: ', error);
        return cb(error, null);
      });
    },

    fetchData(progress, data, cb) {
      self.abortTimer = setTimeout(() => {
        debug('TIMEOUT');
        cb(new Error('Timeout error'), null);
      }, TIMEOUT);

      progress(0);

      handleError = (event) => cb(event.error, null);
      cfg.deviceComms.ble.addEventListener('error', handleError);

      debug('in fetchData', data);
      handleData = (event) => {
        debug('Records:', event.detail);
        data.records = event.detail;
        progress(100);
        return cb(null, data);
      };
      cfg.deviceComms.ble.addEventListener('data', handleData, { once: true });

      handleDateTime = async (event) => {
        clearTimeout(self.abortTimer);
        cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(event.detail);

        common.checkDeviceTime(
          cfg,
          async (timeErr) => {
            if (timeErr) {
              cb(timeErr, null);
            } else {
              data.connect = true;
              try {
                await cfg.deviceComms.ble.getAllRecords(progress);
              } catch (error) {
                cb(error, null);
              }
            }
          },
        );
      };
      cfg.deviceComms.ble.addEventListener('dateTime', handleDateTime, { once: true });

      (async () => {
        await cfg.deviceComms.ble.getTime();
      })().catch((error) => cb(error, null));
    },

    processData(progress, data, cb) {
      progress(0);
      data.post_records = [];

      _.forEach(data.records, (result) => {
        const record = result;
        let annotation = null;

        if (record.value > 600) {
          record.value = 601;
          annotation = {
            code: 'bg/out-of-range',
            threshold: 600,
            value: 'high',
          };
        } else if (record.value < 20) {
          record.value = 19;
          annotation = {
            code: 'bg/out-of-range',
            threshold: 20,
            value: 'low',
          };
        }

        const postRecord = cfg.builder.makeSMBG()
          .with_value(record.value)
          .with_units('mg/dL')
          .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
          .set('index', record.seqNum);

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
        return cb(new Error('Device has no records to upload'), null);
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
        cfg.deviceComms.ble.removeEventListener('data', handleData);
        cfg.deviceComms.ble.removeEventListener('dateTime', handleDateTime);
        cfg.deviceComms.ble.removeEventListener('error', handleError);
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
