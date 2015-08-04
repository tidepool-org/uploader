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

var _ = require('lodash');
var mapcat = require('../core/mapcat');

var config = require('../config');

var appState = {};

appState.bindApp = function(app) {
  this.app = app;
  return this;
};

appState.getInitial = function() {

  var uploads = [
    {
      name: 'Insulet OmniPod',
      key: 'omnipod',
      source: {type: 'block', driverId: 'InsuletOmniPod', extension: '.ibf'}
    },
    {
      name: 'Dexcom G4 Platinum',
      key: 'dexcom',
      source: {type: 'device', driverId: 'DexcomG4'}
    },
    {
      name: 'Abbott FreeStyle Precision Xtra',
      key: 'precisionxtra',
      source: {type: 'device', driverId: 'AbbottFreeStyle'}
    },
    // {
    //   name: 'OneTouch Ultra2',
    //   key: 'onetouchultra2',
    //   source: {type: 'device', driverId: 'OneTouchUltra2'}
    // },
    // {
    //   name: 'OneTouch UltraMini',
    //   key: 'onetouchmini',
    //   source: {type: 'device', driverId: 'OneTouchMini'}
    // }
    {
      name: 'Abbott FreeStyle Lite',
      key: 'abbottfreestylelite',
      source: {type: 'device', driverId: 'AbbottFreeStyleLite'}
    },
    {
      name: 'Bayer Contour Next',
      key: 'bayercontournext',
      source: {type: 'device', driverId: 'BayerContourNext'}
    }
  ];

  if (config.CARELINK) {
    uploads.unshift({name: 'Medtronic MiniMed (CareLink)', key: 'carelink', source: {type: 'carelink'}});
  }

  return {
    dropMenu: false,
    page: 'loading',
    user: null,
    targetId: null,
    targetDevices: [],
    targetTimezone: null,
    targetTimezoneLabel: null,
    uploads: uploads
  };
};

appState.isLoggedIn = function() {
  return Boolean(this.app.state.user);
};

// For now we only support only one upload at a time,
// so the "current" upload is the first one of the list "in progress"
appState.currentUploadIndex = function() {
  return _.findIndex(this.app.state.uploads, this._isUploadInProgress);
};

appState._isUploadInProgress = function(upload) {
  if (upload.progress && !upload.progress.finish) {
    return true;
  }
  return false;
};

appState.hasUploadInProgress = function() {
  return Boolean(this.currentUploadIndex() !== -1);
};

appState.deviceCount = function() {
  return _.filter(this.app.state.uploads, function(upload) {
    return upload.source.type === 'device';
  }).length;
};

appState.uploadsWithFlags = function() {
  var self = this;
  var currentUploadIndex = this.currentUploadIndex();
  var currentUploadKey = null;
  if (currentUploadIndex !== -1) {
    currentUploadKey = this.app.state.uploads[currentUploadIndex].key;
  }
  var targetedUploads = _.filter(this.app.state.uploads, function(upload) {
    return _.contains(self.app.state.targetDevices, upload.key);
  });
  return _.map(targetedUploads, function(upload, index) {
    upload = _.clone(upload);
    var source = upload.source || {};

    if (currentUploadIndex !== -1 && upload.key !== currentUploadKey) {
      upload.disabled = true;
    }
    if (source.type === 'device' &&
        source.connected === false) {
      upload.disconnected = true;
      upload.disabled = true;
    }
    if (source.type === 'carelink') {
      upload.carelink = true;
    }
    if (self._isUploadInProgress(upload)) {
      upload.uploading = true;
      if (source.type === 'carelink' && upload.progress.step === 'start') {
        upload.fetchingCarelinkData = true;
      }
    }
    if (!upload.uploading && upload.progress) {
      upload.completed = true;
      var instance = upload.progress;
      if (instance.success) {
        upload.successful = true;
      }
      else if (instance.error) {
        upload.failed = true;
        upload.error = instance.error;
      }
    }

    return upload;
  });
};

module.exports = appState;
