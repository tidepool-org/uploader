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

/* global chrome */

var _ = require('lodash');
var async = require('async');
var md5 = require('blueimp-md5');
// sometimes we load this into node and this routine behaves differently
if (md5.md5) {
  md5 = md5.md5;
}

var isChromeApp = (typeof chrome !== 'undefined');
var bows = require('../bows');
var log = isChromeApp ? bows('Api') : console.log;
var builder = require('../objectBuilder')();
var localStore = require('./localStore');

// for cli tools running in node
if (typeof localStore === 'function') {
  localStore = localStore({});
}

// Wrapper around the Tidepool client library
var createTidepoolClient = require('tidepool-platform-client');
var tidepool;

var api = {
  log: log
};

// ----- Api Setup -----

api.init = function(options, cb) {
  var tidepoolLog = isChromeApp ? bows('Tidepool') : console.log;
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

// ----- Config -----
api.setHosts = function(hosts) {
  if (hosts.API_URL) {
    tidepool.setApiHost(hosts.API_URL);
  }
  if (hosts.UPLOAD_URL) {
    tidepool.setUploadHost(hosts.UPLOAD_URL);
  }
  if (hosts.BLIP_URL) {
    tidepool.setBlipHost(hosts.BLIP_URL);
  }
};

api.makeBlipUrl = function(tail) {
  return tidepool.makeBlipUrl(tail);
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

api.user.getUploadGroups = function(cb) {
  var userId = tidepool.getUserId();

  api.log('GET /access/groups/' + userId);

  tidepool.getUploadGroups(userId, function(err, groups) {
    if (err) {
      return cb(err);
    }

    var asyncProfileSearchTasks = [];
    var uploadGroups = [];

    for(var id in groups) {
      var group = groups[id];

      var find = (function(_id) {
        return function(callback) {
          tidepool.findProfile(_id, function(err, profile) {
            if (err) {
              callback(err);
            }

            uploadGroups.push({
              userid: _id,
              profile: profile
            });

            callback();
          });
        };
      })(id);

      asyncProfileSearchTasks.push(find);
    }

    if(!asyncProfileSearchTasks.length) {
      return cb(null, []);
    }

    async.parallel(asyncProfileSearchTasks, function(){
      var sortedGroups = _.sortBy(uploadGroups, function(group) { return group.userid === userId; });

      return cb(null, sortedGroups);
    });
  });
};

// ----- Upload -----

api.upload = {};

api.upload.accounts = function(happyCb, sadCb) {
  api.log('GET /access/groups/'+tidepool.getUserId());
  tidepool.getViewableUsers(tidepool.getUserId(),function(err, data) {
    if(err){
      return sadCb(err,err);
    }
    return happyCb(data, 'upload accounts found');
  });
};

function postBlockToPlatform(data, groupId, callback) {

  var recCount = data.length;
  var happy = function () {
    callback(null, recCount);
  };

  var sad = function (jqxhr, status, err) {
    api.log('postBlockToPlatform: checking failure details');
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
      api.log('platform data post failed.');
      api.log(status);
      callback(status);
    }
  };

  api.log('postBlockToPlatform: using id ', groupId);

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

  var blocks = [];
  var BLOCKSIZE = 100;
  var nblocks = 0;

  var post_and_progress = function (data, callback) {
    progress(nblocks++ * 100.0 / blocks.length);
    //off to the platfrom we go
    return postBlockToPlatform(data, groupId, callback);
  };

  var post_upload_meta = function (uploadMeta, callback) {
    return postBlockToPlatform(uploadMeta, groupId, callback);
  };

  var decorate_uploadid = function (data, uploadItem) {
    var deviceRecords = _.map(data, function(item) {
      return _.extend({}, item, {uploadId: uploadItem.uploadId});
    });
    return deviceRecords;
  };

  async.waterfall([
    function(callback) {
      //generate and post the upload metadata
      var uploadId = 'upid_' + md5(sessionInfo.deviceId + '_' + sessionInfo.start).slice(0, 12);

      var uploadItem = builder.makeUpload()
        .with_time(sessionInfo.start)
        .with_timezone(sessionInfo.tzName)
        .with_version(sessionInfo.version)
        .with_uploadId(uploadId)
        .with_source(sessionInfo.source)
        .with_byUser(tidepool.getUserId())
        .with_deviceTags(sessionInfo.deviceTags)
        .with_deviceManufacturers(sessionInfo.deviceManufacturers)
        .with_deviceModel(sessionInfo.deviceModel)
        .with_deviceSerialNumber(sessionInfo.deviceSerialNumber)
        .with_deviceId(sessionInfo.deviceId)
        .with_payload(sessionInfo.payload)
        .done();

      api.log('saving upload metadata');

      post_upload_meta(uploadItem, function(err){
        if(_.isEmpty(err)){
          api.log('saved upload metadata');
          return callback(null, uploadItem);
        }
        api.log('error saving upload metadata ', err);
        return callback(err);
      });
    },
    function(uploadItem, callback) {
      //decotorate our data with the successfully posted upload metadata and then save to the platform
      data =  decorate_uploadid(data, uploadItem);

      for (var i = 0; i < data.length; i += BLOCKSIZE) {
        blocks.push(data.slice(i, i + BLOCKSIZE));
      }
      api.log('start uploading the rest of the data');
      //process then finalise, or if you want you can finalize :)
      async.mapSeries(blocks, post_and_progress, callback);
    }
  ], function (err, result) {
    if(_.isEmpty(err)){
      api.log('upload.toPlatform: all good');
      return cb(null, result);
    }
    api.log('upload.toPlatform: failed ',err);
    return cb(err);
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
