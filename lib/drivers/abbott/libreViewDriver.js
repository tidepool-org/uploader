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
import common from '../../commonFunctions';

const isBrowser = typeof window !== 'undefined';
const debug = isBrowser ? require('bows')('LibreViewDriver') : console.log;

function addOutOfRangeAnnotation(recordBuilder, low, high, units, type) {
  let step = 1;
  if (units === 'mmol/L') {
    step = 0.1;
  }

  if (low !== null && recordBuilder.value < low + step) {
    recordBuilder.with_value(low);
    annotate.annotateEvent(recordBuilder, {
      code: `${type}/out-of-range`,
      value: 'low',
      threshold: common.fixFloatingPoint(low + step),
    });
  } else if (high !== null && recordBuilder.value > high - step) {
    recordBuilder.with_value(high);
    annotate.annotateEvent(recordBuilder, {
      code: `${type}/out-of-range`,
      value: 'high',
      threshold: common.fixFloatingPoint(high - step),
    });
  }
}

module.exports = (config) => {
  const LIBREVIEW_TS_FORMAT = [
    'YYYY-MM-DD hh:mm A',
    'YYYY-MM-DD HH:mm',
    'MM-DD-YYYY hh:mm A',
    'MM-DD-YYYY HH:mm',
  ];

  const LIBREVIEW_TS_FORMAT_ALT = [
    'DD-MM-YYYY hh:mm A',
    'DD-MM-YYYY HH:mm',
  ];

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

  const STRIP_GLUCOSE_LO = {
    'mg/dL': 20,
    'mmol/L': 1.1,
  };

  const KETONE_HI = 8.0;
  const KETONE_LO = null; // ketone value cannot be low

  const TYPES_TO_READ = {
    0: 4, //  Historic Glucose
    1: 5, //  Scan Glucose
    2: 14, // Strip Glucose
    3: 15, // Ketone

    4: false, // Rapid-Acting Insulin (units) OR Non-numeric Long-Acting Insulin
    5: false, // Non-numeric Food
    6: false, // ?
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
      // Due to language differences, we cannot parse the units from the CSV
      // If we find any values larger than 40, we use mg/dL instead
      config.units = 'mmol/L';
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
        dynamicTyping: true,
      });

      if (parsed.data[0].filter((x) => x).length <= 2) {
        // for LibreView Pro, we remove the patient name and birth date
        parsed.data.shift();
      }

      const parseRows = (format) => {
        const rows = [];
        let validateDateFormat = false;

        debug('Using format', format);

        for (let i = parsed.data.length - 1; i > 0; --i) {
          const datum = parsed.data[i];

          if (datum[0] === '') {
            /* eslint-disable-next-line no-continue */
            continue;
          }

          if (!sundial.isValidDateForMask(datum[2], format)) {
            return false;
          }

          datum.jsDate = sundial.parseFromFormat(datum[2], format);

          if ((datum.jsDate.getDate() > 12) || Number(datum[2].slice(0, 4))) {
            // if there's a row in the data where the date is higher than 12
            // (to distinguish it from the month) or the year is first, it's valid
            validateDateFormat = true;
          }

          datum.deviceTime = sundial.formatDeviceTime(datum.jsDate);
          datum.csvIndex = i;

          const recordType = datum[3];
          if (!TYPES_TO_READ[recordType]) {
            /* eslint-disable-next-line no-continue */
            continue;
          }
          datum.device = `${datum[0]} ${datum[1]}`;
          datum.type = TYPES_TO_READ[recordType];

          datum.value = Number(datum[datum.type]);

          if (Number.isNaN(datum.value)) {
            // comma decimal separator is being used
            datum.value = Number(datum[datum.type].replace(',', '.'));
          }

          if (Number.isNaN(datum.value)) {
            throw new Error('Could not parse value');
          }

          if (datum.value >= GLUCOSE_LO['mg/dL']) {
            config.units = 'mg/dL';
          }

          rows.push(datum);
        }

        if (!validateDateFormat) {
          return false;
        }

        return rows;
      };

      let rows = parseRows(LIBREVIEW_TS_FORMAT);

      if (rows === false) {
        // we can't use DD/MM/YYYY and MM/DD/YYYY formats at the same time, as moment.js
        // will just use whatever one works, so we first try the one and then the other
        debug('Trying alternative date format');
        rows = parseRows(LIBREVIEW_TS_FORMAT_ALT);
      }

      if (rows === false) {
        // we can't be sure about the date format, so we have to throw an error
        return cb('E_LIBREVIEW_FORMAT');
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
            deviceModel: payload.theData[k][0],
            serialNumber: payload.theData[k][1],
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

      const validateUnits = (value) => {
        if ((config.units === 'mg/dL') && !Number.isInteger(value)) {
          throw new Error('Could not validate units');
        }
      };

      Object.keys(payload.devices).forEach((key) => {
        const device = payload.devices[key];
        const events = device.data;

        const postRecords = [];
        payload.postRecords = postRecords;

        config.tzoUtil = new TZOUtil(config.timezone, mostRecent, postRecords);
        device.postRecords = postRecords;
        config.builder.setDefaults({ deviceId: device.info.deviceId });

        events.filter(elem => elem[3] === RECORD_TYPE_HISTORIC)
          .forEach((record) => {
            const cbg = config.builder.makeCBG()
              .with_value(record.value)
              .with_units(config.units)
              .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
              .set('index', record.csvIndex);

            validateUnits(record.value);
            config.tzoUtil.fillInUTCInfo(cbg, record.jsDate);

            addOutOfRangeAnnotation(cbg, GLUCOSE_LO[config.units], GLUCOSE_HI[config.units], config.units, 'bg');
            postRecords.push(cbg.done());
          });
        events.filter(elem => (elem[3] === RECORD_TYPE_STRIP || elem[3] === RECORD_TYPE_SCAN))
          .forEach((record) => {
            const smbg = config.builder.makeSMBG()
              .with_value(record.value)
              .with_units(config.units)
              .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
              .set('index', record.csvIndex);

            if (record[3] === RECORD_TYPE_SCAN) {
              smbg.with_subType('scanned');
            }

            validateUnits(record.value);

            if (record[3] === RECORD_TYPE_STRIP) {
              addOutOfRangeAnnotation(smbg, STRIP_GLUCOSE_LO[config.units], GLUCOSE_HI[config.units], config.units, 'bg');
            } else {
              addOutOfRangeAnnotation(smbg, GLUCOSE_LO[config.units], GLUCOSE_HI[config.units], config.units, 'bg');
            }

            config.tzoUtil.fillInUTCInfo(smbg, record.jsDate);

            postRecords.push(smbg.done());
          });
        events.filter(elem => elem[3] === RECORD_TYPE_KETONE)
          .forEach((record) => {
            const ketone = config.builder.makeBloodKetone()
              .with_value(record.value)
              .with_units('mmol/L')
              .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
              .set('index', record.csvIndex);

            addOutOfRangeAnnotation(ketone, KETONE_LO, KETONE_HI, 'mmol/L', 'ketone');
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

      const devices = {
        total: Object.keys(payload.devices).length,
        index: 0,
      };

      async.eachSeries(Object.keys(payload.devices), (key, done) => {
        const device = payload.devices[key];
        const deviceRecords = device.postRecords;

        deviceRecords.forEach((record) => delete record.index);

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

        devices.index += 1;

        config.api.upload.toPlatform(
          deviceRecords, sessionInfo, progress, config.groupId,
          (err) => {
            if (err) {
              debug(err);
              return done(err);
            }

            payload.post_records = payload.post_records.concat(deviceRecords);
            return done();
          }, 'dataservices', devices,
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
