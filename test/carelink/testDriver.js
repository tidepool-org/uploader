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

/* global describe, it */
/*jshint quotmark: false */

var async = require('async');
var fs = require('fs');
var expect = require('salinity').expect;

var carelinkDriver = require('../../lib/drivers/carelinkDriver.js')(require('./mockSimulator.js'));

function noop() {}

function spiderTests(baseDir) {
  var files = fs.readdirSync(baseDir);
  for (var i = 0; i < files.length; ++i) {
    if (files[i] === 'input.csv') {
      (function (path) {
        it(path, function (done) {
          var input = fs.readFileSync(path + '/input.csv', {encoding: 'utf8'});
          var output = JSON.parse(fs.readFileSync(path + '/output.json'));

          var drvr = carelinkDriver({ filename: '/input.csv', fileData: input, timezone: 'Pacific/Honolulu' });

          async.waterfall(
            [
              drvr.setup.bind(drvr, {}, noop),
              drvr.connect.bind(drvr, noop),
              drvr.getConfigInfo.bind(drvr, noop),
              drvr.fetchData.bind(drvr, noop),
              drvr.processData.bind(drvr, noop)
            ],
            function(err, payload) {
              if(err){
                console.log(payload);
              }
              try {
                expect(payload.devices['Paradigm Revel - 723'].simulator.getEvents()).deep.equals(output);
              }
              catch (e) {
                if (e.message === "Cannot read property 'simulator' of undefined") {
                  expect(payload.devices['Paradigm Revel - 723 : CGM'].simulator.getEvents()).deep.equals(output);
                }
                else {
                  throw(e);
                }
              }
              done(err);
            }
          );
        });
      })(baseDir);
    } else if (files[i] === 'old.csv') {
      (function (path) {
        it(path, function (done) {
          var input = fs.readFileSync(path + '/old.csv', {encoding: 'utf8'});
          var output = JSON.parse(fs.readFileSync(path + '/output.json'));

          var drvr = carelinkDriver({ filename: '/old.csv', fileData: input, timezone: 'Pacific/Honolulu' });

          async.waterfall(
            [
              drvr.setup.bind(drvr, {}, noop),
              drvr.connect.bind(drvr, noop),
              drvr.getConfigInfo.bind(drvr, noop),
              drvr.fetchData.bind(drvr, noop),
              drvr.processData.bind(drvr, noop)
            ],
            function(err, payload) {
              if(err){
                console.log(payload);
              }
              expect(payload.devices['Paradigm 722'].simulator.getEvents()).deep.equals(output);
              done(err);
            }
          );
        });
      })(baseDir);
    } else {
      var path = baseDir + '/' + files[i];
      if (fs.lstatSync(path).isDirectory()) {
        spiderTests(path);
      }
    }
  }
}

describe('carelinkDriver.js', function(){
  describe('Input/Output Test', function(){
      spiderTests(__dirname);
  });
});