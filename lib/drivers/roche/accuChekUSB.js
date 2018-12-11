/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2018, Tidepool Project
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
import usb from 'usb';

import annotate from '../../eventAnnotations';
import common from '../../commonFunctions';
import TZOUtil from '../../TimezoneOffsetUtil';
import structJs from '../../struct';

const struct = structJs();
const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('AccuChekUSBDriver') : console.log;

const APDU_TYPE = {
  ASSOCIATION_REQUEST: 0xE200,
  ASSOCIATION_RESPONSE: 0xE300,
  ASSOCIATION_RELEASE_REQUEST: 0xE400,
  ASSOCIATION_RELEASE_RESPONSE: 0xE500,
  ASSOCIATION_ABORT: 0xE600,
  PRESENTATION_APDU: 0xE700,
};

const EVENT_TYPE = {
  MDC_NOTI_CONFIG: 0x0D1C,
  MDC_NOTI_SEGMENT_DATA: 0x0D21,
};

const ACTION_TYPE = {
  MDC_ACT_SEG_GET_INFO: 0x0C0D,
  MDC_ACT_SEG_GET_ID_LIST: 0x0C1E,
};

const DATA_ADPU = {
  RESPONSE_CONFIRMED_EVENT_REPORT: 0x0201,
  // TODO: add others
};

class AccuChekUSB {
  constructor(cfg) {
    this.cfg = cfg;
    this.usbDevice = this.cfg.deviceComms;
  }

  openDevice(deviceInfo) {
    this.device = usb.findByIds(deviceInfo.vendorId, deviceInfo.productId);
    this.device.open();
    const self = this;

    const ep = 0x03;

    [self.iface] = this.device.interfaces;
    self.iface.claim();

    (async () => {
      const getStatus = {
        requestType: 'standard',
        recipient: 'device',
        request: 0x00,
        value: 0x00,
        index: 0x00,
      };

      console.log('Device:', this.device);

      const result = await this.controlTransferIn(getStatus, 2);
      console.log('get status:', result);

      let incoming = await this.transferIn(ep, 128);
      console.log('Assoc request:', incoming);
      console.log('Decoded:', incoming.toString('hex'));

      await this.transferOut(ep, Buffer.from(AccuChekUSB.buildAssociationResponse()));

      incoming = await this.transferIn(ep, 1024);
      console.log('extended config:', incoming);
      console.log('Decoded:', incoming.toString('hex'));

      let invokeId = incoming.readUInt16BE(6);
      console.log('Invoke Id:', invokeId);

      await this.transferOut(ep, Buffer.from(AccuChekUSB.buildConfigResponse(invokeId)));

      await this.transferOut(ep, Buffer.from(AccuChekUSB.buildMDSAttributeRequest(invokeId)));

      incoming = await this.transferIn(ep, 1024);
      console.log('MDS attribute response:', incoming);
      console.log('Decoded:', incoming.toString('hex'));

      invokeId = incoming.readUInt16BE(6);
      console.log('Invoke Id:', invokeId);

      await this.transferOut(ep, Buffer.from(AccuChekUSB.buildActionRequest(invokeId)));

      incoming = await this.transferIn(ep, 1024);
      console.log('Action request response:', incoming);
      console.log('Decoded:', incoming.toString('hex'));

      invokeId = incoming.readUInt16BE(6);
      console.log('Invoke Id:', invokeId);

      /*
      self.inEndpoint = self.iface.endpoint(0x83);
      self.inEndpoint.startPoll();
      self.inEndpoint.on('data', (data) => {
        console.log('Data:', data.toString('hex'));
      });
      */

      await this.transferOut(ep, AccuChekUSB.buildDataTransferRequest(invokeId));

      incoming = await this.transferIn(ep, 1024);
      console.log('Data transfer request response:', incoming);
      console.log('Decoded:', incoming.toString('hex'));

      incoming = await this.transferIn(ep, 1024);
      console.log('Data:', incoming);
      console.log('Decoded:', incoming.toString('hex'));

      setTimeout(() => {
        this.close(() => {
        });
      }, 3000);
    })().catch((error) => {
      console.log(error);
    });
  }

  static buildAssociationResponse() {
    const buffer = new ArrayBuffer(48);
    const view = new DataView(buffer);

    view.setUint16(0, APDU_TYPE.ASSOCIATION_RESPONSE);
    view.setUint16(2, 44); // Length (excludes initial 4 bytes)
    view.setUint16(4, 0x0003); // accepted-unknown-config
    view.setUint16(6, 20601); // data-proto-id
    view.setUint16(8, 38); // data-proto-info length
    view.setUint32(10, 0x80000002); // protocolVersion
    view.setUint16(14, 0x8000); // encoding-rules = MDER
    view.setUint32(16, 0x80000000); // nomenclatureVersion
    view.setUint32(20, 0); // functionalUnits = normal association
    view.setUint32(24, 0x80000000); // systemType = sys-type-manager
    view.setUint16(28, 8); // system-id length
    view.setUint32(30, 0x12345678); // system-id high
    view.setUint32(34, 0x87654321); // system-id low
    // rest of bytes should always be 0x00 for manager response

    console.log('ASSOC RESPONSE:', common.bytes2hex(buffer));

    return buffer;
  }

  static buildConfigResponse(invokeId) {
    const buffer = new ArrayBuffer(26);
    const view = new DataView(buffer);

    view.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    view.setUint16(2, 22); // length
    view.setUint16(4, 20); // octet stringlength
    view.setUint16(6, invokeId); // invoke-id from config
    view.setUint16(8, 0x0201); // Remote Operation Response | Confirmed Event report
    view.setUint16(10, 14); // length
    view.setUint16(12, 0); // obj-handle = 0
    view.setUint32(14, 0); // currentTime = 0
    view.setUint16(18, EVENT_TYPE.MDC_NOTI_CONFIG); // event-type
    view.setUint16(20, 4); // length
    view.setUint16(22, 0x4000); // config-report-id = extended-config-start
    view.setUint16(24, 0); // config-result = accepted-config

    console.log('CONFIG RESPONSE:', common.bytes2hex(buffer));

    return buffer;
  }

  static buildMDSAttributeRequest(invokeId) {
    const buffer = new ArrayBuffer(18);
    const view = new DataView(buffer);

    view.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    view.setUint16(2, 14); // length
    view.setUint16(4, 12); // octet string length
    view.setUint16(6, invokeId + 1); // to differentiate from previous
    view.setUint16(8, 0x0103); // Remote Operation Invoke | GET
    view.setUint16(10, 6); // length
    view.setUint16(12, 0); // handle 0
    view.setUint16(14, 0); // attribute-id-list.count = 0 (get all attributes)
    view.setUint16(16, 0); // attribute-id-list.length = 0

    console.log('MDS REQUEST:', common.bytes2hex(buffer));

    return buffer;
  }

  static buildActionRequest(invokeId) {
    const buffer = new ArrayBuffer(24);
    const view = new DataView(buffer);

    view.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    view.setUint16(2, 20); // length
    view.setUint16(4, 18); // octet string length
    view.setUint16(6, invokeId + 1); // invoke-id
    view.setUint16(8, 0x0107); // Remote Operation Invoke | Confirmed Action
    view.setUint16(10, 12); // length
    view.setUint16(12, 5); // PM-store object (TODO: get obj-handle of PM-store from config)
    view.setUint16(14, ACTION_TYPE.MDC_ACT_SEG_GET_INFO);
    view.setUint16(16, 6); // length
    view.setUint16(18, 1); // all-segments
    view.setUint16(20, 2); // length
    view.setUint16(22, 0);

    console.log('ACTION:', common.bytes2hex(buffer));

    return buffer;
  }

  static buildDataTransferRequest(invokeId) {
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);

    view.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    view.setUint16(2, 16); // length
    view.setUint16(4, 14); // octet string length
    view.setUint16(6, invokeId + 1); // invoke-id
    view.setUint16(8, 0x0107); // Remote Operation Invoke | Confirmed Action
    view.setUint16(10, 8); // length
    view.setUint16(12, 5); // PM-store object  (TODO)
    view.setUint16(14, 0x0C1C); // u
    view.setUint16(16, 2); // length
    view.setUint16(18, 0x0000); // segment

    console.log('DATA TRANSFER REQUEST:', common.bytes2hex(buffer));

    return buffer;
  }

  static buildDataTransferConfirmation(invokeId, segmentDataResult) {
    const buffer = new ArrayBuffer(30);
    const bytes = new Uint8Array(buffer);

    struct.pack(
      bytes, 0, 'SSSSSSSSS11z',
      APDU_TYPE.PRESENTATION_APDU,
      26, // length
      24, // octet string length
      invokeId + 1,
      DATA_ADPU.RESPONSE_CONFIRMED_EVENT_REPORT,
      18, // length
      5, // PM-store (TODO)
      EVENT_TYPE.MDC_NOTI_SEGMENT_DATA,
      12, // length
      segmentDataResult,
      0x80, // confirmed
    );

    console.log('DATA TRANSFER CONFIRMATION:', common.bytes2hex(buffer));

    return buffer;
  }

  static getRequestType(direction, requestType, recipient) {
    const TYPES = {
      standard: 0x00,
      class: 0x01,
      vendor: 0x02,
      reserved: 0x03,
    };

    const RECIPIENTS = {
      device: 0x00,
      interface: 0x01,
      endpoint: 0x02,
      other: 0x03,
    };

    const DIRECTION = {
      'host-to-device': 0x00,
      'device-to-host': 0x01,
    };

    /* eslint-disable no-bitwise */
    return (DIRECTION[direction] << 7) || (TYPES[requestType] << 5) || RECIPIENTS[recipient];
  }

  controlTransfer(direction, transfer, dataOrLength) {
    return new Promise((resolve, reject) => {
      this.device.controlTransfer(
        AccuChekUSB.getRequestType(
          direction,
          transfer.requestType,
          transfer.recipient,
        ),
        transfer.request, transfer.value, transfer.index, dataOrLength,
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(data);
        },
      );
    });
  }

  controlTransferOut(transfer, data) {
    return this.controlTransfer('host-to-device', transfer, data != null ? data : Buffer.alloc(0));
  }

  controlTransferIn(transfer, length) {
    return this.controlTransfer('device-to-host', transfer, length);
  }

  transferIn(endpoint, length) {
    return new Promise((resolve, reject) => {
      this.iface.endpoint(endpoint | 0x80).transfer(length, (err, result) => {
        if (err) {
          console.log('transferIn Error:', err);
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  transferOut(endpoint, data) {
    return new Promise((resolve, reject) => {
      this.iface.endpoint(endpoint).transfer(data, (err) => {
        if (err) {
          console.log('transferOut Error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      this.iface.release(true, () => {
        this.device.close();
        resolve();
      });
    });
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  cfg.deviceTags = ['bgm'];
  const driver = new AccuChekUSB(cfg);

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
      driver.openDevice(data.deviceInfo, (err, result) => {
        if (err) {
          data.disconnect = true;
          debug('Error:', err);
          cb(err, null);
        } else {
          console.log('Result:', result);
          return cb(null, result);
        }
      });
    },

    getConfigInfo(progress, data, cb) {
      debug('in getConfigInfo', data);
      progress(0);

      (async () => {
        cb();
      })().catch((error) => {
        debug('Error in getConfigInfo: ', error);
        cb(error, null);
      });
    },

    async fetchData(progress, data, cb) {
      debug('in fetchData', data);
      cb();
    },

    processData(progress, data, cb) {
      progress(0);
      cfg.builder.setDefaults({ deviceId: data.deviceInfo.deviceId });
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
        deviceManufacturers: ['Trividia Health'],
        deviceModel: cfg.deviceInfo.modelName,
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
      cfg.deviceComms.removeListeners();
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
