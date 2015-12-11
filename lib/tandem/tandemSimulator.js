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
var sundial = require('sundial');
var util = require('util');

var annotate = require('../eventAnnotations');
var common = require('../commonSimulations');

/**
 * Creates a new "simulator" for Tandem insulin pump data. The simulator has methods for events like
 *
 * cbg(), smbg(), basal(), bolus(), settingsChange(), etc.
 *
 * This simulator exists as an abstraction over the Tidepool APIs. It was written to simplify the conversion
 * of static, "retrospective" audit logs from devices into events understood by the Tidepool platform.
 *
 * On the input side, you have events extracted from a Tandem insulin pump. They should be delivered to the simulator
 * in time order.
 *
 * Once all input activities are collected, the simulator will have accumulated events that the Tidepool Platform
 * will understand into a local "events" array.  You can retrieve the events by calling `getEvents()`
 *
 * @param config
 * @returns {*}
 */
exports.make = function(config){
  if (config == null) {
    config = {};
  }
  var events = [];

  var currBasal = null;
  var currStatus = null;
  var currTimestamp = null;
  var currTempBasal = null;

  function setCurrBasal(basal) {
    currBasal = basal;
  }

  function setCurrStatus(status) {
    currStatus = status;
  }

  function setCurrTempBasal(tempBasal) {
    currTempBasal = tempBasal;
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
      if (currStatus !== null && currStatus.status === 'suspended') {
        var type = event.alarmType;
        if(type === 'occlusion' || type === 'auto_off' || type === 'no_insulin' || type === 'no_power') {

          var status = currStatus;
          status.reason = {suspended: 'automatic'};

          if(status.payload !== undefined) {
            status.payload.cause = type;
          }
          else {
            status.payload = {cause: type};
          }
          setCurrStatus(status);
        }
      }
      simpleSimulate(event);
    },
    basal: function(event){
      ensureTimestamp(event);
      if (currBasal != null) {
        if(currBasal.deliveryType === 'temp') {
          if (currTempBasal != null) {
            currBasal.percent = currTempBasal.percent;
            if(currBasal.isAssigned('payload')) {
              currBasal.payload.duration =  currTempBasal.duration;
            }else{
              currBasal.payload = {duration : currTempBasal.duration};
            }
          }
        }

        // ignore repeated broadcasts of events at the same time
        // TODO: do a more thorough (deep equality-ish?) check for same-ness
        if (currBasal.time !== event.time) {
          if (!currBasal.isAssigned('duration')) {
            currBasal.with_duration(Date.parse(event.time) - Date.parse(currBasal.time));
          }
          currBasal = currBasal.done();
          event.previous = _.omit(currBasal, 'previous');
          events.push(currBasal);
        }
        else {
          return; 
        }
      }

      setCurrBasal(event);
    },
    finalBasal: function() {
      if (currBasal != null) {
        if (currBasal.deliveryType !== 'scheduled') {

          if (currBasal.deliveryType === 'temp') {
            if(!currBasal.isAssigned('duration')) {
              if(currTempBasal && currTempBasal.time_left) {
                // temp basal was cancelled
                currBasal.duration = currTempBasal.duration - currTempBasal.time_left;
              }else{
                currBasal.duration = currTempBasal.duration;
              }
            }
            currBasal = currBasal.done();
          }
          else {
            if (!currBasal.isAssigned('duration')) {
              currBasal.duration = 0;
              annotate.annotateEvent(currBasal, 'basal/unknown-duration');
              currBasal = currBasal.done();
            }
            else {
              currBasal = currBasal.done();
            }
          }
        }
        else if (config.settings != null) {
          currBasal.with_scheduleName(_.find(
            config.profiles,
            {idp: currBasal.payload.personalProfileIndex}
          ).name);
          currBasal = common.finalScheduledBasal(currBasal, config.settings, 'tandem');
        }
        else {
          currBasal.with_duration(0);
          annotate.annotateEvent(currBasal, 'basal/unknown-duration');
          currBasal = currBasal.done();
        }

        events.push(currBasal);
      }
    },
    tempBasal: function(event) {
      if(event.subType === 'start') {
        setCurrTempBasal(event);
      }
      else if(event.subType === 'stop') {
        if(currTempBasal != null) {
          var tempBasal = currTempBasal;
          tempBasal.subType = 'stop';
          tempBasal.time_left = event.time_left;
          setCurrTempBasal(tempBasal);
        }
      }
    },
    newDay: function(event) {
      ensureTimestamp(event);
      if (currBasal !== null) {
         if (currStatus !== null && currStatus.status === 'suspended') {
           return;
           // only insert the new day event if the basal rate is not suspended
         }

        if (currBasal.time !== event.time) {
          if (!currBasal.isAssigned('duration')) {
            currBasal.with_duration(Date.parse(event.time) - Date.parse(currBasal.time));
          }

          if(currBasal.deliveryType === 'temp') {
            if (currTempBasal != null) {
              currBasal.percent = currTempBasal.percent;
              if(currBasal.isAssigned('payload')) {
                currBasal.payload.duration =  currTempBasal.duration;
              }else{
                currBasal.payload = {duration : currTempBasal.duration};
              }
            }
            var suppressed = currBasal.suppressed;
            event.deliveryType = 'temp';
            event.percent = currBasal.percent;
            event.rate = currBasal.rate;
            event.set('suppressed', suppressed);
          }
          currBasal = currBasal.done();

          event.set('type', 'basal');
          event.previous = _.omit(currBasal, 'previous');
          event.with_payload(currBasal.payload);
          annotate.annotateEvent(event, 'tandem/basal/fabricated-from-new-day');

          events.push(currBasal);
          setCurrBasal(event);
        }
      }
    },
    bolus: function(event) {
      simpleSimulate(event);
    },
    changeDeviceTime: function(event) {
      simpleSimulate(event);
    },
    cartridgeChange: function(event) {
      simpleSimulate(event);
    },
    pumpSettings: function(event) {
      // TODO: once pumpSettings are a corrected
      // (and tideline is able to render them)
      // then start simulating them again for upload
      simpleSimulate(event);
    },
    smbg: function(event) {
      simpleSimulate(event);
    },
    suspend: function(event) {
      if (currStatus != null && currStatus.status === 'suspended') {
        return;
      }
      simpleSimulate(event);
      setCurrStatus(event);
    },
    resume: function(event) {
      ensureTimestamp(event);
      if (currStatus !== null) {
          event.previous = _.omit(currStatus, 'previous');
      }
      events.push(event.done());
      setCurrStatus(event);
    },
    wizard: function(event) {
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
