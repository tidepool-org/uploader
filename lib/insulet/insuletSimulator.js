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
var common = require('./common');

/**
 * Creates a new "simulator" for Insulet OmniPod data.  The simulator has methods for events like
 *
 * cbg(), smbg(), basal(), bolus(), settingsChange(), etc.
 *
 * This simulator exists as an abstraction over the Tidepool APIs.  It was written to simplify the conversion
 * of static, "retrospective" audit logs from devices into events understood by the Tidepool platform.
 *
 * On the input side, you have events extracted from an Insulet .ibf file.  They should be delivered to the simulator
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
  var settings = config.settings || null;
  var events = [];

  var currAlarm = null;
  var currBasal = null;
  var currBolus = null;
  var currStatus = null;
  var currTimestamp = null;

  function setCurrAlarm(alarm) {
    currAlarm = alarm;
  }

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
      e.suppressed = null;
    }
  }

  return {
    alarm: function(event) {
      ensureTimestamp(event);
      setCurrAlarm(event);
    },
    basal: function(event){
      ensureTimestamp(event);
      if (currBasal != null) {
        // currBasal.duration is a string when the builder object hasn't had
        // .with_duration called yet (i.e., it's the string `**REQUIRED**`)
        if (currBasal.duration != null && typeof currBasal.duration === 'string') {
          currBasal.with_duration(Date.parse(event.time) - Date.parse(currBasal.time));
        }
        if (currBasal.suppressed != null && typeof currBasal.suppressed !== 'string') {
          fillInSuppressed(currBasal);
        }
        currBasal = currBasal.done();
        event.previous = _.omit(currBasal, 'previous');
        events.push(currBasal);
      }
      setCurrBasal(event);
    },
    bolus: function(event) {
      simpleSimulate(event);
      setCurrBolus(event);
    },
    bolusTermination: function(event) {
      if (currBolus != null) {
        if (currBolus.subType === 'normal') {
          currBolus.expectedNormal = common.fixFloatingPoint(currBolus.normal + event.missedInsulin, 2);
        }
        else {
          currBolus.expectedExtended = common.fixFloatingPoint(currBolus.extended + event.missedInsulin, 2);
          currBolus.expectedDuration = currBolus.duration + event.durationLeft;
        }
      }
      else {
        throw new Error(
          util.format('Cannot find bolus to modify given bolus termination[%j]', event)
        );
      }
    },
    resume: function(event) {
      ensureTimestamp(event);
      if (currStatus != null && currStatus.status === 'suspended') {
        event = event.with_previous(_.omit(currStatus, 'previous')).done();
      }
      setCurrStatus(event);
      events.push(event);
    },
    settings: function(event) {
      simpleSimulate(event);
    },
    smbg: function(event) {
      simpleSimulate(event);
    },
    suspend: function(event) {
      ensureTimestamp(event);
      setCurrStatus(event);
      events.push(event);
    },
    wizard: function(event) {
      simpleSimulate(event);
    },
    getEvents: function() {
      return events;
    }
  };
};