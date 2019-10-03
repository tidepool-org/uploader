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

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('BluetoothLEDriver') : console.log;

module.exports = (config) => {
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

   async connect(progress, data, cb) {
     debug('in connect!');
     await cfg.deviceComms.connect();
     return cb(null, data);
   },

   async getConfigInfo(progress, data, cb) {
     debug('in getConfigInfo', data);
     progress(0);

     _.assign(cfg.deviceInfo , await cfg.deviceComms.ble.getDeviceInfo());
     cfg.deviceInfo.deviceId = `${[cfg.deviceInfo.manufacturers]}-${cfg.deviceInfo.model}-${cfg.deviceInfo.serialNumber}`;
     cfg.deviceTags = ['bgm'];

     // TODO: cfg.deviceTime

     cfg.deviceComms.ble.on('numberOfRecords', (result) => {
       debug('Number of records:', result);
     });
     await cfg.deviceComms.ble.getNumberOfRecords();

     return cb(null, data);
   },

   async fetchData(progress, data, cb) {
     debug('in fetchData', data);

     cfg.deviceComms.ble.on('data', (result) => {
       debug('Records:', result);
       data.records = result;
       return cb(null, data);
     });
     await cfg.deviceComms.ble.getAllRecords();
   },

   processData(progress, data, cb) {
     progress(0);
     cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });
     data.postRecords = [];

     _.forEach(data.records, (result) => {
       const record = result;
       let annotation = null;

       if (record.value === Number.POSITIVE_INFINITY) {
         record.value = 0;
         annotation = {
           code: 'bg/out-of-range',
           value: 'high',
         };
       } else if (record.value === Number.NEGATIVE_INFINITY) {
         record.value = 0;
         annotation = {
           code: 'bg/out-of-range',
           value: 'low',
         };
       }

       if (annotation) {
         annotate.annotateEvent(postRecord, annotation);
         annotate.annotateEvent(postRecord, { code: 'bg/unknown-value' });
       }

       const postRecord = cfg.builder.makeSMBG()
         .with_value(record.value)
         .with_units(record.units)
         .with_deviceTime(sundial.formatDeviceTime(record.timestamp))
         .set('index', record.seqNum);

       cfg.tzoUtil.fillInUTCInfo(postRecord, record.timestamp);
       delete postRecord.index;

       data.postRecords.push(postRecord.done());
     });

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
       deviceTags: cfg.deviceTags,
       deviceManufacturers: cfg.deviceInfo.manufacturers,
       deviceModel: cfg.deviceInfo.model,
       deviceSerialNumber: cfg.deviceInfo.serial,
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
     cfg.deviceComms.ble.disconnect();
     data.disconnect = true;
     cb(null, data);
   },

   cleanup(progress, data, cb) {
     debug('in cleanup');
     progress(100);
     data.cleanup = true;
     cb();
   },
  };
};
