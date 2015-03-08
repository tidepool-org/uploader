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

exports.make = function(config) {
  if (config == null) {
    config = {};
  }
  var defaults = config.defaults;
  var events = [];

  function appendToEvents(type) {
    return function() {
      events.push(_.assign.apply(_.assign, [{type: type}, defaults].concat(Array.prototype.slice.call(arguments, 0))));
    };
  }

  return {
    basalScheduled: appendToEvents('basal-scheduled'),
    basalTemp: appendToEvents('basal-temp'),
    bolus: appendToEvents('bolus'),
    bolusDual: appendToEvents('bolus-dual'),
    bolusNormal: appendToEvents('bolus-normal'),
    bolusSquare: appendToEvents('bolus-square'),
    cbg: appendToEvents('cbg'),
    deviceMeta: appendToEvents('deviceMeta'),
    resume: appendToEvents('resume'),
    settings: appendToEvents('settings'),
    suspend: appendToEvents('suspend'),
    smbg: appendToEvents('smbg'),
    wizard: appendToEvents('wizard'),
    getEvents: function(){
      return _.map(events, function(event) {
        if (event.type === 'wizard') {
          event.bolus = _.omit(event.bolus, 'jaebPayload');
        }
        return _.omit(event, 'jaebPayload');
      });
    }
  };
};