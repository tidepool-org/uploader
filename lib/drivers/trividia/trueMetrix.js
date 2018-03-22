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

// import annotate from '../../eventAnnotations';
// import common from '../../commonFunctions';
import TZOUtil from '../../TimezoneOffsetUtil';
import structJs from '../../struct';

const struct = structJs();
const isBrowser = typeof window !== 'undefined';
const debug = isBrowser ? require('bows')('TrueMetrixDriver') : console.log;

const HEADER = 0xA0;

const COMMANDS = {
  WAKEUP: '(^)AF',
  IDENTIFY: '(I)9A',
  GET_SERIAL: '(Z1)DC',
  ACK: '(*)7B',
  GET_RESULTS: '(G)98',
  POWER_OFF: '(_)B0',
  GET_FIRMWARE_VERSION: '(V)A7',
  GET_METER_TIME: '(T)A5',
};

const TYPES = {
  MODEL: 'i',
  SERIAL: 'z1',
  GLUCOSE: 'g',
  TIME: 't',
  CHECKSUM: 'x', // TODO: verify checksum of multiple frames
};

const MODELS = {
  MR2: 'trueMetrix',
  RC2: 'trueMetrixGo',
};

class TrueMetrix {
  constructor(cfg) {
    this.cfg = cfg;
    this.hidDevice = this.cfg.deviceComms;
  }

  static extractPacketIntoMessages(bytes) {
    const re = /\(([^)]*)\)(\w{2})/g;
    const str = String.fromCharCode.apply(null, bytes);
    let results;
    const messages = [];

    // eslint-disable-next-line no-cond-assign
    while ((results = re.exec(str)) !== null) {
      if (results != null) {
        if (TrueMetrix.verifyChecksum(results[1], results[2])) {
          messages.push(results[1]);
        }
      }
    }
    return messages;
  }

  static buildPacket(command, cmdlength) {
    const datalen = cmdlength + 2; /* we use 2 bytes because we add 1 byte for
                                    the header and 1 byte for the length of
                                    the payload */
    const buf = new ArrayBuffer(datalen);
    const bytes = new Uint8Array(buf);
    if (cmdlength) {
      let ctr = 0;
      ctr += struct.pack(bytes, ctr, 'bb6z', HEADER, cmdlength, command);
      debug('Sending', ctr, 'bytes:', String.fromCharCode.apply(null, bytes));
    }
    return buf;
  }

  static verifyChecksum(frame, expected) {
    let checksum = 0;
    for (let i = 0; i < frame.length; ++i) {
      checksum += frame.charCodeAt(i);
    }
    checksum += 0x29 + 0x28; // add frame start and end characters back in

    let checkStr = _.toUpper(checksum.toString(16)).slice(-2);
    checkStr = checkStr.slice(-2);
    return checkStr === _.toUpper(expected);
  }

  static getAnnotations(annotation, data) {
    const annInfo = [];

    if (data.unreportedThreshold) {
      annInfo.push({
        code: 'bayer/smbg/unreported-hi-lo-threshold',
      });
    }
    if (annotation.indexOf('>') !== -1) {
      annInfo.push({
        code: 'bg/out-of-range',
        threshold: data.hiThreshold,
        value: 'high',
      });

      return annInfo;
    } else if (annotation.indexOf('<') !== -1) {
      annInfo.push({
        code: 'bg/out-of-range',
        threshold: data.lowThreshold,
        value: 'low',
      });

      return annInfo;
    }
    return null;
  }

  async commandResponse(cmd) {
    let message = '';

    await this.hidDevice.sendPromisified(TrueMetrix.buildPacket(cmd, cmd.length));

    let raw = [];
    let result;
    do {
      // eslint-disable-next-line no-await-in-loop, requests to devices are sequential
      result = this.hidDevice.receiveTimeout(2000);
      const length = result[0];

      if (result.length > 0 && length < 64) {
        raw = raw.concat(result.slice(1, length + 1));
      }
    } while (result.length > 0);

    // Only process if we get data
    if (raw.length > 0) {
      debug('Packet:', String.fromCharCode.apply(null, raw));
      message = TrueMetrix.extractPacketIntoMessages(raw);
    }
    debug('Message(s):', message);
    return message;
  }

  static filterByType(results, type) {
    const filtered = _.filter(results, (result, index, self) =>
      result != null &&
      _.startsWith(result, type) && // check type
      self.indexOf(result) === index); // remove duplicates
    return _.map(filtered, element => element.slice(type.length));
  }

  async getModelAndDeviceId() {
    let results = await this.commandResponse(COMMANDS.IDENTIFY);
    if (!_.isArray(results)) {
      results = [];
    }
    results = results.concat(await this.commandResponse(COMMANDS.GET_SERIAL));

    const model = MODELS[TrueMetrix.filterByType(results, TYPES.MODEL)];
    const serial = TrueMetrix.filterByType(results, TYPES.SERIAL);

    if (model == null || serial == null) {
      throw Error('Failed to connect to device. Is it in the cradle?');
    } else {
      return {
        model,
        deviceId: `Trividia-${model}-${serial}`,
      };
    }
  }

  /*
  prepBGData(progress, data) {
    //build missing data.id
    data.id = data.model + '-' + data.serialNumber;
    this.cfg.builder.setDefaults({ deviceId: data.id});
    var dataToPost = [];
    if (data.bgmReadings.length > 0) {
      for (var i = 0; i < data.bgmReadings.length; ++i) {
        var datum = data.bgmReadings[i];
        if(datum.control === true) {
          debug('Discarding control');
          continue;
        }
        var smbg = this.cfg.builder.makeSMBG()
          .with_value(datum.glucose)
          .with_deviceTime(datum.displayTime)
          .with_timezoneOffset(datum.timezoneOffset)
          .with_conversionOffset(datum.conversionOffset)
          .with_time(datum.displayUtc)
          .with_units(datum.units)
          .set('index', datum.nrec)
          .done();
          if (datum.annotations) {
            _.each(datum.annotations, function(ann) {
              annotate.annotateEvent(smbg, ann);
            });
          }
        dataToPost.push(smbg);
      }
    } else {
      debug('Device has no records to upload');
      throw(new Error('Device has no records to upload'));
    }

    return dataToPost;
  };
  */
}


module.exports = (config) => {
  const cfg = _.clone(config);
  const driver = new TrueMetrix(cfg);

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

      cfg.deviceComms.connect(data.deviceInfo, cb, (err) => {
        if (err) {
          return cb(err);
        }
        data.disconnect = false;
        progress(100);
        return cb(null, data);
      });
    },

    getConfigInfo(progress, data, cb) {
      debug('in getConfigInfo', data);
      progress(0);

      (async () => {
        driver.hidDevice.receiveTimeout(2000); // flush any data in the buffer
        progress(20);
        await driver.commandResponse(COMMANDS.WAKEUP);
        _.assign(cfg.deviceInfo, await driver.getModelAndDeviceId());
        progress(40);
        [cfg.deviceInfo.firmwareVersion] =
          await driver.commandResponse(COMMANDS.GET_FIRMWARE_VERSION);
        progress(60);

        // TODO: check against server time when time-difference branch is merged
        const [rawTime] = await driver.commandResponse(COMMANDS.GET_METER_TIME);
        cfg.deviceInfo.meterTime = sundial.parseFromFormat(rawTime, 'ssmmHHDDMMYY');

        debug('DeviceInfo:', JSON.stringify(cfg.deviceInfo, null, 4));

        progress(100);
        data.connect = true;
        return cb(null, data);
      })().catch((error) => {
        debug('Error in getConfigInfo: ', error);
        cb(error, null);
      });
    },

    async fetchData(progress, data, cb) {
      debug('in fetchData', data);
      data.glucose = await driver.commandResponse(COMMANDS.GET_RESULTS);
      cb(null, data);
    },

    processData(progress, data, cb) {
      progress(0);
      _.forEach(data.glucose, (record) => {
        console.log(record);
      });
      progress(100);
      cb(null, data);
    },

    uploadData(progress, data, cb) {
      /*

      var model = MODELS[data.model];
      if(model == null) {
        model = 'Unknown Bayer model';
      }
      debug('Detected as: ', model);

      progress(0);
      var sessionInfo = {
        deviceTags: ['bgm'],
        deviceManufacturers: ['Bayer'],
        deviceModel: model,
        deviceSerialNumber: data.serialNumber,
        deviceId: data.id,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName : cfg.timezone,
        version: cfg.version
      };

      cfg.api.upload.toPlatform(data.post_records, sessionInfo,
        progress, cfg.groupId, function (err, result) {
        progress(100);

        if (err) {
          debug(err);
          debug(result);
          return cb(err, data);
        } else {
          data.cleanup = true;
          return cb(null, data);
        }
      });
      */
      cb(null, data);
    },

    disconnect(progress, data, cb) {
      debug('in disconnect');
      cfg.deviceComms.removeListeners();
      // Due to an upstream bug in HIDAPI on Windoze, we have to send a command
      // to the device to ensure that the listeners are removed before we disconnect
      // For more details, see https://github.com/node-hid/node-hid/issues/61
      driver.hidDevice.send(TrueMetrix.buildPacket(
        COMMANDS.POWER_OFF,
        COMMANDS.POWER_OFF.length,
      ), () => {
        progress(100);
        cb(null, data);
      });
    },

    cleanup(progress, data, cb) {
      debug('in cleanup');
      if (!data.disconnect) {
        cfg.deviceComms.disconnect(data, () => {
          progress(100);
          data.cleanup = true;
          data.disconnect = true;
          cb(null, data);
        });
      } else {
        progress(100);
      }
    },
  };
};
