/* eslint-disable no-continue */
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

import _ from 'lodash';
import sundial from 'sundial';
import { webusb } from 'usb';
import crypto from 'crypto';

import TZOUtil from '../../TimezoneOffsetUtil';
import {
  cRC8,
  packFrame,
  unpackFrame,
  uintFromArrayBuffer,
  formatString,
  uint8ArrayToString,
  concatArrayBuffer,
} from './utils';

const isBrowser = typeof window !== 'undefined';
const debug = isBrowser ? require('bows')('WeitaiUSBDriver') : console.log;
const common = require('../../commonFunctions');

class WeitaiUSB {
  constructor(cfg) {
    this.cfg = cfg;
  }

  async openDevice(deviceInfo, cb) {
    try {
      this.usbDevice = await webusb.requestDevice({
        filters: [
          {
            vendorId: deviceInfo.usbDevice.vendorId,
            productId: deviceInfo.usbDevice.productId,
          },
        ],
      });

      if (this.usbDevice == null) {
        return cb(new Error('Could not find device'));
      }

      await this.usbDevice.open();
    } catch (err) {
      debug(err);
      return cb(err, null);
    }
    this.usbDevice.selectConfiguration(1).then(async () => {
      if (this.usbDevice.configuration.interfaces == null) {
        return cb(new Error('Please unplug device and retry.'), null);
      }

      if (deviceInfo.usbDevice.vendorId === 6353 && deviceInfo.usbDevice.productId === 11521) {
        await this.open18d1(cb);
      } else {
        try {
          // eslint-disable-next-line prefer-destructuring
          this.usbDevice.iface = this.usbDevice.configuration.interfaces[3];
          this.usbDevice.claimInterface(this.usbDevice.iface.interfaceNumber);
        } catch (e) {
          return cb(e, null);
        }

        try {
          const getStatus = {
            requestType: 'vendor',
            recipient: 'device',
            request: 0x33,
            value: 0x00,
            index: 0x00,
          };

          const incomingControl = await this.usbDevice.controlTransferIn(
            getStatus,
            2,
          );

          if (incomingControl.data.getUint16(0) !== 0x0200) {
            return cb(new Error('Could not connect to the device'), null);
          }

          const getStatus1 = {
            requestType: 'vendor',
            recipient: 'device',
            request: 0x34,
            value: 0x00,
            index: 0x00,
          };
          const buff1 = 'MicrotechMD\0';
          await this.usbDevice.controlTransferOut(getStatus1, buff1);

          const getStatus2 = {
            requestType: 'vendor',
            recipient: 'device',
            request: 0x34,
            value: 0x00,
            index: 0x01,
          };
          const buff2 = 'Equil\0';
          await this.usbDevice.controlTransferOut(getStatus2, buff2);

          const getStatus3 = {
            requestType: 'vendor',
            recipient: 'device',
            request: 0x34,
            value: 0x00,
            index: 0x03,
          };
          const buff3 = '1.0\0';
          await this.usbDevice.controlTransferOut(getStatus3, buff3);

          const getStatus4 = {
            requestType: 'vendor',
            recipient: 'device',
            request: 0x35,
            value: 0x00,
            index: 0x00,
          };

          await this.usbDevice.controlTransferOut(getStatus4, []);
          await this.usbDevice.close();
          setTimeout(() => {
            const newDevice = deviceInfo;
            newDevice.usbDevice.vendorId = 6353;
            newDevice.usbDevice.productId = 11521;
            this.openDevice(newDevice, cb);
          }, 3000);
        } catch (error) {
          if (error.message === 'LIBUSB_TRANSFER_TIMED_OUT') {
            error.code = 'E_UNPLUG_AND_RETRY';
          }
          return cb(error, null);
        }
      }
    });
  }

  async open18d1(cb) {
    debug('in Accessory Mode!');
    [this.usbDevice.iface] = this.usbDevice.configuration.interfaces;
    this.usbDevice.claimInterface(this.usbDevice.iface.interfaceNumber);

    [this.inEndpoint, this.outEndpoint] = this.usbDevice.iface.alternate.endpoints;

    return cb(null);
  }

  static buildSettingPacket(payload, commandBody) {
    const md5 = crypto
      .createHash('md5')
      .update(new DataView(payload))
      .digest();

    const commandBodyView = new DataView(commandBody);

    const data = concatArrayBuffer(payload, md5);

    commandBodyView.setUint32(4, data.byteLength, true); // Length

    const crc8 = cRC8(concatArrayBuffer(commandBody.slice(0, 3), commandBody.slice(4)));
    commandBodyView.setUint8(3, crc8); // Checksum_CRC8

    const command = packFrame(commandBody);

    const packet = concatArrayBuffer(command, data);

    return packet;
  }

  static parseSettingPacket(packet, name, cb) {
    const command = WeitaiUSB.getCommand(packet);

    if (command.length < 12) {
      return cb(new Error('Command length check failed'), null);
    }
    const commandBody = unpackFrame(command);
    const commandBodyView = new DataView(commandBody);
    const crc8 = commandBodyView.getUint8(3);
    const length = commandBodyView.getInt32(4, true);

    const crc8C = cRC8(concatArrayBuffer(commandBody.slice(0, 3), commandBody.slice(4)));

    if (crc8 !== crc8C) {
      return cb(new Error('CRC-8 check failed'), null);
    }

    if (packet.byteLength < command.byteLength + length) {
      return cb(new Error('Packet length check failed'), null);
    }

    const data = packet.slice(command.byteLength, command.byteLength + length);

    const payload = data.slice(0, data.byteLength - 16);
    const md5 = data.slice(data.byteLength - 16, data.byteLength);

    const md5C = crypto
      .createHash('md5')
      .update(new DataView(payload))
      .digest();

    if (!_.isEqual(new Uint8Array(md5), md5C)) {
      return cb(new Error('MD5 check failed'), null);
    }
    let inComeRes = [];
    if (name === 'name') {
      inComeRes = WeitaiUSB.parseSettingAndNamePayload(payload, cb);
    } else if (name === 'PDASN') {
      inComeRes = WeitaiUSB.parseSnPayload(payload, cb);
    } else if (name === 'PDADATE') {
      inComeRes = WeitaiUSB.parseDatePayload(payload, cb);
    } else {
      inComeRes = WeitaiUSB.parseSettingPayload(payload, cb);
    }
    return inComeRes;
  }

  static parseDatePayload(payload, cb) {
    if (payload.byteLength === 0) {
      return cb({ code: 'E_READ_FILE' }, null);
    }
    const dateTime = payload;

    const year = uintFromArrayBuffer(dateTime.slice(0, 1), true) + 2000;
    const month = uintFromArrayBuffer(dateTime.slice(1, 2), true);
    const day = uintFromArrayBuffer(dateTime.slice(2, 3), true);
    const hour = uintFromArrayBuffer(dateTime.slice(3, 4), true);
    const minute = uintFromArrayBuffer(dateTime.slice(4, 5), true);
    const second = uintFromArrayBuffer(dateTime.slice(5, 6), true);
    const pdaDate = `${year}-${(month + 100).toString().substring(1)}-${(day + 100).toString().substring(1)}T${(hour + 100).toString().substring(1)}:${(minute + 100).toString().substring(1)}:${(second + 100).toString().substring(1)}`;
    debug('pdaDate', pdaDate);
    return pdaDate;
  }

  static parseSnPayload(payload, cb) {
    if (payload.byteLength === 0) {
      return cb({ code: 'E_READ_FILE' }, null);
    }
    const pdaSn = uint8ArrayToString(new Uint8Array(payload));
    debug('pdaSn', pdaSn);
    return pdaSn;
  }

  static parseSettingAndNamePayload(payload, cb) {
    const inComeRes = [];
    if (payload.byteLength === 0) {
      return cb({ code: 'E_READ_FILE' }, null);
    }

    const slice = payload.slice(96);
    const sliceArray = [];
    let name = '';
    if (slice.length) {
      for (let b = 0; b < slice.byteLength; b++) {
        sliceArray[b] = slice[b];
      }
      let encoded = '';
      for (let i = 0; i < sliceArray.length; i++) {
        encoded += `%${sliceArray[i].toString(16)}`;
      }
      name = decodeURIComponent(encoded);
      debug('payload', decodeURIComponent(encoded));
    }

    for (let i = 0; i < 96; i += 2) {
      const history = payload.slice(i, i + 2);
      const lowerRes = uintFromArrayBuffer(history, true);
      inComeRes.push(lowerRes);
    }
    return { name, inComeRes };
  }

  static parseSettingPayload(payload, cb) {
    const inComeRes = [];
    if (payload.byteLength === 0) {
      return cb(new Error('No data'), null);
    }

    for (let i = 0; i < payload.byteLength; i += 2) {
      const history = payload.slice(i, i + 2);
      const lowerRes = uintFromArrayBuffer(history, true);
      inComeRes.push(lowerRes);
    }
    return { inComeRes };
  }

  static buildPacket(payload) {
    const md5 = crypto
      .createHash('md5')
      .update(new DataView(payload))
      .digest();
    const data = concatArrayBuffer(payload, md5);

    const commandBody = new ArrayBuffer(8);
    const commandBodyView = new DataView(commandBody);

    commandBodyView.setUint8(0, 0x05); // Port
    commandBodyView.setUint8(1, 0x01); // Parameter
    commandBodyView.setUint8(2, 0x02); // Operation
    commandBodyView.setUint32(4, data.byteLength, true); // Length

    const crc8 = cRC8(concatArrayBuffer(commandBody.slice(0, 3), commandBody.slice(4)));
    commandBodyView.setUint8(3, crc8);

    const command = packFrame(commandBody);

    const packet = concatArrayBuffer(command, data);

    return packet;
  }

  static parsePacket(packet, cfg, cb) {
    const command = WeitaiUSB.getCommand(packet);

    if (command.length < 12) {
      return false;
    }
    const commandBody = unpackFrame(command);
    const commandBodyView = new DataView(commandBody);

    const crc8 = commandBodyView.getUint8(3);
    const length = commandBodyView.getInt32(4, true);

    const crc8C = cRC8(concatArrayBuffer(commandBody.slice(0, 3), commandBody.slice(4)));

    if (crc8 !== crc8C) {
      return cb(new Error('CRC8 checksums not matching'), null);
    }

    if (packet.byteLength < command.byteLength + length) {
      return cb(new Error('Incorrect packet length'), null);
    }

    const data = packet.slice(command.byteLength, command.byteLength + length);

    const payload = data.slice(0, data.byteLength - 16);
    const md5 = data.slice(data.byteLength - 16, data.byteLength);

    const md5C = crypto
      .createHash('md5')
      .update(new DataView(payload))
      .digest();

    if (!_.isEqual(new Uint8Array(md5), md5C)) {
      return cb(new Error('MD5 checksums not matching'), null);
    }

    const inComeRes = WeitaiUSB.parsePayload(payload, cfg, cb);

    return inComeRes;
  }

  static parsePayload(payload, cfg, cb) {
    const inComeRes = {
      BloodGlucoses: [],
      BasalRates: [],
      BolusRates: [],
      alarm: [],
      status: [],
      reservoirChanges: [],
      primes: [],
      sn: 0,
      snObj: {},
    };

    if (payload.byteLength === 0) {
      return cb({ code: 'E_READ_FILE' }, null);
    }

    if (payload.byteLength % 28) {
      return cb(new Error('Incorrect payload length'), null);
    }
    let suspendTime = '';
    for (let i = 0; i < payload.byteLength; i += 28) {
      const history = payload.slice(i, i + 28);

      const ID = history.slice(0, 4);
      const SN = history.slice(4, 10);
      const dateTime = history.slice(10, 16);
      const status = history.slice(16, 22);
      const event = history.slice(22, 28);

      const recordID = uintFromArrayBuffer(ID, true);
      const deviceSn = uint8ArrayToString(SN);

      const year = uintFromArrayBuffer(dateTime.slice(0, 1), true) + 2000;
      const month = uintFromArrayBuffer(dateTime.slice(1, 2), true);
      const day = uintFromArrayBuffer(dateTime.slice(2, 3), true);
      const hour = uintFromArrayBuffer(dateTime.slice(3, 4), true);
      const minute = uintFromArrayBuffer(dateTime.slice(4, 5), true);
      const second = uintFromArrayBuffer(dateTime.slice(5, 6), true);

      const battery = uintFromArrayBuffer(status.slice(0, 1), true);
      const reservoir = uintFromArrayBuffer(status.slice(1, 2), true);
      const basalRate = uintFromArrayBuffer(status.slice(2, 4), true);
      const bolusRate = uintFromArrayBuffer(status.slice(4, 6), true);

      const eventIndex = uintFromArrayBuffer(event.slice(0, 2), true);
      const eventPort = uintFromArrayBuffer(event.slice(2, 3), true);
      const eventType = uintFromArrayBuffer(event.slice(3, 4), true);
      const eventUrgency = uintFromArrayBuffer(event.slice(4, 5), true);
      const eventValue = uintFromArrayBuffer(event.slice(5, 6), true);

      // eslint-disable-next-line prefer-template
      const timeText =
        year +
        '-' +
        (month + 100).toString().substring(1) +
        '-' +
        (day + 100).toString().substring(1) +
        'T' +
        (hour + 100).toString().substring(1) +
        ':' +
        (minute + 100).toString().substring(1) +
        ':' +
        (second + 100).toString().substring(1);
      const recoder = {
        deviceTime: timeText,
        recordId: recordID,
        eventPort,
        deviceSn,
      };

      if (SN === '000000') {
        continue;
      }

      if (eventPort === 4 && eventType === 1 && eventUrgency === 1) {
        inComeRes.alarm.push({
          index: recordID,
          type: 'low_insulin',
          deviceTime: timeText,
        });
      }

      if (eventPort === 4 && eventType === 5 && eventUrgency === 0) {
        inComeRes.status.push({
          index: recordID,
          type: 'suspend',
          deviceTime: timeText,
        });
        suspendTime = timeText;
        // add suspend basal
        const basalRecorderLength = inComeRes.BasalRates.length;
        if (basalRecorderLength
          && inComeRes.BasalRates[basalRecorderLength - 1].deviceTime !== timeText) {
          recoder.BasalRate = parseInt(formatString(basalRate), 10) * 0.00625;
          recoder.deliveryType = 'suspend';
          inComeRes.BasalRates.push(recoder);
        }
      }

      if (eventPort === 4 && eventType === 1 && eventUrgency === 2) {
        inComeRes.alarm.push({
          index: recordID,
          type: 'no_insulin',
          deviceTime: timeText,
        });
      }

      if (eventPort === 5 && eventType === 0 && eventUrgency === 1) {
        inComeRes.alarm.push({
          index: recordID,
          type: 'low_power',
          deviceTime: timeText,
        });
      }

      if (eventPort === 5 && eventType === 0 && eventUrgency === 2) {
        inComeRes.alarm.push({
          index: recordID,
          type: 'no_power',
          deviceTime: timeText,
        });
      }

      if (eventPort === 4 && eventType === 6 && eventUrgency === 2) {
        inComeRes.alarm.push({
          index: recordID,
          type: 'auto_off',
          deviceTime: timeText,
        });
      }

      if (eventPort === 4 && eventType === 2) {
        inComeRes.alarm.push({
          index: recordID,
          type: 'occlusion',
          deviceTime: timeText,
        });
      }

      if (eventPort === 4 && eventType === 8) {
        inComeRes.reservoirChanges.push({
          index: recordID,
          type: 'reservoirChanges',
          deviceTime: timeText,
        });
        suspendTime = timeText;
        // add suspend basal
        const basalRecorderLength = inComeRes.BasalRates.length;
        if (basalRecorderLength
          && inComeRes.BasalRates[basalRecorderLength - 1].deviceTime !== timeText) {
          recoder.BasalRate = parseInt(formatString(basalRate), 10) * 0.00625;
          recoder.deliveryType = 'suspend';
          inComeRes.BasalRates.push(recoder);
        }
      }

      if (eventPort === 4 && eventType === 7) {
        inComeRes.primes.push({
          index: recordID,
          type: 'prime',
          deviceTime: timeText,
        });
      }

      if (eventPort === 4 && eventType === 3) {
        inComeRes.alarm.push({
          index: recordID,
          type: 'occlusion',
          deviceTime: timeText,
        });
      }

      if (eventPort === 3 && eventType === 0) {
        recoder.BloodGlucose = formatString(basalRate);
        inComeRes.BloodGlucoses.push(recoder);
        continue;
      }

      // Carbohydrate
      if (eventPort === 3 && eventType === 1) {
        continue;
      }

      // Basal
      if (eventPort === 4 && eventType === 0 && eventUrgency === 0) {
        if (suspendTime === timeText) {
          continue;
        }
        recoder.BasalRate = parseInt(formatString(basalRate), 10) * 0.00625;
        inComeRes.BasalRates.push(recoder);
      }

      // BolusRate
      if (parseInt(formatString(bolusRate), 10) === 0) {
        if (
          inComeRes.BolusRates[inComeRes.BolusRates.length - 1] &&
          parseInt(
            inComeRes.BolusRates[inComeRes.BolusRates.length - 1].BolusRate,
            10,
          ) !== 0
        ) {
          recoder.BolusRate = formatString(bolusRate);
          inComeRes.BolusRates.push(recoder);
        } else if (!inComeRes.BolusRates.length) {
          recoder.BolusRate = formatString(bolusRate);
          inComeRes.BolusRates.push(recoder);
        }
      }
      if (parseInt(formatString(bolusRate), 10) !== 0) {
        recoder.BolusRate = formatString(bolusRate);
        inComeRes.BolusRates.push(recoder);
      }

      const text1 = (recordID + 1000).toString().substring(1);
      const text2 =
        year +
        '-' +
        (month + 100).toString().substring(1) +
        '-' +
        (day + 100).toString().substring(1) +
        ' ' +
        (hour + 100).toString().substring(1) +
        ':' +
        (minute + 100).toString().substring(1) +
        ':' +
        (second + 100).toString().substring(1);

      const text3 =
        ' Battery/Flag: ' +
        formatString(battery) +
        ' Reservoir/Type: ' +
        formatString(reservoir) +
        ' BasalRate/BloodGlucose: ' +
        formatString(basalRate) +
        ' BolusRate/Carbohydrate: ' +
        formatString(bolusRate);

      const text4 =
        ' EventIndex: ' +
        formatString(eventIndex) +
        ' EventPort: ' +
        eventPort +
        ' EventType: ' +
        eventType +
        ' EventUrgency: ' +
        eventUrgency +
        ' EventValue: ' +
        eventValue;

      debug(text1, text2, text3, text4);
    }
    return inComeRes;
  }

  static getCommand(buf) {
    const buffer = new Uint8Array(buf);
    let begin = -1;
    let end = -1;
    for (let i = 0; i < buffer.byteLength - 1; ++i) {
      if (begin < 0) {
        const c1 = buffer[i];
        const c2 = buffer[i + 1];
        if (c1 === 0x2b && c2 === 0x2b) {
          begin = i;
          i += 1;
        }
      } else {
        const c1 = buffer[i];
        const c2 = buffer[i + 1];
        if (c1 === 0x2b && c2 === 0x2b) {
          end = i + 1;
          break;
        }
      }
    }
    if (begin < 0 || end < 0) {
      return new ArrayBuffer(0);
    }
    return buffer.slice(begin, end + 1);
  }

  async getPdaSn(cb) {
    let done = false;
    let count = 1;
    let pdaSn = 'unkonwSn';
    let commandBodyLength = 0;
    const payloadBuf = new ArrayBuffer(4);
    const payload = new DataView(payloadBuf);
    const commandBodyBuf = new ArrayBuffer(8);
    let commandBody = new DataView(commandBodyBuf);
    payload.setUint8(0, 0x00);
    payload.setUint8(1, 0x00);
    payload.setUint8(2, 0x00);
    payload.setUint8(3, 0x00);

    commandBody.setUint8(0, 0x00); // Port
    commandBody.setUint8(1, 0x07); // Parameter
    commandBody.setUint8(2, 0x02); // Operation
    const buffer = WeitaiUSB.buildSettingPacket(payloadBuf, commandBodyBuf);
    await this.usbDevice.transferOut(this.outEndpoint.endpointNumber, buffer);
    let incomingA = new ArrayBuffer();
    while (!done) {
      /* eslint-disable no-loop-func */
      // eslint-disable-next-line no-await-in-loop
      await this.usbDevice
        .transferIn(this.inEndpoint.endpointNumber, 10240)
        .then((res) => {
          const incoming = res;
          console.log(incoming.data.buffer.byteLength);
          incomingA = concatArrayBuffer(incomingA, incoming.data.buffer);
          debug('Received', common.bytes2hex(new Uint8Array(incoming.data.buffer)));
          if (count === 1) {
            const command = WeitaiUSB.getCommand(incomingA);
            commandBody = unpackFrame(command);
            const commandBodyView = new DataView(commandBody);
            commandBodyLength = commandBodyView.getInt32(4, true);
            count += 1;
          } else {
            commandBodyLength -= incoming.data.buffer.byteLength;
            if (commandBodyLength === 0) {
              done = true;
              pdaSn = WeitaiUSB.parseSettingPacket(incomingA, 'PDASN', cb);
            }
          }
        });
      /* eslint-enable no-loop-func */
    }
    return pdaSn;
  }

  async getPdaDate(cb) {
    let done = false;
    let count = 1;
    let pdaDate = '';
    let commandBodyLength = 0;
    const payloadBuf = new ArrayBuffer(4);
    const payload = new DataView(payloadBuf);
    const commandBodyBuf = new ArrayBuffer(8);
    let commandBody = new DataView(commandBodyBuf);
    payload.setUint8(0, 0x00);
    payload.setUint8(1, 0x00);
    payload.setUint8(2, 0x00);
    payload.setUint8(3, 0x00);

    commandBody.setUint8(0, 0x05); // Port
    commandBody.setUint8(1, 0x00); // Parameter
    commandBody.setUint8(2, 0x02); // Operation
    const buffer = WeitaiUSB.buildSettingPacket(payloadBuf, commandBodyBuf);
    await this.usbDevice.transferOut(this.outEndpoint.endpointNumber, buffer);
    let incomingA = new ArrayBuffer();
    while (!done) {
      /* eslint-disable no-loop-func */
      // eslint-disable-next-line no-await-in-loop
      await this.usbDevice
        .transferIn(this.inEndpoint.endpointNumber, 10240)
        .then((res) => {
          const incoming = res;
          console.log(incoming.data.buffer.byteLength);
          incomingA = concatArrayBuffer(incomingA, incoming.data.buffer);
          debug('Received', common.bytes2hex(new Uint8Array(incoming.data.buffer)));
          if (count === 1) {
            const command = WeitaiUSB.getCommand(incomingA);
            commandBody = unpackFrame(command);
            const commandBodyView = new DataView(commandBody);
            commandBodyLength = commandBodyView.getInt32(4, true);
            count += 1;
          } else {
            commandBodyLength -= incoming.data.buffer.byteLength;
            if (commandBodyLength === 0) {
              done = true;
              pdaDate = WeitaiUSB.parseSettingPacket(incomingA, 'PDADATE', cb);
            }
          }
        });
    }
    return pdaDate;
  }

  async getConfig(data, cb) {
    this.current = 0;
    let settings = {};
    try {
      for (let i = 0; i < this.setTypes.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        settings = await this.getSetting(cb);
      }
    } catch (e) {
      if (e.message === 'LIBUSB_TRANSFER_TIMED_OUT') {
        return cb({ code: 'E_UNPLUG_AND_RETRY' }, null);
      }
      return cb({ code: 'E_READ_FILE' }, null);
    }
    let pdaSn = '';
    let pdaDate = '';
    try {
      pdaSn = await this.getPdaSn(cb);
    } catch (e) {
      debug(e);
      return cb({ code: 'E_READ_FILE' }, null);
    }
    try {
      pdaDate = await this.getPdaDate(cb);
    } catch (e) {
      debug(e);
      return cb({ code: 'E_READ_FILE' }, null);
    }
    let done = false;
    let count = 1;
    let commandBodyLength = 0;
    const buffer = WeitaiUSB.buildPacket(new ArrayBuffer());
    await this.usbDevice.transferOut(this.outEndpoint.endpointNumber, buffer);
    let incomingA = new ArrayBuffer(0);
    while (!done) {
      /* eslint-disable no-loop-func */
      // eslint-disable-next-line no-await-in-loop
      await this.usbDevice
        .transferIn(this.inEndpoint.endpointNumber, 10240)
        .then((res) => {
          const incoming = res;
          incomingA = concatArrayBuffer(incomingA, incoming.data.buffer);
          debug('Received', common.bytes2hex(new Uint8Array(incoming.data.buffer)));
          if (count === 1) {
            const command = WeitaiUSB.getCommand(incomingA);
            const commandBody = unpackFrame(command);
            const commandBodyView = new DataView(commandBody);
            commandBodyLength = commandBodyView.getInt32(4, true);
            count += 1;
          } else {
            commandBodyLength -= incoming.data.buffer.byteLength;
            if (commandBodyLength === 0) {
              done = true;
            }
          }
        });
      /* eslint-enable no-loop-func */
    }
    this.cfg.deviceInfo.deviceId = `equil-${pdaSn}`;
    this.cfg.deviceInfo.serialNumber = pdaSn;
    data.incomingA = incomingA;
    data.settings = settings;
    data.pdaSn = pdaSn;
    data.pdaDate = pdaDate;
    return data;
  }

  current = 0;

  settingUpload = {};

  setTypes = [
    'lowBg',
    'highBg',
    'defaultCho',
    'sensitiveSilver',
    'originBasal',
    'bolusRate',
    'maxBolus',
    'doubleBolus',
    'effectiveTime',
    'program0',
    'program1',
    'program2',
  ];

  async getSetting(cb) {
    let done = false;
    let incomingA = new ArrayBuffer(0);
    let counter = 1;
    let commandBodyLength = 0;
    const payloadBuf = new ArrayBuffer(4);
    const payload = new DataView(payloadBuf);
    const commandBodyBuf = new ArrayBuffer(8);
    let commandBody = new DataView(commandBodyBuf);
    payload.setUint8(0, 0x01);
    payload.setUint8(1, 0x00);
    payload.setUint8(2, 0x00);
    payload.setUint8(3, 0x00);

    commandBody.setUint8(0, 0x03); // Port
    commandBody.setUint8(1, 0x11); // Parameter
    commandBody.setUint8(2, 0x02); // Operation
    if (this.current === 1) {
      // high bg
      payload.setUint8(0, 0x00);
      payload.setUint8(1, 0x00);
      payload.setUint8(2, 0x00);
      payload.setUint8(3, 0x00);

      commandBody.setUint8(0, 0x03); // Port
      commandBody.setUint8(1, 0x11); // Parameter
      commandBody.setUint8(2, 0x02); // Operation
    }
    if (this.current === 2) {
      // carb ratio
      payload.setUint8(0, 0x02);
      payload.setUint8(1, 0x00);
      payload.setUint8(2, 0x00);
      payload.setUint8(3, 0x00);

      commandBody.setUint8(0, 0x03); // Port
      commandBody.setUint8(1, 0x11); // Parameter
      commandBody.setUint8(2, 0x02); // Operation
    }
    if (this.current === 3) {
      // sensitiveSilver
      payload.setUint8(0, 0x03);
      payload.setUint8(1, 0x00);
      payload.setUint8(2, 0x00);
      payload.setUint8(3, 0x00);

      commandBody.setUint8(0, 0x03); // Port
      commandBody.setUint8(1, 0x11); // Parameter
      commandBody.setUint8(2, 0x02); // Operation
    }
    if (this.current === 4) {
      // originBasal
      payload.setUint8(0, 0x0c);
      payload.setUint8(1, 0x00);
      payload.setUint8(2, 0x00);
      payload.setUint8(3, 0x00);

      commandBody.setUint8(0, 0x04); // Port
      commandBody.setUint8(1, 0x05); // Parameter
      commandBody.setUint8(2, 0x02); // Operation
    }

    if (this.current === 5) {
      // bolusRate
      payload.setUint8(0, 0x0a);
      payload.setUint8(1, 0x00);
      payload.setUint8(2, 0x00);
      payload.setUint8(3, 0x00);

      commandBody.setUint8(0, 0x04); // Port
      commandBody.setUint8(1, 0x05); // Parameter
      commandBody.setUint8(2, 0x02); // Operation
    }
    if (this.current === 6) {
      // maxBolus
      payload.setUint8(0, 0x08);
      payload.setUint8(1, 0x00);
      payload.setUint8(2, 0x00);
      payload.setUint8(3, 0x00);

      commandBody.setUint8(0, 0x04); // Port
      commandBody.setUint8(1, 0x05); // Parameter
      commandBody.setUint8(2, 0x02); // Operation
    }

    if (this.current === 7) {
      // doubleBolus
      payload.setUint8(0, 0x0d);
      payload.setUint8(1, 0x00);
      payload.setUint8(2, 0x00);
      payload.setUint8(3, 0x00);

      commandBody.setUint8(0, 0x04); // Port
      commandBody.setUint8(1, 0x05); // Parameter
      commandBody.setUint8(2, 0x02); // Operation
    }
    if (this.current === 8) {
      // effectiveTime
      payload.setUint8(0, 0x03);
      payload.setUint8(1, 0x00);
      payload.setUint8(2, 0x00);
      payload.setUint8(3, 0x00);

      commandBody.setUint8(0, 0x03); // Port
      commandBody.setUint8(1, 0x10); // Parameter
      commandBody.setUint8(2, 0x02); // Operation
    }
    if (this.current === 9) {
      // program 0
      payload.setUint8(0, 0x00);
      payload.setUint8(1, 0x00);
      payload.setUint8(2, 0x00);
      payload.setUint8(3, 0x00);

      commandBody.setUint8(0, 0x04); // Port
      commandBody.setUint8(1, 0x02); // Parameter
      commandBody.setUint8(2, 0x02); // Operation
    }
    if (this.current === 10) {
      // program 1
      payload.setUint8(0, 0x01);
      payload.setUint8(1, 0x00);
      payload.setUint8(2, 0x00);
      payload.setUint8(3, 0x00);

      commandBody.setUint8(0, 0x04); // Port
      commandBody.setUint8(1, 0x02); // Parameter
      commandBody.setUint8(2, 0x02); // Operation
    }
    if (this.current === 11) {
      // program 2
      payload.setUint8(0, 0x02);
      payload.setUint8(1, 0x00);
      payload.setUint8(2, 0x00);
      payload.setUint8(3, 0x00);

      commandBody.setUint8(0, 0x04); // Port
      commandBody.setUint8(1, 0x02); // Parameter
      commandBody.setUint8(2, 0x02); // Operation
    }
    const buffer = WeitaiUSB.buildSettingPacket(payloadBuf, commandBodyBuf);
    await this.usbDevice.transferOut(this.outEndpoint.endpointNumber, buffer);
    while (!done) {
      /* eslint-disable no-loop-func */
      // eslint-disable-next-line no-await-in-loop
      await this.usbDevice
        .transferIn(this.inEndpoint.endpointNumber, 10240)
        .then((res) => {
          const incoming = res;
          incomingA = concatArrayBuffer(incomingA, incoming.data.buffer);
          if (counter === 1) {
            const command = WeitaiUSB.getCommand(incomingA);
            commandBody = unpackFrame(command);
            const commandBodyView = new DataView(commandBody);
            commandBodyLength = commandBodyView.getInt32(4, true);
            counter += 1;
          } else {
            commandBodyLength -= incoming.data.buffer.byteLength;
            if (commandBodyLength === 0) {
              done = true;
              let inComeRes = {};
              if (this.current > 8) {
                inComeRes = WeitaiUSB.parseSettingPacket(incomingA, 'name', cb);
              } else {
                inComeRes = WeitaiUSB.parseSettingPacket(incomingA, '', cb);
              }
              this.settingUpload[this.setTypes[this.current]] =
                inComeRes.inComeRes;
              this.settingUpload[this.setTypes[this.current] + '_name'] =
                inComeRes.name;
              this.current += 1;
            }
          }
        });
      /* eslint-enable no-loop-func */
    }
    return this.settingUpload;
  }

  async close(cb) {
    try {
      this.usbDevice.close();
      cb();
    } catch (err) {
      return cb(err, null);
    }
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  _.assign(cfg.deviceInfo, {
    tags: ['insulin-pump'],
    manufacturers: ['MicroTech'],
  });
  const driver = new WeitaiUSB(cfg);

  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

  return {
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
        // start
        const result = await driver.getConfig(data, cb);
        if (result) {
          data.deviceDetails = result;
          _.assign(cfg.deviceInfo, {
            deviceTime: data.pdaDate,
            deviceId: `equil-${data.pdaSn}`,
            model: 'equil',
            serialNumber: data.pdaSn,
            timezoneOffset: 0,
          });
          common.checkDeviceTime(cfg, (timeErr) => {
            cfg.pdaDate = data.pdaDate;
            cb(timeErr, data);
          });
        }
      })().catch((error) => {
        debug('Error in getConfigInfo: ', error);
        cb(error, null);
      });
    },

    buildBasalSchedules(settings) {
      // carbRatio
      const choList = settings.defaultCho;
      const carbRatio = [];
      for (let c = 0; c < choList.length; c++) {
        if (c === 0) {
          carbRatio.push({
            amount: choList[c],
            start: 0,
          });
        } else {
          const choLgth = carbRatio.length;
          const carbLastOne = carbRatio[choLgth - 1].amount;
          if (choList[c] !== carbLastOne) {
            carbRatio.push({
              amount: choList[c],
              start: c * 30 * 60 * 1000,
            });
          }
        }
      }

      // insulinSensitivity
      const senList = settings.sensitiveSilver;
      const insulinSensitivity = [];
      for (let c = 0; c < senList.length; c++) {
        if (c === 0) {
          insulinSensitivity.push({
            amount: senList[c] / 10,
            start: 0,
          });
        } else {
          const senLgtn = insulinSensitivity.length;
          const senLastOne = insulinSensitivity[senLgtn - 1].amount * 10;
          if (senList[c] !== senLastOne) {
            insulinSensitivity.push({
              amount: senList[c] / 10,
              start: c * 30 * 60 * 1000,
            });
          }
        }
      }

      const bgList = settings.lowBg;
      const bgHighList = settings.highBg;
      if (bgHighList.length > 1) {
        // remove default value
        bgList.pop();
        bgHighList.pop();
      }
      const bgTarget = [];
      for (let c = 0; c < bgList.length; c++) {
        if (c === 0) {
          bgTarget.push({
            start: 0,
            low: parseInt(bgList[0] / 10, 10),
            high: parseInt(bgHighList[0] / 10, 10),
          });
        } else {
          const targetLength = bgTarget.length;
          const mergerLow = bgList[c] / 10;
          const mergerHigh = bgHighList[c] / 10;
          if (mergerLow !== bgTarget[targetLength - 1].low || mergerHigh !== bgTarget[targetLength - 1].high) {
            bgTarget.push({
              start: 30 * 60 * 1000 * c,
              low: mergerLow,
              high: mergerHigh,
            });
          }
        }
      }

      // basalSchedules
      const basalSchedules = {};
      for (let i = 0; i < 3; i++) {
        const nameIndex = 'program' + i + '_name';
        const name = settings[nameIndex] || 'Program ' + (i + 1);
        const basalList = settings['program' + i] || [];
        basalSchedules[name] = [];
        if (basalList.length) {
          for (let b = 0; b < basalList.length; b++) {
            if (b === 0) {
              basalSchedules[name].push({
                start: 0,
                rate: parseFloat((basalList[b] * 0.0125).toFixed(3)),
              });
            } else if (basalList[b] !== basalList[b - 1]) {
              basalSchedules[name].push({
                start: b * 30 * 60 * 1000,
                rate: parseFloat((basalList[b] * 0.0125).toFixed(3)),
              });
            }
          }
        }
      }
      return {
        carbRatio,
        insulinSensitivity,
        bgTarget,
        basalSchedules,
      };
    },

    buildSettings(settings) {
      // basalSchedules
      const settingRes = this.buildBasalSchedules(settings);
      const postsettings = cfg.builder
        .makePumpSettings()
        .with_activeSchedule('unknown')
        .with_units({ carb: 'grams', bg: 'mg/dL' })
        .with_basalSchedules(settingRes.basalSchedules)
        .with_carbRatio(settingRes.carbRatio)
        .with_insulinSensitivity(settingRes.insulinSensitivity)
        .with_bgTarget(settingRes.bgTarget)
        .with_manufacturers(['Microtech'])
        .with_serialNumber(cfg.deviceInfo.serialNumber)
        .with_deviceTime(cfg.pdaDate)
        .with_time(
          sundial.applyTimezone(new Date(), cfg.timezone).toISOString(),
        )
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .done();

      return postsettings;
    },

    buildBlood(BloodGlucoses) {
      const res = [];
      for (const blood of BloodGlucoses) {
        const recordBuilder = cfg.builder
          .makeSMBG()
          .with_value(parseFloat(blood.BloodGlucose))
          .with_units('mg/dL') // values are always in 'mg/dL'
          .with_deviceTime(blood.deviceTime)
          .set('index', blood.recordId);

        cfg.tzoUtil.fillInUTCInfo(
          recordBuilder,
          sundial.parseFromFormat(blood.deviceTime),
        );
        const postRecord = recordBuilder.done();
        delete postRecord.index;
        res.push(postRecord);
      }
      return res;
    },

    buildBasal(BasalRates) {
      const res = [];
      BasalRates.sort((a, b) => (a.deviceTime < b.deviceTime ? -1 : 1));
      for (let i = 0; i < BasalRates.length; i++) {
        const currDu = new Date(BasalRates[i].deviceTime).valueOf();
        const nextDu = BasalRates[i + 1]
          ? new Date(BasalRates[i + 1].deviceTime).valueOf()
          : currDu + 1000;
        if (nextDu - currDu < 0) {
          debug('error-basal', BasalRates[i]);
        }
        if (i === BasalRates.length - 1) {
          break;
        }
        const currentDur = (nextDu - currDu) < 604800000 ? (nextDu - currDu) : 604799999;
        let basalBuilder = '';
        if (BasalRates[i].deliveryType === 'suspend') {
          basalBuilder = cfg.builder
            .makeSuspendBasal()
            .with_deviceTime(BasalRates[i].deviceTime)
            .with_duration(currentDur)
            .set('index', BasalRates[i].recordId);
        } else {
          basalBuilder = cfg.builder
            .makeScheduledBasal()
            .with_deviceTime(BasalRates[i].deviceTime)
            .with_rate(parseFloat(BasalRates[i].BasalRate.toFixed(3)))
            .with_duration(currentDur)
            .set('index', BasalRates[i].recordId);
        }
        cfg.tzoUtil.fillInUTCInfo(
          basalBuilder,
          sundial.parseFromFormat(BasalRates[i].deviceTime),
        );
        const postRecord = basalBuilder.done();
        if (res[i - 1]) {
          let preRes = JSON.stringify(res[i - 1]);
          preRes = JSON.parse(preRes);
          delete preRes.previous;
          postRecord.previous = preRes;
        }
        res.push(postRecord);
      }
      return res;
    },

    buildBolus(BolusRates) {
      let postRes = [];
      let itemRes = [];
      for (const bolus of BolusRates) {
        if (!itemRes.length) {
          itemRes.push(bolus);
          continue;
        }
        if (bolus.BolusRate === '0') {
          itemRes.push(bolus);
          const chckRes = this.checkBolus(itemRes);
          if (chckRes === 'normal') {
            const postAary = this.buildBolusNormal(itemRes);
            postRes = postRes.concat(postAary);
          }
          if (chckRes === 'square') {
            const postAary = this.buildBolusSquare(itemRes);
            postRes = postRes.concat(postAary);
          }
          if (chckRes === 'dulSquare') {
            const postAary = this.buildBolusDualSquare(itemRes);
            postRes = postRes.concat(postAary);
          }
          itemRes = [];
          continue;
        } else {
          itemRes.push(bolus);
          continue;
        }
      }
      return postRes;
    },
    checkBolus(blous) {
      let normal = false;
      let square = false;
      let returnStr = '';
      for (const item of blous) {
        if (parseInt(item.BolusRate, 10) > 0 && parseInt(item.BolusRate, 10) <= 12800) {
          square = true;
        }
        if (parseInt(item.BolusRate, 10) > 12800) {
          normal = true;
        }
      }
      if (normal && square) {
        returnStr = 'dulSquare';
      }
      if (normal && !square) {
        returnStr = 'normal';
      }
      if (!normal && square) {
        returnStr = 'square';
      }
      return returnStr;
    },
    buildBolusNormal(bolus) {
      const bolusArray = [];
      for (let i = 0; i < bolus.length; i++) {
        if (bolus[i].BolusRate !== '0') {
          const currTimeStamp = new Date(bolus[i].deviceTime).valueOf();
          const nextTimeStamp = bolus[i + 1]
            ? new Date(bolus[i + 1].deviceTime).valueOf()
            : new Date(bolus[i].deviceTime).valueOf();
          const durCalcut = (nextTimeStamp - currTimeStamp) / 1000;
          const boluMount = this.buildValue(
            (parseInt(bolus[i].BolusRate, 10) * 0.00625 * durCalcut) / (60 * 60),
          );
          let postbolus = cfg.builder
            .makeNormalBolus()
            .with_normal(parseFloat(boluMount.toFixed(3)))
            .with_deviceTime(bolus[i].deviceTime)
            .set('index', bolus[i].recordId);
          cfg.tzoUtil.fillInUTCInfo(
            postbolus,
            sundial.parseFromFormat(bolus[i].deviceTime),
          );
          postbolus = postbolus.done();
          bolusArray.push(postbolus);
        }
      }
      return bolusArray;
    },

    buildBolusSquare(bolus) {
      const bolusArray = [];
      for (let i = 0; i < bolus.length; i++) {
        if (bolus[i].BolusRate !== '0') {
          const currTimeStamp = new Date(bolus[i].deviceTime).valueOf();
          const nextTimeStamp = bolus[i + 1]
            ? new Date(bolus[i + 1].deviceTime).valueOf()
            : new Date(bolus[i].deviceTime).valueOf();
          const durCalcut = (nextTimeStamp - currTimeStamp) / 1000;
          const boluMount = this.buildValue(
            (parseInt(bolus[i].BolusRate, 10) * 0.00625 * durCalcut) / (60 * 60),
          );
          let postbolus = cfg.builder
            .makeSquareBolus()
            .with_deviceTime(bolus[i].deviceTime)
            .with_extended(parseFloat(boluMount.toFixed(3)))
            .with_duration(nextTimeStamp - currTimeStamp)
            .set('index', bolus[i].recordId);
          cfg.tzoUtil.fillInUTCInfo(
            postbolus,
            sundial.parseFromFormat(bolus[i].deviceTime),
          );
          postbolus = postbolus.done();
          if (postbolus.extended > 0) {
            // The Equil pump does not record expected extended values,
            // so we only record non-zero boluses
            bolusArray.push(postbolus);
          }
        }
      }
      return bolusArray;
    },

    buildBolusDualSquare(bolus) {
      const bolusArray = [];
      let normal = 0;
      let square = 0;
      let dur = 0;
      let deviceTime;
      let index = 0;
      for (let i = 0; i < bolus.length; i++) {
        const currTimeStamp = new Date(bolus[i].deviceTime).valueOf();
        const nextTimeStamp = bolus[i + 1]
          ? new Date(bolus[i + 1].deviceTime).valueOf()
          : new Date(bolus[i].deviceTime).valueOf();
        const currDur = nextTimeStamp - currTimeStamp;
        const durCalcut = (nextTimeStamp - currTimeStamp) / 1000;
        const boluMount =
          (parseInt(bolus[i].BolusRate, 10) * 0.00625 * durCalcut) / (60 * 60);
        if (bolus[i].BolusRate !== '0' && parseInt(bolus[i].BolusRate, 10) > 12800) {
          normal = boluMount + normal;
          deviceTime = bolus[i].deviceTime;
          index = bolus[i].recordId;
        }
        if (bolus[i].BolusRate !== '0' && parseInt(bolus[i].BolusRate, 10) < 12800) {
          square = boluMount + square;
          dur = currDur + dur;
        }
      }
      let postbolus = cfg.builder
        .makeDualBolus()
        .with_normal(parseFloat(this.buildValue(normal).toFixed(3)))
        .with_deviceTime(deviceTime)
        .with_extended(parseFloat(square))
        // .with_extended(0.0025)
        .with_duration(dur)
        .set('index', index);
      cfg.tzoUtil.fillInUTCInfo(postbolus, sundial.parseFromFormat(deviceTime));
      postbolus = postbolus.done();
      bolusArray.push(postbolus);
      return bolusArray;
    },

    buildValue(originValue) {
      const value = this.formatDecimal(originValue, 2);
      const res = (value * 1000) / 25;
      const floorRes = Math.floor(res);
      let floor = floorRes * 25;
      if (res > floorRes) {
        floor = (floor + 25) / 1000;
      } else {
        floor /= 1000;
      }
      return floor;
    },
    buildStatus(status) {
      const statusRes = [];
      for (const suspendresumedatum of status) {
        try {
          const suspend = cfg.builder.makeDeviceEventSuspend()
            .with_deviceTime(suspendresumedatum.deviceTime)
            .with_reason({ suspended: 'manual' })
            .set('index', suspendresumedatum.index);
          cfg.tzoUtil.fillInUTCInfo(suspend, sundial.parseFromFormat(suspendresumedatum.deviceTime));
          statusRes.push(suspend.done());
        } catch (e) {
          debug('alarm', e);
        }
      }
      return statusRes;
    },
    buildAlarm(alarmRecords) {
      const alarmRes = [];
      for (const alarmdatum of alarmRecords) {
        try {
          let alarmRecord = cfg.builder
            .makeDeviceEventAlarm()
            .with_deviceTime(alarmdatum.deviceTime)
            .set('index', alarmdatum.index)
            .with_alarmType(alarmdatum.type);
          cfg.tzoUtil.fillInUTCInfo(
            alarmRecord,
            sundial.parseFromFormat(alarmdatum.deviceTime),
          );
          alarmRecord = alarmRecord.done();
          alarmRes.push(alarmRecord);
        } catch (e) {
          debug('alarm', e);
        }
      }
      return alarmRes;
    },
    buildReservoirChange(resRecords) {
      const reservoirRes = [];
      for (const reservoir of resRecords) {
        try {
          let reservoirRecord = cfg.builder
            .makeDeviceEventReservoirChange()
            .with_deviceTime(reservoir.deviceTime)
            .set('index', reservoir.index);
          cfg.tzoUtil.fillInUTCInfo(
            reservoirRecord,
            sundial.parseFromFormat(reservoir.deviceTime),
          );
          reservoirRecord = reservoirRecord.done();
          reservoirRes.push(reservoirRecord);
        } catch (e) {
          debug('reservoir', e);
        }
      }
      return reservoirRes;
    },

    buildPrime(primeRecords) {
      const primeRes = [];
      for (const prime of primeRecords) {
        try {
          let primeRecord = cfg.builder
            .makeDeviceEventPrime()
            .with_deviceTime(prime.deviceTime)
            .with_primeTarget('cannula')
            .set('index', prime.index);
          cfg.tzoUtil.fillInUTCInfo(
            primeRecord,
            sundial.parseFromFormat(prime.deviceTime),
          );
          primeRecord = primeRecord.done();
          primeRes.push(primeRecord);
        } catch (e) {
          debug('prime', e);
        }
      }
      return primeRes;
    },

    formatDecimal(originnum, decimal) {
      const num = originnum.toString();
      const index = num.indexOf('.');
      let resNum = '';
      if (index !== -1) {
        resNum = num.substring(0, decimal + index + 1);
      } else {
        resNum = num.substring(0);
      }
      return parseFloat(resNum).toFixed(decimal);
    },

    fetchData(progress, data, cb) {
      const records = [];
      const { incomingA } = data;
      const inComeRes = WeitaiUSB.parsePacket(incomingA, cfg, cb);
      const returnData = data;
      returnData.BloodGlucoses = inComeRes.BloodGlucoses;
      returnData.BasalRates = inComeRes.BasalRates;
      returnData.BolusRates = inComeRes.BolusRates;
      returnData.reservoirChanges = inComeRes.reservoirChanges;
      returnData.primes = inComeRes.primes;
      returnData.alarm = inComeRes.alarm;
      returnData.status = inComeRes.status;
      returnData.records = records;
      return cb(null, returnData);
    },

    processData(progress, data, cb) {
      cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });
      progress(100);
      const { settings, alarm, status } = data;
      const postSetting = this.buildSettings(settings);
      const bloodRes = this.buildBlood(data.BloodGlucoses);
      let basalRes = this.buildBasal(data.BasalRates);
      const bolusRes = this.buildBolus(data.BolusRates);
      const reservoirChanges = this.buildReservoirChange(data.reservoirChanges);
      const primes = this.buildPrime(data.primes);
      basalRes = basalRes.length > 1 ? basalRes : [];
      const alarmRes = this.buildAlarm(alarm);
      const statusRes = this.buildStatus(status);
      let postRecords = [].concat(
        bloodRes,
        basalRes,
        bolusRes,
        postSetting,
        alarmRes,
        statusRes,
        primes,
        reservoirChanges,
      );
      if (!postRecords.length) {
        const err = new Error();
        err.code = 'E_NO_NEW_RECORDS';
        return cb(err, null);
      }
      postRecords = _.sortBy(postRecords, (d) => d.time);
      data.post_records = postRecords;
      return cb(null, data);
    },

    uploadData(progress, data, cb) {
      progress(0);
      const sessionInfo = {
        delta: cfg.delta,
        deviceTags: cfg.deviceInfo.tags,
        deviceManufacturers: ['Microtech'],
        deviceModel: 'equil', // only one device model
        deviceSerialNumber: cfg.deviceInfo.serialNumber,
        deviceId: cfg.deviceInfo.deviceId,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version,
      };
      cfg.api.upload.toPlatform(
        data.post_records,
        sessionInfo,
        progress,
        cfg.groupId,
        (err, result) => {
          progress(100);

          if (err) {
            debug(err);
            debug(result);
            return cb(err, null);
          }
          data.cleanup = true;
          return cb(null, data);
        },
        'dataservices',
      );
    },
    disconnect(progress, data, cb) {
      debug('in disconnect');
      progress(100);
      cb(null, data);
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');
      driver.close(() => {
        progress(100);
        data.cleanup = true;
        cb(null, data);
      });
    },
  };
};
