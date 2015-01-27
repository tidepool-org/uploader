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

/* global beforeEach, describe, it */

var _ = require('lodash');
var expect = require('salinity').expect;

var pwdSimulator = require('../../lib/insulet/insuletSimulator.js');

describe('insuletSimulator.js', function() {
  var simulator = null;

  beforeEach(function(){
    simulator = pwdSimulator.make();
  });

  describe('smbg', function(){
    it('passes through', function(){
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        deviceId: 'InsOmn1234',
        units: 'mg/dL',
        type: 'smbg',
        value: 1.3
      };

      simulator.smbg(val);
      expect(simulator.getEvents()).deep.equals([val]);
    });
  });

  describe('bolus', function(){
    describe('normal', function() {
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        deviceId: 'InsOmn1234',
        normal: 1.3,
        type: 'bolus',
        subType: 'normal'
      };

      it('passes through', function(){
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });

      it('is amended with an expectedNormal when followed by a bolus termination event', function(){
        var term = {
          time: '2014-09-25T01:00:05.000Z',
          type: 'termination',
          subType: 'bolus',
          missedInsulin: 2.7,
          durationLeft: 0
        };

        simulator.bolus(val);
        simulator.bolusTermination(term);
        expect(simulator.getEvents()).deep.equals([_.assign({}, val, {expectedNormal: 4.0})]);
      });
    });

    describe('square', function(){
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        deviceId: 'InsOmn1234',
        extended: 1.4,
        duration: 1800000,
        type: 'bolus',
        subType: 'square'
      };

      it('passes through', function(){
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });

      it('is amended with expectedExtended and expectedDuration when followed by a bolus termination', function(){
        var term = {
          time: '2014-09-25T01:30:00.000Z',
          type: 'termination',
          subType: 'bolus',
          missedInsulin: 1.4,
          durationLeft: 1800000
        };

        simulator.bolus(val);
        simulator.bolusTermination(term);
        expect(simulator.getEvents()).deep.equals([_.assign({}, val, {expectedExtended: 2.8, expectedDuration: 3600000})]);
      });
    });

    describe('dual', function(){
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        deviceId: 'InsOmn1234',
        normal: 1.3,
        extended: 1.4,
        duration: 0,
        type: 'bolus',
        subType: 'dual/square'
      };
      it('passes through', function(){
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });

      it('is amended with an expectedNormal, expectedExtended, and expectedDuration when two bolus terminations follow (interrupted during up-front delivery)', function(){
        var term1 = {
          time: '2014-09-25T01:00:05.000Z',
          type: 'termination',
          subType: 'bolus',
          missedInsulin: 2.7,
          durationLeft: 0
        };
        var term2 = {
          time: '2014-09-25T01:00:05.000Z',
          type: 'termination',
          subType: 'bolus',
          missedInsulin: 1.4,
          durationLeft: 3600000
        };

        simulator.bolus(val);
        simulator.bolusTermination(term1);
        simulator.bolusTermination(term2);
        expect(simulator.getEvents()).deep.equals([_.assign({}, val, {expectedNormal: 4.0, expectedExtended: 2.8, expectedDuration: 3600000})]);
      });
    });
  });
});