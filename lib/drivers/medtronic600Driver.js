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

const _ = require('lodash');
const async = require('async');
const sundial = require('sundial');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const crcCalculator = require('../crc.js');

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('../bows')('Medtronic600Driver') : console.log;

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
  constructor(expectedChecksum, calculatedChecksum) {
    super('Message checksums do not match! ' +
      `Expected ${expectedChecksum}, but calculated ${calculatedChecksum}`);
  }
}

class BCNLMessage {
  constructor(bytes, responseType) {
    if (new.target === BCNLMessage) {
      throw new TypeError(`Cannot construct ${new.target.name} instances directly`);
    }

    this.payload = Buffer.from(bytes);
    this.responseType = responseType;
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

  static wait(delay) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      setTimeout(resolve, delay);
    });
  }

  toString() {
    return this.payload.toString('hex');
  }

  // eslint-disable-next-line class-methods-use-this
  readMessage(hidDevice, readTimeout = BCNLMessage.READ_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const abortTimer = setTimeout(() => {
        debug('TIMEOUT');
        reject(new TimeoutError('Timeout error.'));
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
              return callback(new InvalidMessageError('Unexpected USB packet header.'));
            }

            message = Buffer.concat([message, packet.slice(4)],
              (message.length + packet.length) - 4);

            // USB_BLOCKSIZE - 4, because we don't include the MAGIC_HEADER or the size byte
            if (size < (BCNLMessage.USB_BLOCKSIZE - 4)) {
              clearTimeout(abortTimer);
              return callback(true);
            }
            return callback(false);
          });
        },
        (valid) => {
          if (valid instanceof Error) {
            throw valid;
          }
          return (!valid);
        },
        () => {
          debug('### READ USB DATA', message.toString('hex'));
          resolve(message);
        },
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
        () => resolve(),
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
    this.telDSequenceNumber = 0;
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

    /* eslint-disable lodash/prefer-lodash-method */
    payloadBuffer.writeUInt16BE(MinimedMessage.MINIMED_HEADER, 0); // Q\x03
    payloadBuffer.write('000000', 2); // Pump serial. '000000' for 600-series
    payloadBuffer.fill(0, 8, 18); // Unknown bytes (hardcoded in CLPro)
    payloadBuffer.writeUInt8(commandType, 18);
    payloadBuffer.writeUInt32LE(pumpSession.envelopeSequenceNumber += 1, 19);
    payloadBuffer.fill(0, 23, 28); // Unknown bytes (hardcoded in CLPro)
    payloadBuffer.writeUInt16LE(payloadLength, 28);
    payloadBuffer.fill(0, 30, 32); // Unknown bytes (hardcoded in CLPro)
    payloadBuffer.writeUInt8(0, 32); // Placeholder for the single byte checksum
    if (payloadLength > 0) {
      payloadBuffer.write(Buffer.from(payload).toString('binary'), 33, 'binary');
    }
    /* eslint-enable lodash/prefer-lodash-method */

    // Now that we have written the message, calculate the CRC
    const checksum = MinimedMessage.oneByteChecksum(payloadBuffer);
    payloadBuffer.writeUInt8(checksum, 32);
    return payloadBuffer;
  }
}

class TelDMessage extends MinimedMessage {
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
      PACKET_RESPONSE_HEADER: 0x55, // 'U'
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

class TelDResponse extends MinimedResponse {
  constructor(payload, pumpSession) {
    super(payload, pumpSession);

    if (this.payload[MinimedMessage.ENVELOPE_SIZE] !==
      TelDMessage.COMMAND_TYPE.PACKET_RESPONSE_HEADER) {
      throw new InvalidMessageError('Unexpected TelD packet header.');
    }

    const telDPayloadSize = this.payload[0x22];
    // Check the payload's checksums
    const telDPayload =
      Buffer.from(this.payload.slice(MinimedMessage.ENVELOPE_SIZE, MinimedMessage.ENVELOPE_SIZE +
        telDPayloadSize + TelDMessage.CHECKSUM_SIZE));
    const expectedChecksum = telDPayload.readUInt16LE(telDPayload.length - 2);
    const calculatedChecksum =
      TelDMessage.ccittChecksum(telDPayload, telDPayload.length - 2);

    if (expectedChecksum !== calculatedChecksum) {
      throw new ChecksumError(expectedChecksum, calculatedChecksum);
    }
  }
}

class TelDRequest extends TelDMessage {
  constructor(commandType, pumpSession, payload, responseType = TelDResponse) {
    if (new.target === TelDRequest) {
      throw new TypeError(`Cannot construct ${new.target.name} instances directly`);
    }

    super(TelDRequest.buildPayload(commandType, pumpSession, payload), responseType);
    this.pumpSession = pumpSession;
  }

  static buildPayload(commandType, pumpSession, payload) {
    const payloadLength = (payload === null) ? 0 : payload.length;
    const payloadBuffer = Buffer.alloc(
      TelDMessage.ENVELOPE_SIZE + payloadLength + TelDMessage.CHECKSUM_SIZE);

    payloadBuffer.writeUInt8(commandType, 0);
    payloadBuffer.writeUInt8(TelDMessage.ENVELOPE_SIZE + payloadLength, 1);
    if (payloadLength > 0) {
      payloadBuffer.write(Buffer.from(payload).toString('binary'), 2, 'binary');
    }

    // Now that we have written the message, calculate the CRC
    const messageSize = payloadBuffer.length - 2;
    const checksum = TelDMessage.ccittChecksum(payloadBuffer, messageSize);
    payloadBuffer.writeUInt16LE(checksum, messageSize);

    return MinimedRequest.buildPayload(MinimedRequest.COMMAND_TYPE.SEND_MESSAGE,
      pumpSession, payloadBuffer);
  }

  // Override send(), because we do an 'optional double read' after sending the request
  send(hidDevice, readTimeout = BCNLMessage.READ_TIMEOUT_MS, sendDelay = 0, get80response = true) {
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

class JoinNetworkResponse extends TelDResponse {
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

class JoinNetworkRequest extends TelDRequest {
  static get READ_TIMEOUT_MS() {
    return 10000;
  }

  constructor(pumpSession) {
    const payloadBuffer = Buffer.alloc(26);

    /* eslint-disable lodash/prefer-lodash-method */
    // The telDSequenceNumber stays 1 for this message...
    payloadBuffer.writeUInt8(1, 0x00);
    // ... but we increment it for future messages.
    pumpSession.telDSequenceNumber += 1;
    payloadBuffer.writeUInt8(pumpSession.radioChannel, 1);
    payloadBuffer.fill(0x00, 0x02, 0x05); // Unknown bytes (hardcoded in CLPro)
    payloadBuffer.fill(0x07, 0x05, 0x07); // Unknown bytes (hardcoded in CLPro)
    payloadBuffer.fill(0x00, 0x07, 0x09); // Unknown bytes (hardcoded in CLPro)
    payloadBuffer.writeUInt8(0x02, 0x09); // Unknown bytes (hardcoded in CLPro)
    payloadBuffer.write(pumpSession.packedLinkMAC, 0xA, 8, 'binary');
    payloadBuffer.write(pumpSession.packedPumpMAC, 0x12, 8, 'binary');
    /* eslint-enable lodash/prefer-lodash-method */

    super(TelDMessage.COMMAND_TYPE.JOIN_NETWORK, pumpSession, payloadBuffer, JoinNetworkResponse);
  }

  // Override send(), longer read timeout required
  send(hidDevice, readTimeout = JoinNetworkRequest.READ_TIMEOUT_MS, sendDelay = 0,
    get80response = true) {
    return super.send(hidDevice, readTimeout, sendDelay, get80response);
  }
}

class TransmitPacketResponse extends TelDResponse {
  constructor(payload, pumpSession) {
    super(payload, pumpSession);

    // Decrypt response and write it to another member
    const payloadLength =
      MinimedMessage.ENVELOPE_SIZE + this.payload[0x22] + TelDMessage.CHECKSUM_SIZE;
    if (payloadLength < 0x39) {
      throw new InvalidMessageError('Received invalid ComD message.');
    }

    const encryptedPayloadSize = this.payload[0x38];
    const encryptedPayload = Buffer.from(this.payload.slice(0x39, 0x39 + encryptedPayloadSize));
    const decryptedPayload =
      TransmitPacketResponse.decrypt(pumpSession.key, pumpSession.iv, encryptedPayload);

    // Check the decrypted payload's checksums
    const expectedChecksum = decryptedPayload.readUInt16BE(decryptedPayload.length - 2);
    const calculatedChecksum =
      TelDMessage.ccittChecksum(decryptedPayload, decryptedPayload.length - 2);

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
}

class TransmitPacketRequest extends TelDRequest {
  static get ENVELOPE_SIZE() {
    return 11;
  }

  static get COMDCOMMAND_SIZE() {
    return 5;
  }

  static get COM_D_COMMAND() {
    return {
      HIGH_SPEED_MODE_COMMAND: 0x0412,
      TIME_REQUEST: 0x0403,
      TIME_RESPONSE: 0x0407,
      READ_PUMP_STATUS_REQUEST: 0x0112,
      READ_PUMP_STATUS_RESPONSE: 0x013C,
      READ_BASAL_PATTERN_REQUEST: 0x0116,
      READ_BASAL_PATTERN_RESPONSE: 0x0123,
      READ_BOLUS_WIZARD_BG_TARGETS_REQUEST: 0x0131,
      READ_BOLUS_WIZARD_BG_TARGETS_RESPONSE: 0x0132,
      READ_BOLUS_WIZARD_CARB_RATIOS_REQUEST: 0x012B,
      READ_BOLUS_WIZARD_CARB_RATIOS_RESPONSE: 0x012C,
      READ_BOLUS_WIZARD_SENSITIVITY_FACTORS_REQUEST: 0x012E,
      READ_BOLUS_WIZARD_SENSITIVITY_FACTORS_RESPONSE: 0x012F,
      DEVICE_CHARACTERISTICS_REQUEST: 0x0200,
      DEVICE_CHARACTERISTICS_RESPONSE: 0x0201,
      DEVICE_STRING_REQUEST: 0x013A,
      DEVICE_STRING_RESPONSE: 0x013B,
    };
  }

  constructor(pumpSession, comDCommand, parameters, responseType = TransmitPacketResponse) {
    const comDCommandLength = TransmitPacketRequest.COMDCOMMAND_SIZE + parameters.length;
    const envelopeBuffer = Buffer.alloc(TransmitPacketRequest.ENVELOPE_SIZE);
    const transmitBuffer = Buffer.alloc(comDCommandLength);

    envelopeBuffer.write(pumpSession.packedPumpMAC, 0x00, 8, 'binary');
    envelopeBuffer.writeUInt8(pumpSession.telDSequenceNumber += 1, 0x08);
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
    const checksum = TelDMessage.ccittChecksum(transmitBuffer, messageSize);
    transmitBuffer.writeUInt16BE(checksum, messageSize);

    // Encrypt the ComD message
    const encryptedBuffer =
      TransmitPacketRequest.encrypt(pumpSession.key, pumpSession.iv, transmitBuffer);

    const payloadBuffer = Buffer.concat([envelopeBuffer, encryptedBuffer],
      envelopeBuffer.length + encryptedBuffer.length);

    super(TelDMessage.COMMAND_TYPE.TRANSMIT_PACKET, pumpSession, payloadBuffer, responseType);
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
  send(hidDevice, readTimeout = BCNLMessage.READ_TIMEOUT_MS, sendDelay = 0, get80response = false) {
    return super.send(hidDevice, readTimeout, sendDelay, get80response);
  }
}

class PumpTimeResponse extends TransmitPacketResponse {}

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
      const highInteger = this.decryptedPayload.readUInt16BE(0x06 + (i * 9));
      const highDecimal = this.decryptedPayload.readUInt16BE(0x08 + (i * 9));
      const lowInteger = this.decryptedPayload.readUInt16BE(0x0A + (i * 9));
      const lowDecimal = this.decryptedPayload.readUInt16BE(0x0C + (i * 9));

      targets.push({
        start: this.decryptedPayload[0x0E + (i * 9)] * 30 * sundial.MIN_TO_MSEC,
        high: parseFloat(`${highInteger}.${highDecimal}`),
        low: parseFloat(`${lowInteger}.${lowDecimal}`),
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
      const isfInteger = this.decryptedPayload.readUInt16BE(0x06 + (i * 5));
      const isfDecimal = this.decryptedPayload.readUInt16BE(0x08 + (i * 5));

      factors.push({
        start: this.decryptedPayload[0x0A + (i * 5)] * 30 * sundial.MIN_TO_MSEC,
        amount: parseFloat(`${isfInteger}.${isfDecimal}`),
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

  get model() {
    const modelMajorNumber = this.decryptedPayload.readUInt16BE(0x1A);
    const modelMinorNumber = this.decryptedPayload.readUInt16BE(0x1C);
    return `${modelMajorNumber}.${modelMinorNumber}`;
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

  get model() {
    const modelUtf16 = this.decryptedPayload.slice(0x0E, 0x5E);
    return iconv.decode(modelUtf16, 'utf16-be');
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

  static get PATTERN_NAME() {
    return [
      'Pattern 1',
      'Pattern 2',
      'Pattern 3',
      'Pattern 4',
      'Pattern 5',
      'Workday',
      'Day Off',
      'Sick Day',
    ];
  }

  enterRemoteCommandMode() {
    return new BCNLCommand(BCNLMessage.ASCII_CONTROL.NAK).send(this.hidDevice)
      .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.EOT))
      .then(() => new BCNLCommand(BCNLMessage.ASCII_CONTROL.ENQ).send(this.hidDevice))
      .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.ACK));
  }

  exitRemoteCommandMode() {
    return new BCNLCommand(BCNLMessage.ASCII_CONTROL.EOT).send(this.hidDevice)
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
        },
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
                basalSchedules[MM600SeriesDriver.PATTERN_NAME[i]] = results[i];
              }
            }
            resolve(basalSchedules);
          }
        });
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

      const settings = {};
      let error = null;

      driver.getCnlInfo()
        .then(() => {
          debug('BCNL model and serial:', driver.pumpSession.bcnlModelAndSerial);
          data.connect = true;
        })
        .then(() => driver.enterRemoteCommandMode())
        .then(() => driver.togglePassthroughMode(BCNLDriver.PASSTHROUGH_MODE.ENABLE))
        .then(() => driver.openConnection())
        .then(() => driver.readPumpInfo())
        .then(() => driver.getLinkKey())
        .then(() => driver.negotiateRadioChannel())
        .then(() => driver.toggleHighSpeedMode(HighSpeedModeCommand.HIGH_SPEED_MODE.ENABLE))
        .then(() => driver.getPumpTime())
        .then(() => driver.getPumpStatus())
        .then((status) => {
          settings.activeBasalPattern =
            MM600SeriesDriver.PATTERN_NAME[status.activeBasalPattern - 1];
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
          settings.pumpModel = deviceString.model;
        })
        .then(() => driver.readBasalPatterns())
        .then((schedules) => {
          settings.basalSchedules = schedules;
        })
        .catch((err) => {
          error = err;
        })
        // Finally
        .then(() => driver.toggleHighSpeedMode(HighSpeedModeCommand.HIGH_SPEED_MODE.DISABLE))
        .then(() => driver.closeConnection())
        .then(() => driver.exitRemoteCommandMode())
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

    fetchData(progress, data, cb) {
      if (!isBrowser) {
        data.fetchData = true;
        cb(null, data);
        return;
      }
      debug('in fetchData', data);
      progress(100);
      cb(null, data);
    },

    processData(progress, data, cb) {
      debug('in processData');
      cfg.builder.setDefaults({
        deviceId: driver.pumpSession.bcnlModelAndSerial,
      });
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
        timeProcessing: 'utc-bootstrapping',
        tzName: cfg.timezone,
        version: cfg.version,
      };

      const postRecords = [{
        time: new Date(sessionInfo.start).toISOString(),
        timezoneOffset: 660,
        conversionOffset: 0,
        deviceTime: sundial.formatDeviceTime(sundial.applyTimezoneAndConversionOffset(sessionInfo.start, 'Etc/UTC', -3600 * 11 * 1000)),
        deviceId: `${data.settings.pumpModel}:${data.settings.pumpSerial}`,
        type: 'pumpSettings',
        activeSchedule: data.settings.activeBasalPattern,
        units: {
          bg: 'mg/dL', // Even though the pump can be in mmol/L, the data is always in mg/dL
          carb: 'grams',
        },
        basalSchedules: data.settings.basalSchedules,
        carbRatio: data.settings.carbRatio,
        insulinSensitivity: data.settings.insulinSensitivity,
        bgTarget: data.settings.bgTarget,
      }];

      // cfg.api.upload.toPlatform(data.post_records, sessionInfo, progress, cfg.groupId,
      cfg.api.upload.toPlatform(postRecords, sessionInfo, progress, cfg.groupId,
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
