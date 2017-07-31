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
 * --- 0x0a: BINARY PROTOCOL request data with AAP OP_CODES?
 * --- 0x0d: ?
 * --- 0x15: ?
 * --- 0x21: TEXT PROTOCOL command
 * --- 0x60: TEXT PROTOCOL command
 *
 * - from device to host:
 * --- 0x06: used in init returning the device's serial number?
 * --- 0x0b: BINARY PROTOCOL response to 0x0a?
 * --- 0x0c: ?
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
 * BINARY COMMAND:
 * - exactly one AAP frame (contained in a single ATP frame, inside a single HID report frame)
 *
 * BINARY RESPONSE:
 * - can span multiple AAP frames, possibly spread over multiple ATP and HID frames
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
const READ_TIMEOUT = 5000;

const COMMAND = {
  TEXT: 0x60
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
  }

  readResponse(commandType, timeout, cb) {
    let abortTimer = null;
    const resetTimeout = () => {
      if (abortTimer !== null) {
        clearTimeout(abortTimer);
      }
      abortTimer = setTimeout(() => {
        debug('readResponse: TIMEOUT');
        const e = new Error('Timeout error.');
        e.name = 'TIMEOUT';
        return cb(e, null);
      }, timeout);
    };

    let message = '';

    async.doWhilst(
        callback => {
          resetTimeout();
          this.hidDevice.receive(raw => {
            // if we did not get any data, continue receiving
            if (raw === undefined || raw.length === 0) {
              return callback(false);
            }
            debug('readResponse: received: ' + raw.length + ': "' + raw + '"');

            const packetHeadStruct = 'bb';
            const packetHeadLength = struct.structlen(packetHeadStruct);
            const packetHead = struct.unpack(raw, 0, packetHeadStruct, ['commandType', 'dataLen']);
            debug('readResponse: packetHead: type: ' + packetHead['commandType'] + ', len: ' + packetHead['dataLen']);

            if (commandType !== null && packetHead['commandType'] !== commandType) {
              debug('readResponse: Invalid packet from ' + DEVICE_MODEL_NAME);
              clearTimeout(abortTimer);
              return callback(new Error('Invalid USB packet received.'));
            }

            // append newly received data to message string
            message += raw.slice(packetHeadLength, packetHeadLength + packetHead['dataLen']);

            // if this was a text command and the status line is not in the received data yet, continue receiving
            if (commandType === COMMAND.TEXT && !TEXT_STATUS_REGEX.exec(message)) {
              return callback(false);
            }

            // data reception is complete
            clearTimeout(abortTimer);
            return callback(true);
          });
        },
        isValid => {
          if (isValid instanceof Error) {
            return cb(isValid, null);
          }
          return (isValid !== true);
        },
        () => {
          return cb(null, message);
        }
    );
  }

  static validateChecksum(data, expectedChecksum) {
    const calculatedChecksum = data.split('')
        .reduce((a, b) => {
          return a + b.charCodeAt(0);
        }, 0);
    debug('validateChecksum: checksum: ' + calculatedChecksum + ' ?= ' + expectedChecksum);
    return calculatedChecksum === expectedChecksum;
  }

  static buildPacket(commandType, data) {
    const buf = new ArrayBuffer(HID_PACKET_SIZE);
    const bytes = new Uint8Array(buf, 0, HID_PACKET_SIZE);
    let counter = struct.pack(bytes, 0, 'bb', commandType, data.length);
    if (data.length) {
      struct.pack(bytes, counter, data.length + 'Z', data);
    }
    return buf;
  }

  sendCommand(command, responseCommand, data, cb) {
    debug('sendCommand: Sending command: ', command, ', data: ', data);
    this.hidDevice.send(this.constructor.buildPacket(command, data), () => {
      this.readResponse(responseCommand, READ_TIMEOUT, cb);
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
    this.sendCommand(COMMAND.TEXT, COMMAND.TEXT, command + '\r\n', (err, responseData) => {
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
        return errorCallback(new Error('Invalid database record count: ' + dbRecordCount + ' != ' + dbRecords.length), data);
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
      cb => { this.sendCommand(0x04, null, '', cb); },
      cb => { this.sendCommand(0x05, null, '', cb); },
      cb => { this.sendCommand(0x15, null, '', cb); },
      cb => { this.sendCommand(0x01, null, '', cb); }
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
