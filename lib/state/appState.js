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
      name: 'Dexcom',
      key: 'dexcom',
      source: {type: 'device', driverId: 'Dexcom'},
      win: {driverLink:'http://tidepool.org/downloads/'},
      mac: {driverLink:'http://tidepool.org/downloads/'},
    },
    {
      name: 'Abbott Precision Xtra',
      key: 'precisionxtra',
      source: {type: 'device', driverId: 'AbbottPrecisionXtra'}
    },
    {
       name: 'Tandem',
       key: 'tandem',
       source: {type: 'device', driverId: 'Tandem'}
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
    // },
    {
      name: 'Abbott FreeStyle Lite',
      key: 'abbottfreestylelite',
      source: {type: 'device', driverId: 'AbbottFreeStyleLite'}
    },
    {
      name: 'Abbott FreeStyle Freedom Lite',
      key: 'abbottfreestylefreedomlite',
      source: {type: 'device', driverId: 'AbbottFreeStyleFreedomLite'}
    },
    {
      name: 'Bayer Contour Next',
      key: 'bayercontournext',
      source: {type: 'device', driverId: 'BayerContourNext'}
    },
    {
       name: 'Bayer Contour Next USB',
       key: 'bayercontournextusb',
       source: {type: 'device', driverId: 'BayerContourNextUsb'}
    },
    {
       name: 'Bayer Contour USB',
       key: 'bayercontourusb',
       source: {type: 'device', driverId: 'BayerContourUsb'}
     },
     {
      name: 'Bayer Contour Next LINK',
      key: 'bayercontournextlink',
      source: {type: 'device', driverId: 'BayerContourNextLink'}
    },
    {
      name: 'Bayer Contour Next LINK 2.4',
      key: 'bayercontournextlink24',
      source: {type: 'device', driverId: 'BayerContourNextLink24'}
    }
  ];

  if (config.CARELINK) {
    uploads.unshift({name: 'Medtronic (from CareLink)', key: 'carelink', source: {type: 'carelink'}});
  }

  return {
    dropMenu: false,
    howToUpdateKBLink: 'https://tidepool-project.helpscoutdocs.com/article/6-how-to-install-or-upgrade-the-tidepool-uploader-gen',
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
