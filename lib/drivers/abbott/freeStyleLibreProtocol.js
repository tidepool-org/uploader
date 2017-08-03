/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
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
 * --- 0x06: used in init returning the device's serial number?
 * --- 0x0b: BINARY PROTOCOL response to 0x0a
 * --- 0x0c: ACK received packets
 * --- 0x22: ?
 * --- 0x34: ?
 * --- 0x35: text response?
 * --- 0x60: TEXT PROTOCOL response
 * --- 0x71: ?
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
 * --- SEQ_RX:  1 byte sequence information? counting how?
 * --- SEQ_TX:  1 byte sequence information? counting how?
 * --- CRC:     32 bit CRC? calculated how?
 * - ATP_DATA
 * --- can contain one or multiple AAP frames or only parts of one
 *
 * AAP_FRAME:
 * - AAP_HEADER:
 * --- AAP_LENGTH: 0 to 3 bytes
 * ----- if high bit is set, the lower 7 bits are the length -> max 21 bits for length
 * ----- if not, this byte is already the OP_CODE byte
 * --- OP_CODE: 1 byte (high bit is 0)
 * - AAP_DATA: up to 2MB spread over multiple ATP_DATA fields of consecutive? ATP_FRAMES
 *
 * OP_CODE:
 * - 0x7d: make device flush its output buffer
 *  (sends remaining AAP data, even if not a full ATP frame can be filled)
 *
 * BINARY COMMAND:
 * - exactly one AAP frame (contained in a single ATP frame, inside a single HID report frame)
 *
 * BINARY RESPONSE:
 * - can span multiple AAP frames, possibly spread over multiple ATP and HID frames
 * - only completely filled ATP frames are sent
 * --- send OP Code 0x7d to force the device to send remaining AAP data in partially filled ATP frame
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
import structJs from '../../struct.js';
const struct = structJs();

const isBrowser = typeof window !== 'undefined';
const debug = isBrowser ? require('bows')('FreeStyleLibreDriver') : console.log;

const DEVICE_MODEL_NAME = 'FreeStyle Libre';

const HID_PACKET_SIZE = 64;
const HID_HEADER_FORMAT = 'bb';
const HID_HEADER_LENGTH = struct.structlen(HID_HEADER_FORMAT);

const ATP_HEADER_FORMAT = 'bbI';
const ATP_HEADER_LENGTH = struct.structlen(ATP_HEADER_FORMAT);

const ACK_HEADER_FORMAT = 'bb2Z';
const ACK_HEADER_LENGTH = struct.structlen(ACK_HEADER_FORMAT);

const READ_TIMEOUT = 5000; // [ms]
const ACK_INTERVAL = 10;  // [ms]

const INIT_ACK_MAGIC_DATA = '\x00\x02';

const COMMAND = {
  INIT_REQUEST_1: 0x04,
  INIT_REQUEST_2: 0x05,
  INIT_REQUEST_3: 0x15,
  INIT_REQUEST_4: 0x01,
  BINARY_REQUEST: 0x0a,
  BINARY_RESPONSE: 0x0b,
  ACK_FROM_DEVICE: 0x0c,
  ACK_FROM_HOST: 0x0d,
  TEXT_REQUEST: 0x21,
  TEXT_RESPONSE: 0x60,
};

const OP_CODE = {
  GET_DATABASE: 0x31,
  GET_SCHEMA: 0x34,
  GET_DATE_TIME: 0x41,
  GET_CFG_SCHEMA: 0x54,
  FLUSH_BUFFERS: 0x7d,
};

// since the CRC algorithm is not documented we use a lookup table for now to determine the CRC values
// data captured using Wireshark: mapping from AAP packet string to its corresponding ATP CRC32
const ATP_CRC_LOOKUP = {
  '\x34': 0x37c63200,
  '\x54': 0xa00097ac,
  '\x41': 0xbbb043f7,
  '\x7d': 0x4f467d16,
  '\x81\x51\x01': 0x26ba1f28,
  '\x81\x51\x02': 0xaf4f762a,
  '\x81\x51\x03': 0x28e3ae2b,
  '\x81\x51\x04': 0xbda4a52e,
  '\x81\x51\x05': 0x3a087d2f,
  '\x81\x51\x06': 0xb3fd142d,
  '\x81\x51\x07': 0x3451cc2c,
  '\x81\x51\x08': 0x99720227,
  '\x81\x51\x09': 0x1ededa26,
  '\x81\x51\x0a': 0x972bb324,
  '\x81\x31\x00': 0xcb4c2248,
  '\x81\x31\x01': 0x4ce0fa49,
  '\x81\x31\x06': 0xd9a7f14c,
  '\x81\x31\x07': 0x5e0b294d,
  '\x81\x60\x01': 0xcfd6f4ca
};

//
// regular expressions for matching text protocol responses
//
const TEXT_CHECKSUM_FORMAT = 'CKSM:([0-9A-F]{8})\r\n';
const TEXT_STATUS_FORMAT = 'CMD (OK|Fail!)\r\n';
const TEXT_STATUS_REGEX = new RegExp(TEXT_STATUS_FORMAT);
// in javascript RegExp "[^]*" has to be used instead of ".*" to match all chars over multiple lines
// the multiline flag /s/ does not exist, so ".*" will never match newlines
const TEXT_RESPONSE_REGEX = new RegExp('^([^]*)' + TEXT_CHECKSUM_FORMAT + TEXT_STATUS_FORMAT);

const DB_RECORD_NUMBER_REGEX = new RegExp('^DB Record Number = ([0-9]+)\r\n$');

// after db record responses (e.g. $arresult?, $history?) an additional line is send,
// containing the record count and an additional checksum of just the records:
// COUNT,RECORD_CHECKSUM\r\n
const DB_RECORDS_REGEX = new RegExp('^([^]*\r\n)([0-9]+),([0-9A-F]{8})\r\n$');


export class FreeStyleLibreProtocol {

  constructor(config) {
    this.config = config;
    this.hidDevice = config.deviceComms;
    this.sequenceRx = 0;
    this.sequenceTx = 0;
    this.receiveBuffer = {};
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
          debug('readResponse: ackInterval');
          this.sendAck();
        }
      }, ACK_INTERVAL);
    }

    let aapPackets = [];
    async.doWhilst(
        callback => {
          debug('\niteratee\n');
          resetReceiveTimeout();
          this.hidDevice.receive(buffer => {

            if (buffer !== undefined && buffer.length > 0) {
              //debug('readResponse: received: ' + buffer.length + ' bytes: "' + buffer + '"');

              const hidPacket = this.constructor.parseHidPacket(buffer);

              if (hidPacket.responseType === COMMAND.TEXT_RESPONSE) {

                // append newly received data to message string
                if (this.receiveBuffer[responseType] !== undefined) {
                  this.receiveBuffer[responseType] = Buffer.concat([this.receiveBuffer[responseType], hidPacket.data]);
                } else {
                  this.receiveBuffer[responseType] = hidPacket.data;
              }

              } else if (hidPacket.responseType === COMMAND.BINARY_RESPONSE) {

                const atpPacket = this.constructor.parseAtpFrame(hidPacket.data);
                if (this.sequenceRx === atpPacket.sequenceTx) {
                  // next sequence number expected is one higher than the one just received
                  this.sequenceRx += 1;

                  if (this.receiveBuffer[responseType] !== undefined) {
                    this.receiveBuffer[responseType] = Buffer.concat([this.receiveBuffer[responseType], atpPacket.data]);
                  } else {
                    this.receiveBuffer[responseType] = atpPacket.data;
                  }
                } else {
                  debug('readResponse: Received wrong sequence number ' + atpPacket.sequenceTx + ', expected ' + this.sequenceRx);
                }

              } else if (hidPacket.responseType === COMMAND.ACK_FROM_DEVICE) {

                // ignore these for now

              } else if (responseType !== null && responseType !== hidPacket.responseType) {

                debug('readResponse: Unknown response type 0x' + hidPacket.responseType.toString(16) + ' from ' + DEVICE_MODEL_NAME);
                //clearTimeout(receiveTimeout);
                //return callback(new Error('Unknown response type received.'));

              }
            }

            // run test to see if we are done receiving
            return callback();
          });
        },

        () => {
          debug('\ntest\n');
          if (responseType === COMMAND.TEXT_RESPONSE) {
            // if we are waiting for a text response and the buffer contains the status line, we're done
            return !(TEXT_STATUS_REGEX.exec(this.receiveBuffer[responseType]));

          } else if (responseType === COMMAND.BINARY_RESPONSE) {

            debug('readResponse: binary data buffer length: ' + this.receiveBuffer[responseType].length);
            debug('readResponse: seqRx: ' + this.sequenceRx);

            // collect all valid AAP packets from the buffer
            let aapPacket;
            do {
              aapPacket = this.constructor.parseAapFrame(this.receiveBuffer[responseType]);
              if (aapPacket !== null) {
                aapPackets += aapPacket;
                // remove parsed packet from buffer
                this.receiveBuffer[responseType] = this.receiveBuffer[responseType].slice(aapPacket.packetLength);
              }
            } while (aapPacket !== null);

            return (aapPackets.length === 0 || aapPackets[aapPackets.length - 1].dataLength !== 0);

          } else if (responseType === null) {

            // no response needed
            return false;

          }
          // continue iterating
          return true;
        },

        (err) => {
          debug('\nfinal\n');
          clearTimeout(receiveTimeout);
          // send a final Ack and stop interval timer
          if (ackInterval !== null) {
            clearInterval(ackInterval);
            debug('readResponse: final ack');
            this.sendAck();
          }
          if (err) {
            return cb(err, null);
          }
          return cb(null, this.receiveBuffer[responseType]);
        }
    );
  }

  static validateChecksum(data, expectedChecksum) {
    const calculatedChecksum = data.split('')
        .reduce((a, b) => {
          return a + (b.charCodeAt(0) & 0xff);
        }, 0);
    debug('validateChecksum: checksum: ' + calculatedChecksum + ' ?= ' + expectedChecksum);
    return calculatedChecksum === expectedChecksum;
  }

  static parseHidPacket(buffer) {
    const packet = struct.unpack(buffer, 0, HID_HEADER_FORMAT, ['responseType', 'dataLen']);
    debug('parseHidPacket: packet: type: 0x' + packet.responseType.toString(16) + ', len: ' + packet['dataLen']);
    packet.data = buffer.slice(HID_HEADER_LENGTH, HID_HEADER_LENGTH + packet['dataLen']);
    return packet;
  }
  
  static buildHidPacket(commandType, data) {
    const bytes = new Uint8Array(HID_PACKET_SIZE);
    let counter = struct.pack(bytes, 0, HID_HEADER_FORMAT, commandType, data.length);
    if (data.length) {
      // data can be either a TypedArray or a string
      let dataTypeChar = 'B';
      if (typeof(data) === 'string') {
        dataTypeChar = 'Z';
      }
      struct.pack(bytes, counter, data.length + dataTypeChar, data);
    }
    return bytes.buffer;
  }

  static parseAapFrame(buffer) {
    const packet = {
      dataLength: 0
    };

    let dataLengthNumBytes = 0;
    // the first 0 to 3 bytes describe the aap frame length in their lower 7 bits in little endian
    for (let i = 0; i <= Math.min(2, buffer.length); i++) {
      const values = struct.unpack(buffer, i, 'b', ['byte']);
      // if highest bit is not set, this is already the command byte
      if ((values['byte'] & 0x80) === 0) {
        break;
      }
      // highest bit was set, extract lower 7 bits as length value
      let lengthValue = values['byte'] & 0x7f;
      // shift these 7 bits to the left depending on the index i
      lengthValue = lengthValue << (7 * i);
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
    let numBytesMissing = packet.packetLength - buffer.length;
    if (numBytesMissing > 0) {
      debug('parseAapFrame: still missing ' + numBytesMissing + ' bytes');
      if (packet['opCode'] !== undefined) {
        debug('parseAapFrame: waiting for op code: 0x' + packet['opCode'].toString(16) + ', data length: ' + packet.dataLength);
      }
      return null;
    }

    if ((packet['opCode'] & 0x80) !== 0) {
      debug('parseAapFrame: Faulty op code: 0x' + packet['opCode'].toString(16));
      return null;
    }

    // add data to packet
    packet.data = buffer.slice(dataLengthNumBytes + opCodeNumBytes, packet.dataLength);
    debug('parseAapFrame: got op code: 0x' + packet['opCode'].toString(16) + ', data length: ' + packet.dataLength);

    return packet;
  }

  static buildAapFrame(opCode, data) {
     if (data === undefined) {
      data = '';
    }
    let aapDataLengthBytes = [];
    let dataLength = data.length;
    // as long as there are length bits left
    while (dataLength > 0) {
      // put the lowest 7 bits in a length byte and set the high bit
      let lengthByte = 0x80 | (dataLength & 0x7f);
      // prepend length string with new length byte
      aapDataLengthBytes.append(lengthByte);
      // shift length by the 7 bits just used
      dataLength = dataLength >> 7;
    }

    const packetFormat = aapDataLengthBytes.length + 'B' + 'b' + data.length + 'Z';
    const packetLength = struct.structlen(packetFormat);

    const bytes = new Uint8Array(packetLength);
    struct.pack(bytes, 0, packetFormat, aapDataLengthBytes, opCode, data);
    return bytes;
  }

  static parseAtpFrame(buffer) {
    const packet = struct.unpack(buffer, 0, ATP_HEADER_FORMAT, ['sequenceRx', 'sequenceTx', 'crc32']);
    packet.data = buffer.slice(ATP_HEADER_LENGTH);
    return packet;
  }

  buildAtpFrame(aapFrameArray) {
    // TODO: actually calculate CRC as soon as we know the CRC algo
    //let atpCrc = 0x37c63200; // CRC for OP Code 0x31 (getschema)
    const aapFrameString = struct.extractString(aapFrameArray);
    let atpCrc = ATP_CRC_LOOKUP[aapFrameString];
    if (atpCrc === undefined) {
      debug('buildAtpFrame: Error looking up CRC for "' + aapFrameString + '"');
      return null;
    }

    const atpFrameArray = new Uint8Array(ATP_HEADER_LENGTH + aapFrameArray.length);
    struct.pack(atpFrameArray, 0, ATP_HEADER_FORMAT + aapFrameArray.length + 'B',
      this.sequenceRx,
      this.sequenceTx,
      atpCrc,
      aapFrameArray);
    return atpFrameArray;
  }

  buildAckFrame(unknownData) {
    if (unknownData === undefined) {
      unknownData = '\x00\x00';
    }
    const ackFrameArray = new Uint8Array(ACK_HEADER_LENGTH);
    struct.pack(ackFrameArray, 0, ACK_HEADER_FORMAT,
      this.sequenceRx,
      this.sequenceTx,
      unknownData);
    return ackFrameArray;
  }

  sendAck(unknownData, cb) {
    debug('sendAck: Sending ack');
    if (cb === undefined) {
      cb = () => {};
    }
    this.lastAckRx = this.sequenceRx;
    const ackFrameArray = this.buildAckFrame(unknownData);
    this.hidDevice.send(this.constructor.buildHidPacket(COMMAND.ACK_FROM_HOST, ackFrameArray), cb);
  }

  sendCommand(command, responseType, data, cb) {
    debug('sendCommand: Sending command: 0x' + command.toString(16), ', data: ', data);
    this.hidDevice.send(this.constructor.buildHidPacket(command, data), () => {
      if (responseType !== null) {
        // clear receive buffer for this response type
        this.receiveBuffer[responseType] = new Buffer(0);
      }
      this.readResponse(responseType, READ_TIMEOUT, cb);
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
      if (this.constructor.validateChecksum(data, checksum)) {
        return data;
      } else {
        return new Error('Invalid checksum.');
      }
    } else {
      return new Error('Device responseData was not "OK", but "' + result + '"');
    }
  }

  requestTextResponse(command, successCallback, errorCallback) {
    this.sendCommand(COMMAND.TEXT_REQUEST, COMMAND.TEXT_RESPONSE, command, (err, responseData) => {
      if (err) {
        debug('requestTextResponse: error: ', err);
        return errorCallback(err, responseData);
      }

      debug('requestTextResponse: responseData: "' + responseData + '"');
      const data = this.parseTextResponse(responseData);
      if (data instanceof Error) {
        return errorCallback(data, responseData);
      }
      return successCallback(data);
    });
  }

  requestBinaryResponse(opCode, aapData, successCallback, errorCallback) {
    const aapFrameArray = this.constructor.buildAapFrame(opCode, aapData);
    const atpFrameArray = this.buildAtpFrame(aapFrameArray);
    const atpFrameString = struct.extractString(atpFrameArray);
    this.sequenceTx += 1;
    this.hidDevice.send(this.constructor.buildHidPacket(COMMAND.BINARY_REQUEST, atpFrameString), () => {

      let flushData = this.buildAtpFrame(this.constructor.buildAapFrame(OP_CODE.FLUSH_BUFFERS, ''));
      this.sequenceTx += 1;
      this.sendCommand(COMMAND.BINARY_REQUEST, COMMAND.BINARY_RESPONSE, flushData, (err, responseData) => {
        if (err) {
          debug('requestBinaryResponse: error: ', err);
          return errorCallback(err, responseData);
        }

        debug('requestBinaryResponse: responseData: "' + responseData + '"');
        const data = this.parseBinaryResponse(responseData);
        if (data instanceof Error) {
          return errorCallback(data, responseData);
        }
        return successCallback(data);
      });

    });
  }

  getDBRecords(command, successCallback, errorCallback) {
    debug('getDBRecords: ' + command);
    this.requestTextResponse(command, data => {
      const match = DB_RECORDS_REGEX.exec(data);
      if (!match) {
        return errorCallback(new Error('Invalid response format for database records.'), data);
      }
      let dbRecords = match[1];
      const dbRecordCount = parseInt(match[2]);
      const dbRecordChecksum = parseInt(match[3], 16);

      if (!this.constructor.validateChecksum(dbRecords, dbRecordChecksum)) {
        return errorCallback(new Error('Invalid database record checksum.'), data);
      }

      dbRecords = dbRecords.replace(/\r\n$/, '').split('\r\n');

      if (dbRecordCount !== dbRecords.length) {
        return errorCallback(
          new Error('Invalid database record count: ' + dbRecordCount + ' != ' + dbRecords.length), data);
      }

      successCallback(null, dbRecords);
    }, errorCallback);
  }

  getReaderResultData(cb) {
    this.getDBRecords('$arresult?', data => {
      cb(null, {readerResultData: data});
    }, cb);
  }

  getHistoricalScanData(cb) {
    this.getDBRecords('$history?', data => {
      cb(null, {historicalScanData: data});
    }, cb);
  }

  getDBRecordNumber(cb) {
    const command = '$dbrnum?';
    this.requestTextResponse(command, data => {
      const match = DB_RECORD_NUMBER_REGEX.exec(data);
      if (!match) {
        return cb(new Error('Invalid response format for database record number.'), data);
      }
      const dbRecordNumber = parseInt(match[1]);

      cb(null, {dbRecordNumber: dbRecordNumber});
    }, cb);
  }

  getDateTime(cb) {
    this.requestBinaryResponse(OP_CODE.GET_DATE_TIME, '', data => {
      cb(null, {deviceDateTime: data});
    }, cb);
  }

  getDBSchema(cb) {
    this.requestBinaryResponse(OP_CODE.GET_SCHEMA, '', data => {
      cb(null, {dbSchema: data});
    }, cb);
  }

  getFirmwareVersion(cb) {
    this.requestTextResponse('$swver?', data => {
      cb(null, {firmwareVersion: data.replace(/\r\n$/, '')});
    }, cb);
  }

  getSerialNumber(cb) {
    this.requestTextResponse('$sn?', data => {
      cb(null, {serialNumber: data.replace(/\r\n$/, '')});
    }, cb);
  }

  initCommunication(cb) {
    const initFunctions = [
      cb => { this.sendCommand(COMMAND.INIT_REQUEST_1, null, '', cb); },
      cb => { this.sendAck(INIT_ACK_MAGIC_DATA, cb); },
      cb => { this.sendCommand(COMMAND.INIT_REQUEST_2, null, '', cb); },
      cb => { this.sendCommand(COMMAND.INIT_REQUEST_3, null, '', cb); },
      cb => { this.sendCommand(COMMAND.INIT_REQUEST_4, null, '', cb); }
    ];
    async.series(initFunctions, (err, result) => {
      cb(err, result);
    });
  }

  static probe(cb) {
    debug('probe: not using probe for ' + DEVICE_MODEL_NAME);
    cb();
  }
}
