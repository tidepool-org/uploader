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

/* global beforeEach, describe, it */

var _ = require('lodash');
var expect = require('salinity').expect;

var pwdSimulator = require('../../lib/tandem/tandemSimulator.js');
var builder = require('../../lib/objectBuilder')();

describe('tandemSimulator.js', function() {
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
        conversionOffset: 0,
        deviceId: 'tandem12345',
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
        conversionOffset: 0,
        deviceId: 'tandem12345',
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
        deviceId: 'tandem12345',
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
        deviceId: 'tandem12345',
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
      deviceId: 'tandem12345',
      normal: 1.3,
      type: 'bolus',
      subType: 'normal'
    };

    var val = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      timezoneOffset: 0,
      conversionOffset: 0,
      deviceId: 'tandem12345',
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

    it('does not pass through a zero-volume wizard bolus', function() {
      var zeroWizard = _.assign({}, bolus, {normal: 0.0});
      simulator.bolus(val);
      simulator.bolus(zeroWizard);
      expect(simulator.getEvents()).deep.equals([val]);
    });
  });

  describe('deviceEvent', function() {
  // TODO: these tests are pending until device events are implemented
    describe('alarm', function() {
      it.skip('passes through', function() {
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          timezoneOffset: 0,
          conversionOffset: 0,
          deviceId: 'tandem12345',
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
        deviceId: 'tandem12345',
        type: 'deviceEvent',
        subType: 'reservoirChange'
      };

      it.skip('passes through', function() {
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
        deviceId: 'tandem12345',
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
      var expectedResume = _.assign({}, resume);
      expectedResume = expectedResume.set('previous', suspend).done();

      it.skip('a suspend passes through', function() {
        simulator.suspend(suspend);
        expect(simulator.getEvents()).deep.equals([suspend]);
      });

      it.skip('a resume passes through', function() {
        simulator.resume(resume);
        expect(simulator.getEvents()).deep.equals([resume.done()]);
      });

      it.skip('a resume includes a previous when preceded by a suspend', function() {
        simulator.suspend(suspend);
        simulator.resume(resume);
        expect(simulator.getEvents()).deep.equals([suspend, expectedResume]);
      });

      it.skip('uses the timestamp of the first suspend if multiple suspends appear before a single resume', function() {
        var suspend2 = {
          time: '2014-09-25T01:05:00.000Z',
          deviceTime: '2014-09-25T01:05:00',
          timezoneOffset: 0,
          conversionOffset: 0,
          deviceId: 'tandem12345',
          type: 'deviceEvent',
          subType: 'status',
          status: 'suspended',
          reason: {suspended: 'automatic'}
        };
        simulator.suspend(suspend);
        simulator.suspend(suspend2);
        simulator.resume(resume);
        expect(simulator.getEvents()).deep.equals([suspend, expectedResume]);
      });
    });

    describe('timeChange', function() {
      var change = {
        time: '2014-09-25T01:05:00.000Z',
        deviceTime: '2014-09-25T01:05:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'tandem12345',
        type: 'deviceEvent',
        subType: 'timeChange',
        change: {
          from: '2014-09-25T01:05:00',
          to: '2014-09-25T01:00:00',
          agent: 'manual'
        }
      };
      it('passes through', function() {
        simulator.changeDeviceTime(change);
        expect(simulator.getEvents()).deep.equals([change]);
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

    it('sets previous on basals other than the first', function() {
      var expectedFirstBasal = _.cloneDeep(basal1);
      expectedFirstBasal = expectedFirstBasal.set('duration', 3600000).done();
      var expectedSecondBasal = _.cloneDeep(basal2);
      expectedSecondBasal = expectedSecondBasal.set('duration', 1800000)
        .set('previous', expectedFirstBasal)
        .done();
      var expectedThirdBasal = _.cloneDeep(basal3);
      expectedThirdBasal = expectedThirdBasal.set('duration', 0)
        .set('previous', _.omit(expectedSecondBasal, 'previous'))
        .done();
      expectedThirdBasal.annotations = [{code: 'basal/unknown-duration'}];
      simulator.basal(basal1);
      simulator.basal(basal2);
      simulator.basal(basal3);
      simulator.finalBasal();
      expect(simulator.getEvents()).deep.equals([
        expectedFirstBasal,
        expectedSecondBasal,
        expectedThirdBasal
      ]);
    });

    // TODO: these tests are pending until suppressed basals are handled
    it.skip('fills in the suppressed.scheduleName for a temp basal by percentage', function() {
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
      var suppressed = builder.makeScheduledBasal()
        .with_time('2014-09-25T18:10:00.000Z')
        .with_deviceTime('2014-09-25T18:10:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3)
        .with_duration(1800000);
      tempBasal.with_suppressed(suppressed);
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
      var expectedSecondBasal = _.cloneDeep(tempBasal);
      expectedSecondBasal.set('previous', expectedFirstBasal);
      expectedSecondBasal.suppressed = expectedSecondBasal.suppressed
        .set('scheduleName', 'billy').done();
      expectedSecondBasal = expectedSecondBasal.done();
      var expectedThirdBasal = _.cloneDeep(regBasal2);
      expectedThirdBasal = expectedThirdBasal.set('duration', 19200000)
        .set('previous', _.omit(expectedSecondBasal, 'previous'))
        .done();
      expectedThirdBasal.annotations = [{code: 'insulet/basal/fabricated-from-schedule'}];
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

  describe('newDay', function() {
    it('fabricated from new day event', function () {
      var currBasal = builder.makeScheduledBasal()
        .with_time('2014-09-25T18:05:00.000Z')
        .with_deviceTime('2014-09-25T18:05:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3);

      var newDay = builder.makeScheduledBasal()
        .with_time('2014-09-26T00:00:00.000Z')
        .with_deviceTime('2014-09-26T00:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3);
      newDay.set('type', 'new-day');

      simulator.basal(currBasal);
      simulator.newDay(newDay);
      simulator.finalBasal();

      var events = simulator.getEvents();
      var lastEvent = events[events.length - 1];
      expect(lastEvent.type).to.equal('basal');
      expect(lastEvent.annotations[0].code).to.equal('tandem/basal/fabricated-from-new-day');

    });
  });

  describe('finalBasal', function() {
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

    it('a temp basal is completed ', function() {
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

    it('a suspend basal is given a null duration and annotated', function() {
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

  describe('event interplay', function() {
    it('new-day event does not pass through as scheduled basal when pump is suspended', function() {

      var basal = builder.makeScheduledBasal()
        .with_time('2014-09-25T15:00:00.000Z')
        .with_deviceTime('2014-09-25T15:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3);

      var suspendEvent = builder.makeDeviceEventSuspend()
        .with_reason({suspended: 'manual'})
        .with_time('2014-09-25T18:05:00.000Z')
        .with_deviceTime('2014-09-25T18:05:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .done();

      var suspend = builder.makeSuspendBasal()
        .with_time('2014-09-25T18:05:00.000Z')
        .with_deviceTime('2014-09-25T18:05:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0);

      var newDay = builder.makeScheduledBasal()
        .with_time('2014-09-26T00:00:00.000Z')
        .with_deviceTime('2014-09-26T00:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_rate(1.3);
      newDay.set('type', 'new-day');

      simulator.basal(basal);
      simulator.suspend(suspendEvent);
      simulator.basal(suspend);
      simulator.newDay(newDay);

      expect(simulator.getEvents()).deep.equals([basal.done(),suspendEvent]);
    });

  });

});
