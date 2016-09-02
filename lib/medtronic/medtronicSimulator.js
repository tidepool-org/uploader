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

/**
 * Creates a new "simulator" for Medtronic pump data.
 *
 * Once all input activities are collected, the simulator will have accumulated events that the Tidepool Platform
 * will understand into a local "events" array.  You can retrieve the events by calling `getEvents()`
 *
 */
exports.make = function(config){
  var events = [];

  var currBolus = null;
  var currWizard = null;
  var currTimestamp = null;

  function setCurrBolus(bolus) {
    currBolus = bolus;
  }

  function setCurrWizard(wizard) {
    currWizard = wizard;
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
    bolus: function(event) {
      if(currWizard && currWizard.jsDate.getTime() === event.jsDate.getTime()) {
        currWizard.bolus = event;
        currWizard = currWizard.done();
      }
      simpleSimulate(event);
      setCurrBolus(event);
    },
    wizard: function(event) {
      if(currBolus && currBolus.jsDate.getTime() === event.jsDate.getTime()) {
        // TODO: should we match on index+1 or index-1 too?
        event.bolus = currBolus;
        event = event.done();
      }
      simpleSimulate(event);
      setCurrWizard(event);
    },
    getEvents: function() {
      function filterOutInvalidData() {
        return _.filter(events, function(event) {

          //filter out zero boluses
          /*
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
          */

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
