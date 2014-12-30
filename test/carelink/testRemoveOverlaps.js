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

/* global describe, it */

var _ = require('lodash');
var csv = require('babyparse');
var fs = require('fs');
var util = require('util');

var expect = require('salinity').expect;
var sundial = require('sundial');

var removeOverlaps = require('../../lib/carelink/removeOverlapping');
var CARELINK_TS_FORMAT = 'MM/DD/YY HH:mm:ss';

describe('removeOverlapping', function() {
  function convertRawValues(e) {
    var RAW_VALUES = e['Raw-Values'];
    if (RAW_VALUES == null || RAW_VALUES === '') {
      e['Raw-Values'] = null;
      return e;
    }

    var rawVals = {};
    var keyValSplits = RAW_VALUES.split(',');
    for (var i = 0; i < keyValSplits.length; ++i) {
      var keyVal = keyValSplits[i].trim().split('=');
      if (keyVal.length !== 2) {
        throw new Error(util.format('keyVal didn\'t split on \'=\' well[%s], input was[%j]', keyValSplits[i], e));
      }
      rawVals[keyVal[0]] = keyVal[1];
    }

    e['Raw-Values'] = rawVals;
    return e;
  }

  it('should not find overlaps on a file without overlaps', function() {
    var input = fs.readFileSync(__dirname + '/overlaps/no-overlap.csv', {encoding: 'utf8'}), payload = {};
    var endOfPreamble = input.indexOf('Index');
    // Setup the preamble to have everything up to the header line
    payload.preamble = csv.parse(input.substr(0, endOfPreamble), {});
    // Store the rest of the data
    payload.theData = csv.parse(input.substr(endOfPreamble), {
      header: true,
      dynamicTyping: true
    }).data;

    for (var i = 0; i < payload.theData.length; ++i) {
      convertRawValues(payload.theData[i]);
      payload.theData[i].deviceTime = sundial.parseAndApplyTimezone(payload.theData[i]['Timestamp'], CARELINK_TS_FORMAT);
    }

    expect(Object.keys(removeOverlaps(payload))).deep.equals(['53602018', '53602076']);
  });

  it('should keep latest of two overapping uploads in file', function() {
    var input = fs.readFileSync(__dirname + '/overlaps/overlap.csv', {encoding: 'utf8'}), payload = {};
    var endOfPreamble = input.indexOf('Index');
    // Setup the preamble to have everything up to the header line
    payload.preamble = csv.parse(input.substr(0, endOfPreamble), {});
    // Store the rest of the data
    payload.theData = csv.parse(input.substr(endOfPreamble), {
      header: true,
      dynamicTyping: true
    }).data;

    for (var i = 0; i < payload.theData.length; ++i) {
      convertRawValues(payload.theData[i]);
      payload.theData[i].deviceTime = sundial.parseAndApplyTimezone(payload.theData[i]['Timestamp'], CARELINK_TS_FORMAT);
    }

    expect(Object.keys(removeOverlaps(payload))).deep.equals(['53602076']);
  });
});