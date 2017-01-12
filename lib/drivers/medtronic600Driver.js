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

class ChecksumError extends ExtendableError {
  constructor(expectedChecksum, calculatedChecksum) {
    super('Message checksums do not match! ' +
      `Expected ${expectedChecksum}, but calculated ${calculatedChecksum}`);
  }
}

class BCNLMessage {
  constructor(bytes) {
    if (new.target === BCNLMessage) {
      throw new TypeError(`Cannot construct ${new.target.name} instances directly`);
    }

    this.payload = Buffer.from(bytes);
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
              return callback(new Error('Invalid USB packet received.'));
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
          return (valid !== true);
        },
        () => resolve(message),
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
          debug('### SENDING DATA', bytes.toString('hex'));

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
          const message = this.getResponse(response);
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
      super(Buffer.from([command]));
    } else {
      // For regular strings
      super(Buffer.from(command, 'ascii'));
    }
  }

  // TODO - should we do getResponse differently?
  // Perhaps a member in BNCLRequest that points to a returning class?
  // eslint-disable-next-line class-methods-use-this
  getResponse(payload) {
    return new BCNLCommandResponse(payload);
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
  constructor(modelAndSerial) {
    this.envelopeSequenceNumber = 0;
    this.telDSequenceNumber = 0;
    this.comDSequenceNumber = 0;
    this.modelAndSerial = modelAndSerial;
    this.radioChannel = null;
    this.linkMAC = null;
    this.pumpMAC = null;
    this.key = null;
  }

  get serialNumber() {
    return this.modelAndSerial.replace(/\d+-/, '');
  }

  get iv() {
    const iv = Buffer.from(this.key);
    iv[0] = this.radioChannel;

    return iv;
  }

  get BEPackedLinkMAC() {
    return Buffer.from(this.linkMAC, 'hex').toString('binary');
  }

  get LEPackedLinkMAC() {
    return Buffer.from(this.linkMAC, 'hex').swap64().toString('binary');
  }

  get BEPackedPumpMAC() {
    return Buffer.from(this.pumpMAC, 'hex').toString('binary');
  }

  get LEPackedPumpMAC() {
    return Buffer.from(this.pumpMAC, 'hex').swap64().toString('binary');
  }

  getHMAC() {
    const paddingKey = 'A4BD6CED9A42602564F413123';
    const digest = crypto.createHash('sha256')
      .update(`${this.serialNumber}${paddingKey}`)
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

  static oneByteChecksum(buffer) {
    // eslint-disable-next-line no-bitwise
    return _.reduce(buffer, (a, b) => a + b, 0) & 0xff;
  }
}

class MinimedResponse extends MinimedMessage {
  // TODO check response sizes, checksums, etc
}

class MinimedRequest extends MinimedMessage {
  constructor(commandType, pumpSession, payload) {
    if (new.target === MinimedRequest) {
      throw new TypeError(`Cannot construct ${new.target.name} instances directly`);
    }

    super(MinimedRequest.buildPayload(commandType, pumpSession, payload));
    this.pumpSession = pumpSession;
  }

  static get ENVELOPE_SIZE() {
    return 33;
  }

  static buildPayload(commandType, pumpSession, payload) {
    const payloadLength = (payload === null) ? 0 : payload.length;
    const payloadBuffer = Buffer.alloc(MinimedRequest.ENVELOPE_SIZE + payloadLength);

    /* eslint-disable lodash/prefer-lodash-method */
    payloadBuffer.writeUInt8(0x51, 0); // 'Q'
    payloadBuffer.writeUInt8(0x3, 1); // Delimiter
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

class TelDResponse extends TelDMessage {
  constructor(payload, pumpSession) {
    super(payload, pumpSession);

    if (this.payload[MinimedRequest.ENVELOPE_SIZE] !==
      TelDMessage.COMMAND_TYPE.PACKET_RESPONSE_HEADER) {
      // TODO - custom exception InvalidMessageException?
      throw new Error('Invalid message received.');
    }

    const telDPayloadSize = this.payload[0x22];
    // Check the decrypted payload's checksums
    const telDPayload =
      Buffer.from(this.payload.slice(MinimedRequest.ENVELOPE_SIZE, MinimedRequest.ENVELOPE_SIZE +
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
  constructor(commandType, pumpSession, payload) {
    if (new.target === TelDRequest) {
      throw new TypeError(`Cannot construct ${new.target.name} instances directly`);
    }

    super(TelDRequest.buildPayload(commandType, pumpSession, payload));
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
        .then((response) => {
          // TODO - throw here if the 0x81 doesn't check out.
          debug('*** 0x81 Response', response.toString('hex'));
        })
        .then(() => {
          if (get80response) {
            debug('*** | Requesting an 0x80 response');
            this.readMessage(hidDevice, readTimeout)
              .then((response) => {
                debug('*** 0x80 Response', response.toString('hex'));
                const message = this.getResponse(response, this.pumpSession);
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

// TODO - CLP doesn't check the response, so we probably don't care either. Use a generic response?
class OpenConnectionResponse extends MinimedResponse {}

class OpenConnectionRequest extends MinimedRequest {
  constructor(pumpSession) {
    super(MinimedMessage.COMMAND_TYPE.OPEN_CONNECTION, pumpSession, pumpSession.getHMAC());
  }

  // eslint-disable-next-line class-methods-use-this
  getResponse(payload) {
    return new OpenConnectionResponse(payload);
  }
}

class ReadInfoResponse extends MinimedResponse {
  // Link MAC and Pump MAC are packed as a 64-bit integers, but JavaScript doesn't support those,
  // so we'll store them as a hex strings.
  get linkMAC() {
    const offset = MinimedRequest.ENVELOPE_SIZE + 0x00;
    return this.payload.slice(offset, offset + 8).toString('hex');
  }

  get pumpMAC() {
    const offset = MinimedRequest.ENVELOPE_SIZE + 0x08;
    return this.payload.slice(offset, offset + 8).toString('hex');
  }

  get linkCounter() {
    return this.payload.readUInt16LE(MinimedRequest.ENVELOPE_SIZE + 0x10);
  }

  get encryptionMode() {
    // eslint-disable-next-line no-bitwise
    return this.payload[MinimedRequest.ENVELOPE_SIZE + 0x12] & 1;
  }

  get isAssociated() {
    return this.pumpMAC !== '0000000000000000';
  }
}

class ReadInfoRequest extends MinimedRequest {
  constructor(pumpSession) {
    super(MinimedMessage.COMMAND_TYPE.READ_INFO, pumpSession, null);
  }

  // eslint-disable-next-line class-methods-use-this
  getResponse(payload) {
    return new ReadInfoResponse(payload);
  }
}

class RequestLinkKeyResponse extends MinimedResponse {
  get packedLinkKey() {
    return this.payload.slice(MinimedRequest.ENVELOPE_SIZE, MinimedRequest.ENVELOPE_SIZE + 55);
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
    super(MinimedMessage.COMMAND_TYPE.REQUEST_LINK_KEY, pumpSession, null);
  }

  // eslint-disable-next-line class-methods-use-this
  getResponse(payload) {
    return new RequestLinkKeyResponse(payload);
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
    payloadBuffer.write(pumpSession.LEPackedLinkMAC, 0xA, 8, 'binary');
    payloadBuffer.write(pumpSession.LEPackedPumpMAC, 0x12, 8, 'binary');
    /* eslint-enable lodash/prefer-lodash-method */

    super(TelDMessage.COMMAND_TYPE.JOIN_NETWORK, pumpSession, payloadBuffer);
  }

  // Override send(), longer read timeout required
  send(hidDevice, readTimeout = JoinNetworkRequest.READ_TIMEOUT_MS, sendDelay = 0,
    get80response = true) {
    return super.send(hidDevice, readTimeout, sendDelay, get80response);
  }

  // eslint-disable-next-line class-methods-use-this
  getResponse(payload) {
    return new JoinNetworkResponse(payload);
  }
}

class TransmitPacketResponse extends TelDResponse {
  constructor(payload, pumpSession) {
    super(payload, pumpSession);

    // Decrypt response and write it to another member
    const payloadLength =
      MinimedRequest.ENVELOPE_SIZE + this.payload[0x22] + TelDMessage.CHECKSUM_SIZE;
    if (payloadLength < 0x39) {
      // TODO - custom exception
      throw new Error('Unexpected message received.');
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
      READ_PUMP_STATUS_RESPONSE: 0x013c,
      READ_BASAL_PATTERN_REQUEST: 0x0116,
      READ_BASAL_PATTERN_RESPONSE: 0x0123,
    };
  }

  constructor(pumpSession, comDCommand, parameters) {
    const comDCommandLength = TransmitPacketRequest.COMDCOMMAND_SIZE + parameters.length;
    const envelopeBuffer = Buffer.alloc(TransmitPacketRequest.ENVELOPE_SIZE);
    const transmitBuffer = Buffer.alloc(comDCommandLength);

    envelopeBuffer.write(pumpSession.LEPackedPumpMAC, 0x00, 8, 'binary');
    envelopeBuffer.writeUInt8(pumpSession.telDSequenceNumber, 0x08);
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

    super(TelDMessage.COMMAND_TYPE.TRANSMIT_PACKET, pumpSession, payloadBuffer);
  }

  static encrypt(key, iv, clear) {
    const cipher = crypto.createCipheriv('aes-128-cfb', key, iv);
    let crypted = cipher.update(clear, 'binary', 'hex');
    crypted += cipher.final('hex');
    return Buffer.from(crypted, 'hex');
  }

  // eslint-disable-next-line class-methods-use-this
  getResponse(payload) {
    return new TransmitPacketResponse(payload);
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
    super(pumpSession, TransmitPacketRequest.COM_D_COMMAND.TIME_REQUEST,
      Buffer.from([]));
  }

  // eslint-disable-next-line class-methods-use-this
  getResponse(payload, pumpSession) {
    return new PumpTimeResponse(payload, pumpSession);
  }
}

class ReadBasalPatternResponse extends TransmitPacketResponse {
  get schedule() {
    const schedule = [];
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
      Buffer.from([basalPattern]));
  }

  // eslint-disable-next-line class-methods-use-this
  getResponse(payload, pumpSession) {
    return new ReadBasalPatternResponse(payload, pumpSession);
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
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      new DeviceInfoRequestCommand(BCNLMessage.ASCII_CONTROL.NAK).send(this.hidDevice)
        .then((response) => {
          this.pumpSession = new MinimedPumpSession(response.getModelAndSerial());
        })
        .then(() => resolve())
        .catch(err => reject(err));
    });
  }
}

class MM600SeriesDriver extends BCNLDriver {
  static get CHANNELS() {
    // CHANNELS In the order that the CareLink applet requests them
    return [0x14, 0x11, 0x0e, 0x17, 0x1a];
  }

  enterRemoteCommandMode() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      new BCNLCommand(BCNLMessage.ASCII_CONTROL.NAK).send(this.hidDevice)
        .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.EOT))
        .then(() => new BCNLCommand(BCNLMessage.ASCII_CONTROL.ENQ).send(this.hidDevice))
        .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.ACK))
        .then(() => resolve())
        .catch(err => reject(err));
    });
  }

  exitRemoteCommandMode() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      new BCNLCommand(BCNLMessage.ASCII_CONTROL.EOT).send(this.hidDevice)
        .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.ENQ))
        .then(() => resolve())
        .catch(err => reject(err));
    });
  }

  togglePassthroughMode(mode) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      new BCNLCommand('W|').send(this.hidDevice)
        .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.ACK))
        .then(() => new BCNLCommand('Q|').send(this.hidDevice))
        .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.ACK))
        .then(() => new BCNLCommand(`${mode}|`).send(this.hidDevice))
        .then(response => response.checkAsciiControl(BCNLMessage.ASCII_CONTROL.ACK))
        .then(() => resolve())
        .catch(err => reject(err));
    });
  }

  openConnection() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      new OpenConnectionRequest(this.pumpSession).send(this.hidDevice)
        // eslint-disable-next-line no-unused-vars
        .then((response) => {
          // TODO - do we care about the response?
          resolve();
        });
    });
  }

  readPumpInfo() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      new ReadInfoRequest(this.pumpSession).send(this.hidDevice)
        .then((response) => {
          this.pumpSession.linkMAC = response.linkMAC;
          this.pumpSession.pumpMAC = response.pumpMAC;
          resolve();
        });
    });
  }

  getLinkKey() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      new RequestLinkKeyRequest(this.pumpSession).send(this.hidDevice)
        .then((response) => {
          this.pumpSession.key = response.linkKey(this.pumpSession.modelAndSerial);
          resolve();
        });
    });
  }

  negotiateRadioChannel() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      // TODO - reorder the channel list if we know the last used radio channel
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
              reject(new Error('Cannot connect to pump. Are you nearby?'));
            }
            resolve();
          }
        },
      );
    });
  }

  toggleHighSpeedMode(mode) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      new HighSpeedModeCommand(this.pumpSession, mode).send(this.hidDevice)
        .then(() => {
          resolve();
        })
        .catch(err => reject(err));
    });
  }

  getPumpTime() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      new PumpTimeCommand(this.pumpSession).send(this.hidDevice, 10000, 500, true)
        .then((response) => {
          debug('*** GET PUMP TIME:', response);
          resolve();
        })
        .catch(err => reject(err));
    });
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
                basalSchedules[`pattern ${i + 1}`] = results[i];
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

      let error = null;

      driver.getCnlInfo()
        .then(() => {
          debug('BCNL model and serial:', driver.pumpSession.modelAndSerial);
          data.connect = true;
        })
        .then(() => driver.enterRemoteCommandMode())
        .then(() => driver.togglePassthroughMode(BCNLDriver.PASSTHROUGH_MODE.ENABLE))
        .then(() => driver.openConnection())
        .then(() => driver.readPumpInfo())
        .then(() => driver.getLinkKey())
        .then(() => driver.negotiateRadioChannel())
        .then(() => {
          debug('*** PUMP SESSION', driver.pumpSession);
        })
        .then(() => driver.toggleHighSpeedMode(HighSpeedModeCommand.HIGH_SPEED_MODE.ENABLE))
        .then(() => driver.getPumpTime())
        .then(() => driver.readBasalPatterns())
        .then((schedules) => {
          const settings = {
            basalSchedules: schedules,
          };
          data.settings = _.clone(settings);
        })
        .catch((err) => {
          driver.togglePassthroughMode(BCNLDriver.PASSTHROUGH_MODE.DISABLE)
            .then(() => driver.exitRemoteCommandMode());
          error = err;
        })
        .then(() => { // Finally
          progress(100);
          if (error) {
            debug('Error getting config info: ', error.message);
            cb(error.message, null);
          } else {
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

      let error = null;

      debug('*** PUMP SESSION', driver.pumpSession);
      driver.toggleHighSpeedMode(HighSpeedModeCommand.HIGH_SPEED_MODE.DISABLE)
        .then(() => {
          debug('Finished getting data');
        })
        .catch((err) => {
          error = err;
        })
        // Finally
        .then(() => driver.togglePassthroughMode(BCNLDriver.PASSTHROUGH_MODE.DISABLE))
        .then(() => driver.exitRemoteCommandMode())
        .then(() => {
          progress(100);
          if (error) {
            debug('Error fetching data', error);
            cb(error.message, null);
          } else {
            cb(null, data);
          }
        });
    },

    processData(progress, data, cb) {
      debug('in processData');
      cfg.builder.setDefaults({
        deviceId: driver.pumpSession.modelAndSerial,
      });
      progress(100);
      cb(null, data);
    },

    uploadData(progress, data, cb) {
      progress(0);

      const sessionInfo = {
        deviceTags: ['insulin-pump'],
        deviceManufacturers: ['Medtronic'],
        deviceModel: '640G',
        deviceSerialNumber: '1055866',
        deviceId: '640G-1055866',
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
        deviceId: '640G-1055866',
        type: 'pumpSettings',
        activeSchedule: 'pattern 1',
        units: {
          bg: 'mmol/L',
          carb: 'grams',
        },
        basalSchedules: data.settings.basalSchedules,
        carbRatio: [{
          start: 0,
          amount: 6,
        }],
        insulinSensitivity: [{
          start: 0,
          amount: 3,
        }],
        bgTarget: [{
          start: 0,
          low: 5,
          high: 5.5,
        }],
      }];
      debug('*** SEND DATA:', postRecords);

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
