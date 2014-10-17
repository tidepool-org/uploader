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

var sundial = require('sundial');

var parsing = require('./parsing.js');

var CARELINK_TS_FORMAT = 'MM/DD/YY HH:mm:ss';

exports.makeCommonVals = function(timezone){
  return function (line) {
    var timestamp = line['Timestamp'];
    var deviceTime = sundial.parseFormat(timestamp, CARELINK_TS_FORMAT);
    var time = sundial.parseFormat(timestamp, CARELINK_TS_FORMAT, timezone);
    return {
      deviceTime: deviceTime.format('YYYY-MM-DDTHH:mm:ss'),
      time: time.toISOString(),
      timezoneOffset: (deviceTime.valueOf() - time.valueOf()) / 60000,
      deviceId: line['Raw-Device Type']
    };
  };
};


exports.makeParser = function (specs) {
  var retVal = parsing.parserBuilder();

  Object.keys(specs).forEach(function (key) {
    retVal.whenFieldIs('Raw-Type', key).applyConversion(specs[key]);
  });

  return retVal.build();
};

