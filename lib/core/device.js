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

/* global chrome */

var _ = require('lodash');
var async = require('async');
var getIn = require('./getIn');

var serialDevice = require('../serialDevice');
var driverManager = require('../driverManager');
var builder = require('../objectBuilder')();

var dexcomDriver = require('../drivers/dexcomDriver');
var oneTouchMiniDriver = require('../drivers/oneTouchMiniDriver');
var abbottFreeStyle = require('../drivers/abbottFreeStyle');

var device = {
  log: require('../bows')('Device')
};

device._deviceDrivers = {
  'DexcomG4': dexcomDriver,
  'OneTouchMini': oneTouchMiniDriver,
  'AbbottFreeStyle': abbottFreeStyle
};

device._deviceComms = {
  'DexcomG4': serialDevice,
  'OneTouchMini': serialDevice,
  'AbbottFreeStyle': serialDevice
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
  self._restrictDrivers = options.restrictDrivers;
  self._driverManifests = self._getSupportedDriverManifests();
  self._api = options.api;
  self._version = options.version;
  self._groupId = options.targetId;
  chrome.runtime.getPlatformInfo(function (platformInfo) {
    if (platformInfo.os == 'win') {
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

device._getSupportedDriverManifests = function() {
  var allDriverManifests = this._getAllDriverManifests();

  var restrictDriverIds = this._restrictDrivers;
  if (!restrictDriverIds.length) {
    return allDriverManifests;
  }

  return _.pick(allDriverManifests, restrictDriverIds);
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

  return driverManager(drivers, configs);
};

device._createDriverConfig = function(driverId, options) {
  options = options || {};
  var timezone = options.timezone || this._defaultTimezone;
  var comms = options.silent ? this._silentComms : this._deviceComms;
  var theVersion = options.version || this._version;
  var uploadGroup = options.targetId || this._groupId;

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

device.detectUsb = function(driverId, cb) {
  var self = this;
  var driverManifest = this.getDriverManifest(driverId);
  var identification = {
    vendorId: driverManifest.vendorId,
    productId: driverManifest.productId
  };
  chrome.usb.getDevices(identification, function(results) {
    var devices = _.map(results, function(result) {
      var retval = {
        driverId: driverId,
        vendorId: driverManifest.vendorId,
        productId: driverManifest.productId,
        portPattern: self._portpattern,
        usbDevice: result.device
      };
      if (!!driverManifest.bitrate) {
        retval.bitrate = driverManifest.bitrate;
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

device.detect = function(driverId, options, cb) {
  var self = this;
  if (_.isFunction(options)) {
    cb = options;
    options = { version: self._version };
  }
  var driverManifest = this.getDriverManifest(driverId);
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
