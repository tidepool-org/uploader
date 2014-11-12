/**
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
 */

// Wrapper around the Tidepool client library
var bows = require('bows');
var createTidepoolClient = require('tidepool-platform-client');
var tidepool;

//TODO: config
var tidepoolHosts = {
  local: { 
    host: 'http://localhost:8009', 
    jellyfish: 'http://localhost:9122',
    blip: 'http://localhost:3000'
  },
  devel: { 
    host: 'https://devel-api.tidepool.io', 
    jellyfish: 'https://devel-uploads.tidepool.io',
    blip: 'https://blip-devel.tidepool.io'
  },
  staging: { 
    host: 'https://staging-api.tidepool.io', 
    jellyfish: 'https://staging-uploads.tidepool.io',
    blip: 'https://blip-staging.tidepool.io'
  },
  prod: { 
    host: 'https://api.tidepool.io', 
    jellyfish: 'https://uploads.tidepool.io',
    blip: 'https://blip-ucsf-pilot.tidepool.io'
  }
};

//TODO: full replaced by platform client
var tidepoolServerData = {
  host: '',
  jellyfish: '',
  usertoken: '',
  userdata: null,
  isLoggedIn: false
};

var api = {
  log: bows('Api'),
  hosts: tidepoolHosts,
  serverData: tidepoolServerData
};

// ----- Api Setup -----

api.init = function(config,cb) {

  config = config || tidepoolHosts;

  var tidepoolLog = bows('Tidepool');
  tidepool = createTidepoolClient({
    host: config.host,
    uploadApi: config.jellyfish,
    log: {
      warn: tidepoolLog,
      info: tidepoolLog,
      debug: tidepoolLog
    },
    localStore: window.localStorage,
    metricsSource: 'chrome-uploader',
    metricsVersion: 'chrome-uploader-beta'
  });

  api.tidepool = tidepool;

  tidepool.initialize(function() {
    cb();
  });
};

// ----- User -----

api.user = {};

api.user.login = function(user, happyCb, sadCb) {
  api.log('POST /user/login');

  tidepool.login(user, {}, function(err, data) {
    if (err) {
      return sadCb(err,err);
    }
    return happyCb(data,'logged in');
  });
};

api.user.profile = function(happyCb, sadCb) {
  api.log('POST /user/login');

  tidepool.findProfile(tidepool.getUserId(), function(err, profile) {
      if (err) {
        return sadCb(err,err);
      }
      return happyCb(profile,'profile found');
  });
};

// ----- Upload -----

api.upload = {};

api.upload.accounts = function(happyCb, sadCb) {
  //TODO: check this method out
  tidepool.getViewableUsers(tidepool.getUserId(),function(err, data) {
    if(err){
      return sadCb(err,err);
    }
    return happyCb(data, 'upload accounts found');
  });
};

api.upload.toPlatform = function(data, happyCb, sadCb) {
  //off to jellyfish we go
  tidepool.uploadDeviceDataForUser(data, function(err, result) {
    if(err){
      return sadCb(err,err);
    }
    return happyCb(result, 'upload accounts found');
  });
};

// ----- Metrics -----

api.metrics = {};

api.metrics.track = function(eventName, properties, cb) {
  api.log('GET /metrics/' + window.encodeURIComponent(eventName));
  return tidepool.trackMetric(eventName, properties, cb);
};

// ----- Errors -----

api.errors = {};

api.errors.log = function(error, message, properties) {
  api.log('POST /errors');

  return tidepool.logAppError(error, message, properties);
};

module.exports = api;
