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

var appState = {};

appState.bindApp = function(app) {
  this.app = app;
  return this;
};

appState.getInitial = function() {
  return {
    page: 'loading',
    user: null,
    targetId: null,
    uploads: [
      {source: {type: 'carelink'}}
    ]
  };
};

appState.isLoggedIn = function() {
  return Boolean(this.app.state.user);
};

// For now we only support only one upload at a time,
// so the "current" upload is the first one of the list "in progress"
appState.currentUpload = function() {
  return _.find(this.app.state.uploads, function(upload) {
    return Boolean(upload.progress);
  });
};

appState.hasUploadInProgress = function() {
  return Boolean(this.currentUpload());
};

module.exports = appState;
