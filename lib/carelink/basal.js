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

var common = require('./common.js');
var parsing = require('./parsing.js');

module.exports = function () {
  var parser = common.makeParser(
    {
      BasalProfileStart: [
        common.makeCommonVals(),
        {
          uploadSeqNum: parsing.asNumber('Raw-Seq Num'),
          deliveryType: 'scheduled',
          scheduleName: parsing.extract(['Raw-Values', 'PATTERN_NAME']),
          rate: parsing.asNumber(['Raw-Values', 'RATE'])
        }
      ],
      ChangeTempBasalPercent: [
        common.makeCommonVals(),
        {
          deliveryType: 'temp',
          percent: parsing.map(['Raw-Values', 'PERCENT_OF_RATE'], function(e){ return parseFloat(e) / 100.0; }),
          duration: parsing.asNumber(['Raw-Values', 'DURATION'])
        }
      ],
      ChangeTempBasal: [
        common.makeCommonVals(),
        {
          deliveryType: 'temp',
          rate: parsing.asNumber(['Raw-Values', 'RATE']),
          duration: parsing.asNumber(['Raw-Values', 'DURATION'])
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
      switch (parsed.deliveryType) {
        case 'scheduled':
          simulator.basalScheduled(parsed);
          break;
        case 'temp':
          if (parsed.duration !== 0) {
            simulator.basalTemp(parsed);
          }
          break;
        default:
      }
    }
  };
};
