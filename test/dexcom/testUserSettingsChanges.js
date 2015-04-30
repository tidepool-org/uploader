/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

var _ = require('lodash');
var expect = require('salinity').expect;
var sundial = require('sundial');

var builder = require('../../lib/objectBuilder')();
var userSettingsChanges = require('../../lib/dexcom/userSettingsChanges');

describe('userSettingsChanges.js', function() {
  var settings = [
    {
      displayOffset: 0,
      internalTime: '2009-01-10T06:19:55',
      jsDate: new Date(Date.UTC(2009,0,1,0,0,0) + 1000*800395),
      systemSeconds: 800395,
      systemTimeMsec: 1231568395000
    },
    {
      displayOffset: -28800,
      internalTime: '2014-11-23T06:54:49',
      jsDate: new Date(Date.UTC(2009,0,1,0,0,0) + 1000*185928889),
      systemSeconds: 185957689,
      systemTimeMsec: 1416725689000,
    },
    {
      displayOffset: -28800,
      internalTime: '2014-11-23T06:55:07',
      jsDate: new Date(Date.UTC(2009,0,1,0,0,0) + 1000*185928907),
      systemSeconds: 185957707,
      systemTimeMsec: 1416725707000
    },
    {
      displayOffset: -21644,
      internalTime: '2014-12-25T21:34:45',
      jsDate: new Date(Date.UTC(2009,0,1,0,0,0) + 1000*188753640),
      systemSeconds: 188775285,
      systemTimeMsec: 1419543285000
    }
  ];
  _.each(settings, function(setting) {
    setting.deviceTime = sundial.formatDeviceTime(setting.jsDate.toISOString());
  });
  it('is a function', function() {
    expect(typeof userSettingsChanges).to.equal('function');
  });

  it('returns an object with `timeChanges` and `settingsChange` attributes', function() {
    var res = userSettingsChanges([]);
    expect(typeof res).to.equal('object');
    expect(res.timeChanges).to.exist;
    expect(res.settingChanges).to.exist;
  });

  describe('timeChanges', function() {
    var res = userSettingsChanges(settings, {builder: builder});

    it('ignores records from 2009 when calculating `timeChanges`', function() {
      _.each(res.timeChanges, function(change) {
        expect(change.time.slice(0,4)).not.to.equal('2009');
      });
    });

    it('only creates timeChange records when the displayOffset has changed', function() {
      var res = userSettingsChanges(settings, {builder: builder});
      var expectedChange = {
        deviceTime: '2014-12-25T15:34:00',
        change: {
          agent: 'manual',
          from: '2014-12-25T13:34:45',
          to: '2014-12-25T15:34:01'
        }
      };
      expect(res.timeChanges.length).to.equal(1);
      expect(_.pick(res.timeChanges[0], ['deviceTime', 'change'])).to.deep.equal(expectedChange);
    });
  });
});