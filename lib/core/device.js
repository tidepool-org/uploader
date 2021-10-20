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

var os = require('os');

var _ = require('lodash');
var async = require('async');
var util = require('util');

var common = require('../commonFunctions');
var debugMode = require('../../app/utils/debugMode');
var serialDevice = require('../serialDevice');
var hidDevice = require('../hidDevice');
var usbDevice = require('../usbDevice');
var bleDevice = require('../bleDevice');
var driverManager = require('../driverManager');
var builder = require('../objectBuilder')();
var hid = require('node-hid');
var usb = require('usb');
var SerialPort = require('serialport');

var dexcomDriver = require('../drivers/dexcom/dexcomDriver');
var oneTouchUltraMini = require('../drivers/onetouch/oneTouchUltraMini');
var abbottPrecisionXtra = require('../drivers/abbott/abbottPrecisionXtra');
var tandemDriver = require('../drivers/tandem/tandemDriver');
var insuletOmniPod = require('../drivers/insulet/insuletDriver');
var oneTouchUltra2 = require('../drivers/onetouch/oneTouchUltra2');
var oneTouchVerio = require('../drivers/onetouch/oneTouchVerio');
var oneTouchVerioIQ = require('../drivers/onetouch/oneTouchVerioIQ');
var abbottFreeStyleLite = require('../drivers/abbott/abbottFreeStyleLite');
var abbottFreeStyleLibre = require('../drivers/abbott/abbottFreeStyleLibre');
var bayerContourNext = require('../drivers/bayer/bayerContourNext');
var animasDriver = require('../drivers/animas/animasDriver');
var medtronicDriver = require('../drivers/medtronic/medtronicDriver');
var medtronic600Driver = require('../drivers/medtronic600/medtronic600Driver');
var TrueMetrixDriver = require('../drivers/trividia/trueMetrix');
var accuChekUSBDriver = require('../drivers/roche/accuChekUSB');
var bluetoothLEDriver = require('../drivers/bluetoothLE/bluetoothLEDriver');

var device = {
  log: require('bows')('Device')
};

var hostMap = {
  'darwin': 'mac',
  'win32' : 'win',
  'linux': 'linux',
};

device._deviceDrivers = {
  'Dexcom': dexcomDriver,
  'OneTouchUltraMini': oneTouchUltraMini,
  'AbbottPrecisionXtra': abbottPrecisionXtra,
  'InsuletOmniPod': insuletOmniPod,
  'Tandem': tandemDriver,
  'OneTouchUltra2': oneTouchUltra2,
  'OneTouchVerio': oneTouchVerio,
  'OneTouchVerioIQ': oneTouchVerioIQ,
  'AbbottFreeStyleLite': abbottFreeStyleLite,
  'AbbottFreeStyleLibre': abbottFreeStyleLibre,
  'BayerContourNext': bayerContourNext,
  'Animas': animasDriver,
  'Medtronic': medtronicDriver,
  'Medtronic600': medtronic600Driver,
  'TrueMetrix': TrueMetrixDriver,
  'AccuChekUSB': accuChekUSBDriver,
  'BluetoothLE': bluetoothLEDriver,
};

device._deviceComms = {
  'Dexcom': serialDevice,
  'OneTouchUltraMini': serialDevice,
  'AbbottPrecisionXtra': serialDevice,
  'OneTouchUltra2': serialDevice,
  'OneTouchVerio': usbDevice,
  'OneTouchVerioIQ': serialDevice,
  'AbbottFreeStyleLite': serialDevice,
  'AbbottFreeStyleLibre': hidDevice,
  'Tandem': serialDevice,
  'BayerContourNext': hidDevice,
  'Animas': serialDevice,
  'Medtronic': hidDevice,
  'Medtronic600': hidDevice,
  'TrueMetrix': hidDevice,
  'AccuChekUSB': usbDevice,
  'BluetoothLE': bleDevice,
};

device._driverManifests = {
  'Medtronic': {
    mode: 'HID',
    usb: [
      {vendorId: 6777, productId: 25344}, // Bayer Contour Next Link mmol/L
      {vendorId: 6777, productId: 25088}  // Bayer Contour Next Link
    ]
  },
  'Medtronic600': {
    mode: 'HID',
    usb: [
      {vendorId: 6777, productId: 25104} // Bayer Contour Next Link 2.4
    ]
  },
  'InsuletOmniPod': {
    mode: os.platform() === 'win32' ? 'block' : 'usb',
    usb: [
      {vendorId: 7734, productId: 2},   // Eros PDM
      {vendorId: 3725, productId: 8221} // Dash PDM
    ]
  },
  'Dexcom': {
    mode: 'serial',
    usb: [
      {vendorId: 8867, productId: 71, driver: 'cdc-acm'}
    ]
  },
  'AbbottPrecisionXtra': {
    mode: 'serial',
    bitrate: 19200,
    usb: [
      {vendorId: 6753, productId: 13344, driver: 'tusb3410'}
    ]
  },
  'Tandem': {
    mode: 'serial',
    bitrate: 921600,
    sendTimeout: 50,
    receiveTimeout: 50,
    usb: [
      {vendorId: 1155, productId: 22336, driver: 'cdc-acm'}
    ]
  },
  'AbbottFreeStyleLite': {
    mode: 'serial',
    bitrate: 19200,
    usb: [
      {vendorId: 6753, productId: 13328, driver: 'tusb3410'}, // Abbott cable
      {vendorId: 1027, productId: 24577}  // FTDI cable
    ]
  },
  'AbbottFreeStyleLibre': {
    mode: 'HID',
    usb: [
      {vendorId: 6753, productId: 13904}, // FreeStyle Libre
      {vendorId: 6753, productId: 13936}  // FreeStyle Libre Pro
    ]
  },
  'BayerContourNext': {
    mode: 'HID',
    usb: [
      {vendorId: 6777, productId: 29520}, // Bayer Contour Next
      {vendorId: 6777, productId: 29712}, // Bayer Contour Next USB
      {vendorId: 6777, productId: 25088}, // Bayer Contour Next Link
      {vendorId: 6777, productId: 25344}, // Bayer Contour Next Link mmol/L
      {vendorId: 6777, productId: 25104}, // Bayer Contour Next Link 2.4
      {vendorId: 6777, productId: 24578}, // Bayer Contour USB
      {vendorId: 6777, productId: 30720}  // Bayer Contour Next One
    ]
  },
  'Animas': {
    mode: 'serial',
    bitrate: 9600,
    ctsFlowControl: true,
    sendTimeout: 500,
    receiveTimeout: 500,
    usb: [
      {vendorId: 1659, productId: 8963, driver: 'pl2303'}
    ]
  },
  'OneTouchVerio': {
    mode: 'usb',
    usb: [
      {vendorId: 10086, productId: 0},
      {vendorId: 10086, productId: 4}
    ]
  },
  'OneTouchVerioIQ': {
    mode: 'serial',
    bitrate: 38400,
    usb: [
      {vendorId: 4292, productId: 34215, driver: 'cp2102'}
    ]
  },
  'OneTouchUltraMini': {
    mode: 'serial',
    usb: [
      {vendorId: 1659, productId: 8963, driver: 'pl2303'}, // "official" Prolific cable
      { vendorId: 1027, productId: 24577 }  // FTDI cable
    ]
  },
  'OneTouchUltra2': {
    mode: 'serial',
    bitrate: 9600,
    sendTimeout: 5000,
    receiveTimeout: 5000,
    usb: [
      {vendorId: 1659, productId: 8963, driver: 'pl2303'},  // "official" Prolific cable
      {vendorId: 1027, productId: 24577}  // FTDI cable
    ]
  },
  'TrueMetrix': {
    mode: 'HID',
    usb: [
      {vendorId: 8001, productId: 0},
      {vendorId: 8001, productId: 3},
    ]
  },
  'AccuChekUSB': {
    mode: 'usb',
    usb: [
      {vendorId: 5946, productId: 8661}, // Accu-Chek Guide
      {vendorId: 5946, productId: 8655}, // Accu-Chek Aviva Connect
      {vendorId: 5946, productId: 8662},  // Accu-chek Guide Me
      {vendorId: 5946, productId: 8663} // Accu-chek Instant
    ]
  },
  'BluetoothLE': {
    mode: 'bluetooth',
  },
};

_.forEach(_.keys(device._deviceComms), function(driverId) {

  var comm = device._deviceComms[driverId];

  if (comm.name !== 'UsbDevice' && comm.name !== 'BLEDevice') {
    // usbDevice and BLEDevice are ES6 classes not handled here
    device._deviceComms[driverId] = comm();
  }
});

// this is a cache for device information
// we need it so that what we learn in detect()
// can be used by process().
device._deviceInfoCache = {};

device.init = function(options, cb) {
  var self=this;
  self._defaultTimezone = options.defaultTimezone;
  self._api = options.api;
  self._version = options.version;
  self._groupId = options.targetId;
  self._os = hostMap[os.platform()];
  cb();
};

device.getDriverManifests = function() {
  return _.cloneDeep(this._driverManifests);
};

device.getDriverIds = function() {
  return _.keys(this._driverManifests);
};

device.getDriverManifest = function(driverId) {
  var driverManifest = this._driverManifests[driverId];
  if (!driverManifest) {
    throw new Error('Could not find driver manifest for "' + driverId + '"');
  }
  return driverManifest;
};

device.detectHelper = function(driverId, options, cb) {
  var dm = this._createDriverManager(driverId, options);
  dm.detect(driverId, cb);
};

device._createDriverManager = function(driverId, options) {
  var drivers = {};
  drivers[driverId] = this._deviceDrivers[driverId];
  var configs = {};
  configs[driverId] = this._createDriverConfig(driverId, options);
  configs.debug = debugMode.isDebug;

  return driverManager(drivers, configs);
};

device._createDriverConfig = function(driverId, options) {
  options = options || {};
  var timezone = options.timezone || this._defaultTimezone;
  var comms = this._deviceComms;
  var theVersion = options.version || this._version;
  var uploadGroup = options.targetId || this._groupId;

  // handle config for block-mode devices, which includes the file name and data
  if (options.filename != null) {
    return {
      filename: options.filename,
      filedata: options.filedata,
      deviceInfo: this._deviceInfoCache[driverId],
      timezone: timezone,
      groupId: uploadGroup,
      api: this._api,
      version: options.version,
      builder: builder,
      progress: options.progress,
      displayTimeModal: options.displayTimeModal,
      displayAdHocModal: options.displayAdHocModal,
    };
  }

  var deviceInfo = this._deviceInfoCache[driverId];

  if(options.serialNumber) {
    _.assign(deviceInfo, {serialNumber: options.serialNumber});
  }

  return {
    deviceInfo: deviceInfo,
    deviceComms: comms[driverId],
    timezone: timezone,
    groupId: uploadGroup,
    api: this._api,
    version: options.version,
    builder: builder,
    progress: options.progress,
    displayTimeModal: options.displayTimeModal,
    displayAdHocModal: options.displayAdHocModal,
  };
};

device.findUsbDevice = function(driverId, usbDevices) {
  var self = this;
  var userSpaceDriver = null;
  var driverManifest = this.getDriverManifest(driverId);
  var combos = _.map(usbDevices, function(i) {
    return _.pick(i, 'product','vendorId','productId');
  });
  self.log('Looking for USB PID/VID(s): ', JSON.stringify(driverManifest.usb));
  self.log('Available USB PID/VIDs:',  JSON.stringify(combos));

  for (var i = 0; i < driverManifest.usb.length; i++) {
    self.log('USB details for ', JSON.stringify(driverManifest.usb[i]), ':',
      util.inspect(usb.findByIds(driverManifest.usb[i].vendorId,
                    driverManifest.usb[i].productId)));
  }

  var matchingUsbDevices = _.filter(usbDevices, function(usbDevice) {
    var found = false;
    for (var i = 0; i < driverManifest.usb.length; i++) {
      if(driverManifest.usb[i].vendorId === usbDevice.vendorId &&
        driverManifest.usb[i].productId === usbDevice.productId) {
        userSpaceDriver = driverManifest.usb[i].driver;
        found = true;
      }
    }
    return found;
  });

  var devices = _.map(matchingUsbDevices, function(result) {
    return {
      driverId: driverId,
      deviceId: result.deviceId,
      vendorId: result.vendorId,
      productId: result.productId,
      userSpaceDriver: userSpaceDriver,
      bitrate: driverManifest.bitrate
    };
  });

  if (devices.length > 1) {
    this.log('WARNING: More than one device found for "' + driverId + '"');
    device.othersConnected = devices.length - 1;
  }

  return _.first(devices);
};

device.detectUsb = function(driverId, cb) {
  var usbDevices = _.map(usb.getDeviceList(), function(result) {
    return {
      deviceId: result.deviceDescriptor.idDevice,
      vendorId: result.deviceDescriptor.idVendor,
      productId: result.deviceDescriptor.idProduct
    };
  });

  return cb(null, this.findUsbDevice(driverId, usbDevices));
};

device.detectHid = function(driverId, cb) {
  return cb(null, this.findUsbDevice(driverId, hid.devices()));
};

device.detectUsbSerial = function(driverId, cb) {
  var self = this;
  var driverManifest = this.getDriverManifest(driverId);

  var getDevice = function(results) {
    var devices = _.map(results, function(result) {
      var retval = {
        driverId: driverId,
        vendorId: result.vendorId,
        productId: result.productId,
        usbDevice: result.device,
        path: result.comName
      };
      if (!!driverManifest.bitrate) {
        retval.bitrate = driverManifest.bitrate;
      }
      if(!!driverManifest.ctsFlowControl) {
        retval.ctsFlowControl = driverManifest.ctsFlowControl;
      }
      if(!!driverManifest.sendTimeout){
        retval.sendTimeout = driverManifest.sendTimeout;
      }
      if(!!driverManifest.receiveTimeout) {
        retval.receiveTimeout = driverManifest.receiveTimeout;
      }
      return retval;
    });

    var devdata = _.head(devices);

    if (devices.length > 1) {
      self.log('WARNING: More than one device found for "' + driverId + '"');
      device.othersConnected = devices.length - 1;
    }
    return cb(null, devdata);
  };


  SerialPort.list(function (err, serialDevices) {
    console.log('Connected device(s):', serialDevices);
    serialDevices = _.filter(serialDevices, function(serialDevice) {
      var vendorId = parseInt(serialDevice.vendorId, 16);
      var productId = parseInt(serialDevice.productId, 16);

      for (var i = 0; i < driverManifest.usb.length; i++) {

        if(driverManifest.usb[i].vendorId === vendorId &&
           driverManifest.usb[i].productId === productId) {

           if (self._os === 'mac') {
             if (serialDevice.comName.match('/dev/tty.+')) {
               return true;
             }
           } else {
             return true;
           }
        }
      }
      return false;
    });
    console.log('Possible device(s):', serialDevices);
    getDevice(serialDevices);
  });
};

device.detect = function(driverId, options, cb) {
  var self = this;
  if (_.isFunction(options)) {
    cb = options;
    options = { version: self._version };
  }
  var driverManifest = this.getDriverManifest(driverId);

  if(driverManifest.mode === 'HID'){
      this.detectHid(driverId, function(err, devdata) {

        if (err) {
          return cb(err);
        }

        if (!devdata) {
          return cb();
        }

        self._deviceInfoCache[driverId] = _.cloneDeep(devdata);
        self.detectHelper(driverId, options, function(err, ftdiDevice) {

          if (err) {
            return cb(err);
          }
          device = _.assign(devdata, ftdiDevice);
          return cb(null, devdata);
        });
      });

  } else if (driverManifest.mode === 'usb') {

    this.detectUsb(driverId, function(err, devdata) {

      if (err) {
        return cb(err);
      }

      if (!devdata) {
        return cb();
      }

      self._deviceInfoCache[driverId] = _.cloneDeep(devdata);

      self.detectHelper(driverId, options, function(err, usbDevice) {

        if (err) {
          return cb(err);
        }
        device = _.assign(devdata, usbDevice);
        return cb(null, devdata);
      });
    });

  } else if (driverManifest.mode === 'bluetooth') {
    const devdata = {
      id: options.ble.device.id,
      name: options.ble.device.name
    };
    self._deviceInfoCache[driverId] = _.cloneDeep(devdata);
    if (!self._deviceComms[driverId].ble) {
      self._deviceComms[driverId] = new self._deviceComms[driverId](options);
    }
    self.detectHelper(driverId, options, function(err, bleDevice) {
      if (err) {
        return cb(err);
      }
      return cb(null, devdata);
    });
  } else {

    this.detectUsbSerial(driverId, function(err, devdata) {

      if (err) {
        return cb(err);
      }

      if (!devdata) {
        // no matching serial devices were found, let's see if they are
        // actually connected via USB
        self.detectUsb(driverId, function(err, devdata) {
          if(!devdata) {
            return cb();
          }
          self._deviceInfoCache[driverId] = _.cloneDeep(devdata);
          // hey, we can see it on the USB bus!
          // let's try the userspace driver if available
          if (devdata.userSpaceDriver) {
            self.detectHelper(driverId, options, function(err, userspaceDevice) {
              if (err) {
                return cb(err);
              }
              device = _.assign(devdata, userspaceDevice);
              return cb(null, devdata);
            });
          } else {
            return cb();
          }
        });
      } else {
        self._deviceInfoCache[driverId] = _.cloneDeep(devdata);
        self.detectHelper(driverId, options, function(err, serialDevice) {
          if (err) {
            return cb(err);
          }
          device = _.assign(devdata, serialDevice);
          return cb(null, devdata);
        });
      }
    });
  }
};

device.detectAll = function(cb) {
  async.map(this.getDriverIds(), this.detect.bind(this), function(err, results) {
    if (err) {
      return cb(err);
    }
    // Filter out any nulls
    results = _.filter(results);
    cb(null, results);
  });
};

device.upload = function(driverId, options, cb) {
  var dm = this._createDriverManager(driverId, options);
  dm.process(driverId, function(err, result) {
    return cb(err, result);
  });
};

module.exports = device;
