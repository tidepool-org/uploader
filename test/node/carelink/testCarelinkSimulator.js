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

var pwdSimulator = require('../../../lib/carelink/carelinkSimulator.js');

function attachPrev(arr) {
  var prevBasal = null;

  return arr.map(function(e){
    if (e.type === 'basal') {
      if (prevBasal != null) {
        e = _.assign({ previous: _.omit(prevBasal, 'previous') }, e);
      }
      prevBasal = e;
    }
    return e;
  });
}

describe('carelinkSimulator.js', function(){
  var simulator = null;

  beforeEach(function(){
    simulator = pwdSimulator.make();
  });

  function getBasals(){
    return simulator.getEvents().filter(function(e){ return e.type === 'basal'; });
  }

  describe('cbg', function(){
    it('works', function(){
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        value: 6.8274200289860065,
        timezoneOffset: 0,
        conversionOffset: 0,
        units: 'mg/dL'
      };

      simulator.cbg(val);
      expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'cbg'}, val)]);
    });
  });

  describe('smbg', function(){
    it('works', function(){
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        value: 6.8274200289860065,
        timezoneOffset: 0,
        conversionOffset: 0,
        units: 'mg/dL'
      };

      simulator.smbg(val);
      expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'smbg'}, val)]);
    });
  });

  describe('bolus', function(){
    describe('dual', function(){
      it('works', function(){
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          normal: 1.3,
          extended: 1.4,
          duration: 60000,
          timezoneOffset: 0,
          conversionOffset: 0
        };

        simulator.bolusDual(val);
        expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'bolus', subType: 'dual/square'}, val)]);
      });
    });

    describe('normal', function(){
      it('works', function(){
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          normal: 1.3,
          timezoneOffset: 0,
          conversionOffset: 0
        };

        simulator.bolusNormal(val);
        expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'bolus', subType: 'normal'}, val)]);
      });
    });

    describe('square', function(){
      it('works', function(){
        var val = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          extended: 1.4,
          duration: 60000,
          timezoneOffset: 0,
          conversionOffset: 0
        };

        simulator.bolusSquare(val);
        expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'bolus', subType: 'square'}, val)]);
      });
    });
  });


  describe('basal', function(){
    describe('scheduled', function(){
      describe('withoutSettings', function(){
        it('passes through without an annotation and sets hasSeenScheduled to `true`', function(){
          var val = {
            time: '2014-09-25T01:00:00.000Z',
            deviceTime: '2014-09-25T01:00:00',
            scheduleName: 'billy',
            rate: 1.3,
            duration: 3600000,
            timezoneOffset: 0,
            conversionOffset: 0
          };

          simulator.basalScheduled(val);
          expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'basal', deliveryType: 'scheduled'}, val)]);
          expect(simulator.hasSeenScheduled()).to.be.true;
        });

        it('attaches a previous when there is an active basal', function(){
          var initialBasal = {
            time: '2014-09-25T01:00:00.000Z',
            deviceTime: '2014-09-25T01:00:00',
            scheduleName: 'billy',
            rate: 1.3,
            duration: 3600000,
            timezoneOffset: 0,
            conversionOffset: 0
          };
          var secondBasal = {
            time: '2014-09-25T02:00:00.000Z',
            deviceTime: '2014-09-25T02:00:00',
            scheduleName: 'billy',
            rate: 1.4,
            duration: 3600000,
            timezoneOffset: 0,
            conversionOffset: 0
          };
          var thirdBasal = {
            time: '2014-09-25T03:00:00.000Z',
            deviceTime: '2014-09-25T03:00:00',
            scheduleName: 'billy',
            rate: 1.5,
            duration: 3600000,
            timezoneOffset: 0,
            conversionOffset: 0
          };

          simulator.basalScheduled(initialBasal);
          simulator.basalScheduled(secondBasal);
          simulator.basalScheduled(thirdBasal);
          expect(simulator.getEvents()).deep.equals(
            attachPrev([
              _.assign({type: 'basal', deliveryType: 'scheduled'}, initialBasal),
              _.assign({type: 'basal', deliveryType: 'scheduled'}, secondBasal),
              _.assign({type: 'basal', deliveryType: 'scheduled'}, thirdBasal)
            ])
          );
        });


        it('if no duration, attaches a 0 duration and annotates', function(){
          var val = {
            time: '2014-09-25T01:00:00.000Z',
            deviceTime: '2014-09-25T01:00:00',
            scheduleName: 'billy',
            rate: 1.3,
            timezoneOffset: 0,
            conversionOffset: 0
          };

          simulator.basalScheduled(val);
          expect(simulator.getEvents()).deep.equals(
            [
              _.assign(
                { type: 'basal',
                  duration: 0,
                  deliveryType: 'scheduled',
                  annotations: [{code: 'basal/unknown-duration'}] },
                val
              )
            ]
          );
        });

      });

      describe('withSettings', function(){
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

        beforeEach(function(){
          simulator.pumpSettings(settings);
        });

        describe('with duration', function(){
          it('passes through a scheduled that agrees with the schedule without annotation', function(){
            var val = {
              time: '2014-09-25T06:00:00.000Z',
              deviceTime: '2014-09-25T06:00:00',
              duration: 21600000,
              scheduleName: 'billy',
              rate: 1.1,
              timezoneOffset: 0,
              conversionOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign({type: 'basal', deliveryType: 'scheduled'}, val)
              ]);
          });

          it('passes through a scheduled that starts mid-schedule and agrees with schedule without annotation', function(){
            var val = {
              time: '2014-09-25T06:01:00.000Z',
              deviceTime: '2014-09-25T06:01:00',
              duration: 21540000,
              scheduleName: 'billy',
              rate: 1.1,
              timezoneOffset: 0,
              conversionOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign({type: 'basal', deliveryType: 'scheduled'}, val)
              ]);
          });

          it('annotates a scheduled that doesn\'t match schedule but doesn\'t change a provided duration', function(){
            var val = {
              time: '2014-09-25T06:00:00.000Z',
              deviceTime: '2014-09-25T06:00:00',
              duration: 21600000,
              scheduleName: 'billy',
              rate: 1.0,
              timezoneOffset: 0,
              conversionOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.defaults({
                  type: 'basal',
                  deliveryType: 'scheduled',
                  duration: 21600000,
                  annotations: [{code: 'carelink/basal/off-schedule-rate'}]
                }, val)
              ]);
          });

          it('annotates a scheduled that doesn\'t match schedule but pushes basal clock forward according to given schedule if matches one in settings', function(){
            var basal1 = {
              time: '2014-09-25T06:00:00.000Z',
              deviceTime: '2014-09-25T06:00:00',
              duration: 64800000,
              scheduleName: 'bob',
              rate: 0.0,
              timezoneOffset: 0,
              conversionOffset: 0
            };
            var basal2 = {
              time: '2014-09-27T00:00:00.000Z',
              deviceTime: '2014-09-27T00:00:00',
              duration: 864e5,
              scheduleName: 'bob',
              rate: 0.0,
              timezoneOffset: 0,
              conversionOffset: 0
            };

            var annotation = [{code: 'carelink/basal/off-schedule-rate'}];

            simulator.basalScheduled(basal1);
            simulator.basalScheduled(basal2);

            expect(getBasals()).deep.equals(
              attachPrev(
                [
                  _.assign({}, basal1, {type: 'basal', deliveryType: 'scheduled', annotations: annotation}),
                  {
                    deviceTime: '2014-09-26T00:00:00', time: '2014-09-26T00:00:00.000Z', timezoneOffset: 0, conversionOffset: 0,
                    duration: 864e5, scheduleName: 'bob', rate: 0.0, type: 'basal', deliveryType: 'scheduled',
                    annotations: [{code: 'carelink/basal/fabricated-from-schedule'}]
                  },
                  _.assign({}, basal2, {type: 'basal', deliveryType: 'scheduled', annotations: annotation})
                ]
                )
              );
          });
        });

        describe('no duration', function(){
          it('attaches a duration according to the schedule', function(){
            var val = {
              time: '2014-09-25T01:00:00.000Z',
              deviceTime: '2014-09-25T01:00:00',
              scheduleName: 'billy',
              rate: 1.0,
              timezoneOffset: 0,
              conversionOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign({type: 'basal', deliveryType: 'scheduled', duration: 18000000}, val)
              ]);
          });

          it('annotates if basal doesn\'t match schedule', function(){
            var val = {
              time: '2014-09-25T01:00:00.000Z',
              deviceTime: '2014-09-25T01:00:00',
              scheduleName: 'billy',
              rate: 1.1,
              timezoneOffset: 0,
              conversionOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign(
                  { type: 'basal', deliveryType: 'scheduled', duration: 0 },
                  { annotations: [{code: 'carelink/basal/off-schedule-rate'}] },
                  val
                )
              ]
            );
          });
        });
      });

      describe('withSettings, data with timezoneOffset', function(){
        var settings = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          activeSchedule: 'billy',
          units: { 'bg': 'mg/dL' },
          basalSchedules: {
            'billy': [
              { start: 0, rate: 1.0 },
              { start: 21600000, rate: 1.1 }, // 6:00
              { start: 43200000, rate: 1.2 }, // 12:00
              { start: 64800000, rate: 1.3 } // 18:00
            ]
          },
          timezoneOffset: -240,
          conversionOffset: 0
        };

        beforeEach(function(){
          simulator.pumpSettings(settings);
        });

        describe('with duration', function(){
          it('passes through a scheduled that agrees with the schedule without annotation', function(){
            var val = {
              time: '2014-09-25T10:00:00.000Z',
              deviceTime: '2014-09-25T06:00:00',
              duration: 21600000,
              scheduleName: 'billy',
              rate: 1.1,
              timezoneOffset: -240,
              conversionOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign({type: 'basal', deliveryType: 'scheduled'}, val)
              ]);
          });

          it('passes through a scheduled that starts mid-schedule and agrees with schedule without annotation', function(){
            var val = {
              time: '2014-09-25T10:01:00.000Z',
              deviceTime: '2014-09-25T06:01:00',
              duration: 21540000,
              scheduleName: 'billy',
              rate: 1.1,
              timezoneOffset: -240,
              conversionOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign({type: 'basal', deliveryType: 'scheduled'}, val)
              ]);
          });

          it('annotates a scheduled that doesn\'t match schedule but doesn\'t change a provided duration', function(){
            var val = {
              time: '2014-09-25T10:00:00.000Z',
              deviceTime: '2014-09-25T06:00:00',
              duration: 21600000,
              scheduleName: 'billy',
              rate: 1.0,
              timezoneOffset: -240,
              conversionOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.defaults({
                  type: 'basal',
                  deliveryType: 'scheduled',
                  duration: 21600000,
                  annotations: [{code: 'carelink/basal/off-schedule-rate'}]
                }, val)
              ]);
          });
        });

        describe('no duration', function(){
          it('attaches a duration according to the schedule', function(){
            var val = {
              time: '2014-09-25T05:00:00.000Z',
              deviceTime: '2014-09-25T01:00:00',
              scheduleName: 'billy',
              rate: 1.0,
              timezoneOffset: -240,
              conversionOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign({type: 'basal', deliveryType: 'scheduled', duration: 18000000}, val)
              ]);
          });

          it('annotates if basal doesn\'t match schedule', function(){
            var val = {
              time: '2014-09-25T05:00:00.000Z',
              deviceTime: '2014-09-25T01:00:00',
              scheduleName: 'billy',
              rate: 1.1,
              timezoneOffset: -240,
              conversionOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign(
                  { type: 'basal', deliveryType: 'scheduled', duration: 0 },
                  { annotations: [{code: 'carelink/basal/off-schedule-rate'}] },
                  val
                )
              ]
            );
          });
        });
      });
    });

    describe('temp', function(){
      describe('withoutActiveBasal', function(){
        it('passes through with no suppressed', function(){
          var val = {
            time: '2014-09-25T01:31:57.000Z',
            deviceTime: '2014-09-25T01:31:57',
            rate: 1.3,
            duration: 3600000,
            timezoneOffset: 0,
            conversionOffset: 0
          };

          simulator.basalTemp(val);
          expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'basal', deliveryType: 'temp'}, val)]);
        });

        it('percent passes through with no suppressed and no rate', function(){
          var val = {
            time: '2014-09-25T01:31:57.000Z',
            deviceTime: '2014-09-25T01:31:57',
            scheduleName: 'billy',
            percent: 0.7,
            duration: 3600000,
            timezoneOffset: 0,
            conversionOffset: 0
          };

          simulator.basalTemp(val);
          expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'basal', deliveryType: 'temp'}, val)]);
        });
      });

      describe('withActiveBasal', function(){
        var settings = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          deliveryType: 'scheduled',
          activeSchedule: 'billy',
          units: { 'bg': 'mg/dL' },
          basalSchedules: {
            'billy': [
              { start: 0, rate: 2.0 },
              { start: 21600000, rate: 2.1 },
              { start: 43200000, rate: 2.2 },
              { start: 64800000, rate: 2.3 }
            ]
          },
          timezoneOffset: 0,
          conversionOffset: 0
        };
        var basal = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          scheduleName: 'billy',
          rate: 2.0,
          timezoneOffset: 0,
          conversionOffset: 0
        };
        var basalEvent = _.assign({}, {type: 'basal', deliveryType: 'scheduled', duration: 18000000}, basal);


        beforeEach(function(){
          simulator.pumpSettings(settings);
          simulator.basalScheduled(basal);
        });

        function getTempBasals(){
          return simulator.getEvents().filter(function(e){ return e.type === 'basal' && e.deliveryType === 'temp'; });
        }

        it('sets up the suppressed and previous', function(){
          var val = {
            time: '2014-09-25T01:31:57.000Z',
            deviceTime: '2014-09-25T01:31:57',
            rate: 0.5,
            duration: 3600000,
            timezoneOffset: 0,
            conversionOffset: 0
          };

          simulator.basalTemp(val);
          expect(getTempBasals()).deep.equals(
            [_.assign({}, {type: 'basal', deliveryType: 'temp', suppressed: basalEvent, previous: basalEvent}, val)]
          );
        });

        it('applies the percent to the suppressed', function(){
          var val = {
            time: '2014-09-25T01:31:57.000Z',
            deviceTime: '2014-09-25T01:31:57',
            percent: 0.3,
            duration: 3600000,
            timezoneOffset: 0,
            conversionOffset: 0
          };

          simulator.basalTemp(val);
          expect(getTempBasals()).deep.equals(
            [_.assign(
              {type: 'basal', deliveryType: 'temp', rate: 0.6, suppressed: basalEvent, previous: basalEvent},
              val
            )]
          );
        });
      });

      describe('withActiveBasal, data with timezoneOffset', function(){
        var settings = {
          time: '2014-09-25T05:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          deliveryType: 'scheduled',
          activeSchedule: 'billy',
          units: { 'bg': 'mg/dL' },
          basalSchedules: {
            'billy': [
              { start: 0, rate: 2.0 },
              { start: 21600000, rate: 2.1 },
              { start: 43200000, rate: 2.2 },
              { start: 64800000, rate: 2.3 }
            ]
          },
          timezoneOffset: -240,
          conversionOffset: 0
        };
        var basal = {
          time: '2014-09-25T05:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          scheduleName: 'billy',
          rate: 2.0,
          timezoneOffset: -240,
          conversionOffset: 0
        };
        var basalEvent = _.assign({}, {type: 'basal', deliveryType: 'scheduled', duration: 18000000}, basal);


        beforeEach(function(){
          simulator.pumpSettings(settings);
          simulator.basalScheduled(basal);
        });

        function getTempBasals(){
          return simulator.getEvents().filter(function(e){ return e.type === 'basal' && e.deliveryType === 'temp'; });
        }

        it('sets up the suppressed and previous', function(){
          var val = {
            time: '2014-09-25T05:31:57.000Z',
            deviceTime: '2014-09-25T01:31:57',
            rate: 0.5,
            duration: 3600000,
            timezoneOffset: -240,
            conversionOffset: 0
          };

          simulator.basalTemp(val);
          expect(getTempBasals()).deep.equals(
            [_.assign({}, {type: 'basal', deliveryType: 'temp', suppressed: basalEvent, previous: basalEvent}, val)]
          );
        });

        it('applies the percent to the suppressed', function(){
          var val = {
            time: '2014-09-25T05:31:57.000Z',
            deviceTime: '2014-09-25T01:31:57',
            percent: 0.3,
            duration: 3600000,
            timezoneOffset: -240,
            conversionOffset: 0
          };

          simulator.basalTemp(val);
          expect(getTempBasals()).deep.equals(
            [_.assign(
              {type: 'basal', deliveryType: 'temp', rate: 0.6, suppressed: basalEvent, previous: basalEvent},
              val
            )]
          );
        });
      });
    });
  });

  describe('settings', function(){
    it('accepts the settings', function(){
      var val = {
        time: '2014-09-25T01:00:00.000Z',
        deviceTime: '2014-09-25T01:00:00',
        deliveryType: 'scheduled',
        activeSchedule: 'billy',
        units: { 'bg': 'mg/dL' },
        basalSchedules: {
          'billy': [
            { start: 0, rate: 1.0 },
            { start: 21600000, rate: 1.1 },
            { start: 43200000, rate: 1.2 },
            { start: 64800000, rate: 1.3 }
          ]
        },
        bgTarget: [],
        insulinSensitivity: [],
        carbRatio: [],
        timezoneOffset: 0,
        conversionOffset: 0
      };

      simulator.pumpSettings(val);
      expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'pumpSettings'}, val)]);
    });
  });

  describe('deviceEvent', function() {
    var suspend = { time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00', reason: {'suspended': 'manual'}, timezoneOffset: 0, conversionOffset: 0 };
    var resume = { time: '2014-09-25T01:10:00.000Z', deviceTime: '2014-09-25T01:10:00', reason: {'suspended': 'manual'}, timezoneOffset: 0, conversionOffset: 0 };

    it('sets up the previous and hasSeenScheduled remains default `false`', function(){
      simulator.suspend(suspend);
      simulator.resume(resume);
      var expectedSuspend = _.assign({}, {type: 'deviceEvent', subType: 'status', status: 'suspended'}, suspend);
      expect(simulator.getEvents().filter(function(e){ return e.type === 'deviceEvent'; })).deep.equals([
        expectedSuspend,
        _.assign({}, {type: 'deviceEvent', subType: 'status', status: 'resumed', previous: expectedSuspend}, resume),
        ]);
      expect(simulator.hasSeenScheduled()).to.be.false;
    });

    it('creates a basal with `suspend` deliveryType and duration of suspend', function(){
      simulator.suspend(suspend);
      simulator.resume(resume);
      expect(getBasals()).deep.equals([{
        type: 'basal',
        deliveryType: 'suspend',
        deviceTime: suspend.deviceTime,
        time: suspend.time,
        timezoneOffset: 0,
        conversionOffset: 0,
        duration: 1800000 
      }]);
    });
  });

  describe('event interplay', function(){
    describe('fill in scheduled events when a temp is active and time passes', function(){
      var settings = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        activeSchedule: 'billy',
        units: { bg: 'mg/dL' },
        basalSchedules: {
          billy: [
            { start: 0, rate: 1.0 },
            { start: 3600000, rate: 2.0 },
            { start: 7200000, rate: 2.1 },
            { start: 10800000, rate: 2.2 },
            { start: 14400000, rate: 2.3 },
            { start: 18000000, rate: 2.4 },
            { start: 21600000, rate: 1.1 },
            { start: 43200000, rate: 1.2 },
            { start: 64800000, rate: 1.3 }
          ]
        },
        bgTarget: [],
        insulinSensitivity: [],
        carbRatio: [],
        timezoneOffset: 0,
        conversionOffset: 0
      };
      var basal = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: 0,
        conversionOffset: 0
      };
      var temp = {
        time: '2014-09-25T00:30:00.000Z',
        deviceTime: '2014-09-25T00:30:00',
        percent: 0.1,
        duration: 7200000,
        timezoneOffset: 0,
        conversionOffset: 0
      };

      it('fills in for changes in schedule when another scheduled appears', function(){
        simulator.pumpSettings(settings);
        simulator.basalScheduled(basal);
        simulator.basalTemp(temp);

        var val = {
          time: '2014-09-25T02:30:00.000Z',
          deviceTime: '2014-09-25T02:30:00',
          scheduleName: 'billy',
          rate: 2.1,
          timezoneOffset: 0,
          conversionOffset: 0
        };

        simulator.basalScheduled(val);

        expect(getBasals()).deep.equals(
          attachPrev(
            [
              _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 7200000,
                time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                timezoneOffset: 0, conversionOffset: 0,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                  time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00', timezoneOffset: 0,
                  conversionOffset: 0
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.2, duration: 5400000,
                time: '2014-09-25T01:00:00.000Z', timezoneOffset: 0, conversionOffset: 0,
                deviceTime: '2014-09-25T01:00:00',
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                  time: '2014-09-25T01:00:00.000Z', timezoneOffset: 0, conversionOffset: 0, deviceTime: '2014-09-25T01:00:00',
                  annotations: [{ code: 'carelink/basal/fabricated-from-schedule' }]
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 2.1 * 0.1, duration: 1800000,
                time: '2014-09-25T02:00:00.000Z', timezoneOffset: 0, conversionOffset: 0,
                deviceTime: '2014-09-25T02:00:00',
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.1, duration: 3600000,
                  time: '2014-09-25T02:00:00.000Z', timezoneOffset: 0, conversionOffset: 0,
                  deviceTime: '2014-09-25T02:00:00',
                  annotations: [{ code: 'carelink/basal/fabricated-from-schedule' }]
                }
              },
              _.assign({}, val,
                       { type: 'basal', time: '2014-09-25T02:30:00.000Z', deviceTime: '2014-09-25T02:30:00',
                         deliveryType: 'scheduled', duration: 1800000, timezoneOffset: 0, conversionOffset: 0 }
              )
            ]));
      });

      it('completes a temp that is suppressed by a suspended before completing the scheduled that ends after the temp',
         function(){
           simulator.pumpSettings(settings);
           simulator.basalScheduled(basal);
           simulator.basalTemp(_.assign({}, temp, { duration: 900000 })); // 15 minutes

           simulator.suspend({ time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00', reason: {'suspended': 'manual'}, timezoneOffset: 0, conversionOffset: 0 });
           expect(getBasals()).deep.equals(
             attachPrev(
               [
                 _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
                 {
                   type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                   time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                   timezoneOffset: 0, conversionOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00', timezoneOffset: 0,
                     conversionOffset: 0
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend',
                   time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00', timezoneOffset: 0,
                   conversionOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                     time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00', timezoneOffset: 0,
                     conversionOffset: 0,  
                     suppressed: {
                       type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                       time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00', timezoneOffset: 0,
                       conversionOffset: 0
                     }
                   }
                 }
               ])
           );

           simulator.resume({ time: '2014-09-25T01:10:00.000Z', deviceTime: '2014-09-25T01:10:00', reason: {'suspended': 'manual'}, timezoneOffset: 0, conversionOffset: 0 });

           expect(getBasals()).deep.equals(
             attachPrev(
               [
                 _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
                 {
                   type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                   time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                   timezoneOffset: 0, conversionOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00', timezoneOffset: 0,
                     conversionOffset: 0
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 1800000,
                   time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   timezoneOffset: 0, conversionOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                     time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00', timezoneOffset: 0,
                     conversionOffset: 0,
                     suppressed: {
                       type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                       time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',  timezoneOffset: 0,
                       conversionOffset: 0
                     }
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 1500000,
                   time: '2014-09-25T00:45:00.000Z', timezoneOffset: 0, conversionOffset: 0,
                   deviceTime: '2014-09-25T00:45:00',
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00', timezoneOffset: 0,
                     conversionOffset: 0
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 600000,
                   time: '2014-09-25T01:00:00.000Z', timezoneOffset: 0, conversionOffset: 0,
                   deviceTime: '2014-09-25T01:00:00',
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                     time: '2014-09-25T01:00:00.000Z', timezoneOffset: 0, conversionOffset: 0, deviceTime: '2014-09-25T01:00:00',
                     annotations: [{ code: 'carelink/basal/fabricated-from-schedule' }]
                   }
                 }
               ])
           );
         });

      it('throws away a scheduled when it is done and there are no known settings', function(){
        simulator.basalScheduled(basal);
        simulator.basalTemp(temp);

        expect(getBasals()).deep.equals(
          [
            _.assign(
              {}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 0, annotations: [{ code: 'basal/unknown-duration'}] }
            ),
            {
              type: 'basal', deliveryType: 'temp', percent: 0.1, duration: 7200000,
              time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00', timezoneOffset: 0,
              conversionOffset: 0
            }
          ]);
      });
    });

    describe('tracks scheduleds when settings change', function(){
      var settings = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        activeSchedule: 'billy',
        units: { bg: 'mg/dL' },
        basalSchedules: {
          billy: [
            { start: 0, rate: 1.0 },
            { start: 3600000, rate: 2.0 },
            { start: 7200000, rate: 2.1 },
            { start: 10800000, rate: 2.2 },
            { start: 14400000, rate: 2.3 },
            { start: 18000000, rate: 2.4 },
            { start: 21600000, rate: 1.1 },
            { start: 43200000, rate: 1.2 },
            { start: 64800000, rate: 1.3 }
          ]
        },
        bgTarget: [],
        insulinSensitivity: [],
        carbRatio: [],
        timezoneOffset: 0,
        conversionOffset: 0
      };
      var basal = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: 0,
        conversionOffset: 0
      };
      var newSettings = {
        time: '2014-09-25T00:30:00.000Z',
        deviceTime: '2014-09-25T00:30:00',
        activeSchedule: 'billy',
        units: { bg: 'mg/dL' },
        basalSchedules: {
          billy: [
            { start: 0, rate: 1.5 },
            { start: 3600000, rate: 2.0 },
            { start: 7200000, rate: 2.1 },
            { start: 10800000, rate: 2.2 },
            { start: 14400000, rate: 2.3 },
            { start: 18000000, rate: 2.4 },
            { start: 21600000, rate: 1.1 },
            { start: 43200000, rate: 1.2 },
            { start: 64800000, rate: 1.3 }
          ]
        },
        bgTarget: [],
        insulinSensitivity: [],
        carbRatio: [],
        timezoneOffset: 0,
        conversionOffset: 0
      };
      var nextScheduled = {
        time: '2014-09-25T00:30:05.000Z',
        deviceTime: '2014-09-25T00:30:05',
        scheduleName: 'billy',
        rate: 1.5,
        timezoneOffset: 0,
        conversionOffset: 0
      };

      it('includes old-settings scheduled as `previous` in new-settings scheduled', function(){
        simulator.pumpSettings(settings);
        simulator.basalScheduled(basal);
        simulator.pumpSettings(newSettings);
        simulator.basalScheduled(nextScheduled);

        expect(getBasals()).deep.equals(
          attachPrev(
            [
              _.assign({}, basal, {type: 'basal', deliveryType: 'scheduled', duration: 3600000}),
              {
                type: 'basal', deliveryType: 'scheduled', duration: 1795000,
                time: '2014-09-25T00:30:05.000Z', deviceTime: '2014-09-25T00:30:05',
                rate: 1.5, scheduleName: 'billy', timezoneOffset: 0, conversionOffset: 0
              }
            ]
          )
        );
      });

    });

    describe('on exit from suspend, returs to proper basal rate', function(){
      var settings = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        activeSchedule: 'billy',
        units: { bg: 'mg/dL' },
        basalSchedules: {
          billy: [
            { start: 0, rate: 1.0 },
            { start: 3600000, rate: 2.0 },
            { start: 7200000, rate: 2.1 },
            { start: 10800000, rate: 2.2 },
            { start: 14400000, rate: 2.3 },
            { start: 18000000, rate: 2.4 },
            { start: 21600000, rate: 1.1 },
            { start: 43200000, rate: 1.2 },
            { start: 64800000, rate: 1.3 }
          ]
        },
        bgTarget: [],
        insulinSensitivity: [],
        carbRatio: [],
        timezoneOffset: 0,
        conversionOffset: 0
      };
      var basal = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: 0,
        conversionOffset: 0
      };
      var suspend = {
        reason: {'suspended': 'manual'},
        timezoneOffset: 0,
        time: '2014-09-25T00:05:00.000Z',
        deviceTime: '2014-09-25T00:05:00',
        conversionOffset: 0
      };
      var resume = {
        reason: {'suspended': 'manual'},
        timezoneOffset: 0,
        time: '2014-09-25T00:12:00.000Z',
        deviceTime: '2014-09-25T00:12:00',
        conversionOffset: 0
      };
      var nextBasal = {
        time: '2014-09-25T00:12:00.000Z',
        deviceTime: '2014-09-25T00:12:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: 0,
        conversionOffset: 0
      };
      it('should use a provided nextBasal and not create a duplicate', function(){
        simulator.pumpSettings(settings);
        simulator.basalScheduled(basal);
        simulator.suspend(suspend);
        simulator.resume(resume);
        simulator.basalScheduled(nextBasal);

        var expectedFirstBasal = _.assign({}, basal, {type: 'basal', deliveryType: 'scheduled', duration: 3600000 });
        expect(getBasals()).deep.equals(attachPrev(
          [
            expectedFirstBasal,
            {
              type: 'basal', deliveryType: 'suspend', time: '2014-09-25T00:05:00.000Z',
              deviceTime: '2014-09-25T00:05:00', duration: 420000, timezoneOffset: 0, 
              conversionOffset: 0, suppressed: expectedFirstBasal
            },
            _.assign({}, nextBasal, {type: 'basal', deliveryType: 'scheduled', duration: 2880000 })
          ]
        ));
      });

      it('should generate an (annotated) nextBasal if not provided', function(){
        var newBasal = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          scheduleName: 'billy',
          rate: 2.0,
          timezoneOffset: 0,
          conversionOffset: 0
        };
        simulator.pumpSettings(settings);
        simulator.basalScheduled(basal);
        simulator.suspend(suspend);
        simulator.resume(resume);
        simulator.basalScheduled(newBasal);

        var expectedFirstBasal = _.assign({}, basal, {type: 'basal', deliveryType: 'scheduled', duration: 3600000 });
        expect(getBasals()).deep.equals(attachPrev(
          [
            expectedFirstBasal,
            {
              type: 'basal', deliveryType: 'suspend', time: '2014-09-25T00:05:00.000Z',
              deviceTime: '2014-09-25T00:05:00', duration: 420000, timezoneOffset: 0, 
              conversionOffset: 0, suppressed: expectedFirstBasal
            },
            _.assign({}, nextBasal, {
              type: 'basal', deliveryType: 'scheduled', duration: 2880000,
              annotations: [{code: 'carelink/basal/fabricated-from-suppressed'}]
            }),
            _.assign({}, newBasal, {type: 'basal', deliveryType: 'scheduled', duration: 3600000 })
          ]
        ));
      });
    });

    describe('can resume a temp basal after a suspend', function(){
      var settings = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        activeSchedule: 'billy',
        units: { bg: 'mg/dL' },
        basalSchedules: {
          billy: [
            { start: 0, rate: 1.0 },
            { start: 3600000, rate: 2.0 },
            { start: 7200000, rate: 2.1 },
            { start: 10800000, rate: 2.2 },
            { start: 14400000, rate: 2.3 },
            { start: 18000000, rate: 2.4 },
            { start: 21600000, rate: 1.1 },
            { start: 43200000, rate: 1.2 },
            { start: 64800000, rate: 1.3 }
          ]
        },
        bgTarget: [],
        insulinSensitivity: [],
        carbRatio: [],
        timezoneOffset: 0,
        conversionOffset: 0
      };
      var basal = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: 0,
        conversionOffset: 0
      };
      var tempBasal = {
        time: '2014-09-25T00:02:00.000Z',
        deviceTime: '2014-09-25T00:02:00',
        percent: 0.2,
        timezoneOffset: 0,
        scheduleName: 'billy',
        duration: 1800000,
        conversionOffset: 0
      };
      var suspend = {
        reason: {'suspended': 'manual'},
        timezoneOffset: 0,
        time: '2014-09-25T00:05:00.000Z',
        deviceTime: '2014-09-25T00:05:00',
        conversionOffset: 0
      };
      var resume = {
        reason: {'resumed': 'manual'},
        timezoneOffset: 0,
        time: '2014-09-25T00:12:00.000Z',
        deviceTime: '2014-09-25T00:12:00',
        conversionOffset: 0
      };

      it('generates a temp basal from the suppressed if resume happens within original duration of temp', function(){
        var newBasal = {
          time: '2014-09-25T00:32:00.000Z',
          deviceTime: '2014-09-25T00:32:00',
          scheduleName: 'billy',
          rate: 1.0,
          timezoneOffset: 0,
          conversionOffset: 0
        };
        simulator.pumpSettings(settings);
        simulator.basalScheduled(basal);
        simulator.basalTemp(tempBasal);
        simulator.suspend(suspend);
        simulator.resume(resume);
        simulator.basalScheduled(newBasal);

        var expectedFirstBasal = _.assign({}, basal, {type: 'basal', deliveryType: 'scheduled', duration: 3600000 });
        var expectedTempBasal = _.assign({}, tempBasal, {type: 'basal', deliveryType: 'temp', rate: 0.2, suppressed: expectedFirstBasal});
        expect(getBasals()).deep.equals(attachPrev(
          [
            expectedFirstBasal,
            expectedTempBasal,
            {
              type: 'basal', deliveryType: 'suspend', time: '2014-09-25T00:05:00.000Z',
              deviceTime: '2014-09-25T00:05:00', duration: 420000, timezoneOffset: 0,
              conversionOffset: 0, suppressed: expectedTempBasal
            },
            _.assign({}, expectedTempBasal, {
              time: '2014-09-25T00:12:00.000Z', deviceTime: '2014-09-25T00:12:00', duration: 1200000,
              annotations: [{code: 'carelink/basal/fabricated-from-suppressed' }]
            }),
            _.assign({}, newBasal, {type: 'basal', deliveryType: 'scheduled', duration: 1680000 })
          ]
        ));
      });
    });

    describe('generates scheduleds when autoGen set to true', function(){
      beforeEach(function(){
        simulator = pwdSimulator.make({autoGenScheduleds: true});
      });

      it('empty schedule', function(){
        var settings = {
          time: '2014-09-25T00:00:00.000Z',
          deviceTime: '2014-09-25T00:00:00',
          activeSchedule: 'billy',
          units: { bg: 'mg/dL' },
          basalSchedules: {},
          bgTarget: [],
          insulinSensitivity: [],
          carbRatio: [],
          timezoneOffset: 0,
          conversionOffset: 0
        };


        simulator.pumpSettings(settings);
        simulator.pumpSettings(_.assign({}, settings, {time: '2014-09-27T00:00:00.000Z', activeSchedule: 'bob'}));
        expect(getBasals()).deep.equals([]);
      });

      it('with empty schedule', function(){
        var settings = {
          time: '2014-09-25T00:00:00.000Z',
          deviceTime: '2014-09-25T00:00:00',
          activeSchedule: 'billy',
          units: { bg: 'mg/dL' },
          basalSchedules: {
            billy: []
          },
          bgTarget: [],
          insulinSensitivity: [],
          carbRatio: [],
          timezoneOffset: 0,
          conversionOffset: 0
        };

        simulator.pumpSettings(settings);
        simulator.pumpSettings(_.assign({}, settings, {time: '2014-09-27T00:00:00.000Z', activeSchedule: 'bob'}));
        expect(getBasals()).deep.equals([]);
      });

      it('with empty schedule and basal in the bucket', function(){
        var settings = {
          time: '2014-09-25T00:00:00.000Z',
          deviceTime: '2014-09-25T00:00:00',
          activeSchedule: 'billy',
          units: { bg: 'mg/dL' },
          basalSchedules: {
            billy: []
          },
          bgTarget: [],
          insulinSensitivity: [],
          carbRatio: [],
          timezoneOffset: 0,
          conversionOffset: 0
        };

        var basal = { type: 'basal', deliveryType: 'scheduled', time: '2014-09-25T00:00:00.000Z',
          scheduleName: 'billy', rate: 0, duration: 86400000, timezoneOffset: 0, conversionOffset: 0,
          deviceTime: '2014-09-25T00:00:00' };
        simulator.basalScheduled(basal);
        simulator.pumpSettings(settings);
        simulator.pumpSettings(_.assign({}, settings, {time: '2014-09-27T00:00:00.000Z', activeSchedule: 'bob'}));
        expect(getBasals()).deep.equals([basal]);
      });

      it('with schedule', function(){
        var settings = {
          time: '2014-09-25T00:00:00.000Z',
          deviceTime: '2014-09-25T00:00:00',
          activeSchedule: 'billy',
          units: { bg: 'mg/dL' },
          basalSchedules: {
            billy: [
              { start: 0, rate: 1.0 },
              { start: 21600000, rate: 1.1 },
              { start: 43200000, rate: 1.2 },
              { start: 64800000, rate: 1.3 }
            ]
          },
          bgTarget: [],
          insulinSensitivity: [],
          carbRatio: [],
          timezoneOffset: 0,
          conversionOffset: 0
        };

        simulator.pumpSettings(settings);
        simulator.pumpSettings(_.assign({}, settings, {time: '2014-09-27T00:00:00.000Z', activeSchedule: 'bob'}));

        var expectedBasal = {
          deliveryType: 'scheduled',
          type: 'basal',
          deviceTime: '2014-09-25T00:00:00',
          time: '2014-09-25T00:00:00.000Z',
          scheduleName: 'billy',
          rate: 1.0,
          duration: 21600000,
          annotations: [{code: 'carelink/basal/fabricated-from-schedule'}],
          timezoneOffset: 0,
          conversionOffset: 0
        };

        expect(getBasals()).deep.equals(
          attachPrev(
            [
              expectedBasal,
              _.assign({}, expectedBasal, {time: '2014-09-25T06:00:00.000Z', deviceTime: '2014-09-25T06:00:00', rate: 1.1}),
              _.assign({}, expectedBasal, {time: '2014-09-25T12:00:00.000Z', deviceTime: '2014-09-25T12:00:00', rate: 1.2}),
              _.assign({}, expectedBasal, {time: '2014-09-25T18:00:00.000Z', deviceTime: '2014-09-25T18:00:00', rate: 1.3}),
              _.assign({}, expectedBasal, {time: '2014-09-26T00:00:00.000Z', deviceTime: '2014-09-26T00:00:00', rate: 1.0}),
              _.assign({}, expectedBasal, {time: '2014-09-26T06:00:00.000Z', deviceTime: '2014-09-26T06:00:00', rate: 1.1}),
              _.assign({}, expectedBasal, {time: '2014-09-26T12:00:00.000Z', deviceTime: '2014-09-26T12:00:00', rate: 1.2}),
              _.assign({}, expectedBasal, {time: '2014-09-26T18:00:00.000Z', deviceTime: '2014-09-26T18:00:00', rate: 1.3})
            ]
          )
        );
      });

      it('with schedule at 7am', function(){
        var settings = {
          time: '2014-09-25T07:00:00.000Z',
          deviceTime: '2014-09-25T07:00:00',
          activeSchedule: 'billy',
          units: { bg: 'mg/dL' },
          basalSchedules: {
            billy: [
              { start: 0, rate: 1.0 },
              { start: 21600000, rate: 1.1 },
              { start: 43200000, rate: 1.2 },
              { start: 64800000, rate: 1.3 }
            ]
          },
          bgTarget: [],
          insulinSensitivity: [],
          carbRatio: [],
          timezoneOffset: 0,
          conversionOffset: 0
        };

        simulator.pumpSettings(settings);

        var expectedBasal = {
          deliveryType: 'scheduled',
          type: 'basal',
          deviceTime: '2014-09-25T07:00:00',
          time: '2014-09-25T07:00:00.000Z',
          scheduleName: 'billy',
          rate: 1.1,
          duration: 18000000,
          annotations: [{code: 'carelink/basal/fabricated-from-schedule'}],
          timezoneOffset: 0,
          conversionOffset: 0
        };

        expect(getBasals()).deep.equals([expectedBasal]);
      });

      it('with schedule at 8pm', function(){
        var settings = {
          time: '2014-09-25T20:00:00.000Z',
          deviceTime: '2014-09-25T20:00:00',
          activeSchedule: 'billy',
          units: { bg: 'mg/dL' },
          basalSchedules: {
            billy: [
              { start: 0, rate: 1.0 },
              { start: 21600000, rate: 1.1 },
              { start: 43200000, rate: 1.2 },
              { start: 64800000, rate: 1.3 }
            ]
          },
          bgTarget: [],
          insulinSensitivity: [],
          carbRatio: [],
          timezoneOffset: 0,
          conversionOffset: 0
        };

        simulator.pumpSettings(settings);

        var expectedBasal = {
          type: 'basal',
          deliveryType: 'scheduled',
          deviceTime: '2014-09-25T20:00:00',
          time: '2014-09-25T20:00:00.000Z',
          scheduleName: 'billy',
          rate: 1.3,
          duration: 14400000,
          annotations: [{code: 'carelink/basal/fabricated-from-schedule'}],
          timezoneOffset: 0,
          conversionOffset: 0
        };

        expect(getBasals()).deep.equals([expectedBasal]);
      });
    });
  });

  describe('event interplay, data with timezoneOffset', function(){
    describe('weirdly sequenced scheduled basal before resume', function(){
      // NB: based on a true story
      var settings = {
        time: '2014-03-15T00:00:00.000Z',
        deviceTime: '2014-03-15T10:00:00',
        activeSchedule: 'standard',
        units: { bg: 'mg/dL' },
        basalSchedules: {
          standard: [
            { start: 0, rate: 0.825 }
          ]
        },
        bgTarget: [],
        insulinSensitivity: [],
        carbRatio: [],
        timezoneOffset: -600,
        conversionOffset: 0
      };
      var firstBasal = {
        rate: 0.825,
        deviceTime: '2014-03-15T16:22:15',
        time: '2014-03-16T02:22:15.000Z',
        timezoneOffset: -600,
        scheduleName: 'standard',
        conversionOffset: 0
      };
      var suspend = {
        reason: {'suspended': 'manual'},
        timezoneOffset: -600,
        time: '2014-03-16T02:23:19.000Z',
        deviceTime: '2014-03-15T16:23:19',
        conversionOffset: 0
      };
      var secondBasal = {
        rate: 0.825,
        deviceTime: '2014-03-15T17:18:34',
        time: '2014-03-16T03:18:34.000Z',
        timezoneOffset: -600,
        scheduleName: 'standard',
        conversionOffset: 0
      };
      var resume = {
        reason: {'resumed': 'manual'},
        timezoneOffset: -600,
        time: '2014-03-16T03:18:35.000Z',
        deviceTime: '2014-03-15T17:18:35',
        conversionOffset: 0
      };

      it('should add correct previouses to basals and deviceEvents', function(){
        simulator.pumpSettings(settings);
        simulator.basalScheduled(firstBasal);
        simulator.suspend(suspend);
        simulator.basalScheduled(secondBasal);
        simulator.resume(resume);
        var firstBasalRes = _.assign({}, firstBasal, {type: 'basal', duration: 27465000, deliveryType: 'scheduled'});
        var expectedSuspend = _.assign({}, suspend, {type: 'deviceEvent', subType: 'status', status: 'suspended'});
        var basalSuspend = {
          deliveryType: 'suspend',
          type: 'basal',
          timezoneOffset: -600,
          conversionOffset: 0,
          deviceTime: suspend.deviceTime,
          time: suspend.time,
          duration: 3315000,
          suppressed: firstBasalRes,
          previous: firstBasalRes
        };
        var secondBasalRes = _.assign({}, secondBasal, {
          type: 'basal',
          duration: 24086000,
          deliveryType: 'scheduled',
          previous: _.omit(basalSuspend, 'previous')
        });
        expect(simulator.getEvents()).deep.equals(
          [
            _.assign({}, settings, {type: 'pumpSettings'}),
            firstBasalRes,
            expectedSuspend,
            basalSuspend,
            _.assign({}, resume, {
              type: 'deviceEvent', subType: 'status', status: 'resumed', previous: expectedSuspend,
              time: secondBasal.time, deviceTime: secondBasal.deviceTime
            }),
            secondBasalRes
          ]);
      });
    });

    describe('fill in scheduled events when a temp is active and time passes', function(){
      var settings = {
        time: '2014-09-25T04:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        activeSchedule: 'billy',
        units: { bg: 'mg/dL' },
        basalSchedules: {
          billy: [
            { start: 0, rate: 1.0 },
            { start: 3600000, rate: 2.0 },
            { start: 7200000, rate: 2.1 },
            { start: 10800000, rate: 2.2 },
            { start: 14400000, rate: 2.3 },
            { start: 18000000, rate: 2.4 },
            { start: 21600000, rate: 1.1 },
            { start: 43200000, rate: 1.2 },
            { start: 64800000, rate: 1.3 }
          ]
        },
        bgTarget: [],
        insulinSensitivity: [],
        carbRatio: [],
        timezoneOffset: -240,
        conversionOffset: 0
      };
      var basal = {
        time: '2014-09-25T04:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: -240,
        conversionOffset: 0
      };
      var temp = {
        time: '2014-09-25T04:30:00.000Z',
        deviceTime: '2014-09-25T00:30:00',
        percent: 0.1,
        duration: 7200000,
        timezoneOffset: -240,
        conversionOffset: 0
      };

      it('fills in for changes in schedule when another scheduled appears', function(){
        simulator.pumpSettings(settings);
        simulator.basalScheduled(basal);
        simulator.basalTemp(temp);

        var val = {
          time: '2014-09-25T06:30:00.000Z',
          deviceTime: '2014-09-25T02:30:00',
          scheduleName: 'billy',
          rate: 2.1,
          timezoneOffset: -240,
          conversionOffset: 0
        };

        simulator.basalScheduled(val);

        expect(getBasals()).deep.equals(
          attachPrev(
            [
              _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 7200000,
                time: '2014-09-25T04:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                timezoneOffset: -240, conversionOffset: 0,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                  time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                  timezoneOffset: -240, conversionOffset: 0
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.2, duration: 5400000,
                time: '2014-09-25T05:00:00.000Z', timezoneOffset: -240, conversionOffset: 0,
                deviceTime: '2014-09-25T01:00:00',
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                  time: '2014-09-25T05:00:00.000Z', timezoneOffset: -240, conversionOffset: 0,
                  deviceTime: '2014-09-25T01:00:00',
                  annotations: [{ code: 'carelink/basal/fabricated-from-schedule' }]
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 2.1 * 0.1, duration: 1800000,
                time: '2014-09-25T06:00:00.000Z', timezoneOffset: -240, conversionOffset: 0,
                deviceTime: '2014-09-25T02:00:00',
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.1, duration: 3600000,
                  time: '2014-09-25T06:00:00.000Z', timezoneOffset: -240, conversionOffset: 0,
                  deviceTime: '2014-09-25T02:00:00',
                  annotations: [{ code: 'carelink/basal/fabricated-from-schedule' }]
                }
              },
              _.assign({}, val,
                       { type: 'basal', time: '2014-09-25T06:30:00.000Z', deviceTime: '2014-09-25T02:30:00',
                         deliveryType: 'scheduled', duration: 1800000 }
              )
            ]));
      });

      it('completes a temp that is suppressed by a suspended before completing the scheduled that ends after the temp',
         function(){
           simulator.pumpSettings(settings);
           simulator.basalScheduled(basal);
           simulator.basalTemp(_.assign({}, temp, { duration: 900000 })); // 15 minutes

           simulator.suspend({ time: '2014-09-25T04:40:00.000Z', deviceTime: '2014-09-25T00:40:00',
              reason: {'suspended': 'manual'}, timezoneOffset: -240, conversionOffset: 0 });
           expect(getBasals()).deep.equals(
             attachPrev(
               [
                 _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
                 {
                   type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                   time: '2014-09-25T04:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                   timezoneOffset: -240, conversionOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                     timezoneOffset: -240, conversionOffset: 0
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend',
                   time: '2014-09-25T04:40:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   timezoneOffset: -240, conversionOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                     time: '2014-09-25T04:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                     timezoneOffset: -240, conversionOffset: 0,
                     suppressed: {
                       type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                       time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                       timezoneOffset: -240, conversionOffset: 0
                     }
                   }
                 }
               ])
           );

           simulator.resume({ time: '2014-09-25T05:10:00.000Z', deviceTime: '2014-09-25T01:10:00',
            reason: {'resumed': 'manual'}, timezoneOffset: -240, conversionOffset: 0 });

           expect(getBasals()).deep.equals(
             attachPrev(
               [
                 _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
                 {
                   type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                   time: '2014-09-25T04:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                   timezoneOffset: -240, conversionOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                     timezoneOffset: -240, conversionOffset: 0
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 1800000,
                   time: '2014-09-25T04:40:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   timezoneOffset: -240, conversionOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                     time: '2014-09-25T04:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                     timezoneOffset: -240, conversionOffset: 0,
                     suppressed: {
                       type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                       time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                       timezoneOffset: -240, conversionOffset: 0
                     }
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 1500000,
                   time: '2014-09-25T04:45:00.000Z', deviceTime: '2014-09-25T00:45:00',
                   timezoneOffset: -240, conversionOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                     timezoneOffset: -240, conversionOffset: 0
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 600000,
                   time: '2014-09-25T05:00:00.000Z', deviceTime: '2014-09-25T01:00:00',
                   timezoneOffset: -240, conversionOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                     time: '2014-09-25T05:00:00.000Z', timezoneOffset: -240, conversionOffset: 0,
                     deviceTime: '2014-09-25T01:00:00',
                     annotations: [{ code: 'carelink/basal/fabricated-from-schedule' }]
                   }
                 }
               ])
           );
         });

      it('throws away a scheduled when it is done and there are no known settings', function(){
        simulator.basalScheduled(basal);
        simulator.basalTemp(temp);

        expect(getBasals()).deep.equals(
          [
            _.assign(
              {}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 0, annotations: [{ code: 'basal/unknown-duration'}] }
            ),
            {
              type: 'basal', deliveryType: 'temp', percent: 0.1, duration: 7200000,
              time: '2014-09-25T04:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
              timezoneOffset: -240, conversionOffset: 0
            }
          ]);
      });
    });

    describe('tracks scheduleds when settings change', function(){
      var settings = {
        time: '2014-09-25T04:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        activeSchedule: 'billy',
        units: { bg: 'mg/dL' },
        basalSchedules: {
          billy: [
            { start: 0, rate: 1.0 },
            { start: 3600000, rate: 2.0 },
            { start: 7200000, rate: 2.1 },
            { start: 10800000, rate: 2.2 },
            { start: 14400000, rate: 2.3 },
            { start: 18000000, rate: 2.4 },
            { start: 21600000, rate: 1.1 },
            { start: 43200000, rate: 1.2 },
            { start: 64800000, rate: 1.3 }
          ]
        },
        bgTarget: [],
        insulinSensitivity: [],
        carbRatio: [],
        timezoneOffset: -240,
        conversionOffset: 0
      };
      var basal = {
        time: '2014-09-25T04:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: -240,
        conversionOffset: 0
      };
      var newSettings = {
        time: '2014-09-25T04:30:00.000Z',
        deviceTime: '2014-09-25T00:30:00',
        activeSchedule: 'billy',
        units: { bg: 'mg/dL' },
        basalSchedules: {
          billy: [
            { start: 0, rate: 1.5 },
            { start: 3600000, rate: 2.0 },
            { start: 7200000, rate: 2.1 },
            { start: 10800000, rate: 2.2 },
            { start: 14400000, rate: 2.3 },
            { start: 18000000, rate: 2.4 },
            { start: 21600000, rate: 1.1 },
            { start: 43200000, rate: 1.2 },
            { start: 64800000, rate: 1.3 }
          ]
        },
        bgTarget: [],
        insulinSensitivity: [],
        carbRatio: [],
        timezoneOffset: -240,
        conversionOffset: 0
      };
      var nextScheduled = {
        time: '2014-09-25T04:30:05.000Z',
        deviceTime: '2014-09-25T00:30:05',
        scheduleName: 'billy',
        rate: 1.5,
        timezoneOffset: -240,
        conversionOffset: 0
      };

      it('includes old-settings scheduled as `previous` in new-settings scheduled', function(){
        simulator.pumpSettings(settings);
        simulator.basalScheduled(basal);
        simulator.pumpSettings(newSettings);
        simulator.basalScheduled(nextScheduled);

        expect(getBasals()).deep.equals(
          attachPrev(
            [
              _.assign({}, basal, {type: 'basal', deliveryType: 'scheduled', duration: 3600000}),
              {
                type: 'basal', deliveryType: 'scheduled', duration: 1795000,
                time: '2014-09-25T04:30:05.000Z', deviceTime: '2014-09-25T00:30:05',
                rate: 1.5, scheduleName: 'billy', timezoneOffset: -240, conversionOffset: 0
              }
            ]
          )
        );
      });

    });

    describe('event interplay, low glucose suspend', function(){
      describe('user resume', function(){
        var settings = {
          time: '2014-09-25T00:00:00.000Z',
          deviceTime: '2014-09-25T00:00:00',
          activeSchedule: 'billy',
          units: { bg: 'mg/dL' },
          basalSchedules: {
            billy: [
              { start: 0, rate: 1.0 },
              { start: 3600000, rate: 2.0 },
              { start: 7200000, rate: 2.1 },
              { start: 10800000, rate: 2.2 },
              { start: 14400000, rate: 2.3 },
              { start: 18000000, rate: 2.4 },
              { start: 21600000, rate: 1.1 },
              { start: 43200000, rate: 1.2 },
              { start: 64800000, rate: 1.3 }
            ]
          },
          bgTarget: [],
          insulinSensitivity: [],
          carbRatio: [],
          timezoneOffset: 0,
          conversionOffset: 0
        };
        var basal1 = {
          time: '2014-09-25T00:00:00.000Z',
          deviceTime: '2014-09-25T00:00:00',
          rate: 1.0,
          scheduleName: 'billy',
          duration: 3600000,
          timezoneOffset: 0,
          conversionOffset: 0
        };
        var temp = {
          time: '2014-09-25T00:02:00.000Z',
          deviceTime: '2014-09-25T00:02:00',
          percent: 0.5,
          duration: 1800000,
          timezoneOffset: 0,
          conversionOffset: 0
        };
        // alarm_suspend
        var suspend1 = {
          reason: {suspended: 'automatic'},
          payload: {cause: 'low_glucose'},
          timezoneOffset: 0,
          time: '2014-09-25T00:05:00.000Z',
          deviceTime: '2014-09-25T00:05:00',
          conversionOffset: 0
        };
        // low_suspend_mode_1
        var suspend2 = {
          reason: {suspended: 'automatic'},
          payload: {cause: 'low_glucose'},
          timezoneOffset: 0,
          time: '2014-09-25T00:05:05.000Z',
          deviceTime: '2014-09-25T00:05:05',
          conversionOffset: 0
        };
        // low_suspend_no_response
        var suspend3 = {
          reason: {suspended: 'automatic'},
          payload: {cause: 'low_glucose'},
          timezoneOffset: 0,
          time: '2014-09-25T00:05:10.000Z',
          deviceTime: '2014-09-25T00:05:10',
          conversionOffset: 0
        };
        // low_suspend_user_selected
        var suspend4 = {
          reason: {suspended: 'automatic'},
          payload: {cause: 'low_glucose'},
          timezoneOffset: 0,
          time: '2014-09-25T00:05:15.000Z',
          deviceTime: '2014-09-25T00:05:15',
          conversionOffset: 0
        };
        var basal2 = {
          time: '2014-09-25T00:05:20.000Z',
          deviceTime: '2014-09-25T00:05:20',
          rate: 1.0,
          scheduleName: 'billy',
          duration: 3600000,
          timezoneOffset: 0,
          conversionOffset: 0
        };
        var resume1 = {
          time: '2014-09-25T00:05:20.000Z',
          deviceTime: '2014-09-25T00:05:20',
          reason: {resumed: 'manual'},
          payload: {cause: 'user_restart_basal'},
          timezoneOffset: 0,
          conversionOffset: 0
        };
        var resume2 = {
          time: '2014-09-25T00:05:30.000Z',
          deviceTime: '2014-09-25T00:05:30',
          reason: {resumed: 'manual'},
          timezoneOffset: 0,
          conversionOffset: 0
        };
        var basal3 = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          rate: 2.0,
          scheduleName: 'billy',
          duration: 3600000,
          timezoneOffset: 0,
          conversionOffset: 0
        };
        var firstBasal = _.assign({}, basal1, {type: 'basal', deliveryType: 'scheduled'});
        var expectedSuspend = _.assign({}, suspend1, {type: 'deviceEvent', subType: 'status', status: 'suspended'});
        var suspendBasal = {
          type: 'basal', deliveryType: 'suspend', time: expectedSuspend.time, deviceTime: expectedSuspend.deviceTime,
          suppressed: firstBasal, duration: 20000, timezoneOffset: 0, conversionOffset: 0
        };

        it('should resume to the appropriate scheduled basal if no temp was running before the LGS suspend', function(){
          simulator.pumpSettings(settings);
          simulator.basalScheduled(basal1);
          simulator.suspend(suspend1);
          simulator.suspend(suspend2);
          simulator.suspend(suspend3);
          simulator.suspend(suspend4);
          simulator.basalScheduled(basal2);
          simulator.lgsResume(resume1);
          simulator.resume(resume2);
          simulator.basalScheduled(basal3);

          var fillInBasal = {
            type: 'basal', deliveryType: 'scheduled', time: resume1.time, deviceTime: resume1.deviceTime,
            previous: suspendBasal, annotations: [{code: 'carelink/basal/fabricated-from-suppressed'}], duration: 3280000,
            rate: 1.0, scheduleName: 'billy', timezoneOffset: 0, conversionOffset: 0
          };

          expect(simulator.getEvents()).deep.equals(
            attachPrev(
              [
                _.assign({}, settings, {type: 'pumpSettings'}),
                firstBasal,
                expectedSuspend,
                suspendBasal,
                _.assign({}, resume1, {
                  type: 'deviceEvent', subType: 'status',
                  status: 'resumed', previous: expectedSuspend, reason: {'resumed': 'manual'}
                }),
                fillInBasal,
                _.assign({}, basal3, {type: 'basal', deliveryType: 'scheduled'})
              ]
              )
            );
        });

        it('should resume to a temp if the temp would still be running', function(){
          var backToScheduled = _.assign({}, basal1, {
            time: '2014-09-25T00:32:00.000Z', deviceTime: '2014-09-25T00:32:00'
          });
          simulator.pumpSettings(settings);
          simulator.basalScheduled(basal1);
          simulator.basalTemp(temp);
          simulator.suspend(suspend1);
          simulator.suspend(suspend2);
          simulator.suspend(suspend3);
          simulator.suspend(suspend4);
          simulator.lgsResume(resume1);
          simulator.resume(resume2);
          simulator.basalScheduled(backToScheduled);
          simulator.basalScheduled(basal3);

          var tempBasal = _.assign({}, temp, {type: 'basal', deliveryType: 'temp', rate: 0.5, suppressed: firstBasal});
          var fillInBasal = _.assign({}, temp, {
            type: 'basal', deliveryType: 'temp', time: resume1.time, deviceTime: resume1.deviceTime,
            timezoneOffset: 0, suppressed: firstBasal, annotations: [{code: 'carelink/basal/fabricated-from-suppressed'}],
            rate: 0.5, duration: 1600000, conversionOffset: 0
          });

          expect(simulator.getEvents()).deep.equals(
            attachPrev(
              [
                _.assign({}, settings, {type: 'pumpSettings'}),
                firstBasal,
                tempBasal,
                expectedSuspend,
                _.assign({}, suspendBasal, {suppressed: tempBasal}),
                _.assign({}, resume1, {
                  type: 'deviceEvent', subType: 'status',
                  status: 'resumed', previous: expectedSuspend, reason: {'resumed': 'manual'}
                }),
                fillInBasal,
                _.assign({}, backToScheduled, {type: 'basal', deliveryType: 'scheduled', duration: 1680000}),
                _.assign({}, basal3, {type: 'basal', deliveryType: 'scheduled'})
              ]
              )
            );
        });

        it('should not resume to a temp if the temp would not still be running', function() {
          var thisTemp = _.assign({}, temp, {duration: 190000});
          simulator.pumpSettings(settings);
          simulator.basalScheduled(basal1);
          simulator.basalTemp(thisTemp);
          simulator.suspend(suspend1);
          simulator.suspend(suspend2);
          simulator.suspend(suspend3);
          simulator.suspend(suspend4);
          simulator.lgsResume(resume1);
          simulator.resume(resume2);
          simulator.basalScheduled(basal3);

          var tempBasal = _.assign({}, thisTemp, {type: 'basal', deliveryType: 'temp', rate: 0.5, suppressed: firstBasal});
          var secondSuspendBasal = {
            time: '2014-09-25T00:05:10.000Z', deviceTime: '2014-09-25T00:05:10', type: 'basal', deliveryType: 'suspend',
            suppressed: firstBasal, duration: 10000, timezoneOffset: 0, conversionOffset: 0
          };

          var fillInBasal = {
            type: 'basal', deliveryType: 'scheduled', time: resume1.time, deviceTime: resume1.deviceTime,
            previous: secondSuspendBasal, annotations: [{code: 'carelink/basal/fabricated-from-suppressed'}], duration: 3280000,
            rate: 1.0, scheduleName: 'billy', timezoneOffset: 0, conversionOffset: 0
          };

          expect(simulator.getEvents()).deep.equals(
            attachPrev(
              [
                _.assign({}, settings, {type: 'pumpSettings'}),
                firstBasal,
                tempBasal,
                expectedSuspend,
                _.assign({}, suspendBasal, {suppressed: tempBasal}),
                secondSuspendBasal,
                _.assign({}, resume1, {
                  type: 'deviceEvent', subType: 'status',
                  status: 'resumed', previous: expectedSuspend, reason: {'resumed': 'manual'}
                }),
                fillInBasal,
                _.assign({}, basal3, {type: 'basal', deliveryType: 'scheduled'})
              ]
              )
            );
        });
      });

      describe('automatic resume', function() {
        var settings = {
          time: '2014-09-25T00:00:00.000Z',
          deviceTime: '2014-09-25T00:00:00',
          activeSchedule: 'billy',
          units: { bg: 'mg/dL' },
          basalSchedules: {
            billy: [
              { start: 0, rate: 1.0 },
              { start: 3600000, rate: 2.0 },
              { start: 7200000, rate: 2.1 },
              { start: 10800000, rate: 2.2 },
              { start: 14400000, rate: 2.3 },
              { start: 18000000, rate: 2.4 },
              { start: 21600000, rate: 1.1 },
              { start: 43200000, rate: 1.2 },
              { start: 64800000, rate: 1.3 }
            ]
          },
          bgTarget: [],
          insulinSensitivity: [],
          carbRatio: [],
          timezoneOffset: 0,
          conversionOffset: 0
        };
        var basal1 = {
          time: '2014-09-25T00:00:00.000Z',
          deviceTime: '2014-09-25T00:00:00',
          rate: 1.0,
          scheduleName: 'billy',
          duration: 3600000,
          timezoneOffset: 0,
          conversionOffset: 0
        };
        var temp = {
          time: '2014-09-25T00:02:00.000Z',
          deviceTime: '2014-09-25T00:02:00',
          percent: 0.5,
          duration: 864e5,
          timezoneOffset: 0,
          conversionOffset: 0
        };
        // alarm_suspend
        var suspend1 = {
          reason: {suspended: 'automatic'},
          payload: {cause: 'low_glucose'},
          timezoneOffset: 0,
          time: '2014-09-25T00:05:00.000Z',
          deviceTime: '2014-09-25T00:05:00',
          conversionOffset: 0
        };
        // low_suspend_no_response
        var suspend2 = {
          reason: {suspended: 'automatic'},
          payload: {cause: 'low_glucose'},
          timezoneOffset: 0,
          time: '2014-09-25T00:05:10.000Z',
          deviceTime: '2014-09-25T00:05:10',
          conversionOffset: 0
        };
        // auto_resume_reduced
        var resume = {
          time: '2014-09-25T02:05:00.000Z',
          deviceTime: '2014-09-25T02:05:00',
          reason: {resumed: 'automatic'},
          payload: {cause: 'auto_resume_reduced', user_intervention: 'ignored'},
          timezoneOffset: 0,
          conversionOffset: 0
        };
        var basal2 = {
          time: '2014-09-25T02:05:00.000Z',
          deviceTime: '2014-09-25T02:05:00',
          rate: 2.1,
          scheduleName: 'billy',
          duration: 3300000,
          timezoneOffset: 0,
          conversionOffset: 0
        };
        it('should not resume to a temp when `auto_resume_reduced` even if the temp would still be running', function() {
          simulator.pumpSettings(settings);
          simulator.basalScheduled(basal1);
          simulator.basalTemp(temp);
          simulator.suspend(suspend1);
          simulator.suspend(suspend2);
          simulator.lgsAutoResume(resume);
          simulator.basalScheduled(basal2);

          var firstBasal = _.assign({}, basal1, {type: 'basal', deliveryType: 'scheduled'});
          var tempBasal = _.assign({}, temp, {type: 'basal', deliveryType: 'temp', suppressed: firstBasal, rate: 0.5});

          var expectedSuspend = _.assign({}, suspend1, {type: 'deviceEvent', subType: 'status', status: 'suspended'});

          var suspendBasal1 = {
            time: '2014-09-25T00:05:00.000Z', deviceTime: '2014-09-25T00:05:00', type: 'basal', deliveryType: 'suspend',
            timezoneOffset: 0, conversionOffset: 0, suppressed: tempBasal, previous: tempBasal, duration: 7200000
          };
          var suspendBasal2 = {
            time: '2014-09-25T01:00:00.000Z', deviceTime: '2014-09-25T01:00:00', type: 'basal', deliveryType: 'suspend', duration: 3900000,
            timezoneOffset: 0, conversionOffset: 0, suppressed: _.assign({}, tempBasal, {rate: 1.0, suppressed: {
              time: '2014-09-25T01:00:00.000Z', deviceTime: '2014-09-25T01:00:00', type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy',
              timezoneOffset: 0, conversionOffset: 0, rate: 2.0, annotations: [{code: 'carelink/basal/fabricated-from-schedule'}], duration: 3600000
            }}), previous: _.omit(suspendBasal1, 'previous')
          };
          var suspendBasal3 = {
            time: '2014-09-25T02:00:00.000Z', deviceTime: '2014-09-25T02:00:00', type: 'basal', deliveryType: 'suspend', duration: 300000,
            timezoneOffset: 0, conversionOffset: 0, suppressed: _.assign({}, tempBasal, {rate: 1.05, suppressed: {
              time: '2014-09-25T02:00:00.000Z', deviceTime: '2014-09-25T02:00:00', type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy',
              timezoneOffset: 0, conversionOffset: 0, rate: 2.1, annotations: [{code: 'carelink/basal/fabricated-from-schedule'}], duration: 3600000
            }}), previous: _.omit(suspendBasal2, 'previous')
          };

          expect(simulator.getEvents()).deep.equals(
            attachPrev(
              [
                _.assign({}, settings, {type: 'pumpSettings'}),
                firstBasal,
                tempBasal,
                expectedSuspend,
                suspendBasal1,
                suspendBasal2,
                suspendBasal3,
                _.assign({}, resume, {type: 'deviceEvent', subType: 'status', status: 'resumed', previous: expectedSuspend}),
                _.assign({}, basal2, {type: 'basal', deliveryType: 'scheduled'})
              ]
              )
            );
        });
      });
    });
  });
});
