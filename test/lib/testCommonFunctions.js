/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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


var expect = require('salinity').expect;

var builder = require('../../lib/objectBuilder')();
var TZOUtil = require('../../lib/TimezoneOffsetUtil');

var common = require('../../lib/commonFunctions');

describe('commonFunctions.js', () => {

  describe('finalScheduledBasal', () => {

    var basal;
    beforeEach(() => {
      basal = builder.makeScheduledBasal()
        .with_deviceTime('2015-11-05T17:36:39')
        .with_time('2015-11-05T17:36:39.000Z')
        .with_rate(0.3)
        .with_scheduleName('Test')
        .with_conversionOffset(0)
        .with_timezoneOffset(0);
    });

    test('fabricates final basal duration from two schedule segments', () => {
      var settings = {
        basalSchedules: {
          'Test': [
            {
              rate: 0.3,
              start: 0
            },
            {
              rate: 0.5,
              start: 63400000
            }
          ]
        }
      };
      var finalBasal = common.finalScheduledBasal(basal, settings, 'test');
      expect(finalBasal.annotations[0].code).to.equal('final-basal/fabricated-from-schedule');
      expect(finalBasal.duration).to.equal(1000);
    });

    test('fabricates final basal duration from only one schedule segment', () => {
      var settings = {
        basalSchedules: {
          'Test': [
            {
              rate: 0.3,
              start: 0
            }
          ]
        }
      };
      var finalBasal = common.finalScheduledBasal(basal,settings,'test');
      expect(finalBasal.annotations[0].code).to.equal('final-basal/fabricated-from-schedule');
      expect(finalBasal.duration).to.equal(23001000); // 864e5 - millisInDay
    });

    test('final basal has zero duration when it has an off-schedule rate', () => {
      var settings = {
        basalSchedules: {
          'Test': [
            {
              rate: 0.5,
              start: 0
            }
          ]
        }
      };
      var finalBasal = common.finalScheduledBasal(basal,settings,'test');
      // TODO: to make the following test more robust, consider using chai-things (new dependency)
      // that supports assertions on array elements, e.g.:
      // finalBasal.annotations.should.include.something.that.deep.equals({code : 'basal/unknown-duration'});
      expect(finalBasal.annotations[0].code).to.equal('test/basal/off-schedule-rate');
      expect(finalBasal.annotations[1].code).to.equal('basal/unknown-duration');
      expect(finalBasal.duration).to.equal(0);
    });

    test('final basal has zero duration if no schedule and duration found', () => {
      var settings = {
        basalSchedules: {
          'NotTest': [
            {
              rate: 0.3,
              start: 0
            }
          ]
        }
      };
      var finalBasal = common.finalScheduledBasal(basal,settings,'test');
      expect(finalBasal.annotations[0].code).to.equal('basal/unknown-duration');
      expect(finalBasal.duration).to.equal(0);
    });
  });

  describe('computeMillisInCurrentDay', () => {

    var basal;
    beforeEach(() => {
      basal = builder.makeScheduledBasal()
        .with_deviceTime('2015-11-05T17:00:00')
        .with_time('2015-11-05T17:00:00.000Z')
        .with_rate(0.3)
        .with_scheduleName('Test')
        .with_conversionOffset(0)
        .with_timezoneOffset(0);
    });

    test('returns milliseconds in current day', () => {
      expect(common.computeMillisInCurrentDay(basal)).to.equal(61200000);
    });

    test('rounds to nearest 15 minutes for clock skew', () => {
      basal.with_time('2015-11-05T17:05:00.000Z')
           .with_conversionOffset(420000);
      expect(common.computeMillisInCurrentDay(basal)).to.equal(61200000);
    });
  });

});
