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
                return {
                  status: 'suspended',
                  reason: {
                    suspended: 'manual'
                  }
                };
              case 'low_suspend_mode_1':
              case 'alarm_suspend':
              case 'low_suspend_no_response':
              case 'low_suspend_user_selected':
                return {
                  status: 'suspended',
                  reason: {
                    suspended: 'automatic'
                  },
                  payload: {
                    cause: 'low_glucose',
                    code: reason
                    // TODO: would be wonderful one day to include LGS threshold in payload
                    // but looking that up from settings may have to be in simulator
                  }
                };
              // resume events
              case 'normal_pumping':
                return {
                  status: 'resumed',
                  reason: {
                    resumed: 'manual'
                  },
                  payload: {
                    code: reason
                  }
                };
              case 'user_restart_basal':
                return {
                  status: 'resumed',
                  reason: {
                    resumed: 'manual'
                  },
                  payload: {
                    code: reason
                  }
                };
              case 'auto_resume_complete':
                return {
                  status: 'resumed',
                  reason: {
                    resumed: 'automatic'
                  },
                  payload: {
                    code: reason,
                    user_intervention: 'acknowledged'
                  }
                };
              case 'auto_resume_reduced':
                return {
                  status: 'resumed',
                  reason: {
                    resumed: 'automatic'
                  },
                  payload: {
                    code: reason,
                    user_intervention: 'ignored'
                  }
                };
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
    // if parsed *is* null, we're just in a row of the CSV
    // that isn't relevant to this processor
    // hence the lack of an `else` condition
    if (parsed != null && parsed.payload != null) {
      var event = _.assign(_.omit(parsed, 'payload'), _.omit(parsed.payload, 'status'));
      switch (parsed.payload.status) {
        case 'suspended':
          if (event.payload && event.payload.cause === 'low_glucose') {
            simulator.suspend(event);
          }
          else if (event.reason.suspended === 'manual') {
            simulator.suspend(event);
          }
          else {
            throw new Error(util.format('Unknown suspend reason[%s]', parsed.payload.reason));
          }
          break;
        case 'resumed':
          if (event.payload && event.payload.code === 'auto_resume_complete') {
            simulator.resume(event);
          }
          else if (event.payload && event.payload.code === 'auto_resume_reduced') {
            simulator.lgsAutoResume(event);
          }
          else if (event.payload && event.payload.code === 'user_restart_basal') {
            simulator.lgsResume(event);
          }
          else if (event.reason.resumed === 'manual') {
            simulator.resume(event);
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
