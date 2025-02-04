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
import ErrorMessages from '../../../app/constants/errorMessages';

const struct = structJs();
const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('AGM4000Driver') : console.log;

const STX = 0x80;
const READ_TIMEOUT = 3000;

const COMMAND = {
  READ_NR_RECORDS: 0x00,
  READ_RECORD: 0x01,
  WRITE_TIME: 0x04,
  READ_SERIAL: 0x09,
};

const EVENT = {
  NORMAL: 0x00,
  AFTER_MEAL: 0x01,
  BEFORE_MEAL: 0x02,
  CONTROL: 0x03,
}

class AGM4000 {
  constructor(cfg) {
    this.cfg = cfg;
    this.hidDevice = this.cfg.deviceComms;
  }

  buildPacket(command, data = []) {
    const buf = new ArrayBuffer(6 + data.length);
    const bytes = new Uint8Array(buf);
    const size = data.length + 1;

    let ctr = struct.pack(bytes, 0, 'bbbb', STX, size, ~size, command);

    if (data.length > 0) {
      ctr += struct.copyBytes(bytes, ctr, data, data.length);
    }

    const checksum = this.calculateChecksum(command, data, size);
    ctr += struct.pack(bytes, ctr, 'bb', checksum.low, checksum.high);

    debug('Sending bytes:', common.bytes2hex(bytes));
    return bytes;
  }

  calculateChecksum(command, data, size) {
    const ckl = ~(STX ^ ~size ^ data.filter((_, i) => i % 2 === 0).reduce((acc, val) => acc ^ val, 0));
    const ckh = ~(size ^ command ^ data.filter((_, i) => i % 2 !== 0).reduce((acc, val) => acc ^ val, 0));

    return {
      low: ckl & 0xFF,
      high: ckh & 0xFF,
    }
  }

  async sendCommand(bytes) {
    for (const byte of bytes) {
      const data = new Uint8Array([byte]); // Convert the byte to a Uint8Array
      await this.hidDevice.sendPromisified(data);
      console.log(`Sent report with byte: 0x${byte.toString(16)}`);
    }
    debug('Sent command.');
  }

  async commandResponse(cmd, payload) {
    const bytes = this.buildPacket(cmd, payload);

    await this.sendCommand(bytes);

    const message = {};

    // eslint-disable-next-line no-await-in-loop
    let result = await this.hidDevice.receiveTimeout(READ_TIMEOUT);
    debug('Incoming bytes:', common.bytes2hex(result));

    if (result[0] === 0) {
      debug('Got nothing, trying again..');

      // try again
      await this.sendCommand(bytes);
      result = await this.hidDevice.receiveTimeout(READ_TIMEOUT);
      debug('Incoming bytes:', common.bytes2hex(result));
    }

    if (result[0] === STX) {
      message.size = result[1];

      if (message.size !== (0xFF - result[2])) {
        throw new Error('Size checksum mismatch');
      }

      message.command = result[3];

      if (message.size > 1) {
        message.payload = struct.extractBytes(result, 4, message.size - 1);
      }

      const checksum = this.calculateChecksum(message.command, message.payload, message.size);
      if (checksum.low != result[message.size + 3] || checksum.high != result[message.size + 4]) {
        throw new Error('Checksum mismatch');
      }
    } else {
      // TODO: bubble up error that no device is connected
      throw new Error('Invalid response');
    }

    return message;
  }

  async getNumberOfRecords() {
    const result = await this.commandResponse(COMMAND.READ_NR_RECORDS);
    return struct.extractBEShort(result.payload, 0);
  }

  async getSerialNumber() {
    const result = await this.commandResponse(COMMAND.READ_SERIAL);
    return struct.extractZString(result.payload, 0, 7);
  }

  async getDateTime() {
    const date = await this.commandResponse('$date?');

    if (date.startsWith('255,255')) {
      // the device does not have valid date settings (e.g. power loss),
      // so we return a date in 2006 to display the update-time modal
      return new Date(Date.UTC(2006));
    }

    const time = await this.commandResponse('$time?');

    const fmt = 'MM,DD,YY HH,mm';
    const ddate = `${date} ${time}`;
    return sundial.parseFromFormat(ddate, fmt);
  }

  async getRecords(nrOfRecords) {
    const records = [];

    for (let startIndex = 0; startIndex < nrOfRecords; startIndex++) {
      const index = [];
      const record = {};
      struct.storeBEShort(startIndex, index, 0);
      // requests to devices are sequential
      // eslint-disable-next-line no-await-in-loop
      const result = await this.commandResponse(COMMAND.READ_RECORD, index);

      const time = {
        year: 2000 + _.toInteger((result.payload[2] & 0b11111110) >> 1),
        month: ((result.payload[2] & 0x01) << 3) | ((result.payload[3] & 0b11100000) >> 5),
        day: result.payload[3] & 0b00011111,
        hours: ((result.payload[6] & 0b00000111) << 2) | ((result.payload[7] & 0b11000000) >> 6),
        minutes: result.payload[7] & 0b00111111,
        seconds: 0,
      }

      record.index = struct.extractBEShort(result.payload, 0);
      record.jsDate = sundial.buildTimestamp(time);
      record.value = ((result.payload[4] & 0b00000011) << 8) | result.payload[5];
      record.event = ((result.payload[6] & 0b11000000) >> 6);
      records.push(record);
    }

    return records;
  }

  async setTime(newTime, newDate) {
    const timeResponse = await this.commandResponse(`$time,${newTime}`);
    const dateResponse = await this.commandResponse(`$date,${newDate}`);

    if (timeResponse || dateResponse) {
      throw new Error('Error setting date/time.');
    }
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['Allmedicus'],
    modle: 'AGM-4000',
  });

  if (cfg.deviceInfo.driverId === 'EmbracePRO') {
    cfg.deviceInfo.model = 'EmbracePRO';
    cfg.deviceInfo.manufacturers.push('Omnis Health');
  }

  const hidDevice = config.deviceComms;
  const driver = new AGM4000(cfg);

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
      hidDevice.connect(cfg.deviceInfo, AGM4000.getNumberOfRecords, (err) => {
        if (err) {
          return cb(err);
        }
        data.disconnect = false;
        progress(100);
        return cb(null, data);
      });
    },

    getConfigInfo(progress, data, cb) {
      progress(0);

      (async () => {
        data.nrOfRecords = await driver.getNumberOfRecords();

        cfg.deviceInfo.serialNumber = await driver.getSerialNumber();
        cfg.deviceInfo.deviceId = `${cfg.deviceInfo.driverId}-${cfg.deviceInfo.serialNumber}`;
        // TODO: cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(await driver.getDateTime());
      })().then(() => {
        /* common.checkDeviceTime(
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
        );*/
        data.connect = true;
        cb(null, data);
      }).catch((error) => {
        debug('Error in getConfigInfo: ', error);
        return cb(error, null);
      });
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

      const mostRecent = sundial.applyTimezone(data.records[0].jsDate, cfg.timezone).toISOString();
      cfg.tzoUtil = new TZOUtil(cfg.timezone, mostRecent, data.post_records);

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
