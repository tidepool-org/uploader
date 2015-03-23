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
      expect(typeof common.isSuspectedNewDevice).to.equal('function');
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

    it('should not return true on a settings object with more than just units', function() {
      var notEmptyObj = {
        'activeSchedule': 'foo',
        'basalSchedules': {
            'pattern a': [],
            'pattern b': [],
            'standard': []
        },
        'bgTarget': [{low: 80, high: 120, start: 0}],
        'carbRatio': [],
        'deviceId': 'Test',
        'deviceTime': '2014-01-01T00:00:00',
        'id': 'abcdef',
        'insulinSensitivity': [],
        'time': '2014-01-01T00:00:00.000Z',
        'timezoneOffset': 0,
        'type': 'settings',
        'units': {
            'bg': 'mg/dL',
            'carb': 'grams'
        }
      };
      expect(common.isSuspectedNewDevice(notEmptyObj)).to.be.false;
    });
  });

  describe('isMgDL', function() {
    it('should be a function', function() {
      expect(common.isMgDL).to.exist;
      expect(typeof common.isMgDL).to.equal('function');
    });

    it('should return true on `mg/dL`', function() {
      expect(common.isMgDL('mg/dL')).to.be.true;
    });

    it('should return false on `mmol/L`', function() {
      expect(common.isMgDL('mmol/L')).to.be.false;
    });

    it('should throw an error on `foo`', function() {
      var fn = function() { common.isMgDL('foo'); };
      expect(fn).to.throw(Error);
    });
  });

  describe('convertBackToMmol', function() {
    it('should be a function', function() {
      expect(common.convertBackToMmol).to.exist;
      expect(typeof common.convertBackToMmol).to.equal('function');
    });

    it('should return a floating-point number with one significant digit', function() {
      expect(String(common.convertBackToMmol(99.08))).to.equal('5.5');
    });
  });

  describe('isValidLocalTimestamp', function() {
    it('should be a function', function() {
      expect(common.isValidLocalTimestamp).to.exist;
      expect(typeof common.isValidLocalTimestamp).to.equal('function');
    });

    it('should return true when local timestamp is not in DST no man\'s land', function() {
      var deviceTime = '2015-01-01T00:00:00';
      var utcTime = '2015-01-01T05:00:00.000Z';
      var prescribedOffset = -300;
      expect(common.isValidLocalTimestamp(deviceTime, utcTime, prescribedOffset)).to.be.true;
    });

    it('should return false when local timestamp is in DST no man\'s land', function() {
      var deviceTime = '2015-03-08T02:05:00';
      var utcTime = '2015-03-08T07:05:00.000Z';
      var prescribedOffset = -240;
      expect(common.isValidLocalTimestamp(deviceTime, utcTime, prescribedOffset)).to.be.false;
    });
  });
});