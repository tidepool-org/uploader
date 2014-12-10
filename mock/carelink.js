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

var processData = require('./processData');

var data = {
  // Records uploaded from CareLink file
  records: _.map(_.range(234), function(i) { return {id: i.toString()}; })
};

var patch = function(carelink) {

  carelink._data = data;

  carelink.init = function(options, cb) {
    setTimeout(function() {
      return cb();
    }, 0);
  };

  carelink.upload = function(rawData, options, cb) {
    var progress = options.progress || _.noop;

    processData(progress, function(err) {
      if (err) {
        cb(err);
      }
      return cb(null, data.records);
    });
  };

  return carelink;
};

module.exports = patch;
