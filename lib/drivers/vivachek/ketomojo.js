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

const EXTENDED_CODE_READ = 0x55;
const EXTENDED_CODE_WRITE = 0x66;

const TIMEOUT = 3000;


const options = {
  filters: [
    {
      namePrefix: 'Keto-Mojo',
    },
  ],
  optionalServices: ['device_information', KETO_SERVICE],
};

let self = null;
let prevPacket = null;

export class KetoMojo extends EventTarget {
  constructor() {
    super();
    this.records = [];
    this.retries = 0;
    this.buffer = [];
    this.command = null;
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
      this.verioService = await this.server.getPrimaryService(KETO_SERVICE);
      debug('Retrieved services.');

      this.notifyCharacteristic = await this.verioService.getCharacteristic(KETO_NOTIFICATION);
      await this.notifyCharacteristic.startNotifications();
      debug('Notifications started.');

      this.notifyCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotifications);
      debug('Event listener added.');

      debug('Getting Write Characteristic...');
      this.writeCharacteristic = await this.verioService.getCharacteristic(KETO_WRITE);
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

  static buildPacket(payload) {
    const packetSize = 13 + payload.length;
    const buf = new ArrayBuffer(packetSize);
    const bytes = new Uint8Array(buf);

    let ctr = struct.pack(bytes, 0, 'bbbbb', BEGIN, 0x01, SOURCE_CODE, 0x01, TARGET_CODE);

    ctr += struct.copyBytes(bytes, ctr, payload, payload.length);
    
    ctr += struct.pack(bytes, ctr, 'bbbbbbb', 0x00, 0x00, 0x01, 0x0b, 0x0b, 0x04, END);

    debug('Sending:', KetoMojo.buf2hex(bytes));

    return new Uint8Array(buf);
  }

  async getNextRecord() {
    self.abortTimer = setTimeout(async () => {
      debug('Timeout while getting next record');
      if (self.readUntil && self.readUntil > 0) {
        if (self.retries < 5) {
          self.retries += 1;
          self.recordIndex += 1;
          debug(`Trying to read same record again.. (${self.retries})`);
          await self.getNextRecord();
        } else {
          self.retries = 0;
          self.readUntil -= 1;
          self.recordIndex -= 1;

          if (self.recordIndex >= self.readUntil) {
            debug('Attempting to read next record');
            await self.getNextRecord();
          } else {
            debug(`No next record (index ${self.recordIndex} read until ${self.readUntil})`);
            self.dispatchEvent(new ErrorEvent('VerioBLEError', {
              error: new Error('Timeout error'),
            }));
          }
        }
      } else {
        debug('Timeout error');
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
    await this.writeCharacteristic.writeValue(KetoMojo.buildPacket([COMMAND_READ_SERIAL, EXTENDED_CODE_READ]));
  }

  async setDateTime(serverTime) {
    const timestamp = [
      serverTime.getFullYear() - 2000,
      serverTime.getMonth() + 1,
      serverTime.getDate(),
      serverTime.getHours(),
      serverTime.getMinutes(),
      serverTime.getSeconds()
    ];

    await this.writeCharacteristic.writeValue(KetoMojo.buildPacket([
      COMMAND_SET_DATETIME, EXTENDED_CODE_WRITE,
      0x00, 0x06, // dateTime length
    ].concat(timestamp)));
  }

  async getAllRecords(progress) {
    self.abortTimer2 = setTimeout(async () => {
      debug('Timeout while requesting records');

      if (self.retries < 5) {
        self.retries += 1;
        debug(`Trying again.. (${self.retries})`);
        await self.getAllRecords(progress);
      } else {
        self.retries = 0;
        debug('Timeout error');
        self.dispatchEvent(new ErrorEvent('VerioBLEError', {
          error: new Error('Timeout error'),
        }));
      }
    }, 5000);

    self.progress = progress;
    try {
      await this.writeCharacteristic.writeValue(VerioBLE.buildPacket([0x0a, 0x02, 0x06])); // T counter
    } catch (err) {
      debug('Error while getting records: ', err);
      try {
        await this.connectTimeout();
      } catch (error) {
        debug('Failed to reconnect:', error);
      }
    }
  }

  /* eslint-disable-next-line class-methods-use-this */
  async handleNotifications(event) {
    const { value } = event.target;
    debug('Raw:', KetoMojo.buf2hex(value.buffer));
    //if (_.isEqual(value, prevPacket) && value.byteLength > 1) {
    //  debug('Ignoring duplicate packet');
    //  return;
    //}
    //prevPacket = value;
    clearTimeout(self.abortTimer);
    //self.retries = 0;

    let end = value.byteLength;
    let start = 0;
    let done = false;
    if (value.getUint8(0) === BEGIN) {
      start += 8; // remove header
      self.command = value.getUint8(5);
    }
    if (value.getUint8(value.byteLength - 1) === END) {
      end -= 5; // remove footer
      done = true;
    }

    self.buffer.push(...new Uint8Array(value.buffer.slice(start, end)));

    if (done) {
      debug('Message: ', KetoMojo.buf2hex(self.buffer));

      if (self.command === COMMAND_READ_SERIAL) {
        self.dispatchEvent(new CustomEvent('serial', {
          detail: self.buffer.slice(1),
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
  let handleSerial = null;
  let getAllRecords = null;

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
          handleSerial = async (event) => {
            clearTimeout(self.abortTimer);
            resolve(String.fromCharCode(...event.detail.slice(1)));
          };
          cfg.deviceComms.ble.addEventListener('serial', handleSerial, { once: true });
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

            cfg.deviceComms.ble.setDateTime(serverTime).then((err) => {
              cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(serverTime);
              data.connect = true;
              progress(100);
              // FIXME cb(err, data);
            }).catch((err) => {
              return cb(err);
            });
          // }, cfg, { serverTime, deviceTime: null });
        });
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
      cfg.deviceComms.ble.addEventListener('KetoMojoError', handleError);

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

        getAllRecords = async () => {
          debug('Getting all records');
          cfg.deviceComms.ble.removeEventListener('ACK', getAllRecords);
          data.connect = true;
          try {
            await cfg.deviceComms.ble.getAllRecords(progress);
          } catch (error) {
            cb(error, null);
          }
        };

        common.checkDeviceTime(
          cfg,
          async (timeErr, serverTime) => {
            if (timeErr) {
              if (timeErr === 'updateTime') {
                cfg.deviceInfo.annotations = 'wrong-device-time';

                const tzOffset = sundial.getOffsetFromZone(serverTime, cfg.timezone) * 60;
                const dateTime = (serverTime.getTime() / 1000) + tzOffset - TIME_OFFSET;
                const timeArray = new Array(4);
                struct.storeInt(dateTime, timeArray, 0);

                try {
                  cfg.deviceComms.ble.addEventListener('ACK', getAllRecords, { once: true });
                  await cfg.deviceComms.ble.setTime(timeArray);
                } catch (error) {
                  cb(error, null);
                }
              } else {
                cb(timeErr, null);
              }
            } else {
              getAllRecords();
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
        cfg.deviceComms.ble.removeEventListener('data', handleData);
        cfg.deviceComms.ble.removeEventListener('dateTime', handleDateTime);
        cfg.deviceComms.ble.removeEventListener('KetoMojoError', handleError);
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
