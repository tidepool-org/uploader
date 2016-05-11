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

/* global chrome, __DEBUG__ */

var _ = require('lodash');
var async = require('async');
var getIn = require('./getIn');

var serialDevice = require('../serialDevice');
var hidDevice = require('../hidDevice');
var driverManager = require('../driverManager');
var builder = require('../objectBuilder')();

var dexcomDriver = require('../drivers/dexcomDriver');
var oneTouchMiniDriver = require('../drivers/oneTouchMiniDriver');
var abbottPrecisionXtra = require('../drivers/abbottPrecisionXtra');
var tandemDriver = require('../drivers/tandemDriver');
var insuletOmniPod = require('../drivers/insuletDriver');
var oneTouchUltra2 = require('../drivers/oneTouchUltra2');
var oneTouchVerioIQ = require('../drivers/oneTouchVerioIQ');
var abbottFreeStyleLite = require('../drivers/abbottFreeStyleLite');
var bayerContourNext = require('../drivers/bayerContourNext');

var device = {
  log: require('../bows')('Device')
};

device._deviceDrivers = {
  'Dexcom': dexcomDriver,
  'OneTouchMini': oneTouchMiniDriver,
  'AbbottPrecisionXtra': abbottPrecisionXtra,
  'InsuletOmniPod': insuletOmniPod,
  'Tandem': tandemDriver,
  'OneTouchUltra2': oneTouchUltra2,
  'OneTouchVerioIQ': oneTouchVerioIQ,
  'AbbottFreeStyleLite': abbottFreeStyleLite,
  'AbbottFreeStyleFreedomLite': abbottFreeStyleLite,
  'BayerContourNext': bayerContourNext,
  'BayerContourNextUsb': bayerContourNext,
  'BayerContourUsb': bayerContourNext,
  'BayerContourNextLink': bayerContourNext
};

device._deviceComms = {
  'Dexcom': serialDevice,
  'OneTouchMini': serialDevice,
  'AbbottPrecisionXtra': serialDevice,
  'OneTouchUltra2': serialDevice,
  'OneTouchVerioIQ': serialDevice,
  'AbbottFreeStyleLite': serialDevice,
  'AbbottFreeStyleFreedomLite': serialDevice,
  'Tandem': serialDevice,
  'BayerContourNext': hidDevice,
  'BayerContourNextUsb': hidDevice,
  'BayerContourUsb': hidDevice,
  'BayerContourNextLink': hidDevice
};

device._silentComms = {};
_.forEach(_.keys(device._deviceComms), function(driverId) {

  var comm = device._deviceComms[driverId];
  device._silentComms[driverId] = comm({silent: true});
  device._deviceComms[driverId] = comm();
});

// this is a cache for device information
// we need it so that what we learn in detect()
// can be used by process().
device._deviceInfoCache = {};

device.init = function(options, cb) {
  var self=this;
  self._defaultTimezone = options.defaultTimezone;
  self._driverManifests = self._getAllDriverManifests();
  self._api = options.api;
  self._version = options.version;
  self._groupId = options.targetId;

  chrome.runtime.getPlatformInfo(function (platformInfo) {
    self._os = platformInfo.os;
    if (self._os == 'win') {
      self._portpattern = 'COM[0-9]+';
    } else {
      self._portpattern = '/dev/cu\\.usb.+';
    }
    cb();
  });

};

device._getAllDriverManifests = function() {
  var manifest = chrome.runtime.getManifest();

  var usbDevicesPermission = _.find(manifest.permissions, function(permission) {
    return permission.usbDevices;
  });
  return _.reduce(usbDevicesPermission.usbDevices, function(acc, usbDevice) {
    acc[usbDevice.driverId] = usbDevice;
    return acc;
  }, {});
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
  // Detect can run on a loop, so don't pollute the console with logging
  options.silent = true;
  var dm = this._createDriverManager(driverId, options);
  dm.detect(driverId, cb);
};

device._createDriverManager = function(driverId, options) {
  var drivers = {};
  drivers[driverId] = this._deviceDrivers[driverId];
  var configs = {};
  configs[driverId] = this._createDriverConfig(driverId, options);
  configs.debug = __DEBUG__ || false;

  return driverManager(drivers, configs);
};

device._createDriverConfig = function(driverId, options) {
  options = options || {};
  var timezone = options.timezone || this._defaultTimezone;
  var comms = options.silent ? this._silentComms : this._deviceComms;
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
      silent: Boolean(options.silent)
    };
  }

  return {
    deviceInfo: this._deviceInfoCache[driverId],
    deviceComms: comms[driverId],
    timezone: timezone,
    groupId: uploadGroup,
    api: this._api,
    version: options.version,
    builder: builder,
    progress: options.progress,
    silent: Boolean(options.silent)
  };
};

device.detectHid = function(driverId, cb) {
  var self = this;
  var driverManifest = this.getDriverManifest(driverId);
  var identification = {
    vendorId: driverManifest.vendorId,
    productId: driverManifest.productId
  };
  chrome.hid.getDevices({vendorId:driverManifest.vendorId}, function(results) {
    var devices = _.map(results, function(result) {
      var retval = {
        driverId: driverId,
        deviceId: result.deviceId,
        vendorId: result.vendorId,
        productId: result.productId
      };

      if (self._os == 'win') {
        if (driverManifest.winPortPattern) {
          retval.portPattern = driverManifest.winPortPattern;
        }
      } else {
        if (driverManifest.macPortPattern) {
          retval.portPattern = driverManifest.macPortPattern;
        }
      }

      return retval;
    });

    var devdata = _.first(devices);

    if (devices.length > 1) {
      self.log('WARNING: More than one device found for "' + driverId + '"');
      device.othersConnected = devices.length - 1;
    }

    return cb(null, devdata);
  });
};

device.detectUsb = function(driverId, cb) {
  var self = this;
  var driverManifest = this.getDriverManifest(driverId);
  var identification = {
    vendorId: driverManifest.vendorId,
    productId: driverManifest.productId
  };

  var getDevice = function(results) {
    var devices = _.map(results, function(result) {
      var retval = {
        driverId: driverId,
        vendorId: driverManifest.vendorId,
        productId: driverManifest.productId,
        portPattern: self._portpattern,
        usbDevice: result.device,
        path: result.path
      };
      if (self._os == 'win') {
        if (driverManifest.winPortPattern) {
          retval.portPattern = driverManifest.winPortPattern;
        }
      } else {
        if (driverManifest.macPortPattern) {
          retval.portPattern = driverManifest.macPortPattern;
        }
      }
      if (!!driverManifest.bitrate) {
        retval.bitrate = driverManifest.bitrate;
      }
      if (!!driverManifest.sendTimeout) {
        retval.sendTimeout = driverManifest.sendTimeout;
      }
      if(!!driverManifest.receiveTimeout) {
        retval.receiveTimeout = driverManifest.receiveTimeout;
      }
      return retval;
    });

    var devdata = _.first(devices);

    if (devices.length > 1) {
      self.log('WARNING: More than one device found for "' + driverId + '"');
      device.othersConnected = devices.length - 1;
    }
    return cb(null, devdata);
  };

  if (self._os === 'win') {
    var chromeVersion = /Chrome\/([0-9]+)/.exec(navigator.userAgent)[1];
    self.log('Chrome version detected as', chromeVersion);

    if (chromeVersion >= 50) {
      chrome.serial.getDevices(function(results) {
        // As of Chrome 50, product ID and vendor ID is returned
        // on Windows (only) for serial.getDevices
        results = _.filter(results, function(p) {
          return (p.vendorId === driverManifest.vendorId) &&
          (p.productId === driverManifest.productId);
        });

        getDevice(results);
      });
    }
    else {
      // this is the hotfix for Windows Chrome 49 and earlier
      chrome.serial.getDevices(function(results) {
        self.log('Connected device(s): ');
        for(var i in results) {
            self.log(results[i].path);
        }
        getDevice(results);
      });
    }
  }
  else {
    chrome.usb.getDevices(identification, function(results) {
      // this is the way it *should* work, with filtering done by
      // usb.getDevices, but it is not working on Windows
      getDevice(results);
    });
  }
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

  }else{

    this.detectUsb(driverId, function(err, devdata) {

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
    if (err) {
      return cb(err);
    }
    return cb(null, result.post_records);
  });
};

module.exports = device;
