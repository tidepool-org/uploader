/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2019, Tidepool Project
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

import TZOUtil from '../../TimezoneOffsetUtil';
import annotate from '../../eventAnnotations';
import { remote } from 'electron';

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('BluetoothLEDriver') : console.log;

const VERIO_SERVICE = 'af9df7a1-e595-11e3-96b4-0002a5d5c51b';
const VERIO_NOTIFICATION = 'af9df7a3-e595-11e3-96b4-0002a5d5c51b';
const VERIO_WRITE = 'af9df7a2-e595-11e3-96b4-0002a5d5c51b';

const DATA_DELIMITER = 0x03;
const ACK = 0x81;
const TIME_OFFSET = 946684799;

const options = {
  filters: [
    {
      namePrefix: 'OneTouch',
    },
  ],
  optionalServices: ['device_information', VERIO_SERVICE],
};

let self = null;

export class VerioBLE {
  constructor() {
    this.records = [];
    self = this; // so that we can access it from event handler
  }

  static timeout(delay) {
    return new Promise((resolve, reject) => setTimeout(reject, delay, new Error('Timeout error')));
  }

  async scan() {
    console.log('Requesting Bluetooth Device...');
    console.log(`with  ${JSON.stringify(options)}`);

    if (typeof navigator !== 'undefined') {
      this.device = await Promise.race([
        VerioBLE.timeout(15000),
        navigator.bluetooth.requestDevice(options),
      ]);

      console.log(`Name: ${this.device.name}`);
      console.log(`Id: ${this.device.id}`);
      console.log(`Connected: ${this.device.gatt.connected}`);
    } else {
      throw new Error('navigator not available.');
    }
  }

  async connectTimeout(timeout = 40000) {
    await Promise.race([
      this.connect(),
      VerioBLE.timeout(timeout),
    ]).catch((err) => {
      console.log('Error:', err);
      throw err;
    });
  }

  async connect() {
    try {
      this.server = await this.device.gatt.connect();
      console.log('Connected.');

      this.deviceInfoService = await this.server.getPrimaryService('device_information');
      this.glucoseService = await this.server.getPrimaryService('glucose');
      console.log('Retrieved services.');

      const glucoseFeature = await this.glucoseService.getCharacteristic('glucose_feature');
      const features = await glucoseFeature.readValue();
      console.log('Glucose features:', features.getUint16().toString(2).padStart(16, '0'));

      this.glucoseMeasurement = await this.glucoseService.getCharacteristic('glucose_measurement');
      await this.glucoseMeasurement.startNotifications();
      this.glucoseMeasurementContext = await this.glucoseService.getCharacteristic('glucose_measurement_context');
      await this.glucoseMeasurementContext.startNotifications();
      this.racp = await this.glucoseService.getCharacteristic('record_access_control_point');
      await this.racp.startNotifications();
      console.log('Notifications started.');

      this.glucoseMeasurementContext.addEventListener('characteristicvaluechanged', bluetoothLE.handleContextNotifications);
      this.glucoseMeasurement.addEventListener('characteristicvaluechanged', this.handleNotifications);
      this.racp.addEventListener('characteristicvaluechanged', this.handleRACP);
      console.log('Event listeners added.');
    } catch (error) {
      console.log(`Argh! ${error}`);
      throw error;
    }
  }

  async disconnect() {
    if (!this.device) {
      return;
    }
    console.log('Stopping notifications and removing event listeners...');
    if (this.glucoseMeasurement) {
      await this.glucoseMeasurement.stopNotifications();
      this.glucoseMeasurement.removeEventListener(
        'characteristicvaluechanged',
        this.handleNotifications,
      );
      this.glucoseMeasurement = null;
    }
    if (this.glucoseMeasurementContext) {
      await this.glucoseMeasurementContext.stopNotifications();
      this.glucoseMeasurementContext.removeEventListener(
        'characteristicvaluechanged',
        this.handleContextNotifications,
      );
      this.glucoseMeasurementContext = null;
    }
    if (this.racp) {
      await this.racp.stopNotifications();
      this.racp.removeEventListener(
        'characteristicvaluechanged',
        this.handleRACP,
      );
      this.racp = null;
    }
    console.log('Notifications and event listeners stopped.');
    console.log('Disconnecting from Bluetooth Device...');
    if (this.device.gatt.connected) {
      this.device.gatt.disconnect();
    } else {
      console.log('Bluetooth Device is already disconnected');
    }
  }

  async getDeviceInfo() {
    console.log('Getting Device Information Characteristics...');
    const characteristics = await this.deviceInfoService.getCharacteristics();
    self.deviceInfo = {};

    const decoder = new TextDecoder('utf-8');

    /* eslint-disable no-await-in-loop, requests to devices are sequential */
    for (let i = 0; i < characteristics.length; i += 1) {
      switch (characteristics[i].uuid) {
        case BluetoothUUID.getCharacteristic('manufacturer_name_string'):
          self.deviceInfo.manufacturers = [decoder.decode(await characteristics[i].readValue())];
          break;

        case BluetoothUUID.getCharacteristic('model_number_string'):
          self.deviceInfo.model = decoder.decode(await characteristics[i].readValue());
          break;

        default:
          break;
      }
    }
    /* eslint-enable no-await-in-loop */

    return self.deviceInfo;
  }

  async sendCommand(cmd) {
    await this.racp.writeValue(new Uint8Array(cmd));
    console.log('Sent command.');
  }

  async getNumberOfRecords() { await this.sendCommand([0x04, 0x01]); }

  async getAllRecords() {
    self.records = [];
    self.contextRecords = [];
    await this.sendCommand([0x01, 0x01]);
  }

  static handleContextNotifications(event) {
    const { value } = event.target;
    console.log('Received context:', bluetoothLE.buf2hex(value.buffer));
    this.parsed = bluetoothLE.parseMeasurementContext(value);
    self.contextRecords.push(this.parsed);
  }

  handleNotifications(event) {
    const { value } = event.target;

    console.log('Received:', bluetoothLE.buf2hex(value.buffer));
    this.parsed = bluetoothLE.parseGlucoseMeasurement(value);
    self.records.push(this.parsed);
  }

  handleRACP(event) {
    const { value } = event.target;
    this.racpObject = {
      opCode: value.getUint8(0),
      operator: value.getUint8(1),
      operand: value.getUint16(2, true),
    };
    console.log('RACP Event:', this.racpObject);

    switch (this.racpObject.opCode) {
      case 0x05:
        self.emit('numberOfRecords', this.racpObject.operand);
        break;
      case 0x06:
        if (this.racpObject.operand === 0x0101) {
          console.log('Success.');
          self.emit('data', {
            records: self.records,
            contextRecords: self.contextRecords,
          });
        } else if (this.racpObject.operand === 0x0601) {
          // no records found
          self.emit('data', []);
        }
        break;
      default:
        throw Error('Unrecognized op code');
    }
  }

  static parseMeasurementContext(result) {
    const record = {
      flags: result.getUint8(0),
      seqNum: result.getUint16(1, true),
    };
    let offset = 3;

    if (this.hasFlag(CONTEXT_FLAGS.EXTENDED, record.flags)) {
      record.extended = result.getUint8(offset);
      offset += 1;
    }

    if (this.hasFlag(CONTEXT_FLAGS.CARBS, record.flags)) {
      record.carbID = result.getUint8(offset);
      record.carbUnits = result.getUint16(offset + 1, true);
      offset += 2;
    }

    if (this.hasFlag(CONTEXT_FLAGS.MEAL, record.flags)) {
      record.meal = result.getUint8(offset);
      offset += 1;
    }

    return record;
  }

  static parseGlucoseMeasurement(result) {
    const record = {
      flags: result.getUint8(0),
      seqNum: result.getUint16(1, true),
    };
    let offset = 0;

    const dateTime = {
      year: result.getUint16(3, true),
      month: result.getUint8(5),
      day: result.getUint8(6),
      hours: result.getUint8(7),
      minutes: result.getUint8(8),
      seconds: result.getUint8(9),
    };

    if (this.hasFlag(FLAGS.TIME_OFFSET_PRESENT, record.flags)) {
      record.payload = {
        internalTime: sundial.buildTimestamp(dateTime),
        timeOffset: result.getInt16(10, true),
      };
      record.timestamp = sundial.applyOffset(
        record.payload.internalTime,
        record.payload.timeOffset,
      );
      offset += 2;
    } else {
      record.timestamp = sundial.buildTimestamp(dateTime);
    }

    if (this.hasFlag(FLAGS.GLUCOSE_PRESENT, record.flags)) {
      if (this.hasFlag(FLAGS.IS_MMOL, record.flags)) {
        record.units = 'mmol/L';
      } else {
        record.units = 'mg/dL';
      }
      record.value = this.getSFLOAT(result.getUint16(offset + 10, true), record.units);
      record.type = result.getUint8(offset + 12) >> 4;
      record.location = result.getUint8(offset + 12) && 0x0F;

      if (this.hasFlag(FLAGS.STATUS_PRESENT, record.flags)) {
        record.status = result.getUint16(offset + 13, true);
      }
    } else {
      console.log('No glucose value present for ', sundial.formatDeviceTime(record.timestamp));
    }

    record.hasContext = this.hasFlag(FLAGS.CONTEXT_INFO, record.flags);

    return record;
  }
}

export default (config) => {
  const cfg = _.clone(config);
  cfg.deviceTags = ['bgm'];

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
      })().then(() => {
        return cb(null, data);
      }).catch((error) => {
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
        if (!cfg.deviceInfo.name.startsWith('CareSens') && !cfg.deviceInfo.name.startsWith('ReliOn 2395')) {
          return cb(new Error('We don\'t currently support this meter.'));
        }

        cfg.deviceTags = ['bgm'];
        cfg.deviceInfo.deviceId = `${[cfg.deviceInfo.manufacturers]}-${cfg.deviceInfo.model}-${remote.getGlobal('bluetoothDeviceId')}`;
        data.deviceModel = cfg.deviceInfo.model; // for metrics
        cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });
        return cb(null, data);
      }).catch((error) => {
        debug('Error in getConfigInfo: ', error);
        return cb(error, null);
      });
    },

    fetchData(progress, data, cb) {
      debug('in fetchData', data);

      cfg.deviceComms.ble.once('data', (result) => {
        debug('Records:', result);
        _.assign(data, result);
        return cb(null, data);
      });

      (async () => {
        await cfg.deviceComms.ble.getAllRecords();
      })().catch((error) => {
        return cb(error, null);
      });
    },

    processData(progress, data, cb) {
      progress(0);
      data.post_records = [];

      _.forEach(data.records, (result) => {
        const record = result;
        let annotation = null;
        let isKetone = false;

        if (record.hasContext) {
          const context = _.find(
            data.contextRecords,
            { 'seqNum' : record.seqNum }
          );

          if (context) {
            if (context.meal && context.meal === 6) {
              isKetone = true;
            }
          } else {
            throw new Error('Could not find context of measurement');
          }
        }

        if (isKetone) {
          // According to spec, HI > 8 mmol/L
          // there is no LO as values are between 0 and 8 mmol/L
          if (record.value > (KETONE_HI * KETONE_VALUE_FACTOR)) {
            record.value = KETONE_HI + (1 / KETONE_VALUE_FACTOR);
            annotation = {
              code: 'ketone/out-of-range',
              threshold: KETONE_HI,
              value: 'high',
            };
          } else {
            record.value /= KETONE_VALUE_FACTOR;
          }
        } else {
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
        }

        if (record.type !== 10) { // check that it's not control solution
          let postRecord = null;

          if (isKetone) {
            postRecord = cfg.builder.makeBloodKetone()
              .with_value(record.value)
              .with_units('mmol/L'); // ketones are hard-coded in mmol/L
          } else {
            postRecord = cfg.builder.makeSMBG()
              .with_value(record.value)
              .with_units(record.units);
          }

          postRecord
            .with_deviceTime(sundial.formatDeviceTime(record.timestamp))
            .set('index', record.seqNum);

          if (annotation) {
            annotate.annotateEvent(postRecord, annotation);
          }

          cfg.tzoUtil.fillInUTCInfo(postRecord, record.timestamp);
          delete postRecord.index;

          data.post_records.push(postRecord.done());
        }
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
