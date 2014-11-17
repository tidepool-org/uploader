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

/* global chrome */

'use strict';
module.exports = function () {
  var _ = require('lodash');
  var inMemoryStore = {};
  // wrap chrome.storage.local instance so that it remains consistent with the defined interface
  // see http://dev.w3.org/html5/webstorage/#storage-0
  return {
    init:  function(data,cb){
      chrome.storage.local.get(data, function (result) {
        inMemoryStore = result;
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
        chrome.storage.local.set(data);
        return;
      }
      inMemoryStore[key] = data;
      chrome.storage.local.set({key:data});
    },
    removeItem:function(key){
      delete inMemoryStore[key];
      chrome.storage.local.remove(key);
    }
  };
};
