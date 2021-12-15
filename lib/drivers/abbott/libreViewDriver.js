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

import async from 'async';
import csv from 'babyparse';
import sundial from 'sundial';

import TZOUtil from '../../TimezoneOffsetUtil';
import annotate from '../../eventAnnotations';

const isBrowser = typeof window !== 'undefined';
const debug = isBrowser ? require('bows')('LibreViewDriver') : console.log;

function addOutOfRangeAnnotation(recordBuilder, low, high, step, type) {
  if (low !== null && recordBuilder.value < low + step) {
    recordBuilder.with_value(low);
    annotate.annotateEvent(recordBuilder, {
      code: `${type}/out-of-range`,
      value: 'low',
      threshold: low + step,
    });
  } else if (high !== null && recordBuilder.value > high - step) {
    recordBuilder.with_value(high);
    annotate.annotateEvent(recordBuilder, {
      code: `${type}/out-of-range`,
      value: 'high',
      threshold: high - step,
    });
  }
}

module.exports = (config) => {
  const LIBREVIEW_TS_FORMAT = ['MM/DD/YYYY hh:mm A', 'DD/MM/YYYY HH:mm'];

  const RECORD_TYPE_HISTORIC = 0;
  const RECORD_TYPE_SCAN = 1;
  const RECORD_TYPE_STRIP = 2;
  const RECORD_TYPE_KETONE = 3;

  const GLUCOSE_HI = {
    'mg/dL': 500,
    'mmol/L': 27.8,
  };

  const GLUCOSE_LO = {
    'mg/dL': 40,
    'mmol/L': 2.2,
  };

  const KETONE_HI = 8.0;
  const KETONE_LO = null; // ketone value cannot be low

  const TYPES_TO_READ = {
    0: 'Historic Glucose',
    1: 'Scan Glucose',
    2: 'Strip Glucose',
    3: 'Ketone',

    4: false, // Rapid-Acting Insulin (units) OR Non-numeric Long-Acting Insulin
    5: false, // Non-numeric Food
    6: false, // ?
  };

  const typesUnits = {
    'Historic Glucose': '',
    'Scan Glucose': '',
    'Strip Glucose': '',
    Ketone: '',
  };

  return {
    detect: (obj, cb) => {
      debug('LibreView Detect!');
      cb(null, obj);
    },

    setup: (deviceInfo, progress, cb) => {
      debug('LibreView Setup!');
      progress(100);
      deviceInfo = deviceInfo || {};
      cb(null, { devices: deviceInfo });
    },

    connect: (progress, payload, cb) => {
      debug('LibreView Connect!');
      progress(100);
      cb(null, payload);
    },

    getConfigInfo: (progress, payload, cb) => {
      debug('LibreView GetConfigInfo!');
      progress(100);
      cb(null, payload);
    },

    fetchData: (progress, payload, cb) => {
      debug('LibreView FetchData!');
      let data = config.filedata;
      payload.filedata = config.filedata; // to store as blob

      if (typeof config.filedata !== 'string') {
        data = new TextDecoder().decode(new Uint8Array(config.filedata));
      }

      debug('LibreView data', data.length);

      const endOfPreamble = data.indexOf('\n') + 1;
      // Setup the preamble to have everything up to the header line
      payload.preamble = csv.parse(data.substr(0, endOfPreamble), {});

      // Store the rest of the data
      const parsed = csv.parse(data.substr(endOfPreamble), {
        header: true,
        dynamicTyping: true,
      });

      parsed.meta.fields.forEach((field) => {
        Object.keys(typesUnits).forEach((key) => {
          if (field.startsWith(key)) {
            typesUnits[key] = field.replace(`${key} `, '');
          }
        });
      });

      for (const recordType of [RECORD_TYPE_HISTORIC, RECORD_TYPE_SCAN, RECORD_TYPE_STRIP]) {
        const units = typesUnits[TYPES_TO_READ[recordType]];
        if (GLUCOSE_HI[units] === undefined) {
          const error = `Unexpected units for ${TYPES_TO_READ[recordType]}: ${units}`;
          debug('Error:', error);
          return cb(new Error(error));
        }
      }

      const ketoneUnits = typesUnits[TYPES_TO_READ[RECORD_TYPE_KETONE]];
      if (ketoneUnits !== 'mmol/L') {
        const error = `Unexpected units for ${TYPES_TO_READ[RECORD_TYPE_KETONE]}: ${ketoneUnits}`;
        debug('Error:', error);
        return cb(new Error(error));
      }

      const rows = [];
      for (let i = parsed.data.length - 1; i >= 0; --i) {
        const datum = parsed.data[i];

        if (datum.Device === '') {
          /* eslint-disable-next-line no-continue */
          continue;
        }

        datum.jsDate = sundial.parseFromFormat(datum['Device Timestamp'],
          LIBREVIEW_TS_FORMAT);

        datum.deviceTime = sundial.formatDeviceTime(datum.jsDate);
        datum.csvIndex = i;

        const recordType = datum['Record Type'];
        if (!TYPES_TO_READ[recordType]) {
          /* eslint-disable-next-line no-continue */
          continue;
        }
        datum.device = `${datum.Device} ${datum['Serial Number']}`;
        datum.type = TYPES_TO_READ[recordType];
        datum.units = typesUnits[datum.type];
        datum.value = datum[`${datum.type} ${datum.units}`];

        rows.push(datum);
      }

      payload.theData = rows;

      debug(`Read ${rows.length} entries`);

      debug('Separate into per-device arrays');
      for (let k = 0; k < payload.theData.length; ++k) {
        const key = payload.theData[k].device;
        let device = payload.devices[key];
        if (device == null) {
          device = {};
          payload.devices[key] = device;

          device.data = [];

          device.info = {
            deviceModel: payload.theData[k].Device,
            serialNumber: payload.theData[k]['Serial Number'],
          };
          device.info.deviceId = (
            `Abbott${device.info.deviceModel}-${device.info.serialNumber}`
          ).replace(/ /g, '');
        }
        device.data.push(payload.theData[k]);
      }

      delete payload.theData;

      let entryCount = 0;
      Object.keys(payload.devices).forEach((key) => {
        const device = payload.devices[key];
        debug(`Device ${key}: ${device.data.length} entries`);
        entryCount += device.data.length;
      });

      if (entryCount === 0) {
        debug('Error reading file, no data parsed.');
        return cb(new Error('Error reading file, no data parsed.'));
      }

      return cb(null, payload);
    },

    processData: (progress, payload, cb) => {
      debug('LibreView ProcessData!');
      progress(20);

      let ts = 0;
      Object.keys(payload.devices).forEach((key) => {
        const device = payload.devices[key];
        const mostRecentDatum = device.data[0];
        if (mostRecentDatum.jsDate > ts) {
          ts = mostRecentDatum.jsDate;
        }
      });

      const mostRecent = sundial.applyTimezone(ts, config.timezone).toISOString();

      Object.keys(payload.devices).forEach((key) => {
        const device = payload.devices[key];
        const events = device.data;

        const postRecords = [];
        payload.postRecords = postRecords;

        config.tzoUtil = new TZOUtil(config.timezone, mostRecent, postRecords);
        device.postRecords = postRecords;
        config.builder.setDefaults({ deviceId: device.info.deviceId });

        events.filter(elem => elem['Record Type'] === RECORD_TYPE_HISTORIC)
          .forEach((record) => {
            const cbg = config.builder.makeCBG()
              .with_value(record.value)
              .with_units(record.units)
              .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
              .set('index', record.csvIndex);

            config.tzoUtil.fillInUTCInfo(cbg, record.jsDate);

            addOutOfRangeAnnotation(cbg, GLUCOSE_LO, GLUCOSE_HI, 1, 'bg');
            postRecords.push(cbg.done());
          });
        events.filter(elem => (elem['Record Type'] === RECORD_TYPE_STRIP || elem['Record Type'] === RECORD_TYPE_SCAN))
          .forEach((record) => {
            const smbg = config.builder.makeSMBG()
              .with_value(record.value)
              .with_units(record.units)
              .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
              .set('index', record.csvIndex);

            if (record['Record Type'] === RECORD_TYPE_SCAN) {
              smbg.with_subType('scanned');
            }

            addOutOfRangeAnnotation(smbg, GLUCOSE_LO[record.units], GLUCOSE_HI[record.units], 1, 'bg');
            config.tzoUtil.fillInUTCInfo(smbg, record.jsDate);

            postRecords.push(smbg.done());
          });
        events.filter(elem => elem['Record Type'] === RECORD_TYPE_KETONE)
          .forEach((record) => {
            const ketone = config.builder.makeBloodKetone()
              .with_value(record.value)
              .with_units(record.units)
              .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
              .set('index', record.csvIndex);

            addOutOfRangeAnnotation(ketone, KETONE_LO, KETONE_HI, 1, 'ketone');
            config.tzoUtil.fillInUTCInfo(ketone, record.jsDate);
            postRecords.push(ketone.done());
          });
      });
      progress(100);
      cb(null, payload);
    },

    uploadData: (progress, payload, cb) => {
      progress(0);
      payload.post_records = [];

      async.eachSeries(Object.keys(payload.devices), (key, done) => {
        const device = payload.devices[key];
        const deviceRecords = device.postRecords;

        const sessionInfo = {
          deviceTags: ['bgm', 'cgm'],
          deviceManufacturers: ['Abbott'],

          deviceModel: device.info.deviceModel,
          deviceSerialNumber: device.info.serialNumber,
          deviceId: device.info.deviceId,

          start: sundial.utcDateString(),
          timeProcessing: config.tzoUtil.type,
          tzName: config.timezone,
          version: config.version,
          blobId: payload.blobId,
          source: 'LibreView', // to be able to distinguish from direct uploads
        };

        if (device.info.annotations) {
          annotate.annotateEvent(sessionInfo, device.info.annotations);
        }

        config.api.upload.toPlatform(
          deviceRecords, sessionInfo, progress, config.groupId,
          (err) => {
            if (err) {
              debug(err);
              return done(err);
            }

            payload.post_records = payload.post_records.concat(deviceRecords);
            return done();
          }, 'dataservices',
        );
      }, (err) => {
        if (err) {
          progress(100);
          cb(err);
        }
        progress(100);
        cb(null, payload);
      });
    },

    disconnect: (progress, payload, cb) => {
      debug('LibreView Disconnect!');
      progress(100);
      cb(null, payload);
    },

    cleanup: (progress, payload, cb) => {
      debug('LibreView Cleanup!');
      progress(100);
      cb(null, payload);
    },
  };
};
