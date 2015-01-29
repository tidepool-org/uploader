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
var sundial = require('sundial');
var localStore = require('../core/localStore');
var api = require('../core/api');
var device = require('../core/device');
var carelink = require('../core/carelink');
var appState = require('./appState');

var config = require('../config.js');

var appActions = {};

appActions.trackedState = {
  LOGIN_SUCCESS : 'Login Successful',
  LOGOUT_CLICKED : 'Clicked Log Out',
  UPLOAD_FAILED : 'Upload Failed',
  UPLOAD_SUCCESS : 'Upload Successful',
  UPLOAD_STARTED : 'Upload Attempted',
  CARELINK_FETCH_FAILED : 'CareLink Fetch Failed',
  CARELINK_FETCH_SUCCESS : 'CareLink Fetch Successful',
  CARELINK_LOAD_FAILED : 'CareLink Upload Failed',
  CARELINK_LOAD_SUCCESS : 'CareLink Upload Successful',
  SEE_IN_BLIP : 'Clicked See Data in Blip'
};

appActions.bindApp = function(app) {
  this.app = app;
  return this;
};

appActions.changeGroup = function(e) {
  var userid = e.target.value;

  //reset upload state when changing group
  for(var i in this.app.state.uploads) {
    appActions.reset(i);
  }
  this.app.setState({
    targetId: userid
  });
};

appActions.load = function(cb) {
  var self = this;
  var loadLocalStore = function(cb) {
    localStore.init(localStore.getInitialState(), function() {
      cb();
    });
  };

  function setHostsWithCallback(cb) {
    api.setHosts(_.pick(config, ['API_URL', 'UPLOAD_URL', 'BLIP_URL']));
    return cb(null);
  }

  async.series([
    loadLocalStore,
    device.init.bind(device, {
      api: api,
      defaultTimezone: config.DEFAULT_TIMEZONE,
      restrictDrivers: config.RESTRICT_DRIVERS,
      version: config.namedVersion
    }),
    carelink.init.bind(carelink, {
      api: api,
      defaultTimezone: config.DEFAULT_TIMEZONE
    }),
    api.init.bind(api, {
      // these are for initialization only -- they get overwritten
      // if someone changes the URL
      apiUrl: config.API_URL,
      uploadUrl: config.UPLOAD_URL
    }),
    setHostsWithCallback,
  ], function(err, results) {
    if (err) {
      return cb(err);
    }

    var session = results[3];
    if (!session) {
      self.app.setState({
        page: 'login'
      });
      return cb();
    }

    async.series([
      api.user.account.bind(null),
      api.user.profile.bind(null),
      api.user.getUploadGroups.bind(null)
    ], function(err, results) {
      var account = results[0];
      var profile = results[1];
      var uploadGroups = results[2];

      var user = _.assign({}, account, {profile: profile, uploadGroups: uploadGroups});

      // once we've logged in, we don't want the right-click menus around, so
      // delete them.
      // because our test env isn't chrome, we have to test for it
      if (typeof chrome !== 'undefined') {
        chrome.contextMenus.removeAll();
      }

      self.app.setState({
        user: user,
        // per default we pick the first group in the uploadGroups
        targetId: uploadGroups[0].userid,
        page: 'main'
      });

      return cb(null, user);
    });
  });
};

appActions.login = function(credentials, options, cb) {
  var self = this;
  async.series([
    api.user.login.bind(null, credentials, options),
    api.user.profile,
    api.user.getUploadGroups.bind(null)
  ], function(err, results) {
    if (err) {
      return cb(err);
    }
    self._logMetric(self.trackedState.LOGIN_SUCCESS);
    // once we've logged in, we don't want the right-click menus around, so
    // delete them.
    // because our test env isn't chrome, we have to test for it
    if (typeof chrome !== 'undefined') {
      chrome.contextMenus.removeAll();
    }

    var account = results[0] && results[0].user;
    var profile = results[1];
    var uploadGroups = results[2];

    var user = _.assign({}, account, {profile: profile, uploadGroups: uploadGroups});

    self.app.setState({
      user: user,
      targetId: user.userid,
      page: 'main'
    });

    return cb(null, user);
  });
};

appActions.logout = function(cb) {
  var self = this;
  self._logMetric(this.trackedState.LOGOUT_CLICKED);
  api.user.logout(function(err) {
    if (err) {
      return cb(err);
    }

    self.app.setState(_.assign(appState.getInitial(), {
      page: 'login'
    }));

    return cb();
  });
};

appActions.viewData = function() {
  this._logMetric(this.trackedState.SEE_IN_BLIP);
  return;
};

appActions.detectDevices = function(cb) {
  var self = this;
  device.detectAll(function(err, devices) {
    if (err) {
      return cb(err);
    }

    var uploads = self._mergeDevicesWithUploads(
      devices, self.app.state.uploads
    );
    self.app.setState({
      uploads: uploads
    });

    return cb(null, devices);
  });
};

appActions._logMetric = function(eventName, properties) {
  api.metrics.track(eventName, properties);
};

appActions._logError = function(error, message, properties) {
  api.errors.log(error, message, properties);
};

appActions._mergeDevicesWithUploads = function(devices, uploads) {
  var self = this;

  // Map connected devices to upload ids
  var connectedDeviceMap = _.reduce(devices, function(acc, d) {
    var upload = self._newUploadFromDevice(d);
    acc[self._getUploadId(upload)] = d;
    return acc;
  }, {});

  // Work only on device uploads
  var deviceUploads = _.filter(uploads, function(upload) {
    return upload.source.type === 'device';
  });

  // Mark device uploads that are disconnected
  // and add any newly connected devices at the end of the list
  var newDeviceMap = _.clone(connectedDeviceMap);
  _.forEach(deviceUploads, function(upload) {
    var uploadId = self._getUploadId(upload);
    var connectedDevice = connectedDeviceMap[uploadId];
    if (!connectedDevice) {
      upload.source.connected = false;
      delete upload.progress;
    }
    else {
      upload.source = _.assign(
        upload.source, {connected: true}, connectedDevice
      );
      delete newDeviceMap[uploadId];
    }
  });
  _.forEach(_.values(newDeviceMap), function(d) {
    deviceUploads.push(self._newUploadFromDevice(d));
  });

  // Add back carelink upload at beginning of list
  var carelinkUpload = _.find(uploads, function(upload) {
    return upload.source.type === 'carelink';
  });
  var newUploads = deviceUploads;
  if (carelinkUpload) {
    newUploads.unshift(carelinkUpload);
  }

  return newUploads;
};

appActions._getUploadId = function(upload) {
  var source = upload.source;
  if (source.type === 'device') {
    return source.driverId;
  }
  if (source.type === 'carelink') {
    return source.type;
  }
  return null;
};

appActions._newUploadFromDevice = function(d) {
  return {
    source: _.assign({type: 'device'}, d, {connected: true})
  };
};

appActions.upload = function(uploadIndex, options, cb) {
  var self = this;
  cb = cb || _.noop;

  this._assertValidUploadIndex(uploadIndex);

  if (appState.hasUploadInProgress()) {
    throw new Error('Cannot start upload while an upload is in progress');
  }

  var upload = this.app.state.uploads[uploadIndex];

  options = _.assign(options, {
    targetId: this.app.state.targetId,
    progress: this._setUploadPercentage.bind(this, uploadIndex),
    version: config.namedVersion //e.g. Tidepool Uploader v0.1.0
  });
  var onUploadFinish = function(err, records) {
    if (err) {
      self._handleUploadError(uploadIndex, err);
      return cb(err);
    }
    self._handleUploadSuccess(uploadIndex, records);
    return cb(null, records);
  };

  this._setUploadStart(uploadIndex, options);

  self._logMetric(
    self.trackedState.UPLOAD_STARTED+' '+self._getUploadId(upload),
    { type: upload.source.type, source:upload.source.driverId }
  );

  if (upload.source.type === 'device') {
    var driverId = this.app.state.uploads[uploadIndex].source.driverId;
    return this._uploadDevice(driverId, options, onUploadFinish);
  }
  else if (upload.source.type === 'carelink') {
    var credentials = {
      username: options.username,
      password: options.password
    };
    return this._uploadCarelink(credentials, options, onUploadFinish);
  }
  else {
    throw new Error('Unsupported upload source type ' + upload.source.type);
  }
};

appActions._assertValidUploadIndex = function(uploadIndex) {
  if (uploadIndex > this.app.state.uploads.length - 1) {
    throw new Error('Invalid upload index ' + uploadIndex);
  }
};

appActions._setUploadStart = function(uploadIndex, options) {
  var self = this;
  this._updateUpload(uploadIndex, function(upload) {
    var progress = {
      targetId: options.targetId,
      start: self._now(),
      step: 'start',
      percentage: 0
    };

    // Remember carelink username we're uploading from
    if (options.username) {
      progress.username = options.username;
    }

    upload.progress = progress;
    return upload;
  });
};

appActions._setUploadPercentage = function(uploadIndex, step, percentage) {
  this._updateUpload(uploadIndex, function(upload) {
    upload.progress = _.assign(upload.progress, {
      step: step,
      percentage: percentage
    });
    return upload;
  });
};

appActions._handleUploadSuccess = function(uploadIndex, records) {
  var self = this;
  this._updateUpload(uploadIndex, function(upload) {
    //log metric details
    self._logMetric(
      self.trackedState.UPLOAD_SUCCESS+' '+self._getUploadId(upload),
      { type: upload.source.type,
        source: upload.source.driverId,
        started: upload.progress.start,
        finished: upload.progress.finish,
        processed: upload.progress.count
      }
    );

    var instance = _.assign(upload.progress, {
      finish: self._now(),
      success: true,
      count: records.length
    });
    upload.progress = instance;
    upload = self._addToUploadHistory(upload, instance);
    //
    return upload;
  });
};

appActions._handleUploadError = function(uploadIndex, error) {
  var self = this;
  this._updateUpload(uploadIndex, function(upload) {
    //log the errors
    self._logMetric(
      self.trackedState.UPLOAD_FAILED +' '+self._getUploadId(upload),
      {type: upload.source.type ,source:upload.source.driverId, error: error }
    );

    self._logError(
      error,
      self.trackedState.UPLOAD_FAILED +' '+self._getUploadId(upload),
      {type: upload.source.type ,source:upload.source.driverId}
    );

    var instance = _.assign(upload.progress, {
      finish: self._now(),
      error: error
    });
    upload.progress = instance;
    upload = self._addToUploadHistory(upload, instance);
    return upload;
  });
};

appActions._addToUploadHistory = function(upload, instance) {
  var history = upload.history || [];
  history.unshift(instance);
  upload.history = history;
  return upload;
};

appActions._updateUpload = function(uploadIndex, updateFn) {
  var uploads = this.app.state.uploads;
  uploads[uploadIndex] = updateFn(uploads[uploadIndex]);
  this.app.setState({
    uploads: uploads
  });
};

appActions._uploadDevice = function(driverId, options, cb) {

  device.detect(driverId, options, function(err, d) {
    if (err) {
      return cb(err);
    }

    if (!d) {
      err = new Error('The device doesn\'t appear to be connected');
      err.code = 404;
      return cb(err);
    }

    device.upload(driverId, options, function(err, records) {
      if (err) {
        return cb(err);
      }

      records = records || [];
      return cb(null, records);
    });
  });
};

appActions._now = function() {
  return sundial.utcDateString();
};

appActions._uploadCarelink = function(credentials, options, cb) {
  var self = this;

  var payload = {
    carelinkUsername: credentials.username,
    carelinkPassword: credentials.password,
    daysAgo: config.DEFAULT_CARELINK_DAYS
  };

  api.upload.fetchCarelinkData(payload, function(err, data) {

    if (err) {
      var loggedMessage = self.trackedState.CARELINK_FETCH_FAILED;

      if (err.error && err.error.error){
        //add detail to name as we have it.
        loggedMessage = loggedMessage +' '+err.error.error;
      }

      self._logMetric(loggedMessage);
      self._logError(err, loggedMessage);
      return cb(err);
    }

    self._logMetric(self.trackedState.CARELINK_FETCH_SUCCESS);

    carelink.upload(data, options, function(err, records) {
      if (err) {
        return cb(err);
      }

      records = records || [];
      return cb(null, records);
    });
  });
};

appActions.reset = function(uploadIndex) {
  this._assertValidUploadIndex(uploadIndex);
  this._updateUpload(uploadIndex, function(upload) {
    return _.omit(upload, 'progress');
  });
};

module.exports = appActions;
