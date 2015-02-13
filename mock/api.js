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
var localStore = require('../lib/core/localStore');

var AUTH_TOKEN = '123';
var PASSWORD = 'demo';
var data = {
  user: {
    userid: '11',
    username: 'demo',
    emails: ['mary.smith@example.com'],
    profile: {
      fullName: 'Mary Smith',
      patient: {
        birthday: '1987-03-08',
        diagnosisDate: '1994-02-01',
        about: 'Favorite color is orange.'
      }
    }
  }
};

var patch = function(api) {

  api._data = data;

  api.init = function(options, cb) {
    setTimeout(function() {
      if (localStore.getItem('authToken') === AUTH_TOKEN) {
        return cb(null, {token: AUTH_TOKEN});
      }
      return cb();
    }, 500);
  };

  // ----- User -----

  api.user.login = function(user, options, cb) {
    api.log('[mock] POST /auth/login');

    setTimeout(function() {
      if (user.username !== data.user.username ||
          user.password !== PASSWORD) {
        return cb({status: 401, body: 'Wrong username or password'});
      }

      if (options.remember) {
        localStore.setItem('authToken', AUTH_TOKEN);
      }

      cb(null, {
        userid: data.user.userid,
        user: _.omit(data.user, 'profile')
      });
    }, 700);
  };

  api.user.account = function(cb) {
    api.log('[mock] GET /auth/user');

    setTimeout(function() {
      cb(null, _.omit(data.user, 'profile'));
    }, 0);
  };

  api.user.profile = function(cb) {
    api.log('[mock] GET /metadata/' + data.user.userid + '/profile');

    setTimeout(function() {
      cb(null, _.cloneDeep(data.user.profile));
    }, 0);
  };

  api.user.logout = function(cb) {
    api.log('[mock] POST /auth/logout');

    setTimeout(function() {
      localStore.removeItem('authToken');
      cb();
    }, 700);
  };

  api.user.getUploadGroups = function(cb) {
    api.log('GET /access/groups/' + data.user.userid);

    //todo: set this object in data and check its format
    setTimeout(function() {
      var users = [
        data.user
        ,{
          userid: 3123412,
          profile: {fullName: 'Peter Petersen'},
          permissions: {
            view: {}
          }
        },{
          userid: 2341234,
          profile: {fullName: 'Peter Petersen'},
          permissions: {
            upload: {},
            view: {}
          }
        }
      ];

      cb(null, users);
    }, 0);
  };

  // ----- Upload -----
  api.upload.fetchCarelinkData = function(payload, cb) {
    api.log('[mock] POST /carelink');

    setTimeout(function() {
      cb(null, 'Carelink CSV file contents');
    }, 1400);
  };

  // ----- Metrics -----

  api.metrics.track = function(eventName, properties) {
    api.log('[mock] GET /metrics/' + window.encodeURIComponent(eventName));
  };

  // ----- Errors -----

  api.errors.log = function(error, message, properties) {
    api.log('[mock] POST /errors');
  };

  return api;
};

module.exports = patch;
