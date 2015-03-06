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

var common = require('./common.js');
var parsing = require('./parsing.js');

module.exports = function(rows, type) {
  var serials = [], multiple = false;
  var timeChanges = [];
  for (var i = 0; i < rows.length; ++i) {
    if (rows[i][0].search(type) != -1) {
      var model = rows[i][1].replace(' -', '');
      var serial = rows[i][2].replace('#', '');
      serials.push({
        deviceModel: model,
        deviceSerialNumber: serial
      });
      var match = rows[i][3].match(/Time Changes: (\d+)/);
      if (match !== null) {
        timeChanges.push({
          deviceSerialNumber: serial,
          numTimeChanges: parseInt(match[1], 10)
        });
      }
    } 
  }

  if (serials.length > 1) {
    multiple = true;
  }
  return {
    getDeviceModel: function() {
      if (serials.length === 1) {
        return serials[0].deviceModel;
      }
      else if (serials.length > 1) {
        return 'multiple';
      }
      else {
        throw new Error('No devices! Cannot retrieve deviceModel :(');
      }
    },
    getDeviceSerialNumber: function() {
      if (serials.length === 1) {
        return serials[0].deviceSerialNumber;
      }
      else if (serials.length > 1) {
        return 'multiple';
      }
      else {
        throw new Error('No devices! Cannot retrieve deviceSerialNumber :(');
      }
    },
    hasMultiple: function() { return multiple; },
    getPayload: function() { return {devices: serials}; },
    getNumTimeChangesPerSN: function() {
      return timeChanges;
    },
    hasTimeChanges: function() {
      return !_.isEmpty(timeChanges);
    }
  };
};
