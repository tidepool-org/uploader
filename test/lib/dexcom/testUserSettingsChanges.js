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

var builder = require('../../../lib/objectBuilder')();
var userSettingsChanges = require('../../../lib/drivers/dexcom/userSettingsChanges');

describe('userSettingsChanges.js', () => {
  var settingsTemplate = {
    transmitterId: '6397714',
    lowAlarmEnabled: true,
    lowAlarmValue: 70,
    lowAlarmSnoozeMsec: 18e5,
    highAlarmEnabled: true,
    highAlarmValue: 180,
    highAlarmSnoozeMsec: 72e5,
    fallRateEnabled: false,
    fallRateValue: -2,
    riseRateEnabled: false,
    riseRateValue: 3,
    outOfRangeEnabled: true,
    outOfRangeSnoozeMsec: 18e5,
    languageName: 'Kiwi',
    alarmProfileName: 'Normal'
  };
  var settings = [
    {
      displayOffset: 0,
      internalTime: '2009-01-10T06:19:55',
      jsDate: new Date(Date.UTC(2009,0,1,0,0,0) + 1000*800395),
      systemSeconds: 800395,
      systemTimeMsec: 1231568395000,
      setUpState: 1
    },
    {
      displayOffset: -28800,
      internalTime: '2014-11-23T06:54:49',
      jsDate: new Date(Date.UTC(2009,0,1,0,0,0) + 1000*185928889),
      systemSeconds: 185957689,
      systemTimeMsec: 1416725689000,
      setUpState: 3
    },
    {
      displayOffset: -28800,
      internalTime: '2014-11-23T06:55:07',
      jsDate: new Date(Date.UTC(2009,0,1,0,0,0) + 1000*185928907),
      systemSeconds: 185957707,
      systemTimeMsec: 1416725707000,
      setUpState: 5
    },
    {
      displayOffset: -21644,
      internalTime: '2014-12-25T21:34:45',
      jsDate: new Date(Date.UTC(2009,0,1,0,0,0) + 1000*188753640),
      systemSeconds: 188775285,
      systemTimeMsec: 1419543285000,
      setUpState: 5
    },
    {
      displayOffset: -25256,
      internalTime: '2014-12-31T21:26:56',
      jsDate: new Date(Date.UTC(2009,0,1,0,0,0) + 1000*189267960),
      systemSeconds: 189293216,
      systemTimeMsec: 1420061216000,
      setUpState: 5
    }
  ];
  _.each(settings, function(setting) {
    setting.deviceTime = sundial.formatDeviceTime(setting.jsDate.toISOString());
  });
  test('is a function', () => {
    expect(typeof userSettingsChanges).to.equal('function');
  });

  test('returns an object with `timeChanges` and `settingsChange` attributes', () => {
    var res = userSettingsChanges([]);
    expect(typeof res).to.equal('object');
    expect(res.timeChanges).to.exist;
    expect(res.settingChanges).to.exist;
  });

  describe('timeChanges', () => {
    var res = userSettingsChanges(settings, {builder: builder});

    test('ignores records from 2009', () => {
      _.each(res.timeChanges, function(change) {
        expect(change.time.slice(0,4)).not.to.equal('2009');
      });
    });

    test('only creates timeChange records when the displayOffset has changed', () => {
      var res = userSettingsChanges(settings, {builder: builder});
      var expectedChange = {
        deviceTime: '2014-12-25T13:34:45',
        change: {
          agent: 'manual',
          from: '2014-12-25T13:34:45',
          to: '2014-12-25T15:34:01'
        }
      };
      expect(res.timeChanges.length).to.equal(2);
      expect(_.pick(res.timeChanges[0], ['deviceTime', 'change'])).to.deep.equal(expectedChange);
    });
  });

  describe('settingChanges', () => {
    var mockSettingsNoChanges = _.map(settings, function(timeInfo) {
      var wholeSettings = _.assign({}, timeInfo, settingsTemplate);
      wholeSettings.deviceTime = sundial.formatDeviceTime(wholeSettings.jsDate);
      return wholeSettings;
    });
    test('ignores records from 2009', () => {
      var res = userSettingsChanges(mockSettingsNoChanges, {builder: builder});
      _.each(res.settingChanges, function(change) {
        expect(change.time.slice(0,4)).not.to.equal('2009');
      });
    });

    test('ignores records with a transmitterId of `60000` (default, not yet set up)', () => {
      var thisSettings = _.map(mockSettingsNoChanges, function(obj) { return _.cloneDeep(obj); });
      thisSettings[0].transmitterId = 6291456;
      thisSettings[1].transmitterId = 6291456;
      thisSettings[2].transmitterId = 6291456;
      var res = userSettingsChanges(thisSettings, {builder: builder});
      expect(res.settingChanges.length).to.equal(1);
      expect(res.settingChanges[0].payload.internalTime).to.equal('2014-12-25T21:34:45');
    });

    test('ignores records with an incomplete `setUpState`', () => {
      var thisSettings = _.map(mockSettingsNoChanges, function(obj) { return _.cloneDeep(obj); });
      thisSettings[4].fallRateEnabled = true;
      var res = userSettingsChanges(thisSettings, {builder: builder});
      expect(res.settingChanges.length).to.equal(2);
      expect(res.settingChanges[0].payload.internalTime).to.equal('2014-11-23T06:55:07');
      expect(res.settingChanges[1].payload.internalTime).to.equal('2014-12-31T21:26:56');
    });

    test('produces one settings object at earliest data when no changes', () => {
      var res = userSettingsChanges(mockSettingsNoChanges, {builder: builder});
      expect(res.settingChanges.length).to.equal(1);
      expect(res.settingChanges[0].payload.internalTime).to.equal('2014-11-23T06:55:07');
    });

    test('de-dupes settings so that only *changes* to settings are returned', () => {
      var thisSettings = _.map(mockSettingsNoChanges, function(obj) { return _.cloneDeep(obj); });
      thisSettings[3].fallRateEnabled = true;
      thisSettings[3].riseRateEnabled = true;
      thisSettings[3].lowAlarmValue = 80;
      thisSettings[3].highAlarmValue = 200;
      // continue changes to final settings object, which should then be de-duped since nothing's changed
      thisSettings[4].fallRateEnabled = true;
      thisSettings[4].riseRateEnabled = true;
      thisSettings[4].lowAlarmValue = 80;
      thisSettings[4].highAlarmValue = 200;
      var convertedTransmitterId = '637QJ';
      var res = userSettingsChanges(thisSettings, {builder: builder});
      expect(res.settingChanges.length).to.equal(2);
      expect(res.settingChanges[0].transmitterId).to.equal(convertedTransmitterId);
      expect(res.settingChanges[0].payload.internalTime).to.equal('2014-11-23T06:55:07');
      expect(res.settingChanges[0].rateOfChangeAlerts.fallRate.enabled).to.be.false;
      expect(res.settingChanges[0].rateOfChangeAlerts.riseRate.enabled).to.be.false;
      expect(res.settingChanges[0].lowAlerts.level).to.equal(70);
      expect(res.settingChanges[0].highAlerts.level).to.equal(180);
      expect(res.settingChanges[0].transmitterId).to.equal(convertedTransmitterId);
      expect(res.settingChanges[1].payload.internalTime).to.equal('2014-12-25T21:34:45');
      expect(res.settingChanges[1].rateOfChangeAlerts.fallRate.enabled).to.be.true;
      expect(res.settingChanges[1].rateOfChangeAlerts.riseRate.enabled).to.be.true;
      expect(res.settingChanges[1].lowAlerts.level).to.equal(80);
      expect(res.settingChanges[1].highAlerts.level).to.equal(200);
    });
  });
});
