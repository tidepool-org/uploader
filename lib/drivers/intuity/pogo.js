/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2024, Tidepool Project
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
import crc from '../../crc';
import debugMode from '../../../app/utils/debugMode';

const struct = structJs();
const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('POGO') : console.log;

const OP_CODE = {
  READ_SERIAL: '?',
  NR_RECORDS: 'n',
  GET_EVENT: 'D',
};

const ASCII_CONTROL = {
  CR: 0x0D,
  ETB: 0x17,
  ETX: 0x03,
  LF: 0x0A,
  SP: 0x20,
  STX: 0x02,
};

class POGO {
  constructor(cfg) {
    this.cfg = cfg;
    this.serialDevice = this.cfg.deviceComms;
  }

  static buildPacket(command, payload = '') {
    const buf = new ArrayBuffer(11);
    const bytes = new Uint8Array(buf);

    const cmdpayload = command.concat(payload);
      
    // calculate checksum
    const encoder = new TextEncoder();
    const byteArray = encoder.encode(cmdpayload);
    const checksum = crc.calcCRC_I(byteArray, byteArray.length);

    var ctr = struct.pack(bytes, 0, 'b1z', ASCII_CONTROL.STX, command);
    struct.storeString(payload, bytes, ctr);
    ctr += payload.length;
    ctr += struct.pack(bytes, ctr, '4zb', checksum.toString(16).toUpperCase().padStart(4, '0'), ASCII_CONTROL.ETX);
    debug('Sending:', common.bytes2hex(bytes.slice(0, ctr)));

    return buf.slice(0, ctr);
  }

  static extractPacketIntoMessages(bytes) {
    const decoder = new TextDecoder();
    const string = decoder.decode(new Uint8Array(bytes));
    const checksum = parseInt(string.slice(-4), 16);
    const response = bytes.slice(1, -4);
    const calcChecksum = crc.calcCRC_I(response, response.length);

    if (checksum !== calcChecksum) {
      debug('Checksum is', checksum.toString(16), ', expected', calcChecksum.toString(16));
      throw new Error('Checksum mismatch');
    }

    return string.slice(1, -4);
  }

  static extractPacket(bytes) {
    const packet = {
      bytes,
      packet_len: bytes.length,
    };

    return packet;
  }

  static packetHandler(buffer) {
    if (!buffer.bytes().includes(ASCII_CONTROL.ETX)) {
      return false;
    }

    const packet = POGO.extractPacket(buffer.bytes());
    if (packet.packet_len !== 0) {
      // cleanup the buffer data
      buffer.discard(packet.packet_len);
    }

    return packet;
  }

  listenForPacket(timeout, callback) {
    let listenTimer = null;

    const abortTimeout = () => {
      clearInterval(listenTimer);
      debug('TIMEOUT');
      callback('Timeout error. Is the meter switched on?', null);
    };

    let raw = [];
    let abortTimer = setTimeout(abortTimeout, timeout);

    listenTimer = setInterval(() => {
      if (this.serialDevice.hasAvailablePacket()) {
        // reset abort timeout
        clearTimeout(abortTimer);
        abortTimer = setTimeout(abortTimeout, timeout);

        const { bytes } = this.serialDevice.nextPacket();

        debug('Raw packet received:', common.bytes2hex(bytes));

        raw = raw.concat(Array.from(bytes));
        debug(`Received ${raw.length} bytes`);
        const end = raw.indexOf(ASCII_CONTROL.ETX);

        if (end > 0) {
          clearTimeout(abortTimer);
          clearInterval(listenTimer);
          debug('Packet:', String.fromCharCode.apply(null, raw));

          try {
            return callback(null, POGO.extractPacketIntoMessages(raw.slice(0, end)));
          } catch (err) {
            return callback(err, null);
          }
        }

        return null;
      }
    }, 20);
  }

  async commandResponse(cmd, payload) {
    return new Promise((resolve, reject) => {
      try {
        this.serialDevice.writeSerial(POGO.buildPacket(cmd, payload), () => {
          this.listenForPacket(5000, (err, result) => {
            if (err) {
              reject(err);
            }

            if (result[0] !== cmd) {
              // first character should match the command sent
              reject('Unexpected response');
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

  async getSerialNumber() {
    const result = await this.commandResponse(OP_CODE.READ_SERIAL);
    const response = {
        serialNumber: result.slice(1, 14),
        softwareVersion: result.slice(15, 20),
    };

    return response;
  }

  async getDateTime() { //TODO
    // const result = await this.commandResponse(OP_CODE.READ_DATE_TIME);
    // const raw = struct.unpack(result.payload, 0, 'bbs', ['year', 'month', 'packed']);
    // /*  eslint-disable no-bitwise */
    // const fields = {
    //   year: (raw.year & 0x7F) + 2000,
    //   month: raw.month & 0x0F,
    //   day: raw.packed & 0x1F,
    //   hours: (raw.packed >> 5) & 0x1F,
    //   minutes: raw.packed >> 10,
    //   seconds: 0,
    // };
    // /* eslint-enable no-bitwise */

    // return sundial.buildTimestamp(fields);
  }

  async setDateTime(dateTime) { // TODO
    // const result = await this.commandResponse(OP_CODE.WRITE_DATE_TIME, dateTime);

    // if (result.opCode !== OP_CODE.WRITE_DATE_TIME || result.payload[0] !== 0x01) {
    //   throw new Error('Error setting date/time.');
    // }
  }

  async getNumberOfRecords() {
    const result = await this.commandResponse(OP_CODE.NR_RECORDS);
    const nrOfRecords = parseInt(result.slice(1,4));
    debug('Number of records:', nrOfRecords);
    
    return nrOfRecords;
  }

  async getRecord(index) {
    const result = await this.commandResponse(OP_CODE.GET_EVENT, index.toString().padStart(3, '0'));
    const record = { 
        rawResult: result,
        index: parseInt(result.slice(1,6)),
        jsDate: sundial.parseFromFormat(result.slice(7, 24), 'HH:mm:ss MM/DD/YY'),
        trustedTime: parseInt(result[37]) ? true : false
    };
      
    record.dataString = result.slice(49);
    record.type = record.dataString[0];
    
    return record;
  }
}

module.exports = (config) => {
  const cfg = _.clone(config);
  _.assign(cfg.deviceInfo, {
    tags: ['bgm'],
    manufacturers: ['Intuity'],
    model: 'POGO',
  });

  const serialDevice = config.deviceComms;
  const driver = new POGO(cfg);

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
      serialDevice.connect(data.deviceInfo, POGO.packetHandler, (err) => {
        if (err) {
          return cb(err);
        }
        
        data.disconnect = false;
        progress(100);
        cb(null, data);
      });
    },

    getConfigInfo(progress, data, cb) {
      progress(0);

      (async () => {
        Object.assign(cfg.deviceInfo, await driver.getSerialNumber());
        cfg.deviceInfo.deviceId = `${cfg.deviceInfo.driverId}-${cfg.deviceInfo.serialNumber}`;

        //cfg.deviceInfo.deviceTime = sundial.formatDeviceTime(await driver.getDateTime());
        debug('Config:', cfg);

        //common.checkDeviceTime( // TODO
        //  cfg,
        //  (timeErr, serverTime) => {
            progress(100);
            /*
            if (timeErr) {
              if (timeErr === 'updateTime') {
                cfg.deviceInfo.annotations = 'wrong-device-time';

                (async () => {
                  const buf = new ArrayBuffer(5);
                  const dateTime = new DataView(buf);
                  dateTime.setUint8(0, sundial.formatInTimezone(serverTime, cfg.timezone, 'YY'));
                  dateTime.setUint8(1, sundial.formatInTimezone(serverTime, cfg.timezone, 'M'));
                  dateTime.setUint8(2, sundial.formatInTimezone(serverTime, cfg.timezone, 'D'));
                  dateTime.setUint8(3, sundial.formatInTimezone(serverTime, cfg.timezone, 'H'));
                  dateTime.setUint8(4, sundial.formatInTimezone(serverTime, cfg.timezone, 'm'));

                  await driver.setDateTime(new Uint8Array(buf));
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
            } else {*/
              data.connect = true;
              cb(null, data);
            //}
          //},
        //);
      })().catch((error) => {
        debug('Error in getConfigInfo: ', error);
        return cb(error, null);
      });
    },

    fetchData(progress, data, cb) {
      (async () => {
        try {
          debug('in fetchData', data);
          cfg.builder.setDefaults({ deviceId: cfg.deviceInfo.deviceId });

          data.nrOfRecords = await driver.getNumberOfRecords();
            
          data.records = [];
          data.post_records = [];

          for (let i = 0; i < data.nrOfRecords; i++) {
            const record = await driver.getRecord(i);
            debug(record); 
            data.records.push(record);
              
            if (record.dataString[0] === 'C') {
                // handle time changes so that we can set up TZOUtil
                const fromTime = sundial.parseFromFormat(record.dataString.slice(2, 19), 'HH:mm:ss MM/DD/YY');
                const datetimechange = cfg.builder.makeDeviceEventTimeChange()
                  .with_change({
                    from: sundial.formatDeviceTime(fromTime),
                    to: sundial.formatDeviceTime(record.jsDate),
                    agent: 'manual'
                  })
                  .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
                  .set('jsDate', record.jsDate)
                  .set('index', record.index);
                data.post_records.push(datetimechange);
            }

          }
            
          const mostRecent = sundial.applyTimezone(data.records[data.records.length-1].jsDate, cfg.timezone).toISOString();
          cfg.tzoUtil = new TZOUtil(cfg.timezone, mostRecent, data.post_records);
          
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
        
      data.deviceModel = cfg.deviceInfo.model; // for metrics: TODO
        
      data.records.forEach((record) => {
          switch (record.type) {
            case 'G':
                // glucose  
                const value = parseInt(record.dataString.slice(2,5));
                
                const recordBuilder = cfg.builder.makeSMBG()
                  .with_value(value)
                  .with_units('mg/dL')
                  .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
                  .set('index', record.index);

                cfg.tzoUtil.fillInUTCInfo(recordBuilder, record.jsDate);
                  
                // TODO: handle HI/LO

                //if (annotation) {
                //  annotate.annotateEvent(recordBuilder, annotation);
                //}

                const postRecord = recordBuilder.done();
                delete postRecord.index;
                data.post_records.push(postRecord);

                break;
            case 'S':
                // control solution
                debug('Skipping control solution');
                break;
            case 'E':
                // error
                // TODO: parse error codes
                debug(`Error at device time ${sundial.formatDeviceTime(record.jsDate)}: ${record.dataString.slice(2, 7)}`);
                break;
            case 'C':
                // time change were already handled in in fetchData, as we need them to process data
                break;
            case 'D':
                // memory reset
                debug('Database was cleared at device time ', sundial.formatDeviceTime(record.jsDate));
                break;
            case 'P':
                /*
                Because device shutdown interferes with BtUTC, anywhere
                where a device shutdown appears in records to be processed
                we only attempt to process and upload the data following
                the most recent device shutdown.
                */
                if (!debugMode.isDebug) {
                    debug('Found a device shutdown record, ignoring all previous records');
                    data.post_records = [];
                }
                break;
            case 'I':
                // invalid record
                debug('Invalid record:', record.dataString.slice(2));
                break;
            default:
                debug('Undocumented record:', record.dataString);
          }
      });

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
        serialDevice.disconnect(() => {
          progress(100);
          data.cleanup = true;
          data.disconnect = true;
          cb(null, data);
        });
      } else {
        progress(100);
        cb();
      }
    },
  };
};
