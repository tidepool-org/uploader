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

import annotate from '../../eventAnnotations';
import common from '../../commonFunctions';
import TZOUtil from '../../TimezoneOffsetUtil';
import structJs from '../../struct';
import protocol from './freeStyleLibreProtocol';
import constants from './freeStyleLibreConstants';

const struct = structJs();
const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('PrecisionNeoDriver') : console.log;

const COMMAND = {
  INIT_REQUEST_1: 0x04,
  INIT_REQUEST_2: 0x05,
  INIT_REQUEST_3: 0x15,
  INIT_REQUEST_4: 0x01,
  TEXT_REQUEST: 0x21,
};

const READ_TIMEOUT = 5000;
const HID_PACKET_SIZE = 64;

class PrecisionNeo {
  constructor(cfg) {
    this.cfg = cfg;
    this.hidDevice = this.cfg.deviceComms;
  }

  static extractPacketIntoMessages(bytes) {
    return bytes;
  }

  static buildHidPacket(commandType, data) {
    const bytes = new Uint8Array(HID_PACKET_SIZE);
    const counter = struct.pack(bytes, 0, 'bb', commandType, data.length);
    if (data.length) {
      // data can be either a TypedArray or a string
      let dataTypeChar = 'B';
      if (typeof (data) === 'string') {
        dataTypeChar = 'Z';
      }
      struct.pack(bytes, counter, data.length + dataTypeChar, data);
    }
    return bytes.buffer;
  }

  async commandResponse(cmd, data) {
    let message = '';

    const bytesWritten =
      await this.hidDevice.sendPromisified(protocol.buildHidPacket(cmd, data));
    debug('Sent', bytesWritten, 'bytes.');

    let raw = [];
    let result;
    do {
      result = [];
      // requests to devices are sequential
      // eslint-disable-next-line no-await-in-loop
      result = await this.hidDevice.receiveTimeout(READ_TIMEOUT);
      const length = result[1];

      debug('Incoming bytes:', common.bytes2hex(result));

      if (result.length > 0 && length < 64) {
        raw = raw.concat(result.slice(1, length + 1));
      }
    } while (result.length > 0);

    // Only process if we get data
    if (raw.length > 0) {
      debug('Packet:', String.fromCharCode.apply(null, raw));
      message = PrecisionNeo.extractPacketIntoMessages(raw);
    }
    debug('Message(s):', message);
    return message;
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['Abbott'],
  });

  const driver = new PrecisionNeo(cfg);

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
      // eslint-disable-next-line consistent-return
      cfg.deviceComms.connect(data.deviceInfo, _.noop(), (err) => {
        if (err) {
          data.disconnect = true;
          debug('Error:', err);
          return cb(err, null);
        }

        (async () => {
          await driver.commandResponse(COMMAND.INIT_REQUEST_1, '');
          await driver.commandResponse(COMMAND.INIT_REQUEST_2, '');
          await driver.commandResponse(COMMAND.INIT_REQUEST_3, '');
          await driver.commandResponse(COMMAND.INIT_REQUEST_4, '');
        })().then(() => {
          data.disconnect = false;
          progress(100);
          return cb(null, data);
        }).catch((error) => {
          debug('Error in connect: ', error);
          return cb(error, null);
        });
      });
    },

    getConfigInfo(progress, data, cb) {
      debug('in getConfigInfo', data);
      progress(0);

      (async () => {
        await driver.commandResponse(COMMAND.TEXT_REQUEST, '$result?\r\n');
        progress(20);
        await driver.commandResponse(COMMANDS.WAKEUP);
        _.assign(cfg.deviceInfo, await driver.getDeviceId());
        progress(40);
        [cfg.deviceInfo.firmwareVersion] =
          await driver.commandResponse(COMMANDS.GET_FIRMWARE_VERSION);
        progress(60);

        const [rawTime] = await driver.commandResponse(COMMANDS.GET_METER_TIME);
        cfg.deviceInfo.meterTime = sundial.parseFromFormat(rawTime, 'ssmmHHDDMMYY');
        cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(cfg.deviceInfo.meterTime);

        debug('DeviceInfo:', JSON.stringify(cfg.deviceInfo, null, 4));

        common.checkDeviceTime(
          cfg,
          (timeErr) => {
            if (timeErr) {
              cfg.deviceComms.removeListeners();
              return driver.hidDevice.send(TrueMetrix.buildPacket(
                COMMANDS.POWER_OFF,
                COMMANDS.POWER_OFF.length,
              ), (err) => {
                if (err) {
                  cb(err, null);
                } else {
                  progress(100);
                  cb(timeErr, data);
                }
              });
            }
            progress(100);
            data.connect = true;
            return cb(null, data);
          },
        );
      })().catch((error) => {
        debug('Error in getConfigInfo: ', error);
        cb(error, null);
      });
    },

    async fetchData(progress, data, cb) {
      debug('in fetchData', data);
      try {

        cb(null, data);
      } catch (error) {
        debug('Error in fetchData: ', error);
        cb(error, null);
      }
    },

    processData(progress, data, cb) {
      progress(0);
      cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });
      data.postRecords = [];
      let payloads = '';

      _.forEach(data.glucose, (nibbles, index) => {
        // each ASCII hex byte is a nibble
        payloads = payloads.concat(nibbles);
        const dayYear = parseInt(nibbles.slice(1, 4), 16).toString();
        const timestamp = parseInt(nibbles.slice(4, 7), 16).toString();

        const time = {
          year: _.toInteger(dayYear.slice(-2)) + 2000,
          month: parseInt(nibbles[0], 16),
          day: _.toInteger(dayYear.slice(0, -2)),
          hours: _.toInteger(timestamp.slice(0, -2)),
          minutes: _.toInteger(timestamp.slice(-2)),
          seconds: 0,
        };
        const jsDate = sundial.buildTimestamp(time);

        /* eslint-disable no-bitwise */
        // maximum glucose value is 0x7FF = 2047 mg/dL
        const threeBits = nibbles[7] & 0x07; // lower three bits of nibble
        let value = (threeBits << 8) + parseInt(nibbles.slice(8, 10), 16);
        /* eslint-enable no-bitwise */

        // According to user manual, HI > 600 and LO < 20
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
        }

        const controlSolution = _.toInteger(nibbles[11]);

        if (controlSolution === 0) {
          const recordBuilder = cfg.builder.makeSMBG()
            .with_value(value)
            .with_units('mg/dL') // values are always in 'mg/dL'
            .with_deviceTime(sundial.formatDeviceTime(jsDate))
            .set('index', index);

          cfg.tzoUtil.fillInUTCInfo(recordBuilder, jsDate);

          if (annotation) {
            annotate.annotateEvent(recordBuilder, annotation);
          }

          const postRecord = recordBuilder.done();
          delete postRecord.index;
          data.postRecords.push(postRecord);
        }
      });

      // Also verify checksum of all the payloads
      if (!TrueMetrix.verifyChecksum(payloads, data.checksum.slice(1), CHECKSUM_TYPE.DOWNLOAD)) {
        return cb(new Error('Possible data corruption, checksums not matching.'), null);
      }

      debug('POST records:', data.postRecords);

      if (data.postRecords.length === 0) {
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
        data.postRecords, sessionInfo, progress, cfg.groupId,
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
      cfg.deviceComms.removeListeners();
      // Due to an upstream bug in HIDAPI on Windoze, we have to send a command
      // to the device to ensure that the listeners are removed before we disconnect
      // For more details, see https://github.com/node-hid/node-hid/issues/61
      driver.hidDevice.send(TrueMetrix.buildPacket(
        COMMANDS.POWER_OFF,
        COMMANDS.POWER_OFF.length,
      ), (err) => {
        progress(100);
        cb(err, data);
      });
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
