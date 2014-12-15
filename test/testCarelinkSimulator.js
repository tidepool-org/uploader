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

var pwdSimulator = require('../lib/simulator/carelinkSimulator.js');

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
            ],
            'bob': [
              { start: 0, rate: 0.0}
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
              timezoneOffset: 0
            };
            var basal2 = {
              time: '2014-09-27T00:00:00.000Z',
              deviceTime: '2014-09-27T00:00:00',
              duration: 864e5,
              scheduleName: 'bob',
              rate: 0.0,
              timezoneOffset: 0
            };

            var annotation = [{code: 'carelink/basal/off-schedule-rate'}];

            simulator.basalScheduled(basal1);
            simulator.basalScheduled(basal2);

            expect(getBasals()).deep.equals(
              attachPrev(
                [
                  _.assign({}, basal1, {type: 'basal', deliveryType: 'scheduled', annotations: annotation}),
                  {
                    time: '2014-09-26T00:00:00.000Z', timezoneOffset: 0,
                    duration: 864e5, scheduleName: 'bob', rate: 0.0, type: 'basal', deliveryType: 'scheduled',
                    annotations: [{code: 'carelink/basal/fabricated-from-schedule'}]
                  },
                  _.assign({}, basal2, {type: 'basal', deliveryType: 'scheduled', annotations: annotation})
                ]
                )
              );
          });

          it('skips over a scheduled that has an out-of-sequence uploadSeqNum', function(){
            // NB: based on a true story
            // TODO: remove when we are boostrapping to 100% UTC timestamps before processing
            // that should eliminate all out-of-sequence scheduled basals
            var basal1 = {
              time: '2014-09-25T06:00:00.000Z',
              deviceTime: '2014-09-25T06:00:00',
              duration: 21600000,
              scheduleName: 'billy',
              rate: 1.1,
              timezoneOffset: 0,
              uploadSeqNum: 100
            };
            var basal2 = {
              time: '2014-09-25T07:00:00.000Z',
              deviceTime: '2014-09-25T07:00:00',
              duration: 61200000,
              scheduleName: 'bob',
              rate: 0.0,
              timezoneOffset: 0,
              uploadSeqNum: 101
            };
            var basal3 = {
              time: '2014-09-27T00:00:00.000Z',
              deviceTime: '2014-09-27T00:00:00',
              duration: 864e5,
              scheduleName: 'bob',
              rate: 0.0,
              timezoneOffset: 0,
              uploadSeqNum: 99
            };

            var annotation = [{code: 'carelink/basal/off-schedule-rate'}];
            var fabricated = [{code: 'carelink/basal/fabricated-from-schedule'}];

            simulator.basalScheduled(basal1);
            simulator.basalScheduled(basal2);
            simulator.basalScheduled(basal3);

            expect(getBasals()).deep.equals(
              attachPrev(
                [
                  _.assign({}, _.omit(basal1, 'uploadSeqNum'), {type: 'basal', deliveryType: 'scheduled'}),
                  {
                    time: '2014-09-25T12:00:00.000Z', timezoneOffset: 0, type: 'basal',
                    deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.2,
                    duration: 21600000, annotations: fabricated
                  },
                  {
                    time: '2014-09-25T18:00:00.000Z', timezoneOffset: 0, type: 'basal',
                    deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.3,
                    duration: 21600000, annotations: fabricated
                  },
                  {
                    time: '2014-09-26T00:00:00.000Z', timezoneOffset: 0, type: 'basal',
                    deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0,
                    duration: 21600000, annotations: fabricated
                  },
                  {
                    time: '2014-09-26T06:00:00.000Z', timezoneOffset: 0, type: 'basal',
                    deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.1,
                    duration: 21600000, annotations: fabricated
                  },
                  {
                    time: '2014-09-26T12:00:00.000Z', timezoneOffset: 0, type: 'basal',
                    deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.2,
                    duration: 21600000, annotations: fabricated
                  },
                  {
                    time: '2014-09-26T18:00:00.000Z', timezoneOffset: 0, type: 'basal',
                    deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.3,
                    duration: 21600000, annotations: fabricated
                  },
                  _.assign({}, _.omit(basal3, 'uploadSeqNum'), {type: 'basal', deliveryType: 'scheduled', annotations: annotation})
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
                time: '2014-09-25T01:00:00.000Z', timezoneOffset: 0,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                  time: '2014-09-25T01:00:00.000Z', timezoneOffset: 0,
                  annotations: [{ code: 'carelink/basal/fabricated-from-schedule' }]
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 2.1 * 0.1, duration: 1800000,
                time: '2014-09-25T02:00:00.000Z', timezoneOffset: 0,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.1, duration: 3600000,
                  time: '2014-09-25T02:00:00.000Z', timezoneOffset: 0,
                  annotations: [{ code: 'carelink/basal/fabricated-from-schedule' }]
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
                   time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00', timezoneOffset: 0,
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
                   time: '2014-09-25T00:45:00.000Z', timezoneOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T00:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00', timezoneOffset: 0
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 600000,
                   time: '2014-09-25T01:00:00.000Z', timezoneOffset: 0,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                     time: '2014-09-25T01:00:00.000Z', timezoneOffset: 0,
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
        timezoneOffset: 0
      };
      var basal = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: 0
      };
      var suspend = {
        reason: 'manual',
        timezoneOffset: 0,
        time: '2014-09-25T00:05:00.000Z',
        deviceTime: '2014-09-25T00:05:00'
      };
      var resume = {
        reason: 'manual',
        timezoneOffset: 0,
        time: '2014-09-25T00:12:00.000Z',
        deviceTime: '2014-09-25T00:12:00'
      };
      var nextBasal = {
        time: '2014-09-25T00:12:00.000Z',
        deviceTime: '2014-09-25T00:12:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: 0
      };
      it('should use a provided nextBasal and not create a duplicate', function(){
        simulator.settings(settings);
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
              deviceTime: '2014-09-25T00:05:00', duration: 420000, timezoneOffset: 0, suppressed: expectedFirstBasal
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
          timezoneOffset: 0
        };
        simulator.settings(settings);
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
              deviceTime: '2014-09-25T00:05:00', duration: 420000, timezoneOffset: 0, suppressed: expectedFirstBasal
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
        timezoneOffset: 0
      };
      var basal = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0,
        timezoneOffset: 0
      };
      var tempBasal = {
        time: '2014-09-25T00:02:00.000Z',
        deviceTime: '2014-09-25T00:02:00',
        percent: 0.2,
        timezoneOffset: 0,
        scheduleName: 'billy',
        duration: 1800000
      };
      var suspend = {
        reason: 'manual',
        timezoneOffset: 0,
        time: '2014-09-25T00:05:00.000Z',
        deviceTime: '2014-09-25T00:05:00'
      };
      var resume = {
        reason: 'manual',
        timezoneOffset: 0,
        time: '2014-09-25T00:12:00.000Z',
        deviceTime: '2014-09-25T00:12:00'
      };

      it('generates a temp basal from the suppressed if resume happens within original duration of temp', function(){
        var newBasal = {
          time: '2014-09-25T00:32:00.000Z',
          deviceTime: '2014-09-25T00:32:00',
          scheduleName: 'billy',
          rate: 1.0,
          timezoneOffset: 0
        };
        simulator.settings(settings);
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
              deviceTime: '2014-09-25T00:05:00', duration: 420000, timezoneOffset: 0, suppressed: expectedTempBasal
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
          annotations: [{code: 'carelink/basal/fabricated-from-schedule'}],
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
          annotations: [{code: 'carelink/basal/fabricated-from-schedule'}],
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
          annotations: [{code: 'carelink/basal/fabricated-from-schedule'}],
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
          type: 'basal',
          timezoneOffset: -600,
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
            _.assign({}, settings, {type: 'settings'}),
            firstBasalRes,
            expectedSuspend,
            basalSuspend,
            _.assign({}, resume, {
              type: 'deviceMeta', subType: 'status', status: 'resumed', previous: expectedSuspend,
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
                time: '2014-09-25T05:00:00.000Z', timezoneOffset: -240,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                  time: '2014-09-25T05:00:00.000Z', timezoneOffset: -240,
                  annotations: [{ code: 'carelink/basal/fabricated-from-schedule' }]
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 2.1 * 0.1, duration: 1800000,
                time: '2014-09-25T06:00:00.000Z', timezoneOffset: -240,
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.1, duration: 3600000,
                  time: '2014-09-25T06:00:00.000Z', timezoneOffset: -240,
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
                   time: '2014-09-25T04:45:00.000Z',
                   timezoneOffset: -240,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T04:00:00.000Z', 'deviceTime': '2014-09-25T00:00:00',
                     timezoneOffset: -240
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 600000,
                   time: '2014-09-25T05:00:00.000Z',
                   timezoneOffset: -240,
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                     time: '2014-09-25T05:00:00.000Z', timezoneOffset: -240,
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
          timezoneOffset: 0
        };
        var basal1 = {
          time: '2014-09-25T00:00:00.000Z',
          deviceTime: '2014-09-25T00:00:00',
          rate: 1.0,
          scheduleName: 'billy',
          duration: 3600000,
          timezoneOffset: 0
        };
        var temp = {
          time: '2014-09-25T00:02:00.000Z',
          deviceTime: '2014-09-25T00:02:00',
          percent: 0.5,
          duration: 1800000,
          timezoneOffset: 0
        };
        // alarm_suspend
        var suspend1 = {
          reason: 'low_glucose',
          timezoneOffset: 0,
          time: '2014-09-25T00:05:00.000Z',
          deviceTime: '2014-09-25T00:05:00'
        };
        // low_suspend_mode_1
        var suspend2 = {
          reason: 'low_glucose',
          timezoneOffset: 0,
          time: '2014-09-25T00:05:05.000Z',
          deviceTime: '2014-09-25T00:05:05'
        };
        // low_suspend_no_response
        var suspend3 = {
          reason: 'low_glucose',
          timezoneOffset: 0,
          time: '2014-09-25T00:05:10.000Z',
          deviceTime: '2014-09-25T00:05:10'
        };
        // low_suspend_user_selected
        var suspend4 = {
          reason: 'low_glucose',
          timezoneOffset: 0,
          time: '2014-09-25T00:05:15.000Z',
          deviceTime: '2014-09-25T00:05:15'
        };
        var basal2 = {
          time: '2014-09-25T00:05:20.000Z',
          deviceTime: '2014-09-25T00:05:20',
          rate: 1.0,
          scheduleName: 'billy',
          duration: 3600000,
          timezoneOffset: 0
        };
        var resume1 = {
          time: '2014-09-25T00:05:20.000Z',
          deviceTime: '2014-09-25T00:05:20',
          reason: 'user_restart_basal',
          timezoneOffset: 0
        };
        var resume2 = {
          time: '2014-09-25T00:05:30.000Z',
          deviceTime: '2014-09-25T00:05:30',
          reason: 'manual',
          timezoneOffset: 0
        };
        var basal3 = {
          time: '2014-09-25T01:00:00.000Z',
          deviceTime: '2014-09-25T01:00:00',
          rate: 2.0,
          scheduleName: 'billy',
          duration: 3600000,
          timezoneOffset: 0
        };
        var firstBasal = _.assign({}, basal1, {type: 'basal', deliveryType: 'scheduled'});
        var expectedSuspend = _.assign({}, suspend1, {type: 'deviceMeta', subType: 'status', status: 'suspended'});
        var suspendBasal = {
          type: 'basal', deliveryType: 'suspend', time: expectedSuspend.time, deviceTime: expectedSuspend.deviceTime,
          suppressed: firstBasal, duration: 20000, timezoneOffset: 0
        };

        it('should resume to the appropriate scheduled basal if no temp was running before the LGS suspend', function(){
          simulator.settings(settings);
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
            rate: 1.0, scheduleName: 'billy', timezoneOffset: 0
          };

          expect(simulator.getEvents()).deep.equals(
            attachPrev(
              [
                _.assign({}, settings, {type: 'settings'}),
                firstBasal,
                expectedSuspend,
                suspendBasal,
                _.assign({}, resume1, {
                  type: 'deviceMeta', subType: 'status',
                  status: 'resumed', previous: expectedSuspend, reason: 'manual'
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
          simulator.settings(settings);
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
            rate: 0.5, duration: 1600000
          });

          expect(simulator.getEvents()).deep.equals(
            attachPrev(
              [
                _.assign({}, settings, {type: 'settings'}),
                firstBasal,
                tempBasal,
                expectedSuspend,
                _.assign({}, suspendBasal, {suppressed: tempBasal}),
                _.assign({}, resume1, {
                  type: 'deviceMeta', subType: 'status',
                  status: 'resumed', previous: expectedSuspend, reason: 'manual'
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
          simulator.settings(settings);
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
            time: '2014-09-25T00:05:10.000Z', type: 'basal', deliveryType: 'suspend',
            suppressed: firstBasal, duration: 10000, timezoneOffset: 0
          };

          var fillInBasal = {
            type: 'basal', deliveryType: 'scheduled', time: resume1.time, deviceTime: resume1.deviceTime,
            previous: secondSuspendBasal, annotations: [{code: 'carelink/basal/fabricated-from-suppressed'}], duration: 3280000,
            rate: 1.0, scheduleName: 'billy', timezoneOffset: 0
          };

          expect(simulator.getEvents()).deep.equals(
            attachPrev(
              [
                _.assign({}, settings, {type: 'settings'}),
                firstBasal,
                tempBasal,
                expectedSuspend,
                _.assign({}, suspendBasal, {suppressed: tempBasal}),
                secondSuspendBasal,
                _.assign({}, resume1, {
                  type: 'deviceMeta', subType: 'status',
                  status: 'resumed', previous: expectedSuspend, reason: 'manual'
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
          timezoneOffset: 0
        };
        var basal1 = {
          time: '2014-09-25T00:00:00.000Z',
          deviceTime: '2014-09-25T00:00:00',
          rate: 1.0,
          scheduleName: 'billy',
          duration: 3600000,
          timezoneOffset: 0
        };
        var temp = {
          time: '2014-09-25T00:02:00.000Z',
          deviceTime: '2014-09-25T00:02:00',
          percent: 0.5,
          duration: 864e5,
          timezoneOffset: 0
        };
        // alarm_suspend
        var suspend1 = {
          reason: 'low_glucose',
          timezoneOffset: 0,
          time: '2014-09-25T00:05:00.000Z',
          deviceTime: '2014-09-25T00:05:00'
        };
        // low_suspend_no_response
        var suspend2 = {
          reason: 'low_glucose',
          timezoneOffset: 0,
          time: '2014-09-25T00:05:10.000Z',
          deviceTime: '2014-09-25T00:05:10'
        };
        // auto_resume_reduced
        var resume = {
          time: '2014-09-25T02:05:00.000Z',
          deviceTime: '2014-09-25T02:05:00',
          reason: 'automatic',
          timezoneOffset: 0
        };
        var basal2 = {
          time: '2014-09-25T02:05:00.000Z',
          deviceTime: '2014-09-25T02:05:00',
          rate: 2.1,
          scheduleName: 'billy',
          duration: 3300000,
          timezoneOffset: 0
        };
        it('should not resume to a temp when `auto_resume_reduced` even if the temp would still be running', function() {
          simulator.settings(settings);
          simulator.basalScheduled(basal1);
          simulator.basalTemp(temp);
          simulator.suspend(suspend1);
          simulator.suspend(suspend2);
          simulator.lgsAutoResume(resume);
          simulator.basalScheduled(basal2);

          var firstBasal = _.assign({}, basal1, {type: 'basal', deliveryType: 'scheduled'});
          var tempBasal = _.assign({}, temp, {type: 'basal', deliveryType: 'temp', suppressed: firstBasal, rate: 0.5});

          var expectedSuspend = _.assign({}, suspend1, {type: 'deviceMeta', subType: 'status', status: 'suspended'});

          var suspendBasal1 = {
            time: '2014-09-25T00:05:00.000Z', deviceTime: '2014-09-25T00:05:00', type: 'basal', deliveryType: 'suspend',
            timezoneOffset: 0, suppressed: tempBasal, previous: tempBasal, duration: 7200000
          };
          var suspendBasal2 = {
            time: '2014-09-25T01:00:00.000Z', type: 'basal', deliveryType: 'suspend', duration: 3900000,
            timezoneOffset: 0, suppressed: _.assign({}, tempBasal, {rate: 1.0, suppressed: {
              time: '2014-09-25T01:00:00.000Z', type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy',
              timezoneOffset: 0, rate: 2.0, annotations: [{code: 'carelink/basal/fabricated-from-schedule'}], duration: 3600000
            }}), previous: _.omit(suspendBasal1, 'previous')
          };
          var suspendBasal3 = {
            time: '2014-09-25T02:00:00.000Z', type: 'basal', deliveryType: 'suspend', duration: 300000,
            timezoneOffset: 0, suppressed: _.assign({}, tempBasal, {rate: 1.05, suppressed: {
              time: '2014-09-25T02:00:00.000Z', type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy',
              timezoneOffset: 0, rate: 2.1, annotations: [{code: 'carelink/basal/fabricated-from-schedule'}], duration: 3600000
            }}), previous: _.omit(suspendBasal2, 'previous')
          };

          expect(simulator.getEvents()).deep.equals(
            attachPrev(
              [
                _.assign({}, settings, {type: 'settings'}),
                firstBasal,
                tempBasal,
                expectedSuspend,
                suspendBasal1,
                suspendBasal2,
                suspendBasal3,
                _.assign({}, resume, {type: 'deviceMeta', subType: 'status', status: 'resumed', previous: expectedSuspend}),
                _.assign({}, basal2, {type: 'basal', deliveryType: 'scheduled'})
              ]
              )
            );
        });
      });
    });
  });
});
