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

var pwdSimulator = require('../../../lib/drivers/insulet/insuletSimulator.js');
var builder = require('../../../lib/objectBuilder')();

describe('insuletSimulator.js', () => {
  var simulator = null;

  beforeEach(() => {
    simulator = pwdSimulator.make();
  });

  describe('smbg', () => {
    test('passes through', () => {
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'InsOmn1234',
        units: 'mg/dL',
        type: 'smbg',
        value: 1.3
      };

      simulator.smbg(val);
      expect(simulator.getEvents()).deep.equals([val]);
    });
  });

  describe('bolus', () => {
    describe('normal', () => {
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
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

      test('passes through', () => {
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });

      test('is amended with an expectedNormal when followed by a bolus termination event', () => {
        simulator.bolus(_.cloneDeep(val));
        simulator.bolusTermination(term);
        expect(simulator.getEvents()).deep.equals([_.assign({}, val, {expectedNormal: 4.0})]);
      });

      test('is amended with an expectedNormal when followed by a bolus termination even when it has zero volume', () => {
        var zeroBolus = _.assign({}, val, {normal: 0.0});
        simulator.bolus(zeroBolus);
        simulator.bolusTermination(term);
        expect(simulator.getEvents()).deep.equals([_.assign({}, zeroBolus, {expectedNormal: 2.7})]);
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
        deviceId: 'InsOmn1234',
        extended: 1.4,
        duration: 1800000,
        type: 'bolus',
        subType: 'square'
      };

      test('passes through', () => {
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });

      test('is amended with expectedExtended and expectedDuration when followed by a bolus termination', () => {
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

    describe('dual', () => {
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'InsOmn1234',
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

      test('is amended with an expectedNormal, expectedExtended, and expectedDuration when two bolus terminations follow (interrupted during up-front delivery)', () => {
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

  describe('wizard', () => {
    var bolus = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      timezoneOffset: 0,
      conversionOffset: 0,
      deviceId: 'InsOmn1234',
      normal: 1.3,
      type: 'bolus',
      subType: 'normal'
    };

    var val = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      timezoneOffset: 0,
      conversionOffset: 0,
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

    test('passes through with a bolus', () => {
      simulator.wizard(val);
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
          deviceId: 'InsOmn1234',
          type: 'deviceEvent',
          subType: 'alarm',
          alarmType: 'low_insulin'
        };

        simulator.alarm(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });

      test('throws an error without a status if `stopsDelivery` in payload and `index` available', () => {
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          timezoneOffset: 0,
          conversionOffset: 0,
          deviceId: 'InsOmn1234',
          type: 'deviceEvent',
          subType: 'alarm',
          alarmType: 'occlusion',
          payload: {
            stopsDelivery: true
          },
          index: 10
        };

        var fn = function() { simulator.alarm(val); };
        expect(fn).to.throw(Error);
      });

      test('passes through if `stopsDelivery` in payload but no `index` available', () => {
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          timezoneOffset: 0,
          conversionOffset: 0,
          deviceId: 'InsOmn1234',
          type: 'deviceEvent',
          subType: 'alarm',
          alarmType: 'occlusion',
          payload: {
            stopsDelivery: true
          }
        };

        simulator.alarm(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });

      test('passes through if `stopsDelivery` in payload and `status` exists', () => {
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          timezoneOffset: 0,
          conversionOffset: 0,
          deviceId: 'InsOmn1234',
          type: 'deviceEvent',
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
            type: 'deviceEvent',
            subType: 'status',
            status: 'suspended'
          }
        };

        simulator.alarm(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });

    describe('changeReservoir', () => {
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'InsOmn1234',
        type: 'deviceEvent',
        subType: 'reservoirChange'
      };

      test('passes through with a status', () => {
        var suspend = builder.makeDeviceEventSuspendResume()
          .with_time('2014-09-25T01:00:00.000Z')
          .with_deviceTime('2014-09-25T01:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_reason({suspended: 'manual'});

        var withStatus = _.assign({}, val, {status: suspend});
        simulator.changeReservoir(withStatus);
        simulator.finalBasal();
        expect(simulator.getEvents()).deep.equals([withStatus]);
      });

      test('throws an error without a status', () => {
        var fn = function() { simulator.changeReservoir(val); };
        expect(fn).to.throw(Error);
      });
    });

    describe('status', () => {
      var suspend = builder.makeDeviceEventSuspendResume()
        .with_time('2014-09-25T01:00:00.000Z')
        .with_deviceTime('2014-09-25T01:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_reason({suspended: 'automatic'});
      var resume = builder.makeDeviceEventResume()
        .with_time('2014-09-25T02:00:00.000Z')
        .with_deviceTime('2014-09-25T02:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_status('resumed')
        .with_reason({resumed: 'manual'});

      test('a suspend does not pass through', () => {
        simulator.suspend(suspend);
        expect(simulator.getEvents()).deep.equals([]);
      });

      test('a resume passes through', () => {
        simulator.resume(resume);
        resume.annotations = [{code: 'status/incomplete-tuple'}];
        expect(simulator.getEvents()).deep.equals([resume.done()]);
      });

      test('uses the timestamp of the first suspend if multiple suspends appear before a single resume', () => {
        var suspend2 = {
          time: '2014-09-25T01:05:00.000Z',
          deviceTime: '2014-09-25T01:05:00',
          timezoneOffset: 0,
          conversionOffset: 0,
          deviceId: 'InsOmn1234',
          type: 'deviceEvent',
          subType: 'status',
          status: 'suspended',
          reason: {suspended: 'automatic'}
        };
        simulator.suspend(suspend);
        simulator.suspend(suspend2);
        simulator.resume(resume);
        var expectedSuspendResume = _.clone(suspend);
        expectedSuspendResume = expectedSuspendResume.with_duration(3600000);
        expect(simulator.getEvents()).deep.equals([expectedSuspendResume.done()]);
      });
    });

    describe('timeChange', () => {
      var change = {
        time: '2014-09-25T01:05:00.000Z',
        deviceTime: '2014-09-25T01:05:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'InsOmn1234',
        type: 'deviceEvent',
        subType: 'timeChange',
        change: {
          from: '2014-09-25T01:05:00',
          to: '2014-09-25T01:00:00',
          agent: 'manual'
        }
      };
      test('passes through', () => {
        simulator.changeDeviceTime(change);
        expect(simulator.getEvents()).deep.equals([change]);
      });
    });
  });

  describe('settings', () => {
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

    test('fills in the suppressed.scheduleName for a temp basal by percentage', () => {
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
        timezoneOffset: 0,
        conversionOffset: 0
      };
      var regBasal1 = builder.makeScheduledBasal()
        .with_time('2014-09-25T18:05:00.000Z')
        .with_deviceTime('2014-09-25T18:05:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3)
        .with_scheduleName('billy');
      var tempBasal = builder.makeTempBasal()
        .with_time('2014-09-25T18:10:00.000Z')
        .with_deviceTime('2014-09-25T18:10:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(0.65)
        .with_percent(0.5)
        .with_duration(1800000);
      var suppressed = {
        type: 'basal',
        deliveryType: 'scheduled',
        rate: 1.3
      };
      tempBasal.set('suppressed', suppressed);
      var regBasal2 = builder.makeScheduledBasal()
        .with_time('2014-09-25T18:40:00.000Z')
        .with_deviceTime('2014-09-25T18:40:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3)
        .with_scheduleName('billy');
      var thisSim = pwdSimulator.make({settings: settings});
      var expectedFirstBasal = _.cloneDeep(regBasal1);
      expectedFirstBasal = expectedFirstBasal.set('duration', 300000).done();
      var expectedSecondBasal = _.cloneDeep(tempBasal).done();
      expectedSecondBasal.suppressed.scheduleName = 'billy';
      var expectedThirdBasal = _.cloneDeep(regBasal2);
      expectedThirdBasal = expectedThirdBasal.set('duration', 19200000).done();
      expectedThirdBasal.annotations = [{code: 'final-basal/fabricated-from-schedule'}];
      thisSim.basal(regBasal1);
      thisSim.basal(tempBasal);
      thisSim.basal(regBasal2);
      thisSim.finalBasal();
      expect(thisSim.getEvents()).deep.equals([
        expectedFirstBasal,
        expectedSecondBasal,
        expectedThirdBasal
      ]);
    });
  });

  describe('finalBasal', () => {
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
      timezoneOffset: 0,
      conversionOffset: 0
    };
    var basal = builder.makeScheduledBasal()
      .with_time('2014-09-25T18:05:00.000Z')
      .with_deviceTime('2014-09-25T18:05:00')
      .with_timezoneOffset(0)
      .with_conversionOffset(0)
      .with_rate(1.3)
      .with_scheduleName('billy');

    test('a single basal passes through with a call to finalBasal when settings available', () => {
      var thisSim = pwdSimulator.make({settings: settings});
      thisSim.basal(basal);
      thisSim.finalBasal();
      var expectedBasal = _.cloneDeep(basal);
      expectedBasal.annotations = [{code: 'final-basal/fabricated-from-schedule'}];
      expectedBasal = expectedBasal.set('duration', 21600000-300000).done();
      expect(thisSim.getEvents()).deep.equals([expectedBasal]);
    });

    test('a single basal gets annotated with a call to finalBasal when settings available but rate doesn\'t match', () => {
      var thisSim = pwdSimulator.make({settings: settings});
      var thisBasal = builder.makeScheduledBasal()
        .with_time('2014-09-25T18:00:00.000Z')
        .with_deviceTime('2014-09-25T18:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.0)
        .with_scheduleName('billy');
      thisSim.basal(thisBasal);
      thisSim.finalBasal();
      var expectedBasal = _.cloneDeep(thisBasal);
      expectedBasal = expectedBasal.set('duration', 0).done();
      expectedBasal.annotations = [{code: 'insulet/basal/off-schedule-rate'}, {code: 'basal/unknown-duration'}];
      expect(thisSim.getEvents()).deep.equals([expectedBasal]);
    });

    test('a single basal gets annotated with a call to finalBasal when settings available but scheduleName doesn\'t match', () => {
      var thisSim = pwdSimulator.make({settings: settings});
      var thisBasal = builder.makeScheduledBasal()
        .with_time('2014-09-25T18:00:00.000Z')
        .with_deviceTime('2014-09-25T18:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3)
        .with_scheduleName('bob');
      thisSim.basal(thisBasal);
      thisSim.finalBasal();
      var expectedBasal = _.cloneDeep(thisBasal);
      expectedBasal = expectedBasal.set('duration', 0).done();
      expectedBasal.annotations = [{code: 'insulet/basal/off-schedule-rate'}, {code: 'basal/unknown-duration'}];
      expect(thisSim.getEvents()).deep.equals([expectedBasal]);
    });

    test('a single basal gets null duration and annotated with a call to finalBasal when settings unavailable', () => {
      var thisBasal = builder.makeScheduledBasal()
        .with_time('2014-09-25T18:05:00.000Z')
        .with_deviceTime('2014-09-25T18:05:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3);
      simulator.basal(thisBasal);
      simulator.finalBasal();
      var expectedBasal = _.cloneDeep(thisBasal);
      expectedBasal = expectedBasal.set('duration', 0).done();
      expectedBasal.annotations = [{code: 'basal/unknown-duration'}];
      expect(simulator.getEvents()).deep.equals([expectedBasal]);
    });

    test('a temp basal is completed ', () => {
      var temp = builder.makeTempBasal()
        .with_time('2014-09-25T18:05:00.000Z')
        .with_deviceTime('2014-09-25T18:05:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3)
        .with_duration(1800000);
      var expectedBasal = _.cloneDeep(temp);
      expectedBasal = expectedBasal.done();
      simulator.basal(temp);
      simulator.finalBasal();
      expect(simulator.getEvents()).deep.equals([expectedBasal]);
    });

    test('a suspend basal is given a null duration and annotated', () => {
      var suspend = builder.makeSuspendBasal()
        .with_time('2014-09-25T18:05:00.000Z')
        .with_deviceTime('2014-09-25T18:05:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0);
      var expectedBasal = _.cloneDeep(suspend);
      expectedBasal = expectedBasal.set('duration', 0).done();
      expectedBasal.annotations = [{code: 'basal/unknown-duration'}];
      simulator.basal(suspend);
      simulator.finalBasal();
      expect(simulator.getEvents()).deep.equals([expectedBasal]);
    });
  });

  describe('event interplay', () => {
    var suspend = builder.makeDeviceEventSuspendResume()
      .with_time('2014-09-25T01:50:00.000Z')
      .with_deviceTime('2014-09-25T01:50:00')
      .with_timezoneOffset(0)
      .with_conversionOffset(0)
      .with_status('suspended')
      .with_reason({suspended: 'manual'});
    var resume = builder.makeDeviceEventResume()
      .with_time('2014-09-25T02:00:00.000Z')
      .with_deviceTime('2014-09-25T02:00:00')
      .with_timezoneOffset(0)
      .with_conversionOffset(0)
      .with_status('resumed')
      .with_reason({resumed: 'manual'});
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

    test('if a new pod is activated, a resume is fabricated before basal resumes', () => {
      simulator.podActivation(resume);
      simulator.basal(basal1);
      simulator.basal(basal2);
      simulator.finalBasal();
      var expectedResume = _.cloneDeep(resume);
      expectedResume = expectedResume.done();
      expectedResume.annotations = [{code: 'status/incomplete-tuple'}];
      var expectedFirstBasal = _.cloneDeep(basal1);
      expectedFirstBasal = expectedFirstBasal.set('duration', 3600000).done();
      var expectedSecondBasal = _.cloneDeep(basal2);
      expectedSecondBasal = expectedSecondBasal.set('duration', 0).done();
      expectedSecondBasal.annotations = [{code: 'basal/unknown-duration'}];
      expect(simulator.getEvents()).deep.equals([
        expectedResume,
        expectedFirstBasal,
        expectedSecondBasal
      ]);
    });

    test('if a new pod is activated and the pump is suspended, the status event is finalized before basal resumes', () => {
      simulator.suspend(suspend);
      simulator.podActivation(resume);
      simulator.basal(basal1);
      simulator.basal(basal2);
      simulator.finalBasal();
      var expectedSuspendResume = _.cloneDeep(suspend).done();
      expectedSuspendResume.duration = 600000;
      var expectedFirstBasal = _.cloneDeep(basal1);
      expectedFirstBasal = expectedFirstBasal.set('duration', 3600000).done();
      var expectedSecondBasal = _.cloneDeep(basal2);
      expectedSecondBasal = expectedSecondBasal.set('duration', 0).done();
      expectedSecondBasal.annotations = [{code: 'basal/unknown-duration'}];
      expect(simulator.getEvents()).deep.equals([
        expectedSuspendResume,
        expectedFirstBasal,
        expectedSecondBasal
      ]);
    });
  });
});
