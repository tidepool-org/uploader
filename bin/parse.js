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

var async = require('async');
var fs = require('fs');
var path = require('path');

var carelinkDriver = require('../lib/carelink/carelinkDriver.js')(require('../lib/simulator/carelinkSimulator.js'));

function noop() {}

var file = process.argv[2];
var timezone = process.argv[3];
if (timezone == null) {
  timezone = 'America/Los_Angeles';
}

var input = fs.readFileSync(file, {encoding: 'utf8'});
var drvr = carelinkDriver({ filename: path.basename(file), fileData: input, timezone: timezone });

async.waterfall(
  [
    drvr.setup.bind(drvr, noop),
    drvr.connect.bind(drvr, noop),
    drvr.getConfigInfo.bind(drvr, noop),
    drvr.fetchData.bind(drvr, noop),
    drvr.processData.bind(drvr, noop)
  ],
  function(err, payload) {
    Object.keys(payload.devices).map(function(device){
      var events = payload.devices[device].simulator.getEvents();
      for (var i = 0; i < events.length; ++i) {
        console.log('%j', events[i]);
      }
    });
  }
);