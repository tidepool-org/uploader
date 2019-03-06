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

import annotate from '../../eventAnnotations';
import common from '../../commonFunctions';
import TZOUtil from '../../TimezoneOffsetUtil';
import structJs from '../../struct';
import UsbDevice from '../../usbDevice';
import {
  MDC_PART_OBJ,
  DATA_RESPONSE,
  ACTION_TYPE,
  APDU_TYPE,
  DATA_ADPU,
  EVENT_TYPE,
  getObject,
  getAttribute,
  getAttributeList,
  getProductionSpecEntry,
} from './utils';

const struct = structJs();
const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('AccuChekUSBDriver') : console.log;

class AccuChekUSB {
  constructor(cfg) {
    this.cfg = cfg;
  }

  static get TIMEOUT() {
    return 5000;
  }

  async openDevice(deviceInfo, cb) {
    this.usbDevice = new UsbDevice(deviceInfo);
    this.usbDevice.device.open(false); // don't auto-configure
    this.usbDevice.device.reset();

    this.usbDevice.device.setConfiguration(1, async () => {
      if (this.usbDevice.device.interfaces == null) {
        throw new Error('Please unplug device and retry.');
      }

      [this.usbDevice.iface] = this.usbDevice.device.interfaces;
      this.usbDevice.iface.claim();

      /* eslint-disable no-bitwise */
      this.usbDevice.iface.endpoints[0].timeout = AccuChekUSB.TIMEOUT;
      this.ep = this.usbDevice.iface.endpoints[0].address & 0x0F;

      try {
        const getStatus = {
          requestType: 'standard',
          recipient: 'device',
          request: 0x00,
          value: 0x00,
          index: 0x00,
        };

        await this.usbDevice.controlTransferIn(getStatus, 2);
        const incoming = await this.usbDevice.transferIn(this.ep, 128);
        debug('Received association request:', _.toUpper(incoming.toString('hex')));

        await this.usbDevice.transferOut(
          this.ep,
          Buffer.from(AccuChekUSB.buildAssociationResponse()),
        );

        return cb(null);
      } catch (error) {
        if (error.message === 'LIBUSB_TRANSFER_TIMED_OUT') {
          error.code = 'E_UNPLUG_AND_RETRY';
        }
        return cb(error, null);
      }
    });
  }

  async getConfig(data) {
    let incoming = await this.usbDevice.transferIn(this.ep, 1024);
    debug('Received extended config:', _.toUpper(incoming.toString('hex')));
    data.extendedConfig = incoming;

    if (incoming == null) {
      throw Error('Could not retrieve config. Please retry.');
    }

    const pmStoreDetails = getObject(
      incoming,
      MDC_PART_OBJ.MDC_MOC_VMO_PMSTORE,
    );

    if (pmStoreDetails == null) {
      throw Error('Could not parse config. Please retry.');
    }
    data.pmStoreHandle = pmStoreDetails.handle;
    data.numberOfSegments = struct.extractBEShort(
      getAttribute(pmStoreDetails, MDC_PART_OBJ.MDC_ATTR_NUM_SEG),
      0,
    );

    let invokeId = incoming.readUInt16BE(6);
    await this.usbDevice.transferOut(
      this.ep,
      Buffer.from(AccuChekUSB.buildConfigResponse(invokeId)),
    );

    await this.usbDevice.transferOut(
      this.ep,
      Buffer.from(AccuChekUSB.buildMDSAttributeRequest(invokeId)),
    );
    incoming = await this.usbDevice.transferIn(this.ep, 1024);
    debug('Received MDS attribute response:', _.toUpper(incoming.toString('hex')));
    invokeId = incoming.readUInt16BE(6);
    data.deviceDetails = incoming;

    await this.usbDevice.transferOut(
      this.ep,
      Buffer.from(AccuChekUSB.buildActionRequest(invokeId, data.pmStoreHandle)),
    );
    incoming = await this.usbDevice.transferIn(this.ep, 1024);
    debug('Received action request response:', _.toUpper(incoming.toString('hex')));
    data.pmStoreConfig = incoming;

    data.lastInvokeId = incoming.readUInt16BE(6);

    return data;
  }

  async getData(invokeId, pmStoreHandle, cb) {
    const pages = [];
    let done = false;
    const segment = 0;

    try {
      // eslint-disable-next-line no-await-in-loop, these requests need to be sequential
      await this.usbDevice.transferOut(this.ep, AccuChekUSB.buildDataTransferRequest(
        invokeId,
        pmStoreHandle,
        segment,
      ));

      // eslint-disable-next-line no-await-in-loop, these requests need to be sequential
      const incoming = await this.usbDevice.transferIn(this.ep, 1024);
      debug('Received data transfer request response:', _.toUpper(incoming.toString('hex')));

      if (incoming.length === 22 && incoming.readUInt16BE(20)) {
        const dataResponse = incoming.readUInt16BE(20);
        if (dataResponse === 3) {
          debug('Segment was empty');
        } else {
          throw new Error(`Could not retrieve data: ${DATA_RESPONSE[dataResponse]}`);
        }
      } else if (incoming.length < 22 ||
            incoming.readUInt16BE(14) !== ACTION_TYPE.MDC_ACT_SEG_TRIG_XFER) {
        throw new Error('Unexpected response');
      } else {
        while (!done) {
          // eslint-disable-next-line no-await-in-loop, these requests need to be sequential
          const data = await this.usbDevice.transferIn(this.ep, 1024);
          debug('Data:', _.toUpper(data.toString('hex')));
          pages.push(data);

          const dataInvokeId = data.readUInt16BE(6);
          const segmentDataResult = data.slice(22, 32);
          const status = data.readUInt8(32);

          if (status & 0x40) {
            // the second bit of the status field indicates if it's the last one
            done = true;
          }

          // eslint-disable-next-line no-await-in-loop, these requests need to be sequentia
          await this.usbDevice.transferOut(this.ep, AccuChekUSB.buildDataTransferConfirmation(
            dataInvokeId,
            pmStoreHandle,
            segmentDataResult,
          ));
        }
      }
    } catch (error) {
      return cb(error, null);
    }

    return cb(null, pages);
  }

  static parseData(pages) {
    const records = [];

    _.forEach(pages, (page) => {
      let offset = 30;
      const entries = struct.extractBEShort(page, offset);

      for (let i = 0; i < entries; i++) {
        const record = {};
        const timestamp = page.slice(offset + 6, offset + 12).toString('hex');
        record.dateTime = sundial.parseFromFormat(timestamp, 'YYYYMMDDHHmm');
        record.value = page.readUInt16BE(offset + 14);
        record.status = page.readUInt16BE(offset + 16);
        offset += 12;
        records.push(record);
      }
    });

    return records;
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

    debug('Association response:', common.bytes2hex(new Uint8Array(buffer), true));

    return buffer;
  }

  static buildAssociationReleaseRequest() {
    const buffer = Buffer.alloc(6);

    buffer.writeUInt16BE(APDU_TYPE.ASSOCIATION_RELEASE_REQUEST, 0);
    buffer.writeUInt16BE(2, 2); // length  = 2
    buffer.writeUInt16BE(0x0000, 4); // normal

    debug('Association release:', _.toUpper(buffer.toString('hex')));

    return buffer;
  }

  static buildConfigResponse(invokeId) {
    const buffer = new ArrayBuffer(26);
    const view = new DataView(buffer);

    view.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    view.setUint16(2, 22); // length
    view.setUint16(4, 20); // octet stringlength
    view.setUint16(6, invokeId); // invoke-id from config
    view.setUint16(8, DATA_ADPU.RESPONSE_CONFIRMED_EVENT_REPORT);
    view.setUint16(10, 14); // length
    view.setUint16(12, 0); // obj-handle = 0
    view.setUint32(14, 0); // currentTime = 0
    view.setUint16(18, EVENT_TYPE.MDC_NOTI_CONFIG); // event-type
    view.setUint16(20, 4); // length
    view.setUint16(22, 0x4000); // config-report-id = extended-config-start
    view.setUint16(24, 0); // config-result = accepted-config

    debug('Config response:', common.bytes2hex(new Uint8Array(buffer), true));

    return buffer;
  }

  static buildMDSAttributeRequest(invokeId) {
    const buffer = new ArrayBuffer(18);
    const view = new DataView(buffer);

    view.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    view.setUint16(2, 14); // length
    view.setUint16(4, 12); // octet string length
    view.setUint16(6, invokeId + 1); // to differentiate from previous
    view.setUint16(8, DATA_ADPU.INVOKE_GET);
    view.setUint16(10, 6); // length
    view.setUint16(12, 0); // handle 0
    view.setUint16(14, 0); // attribute-id-list.count = 0 (get all attributes)
    view.setUint16(16, 0); // attribute-id-list.length = 0

    debug('MDS request:', common.bytes2hex(new Uint8Array(buffer), true));

    return buffer;
  }

  static buildActionRequest(invokeId, pmStoreHandle) {
    const buffer = new ArrayBuffer(24);
    const view = new DataView(buffer);

    view.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    view.setUint16(2, 20); // length
    view.setUint16(4, 18); // octet string length
    view.setUint16(6, invokeId + 1); // invoke-id
    view.setUint16(8, DATA_ADPU.INVOKE_CONFIRMED_ACTION);
    view.setUint16(12, pmStoreHandle);
    view.setUint16(14, ACTION_TYPE.MDC_ACT_SEG_GET_INFO);
    view.setUint16(16, 6); // length
    view.setUint16(18, 1); // all-segments
    view.setUint16(20, 2); // length
    view.setUint16(22, 0);

    debug('Action request:', common.bytes2hex(new Uint8Array(buffer, true)));

    return buffer;
  }

  static buildDataTransferRequest(invokeId, pmStoreHandle, segment) {
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);

    view.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    view.setUint16(2, 16); // length
    view.setUint16(4, 14); // octet string length
    view.setUint16(6, invokeId + 1); // invoke-id
    view.setUint16(8, DATA_ADPU.INVOKE_CONFIRMED_ACTION);
    view.setUint16(10, 8); // length
    view.setUint16(12, pmStoreHandle);
    view.setUint16(14, ACTION_TYPE.MDC_ACT_SEG_TRIG_XFER);
    view.setUint16(16, 2); // length
    view.setUint16(18, segment); // segment

    debug('Data transfer request:', common.bytes2hex(new Uint8Array(buffer), true));

    return buffer;
  }

  static buildDataTransferConfirmation(invokeId, pmStoreHandle, segmentDataResult) {
    const buffer = new ArrayBuffer(34);
    const view = new DataView(buffer);

    view.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    view.setUint16(2, 30); // length
    view.setUint16(4, 28); // octet string length
    view.setUint16(6, invokeId);
    view.setUint16(8, DATA_ADPU.RESPONSE_CONFIRMED_EVENT_REPORT);
    view.setUint16(10, 22); // length
    view.setUint16(12, pmStoreHandle);
    view.setUint32(14, 0xFFFFFFFF); // relative time
    view.setUint16(18, EVENT_TYPE.MDC_NOTI_SEGMENT_DATA);
    view.setUint16(20, 12); // length
    view.setUint32(22, segmentDataResult.readUInt32BE(0));
    view.setUint32(26, segmentDataResult.readUInt32BE(4));
    view.setUint16(30, segmentDataResult.readUInt16BE(8)); // number of entries
    view.setUint16(32, 0x0080); // confirmed

    debug('Data transfer confirmation:', common.bytes2hex(new Uint8Array(buffer), true));

    return buffer;
  }

  async release(cb) {
    await this.usbDevice.transferOut(this.ep, AccuChekUSB.buildAssociationReleaseRequest());
    const incoming = await this.usbDevice.transferIn(this.ep, 1024);
    debug('Release response:', _.toUpper(incoming.toString('hex')));
    return cb();
  }

  async close(cb) {
    this.usbDevice.iface.release(true, () => {
      this.usbDevice.device.close();
      cb();
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
      driver.openDevice(data.deviceInfo, (err) => {
        if (err) {
          data.disconnect = true;
          debug('Error:', err);
          return cb(err, null);
        }
        return cb(null, data);
      });
    },

    getConfigInfo(progress, data, cb) {
      debug('in getConfigInfo', data);
      progress(0);

      (async () => {
        const result = await driver.getConfig(data);

        const deviceDetails = getAttributeList(result.deviceDetails);
        const modelId = getAttribute(deviceDetails, MDC_PART_OBJ.MDC_ATTR_ID_MODEL);

        const re = /(\d+)/g;
        let parsed = re.exec(modelId);
        [data.deviceInfo.model] = parsed;

        const productionSpec = getAttribute(deviceDetails, MDC_PART_OBJ.MDC_ATTR_ID_PROD_SPECN);
        const serialNumber = getProductionSpecEntry(productionSpec, 'serial-number');

        parsed = re.exec(serialNumber);
        [data.deviceInfo.serial] = parsed;
        data.deviceInfo.deviceId = `Roche-${data.deviceInfo.model}-${data.deviceInfo.serial}`;

        const timestamp = getAttribute(deviceDetails, MDC_PART_OBJ.MDC_ATTR_TIME_ABS);
        data.deviceInfo.meterTime = sundial.parseFromFormat(timestamp.toString('hex'), 'YYYYMMDDHHmm');

        common.checkDeviceTime(
          sundial.formatDeviceTime(data.deviceInfo.meterTime), cfg,
          (timeErr) => {
            progress(100);
            if (timeErr) {
              return cb(timeErr, null);
            }
            _.assign(data, result);
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
      driver.getData(data.lastInvokeId, data.pmStoreHandle, (err, result) => {
        if (err) {
          debug('Error:', err);
          return cb(err, null);
        }
        data.records = result;
        return cb(null, data);
      });
    },

    processData(progress, data, cb) {
      data.parsedRecords = AccuChekUSB.parseData(data.records);

      progress(0);
      cfg.builder.setDefaults({ deviceId: data.deviceInfo.deviceId });
      data.postRecords = [];

      _.forEach(data.parsedRecords, (result, index) => {
        const record = result;
        let annotation = null;

        // According to user manual, HI > 600 and LO < 20
        if (record.value === 0x07FE) { // +INFINITY
          record.value = 601;
          annotation = {
            code: 'bg/out-of-range',
            value: 'high',
            threshold: 600,
          };
        } else if (record.value === 0x0802) { // -INFINITY
          record.value = 19;
          annotation = {
            code: 'bg/out-of-range',
            value: 'low',
            threshold: 20,
          };
        }

        const recordBuilder = cfg.builder.makeSMBG()
          .with_value(record.value)
          .with_units('mg/dL') // values are always in 'mg/dL'
          .with_deviceTime(sundial.formatDeviceTime(record.dateTime))
          .set('index', index);

        cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.dateTime);

        if (annotation) {
          annotate.annotateEvent(recordBuilder, annotation);
        }

        const postRecord = recordBuilder.done();
        delete postRecord.index;
        data.postRecords.push(postRecord);
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
        deviceManufacturers: ['Roche'],
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
      driver.release(() => {
        data.disconnect = true;
        cb(null, data);
      });
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');
      driver.close(() => {
        progress(100);
        data.cleanup = true;
        cb();
      });
    },
  };
};
