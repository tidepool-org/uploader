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

// import annotate from '../../eventAnnotations';
import common from '../../commonFunctions';
import TZOUtil from '../../TimezoneOffsetUtil';
import structJs from '../../struct';
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
    this.usbDevice = this.cfg.deviceComms;
  }

  async openDevice(deviceInfo, cb) {
    this.device = usb.findByIds(deviceInfo.vendorId, deviceInfo.productId);
    this.device.open(false); // dont' auto-configure

    this.device.setConfiguration(1, async () => {
      [this.iface] = this.device.interfaces;
      this.iface.claim();

      /* eslint-disable no-bitwise */
      this.ep = this.iface.endpoints[0].address & 0x0F;

      try {
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

        const incoming = await this.transferIn(this.ep, 128);
        console.log('Assoc request:', incoming.toString('hex'));

        await this.transferOut(this.ep, Buffer.from(AccuChekUSB.buildAssociationResponse()));

        /*
        self.inEndpoint = self.iface.endpoint(0x83);
        self.inEndpoint.startPoll();
        self.inEndpoint.on('data', (data) => {
          console.log('Data:', data.toString('hex'));
        });
        */
        return cb(null);
      } catch (error) {
        return cb(error, null);
      }
    });
  }

  async getConfig(data, cb) {
    try {
      let incoming = await this.transferIn(this.ep, 1024);
      console.log('extended config:', incoming.toString('hex'));
      data.extendedConfig = incoming;

      const pmStoreDetails = getObject(
        incoming,
        MDC_PART_OBJ.MDC_MOC_VMO_PMSTORE,
      );
      data.pmStoreHandle = pmStoreDetails.handle;
      data.numberOfSegments = struct.extractBEShort(
        getAttribute(pmStoreDetails, MDC_PART_OBJ.MDC_ATTR_NUM_SEG),
        0,
      );

      let invokeId = incoming.readUInt16BE(6);
      console.log('Invoke Id:', invokeId);
      await this.transferOut(this.ep, Buffer.from(AccuChekUSB.buildConfigResponse(invokeId)));

      await this.transferOut(this.ep, Buffer.from(AccuChekUSB.buildMDSAttributeRequest(invokeId)));
      incoming = await this.transferIn(this.ep, 1024);
      console.log('MDS attribute response:', incoming.toString('hex'));
      invokeId = incoming.readUInt16BE(6);
      console.log('Invoke Id:', invokeId);
      data.deviceDetails = incoming;

      await this.transferOut(
        this.ep,
        Buffer.from(AccuChekUSB.buildActionRequest(invokeId, data.pmStoreHandle)),
      );
      incoming = await this.transferIn(this.ep, 1024);
      console.log('Action request response:', incoming.toString('hex'));
      data.pmStoreConfig = incoming;

      invokeId = incoming.readUInt16BE(6);
      console.log('Invoke Id:', invokeId);
      data.lastInvokeId = invokeId;
    } catch (error) {
      return cb(error, null);
    }

    return cb(null, data);
  }

  async getData(invokeId, pmStoreHandle, cb) {
    let data = [];

    try {
      await this.transferOut(this.ep, AccuChekUSB.buildDataTransferRequest(
        invokeId,
        pmStoreHandle,
      ));

      const incoming = await this.transferIn(this.ep, 1024);
      console.log('Data transfer request response:', incoming);
      console.log('Decoded:', incoming.toString('hex'));

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
        data = await this.transferIn(this.ep, 1024);
        console.log('Data:', incoming.toString('hex'));

        const dataInvokeId = incoming.readUInt16BE(6);
        const segmentDataResult = incoming.slice(22, 33);

        await this.transferOut(this.ep, AccuChekUSB.buildDataTransferConfirmation(
          dataInvokeId,
          pmStoreHandle,
          segmentDataResult,
        ));
      }
    } catch (error) {
      return cb(error, null);
    }

    return cb(null, data);
  }

  static parseData(data) {
    let offset = 30;
    const records = [];

    if (data.length > 0) {
      const entries = struct.extractBEShort(data, offset);
      for (let i = 0; i < entries; i++) {
        const record = {};
        const timestamp = data.slice(offset + 6, offset + 12).toString('hex');
        record.dateTime = sundial.parseFromFormat(timestamp, 'YYYYMMDDHHmm');
        record.value = data.readUInt16BE(offset + 14);
        record.status = data.readUInt16BE(offset + 16);
        offset += 12;
        records.push(record);
      }
    }

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

    console.log('ASSOC RESPONSE:', common.bytes2hex(view));

    return buffer;
  }

  static buildAssociationReleaseRequest() {
    const buffer = Buffer.alloc(6);

    buffer.writeUInt16BE(APDU_TYPE.ASSOCIATION_RELEASE_REQUEST, 0);
    buffer.writeUInt16BE(2, 2); // length  = 2
    buffer.writeUInt16BE(0x0000, 4); // normal

    console.log('ASSSOC RELEASE:', buffer.toString('hex'));

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

    console.log('CONFIG RESPONSE:', common.bytes2hex(view));

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

    console.log('MDS REQUEST:', common.bytes2hex(view));

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

    console.log('ACTION:', common.bytes2hex(view));

    return buffer;
  }

  static buildDataTransferRequest(invokeId, pmStoreHandle) {
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
    view.setUint16(18, 0x0000); // segment

    console.log('DATA TRANSFER REQUEST:', common.bytes2hex(view));

    return buffer;
  }

  static buildDataTransferConfirmation(invokeId, pmStoreHandle, segmentDataResult) {
    const buffer = new ArrayBuffer(30);
    const bytes = new Uint8Array(buffer);

    struct.pack(
      bytes, 0, 'SSSSSSSSS11Bb',
      APDU_TYPE.PRESENTATION_APDU,
      26, // length
      24, // octet string length
      invokeId,
      DATA_ADPU.RESPONSE_CONFIRMED_EVENT_REPORT,
      18, // length
      pmStoreHandle,
      EVENT_TYPE.MDC_NOTI_SEGMENT_DATA,
      12, // length
      segmentDataResult,
      0x80, // confirmed
    );

    console.log('DATA TRANSFER CONFIRMATION:', common.bytes2hex(bytes));

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

  async close(cb) {
    await this.transferOut(this.ep, AccuChekUSB.buildAssociationReleaseRequest());
    const incoming = await this.transferIn(this.ep, 1024);
    console.log('Release response:', incoming.toString('hex'));

    this.iface.release(true, () => {
      this.device.close();
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
      driver.openDevice(data.deviceInfo, (err, result) => {
        if (err) {
          data.disconnect = true;
          debug('Error:', err);
          return cb(err, null);
        }
        console.log('Result:', result);
        return cb(null, data);
      });
    },

    getConfigInfo(progress, data, cb) {
      debug('in getConfigInfo', data);
      progress(0);

      driver.getConfig(data, (err, result) => {
        if (err) {
          debug('Error:', err);
          return cb(err, null);
        }

        console.log('Result:', result);

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

        _.assign(data, result);
        return cb(null, data);
      });
    },

    async fetchData(progress, data, cb) {
      debug('in fetchData', data);
      driver.getData(data.lastInvokeId, data.pmStoreHandle, (err, result) => {
        if (err) {
          debug('Error:', err);
          return cb(err, null);
        }
        console.log('Result:', result.toString('hex'));
        data.records = result;
        return cb(null, data);
      });
    },

    processData(progress, data, cb) {
      console.log('DATA:', data);
      data.parsedRecords = AccuChekUSB.parseData(data.records);

      progress(0);
      cfg.builder.setDefaults({ deviceId: data.deviceInfo.deviceId });
      data.postRecords = [];

      _.forEach(data.parsedRecords, (record, index) => {
        // According to user manual, HI > 600 and LO < 20
        // let annotation = null;
        // if (value > 600) {
        //   value = 601;
        //   annotation = {
        //     code: 'bg/out-of-range',
        //     value: 'high',
        //     threshold: 600,
        //   };
        // } else if (value < 20) {
        //   value = 19;
        //   annotation = {
        //     code: 'bg/out-of-range',
        //     value: 'low',
        //     threshold: 20,
        //   };
        // }
        //
        // const controlSolution = _.toInteger(nibbles[11]);
        //

        const recordBuilder = cfg.builder.makeSMBG()
          .with_value(record.value)
          .with_units('mg/dL') // values are always in 'mg/dL'
          .with_deviceTime(sundial.formatDeviceTime(record.dateTime))
          .set('index', index);

        cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.dateTime);

        // if (annotation) {
        //   annotate.annotateEvent(recordBuilder, annotation);
        // }

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
      driver.close(() => {
        progress(100);
        data.disconnect = true;
        cb(null, data);
      });
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');
      progress(100);
      data.cleanup = true;
      cb();
    },
  };
};
