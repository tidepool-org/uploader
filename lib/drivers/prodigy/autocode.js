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

const READ_SERIAL = 0x58;
const READ_RECORDS = 0x05;

const STX = 0x02;
const ETX = 0x03;
const EOT = 0x04;
const END = 0x9D;

const UART_CONFIG = {
  reportId: 0,
  set: 1,
  baud: 57600,
  parity: 0,
  flowControl: 0,
  dataBits: 8,
};

class Autocode {
  constructor(cfg) {
    this.cfg = cfg;
    this.hidDevice = this.cfg.deviceComms;
  }

  buildPacket(command) {
    const buf = new ArrayBuffer(33);
    const bytes = new Uint8Array(buf);

    struct.pack(bytes, 0, 'bbb', 0x00, 0x01, command);

    debug('Sending bytes:', common.bytes2hex(bytes));
    return bytes;
  }

  async commandResponse(cmd) {
    const bytes = this.buildPacket(cmd);
    await this.hidDevice.sendPromisified(bytes);

    const buffer = [];
    let result = [];
    let complete = false;

    // eslint-disable-next-line no-await-in-loop
    while (!complete) {
      result = await this.hidDevice.receiveTimeout(READ_TIMEOUT);
      debug('Incoming bytes:', common.bytes2hex(result));

      if (result.length === 0) {
        throw new Error('Meter not responding. Try reconnecting the meter and check that it is switched on.');
      }

      const [length] = result;

      // Extract payload bytes
      for (let i = 1; i <= length && i < result.length; i++) {
        const byte = result[i];
        buffer.push(byte);

        if ((buffer.at(-1) === EOT && buffer.at(-2) === ETX) ||
            (buffer.at(-1) === END)) {
          complete = true;
        }
      }
    }

    debug('Received:', String.fromCharCode(...buffer));

    return buffer;
  }

  async getSerialNumber() {
    const result = await this.commandResponse(READ_SERIAL);
    const nullIndex = result.indexOf(0x00);
    const endIndex = nullIndex !== -1 ? nullIndex : result.indexOf(END);

    return String.fromCharCode(...result.slice(1, endIndex));
  }

  async getRecords() {
    const result = await this.commandResponse(READ_RECORDS);

    // Find start (STX) and end (ETX) of transmission
    const stxIndex = result.indexOf(STX);
    const etxIndex = result.indexOf(ETX);

    if (stxIndex === -1 || etxIndex === -1) {
      throw new Error('Could not parse glucose data');
    }

    const dataBytes = result.slice(stxIndex + 1, etxIndex);
    const dataString = String.fromCharCode(...dataBytes);

    const lines = dataString.split('\r\n').filter(line => line.length > 0);

    const records = lines.map(line => {
      const [index, year, month, day, hours, minutes, glucose, unit] = line.split(',');
      const dateTime = {
        year: parseInt(year),
        month: parseInt(month),
        day: parseInt(day),
        hours: parseInt(hours),
        minutes: parseInt(minutes),
        seconds: 0,
      };
      return {
        index: parseInt(index),
        jsDate: sundial.buildTimestamp(dateTime),
        value: parseInt(glucose),
        units: unit === 'mg_dL' ? 'mg/dL' : 'mmol/L'
      };
    });

    return records;
  }
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

      // AutoCode meter should automatically skip control solution tests

      const recordBuilder = cfg.builder.makeSMBG()
        .with_value(record.value)
        .with_units(record.units)
        .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
        .set('index', record.index);

      cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.jsDate);

      if (annotation) {
        annotate.annotateEvent(recordBuilder, annotation);
      }

      const postRecord = recordBuilder.done();
      delete postRecord.index;
      data.post_records.push(postRecord);
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
      (async () => {
        try {
          debug('in getConfigInfo', data);
          cfg.deviceInfo.serialNumber = await driver.getSerialNumber();
          cfg.deviceInfo.deviceId = `${cfg.deviceInfo.manufacturers[0]}-${cfg.deviceInfo.model}-${cfg.deviceInfo.serialNumber}`;
          progress(100);
          data.connect = true;
          return cb(null, data);
        } catch (error) {
          debug('Error in getConfigInfo: ', error);
          return cb(error, null);
        }
      })();
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
      debug('in disconnect');
      progress(100);
      cb(null, data);
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
