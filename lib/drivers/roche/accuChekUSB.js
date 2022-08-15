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
/* eslint-disable import/no-extraneous-dependencies */
import { webusb } from 'usb';

import annotate from '../../eventAnnotations';
import common from '../../commonFunctions';
import TZOUtil from '../../TimezoneOffsetUtil';
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

  static timeout(delay = 5000) {
    return new Promise((resolve, reject) => setTimeout(reject, delay, new Error('Timeout error')));
  }

  // eslint-disable-next-line consistent-return
  async openDevice(deviceInfo, cb) {
    const devices = await webusb.getDevices();

    // eslint-disable-next-line no-restricted-syntax
    for (const usbDevice of devices) {
      if (usbDevice.productId === deviceInfo.usbDevice.productId &&
          usbDevice.vendorId === deviceInfo.usbDevice.vendorId) {
        this.usbDevice = usbDevice;
      }
    }

    if (this.usbDevice == null) {
      return cb(new Error('Could not find device'));
    }

    try {
      await this.usbDevice.open();

      if (this.usbDevice.configuration === null) {
        debug('Selecting configuration 1');
        await this.usbDevice.selectConfiguration(1);
      }

      if (this.usbDevice.configuration.interfaces == null) {
        throw new Error('Please unplug device and retry.');
      }

      [this.iface] = this.usbDevice.configuration.interfaces;

      debug('Claiming interface', this.iface.interfaceNumber);
      await this.usbDevice.claimInterface(this.iface.interfaceNumber);

      const epOut = this.iface.alternate.endpoints.find((ep) => ep.direction === 'out');
      const epIn = this.iface.alternate.endpoints.find((ep) => ep.direction === 'in');

      this.usbDevice.usbconfig = {
        interface: this.iface,
        outEPnum: epOut.endpointNumber,
        inEPnum: epIn.endpointNumber,
        outPacketSize: epOut.packetSize || 1024,
        inPacketSize: epIn.packetSize || 1024,
      };

      const getStatus = {
        requestType: 'standard',
        recipient: 'device',
        request: 0x00,
        value: 0x00,
        index: 0x00,
      };

      await this.usbDevice.controlTransferIn(getStatus, 2);

      const incoming = await Promise.race([
        AccuChekUSB.timeout(),
        this.usbDevice.transferIn(this.usbDevice.usbconfig.inEPnum, 128),
      ]);
      debug('Received association request:', common.bytes2hex(new Uint8Array(incoming.data.buffer), true));

      await this.usbDevice.transferOut(
        this.usbDevice.usbconfig.outEPnum,
        AccuChekUSB.buildAssociationResponse(),
      );

      return cb(null);
    } catch (error) {
      if (error.message === 'Timeout error') {
        error.code = 'E_UNPLUG_AND_RETRY';
      }
      debug('Error:', error);
      return cb(error, null);
    }
  }

  async getConfig(data) {
    let incoming;

    async function getPMStore(self) {
      incoming = await self.usbDevice.transferIn(self.usbDevice.usbconfig.inEPnum, 1024);
      debug('Received extended config:', common.bytes2hex(new Uint8Array(incoming.data.buffer), true));
      data.extendedConfig = incoming.data;

      if (incoming == null) {
        throw Error('Could not retrieve config. Please retry.');
      }

      return getObject(
        incoming.data,
        MDC_PART_OBJ.MDC_MOC_VMO_PMSTORE,
      );
    }

    let pmStoreDetails = await getPMStore(this);

    if (pmStoreDetails == null) {
      debug('Invalid config, trying again...');

      await this.usbDevice.transferOut(
        this.usbDevice.usbconfig.outEPnum,
        AccuChekUSB.buildAssociationResponse(),
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
    ).getUint16(0);

    let invokeId = incoming.data.getUint16(6);
    await this.usbDevice.transferOut(
      this.usbDevice.usbconfig.outEPnum,
      AccuChekUSB.buildConfigResponse(invokeId),
    );

    await this.usbDevice.transferOut(
      this.usbDevice.usbconfig.outEPnum,
      AccuChekUSB.buildMDSAttributeRequest(invokeId),
    );
    incoming = await this.usbDevice.transferIn(this.usbDevice.usbconfig.inEPnum, 1024);
    debug('Received MDS attribute response:', common.bytes2hex(new Uint8Array(incoming.data.buffer), true));
    invokeId = incoming.data.getUint16(6);
    data.deviceDetails = incoming.data;

    await this.usbDevice.transferOut(
      this.usbDevice.usbconfig.outEPnum,
      AccuChekUSB.buildActionRequest(invokeId, data.pmStoreHandle),
    );
    incoming = await this.usbDevice.transferIn(this.usbDevice.usbconfig.inEPnum, 1024);
    debug('Received action request response:', common.bytes2hex(new Uint8Array(incoming.data.buffer), true));
    data.pmStoreConfig = incoming.data;

    data.lastInvokeId = incoming.data.getUint16(6);

    return data;
  }

  async setTime(invokeId, pmStoreHandle, timestamp, cb) {
    await this.usbDevice.transferOut(
      this.usbDevice.usbconfig.outEPnum,
      AccuChekUSB.buildSetTimeRequest(invokeId, pmStoreHandle, timestamp),
    );
    const incoming = await this.usbDevice.transferIn(this.usbDevice.usbconfig.inEPnum, 1024);
    const lastInvokeId = incoming.data.getUint16(6);
    debug('Received set time response:', common.bytes2hex(new Uint8Array(incoming.data.buffer), true));

    return cb(lastInvokeId);
  }

  async getData(invokeId, pmStoreHandle, cb) {
    const pages = [];
    let done = false;
    const segment = 0;

    try {
      // these requests need to be sequential
      // eslint-disable-next-line no-await-in-loop
      await this.usbDevice.transferOut(
        this.usbDevice.usbconfig.outEPnum,
        AccuChekUSB.buildDataTransferRequest(
          invokeId,
          pmStoreHandle,
          segment,
        ),
      );

      // these requests need to be sequential
      // eslint-disable-next-line no-await-in-loop
      const incoming = await this.usbDevice.transferIn(this.usbDevice.usbconfig.inEPnum, 1024);
      debug('Received data transfer request response:', common.bytes2hex(new Uint8Array(incoming.data.buffer), true));

      if (incoming.data.length === 22 && incoming.data.getUint16(20)) {
        const dataResponse = incoming.data.getUint16(20);
        if (dataResponse === 3) {
          debug('Segment was empty');
        } else {
          throw new Error(`Could not retrieve data: ${DATA_RESPONSE[dataResponse]}`);
        }
      } else if (incoming.data.length < 22
            || incoming.data.getUint16(14) !== ACTION_TYPE.MDC_ACT_SEG_TRIG_XFER) {
        throw new Error('Unexpected response');
      } else {
        while (!done) {
          // these requests need to be sequential
          // eslint-disable-next-line no-await-in-loop
          const { data } = await this.usbDevice.transferIn(this.usbDevice.usbconfig.inEPnum, 1024);
          debug('Data:', common.bytes2hex(new Uint8Array(data.buffer), true));
          pages.push(data);

          const dataInvokeId = data.getUint16(6);
          const segmentDataResult = new DataView(data.buffer.slice(22, 32));
          const status = data.getUint8(32);

          /* eslint-disable-next-line no-bitwise */
          if (status & 0x40) {
            // the second bit of the status field indicates if it's the last one
            done = true;
          }

          // these requests need to be sequential
          // eslint-disable-next-line no-await-in-loop
          await this.usbDevice.transferOut(
            this.usbDevice.usbconfig.outEPnum,
            AccuChekUSB.buildDataTransferConfirmation(
              dataInvokeId,
              pmStoreHandle,
              segmentDataResult,
            ),
          );
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
      const entries = page.getUint16(offset);

      for (let i = 0; i < entries; i++) {
        const record = {};
        const timestamp = page.buffer.slice(offset + 6, offset + 12);
        record.dateTime = sundial.parseFromFormat(
          common.bytes2hex(new Uint8Array(timestamp), true),
          'YYYYMMDDHHmm',
        );
        record.value = page.getUint16(offset + 14);
        record.status = page.getUint16(offset + 16);
        offset += 12;
        records.push(record);
      }
    });

    return records;
  }

  static buildAssociationResponse() {
    const buf = new ArrayBuffer(48);
    const buffer = new DataView(buf);

    buffer.setUint16(0, APDU_TYPE.ASSOCIATION_RESPONSE);
    buffer.setUint16(2, 44); // Length (excludes initial 4 bytes)
    buffer.setUint16(4, 0x0003); // accepted-unknown-config
    buffer.setUint16(6, 20601); // data-proto-id
    buffer.setUint16(8, 38); // data-proto-info length
    buffer.setUint32(10, 0x80000002); // protocolVersion
    buffer.setUint16(14, 0x8000); // encoding-rules = MDER
    buffer.setUint32(16, 0x80000000); // nomenclatureVersion
    buffer.setUint32(20, 0); // functionalUnits = normal association
    buffer.setUint32(24, 0x80000000); // systemType = sys-type-manager
    buffer.setUint16(28, 8); // system-id length
    buffer.setUint32(30, 0x12345678); // system-id high
    buffer.setUint32(34, 0x87654321); // system-id low
    // rest of bytes should always be 0x00 for manager response

    debug('Association response:', common.bytes2hex(new Uint8Array(buf), true));

    return buffer.buffer;
  }

  static buildAssociationReleaseRequest() {
    const buf = new ArrayBuffer(6);
    const buffer = new DataView(buf);

    buffer.setUint16(0, APDU_TYPE.ASSOCIATION_RELEASE_REQUEST);
    buffer.setUint16(2, 2); // length  = 2
    buffer.setUint16(4, 0x0000); // normal

    debug('Association release:', common.bytes2hex(new Uint8Array(buf), true));

    return buffer.buffer;
  }

  static buildConfigResponse(invokeId) {
    const buf = new ArrayBuffer(26);
    const buffer = new DataView(buf);

    buffer.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    buffer.setUint16(2, 22); // length
    buffer.setUint16(4, 20); // octet stringlength
    buffer.setUint16(6, invokeId); // invoke-id from config
    buffer.setUint16(8, DATA_ADPU.RESPONSE_CONFIRMED_EVENT_REPORT);
    buffer.setUint16(10, 14); // length
    buffer.setUint16(12, 0); // obj-handle = 0
    buffer.setUint32(14, 0); // currentTime = 0
    buffer.setUint16(18, EVENT_TYPE.MDC_NOTI_CONFIG); // event-type
    buffer.setUint16(20, 4); // length
    buffer.setUint16(22, 0x4000); // config-report-id = extended-config-start
    buffer.setUint16(24, 0); // config-result = accepted-config

    debug('Config response:', common.bytes2hex(new Uint8Array(buf), true));

    return buffer.buffer;
  }

  static buildMDSAttributeRequest(invokeId) {
    const buf = new ArrayBuffer(18);
    const buffer = new DataView(buf);

    buffer.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    buffer.setUint16(2, 14); // length
    buffer.setUint16(4, 12); // octet string length
    buffer.setUint16(6, invokeId + 1); // to differentiate from previous
    buffer.setUint16(8, DATA_ADPU.INVOKE_GET);
    buffer.setUint16(10, 6); // length
    buffer.setUint16(12, 0); // handle 0
    buffer.setUint16(14, 0); // attribute-id-list.count = 0 (get all attributes)
    buffer.setUint16(16, 0); // attribute-id-list.length = 0

    debug('MDS request:', common.bytes2hex(new Uint8Array(buf), true));

    return buffer.buffer;
  }

  static buildActionRequest(invokeId, pmStoreHandle) {
    const buf = new ArrayBuffer(24);
    const buffer = new DataView(buf);

    buffer.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    buffer.setUint16(2, 20); // length
    buffer.setUint16(4, 18); // octet string length
    buffer.setUint16(6, invokeId + 1); // invoke-id
    buffer.setUint16(8, DATA_ADPU.INVOKE_CONFIRMED_ACTION);
    buffer.setUint16(12, pmStoreHandle);
    buffer.setUint16(14, ACTION_TYPE.MDC_ACT_SEG_GET_INFO);
    buffer.setUint16(16, 6); // length
    buffer.setUint16(18, 1); // all-segments
    buffer.setUint16(20, 2); // length
    buffer.setUint16(22, 0);

    debug('Action request:', common.bytes2hex(new Uint8Array(buf), true));

    return buffer.buffer;
  }

  static buildSetTimeRequest(invokeId, pmStoreHandle, timestamp) {
    const buf = new ArrayBuffer(30);
    const buffer = new DataView(buf);

    buffer.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    buffer.setUint16(2, 26); // length
    buffer.setUint16(4, 24); // octet string length
    buffer.setUint16(6, invokeId + 1); // invoke-id
    buffer.setUint16(8, DATA_ADPU.INVOKE_CONFIRMED_ACTION);
    buffer.setUint16(10, 18); // length
    buffer.setUint16(12, 0);
    buffer.setUint16(14, ACTION_TYPE.MDC_ACT_SEG_SET_TIME);
    buffer.setUint16(16, 12); // length
    buffer.setBigUint64(18, timestamp); // AbsoluteTime
    buffer.setUint32(26, 0); // accuracy (FLOAT-type, set to zero)

    debug('Set time request:', common.bytes2hex(new Uint8Array(buf), true));

    return buffer.buffer;
  }

  static buildDataTransferRequest(invokeId, pmStoreHandle, segment) {
    const buf = new ArrayBuffer(20);
    const buffer = new DataView(buf);

    buffer.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    buffer.setUint16(2, 16); // length
    buffer.setUint16(4, 14); // octet string length
    buffer.setUint16(6, invokeId + 1); // invoke-id
    buffer.setUint16(8, DATA_ADPU.INVOKE_CONFIRMED_ACTION);
    buffer.setUint16(10, 8); // length
    buffer.setUint16(12, pmStoreHandle);
    buffer.setUint16(14, ACTION_TYPE.MDC_ACT_SEG_TRIG_XFER);
    buffer.setUint16(16, 2); // length
    buffer.setUint16(18, segment); // segment

    debug('Data transfer request:', common.bytes2hex(new Uint8Array(buf), true));

    return buffer.buffer;
  }

  static buildDataTransferConfirmation(invokeId, pmStoreHandle, segmentDataResult) {
    const buf = new ArrayBuffer(34);
    const buffer = new DataView(buf);

    buffer.setUint16(0, APDU_TYPE.PRESENTATION_APDU);
    buffer.setUint16(2, 30); // length
    buffer.setUint16(4, 28); // octet string length
    buffer.setUint16(6, invokeId);
    buffer.setUint16(8, DATA_ADPU.RESPONSE_CONFIRMED_EVENT_REPORT);
    buffer.setUint16(10, 22); // length
    buffer.setUint16(12, pmStoreHandle);
    buffer.setUint32(14, 0xFFFFFFFF); // relative time
    buffer.setUint16(18, EVENT_TYPE.MDC_NOTI_SEGMENT_DATA);
    buffer.setUint16(20, 12); // length
    buffer.setUint32(22, segmentDataResult.getUint32(0));
    buffer.setUint32(26, segmentDataResult.getUint32(4));
    buffer.setUint16(30, segmentDataResult.getUint16(8)); // number of entries
    buffer.setUint16(32, 0x0080); // confirmed

    debug('Data transfer confirmation:', common.bytes2hex(new Uint8Array(buf), true));

    return buffer.buffer;
  }

  async release() {
    try {
      await this.usbDevice.transferOut(
        this.usbDevice.usbconfig.outEPnum,
        AccuChekUSB.buildAssociationReleaseRequest(),
      );
      const incoming = await this.usbDevice.transferIn(this.usbDevice.usbconfig.inEPnum, 1024);
      debug('Release response:', common.bytes2hex(new Uint8Array(incoming.data.buffer), true));
    } catch (error) {
      debug('Could not release device successfully.');
    }
  }

  async close() {
    await this.usbDevice.releaseInterface(0);
    await this.usbDevice.close();
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['Roche'],
  });
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
      }).catch((err) => cb(err, null));
    },

    getConfigInfo(progress, data, cb) {
      debug('in getConfigInfo', data);
      progress(0);
      const decoder = new TextDecoder();

      (async () => {
        const result = await driver.getConfig(data);

        const deviceDetails = getAttributeList(result.deviceDetails);
        const modelId = decoder.decode(getAttribute(deviceDetails, MDC_PART_OBJ.MDC_ATTR_ID_MODEL));

        const re = /(\d+)/g;
        [data.deviceModel] = re.exec(modelId);
        cfg.deviceInfo.model = data.deviceModel;

        const productionSpec = getAttribute(deviceDetails, MDC_PART_OBJ.MDC_ATTR_ID_PROD_SPECN);
        const serialNumber = decoder.decode(getProductionSpecEntry(productionSpec, 'serial-number'));

        [data.serialNumber] = re.exec(serialNumber);
        cfg.deviceInfo.serialNumber = data.serialNumber;
        cfg.deviceInfo.deviceId = `Roche-${cfg.deviceInfo.model}-${cfg.deviceInfo.serialNumber}`;

        const timestamp = getAttribute(deviceDetails, MDC_PART_OBJ.MDC_ATTR_TIME_ABS);
        cfg.deviceInfo.meterTime = sundial.parseFromFormat(
          common.bytes2hex(new Uint8Array(timestamp.buffer), true),
          'YYYYMMDDHHmm',
        );
        cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(cfg.deviceInfo.meterTime);

        common.checkDeviceTime(
          cfg,
          (timeErr, serverTime) => {
            progress(100);
            if (timeErr) {
              if (timeErr === 'updateTime') {
                cfg.deviceInfo.annotations = 'wrong-device-time';
                const newTime = sundial.formatInTimezone(serverTime, cfg.timezone, 'YYYYMMDDHHmm');
                driver.setTime(data.lastInvokeId, data.pmStoreHandle, newTime, (invokeId) => {
                  _.assign(data, result);
                  data.lastInvokeId = invokeId;
                  return cb(null, data);
                });
              } else {
                cb(timeErr, null);
              }
            } else {
              _.assign(data, result);
              cb(null, data);
            }
          },
        );
      })().catch((error) => {
        debug('Error in getConfigInfo: ', error);
        cb(error, null);
      });
    },

    fetchData(progress, data, cb) {
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
      cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });
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
      debug('in disconnect');
      driver.release().then(() => {
        data.disconnect = true;
        cb(null, data);
      });
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');
      driver.close().then(() => {
        progress(100);
        data.cleanup = true;
        cb();
      }).catch((err) => {
        debug('Error during cleanup:', err);
        cb();
      });
    },
  };
};
