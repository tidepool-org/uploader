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

      if(currBasal !== null) {
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
        event.previous = _.omit(currBasal, 'previous');
        events.push(currBasal);
      }

      if(currStatus !== null) {
        if(currStatus.status === 'suspended' && event.rate === 0) {
          //this basal is suspended
          event.deliveryType = 'suspend';
        }
      }

      setCurrBasal(event);

    },
    bolus: function(event) {
      delete event.syncCounter; //wizard events already synced up
      delete event.requiredAmount;
      simpleSimulate(event);
      setCurrBolus(event);
    },
    changeDeviceTime: function(event) {
      simpleSimulate(event);
    },
    changeReservoir: function(event) {
      simpleSimulate(event);
    },
    finalBasal: function() {
      //TODO: special case
      if (currBasal != null) {
        currBasal.with_duration(0);
        annotate.annotateEvent(currBasal, 'basal/unknown-duration');
        currBasal = currBasal.done();
        events.push(currBasal);
      }
    },
    resume: function(event) {
      ensureTimestamp(event);
      if (currStatus != null && currStatus.status === 'suspended') {
        event = event.with_previous(_.omit(currStatus, 'previous'));
      }
      event = event.done();
      setCurrStatus(event);
      events.push(event);
    },
    pumpSettings: function(event) {
      simpleSimulate(event);
    },
    smbg: function(event) {
      if(currSMBG != null && currSMBG.value === event.value) {
        console.log('Duplicate SMBG value',event.value,event.time,currSMBG.time);
        var duration = Date.parse(event.time) - Date.parse(currSMBG.time);
        if (duration < (15 * sundial.MIN_TO_MSEC)) {
          console.log('Dropping duplicate manual value');
          if(event.subType === 'linked') {
            //TODO: remove this once we're sure that linked values do not occur after manual values
            throw Error('Dropping linked value instead of manual value.');
          }
          return;
        }
      }
      simpleSimulate(event);
      setCurrSMBG(event);
    },
    suspend: function(event) {
      // if we're already in a suspended state, we just return early to maintain that state
      if (currStatus != null && currStatus.status === 'suspended') {
        return;
      }
      ensureTimestamp(event);
      setCurrStatus(event);
      events.push(event);
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
