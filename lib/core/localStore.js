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

var localStore = null;
var ourStore = null;

var isBrowser = typeof window !== 'undefined';
var isChromeApp = (typeof chrome !== 'undefined' && !!chrome.storage);

if (isChromeApp) {
  ourStore = chrome.storage.local;
}
else if (isBrowser) {
  ourStore = window.localStorage;
}

if (ourStore) {
  localStore = require('./storage')({
    isChromeApp: isChromeApp,
    ourStore: ourStore
  });
  localStore.getInitialState = function() {
    return {
      authToken: null,
      devices: null
    };
  };
}

// for testing and cli tools, we don't have either case, so we return a dummy object
if (!isBrowser && typeof chrome === 'undefined') {
  localStore = function(initialState) {
    initialState = initialState || {};

    var store = _.assign({}, initialState);

    return {
      init: function(options, cb) { cb(); },
      getInitialState: function() {},
      getItem: function(attr) {
        return store[attr];
      },
      setItem: function(obj) {
        store = _.assign(store, obj);
      },
      removeItem: function(attr) {
        store = _.omit(store, [attr]);
      },
      getAllKeys: function(cb){
        if(cb) { cb(_.keys(store)); }
        return _.keys(store);
      }
    };
  };
}

module.exports = localStore;
