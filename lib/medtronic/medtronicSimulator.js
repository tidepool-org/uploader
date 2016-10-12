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

var _ = require('lodash');
var sundial = require('sundial');
var util = require('util');

var annotate = require('../eventAnnotations');

var debug = require('../bows')('MedtronicDriver');
var common = require('../commonFunctions');

/**
 * Creates a new "simulator" for Medtronic pump data.
 *
 * Once all input activities are collected, the simulator will have accumulated events that the Tidepool Platform
 * will understand into a local "events" array.  You can retrieve the events by calling `getEvents()`
 *
 */
exports.make = function(config){
  var events = [];

  var TWENTY_FOUR_HOURS = 864e5;

  var currBasal = null;
  var currWizard = null;
  var currSMBG = null;
  var currTimestamp = null;
  var currPumpSettings = null;
  var suspendingEvent = null;

  function setCurrBasal(basal) {
    currBasal = basal;
  }

  function setCurrWizard(wizard) {
    currWizard = wizard;
  }

  function setCurrSMBG(smbg) {
    currSMBG = smbg;
  }

  function setCurrPumpSettings(settings) {
    currPumpSettings = settings;
  };

  function setSuspendingEvent(event) {
    suspendingEvent = event;
  };

  function ensureTimestamp(e){
    if (currTimestamp > e.time) {
      throw new Error(
        util.format('Timestamps must be in order.  Current timestamp was[%s], but got[%j]', currTimestamp, e)
      );
    }
    currTimestamp = e.time;
    return e;
  }

  function simpleSimulate(e) {
    ensureTimestamp(e);
    events.push(e);
  }

  return {
    basal: function(event) {
      ensureTimestamp(event);

      if (currBasal != null) {

        if (suspendingEvent != null) {

          // The current basal only ran until the suspending event occurred
          var duration = Date.parse(suspendingEvent.time) - Date.parse(currBasal.time);
          currBasal.with_duration(duration);
          currBasal = currBasal.done();
          events.push(currBasal);

          // create suspended basal at time of alarm or reservoir change and set that as the current basal
          var suspendedDuration = Date.parse(event.time) - Date.parse(suspendingEvent.time);
          var suspendedBasal = config.builder.makeSuspendBasal()
            .with_deviceTime(suspendingEvent.deviceTime)
            .with_time(suspendingEvent.time)
            .with_timezoneOffset(suspendingEvent.timezoneOffset)
            .with_conversionOffset(suspendingEvent.conversionOffset)
            .with_duration(suspendedDuration)
            .set('index', suspendingEvent.index);
          setCurrBasal(suspendedBasal);

          console.log('Embedding a suspend/resume event in a device event:', suspendingEvent);

          var status = {
            time: currBasal.time,
            deviceTime: currBasal.deviceTime,
            timezoneOffset: currBasal.timezoneOffset,
            conversionOffset: currBasal.conversionOffset,
            deviceId: event.deviceId,
            duration: currBasal.duration,
            type: 'deviceEvent',
            subType: 'status',
            status: 'suspended',
            reason: {suspended: 'automatic', resumed: 'manual'},
          };
          if(suspendingEvent.alarmType) {
            status.payload = {cause: suspendingEvent.alarmType};
          }
          annotate.annotateEvent(status, 'medtronic/status/fabricated-from-device-event');

          // also push the device event with its new status object
          suspendingEvent.status = status;
          events.push(suspendingEvent);
          setSuspendingEvent(null); //reset device event as not to re-use
        }

        if(!currBasal.isAssigned('duration')) {
          // calculate current basal's duration
          var duration = Date.parse(event.time) - Date.parse(currBasal.time);
          currBasal.with_duration(duration);
        }

        if (!event.rate && event.duration === 0) {
          // temp basal was cancelled:
          // The pump sends a temp basal record with duration 0 and no rate.
          // We use the time this record was sent to calculate the actual duration.
          currBasal.with_expectedDuration(currBasal.duration);
          var duration = Date.parse(event.time) - Date.parse(currBasal.time);
          currBasal.with_duration(duration);

          currBasal = currBasal.done();
          events.push(currBasal);
          setCurrBasal(null);
          return;
        }

        if(currBasal.deliveryType === 'temp' && event.deliveryType === 'temp' && event.duration !== 0) {
          // temp basal was updated
          currBasal.with_expectedDuration(currBasal.duration)
                   .with_duration(Date.parse(event.time) - Date.parse(currBasal.time));
          event.suppressed = _.clone(currBasal.suppressed);
        }

        if(currBasal.deliveryType !== 'scheduled' && currPumpSettings) {
          // check for schedule changes during temp basal

          var currSchedule = currPumpSettings.basalSchedules[currPumpSettings.activeSchedule];

          var checkSchedules = function(startTime, endTime, durationBeforeMidnight) {
            for(var i in currSchedule) {
              if((startTime <= currSchedule[i].start) && (endTime > currSchedule[i].start) &&
                 (currBasal.suppressed.deliveryType === 'scheduled' && currSchedule[i].rate !== currBasal.suppressed.rate)) {
                   // TODO: may need to do a nested search for suppressed scheduled rate

                // there was a schedule rate change _during_ the temp/suspended basal
                var adjustedDuration = durationBeforeMidnight + currSchedule[i].start - startTime;
                var oldDuration = currBasal.duration;
                currBasal.with_duration(adjustedDuration);
                if(currBasal.isAssigned('payload')) {
                 currBasal.payload.duration =  oldDuration;
                }else{
                 currBasal.payload = {duration : oldDuration};
                }
                if(currBasal.deliveryType === 'scheduled') {
                  currBasal.with_scheduleName(currPumpSettings.activeSchedule);
                }
                currBasal = currBasal.done();
                events.push(currBasal);

                var newJsDate = new Date(currBasal.jsDate.valueOf() + adjustedDuration);

                var newSuppressed = {
                  type: 'basal',
                  deliveryType: 'scheduled',
                  rate: currSchedule[i].rate,
                  scheduleName : currPumpSettings.activeSchedule
                };

                var newBasal;
                if(currBasal.deliveryType === 'temp') {
                  newBasal = config.builder.makeTempBasal();
                  if(currBasal.percent) {
                    newBasal.with_rate(currSchedule[i].rate * currBasal.percent)
                           .with_percent(currBasal.percent);
                  } else {
                    newBasal.with_rate(currBasal.rate);
                  }
                } else {
                  newBasal = config.builder.makeSuspendBasal();
                }

                newBasal.with_time(newJsDate.toISOString())
                  .with_duration(oldDuration - adjustedDuration)
                  .with_deviceTime(sundial.formatDeviceTime(newJsDate))
                  .set('index', currBasal.index)
                  .set('suppressed', newSuppressed);

                config.tzoUtil.fillInUTCInfo(newBasal, newJsDate);

                annotate.annotateEvent(newBasal, 'medtronic/basal/fabricated-from-schedule');
                setCurrBasal(newBasal);
              }
            }
          };

          var startTime = common.computeMillisInCurrentDay(currBasal);
          var endTime = startTime + currBasal.duration;

          if (endTime >= TWENTY_FOUR_HOURS) {
            //check before midnight
            checkSchedules(startTime, TWENTY_FOUR_HOURS - startTime, 0);
            //check after midnight
            checkSchedules(0, endTime - TWENTY_FOUR_HOURS, TWENTY_FOUR_HOURS - startTime);
          } else {
            checkSchedules(startTime, endTime, 0);
          }
        }

        if(event.deliveryType === 'temp') {

          if(currBasal.deliveryType === 'scheduled') {
            var suppressed = {
              type: 'basal',
              deliveryType: 'scheduled',
              rate: currBasal.rate
            };
            event.suppressed = suppressed;

            if (currPumpSettings) {
              currBasal.with_scheduleName(currPumpSettings.activeSchedule);
              event.suppressed.scheduleName = currBasal.scheduleName;
            }
          }
        }

        if(event.deliveryType === 'suspend') {
          var suppressed = {
            type: 'basal',
            deliveryType: currBasal.deliveryType,
            rate: currBasal.rate
          };
          if(currBasal.deliveryType === 'temp') {
            // nest suppressed scheduled basal in temp basal
            suppressed.suppressed = currBasal.suppressed;
          }
          event.suppressed = suppressed;
        }

        if (currPumpSettings && currBasal.deliveryType === 'scheduled') {
          currBasal.with_scheduleName(currPumpSettings.activeSchedule);
          if(event.suppressed) {
            event.suppressed.scheduleName = currBasal.scheduleName;
          }
        }
        common.truncateDuration(currBasal, 'medtronic');
        currBasal = currBasal.done();
        events.push(currBasal);
      }

      setCurrBasal(event);
    },
    bolus: function(event) {
      if(currWizard) {
        // A wizard event is always followed by a bolus event.
        // Usually the timestamp is the same, but sometimes the bolus timestamp
        // is a second later. Here we also check that the bolus event is at least
        // within 5 seconds of the wizard event.
        var bolusTime = event.jsDate.valueOf();
        var wizardTime = currWizard.jsDate.valueOf();
        if ( (bolusTime >= wizardTime) && ( bolusTime < (wizardTime + 5000)) ) {
          currWizard.bolus = event;
          currWizard = currWizard.done();
          simpleSimulate(currWizard);
          setCurrWizard(null);
        } else {
          throw new Error('Could find matching bolus for wizard:' + currWizard);
        }
      }
      simpleSimulate(event);
    },
    wizard: function(event) {
      setCurrWizard(event);
    },
    smbg: function(event) {
      // TODO: DRY this out once Animas mmol/L issue (https://trello.com/c/Ry3Cz0eC) is resolved
      if(currSMBG != null && currSMBG.value === event.value) {
        console.log('Duplicate SMBG value (',event.value,')',currSMBG.subType,currSMBG.time,'/',event.subType,event.time);
        var duration = Date.parse(event.time) - Date.parse(currSMBG.time);
        if ((duration < (15 * sundial.MIN_TO_MSEC)) && (event.subType === 'manual') && (currSMBG.subType === 'linked')) {
          console.log('Dropping duplicate manual value');
          return;
        }
      }
      simpleSimulate(event);
      setCurrSMBG(event);
    },
    pumpSettings: function(event) {
      simpleSimulate(event);
      setCurrPumpSettings(event);
    },
    suspendResume: function(event) {
      simpleSimulate(event);
    },
    alarm: function(event) {
      var type = event.alarmType;
      if(type === 'no_delivery' || type === 'auto_off' || type === 'no_power') {
        // alarm will be added later (with fabricated status event) when basal is resumed,
        // because only then will we know the duration it was suspended for
        setSuspendingEvent(event);
      } else{
        simpleSimulate(event);
      }
    },
    prime: function(event) {
      simpleSimulate(event);
    },
    rewind: function(event) {
      setSuspendingEvent(event);
      simpleSimulate(event);
    },
    changeDeviceTime: function(event) {
      simpleSimulate(event);
    },
    finalBasal: function(finalRecordTime) {
      if(!currBasal.isAssigned('duration')) {
        var duration = Date.parse(finalRecordTime) - Date.parse(currBasal.time);
        currBasal.with_duration(duration);
      }
      if (currPumpSettings && currBasal.deliveryType === 'scheduled') {
        currBasal.with_scheduleName(currPumpSettings.activeSchedule);
      }
      common.truncateDuration(currBasal, 'medtronic');
      currBasal = currBasal.done();
      events.push(currBasal);
    },
    getEvents: function() {
      function filterOutInvalidData() {
        return _.filter(events, function(event) {

          //filter out zero boluses
          if (event.type === 'bolus') {
            if (event.normal === 0 && !event.expectedNormal) {
              return false;
            }
            else {
              return true;
            }
          }
          else if (event.type === 'wizard') {
            var bolus = event.bolus || null;
            if (bolus != null) {
              if (bolus.normal === 0 && !bolus.expectedNormal) {
                return false;
              }
              else {
                return true;
              }
            }
          }

          // Filter out dates 2012 and earlier.
          // We are doing this because we expect no pump to have true 2012 dates,
          // so anything generated in 2012 or earlier is really just because
          // someone didn't immediately set the date upon powering up the pump
          // for a while. Thus, we are dropping these events because we don't
          // know the actual, real time for them.
          if(parseInt(event.time.substring(0,4)) <= 2012) {
            debug('Dropping event in 2012 or earlier: ', event);
            return false;
          }

          return true;
        });
      }
      var orderedEvents = _.sortBy(filterOutInvalidData(), function(e) { return e.time; });

      _.forEach(orderedEvents, function(record) {
        delete record.index;
        delete record.jsDate;
      });

      return orderedEvents;
    }
  };
};
