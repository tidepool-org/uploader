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
var expect = require('salinity').expect;

var common = require('../../lib/carelink/common');

describe('common', function() {

  describe('isSuspectedNewDevice', function() {
    it('should be a function', function() {
      expect(common.isSuspectedNewDevice).to.exist;
    });

    it('should return true on a settings object with only units', function() {
      var allButEmptyObj = {
        'activeSchedule': 'foo',
        'basalSchedules': {
            'pattern a': [],
            'pattern b': [],
            'standard': []
        },
        'bgTarget': [],
        'carbRatio': [],
        'deviceId': 'Test',
        'deviceTime': '2014-01-01T00:00:00',
        'id': 'abcdef',
        'insulinSensitivity': [],
        'source': 'carelink',
        'time': '2014-01-01T00:00:00.000Z',
        'timezoneOffset': 0,
        'type': 'settings',
        'units': {
            'bg': 'mg/dL',
            'carb': 'grams'
        }
      };
      expect(common.isSuspectedNewDevice(allButEmptyObj)).to.be.true;
    });
  });
});