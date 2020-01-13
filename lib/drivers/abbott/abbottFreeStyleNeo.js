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
import { KETONE_VALUE_FACTOR, KETONE_HI } from './freeStyleLibreConstants';

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('PrecisionNeoDriver') : console.log;

const RECORD_TYPE = {
  GLUCOSE: 7,
  KETONE: 9,
  INSULIN: 10,
  BASAL_TITRATION: 11,
  TIME_CHANGE: 6,
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
    return this.commandResponse('$serlnum?');
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

  function filterHistory(type, records) {
    return records.filter((record) => type === _.toInteger(record.split(',')[0]));
  }

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

  function buildTimeChangeRecords(data) {
    _.forEach(filterHistory(RECORD_TYPE.TIME_CHANGE, data.records), (record) => {
      const fields = record.split(',');

      const index = _.toInteger(fields[1]);
      const toDatum = parseDateTime(fields);
      const valid = _.toInteger(fields[7]);

      const fromTime = {
        month: _.toInteger(fields[8]),
        day: _.toInteger(fields[9]),
        year: _.toInteger(fields[10]) + 2000,
        hours: _.toInteger(fields[11]),
        minutes: _.toInteger(fields[12]),
        seconds: 0,
      };
      const fromDatum = sundial.buildTimestamp(fromTime);

      const timeChange = cfg.builder.makeDeviceEventTimeChange()
        .with_change({
          from: sundial.formatDeviceTime(fromDatum),
          to: sundial.formatDeviceTime(toDatum),
          agent: 'manual',
        })
        .with_deviceTime(sundial.formatDeviceTime(toDatum))
        .with_payload({ valid })
        .set('jsDate', toDatum)
        .set('index', index);
      data.post_records.push(timeChange);
    });
  }

  function buildBGRecords(data) {
    const records = filterHistory(RECORD_TYPE.GLUCOSE, data.records);

    _.forEach(records, (record) => {
      const fields = record.split(',');

      const index = _.toInteger(fields[1]);
      let value = fields[8];
      // eslint-disable-next-line no-unneeded-ternary
      const isControlSolution = _.toInteger(fields[10]) ? false : true;
      const jsDate = parseDateTime(fields);

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

      if (isControlSolution === false) {
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
        data.post_records.push(postRecord);
      } else {
        debug('Skipping BG control solution test');
      }
    });
  }

  function buildKetoneRecords(data) {
    const records = filterHistory(RECORD_TYPE.KETONE, data.records);

    _.forEach(records, (record) => {
      const fields = record.split(',');

      const index = _.toInteger(fields[1]);
      let value = fields[8];
      // eslint-disable-next-line no-unneeded-ternary
      const isControlSolution = _.toInteger(fields[9]) ? false : true;
      const jsDate = parseDateTime(fields);

      // According to spec, HI > 8 mmol/L
      // there is no LO as values are between 0 and 8 mmol/L
      let annotation = null;
      if (value === 'HI') {
        value = KETONE_HI + (1 / KETONE_VALUE_FACTOR);
        annotation = {
          code: 'ketone/out-of-range',
          value: 'high',
          threshold: KETONE_HI,
        };
      } else {
        value = _.toInteger(value) / KETONE_VALUE_FACTOR;
      }

      if (isControlSolution === false) {
        const recordBuilder = cfg.builder.makeBloodKetone()
          .with_value(value)
          .with_units('mmol/L') // values are always in 'mmol/L'
          .with_deviceTime(sundial.formatDeviceTime(jsDate))
          .set('index', index);

        cfg.tzoUtil.fillInUTCInfo(recordBuilder, jsDate);

        if (annotation) {
          annotate.annotateEvent(recordBuilder, annotation);
        }

        const postRecord = recordBuilder.done();
        delete postRecord.index;
        data.post_records.push(postRecord);
      } else {
        debug('Skipping ketone control solution test');
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
      buildTimeChangeRecords(data);
      cfg.tzoUtil = new TZOUtil(cfg.timezone, mostRecent, data.post_records);

      buildBGRecords(data);
      buildKetoneRecords(data);

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
