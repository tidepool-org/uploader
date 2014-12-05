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

var pwdSimulator = require('../lib/simulator/pwdSimulator.js');

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

describe('pwdSimulator.js', function(){
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
        value: 123,
        timezoneOffset: 0
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
        value: 1.3,
        timezoneOffset: 0
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
          timezoneOffset: 0
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
          timezoneOffset: 0
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
          timezoneOffset: 0
        };

        simulator.bolusSquare(val);
        expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'bolus', subType: 'square'}, val)]);
      });
    });
  });


  describe('basal', function(){
    describe('scheduled', function(){
      describe('withoutSettings', function(){
        it('passes through without an annotation', function(){
          var val = {
            time: '2014-09-25T01:00:00.000Z',
            deviceTime: '2014-09-25T01:00:00',
            scheduleName: 'billy',
            rate: 1.3,
            duration: 3600000,
            timezoneOffset: 0
          };

          simulator.basalScheduled(val);
          expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'basal', deliveryType: 'scheduled'}, val)]);
        });

        it('attaches a previous when there is an active basal', function(){
          var initialBasal = {
            time: '2014-09-25T01:00:00.000Z',
            deviceTime: '2014-09-25T01:00:00',
            scheduleName: 'billy',
            rate: 1.3,
            duration: 3600000,
            timezoneOffset: 0
          };
          var secondBasal = {
            time: '2014-09-25T02:00:00.000Z',
            deviceTime: '2014-09-25T02:00:00',
            scheduleName: 'billy',
            rate: 1.4,
            duration: 3600000,
            timezoneOffset: 0
          };
          var thirdBasal = {
            time: '2014-09-25T03:00:00.000Z',
            deviceTime: '2014-09-25T03:00:00',
            scheduleName: 'billy',
            rate: 1.5,
            duration: 3600000,
            timezoneOffset: 0
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
            timezoneOffset: 0
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
            ]
          },
          timezoneOffset: 0
        };

        beforeEach(function(){
          simulator.settings(settings);
        });

        describe('with duration', function(){
          it('passes through a scheduled that agrees with the schedule without annotation', function(){
            var val = {
              time: '2014-09-25T06:00:00.000Z',
              deviceTime: '2014-09-25T06:00:00',
              duration: 21600000,
              scheduleName: 'billy',
              rate: 1.1,
              timezoneOffset: 0
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
              timezoneOffset: 0
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
              timezoneOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.defaults({
                  type: 'basal',
                  deliveryType: 'scheduled',
                  duration: 21600000,
                  annotations: [{code: 'basal/off-schedule-rate'}]
                }, val)
              ]);
          });
        });

        describe('no duration', function(){
          it('attaches a duration according to the schedule', function(){
            var val = {
              time: '2014-09-25T01:00:00.000Z',
              deviceTime: '2014-09-25T01:00:00',
              scheduleName: 'billy',
              rate: 1.0,
              timezoneOffset: 0
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
              timezoneOffset: 0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign(
                  { type: 'basal', deliveryType: 'scheduled', duration: 0 },
                  { annotations: [{code: 'basal/off-schedule-rate'}] },
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
          timezoneOffset: -240
        };

        beforeEach(function(){
          simulator.settings(settings);
        });

        describe('with duration', function(){
          it('passes through a scheduled that agrees with the schedule without annotation', function(){
            var val = {
              time: '2014-09-25T10:00:00.000Z',
              deviceTime: '2014-09-25T06:00:00',
              duration: 21600000,
              scheduleName: 'billy',
              rate: 1.1,
              timezoneOffset: -240
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
              timezoneOffset: -240
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
              timezoneOffset: -240
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.defaults({
                  type: 'basal',
                  deliveryType: 'scheduled',
                  duration: 21600000,
                  annotations: [{code: 'basal/off-schedule-rate'}]
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
              timezoneOffset: -240
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
              timezoneOffset: -240
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign(
                  { type: 'basal', deliveryType: 'scheduled', duration: 0 },
                  { annotations: [{code: 'basal/off-schedule-rate'}] },
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
            timezoneOffset: 0
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
            timezoneOffset: 0
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
          timezoneOffset: 0
        };
        var basal = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          scheduleName: 'billy',
          rate: 2.0,
          timezoneOffset: 0
        };
        var basalEvent = _.assign({}, {type: 'basal', deliveryType: 'scheduled', duration: 18000000}, basal);


        beforeEach(function(){
          simulator.settings(settings);
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
            timezoneOffset: 0
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
            timezoneOffset: 0
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
          timezoneOffset: -240
        };
        var basal = {
          time: '2014-09-25T05:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          scheduleName: 'billy',
          rate: 2.0,
          timezoneOffset: -240
        };
        var basalEvent = _.assign({}, {type: 'basal', deliveryType: 'scheduled', duration: 18000000}, basal);


        beforeEach(function(){
          simulator.settings(settings);
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
            timezoneOffset: -240
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
            timezoneOffset: -240
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
        timezoneOffset: 0
      };

      simulator.settings(val);
      expect(simulator.getEvents()).deep.equals([_.assign({}, {type: 'settings'}, val)]);
    });
  });

  describe('deviceMeta', function() {
    var suspend = { time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00', reason: 'manual', timezoneOffset: 0 };
    var resume = { time: '2014-09-25T01:10:00.000Z', deviceTime: '2014-09-25T01:10:00', reason: 'manual', timezoneOffset: 0 };

    it('sets up the previous', function(){
      simulator.suspend(suspend);
      simulator.resume(resume);
      var expectedSuspend = _.assign({}, {type: 'deviceMeta', subType: 'status', status: 'suspended'}, suspend);
      expect(simulator.getEvents().filter(function(e){ return e.type === 'deviceMeta'; })).deep.equals([
        expectedSuspend,
        _.assign({}, {type: 'deviceMeta', subType: 'status', status: 'resumed', previous: expectedSuspend}, resume),
        ]);
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
        timezoneOffset: 0
      };
      var basal = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: 0
      };
      var temp = {
        time: '2014-09-25T00:30:00.000Z',
        deviceTime: '2014-09-25T00:30:00',
        percent: 0.1,
        duration: 7200000,
        timezoneOffset: 0
      };

      it('fills in for changes in schedule when another scheduled appears', function(){
        simulator.settings(settings);
        simulator.basalScheduled(basal);
        simulator.basalTemp(temp);

        var val = {
          time: '2014-09-25T02:30:00.000Z',
          deviceTime: '2014-09-25T02:30:00',
          scheduleName: 'billy',
          rate: 2.1,
          timezoneOffset: 0
        };

        simulator.basalScheduled(val);

        expect(getBasals()).deep.equals(
          attachPrev(
            [
              _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 7200000,
                time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                timezoneOffset: 0,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                  time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00', timezoneOffset: 0
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.2, duration: 5400000,
                time: '2014-09-25T01:00:00.000Z', deviceTime: '2014-09-25T00:30:00',
                timezoneOffset: 0,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                  time: '2014-09-25T01:00:00.000Z', timezoneOffset: 0,
                  annotations: [{ code: 'basal/fabricated-from-schedule' }]
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 2.1 * 0.1, duration: 1800000,
                time: '2014-09-25T02:00:00.000Z', deviceTime: '2014-09-25T00:30:00',
                timezoneOffset: 0,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.1, duration: 3600000,
                  time: '2014-09-25T02:00:00.000Z', timezoneOffset: 0,
                  annotations: [{ code: 'basal/fabricated-from-schedule' }]
                }
              },
              _.assign({}, val,
                       { type: 'basal', time: '2014-09-25T02:30:00.000Z', deviceTime: '2014-09-25T02:30:00',
                         deliveryType: 'scheduled', duration: 1800000, timezoneOffset: 0 }
              )
            ]));
      });

      it('completes a temp that is suppressed by a suspended before completing the scheduled that ends after the temp',
         function(){
           simulator.settings(settings);
           simulator.basalScheduled(basal);
           simulator.basalTemp(_.assign({}, temp, { duration: 900000 })); // 15 minutes

           simulator.suspend({ time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00', reason: 'manual', timezoneOffset: 0 });
           expect(getBasals()).deep.equals(
             attachPrev(
               [
                 _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
                 {
                   type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                   time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                   timezoneOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00', timezoneOffset: 0
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend',
                   time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   timezoneOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                     time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00', timezoneOffset: 0,
                     suppressed: {
                       type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                       time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00', timezoneOffset: 0
                     }
                   }
                 }
               ])
           );

           simulator.resume({ time: '2014-09-25T01:10:00.000Z', deviceTime: '2014-09-25T01:10:00', reason: 'manual', timezoneOffset: 0 });

           expect(getBasals()).deep.equals(
             attachPrev(
               [
                 _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
                 {
                   type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                   time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                   timezoneOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00', timezoneOffset: 0
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 1800000,
                   time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   timezoneOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                     time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00', timezoneOffset: 0,
                     suppressed: {
                       type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                       time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',  timezoneOffset: 0
                     }
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 1500000,
                   time: '2014-09-25T00:45:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   timezoneOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00', timezoneOffset: 0
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 600000,
                   time: '2014-09-25T01:00:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   timezoneOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                     time: '2014-09-25T01:00:00.000Z', timezoneOffset: 0,
                     annotations: [{ code: 'basal/fabricated-from-schedule' }]
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3000000,
                   time: '2014-09-25T01:10:00.000Z', timezoneOffset: 0,
                   annotations: [{ code: 'basal/fabricated-from-schedule' }]
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
              time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00', timezoneOffset: 0
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
        timezoneOffset: 0
      };
      var basal = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: 0
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
        timezoneOffset: 0
      };
      var nextScheduled = {
        time: '2014-09-25T00:30:05.000Z',
        deviceTime: '2014-09-25T00:30:05',
        scheduleName: 'billy',
        rate: 1.5,
        timezoneOffset: 0
      };

      it('includes old-settings scheduled as `previous` in new-settings scheduled', function(){
        simulator.settings(settings);
        simulator.basalScheduled(basal);
        simulator.settings(newSettings);
        simulator.basalScheduled(nextScheduled);

        expect(getBasals()).deep.equals(
          attachPrev(
            [
              _.assign({}, basal, {type: 'basal', deliveryType: 'scheduled', duration: 3600000}),
              {
                type: 'basal', deliveryType: 'scheduled', duration: 1795000,
                time: '2014-09-25T00:30:05.000Z', deviceTime: '2014-09-25T00:30:05',
                rate: 1.5, scheduleName: 'billy', timezoneOffset: 0
              }
            ]
          )
        );
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
          timezoneOffset: 0
        };


        simulator.settings(settings);
        simulator.settings(_.assign({}, settings, {time: '2014-09-27T00:00:00.000Z', activeSchedule: 'bob'}));
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
          timezoneOffset: 0
        };

        simulator.settings(settings);
        simulator.settings(_.assign({}, settings, {time: '2014-09-27T00:00:00.000Z', activeSchedule: 'bob'}));
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
          timezoneOffset: 0
        };

        var basal = { type: 'basal', deliveryType: 'scheduled', time: '2014-09-25T00:00:00.000Z',
          scheduleName: 'billy', rate: 0, duration: 86400000, timezoneOffset: 0 };
        simulator.basalScheduled(basal);
        simulator.settings(settings);
        simulator.settings(_.assign({}, settings, {time: '2014-09-27T00:00:00.000Z', activeSchedule: 'bob'}));
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
          timezoneOffset: 0
        };

        simulator.settings(settings);
        simulator.settings(_.assign({}, settings, {time: '2014-09-27T00:00:00.000Z', activeSchedule: 'bob'}));

        var expectedBasal = {
          deliveryType: 'scheduled',
          type: 'basal',
          time: '2014-09-25T00:00:00.000Z',
          scheduleName: 'billy',
          rate: 1.0,
          duration: 21600000,
          annotations: [{code: 'basal/fabricated-from-schedule'}],
          timezoneOffset: 0
        };

        expect(getBasals()).deep.equals(
          attachPrev(
            [
              expectedBasal,
              _.assign({}, expectedBasal, {time: '2014-09-25T06:00:00.000Z', rate: 1.1}),
              _.assign({}, expectedBasal, {time: '2014-09-25T12:00:00.000Z', rate: 1.2}),
              _.assign({}, expectedBasal, {time: '2014-09-25T18:00:00.000Z', rate: 1.3}),
              _.assign({}, expectedBasal, {time: '2014-09-26T00:00:00.000Z', rate: 1.0}),
              _.assign({}, expectedBasal, {time: '2014-09-26T06:00:00.000Z', rate: 1.1}),
              _.assign({}, expectedBasal, {time: '2014-09-26T12:00:00.000Z', rate: 1.2}),
              _.assign({}, expectedBasal, {time: '2014-09-26T18:00:00.000Z', rate: 1.3})
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
          timezoneOffset: 0
        };

        simulator.settings(settings);

        var expectedBasal = {
          deliveryType: 'scheduled',
          type: 'basal',
          time: '2014-09-25T07:00:00.000Z',
          scheduleName: 'billy',
          rate: 1.1,
          duration: 18000000,
          annotations: [{code: 'basal/fabricated-from-schedule'}],
          timezoneOffset: 0
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
          timezoneOffset: 0
        };

        simulator.settings(settings);

        var expectedBasal = {
          type: 'basal',
          deliveryType: 'scheduled',
          time: '2014-09-25T20:00:00.000Z',
          scheduleName: 'billy',
          rate: 1.3,
          duration: 14400000,
          annotations: [{code: 'basal/fabricated-from-schedule'}],
          timezoneOffset: 0
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
        timezoneOffset: -600
      };
      var firstBasal = {
        rate: 0.825,
        deviceTime: '2014-03-15T16:22:15',
        time: '2014-03-16T02:22:15.000Z',
        timezoneOffset: -600,
        scheduleName: 'standard'
      };
      var suspend = {
        reason: 'manual',
        timezoneOffset: -600,
        time: '2014-03-16T02:23:19.000Z',
        deviceTime: '2014-03-15T16:23:19'
      };
      var secondBasal = {
        rate: 0.825,
        deviceTime: '2014-03-15T17:18:34',
        time: '2014-03-16T03:18:34.000Z',
        timezoneOffset: -600,
        scheduleName: 'standard'
      };
      var resume = {
        reason: 'manual',
        timezoneOffset: -600,
        time: '2014-03-16T03:18:35.000Z',
        deviceTime: '2014-03-15T17:18:35'
      };

      it('should add correct previouses to basals and deviceMetas', function(){
        simulator.settings(settings);
        simulator.basalScheduled(firstBasal);
        simulator.suspend(suspend);
        simulator.basalScheduled(secondBasal);
        simulator.resume(resume);
        var firstBasalRes = _.assign({}, firstBasal, {type: 'basal', duration: 27465000, deliveryType: 'scheduled'});
        var expectedSuspend = _.assign({}, suspend, {type: 'deviceMeta', subType: 'status', status: 'suspended'});
        var basalSuspend = {
          deliveryType: 'suspend',
          // TODO: not sure if we actually expect this to be calculated here rather than in jellyfish
          duration: 3316000,
          type: 'basal',
          timezoneOffset: -600,
          deviceTime: suspend.deviceTime,
          time: suspend.time,
          suppressed: firstBasalRes,
          previous: firstBasalRes
        };
        var secondBasalRes = _.assign({}, secondBasal, {
          type: 'basal',
          duration: 24085000,
          deliveryType: 'scheduled',
          time: resume.time,
          deviceTime: resume.deviceTime,
          previous: _.omit(basalSuspend, 'previous'),
          annotations: [{code: 'basal/fabricated-from-schedule'}]
        });
        expect(simulator.getEvents()).deep.equals(
          [
            _.assign({}, settings, {type: 'settings'}),
            firstBasalRes,
            expectedSuspend,
            basalSuspend,
            secondBasalRes,
            _.assign({}, resume, {type: 'deviceMeta', subType: 'status', status: 'resumed', previous: expectedSuspend})
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
        timezoneOffset: -240
      };
      var basal = {
        time: '2014-09-25T04:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: -240
      };
      var temp = {
        time: '2014-09-25T04:30:00.000Z',
        deviceTime: '2014-09-25T00:30:00',
        percent: 0.1,
        duration: 7200000,
        timezoneOffset: -240
      };

      it('fills in for changes in schedule when another scheduled appears', function(){
        simulator.settings(settings);
        simulator.basalScheduled(basal);
        simulator.basalTemp(temp);

        var val = {
          time: '2014-09-25T06:30:00.000Z',
          deviceTime: '2014-09-25T02:30:00',
          scheduleName: 'billy',
          rate: 2.1,
          timezoneOffset: -240
        };

        simulator.basalScheduled(val);

        expect(getBasals()).deep.equals(
          attachPrev(
            [
              _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 7200000,
                time: '2014-09-25T04:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                timezoneOffset: -240,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                  time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                  timezoneOffset: -240
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.2, duration: 5400000,
                time: '2014-09-25T05:00:00.000Z', deviceTime: '2014-09-25T00:30:00',
                timezoneOffset: -240,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                  time: '2014-09-25T05:00:00.000Z', timezoneOffset: -240,
                  annotations: [{ code: 'basal/fabricated-from-schedule' }]
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 2.1 * 0.1, duration: 1800000,
                time: '2014-09-25T06:00:00.000Z', deviceTime: '2014-09-25T00:30:00',
                timezoneOffset: -240,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.1, duration: 3600000,
                  time: '2014-09-25T06:00:00.000Z', timezoneOffset: -240,
                  annotations: [{ code: 'basal/fabricated-from-schedule' }]
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
           simulator.settings(settings);
           simulator.basalScheduled(basal);
           simulator.basalTemp(_.assign({}, temp, { duration: 900000 })); // 15 minutes

           simulator.suspend({ time: '2014-09-25T04:40:00.000Z', deviceTime: '2014-09-25T00:40:00',
              reason: 'manual', timezoneOffset: -240 });
           expect(getBasals()).deep.equals(
             attachPrev(
               [
                 _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
                 {
                   type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                   time: '2014-09-25T04:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                   timezoneOffset: -240,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                     timezoneOffset: -240
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend',
                   time: '2014-09-25T04:40:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   timezoneOffset: -240,
                   suppressed: {
                     type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                     time: '2014-09-25T04:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                     timezoneOffset: -240,
                     suppressed: {
                       type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                       time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                       timezoneOffset: -240
                     }
                   }
                 }
               ])
           );

           simulator.resume({ time: '2014-09-25T05:10:00.000Z', deviceTime: '2014-09-25T01:10:00',
            reason: 'manual', timezoneOffset: -240 });

           expect(getBasals()).deep.equals(
             attachPrev(
               [
                 _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
                 {
                   type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                   time: '2014-09-25T04:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                   timezoneOffset: -240,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                     timezoneOffset: -240
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 1800000,
                   time: '2014-09-25T04:40:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   timezoneOffset: -240,
                   suppressed: {
                     type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                     time: '2014-09-25T04:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                     timezoneOffset: -240,
                     suppressed: {
                       type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                       time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                       timezoneOffset: -240
                     }
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 1500000,
                   time: '2014-09-25T04:45:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   timezoneOffset: -240,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                     timezoneOffset: -240
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 600000,
                   time: '2014-09-25T05:00:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   timezoneOffset: -240,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                     time: '2014-09-25T05:00:00.000Z', timezoneOffset: -240,
                     annotations: [{ code: 'basal/fabricated-from-schedule' }]
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3000000,
                   time: '2014-09-25T05:10:00.000Z', timezoneOffset: -240,
                   annotations: [{ code: 'basal/fabricated-from-schedule' }]
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
              timezoneOffset: -240
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
        timezoneOffset: -240
      };
      var basal = {
        time: '2014-09-25T04:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: -240
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
        timezoneOffset: -240
      };
      var nextScheduled = {
        time: '2014-09-25T04:30:05.000Z',
        deviceTime: '2014-09-25T00:30:05',
        scheduleName: 'billy',
        rate: 1.5,
        timezoneOffset: -240
      };

      it('includes old-settings scheduled as `previous` in new-settings scheduled', function(){
        simulator.settings(settings);
        simulator.basalScheduled(basal);
        simulator.settings(newSettings);
        simulator.basalScheduled(nextScheduled);

        expect(getBasals()).deep.equals(
          attachPrev(
            [
              _.assign({}, basal, {type: 'basal', deliveryType: 'scheduled', duration: 3600000}),
              {
                type: 'basal', deliveryType: 'scheduled', duration: 1795000,
                time: '2014-09-25T04:30:05.000Z', deviceTime: '2014-09-25T00:30:05',
                rate: 1.5, scheduleName: 'billy', timezoneOffset: -240
              }
            ]
          )
        );
      });

    });
  });
});
