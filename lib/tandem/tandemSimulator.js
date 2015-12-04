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
  var scheduleNames = [];
  var activeSchedule = {};

  function setCurrBasal(basal) {
    currBasal = basal;
  }

  function setCurrStatus(status) {
    currStatus = status;
  }

  function setCurrTempBasal(tempBasal) {
    currTempBasal = tempBasal;
  }

  function setScheduleName(idp, name) {
    var match = _.find(scheduleNames, {idp:idp});
    if(match){
        var index = _.indexOf(scheduleNames, match);
        scheduleNames.splice(index, 1, {idp:idp,name:name});
    } else {
        scheduleNames.push({idp:idp,name:name});
    }
    console.log("scheduleNames:",scheduleNames);
  }

  function setActiveSchedule(idp, name) {
    activeSchedule = {
      idp : idp,
      name : name
    };
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
      simpleSimulate(event);
    },
    basal: function(event){
      ensureTimestamp(event);
      if (currBasal != null) {
        if(currBasal.deliveryType === 'temp') {
          if (currTempBasal != null) {
            currBasal.percent = currTempBasal.percent;
            currBasal.payload =  { duration: currTempBasal.duration };
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
      }

      setCurrBasal(event);
    },
    finalBasal: function() {
      if (currBasal != null) {
        if (currBasal.deliveryType !== 'scheduled') {
          if (currBasal.deliveryType === 'temp') {
            if (currBasal.isAssigned('suppressed')) {
              if(currTempBasal && currTempBasal.duration && currTempBasal.time_left) {
                currBasal.duration = currTempBasal.duration - currTempBasal.time_left;
                annotate.annotateEvent(event, 'tandem/basal/fabricated-from-time-left');
              }else{
                currBasal.duration = 0;
                annotate.annotateEvent(currBasal, 'basal/unknown-duration');
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
        //add time_left in case temp basal was terminated early and it's the final basal
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
              currBasal.payload =  { duration: currTempBasal.duration };
              var suppressed = {
                type: 'basal',
                deliveryType: 'scheduled',
                rate: event.rate
              };
              event.deliveryType = 'temp';
              event.percent = currTempBasal.percent;
              event.rate = currTempBasal.rate;
              event.set('suppressed', suppressed);
            }
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

      //TODO: batch records with the same time

      if(event.subType === 'name-change') {
        console.log("schedule name change to ", event.name);
        setScheduleName(event.idp,event.name);
      }
      else if (event.subType === 'activate') {
        console.log("active schedule change");
        setActiveSchedule(event.idp,event.name);
      } else{
        //regular settings Object
        if (activeSchedule) {
          event.activeSchedule = activeSchedule.name;
        }
        scheduleNames.forEach(function (schedule) {

          var match = null;
          // searching for old schedule name
          _.forEach(event.basalSchedules, function(n, key) {
            if (n.idp === schedule.idp) {
              match = key;
            }
          });

          if (match && match !== schedule.name) {
            console.log("renaming", match ,"to",schedule.name);
            //renaming schedules
            event.basalSchedules[schedule.name] = event.basalSchedules[match];
            delete event.basalSchedules[match];
            event.carbRatios[schedule.name] = event.carbRatios[match];
            delete event.carbRatios[match];
            event.insulinSensitivities[schedule.name] = event.insulinSensitivities[match];
            delete event.insulinSensitivities[match];
            event.bgTargets[schedule.name] = event.bgTargets[match];
            delete event.bgTargets[match];
            console.log("basalSchedules after:", JSON.stringify(event.basalSchedules));
          }
        });
        simpleSimulate(event);
      }
    },
    smbg: function(event) {
      simpleSimulate(event);
    },
    suspend: function(event) {
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
