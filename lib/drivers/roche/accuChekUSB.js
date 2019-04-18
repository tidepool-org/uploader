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

      this.usbDevice.iface.endpoints[0].timeout = AccuChekUSB.TIMEOUT;
      /* eslint-disable-next-line no-bitwise */
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
    let incoming;

    async function getPMStore(self) {
      incoming = await self.usbDevice.transferIn(self.ep, 1024);
      debug('Received extended config:', _.toUpper(incoming.toString('hex')));
      data.extendedConfig = incoming;

      if (incoming == null) {
        throw Error('Could not retrieve config. Please retry.');
      }

      return getObject(
        incoming,
        MDC_PART_OBJ.MDC_MOC_VMO_PMSTORE,
      );
    }

    let pmStoreDetails = await getPMStore(this);

    if (pmStoreDetails == null) {
      debug('Invalid config, trying again...');

      await this.usbDevice.transferOut(
        this.ep,
        Buffer.from(AccuChekUSB.buildAssociationResponse()),
      );

      pmStoreDetails = await getPMStore(this);

      if (pmStoreDetails == null) {
        throw Error('Could not parse config. Please retry.');
      }
    }
    data.pmStoreHandle = pmStoreDetails.handle;
    data.numberOfSegments = getAttribute(
      pmStoreDetails,
      MDC_PART_OBJ.MDC_ATTR_NUM_SEG,
    ).readUInt16BE(0);

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

          /* eslint-disable-next-line no-bitwise */
          if (status & 0x40) {
            // the second bit of the status field indicates if it's the last one
            done = true;
          }

          // eslint-disable-next-line no-await-in-loop, these requests need to be sequential
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
      const entries = page.readUInt16BE(offset);

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
    const buffer = Buffer.alloc(48);

    buffer.writeUInt16BE(APDU_TYPE.ASSOCIATION_RESPONSE, 0);
    buffer.writeUInt16BE(44, 2); // Length (excludes initial 4 bytes)
    buffer.writeUInt16BE(0x0003, 4); // accepted-unknown-config
    buffer.writeUInt16BE(20601, 6); // data-proto-id
    buffer.writeUInt16BE(38, 8); // data-proto-info length
    buffer.writeUIntBE(0x80000002, 10, 4); // protocolVersion
    buffer.writeUInt16BE(0x8000, 14); // encoding-rules = MDER
    buffer.writeUIntBE(0x80000000, 16, 4); // nomenclatureVersion
    buffer.writeUIntBE(0, 20, 4); // functionalUnits = normal association
    buffer.writeUIntBE(0x80000000, 24, 4); // systemType = sys-type-manager
    buffer.writeUInt16BE(8, 28); // system-id length
    buffer.writeUIntBE(0x12345678, 30, 4); // system-id high
    buffer.writeUIntBE(0x87654321, 34, 4); // system-id low
    // rest of bytes should always be 0x00 for manager response

    debug('Association response:', _.toUpper(buffer.toString('hex')));

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
    const buffer = Buffer.alloc(26);

    buffer.writeUInt16BE(APDU_TYPE.PRESENTATION_APDU, 0);
    buffer.writeUInt16BE(22, 2); // length
    buffer.writeUInt16BE(20, 4); // octet stringlength
    buffer.writeUInt16BE(invokeId, 6); // invoke-id from config
    buffer.writeUInt16BE(DATA_ADPU.RESPONSE_CONFIRMED_EVENT_REPORT, 8);
    buffer.writeUInt16BE(14, 10); // length
    buffer.writeUInt16BE(0, 12); // obj-handle = 0
    buffer.writeUIntBE(0, 14, 4); // currentTime = 0
    buffer.writeUInt16BE(EVENT_TYPE.MDC_NOTI_CONFIG, 18); // event-type
    buffer.writeUInt16BE(4, 20); // length
    buffer.writeUInt16BE(0x4000, 22); // config-report-id = extended-config-start
    buffer.writeUInt16BE(0, 24); // config-result = accepted-config

    debug('Config response:', _.toUpper(buffer.toString('hex')));

    return buffer;
  }

  static buildMDSAttributeRequest(invokeId) {
    const buffer = Buffer.alloc(18);

    buffer.writeUInt16BE(APDU_TYPE.PRESENTATION_APDU, 0);
    buffer.writeUInt16BE(14, 2); // length
    buffer.writeUInt16BE(12, 4); // octet string length
    buffer.writeUInt16BE(invokeId + 1, 6); // to differentiate from previous
    buffer.writeUInt16BE(DATA_ADPU.INVOKE_GET, 8);
    buffer.writeUInt16BE(6, 10); // length
    buffer.writeUInt16BE(0, 12); // handle 0
    buffer.writeUInt16BE(0, 14); // attribute-id-list.count = 0 (get all attributes)
    buffer.writeUInt16BE(0, 16); // attribute-id-list.length = 0

    debug('MDS request:', _.toUpper(buffer.toString('hex')));

    return buffer;
  }

  static buildActionRequest(invokeId, pmStoreHandle) {
    const buffer = Buffer.alloc(24);

    buffer.writeUInt16BE(APDU_TYPE.PRESENTATION_APDU, 0);
    buffer.writeUInt16BE(20, 2); // length
    buffer.writeUInt16BE(18, 4); // octet string length
    buffer.writeUInt16BE(invokeId + 1, 6); // invoke-id
    buffer.writeUInt16BE(DATA_ADPU.INVOKE_CONFIRMED_ACTION, 8);
    buffer.writeUInt16BE(pmStoreHandle, 12);
    buffer.writeUInt16BE(ACTION_TYPE.MDC_ACT_SEG_GET_INFO, 14);
    buffer.writeUInt16BE(6, 16); // length
    buffer.writeUInt16BE(1, 18); // all-segments
    buffer.writeUInt16BE(2, 20); // length
    buffer.writeUInt16BE(0, 22);

    debug('Action request:', _.toUpper(buffer.toString('hex')));

    return buffer;
  }

  static buildDataTransferRequest(invokeId, pmStoreHandle, segment) {
    const buffer = Buffer.alloc(20);

    buffer.writeUInt16BE(APDU_TYPE.PRESENTATION_APDU, 0);
    buffer.writeUInt16BE(16, 2); // length
    buffer.writeUInt16BE(14, 4); // octet string length
    buffer.writeUInt16BE(invokeId + 1, 6); // invoke-id
    buffer.writeUInt16BE(DATA_ADPU.INVOKE_CONFIRMED_ACTION, 8);
    buffer.writeUInt16BE(8, 10); // length
    buffer.writeUInt16BE(pmStoreHandle, 12);
    buffer.writeUInt16BE(ACTION_TYPE.MDC_ACT_SEG_TRIG_XFER, 14);
    buffer.writeUInt16BE(2, 16); // length
    buffer.writeUInt16BE(segment, 18); // segment

    debug('Data transfer request:', _.toUpper(buffer.toString('hex')));

    return buffer;
  }

  static buildDataTransferConfirmation(invokeId, pmStoreHandle, segmentDataResult) {
    const buffer = Buffer.alloc(34);

    buffer.writeUInt16BE(APDU_TYPE.PRESENTATION_APDU, 0);
    buffer.writeUInt16BE(30, 2); // length
    buffer.writeUInt16BE(28, 4); // octet string length
    buffer.writeUInt16BE(invokeId, 6);
    buffer.writeUInt16BE(DATA_ADPU.RESPONSE_CONFIRMED_EVENT_REPORT, 8);
    buffer.writeUInt16BE(22, 10); // length
    buffer.writeUInt16BE(pmStoreHandle, 12);
    buffer.writeUIntBE(0xFFFFFFFF, 14, 4); // relative time
    buffer.writeUInt16BE(EVENT_TYPE.MDC_NOTI_SEGMENT_DATA, 18);
    buffer.writeUInt16BE(12, 20); // length
    buffer.writeUIntBE(segmentDataResult.readUInt32BE(0), 22, 4);
    buffer.writeUIntBE(segmentDataResult.readUInt32BE(4), 26, 4);
    buffer.writeUInt16BE(segmentDataResult.readUInt16BE(8), 30); // number of entries
    buffer.writeUInt16BE(0x0080, 32); // confirmed

    debug('Data transfer confirmation:', _.toUpper(buffer.toString('hex')));

    return buffer;
  }

  async release(cb) {
    try {
      await this.usbDevice.transferOut(this.ep, AccuChekUSB.buildAssociationReleaseRequest());
      const incoming = await this.usbDevice.transferIn(this.ep, 1024);
      debug('Release response:', _.toUpper(incoming.toString('hex')));
    } catch (error) {
      debug('Could not release device successfully.');
    }

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
