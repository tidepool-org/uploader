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

/* global describe, it */

var expect = require('salinity').expect;

var builder = require('../lib/objectBuilder')();
var TZOUtil = require('../lib/TimezoneOffsetUtil');

var common = require('../lib/commonSimulations');

describe('commonSimulations.js', function(){

  describe('finalScheduledBasal', function(){
    it('fabricates from two schedule segments', function(){
      var basal = builder.makeScheduledBasal()
        .with_deviceTime('2015-11-05T17:36:39')
        .with_time('2015-11-05T17:36:39.000Z')
        .with_rate(0.3)
        .with_scheduleName('Test')
        .with_conversionOffset(0)
        .with_timezoneOffset(0);
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
      var finalBasal = common.finalScheduledBasal(basal, settings, 'tandem');
      expect(finalBasal.annotations[0].code).to.equal('tandem/basal/fabricated-from-schedule');
      expect(finalBasal.duration).to.equal(1000);
    });
    it('fabricates from only one schedule segment', function(){
      //TODO: 864e5 - millisInDay
    });

    //TODO: off-schedule-rate
    //TODO: basal/unknown-duration if no schedule
  });
});
