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

/*
 * *** FreeStyle Libre communication via USB HID ***
 *
 * *** HID DATA TRANSFER ***
 * - HID reports are used to encapsulate the text and the binary protocol
 * - HID report frames always have 64 bytes
 *
 * HID_FRAME:
 * |---------------------------------------------------------------------
 * HID_HEADER           HID_DATA
 * |-      |-           |------------------------------------------------
 * COMMAND DATA_LENGTH  PAYLOAD_DATA          GARBAGE
 * |-      |-           |-------------------  |--------------------------
 * 0xnn    0xll         (up to 62 bytes)
 *
 *
 * HID_HEADER:
 * - COMMAND:      1 byte
 * - DATA_LENGTH:  1 byte (excluding HID_HEADER, so valid range is 0-62)
 *
 * HID_DATA:
 * - PAYLOAD_DATA: DATA_LENGTH bytes actual data
 * - GARBAGE:      (62 - DATA_LENGTH) bytes fill the rest of the frame
 *
 * COMMAND CODES:
 * - from host to device:
 * --- 0x01: used in init?
 * --- 0x04: used in init?
 * --- 0x05: used in init?
 * --- 0x0a: BINARY PROTOCOL request data with AAP OP_CODES
 * --- 0x0d: ACK received packets
 * --- 0x15: used in init?
 * --- 0x21: TEXT PROTOCOL command
 * --- 0x60: TEXT PROTOCOL command
 *
 * - from device to host:
 * --- 0x06: answer to init 0x05, data in text format containing the device's serial number
 * --- 0x0b: BINARY PROTOCOL response to 0x0a
 * --- 0x0c: ACK received packets
 * --- 0x22: at seemingly random points in the communication? always the same single data byte: 0x05
 * --- 0x34: answer to init 0x04, single data byte with different values?
 * --- 0x35: answer to init 0x05, data in text format containing the devices software version
 * --- 0x60: TEXT PROTOCOL response
 * --- 0x71: answer to init 0x01, single data byte with value 0x01?
 *
 *
 * *** BINARY PROTOCOL ***
 *
 * - ABMP: ADC Binary 22175 communication Meter Protocol
 * --- ATP:  ABMP Transport Protocol
 * ----- AAP:  ABMP Application Protocol
 *
 * ATP_FRAME:
 *
 * PAYLOAD_DATA
 * |---------------------------------------------------------------
 * ATP_HEADER            ATP_DATA
 * |-     |-     |----   |---------------------           |----------
 * SEQ_RX SEQ_TX CRC     AAP_FRAME_1                      AAP_FRAME_2...
 *                       |---------------------
 *                       AAP_HEADER           AAP_DATA
 *                       |---        |-       |---------
 *                       AAP_LENGTH  OP_CODE  AAP_DATA
 *
 * ATP_FRAME:
 * - ATP_HEADER
 * --- SEQ_RX:  1 byte sequence information: the next expected packet's sequence number
 * --- SEQ_TX:  1 byte sequence information: this packet's sequence number
 * --- CRC:     32 bit CRC (variation of CRC32-CCITT, using 8 XORs but only a size 16 lookup table)
 * - ATP_DATA
 * --- can contain one or multiple AAP frames or only parts of one
 *
 * AAP_FRAME:
 * - AAP_HEADER:
 * --- AAP_LENGTH: 0 to 3 bytes
 * ----- if high bit is set, the lower 7 bits are the length -> max 21 bits for length
 * ----- if not, this byte is already the OP_CODE byte
 * --- OP_CODE: 1 byte (high bit is 0)
 * - AAP_DATA: up to 2MB spread over multiple ATP_DATA fields of consecutive ATP_FRAMES
 *
 * OP_CODE: (in addition to the ones defined in the specs)
 * - 0x7d: make device flush its output buffer
 *  (sends remaining AAP data, even if not a full ATP frame can be filled)
 *
 * BINARY COMMAND:
 * - exactly one AAP frame (contained in a single ATP frame, inside a single HID report frame)
 *
 * BINARY RESPONSE:
 * - can span multiple AAP frames, possibly spread over multiple ATP and HID frames
 * - only completely filled ATP frames are sent
 * --- send OP Code 0x7d to force device to send remaining AAP data in partially filled ATP frame
 *
 *
 * *** TEXT PROTOCOL ***
 *
 * TEXT COMMAND:
 *
 * PAYLOAD_DATA
 * |----------------
 * MESSAGE       SEP
 * |--------     |--
 * $command?     \r\n
 *
 * TEXT RESPONSE:
 * - can span multiple HID frames, ending with STATUS ("CMD OK\r\n" or "CMD Fail!\r\n")
 * - lines are separated by SEP: "\r\n" (0x0a 0x0d)
 * - MESSAGE is followed by CHECKSUM and STATUS, each in its own line
 *
 * PAYLOAD_DATA
 * |------------------------------------------------------------------------
 * MESSAGE       SEP   CHECKSUM            SEP   STATUS                  SEP
 * |--------     |--   |-------------      |--   |------                 |--
 * message...    \r\n  "CKSM:[0-9A-F]{8}"  \r\n  "CMD OK" or "CMD Fail!" \r\n
 *
 */

import async from 'async';
import sundial from 'sundial';
import structJs from '../../struct';

import { DEVICE_MODEL_NAME, OP_CODE, COMMAND, CRC32_TABLE } from './freeStyleLibreConstants';

const struct = structJs();

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('FreeStyleLibreDriver') : console.log;

const HID_PACKET_SIZE = 64;
const HID_HEADER_FORMAT = 'bb';
const HID_HEADER_LENGTH = struct.structlen(HID_HEADER_FORMAT);

const ATP_HEADER_FORMAT = 'bbi';
const ATP_HEADER_LENGTH = struct.structlen(ATP_HEADER_FORMAT);

const ACK_HEADER_FORMAT = 'bb2Z';
const ACK_HEADER_LENGTH = struct.structlen(ACK_HEADER_FORMAT);

const READ_TIMEOUT = 5000; // [ms]
const ACK_INTERVAL = 10; // [ms]

const INIT_ACK_MAGIC_DATA = '\x00\x02';

// to know then all AAP responses for a request were received,
// we can look for the AAP data length of the final packet
const FINAL_AAP_DATA_LENGTHS = {};
// contrary to the specs the db tables are concluded by just 0x31 with length 0, not 0x81 0x31 0xcc
FINAL_AAP_DATA_LENGTHS[OP_CODE.GET_DATABASE] = 0;
FINAL_AAP_DATA_LENGTHS[OP_CODE.GET_DB_SCHEMA] = 0;
FINAL_AAP_DATA_LENGTHS[OP_CODE.GET_DATE_TIME] = 8;
FINAL_AAP_DATA_LENGTHS[OP_CODE.SET_DATE_TIME] = 0;
FINAL_AAP_DATA_LENGTHS[OP_CODE.GET_CFG_DATA] = -1;
FINAL_AAP_DATA_LENGTHS[OP_CODE.GET_CFG_SCHEMA] = 0;
FINAL_AAP_DATA_LENGTHS[OP_CODE.SET_COMPRESSION] = 1;

//
// regular expressions for matching text protocol responses
//
const TEXT_CHECKSUM_FORMAT = 'CKSM:([0-9A-F]{8})\r\n';
const TEXT_STATUS_FORMAT = 'CMD (OK|Fail!)\r\n';
const TEXT_STATUS_REGEX = new RegExp(TEXT_STATUS_FORMAT);
// in javascript RegExp "[^]*" has to be used instead of ".*" to match all chars over multiple lines
// the multiline flag /s/ does not exist, so ".*" will never match newlines
const TEXT_RESPONSE_REGEX = new RegExp(`^([^]*)${TEXT_CHECKSUM_FORMAT}${TEXT_STATUS_FORMAT}`);

const DB_RECORD_NUMBER_REGEX = new RegExp('^DB Record Number = ([0-9]+)$');

// after db record responses (e.g. $arresult?, $history?) an additional line is send,
// containing the record count and an additional checksum of just the records:
// COUNT,RECORD_CHECKSUM\r\n
// eslint-disable-next-line no-control-regex
const DB_RECORDS_REGEX = new RegExp('^([^]*\r\n)([0-9]+),([0-9A-F]{8})$');

export default class FreeStyleLibreProtocol {
  constructor(config) {
    this.config = config;
    this.hidDevice = config.deviceComms;
    this.sequenceRx = 0;
    this.sequenceTx = 0;
    this.lastAckRx = 0;
  }

  readResponse(responseType, timeout, cb) {
    let receiveTimeout = null;
    const resetReceiveTimeout = () => {
      if (receiveTimeout !== null) {
        clearTimeout(receiveTimeout);
      }
      receiveTimeout = setTimeout(() => {
        debug('readResponse: TIMEOUT');
        const e = new Error('Timeout error.');
        e.name = 'TIMEOUT';
        return cb(e, null);
      }, timeout);
    };

    let ackInterval = null;
    if (responseType === COMMAND.BINARY_RESPONSE) {
      ackInterval = setInterval(() => {
        if (this.sequenceRx !== this.lastAckRx) {
          this.sendAck();
        }
      }, ACK_INTERVAL);
    }

    const aapPackets = [];
    let receiveBuffer = [];
    async.doWhilst(
      (callback) => {
        resetReceiveTimeout();
        this.hidDevice.receive((err, buffer) => {
          if (err) {
            return callback(err, null);
          }
          if (buffer !== undefined && buffer.length > 0) {
            const hidPacket = this.constructor.parseHidPacket(buffer);

            if (hidPacket.responseType === COMMAND.TEXT_RESPONSE) {
              // append newly received data to message string
              receiveBuffer = receiveBuffer.concat(Array.from(hidPacket.data));
            } else if (hidPacket.responseType === COMMAND.BINARY_RESPONSE) {
              const atpPacket = this.constructor.parseAtpFrame(hidPacket.data);
              if (atpPacket === null) {
                // CRC error: try to get damaged package again
                this.sendAck();
              } else if (this.sequenceRx === atpPacket.sequenceTx) {
                // next sequence number expected is one higher than the one just received
                this.sequenceRx = (this.sequenceRx + 1) % 0x100;

                receiveBuffer = receiveBuffer.concat(Array.from(atpPacket.data));
              } else {
                debug(
                  'readResponse: Received wrong sequence number', atpPacket.sequenceTx,
                  ', expected', this.sequenceRx,
                );
                // try to get missing package by sending an ACK containing the next expected
                // sequence number to the device
                this.sendAck();
              }
            } else if (hidPacket.responseType === COMMAND.ACK_FROM_DEVICE) {
              const ackPacket = this.constructor.parseAckFrame(hidPacket.data);
              const validAckSequenceNumbers =
                [this.sequenceTx, ((this.sequenceTx - 1) + 0x100) % 0x100];
              if (validAckSequenceNumbers.indexOf(ackPacket.sequenceRx) === -1) {
                return callback(new Error('Received invalid ACK sequence number: ' +
                  `${ackPacket.sequenceRx} not in ${validAckSequenceNumbers}. Please try again!`));
                // instead of throwing an error here, we could resend the packets the device missed
                // to try and recover this session (but this error does not seem to happen anyways)
              }
            }
          }

          // run test to see if we are done receiving
          return callback();
        });
      },

      () => {
        if (responseType === COMMAND.TEXT_RESPONSE) {
          // if we are waiting for a text response and the buffer contains the status line: done
          return !(TEXT_STATUS_REGEX.exec(String.fromCharCode(...receiveBuffer)));
        } else if (responseType === COMMAND.BINARY_RESPONSE) {
          // collect all valid AAP packets from the buffer
          let aapPacket;
          do {
            aapPacket = this.constructor.parseAapFrame(receiveBuffer);
            if (aapPacket !== null) {
              aapPackets.push(aapPacket);
              // remove parsed packet from buffer
              receiveBuffer = receiveBuffer.slice(aapPacket.packetLength);
            }
          } while (aapPacket !== null && receiveBuffer.length > 0);

          if (aapPackets.length === 0) {
            return true;
          }

          // we can recognise the last AAP packet of a response from its data length
          // or from the number of AAP packets
          const lastAapPacket = aapPackets[aapPackets.length - 1];
          const finalLength = FINAL_AAP_DATA_LENGTHS[lastAapPacket.opCode];
          // if the finalLength value is negative it describes the index of the final AAP packets
          if (finalLength < 0) {
            return aapPackets.length < -finalLength;
          }
          // if it is 0 or higher, it describes the dataLength of the final AAP packet
          return lastAapPacket.dataLength !== finalLength;
        } else if (responseType === null) {
          // no response needed
          return false;
        }
        // continue iterating
        return true;
      },

      (err) => {
        clearTimeout(receiveTimeout);
        // send a final Ack and stop interval timer
        if (ackInterval !== null) {
          clearInterval(ackInterval);
          this.sendAck();
        }
        if (err) {
          return cb(err, null);
        }
        if (responseType === COMMAND.BINARY_RESPONSE) {
          return cb(null, aapPackets);
        }
        return cb(null, String.fromCharCode(...receiveBuffer));
      },
    );
  }

  static validateTextChecksum(dataString, expectedChecksum) {
    /* eslint-disable no-bitwise */
    const calculatedChecksum = dataString.split('')
      .reduce((a, b) => a + (b.charCodeAt(0) & 0xff), 0);
    /* eslint-enable no-bitwise */
    if (calculatedChecksum !== expectedChecksum) {
      debug(`validateTextChecksum: wrong checksum: ${calculatedChecksum} != ${expectedChecksum}`);
    }
    return calculatedChecksum === expectedChecksum;
  }

  static parseHidPacket(buffer) {
    const packet = struct.unpack(buffer, 0, HID_HEADER_FORMAT, ['responseType', 'dataLen']);
    packet.data = buffer.slice(HID_HEADER_LENGTH, HID_HEADER_LENGTH + packet.dataLen);
    return packet;
  }

  static buildHidPacket(commandType, data) {
    const bytes = new Uint8Array(HID_PACKET_SIZE);
    const counter = struct.pack(bytes, 0, HID_HEADER_FORMAT, commandType, data.length);
    if (data.length) {
      // data can be either a TypedArray or a string
      let dataTypeChar = 'B';
      if (typeof (data) === 'string') {
        dataTypeChar = 'Z';
      }
      struct.pack(bytes, counter, data.length + dataTypeChar, data);
    }
    return bytes.buffer;
  }

  /* eslint-disable no-bitwise */
  static parseAapFrame(buffer) {
    const packet = {
      dataLength: 0,
    };

    let dataLengthNumBytes = 0;
    // the first 0 to 3 bytes describe the aap frame length in their lower 7 bits in little endian
    for (let i = 0; i <= 2; i++) {
      if (i >= buffer.length) {
        return null;
      }
      const values = struct.unpack(buffer, i, 'b', ['byte']);
      // if highest bit is not set, this is already the command byte
      if ((values.byte & 0x80) === 0) {
        break;
      }
      // highest bit was set, extract lower 7 bits as length value
      let lengthValue = values.byte & 0x7f;
      // shift these 7 bits to the left depending on the index i
      lengthValue <<= (7 * i);
      // combine these bits with the previous length value
      packet.dataLength |= lengthValue;

      dataLengthNumBytes += 1;
    }

    const opCodeNumBytes = 1;

    if (buffer.length > dataLengthNumBytes) {
      // add opCode to packet
      struct.unpack(buffer, dataLengthNumBytes, 'b', ['opCode'], packet);
    }

    // if there is data missing, return null
    packet.packetLength = dataLengthNumBytes + opCodeNumBytes + packet.dataLength;
    const numBytesMissing = packet.packetLength - buffer.length;
    if (numBytesMissing > 0) {
      return null;
    }

    if ((packet.opCode & 0x80) !== 0) {
      debug(`parseAapFrame: Faulty op code: 0x${packet.opCode.toString(16)}`);
      return null;
    }

    // add data to packet
    packet.data = buffer.slice(dataLengthNumBytes + opCodeNumBytes, packet.packetLength);

    return packet;
  }

  static buildAapFrame(opCode, dataArrayOptional) {
    let dataArray = dataArrayOptional;
    if (dataArray === undefined) {
      dataArray = [];
    }
    const aapDataLengthBytes = [];
    let dataLength = dataArray.length;
    // as long as there are length bits left
    while (dataLength > 0) {
      // put the lowest 7 bits in a length byte and set the high bit
      const lengthByte = 0x80 | (dataLength & 0x7f);
      // append new length byte to length string (little endian ordering)
      aapDataLengthBytes.push(lengthByte);
      // shift length by the 7 bits just used
      dataLength >>= 7;
    }

    const packetFormat = `${aapDataLengthBytes.length}Bb${dataArray.length}B`;
    const packetLength = struct.structlen(packetFormat);

    const bytes = new Uint8Array(packetLength);
    struct.pack(bytes, 0, packetFormat, aapDataLengthBytes, opCode, dataArray);
    return bytes;
  }

  static parseAtpFrame(buffer) {
    const packet = struct.unpack(buffer, 0, ATP_HEADER_FORMAT, ['sequenceRx', 'sequenceTx', 'crc32']);
    packet.data = buffer.slice(ATP_HEADER_LENGTH);
    const crc32 = FreeStyleLibreProtocol.calcCrc32(packet.data);
    if (crc32 !== packet.crc32) {
      debug('parseAtpFrame: CRC32 did not match:', crc32.toString(16), '!=', packet.crc32.toString(16));
      return null;
    }
    return packet;
  }

  static calcCrc32(buffer) {
    // make zero-padded buffer with length that is multiple of 4
    const paddedBuffer = Array.from(buffer).concat(
      Array(((buffer.length + 3) & 0xfffffffc) - buffer.length).fill(0),
    );

    let remainder = 0xffffffff;
    for (let index = 0; index < paddedBuffer.length / 4; index++) {
      let data = struct.extractInt(paddedBuffer, index * 4);

      data ^= remainder;

      for (let i = 0; i < 8; i++) {
        remainder = data >>> 28;
        data <<= 4;
        data ^= CRC32_TABLE[remainder >>> 0]; // use unsigned remainder as index
      }

      remainder = data;
    }
    return remainder >>> 0; // return unsigned remainder
  }
  /* eslint-enable no-bitwise */

  buildAtpFrame(aapFrameArray) {
    const atpCrc = this.constructor.calcCrc32(aapFrameArray);
    const atpFrameArray = new Uint8Array(ATP_HEADER_LENGTH + aapFrameArray.length);
    struct.pack(
      atpFrameArray, 0, `${ATP_HEADER_FORMAT + aapFrameArray.length}B`,
      this.sequenceRx,
      this.sequenceTx,
      atpCrc,
      aapFrameArray,
    );
    return atpFrameArray;
  }

  static parseAckFrame(buffer) {
    const packet = struct.unpack(
      buffer, 0, ACK_HEADER_FORMAT,
      ['sequenceRx', 'sequenceTx', 'unknownData'],
    );
    return packet;
  }

  buildAckFrame(unknownDataOptional) {
    let unknownData = unknownDataOptional;
    if (unknownData === undefined) {
      unknownData = '\x00\x00';
    }
    const ackFrameArray = new Uint8Array(ACK_HEADER_LENGTH);
    struct.pack(
      ackFrameArray, 0, ACK_HEADER_FORMAT,
      this.sequenceRx,
      this.sequenceTx,
      unknownData,
    );
    return ackFrameArray;
  }

  sendAck(unknownData, cbOptional) {
    let cb = cbOptional;
    if (cb === undefined) {
      cb = () => {};
    }
    this.lastAckRx = this.sequenceRx;
    const ackFrameArray = this.buildAckFrame(unknownData);
    this.hidDevice.send(this.constructor.buildHidPacket(COMMAND.ACK_FROM_HOST, ackFrameArray), cb);
  }

  sendCommand(command, responseType, data, cb) {
    this.hidDevice.send(this.constructor.buildHidPacket(command, data), (err) => {
      if (err) {
        cb(err, null);
      } else {
        this.readResponse(responseType, READ_TIMEOUT, cb);
      }
    });
  }

  parseTextResponse(responseData) {
    const match = TEXT_RESPONSE_REGEX.exec(responseData);
    if (!match) {
      return new Error('Invalid text responseData format.');
    }
    const data = match[1];
    const checksum = parseInt(match[2], 16);
    const result = match[3];

    if (result === 'OK') {
      if (this.constructor.validateTextChecksum(data, checksum)) {
        return data.replace(/\r\n$/, '');
      }
      return new Error('Invalid checksum.');
    }
    return new Error(`Device responseData was not "OK", but "${result}"`);
  }

  requestTextResponse(command, successCallback, errorCallback) {
    debug(
      `requestTextResponse: Sending command: 0x${COMMAND.TEXT_REQUEST.toString(16)}`,
      ', data: ', command,
    );
    this.sendCommand(COMMAND.TEXT_REQUEST, COMMAND.TEXT_RESPONSE, command, (err, responseData) => {
      if (err) {
        debug('requestTextResponse: error: ', err);
        return errorCallback(err, responseData);
      }

      const data = this.parseTextResponse(responseData);
      if (data instanceof Error) {
        return errorCallback(data, responseData);
      }
      debug(`requestTextResponse: data: "${data}"`);
      return successCallback(data);
    });
  }

  requestBinaryResponse(opCode, aapData, cb) {
    const atpFrameArray = this.buildAtpFrame(this.constructor.buildAapFrame(opCode, aapData));
    this.sequenceTx = (this.sequenceTx + 1) % 0x100;
    debug(
      `requestBinaryResponse: Sending command: 0x${COMMAND.BINARY_REQUEST.toString(16)}`,
      ', data: ', Buffer.from(atpFrameArray).toString('hex'),
    );
    const packetToSend = this.constructor.buildHidPacket(COMMAND.BINARY_REQUEST, atpFrameArray);
    this.hidDevice.send(packetToSend, (error) => {
      if (error) {
        cb(error, null);
      } else {
        const flushData = this.buildAtpFrame(this.constructor.buildAapFrame(OP_CODE.FLUSH_BUFFERS));
        this.sequenceTx = (this.sequenceTx + 1) % 0x100;
        this.sendCommand(
          COMMAND.BINARY_REQUEST, COMMAND.BINARY_RESPONSE, flushData,
          (err, aapPackets) => {
            if (err) {
              debug('requestBinaryResponse: error: ', err);
              return cb(err, aapPackets);
            }

            debug(`requestBinaryResponse: num aapPackets: ${aapPackets.length}`);
            return cb(null, aapPackets);
          },
        );
      }
    });
  }

  getDBRecords(command, successCallback, errorCallback) {
    debug(`getDBRecords: ${command}`);
    this.requestTextResponse(command, (data) => {
      const match = DB_RECORDS_REGEX.exec(data);
      if (!match) {
        return errorCallback(new Error('Invalid response format for database records.'), data);
      }
      let dbRecords = match[1];
      const dbRecordCount = parseInt(match[2], 10);
      const dbRecordChecksum = parseInt(match[3], 16);

      if (!this.constructor.validateTextChecksum(dbRecords, dbRecordChecksum)) {
        return errorCallback(new Error('Invalid database record checksum.'), data);
      }

      dbRecords = dbRecords.split('\r\n').filter(Boolean);

      if (dbRecordCount !== dbRecords.length) {
        return errorCallback(new Error(`Invalid database record count: ${dbRecordCount} != ${dbRecords.length}`), data);
      }

      return successCallback(dbRecords);
    }, errorCallback);
  }

  // this is currently unused as it uses part of the text protocol not meant for production
  getReaderResultData(cb) {
    this.getDBRecords('$arresult?', (data) => {
      cb(null, { readerResultData: data });
    }, cb);
  }

  // this is currently unused as it uses part of the text protocol not meant for production
  getHistoricalScanData(cb) {
    this.getDBRecords('$history?', (data) => {
      cb(null, { historicalScanData: data });
    }, cb);
  }

  getDBRecordNumber(cb) {
    const command = '$dbrnum?';
    this.requestTextResponse(command, (data) => {
      const match = DB_RECORD_NUMBER_REGEX.exec(data);
      if (!match) {
        return cb(new Error('Invalid response format for database record number.'), data);
      }
      const dbRecordNumber = parseInt(match[1], 10);

      return cb(null, { dbRecordNumber });
    }, cb);
  }

  setCompression(enableCompression, cb) {
    this.requestBinaryResponse(OP_CODE.SET_COMPRESSION, [enableCompression], cb);
  }

  getDateTime(cb) {
    this.requestBinaryResponse(OP_CODE.GET_DATE_TIME, [], cb);
  }

  setDateTime(obj, cb) {
    this.requestBinaryResponse(OP_CODE.SET_DATE_TIME, [
      obj.seconds,
      obj.minutes,
      obj.hours,
      obj.days,
      obj.months,
      obj.yearLow,
      obj.yearHigh,
      0x01,
    ], cb);
  }

  getDbSchema(cb) {
    this.requestBinaryResponse(OP_CODE.GET_DB_SCHEMA, [], cb);
  }

  getCfgSchema(cb) {
    this.requestBinaryResponse(OP_CODE.GET_CFG_SCHEMA, [], cb);
  }

  getCfgData(tableNumber, cb) {
    this.requestBinaryResponse(OP_CODE.GET_CFG_DATA, [tableNumber], cb);
  }

  getDatabase(tableNumber, cb) {
    this.requestBinaryResponse(OP_CODE.GET_DATABASE, [tableNumber], cb);
  }

  getFirmwareVersion(cb) {
    this.requestTextResponse('$swver?', (data) => {
      cb(null, { firmwareVersion: data });
    }, cb);
  }

  getSerialNumber(cb) {
    this.requestTextResponse('$sn?', (data) => {
      cb(null, { serialNumber: data });
    }, cb);
  }

  getReaderTime(cb) {
    this.requestTextResponse('$rdt?', (data) => {
      const arr = data.split(',').map(Number);
      arr[0] += 2000; // only two digits provided for year
      arr[1] -= 1; // month starts at 0 in JS format

      /*
        arr[6] indicates if valid (1) or uncertain (0)
        arr[7] contains offset (in seconds) between factory time and user time (but not on Pro)
      */
      let dateTime = Date.UTC(...arr.slice(0, -2));

      if (arr.length === 8) {
        dateTime += (arr[7] * sundial.SEC_TO_MSEC);
      }

      if (arr[6] === 0) {
        debug('Reader time not valid');
        cb(null);
      } else {
        cb({ readerTime: new Date(dateTime) });
      }
    }, cb);
  }

  initCommunication(cb) {
    const initFunctions = [
      (callback) => { this.sendCommand(COMMAND.INIT_REQUEST_1, null, '', callback); },
      (callback) => { this.sendAck(INIT_ACK_MAGIC_DATA, callback); },
      (callback) => { this.sendCommand(COMMAND.INIT_REQUEST_2, null, '', callback); },
      (callback) => { this.sendCommand(COMMAND.INIT_REQUEST_3, null, '', callback); },
      (callback) => { this.sendCommand(COMMAND.INIT_REQUEST_4, null, '', callback); },
    ];
    async.series(initFunctions, (err, result) => {
      cb(err, result);
    });
  }

  static probe(cb) {
    debug(`probe: not using probe for ${DEVICE_MODEL_NAME}`);
    cb();
  }
}
