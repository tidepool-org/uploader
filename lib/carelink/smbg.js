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

module.exports = function (opts) {

  if (_.isEmpty(opts)) {
    throw new Error('Parser options required but none provided :(');
  }

  var parserSchema = {};
  parserSchema[opts.RAW_TYPE] = [
    common.makeCommonVals(),
    {
      units: opts.units,
      value: opts.RAW_VALUES.AMOUNT,
      payload: {
        source: opts.RAW_VALUES.ACTION_REQUESTOR
      }
    }
  ];

  var parser = common.makeParser(parserSchema);

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
