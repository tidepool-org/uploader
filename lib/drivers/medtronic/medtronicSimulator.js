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

var annotate = require('../../eventAnnotations');
var common = require('../../commonFunctions');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('bows')('MedtronicDriver') : console.log;
var debugMode = require('../../../app/utils/debugMode');
var __DEBUG__ = debugMode.isDebug || true;

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
  var resumingEvent = null;
  var currStatus = null;
  var prevBasal = null;

  function setCurrBasal(basal) {
    prevBasal = _.clone(currBasal);
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
    if (currBasal && currBasal.deliveryType !== 'suspend') {
      suspendingEvent = event;
    } else if (event === null) {
      suspendingEvent = null;
    } else {
      // not a suspending event, so add it
      simpleSimulate(event);
    }
  };

  function setResumingEvent(event) {
    resumingEvent = event;
  };

  function setCurrStatus(status) {
    currStatus = status;
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

  function checkForScheduleChanges(cancelled) {
    var changed = false; // flag if schedule change did occur

    if(currBasal.deliveryType !== 'scheduled' && currPumpSettings) {
      // check for schedule changes during temp basal or suspended basal

      var currSchedule = currPumpSettings.basalSchedules[currPumpSettings.activeSchedule];

      var checkSchedules = function(startTime, endTime, durationBeforeMidnight) {
        for (var i in currSchedule) {

          if(cancelled) {
            // we should stop looking for schedule changes after a temp basal was cancelled

            if (currBasal.deviceTime.slice(0,10) === cancelled.deviceTime.slice(0,10) && (durationBeforeMidnight > 0)) {
              // temp basal was cancelled before midnight and we're now looking after midnight
              break;
            }

            if (common.computeMillisInCurrentDay(cancelled) <= currSchedule[i].start ) {
              // temp basal was cancelled before new schedule started
              break;
            }
          }

          if((startTime <= currSchedule[i].start) && (endTime > currSchedule[i].start) &&
             ((currBasal.suppressed.deliveryType === 'scheduled' && currSchedule[i].rate !== currBasal.suppressed.rate) ||
              (currBasal.suppressed.suppressed && //there's a nested suppresed
                currBasal.suppressed.suppressed.deliveryType === 'scheduled' && currSchedule[i].rate !== currBasal.suppressed.suppressed.rate))) {

            // there was a schedule rate change _during_ the temp/suspended basal
            var adjustedDuration = durationBeforeMidnight + currSchedule[i].start - startTime;
            durationBeforeMidnight = 0; // we've now taken account of the duration before midnight in the adjusted duration
            var oldDuration = currBasal.duration;
            currBasal.duration = adjustedDuration;
            if(currBasal.isAssigned('payload')) {
             currBasal.payload.duration =  oldDuration;
            }else{
             currBasal.payload = {duration : oldDuration};
            }
            delete currBasal.startTime;
            delete currBasal.endTime;
            currBasal = currBasal.done();
            events.push(currBasal);

            var newSuppressed = {
              type: 'basal',
              deliveryType: 'scheduled',
              rate: currSchedule[i].rate
            };
            if(currPumpSettings) {
              newSuppressed.scheduleName = currPumpSettings.activeSchedule;
            }
            annotate.annotateEvent(newSuppressed, 'medtronic/basal/fabricated-from-schedule');

            var newBasal;
            if(currBasal.deliveryType === 'temp') {
              newBasal = config.builder.makeTempBasal();
              if(currBasal.percent != null) {
                newBasal.with_rate(currSchedule[i].rate * currBasal.percent)
                       .with_percent(currBasal.percent);
              } else {
                newBasal.with_rate(currBasal.rate);
              }
            } else {
              newBasal = config.builder.makeSuspendBasal();
            }

            var newJsDate = common.addDurationToDeviceTime(currBasal, adjustedDuration);
            newBasal.with_duration(oldDuration - adjustedDuration)
              .with_deviceTime(sundial.formatDeviceTime(newJsDate))
              .set('index', currBasal.index);

            config.tzoUtil.fillInUTCInfo(newBasal, newJsDate);


            if(currBasal.suppressed.suppressed) {
              newBasal.set('suppressed', _.clone(currBasal.suppressed));
              newBasal.suppressed.suppressed = newSuppressed;
            } else {
              newBasal.set('suppressed', newSuppressed);
            }

            setCurrBasal(newBasal);
            currBasal.startTime = common.computeMillisInCurrentDay(currBasal);
            startTime = currBasal.startTime;
            currBasal.endTime = currBasal.startTime + currBasal.duration;
            endTime = currBasal.endTime;
            changed = true;
          }
        }
      };

      currBasal.startTime = common.computeMillisInCurrentDay(currBasal);
      currBasal.endTime = currBasal.startTime + currBasal.duration;

      if (currBasal.endTime >= TWENTY_FOUR_HOURS) {
        //check before midnight
        checkSchedules(currBasal.startTime, TWENTY_FOUR_HOURS, 0);
        //check after midnight
        checkSchedules(0, currBasal.endTime - TWENTY_FOUR_HOURS, TWENTY_FOUR_HOURS - currBasal.startTime);
      } else {
        checkSchedules(currBasal.startTime, currBasal.endTime, 0);
      }
    }
    delete currBasal.startTime;
    delete currBasal.endTime;
    return changed;
  }

  function checkForExchanges(event) {
    if(currPumpSettings != null) {
      if(currPumpSettings.units.carb === 'exchanges') {
        // until the data model supports units for the carb ratio in wizard
        // records, we have to check if the pump was set to exchanges and
        // convert if necessary
        event.carbInput = Math.round(event.carbInput / 10.0 * 15);
        event.insulinCarbRatio = Math.round(15 / (event.insulinCarbRatio / 100.0));
      }
    }

    return event;
  }

  function pushWizardWithZeroBolus(record) {
    record = checkForExchanges(record);
    record.bolus = config.builder.makeNormalBolus()
      .with_normal(0)
      .with_expectedNormal(0)
      .with_deviceTime(record.deviceTime)
      .with_time(record.time)
      .with_timezoneOffset(record.timezoneOffset)
      .with_conversionOffset(record.conversionOffset)
      .with_clockDriftOffset(record.clockDriftOffset)
      .done();
    record = record.done();
    events.push(record);
  }

  return {
    basal: function(event) {
      var resumedBasal = null;

      ensureTimestamp(event);

      if(event.deliveryType === 'temp' && currPumpSettings) {

        // assign suppressed basal based on basal schedule
        var currSchedule = currPumpSettings.basalSchedules[currPumpSettings.activeSchedule];
        var startTime = common.computeMillisInCurrentDay(event);
        var rate = null;

        for (var i = 0; i < currSchedule.length; i++) {
          if(startTime >= currSchedule[i].start) {
            rate = currSchedule[i].rate;
          }
        };
        if(rate) {
          var newSuppressed = {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: rate,
            scheduleName: currPumpSettings.activeSchedule
          };
          event.set('suppressed', newSuppressed);
        }
      }

      if (currBasal != null) {

        if (suspendingEvent != null) {
          // The current basal only ran until the suspending event occurred
          var duration = Date.parse(suspendingEvent.time) - Date.parse(currBasal.time);

          if(duration > 0) {
            // suspending event did happen after the basal event
            currBasal.duration = duration;
            checkForScheduleChanges();

            if (resumingEvent != null) {
              // this basal was automatically resumed
              resumedBasal = _.clone(currBasal);
            }
            common.truncateDuration(currBasal, 'medtronic');
            currBasal = currBasal.done();
            events.push(currBasal);

            var resumeTime = null;
            if(resumingEvent != null) {
              resumeTime = resumingEvent.time;
            } else {
              resumeTime = event.time;
            }
            // create suspended basal at time of alarm or reservoir change and set that as the current basal
            var suspendedDuration = Date.parse(resumeTime) - Date.parse(suspendingEvent.time);
            var suspendedBasal = config.builder.makeSuspendBasal()
              .with_deviceTime(suspendingEvent.deviceTime)
              .with_time(suspendingEvent.time)
              .with_timezoneOffset(suspendingEvent.timezoneOffset)
              .with_conversionOffset(suspendingEvent.conversionOffset)
              .with_duration(suspendedDuration)
              .set('index', suspendingEvent.index);
            suspendedBasal.suppressed = {
              type: 'basal',
              deliveryType: currBasal.deliveryType,
              rate: currBasal.rate,
            };
            if (currBasal.suppressed) {
              suspendedBasal.suppressed.suppressed = _.clone(currBasal.suppressed);
            }
            setCurrBasal(suspendedBasal);

            var status = {
              time: currBasal.time,
              deviceTime: currBasal.deviceTime,
              timezoneOffset: currBasal.timezoneOffset,
              conversionOffset: currBasal.conversionOffset,
              deviceId: event.deviceId,
              duration: currBasal.duration,
              type: 'deviceEvent',
              subType: 'status',
              status: 'suspended'
            };
            if (resumingEvent != null) {
              status.reason = {suspended: 'automatic', resumed: 'automatic'};
            } else {
              status.reason = {suspended: 'automatic', resumed: 'manual'};
            }
            if (suspendingEvent.alarmType) {
              status.payload = {cause: suspendingEvent.alarmType};
            } else if (suspendingEvent.subType) {
              status.payload = {cause: suspendingEvent.subType};
            }
            annotate.annotateEvent(status, 'medtronic/status/fabricated-from-device-event');

            // also push the device event with its new status object
            suspendingEvent.status = status;
          }
          events.push(suspendingEvent);
          setSuspendingEvent(null); //reset device event as not to re-use

          if (resumingEvent != null && resumedBasal) {
            checkForScheduleChanges();

            // push suspended basal on stack
            common.truncateDuration(currBasal, 'medtronic');
            currBasal = currBasal.done();
            events.push(currBasal);

            // set resumed basal as current basal
            resumedBasal.time = resumingEvent.time;
            resumedBasal.deviceTime = resumingEvent.deviceTime;
            resumedBasal.timezoneOffset = resumingEvent.timezoneOffset;
            resumedBasal.conversionOffset = resumingEvent.conversionOffset;
            resumedBasal.duration = Date.parse(event.time) - Date.parse(resumingEvent.time);

            setCurrBasal(resumedBasal);
          }

          setResumingEvent(null); //reset device event as not to re-use
        }

        if(!currBasal.isAssigned('duration')) {

          // calculate current basal's duration
          var duration = Date.parse(event.time) - Date.parse(currBasal.time);
          currBasal.duration = duration;
        }

        if (event.deliveryType === 'temp') {
          if (event.duration === 0) {
            if(event.annotations && event.annotations[0].code === 'basal/unknown-duration') {
              debug('Temp basal at ' + event.time + ' has unknown duration');
            } else {
              // temp basal was cancelled:
              // The pump sends a temp basal record with duration 0.
              // We use the time this record was sent to calculate the actual duration.
              checkForScheduleChanges(event);
              if(currBasal.duration !== 0) {
                currBasal.expectedDuration = currBasal.duration;
              }
              var duration = Date.parse(event.time) - Date.parse(currBasal.time);
              currBasal.duration = duration;

              common.truncateDuration(currBasal, 'medtronic');
              currBasal = currBasal.done();
              events.push(currBasal);
              setCurrBasal(null);

              return;
            }
          }

          if(currBasal.deliveryType === 'temp') {
            // temp basal was updated

            // check for any schedule changes before it was updated
            checkForScheduleChanges(event);

            if(currBasal.duration !== 0) {
              currBasal.expectedDuration = currBasal.duration;
            }
            currBasal.duration = Date.parse(event.time) - Date.parse(currBasal.time);

            if (currBasal.duration > currBasal.expectedDuration) {
              annotate.annotateEvent(currBasal, 'basal/unknown-duration');
              currBasal.duration = currBasal.expectedDuration;
            }
            event.suppressed = _.clone(currBasal.suppressed);
          }

          if(currBasal.deliveryType === 'scheduled') {
            var suppressed = {
              type: 'basal',
              deliveryType: 'scheduled',
              rate: currBasal.rate
            };
            if(currBasal.isAssigned('scheduleName')) {
              suppressed.scheduleName = currBasal.scheduleName;
            }
            event.suppressed = suppressed;
          }

          if(event.rate == null || !event.isAssigned('rate')) {
            if(event.percent == null || !event.isAssigned('percent')) {
              throw new Error ('Temp basal without rate or percent');
            }
            event = event.with_rate(event.suppressed.rate * event.percent);
          }
        }

        if (event.deliveryType === 'suspend' && currBasal.deliveryType !== 'suspend') {

          checkForScheduleChanges(event); //check for schedule changes before basal is suspended

          event.suppressed = {
            type: 'basal',
            deliveryType: currBasal.deliveryType,
            rate: currBasal.rate
          };
          if(currBasal.isAssigned('scheduleName')) {
            event.suppressed.scheduleName = currBasal.scheduleName;
          }

          if(currBasal.deliveryType === 'temp') {
            // nest suppressed scheduled basal in temp basal inside suspended basal
            event.suppressed.suppressed = currBasal.suppressed;
            var resumeBasal = null;

            if(currStatus.duration > 0) {
              // basal was resumed, check if temp basal was still active
              var tempStartToResumeDuration = Date.parse(currStatus.time) - Date.parse(currBasal.time) + currStatus.duration;
              if(currBasal.duration > tempStartToResumeDuration) {
              // temp basal is still active after suspend, so restart temp basal on resume

                // check that the indexes are the same, as the suspended basal was
                // created from the same record as the suspend/resume event
                if(currStatus && currStatus.index === event.index) {

                  event.duration = currStatus.duration;

                  resumeBasal = _.clone(currBasal);
                  resumeBasal.time = new Date(Date.parse(currStatus.time) + currStatus.duration).toISOString();
                  resumeBasal.deviceTime = sundial.formatDeviceTime(common.addDurationToDeviceTime(currStatus, currStatus.duration));
                  resumeBasal.index = event.resumeIndex;
                  delete resumeBasal.duration; // we don't know the new duration yet
                }
              }
            }

            // finish up the temp basal before the suspend
            if(currBasal.isAssigned('duration')) {
              currBasal.expectedDuration = currBasal.duration;
              var duration = Date.parse(event.time) - Date.parse(currBasal.time);
              currBasal.duration = duration;

              if (currBasal.duration > currBasal.expectedDuration) {
                annotate.annotateEvent(currBasal, 'basal/unknown-duration');
                currBasal.duration = currBasal.expectedDuration;
              }
            }

            if(resumeBasal) {
              common.truncateDuration(currBasal, 'medtronic');
              events.push(currBasal.done());
              setCurrBasal(event);
              // check if suspended basal is crossing schedule changes before resumed
              if (checkForScheduleChanges()) {
                // we should remember to update resume basal's suppressed too
                resumeBasal.suppressed = currBasal.suppressed.suppressed;
              }
              common.truncateDuration(currBasal, 'medtronic');
              events.push(currBasal.done());

              setCurrBasal(resumeBasal);
              return;
            }
          }
        }

        checkForScheduleChanges();

        common.truncateDuration(currBasal, 'medtronic');
        currBasal = currBasal.done();
        events.push(currBasal);
      }

      if (currPumpSettings && event.deliveryType === 'scheduled') {
        if(!event.isAssigned('scheduleName')) {
          event.with_scheduleName(currPumpSettings.activeSchedule);
        }
      }

      if (event.deliveryType === 'scheduled') {

        // check if current or cancelled (previous) basal was a temp basal
        var tempBasal = null;
        if(currBasal == null) {
          if(prevBasal && prevBasal.deliveryType === 'temp' && prevBasal.expectedDuration > 0) {
            tempBasal = prevBasal;
          }
        } else {
          if(currBasal.deliveryType === 'temp') {
            tempBasal = currBasal;
          }
        }

        if(tempBasal) {
          //check for possible one-second gap between end of temp basal and start of scheduled basal

          var supposedEndTime = Date.parse(tempBasal.time) + tempBasal.duration;
          var nextBasalTime = Date.parse(event.time);

          if(supposedEndTime !== nextBasalTime) {
            // there's a gap
            if(nextBasalTime - supposedEndTime === 1000) {
              // it's the expected one second gap, fabricate a basal
              var jsDate = common.addDurationToDeviceTime(tempBasal, tempBasal.duration);
              var oneSecondBasal = config.builder.makeTempBasal()
                .with_duration(1000)
                .with_rate(tempBasal.rate)
                .with_deviceTime(sundial.formatDeviceTime(jsDate))
                .set('index', tempBasal.index);
              if(tempBasal.suppressed) {
                oneSecondBasal.set('suppressed', tempBasal.suppressed);
              }

              config.tzoUtil.fillInUTCInfo(oneSecondBasal, jsDate);
              annotate.annotateEvent(oneSecondBasal, 'medtronic/basal/one-second-gap');
              oneSecondBasal = oneSecondBasal.done();
              events.push(oneSecondBasal);
            } else {
              debug('Annotating temp basal just prior to unexpected gap in basal before ',event.time);
              annotate.annotateEvent(tempBasal, 'basal/unknown-duration');
            }
          }
        }
      }

      if (event.deliveryType === 'temp') {
        if(event.percent != null && event.rate == null) {
          // try to determine rate of percentage temp basal without one
          if (event.suppressed && event.suppressed.rate != null) {
            event = event.with_rate(event.suppressed.rate * event.percent);
          } else if (currPumpSettings) {
            event = event.with_rate(currPumpSettings.basalSchedules[currPumpSettings.activeSchedule].rate * event.percent);
          } else {
            debug('Cannot determine rate of percent temp basal');
            return;
          }
        }
      }

      setCurrBasal(event);
    },
    bolus: function(event) {
      ensureTimestamp(event);
      if(currWizard != null ) {
        // A wizard event is always followed by a bolus event.
        // Usually the timestamp is the same, but sometimes the bolus timestamp
        // is a second later. Here we also check that the bolus event is at least
        // within 30 seconds of the wizard event.
        var bolusTime = event.jsDate.valueOf();
        var wizardTime = currWizard.jsDate.valueOf();
        if ( (bolusTime >= wizardTime) && ( bolusTime < (wizardTime + 30000)) ) {
          currWizard.bolus = _.clone(event);

          // for IOB, we use the value in the bolus event, as the IOB stored
          // in the wizard event will be zero if there is no BG value entered
          currWizard.with_insulinOnBoard(currWizard.bolus.iob);

          delete currWizard.bolus.jsDate;
          delete currWizard.bolus.index;
          delete currWizard.bolus.iob;

          currWizard = checkForExchanges(currWizard);
          currWizard = currWizard.done();
          events.push(currWizard);
        } else {
          debug('Could not find matching bolus for wizard:' + JSON.stringify(currWizard,null,4));
          simpleSimulate(event); // run the bolus, as it's not going to be embedded in a wizard
        }
        setCurrWizard(null);
      } else {
        simpleSimulate(event);
      }
    },
    wizard: function(event) {

      if (currWizard) {
        // wizard event without bolus, occurs with 0U bolus
        pushWizardWithZeroBolus(currWizard);
      }
      setCurrWizard(event);
    },
    smbg: function(event) {
      if(currSMBG != null && currSMBG.value === event.value) {
        debug('Duplicate SMBG value (',event.value,')',currSMBG.subType,currSMBG.time,'/',event.subType,event.time);
        var duration = Date.parse(event.time) - Date.parse(currSMBG.time);
        if ((duration < (15 * sundial.MIN_TO_MSEC)) && (event.subType === 'manual') && (currSMBG.subType === 'linked')) {
          debug('Dropping duplicate manual value');
          return;
        }
      }
      simpleSimulate(event);
      setCurrSMBG(event);
    },
    pumpSettings: function(event) {

      var setIfAvailable = function(objStr) {
        if (currPumpSettings && _.has(currPumpSettings, objStr)) {
          _.update(event, objStr, function(n) {
            if (n === undefined) {
              return _.get(currPumpSettings, objStr);
            } else {
              return n;
            }
          });
        }
      };

      event.with_manufacturers(config.deviceManufacturers)
           .with_model(config.settings.modelNumber)
           .with_serialNumber(config.settings.serialNumber)
           .with_display({
             bloodGlucose: {
               units: event.units.bg
             }
           });

      // some settings are sent point-in-time (not with old and new values),
      // so we fill it in for new settings until it changes
      setIfAvailable('bolus.amountMaximum');
      setIfAvailable('bolus.extended');
      setIfAvailable('basal.rateMaximum');
      setIfAvailable('basal.temporary');

      simpleSimulate(event.done());
      setCurrPumpSettings(event);
    },
    suspendResume: function(event) {
      simpleSimulate(event);
      setCurrStatus(event);
    },
    cbg: function(event) {
      simpleSimulate(event);
    },
    alarm: function(event) {
      var type = event.alarmType;
      if((type === 'no_delivery' || type === 'auto_off')
        && suspendingEvent === null ) {
        // alarm will be added later (with fabricated status event) when basal is resumed,
        // because only then will we know the duration it was suspended for
        setSuspendingEvent(event);
      } else{

        if(type === 'other' && event.payload.alarm_id === 3 && currBasal) {
          if(__DEBUG__) {
            debug('Battery out too long at',event.time,', annotating previous basal at', currBasal.time);
          }
          annotate.annotateEvent(currBasal, 'basal/unknown-duration');

          if(currBasal.deliveryType === 'scheduled' && currPumpSettings) {
            // set last basal to not be longer than scheduled duration
            var currSchedule = currPumpSettings.basalSchedules[currPumpSettings.activeSchedule];
            var startTime = common.computeMillisInCurrentDay(currBasal);
            for (var i = 0; i < currSchedule.length; i++) {

              if((startTime >= currSchedule[i].start) && (currBasal.rate === currSchedule[i].rate)) {
                if(currSchedule[i+1]) {
                  var scheduledDuration = currSchedule[i+1].start - currSchedule[i].start;
                  currBasal.duration = scheduledDuration;
                  break;
                }
              }
            };
          }
        }
        simpleSimulate(event);
      }
    },
    prime: function(event) {
      if(suspendingEvent != null) {
        setResumingEvent(event);
      }
      simpleSimulate(event);
    },
    rewind: function(event) {
      // check that a suspending event, e.g. "no delivery" alarm
      // hasn't already been triggered
      if(suspendingEvent === null) {
        setSuspendingEvent(event);
      } else {
        simpleSimulate(event);
      }
    },
    calibration: function(event) {
      simpleSimulate(event);
    },
    changeDeviceTime: function(event) {
      if(event.payload.deviceType === 'pump' && currBasal && currBasal.deliveryType === 'temp') {
        // if there is a time change event _during_ a temp basal, we need to split
        // it in two so that we can check for schedule changes (which are not timezone-aware)
        // in order to build suppressed info correctly

        var adjustedTempDuration = Date.parse(event.time) - Date.parse(currBasal.time);
        currBasal.duration = adjustedTempDuration;
        checkForScheduleChanges();
        common.truncateDuration(currBasal, 'medtronic');
        currBasal = currBasal.done();
        events.push(currBasal);

        var newTempBasal = config.builder.makeTempBasal()
          .with_deviceTime(event.deviceTime)
          .with_time(event.time)
          .with_timezoneOffset(event.timezoneOffset)
          .with_conversionOffset(event.conversionOffset)
          .with_rate(currBasal.rate)
          .set('index', event.index + 1);
        if (currBasal.suppressed) {
          newTempBasal.set('suppressed', currBasal.suppressed);
        }
        annotate.annotateEvent(newTempBasal, 'medtronic/basal/time-change');
        setCurrBasal(newTempBasal);
      }
      simpleSimulate(event);
    },
    finalize: function() {
      if(currBasal) {

        if (currBasal.deliveryType === 'scheduled' && currPumpSettings) {
            currBasal.with_scheduleName(currPumpSettings.activeSchedule);
            if(!currBasal.isAssigned('duration')) {
              currBasal = common.finalScheduledBasal(currBasal, currPumpSettings, 'medtronic');
            } else {
              currBasal = currBasal.done();
            }
        } else {
          if(!currBasal.isAssigned('duration')) {
            currBasal.duration = 0;
            annotate.annotateEvent(currBasal, 'basal/unknown-duration');
          }
          common.truncateDuration(currBasal, 'medtronic');
          currBasal = currBasal.done();
        }

        events.push(currBasal);
      };

      if (currWizard) {
        // wizard event without bolus, occurs with 0U bolus
        pushWizardWithZeroBolus(currWizard);
      }
    },
    getEvents: function() {
      function filterOutInvalidData() {
        return _.filter(events, function(event) {

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
              if (bolus.normal === 0 && !bolus.expectedNormal && !event.carbInput) {
                return false;
              }
              else {
                return true;
              }
            }
          }

          return true;
        });
      }
      var orderedEvents = _.sortBy(filterOutInvalidData(), function(e) { return e.time; });

      _.forEach(orderedEvents, function(record) {
        delete record.index;
        delete record.resumeIndex;
        delete record.jsDate;
        delete record.iob;
      });

      return orderedEvents;
    }
  };
};
