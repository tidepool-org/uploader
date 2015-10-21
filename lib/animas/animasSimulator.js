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

  function setCurrBasal(basal) {
    currBasal = basal;
  }

  function setCurrBolus(bolus) {
    currBolus = bolus;
  }

  function setCurrStatus(status) {
    currStatus = status;
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

  function fillInSuppressed(e) {
    var schedName = null, suppressed = _.clone(e.suppressed);
    if (e.previous != null) {
      if (e.previous.deliveryType === 'scheduled') {
        schedName = e.previous.scheduleName;
      }
      else if (e.previous.deliveryType === 'temp') {
        if (e.previous.suppressed != null) {
          if (e.previous.suppressed.deliveryType === 'scheduled') {
            schedName = e.previous.suppressed.scheduleName;
          }
        }
      }
    }

    if (schedName != null) {
      e.suppressed = suppressed.with_scheduleName(schedName).done();
    }
    else {
      delete e.suppressed;
    }
  }

  return {
    /*
    alarm: function(event) {
      if (event.payload != null && event.payload.stopsDelivery === true) {
        if (event.status == null && event.index != null) {
          throw new Error('An Insulet alarm with a log index that has `stopsDelivery` in the payload must have a `status`.');
        }
      }
      simpleSimulate(event);
    },*/
    basal: function(event){
      ensureTimestamp(event);

      //TODO: if currStatus is suspended and is now resumed,
      // put the correct previous status in and emit device event and new basal

      if(currBasal !== null) {

        if (!currBasal.isAssigned('duration')) {
          currBasal.with_duration(Date.parse(event.time) - Date.parse(currBasal.time));
        }
        if (currBasal.isAssigned('suppressed')) {
          fillInSuppressed(currBasal);
        }
        currBasal = currBasal.done();
        event.previous = _.omit(currBasal, 'previous');
        events.push(currBasal);
      }
      setCurrBasal(event);


      /*
      if (currBasal != null) {
        // sometimes there can be duplicate suspend basals, so we return early
        // if we come across a suspend basal when we're already in one
        if (currBasal.deliveryType === 'suspend' && event.deliveryType === 'suspend') {
          return;
        }
        // completing a resume event from a new pod activation
        // see podActivation() below for more details
        if (currStatus != null && currStatus.status === 'suspended') {
          if (activationStatus != null && activationStatus.status === 'resumed') {
            var resume = activationStatus.with_previous(_.omit(currStatus, 'previous'))
              .with_reason({resumed: 'manual'})
              .done();
            setCurrStatus(resume);
            events.push(resume);
          }
          else {
            // if we're in a suspend basal, we need to leave the currStatus because
            // a resume is probably still impending
            // but if we've already moved on to a basal that's not deliveryType: suspend
            // then we need to wipe the slate clean
            if (event.deliveryType !== 'suspend') {
              setCurrStatus(null);
            }
          }
        }
        if (!currBasal.isAssigned('duration')) {
          currBasal.with_duration(Date.parse(event.time) - Date.parse(currBasal.time));
        }
        if (currBasal.isAssigned('suppressed')) {
          fillInSuppressed(currBasal);
        }
        currBasal = currBasal.done();
        event.previous = _.omit(currBasal, 'previous');
        events.push(currBasal);
      }
      // at the very beginning of a file (which === when currBasal is null) it is common
      // to see a pod activation and then a basal; the former will end up as a `deviceEvent`
      // resume without a `previous` but it's technically accurate, so we upload it anyway
      else {
        if (activationStatus != null && activationStatus.status === 'resumed') {
          var initialResume;
          // we don't really expect this to happen, but just in case...
          if (currStatus != null && currStatus.status === 'suspended') {
            initialResume = activationStatus.with_previous(_.omit(currStatus, 'previous'))
              .with_reason({resumed: 'manual'})
              .done();
            setCurrStatus(initialResume);
            events.push(initialResume);
          }
          // this is the more common case, in which case we finish building a resume
          // that won't be connected with a suspend, kinda pointless, but accurate
          else {
            initialResume = activationStatus.with_reason({resumed: 'manual'})
              .done();
            setCurrStatus(initialResume);
            events.push(initialResume);
          }
          setActivationStatus(null);
        }
      }
      */

    },
    bolus: function(event) {
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
      currBasal.with_duration(0);
      annotate.annotateEvent(currBasal, 'basal/unknown-duration');
      currBasal = currBasal.done();
      events.push(currBasal);
    },
    resume: function(event) {
      ensureTimestamp(event);
      if (currStatus != null && currStatus.status === 'suspended') {
        console.log("EVENT: ", event);
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
      simpleSimulate(event);
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
