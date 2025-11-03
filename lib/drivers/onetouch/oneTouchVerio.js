/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2017, Tidepool Project
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

/* eslint-disable max-classes-per-file */
/* global chrome */

import { assign, clone, invert } from 'lodash';
import sundial from 'sundial';
import os from 'os';
import semver from 'semver';
import { ipcRenderer } from '../../../app/utils/ipc.cjs';
import TZOUtil from '../../TimezoneOffsetUtil';
import annotate from '../../eventAnnotations';
import crc from '../../crc';
import common from '../../commonFunctions';
import env from '../../../app/utils/env';

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('OneTouchVerio') : console.log;

const USB_BULK_BLOCKSIZE = 512;
const LINK_LAYER_HEADER_LENGTH = 3;
const LINK_LAYER_CRC_LENGTH = 2;
const STX = 0x02;
const ETX = 0x03;
const RESPONSE_OK = 0x06;
const APPLICATION_LAYER_HEADER_LENGTH = 2;
const WSTRING_ZERO_TERMINATOR_LENGTH = 2;
const LBA_NUMBER = {
  GENERAL: 3,
  PARAMETER: 4,
};
const BLOCKDEVICE_BLOCKSIZE = 512;
const BLOCKDEVICE_SIGNATURE = 'LIFESCAN   FAT16';
const SERVICE_ID = 0x04;
const QUERY_TYPE = {
  serialNumber: 0x00,
  deviceModel: 0x01,
  softwareVersion: 0x02,
  unknown: 0x03,
  dateFormat: 0x04,
  timeFormat: 0x05,
  vendorUrl: 0x07,
  languages: 0x09,
};
const QUERY_NAME = invert(QUERY_TYPE);
const PARAMETER_TYPE = {
  timeFormat: 0x00,
  dateFormat: 0x02,
  displayUnit: 0x04,
};
const PARAMETER_NAME = invert(PARAMETER_TYPE);
const UNIT_OF_MEASURE = [
  'mg/dL',
  'mmol/L',
];
const TIMESTAMP_EPOCH = 946684800; // 2000-01-01T00:00:00+00:00

const GLUCOSE_LO = 20;
const GLUCOSE_HI = 600;

class NativeMessaging {
  constructor() {
    this.extensionId = 'nejgoemnddedidafdoppamlbijokiahb';
  }

  // eslint-disable-next-line consistent-return
  openDevice(deviceInfo, callback) {
    if (!chrome.runtime) {
      return callback(new Error('Uploader Helper extension not installed.'));
    }

    chrome.runtime.sendMessage(this.extensionId, { command: 'getAppVersion' }, (version) => {
      debug('App version:', version?.details);

      chrome.runtime.sendMessage(this.extensionId, { command: 'openDevice' }, (response) => {
        debug('Response from extension:', response);
        if (response.msgType === 'error') {
          callback(new Error(response.details));
        } else {
          callback(null);
        }
      });
    });
  }

  closeDevice(callback) {
    chrome.runtime.sendMessage(this.extensionId, { command: 'closeDevice' }, (response) => {
      debug('Closed:', response);
      if (callback) {
        return callback();
      }
      return null;
    });
  }

  checkDevice(callback) {
    chrome.runtime.sendMessage(this.extensionId, { command: 'checkDevice' }, (response) => {
      debug('Response:', response);

      if (response.msgType === 'data') {
        // make very sure this is the device we are looking for
        if (response.details !== BLOCKDEVICE_SIGNATURE) {
          this.closeDevice();
          return callback(new Error('Did not find device signature'));
        }
        return callback(null);
      }
      return callback(new Error(response.details));
    });
  }

  retrieveData(lbaNumber, requestData, callback) {
    const seekOffset = lbaNumber * BLOCKDEVICE_BLOCKSIZE;

    chrome.runtime.sendMessage(this.extensionId, { command: 'retrieveData', request: Array.from(requestData), seekOffset }, (response) => {
      if (response.msgType === 'data') {
        callback(null, Buffer.from(response.details));
      } else {
        callback(new Error(response.details));
      }
    });
  }
}

class ElectronMessaging {
  constructor() {
    this.callback = null;
    this.opened = false;

    // Remove any existing listeners to prevent duplicates
    ipcRenderer.removeAllListeners('native-reply');

    // eslint-disable-next-line consistent-return
    ipcRenderer.on('native-reply', (event, response) => {
      switch (response.msgType) {
        case 'version':
          debug('App version: ', response.details);
          this.sendToNative({ command: 'openDevice' });
          break;
        case 'success':
          debug('details:', response.details);
          return this.callback(null);
        case 'info':
          debug(response.details);
          if (response.details === 'Closing device') {
            return this.callback(null);
          }
          break;
        case 'data':
          if (this.opened) {
            return this.callback(null, Buffer.from(response.details));
          }

          if (response.details !== BLOCKDEVICE_SIGNATURE) {
            this.closeDevice();
            return this.callback(new Error('Did not find device signature'));
          }

          this.opened = true;
          return this.callback(null);
        case 'error':
          debug('Error:', response.details);
          return this.callback(new Error(response.details));
        default:
          debug('Unknown message received');
          return this.callback(new Error(response.details));
      }
    });
  }

  sendToNative(msg, callback) {
    ipcRenderer.send('native-message', msg);
    if (callback !== undefined) {
      this.callback = callback;
    }
  }

  openDevice(deviceInfo, callback) {
    // eslint-disable-next-line consistent-return
    (async () => {
      // >= macOS Catalina
      if (os.platform() === 'darwin' && semver.compare(os.release(), '19.0.0') >= 0) {
        // eslint-disable-next-line global-require
        const drivelist = require('drivelist');
        const drives = await drivelist.list();

        this.devicePath = null;
        debug('Drives:', JSON.stringify(drives, null, 4));
        // eslint-disable-next-line no-restricted-syntax
        for (const drive of drives) {
          if (drive.description && drive.description.includes('LifeScan') && !drive.system) {
            this.devicePath = drive.raw;
          }
        }
        if (this.devicePath) {
          // eslint-disable-next-line global-require
          const { sudo } = require('./catalina-sudo/sudo');
          const cmd = `chmod a+rw "${this.devicePath}"`;
          const result = await sudo(cmd);
          debug('Result of sudo command:', result);
        } else {
          return callback('No LifeScan devices found');
        }
      }
    })().then(() => {
      this.sendToNative({ command: 'getAppVersion' }, callback);
    }).catch((error) => {
      debug('Error in openDevice: ', error);
      return callback(error, null);
    });
  }

  closeDevice(callback) {
    this.sendToNative({ command: 'closeDevice' }, callback);
  }

  checkDevice(callback) {
    this.sendToNative({ command: 'checkDevice' }, callback);
  }

  retrieveData(lbaNumber, requestData, callback) {
    const seekOffset = lbaNumber * BLOCKDEVICE_BLOCKSIZE;
    this.sendToNative({ command: 'retrieveData', request: Array.from(requestData), seekOffset }, callback);
  }
}

class OneTouchVerio {
  constructor(cfg) {
    this.cfg = cfg;
    if (env.browser) {
      this.communication = new NativeMessaging();
    } else {
      this.communication = new ElectronMessaging();
    }
  }

  openDevice(deviceInfo, callback) {
    return this.communication.openDevice(deviceInfo, callback);
  }

  closeDevice(callback) {
    return this.communication.closeDevice(callback);
  }

  checkDevice(callback) {
    return this.communication.checkDevice(callback);
  }

  static parseApplicationLayer(data, callback) {
    const responseCode = data[1];
    if (responseCode !== RESPONSE_OK) {
      throw new Error(`parseApplicationLayer: Invalid response code: ${responseCode}`);
    }
    const commandData = data.slice(APPLICATION_LAYER_HEADER_LENGTH);
    if (callback) {
      callback(commandData);
    }
  }

  static parseLinkLayer(data, callback) {
    if (data.length !== USB_BULK_BLOCKSIZE) {
      throw new Error(`parseLinkLayer: Invalid data blocksize: ${data.length}`);
    }
    if (data[0] !== STX) {
      throw new Error(`parseLinkLayer: Invalid start byte: ${data[0]}`);
    }
    const length = data.readUInt16LE(1);
    if (data[length - 1 - LINK_LAYER_CRC_LENGTH] !== ETX) {
      throw new Error(`parseLinkLayer: Invalid end byte: ${data[length - 1 - LINK_LAYER_CRC_LENGTH]}`);
    }
    const crc16 = data.readUInt16LE(length - LINK_LAYER_CRC_LENGTH);
    const calculatedCrc16 =
      crc.calcCRC_A(data.slice(0, length - LINK_LAYER_CRC_LENGTH), length - LINK_LAYER_CRC_LENGTH);
    if (crc16 !== calculatedCrc16) {
      throw new Error(`parseLinkLayer: CRC error: ${crc16} != ${calculatedCrc16}`);
    }
    const applicationData =
      data.slice(LINK_LAYER_HEADER_LENGTH, length - 1 - LINK_LAYER_CRC_LENGTH);
    callback(applicationData);
  }

  retrieveData(lbaNumber, linkLayerRequestData, callback) {
    this.communication.retrieveData(lbaNumber, linkLayerRequestData, (err, linkResponseData) => {
      if (err) {
        callback(err, null);
      } else {
        this.constructor.parseLinkLayer(linkResponseData, (applicationResponseData) => {
          this.constructor.parseApplicationLayer(applicationResponseData, (commandData) => {
            callback(null, commandData);
          });
        });
      }
    });
  }

  static buildLinkLayerFrame(applicationData) {
    const length = LINK_LAYER_HEADER_LENGTH + applicationData.length + 1 + LINK_LAYER_CRC_LENGTH;
    const data = Buffer.alloc(length);
    data[0] = STX;
    data.writeUInt16LE(length, 1);
    applicationData.copy(data, LINK_LAYER_HEADER_LENGTH);
    data[length - 1 - LINK_LAYER_CRC_LENGTH] = ETX;
    const calculatedCrc16 =
      crc.calcCRC_A(data.slice(0, length - LINK_LAYER_CRC_LENGTH), length - LINK_LAYER_CRC_LENGTH);
    data.writeUInt16LE(calculatedCrc16, length - LINK_LAYER_CRC_LENGTH);
    return data;
  }

  retrieveQueryData(queryType, callback) {
    const linkRequestData = Buffer.alloc(USB_BULK_BLOCKSIZE);
    const applicationData = Buffer.from([SERVICE_ID, 0xe6, 0x02, queryType]);
    this.constructor.buildLinkLayerFrame(applicationData).copy(linkRequestData);
    this.retrieveData(LBA_NUMBER.GENERAL, linkRequestData, (err, commandData) => {
      if (err) {
        return callback(err);
      }
      const responseString = commandData
        .slice(0, commandData.length - WSTRING_ZERO_TERMINATOR_LENGTH).toString('utf16le');
      debug('parseQueryResponse:', QUERY_NAME[queryType], ':', responseString);
      const data = {};
      data[QUERY_NAME[queryType]] = responseString;
      return callback(null, data);
    });
  }

  retrieveParameterData(parameterType, callback) {
    const linkRequestData = Buffer.alloc(USB_BULK_BLOCKSIZE);
    const applicationData = Buffer.from([SERVICE_ID, parameterType, 0x00]);
    this.constructor.buildLinkLayerFrame(applicationData).copy(linkRequestData);
    this.retrieveData(LBA_NUMBER.PARAMETER, linkRequestData, (err, commandData) => {
      if (err) {
        return callback(err);
      }
      let responseString;
      if (parameterType === PARAMETER_TYPE.displayUnit) {
        responseString = UNIT_OF_MEASURE[commandData.readUInt32LE()];
      } else {
        responseString = commandData
          .slice(0, commandData.length - WSTRING_ZERO_TERMINATOR_LENGTH).toString('utf16le');
      }
      debug('parseParameterResponse:', PARAMETER_NAME[parameterType], ':', responseString);
      const data = {};
      data[PARAMETER_NAME[parameterType]] = responseString;
      return callback(null, data);
    });
  }

  retrieveRTCData(callback) {
    const linkRequestData = Buffer.alloc(USB_BULK_BLOCKSIZE);
    const applicationData = Buffer.from([SERVICE_ID, 0x20, 0x02]);
    this.constructor.buildLinkLayerFrame(applicationData).copy(linkRequestData);
    this.retrieveData(LBA_NUMBER.GENERAL, linkRequestData, (err, commandData) => {
      if (err) {
        return callback(err);
      }
      const timestamp = commandData.readUInt32LE(0);
      debug('parseRTCResponse:', timestamp);
      if (timestamp) {
        return callback(null, this.constructor.getDate(timestamp));
      }
      return callback(null);
    });
  }

  setRTCData(timestamp, callback) {
    const linkRequestData = Buffer.alloc(USB_BULK_BLOCKSIZE);
    const applicationData = Buffer.from([SERVICE_ID, 0x20, 0x01, 0x00, 0x00, 0x00, 0x00]);
    applicationData.writeUInt32LE(timestamp, 3);
    this.constructor.buildLinkLayerFrame(applicationData).copy(linkRequestData);
    this.retrieveData(LBA_NUMBER.GENERAL, linkRequestData, (err) => {
      callback(err);
    });
  }

  retrieveRecordCount(callback) {
    const linkRequestData = Buffer.alloc(USB_BULK_BLOCKSIZE);
    const applicationData = Buffer.from([SERVICE_ID, 0x27, 0x00]);
    this.constructor.buildLinkLayerFrame(applicationData).copy(linkRequestData);
    this.retrieveData(LBA_NUMBER.GENERAL, linkRequestData, (err, commandData) => {
      if (err) {
        return callback(err);
      }
      const recordCount = commandData.readUInt16LE(0);
      debug('retrieveRecordCount:', recordCount);
      const data = {};
      data.recordCount = recordCount;
      return callback(null, data);
    });
  }

  static getDate(timestamp) {
    return new Date((TIMESTAMP_EPOCH + timestamp) * 1000);
  }

  retrieveRecord(recordIndex, callback) {
    const linkRequestData = Buffer.alloc(USB_BULK_BLOCKSIZE);
    const applicationData = Buffer.from([SERVICE_ID, 0x31, 0x02, 0x00, 0x00, 0x00]);
    applicationData.writeUInt16LE(recordIndex, 3);
    this.constructor.buildLinkLayerFrame(applicationData).copy(linkRequestData);
    this.retrieveData(LBA_NUMBER.GENERAL, linkRequestData, (err, commandData) => {
      if (err) {
        return callback(err);
      }
      const data = {};
      debug('Raw result:', commandData.toString('hex'));
      data.globalRecordIndex = commandData.readUInt16LE(3);
      data.timestamp = this.constructor.getDate(commandData.readUInt32LE(5));
      data.glucoseValueMgdl = commandData.readUInt16LE(9);
      // eslint-disable-next-line no-bitwise
      data.controlSolution = !!(0x01 & commandData.readUInt8(2));
      debug('retrieveRecord:', data);
      return callback(null, data);
    });
  }

  retrieveRecords(recordCount, callback) {
    const records = [];
    const cb = (error, data) => {
      records.push(data);
      if (records.length < recordCount) {
        this.retrieveRecord(records.length, cb);
      } else {
        callback(null, records);
      }
    };
    this.retrieveRecord(records.length, cb);
  }

  static addOutOfRangeAnnotation(recordBuilder, low, high, step, type) {
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

  processData(data) {
    const postRecords = [];
    data.records.forEach((record) => {
      if (!record.controlSolution) {
        // values are always in 'mg/dL', independent of the unitOfMeasure setting
        const recordBuilder = this.cfg.builder.makeSMBG()
          .with_value(record.glucoseValueMgdl)
          .with_units('mg/dL')
          .with_deviceTime(sundial.formatDeviceTime(record.timestamp))
          .set('index', record.globalRecordIndex);

        this.cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.timestamp);

        this.constructor.addOutOfRangeAnnotation(recordBuilder, GLUCOSE_LO, GLUCOSE_HI, 1, 'bg');

        const postRecord = recordBuilder.done();
        delete postRecord.index;
        postRecords.push(postRecord);
      }
    });
    return postRecords;
  }
}

export default function (config) {
  const cfg = clone(config);
  const driver = new OneTouchVerio(cfg);

  // With no date & time settings changes available,
  // timezone is applied across-the-board
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);
  cfg.deviceInfo = {};
  assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['LifeScan'],
  });

  return {
    /* eslint no-param-reassign:
       [ "error", { "props": true, "ignorePropertyModificationsFor": ["data"] } ] */

    detect(deviceInfo, cb) {
      cb(null, deviceInfo);
    },

    setup(deviceInfo, progress, cb) {
      progress(100);
      return cb(null, { deviceInfo });
    },

    connect(progress, data, cb) {
      progress(0);
      driver.openDevice(data.deviceInfo, (err) => {
        if (err) {
          debug('Cannot open device:', err);
          cb(err, null);
          return;
        }
        progress(20);
        driver.checkDevice((err2) => {
          if (err2) {
            cb(err2, null);
            return;
          }
          data.disconnect = false;
          progress(100);
          cb(null, data);
        });
      });
    },

    getConfigInfo(progress, data, cb) {
      progress(0);
      const querySerial = QUERY_TYPE.serialNumber;
      driver.retrieveQueryData(querySerial, (err, serialNumber) => {
        if (err) {
          cb(err, null);
          return;
        }
        assign(cfg.deviceInfo, serialNumber);

        const queryModel = QUERY_TYPE.deviceModel;
        driver.retrieveQueryData(queryModel, (err2, deviceModel) => {
          if (err2) {
            cb(err2, null);
            return;
          }

          assign(cfg.deviceInfo, { model: deviceModel.deviceModel });
          data.deviceModel = cfg.deviceInfo.model; // for metrics
          progress(100);

          cfg.deviceInfo.deviceId =
            `${cfg.deviceInfo.model.replace(/\s+/g, '')}-${cfg.deviceInfo.serialNumber}`;

          driver.retrieveRTCData((error, rtcTime) => {
            if (error) {
              cb(error);
            } else {
              cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(rtcTime);
              common.checkDeviceTime(cfg, (timeErr, serverTime) => {
                if (timeErr) {
                  if (timeErr === 'updateTime') {
                    cfg.deviceInfo.annotations = 'wrong-device-time';
                    const newDateTime = ((serverTime.getTime() / 1000) +
                      (sundial.getOffsetFromZone(serverTime, cfg.timezone) * 60)) -
                      TIMESTAMP_EPOCH;
                    driver.setRTCData(newDateTime, () => {
                      cb(null, data);
                    });
                  } else {
                    driver.closeDevice(() => {
                      cb(timeErr, data);
                    });
                  }
                } else {
                  cb(null, data);
                }
              });
            }
          });
        });
      });
    },

    fetchData(progress, data, cb) {
      progress(0);
      driver.retrieveRecordCount((err1, resultData1) => {
        if (err1) {
          cb(err1, null);
          return;
        }
        debug('fetchData: recordCount: ', resultData1.recordCount);
        if (resultData1.recordCount === 0) {
          data.records = [];
          const err = new Error('No records to upload');
          err.code = 'E_NO_RECORDS';
          cb(err, null);
          return;
        }

        driver.retrieveRecords(resultData1.recordCount, (err2, records) => {
          if (err2) {
            cb(err2, null);
            return;
          }
          data.records = records;
          cb(null, data);
        });
      });
    },

    processData(progress, data, cb) {
      debug('processData: num records:', data.records.length);
      progress(0);

      cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });

      data.postRecords = driver.processData(data);
      data.processData = true;

      progress(100);
      cb(null, data);
    },

    uploadData(progress, data, cb) {
      debug('uploadData: num post records:', data.postRecords.length);
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

      if (cfg.deviceInfo.annotations) {
        annotate.annotateEvent(sessionInfo, cfg.deviceInfo.annotations);
      }

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
      progress(0);
      driver.closeDevice(() => {
        progress(100);
        cb(null, data);
      });
    },

    cleanup(progress, data, cb) {
      progress(100);
      cb(null, data);
    },
  };
}
