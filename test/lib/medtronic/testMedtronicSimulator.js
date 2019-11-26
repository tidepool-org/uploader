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

var pwdSimulator = require('../../../lib/drivers/medtronic/medtronicSimulator.js');
var builder = require('../../../lib/objectBuilder')();
var TZOUtil = require('../../../lib/TimezoneOffsetUtil');

describe('medtronicSimulator.js', () => {
  var simulator = null;
  var tzoUtil = new TZOUtil('GMT', '2015-06-01T00:00:00.000Z', []);

  beforeEach(() => {

    simulator = pwdSimulator.make({
      builder:builder,
      tzoUtil: tzoUtil,
      settings: {
        deviceManufacturers : ['Medtronic'],
        units: {bg: 'mg/dL'},
        serialNumber: '12346',
        modelNumber: '551'
      }
    });

  });

  describe('smbg', () => {

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

    test('passes through', () => {
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

    test('drops manual if same value linked within 15 minutes', () => {
      simulator.smbg(linked);
      simulator.smbg(manual);
      expect(simulator.getEvents()).deep.equals([linked]);
    });

    test('does not drop duplicate linked values', () => {
      simulator.smbg(linked);
      simulator.smbg(linked);

      var expectedSecond = _.cloneDeep(linked);

      expect(simulator.getEvents()).deep.equals([linked, expectedSecond]);
    });
  });

  describe('bolus', () => {
    describe('normal', () => {
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

      test('passes through', () => {
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });

      test('does not pass through a zero-volume bolus that does not have an expectedNormal', () => {
        var zeroBolus = _.assign({}, val, {normal: 0.0, time: '2014-09-25T01:05:00.000Z', deviceTime: '2014-09-25T01:05:00'});
        simulator.bolus(val);
        simulator.bolus(zeroBolus);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });

    describe('square', () => {
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

      test('passes through', () => {
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });

    describe('dual', () => {
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'medtronic12345',
        normal: 1.3,
        extended: 1.4,
        duration: 0,
        type: 'bolus',
        subType: 'dual/square'
      };

      test('passes through', () => {
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });
  });

  describe('wizard', () => {

    var bolus, wizard, expectedWizard;
    beforeEach(() => {
      bolus = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'medtronic12345',
        normal: 1.3,
        iob: 0.2,
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
      expectedWizard.bolus = _.clone(bolus);
      delete expectedWizard.bolus.jsDate;
      delete expectedWizard.bolus.iob;
    });

    test('bolus record gets added to wizard', () => {
      simulator.wizard(wizard);
      simulator.bolus(bolus);
      expect(simulator.getEvents()).deep.equals([expectedWizard.done()]);
    });
  });


  describe('deviceEvent', () => {
    describe('alarm', () => {
      test('passes through', () => {
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          timezoneOffset: 0,
          conversionOffset: 0,
          deviceId: 'medtronic12345',
          type: 'deviceEvent',
          subType: 'alarm',
          alarmType: 'low_insulin'
        };

        simulator.alarm(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });

    describe('time-change', () => {

      test('splits temp basal in two with time change', () => {
        var basal1 = builder.makeScheduledBasal()
          .with_time('2014-09-25T02:00:00.000Z')
          .with_deviceTime('2014-09-25T02:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Alice')
          .with_rate(0.75);

        var tempBasal = builder.makeTempBasal()
          .with_time('2014-09-25T03:00:00.000Z')
          .with_deviceTime('2014-09-25T03:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(1800000)
          .with_rate(1.0);

        var timeChange = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2014-09-25T03:10:00.000Z',
            to: '2014-09-25T04:10:00.000Z',
            agent: 'manual'
          })
          .with_payload({deviceType: 'pump'})
          .with_time('2014-09-25T03:10:00.000Z')
          .with_deviceTime('2014-09-25T04:10:00')
          .with_timezoneOffset(60)
          .with_conversionOffset(0)
          .set('index', 3);

        var basal2 = builder.makeScheduledBasal()
          .with_time('2014-09-25T03:30:00.000Z')
          .with_deviceTime('2014-09-25T04:30:00')
          .with_timezoneOffset(60)
          .with_conversionOffset(0)
          .with_scheduleName('Alice')
          .with_rate(2);

        var expectedFirstTempBasal = _.cloneDeep(tempBasal.done());
        var suppressed = {
          type: 'basal',
          deliveryType: 'scheduled',
          rate: 0.75,
          scheduleName: 'Alice'
        };
        expectedFirstTempBasal.duration = 600000;
        expectedFirstTempBasal.suppressed = suppressed;

        var expectedSecondTempBasal = _.cloneDeep(tempBasal.done());
        expectedSecondTempBasal.time ='2014-09-25T03:10:00.000Z';
        expectedSecondTempBasal.deviceTime = '2014-09-25T04:10:00';
        expectedSecondTempBasal.timezoneOffset = 60;
        expectedSecondTempBasal.suppressed = suppressed;
        expectedSecondTempBasal.duration = 1200000;
        expectedSecondTempBasal.annotations = [{code: 'medtronic/basal/time-change'}];
        expectedSecondTempBasal.payload = {logIndices : [4]};

        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.changeDeviceTime(timeChange);
        simulator.basal(basal2);

        expect(simulator.getEvents()).deep.equals([
          basal1.done(),
          expectedFirstTempBasal,
          timeChange,
          expectedSecondTempBasal
        ]);
      });

    });

  });


  describe('settings', () => {

    var settings = builder.makePumpSettings()
      .with_units({ bg: 'mg/dL' })
      .with_carbRatio([
          { start: 0, amount: 1.0 },
          { start: 21600000, amount: 1.1 },
          { start: 0, amount: 0.0}
      ])
      .with_insulinSensitivity([
          { start: 0, amount: 1.0 },
          { start: 21600000, amount: 1.1 },
          { start: 0, amount: 0.0}
      ])
      .with_bgTarget([
          { start: 0, target: 100, range: 15 },
          { start: 21600000, target: 110, range: 15 }
      ])
      .with_basalSchedules({
        'billy': [
          { start: 0, rate: 1.0 },
          { start: 21600000, rate: 1.1 }
        ],
        'bob': [
          { start: 0, rate: 0.0}
        ]
      })
      .with_activeSchedule('billy')
      .with_basal({
          rateMaximum: {
              value: 2,
              units: 'Units/hour'
          },
          temporary: {
            type: 'percent'
          }
      })
      .with_bolus({
          amountMaximum: {
              value: 25,
              units: 'Units'
          },
          calculator: {
              enabled: true,
              insulin: {
                  duration: 8,
                  units: 'hours'
              }
          },
          extended: {
              enabled: true
          }
      })
      .with_time('2014-09-25T01:00:00.000Z')
      .with_deviceTime('2014-09-25T01:00:00')
      .with_timezoneOffset(0)
      .with_conversionOffset(0);

    test('passes through', () => {
      simulator.pumpSettings(settings);
      expect(simulator.getEvents()).deep.equals([settings.done()]);
    });

  });

  describe('basal', () => {
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

    test('sets duration using a following basal', () => {
      var expectedFirstBasal = _.cloneDeep(basal1);
      expectedFirstBasal = expectedFirstBasal.set('duration', 3600000).done();
      simulator.basal(basal1);
      simulator.basal(basal2);
      expect(simulator.getEvents()).deep.equals([expectedFirstBasal]);
    });

    test('limits duration to five days for flat-rate basals', () => {
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


    test('sets suppressed info for suspended basal', () => {

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
        rate: 1,
        scheduleName: 'Alice'
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

    describe('temp basal', () => {

      var basal1 = null,
          tempBasal = null,
          basal2 = null,
          settings= null,
          tempBasalOverMidnight = null,
          suspendResume = null,
          suspendedBasal = null,
          basal3 = null,
          prime = null,
          reservoirChange = null;

      beforeEach(() => {
        basal1 = builder.makeScheduledBasal()
          .with_time('2014-09-25T18:05:00.000Z')
          .with_deviceTime('2014-09-25T18:05:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(1.3)
          .with_duration(2000000)
          .set('index',0);
        tempBasal = builder.makeTempBasal()
          .with_time('2014-09-25T18:10:00.000Z')
          .with_deviceTime('2014-09-25T18:10:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(1800000)
          .with_rate(1.0)
          .set('index',1);
        basal2 = builder.makeScheduledBasal()
          .with_time('2014-09-25T18:40:00.000Z')
          .with_deviceTime('2014-09-25T18:40:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(2)
          .with_duration(1800000)
          .set('index',2);

        settings = builder.makePumpSettings()
          .with_units({ bg: 'mg/dL' })
          .with_basalSchedules({
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
          })
          .with_activeSchedule('standard')
          .with_time('2014-09-25T02:00:00.000Z')
          .with_deviceTime('2014-09-25T02:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0);

        suspendResume = builder.makeDeviceEventSuspendResume()
          .with_time('2014-09-25T18:20:00.000Z')
          .with_deviceTime('2014-09-25T18:20:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(600000)
          .with_reason({resumed: 'manual'})
          .set('index', 1234)
          .set('resumeIndex', 1235)
          .done();

        suspendedBasal = builder.makeSuspendBasal()
          .with_time('2014-09-25T18:20:00.000Z')
          .with_deviceTime('2014-09-25T18:20:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .set('index', 1234);

        basal3 = builder.makeScheduledBasal()
            .with_time('2014-09-26T01:10:00.000Z')
            .with_deviceTime('2014-09-26T01:10:00')
            .with_timezoneOffset(0)
            .with_conversionOffset(0)
            .with_rate(2);

        reservoirChange = builder.makeDeviceEventReservoirChange()
            .with_time('2014-09-25T18:20:00.000Z')
            .with_deviceTime('2014-09-25T18:20:00')
            .with_timezoneOffset(0)
            .with_conversionOffset(0)
            .set('index', 1234)
            .done();

        prime =builder.makeDeviceEventPrime()
          .with_time('2014-09-25T18:30:00.000Z')
          .with_deviceTime('2014-09-25T18:30:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_primeTarget('tubing')
          .set('index', 1235)
          .done();

        tempBasalOverMidnight = builder.makeTempBasal()
          .with_time('2014-09-25T23:10:00.000Z')
          .with_deviceTime('2014-09-25T23:10:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(7200000)
          .with_rate(1.0)
          .set('index',1);
        tempBasalOverMidnight.jsDate = new Date(tempBasalOverMidnight.deviceTime);
      });

      test('adds suppressed info', () => {

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

      test('checks for schedule change', () => {

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
        expectedTempBasal2.duration = 1750000;
        expectedTempBasal2.time = '2014-09-25T18:10:50.000Z';
        expectedTempBasal2.deviceTime = '2014-09-25T18:10:50';
        expectedTempBasal2.clockDriftOffset = 0;
        expectedTempBasal2.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        expectedTempBasal2.suppressed.rate = 0.475;
        delete expectedTempBasal2.payload.duration;

        delete basal1.index;
        delete basal1.jsDate;

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          basal1.done(),
          expectedTempBasal1,
          expectedTempBasal2
        ]);
      });

      test('checks for schedule change over midnight', () => {

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(tempBasalOverMidnight);
        simulator.basal(basal3);

        var expectedTempBasal1 = _.cloneDeep(tempBasalOverMidnight.done());
        expectedTempBasal1.suppressed.rate = 1.3;
        expectedTempBasal1.duration = 3000000;
        expectedTempBasal1.payload.duration = 7200000;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedTempBasal2 = _.cloneDeep(expectedTempBasal1);
        expectedTempBasal2.duration = 4200000;
        expectedTempBasal2.time = '2014-09-26T00:00:00.000Z';
        expectedTempBasal2.deviceTime = '2014-09-26T00:00:00';
        expectedTempBasal2.clockDriftOffset = 0;
        expectedTempBasal2.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        expectedTempBasal2.suppressed.rate = 0.2;
        delete expectedTempBasal2.payload.duration;

        delete basal1.index;
        delete basal1.jsDate;

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          basal1.done(),
          expectedTempBasal1,
          expectedTempBasal2
        ]);
      });

      test('checks temp basal schedule change that only happens after midnight', () => {

        settings.basalSchedules.standard[0].rate = 1.3; // scheduled rate does not change at midnight
        settings.basalSchedules.standard[1].start = 3600000; // schedule only changes at 1am

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(tempBasalOverMidnight);
        simulator.basal(basal3);

        var expectedTempBasal1 = _.cloneDeep(tempBasalOverMidnight.done());
        expectedTempBasal1.suppressed.rate = 1.3;
        expectedTempBasal1.duration = 6600000;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedTempBasal2 = _.cloneDeep(expectedTempBasal1);
        expectedTempBasal2.duration = 600000;
        expectedTempBasal2.time = '2014-09-26T01:00:00.000Z';
        expectedTempBasal2.deviceTime = '2014-09-26T01:00:00';
        expectedTempBasal2.clockDriftOffset = 0;
        expectedTempBasal2.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        expectedTempBasal2.suppressed.rate = 0.375;
        delete expectedTempBasal2.payload.duration;

        delete basal1.index;
        delete basal1.jsDate;

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          basal1.done(),
          expectedTempBasal1,
          expectedTempBasal2
        ]);
      });

      test('restarts temp basal after resume, with schedule change during suspend', () => {

        settings.basalSchedules.standard[2].start = 66300000; // schedule changes during suspend at 18h25

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.suspendResume(suspendResume);
        simulator.basal(suspendedBasal);
        simulator.basal(basal2);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        expectedTempBasal1.suppressed.rate = 1.3;
        expectedTempBasal1.duration = 600000;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedSuspendedBasal1 = _.cloneDeep(suspendedBasal);
        var suppressed = {
          type: 'basal',
          deliveryType: 'temp',
          rate: 1,
          suppressed : {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.3,
            scheduleName: 'standard'
          }
        };
        expectedSuspendedBasal1.duration = 300000;
        expectedSuspendedBasal1.set('suppressed', suppressed);
        delete expectedSuspendedBasal1.index;

        var expectedSuspendedBasal2 = _.cloneDeep(expectedSuspendedBasal1);
        expectedSuspendedBasal2.duration = 300000;
        expectedSuspendedBasal2.time = '2014-09-25T18:25:00.000Z';
        expectedSuspendedBasal2.deviceTime = '2014-09-25T18:25:00';
        expectedSuspendedBasal2.clockDriftOffset = 0;
        expectedSuspendedBasal2.suppressed.suppressed.rate = 0.475;
        expectedSuspendedBasal2.suppressed.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        delete expectedSuspendedBasal2.payload.duration;

        var expectedTempBasal2 = _.cloneDeep(expectedTempBasal1);
        expectedTempBasal2.duration = 600000;
        expectedTempBasal2.time = '2014-09-25T18:30:00.000Z';
        expectedTempBasal2.deviceTime = '2014-09-25T18:30:00';
        expectedTempBasal2.suppressed.rate = 0.475;
        expectedTempBasal2.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        delete expectedTempBasal2.payload;
        delete expectedTempBasal2.expectedDuration;

        delete basal1.index;

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          basal1.done(),
          expectedTempBasal1,
          suspendResume,
          expectedSuspendedBasal1.done(),
          expectedSuspendedBasal2.done(),
          expectedTempBasal2
        ]);
      });

      test('restarts temp basal after resume, with schedule change before suspend', () => {

        settings.basalSchedules.standard[2].start = 65700000; // schedule changes before suspend at 18h15

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.suspendResume(suspendResume);
        simulator.basal(suspendedBasal);
        simulator.basal(basal2);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        expectedTempBasal1.suppressed.rate = 1.3;
        expectedTempBasal1.duration = 300000;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedTempBasal2 = _.cloneDeep(tempBasal.done());
        expectedTempBasal2.time = '2014-09-25T18:15:00.000Z';
        expectedTempBasal2.deviceTime = '2014-09-25T18:15:00';
        expectedTempBasal2.clockDriftOffset = 0;
        expectedTempBasal2.expectedDuration = 1500000;
        expectedTempBasal2.suppressed.rate = 0.475;
        expectedTempBasal2.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        expectedTempBasal2.duration = 300000;
        delete expectedTempBasal2.payload.duration;
        delete expectedTempBasal2.index;

        var expectedSuspendedBasal1 = _.cloneDeep(suspendedBasal);
        var suppressed = {
          type: 'basal',
          deliveryType: 'temp',
          rate: 1,
          suppressed : {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 0.475,
            scheduleName: 'standard'
          }
        };
        expectedSuspendedBasal1.duration = 600000;
        expectedSuspendedBasal1.set('suppressed', suppressed);
        expectedSuspendedBasal1.suppressed.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        delete expectedSuspendedBasal1.index;

        var expectedTempBasal3 = _.cloneDeep(expectedTempBasal1);
        expectedTempBasal3.duration = 600000;
        expectedTempBasal3.time = '2014-09-25T18:30:00.000Z';
        expectedTempBasal3.deviceTime = '2014-09-25T18:30:00';
        expectedTempBasal3.clockDriftOffset = 0;
        expectedTempBasal3.suppressed.rate = 0.475;
        expectedTempBasal3.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        delete expectedTempBasal3.payload;
        delete expectedTempBasal3.expectedDuration;

        delete basal1.index;

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          basal1.done(),
          expectedTempBasal1,
          expectedTempBasal2,
          suspendResume,
          expectedSuspendedBasal1.done(),
          expectedTempBasal3
        ]);
      });

      test('rewinds and primes the pump, but there are no basal records yet', () => {
        simulator.rewind(reservoirChange);
        simulator.prime(prime);
        expect(simulator.getEvents()).deep.equals([reservoirChange, prime]);
      });

      test('restarts temp basal after resume, with schedule change before automatic suspend (reservoir change)', () => {

        settings.basalSchedules.standard[2].start = 65700000; // schedule changes before suspend at 18h15

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.rewind(reservoirChange);
        simulator.prime(prime);
        simulator.basal(basal2);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        expectedTempBasal1.suppressed.rate = 1.3;
        expectedTempBasal1.duration = 300000;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedTempBasal2 = _.cloneDeep(tempBasal.done());
        expectedTempBasal2.time = '2014-09-25T18:15:00.000Z';
        expectedTempBasal2.deviceTime = '2014-09-25T18:15:00';
        expectedTempBasal2.clockDriftOffset = 0;
        expectedTempBasal2.suppressed.rate = 0.475;
        expectedTempBasal2.duration = 300000;
        delete expectedTempBasal2.payload.duration;
        delete expectedTempBasal2.index;
        expectedTempBasal2.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];

        var expectedSuspendedBasal1 = _.cloneDeep(suspendedBasal);
        var suppressed = {
          type: 'basal',
          deliveryType: 'temp',
          rate: 1,
          suppressed : {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 0.475,
            scheduleName: 'standard'
          }
        };
        expectedSuspendedBasal1.duration = 600000;
        expectedSuspendedBasal1.set('payload', {logIndices : [1234]});
        expectedSuspendedBasal1.set('suppressed', suppressed);
        expectedSuspendedBasal1.suppressed.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        delete expectedSuspendedBasal1.index;

        var expectedTempBasal3 = _.cloneDeep(expectedTempBasal1);
        expectedTempBasal3.duration = 600000;
        expectedTempBasal3.time = '2014-09-25T18:30:00.000Z';
        expectedTempBasal3.deviceTime = '2014-09-25T18:30:00';
        expectedTempBasal3.clockDriftOffset = 0;
        expectedTempBasal3.suppressed.rate = 0.475;
        expectedTempBasal3.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        delete expectedTempBasal3.payload.duration;

        delete basal1.index;

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          basal1.done(),
          expectedTempBasal1,
          expectedTempBasal2,
          reservoirChange,
          expectedSuspendedBasal1.done(),
          prime,
          expectedTempBasal3
        ]);
      });

      test('restarts temp basal after resume, followed by a reservoir change', () => {

        var suspendResume = builder.makeDeviceEventSuspendResume()
          .with_time('2014-09-25T18:20:00.000Z')
          .with_deviceTime('2014-09-25T18:20:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(600000)
          .with_reason({resumed: 'manual'})
          .set('index', 1234)
          .set('resumeIndex', 1235)
          .done();

        var suspendedBasal = builder.makeSuspendBasal()
          .with_time('2014-09-25T18:20:00.000Z')
          .with_deviceTime('2014-09-25T18:20:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .set('index', 1234);

        var deviceEvent = builder.makeDeviceEventReservoirChange()
          .with_time('2014-09-25T18:40:00.000Z')
          .with_deviceTime('2014-09-25T18:40:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .set('index', 1235);

        var basal3 = builder.makeScheduledBasal()
            .with_time('2014-09-25T18:50:00.000Z')
            .with_deviceTime('2014-09-25T18:50:00')
            .with_timezoneOffset(0)
            .with_conversionOffset(0)
            .with_rate(2);

        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.suspendResume(suspendResume);
        simulator.basal(suspendedBasal);
        simulator.rewind(deviceEvent);
        simulator.basal(basal3);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        expectedTempBasal1.suppressed.rate = 1.3;
        expectedTempBasal1.duration = 600000;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedSuspendedBasal1 = _.cloneDeep(suspendedBasal);
        var suppressed = {
          type: 'basal',
          deliveryType: 'temp',
          rate: 1,
          suppressed : {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.3,
          }
        };
        expectedSuspendedBasal1.duration = 600000;
        expectedSuspendedBasal1.set('suppressed', suppressed);
        delete expectedSuspendedBasal1.index;

        var expectedTempBasal2 = _.cloneDeep(expectedTempBasal1);
        expectedTempBasal2.time = '2014-09-25T18:30:00.000Z';
        expectedTempBasal2.deviceTime = '2014-09-25T18:30:00';
        delete expectedTempBasal2.payload;
        delete expectedTempBasal2.expectedDuration;

        delete basal1.index;

        var expectedSuspendedBasal2 = _.cloneDeep(suspendedBasal);
        expectedSuspendedBasal2.time = '2014-09-25T18:40:00.000Z';
        expectedSuspendedBasal2.deviceTime = '2014-09-25T18:40:00';
        expectedSuspendedBasal2.set('payload', {logIndices : [1235]});
        expectedSuspendedBasal2.suppressed = suppressed;
        delete expectedSuspendedBasal2.index;

        expect(simulator.getEvents()).deep.equals([
          basal1.done(),
          expectedTempBasal1,
          suspendResume,
          expectedSuspendedBasal1.done(),
          expectedTempBasal2,
          deviceEvent,
          expectedSuspendedBasal2.done()
        ]);
      });

      test('is suspended but not resumed before upload', () => {

        var suspendResume = builder.makeDeviceEventSuspendResume()
          .with_time('2014-09-25T18:20:00.000Z')
          .with_deviceTime('2014-09-25T18:20:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(0)
          .with_reason({suspended: 'manual', resumed: 'manual'})
          .set('index', 1234)
          .done();

        var suspendedBasal = builder.makeSuspendBasal()
          .with_time('2014-09-25T18:20:00.000Z')
          .with_deviceTime('2014-09-25T18:20:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(0)
          .set('index', 1234);

        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.suspendResume(suspendResume);
        simulator.basal(suspendedBasal);
        simulator.finalize();

        var expectedTempBasal = _.cloneDeep(tempBasal.done());
        expectedTempBasal.suppressed.rate = 1.3;
        expectedTempBasal.duration = 600000;
        delete expectedTempBasal.index;
        delete expectedTempBasal.jsDate;

        var expectedSuspendedBasal = _.cloneDeep(suspendedBasal);
        var suppressed = {
          type: 'basal',
          deliveryType: 'temp',
          rate: 1,
          suppressed : {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.3,
          }
        };
        expectedSuspendedBasal.duration = 0;
        expectedSuspendedBasal.set('suppressed', suppressed);
        delete expectedSuspendedBasal.index;

        delete basal1.index;

        expect(simulator.getEvents()).deep.equals([
          basal1.done(),
          expectedTempBasal,
          suspendResume,
          expectedSuspendedBasal.done()
        ]);
      });

      test('is cancelled after schedule change', () => {

        var cancelTempBasal = builder.makeTempBasal()
          .with_time('2014-09-25T18:20:00.000Z')
          .with_deviceTime('2014-09-25T18:20:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(0)
          .with_rate(null);

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.basal(cancelTempBasal);
        simulator.basal(basal2);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        expectedTempBasal1.suppressed.rate = 1.3;
        expectedTempBasal1.duration = 50000;
        expectedTempBasal1.payload.duration = 1800000;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedTempBasal2 = _.cloneDeep(expectedTempBasal1);
        expectedTempBasal2.expectedDuration = 1750000;
        expectedTempBasal2.duration = 550000;
        expectedTempBasal2.time = '2014-09-25T18:10:50.000Z';
        expectedTempBasal2.deviceTime = '2014-09-25T18:10:50';
        expectedTempBasal2.clockDriftOffset = 0;
        expectedTempBasal2.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        expectedTempBasal2.suppressed.rate = 0.475;
        delete expectedTempBasal2.payload.duration;

        delete basal1.index;
        delete basal1.jsDate;

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          basal1.done(),
          expectedTempBasal1,
          expectedTempBasal2
        ]);
      });

      test('should run over midnight but is cancelled before schedule change at midnight', () => {

        tempBasal = builder.makeTempBasal()
          .with_time('2014-09-25T23:35:08.000Z')
          .with_deviceTime('2014-09-25T23:35:08')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(1800000)
          .with_rate(1.0)
          .set('index',1);

        var cancelTempBasal = builder.makeTempBasal()
          .with_time('2014-09-25T23:41:56.000Z')
          .with_deviceTime('2014-09-25T23:41:56')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(0)
          .with_rate(null);

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.basal(cancelTempBasal);
        simulator.basal(basal3);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        expectedTempBasal1.suppressed.rate = 1.3;
        expectedTempBasal1.duration = 408000;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        delete basal1.index;
        delete basal1.jsDate;

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          basal1.done(),
          expectedTempBasal1
        ]);
      });

      test('is updated after a schedule change', () => {

        // schedule change from 0.2 -> 0.375 at 3h00

        basal1 = builder.makeScheduledBasal()
            .with_time('2014-09-25T02:00:00.000Z')
            .with_deviceTime('2014-09-25T02:00:00')
            .with_timezoneOffset(0)
            .with_conversionOffset(0)
            .with_rate(0.2)
            .set('index',0);

        tempBasal = builder.makeTempBasal()
          .with_time('2014-09-25T02:30:00.000Z')
          .with_deviceTime('2014-09-25T02:30:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(3600000)
          .with_rate(1.0)
          .set('index',1);

        var updateTempBasal = builder.makeTempBasal()
          .with_time('2014-09-25T03:10:00.000Z')
          .with_deviceTime('2014-09-25T03:10:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(1800000)
          .with_rate(0);

        basal2 = builder.makeScheduledBasal()
            .with_time('2014-09-25T03:40:00.000Z')
            .with_deviceTime('2014-09-25T03:40:00')
            .with_timezoneOffset(0)
            .with_conversionOffset(0)
            .with_rate(2);

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.basal(updateTempBasal);
        simulator.basal(basal2);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        expectedTempBasal1.suppressed.rate = 0.2;
        expectedTempBasal1.duration = 1800000;
        delete expectedTempBasal1.index;

        var expectedTempBasal2 = builder.makeTempBasal()
          .with_time('2014-09-25T03:00:00.000Z')
          .with_deviceTime('2014-09-25T03:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_clockDriftOffset(0)
          .with_expectedDuration(1800000)
          .with_duration(600000)
          .with_rate(1)
          .set('suppressed', {
                    type: 'basal',
                    deliveryType: 'scheduled',
                    rate: 0.375,
                    scheduleName: 'standard'
                  });
        expectedTempBasal2.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        expectedTempBasal2.payload = { logIndices: [1] };

        var expectedTempBasal3 = _.cloneDeep(updateTempBasal.done());
        expectedTempBasal3.suppressed.rate = 0.375;

        delete basal1.index;

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          basal1.done(),
          expectedTempBasal1,
          expectedTempBasal2.done(),
          expectedTempBasal3
        ]);
      });

      test('runs over midnight and is cancelled after schedule change at midnight', () => {

        tempBasal = builder.makeTempBasal()
          .with_time('2014-09-25T23:35:08.000Z')
          .with_deviceTime('2014-09-25T23:35:08')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(1800000)
          .with_rate(1.0)
          .set('index',1);

        // cancel 8 seconds before end
        var cancelTempBasal = builder.makeTempBasal()
          .with_time('2014-09-26T00:05:00.000Z')
          .with_deviceTime('2014-09-26T00:05:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(0)
          .with_rate(null);

        basal2 = builder.makeScheduledBasal()
            .with_time('2014-09-26T00:05:00.000Z')
            .with_deviceTime('2014-09-26T00:05:00')
            .with_timezoneOffset(0)
            .with_conversionOffset(0)
            .with_rate(2);

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.basal(cancelTempBasal);
        simulator.basal(basal2);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        expectedTempBasal1.suppressed.rate = 1.3;
        expectedTempBasal1.duration = 1492000;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedTempBasal2 = _.cloneDeep(expectedTempBasal1);
        expectedTempBasal2.duration = 300000;
        expectedTempBasal2.expectedDuration = 308000;
        expectedTempBasal2.time = '2014-09-26T00:00:00.000Z';
        expectedTempBasal2.deviceTime = '2014-09-26T00:00:00';
        expectedTempBasal2.clockDriftOffset = 0;
        expectedTempBasal2.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        expectedTempBasal2.suppressed.rate = 0.2;
        delete expectedTempBasal2.payload.duration;

        delete basal1.index;
        delete basal1.jsDate;

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          basal1.done(),
          expectedTempBasal1,
          expectedTempBasal2
        ]);
      });

      test('ends during suspend', () => {

        var suspendResume = builder.makeDeviceEventSuspendResume()
          .with_time('2014-09-25T18:20:00.000Z')
          .with_deviceTime('2014-09-25T18:20:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(600000)
          .with_reason({resumed: 'manual'})
          .set('index', 1234)
          .set('resumeIndex', 1235)
          .done();

        var suspendedBasal = builder.makeSuspendBasal()
          .with_time('2014-09-25T18:20:00.000Z')
          .with_deviceTime('2014-09-25T18:20:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .set('index', 1234);

        var basal3 = builder.makeScheduledBasal()
            .with_time('2014-09-25T18:30:00.000Z')
            .with_deviceTime('2014-09-25T18:30:00')
            .with_timezoneOffset(0)
            .with_conversionOffset(0)
            .with_rate(2);

        tempBasal.duration = 900000; //end in middle of suspend

        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.suspendResume(suspendResume);
        simulator.basal(suspendedBasal);
        simulator.basal(basal3);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        expectedTempBasal1.suppressed.rate = 1.3;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedSuspendedBasal1 = _.cloneDeep(suspendedBasal);
        var suppressed = {
          type: 'basal',
          deliveryType: 'temp',
          rate: 1,
          suppressed : {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.3
          }
        };
        expectedSuspendedBasal1.duration = 600000;
        expectedSuspendedBasal1.set('suppressed', suppressed);
        delete expectedSuspendedBasal1.index;

        delete basal1.index;

        expect(simulator.getEvents()).deep.equals([
          basal1.done(),
          expectedTempBasal1,
          suspendResume,
          expectedSuspendedBasal1.done()
        ]);
      });

      test('has an unknown duration', () => {

        var tempBasalUnknownDuration = builder.makeTempBasal()
          .with_time('2014-09-25T18:40:00.000Z')
          .with_deviceTime('2014-09-25T18:40:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(0)
          .with_rate(3.5);
        tempBasalUnknownDuration.annotations = [{code: 'basal/unknown-duration'}];

        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.basal(tempBasalUnknownDuration);
        simulator.basal(basal2);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        delete basal1.index;
        delete basal1.jsDate;

        expect(simulator.getEvents()).deep.equals([
          basal1.done(),
          expectedTempBasal1,
          tempBasalUnknownDuration.done()
        ]);
      });

      test('is updated with zero percent instead of rate', () => {

        var tempBasal2 = builder.makeTempBasal()
          .with_time('2014-09-25T18:30:00.000Z')
          .with_deviceTime('2014-09-25T18:30:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(180000)
          .with_percent(0);

        basal2 = builder.makeScheduledBasal()
            .with_time('2014-09-25T18:33:00.000Z')
            .with_deviceTime('2014-09-25T18:33:00')
            .with_timezoneOffset(0)
            .with_conversionOffset(0)
            .with_rate(2);

        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.basal(tempBasal2);
        simulator.basal(basal2);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedTempBasal2 = _.cloneDeep(tempBasal2.done());
        expectedTempBasal2.rate = 0; // simulator should fill this in

        delete basal1.index;
        delete basal1.jsDate;

        expect(simulator.getEvents()).deep.equals([
          basal1.done(),
          expectedTempBasal1,
          expectedTempBasal2
        ]);
      });

      test('has two schedule changes before midnight and extends past midnight', () => {

        var settings = builder.makePumpSettings()
          .with_units({ bg: 'mg/dL' })
          .with_basalSchedules({
            standard: [
              {
                'start': 0,
                'rate': 1
              },
              {
                'start': 64800000,
                'rate': 0.9
              },
              {
                'start': 72000000,
                'rate': 0.95
              },
              {
                'start': 79200000,
                'rate': 1.2
              }
            ]
          })
          .with_activeSchedule('standard')
          .with_time('2017-01-08T02:00:00.000Z')
          .with_deviceTime('2017-01-08T02:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0);

        var basal1 = builder.makeSuspendBasal()
          .with_time('2017-01-08T17:43:40.000Z')
          .with_deviceTime('2017-01-08T17:43:40')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(28782000)
          .set('suppressed', {
                              'type': 'basal',
                              'deliveryType': 'scheduled',
                              'rate': 0.9,
                              'scheduleName': 'standard'
                          })
          .set('index', 0);


        var expectedBasal1 = _.cloneDeep(basal1);
        expectedBasal1.duration = 8180000;
        expectedBasal1.payload = { duration : 28782000, logIndices: [0] };

        var expectedBasal2 = builder.makeSuspendBasal()
          .with_time('2017-01-08T20:00:00.000Z')
          .with_deviceTime('2017-01-08T20:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(7200000)
          .with_payload({duration: 20602000, logIndices: [0]})
          .set('suppressed', {
                              'type': 'basal',
                              'deliveryType': 'scheduled',
                              'rate': 0.95,
                              'scheduleName': 'standard'
                          });
        expectedBasal2.clockDriftOffset = 0;
        delete expectedBasal1.index;
        expectedBasal2.suppressed.annotations = [{'code': 'medtronic/basal/fabricated-from-schedule'}];

        var expectedBasal3 = builder.makeSuspendBasal()
          .with_time('2017-01-08T22:00:00.000Z')
          .with_deviceTime('2017-01-08T22:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(7200000)
          .with_payload({duration: 13402000, logIndices: [0]})
          .set('suppressed', {
            'type': 'basal',
            'deliveryType': 'scheduled',
            'rate': 1.2,
            'scheduleName': 'standard'
          });
        expectedBasal3.clockDriftOffset = 0;
        expectedBasal3.suppressed.annotations = [{'code': 'medtronic/basal/fabricated-from-schedule'}];

        var expectedBasal4 = builder.makeSuspendBasal()
          .with_time('2017-01-09T00:00:00.000Z')
          .with_deviceTime('2017-01-09T00:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(6202000)
          .set('suppressed', {
            'type': 'basal',
            'deliveryType': 'scheduled',
            'rate': 1,
            'scheduleName': 'standard'
          });
          expectedBasal4.clockDriftOffset = 0;
          expectedBasal4.payload = { logIndices: [0] };
          expectedBasal4.suppressed.annotations = [{'code': 'medtronic/basal/fabricated-from-schedule'}];

        var basal2 = builder.makeScheduledBasal()
          .with_time('2017-01-09T01:43:22.000Z')
          .with_deviceTime('2017-01-09T01:43:22')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(415000)
          .with_rate(1)
          .with_scheduleName('standard');

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(basal2);

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          expectedBasal1.done(),
          expectedBasal2.done(),
          expectedBasal3.done(),
          expectedBasal4.done()
        ]);

      });

      test('extends past midnight with schedule change after midnight', () => {

        var settings = builder.makePumpSettings()
          .with_units({ bg: 'mg/dL' })
          .with_basalSchedules({
            standard: [
              {
                'start': 0,
                'rate': 0.7
              },
              {
                'start': 1800000,
                'rate': 0.75
              }
            ]
          })
          .with_activeSchedule('standard')
          .with_time('2014-01-08T02:00:00.000Z')
          .with_deviceTime('2014-01-08T02:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0);

        tempBasal = builder.makeTempBasal()
          .with_time('2014-09-25T22:43:30.000Z')
          .with_deviceTime('2014-09-25T22:43:30')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(7200000)
          .with_rate(1.0)
          .set('index',1);

        var basal2 = builder.makeScheduledBasal()
          .with_time('2014-09-26T00:43:30.000Z')
          .with_deviceTime('2014-09-26T00:43:30')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(415000)
          .with_rate(0.75)
          .with_scheduleName('standard');

        simulator.pumpSettings(settings);
        simulator.basal(basal1);
        simulator.basal(tempBasal);
        simulator.basal(basal2);

        var expectedTempBasal1 = _.cloneDeep(tempBasal.done());
        expectedTempBasal1.suppressed = {
          'type': 'basal',
          'deliveryType': 'scheduled',
          'rate': 1.3,
          'scheduleName': 'standard'
        };
        expectedTempBasal1.duration = 4590000;
        delete expectedTempBasal1.index;
        delete expectedTempBasal1.jsDate;

        var expectedTempBasal2 = _.cloneDeep(expectedTempBasal1);
        expectedTempBasal2.duration = 1800000;
        expectedTempBasal2.time = '2014-09-26T00:00:00.000Z';
        expectedTempBasal2.deviceTime = '2014-09-26T00:00:00';
        expectedTempBasal2.clockDriftOffset = 0;
        expectedTempBasal2.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        expectedTempBasal2.suppressed.rate = 0.7;
        expectedTempBasal2.payload.duration = 2610000;

        var expectedTempBasal3 = _.cloneDeep(expectedTempBasal1);
        expectedTempBasal3.duration = 810000;
        expectedTempBasal3.time = '2014-09-26T00:30:00.000Z';
        expectedTempBasal3.deviceTime = '2014-09-26T00:30:00';
        expectedTempBasal3.clockDriftOffset = 0;
        expectedTempBasal3.suppressed.annotations = [{code: 'medtronic/basal/fabricated-from-schedule'}];
        expectedTempBasal3.suppressed.rate = 0.75;
        delete expectedTempBasal3.payload.duration;

        delete basal1.index;

        expect(simulator.getEvents()).deep.equals([
          settings.done(),
          basal1.done(),
          expectedTempBasal1,
          expectedTempBasal2,
          expectedTempBasal3
        ]);

      });

      test('has a one-second gap before a scheduled basal', () => {
        var basal = builder.makeScheduledBasal()
          .with_time('2014-09-25T18:40:01.000Z')
          .with_deviceTime('2014-09-25T18:40:01')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(0.75);

        var expectedTempBasal = _.cloneDeep(tempBasal).done();
        delete expectedTempBasal.index;

        var oneSecondTemp = _.cloneDeep(expectedTempBasal);
        oneSecondTemp.time = '2014-09-25T18:40:00.000Z';
        oneSecondTemp.deviceTime = '2014-09-25T18:40:00';
        oneSecondTemp.clockDriftOffset = 0;
        oneSecondTemp.duration = 1000;
        oneSecondTemp.annotations = [{code: 'medtronic/basal/one-second-gap'}];

        simulator.basal(tempBasal);
        simulator.basal(basal);

        expect(simulator.getEvents()).deep.equals([
          expectedTempBasal,
          oneSecondTemp
        ]);
      });

      test('is cancelled and has a one-second gap before a scheduled basal', () => {

        tempBasal.duration = 1200000;
        tempBasal.expectedDuration = 1800000;

        var basal = builder.makeScheduledBasal()
          .with_time('2014-09-25T18:30:01.000Z')
          .with_deviceTime('2014-09-25T18:30:01')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(0.75);

        var expectedTempBasal = _.cloneDeep(tempBasal).done();
        delete expectedTempBasal.index;

        var oneSecondTemp = _.cloneDeep(expectedTempBasal);
        oneSecondTemp.time = '2014-09-25T18:30:00.000Z';
        oneSecondTemp.deviceTime = '2014-09-25T18:30:00';
        oneSecondTemp.clockDriftOffset = 0;
        oneSecondTemp.duration = 1000;
        oneSecondTemp.annotations = [{code: 'medtronic/basal/one-second-gap'}];
        delete oneSecondTemp.expectedDuration;

        simulator.basal(tempBasal);
        simulator.basal(basal);

        expect(simulator.getEvents()).deep.equals([
          expectedTempBasal,
          oneSecondTemp
        ]);
      });
    });

  });

  describe('device event', () => {
    test('basal is suspended by alarm', () => {

      var basal1 = builder.makeScheduledBasal()
        .with_time('2014-09-25T01:00:00.000Z')
        .with_deviceTime('2014-09-25T01:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.0);

      var alarm = {
        time: '2014-09-25T02:00:00.000Z',
        deviceTime: '2014-09-25T02:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'medtronic12345',
        type: 'deviceEvent',
        subType: 'alarm',
        alarmType: 'auto_off'
      };

      var basal2 = builder.makeScheduledBasal()
        .with_time('2014-09-25T03:00:00.000Z')
        .with_deviceTime('2014-09-25T03:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.2);
      basal2.deviceId = 'medtronic12345';

      var basal3 = builder.makeScheduledBasal()
        .with_time('2014-09-25T04:00:00.000Z')
        .with_deviceTime('2014-09-25T04:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(2);
      basal3.deviceId = 'medtronic12345';

      var expectedSuspendResume = {
        time: '2014-09-25T02:00:00.000Z',
        deviceTime: '2014-09-25T02:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'medtronic12345',
        type: 'deviceEvent',
        subType: 'status',
        status: 'suspended',
        reason: {suspended: 'automatic', resumed: 'manual'},
        payload: {cause: 'auto_off'},
        duration: 3600000
      };
      expectedSuspendResume.annotations = [{code: 'medtronic/status/fabricated-from-device-event'}];

      simulator.basal(basal1);
      simulator.alarm(alarm);
      simulator.basal(basal2);
      simulator.basal(basal3);

      var expectedBasal = builder.makeSuspendBasal()
        .with_time('2014-09-25T02:00:00.000Z')
        .with_deviceTime('2014-09-25T02:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_duration(3600000)
        .set('suppressed', {
          deliveryType: 'scheduled',
          rate: 1,
          type: 'basal'
        })
        .done();

      var expectedAlarm = _.cloneDeep(alarm);
      expectedAlarm.status = expectedSuspendResume;

      expect(simulator.getEvents()).deep.equals([
        basal1.done(),
        expectedAlarm,
        expectedBasal,
        basal2.done() // checks that the suspending event has been cleared
      ]);
    });
  });
});
