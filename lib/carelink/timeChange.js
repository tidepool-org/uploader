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

var builder = require('../objectBuilder')();
builder.setDefaults({source: 'carelink'});

module.exports = function () {
  var parser = common.makeParser(
    {
      ChangeTime: [
        common.makeCommonVals(),
        {
          timestamp: parsing.asNumber(['Raw-Values', 'NEW_TIME']),
          model: parsing.extract('Raw-Device Type')
        }
      ]
    }
  );

  return function (changes, datum) {
    var parsed = parser(datum);
    if (parsed != null) {
      var timeChange = builder.makeDeviceMetaTimeChange()
        .with_change({
          from: parsed.deviceTime,
          to: new Date(parsed.timestamp).toISOString().slice(0,-5),
          agent: 'manual'
        })
        .with_deviceTime(parsed.deviceTime)
        .with_payload({
          NEW_TIME: parsed.timestamp
        })
        .set('deviceId', parsed.deviceId)
        .set('index', parsed.index)
        .set('jsDate', parsed.jsDate)
        .set('model', parsed.model)
        // TODO: delete after conclusion of Jaeb study
        .set('jaebPayload', parsed.jaebPayload);
        // TODO: end deletion
      changes.push(timeChange);
    }
    else {
      throw new Error('Error parsing `ChangeTime` row!');
    }
  };
};
