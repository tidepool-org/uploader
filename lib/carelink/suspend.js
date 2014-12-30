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
var util = require('util');

var common = require('./common.js');
var parsing = require('./parsing.js');

module.exports = function (timezone) {
  var parser = common.makeParser(
    {
      ChangeSuspendEnable: [
        common.makeCommonVals(timezone),
        {
          payload: parsing.map(['Raw-Values', 'ENABLE'], function(reason){
            switch(reason) {
              case null:
              case 'null':
                return null;
              case 'user_suspend':
                return { status: 'suspended', reason: 'manual' };
              case 'low_suspend_mode_1':
              case 'alarm_suspend':
              case 'low_suspend_no_response':
              case 'low_suspend_user_selected':
                return { status: 'suspended', reason: 'low_glucose' };

              // resume events
              case 'normal_pumping':
                return { status: 'resumed', reason: 'manual' };
              case 'user_restart_basal':
                return { status: 'resumed', reason: 'user_restart_basal' };
              case 'auto_resume_complete':
                return { status: 'resumed', reason: 'user_automatic'};
              case 'auto_resume_reduced':
                return { status: 'resumed', reason: 'automatic' };

              default:
                throw new Error(util.format('Unknown status[%s]', reason));
            }
          })
        }
      ]
    }
  );

  return function (simulator, data) {
    var parsed = parser(data);
    if (parsed != null && parsed.payload != null) {
      var event = _.assign(_.omit(parsed, 'payload'), {reason: parsed.payload.reason});
      switch (parsed.payload.status) {
        case 'suspended':
          if (parsed.payload.reason === 'manual') {
            simulator.suspend(event);
          }
          else if (parsed.payload.reason === 'low_glucose') {
            simulator.suspend(event);
          }
          else {
            throw new Error(util.format('Unknown suspend reason[%s]', parsed.payload.reason));
          }
          break;
        case 'resumed':
          if (parsed.payload.reason === 'manual') {
            simulator.resume(event);
          }
          else if (parsed.payload.reason === 'user_automatic') {
            event.reason = 'automatic';
            simulator.resume(event);
          }
          else if (parsed.payload.reason === 'user_restart_basal') {
            simulator.lgsResume(event);
          }
          else if (parsed.payload.reason === 'automatic') {
            simulator.lgsAutoResume(event);
          }
          else {
            throw new Error(util.format('Unknown resume reason[%s]', parsed.payload.reason));
          }
          break;
        default:
      }
    }
  };
};
