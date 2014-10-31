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
    simulator = pwdSimulator();
  });

  function getBasals(){
    return simulator.getEvents().filter(function(e){ return e.type === 'basal'; });
  }

  describe('cbg', function(){
    it('works', function(){
      var val = {
        time: "2014-09-25T01:00:00.000Z",
        deviceTime: "2014-09-25T01:00:00",
        value: 123
      };

      simulator.cbg(val);
      expect(simulator.getEvents()).deep.equals([_.assign({}, {type: "cbg"}, val)]);
    });
  });

  describe('smbg', function(){
    it('works', function(){
      var val = {
        time: "2014-09-25T01:00:00.000Z",
        deviceTime: "2014-09-25T01:00:00",
        value: 1.3
      };

      simulator.smbg(val);
      expect(simulator.getEvents()).deep.equals([_.assign({}, {type: "smbg"}, val)]);
    });
  });

  describe('bolus', function(){
    describe('dual', function(){
      it('works', function(){
        var val = {
          time: "2014-09-25T01:00:00.000Z",
          deviceTime: "2014-09-25T01:00:00",
          normal: 1.3,
          extended: 1.4,
          duration: 60000
        };

        simulator.bolusDual(val);
        expect(simulator.getEvents()).deep.equals([_.assign({}, {type: "bolus", subType: "dual/square"}, val)]);
      });
    });

    describe('normal', function(){
      it('works', function(){
        var val = {
          time: "2014-09-25T01:00:00.000Z",
          deviceTime: "2014-09-25T01:00:00",
          normal: 1.3
        };

        simulator.bolusNormal(val);
        expect(simulator.getEvents()).deep.equals([_.assign({}, {type: "bolus", subType: "normal"}, val)]);
      });
    });

    describe('square', function(){
      it('works', function(){
        var val = {
          time: "2014-09-25T01:00:00.000Z",
          deviceTime: "2014-09-25T01:00:00",
          extended: 1.4,
          duration: 60000
        };

        simulator.bolusSquare(val);
        expect(simulator.getEvents()).deep.equals([_.assign({}, {type: "bolus", subType: "square"}, val)]);
      });
    });
  });


  describe('basal', function(){
    describe('scheduled', function(){
      describe('withoutSettings', function(){
        it('passes through without an annotation', function(){
          var val = {
            time: "2014-09-25T01:00:00.000Z",
            deviceTime: "2014-09-25T01:00:00",
            scheduleName: 'billy',
            rate: 1.3,
            duration: 3600000
          };

          simulator.basalScheduled(val);
          expect(simulator.getEvents()).deep.equals([_.assign({}, {type: "basal", deliveryType: 'scheduled'}, val)]);
        });

        it('attaches a previous when there is an active basal', function(){
          var initialBasal = {
            time: "2014-09-25T01:00:00.000Z",
            deviceTime: "2014-09-25T01:00:00",
            scheduleName: 'billy',
            rate: 1.3,
            duration: 3600000
          };
          var secondBasal = {
            time: "2014-09-25T02:00:00.000Z",
            deviceTime: "2014-09-25T02:00:00",
            scheduleName: 'billy',
            rate: 1.4,
            duration: 3600000
          };
          var thirdBasal = {
            time: "2014-09-25T03:00:00.000Z",
            deviceTime: "2014-09-25T03:00:00",
            scheduleName: 'billy',
            rate: 1.5,
            duration: 3600000
          };

          simulator.basalScheduled(initialBasal);
          simulator.basalScheduled(secondBasal);
          simulator.basalScheduled(thirdBasal);
          expect(simulator.getEvents()).deep.equals(
            attachPrev([
              _.assign({type: "basal", deliveryType: 'scheduled'}, initialBasal),
              _.assign({type: 'basal', deliveryType: 'scheduled'}, secondBasal),
              _.assign({type: 'basal', deliveryType: 'scheduled'}, thirdBasal)
            ])
          );
        });


        it('if no duration, attaches a 0 duration and annotates', function(){
          var val = {
            time: "2014-09-25T01:00:00.000Z",
            deviceTime: "2014-09-25T01:00:00",
            scheduleName: 'billy',
            rate: 1.3
          };

          simulator.basalScheduled(val);
          expect(simulator.getEvents()).deep.equals(
            [
              _.assign(
                { type: "basal",
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
          time: "2014-09-25T01:00:00.000Z",
          deviceTime: "2014-09-25T01:00:00",
          activeSchedule: 'billy',
          units: { 'bg': 'mg/dL' },
          basalSchedules: {
            'billy': [
              { start: 0, rate: 1.0 },
              { start: 21600000, rate: 1.1 },
              { start: 43200000, rate: 1.2 },
              { start: 64800000, rate: 1.3 }
            ]
          }
        };

        beforeEach(function(){
          simulator.settings(settings);
        });

        describe('with duration', function(){
          it('passes through a scheduled that agrees with the schedule without annotation', function(){
            var val = {
              time: "2014-09-25T06:00:00.000Z",
              deviceTime: "2014-09-25T06:00:00",
              duration: 21600000,
              scheduleName: 'billy',
              rate: 1.1
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign({type: 'basal', deliveryType: 'scheduled'}, val)
              ]);
          });

          it('passes through a scheduled that starts mid-schedule and agrees with schedule without annotation', function(){
            var val = {
              time: "2014-09-25T06:01:00.000Z",
              deviceTime: "2014-09-25T06:01:00",
              duration: 21540000,
              scheduleName: 'billy',
              rate: 1.1
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign({type: 'basal', deliveryType: 'scheduled'}, val)
              ]);
          });

          it('annotates a scheduled that doesn\'t match schedule but doesn\'t change a provided duration', function(){
            var val = {
              time: "2014-09-25T06:00:00.000Z",
              deviceTime: "2014-09-25T06:00:00",
              duration: 21600000,
              scheduleName: 'billy',
              rate: 1.0
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
              time: "2014-09-25T01:00:00.000Z",
              deviceTime: "2014-09-25T01:00:00",
              scheduleName: 'billy',
              rate: 1.0
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign({type: "basal", deliveryType: 'scheduled', duration: 18000000}, val)
              ]);
          });

          it('annotates if basal doesn\'t match schedule', function(){
            var val = {
              time: "2014-09-25T01:00:00.000Z",
              deviceTime: "2014-09-25T01:00:00",
              scheduleName: 'billy',
              rate: 1.1
            };

            simulator.basalScheduled(val);
            expect(getBasals()).deep.equals(
              [
                _.assign(
                  { type: "basal", deliveryType: 'scheduled', duration: 0 },
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
            time: "2014-09-25T01:31:57.000Z",
            deviceTime: "2014-09-25T01:31:57",
            rate: 1.3,
            duration: 3600000
          };

          simulator.basalTemp(val);
          expect(simulator.getEvents()).deep.equals([_.assign({}, {type: "basal", deliveryType: 'temp'}, val)]);
        });

        it('percent passes through with no suppressed and no rate', function(){
          var val = {
            time: "2014-09-25T01:31:57.000Z",
            deviceTime: "2014-09-25T01:31:57",
            scheduleName: 'billy',
            percent: 0.7,
            duration: 3600000
          };

          simulator.basalTemp(val);
          expect(simulator.getEvents()).deep.equals([_.assign({}, {type: "basal", deliveryType: 'temp'}, val)]);
        });
      });

      describe('withActiveBasal', function(){
        var settings = {
          time: "2014-09-25T01:00:00.000Z",
          deviceTime: "2014-09-25T01:00:00",
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
          }
        };
        var basal = {
          time: "2014-09-25T01:00:00.000Z",
          deviceTime: "2014-09-25T01:00:00",
          scheduleName: 'billy',
          rate: 2.0
        };
        var basalEvent = _.assign({}, {type: "basal", deliveryType: 'scheduled', duration: 18000000}, basal);


        beforeEach(function(){
          simulator.settings(settings);
          simulator.basalScheduled(basal);
        });

        function getTempBasals(){
          return simulator.getEvents().filter(function(e){ return e.type === 'basal' && e.deliveryType === 'temp'; });
        }

        it('sets up the suppressed and previous', function(){
          var val = {
            time: "2014-09-25T01:31:57.000Z",
            deviceTime: "2014-09-25T01:31:57",
            rate: 0.5,
            duration: 3600000
          };

          simulator.basalTemp(val);
          expect(getTempBasals()).deep.equals(
            [_.assign({}, {type: "basal", deliveryType: 'temp', suppressed: basalEvent, previous: basalEvent}, val)]
          );
        });

        it('applies the percent to the suppressed', function(){
          var val = {
            time: "2014-09-25T01:31:57.000Z",
            deviceTime: "2014-09-25T01:31:57",
            percent: 0.3,
            duration: 3600000
          };

          simulator.basalTemp(val);
          expect(getTempBasals()).deep.equals(
            [_.assign(
              {type: "basal", deliveryType: 'temp', rate: 0.6, suppressed: basalEvent, previous: basalEvent},
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
        time: "2014-09-25T01:00:00.000Z",
        deviceTime: "2014-09-25T01:00:00",
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
        carbRatio: []
      };

      simulator.settings(val);
      expect(simulator.getEvents()).deep.equals([_.assign({}, {type: "settings"}, val)]);
    });
  });

  describe('event interplay', function(){
    describe('fill in scheduled events when a temp is active and time passes', function(){
      var settings = {
        time: "2014-09-25T00:00:00.000Z",
        deviceTime: "2014-09-25T00:00:00",
        deliveryType: 'scheduled',
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
        carbRatio: []
      };
      var basal = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0
      };
      var temp = {
        time: '2014-09-25T00:30:00.000Z',
        deviceTime: '2014-09-25T00:30:00',
        percent: 0.1,
        duration: 7200000
      };

      it('fills in for changes in schedule when another scheduled appears', function(){
        simulator.settings(settings);
        simulator.basalScheduled(basal);
        simulator.basalTemp(temp);

        var val = {
          time: '2014-09-25T02:30:00.000Z',
          deviceTime: '2014-09-25T02:30:00',
          scheduleName: 'billy',
          rate: 2.1
        };

        simulator.basalScheduled(val);

        expect(getBasals()).deep.equals(
          attachPrev(
            [
              _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 7200000,
                time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                  time: '2014-09-25T00:00:00.000Z', "deviceTime": "2014-09-25T00:00:00"
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.2, duration: 5400000,
                time: '2014-09-25T01:00:00.000Z', deviceTime: '2014-09-25T00:30:00',
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                  time: '2014-09-25T01:00:00.000Z',
                  annotations: [{ code: 'basal/fabricated-from-schedule' }]
                }
              },
              {
                type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 2.1 * 0.1, duration: 1800000,
                time: '2014-09-25T02:00:00.000Z', deviceTime: '2014-09-25T00:30:00',
                suppressed: {
                  type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.1, duration: 3600000,
                  time: '2014-09-25T02:00:00.000Z',
                  annotations: [{ code: 'basal/fabricated-from-schedule' }]
                }
              },
              _.assign({}, val,
                       { type: 'basal', time: '2014-09-25T02:30:00.000Z', deviceTime: '2014-09-25T02:30:00',
                         deliveryType: 'scheduled', duration: 1800000 }
              )
            ]));
      });

      it('completes a temp that is suppressed by a suspended before completing the scheduled that ends after the temp',
         function(){
           simulator.settings(settings);
           simulator.basalScheduled(basal);
           simulator.basalTemp(_.assign({}, temp, { duration: 900000 })); // 15 minutes

           simulator.suspend({ time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00', reason: 'manual' });
           expect(getBasals()).deep.equals(
             attachPrev(
               [
                 _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
                 {
                   type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                   time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T00:00:00.000Z', "deviceTime": "2014-09-25T00:00:00"
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend',
                   time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   suppressed: {
                     type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                     time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                     suppressed: {
                       type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                       time: '2014-09-25T00:00:00.000Z', "deviceTime": "2014-09-25T00:00:00"
                     }
                   }
                 }
               ])
           );

           simulator.resume({ time: '2014-09-25T01:10:00.000Z', deviceTime: '2014-09-25T01:10:00', reason: 'manual' });

           expect(getBasals()).deep.equals(
             attachPrev(
               [
                 _.assign({}, basal, { type: 'basal', deliveryType: 'scheduled', duration: 3600000 }),
                 {
                   type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                   time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T00:00:00.000Z', "deviceTime": "2014-09-25T00:00:00"
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 1800000,
                   time: '2014-09-25T00:40:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   suppressed: {
                     type: 'basal', deliveryType: 'temp', percent: 0.1, rate: 0.1, duration: 900000,
                     time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00',
                     suppressed: {
                       type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                       time: '2014-09-25T00:00:00.000Z', "deviceTime": "2014-09-25T00:00:00"
                     }
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 1500000,
                   time: '2014-09-25T00:45:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 1.0, duration: 3600000,
                     time: '2014-09-25T00:00:00.000Z', "deviceTime": "2014-09-25T00:00:00"
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'suspend', duration: 600000,
                   time: '2014-09-25T01:00:00.000Z', deviceTime: '2014-09-25T00:40:00',
                   suppressed: {
                     type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3600000,
                     time: '2014-09-25T01:00:00.000Z',
                     annotations: [{ code: 'basal/fabricated-from-schedule' }]
                   }
                 },
                 {
                   type: 'basal', deliveryType: 'scheduled', scheduleName: 'billy', rate: 2.0, duration: 3000000,
                   time: '2014-09-25T01:10:00.000Z',
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
              time: '2014-09-25T00:30:00.000Z', deviceTime: '2014-09-25T00:30:00'
            }
          ]);
      });
    });

    describe('tracks scheduleds when settings change', function(){
      var settings = {
        time: "2014-09-25T00:00:00.000Z",
        deviceTime: "2014-09-25T00:00:00",
        deliveryType: 'scheduled',
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
        carbRatio: []
      };
      var basal = {
        time: '2014-09-25T00:00:00.000Z',
        deviceTime: '2014-09-25T00:00:00',
        scheduleName: 'billy',
        rate: 1.0
      };
      var newSettings = {
        time: "2014-09-25T00:30:00.000Z",
        deviceTime: "2014-09-25T00:30:00",
        deliveryType: 'scheduled',
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
        carbRatio: []
      };
      var nextScheduled = {
        time: '2014-09-25T00:30:05.000Z',
        deviceTime: '2014-09-25T00:30:05',
        scheduleName: 'billy',
        rate: 1.5
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
                rate: 1.5, scheduleName: 'billy'
              }
            ]
          )
        );
      });

    });
  });
});