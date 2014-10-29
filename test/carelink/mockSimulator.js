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

module.exports = {
  make: function(defaults) {
    var events = [];

    function appendToEvents(type) {
      return function() {
        events.push(_.assign.apply(_.assign, [{type: type}, defaults].concat(Array.prototype.slice.call(arguments, 0))));
      }
    }

    return {
      smbg: appendToEvents('smbg'),
      cbg: appendToEvents('cbg'),
      scheduledBasal: appendToEvents('basal'),
      settings: appendToEvents('settings'),
      tempBasal: appendToEvents('basal'),
      getEvents: function(){
        return events;
      }
    };
  }
};