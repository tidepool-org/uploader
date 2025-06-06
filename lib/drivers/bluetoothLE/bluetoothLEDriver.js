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
import env from '../../../app/utils/env';
import structJs from '../../struct';
import common from '../../commonFunctions';
import uploadDataPeriod from '../../../app/utils/uploadDataPeriod';
import api from '../../core/api';
import getModelName from '../roche/models';

const struct = structJs();

let remote;
if(env.electron){
  remote = require('@electron/remote');
}

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('BluetoothLEDriver') : console.log;

const KETONE_VALUE_FACTOR = 10;
const KETONE_HI = 8.0;

module.exports = (config) => {
  const cfg = _.clone(config);
  let handleData = null;
  let handleNumberOfRecords = null;
  let handleProgress = null;
  let handleTimeSync = null;
  let foraDriver = null;
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
       _.assign(cfg.deviceInfo , await cfg.deviceComms.ble.getDeviceInfo());
     })().then(() => {
       if (!cfg.deviceInfo.name.startsWith('CareSens') &&
           !cfg.deviceInfo.name.startsWith('ReliOn 2395') &&
           !cfg.deviceInfo.name.startsWith('ReliOn 0015') &&
           !cfg.deviceInfo.name.startsWith('TNG VOICE') &&
           !cfg.deviceInfo.name.startsWith('meter+')) {
         return cb (new Error('We don\'t currently support this meter.'));
       }

       if (cfg.deviceInfo.name.startsWith('TNG')) {
         // Fora meters don't set the BLE manufacturer string
         cfg.deviceInfo.manufacturers = ['ForaCare'];

         if (cfg.deviceInfo.model === 'Model Number') {
           // Some Fora TN'G Voice don't report their model number
           cfg.deviceInfo.model = cfg.deviceInfo.name.split(' ').join('');
         }

         try {
           // eslint-disable-next-line global-require, import/no-unresolved, import/extensions
           foraDriver = require('../fora/foraDriver');
         } catch (e) {
           debug('ForaCare driver is only available to Tidepool developers.');
         }
       } else {
         foraDriver = null;
       }

       const regex = /\b [a-fA-F0-9]{4}\b$/;
       if (regex.test(cfg.deviceInfo.name)) {
        // remove the serial number suffix
        data.deviceModel = cfg.deviceInfo.name.slice(0, -5);
       } else {
        data.deviceModel = cfg.deviceInfo.name; // for metrics
       }

       cfg.deviceTags = ['bgm'];
       cfg.deviceInfo.deviceId = `${[cfg.deviceInfo.manufacturers]}-${cfg.deviceInfo.model}`;

       if(cfg.deviceInfo.name.startsWith('meter+')) {
         cfg.deviceInfo.serial = cfg.deviceInfo.model + cfg.deviceInfo.name.slice(6);
         cfg.deviceInfo.deviceId += `-${cfg.deviceInfo.serial}`;
         data.deviceModel = getModelName(cfg.deviceInfo.model);
       } else if(env.electron){
         cfg.deviceInfo.deviceId += `-${remote.getGlobal('bluetoothDeviceId')}`;
       } else {
         cfg.deviceInfo.deviceId += `-${cfg.deviceComms.ble.device.id}`;
       }

       cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });

       if (cfg.deviceInfo.name.startsWith('CareSens') ||
           cfg.deviceInfo.name.startsWith('ReliOn 2395') ||
           cfg.deviceInfo.name.startsWith('ReliOn 0015')) {

            let abortTimer = null;

            (async () => {
              try {
                cfg.deviceComms.ble.customService = await cfg.deviceComms.ble.server.getPrimaryService(0xFFF0);
                cfg.deviceComms.ble.customCharacteristic = await cfg.deviceComms.ble.customService.getCharacteristic(0xFFF1);
              } catch (err) {
                if (err.name === 'NotFoundError') {
                  // use v1.5 custom service instead
                  cfg.deviceComms.ble.customService = await cfg.deviceComms.ble.server.getPrimaryService('c4dea010-5a9d-11e9-8647-d663bd873d93');
                  cfg.deviceComms.ble.customCharacteristic = await cfg.deviceComms.ble.customService.getCharacteristic('c4dea3bc-5a9d-11e9-8647-d663bd873d93');
                } else {
                  return cb(err);
                }
              }

              handleTimeSync = (event) => {
                clearTimeout(abortTimer);
                const { value } = event.target;
                const fields = struct.unpack(new Uint8Array(value.buffer), 0, '....sbbbbb', ['year', 'month', 'day', 'hours', 'minutes', 'seconds']);
                cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(sundial.buildTimestamp(fields));
                debug(`Time on device was previously ${cfg.deviceInfo.deviceTime}`);

                common.checkDeviceTime(cfg, async (timeErr, serverTime) => {
                  if (timeErr) {
                    const buf = new ArrayBuffer(11);
                    const bytes = new Uint8Array(buf);
                    let ctr = struct.pack(bytes, 0, 'bbbbsbbbbb',
                      0xC0, 0x03, 0x01, 0x00,
                      sundial.formatInTimezone(serverTime, cfg.timezone, 'YYYY'),
                      sundial.formatInTimezone(serverTime, cfg.timezone, 'M'),
                      sundial.formatInTimezone(serverTime, cfg.timezone, 'D'),
                      sundial.formatInTimezone(serverTime, cfg.timezone, 'H'),
                      sundial.formatInTimezone(serverTime, cfg.timezone, 'm'),
                      sundial.formatInTimezone(serverTime, cfg.timezone, 's')
                    );

                    try {
                      // we don't wait for a confirmation, as it takes too long for the
                      // meter to reply with the updated time
                      await cfg.deviceComms.ble.customCharacteristic.writeValue(bytes);  // set time
                      return cb(null, data);
                    } catch (err) {
                      return cb(err, null);
                    }
                  } else {
                    return cb(null, data);
                  }
                });
              };

              cfg.deviceComms.ble.customCharacteristic.addEventListener('characteristicvaluechanged', handleTimeSync, { once: true });
              await cfg.deviceComms.ble.customCharacteristic.startNotifications();
              debug('Added time sync listener.');

              abortTimer = setTimeout(() => {
                debug('Time sync failed');
                return cb(null, data); // not throwing error if time sync fails
              }, 5000);

              const buf = new ArrayBuffer(11);
              const bytes = new Uint8Array(buf);
              let ctr = struct.pack(bytes, 0, 'bbbbsbbbbb', 0xC0, 0x03, 0x01, 0x00, 0, 0, 0, 0, 0, 0); // get time

              await cfg.deviceComms.ble.customCharacteristic.writeValue(bytes);
            })().catch((error) => {
              debug('Error in time sync: ', error);
              return cb(error, null);
            });
       } else {
        return cb(null, data);
       }
     }).catch((error) => {
       debug('Error in getConfigInfo: ', error);
       return cb(error, null);
     });
   },

   fetchData(progress, data, cb) {
     debug('in fetchData', data);
     let retryTimer = null;

     api.getMostRecentUploadRecord(cfg.groupId, cfg.deviceInfo.deviceId, function(err, lastUpload) {
        if (err) {
          return cb(err);
        }

        if (!foraDriver) { // ForaCare meters do not handle delta uploads correctly
          data.lastEndPosition = _.get(lastUpload, 'client.private.delta.lastEndPosition', null);
        }

        if (data.lastEndPosition) {
          debug('Last record read was', data.lastEndPosition, ', starting from there');
        }

         const abortTimer = setTimeout(() => {
           debug('TIMEOUT');
           return cb('Timeout error. Did the meter pair succesfully?', null);
         }, 30000); // give enough time to confirm pairing on meter

         handleData = (result) => {
           debug('Records:', result.detail);
           _.assign(data, result.detail);
           return cb(null, data);
         };
         cfg.deviceComms.ble.addEventListener('data', handleData, { once: true });

         handleNumberOfRecords = async (result) => {
           debug('Number of records:', result.detail);
           data.numberOfRecords = result.detail;
           clearTimeout(abortTimer);
           clearTimeout(retryTimer);
           setTimeout(async () => {
             if (data.lastEndPosition && uploadDataPeriod.periodGlobal === uploadDataPeriod.PERIODS.DELTA) {
                 debug('Getting new records since last upload..');
                 await cfg.deviceComms.ble.getDeltaRecords(data.lastEndPosition + 1);
             } else {
                 debug('Getting all records..');
                 await cfg.deviceComms.ble.getAllRecords();

                 retryTimer = setTimeout(async () => {
                   debug('Retrying..');
                   try{
                     await cfg.deviceComms.ble.getAllRecords();
                   } catch(err) {
                     console.log('Retry failed:', err);
                   }
                 }, 5000);
             }
           }, 500); // wait 500ms to prevent "GATT operation already in progress" error
         };

         handleProgress = async (result) => {
           clearTimeout(retryTimer);
           const value = Math.min(result.detail / data.numberOfRecords * 100, 100);
           progress(value);
         };

         cfg.deviceComms.ble.addEventListener('numberOfRecords', handleNumberOfRecords, { once: true });
         cfg.deviceComms.ble.addEventListener('sequenceNumber', handleProgress);

        setTimeout(async () => {

          retryTimer = setTimeout(async () => {
            debug('Retrying..');
            try{
              await cfg.deviceComms.ble.getNumberOfRecords();
            } catch(err) {
              console.log('Retry failed:', err);
            }
          }, 1000);

          try {

            if (data.lastEndPosition && uploadDataPeriod.periodGlobal === uploadDataPeriod.PERIODS.DELTA) {
                debug('Getting number of new records..');
                await cfg.deviceComms.ble.getDeltaNumberOfRecords(data.lastEndPosition + 1);
            } else {
                debug('Getting number of records on device..');
                await cfg.deviceComms.ble.getNumberOfRecords();
            }
          } catch (error) {
            debug('Error:', error);
            clearTimeout(abortTimer);
            clearTimeout(retryTimer);
            return cb(error, null);
          }
        }, 500); // wait 500ms to give meter a moment to set date/time
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
           throw new Error ('Could not find context of measurement');
         }
       }

       if (isKetone) {
         // According to spec, HI > 8 mmol/L
         // there is no LO as values are between 0 and 8 mmol/L
         if (record.value > (KETONE_HI * KETONE_VALUE_FACTOR) ) {
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
             value: 'high',
           };
         } else if (record.value < 10) {
           record.value = 9; // set value below lowest known threshold
           annotation = {
             code: 'bg/out-of-range',
             value: 'low',
           };
         }
       }

       if (record.type !== 10 &&  // check that it's not control solution
            record.type !== 4) {  // Accu-Chek meters record unlisted values with type 4
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

         if (cfg.deviceInfo.manufacturers.includes('Roche')) {
           // The roche/accuChekUSB.js driver does not record seconds, so to prevent
           // duplicates we also remove seconds from the Bluetooth uploads for Roche
           // meters (even the one branded as ReliOn Platinum)
           record.timestamp.setSeconds(0);
         }

         postRecord
            .with_deviceTime(sundial.formatDeviceTime(record.timestamp))
            .set('index', record.seqNum);

         if (annotation) {
           annotate.annotateEvent(postRecord, annotation);
           // BG treshold values are not provided, and we know there are meters
           // with different thresholds, e.g. Accu-chek Instant range is 10-600mg/dL
           // vs 20-600mg/dL for other meters, so we annotate that threshold is unknown
           annotate.annotateEvent(postRecord, {
             code: 'bg/unknown-value',
           });
         }

         cfg.tzoUtil.fillInUTCInfo(postRecord, record.timestamp);
         delete postRecord.index;

         data.post_records.push(postRecord.done());
         data.lastRead = record.seqNum;
       }
     });

     debug('POST records:', data.post_records);

     if (data.post_records.length === 0) {
        const err = new Error('No records');
        if (data.lastEndPosition > 0) {
          debug('Device has no new records to upload');
          err.code = 'E_NO_NEW_RECORDS';
        } else {
          debug('Device has no records to upload');
          err.code = 'E_NO_RECORDS';
        }
       return cb(err, null);
     }

     if (foraDriver) {
       // Fora TN'G Voice uses a proprietary method to set device time
       (async () => {
         await foraDriver.init(cfg, data, cb);

         cfg.abortTimer = setTimeout(() => {
           debug('Time sync failed');
           return cb(null, data); // not throwing error if time sync fails
         }, 5000);

         await foraDriver.syncDateTime(cfg);

       })().catch((error) => {
         debug('Error in time sync: ', error);
         return cb(error, null);
       });
     } else {
       progress(100);
       return cb(null, data);
     }
   },

   uploadData(progress, data, cb) {
     progress(0);

     if (cfg.deviceInfo.name.startsWith('TNG')) {
       // When Fora TN'G Voice meters are full (450 records), they add a bogus
       // HI reading in 2037 to the end, so just use the first 450 records
       data.post_records = data.post_records.slice(0, 450);
       cfg.deviceInfo.manufacturers = ['ForaCare'];
     }

     const sessionInfo = {
       delta: { lastEndPosition: data.lastRead },
       deviceTags: cfg.deviceTags,
       deviceManufacturers: cfg.deviceInfo.manufacturers,
       deviceModel: data.deviceModel,
       deviceId: cfg.deviceInfo.deviceId,
       deviceSerialNumber: cfg.deviceInfo.serial,
       start: sundial.utcDateString(),
       timeProcessing: cfg.tzoUtil.type,
       tzName: cfg.timezone,
       version: cfg.version,
     };

     if(cfg.deviceInfo.name.startsWith('meter+')) {
       // For Roche meters, we want to store the model number in the upload
       // record instead of the model name, to match the USB version
       sessionInfo.deviceModel = cfg.deviceInfo.model;
     }

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
       cfg.deviceComms.ble.removeEventListener('data', handleData);
       cfg.deviceComms.ble.removeEventListener('numberOfRecords', handleNumberOfRecords);
       cfg.deviceComms.ble.removeEventListener('sequenceNumber', handleProgress);
       if (cfg.deviceComms.ble.customCharacteristic) {
        try {
          cfg.deviceComms.ble.customCharacteristic.removeEventListener('characteristicvaluechanged', handleTimeSync);
          await cfg.deviceComms.ble.customCharacteristic.stopNotifications();
          cfg.deviceComms.ble.customCharacteristic = null;
        } catch (err) {
          debug('Could not stop custom characteristic.');
        }
       }
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
