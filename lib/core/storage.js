// == BSD2 LICENSE ==
// Copyright (c) 2014, Tidepool Project
//
// This program is free software; you can redistribute it and/or modify it under
// the terms of the associated License, which is identical to the BSD 2-Clause
// License as published by the Open Source Initiative at opensource.org.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the License for more details.
//
// You should have received a copy of the License along with this program; if
// not, you can obtain one from Tidepool Project at tidepool.org.
// == BSD2 LICENSE ==

var _ = require('lodash');

/**
 * Create our the store we will be using
 *
 * @param {Object}  options
 * @param {Boolean} options.isChromeApp
 * @param {Object}  options.ourStore the storage system we are using
 */
module.exports = function (options) {

  // Version that runs in browser
  if (options.isChromeApp === false && _.isEmpty(options.ourStore) === false) {
    return {
      init: function(data, cb) {
        var result = _.reduce(data, function(result, defaultValue, key) {
          var value = options.ourStore.getItem(key);
          if (value == null) {
            value = defaultValue;
          }
          result[key] = value;
          return result;
        }, {});
        cb(result);
      },
      getItem: options.ourStore.getItem.bind(options.ourStore),
      setItem: options.ourStore.setItem.bind(options.ourStore),
      removeItem: options.ourStore.removeItem.bind(options.ourStore)
    };
  }

  var inMemoryStore = {};

  // wrap chrome.storage.local instance so that it remains consistent with the defined interface
  // see http://dev.w3.org/html5/webstorage/#storage-0
  return {
    init:  function(data, cb) {
      // first, make sure our input query is an object
      var obj = data;
      if (!_.isObject(data)) {
        obj = {};
        obj[data] = null;
      }

      options.ourStore.get(obj, function (result) {
        // we may get initialized more than once, so make sure we don't blow away
        // the old version of the memoryStore.
        _.assign(inMemoryStore, result);
        return cb(result);
      });
    },
    getItem:function(key){
      if(_.isEmpty(key)){
        return;
      }
      return inMemoryStore[key];
    },
    setItem:function(key,data){
       if(_.isEmpty(key)){
        inMemoryStore = _.assign(inMemoryStore, data);
        options.ourStore.set(data);
        return;
      }
      inMemoryStore[key] = data;
      var payload = {};
      payload[key] = data;
      options.ourStore.set(payload);
    },
    removeItem:function(key){
      delete inMemoryStore[key];
      options.ourStore.remove(key);
    }
  };
};
