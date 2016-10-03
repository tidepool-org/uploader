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

var pwdSimulator = require('../../../lib/medtronic/medtronicSimulator.js');
var builder = require('../../../lib/objectBuilder')();
var TZOUtil = require('../../../lib/TimezoneOffsetUtil');

describe('medtronicSimulator.js', function() {
  var simulator = null;
  var tzoUtil = new TZOUtil('Europe/London', new Date().toISOString(), []);

  beforeEach(function(){

    simulator = pwdSimulator.make({builder:builder, tzoUtil: tzoUtil});

  });

  describe('smbg', function(){

    var manual = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      timezoneOffset: 0,
      conversionOffset: 0,
      deviceId: 'medronic12345',
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
      deviceId: 'medtronic12345',
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
        deviceId: 'medtronic12345',
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

      var expectedSecond = _.cloneDeep(linked);

      expect(simulator.getEvents()).deep.equals([linked, expectedSecond]);
    });
  });

  describe('bolus', function(){
    describe('normal', function() {
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'medtronic12345',
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
        deviceId: 'medtronic12345',
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

    var bolus, wizard, expectedWizard;
    beforeEach(function(){
      bolus = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'medtronic12345',
        normal: 1.3,
        type: 'bolus',
        subType: 'normal'
      };

      bolus.jsDate = new Date(bolus.deviceTime);

      wizard = builder.makeWizard()
        .with_time('2014-09-25T01:00:00.000Z')
        .with_deviceTime('2014-09-25T01:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_recommended({
          carb: 1.0,
          correction: 2.0,
          net: 3.0
        })
        .with_carbInput(15)
        .with_insulinOnBoard(0.2)
        .with_insulinCarbRatio(15)
        .with_insulinSensitivity(50)
        .with_bgInput(200)
        .with_bgTarget({
          low: 80,
          high: 120
        })
        .with_units('mg/dL');
      wizard.jsDate = new Date(wizard.deviceTime);

      expectedWizard = _.cloneDeep(wizard);
      delete expectedWizard.jsDate;
      expectedWizard.bolus = bolus;
    });

    it('bolus record gets added to wizard when it is first', function() {
      simulator.bolus(bolus);
      simulator.wizard(wizard);

      expect(simulator.getEvents()).deep.equals([bolus,expectedWizard.done()]);
    });

    it('bolus record gets added to wizard when it is last', function() {
      simulator.wizard(wizard);
      simulator.bolus(bolus);
      expect(simulator.getEvents()).deep.equals([expectedWizard.done(),bolus]);
    });
  });

  /*
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

  });
  */

  describe('settings', function() {
    var settings = {
      type: 'pumpSettings',
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
      carbRatio: [
          { start: 0, amount: 1.0 },
          { start: 21600000, amount: 1.1 },
          { start: 0, amount: 0.0}
      ],
      insulinSensitivity: [
          { start: 0, amount: 1.0 },
          { start: 21600000, amount: 1.1 },
          { start: 0, amount: 0.0}
      ],
      bgTarget: [
          { start: 0, target: 100, range: 15 },
          { start: 21600000, target: 110, range: 15 }
      ],
      timezoneOffset: 0,
      conversionOffset: 0
    };

    it('passes through', function() {
      simulator.pumpSettings(settings);
      expect(simulator.getEvents()).deep.equals([settings]);
    });

  });

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
      expect(simulator.getEvents()).deep.equals([expectedFirstBasal]);
    });

    it('limits duration to five days for flat-rate basals', function() {
      var basal = builder.makeScheduledBasal()
        .with_time('2014-09-01T02:00:00.000Z') // more than five days before basal1
        .with_deviceTime('2014-09-01T02:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_scheduleName('Alice')
        .with_rate(0.75);

      var expectedFirstBasal = _.cloneDeep(basal);
      expectedFirstBasal = expectedFirstBasal.set('duration', 432000000).done();
      expectedFirstBasal.annotations = [{code: 'medtronic/basal/flat-rate'}];
      simulator.basal(basal);
      simulator.basal(basal1);
      expect(simulator.getEvents()).deep.equals([expectedFirstBasal]);

    });


    it('sets suppressed info for suspended basal', function() {

      var basal = builder.makeScheduledBasal()
        .with_time('2014-09-25T01:00:00.000Z')
        .with_deviceTime('2014-09-25T01:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_scheduleName('Alice')
        .with_rate(1);

      var suspendResume = builder.makeDeviceEventSuspendResume()
        .with_time('2014-09-25T02:00:00.000Z')
        .with_deviceTime('2014-09-25T02:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_status('suspended')
        .with_duration(600000)
        .with_reason({resumed: 'automatic'})
        .done();

      var suspendedBasal = builder.makeSuspendBasal()
        .with_time('2014-09-25T02:00:00.000Z')
        .with_deviceTime('2014-09-25T02:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0);

      var basal2 = builder.makeScheduledBasal()
        .with_time('2014-09-25T03:00:00.000Z')
        .with_deviceTime('2014-09-25T03:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_scheduleName('Alice')
        .with_rate(2);

      var expectedSuspendedBasal = _.cloneDeep(suspendedBasal);
      var suppressed = {
        type: 'basal',
        deliveryType: 'scheduled',
        rate: 1
      };
      expectedSuspendedBasal.duration = 3600000;
      expectedSuspendedBasal.set('suppressed', suppressed);

      simulator.basal(basal);
      simulator.suspendResume(suspendResume);
      simulator.basal(suspendedBasal);
      simulator.basal(basal2);

      expect(simulator.getEvents()).deep.equals([
        basal.done(),
        suspendResume,
        expectedSuspendedBasal.done(),
      ]);

    });

    describe('temp basal', function() {

      var basal1 = null, tempBasal = null, basal2 = null;
      beforeEach( function() {
        basal1 = builder.makeScheduledBasal()
          .with_time('2014-09-25T17:05:00.000Z')
          .with_deviceTime('2014-09-25T18:05:00')
          .with_timezoneOffset(60)
          .with_conversionOffset(0)
          .with_rate(1.3)
          .with_duration(2000000)
          .set('index',0);
        tempBasal = builder.makeTempBasal()
          .with_time('2014-09-25T17:10:00.000Z')
          .with_deviceTime('2014-09-25T18:10:00')
          .with_timezoneOffset(60)
          .with_conversionOffset(0)
          .with_duration(1800000)
          .with_rate(1.0)
          .set('index',1);
        basal2 = builder.makeScheduledBasal()
          .with_time('2014-09-25T17:40:00.000Z')
          .with_deviceTime('2014-09-25T18:40:00')
          .with_timezoneOffset(60)
          .with_conversionOffset(0)
          .with_rate(2)
          .with_duration(1800000)
          .set('index',2);
      });

      it('adds supressed info', function() {

        var expectedTempBasal = tempBasal.set('suppressed',{
          type: 'basal',
          deliveryType: 'scheduled',
          rate: 1.3
        }).done();

        delete basal1.index;
        delete basal1.jsDate;
        delete expectedTempBasal.index;
        delete expectedTempBasal.jsDate;

        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.basal(basal2);
        expect(simulator.getEvents()).deep.equals([
          basal1.done(),
          expectedTempBasal
        ]);
      });

      it('checks for schedule change', function() {
        var settings = {
          type: 'pumpSettings',
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T02:00:00',
          timezoneOffset: 60,
          conversionOffset: 0,
          activeSchedule: 'standard',
          units: { 'bg': 'mg/dL' },
          basalSchedules: {
      			standard: [
      				{
      					start: 0,
      					rate: 0.2
      				},
      				{
      					start: 10800000,
      					rate: 0.375
      				},
      				{
      					start: 65450000,
      					rate: 0.475
      				}
			      ]
          }
        };

        tempBasal.jsDate = new Date(tempBasal.deviceTime);

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.basal(basal2);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        expectedTempBasal1.suppressed.rate = 1.3;
        expectedTempBasal1.duration = 50000;
        expectedTempBasal1.payload.duration = 1800000;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedTempBasal2 = _.cloneDeep(expectedTempBasal1);
        expectedTempBasal2.clockDriftOffset = 0;
        expectedTempBasal2.duration = 1750000;
        expectedTempBasal2.time = '2014-09-25T17:10:50.000Z';
        expectedTempBasal2.deviceTime = '2014-09-25T18:10:50';
        expectedTempBasal2.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        expectedTempBasal2.suppressed.rate = 0.475;
        delete expectedTempBasal2.payload.duration;

        delete basal1.index;
        delete basal1.jsDate;

        expect(simulator.getEvents()).deep.equals([
          settings,
          basal1.done(),
          expectedTempBasal1,
          expectedTempBasal2
        ]);
      });
    });

  });
});
