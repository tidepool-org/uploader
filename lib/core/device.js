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

import os from 'os';
import osName from 'os-name';
import _ from 'lodash';
import async from 'async';
import util from 'util';
import bows from 'bows';

/* eslint-disable import/no-extraneous-dependencies */
import hid from 'node-hid';
import usb from 'usb';
import SerialPort from 'serialport';

import debugMode from '../../app/utils/debugMode';
import serialDevice from '../serialDevice';
import hidDevice from '../hidDevice';
import usbDevice from '../usbDevice';
import bleDevice from '../bleDevice';
import driverManager from '../driverManager';
import builder from '../objectBuilder';

import dexcomDriver from '../drivers/dexcom/dexcomDriver';
import oneTouchUltraMini from '../drivers/onetouch/oneTouchUltraMini';
import abbottPrecisionXtra from '../drivers/abbott/abbottPrecisionXtra';
import tandemDriver from '../drivers/tandem/tandemDriver';
import insuletOmniPod from '../drivers/insulet/insuletDriver';
import oneTouchUltra2 from '../drivers/onetouch/oneTouchUltra2';
import oneTouchVerio from '../drivers/onetouch/oneTouchVerio';
import oneTouchVerioIQ from '../drivers/onetouch/oneTouchVerioIQ';
import abbottFreeStyleLite from '../drivers/abbott/abbottFreeStyleLite';
import abbottFreeStyleLibre from '../drivers/abbott/abbottFreeStyleLibre';
import abbottFreeStyleNeo from '../drivers/abbott/abbottFreeStyleNeo';
import bayerContourNext from '../drivers/bayer/bayerContourNext';
import animasDriver from '../drivers/animas/animasDriver';
import medtronicDriver from '../drivers/medtronic/medtronicDriver';
import medtronic600Driver from '../drivers/medtronic600/medtronic600Driver';
import TrueMetrixDriver from '../drivers/trividia/trueMetrix';
import accuChekUSBDriver from '../drivers/roche/accuChekUSB';
import bluetoothLEDriver from '../drivers/bluetoothLE/bluetoothLEDriver';

let device = {
  log: bows('Device'),
};

const hostMap = {
  darwin: 'mac',
  win32: 'win',
  linux: 'linux',
};

device.deviceDrivers = {
  Dexcom: dexcomDriver,
  OneTouchUltraMini: oneTouchUltraMini,
  AbbottPrecisionXtra: abbottPrecisionXtra,
  InsuletOmniPod: insuletOmniPod,
  Tandem: tandemDriver,
  OneTouchUltra2: oneTouchUltra2,
  OneTouchVerio: oneTouchVerio,
  OneTouchVerioIQ: oneTouchVerioIQ,
  AbbottFreeStyleLite: abbottFreeStyleLite,
  AbbottFreeStyleLibre: abbottFreeStyleLibre,
  AbbottFreeStyleNeo: abbottFreeStyleNeo,
  BayerContourNext: bayerContourNext,
  Animas: animasDriver,
  Medtronic: medtronicDriver,
  Medtronic600: medtronic600Driver,
  TrueMetrix: TrueMetrixDriver,
  AccuChekUSB: accuChekUSBDriver,
  BluetoothLE: bluetoothLEDriver,
};

device.deviceComms = {
  Dexcom: serialDevice,
  OneTouchUltraMini: serialDevice,
  AbbottPrecisionXtra: serialDevice,
  OneTouchUltra2: serialDevice,
  OneTouchVerio: usbDevice,
  OneTouchVerioIQ: serialDevice,
  AbbottFreeStyleLite: serialDevice,
  AbbottFreeStyleLibre: hidDevice,
  AbbottFreeStyleNeo: hidDevice,
  Tandem: serialDevice,
  BayerContourNext: hidDevice,
  Animas: serialDevice,
  Medtronic: hidDevice,
  Medtronic600: hidDevice,
  TrueMetrix: hidDevice,
  AccuChekUSB: usbDevice,
  BluetoothLE: bleDevice,
};

device.driverManifests = {
  Medtronic: {
    mode: 'HID',
    usb: [
      { vendorId: 6777, productId: 25344 }, // Bayer Contour Next Link mmol/L
      { vendorId: 6777, productId: 25088 }, // Bayer Contour Next Link
    ],
  },
  Medtronic600: {
    mode: 'HID',
    usb: [
      { vendorId: 6777, productId: 25104 }, // Bayer Contour Next Link 2.4
    ],
  },
  InsuletOmniPod: {
    mode: osName() === 'Windows 7' ? 'block' : 'usb',
    usb: [
      { vendorId: 7734, productId: 2 }, // Eros PDM
      { vendorId: 3725, productId: 8221 }, // Dash PDM
    ],
  },
  Dexcom: {
    mode: 'serial',
    usb: [
      { vendorId: 8867, productId: 71, driver: 'cdc-acm' },
    ],
  },
  AbbottPrecisionXtra: {
    mode: 'serial',
    bitrate: 19200,
    usb: [
      { vendorId: 6753, productId: 13344, driver: 'tusb3410' },
    ],
  },
  Tandem: {
    mode: 'serial',
    bitrate: 921600,
    sendTimeout: 50,
    receiveTimeout: 50,
    usb: [
      { vendorId: 1155, productId: 22336, driver: 'cdc-acm' },
    ],
  },
  AbbottFreeStyleLite: {
    mode: 'serial',
    bitrate: 19200,
    usb: [
      { vendorId: 6753, productId: 13328, driver: 'tusb3410' }, // Abbott cable
      { vendorId: 1027, productId: 24577 }, // FTDI cable
    ],
  },
  AbbottFreeStyleLibre: {
    mode: 'HID',
    usb: [
      { vendorId: 6753, productId: 13904 }, // FreeStyle Libre
      { vendorId: 6753, productId: 13936 }, // FreeStyle Libre Pro
    ],
  },
  AbbottFreeStyleNeo: {
    mode: 'HID',
    usb: [
      { vendorId: 6753, productId: 14416 }, // FreeStyle Optium Neo
    ],
  },
  BayerContourNext: {
    mode: 'HID',
    usb: [
      { vendorId: 6777, productId: 29520 }, // Bayer Contour Next
      { vendorId: 6777, productId: 29712 }, // Bayer Contour Next USB
      { vendorId: 6777, productId: 25088 }, // Bayer Contour Next Link
      { vendorId: 6777, productId: 25344 }, // Bayer Contour Next Link mmol/L
      { vendorId: 6777, productId: 25104 }, // Bayer Contour Next Link 2.4
      { vendorId: 6777, productId: 24578 }, // Bayer Contour USB
      { vendorId: 6777, productId: 30720 }, // Bayer Contour Next One
    ],
  },
  Animas: {
    mode: 'serial',
    bitrate: 9600,
    ctsFlowControl: true,
    sendTimeout: 500,
    receiveTimeout: 500,
    usb: [
      { vendorId: 1659, productId: 8963, driver: 'pl2303' },
    ],
  },
  OneTouchVerio: {
    mode: 'usb',
    usb: [
      { vendorId: 10086, productId: 0 },
      { vendorId: 10086, productId: 4 },
    ],
  },
  OneTouchVerioIQ: {
    mode: 'serial',
    bitrate: 38400,
    usb: [
      { vendorId: 4292, productId: 34215, driver: 'cp2102' },
    ],
  },
  OneTouchUltraMini: {
    mode: 'serial',
    usb: [
      { vendorId: 1659, productId: 8963, driver: 'pl2303' }, // "official" Prolific cable
      { vendorId: 1027, productId: 24577 }, // FTDI cable
    ],
  },
  OneTouchUltra2: {
    mode: 'serial',
    bitrate: 9600,
    sendTimeout: 5000,
    receiveTimeout: 5000,
    usb: [
      { vendorId: 1659, productId: 8963, driver: 'pl2303' }, // "official" Prolific cable
      { vendorId: 1027, productId: 24577 }, // FTDI cable
    ],
  },
  TrueMetrix: {
    mode: 'HID',
    usb: [
      { vendorId: 8001, productId: 0 },
      { vendorId: 8001, productId: 3 },
    ],
  },
  AccuChekUSB: {
    mode: 'usb',
    usb: [
      { vendorId: 5946, productId: 8661 }, // Accu-Chek Guide
      { vendorId: 5946, productId: 8655 }, // Accu-Chek Aviva Connect
      { vendorId: 5946, productId: 8662 }, // Accu-chek Guide Me
    ],
  },
  BluetoothLE: {
    mode: 'bluetooth',
  },
};

_.forEach(_.keys(device.deviceComms), (driverId) => {
  const comm = device.deviceComms[driverId];

  if (comm.name !== 'UsbDevice' && comm.name !== 'BLEDevice') {
    // usbDevice and BLEDevice are ES6 classes not handled here
    device.deviceComms[driverId] = comm();
  }
});

// this is a cache for device information
// we need it so that what we learn in detect()
// can be used by process().
device.deviceInfoCache = {};

device.init = (options, cb) => {
  const self = this;
  self.defaultTimezone = options.defaultTimezone;
  self.api = options.api;
  self.version = options.version;
  self.groupId = options.targetId;
  self.os = hostMap[os.platform()];
  cb();
};

device.getDriverManifests = () => _.cloneDeep(this.driverManifests);

device.getDriverIds = () => _.keys(this.driverManifests);

device.getDriverManifest = (driverId) => {
  const driverManifest = this.driverManifests[driverId];
  if (!driverManifest) {
    throw new Error(`Could not find driver manifest for ${driverId}`);
  }
  return driverManifest;
};

device.detectHelper = (driverId, options, cb) => {
  const dm = this.createDriverManager(driverId, options);
  dm.detect(driverId, cb);
};

device.createDriverManager = (driverId, options) => {
  const drivers = {};
  drivers[driverId] = this.deviceDrivers[driverId];
  const configs = {};
  configs[driverId] = this.createDriverConfig(driverId, options);
  configs.debug = debugMode.isDebug;

  return driverManager(drivers, configs);
};

device.createDriverConfig = (driverId, options = {}) => {
  const timezone = options.timezone || this.defaultTimezone;
  const comms = this.deviceComms;
  const uploadGroup = options.targetId || this.groupId;

  // handle config for block-mode devices, which includes the file name and data
  if (options.filename != null) {
    return {
      filename: options.filename,
      filedata: options.filedata,
      deviceInfo: this.deviceInfoCache[driverId],
      timezone,
      groupId: uploadGroup,
      api: this.api,
      version: options.version,
      builder: builder(),
      progress: options.progress,
      displayTimeModal: options.displayTimeModal,
      displayAdHocModal: options.displayAdHocModal,
    };
  }

  const deviceInfo = this.deviceInfoCache[driverId];

  if (options.serialNumber) {
    _.assign(deviceInfo, { serialNumber: options.serialNumber });
  }

  return {
    deviceInfo,
    deviceComms: comms[driverId],
    timezone,
    groupId: uploadGroup,
    api: this.api,
    version: options.version,
    builder: builder(),
    progress: options.progress,
    displayTimeModal: options.displayTimeModal,
    displayAdHocModal: options.displayAdHocModal,
  };
};

device.findUsbDevice = (driverId, usbDevices) => {
  const self = this;
  let userSpaceDriver = null;
  const driverManifest = this.getDriverManifest(driverId);
  const combos = _.map(usbDevices, (i) => _.pick(i, 'product', 'vendorId', 'productId'));

  self.log('Looking for USB PID/VID(s): ', JSON.stringify(driverManifest.usb));
  self.log('Available USB PID/VIDs:', JSON.stringify(combos));

  for (let i = 0; i < driverManifest.usb.length; i++) {
    self.log('USB details for ', JSON.stringify(driverManifest.usb[i]), ':',
      util.inspect(usb.findByIds(driverManifest.usb[i].vendorId,
        driverManifest.usb[i].productId)));
  }

  const matchingUsbDevices = _.filter(usbDevices, (matching) => {
    let found = false;
    for (let i = 0; i < driverManifest.usb.length; i++) {
      if (driverManifest.usb[i].vendorId === matching.vendorId
        && driverManifest.usb[i].productId === matching.productId) {
        userSpaceDriver = driverManifest.usb[i].driver;
        found = true;
      }
    }
    return found;
  });

  const devices = _.map(matchingUsbDevices, (result) => ({
    driverId,
    deviceId: result.deviceId,
    vendorId: result.vendorId,
    productId: result.productId,
    userSpaceDriver,
    bitrate: driverManifest.bitrate,
  }));

  if (devices.length > 1) {
    this.log(`WARNING: More than one device found for ${driverId}`);
    device.othersConnected = devices.length - 1;
  }

  return _.first(devices);
};

device.detectUsb = (driverId, cb) => {
  const usbDevices = _.map(usb.getDeviceList(), (result) => ({
    deviceId: result.deviceDescriptor.idDevice,
    vendorId: result.deviceDescriptor.idVendor,
    productId: result.deviceDescriptor.idProduct,
  }));

  return cb(null, this.findUsbDevice(driverId, usbDevices));
};

device.detectHid = (driverId, cb) => cb(null, this.findUsbDevice(driverId, hid.devices()));

device.detectUsbSerial = (driverId, cb) => {
  const self = this;
  const driverManifest = this.getDriverManifest(driverId);

  const getDevice = (results) => {
    const devices = _.map(results, (result) => {
      const retval = {
        driverId,
        vendorId: result.vendorId,
        productId: result.productId,
        usbDevice: result.device,
        path: result.comName,
      };
      if (driverManifest.bitrate) {
        retval.bitrate = driverManifest.bitrate;
      }
      if (driverManifest.ctsFlowControl) {
        retval.ctsFlowControl = driverManifest.ctsFlowControl;
      }
      if (driverManifest.sendTimeout) {
        retval.sendTimeout = driverManifest.sendTimeout;
      }
      if (driverManifest.receiveTimeout) {
        retval.receiveTimeout = driverManifest.receiveTimeout;
      }
      return retval;
    });

    const devdata = _.head(devices);

    if (devices.length > 1) {
      self.log(`WARNING: More than one device found for ${driverId}`);
      device.othersConnected = devices.length - 1;
    }
    return cb(null, devdata);
  };

  (async () => {
    try {
      let serialDevices = await SerialPort.list();

      self.log('Connected device(s):', serialDevices);
      serialDevices = _.filter(serialDevices, (matching) => {
        const vendorId = parseInt(matching.vendorId, 16);
        const productId = parseInt(matching.productId, 16);

        for (let i = 0; i < driverManifest.usb.length; i++) {
          if (driverManifest.usb[i].vendorId === vendorId
             && driverManifest.usb[i].productId === productId) {
            if (self.os === 'mac') {
              if (matching.comName.match('/dev/tty.+')) {
                return true;
              }
            } else {
              return true;
            }
          }
        }
        return false;
      });
      self.log('Possible device(s):', serialDevices);
      return getDevice(serialDevices);
    } catch (error) {
      return cb(error, null);
    }
  })();
};

device.detect = (driverId, options, cb) => {
  const self = this;
  if (_.isFunction(options)) {
    // eslint-disable-next-line no-param-reassign
    cb = options;
    // eslint-disable-next-line no-param-reassign
    options = { version: self.version };
  }
  const driverManifest = this.getDriverManifest(driverId);

  if (driverManifest.mode === 'HID') {
    this.detectHid(driverId, (err, devdata) => {
      if (err) {
        return cb(err);
      }

      if (!devdata) {
        return cb();
      }

      self.deviceInfoCache[driverId] = _.cloneDeep(devdata);
      return self.detectHelper(driverId, options, (error, ftdiDevice) => {
        if (error) {
          return cb(error);
        }
        device = _.assign(devdata, ftdiDevice);
        return cb(null, devdata);
      });
    });
  } else if (driverManifest.mode === 'usb') {
    this.detectUsb(driverId, (err, devdata) => {
      if (err) {
        return cb(err);
      }

      if (!devdata) {
        return cb();
      }

      self.deviceInfoCache[driverId] = _.cloneDeep(devdata);

      return self.detectHelper(driverId, options, (error, theDevice) => {
        if (error) {
          return cb(error);
        }
        device = _.assign(devdata, theDevice);
        return cb(null, devdata);
      });
    });
  } else if (driverManifest.mode === 'bluetooth') {
    const devdata = {
      id: options.ble.device.id,
      name: options.ble.device.name,
    };
    self.deviceInfoCache[driverId] = _.cloneDeep(devdata);
    if (!self.deviceComms[driverId].ble) {
      self.deviceComms[driverId] = new self.deviceComms[driverId](options);
    }
    self.detectHelper(driverId, options, (err) => {
      if (err) {
        return cb(err);
      }
      return cb(null, devdata);
    });
  } else {
    this.detectUsbSerial(driverId, (err, devdata) => {
      if (err) {
        return cb(err);
      }

      if (!devdata) {
        // no matching serial devices were found, let's see if they are
        // actually connected via USB
        return self.detectUsb(driverId, (error, devdata2) => {
          if (!devdata) {
            return cb();
          }
          self.deviceInfoCache[driverId] = _.cloneDeep(devdata2);
          // hey, we can see it on the USB bus!
          // let's try the userspace driver if available
          if (devdata2.userSpaceDriver) {
            return self.detectHelper(driverId, options, (error2, userspaceDevice) => {
              if (error2) {
                return cb(err);
              }
              device = _.assign(devdata2, userspaceDevice);
              return cb(null, devdata2);
            });
          }
          return cb();
        });
      }

      self.deviceInfoCache[driverId] = _.cloneDeep(devdata);
      return self.detectHelper(driverId, options, (error3, serialDevice2) => {
        if (error3) {
          return cb(error3);
        }
        device = _.assign(devdata, serialDevice2);
        return cb(null, devdata);
      });
    });
  }
};

device.detectAll = (cb) => {
  async.map(this.getDriverIds(), this.detect.bind(this), (err, results) => {
    if (err) {
      return cb(err);
    }
    // Filter out any nulls
    const filtered = _.filter(results);
    return cb(null, filtered);
  });
};

device.upload = (driverId, options, cb) => {
  const dm = this.createDriverManager(driverId, options);
  dm.process(driverId, (err, result) => cb(err, result));
};

module.exports = device;
