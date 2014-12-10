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
var timeutils = require('../timeutils');

var dexcomDriver = require('../dexcomDriver');

var device = {
  log: require('../bows')('Device')
};

device._deviceDrivers = {
  'DexcomG4': dexcomDriver
};

device._deviceComms = {
  'DexcomG4': serialDevice
};
device._silentComms = {};
_.forEach(_.keys(device._deviceComms), function(driverId) {
  var comm = device._deviceComms[driverId];
  device._silentComms[driverId] = comm({silent: true});
  device._deviceComms[driverId] = comm();
});

device.init = function(options, cb) {
  this._defaultTimezone = options.defaultTimezone;
  this._restrictDrivers = options.restrictDrivers;
  this._jellyfish = options.jellyfish;
  this._driverManifests = this._getSupportedDriverManifests();
  cb();
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

device.detectHelper = function(driverId, cb) {
  // Detect can run on a loop, so don't polute the console with logging
  var dm = this._createDriverManager(driverId, {silent: true});
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
  return {
    deviceComms: comms[driverId],
    timeutils: timeutils,
    timezone: timezone,
    jellyfish: this._jellyfish,
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
      return {
        driverId: driverId,
        usbDevice: result.device
      };
    });

    var device = _.first(devices);

    if (devices.length > 1) {
      self.log('WARNING: More than one device found for "' + driverId + '"');
      device.othersConnected = devices.length - 1;
    }

    return cb(null, device);
  });
};

device.detect = function(driverId, cb) {
  var self = this;
  var driverManifest = this.getDriverManifest(driverId);
  this.detectUsb(driverId, function(err, device) {
    if (err) {
      return cb(err);
    }

    return self.detectHelper(driverId, function(err, ftdiDevice) {
      if (err) {
        return cb(err);
      }
      device = _.assign(device, ftdiDevice);
      return cb(null, device);
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
