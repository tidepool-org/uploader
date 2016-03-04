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

var pwdSimulator = require('../../../lib/animas/animasSimulator.js');
var builder = require('../../../lib/objectBuilder')();

describe('animasSimulator.js', function() {
  var simulator = null;

  beforeEach(function(){
    simulator = pwdSimulator.make();
  });

  describe('smbg', function(){

    var manual = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      timezoneOffset: 0,
      conversionOffset: 0,
      deviceId: 'animas12345',
      units: 'mg/dL',
      type: 'smbg',
      subType: 'manual',
      value: 1.3
    };

    var linked = {
      time: '2014-09-25T01:08:00.000Z',
      deviceTime: '2014-09-25T01:08:00',
      timezoneOffset: 0,
      conversionOffset: 0,
      deviceId: 'animas12345',
      units: 'mg/dL',
      type: 'smbg',
      subType:'linked',
      value: 1.3
    };

    it('passes through', function(){
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'animas12345',
        units: 'mg/dL',
        type: 'smbg',
        value: 1.3
      };

      simulator.smbg(val);
      expect(simulator.getEvents()).deep.equals([val]);
    });

    it('drops manual if same value linked within 15 minutes', function(){
      simulator.smbg(linked);
      simulator.smbg(manual);
      expect(simulator.getEvents()).deep.equals([linked]);
    });

    it('does not drop duplicate linked values', function(){
      simulator.smbg(linked);
      simulator.smbg(linked);
      expect(simulator.getEvents()).deep.equals([linked, linked]);
    });
  });

  describe('bolus', function(){
    describe('normal', function() {
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'animas12345',
        normal: 1.3,
        type: 'bolus',
        subType: 'normal'
      };

      it('passes through', function(){
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
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
        conversionOffset: 0,
        deviceId: 'animas12345',
        extended: 1.4,
        duration: 1800000,
        type: 'bolus',
        subType: 'square'
      };

      it('passes through', function(){
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });

    describe('dual', function(){
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'animas12345',
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
    });
  });

  describe('wizard', function() {
    var bolus = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      timezoneOffset: 0,
      conversionOffset: 0,
      deviceId: 'animas12345',
      normal: 1.3,
      type: 'bolus',
      subType: 'normal'
    };

    var val = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      timezoneOffset: 0,
      conversionOffset: 0,
      deviceId: 'animas12345',
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
        range: 15
      },
      bolus: bolus,
      units: 'mg/dL',
      type: 'wizard'
    };

    it('passes through with a bolus', function() {
      simulator.wizard(val);
      expect(simulator.getEvents()).deep.equals([val]);
    });

    it('does not pass through a zero-volume wizard bolus', function() {
      var zeroWizard = _.assign({}, bolus, {normal: 0.0});
      simulator.bolus(val);
      simulator.bolus(zeroWizard);
      expect(simulator.getEvents()).deep.equals([val]);
    });
  });

  describe('deviceEvent', function() {
    describe('alarm', function() {
      it('passes through', function() {
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          timezoneOffset: 0,
          conversionOffset: 0,
          deviceId: 'animas12345',
          type: 'deviceEvent',
          subType: 'alarm',
          alarmType: 'low_insulin'
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
        conversionOffset: 0,
        deviceId: 'animas12345',
        type: 'deviceEvent',
        subType: 'reservoirChange'
      };

      it('passes through', function() {
        simulator.changeReservoir(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });

    describe('status', function() {
      var suspend = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'animas12345',
        type: 'deviceEvent',
        subType: 'status',
        status: 'suspended',
        reason: {suspended: 'automatic'}
      };
      var resume = builder.makeDeviceEventResume()
        .with_time('2014-09-25T02:00:00.000Z')
        .with_deviceTime('2014-09-25T02:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_status('resumed')
        .with_reason({resumed: 'manual'});

      it('a suspend passes through', function() {
        simulator.suspend(suspend);
        expect(simulator.getCrudEvents()).deep.equals([suspend]);
      });

      it('a resume passes through', function() {
        simulator.resume(resume);
        expect(simulator.getCrudEvents()).deep.equals([resume.done()]);
      });

      it('uses the timestamp of the first suspend if multiple suspends appear before a single resume', function() {
        var suspend2 = {
          time: '2014-09-25T01:05:00.000Z',
          deviceTime: '2014-09-25T01:05:00',
          timezoneOffset: 0,
          conversionOffset: 0,
          deviceId: 'animas12345',
          type: 'deviceEvent',
          subType: 'status',
          status: 'suspended',
          reason: {suspended: 'automatic'}
        };
        simulator.suspend(suspend);
        simulator.suspend(suspend2);
        simulator.resume(resume);
        expect(simulator.getCrudEvents()).deep.equals([suspend, resume.done()]);
      });
    });
  });

  /* TODO:
  describe('settings', function() {
    var settings = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      activeSchedule: 'billy',
      units: { 'bg': 'mg/dL' },
      basalSchedules: {
        'billy': [
          { start: 0, rate: 1.0 },
          { start: 21600000, rate: 1.1 }
        ],
        'bob': [
          { start: 0, rate: 0.0}
        ]
      },
      carbSchedules: {
        'billy': [
          { start: 0, amount: 1.0 },
          { start: 21600000, amount: 1.1 }
        ],
        'bob': [
          { start: 0, amount: 0.0}
        ]
      },
      sensitivitySchedules: {
        'billy': [
          { start: 0, amount: 1.0 },
          { start: 21600000, amount: 1.1 }
        ],
        'bob': [
          { start: 0, amount: 0.0}
        ]
      },
      targetSchedules: {
        'billy': [
          { start: 0, target: 100 },
          { start: 21600000, target: 110 }
        ],
        'bob': [
          { start: 0, target: 105}
        ]
      },
      timezoneOffset: 0,
      conversionOffset: 0
    };

    it('passes through', function() {
      simulator.pumpSettings(settings);
      expect(simulator.getEvents()).deep.equals([settings]);
    });

  });
  */

  describe('basal', function() {
    var basal1 = builder.makeScheduledBasal()
      .with_time('2014-09-25T02:00:00.000Z')
      .with_deviceTime('2014-09-25T02:00:00')
      .with_timezoneOffset(0)
      .with_conversionOffset(0)
      .with_scheduleName('Alice')
      .with_rate(0.75);
    var basal2 = builder.makeScheduledBasal()
      .with_time('2014-09-25T03:00:00.000Z')
      .with_deviceTime('2014-09-25T03:00:00')
      .with_timezoneOffset(0)
      .with_conversionOffset(0)
      .with_scheduleName('Alice')
      .with_rate(0.85);
    var basal3 = builder.makeScheduledBasal()
      .with_time('2014-09-25T03:30:00.000Z')
      .with_deviceTime('2014-09-25T03:30:00')
      .with_timezoneOffset(0)
      .with_conversionOffset(0)
      .with_scheduleName('Alice')
      .with_rate(0.90);

    it('sets duration using a following basal', function() {
      var expectedFirstBasal = _.cloneDeep(basal1);
      expectedFirstBasal = expectedFirstBasal.set('duration', 3600000).done();
      simulator.basal(basal1);
      simulator.basal(basal2);
      expect(simulator.getCrudEvents()).deep.equals([expectedFirstBasal]);
    });

    it('temp basal', function() {
      var suppressed = builder.makeScheduledBasal()
        .with_time('2014-09-25T18:05:00.000Z')
        .with_deviceTime('2014-09-25T18:05:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3)
        .with_duration(2000000);
      var tempBasal = builder.makeTempBasal()
        .with_time('2014-09-25T18:10:00.000Z')
        .with_deviceTime('2014-09-25T18:10:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_duration(1800000)
        .with_rate(1.0);
      var basal2 = builder.makeScheduledBasal()
        .with_time('2014-09-25T18:40:00.000Z')
        .with_deviceTime('2014-09-25T18:40:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(2)
        .with_duration(1800000);

      var expectedTempBasal = tempBasal.with_payload({duration:1500000}).done();

      simulator.basal(suppressed);
      simulator.basal(tempBasal);
      simulator.basal(basal2);
      expect(simulator.getCrudEvents()).deep.equals([
        suppressed.done(),
        expectedTempBasal
      ]);
    });

    it('temp basal crossing multiple segments', function() {
      var suppressed = builder.makeScheduledBasal()
        .with_time('2014-09-25T18:00:00.000Z')
        .with_deviceTime('2014-09-25T18:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_duration(180000)
        .with_rate(1.3);
      var tempBasal = builder.makeTempBasal()
        .with_time('2014-09-25T18:15:00.000Z')
        .with_deviceTime('2014-09-25T18:15:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0);
      var tempBasal2 = builder.makeTempBasal()
        .with_time('2014-09-25T18:30:00.000Z')
        .with_deviceTime('2014-09-25T18:30:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0);
      var basal3 = builder.makeScheduledBasal()
        .with_time('2014-09-25T19:00:00.000Z')
        .with_deviceTime('2014-09-25T19:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(2);

      var expectedTempBasal = tempBasal.with_payload({duration:1800000})
                                        .with_duration(900000)
                                        .done();
      var expectedTempBasal2 = tempBasal2.with_payload({duration:1800000})
                                        .with_duration(900000)
                                        .done();

      simulator.basal(suppressed);
      simulator.basal(tempBasal);
      simulator.basal(tempBasal2);
      simulator.basal(basal3);
      expect(simulator.getCrudEvents()).deep.equals([
        suppressed.done(),
        expectedTempBasal,
        expectedTempBasal2
      ]);
    });

    it('ignore duplicate suspended basals', function() {

      var basal = builder.makeScheduledBasal()
        .with_time('2014-09-25T15:00:00.000Z')
        .with_deviceTime('2014-09-25T15:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3);

      var suspend = builder.makeSuspendBasal()
        .with_time('2014-09-25T18:00:00.000Z')
        .with_deviceTime('2014-09-25T18:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0);

      var duplicateSuspend = builder.makeSuspendBasal()
        .with_time('2014-09-25T18:00:00.000Z')
        .with_deviceTime('2014-09-25T18:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0);

      var basal2 = builder.makeScheduledBasal()
        .with_time('2014-09-25T18:30:00.000Z')
        .with_deviceTime('2014-09-25T18:30:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3);

      simulator.basal(basal);
      simulator.basal(suspend);
      simulator.basal(duplicateSuspend);
      simulator.basal(basal2);

      var expectedSuspend = suspend.set('duration', 1800000).done();

      expect(simulator.getCrudEvents()).deep.equals([basal.done(),expectedSuspend]);
    });
  });
});
