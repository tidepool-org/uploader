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
var builder = require('../../lib/objectBuilder')();

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
      var term = {
        time: '2014-09-25T01:00:05.000Z',
        type: 'termination',
        subType: 'bolus',
        missedInsulin: 2.7,
        durationLeft: 0
      };

      it('passes through', function(){
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });

      it('is amended with an expectedNormal when followed by a bolus termination event', function(){
        simulator.bolus(_.cloneDeep(val));
        simulator.bolusTermination(term);
        expect(simulator.getEvents()).deep.equals([_.assign({}, val, {expectedNormal: 4.0})]);
      });

      it('is amended with an expectedNormal when followed by a bolus termination even when it has zero volume', function() {
        var zeroBolus = _.assign({}, val, {normal: 0.0});
        simulator.bolus(zeroBolus);
        simulator.bolusTermination(term);
        expect(simulator.getEvents()).deep.equals([_.assign({}, zeroBolus, {expectedNormal: 2.7})]);
      });

      it('does not pass through a zero-volume bolus that does not have an expectedNormal', function() {
        var zeroBolus = _.assign({}, val, {normal: 0.0, time: '2014-09-25T01:05:00.000Z', deviceTime: '2014-09-25T01:05:00'});
        simulator.bolus(val);
        simulator.bolus(zeroBolus);
        expect(simulator.getEvents()).deep.equals([val]);
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

  describe('wizard', function() {
    var bolus = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      timezoneOffset: 0,
      deviceId: 'InsOmn1234',
      normal: 1.3,
      type: 'bolus',
      subType: 'normal'
    };

    var val = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      timezoneOffset: 0,
      deviceId: 'InsOmn1234',
      recommended: {
        carb: 1.0,
        correction: 2.0,
        net: 3.0
      },
      bgInput: 200,
      carbInput: 15,
      insulinOnBoard: 0.2,
      insulinCarbRatio: 15,
      insulinSensitivity: 50,
      bgTarget: {
        target: 100,
        high: 120
      },
      bolus: bolus,
      units: 'mg/dL',
      type: 'wizard'
    };

    it('passes through with a bolus', function() {
      simulator.wizard(val);
      expect(simulator.getEvents()).deep.equals([val]);
    });
  });

  describe('deviceMeta', function() {
    describe('alarm', function() {
      it('passes through', function() {
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          timezoneOffset: 0,
          deviceId: 'InsOmn1234',
          type: 'deviceMeta',
          subType: 'alarm',
          alarmType: 'low_insulin'
        };

        simulator.alarm(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });

      it('throws and error without a status if `stopsDelivery` in payload', function() {
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          timezoneOffset: 0,
          deviceId: 'InsOmn1234',
          type: 'deviceMeta',
          subType: 'alarm',
          alarmType: 'occlusion',
          payload: {
            stopsDelivery: true
          }
        };

        var fn = function() { simulator.alarm(val); };
        expect(fn).to.throw(Error);
      });

      it('passes through if `stopsDelivery` in payload and `status` exists', function() {
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          timezoneOffset: 0,
          deviceId: 'InsOmn1234',
          type: 'deviceMeta',
          subType: 'alarm',
          alarmType: 'occlusion',
          payload: {
            stopsDelivery: true
          },
          status: {
            time: '2014-09-25T01:00:00.000Z',
            deviceTime: '2014-09-25T01:00:00',
            timezoneOffset: 0,
            deviceId: 'InsOmn1234',
            type: 'deviceMeta',
            subType: 'status',
            status: 'suspended'
          }
        };

        simulator.alarm(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });

    describe('changeReservoir', function() {
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        deviceId: 'InsOmn1234',
        type: 'deviceMeta',
        subType: 'reservoirChange'
      };

      it('passes through with a status', function() {
        var suspend = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          timezoneOffset: 0,
          deviceId: 'InsOmn1234',
          type: 'deviceMeta',
          subType: 'status',
          status: 'suspended',
          reason: 'manual'
        };

        var withStatus = _.assign({}, val, {status: suspend});
        simulator.changeReservoir(withStatus);
        expect(simulator.getEvents()).deep.equals([withStatus]);
      });

      it('throws an error without a status', function() {
        var fn = function() { simulator.changeReservoir(val); };
        expect(fn).to.throw(Error);
      });
    });

    describe('status', function() {
      var suspend = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        deviceId: 'InsOmn1234',
        type: 'deviceMeta',
        subType: 'status',
        status: 'suspended',
        reason: 'automatic'
      };
      var resume = builder.makeDeviceMetaResume()
        .with_time('2014-09-25T02:00:00.000Z')
        .with_deviceTime('2014-09-25T02:00:00')
        .with_timezoneOffset(0)
        .with_status('resumed')
        .with_reason('manual');
      var expectedResume = _.cloneDeep(resume);
      expectedResume = expectedResume.with_previous(suspend).done();

      it('a suspend passes through', function() {
        simulator.suspend(suspend);
        expect(simulator.getEvents()).deep.equals([suspend]);
      });

      it('a resume passes through', function() {
        simulator.resume(resume);
        expect(simulator.getEvents()).deep.equals([resume]);
      });

      it('a resume includes a previous when preceded by a suspend', function() {
        simulator.suspend(suspend);
        simulator.resume(resume);
        expect(simulator.getEvents()).deep.equals([suspend, expectedResume]);
      });

      it('uses the timestamp of the first suspend if multiple suspends appear before a single resume', function() {
        var suspend2 = {
          time: '2014-09-25T01:05:00.000Z',
          deviceTime: '2014-09-25T01:05:00',
          timezoneOffset: 0,
          deviceId: 'InsOmn1234',
          type: 'deviceMeta',
          subType: 'status',
          status: 'suspended',
          reason: 'automatic'
        };
        simulator.suspend(suspend);
        simulator.suspend(suspend2);
        simulator.resume(resume);
        expect(simulator.getEvents()).deep.equals([suspend, expectedResume]);
      });
    });
  });

  describe('settings', function() {
    var settings = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      activeSchedule: 'billy',
      units: { 'bg': 'mg/dL' },
      basalSchedules: {
        'billy': [
          { start: 0, rate: 1.0 },
          { start: 21600000, rate: 1.1 },
          { start: 43200000, rate: 1.2 },
          { start: 64800000, rate: 1.3 }
        ],
        'bob': [
          { start: 0, rate: 0.0}
        ]
      },
      timezoneOffset: 0
    };

    it('passes through', function() {
      simulator.settings(settings);
      expect(simulator.getEvents()).deep.equals([settings]);
    });
  });
});