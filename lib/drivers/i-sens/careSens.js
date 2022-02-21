/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2020, Tidepool Project
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
import crcCalculator from '../../crc';

const struct = structJs();
const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('CareSensDriver') : console.log;

const COMMAND = {
  HEADER: 'iSPc',
  GLUCOSE_RESULT: 'GLUE',
  CURRENT_INDEX: 'NCOT',
  READ_SERIAL: 'RSNB',
  READ_TIME: 'RTIM',
  WRITE_TIME: 'WTIM',
};

const ASCII_CONTROL = {
  STX: 0x02,
  ETX: 0x03,
};

const UART = {
  ECHO: 0x80,
  READ_FLASH: 0x8B,
};

const REPORT_ID = {
  GET_SET_UART_ENABLE: 0x41,
  GET_VERSION_INFO: 0x46,
  GET_SET_UART_CONFIG: 0x50,
};

const PARITY = {
  NONE: 0,
  ODD: 1,
  EVEN: 2,
  MARK: 3,
  SPACE: 4,
};

const FLOW_CONTROL = {
  NONE: 0,
  HARDWARE: 1,
};

const DATA_BITS = {
  FIVE: 0x00,
  SIX: 0x01,
  SEVEN: 0x02,
  EIGHT: 0x03,
};

const STOP_BITS = {
  SHORT: 0x00,
  LONG: 0x01,
};

const UART_CONFIG = {
  baud: 9600,
  parity: PARITY.NONE,
  flowControl: FLOW_CONTROL.NONE,
  dataBits: DATA_BITS.EIGHT,
  stopBits: STOP_BITS.SHORT,
};

const ERROR = {
  TIMEOUT: { value: 'TOUT', name: 'Communication timeout' },
  HEADER_VERIFY: { value: 'HEAD', name: 'Could not verify header packet' },
  SIZE_VERIFY: { value: 'SIZE', name: 'Could not verify size of packet' },
  CRC_VERIFY: { value: 'ECRC', name: 'Could not verify CRC of packet' },
  COMMAND_VERIFY: { value: 'CMND', name: 'Could not verify packet command' },
};

const FLAGS = {
  CONTROL_SOLUTION: { value: 0x01, name: 'Control Solution Test' },
  POST_MEAL: { value: 0x02, name: 'Post-meal' },
  LO: { value: 0x04, name: 'Low measurement result' },
  HI: { value: 0x08, name: 'High measurement result' },
  FASTING: { value: 0x10, name: 'Fasting measurement result' },
  NORMAL: { value: 0x20, name: 'Normal measurement result with no flag' },
  KETONE: { value: 0x40, name: 'Ketone measurement result' },
  LOW_HIGH: { value: 0x80, name: 'Low High flags are available' },
};

const MODEL_CODES = [
  {
    value: 0x00, name: 'CSP', startAddress: 0xC200, maxRecords: 250,
  },
  {
    value: 0x01, name: 'ISP', startAddress: 0xC200, maxRecords: 250,
  },
  {
    value: 0x02, name: 'GSP', startAddress: 0xD200, maxRecords: 250,
  },
  {
    value: 0x03, name: 'CNP', startAddress: 0xE200, maxRecords: 250,
  },
  {
    value: 0x04, name: 'NCP', startAddress: 0xE200, maxRecords: 250,
  },
  {
    value: 0x05, name: 'HDP', startAddress: 0xE200, maxRecords: 250,
  },
  {
    value: 0x06, name: 'ACP', startAddress: 0xE200, maxRecords: 250,
  },
  {
    value: 0x07, name: 'NTP', startAddress: 0xE200, maxRecords: 250,
  },
  {
    value: 0x08, name: 'ECP', startAddress: 0xE200, maxRecords: 250,
  },
  {
    value: 0x09, name: 'AQP', startAddress: 0xE200, maxRecords: 250,
  },
  {
    value: 0x0A, name: 'ITP', startAddress: 0xE200, maxRecords: 250,
  },
  {
    value: 0x0B, name: 'CNM', startAddress: 0xE200, maxRecords: 250,
  },
  {
    value: 0x0C, name: 'APP', startAddress: 0xD200, maxRecords: 500,
  },
  {
    value: 0x0D, name: 'CLP', startAddress: 0xD200, maxRecords: 500,
  },
  {
    value: 0x0E, name: 'DAP', startAddress: 0xE200, maxRecords: 250,
  },
  {
    value: 0x0F, name: 'MDP', startAddress: 0xE200, maxRecords: 250,
  },
  {
    value: 0x10, name: 'CMP', startAddress: 0xE200, maxRecords: 500,
  },
  {
    value: 0x11, name: 'CVP', startAddress: 0xE200, maxRecords: 500,
  },
];

const getStartAddress = (idx) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const i in MODEL_CODES) {
    if (MODEL_CODES[i].name === idx) {
      return MODEL_CODES[i].startAddress;
    }
  }
  return 'unknown';
};

const getMaxRecords = (idx) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const i in MODEL_CODES) {
    if (MODEL_CODES[i].name === idx) {
      return MODEL_CODES[i].maxRecords;
    }
  }
  return 'unknown';
};

const READ_TIMEOUT = 2000; // in milliseconds
const HEADER_SIZE = 6;
const KETONE_VALUE_FACTOR = 10;
const KETONE_HI = 8.0;
const DATA_LENGTH = 0x0A; // for protocol 1

class CareSens {
  constructor(cfg) {
    this.cfg = cfg;
    this.protocol = null;
    if (this.cfg.deviceInfo.driverId === 'ReliOnPremier' || this.cfg.deviceInfo.driverId === 'GlucocardShine') {
      this.serialDevice = this.cfg.deviceComms;
    } else {
      this.hidDevice = this.cfg.deviceComms;
    }
    this.retries = 0;
  }

  buildPacket(command, payload = []) {
    if (this.protocol === 1) {
      const buf = new ArrayBuffer(7);
      const bytes = new Uint8Array(buf);
      let address = null;
      const dataLength = DATA_LENGTH;

      struct.storeByte(UART.READ_FLASH, bytes, 0);

      if (command === COMMAND.READ_SERIAL) {
        address = 0x1034;
      } else if (command === COMMAND.GLUCOSE_RESULT) {
        address = getStartAddress(this.model) + payload;
      } else {
        throw new Error('Unsupported command for this meter');
      }

      /* eslint-disable no-bitwise */
      struct.copyBytes(bytes, 1, [
        0x10 | ((address & 0xF000) >> 12),
        0x20 | ((address & 0x0F00) >> 8),
        0x10 | ((address & 0x00F0) >> 4),
        0x20 | (address & 0x000F),
        0x10 | ((dataLength & 0xF0) >> 4),
        0x20 | (dataLength & 0x0F),
      ], 6);
      /* eslint-enable no-bitwise */

      debug(`Sending ${common.bytes2hex(bytes)}`);

      return buf;
    }

    const datalen = 7 + payload.length; // includes length of command, payload, CRC and ETX
    let packetlen = datalen + 6; // adds header and STX

    if (this.hidDevice) {
      packetlen += 1; // adding size
    }

    const buf = new ArrayBuffer(packetlen);
    const bytes = new Uint8Array(buf);
    let ctr = 0;

    if (this.hidDevice) {
      // only HID packets use packet length
      struct.storeByte(packetlen, bytes, ctr);
      ctr += 1;
    }

    ctr += struct.pack(bytes, ctr, 'b4zb4z', ASCII_CONTROL.STX, COMMAND.HEADER, datalen, command);
    ctr += struct.copyBytes(bytes, ctr, payload, payload.length);
    struct.storeByte(ASCII_CONTROL.ETX, bytes, ctr); // to calculate CRC, overwritten below

    let crc = null;
    if (this.hidDevice) {
      crc = crcCalculator.calcCRC_A(bytes.slice(1), packetlen - 3);
    } else {
      crc = crcCalculator.calcCRC_A(bytes, packetlen - 2);
    }

    ctr += struct.pack(bytes, ctr, 'Sb', crc, ASCII_CONTROL.ETX);

    debug('Sending:', common.bytes2hex(bytes));

    return buf;
  }

  static async enableUART(hidDevice) {
    const buf = new ArrayBuffer(9);
    const bytes = new Uint8Array(buf);

    struct.pack(bytes, 0, 'bIbbbb', REPORT_ID.GET_SET_UART_CONFIG, UART_CONFIG.baud, UART_CONFIG.parity, UART_CONFIG.flowControl, UART_CONFIG.dataBits, UART_CONFIG.stopBits);

    debug('UART config:', common.bytes2hex(bytes));

    debug('Configuring and enabling UART..');
    await hidDevice.sendFeatureReport(buf);
    await hidDevice.sendFeatureReport([REPORT_ID.GET_SET_UART_ENABLE, 1]);
  }

  static verifyChecksum(bytes, expected) {
    bytes.splice(bytes.length - 3, 2); // remove two existing crc bytes
    const calculated = crcCalculator.calcCRC_A(bytes, bytes.length);
    if (calculated !== expected) {
      debug('Checksum is', calculated.toString(16), ', expected', expected.toString(16));
      throw new Error('Checksum mismatch');
    }
  }

  static extractHeader(bytes) {
    const fields = struct.unpack(bytes, 0, '.4zb', ['header', 'size']);
    debug('Header:', fields);
    if (fields.header !== COMMAND.HEADER) {
      throw new Error('Header not found');
    } else {
      return fields;
    }
  }

  extractPacketIntoMessages(bytes) {
    if (this.protocol === 1) {
      let ctr = 0;
      const response = [];

      while (ctr <= (bytes.length - 3)) {
        // data format: 0x8b 0x1X 0x2X
        // eslint-disable-next-line no-bitwise
        const byte = (((bytes[ctr + 1] & 0x0F) << 4) | (bytes[ctr + 2] & 0x0F));
        response.push(byte);
        ctr += 3;
      }

      debug('Decoded:', common.bytes2hex(response));
      return response;
    }

    const fields = CareSens.extractHeader(bytes);

    const response = struct.unpack(bytes, 6, `4z${fields.size - 7}BS`, ['command', 'data', 'crc']);
    debug('Decoded:', response);

    if (response.command !== COMMAND.GLUCOSE_RESULT) { // glucose result does not use CRC :-O
      CareSens.verifyChecksum(bytes, response.crc);
    }

    const err = common.getName(ERROR, response.command);
    if (err !== 'unknown') {
      throw new Error(err);
    } else {
      return response;
    }
  }

  static extractPacket(bytes) {
    const packet = {
      bytes,
      packet_len: bytes.length,
    };

    return packet;
  }

  static packetHandler(buffer) {
    if (buffer.len() < 1) { // only empty buffer is no valid packet
      return false;
    }

    const packet = CareSens.extractPacket(buffer.bytes());
    if (packet.packet_len !== 0) {
      // cleanup the buffer data
      buffer.discard(packet.packet_len);
    }

    return packet;
  }

  listenForPacket(timeout, command, callback) {
    let listenTimer = null;

    const abortTimeout = () => {
      clearInterval(listenTimer);
      debug('TIMEOUT');
      callback('Timeout error. Is the meter switched on?', null);
    };

    let raw = [];
    let foundSTX = false;
    let done = false;
    let packetSize = 64;
    let abortTimer = setTimeout(abortTimeout, timeout);
    const expectedLength = (DATA_LENGTH - 2) * 3;

    listenTimer = setInterval(() => {
      if (this.serialDevice.hasAvailablePacket()) {
        // reset abort timeout
        clearTimeout(abortTimer);
        abortTimer = setTimeout(abortTimeout, timeout);

        const { bytes } = this.serialDevice.nextPacket();

        debug('Raw packet received:', common.bytes2hex(bytes));

        if (this.protocol === 1) {
          raw = raw.concat(Array.from(bytes));
          debug(`Received ${raw.length} of ${expectedLength} bytes`);
          if (raw.length >= expectedLength) {
            done = true;
          }
        } else {
          if (!foundSTX) {
            if (bytes.includes(ASCII_CONTROL.STX)) {
              foundSTX = true;
            }
          }

          if (foundSTX) {
            raw = raw.concat(Array.from(bytes));

            if (raw.length >= HEADER_SIZE) {
              const fields = CareSens.extractHeader(raw);
              packetSize = fields.size;
            }

            if (bytes.includes(ASCII_CONTROL.ETX) && raw.length >= (packetSize + HEADER_SIZE)) {
              done = true;
            }
          }
        }

        if (raw.length > 0 && done) {
          clearTimeout(abortTimer);
          clearInterval(listenTimer);
          if (this.protocol === 1) {
            debug('Packet:', common.bytes2hex(raw));
          } else {
            debug('Packet:', String.fromCharCode.apply(null, raw));
          }
          try {
            return callback(null, this.extractPacketIntoMessages(raw));
          } catch (err) {
            return callback(err, null);
          }
        }

        return null;
      }
    }, 20);
  }

  async commandResponse(cmd, payload) {
    if (this.serialDevice) {
      return new Promise((resolve, reject) => {
        try {
          this.serialDevice.writeSerial(this.buildPacket(cmd, payload), () => {
            this.listenForPacket(5000, cmd, (err, result) => {
              if (err) {
                reject(err);
              }
              resolve(result);
            });
          });
        } catch (e) {
          // exceptions inside Promise won't be thrown, so we have to
          // reject errors here (e.g. device unplugged during data read)
          reject(e);
        }
      });
    }

    let message = '';

    const bytesWritten = await this.hidDevice.sendPromisified(this.buildPacket(cmd, payload));
    debug('Sent', bytesWritten, 'bytes.');

    let raw = [];
    let result;
    let foundSTX = false;
    let foundETX = false;
    let packetSize = 64;
    do {
      result = [];
      // requests to devices are sequential
      // eslint-disable-next-line no-await-in-loop
      result = await this.hidDevice.receiveTimeout(READ_TIMEOUT);
      debug('Incoming bytes:', common.bytes2hex(result));

      if (result.length > 0) {
        let bytes = null;
        if (result.length > 1) {
          if (result.slice(1).every(item => item === 0)) {
            // only first byte in array is nvalid
            bytes = [result[0]];
          } else {
            const length = result[0];
            bytes = result.slice(1, length + 1);
          }
        } else {
          bytes = result;
        }

        if (!foundSTX) {
          if (bytes.includes(ASCII_CONTROL.STX)) {
            foundSTX = true;
          }
        }

        if (foundSTX) {
          raw = raw.concat(bytes);

          if (raw.length >= HEADER_SIZE) {
            const fields = CareSens.extractHeader(raw);
            packetSize = fields.size;
          }

          if (bytes.includes(ASCII_CONTROL.ETX) && raw.length >= (packetSize + HEADER_SIZE)) {
            foundETX = true;
          }
        }
      }
    } while (!foundETX);

    // Only process if we get data
    if (raw.length > 0) {
      debug('Packet:', String.fromCharCode.apply(null, raw));
      message = this.extractPacketIntoMessages(raw);
    }

    return message;
  }

  async getSerialNumber() {
    const result = await this.commandResponse(COMMAND.READ_SERIAL);

    if (this.protocol === 1) {
      // we currently only handle SN-1 format
      const fields = struct.unpack(result, 0, 'ssssb', ['productCount', 'massProductionCount', 'modelCode', 'programVersion', 'flag']);
      this.model = common.getName(MODEL_CODES, fields.modelCode);
      const massProductionCount = this.model === 'CVP' ? fields.massProductionCount.toString(16) : fields.massProductionCount;
      const serialNumber = this.model +
                     massProductionCount.toUpperCase().padStart(2, '0') +
                     String.fromCharCode(fields.programVersion + 65) +
                     fields.productCount.toString().padStart(5, '0');

      return serialNumber;
    }

    return String.fromCharCode.apply(null, _.dropRight(result.data)).trim();
  }

  async getDateTime() {
    const result = await this.commandResponse(COMMAND.READ_TIME);
    const fields = struct.unpack(result.data, 0, 'bbbbbb', ['year', 'month', 'day', 'hours', 'minutes', 'seconds']);
    fields.year += 2000;
    return sundial.buildTimestamp(fields);
  }

  async getNumberOfRecords() {
    if (this.protocol === 1 && this.model === 'CVP') {
      debug('Retrieving the total number of records not supported on this device');
      return null;
    }
    const result = await this.commandResponse(COMMAND.CURRENT_INDEX);
    return struct.extractBEShort(result.data, 0);
  }

  async getRecords(nrOfRecords, progress) {
    const records = [];

    if (this.protocol === 1) {
      let ctr = 0;

      while ((ctr / 8) < getMaxRecords(this.model)) {
        debug('Reading adress', (getStartAddress(this.model) + ctr).toString(16));
        /* eslint-disable-next-line no-await-in-loop */ // requests to devices are sequential
        const result = await this.commandResponse(COMMAND.GLUCOSE_RESULT, ctr);
        if (result[0] === 0xFF && result[1] === 0xFF) {
          // CVP model stores 0xFFFF at the end of the log
          return records;
        }

        ctr += 8;

        const record = struct.unpack(result, 0, 'bbbbbbs', ['year', 'month', 'day', 'hours', 'minutes', 'seconds', 'value']);
        record.year += 2000;
        record.jsDate = sundial.buildTimestamp(record);
        record.flags = 0;

        // order here is important, as a value can be marked as both post-meal and control solution
        /* eslint-disable no-bitwise */
        if (record.value > 20000) {
          record.value -= 20000;
          record.flags |= FLAGS.CONTROL_SOLUTION.value;
        }

        if (record.value > 10000) {
          record.value -= 10000;
          record.flags |= FLAGS.POST_MEAL.value;
        }

        if (record.value === 0x02BC) {
          record.flags |= FLAGS.HI.value;
        }

        if (record.value === 0x0A) {
          record.flags |= FLAGS.LO.value;
        }
        /* eslint-enable no-bitwise */

        records.push(record);
        progress((records.length / nrOfRecords) * 100);
      }

      return records;
    }

    for (let startIndex = 1; startIndex <= nrOfRecords; startIndex += 27) {
      // eslint-disable-next-line no-bitwise
      const count = ((nrOfRecords - startIndex) >= 27) ? 27 : nrOfRecords - startIndex + 1;
      const buf = new ArrayBuffer(3);
      const bytes = new Uint8Array(buf);

      debug(`Requesting from ${startIndex} to ${startIndex + count - 1} of ${nrOfRecords}`);
      struct.pack(bytes, 0, 'Sb', startIndex, count);

      // requests to devices are sequential
      // eslint-disable-next-line no-await-in-loop
      const result = await this.commandResponse(COMMAND.GLUCOSE_RESULT, bytes);
      let ctr = 0;

      for (let i = 0; i < count; i++) {
        const record = struct.unpack(result.data, ctr, 'bbbbbbbS', ['year', 'month', 'day', 'hours', 'minutes', 'seconds', 'flags', 'value']);
        record.year += 2000;
        record.jsDate = sundial.buildTimestamp(record);
        records.push(record);
        progress((records.length / nrOfRecords) * 100);
        ctr += 9;
      }
    }

    return records;
  }

  async setDateTime(dateTime) {
    const buf = new ArrayBuffer(6);
    const bytes = new Uint8Array(buf);
    struct.pack(bytes, 0, 'bbbbbb', ...dateTime);
    const result = await this.commandResponse(COMMAND.WRITE_TIME, bytes);
    const newDateTime = Array.from(result.data);

    if (!_.isEqual(dateTime, newDateTime)) {
      debug('Set date/time:', dateTime);
      debug('Received date/time:', newDateTime);
      throw new Error('Error setting date/time.');
    }
  }

  static probe(cb) {
    debug('not probing CareSens');
    cb();
  }

  serialPing(cb) {
    let listenTimer = null;

    const abortTimer = setTimeout(() => {
      debug('TIMEOUT');

      if (this.retries <= 3) {
        debug('Retrying..');
        this.retries += 1;
        clearTimeout(abortTimer);
        clearInterval(listenTimer);
        this.serialPing(cb);
      } else {
        cb('Meter not responding. Is the meter switched on?', null);
      }
    }, READ_TIMEOUT * 2);

    debug('Pinging over serial..');
    this.serialDevice.writeSerial([UART.ECHO], () => {
      listenTimer = setInterval(() => {
        if (this.serialDevice.hasAvailablePacket()) {
          const { bytes } = this.serialDevice.nextPacket();
          debug('Received:', common.bytes2hex(bytes));

          if (bytes.includes(0x20)) {
            this.protocol = 1;
          } else if (bytes.includes(0x2E)) {
            this.protocol = 3;
          } else if (bytes.includes(0x2F)) {
            // according to spec, protocol 2 should be ignored
            throw new Error('Unsupported protocol');
          }

          if (this.protocol) {
            debug(`Protocol version is ${this.protocol}`);
            clearTimeout(abortTimer);
            clearInterval(listenTimer);
            this.retries = 0;
            cb();
          }
        }
      }, 20);
    });
  }

  async ping() {
    const bytesWritten = await this.hidDevice.sendPromisified([0x01, UART.ECHO]);
    debug('Sent', bytesWritten, 'bytes.');
    const result = await this.hidDevice.receiveTimeout(READ_TIMEOUT);
    debug('Received:', common.bytes2hex(result));

    if (result.length === 0) {
      if (this.retries <= 3) {
        debug('Retrying..');
        this.retries += 1;
        await this.ping();
      } else {
        throw new Error('Device not responding.');
      }
    } else {
      this.retries = 0;
    }
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['i-SENS'],
    model: 'CareSens',
  });

  let hidDevice = null;
  let serialDevice = null;

  switch (cfg.deviceInfo.driverId) {
    case 'ReliOnPremier':
      serialDevice = config.deviceComms;
      cfg.deviceInfo.model = 'ReliOnPremier';
      cfg.deviceInfo.manufacturers.push('Arkray');
      break;
    case 'GlucocardShine':
      serialDevice = config.deviceComms;
      cfg.deviceInfo.model = 'GlucocardShine';
      cfg.deviceInfo.manufacturers.push('Arkray');
      break;
    case 'GlucocardShineHID':
      hidDevice = config.deviceComms;
      cfg.deviceInfo.model = 'GlucocardShine';
      cfg.deviceInfo.manufacturers.push('Arkray');
      break;
    default:
      hidDevice = config.deviceComms;
  }

  const driver = new CareSens(cfg);

  const hasFlag = (flag, v) => {
    // eslint-disable-next-line no-bitwise
    if (flag.value & v) {
      return true;
    }
    return false;
  };

  const buildBGRecords = (data) => {
    _.forEach(data.records, (record, index) => {
      let { value } = record;

      // According to spec, HI > 600 and LO < 20
      let annotation = null;
      if (hasFlag(FLAGS.HI, record.flags) ||
          (cfg.deviceInfo.driverId === 'GlucocardShine' && value > 600)) {
        value = 601;
        annotation = {
          code: 'bg/out-of-range',
          value: 'high',
          threshold: 600,
        };
      } else if (hasFlag(FLAGS.LO, record.flags) ||
          (cfg.deviceInfo.driverId === 'GlucocardShine' && value < 20)) {
        value = 19;
        annotation = {
          code: 'bg/out-of-range',
          value: 'low',
          threshold: 20,
        };
      } else {
        value = _.toInteger(value);
      }

      if (!hasFlag(FLAGS.CONTROL_SOLUTION, record.flags)
          && !hasFlag(FLAGS.KETONE, record.flags)) {
        const recordBuilder = cfg.builder.makeSMBG()
          .with_value(value)
          .with_units('mg/dL') // values are always in 'mg/dL'
          .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
          .set('index', index);

        cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.jsDate);

        if (annotation) {
          annotate.annotateEvent(recordBuilder, annotation);
        }

        const postRecord = recordBuilder.done();
        delete postRecord.index;
        data.post_records.push(postRecord);
      } else if (hasFlag(FLAGS.CONTROL_SOLUTION, record.flags)) {
        debug('Skipping BG control solution test');
      }
    });
  };

  const buildKetoneRecords = (data) => {
    _.forEach(data.records, (record, index) => {
      if (hasFlag(FLAGS.KETONE, record.flags)) {
        let { value } = record;

        // According to spec, HI > 8 mmol/L
        // there is no LO as values are between 0 and 8 mmol/L
        let annotation = null;
        if (hasFlag(FLAGS.HI, record.flags)) {
          value = KETONE_HI + (1 / KETONE_VALUE_FACTOR);
          annotation = {
            code: 'ketone/out-of-range',
            value: 'high',
            threshold: KETONE_HI,
          };
        } else {
          value = _.toInteger(value) / KETONE_VALUE_FACTOR;
        }

        if (!hasFlag(FLAGS.CONTROL_SOLUTION, record.flags)) {
          const recordBuilder = cfg.builder.makeBloodKetone()
            .with_value(value)
            .with_units('mmol/L') // values are always in 'mmol/L'
            .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
            .set('index', index);

          cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.jsDate);

          if (annotation) {
            annotate.annotateEvent(recordBuilder, annotation);
          }

          const postRecord = recordBuilder.done();
          delete postRecord.index;
          data.post_records.push(postRecord);
        } else {
          debug('Skipping ketone control solution test');
        }
      }
    });
  };

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
      if (serialDevice) {
        serialDevice.connect(data.deviceInfo, CareSens.packetHandler, (err) => {
          if (err) {
            return cb(err);
          }
          driver.serialPing((err2) => {
            if (err2) {
              return cb(err2);
            }
            data.disconnect = false;
            progress(100);
            return cb(null, data);
          });
        });
      } else {
        hidDevice.connect(cfg.deviceInfo, CareSens.probe, (err) => {
          if (err) {
            cb(err);
          } else {
            (async () => {
              if (cfg.deviceInfo.driverId === 'CareSens') {
                // The CP2110 chip used implements serial over HID,
                // so we need to enable the UART first.
                // see https://www.silabs.com/documents/public/application-notes/AN434-CP2110-4-Interface-Specification.pdf
                await CareSens.enableUART(hidDevice);
              }
              await driver.ping();

              data.disconnect = false;
              progress(100);
              cb(null, data);
            })().catch((error) => cb(error));
          }
        });
      }
    },

    getConfigInfo(progress, data, cb) {
      progress(0);

      (async () => {
        cfg.deviceInfo.serialNumber = await driver.getSerialNumber();
        cfg.deviceInfo.deviceId = `${cfg.deviceInfo.driverId}-${cfg.deviceInfo.serialNumber}`;

        if (driver.protocol === 1) {
          data.connect = true;
          return cb(null, data);
        }

        cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(await driver.getDateTime());
        debug('Config:', cfg);

        common.checkDeviceTime(
          cfg,
          (timeErr, serverTime) => {
            progress(100);
            if (timeErr) {
              if (timeErr === 'updateTime') {
                cfg.deviceInfo.annotations = 'wrong-device-time';

                (async () => {
                  const dateTime = [
                    sundial.formatInTimezone(serverTime, cfg.timezone, 'YY'),
                    sundial.formatInTimezone(serverTime, cfg.timezone, 'M'),
                    sundial.formatInTimezone(serverTime, cfg.timezone, 'D'),
                    sundial.formatInTimezone(serverTime, cfg.timezone, 'H'),
                    sundial.formatInTimezone(serverTime, cfg.timezone, 'm'),
                    sundial.formatInTimezone(serverTime, cfg.timezone, 's'),
                  ];
                  await driver.setDateTime(dateTime.map(Number));
                })().then(() => {
                  data.connect = true;
                  return cb(null, data);
                }).catch((error) => {
                  debug('Error in getConfigInfo: ', error);
                  return cb(error, null);
                });
              } else {
                cb(timeErr, null);
              }
            } else {
              data.connect = true;
              cb(null, data);
            }
          },
        );
      })().catch((error) => {
        debug('Error in getConfigInfo: ', error);
        return cb(error, null);
      });
    },

    fetchData(progress, data, cb) {
      (async () => {
        try {
          debug('in fetchData', data);

          data.nrOfRecords = await driver.getNumberOfRecords();

          if (data.nrOfRecords != null) {
            debug(`Found ${data.nrOfRecords} records..`);
          }

          data.records = await driver.getRecords(data.nrOfRecords, progress);

          progress(100);
          return cb(null, data);
        } catch (error) {
          debug('Error in fetchData: ', error);
          return cb(error, null);
        }
      })();
    },

    processData(progress, data, cb) {
      progress(0);
      cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });
      data.post_records = [];

      // With no date & time settings changes available,
      // timezone is applied across-the-board
      cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

      buildBGRecords(data);
      buildKetoneRecords(data);

      debug('POST records:', data.post_records);

      if (data.post_records.length === 0) {
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
      debug('in disconnect');
      progress(100);
      cb(null, data);
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');
      if (!data.disconnect) {
        if (serialDevice) {
          serialDevice.disconnect(() => {
            progress(100);
            data.cleanup = true;
            data.disconnect = true;
            cb(null, data);
          });
        } else {
          hidDevice.disconnect(data, () => {
            progress(100);
            data.cleanup = true;
            data.disconnect = true;
            cb(null, data);
          });
        }
      } else {
        progress(100);
        cb();
      }
    },
  };
};
