/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2017, Tidepool Project
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

/* eslint-disable prefer-arrow-callback,func-names,space-before-function-paren */

import _ from 'lodash';
import { expect } from 'chai';
import sundial from 'sundial';

import Medtronic600Simulator from '../../../lib/drivers/medtronic600/medtronic600Simulator';
import { NGPTimestamp } from '../../../lib/drivers/medtronic600/NGPUtil';
import builder from '../../../lib/objectBuilder';
import TZOUtil from '../../../lib/TimezoneOffsetUtil';

function addIndex(event) {
  // Use a hardcoded offset of -1643956064
  const rtc = (sundial.parseFromFormat(event.deviceTime).getTime() / 1000)
    - 946684800 - -1643956064;
  event.set('index', rtc);
  return rtc;
}

function updateExpected(expectedEvent) {
  expectedEvent.set('payload', {
    logIndices: [expectedEvent.index],
  });
  // eslint-disable-next-line no-param-reassign
  delete expectedEvent.index;
}

describe('medtronic600Simulator.js', () => {
  let simulator = null;
  const tzoUtil = new TZOUtil('GMT', '2015-06-01T00:00:00.000Z', []);
  const settings = {
    currentNgpTimestamp: new NGPTimestamp(2186757135, -1643995250),
  };

  beforeEach(() => {
    simulator = new Medtronic600Simulator({
      builder: builder(),
      tzoUtil,
      settings,
    });
  });

  describe('smbg', () => {
    const manual = {
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      timezoneOffset: 0,
      conversionOffset: 0,
      deviceId: 'medronic12345',
      units: 'mg/dL',
      type: 'smbg',
      subType: 'manual',
      value: 1.3,
    };

    const linked = {
      time: '2014-09-25T01:08:00.000Z',
      deviceTime: '2014-09-25T01:08:00',
      timezoneOffset: 0,
      conversionOffset: 0,
      deviceId: 'medtronic12345',
      units: 'mg/dL',
      type: 'smbg',
      subType: 'linked',
      value: 1.3,
    };

    test('should pass through', () => {
      const val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'medtronic12345',
        units: 'mg/dL',
        type: 'smbg',
        value: 1.3,
      };

      simulator.smbg(val);
      expect(simulator.getEvents()).deep.equals([val]);
    });

    test('should drop manual if the same value is linked within 15 minutes', () => {
      simulator.smbg(linked);
      simulator.smbg(manual);
      expect(simulator.getEvents()).deep.equals([linked]);
    });

    test('should drop exact duplicate linked values', () => {
      simulator.smbg(linked);
      simulator.smbg(linked);

      expect(simulator.getEvents()).deep.equals([linked]);
    });
  });

  describe('bolus', () => {
    describe('normal', () => {
      const val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'medtronic12345',
        normal: 1.3,
        type: 'bolus',
        subType: 'normal',
      };

      test('should pass through', () => {
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });

      test('should not pass through a zero-volume bolus that does not have an expectedNormal', () => {
        const zeroBolus = _.assign({}, val, {
          normal: 0.0,
          time: '2014-09-25T01:05:00.000Z',
          deviceTime: '2014-09-25T01:05:00',
        });
        simulator.bolus(val);
        simulator.bolus(zeroBolus);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });

    describe('square', () => {
      const val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'medtronic12345',
        extended: 1.4,
        duration: 1800000,
        type: 'bolus',
        subType: 'square',
      };

      test('should pass through', () => {
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });

    describe('dual', () => {
      const val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        timezoneOffset: 0,
        conversionOffset: 0,
        deviceId: 'medtronic12345',
        normal: 1.3,
        extended: 1.4,
        duration: 0,
        type: 'bolus',
        subType: 'dual/square',
      };

      test('should pass through', () => {
        simulator.bolus(val);
        expect(simulator.getEvents()).deep.equals([val]);
      });
    });
  });

  describe('wizard', () => {
    test('should pass through', () => {
      const wizard = {
        bgTarget: {
          high: 5.5,
          low: 5,
        },
        bolus: {
          clockDriftOffset: 0,
          conversionOffset: 0,
          deviceTime: '2017-02-10T15:54:36',
          normal: 8.55,
          payload: {
            logIndices: [
              2184052526,
            ],
          },
          subType: 'normal',
          time: '2017-02-10T15:54:36.000Z',
          timezoneOffset: 0,
          type: 'bolus',
        },
        carbInput: 60,
        clockDriftOffset: 0,
        conversionOffset: 0,
        deviceTime: '2017-02-10T15:48:52',
        index: 2184052182,
        insulinCarbRatio: 7,
        insulinOnBoard: 1.3,
        insulinSensitivity: 3.5,
        payload: {
          logIndices: [
            2184052182,
          ],
        },
        recommended: {
          carb: 8.55,
          correction: 0,
          net: 8.55,
        },
        time: '2017-02-10T15:48:52.000Z',
        timezoneOffset: 0,
        type: 'wizard',
        units: 'mmol/L',
      };

      simulator.wizard(wizard);
      expect(simulator.getEvents()).deep.equals([wizard]);
    });
  });

  describe('settings', () => {
    const pumpSettings = {
      type: 'pumpSettings',
      time: '2014-09-25T01:00:00.000Z',
      deviceTime: '2014-09-25T01:00:00',
      activeSchedule: 'billy',
      units: {
        bg: 'mg/dL',
      },
      basalSchedules: {
        billy: [{
          start: 0,
          rate: 1.0,
        }, {
          start: 21600000,
          rate: 1.1,
        }],
        bob: [{
          start: 0,
          rate: 0.0,
        }],
      },
      carbRatio: [{
        start: 0,
        amount: 1.0,
      }, {
        start: 21600000,
        amount: 1.1,
      }, {
        start: 0,
        amount: 0.0,
      }],
      insulinSensitivity: [{
        start: 0,
        amount: 1.0,
      }, {
        start: 21600000,
        amount: 1.1,
      }, {
        start: 0,
        amount: 0.0,
      }],
      bgTarget: [{
        start: 0,
        target: 100,
        range: 15,
      }, {
        start: 21600000,
        target: 110,
        range: 15,
      }],
      timezoneOffset: 0,
      conversionOffset: 0,
    };

    test('should pass through', () => {
      simulator.pumpSettings(pumpSettings);
      expect(simulator.getEvents()).deep.equals([pumpSettings]);
    });
  });

  describe('basal', () => {
    test('should set duration using a following basal', () => {
      const basal1 = simulator.config.builder.makeScheduledBasal()
        .with_time('2014-09-25T02:00:00.000Z')
        .with_deviceTime('2014-09-25T02:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_scheduleName('Pattern 1')
        .with_rate(0.75);
      const basal2 = simulator.config.builder.makeScheduledBasal()
        .with_time('2014-09-25T03:00:00.000Z')
        .with_deviceTime('2014-09-25T03:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_scheduleName('Pattern 1')
        .with_rate(0.85);

      const expectedFirstBasal = _.cloneDeep(basal1);
      expectedFirstBasal.set('duration', 3600000);

      simulator.basal(basal1);
      simulator.basal(basal2);
      expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done()]);
    });

    describe('temp basal', () => {
      test('should correct a restored scheduled basal start time after a temp basal', () => {
        const basal1 = simulator.config.builder.makeTempBasal()
          .with_time('2017-02-09T13:11:41.000Z')
          .with_deviceTime('2017-02-09T13:11:41')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(0.75)
          .with_duration(2186000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.5,
            scheduleName: 'Pattern 1',
          });
        addIndex(basal1);
        const basal2 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-09T13:49:00.000Z')
          .with_deviceTime('2017-02-09T13:49:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.5);
        const basal3 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-09T14:00:00.000Z')
          .with_deviceTime('2017-02-09T14:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.7);

        const expectedFirstBasal = _.cloneDeep(basal1);
        updateExpected(expectedFirstBasal);

        const expectedSecondBasal = _.cloneDeep(basal2);
        expectedSecondBasal
          .set('duration', 713000)
          .set('time', '2017-02-09T13:48:07.000Z')
          .set('deviceTime', '2017-02-09T13:48:07')
          .set('clockDriftOffset', 0)
          .set('payload', {
            logIndices: [2183917165],
          });

        simulator.basal(basal1);
        simulator.basal(basal2);
        simulator.basal(basal3);
        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(),
          expectedSecondBasal.done(),
        ]);
      });

      test('should ignore a segment change event when that segment is already active', () => {
        const basal1 = simulator.config.builder.makeTempBasal()
          .with_time('2017-02-09T13:11:41.000Z')
          .with_deviceTime('2017-02-09T13:11:41')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(0.75)
          .with_duration(2186000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.5,
            scheduleName: 'Pattern 1',
          });
        const basal2 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-09T13:12:00.000Z')
          .with_deviceTime('2017-02-09T13:12:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.5);

        simulator.basal(basal1);
        simulator.basal(basal2);
        expect(simulator.getEvents().length === 1);
      });

      test('should check for basal schedule changes', () => {
        const basal1 = simulator.config.builder.makeTempBasal()
          .with_time('2017-02-09T19:27:43.000Z')
          .with_deviceTime('2017-02-09T19:27:43')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(0)
          .with_duration(2700000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.4,
            scheduleName: 'Pattern 1',
          });
        const basal2 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-09T20:00:00.000Z')
          .with_deviceTime('2017-02-09T20:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.2);
        addIndex(basal2);
        const basal3 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-09T20:13:00.000Z')
          .with_deviceTime('2017-02-09T20:13:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_duration(1000)
          .with_rate(1.2);

        const expectedFirstBasal = _.cloneDeep(basal1);
        expectedFirstBasal
          .set('duration', 1937000);

        const expectedSecondBasal = _.cloneDeep(basal1);
        expectedSecondBasal
          .set('duration', 763000)
          .set('time', '2017-02-09T20:00:00.000Z')
          .set('deviceTime', '2017-02-09T20:00:00')
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.2,
            scheduleName: 'Pattern 1',
          })
          .set('payload', {
            logIndices: [2183941664],
          });

        const expectedThirdBasal = _.cloneDeep(basal2);
        expectedThirdBasal
          .set('duration', 1000)
          .set('time', '2017-02-09T20:12:43.000Z')
          .set('deviceTime', '2017-02-09T20:12:43')
          .set('clockDriftOffset', 0)
          .set('payload', {
            logIndices: [2183941664],
          });
        delete expectedThirdBasal.index;

        simulator.basal(basal1);
        simulator.basal(basal2);
        simulator.basal(basal3);
        simulator.finalBasal();
        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(),
          expectedSecondBasal.done(), expectedThirdBasal.done(),
        ]);
      });

      test('should change temp basal rate for percentage basals across a basal schedule change', () => {
        const basal1 = simulator.config.builder.makeTempBasal()
          .with_time('2017-01-28T22:41:00.000Z')
          .with_deviceTime('2017-01-28T22:41:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_percent(1.25)
          .with_rate(1.75)
          .with_duration(5400000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.4,
            scheduleName: 'Pattern 1',
          });
        const basal2 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-01-29T00:00:00.000Z')
          .with_deviceTime('2017-01-29T00:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.5);
        addIndex(basal2);
        const basal3 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-01-29T01:00:00.000Z')
          .with_deviceTime('2017-01-29T01:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_duration(1000)
          .with_rate(1.4);

        const expectedFirstBasal = _.cloneDeep(basal1);
        expectedFirstBasal
          .set('duration', 4740000);

        const expectedSecondBasal = _.cloneDeep(basal1);
        expectedSecondBasal
          .set('duration', 660000)
          .set('time', '2017-01-29T00:00:00.000Z')
          .set('deviceTime', '2017-01-29T00:00:00')
          .set('rate', 1.875)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.5,
            scheduleName: 'Pattern 1',
          })
          .set('payload', {
            logIndices: [2182919264],
          });

        const expectedThirdBasal = _.cloneDeep(basal2);
        expectedThirdBasal
          .set('time', '2017-01-29T00:11:00.000Z')
          .set('deviceTime', '2017-01-29T00:11:00')
          .set('duration', 2940000)
          .set('clockDriftOffset', 0)
          .set('payload', {
            logIndices: [2182919264],
          });
        delete expectedThirdBasal.index;

        simulator.basal(basal1);
        simulator.basal(basal2);
        simulator.basal(basal3);
        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(),
          expectedSecondBasal.done(), expectedThirdBasal.done(),
        ]);
      });

      test('should handle temp basals ending near schedule change boundaries', () => {
        const basal1 = simulator.config.builder.makeTempBasal()
          .with_time('2017-02-10T08:29:24.000Z')
          .with_deviceTime('2017-02-10T08:29:24')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(0)
          .with_duration(1800000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.2,
            scheduleName: 'Pattern 1',
          });
        addIndex(basal1);
        const basal2 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-10T09:00:00.000Z')
          .with_deviceTime('2017-02-10T09:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 2')
          .with_duration(1000)
          .with_rate(1.4);
        addIndex(basal2);

        const expectedFirstBasal = _.cloneDeep(basal1);
        updateExpected(expectedFirstBasal);

        const expectedSecondBasal = _.cloneDeep(basal2);
        expectedSecondBasal
          .set('duration', 36000)
          .set('rate', 1.2)
          .set('scheduleName', 'Pattern 1')
          .set('time', '2017-02-10T08:59:24.000Z')
          .set('deviceTime', '2017-02-10T08:59:24')
          .set('clockDriftOffset', 0)
          .set('payload', {
            logIndices: [2183986628],
          });
        delete expectedSecondBasal.index;

        const expectedThirdBasal = _.cloneDeep(basal2);
        expectedThirdBasal.set('payload', {
          logIndices: [2183988464],
        });
        delete expectedThirdBasal.index;

        simulator.basal(basal1);
        simulator.basal(basal2);
        simulator.finalBasal();
        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(),
          expectedSecondBasal.done(), expectedThirdBasal.done(),
        ]);
      });

      test('should handle back to back temp basals', () => {
        const basal1 = simulator.config.builder.makeTempBasal()
          .with_time('2017-02-04T05:33:03.000Z')
          .with_deviceTime('2017-02-04T05:33:03')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(0)
          .with_duration(1800000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.2,
            scheduleName: 'Pattern 1',
          });
        addIndex(basal1);
        const basal2 = simulator.config.builder.makeTempBasal()
          .with_time('2017-02-04T06:03:22.000Z')
          .with_deviceTime('2017-02-04T06:03:22')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(0)
          .with_duration(1800000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.2,
            scheduleName: 'Pattern 1',
          });

        const expectedFirstBasal = _.cloneDeep(basal1);
        updateExpected(expectedFirstBasal);

        const expectedSecondBasal = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-04T06:03:03.000Z')
          .with_deviceTime('2017-02-04T06:03:03')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_duration(19000)
          .with_rate(1.2)
          .set('clockDriftOffset', 0)
          .set('payload', {
            logIndices: [2183457647],
          });

        const expectedThirdBasal = _.cloneDeep(basal2);

        simulator.basal(basal1);
        simulator.basal(basal2);
        simulator.finalBasal();
        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(),
          expectedSecondBasal.done(), expectedThirdBasal.done(),
        ]);
      });
    });

    describe('pump suspend', () => {
      test('should set suppressed info for suspended basal', () => {
        const basal1 = simulator.config.builder.makeScheduledBasal()
          .with_time('2014-09-25T01:00:00.000Z')
          .with_deviceTime('2014-09-25T01:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Alice')
          .with_rate(1);

        const suspendResume = simulator.config.builder.makeDeviceEventSuspendResume()
          .with_time('2014-09-25T02:00:00.000Z')
          .with_deviceTime('2014-09-25T02:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(3600000)
          .with_reason({
            resumed: 'automatic',
          })
          .done();

        const suspendedBasal = simulator.config.builder.makeSuspendBasal()
          .with_time('2014-09-25T02:00:00.000Z')
          .with_deviceTime('2014-09-25T02:00:00')
          .with_duration(3600000)
          .with_timezoneOffset(0)
          .with_conversionOffset(0);

        const basal2 = simulator.config.builder.makeScheduledBasal()
          .with_time('2014-09-25T03:00:00.000Z')
          .with_deviceTime('2014-09-25T01:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Alice')
          .with_duration(3600000)
          .with_rate(1.2);

        const expectedFirstBasal = _.cloneDeep(basal1);
        expectedFirstBasal.set('duration', 3600000);

        const expectedSuspendedBasal = _.cloneDeep(suspendedBasal);
        const suppressed = {
          type: 'basal',
          deliveryType: 'scheduled',
          rate: 1,
          scheduleName: 'Alice',
        };
        expectedSuspendedBasal.set('suppressed', suppressed);

        const expectedSecondBasal = _.cloneDeep(basal2);

        simulator.basal(basal1);
        simulator.suspendResume(suspendResume);
        simulator.basal(suspendedBasal);
        simulator.basal(basal2);
        simulator.finalBasal();

        expect(simulator.getEvents()).deep.equals([
          expectedFirstBasal.done(), suspendResume, expectedSuspendedBasal.done(),
          expectedSecondBasal.done(),
        ]);
      });

      test('should set a restored scheduled basal after a pump suspend', () => {
        const basal1 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-09T15:00:00.000Z')
          .with_deviceTime('2017-02-09T15:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.4);
        const suspendResume = simulator.config.builder.makeDeviceEventSuspendResume()
          .with_time('2017-02-09T18:12:18.000Z')
          .with_deviceTime('2017-02-09T18:12:18')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(652000)
          .with_reason({
            suspended: 'automatic',
            resumed: 'manual',
          })
          .done();
        const suspendedBasal = simulator.config.builder.makeSuspendBasal()
          .with_time('2017-02-09T18:12:18.000Z')
          .with_deviceTime('2017-02-09T18:12:18')
          .with_duration(652000)
          .with_timezoneOffset(0)
          .with_conversionOffset(0);
        const basal2 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-09T18:24:00.000Z')
          .with_deviceTime('2017-02-09T18:24:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_duration(1000)
          .with_rate(1.2);

        const expectedFirstBasal = _.cloneDeep(basal1);
        expectedFirstBasal.set('duration', 11538000);

        const expectedSuspendedBasal = _.cloneDeep(suspendedBasal);
        const suppressed = {
          type: 'basal',
          deliveryType: 'scheduled',
          rate: 1.4,
          scheduleName: 'Pattern 1',
        };
        expectedSuspendedBasal.set('suppressed', suppressed);

        const expectedSecondBasal = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-09T18:23:10.000Z')
          .with_deviceTime('2017-02-09T18:23:10')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(50000)
          .with_scheduleName('Pattern 1')
          .with_rate(1.4);

        simulator.basal(basal1);
        simulator.suspendResume(suspendResume);
        simulator.basal(suspendedBasal);
        simulator.basal(basal2);
        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(), suspendResume,
          expectedSuspendedBasal.done(), expectedSecondBasal.done(),
        ]);
      });

      test('should handle a pump suspend that crosses multiple schedule changes', () => {
        const basal1 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-05-18T00:00:00.000Z')
          .with_deviceTime('2017-05-18T00:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.35);
        const suspendResume = simulator.config.builder.makeDeviceEventSuspendResume()
          .with_time('2017-05-18T00:30:00.000Z')
          .with_deviceTime('2017-05-18T00:30:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(7200000)
          .with_reason({
            suspended: 'automatic',
            resumed: 'manual',
          })
          .done();
        const suspendedBasal = simulator.config.builder.makeSuspendBasal()
          .with_time('2017-05-18T00:30:00.000Z')
          .with_deviceTime('2017-05-18T00:30:00')
          .with_duration(7200000)
          .with_timezoneOffset(0)
          .with_conversionOffset(0);
        const basal2 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-05-18T01:00:00.000Z')
          .with_deviceTime('2017-05-18T01:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.25);
        const basal3 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-05-18T02:00:00.000Z')
          .with_deviceTime('2017-05-18T02:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_duration(3600000)
          .with_rate(1.3);

        const expectedFirstBasal = _.cloneDeep(basal1);
        expectedFirstBasal.set('duration', 1800000);

        const expectedFirstSuspendedBasal = _.cloneDeep(suspendedBasal);
        expectedFirstSuspendedBasal
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.35,
            scheduleName: 'Pattern 1',
          })
          .set('duration', 1800000);

        const expectedSecondSuspendedBasal = _.cloneDeep(expectedFirstSuspendedBasal);
        expectedSecondSuspendedBasal
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.25,
            scheduleName: 'Pattern 1',
          })
          .set('duration', 3600000)
          .set('time', '2017-05-18T01:00:00.000Z')
          .set('deviceTime', '2017-05-18T01:00:00');

        const expectedThirdSuspendedBasal = _.cloneDeep(expectedFirstSuspendedBasal);
        expectedThirdSuspendedBasal
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.3,
            scheduleName: 'Pattern 1',
          })
          .set('duration', 1800000)
          .set('time', '2017-05-18T02:00:00.000Z')
          .set('deviceTime', '2017-05-18T02:00:00');

        const expectedSecondBasal = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-05-18T02:30:00.000Z')
          .with_deviceTime('2017-05-18T02:30:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(1800000)
          .with_scheduleName('Pattern 1')
          .with_rate(1.3);

        simulator.basal(basal1);
        simulator.suspendResume(suspendResume);
        simulator.basal(suspendedBasal);
        simulator.basal(basal2);
        simulator.basal(basal3);
        simulator.finalBasal();
        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(), suspendResume,
          expectedFirstSuspendedBasal.done(), expectedSecondSuspendedBasal.done(),
          expectedThirdSuspendedBasal.done(), expectedSecondBasal.done(),
        ]);
      });

      test('should handle back to back pump suspends', () => {
        const basal1 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-01T20:00:00.000Z')
          .with_deviceTime('2017-02-01T20:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.4);
        const suspendResume1 = simulator.config.builder.makeDeviceEventSuspendResume()
          .with_time('2017-02-01T22:20:30.000Z')
          .with_deviceTime('2017-02-01T22:20:30')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(170000)
          .with_reason({
            suspended: 'manual',
            resumed: 'manual',
          })
          .done();
        const suspendedBasal1 = simulator.config.builder.makeSuspendBasal()
          .with_time('2017-02-01T22:20:30.000Z')
          .with_deviceTime('2017-02-01T22:20:30')
          .with_duration(170000)
          .with_timezoneOffset(0)
          .with_conversionOffset(0);
        const suspendResume2 = simulator.config.builder.makeDeviceEventSuspendResume()
          .with_time('2017-02-01T22:23:27.000Z')
          .with_deviceTime('2017-02-01T22:23:27')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(544000)
          .with_reason({
            suspended: 'manual',
            resumed: 'manual',
          })
          .done();
        const suspendedBasal2 = simulator.config.builder.makeSuspendBasal()
          .with_time('2017-02-01T22:23:27.000Z')
          .with_deviceTime('2017-02-01T22:23:27')
          .with_duration(544000)
          .with_timezoneOffset(0)
          .with_conversionOffset(0);
        const basal2 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-01T22:35:00.000Z')
          .with_deviceTime('2017-02-01T22:35:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_duration(1000)
          .with_rate(1.2);

        const expectedFirstBasal = _.cloneDeep(basal1);
        expectedFirstBasal.set('duration', 8430000);

        const suppressed = {
          type: 'basal',
          deliveryType: 'scheduled',
          rate: 1.4,
          scheduleName: 'Pattern 1',
        };
        const expectedFirstSuspendedBasal = _.cloneDeep(suspendedBasal1);
        expectedFirstSuspendedBasal.set('suppressed', suppressed);

        const expectedSecondBasal = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-01T22:23:20.000Z')
          .with_deviceTime('2017-02-01T22:23:20')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(7000)
          .with_scheduleName('Pattern 1')
          .with_rate(1.4);

        const expectedSecondSuspendedBasal = _.cloneDeep(suspendedBasal2);
        expectedSecondSuspendedBasal.set('suppressed', suppressed);

        const expectedThirdBasal = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-01T22:32:31.000Z')
          .with_deviceTime('2017-02-01T22:32:31')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_duration(149000)
          .with_scheduleName('Pattern 1')
          .with_rate(1.4);

        simulator.basal(basal1);
        simulator.suspendResume(suspendResume1);
        simulator.basal(suspendedBasal1);
        simulator.suspendResume(suspendResume2);
        simulator.basal(suspendedBasal2);
        simulator.basal(basal2);
        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(), suspendResume1,
          expectedFirstSuspendedBasal.done(), expectedSecondBasal.done(),
          suspendResume2, expectedSecondSuspendedBasal.done(),
          expectedThirdBasal.done(),
        ]);
      });

      test('should handle a pump suspend during a temp basal', () => {
        const basal1 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-04T17:00:00.000Z')
          .with_deviceTime('2017-02-04T17:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.2);
        addIndex(basal1);
        const basal2 = simulator.config.builder.makeTempBasal()
          .with_time('2017-02-04T17:03:22.000Z')
          .with_deviceTime('2017-02-04T17:03:22')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(0)
          .with_duration(1778000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.2,
            scheduleName: 'Pattern 1',
          });
        addIndex(basal2);
        const suspendResume = simulator.config.builder.makeDeviceEventSuspendResume()
          .with_time('2017-02-04T17:07:02.000Z')
          .with_deviceTime('2017-02-04T17:07:02')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(887000)
          .with_reason({
            suspended: 'automatic',
            resumed: 'automatic',
          })
          .done();
        const suspendedBasal = simulator.config.builder.makeSuspendBasal()
          .with_time('2017-02-04T17:07:02.000Z')
          .with_deviceTime('2017-02-04T17:07:02')
          .with_duration(887000)
          .with_timezoneOffset(0)
          .with_conversionOffset(0);
        const basal3 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-04T17:34:00.000Z')
          .with_deviceTime('2017-02-04T17:34:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.2);
        const basal4 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-04T18:00:00.000Z')
          .with_deviceTime('2017-02-04T18:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_duration(1000)
          .with_rate(1.5);

        const expectedFirstBasal = _.cloneDeep(basal1);
        expectedFirstBasal
          .set('duration', 202000);
        updateExpected(expectedFirstBasal);

        const expectedSecondBasal = _.cloneDeep(basal2);
        expectedSecondBasal
          .set('duration', 220000);
        updateExpected(expectedSecondBasal);

        const expectedFirstSuspendedBasal = _.cloneDeep(suspendedBasal);
        expectedFirstSuspendedBasal.set('suppressed', {
          type: 'basal',
          deliveryType: 'temp',
          rate: 0,
          suppressed: {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.2,
            scheduleName: 'Pattern 1',
          },
        });

        const expectedThirdBasal = _.cloneDeep(basal2);
        expectedThirdBasal
          .set('duration', 671000)
          .set('time', '2017-02-04T17:21:49.000Z')
          .set('deviceTime', '2017-02-04T17:21:49')
          .set('payload', {
            logIndices: [2183499066],
          });
        delete expectedThirdBasal.index;

        const expectedFourthBasal = _.cloneDeep(basal1);
        expectedFourthBasal
          .set('duration', 1620000)
          .set('time', '2017-02-04T17:33:00.000Z')
          .set('deviceTime', '2017-02-04T17:33:00')
          .set('clockDriftOffset', 0)
          .set('payload', {
            logIndices: [2183499066],
          });
        delete expectedFourthBasal.index;

        simulator.basal(basal1);
        simulator.basal(basal2);
        simulator.suspendResume(suspendResume);
        simulator.basal(suspendedBasal);
        simulator.basal(basal3);
        simulator.basal(basal4);

        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(),
          expectedSecondBasal.done(), suspendResume, expectedFirstSuspendedBasal.done(),
          expectedThirdBasal.done(), expectedFourthBasal.done(),
        ]);
      });

      test('should handle a pump suspend that starts during a temp basal and finishes after the end of the temp basal, including a scheduled basal change', () => {
        const basal1 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-10T06:00:00.000Z')
          .with_deviceTime('2017-02-10T06:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.4);
        const basal2 = simulator.config.builder.makeTempBasal()
          .with_time('2017-02-10T06:27:43.000Z')
          .with_deviceTime('2017-02-10T06:27:43')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_rate(0.75)
          .with_duration(2657000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.4,
            scheduleName: 'Pattern 1',
          });
        const basal3 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-10T07:00:00.000Z')
          .with_deviceTime('2017-02-10T07:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.2);
        addIndex(basal3);
        const suspendResume = simulator.config.builder.makeDeviceEventSuspendResume()
          .with_time('2017-02-10T07:02:18.000Z')
          .with_deviceTime('2017-02-10T07:02:18')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(2399000)
          .with_reason({
            suspended: 'automatic',
            resumed: 'automatic',
          })
          .done();
        const suspendedBasal = simulator.config.builder.makeSuspendBasal()
          .with_time('2017-02-10T07:02:18.000Z')
          .with_deviceTime('2017-02-10T07:02:18')
          .with_duration(2399000)
          .with_timezoneOffset(0)
          .with_conversionOffset(0);
        const basal4 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-10T07:13:00.000Z')
          .with_deviceTime('2017-02-10T07:13:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.2);
        const basal5 = simulator.config.builder.makeScheduledBasal()
          .with_time('2017-02-10T08:00:00.000Z')
          .with_deviceTime('2017-02-10T08:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_duration(1000)
          .with_rate(1.5);

        const expectedFirstBasal = _.cloneDeep(basal1);
        expectedFirstBasal.set('duration', 1663000);

        const expectedSecondBasal = _.cloneDeep(basal2);
        expectedSecondBasal.set('duration', 1937000);

        const expectedThirdBasal = _.cloneDeep(basal2);
        expectedThirdBasal
          .set('duration', 138000)
          .set('time', '2017-02-10T07:00:00.000Z')
          .set('deviceTime', '2017-02-10T07:00:00');
        expectedThirdBasal
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.2,
            scheduleName: 'Pattern 1',
          })
          .set('payload', {
            logIndices: [2183981264],
          });

        const expectedFirstSuspendedBasal = _.cloneDeep(suspendedBasal);
        expectedFirstSuspendedBasal
          .set('duration', 582000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'temp',
            rate: 0.75,
            suppressed: {
              type: 'basal',
              deliveryType: 'scheduled',
              rate: 1.2,
              scheduleName: 'Pattern 1',
            },
          });

        const expectedSecondSuspendedBasal = _.cloneDeep(suspendedBasal);
        expectedSecondSuspendedBasal
          .set('time', '2017-02-10T07:12:00.000Z')
          .set('deviceTime', '2017-02-10T07:12:00')
          .set('duration', 1817000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.2,
            scheduleName: 'Pattern 1',
          });

        const expectedFourthBasal = _.cloneDeep(basal3);
        expectedFourthBasal
          .set('duration', 1063000)
          .set('time', '2017-02-10T07:42:17.000Z')
          .set('deviceTime', '2017-02-10T07:42:17')
          .set('clockDriftOffset', 0)
          .set('payload', {
            logIndices: [2183981264],
          });
        delete expectedFourthBasal.index;

        simulator.basal(basal1);
        simulator.basal(basal2);
        simulator.basal(basal3);
        simulator.suspendResume(suspendResume);
        simulator.basal(suspendedBasal);
        simulator.basal(basal4);
        simulator.basal(basal5);

        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(),
          expectedSecondBasal.done(), expectedThirdBasal.done(), suspendResume,
          expectedFirstSuspendedBasal.done(),
          expectedSecondSuspendedBasal.done(), expectedFourthBasal.done(),
        ]);
      });

      test('should handle a pump suspend that starts during a temp basal and finishes before the end of the temp basal, including a scheduled basal change', () => {
        const basal1 = simulator.config.builder.makeScheduledBasal()
          .with_time('2018-05-18T06:00:00.000Z')
          .with_deviceTime('2018-05-18T06:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.5);
        const basal2 = simulator.config.builder.makeTempBasal()
          .with_time('2018-05-18T11:04:17.000Z')
          .with_deviceTime('2018-05-18T11:04:17')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_percent(2.0)
          .with_rate(3.0)
          .with_duration(14400000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.5,
            scheduleName: 'Pattern 1',
          });
        const suspendResume = simulator.config.builder.makeDeviceEventSuspendResume()
          .with_time('2018-05-18T11:15:17.000Z')
          .with_deviceTime('2018-05-18T11:15:17')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_status('suspended')
          .with_duration(7243000)
          .with_reason({
            suspended: 'automatic',
            resumed: 'automatic',
          })
          .done();
        const suspendedBasal = simulator.config.builder.makeSuspendBasal()
          .with_time('2018-05-18T11:15:17.000Z')
          .with_deviceTime('2018-05-18T11:15:17')
          .with_duration(7243000)
          .with_timezoneOffset(0)
          .with_conversionOffset(0);
        const basal3 = simulator.config.builder.makeScheduledBasal()
          .with_time('2018-05-18T12:00:00.000Z')
          .with_deviceTime('2018-05-18T12:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_rate(1.0);
        addIndex(basal3);
        const basal4 = simulator.config.builder.makeScheduledBasal()
          .with_time('2018-05-18T16:00:00.000Z')
          .with_deviceTime('2018-05-18T16:00:00')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Pattern 1')
          .with_duration(3600000)
          .with_rate(1.2);

        const expectedFirstBasal = _.cloneDeep(basal1);
        expectedFirstBasal.set('duration', 18257000);

        const expectedSecondBasal = _.cloneDeep(basal2);
        expectedSecondBasal.set('duration', 660000);

        const expectedFirstSuspendedBasal = _.cloneDeep(suspendedBasal);
        expectedFirstSuspendedBasal
          .set('duration', 2683000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'temp',
            percent: 2,
            rate: 3.0,
            suppressed: {
              type: 'basal',
              deliveryType: 'scheduled',
              rate: 1.5,
              scheduleName: 'Pattern 1',
            },
          });

        const expectedSecondSuspendedBasal = _.cloneDeep(suspendedBasal);
        expectedSecondSuspendedBasal
          .set('time', '2018-05-18T12:00:00.000Z')
          .set('deviceTime', '2018-05-18T12:00:00')
          .set('duration', 4560000)
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'temp',
            percent: 2,
            rate: 2.0,
            suppressed: {
              type: 'basal',
              deliveryType: 'scheduled',
              rate: 1.0,
              scheduleName: 'Pattern 1',
            },
          });

        const expectedThirdBasal = _.cloneDeep(basal2);
        expectedThirdBasal
          .set('duration', 6497000)
          .set('time', '2018-05-18T13:16:00.000Z')
          .set('deviceTime', '2018-05-18T13:16:00')
          .set('rate', 2)
          .set('payload', {
            logIndices: [2223916064],
          })
          .set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.0,
            scheduleName: 'Pattern 1',
          });

        const expectedFourthBasal = _.cloneDeep(basal3);
        expectedFourthBasal
          .set('duration', 3343000)
          .set('clockDriftOffset', 0)
          .set('time', '2018-05-18T15:04:17.000Z')
          .set('deviceTime', '2018-05-18T15:04:17')
          .set('payload', {
            logIndices: [2223916064],
          });
        delete expectedFourthBasal.index;

        const expectedFifthBasal = _.cloneDeep(basal4);

        simulator.basal(basal1);
        simulator.basal(basal2);
        simulator.suspendResume(suspendResume);
        simulator.basal(suspendedBasal);
        simulator.basal(basal3);
        simulator.basal(basal4);
        simulator.finalBasal();

        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(),
          expectedSecondBasal.done(), suspendResume, expectedFirstSuspendedBasal.done(),
          expectedSecondSuspendedBasal.done(), expectedThirdBasal.done(),
          expectedFourthBasal.done(), expectedFifthBasal.done(),
        ]);
      });

      describe('first basal is a suspend', () => {
        test('should handle suspended first basal schedule', () => {
          const suspendedBasal = simulator.config.builder.makeSuspendBasal()
            .with_time('2017-09-04T18:00:00.000Z')
            .with_deviceTime('2017-09-04T14:00:00')
            .with_duration(41400000)
            .with_timezoneOffset(-240)
            .with_conversionOffset(0);
          const basal1 = simulator.config.builder.makeScheduledBasal()
            .with_time('2017-09-05T04:00:00.000Z')
            .with_deviceTime('2017-09-05T00:00:00')
            .with_timezoneOffset(-240)
            .with_conversionOffset(0)
            .with_scheduleName('Pattern 1')
            .with_rate(1.15)
            .with_duration(3600000);
          const basal2 = simulator.config.builder.makeScheduledBasal()
            .with_time('2017-09-05T05:00:00.000Z')
            .with_deviceTime('2017-09-05T01:00:00')
            .with_timezoneOffset(-240)
            .with_conversionOffset(0)
            .with_scheduleName('Pattern 1')
            .with_rate(1.35)
            .with_duration(3600000);

          const expectedFirstBasal = _.cloneDeep(suspendedBasal);
          expectedFirstBasal
            .set('duration', 3600000)
            .set('time', '2017-09-05T04:00:00.000Z')
            .set('deviceTime', '2017-09-05T00:00:00');
          expectedFirstBasal.set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.15,
            scheduleName: 'Pattern 1',
          });

          const expectedSecondBasal = _.cloneDeep(suspendedBasal);
          expectedSecondBasal
            .set('duration', 1800000)
            .set('time', '2017-09-05T05:00:00.000Z')
            .set('deviceTime', '2017-09-05T01:00:00');
          expectedSecondBasal.set('suppressed', {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: 1.35,
            scheduleName: 'Pattern 1',
          });

          const expectedThirdBasal = _.cloneDeep(basal2);
          expectedThirdBasal
            .set('duration', 1800000)
            .set('time', '2017-09-05T05:30:00.000Z')
            .set('deviceTime', '2017-09-05T01:30:00');

          simulator.basal(suspendedBasal);
          simulator.basal(basal1);
          simulator.basal(basal2);
          simulator.finalBasal();

          expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(),
            expectedSecondBasal.done(), expectedThirdBasal.done(),
          ]);
        });

        test('should ignore an isolated first suspended basal', () => {
          const suspendedBasal = simulator.config.builder.makeSuspendBasal()
            .with_time('2018-03-21T18:49:42.000Z')
            .with_deviceTime('2018-03-21T12:49:42')
            .with_duration(2098000)
            .with_timezoneOffset(-360)
            .with_conversionOffset(0);
          const basal1 = simulator.config.builder.makeScheduledBasal()
            .with_time('2018-03-21T21:00:00.000Z')
            .with_deviceTime('2018-03-21T15:00:00')
            .with_timezoneOffset(-360)
            .with_conversionOffset(0)
            .with_scheduleName('Pattern 3')
            .with_rate(0.7)
            .with_duration(18000000);

          const expectedFirstBasal = _.cloneDeep(basal1);

          simulator.basal(suspendedBasal);
          simulator.basal(basal1);
          simulator.finalBasal();

          expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done()]);
        });
      });
    });

    describe('Auto-Mode basal', () => {
      test('should add a gap between two Auto-Mode basals that are more than six minutes apart', () => {
        const basal1 = simulator.config.builder.makeAutomatedBasal()
          .with_time('2017-02-09T13:11:41.000Z')
          .with_deviceTime('2017-02-09T13:11:41')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Auto-Basal')
          .with_rate(0.75);
        addIndex(basal1);
        const basal2 = simulator.config.builder.makeAutomatedBasal()
          .with_time('2017-02-09T13:18:41.000Z')
          .with_deviceTime('2017-02-09T13:18:41')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_scheduleName('Auto-Basal')
          .with_rate(1.5)
          .with_duration(300000);

        const expectedFirstBasal = _.cloneDeep(basal1);
        expectedFirstBasal
          .set('duration', 300000);
        updateExpected(expectedFirstBasal);
        const expectedSecondBasal = simulator.config.builder.makeAutomatedBasal()
          .with_time('2017-02-09T13:16:41.000Z')
          .with_deviceTime('2017-02-09T13:16:41')
          .with_timezoneOffset(0)
          .with_conversionOffset(0)
          .with_clockDriftOffset(0)
          .with_scheduleName('Auto-Basal')
          .with_rate(0)
          .with_duration(120000);
        expectedSecondBasal
          .set('payload', {
            logIndices: [2183917465],
          });
        const expectedThirdBasal = _.cloneDeep(basal2);
        expectedThirdBasal
          .set('duration', 300000);

        simulator.basal(basal1);
        simulator.basal(basal2);
        simulator.finalBasal();
        expect(simulator.getEvents()).deep.equals([expectedFirstBasal.done(),
          expectedSecondBasal.done(), expectedThirdBasal.done(),
        ]);
      });
    });
  });

  describe('device event', () => {});
});
