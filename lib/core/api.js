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

var _ = require('lodash');
var async = require('async');

var bows = require('../bows');
var localStore = require('./localStore');

// Wrapper around the Tidepool client library
var createTidepoolClient = require('tidepool-platform-client');
var tidepool;

var api = {
  log: bows('Api')
};

// ----- Api Setup -----

api.init = function(options, cb) {
  var tidepoolLog = bows('Tidepool');
  tidepool = createTidepoolClient({
    host: options.apiUrl,
    uploadApi: options.uploadUrl,
    log: {
      warn: tidepoolLog,
      info: tidepoolLog,
      debug: tidepoolLog
    },
    localStore: localStore,
    metricsSource: 'chrome-uploader',
    metricsVersion: 'chrome-uploader-beta'
  });

  api.tidepool = tidepool;

  tidepool.initialize(cb);
};

// ----- User -----

api.user = {};

api.user.login = function(user, options, cb) {
  api.log('POST /auth/login');

  tidepool.login(user, options, function(err, data) {
    if (err) {
      return cb(err);
    }
    return cb(null, data);
  });
};

api.user.account = function(cb) {
  api.log('GET /auth/user');
  tidepool.getCurrentUser(cb);
};

api.user.profile = function(cb) {
  api.log('GET /metadata/' + tidepool.getUserId() + '/profile');
  tidepool.findProfile(tidepool.getUserId(), function(err, profile) {
      if (err) {
        return cb(err);
      }
      return cb(null, profile);
  });
};

api.user.logout = function(cb) {
  api.log('POST /auth/logout');
  tidepool.logout(cb);
};

// ----- Upload -----

api.upload = {};

api.upload.accounts = function(happyCb, sadCb) {
  //TODO: check this method out
  api.log('GET /access/groups/'+tidepool.getUserId());
  tidepool.getViewableUsers(tidepool.getUserId(),function(err, data) {
    if(err){
      return sadCb(err,err);
    }
    return happyCb(data, 'upload accounts found');
  });
};

function postBlockToPlatform(data, groupId, callback) {
  if (!callback) {
    callback = groupId;
    groupId = null;
  }

  var recCount = data.length;
  var happy = function () {
    callback(null, recCount);
  };

  var sad = function (jqxhr, status, err) {
    if (jqxhr.status == 413 && data.length > 1) { // request entity too big
      // but we can split the request and try again
      var l = Math.floor(data.length / 2);
      var d1 = data.slice(0, l);
      var d2 = data.slice(l);
      async.mapSeries([d1, d2], postBlockToPlatform, function (err, result) {
        if (err) {
          return callback(err, 0);
        }
        return callback(null, result[0] + result[1]);
      });
      return;
    }
    if (jqxhr.responseJSON && jqxhr.responseJSON.errorCode && jqxhr.responseJSON.errorCode == 'duplicate') {
      api.log(jqxhr.responseJSON);
      callback('duplicate', jqxhr.responseJSON.index);
    } else {
      api.log('platfrom data post failed.');
      api.log(status);
      api.log(err);
      api.log(jqxhr.responseJSON);
      callback(jqxhr.responseJSON, 0);
    }
  };

  tidepool.uploadDeviceDataForUser(data, groupId, function(err, result) {
    if (err) {
      return sad(err, err);
    }
    return happy(result);
  });
}

/*
 * process the data sending it to the platform in blocks and feed back progress to the calling function
 */
api.upload.toPlatform = function(data, sessionInfo, progress, groupId, cb) {
  if (!callback) {
    callback = groupId;
    groupId = null;
  }
  
  var blocks = [];
  var BLOCKSIZE = 100;
  var nblocks = 0;

  var post_and_progress = function (data, callback) {
    progress(nblocks++ * 100.0 / blocks.length);
    //off to the platfrom we go
    return postBlockToPlatform(data, groupId, callback);
  };

  var decorate_uploadid = function (data, uploadSessionMeta) {
    var deviceRecords = _.map(data, function(item) {
      return _.extend({}, item, {uploadId: uploadSessionMeta.uploadId});
    });
    deviceRecords.unshift(uploadSessionMeta);
    return deviceRecords;
  };

  tidepool.startUploadSession(sessionInfo,function(err, uploadSessionMeta){
    if(err){
      return cb(err);
    }
    data = decorate_uploadid(data,uploadSessionMeta);

    for (var i = 0; i < data.length; i += BLOCKSIZE) {
      blocks.push(data.slice(i, i + BLOCKSIZE));
    }

    async.mapSeries(blocks, post_and_progress, cb);

  });
};

// `payload` contains:
// `carelinkUsername`, `careLinkPassword`, `daysAgo`
api.upload.fetchCarelinkData = function(payload, cb) {
  api.log('POST /carelink');
  tidepool.uploadCarelinkDataForUser(payload, function(err, syncTask) {
    if (err) {
      return cb(err);
    }
    return tidepool.getCarelinkData(syncTask._id, cb);
  });
};

// ----- Metrics -----

api.metrics = {};

api.metrics.track = function(eventName, properties) {
  api.log('GET /metrics/' + window.encodeURIComponent(eventName));
  return tidepool.trackMetric(eventName, stringifyData(properties));
};

// ----- Errors -----

api.errors = {};

//utility function that so our logs look good
//TODO: should move to platform-client
function stringifyData(data) {
  if(_.isEmpty(data)){
    return '';
  }
  if (_.isPlainObject(data)) {
    return JSON.stringify(data);
  }
  else {
    return data.toString();
  }
}

api.errors.log = function(error, message, properties) {
  api.log('POST /errors');

  return tidepool.logAppError(stringifyData(error), message, stringifyData(properties));
};

module.exports = api;
