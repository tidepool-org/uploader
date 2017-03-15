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

var util = require('util');

var common = require('./common.js');
var parsing = require('./parsing.js');

var RAW_VALUES = 'Raw-Values';

var RV_KEYS = {
  ACTION_REQUESTOR: 'ACTION_REQUESTOR',
  AMOUNT: 'AMOUNT'
};

module.exports = function (opts) {

  var parser = common.makeParser(
    {
      BGCapturedOnPump: [
        common.makeCommonVals(),
        {
          units: opts.units,
          value: parsing.asNumber(opts.colNames.fingerstickGlucose),
          subType: parsing.map([RAW_VALUES, RV_KEYS.ACTION_REQUESTOR], function(requestor) {
            switch(requestor) {
              case null:
              case 'null':
                return null;
              case 'paradigm link or b key':
                return 'linked';
              case 'paradigm link modified':
                return 'manual';
              case 'pump':
                return 'manual';
              default:
                throw new Error(util.format('Unknown action requestor[%s]', requestor));
            }
          }),
          payload: {
            'action-requestor': parsing.extract([RAW_VALUES, RV_KEYS.ACTION_REQUESTOR])
          }
        }
      ]
    }
  );

  return function (simulator, data) {
    var parsed = parser(data);
    // if parsed *is* null, we're just in a row of the CSV
    // that isn't relevant to this processor
    // hence the lack of an `else` condition
    if (parsed != null) {
      simulator.smbg(parsed);
    }
  };
};
