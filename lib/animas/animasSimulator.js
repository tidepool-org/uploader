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

var annotate = require('../eventAnnotations');

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
  var lastAlarm = null;

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

  function setLastAlarm(alarm) {
    lastAlarm = alarm;
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

  function markIfBasalSuspendedByAlarm(alarm,basal) {
    if ((basal != null) && (alarm != null) &&
        (basal.rate === 0) && (basal.deliveryType !== 'suspend')) {

      // Animas does not generate suspend/resume events for alarms,
      // so we check if an alarm occurred recently or at the same time.
      // If so, we mark the basal as suspended and generate a new suspend event.

      var duration = Date.parse(basal.time) - Date.parse(alarm.time);
      var twoHours = (120 * sundial.MIN_TO_MSEC);
      if(duration < twoHours) {

        var type = alarm.alarmType;
        if(type === 'occlusion' || type === 'auto_off' || type === 'no_insulin' || type === 'no_power') {

          //this basal is suspended
          basal.deliveryType = 'suspend';
          delete basal.rate;
          annotate.annotateEvent(basal, 'animas/basal/marked-suspended-from-alarm');

          var status = {
            time: basal.time,
            deviceTime: basal.deviceTime,
            timezoneOffset: basal.timezoneOffset,
            conversionOffset: basal.conversionOffset,
            deviceId: basal.deviceId,
            type: 'deviceEvent',
            subType: 'status',
            status: 'suspended',
            reason: {suspended: 'automatic'},
            payload: {cause: type}
          };

          ensureTimestamp(status);
          setCurrStatus(status);
          setLastAlarm(null); //reset alarm as not to re-use for other zero-rate basals
          setCurrBasal(basal);
        }
      }
    }
  }


  return {
    alarm: function(event) {
      setLastAlarm(event);
      markIfBasalSuspendedByAlarm(event,currBasal);
      simpleSimulate(event);
    },
    basal: function(event){
      ensureTimestamp(event);

      if(currBasal !== null && (currBasal.time !== event.time)) {
        if (currBasal.index < event.index) {
          annotate.annotateEvent(event,'animas/out-of-sequence');
        }

        if (!currBasal.isAssigned('duration')) {
          var duration = Date.parse(event.time) - Date.parse(currBasal.time);
          var fiveDays = (5 * 1440 * sundial.MIN_TO_MSEC);
          if(duration > fiveDays) {
            //flat-rate basal
            duration = fiveDays;
            annotate.annotateEvent(currBasal, 'animas/basal/flat-rate');
          }
          currBasal.with_duration(duration);
        }
        currBasal = currBasal.done();
        events.push(currBasal);
      }

      if(currStatus !== null) {
        if (event.rate === 0 ) {
          // categorize the basal we're processing as a suspend basal if its rate
          // is zero and its start falls within the suspend event we have on deck
          var resumed = Date.parse(currStatus.time) + currStatus.duration;
          if (resumed > Date.parse(event.time)) {
            //this basal is suspended
            event.deliveryType = 'suspend';
            delete event.rate;
          }
        }
        else {
          // basal is non-zero
          // Are we resuming from a suspend event we created from an alarm?
          // If so, we should update the joined suspend/resume event
          if(currStatus.reason.suspended === 'automatic') {

            currStatus.duration = currBasal.duration;
            currStatus.reason.resumed = 'automatic';
            annotate.annotateEvent(currStatus, 'animas/status/fabricated-from-alarm');

            events.push(currStatus);
            setCurrStatus(null);
          }
        }
      }

      setCurrBasal(event);
      markIfBasalSuspendedByAlarm(lastAlarm,event);

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
      if(currSMBG != null && currSMBG.value === event.value) {
        console.log('Duplicate SMBG value (',event.value,')',currSMBG.subType,currSMBG.time,'/',event.subType,event.time);
        var duration = Date.parse(event.time) - Date.parse(currSMBG.time);
        if ((duration < (15 * sundial.MIN_TO_MSEC)) && (event.subType === 'manual')) {
          console.log('Dropping duplicate manual value');
          return;
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
      function filterOutZeroBoluses() {
        return _.filter(events, function(event) {
          // we include the index on all objects to be able to sort accurately in
          // pump-event order despite date & time settings changes, but it's not
          // part of our data model, so we delete before uploading
          delete event.index;
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
          return true;
        });
      }
      // because we have to wait for the *next* basal to determine the duration of a current
      // basal, basal events get added to `events` out of order wrt other events
      // (although within their own type all the basals are always in order)
      // end result: we have to sort events again before we try to upload them
      var orderedEvents = _.sortBy(filterOutZeroBoluses(), function(e) { return e.time; });

      return orderedEvents;
    }
  };
};
