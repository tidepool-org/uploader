// Provides a service to upload a block of records to jellyfish.
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

'use strict';

var async = require('async');

module.exports = function (config) {
  var tidepoolServer = config.tidepoolServer;

  function postOne(data, callback) {
    // console.log('poster');
    var recCount = data.length;
    var happy = function (resp, status, jqxhr) {
      // console.log('Jellyfish post succeeded.');
      // console.log(status);
      // console.log(resp);
      callback(null, recCount);
    };
    var sad = function (jqxhr, status, err) {
      if (jqxhr.status == 413 && data.length > 1) { // request entity too big
        // but we can split the request and try again
        var l = Math.floor(data.length / 2);
        var d1 = data.slice(0, l);
        var d2 = data.slice(l);
        async.mapSeries([d1, d2], postOne, function (err, result) {
          if (err) {
            return callback(err, 0);
          }
          return callback(null, result[0] + result[1]);
        });
        return;
      }
      if (jqxhr.responseJSON && jqxhr.responseJSON.errorCode && jqxhr.responseJSON.errorCode == 'duplicate') {
        console.log(jqxhr.responseJSON);
        callback('duplicate', jqxhr.responseJSON.index);
      } else {
        console.log('Jellyfish post failed.');
        console.log(status);
        console.log(err);
        console.log(jqxhr.responseJSON);
        callback(jqxhr.responseJSON, 0);
      }
    };
    tidepoolServer.upload.toPlatform(data, happy, sad);
  }

  // we break up the posts because early jellyfish has a 1MB upload limit at one time
  // we're upping that limit
  function post(data, progress, callback) {
    var blocks = [];
    var BLOCKSIZE = 100;
    for (var i = 0; i < data.length; i += BLOCKSIZE) {
      blocks.push(data.slice(i, i + BLOCKSIZE));
    }
    var nblocks = 0;
    var post_and_progress = function (data, callback) {
      progress(nblocks++ * 100.0 / blocks.length);
      return postOne(data, callback);
    };
    async.mapSeries(blocks, post_and_progress, callback);
  }

  return {
    post: post
  };
};