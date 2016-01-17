/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2016, Tidepool Project
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
var moment = require('moment'); // Moment is already a dependency of sundial
var POSSIBLE_DATE_FORMATS = ['MM/DD/YY HH:mm:ss', 'DD/MM/YY HH:mm:ss']; // The first element is the default

// We take a Moment as an argument because it's unambiguous.
module.exports = function (rows, /* moment */ dataDownloadMoment) {
  var dataExportFormat = 0;

  var dataExportedOnString;
  for (var i = 0; i < rows.length; ++i) {
    if (rows[i][0].search('Data Exported on') != -1) {
      dataExportedOnString = rows[i][1];
      break;
    }
  }

  // Now try and figure out what the date format should be, since CareLink doesn't tell us explicitly
  // Start from the second element, because the first will be the default if we don't match anyway.
  for (var j = 1; j < POSSIBLE_DATE_FORMATS.length; j++) {
    var dataExportMoment = moment(dataExportedOnString, POSSIBLE_DATE_FORMATS[j]);
    if (dataExportMoment.diff(dataDownloadMoment, 'days') === 0) {
      dataExportFormat = j;
      break;
    }
  }

  return {
    getDataExportFormat: function () {
      return POSSIBLE_DATE_FORMATS[dataExportFormat];
    }
  };
};
