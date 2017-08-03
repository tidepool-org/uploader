/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
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

import {clone, assign} from 'lodash';
import async from 'async';
//import sundial from 'sundial';

import TZOUtil from '../../TimezoneOffsetUtil';

import {FreeStyleLibreProtocol} from './freeStyleLibreProtocol';

const isBrowser = typeof window !== 'undefined';
const debug = isBrowser ? require('bows')('FreeStyleLibreDriver') : console.log;


export default function (config) {

  const cfg = clone(config);
  const hidDevice = config.deviceComms;
  const protocol = new FreeStyleLibreProtocol(cfg);

  // TODO: date & time settings changes are available
  // change timezone calculation accordingly
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

  return {
    detect: function (deviceInfo, cb) {
      debug('detect: no detect function needed', arguments);
      cb(null, deviceInfo);
    },

    setup: function (deviceInfo, progress, cb) {
      debug('in setup');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      debug('in connect');

      hidDevice.connect(data.deviceInfo, FreeStyleLibreProtocol.probe, err => {
        if (err) {
          return cb(err);
        }
        protocol.initCommunication(() => {
          // ignore results of init as it seems not to be relevant to the following communication
          data.disconnect = false;
          progress(100);
          cb(null, data);
        });
      });
    },

    getConfigInfo: function (progress, data, cb) {
      debug('in getConfigInfo');
      progress(0);

      const getterFunctions = [
        //cb => { protocol.getSerialNumber(cb); },
        //cb => { protocol.getFirmwareVersion(cb); },
        cb => { protocol.getDBRecordNumber(cb); }
      ];
      let counter = 0;
      async.series(getterFunctions, (err, result) => {
        counter += 1;
        progress(100 * (counter / getterFunctions.length));

        if (err) {
          debug('getConfigInfo: ', err);
          return cb(err, null);
        }
        data.connect = true;
        result.forEach(element => {
          if (typeof element === 'object') {
            debug('getConfigInfo: result object: ', element);
            assign(data.deviceInfo, element);
          }
        });
        debug('getConfigInfo: data: ', data);

        cb(null, data);
      });
    },

    fetchData: function (progress, data, cb) {
      debug('in fetchData');
      progress(0);

      const getterFunctions = [
        cb => { protocol.getDBSchema(cb); },
        cb => { protocol.getDateTime(cb); },
        //cb => { protocol.getReaderResultData(cb); },
        //cb => { protocol.getHistoricalScanData(cb); }
      ];

      data.dbRecords = {};
      let counter = 0;
      async.series(getterFunctions, (err, results) => {
        counter += 1;
        progress(100 * (counter / getterFunctions.length));

        if (err) {
          debug('fetchData: error: ', err);
          return cb(err, data);
        }
        results.forEach(element => {
          if (typeof element === 'object') {
            debug('fetchData: result object: ' + element);
            assign(data.dbRecords, element);
          }
        });
        return cb(null, data);
      });
    },

    processData: function (progress, data, cb) {
      debug('in processData');
      progress(0);
      cb(new Error('not yet implemented'), data);
    },

    uploadData: function (progress, data, cb) {
      debug('in uploadData');
      progress(0);

      // TODO: enable actual upload
      cb(new Error('not yet implemented'), data);
      /*
       var sessionInfo = {
         deviceTags: ['bgm', 'cgm'],
         deviceManufacturers: ['Abbott'],
         deviceModel: DEVICE_MODEL_NAME,
         deviceSerialNumber: data.serialNumber,
         deviceId: data.id,
         start: sundial.utcDateString(),
         timeProcessing: cfg.tzoUtil.type,
         tzName : cfg.timezone,
         version: cfg.version
       };

       cfg.api.upload.toPlatform(data.post_records, sessionInfo, progress, cfg.groupId, (err, result) => {
         progress(100);

         if (err) {
           debug(err);
           debug(result);
           return cb(err, data);
         } else {
           data.cleanup = true;
           return cb(null, data);
         }
       });
       */
    },

    disconnect: function (progress, data, cb) {
      debug('in disconnect');
      hidDevice.removeListeners();
      // Due to an upstream bug in HIDAPI on Windoze, we have to send a command
      // to the device to ensure that the listeners are removed before we disconnect
      // For more details, see https://github.com/node-hid/node-hid/issues/61
      hidDevice.send(FreeStyleLibreProtocol.buildHidPacket(0x00, ''), () => {
        progress(100);
        cb(null, data);
      });
    },

    cleanup: function (progress, data, cb) {
      debug('in cleanup');
      if (!data.disconnect) {
        hidDevice.disconnect(data, () => {
          progress(100);
          data.cleanup = true;
          data.disconnect = true;
          cb(null, data);
        });
      } else {
        progress(100);
      }
    }
  };
};
