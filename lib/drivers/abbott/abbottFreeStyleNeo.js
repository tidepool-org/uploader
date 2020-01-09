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
import FreeStyleProtocol from './freeStyleLibreProtocol';

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('PrecisionNeoDriver') : console.log;

const RECORD_TYPE = {
  GLUCOSE: 7,
  KETONE: 9,
  INSULIN: 10,
  BASAL_TITRATION: 11,
  TIME_CHANGE: 6, // TODO: UTC bootstrap
};

class PrecisionNeo {
  constructor(cfg, protocol) {
    this.cfg = cfg;
    this.hidDevice = this.cfg.deviceComms;
    this.protocol = protocol;
  }

  async commandResponse(cmd) {
    return new Promise((resolve, reject) => {
      this.protocol.requestTextResponse(cmd, (result) => {
        resolve(result);
      },
      (err) => {
        debug('requestTextResponse Error:', err);
        reject(err);
      });
    });
  }

  async getSerialNumber() {
    const serialNumber = await this.commandResponse('$serlnum?');
    return serialNumber;
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
}

module.exports = (config) => {
  const cfg = _.clone(config);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['Abbott'],
    model: 'Precision/Optium Neo',
  });

  const hidDevice = config.deviceComms;
  const protocol = new FreeStyleProtocol(cfg);
  const driver = new PrecisionNeo(cfg, protocol);

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
      hidDevice.connect(cfg.deviceInfo, FreeStyleProtocol.probe, (err) => {
        if (err) {
          return cb(err);
        }
        return protocol.initCommunication(() => {
          data.disconnect = false;
          progress(100);
          return cb(null, data);
        });
      });
    },

    getConfigInfo(progress, data, cb) {
      progress(0);

      (async () => {
        cfg.deviceInfo.serialNumber = await driver.getSerialNumber();
        cfg.deviceInfo.deviceId = `${cfg.deviceInfo.driverId}-${cfg.deviceInfo.serialNumber}`;
        cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(await driver.getDateTime());
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

    async fetchData(progress, data, cb) {
      debug('in fetchData', data);
      (async () => {
        data.records = await driver.getRecords();
      })().then(() => {
        progress(100);
        return cb(null, data);
      }).catch((error) => {
        debug('Error in fetchData: ', error);
        return cb(error, null);
      });
    },

    processData(progress, data, cb) {
      progress(0);
      cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });
      data.postRecords = [];

      _.forEach(data.records, (record) => {
        const fields = record.split(',');

        const recordType = _.toInteger(fields[0]);
        const index = _.toInteger(fields[1]);
        const time = {
          month: _.toInteger(fields[2]),
          day: _.toInteger(fields[3]),
          year: _.toInteger(fields[4]) + 2000,
          hours: _.toInteger(fields[5]),
          minutes: _.toInteger(fields[6]),
          seconds: 0,
        };

        let value = fields[8];
        // eslint-disable-next-line no-unneeded-ternary
        const isControlSolution = _.toInteger(fields[10]) ? false : true;
        const jsDate = sundial.buildTimestamp(time);

        // According to spec, HI > 500 and LO < 20
        let annotation = null;
        if (value === 'HI') {
          value = 501;
          annotation = {
            code: 'bg/out-of-range',
            value: 'high',
            threshold: 500,
          };
        } else if (value === 'LO') {
          value = 19;
          annotation = {
            code: 'bg/out-of-range',
            value: 'low',
            threshold: 20,
          };
        } else {
          value = _.toInteger(value);
        }

        if (recordType === RECORD_TYPE.GLUCOSE && isControlSolution === false) {
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

      // TODO: handle ketones

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
      // TODO
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
