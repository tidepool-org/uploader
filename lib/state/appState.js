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
  var uploads = [];

  if (config.CARELINK) {
    uploads = [{source: {type: 'carelink'}}];
  }

  return {
    page: 'loading',
    user: null,
    targetId: null,
    uploads: uploads
  };
};

appState.isLoggedIn = function() {
  return Boolean(this.app.state.user);
};

// For now we only support only one upload at a time,
// so the "current" upload is the first one of the list "in progress"
appState.currentUploadIndex = function() {
  return _.findIndex(this.app.state.uploads, function(upload) {
    return Boolean(upload.progress);
  });
};

appState.hasUploadInProgress = function() {
  return Boolean(this.currentUploadIndex() !== -1);
};

appState.deviceCount = function() {
  return _.filter(this.app.state.uploads, function(upload) {
    return upload.source.type === 'device';
  }).length;
};

appState.isShowingDeviceInstructions = function() {
  return this.deviceCount() === 0;
};

appState.uploadsWithFlags = function() {
  var currentUploadIndex = this.currentUploadIndex();
  return _.map(this.app.state.uploads, function(upload, index) {
    upload = _.clone(upload);

    if (currentUploadIndex !== -1 && currentUploadIndex !== index) {
      upload.disabled = true;
    }
    if (upload.source.type === 'device' &&
        upload.source.connected === false) {
      upload.disconnected = true;
      upload.disabled = true;
    }
    if (upload.source.type === 'carelink') {
      upload.carelink = true;
    }
    if (upload.progress) {
      upload.uploading = true;
    }
    if (!upload.progress) {
      var lastInstance = _.first(upload.history) || {};
      if (lastInstance.success) {
        upload.successful = true;
      }
      else if (lastInstance.error) {
        upload.failed = true;
      }
    }

    return upload;
  });
};

appState.hasSuccessfulUpload = function() {
  var instances = mapcat(this.app.state.uploads, function(upload) {
    return upload.history;
  });
  return _.reduce(instances, function(result, instance) {
    if (result) {
      return result;
    }
    return Boolean(instance.success);
  }, false);
};

module.exports = appState;
