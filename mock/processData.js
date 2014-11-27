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
var async = require('async');

var fakeProgress = [
  {name: 'setup', value: 5},
  {name: 'connect', value: 10},
  {name: 'getConfigInfo', value: 20},
  {name: 'fetchData', value: 24},
  {name: 'fetchData', value: 32},
  {name: 'fetchData', value: 44},
  {name: 'fetchData', value: 50},
  {name: 'processData', value: 55},
  {name: 'processData', value: 60},
  {name: 'uploadData', value: 64},
  {name: 'uploadData', value: 67},
  {name: 'uploadData', value: 72},
  // DEBUG: uncomment to produce upload error
  // {name: 'uploadData', value: 73, error: {}},
  {name: 'uploadData', value: 78},
  {name: 'uploadData', value: 81},
  {name: 'uploadData', value: 85},
  {name: 'uploadData', value: 90},
  {name: 'disconnect', value: 95},
  {name: 'cleanup', value: 100}
];

var processData = function(progress, cb) {
  var fns = _.map(fakeProgress, function(step) {
    return function(cb) {
      setTimeout(function() {
        progress(step.name, step.value);
        if (step.error) {
          return cb(step.error);
        }
        return cb();
      }, 200);
    };
  });

  async.series(fns, cb);
};

module.exports = processData;
