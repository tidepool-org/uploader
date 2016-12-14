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

/* global beforeEach, describe, it */

var _ = require('lodash');
var expect = require('salinity').expect;

var proc = require('../../../lib/medtronic/processData.js');
var builder = require('../../../lib/objectBuilder')();
var TZOUtil = require('../../../lib/TimezoneOffsetUtil');

describe('processData.js', function() {
  var tzoUtil = new TZOUtil('GMT', '2016-12-01T00:00:00.000Z', []);
  var cfg = { builder:builder, tzoUtil: tzoUtil };
  var settings = { strokesPerUnit : 40, larger : true };

  beforeEach(function(){
    proc.init(cfg, settings);
  });

  describe('bolus', function(){

    describe('dual', function(){

      var bolus1 = {
          head: [ 1, 0, 20, 0, 1, 0, 8, 1 ],
          type: {
              value: 1,
              head_length: 8,
              name: 'BOLUS',
              date_length: 5,
              body_length: 0
          },
          date: [ 168, 234, 161, 14, 16 ],
          body: {},
          jsDate: new Date('2016-11-14T01:42:40.000Z'),
          index: 39
      };

      var bolus2 = {
        head: [ 1, 0, 20, 0, 20, 0, 8, 0 ],
        type: {
          value: 1,
          head_length: 8,
          name: 'BOLUS',
          date_length: 5,
          body_length: 0
        },
        date: [ 128, 234, 129, 14, 16 ],
        body: {},
        jsDate: new Date('2016-11-14T01:42:00.000Z'),
        index: 40
      };

      var expected = {
        time: '2016-11-14T01:42:00.000Z',
        timezoneOffset: 0,
        clockDriftOffset: 0,
        conversionOffset: 0,
        deviceTime: '2016-11-14T01:42:00',
        type: 'bolus',
        subType: 'dual/square',
        normal: 0.5,
        extended: 0.025,
        duration: 90000,
        expectedExtended: 0.5,
        expectedDuration: 1800000,
        payload: { logIndices: [40] },
        index: 40,
        jsDate: new Date('2016-11-14T01:42:00.000Z')
      };

      it('does not create two boluses when cancelled', function(){
        var result = proc.buildBolusRecords([bolus1,bolus2]);
        expect(result).deep.equals([expected]);
      });
    });
  });

});
