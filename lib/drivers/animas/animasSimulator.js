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

var _ = require('lodash');
var sundial = require('sundial');
var util = require('util');

var annotate = require('../../eventAnnotations');
var common = require('../../commonFunctions');

var debug = require('bows')('AnimasDriver');

/**
 * Creates a new "simulator" for Animas pump data.
 *
 * Once all input activities are collected, the simulator will have accumulated events that the Tidepool Platform
 * will understand into a local "events" array.  You can retrieve the events by calling `getEvents()`
 *
 */
exports.make = function(config){
  if (config == null) {
    config = {};
  }
  var settings = config.settings || null;
  var events = [];

  var currBasal = null;
  var currBolus = null;
  var currStatus = null;
  var currTimestamp = null;
  var currSMBG = null;
  var suspendingAlarm = null;

  function setCurrBasal(basal) {
    currBasal = basal;
  }

  function setCurrBolus(bolus) {
    currBolus = bolus;
  }

  function setCurrStatus(status) {
    currStatus = status;
  }

  function setCurrSMBG(smbg) {
    currSMBG = smbg;
  }

  function setSuspendingAlarm(alarm) {
    suspendingAlarm = alarm;
  }

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
    alarm: function(event) {
      var type = event.alarmType;
      if(type === 'occlusion' || type === 'auto_off' || type === 'no_insulin' || type === 'no_power') {
        // alarm will be added later (with fabricated status event) when basal is resumed
        setSuspendingAlarm(event);
      } else{
        simpleSimulate(event);
      }
    },
    basal: function(event){

      ensureTimestamp(event);

      if (currBasal != null) {
        if(!currBasal.isAssigned('duration')) {
          // calculate current basal's duration
          var duration = Date.parse(event.time) - Date.parse(currBasal.time);
          currBasal.with_duration(duration);
        }
        currBasal = common.truncateDuration(currBasal, 'animas');
      }

      if (event.rate === 0 ) {
        if(currStatus !== null) {
          // categorize the basal we're processing as a suspend basal if its rate
          // is zero and its start falls within the suspend event we have on deck
          var resumed = Date.parse(currStatus.time) + currStatus.duration;
          if (resumed >= Date.parse(event.time)) {
            //this basal is suspended
            event.deliveryType = 'suspend';
            delete event.rate;
          }
        }
      } else {
        // new basal is non-zero:
        // Are we resuming from a suspend event we created from an alarm?
        // If so, we should embed a suspend/resume event in the alarm and
        // mark the current basal as suspended
        if (suspendingAlarm != null) {
          if ((currBasal != null) && (currBasal.rate === 0)) {

            console.log('Embedding a suspend/resume event in an alarm:', suspendingAlarm);

            var status = {
              time: currBasal.time,
              deviceTime: currBasal.deviceTime,
              timezoneOffset: currBasal.timezoneOffset,
              conversionOffset: currBasal.conversionOffset,
              deviceId: currBasal.deviceId,
              duration: currBasal.duration,
              type: 'deviceEvent',
              subType: 'status',
              status: 'suspended',
              reason: {suspended: 'automatic', resumed: 'manual'},
              payload: {cause: suspendingAlarm.alarmType}
            };
            annotate.annotateEvent(status, 'animas/status/fabricated-from-alarm');

            //this basal is suspended
            currBasal.deliveryType = 'suspend';
            delete currBasal.rate;
            annotate.annotateEvent(currBasal, 'animas/basal/marked-suspended-from-alarm');

            suspendingAlarm.status = status;
            setCurrStatus(null);
          }

          events.push(suspendingAlarm);
          setSuspendingAlarm(null); //reset alarm as not to re-use
        }
      }

      if(currBasal !== null && (currBasal.time !== event.time)) {
        if (currBasal.index < event.index) {
          annotate.annotateEvent(event,'animas/out-of-sequence');
        }
        currBasal = currBasal.done();
        events.push(currBasal);
      }

      setCurrBasal(event);
    },
    finalBasal: function() {
      if(currBasal != null && currStatus != null && currBasal.rate !== 0 && currStatus.status === 'suspended') {
        //basal rate has not yet changed to zero after final suspend event
        currBasal.with_duration(Date.parse(currStatus.time) - Date.parse(currBasal.time));
        currBasal = common.truncateDuration(currBasal, 'animas');

        if (currBasal.duration < 0) {
          // if the device time was set wrong and there are event dates in the future,
          // the final basal duration cannot be calculated
          currBasal.duration = 0;
          annotate.annotateEvent(currBasal, 'basal/unknown-duration');
        }

        currBasal = currBasal.done();
        events.push(currBasal);
      }
    },
    bolus: function(event) {
      delete event.syncCounter; //wizard events already synced up
      delete event.requiredAmount;
      delete event.jsDate;
      simpleSimulate(event);
      setCurrBolus(event);
    },
    prime: function(event) {
      simpleSimulate(event);
    },
    pumpSettings: function(event) {
      simpleSimulate(event);
    },
    smbg: function(event) {

      if(currSMBG != null && (event.subType === 'manual') && (currSMBG.subType === 'linked')) {
        var linkedBG = currSMBG.value;
        if(event.units === 'mmol/L') {
          // linked value is always in mg/dL, so we have to convert to
          // mmol/L with one significant digit if we want to compare to
          // Animas mmol/L manual BG value
          linkedBG = common.convertBackToMmol(currSMBG.value);
        }
        if (linkedBG === event.value) {
          console.log('Duplicate SMBG value (',event.value,')',currSMBG.subType,currSMBG.time,'/',event.subType,event.time);
          var duration = Date.parse(event.time) - Date.parse(currSMBG.time);
          if (duration < (15 * sundial.MIN_TO_MSEC)) {
            console.log('Dropping duplicate manual value');
            return;
          }
        }
      }
      simpleSimulate(event);
      setCurrSMBG(event);
    },
    suspend: function(event) {
      ensureTimestamp(event);
      if (currStatus != null && currStatus.index < event.index) {
        annotate.annotateEvent(event,'animas/out-of-sequence');
      }

      if (currBasal != null && currBasal.rate === 0) {
        //this basal is suspended
        currBasal.deliveryType = 'suspend';
        delete currBasal.rate;
      }
      events.push(event);
      setCurrStatus(event);
    },
    wizard: function(event) {
      simpleSimulate(event);
    },
    cbg: function(event) {
      simpleSimulate(event);
    },
    calibration: function(event) {
      simpleSimulate(event);
    },
    getEvents: function() {
      function filterOutInvalidData() {
        return _.filter(events, function(event) {
          // we include the index on all objects to be able to sort accurately in
          // pump-event order despite date & time settings changes, but it's not
          // part of our data model, so we delete before uploading
          delete event.index;

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

          // Filter out dates 2008 and earlier, as this is year 0 for Vibe.
          // We are doing this because we expect no pump to have true 2008 dates,
          // so anything generated in 2008 or earlier is really just because
          // someone didn't immediately set the date upon powering up the pump
          // for a while. Thus, we are dropping these events because we don't
          // know the actual, real time for them.
          if(parseInt(event.time.substring(0,4)) <= 2008) {
            debug('Dropping event in 2008 or earlier: ', event);
            return false;
          }

          return true;
        });
      }
      // because we have to wait for the *next* basal to determine the duration of a current
      // basal, basal events get added to `events` out of order wrt other events
      // (although within their own type all the basals are always in order)
      // end result: we have to sort events again before we try to upload them
      var orderedEvents = _.sortBy(filterOutInvalidData(), function(e) { return e.time; });

      return orderedEvents;
    }
  };
};
