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

var pwdSimulator = require('../../../lib/drivers/animas/animasSimulator.js');
var builder = require('../../../lib/objectBuilder')();

describe('animasSimulator.js', () => {
  var simulator = null;

  beforeEach(() => {
    simulator = pwdSimulator.make();
  });

  describe('smbg', () => {

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

    test('passes through', () => {
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
        deviceId: 'animas12345',
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
        deviceId: 'animas12345',
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
        deviceId: 'animas12345',
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

    test('passes through with a bolus', () => {
      simulator.wizard(val);
      expect(simulator.getEvents()).deep.equals([val]);
    });

    test('does not pass through a zero-volume wizard bolus', () => {
      var zeroWizard = _.assign({}, bolus, {normal: 0.0});
      simulator.bolus(val);
      simulator.bolus(zeroWizard);
      expect(simulator.getEvents()).deep.equals([val]);
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
          deviceId: 'animas12345',
          type: 'deviceEvent',
          subType: 'alarm',
          alarmType: 'low_insulin'
        };

        simulator.alarm(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });

    describe('status', () => {
      var suspend = builder.makeDeviceEventSuspend()
        .with_time('2014-09-25T01:00:00.000Z')
        .with_deviceTime('2014-09-25T01:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_status('suspended')
        .with_reason({suspended: 'manual'})
        .done();
      suspend.annotations = [{code: 'status/incomplete-tuple'}];

      var suspendresume = builder.makeDeviceEventSuspendResume()
        .with_time('2014-09-25T02:00:00.000Z')
        .with_deviceTime('2014-09-25T02:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_status('resumed')
        .with_duration(3600000)
        .with_reason({suspended: 'manual', resumed: 'manual'})
        .done();

      test('a single suspend with annotation passes through', () => {
        simulator.suspend(suspend);
        expect(simulator.getEvents()).deep.equals([suspend]);
      });

      test('a combined suspend/resume passes through', () => {
        simulator.suspend(suspendresume);
        expect(simulator.getEvents()).deep.equals([suspendresume]);
      });

      test('generates annotation for out-of-sequence events', () => {
        var suspendresume2 = builder.makeDeviceEventSuspendResume()
          .with_time('2014-09-25T04:00:00.000Z')
          .with_deviceTime('2014-09-25T04:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('resumed')
          .with_duration(3600000)
          .with_reason({suspended: 'manual', resumed: 'manual'})
          .done();

        suspendresume.index = 4;
        suspendresume2.index = 5;

        var expectedSuspendResume2 = _.cloneDeep(suspendresume2);
        delete expectedSuspendResume2.index;
        expectedSuspendResume2.annotations = [{code: 'animas/out-of-sequence'}];

        simulator.suspend(suspendresume);
        simulator.suspend(suspendresume2);

        expect(simulator.getEvents()).deep.equals([suspendresume, expectedSuspendResume2]);
      });

    });
  });

  describe('settings', () => {
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

    test('passes through', () => {
      simulator.pumpSettings(settings);
      expect(simulator.getEvents()).deep.equals([settings]);
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
      expectedFirstBasal.annotations = [{code: 'animas/basal/flat-rate'}];
      simulator.basal(basal);
      simulator.basal(basal1);
      expect(simulator.getEvents()).deep.equals([expectedFirstBasal]);

    });

    test('generates annotation for out-of-sequence events', () => {
      basal1.set('index', 1);
      basal2.set('index', 3);
      basal3.set('index', 2);

      var expectedFirstBasal = _.cloneDeep(basal1);
      expectedFirstBasal = expectedFirstBasal.set('duration', 3600000).done();
      var expectedSecondBasal = _.cloneDeep(basal2);
      expectedSecondBasal = expectedSecondBasal.set('duration', 1800000).done();
      expectedSecondBasal.annotations = [{code: 'animas/out-of-sequence'}];
      simulator.basal(basal1);
      simulator.basal(basal2);
      simulator.basal(basal3);
      delete expectedFirstBasal.index;
      delete expectedSecondBasal.index;
      expect(simulator.getEvents()).deep.equals([expectedFirstBasal, expectedSecondBasal]);
    });

    test('sets suspended basal', () => {
      var suspendResume = builder.makeDeviceEventSuspendResume()
        .with_time('2014-09-25T02:00:00.000Z')
        .with_deviceTime('2014-09-25T02:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_status('suspended')
        .with_duration(600000)
        .with_reason({resumed: 'automatic'})
        .done();

      var basal = builder.makeScheduledBasal()
        .with_time('2014-09-25T02:00:00.000Z')
        .with_deviceTime('2014-09-25T02:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_scheduleName('Alice')
        .with_rate(0);

      simulator.suspend(suspendResume);
      simulator.basal(basal);
      simulator.basal(basal2);

      var expectedSuspendedBasal = _.cloneDeep(basal);
      expectedSuspendedBasal.deliveryType = 'suspend';

      expect(simulator.getEvents()).deep.equals([suspendResume,expectedSuspendedBasal.done()]);

    });

    test('temp basal', () => {
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
      expect(simulator.getEvents()).deep.equals([
        suppressed.done(),
        expectedTempBasal
      ]);
    });
  });

  describe('event interplay', () => {
    test('basal is suspended by alarm', () => {

      var alarm = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'animas12345',
        type: 'deviceEvent',
        subType: 'alarm',
        alarmType: 'auto_off'
      };

      var basal1 = builder.makeScheduledBasal()
        .with_time('2014-09-25T02:00:00.000Z')
        .with_deviceTime('2014-09-25T02:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(0);
      basal1.deviceId = 'animas12345';

      var basal2 = builder.makeScheduledBasal()
        .with_time('2014-09-25T03:00:00.000Z')
        .with_deviceTime('2014-09-25T03:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.2);
      basal2.deviceId = 'animas12345';

      var expectedSuspendResume = {
        time: '2014-09-25T02:00:00.000Z',
        deviceTime: '2014-09-25T02:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'animas12345',
        type: 'deviceEvent',
        subType: 'status',
        status: 'suspended',
        reason: {suspended: 'automatic', resumed: 'manual'},
        payload: {cause: 'auto_off'},
        duration: 3600000
      };
      expectedSuspendResume.annotations = [{code: 'animas/status/fabricated-from-alarm'}];

      simulator.alarm(alarm);
      simulator.basal(basal1);
      simulator.basal(basal2);

      var expectedBasal = _.cloneDeep(basal1);
      expectedBasal = expectedBasal.done();
      expectedBasal.deliveryType ='suspend';
      expectedBasal.annotations = [{code: 'animas/basal/marked-suspended-from-alarm'}];

      var expectedAlarm = _.cloneDeep(alarm);
      expectedAlarm.status = expectedSuspendResume;

      expect(simulator.getEvents()).deep.equals([
        expectedAlarm,
        expectedBasal
      ]);
    });
  });
});
