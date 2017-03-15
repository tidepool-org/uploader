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

/* global chrome */

// I *like* for..in
/* eslint no-restricted-syntax: [0, "ForInStatement"] */

// TODO - find all Promises without a catch()

const _ = require('lodash');
const async = require('async');
const sundial = require('sundial');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const crcCalculator = require('../../crc.js');
const lzo = require('../../lzo');
const NGPUtil = require('./NGPUtil');
const NGPHistoryParser = require('./NGPHistoryParser');
const Medtronic600Simulator = require('./medtronic600Simulator');

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('../../bows')('Medtronic600Driver') : console.log;

class ExtendableError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    this.message = message;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}

class TimeoutError extends ExtendableError {}

class InvalidMessageError extends ExtendableError {}

class ChecksumError extends ExtendableError {
  constructor(expectedChecksum, calculatedChecksum, message = 'Message checksums do not match') {
    super(`${message}: Expected ${expectedChecksum}, but calculated ${calculatedChecksum}`);
  }
}

class RetryError extends ExtendableError {}

class BCNLMessage {
  constructor(bytes, responseType) {
    if (new.target === BCNLMessage) {
      throw new TypeError(`Cannot construct ${new.target.name} instances directly`);
    }

    this.payload = Buffer.from(bytes);
    this.responseType = responseType;
    this.retries = 0;
  }

  static get USB_BLOCKSIZE() {
    return 64;
  }
  static get MAGIC_HEADER() {
    return 'ABC';
  }
  static get READ_TIMEOUT_MS() {
    return 4000;
  }
  static get SEND_DELAY_MS() {
    return 500;
  }

  static get ASCII_CONTROL() {
    return {
      ACK: 0x06,
      CR: 0x0D,
      ENQ: 0x05,
      EOT: 0x04,
      ETB: 0x17,
      ETX: 0x03,
      LF: 0x0A,
      NAK: 0x15,
      STX: 0x02,
    };
  }

  static get MAX_RETRIES() {
    return 5;
  }

  static wait(delay) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      setTimeout(resolve, delay);
    });
  }

  messageFailure() {
    if (this.retries >= BCNLMessage.MAX_RETRIES) {
      throw new RetryError(`Failed to read message after ${this.retries} times`);
    }
    this.retries += 1;
  }

  messageSuccess() {
    this.retries = 0;
  }

  toString() {
    return this.payload.toString('hex');
  }

  // eslint-disable-next-line class-methods-use-this
  readMessage(hidDevice, readTimeout = BCNLMessage.READ_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      let timeoutFlag = false;
      const abortTimer = setTimeout(() => {
        debug('TIMEOUT');
        timeoutFlag = true;
        return reject(new TimeoutError('Timeout error.'));
      }, readTimeout);

      let message = Buffer.alloc(0);

      async.doWhilst(
        (callback) => {
          hidDevice.receive((raw) => {
            const packet = Buffer.from(new Uint8Array(raw));

            // Only process if we get data
            if (packet.length === 0) {
              return callback(false);
            }

            const header = packet.slice(0, 3).toString('ascii');
            const size = packet[3];

            if (header !== BCNLMessage.MAGIC_HEADER) {
              debug('Invalid packet from Contour device');
              clearTimeout(abortTimer);
              return callback(new InvalidMessageError('Unexpected USB packet header.'), null);
            }

            message = Buffer.concat([message, packet.slice(4)],
              (message.length + packet.length) - 4);

            // USB_BLOCKSIZE - 4, because we don't include the MAGIC_HEADER or the size byte
            if (size < (BCNLMessage.USB_BLOCKSIZE - 4)) {
              clearTimeout(abortTimer);
              return callback(null, false); // We don't have to readMoreBytes
            }
            return callback(null, true); // We have to readMoreBytes
          });
        },
        readMoreBytes => readMoreBytes, // Shall we doWhilst again?
        (err) => {
          if (err instanceof Error) {
            throw err;
          }
          if (!timeoutFlag) {
            debug('### READ USB DATA', message.toString('hex'));
            resolve(message);
          }
        } // eslint-disable-line comma-dangle, for node
      );
    });
  }

  sendMessage(hidDevice) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      let pos = 0;
      const message = this.payload;

      async.doWhilst(
        (callback) => {
          const bytes = Buffer.alloc(BCNLMessage.USB_BLOCKSIZE);
          const sendLength = (pos + 60 > message.length) ? message.length - pos : 60;
          bytes.write(BCNLMessage.MAGIC_HEADER, 0);
          bytes.writeUInt8(sendLength, 3);
          bytes.write(message.slice(pos, pos + sendLength).toString('binary'), 4, 'binary');
          debug('### SENDING USB DATA', bytes.toString('hex'));

          hidDevice.send(bytes.buffer.slice(), () => {
            pos += sendLength;
            callback();
          });
        },
        () => pos < message.length,
        () => resolve() // eslint-disable-line comma-dangle, for node
      );
    });
  }

  send(hidDevice, readTimeout = BCNLMessage.READ_TIMEOUT_MS, sendDelay = 0) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      // Timeout might be zero, but the callback will fire anyway
      this.sendMessage(hidDevice)
        .then(() => BCNLMessage.wait(sendDelay))
        .then(() => this.readMessage(hidDevice, readTimeout))
        .then((response) => {
          const ResponseClass = this.responseType;
          const message = new ResponseClass(response);
          resolve(message);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
}

class BCNLCommandResponse extends BCNLMessage {
  checkAsciiControl(expect = BCNLMessage.ASCII_CONTROL.ACK) {
    if (this.payload[0] !== expect) {
      throw new Error(`Unexpected ASCII control message. Expected ${expect}. Got ${this.payload[0]}`);
    }
  }
}

class BCNLCommand extends BCNLMessage {
  constructor(command) {
    if (typeof command === 'number') {
      // For the ASCII control messages
      super(Buffer.from([command]), BCNLCommandResponse);
    } else {
      // For regular strings
      super(Buffer.from(command, 'ascii'), BCNLCommandResponse);
    }
  }
}

class DeviceInfoRequestResponse extends BCNLMessage {
  getModelAndSerial() {
    const serialMatch = /\d{4}-\d{7}/.exec(this.payload);
    return serialMatch.length === 1 ? serialMatch[0] : null;
  }
}

class DeviceInfoRequestCommand extends BCNLCommand {
  constructor() {
    super('X');
  }

  // Override send(), because we do a 'double read' after sending the request
  send(hidDevice, readTimeout = BCNLMessage.READ_TIMEOUT_MS,
    sendDelay = BCNLMessage.SEND_DELAY_MS) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      let response1 = null;

      // Timeout might be zero, but the callback will fire anyway
      // We use sendMessage instead of super.send() because we want to pull raw
      // data only, and we can't determine response types until after we've checked
      // them. The CNL can send the messages in different orders.
      this.sendMessage(hidDevice)
        .then(() => BCNLMessage.wait(sendDelay))
        .then(() => this.readMessage(hidDevice, readTimeout))
        .then((response) => {
          response1 = response;
        })
        .then(() => BCNLMessage.wait(sendDelay))
        .then(() => this.readMessage(hidDevice, readTimeout))
        .then((response2) => {
          let astmInfo = '';

          if (response1[0] === BCNLMessage.ASCII_CONTROL.EOT) {
            astmInfo = Buffer.from(response1).toString('ascii');
            new BCNLCommandResponse(response2).checkAsciiControl(BCNLMessage.ASCII_CONTROL.ENQ);
          } else {
            astmInfo = Buffer.from(response2).toString('ascii');
            new BCNLCommandResponse(response1).checkAsciiControl(BCNLMessage.ASCII_CONTROL.ENQ);
          }
          const message = new DeviceInfoRequestResponse(astmInfo);
          resolve(message);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
}

class MinimedPumpSession {
  constructor(bcnlModelAndSerial) {
    this.envelopeSequenceNumber = 0;
    this.ngpSequenceNumber = 0;
    this.comDSequenceNumber = 0;
    this.bcnlModelAndSerial = bcnlModelAndSerial;
    this.radioChannel = null;
    this.linkMAC = null;
    this.pumpMAC = null;
    this.key = null;
    this.pumpModel = null;
    this.pumpSerial = null;
  }

  get bcnlSerialNumber() {
    return this.bcnlModelAndSerial.replace(/\d+-/, '');
  }

  get iv() {
    const iv = Buffer.from(this.key);
    iv[0] = this.radioChannel;

    return iv;
  }

  get packedLinkMAC() {
    return Buffer.from(this.linkMAC, 'hex').swap64().toString('binary');
  }

  get packedPumpMAC() {
    return Buffer.from(this.pumpMAC, 'hex').swap64().toString('binary');
  }

  getHMAC() {
    const paddingKey = 'A4BD6CED9A42602564F413123';
    const digest = crypto.createHash('sha256')
      .update(`${this.bcnlSerialNumber}${paddingKey}`)
      .digest()
      .reverse();
    return digest;
  }
}

class MinimedMessage extends BCNLMessage {
  static get COMMAND_TYPE() {
    return {
      OPEN_CONNECTION: 0x10,
      CLOSE_CONNECTION: 0x11,
      SEND_MESSAGE: 0x12,
      READ_INFO: 0x14,
      REQUEST_LINK_KEY: 0x16,
      SEND_LINK_KEY: 0x17,
      RECEIVE_MESSAGE: 0x80,
      SEND_MESSAGE_RESPONSE: 0x81,
      REQUEST_LINK_KEY_RESPONSE: 0x86,
    };
  }

  static get ENVELOPE_SIZE() {
    return 33;
  }

  static get MINIMED_HEADER() {
    return 0x5103; // Q\x03
  }

  static oneByteChecksum(buffer) {
    // eslint-disable-next-line no-bitwise
    return _.reduce(buffer, (a, b) => a + b, 0) & 0xff;
  }
}

class MinimedResponse extends MinimedMessage {
  constructor(payload) {
    super(payload);

    if (this.payload.readUInt16BE(0x00) !== MinimedMessage.MINIMED_HEADER) {
      throw new InvalidMessageError('Unexpected MiniMed packet header.');
    }

    const minimedPayloadSize = this.payload.readUInt16LE(0x1C);
    // Check the payload's checksums
    const minimedPayload =
      Buffer.from(this.payload.slice(0x00, MinimedMessage.ENVELOPE_SIZE + minimedPayloadSize));
    const expectedChecksum = minimedPayload[0x20];
    const calculatedChecksum =
      // eslint-disable-next-line no-bitwise
      (MinimedMessage.oneByteChecksum(minimedPayload) - expectedChecksum) & 0xFF;

    if (expectedChecksum !== calculatedChecksum) {
      throw new ChecksumError(expectedChecksum, calculatedChecksum);
    }
  }
}

class MinimedRequest extends MinimedMessage {
  constructor(commandType, pumpSession, payload, responseType = MinimedResponse) {
    if (new.target === MinimedRequest) {
      throw new TypeError(`Cannot construct ${new.target.name} instances directly`);
    }

    super(MinimedRequest.buildPayload(commandType, pumpSession, payload), responseType);
    this.pumpSession = pumpSession;
  }

  static buildPayload(commandType, pumpSession, payload) {
    const payloadLength = (payload === null) ? 0 : payload.length;
    const payloadBuffer = Buffer.alloc(MinimedMessage.ENVELOPE_SIZE + payloadLength);

    payloadBuffer.writeUInt16BE(MinimedMessage.MINIMED_HEADER, 0); // Q\x03
    payloadBuffer.write('000000', 2); // Pump serial. '000000' for 600-series
    payloadBuffer.fill(0, 8, 18); // Unknown bytes (hardcoded)
    payloadBuffer.writeUInt8(commandType, 18);
    payloadBuffer.writeUInt32LE(pumpSession.envelopeSequenceNumber += 1, 19);
    payloadBuffer.fill(0, 23, 28); // Unknown bytes (hardcoded)
    payloadBuffer.writeUInt16LE(payloadLength, 28);
    payloadBuffer.fill(0, 30, 32); // Unknown bytes (hardcoded)
    payloadBuffer.writeUInt8(0, 32); // Placeholder for the single byte checksum
    if (payloadLength > 0) {
      payloadBuffer.write(Buffer.from(payload).toString('binary'), 33, 'binary');
    }

    // Now that we have written the message, calculate the CRC
    const checksum = MinimedMessage.oneByteChecksum(payloadBuffer);
    payloadBuffer.writeUInt8(checksum, 32);
    return payloadBuffer;
  }
}

class NGPMessage extends MinimedMessage {
  static get COMMAND_TYPE() {
    return {
      INITIALIZE: 0x01,
      SCAN_NETWORK: 0x02,
      JOIN_NETWORK: 0x03,
      LEAVE_NETWORK: 0x04,
      TRANSMIT_PACKET: 0x05,
      READ_DATA: 0x06,
      READ_STATUS: 0x06,
      READ_NETWORK_STATUS: 0x06,
      SET_SECURITY_MODE: 0x0c,
      READ_STATISTICS: 0x0d,
      SET_RF_MODE: 0x0e,
      CLEAR_STATUS: 0x10,
      SET_LINK_KEY: 0x14,
      COMMAND_RESPONSE: 0x55, // 'U'
    };
  }

  static get ENVELOPE_SIZE() {
    return 2;
  }

  static get CHECKSUM_SIZE() {
    return 2;
  }

  static ccittChecksum(buffer, length) {
    return crcCalculator.calcCRC_A(buffer, length);
  }
}

class NGPResponse extends MinimedResponse {
  constructor(payload, pumpSession) {
    super(payload, pumpSession);

    if (this.payload[MinimedMessage.ENVELOPE_SIZE] !==
      NGPMessage.COMMAND_TYPE.COMMAND_RESPONSE) {
      throw new InvalidMessageError('Unexpected NGP packet header.');
    }

    const ngpPayloadSize = this.payload[0x22];
    // Check the payload's checksums
    const ngpPayload =
      Buffer.from(this.payload.slice(MinimedMessage.ENVELOPE_SIZE, MinimedMessage.ENVELOPE_SIZE +
        ngpPayloadSize + NGPMessage.CHECKSUM_SIZE));
    const expectedChecksum = ngpPayload.readUInt16LE(ngpPayload.length - 2);
    const calculatedChecksum =
      NGPMessage.ccittChecksum(ngpPayload, ngpPayload.length - 2);

    if (expectedChecksum !== calculatedChecksum) {
      throw new ChecksumError(expectedChecksum, calculatedChecksum);
    }
  }
}

class NGPRequest extends NGPMessage {
  static get READ_TIMEOUT_MS() {
    return 256; // Timeout for a NGPMessage is different than for Bayer
  }

  constructor(commandType, pumpSession, payload, responseType = NGPResponse) {
    if (new.target === NGPRequest) {
      throw new TypeError(`Cannot construct ${new.target.name} instances directly`);
    }

    super(NGPRequest.buildPayload(commandType, pumpSession, payload), responseType);
    this.pumpSession = pumpSession;
  }

  static buildPayload(commandType, pumpSession, payload) {
    const payloadLength = (payload === null) ? 0 : payload.length;
    const payloadBuffer = Buffer.alloc(
      NGPMessage.ENVELOPE_SIZE + payloadLength + NGPMessage.CHECKSUM_SIZE);

    payloadBuffer.writeUInt8(commandType, 0);
    payloadBuffer.writeUInt8(NGPMessage.ENVELOPE_SIZE + payloadLength, 1);
    if (payloadLength > 0) {
      payloadBuffer.write(Buffer.from(payload).toString('binary'), 2, 'binary');
    }

    // Now that we have written the message, calculate the CRC
    const messageSize = payloadBuffer.length - 2;
    const checksum = NGPMessage.ccittChecksum(payloadBuffer, messageSize);
    payloadBuffer.writeUInt16LE(checksum, messageSize);

    return MinimedRequest.buildPayload(MinimedRequest.COMMAND_TYPE.SEND_MESSAGE,
      pumpSession, payloadBuffer);
  }

  // Override send(), because we do an 'optional double read' after sending the request
  // TODO - add 10 retries for timeouts using async.whilst()
  send(hidDevice, readTimeout = NGPMessage.READ_TIMEOUT_MS, sendDelay = 0, get80response = true) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      // Timeout might be zero, but the callback will fire anyway
      this.sendMessage(hidDevice)
        .then(() => BCNLMessage.wait(sendDelay))
        .then(() => this.readMessage(hidDevice, readTimeout))
        .then(() => {
          // CLPro doesn't check the 0x81 response, so we don't either.
          if (get80response) {
            this.readMessage(hidDevice, readTimeout)
              .then((receiveMessageResponse) => {
                const ResponseClass = this.responseType;
                const message = new ResponseClass(receiveMessageResponse, this.pumpSession);
                resolve(message);
              })
              .catch((err) => {
                reject(err);
              });
          } else {
            resolve();
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
}

// TODO - See if we have already joined a network, so that we don't need to JOIN_NETWORK again.
class OpenConnectionResponse extends MinimedResponse {}

class OpenConnectionRequest extends MinimedRequest {
  constructor(pumpSession) {
    super(MinimedMessage.COMMAND_TYPE.OPEN_CONNECTION, pumpSession, pumpSession.getHMAC(),
      OpenConnectionResponse);
  }
}

class CloseConnectionResponse extends MinimedResponse {}

class CloseConnectionRequest extends MinimedRequest {
  constructor(pumpSession) {
    super(MinimedMessage.COMMAND_TYPE.CLOSE_CONNECTION, pumpSession, pumpSession.getHMAC(),
      CloseConnectionResponse);
  }
}

class ReadInfoResponse extends MinimedResponse {
  // Link MAC and Pump MAC are packed as a 64-bit integers, but JavaScript doesn't support those,
  // so we'll store them as a hex strings.
  get linkMAC() {
    const offset = MinimedMessage.ENVELOPE_SIZE + 0x00;
    return this.payload.slice(offset, offset + 8).toString('hex');
  }

  get pumpMAC() {
    const offset = MinimedMessage.ENVELOPE_SIZE + 0x08;
    return this.payload.slice(offset, offset + 8).toString('hex');
  }

  get linkCounter() {
    return this.payload.readUInt16LE(MinimedMessage.ENVELOPE_SIZE + 0x10);
  }

  get encryptionMode() {
    // eslint-disable-next-line no-bitwise
    return this.payload[MinimedMessage.ENVELOPE_SIZE + 0x12] & 1;
  }

  get isAssociated() {
    return this.pumpMAC !== '0000000000000000';
  }
}

class ReadInfoRequest extends MinimedRequest {
  constructor(pumpSession) {
    super(MinimedMessage.COMMAND_TYPE.READ_INFO, pumpSession, null, ReadInfoResponse);
  }
}

class RequestLinkKeyResponse extends MinimedResponse {
  get packedLinkKey() {
    return this.payload.slice(MinimedMessage.ENVELOPE_SIZE, MinimedMessage.ENVELOPE_SIZE + 55);
  }

  linkKey(cnlModelAndSerial) {
    const key = Buffer.alloc(16);

    // eslint-disable-next-line no-bitwise
    let pos = cnlModelAndSerial.slice(-1) & 7;

    /* eslint-disable no-bitwise */
    for (let i = 0; i < key.length; i++) {
      if ((this.packedLinkKey[pos + 1] & 1) === 1) {
        key[i] = ~this.packedLinkKey[pos];
      } else {
        key[i] = this.packedLinkKey[pos];
      }

      if (((this.packedLinkKey[pos + 1] >> 1) & 1) === 0) {
        pos += 3;
      } else {
        pos += 2;
      }
    }
    /* eslint-enable no-bitwise */

    return key;
  }
}

class RequestLinkKeyRequest extends MinimedRequest {
  constructor(pumpSession) {
    super(MinimedMessage.COMMAND_TYPE.REQUEST_LINK_KEY, pumpSession, null, RequestLinkKeyResponse);
  }
}

class JoinNetworkResponse extends NGPResponse {
  get radioChannel() {
    if (this.payload.length > 46 && this.payload[0x33] === 0x82 && this.payload[0x44] === 0x42) {
      return this.payload[0x4c];
    }

    return 0;
  }

  get joinedNetwork() {
    return this.radioChannel !== 0;
  }
}

class JoinNetworkRequest extends NGPRequest {
  static get READ_TIMEOUT_MS() {
    return 10000;
  }

  constructor(pumpSession) {
    const payloadBuffer = Buffer.alloc(26);

    // The ngpSequenceNumber stays 1 for this message...
    payloadBuffer.writeUInt8(1, 0x00);
    // ... but we increment it for future messages.
    pumpSession.ngpSequenceNumber += 1;
    payloadBuffer.writeUInt8(pumpSession.radioChannel, 1);
    payloadBuffer.fill(0x00, 0x02, 0x05); // Unknown bytes (hardcoded)
    payloadBuffer.fill(0x07, 0x05, 0x07); // Unknown bytes (hardcoded)
    payloadBuffer.fill(0x00, 0x07, 0x09); // Unknown bytes (hardcoded)
    payloadBuffer.writeUInt8(0x02, 0x09); // Unknown bytes (hardcoded)
    payloadBuffer.write(pumpSession.packedLinkMAC, 0xA, 8, 'binary');
    payloadBuffer.write(pumpSession.packedPumpMAC, 0x12, 8, 'binary');

    super(NGPMessage.COMMAND_TYPE.JOIN_NETWORK, pumpSession, payloadBuffer, JoinNetworkResponse);
  }

  // Override send(), longer read timeout required
  send(hidDevice, readTimeout = JoinNetworkRequest.READ_TIMEOUT_MS, sendDelay = 0,
    get80response = true) {
    return super.send(hidDevice, readTimeout, sendDelay, get80response);
  }
}

class TransmitPacketResponse extends NGPResponse {
  constructor(payload, pumpSession) {
    super(payload, pumpSession);

    // Decrypt response and write it to another member
    const payloadLength =
      MinimedMessage.ENVELOPE_SIZE + this.payload[0x22] + NGPMessage.CHECKSUM_SIZE;
    if (payloadLength < 0x39) {
      debug('*** BAD ComD Message', this.payload.toString('hex'));
      throw new InvalidMessageError('Received invalid ComD message.');
    }

    const encryptedPayloadSize = this.payload[0x38];
    const encryptedPayload = Buffer.from(this.payload.slice(0x39, 0x39 + encryptedPayloadSize));
    const decryptedPayload =
      TransmitPacketResponse.decrypt(pumpSession.key, pumpSession.iv, encryptedPayload);

    // Check the decrypted payload's checksums
    const expectedChecksum = decryptedPayload.readUInt16BE(decryptedPayload.length - 2);
    const calculatedChecksum =
      NGPMessage.ccittChecksum(decryptedPayload, decryptedPayload.length - 2);

    if (expectedChecksum !== calculatedChecksum) {
      throw new ChecksumError(expectedChecksum, calculatedChecksum);
    }

    this.decryptedPayload = decryptedPayload;
  }

  static decrypt(key, iv, encrypted) {
    // The browserified version of crypto we're using doesn't support createDecipher
    const decipher = crypto.createDecipheriv('aes-128-cfb', key, iv);
    let clear = decipher.update(encrypted, 'binary', 'hex');
    clear += decipher.final('hex');
    return Buffer.from(clear, 'hex');
  }

  get comDCommand() {
    return this.decryptedPayload.readUInt16BE(0x01);
  }
}

class TransmitPacketRequest extends NGPRequest {
  static get ENVELOPE_SIZE() {
    return 11;
  }

  static get COMDCOMMAND_SIZE() {
    return 5;
  }

  // TODO - Maybe we should make a response message factory, and check we have the correct
  // response in the Response constructors. We'll need to use lodash to find keys for values:
  // https://lodash.com/docs/4.17.4#findKey
  static get COM_D_COMMAND() {
    return {
      HIGH_SPEED_MODE_COMMAND: 0x0412,
      TIME_REQUEST: 0x0403,
      TIME_RESPONSE: 0x0407,
      READ_PUMP_STATUS_REQUEST: 0x0112,
      READ_PUMP_STATUS_RESPONSE: 0x013C,
      READ_BASAL_PATTERN_REQUEST: 0x0116,
      READ_BASAL_PATTERN_RESPONSE: 0x0123,
      READ_BOLUS_WIZARD_CARB_RATIOS_REQUEST: 0x012B,
      READ_BOLUS_WIZARD_CARB_RATIOS_RESPONSE: 0x012C,
      READ_BOLUS_WIZARD_SENSITIVITY_FACTORS_REQUEST: 0x012E,
      READ_BOLUS_WIZARD_SENSITIVITY_FACTORS_RESPONSE: 0x012F,
      READ_BOLUS_WIZARD_BG_TARGETS_REQUEST: 0x0131,
      READ_BOLUS_WIZARD_BG_TARGETS_RESPONSE: 0x0132,
      DEVICE_STRING_REQUEST: 0x013A,
      DEVICE_STRING_RESPONSE: 0x013B,
      DEVICE_CHARACTERISTICS_REQUEST: 0x0200,
      DEVICE_CHARACTERISTICS_RESPONSE: 0x0201,
      READ_HISTORY_REQUEST: 0x0304,
      READ_HISTORY_RESPONSE: 0x0305,
      END_HISTORY_TRANSMISSION: 0x030A,
      READ_HISTORY_INFO_REQUEST: 0x030C,
      READ_HISTORY_INFO_RESPONSE: 0x030D,
      UNMERGED_HISTORY_RESPONSE: 0x030E,
      INITIATE_MULTIPACKET_TRANSFER: 0xFF00,
      MULTIPACKET_SEGMENT_TRANSMISSION: 0xFF01,
      MULTIPACKET_RESEND_PACKETS: 0xFF02,
      ACK_MULTIPACKET_COMMAND: 0x00FE,
    };
  }

  constructor(pumpSession, comDCommand, parameters, responseType = TransmitPacketResponse) {
    const comDCommandLength = TransmitPacketRequest.COMDCOMMAND_SIZE + parameters.length;
    const envelopeBuffer = Buffer.alloc(TransmitPacketRequest.ENVELOPE_SIZE);
    const transmitBuffer = Buffer.alloc(comDCommandLength);

    envelopeBuffer.write(pumpSession.packedPumpMAC, 0x00, 8, 'binary');
    envelopeBuffer.writeUInt8(pumpSession.ngpSequenceNumber += 1, 0x08);
    let modeFlags = 0x01; // Always encrypted
    let comDSequenceNumber = 0x80; // Always 0x80 for HighSpeedModeCommand

    if (comDCommand !== TransmitPacketRequest.COM_D_COMMAND.HIGH_SPEED_MODE_COMMAND) {
      modeFlags += 0x10;
      comDSequenceNumber = pumpSession.comDSequenceNumber += 1;
    }

    envelopeBuffer.writeUInt8(modeFlags, 0x09);
    envelopeBuffer.writeUInt8(comDCommandLength, 0x0A);

    transmitBuffer.writeUInt8(comDSequenceNumber, 0x00);
    transmitBuffer.writeUInt16BE(comDCommand, 0x01);
    if (comDCommandLength > TransmitPacketRequest.COMDCOMMAND_SIZE) {
      transmitBuffer.write(Buffer.from(parameters).toString('binary'), 0x03, 'binary');
    }

    // The ComDMessage also has its own CCITT (so many checksums!)
    const messageSize = transmitBuffer.length - 2;
    const checksum = NGPMessage.ccittChecksum(transmitBuffer, messageSize);
    transmitBuffer.writeUInt16BE(checksum, messageSize);

    // Encrypt the ComD message
    const encryptedBuffer =
      TransmitPacketRequest.encrypt(pumpSession.key, pumpSession.iv, transmitBuffer);

    const payloadBuffer = Buffer.concat([envelopeBuffer, encryptedBuffer],
      envelopeBuffer.length + encryptedBuffer.length);

    super(NGPMessage.COMMAND_TYPE.TRANSMIT_PACKET, pumpSession, payloadBuffer, responseType);
  }

  static encrypt(key, iv, clear) {
    const cipher = crypto.createCipheriv('aes-128-cfb', key, iv);
    let crypted = cipher.update(clear, 'binary', 'hex');
    crypted += cipher.final('hex');
    return Buffer.from(crypted, 'hex');
  }
}

class HighSpeedModeCommand extends TransmitPacketRequest {
  static get HIGH_SPEED_MODE() {
    return {
      ENABLE: 0,
      DISABLE: 1,
    };
  }

  constructor(pumpSession, highSpeedMode) {
    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.HIGH_SPEED_MODE_COMMAND,
      Buffer.from([highSpeedMode]));
  }

  // Override send(), because we don't request an 0x80 response
  send(hidDevice, readTimeout = NGPMessage.READ_TIMEOUT_MS, sendDelay = 0, get80response = false) {
    return super.send(hidDevice, readTimeout, sendDelay, get80response);
  }
}

class PumpTimeResponse extends TransmitPacketResponse {
  get time() {
    if (!this.decryptedPayload[0x03]) {
      throw new Error('Device clock not set');
    }

    return NGPUtil.NGPTimestamp.fromBuffer(this.decryptedPayload.slice(0x04, 0x0C));
  }
}

class PumpTimeCommand extends TransmitPacketRequest {
  constructor(pumpSession) {
    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.TIME_REQUEST, Buffer.from([]),
      PumpTimeResponse);
  }
}

class PumpStatusResponse extends TransmitPacketResponse {
  get activeBasalPattern() {
    return this.decryptedPayload[0x1A];
  }
}

class PumpStatusCommand extends TransmitPacketRequest {
  constructor(pumpSession) {
    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.READ_PUMP_STATUS_REQUEST,
      Buffer.from([]), PumpStatusResponse);
  }
}

class BolusWizardBGTargetsResponse extends TransmitPacketResponse {
  get targets() {
    const targets = [];
    // Bytes 0x03 and 0x04 are a CCITT checksum of the target bytes.
    const numItems = this.decryptedPayload[0x05];

    for (let i = 0; i < numItems; i++) {
      const high = this.decryptedPayload.readUInt16BE(0x06 + (i * 9)); // in mg/dL
      // this.decryptedPayload.readUInt16BE(0x08 + (i * 9)) / 10.0; // in mmol/L
      const low = this.decryptedPayload.readUInt16BE(0x0A + (i * 9)); // in mg/dL
      // this.decryptedPayload.readUInt16BE(0x0C + (i * 9)) / 10.0; // in mmol/L

      targets.push({
        start: this.decryptedPayload[0x0E + (i * 9)] * 30 * sundial.MIN_TO_MSEC,
        high,
        low,
      });
    }

    return targets;
  }
}

class BolusWizardBGTargetsCommand extends TransmitPacketRequest {
  constructor(pumpSession) {
    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.READ_BOLUS_WIZARD_BG_TARGETS_REQUEST,
      Buffer.from([]), BolusWizardBGTargetsResponse);
  }
}

class BolusWizardCarbRatiosResponse extends TransmitPacketResponse {
  get ratios() {
    const ratios = [];
    // Bytes 0x03 and 0x04 are a CCITT checksum of the ratios bytes.
    const numItems = this.decryptedPayload[0x05];

    for (let i = 0; i < numItems; i++) {
      const amount = (this.decryptedPayload.readUInt32BE(0x06 + (i * 9))) / 10;
      // There is another UInt32BE after the amount, which is always 0

      ratios.push({
        start: this.decryptedPayload[0x0E + (i * 9)] * 30 * sundial.MIN_TO_MSEC,
        amount,
      });
    }

    return ratios;
  }
}

class BolusWizardCarbRatiosCommand extends TransmitPacketRequest {
  constructor(pumpSession) {
    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.READ_BOLUS_WIZARD_CARB_RATIOS_REQUEST,
      Buffer.from([]), BolusWizardCarbRatiosResponse);
  }
}

class BolusWizardSensitivityFactorsResponse extends TransmitPacketResponse {
  get factors() {
    const factors = [];
    // Bytes 0x03 and 0x04 are a CCITT checksum of the sentivities' bytes.
    const numItems = this.decryptedPayload[0x05];

    for (let i = 0; i < numItems; i++) {
      const amount = this.decryptedPayload.readUInt16BE(0x06 + (i * 5)); // in mg/dL
      // this.decryptedPayload.readUInt16BE(0x08 + (i * 5)) / 10.0; // in mmol/L

      factors.push({
        start: this.decryptedPayload[0x0A + (i * 5)] * 30 * sundial.MIN_TO_MSEC,
        amount,
      });
    }

    return factors;
  }
}

class BolusWizardSensitivityFactorsCommand extends TransmitPacketRequest {
  constructor(pumpSession) {
    super(pumpSession,
      TransmitPacketRequest.COM_D_COMMAND.READ_BOLUS_WIZARD_SENSITIVITY_FACTORS_REQUEST,
      Buffer.from([]), BolusWizardSensitivityFactorsResponse);
  }
}

/**
 * This message also contains pump and software firmware versions.
 */
class DeviceCharacteristicsResponse extends TransmitPacketResponse {
  constructor(payload, pumpSession) {
    super(payload, pumpSession);

    if (this.decryptedPayload.length < 13) {
      throw new InvalidMessageError('Received invalid DeviceCharacteristicsResponse message.');
    }
  }

  get serial() {
    return this.decryptedPayload.slice(0x03, 0x0D).toString();
  }

  get MAC() {
    return this.decryptedPayload.slice(0x0D, 0x15).toString('binary');
  }

  get comDVersion() {
    const majorNumber = this.decryptedPayload.readUInt8(0x15);
    const minorNumber = this.decryptedPayload.readUInt8(0x16);
    const alpha = String.fromCharCode(65 + this.decryptedPayload.readUInt8(0x17));
    return `${majorNumber}.${minorNumber}${alpha}`;
  }

  get telDVersion() {
    /* eslint-disable no-bitwise */
    const majorNumber = this.decryptedPayload.readUInt8(0x18) >> 3;
    const minorNumber = (this.decryptedPayload.readUInt8(0x19) >> 5) |
      ((this.decryptedPayload.readUInt8(0x18) << 29) >> 26);
    const alpha = String.fromCharCode(64 + ((this.decryptedPayload.readUInt8(0x19) << 3) >> 3));
    /* eslint-enable no-bitwise */
    return `${majorNumber}.${minorNumber}${alpha}`;
  }

  get model() {
    const modelMajorNumber = this.decryptedPayload.readUInt16BE(0x1A);
    const modelMinorNumber = this.decryptedPayload.readUInt16BE(0x1C);
    return `${modelMajorNumber}.${modelMinorNumber}`;
  }

  get firmwareVersion() {
    const majorNumber = this.decryptedPayload.readUInt8(0x29);
    const minorNumber = this.decryptedPayload.readUInt8(0x2A);
    const alpha = String.fromCharCode(this.decryptedPayload.readUInt8(0x2B));
    return `${majorNumber}.${minorNumber}${alpha}`;
  }

  get motorAppVersion() {
    const majorNumber = this.decryptedPayload.readUInt8(0x2C);
    const minorNumber = this.decryptedPayload.readUInt8(0x2D);
    const alpha = String.fromCharCode(this.decryptedPayload.readUInt8(0x2E));
    return `${majorNumber}.${minorNumber}${alpha}`;
  }

  // TODO - we need to confirm that this is indeed BG UNITS before we can use them in `settings`,
  // and updating NGPHistoryParser:buildSettingsRecords()
  get units() {
    // See NGPUtil.NGPConstants.BG_UNITS
    return this.decryptedPayload.readUInt8(0x35);
  }
}

class DeviceCharacteristicsCommand extends TransmitPacketRequest {
  constructor(pumpSession) {
    const params = Buffer.alloc(9);
    params[0] = 0x02;
    const pumpMAC = Buffer.from(pumpSession.pumpMAC, 'hex').toString('binary');
    params.write(pumpMAC, 0x01, 8, 'binary');
    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.DEVICE_CHARACTERISTICS_REQUEST,
      params, DeviceCharacteristicsResponse);
  }
}

class DeviceStringResponse extends TransmitPacketResponse {
  constructor(payload, pumpSession) {
    super(payload, pumpSession);

    if (this.decryptedPayload.length < 96) {
      throw new InvalidMessageError('Received invalid DeviceStringResponse message.');
    }
  }

  get MAC() {
    return this.decryptedPayload.slice(0x03, 0x0B).toString('binary');
  }

  get stringType() {
    return this.decryptedPayload.readUInt16BE(0x0B);
  }

  get language() {
    return this.decryptedPayload.readUInt8(0x0D);
  }

  get string() {
    const deviceStringUtf16 = this.decryptedPayload.slice(0x0E, 0x5E);
    // We have to strip the nulls ourselves, because the payload doesn't give us string size.
    return iconv.decode(deviceStringUtf16, 'utf16-be').replace(/\0/g, '');
  }
}

class DeviceStringCommand extends TransmitPacketRequest {
  constructor(pumpSession) {
    const params = Buffer.alloc(12);
    params[0x00] = 0x01;
    params[0x0A] = 0x04; // Get Model String
    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.DEVICE_STRING_REQUEST,
      params, DeviceStringResponse);
  }
}

class ReadBasalPatternResponse extends TransmitPacketResponse {
  get schedule() {
    const schedule = [];
    // Byte 0x03 is the Basal Pattern number
    const numItems = this.decryptedPayload[0x04];

    for (let i = 0; i < numItems; i++) {
      schedule.push({
        start: this.decryptedPayload[0x09 + (i * 5)] * 30 * sundial.MIN_TO_MSEC,
        rate: (this.decryptedPayload.readUInt32BE(0x05 + (i * 5)) / 10000),
      });
    }

    return schedule;
  }
}

class ReadBasalPatternCommand extends TransmitPacketRequest {
  constructor(pumpSession, basalPattern) {
    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.READ_BASAL_PATTERN_REQUEST,
      Buffer.from([basalPattern]), ReadBasalPatternResponse);
  }
}

class ReadHistoryInfoResponse extends TransmitPacketResponse {
  get historySize() {
    return this.decryptedPayload.readUInt32BE(0x04);
  }

  get dataStart() {
    return NGPUtil.NGPTimestamp.fromBuffer(this.decryptedPayload.slice(0x08, 0x10));
  }

  get dataEnd() {
    return NGPUtil.NGPTimestamp.fromBuffer(this.decryptedPayload.slice(0x10, 0x18));
  }
}

class ReadHistoryInfoCommand extends TransmitPacketRequest {
  constructor(pumpSession, historyDataType, fromRtc, toRtc) {
    const params = Buffer.alloc(12);
    params[0x00] = historyDataType;
    params[0x01] = 0x04; // Hard coded
    params.writeUInt32BE(fromRtc, 0x02);
    params.writeUInt32BE(toRtc, 0x06);
    params.writeUInt16BE(0x00, 0x0A); // Hard coded
    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.READ_HISTORY_INFO_REQUEST,
      params, ReadHistoryInfoResponse);
  }
}

class AckMultipacketCommand extends TransmitPacketRequest {
  static get SEGMENT_COMMAND() {
    return {
      INITIATE_TRANSFER: 0xFF00,
      SEND_NEXT_SEGMENT: 0xFF01,
    };
  }

  constructor(pumpSession, segmentCommand) {
    const params = Buffer.alloc(2);
    params.writeUInt16BE(segmentCommand, 0x00);

    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.ACK_MULTIPACKET_COMMAND, params);
  }

  // Override send(), because we don't request an 0x80 response
  send(hidDevice, readTimeout = NGPMessage.READ_TIMEOUT_MS, sendDelay = 0, get80response = false) {
    return super.send(hidDevice, readTimeout, sendDelay, get80response);
  }
}

class MultipacketResendPacketsCommand extends TransmitPacketRequest {
  constructor(pumpSession, startPacket, packetCount) {
    const params = Buffer.alloc(4);
    params.writeUInt16BE(startPacket, 0x00);
    params.writeUInt16BE(packetCount, 0x02);

    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.MULTIPACKET_RESEND_PACKETS, params);
  }

  // Override send(), because we don't request an 0x80 response
  send(hidDevice, readTimeout = NGPMessage.READ_TIMEOUT_MS, sendDelay = 0, get80response = false) {
    return super.send(hidDevice, readTimeout, sendDelay, get80response);
  }
}

class MultiPacketSegment extends TransmitPacketResponse {
  get packetNumber() {
    return this.decryptedPayload.readUInt16BE(0x03);
  }

  get segmentPayload() {
    return this.decryptedPayload.slice(0x05, this.decryptedPayload.length - 2);
  }
}

// We don't need to inherit from any other message type, because all of the checksums and size
// checks are done in the MultiPacketSession.
class ReadHistoryResponse {
  constructor(dataBlocks) {
    this.blocks = dataBlocks;
  }

  get pages() {
    return _.map(this.blocks, value => value.toString('hex'));
  }
}

class ReadHistoryCommand extends TransmitPacketRequest {
  constructor(pumpSession, historyDataType, fromRtc, toRtc, expectedSize, progressCb = () => {}) {
    const params = Buffer.alloc(12);
    params[0x00] = historyDataType;
    params[0x01] = 0x04; // Hard coded
    params.writeUInt32BE(fromRtc, 0x02);
    params.writeUInt32BE(toRtc, 0x06);
    params.writeUInt16BE(0x00, 0x0A); // Hard coded

    // Request a regular TransmitPacketResponse to process this Multipacket Segment, and return
    // the actual responseType in send()
    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.READ_HISTORY_REQUEST, params,
      TransmitPacketResponse);

    this.historyDataType = historyDataType;
    this.fromRtc = fromRtc;
    this.toRtc = toRtc;
    this.expectedSize = expectedSize;
    this.bytesFetched = 0;
    this.receivedEndHistoryCommand = false;
    this.blocks = [];
    this.progressCb = progressCb;
  }

  static get BLOCK_SIZE() {
    return 2048;
  }

  get lastPacketNumber() {
    return this.packetsToFetch - 1;
  }

  // The number of segments we've actually fetched.
  get segmentCount() {
    return this.segments.filter(value => value !== undefined).length;
  }

  // Returns an array of tuples, with the first element of the tuple being the starting packet,
  // and the second element of the tuple being the number of packets from the starting packet.
  get missingSegments() {
    let missingIndex = -1;
    let processingMissingSegment = false;

    return _.reduce(this.segments, (result, item, index) => {
      if (item === undefined) {
        if (processingMissingSegment === false) {
          result.push([index, 1]);
          processingMissingSegment = true;
          missingIndex += 1;
        } else {
          result[missingIndex][1] += 1;
        }
      } else {
        processingMissingSegment = false;
      }
      return result;
    }, []);
  }

  get segmentPayload() {
    return Buffer.concat(this.segments);
  }

  initSession(payload) {
    this.segmentSize = payload.readUInt32BE(0x03);
    this.packetSize = payload.readUInt16BE(0x07);
    this.lastPacketSize = payload.readUInt16BE(0x09);
    this.packetsToFetch = payload.readUInt16BE(0x0B);
    this.segments = [];
    // Prepopulate the segments array with empty objects so we can check for missing segments later.
    _.fill(this.segments, undefined, 0, this.packetSize);
  }

  fetchMoreData() {
    return !this.receivedEndHistoryCommand;
  }

  segmentComplete() {
    return this.segmentCount === this.packetsToFetch;
  }

  retransmitNeeded() {
    return this.segments[this.lastPacketNumber] !== undefined && !this.segmentComplete();
  }

  processSegment(packetNumber, payload, hidDevice) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      debug(`*** GOT A MULTIPACKET SEGMENT: ${packetNumber + 1} of ${this.packetsToFetch}, count: ${this.segmentCount + 1}`);

      if (payload != null) {
        // debug('*** PAYLOAD:', payload.toString('hex'));
        // multiByteSegments don't always come back in a consecutive order.
        this.segments[packetNumber] = payload;
      }

      if (payload != null &&
        packetNumber === this.lastPacketNumber && payload.length !== this.lastPacketSize) {
        reject(new InvalidMessageError('Multipacket Transfer last packet size mismatch'));
      } else if (payload != null &&
        packetNumber !== this.lastPacketNumber && payload.length !== this.packetSize) {
        reject(new InvalidMessageError('Multipacket Transfer packet size mismatch'));
      } else if (this.segmentComplete()) {
        const segmentPayload = this.segmentPayload;
        if (segmentPayload.length !== this.segmentSize) {
          reject(new InvalidMessageError('Total segment size mismatch'));
        }

        // TODO - should all of this go into a different class?
        // Decompress the message
        if (segmentPayload.readUInt16BE(0x00) === 0x030E) {
          const HEADER_SIZE = 12;
          // It's an UnmergedHistoryUpdateCompressed response. We need to decompress it
          const dataType = segmentPayload[0x02]; // Returns a HISTORY_DATA_TYPE
          const historySizeCompressed = segmentPayload.readUInt32BE(0x03);
          const historySizeUncompressed = segmentPayload.readUInt32BE(0x07);
          const historyCompressed = segmentPayload[0x0B];

          if (dataType !== this.historyDataType) {
            reject(new InvalidMessageError('Unexpected history type in response'));
          }

          // Check that we have the correct number of bytes in this message
          if (segmentPayload.length - HEADER_SIZE !== historySizeCompressed) {
            reject(new InvalidMessageError('Unexpected message size'));
          }

          let blockPayload = null;
          if (historyCompressed) {
            blockPayload = lzo.decompress(segmentPayload.slice(HEADER_SIZE),
              historySizeUncompressed);
          } else {
            blockPayload = segmentPayload.slice(HEADER_SIZE);
          }

          if (blockPayload.length % ReadHistoryCommand.BLOCK_SIZE) {
            reject(new InvalidMessageError('Block payload size is not a multiple of 2048'));
          }

          for (let i = 0; i < blockPayload.length / ReadHistoryCommand.BLOCK_SIZE; i++) {
            const blockSize = blockPayload.readUInt16BE(
              ((i + 1) * ReadHistoryCommand.BLOCK_SIZE) - 4);
            const blockChecksum = blockPayload.readUInt16BE(
              ((i + 1) * ReadHistoryCommand.BLOCK_SIZE) - 2);

            const blockStart = i * ReadHistoryCommand.BLOCK_SIZE;
            const blockData = blockPayload.slice(blockStart, blockStart + blockSize);
            const calculatedChecksum =
              NGPMessage.ccittChecksum(blockData, blockSize);
            if (blockChecksum !== calculatedChecksum) {
              reject(new ChecksumError(blockChecksum, calculatedChecksum,
                `Unexpected checksum in block ${i}`));
            } else {
              this.blocks.push(blockData);
            }
          }

          this.bytesFetched += blockPayload.length;
          this.progressCb(this.bytesFetched);
        } else {
          reject(new InvalidMessageError('Unknown history response message type'));
        }

        debug('Request next segment');
        new AckMultipacketCommand(this.pumpSession,
            AckMultipacketCommand.SEGMENT_COMMAND.SEND_NEXT_SEGMENT)
          .send(hidDevice)
          .then(() => resolve())
          .catch((err) => {
            debug('Error sending AckMultipacketCommand');
            reject(err);
          });
      } else {
        resolve();
      }
    });
  }

  // Override send(), because we handle Multipacket commands.
  // Set get80response to false, because we'll poll for 0x80 messages as we need them.
  send(hidDevice, readTimeout = NGPMessage.READ_TIMEOUT_MS, sendDelay = 0, get80response = false) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      super.send(hidDevice, readTimeout, sendDelay, get80response)
        .then(() => {
          async.whilst(
            () => this.fetchMoreData(),
            (callback) => {
              this.readMessage(hidDevice, readTimeout)
                .then((receiveMessageResponse) => {
                  const response = new MultiPacketSegment(receiveMessageResponse, this.pumpSession);

                  switch (response.comDCommand) {
                    // We can get HIGH_SPEED_MODE_COMMAND responses during a multipacket session -
                    // no idea why. We just ignore them and readMessage again.
                    case TransmitPacketRequest.COM_D_COMMAND.HIGH_SPEED_MODE_COMMAND:
                      {
                        callback(null, null);
                        break;
                      }
                    case TransmitPacketRequest.COM_D_COMMAND.INITIATE_MULTIPACKET_TRANSFER:
                      {
                        this.initSession(response.decryptedPayload);
                        // Acknowledge that we're ready to start receiving data.
                        new AckMultipacketCommand(this.pumpSession,
                          AckMultipacketCommand.SEGMENT_COMMAND.INITIATE_TRANSFER).send(hidDevice)
                        .then(() => callback(null, response));
                        break;
                      }
                    case TransmitPacketRequest.COM_D_COMMAND.MULTIPACKET_SEGMENT_TRANSMISSION:
                      {
                        this.processSegment(response.packetNumber, response.segmentPayload,
                          hidDevice)
                        .then(() => callback(null, response));
                        break;
                      }
                    case TransmitPacketRequest.COM_D_COMMAND.END_HISTORY_TRANSMISSION:
                      {
                        this.receivedEndHistoryCommand = true;

                        // Check that we received as much data as we were expecting.
                        if (this.bytesFetched < this.expectedSize) {
                          callback(new InvalidMessageError('Got less data than expected'), null);
                        } else {
                          // We need to read another HIGH_SPEED_MODE_COMMAND off the stack.
                          this.readMessage(hidDevice, readTimeout)
                            .then(() => callback(null, response));
                        }
                        break;
                      }
                    case TransmitPacketRequest.COM_D_COMMAND.UNMERGED_HISTORY_RESPONSE:
                      {
                        debug('*** IMPLEMENT ME!');
                        callback(new InvalidMessageError(
                          'UNMERGED_HISTORY_RESPONSE not implemented'), null);
                        break;
                      }
                    default:
                      {
                        callback(new InvalidMessageError(
                          `Unexpected message response: ${response.comDCommand}`), null);
                      }
                  }
                })
                .catch((err) => {
                  // TODO - add retry counter so that we don't get stuck retrying on the same
                  // packet.
                  debug('*** ERROR WHILE READING HISTORY', err);
                  if (err instanceof TimeoutError) {
                    debug('*** TIMEOUT ERROR. Try to fetch missing packets');
                    if (!this.segmentComplete()) {
                      const tuple = this.missingSegments[0];
                      new MultipacketResendPacketsCommand(this.pumpSession, tuple[0], tuple[1])
                        .sendMessage(hidDevice)
                        .then(() => {
                          callback(null, null);
                        })
                        .catch((rerequestError) => {
                          callback(rerequestError, null);
                        });
                    }
                  } else {
                    // Ignore other individual message errors. We'll re-request any corrupt packets.
                    callback(null, null);
                  }
                });
            },
            (err) => {
              if (err) {
                reject(err);
              }

              const response = new ReadHistoryResponse(this.blocks);
              resolve(response);
            } // eslint-disable-line comma-dangle, for node
          );
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
}

class BCNLDriver {
  constructor(hidDevice) {
    this.hidDevice = hidDevice;
    this.USB_BLOCKSIZE = 64;
    this.MAGIC_HEADER = 'ABC';

    this.pumpSession = null;
  }

  static get PASSTHROUGH_MODE() {
    return {
      ENABLE: '1',
      DISABLE: '0',
    };
  }

  connect(deviceInfo, cb) {
    const probe = () => {
      debug('not probing Medtronic 600 series');
    };

    this.hidDevice.connect(deviceInfo, probe, cb);
  }

  disconnect(cb) {
    this.hidDevice.disconnect(null, cb);
  }

  getCnlInfo() {
    return new DeviceInfoRequestCommand().send(this.hidDevice)
      .then((response) => {
        this.pumpSession = new MinimedPumpSession(response.getModelAndSerial());
      });
  }
}

class MM600SeriesDriver extends BCNLDriver {
  static get CHANNELS() {
    // CHANNELS In the order that the CareLink applet requests them
    return [0x14, 0x11, 0x0e, 0x17, 0x1a];
  }

  static get COMMS_RESET_DELAY_MS() {
    return 4000;
  }

  static get HISTORY_DATA_TYPE() {
    return {
      PUMP_DATA: 2,
      SENSOR_DATA: 3,
    };
  }

  enterRemoteCommandMode() {
    return new BCNLCommand(BCNLMessage.ASCII_CONTROL.NAK).send(this.hidDevice)
      .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.EOT))
      .then(() => new BCNLCommand(BCNLMessage.ASCII_CONTROL.ENQ).send(this.hidDevice))
      .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.ACK));
  }

  exitRemoteCommandMode() {
    return new BCNLCommand(BCNLMessage.ASCII_CONTROL.EOT)
      .send(this.hidDevice, BCNLMessage.READ_TIMEOUT_MS, 4000)
      .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.ENQ));
  }

  togglePassthroughMode(mode) {
    return new BCNLCommand('W|').send(this.hidDevice)
      .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.ACK))
      .then(() => new BCNLCommand('Q|').send(this.hidDevice))
      .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.ACK))
      .then(() => new BCNLCommand(`${mode}|`).send(this.hidDevice))
      .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.ACK));
  }

  openConnection() {
    return new OpenConnectionRequest(this.pumpSession).send(this.hidDevice);
  }

  closeConnection() {
    return new CloseConnectionRequest(this.pumpSession).send(this.hidDevice);
  }

  readPumpInfo() {
    return new ReadInfoRequest(this.pumpSession).send(this.hidDevice)
      .then((response) => {
        this.pumpSession.linkMAC = response.linkMAC;
        this.pumpSession.pumpMAC = response.pumpMAC;
      });
  }

  getLinkKey() {
    return new RequestLinkKeyRequest(this.pumpSession).send(this.hidDevice)
      .then((response) => {
        this.pumpSession.key = response.linkKey(this.pumpSession.bcnlModelAndSerial);
      });
  }

  negotiateRadioChannel() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      async.eachSeries(
        MM600SeriesDriver.CHANNELS,
        (channel, callback) => {
          this.pumpSession.radioChannel = channel;
          new JoinNetworkRequest(this.pumpSession).send(this.hidDevice)
            .then((response) => {
              if (response.joinedNetwork) {
                callback(true);
              } else {
                callback(null);
              }
            })
            .catch((err) => {
              callback(err);
            });
        },
        (result) => {
          if (result instanceof Error) {
            throw result;
          } else {
            if (result === null) {
              this.pumpSession.radioChannel = 0;
              reject(new Error('Please make sure that the pump is paired with this ' +
                'Contour Next Link 2.4 and that the pump is in range'));
            }
            resolve();
          }
        } // eslint-disable-line comma-dangle, for node
      );
    });
  }

  toggleHighSpeedMode(mode) {
    return new HighSpeedModeCommand(this.pumpSession, mode).send(this.hidDevice);
  }

  getPumpTime() {
    return new PumpTimeCommand(this.pumpSession).send(this.hidDevice);
  }

  getPumpStatus() {
    return new PumpStatusCommand(this.pumpSession).send(this.hidDevice);
  }

  getBolusWizardSettings() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      const settings = {};
      new BolusWizardBGTargetsCommand(this.pumpSession).send(this.hidDevice)
        .then((response) => {
          settings.bgTarget = response.targets;
        })
        .then(() => new BolusWizardCarbRatiosCommand(this.pumpSession).send(this.hidDevice))
        .then((response) => {
          settings.carbRatio = response.ratios;
        })
        .then(() => new BolusWizardSensitivityFactorsCommand(this.pumpSession).send(this.hidDevice))
        .then((response) => {
          settings.insulinSensitivity = response.factors;
        })
        .then(() => resolve(settings));
    });
  }

  getDeviceCharacteristics() {
    return new DeviceCharacteristicsCommand(this.pumpSession).send(this.hidDevice);
  }

  getDeviceString() {
    return new DeviceStringCommand(this.pumpSession).send(this.hidDevice);
  }

  readBasalPatterns() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      async.timesSeries(8,
        (n, next) => {
          new ReadBasalPatternCommand(this.pumpSession, n + 1).send(this.hidDevice)
            .then((response) => {
              next(null, response.schedule);
            })
            .catch(err => next(err, null));
        },
        (err, results) => {
          if (err) {
            reject(err);
          } else {
            const basalSchedules = {};
            for (let i = 0; i < results.length; i++) {
              const schedule = results[i];
              // Only include patterns with schedules in them
              if (schedule.length > 0) {
                basalSchedules[NGPUtil.NGPConstants.BASAL_PATTERN_NAME[i]] = results[i];
              }
            }
            resolve(basalSchedules);
          }
        });
    });
  }

  // eslint-disable-next-line no-unused-vars
  readHistory(fromRtc, toRtc, progressCb, progressStart, progressEnd) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      const history = {};
      let expectedSize = 0;
      const percentPerDataType = (progressEnd - progressStart) / 2;
      new ReadHistoryInfoCommand(this.pumpSession,
          MM600SeriesDriver.HISTORY_DATA_TYPE.PUMP_DATA, fromRtc, toRtc)
        .send(this.hidDevice)
        .then((response) => {
          debug(`*** GETTING PUMP HISTORY FROM ${response.dataStart.toDate()} TO ${response.dataEnd.toDate()}`);
          expectedSize = response.historySize;
        })
        .then(() => new ReadHistoryCommand(this.pumpSession,
            MM600SeriesDriver.HISTORY_DATA_TYPE.PUMP_DATA, fromRtc, toRtc, expectedSize,
            (fetchedSize) => {
              const percentFetched = fetchedSize / expectedSize;
              progressCb(progressStart + (percentPerDataType * percentFetched));
            })
          .send(this.hidDevice))
        .then((response) => {
          history.pages = response.pages;
        })
        .then(() => new ReadHistoryInfoCommand(this.pumpSession,
            MM600SeriesDriver.HISTORY_DATA_TYPE.SENSOR_DATA, fromRtc, toRtc)
          .send(this.hidDevice))
        .then((response) => {
          debug(`*** GETTING CGM HISTORY FROM ${response.dataStart.toDate()} TO ${response.dataEnd.toDate()}`);
          expectedSize = response.historySize;
        })
        .then(() => new ReadHistoryCommand(this.pumpSession,
            MM600SeriesDriver.HISTORY_DATA_TYPE.SENSOR_DATA, fromRtc, toRtc, expectedSize,
            (fetchedSize) => {
              const percentFetched = fetchedSize / expectedSize;
              progressCb(progressStart + percentPerDataType +
                (percentPerDataType * percentFetched));
            })
          .send(this.hidDevice))
        .then((response) => {
          history.cbg_pages = response.pages;
        })
        .then(() => resolve(history))
        .catch(err => reject(err));
    });
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  const driver = new MM600SeriesDriver(cfg.deviceComms);

  // REVIEW - discuss http://eslint.org/docs/rules/no-param-reassign...
  /* eslint no-param-reassign: [2, { props: false }] */
  /* eslint-disable no-unused-vars */
  return {
    detect(deviceInfo, cb) {
      debug('no detect function needed');
      cb(null, deviceInfo);
    },

    setup(deviceInfo, progress, cb) {
      debug('in setup!');

      if (isBrowser) {
        progress(100);
        cb(null, {
          deviceInfo,
        });
      } else {
        // pages are coming from CLI
        progress(100);
        const data = cfg.fileData;
        data.deviceInfo = deviceInfo;
        cb(null, data);
      }
    },

    connect(progress, data, cb) {
      if (!isBrowser) {
        data.disconnect = false;
        cb(null, data);
        return;
      }
      debug('in connect!');

      driver.connect(data.deviceInfo, (err) => {
        if (err) {
          cb(err);
        } else {
          data.disconnect = false;
          progress(100);
          cb(null, data);
        }
      });
    },

    getConfigInfo(progress, data, cb) {
      if (!isBrowser) {
        data.connect = true;
        cb(null, data);
        return;
      }
      debug('in getConfigInfo', data);

      data.minimedConnection = false;
      data.pumpHighSpeedMode = false;

      progress(100);
      cb(null, data);
    },

    fetchData(progress, data, cb) {
      if (!isBrowser) {
        data.fetchData = true;
        cb(null, data);
        return;
      }
      debug('in fetchData', data);

      const settings = {
        units: {
          bg: 'mg/dL', // Even though the pump can be in mmol/L, we read the mg/dL settings values
          carb: 'grams',
        },
      };

      let error = null;

      driver.getCnlInfo()
        .then(() => {
          data.connect = true;
        })
        // The enter/exit/enter paradigm is what CareLink does, according to packet captures.
        .then(() => driver.enterRemoteCommandMode())
        .then(() => driver.exitRemoteCommandMode())
        .then(() => driver.enterRemoteCommandMode())
        .then(() => driver.togglePassthroughMode(BCNLDriver.PASSTHROUGH_MODE.ENABLE))
        .then(() => driver.openConnection())
        .then(() => progress(10))
        .then(() => {
          data.minimedConnection = true;
        })
        .then(() => driver.readPumpInfo())
        .then(() => driver.getLinkKey())
        .then(() => driver.negotiateRadioChannel())
        .then(() => progress(15))
        .then(() => driver.toggleHighSpeedMode(HighSpeedModeCommand.HIGH_SPEED_MODE.ENABLE))
        .then(() => {
          data.pumpHighSpeedMode = true;
        })
        .then(() => driver.getPumpTime())
        .then((pumpTime) => {
          // We store the NGPTimestamp, because we need it for later messages.
          settings.currentNgpTimestamp = pumpTime.time;
          settings.currentDeviceTime = pumpTime.time.toDate(cfg.timezone).toISOString();
        })
        .then(() => driver.getPumpStatus())
        .then((status) => {
          settings.activeSchedule =
            NGPUtil.NGPConstants.BASAL_PATTERN_NAME[status.activeBasalPattern - 1];
        })
        .then(() => driver.getBolusWizardSettings())
        .then((bwzSettings) => {
          _.assign(settings, bwzSettings);
        })
        .then(() => driver.getDeviceCharacteristics())
        .then((deviceCharacteristics) => {
          settings.pumpSerial = deviceCharacteristics.serial;
        })
        .then(() => driver.getDeviceString())
        .then((deviceString) => {
          settings.pumpModel = deviceString.string;
        })
        .then(() => progress(20))
        .then(() => driver.readBasalPatterns())
        .then((schedules) => {
          settings.basalSchedules = schedules;
        })
        .then(() => progress(30))
        .then(() => {
          const threeMonthsAgo = new Date(new Date().valueOf() - 7776e6);
          return driver.readHistory(
            settings.currentNgpTimestamp.rtcFromDate(threeMonthsAgo),
            NGPUtil.NGPTimestamp.maxRTC, progress, 30, 90);
        })
        .then((history) => {
          _.assign(data, history);
        })
        .catch((err) => {
          error = err;
        })
        .then(() => {
          let promise = Promise.resolve();
          if (data.pumpHighSpeedMode) {
            promise = driver.toggleHighSpeedMode(HighSpeedModeCommand.HIGH_SPEED_MODE.DISABLE);
            data.pumpHighSpeedMode = false;
          }
          return promise;
        })
        .then(() => {
          let promise = Promise.resolve();
          if (data.minimedConnection) {
            promise = driver.closeConnection();
            data.minimedConnection = false;
          }
          return promise;
        })
        .then(() => driver.exitRemoteCommandMode())
        .catch((err) => {
          // We don't need to do anything. We're just catching unexpected closing comms.
          debug('Comms close out error', err);
        })
        // Finally
        .then(() => {
          progress(100);
          if (error) {
            debug('Error getting config info: ', error.message);
            cb(error.message, null);
          } else {
            data.settings = _.clone(settings);
            cb(null, data);
          }
        });
    },

    processData(progress, data, cb) {
      debug('in processData');
      cfg.builder.setDefaults({
        deviceId: `${data.settings.pumpModel}:${data.settings.pumpSerial}`,
      });

      let events = [];
      data.postRecords = [];

      const historyParser = new NGPHistoryParser(cfg, data.settings,
        data.pages.concat(data.cbg_pages));

      const currentDeviceTime = data.settings.currentDeviceTime;
      const timeChanges = historyParser.buildTimeChangeRecords(currentDeviceTime);
      _.assign(events, timeChanges.postRecords);
      cfg.tzoUtil = timeChanges.tzoUtil;

      historyParser
        .buildSettingsRecords(events)
        .buildBasalRecords(events)
        .buildTempBasalRecords(events)
        .buildSuspendResumeRecords(events)
        .buildNormalBolusRecords(events)
        .buildSquareBolusRecords(events)
        .buildDualBolusRecords(events)
        .buildRewindRecords(events)
        .buildPrimeRecords(events)
        .buildCGMRecords(events)
        .buildBGRecords(events);

      events = _.sortBy(events, datum => datum.time);

      const simulator = new Medtronic600Simulator({
        settings: data.settings,
        tzoUtil: cfg.tzoUtil,
        builder: cfg.builder,
      });

      for (const datum of events) {
        simulator.addDatum(datum);
      }
      simulator.finalBasal();

      _.assign(data.postRecords, simulator.getEvents());

      progress(100);
      cb(null, data);
    },

    uploadData(progress, data, cb) {
      progress(0);

      const sessionInfo = {
        deviceTags: ['insulin-pump'],
        deviceManufacturers: ['Medtronic'],
        deviceModel: data.settings.pumpModel,
        deviceSerialNumber: data.settings.pumpSerial,
        deviceId: `${data.settings.pumpModel}:${data.settings.pumpSerial}`,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version,
      };

      cfg.api.upload.toPlatform(data.postRecords, sessionInfo, progress, cfg.groupId,
        (err, result) => {
          progress(100);

          if (err) {
            debug(err);
            debug(result);
            cb(err, data);
          } else {
            data.cleanup = true;
            cb(null, data);
          }
        }, 'dataservices');
    },

    disconnect(progress, data, cb) {
      debug('in disconnect');
      progress(100);
      cb(null, data);
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');

      if (isBrowser) {
        if (!data.disconnect) {
          driver.disconnect(() => {
            progress(100);
            data.cleanup = true;
            data.disconnect = true;
            cb(null, data);
          });
        } else {
          progress(100);
          cb(null, data);
        }
      } else {
        progress(100);
        cb(null, data);
      }
    },
    /* eslint-enable no-unused-vars */
  };
};
