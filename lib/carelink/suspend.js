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
                return { status: 'suspended', reason: 'low_glucose' };
              case 'alarm_suspend':
              case 'low_suspend_no_response':
                return { status: 'suspended', reason: 'alarm' };
              case 'low_suspend_user_selected':
                return { status: 'suspended', reason: 'unknown' };

              // resume events
              case 'normal_pumping':
              case 'user_restart_basal':
                return { status: 'resumed', reason: 'manual' };
              case 'auto_resume_complete':
              case 'auto_resume_reduced':
                return { status: 'resumed', reason: 'automatic' };

              default:
                throw except.IAE('Unknown status[%s] on field[%s], ts[%s]', e[field], field, e.deviceTime);
            }
          })
        }
      ]
    }
  );

  return function (simulator, data) {
    var parsed = parser(data);
    if (parsed != null && parsed.payload != null) {
      switch (parsed.payload.status) {
        case 'suspended':
          simulator.suspend(_.assign(_.omit(parsed, 'payload'), {reason: parsed.payload.reason}));
          break;
        case 'resumed':
          simulator.resume(_.assign(_.omit(parsed, 'payload'), {reason: parsed.payload.reason}));
          break;
        default:
      }
    }
  };
};
