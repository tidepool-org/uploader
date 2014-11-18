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
var getIn = require('./getIn');

var serialDevice = require('../serialDevice');
var driverManager = require('../driverManager.js');
var dexcomDriver = require('../dexcomDriver');

var config = require('../config');

var device = {
  log: require('bows')('Device')
};

device._serialDrivers = {
  'DexcomG4': dexcomDriver
};

device._serialConfigs = {
  'DexcomG4': {
    deviceComms: serialDevice()
  }
};

device.init = function(cb) {
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

  var restrictDriverIds = config.RESTRICT_DRIVERS;
  if (!restrictDriverIds.length) {
    return allDriverManifests;
  }

  return _.pick(allDriverManifests, restrictDriverIds);
};

device.getDriverManifests = function() {
  return _.cloneDeep(this._driverManifests);
};

device.getDriverManifest = function(driverId) {
  var driverManifest = this._driverManifests[driverId];
  if (!driverManifest) {
    throw new Error('Could not find driver manifest for "' + driverId + '"');
  }
  return driverManifest;
};

device.detectFtdi = function(driverId, cb) {
  var drivers = {};
  drivers[driverId] = this._serialDrivers[driverId];
  var dm = driverManager(drivers, this._serialConfigs);
  dm.detect(driverId, cb);
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

    if (devices.length > 1) {
      self.log('WARNING: More than one device found for "' + driverId + '"');
    }

    var device = _.first(devices);

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

    if (driverManifest.mode === 'FTDI') {
      return self.detectFtdi(driverId, cb);
    }

    return cb(null, device);
  });
};

module.exports = device;
