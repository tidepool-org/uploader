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

var basalRateParser = common.makeParser(
  {
    CurrentBasalProfile: {
      index: parsing.asNumber(['Raw-Values', 'PROFILE_INDEX']),
      payload: {
        rate: parsing.asNumber(['Raw-Values', 'RATE']),
        start: parsing.asNumber(['Raw-Values', 'START_TIME'])
      }
    }
  });

var bgTargetParser = common.makeParser(
  {
    CurrentBGTargetRange: {
      index: parsing.asNumber(['Raw-Values', 'INDEX']),
      payload: {
        low: parsing.asNumber(['Raw-Values', 'AMOUNT_LOW']),
        high: parsing.asNumber(['Raw-Values', 'AMOUNT_HIGH']),
        start: parsing.asNumber(['Raw-Values', 'START_TIME'])
      }
    }
  });

var carbRatioParser = common.makeParser(
  {
    CurrentCarbRatio: {
      index: parsing.asNumber(['Raw-Values', 'INDEX']),
      payload: {
        amount: parsing.asNumber(['Raw-Values', 'AMOUNT']),
        start: parsing.asNumber(['Raw-Values', 'START_TIME'])
      }
    }
  });

var insulinSensitivityParser = common.makeParser(
  {
    CurrentInsulinSensitivity: {
      index: parsing.asNumber(['Raw-Values', 'INDEX']),
      payload: {
        amount: parsing.asNumber(['Raw-Values', 'AMOUNT']),
        start: parsing.asNumber(['Raw-Values', 'START_TIME'])
      }
    }
  });

module.exports = function (timezone) {
  var parser = common.makeCommonVals(timezone);

  var cachedObjects = null;
  var pointer = 0;

  function buildCache(data) {
    cachedObjects = [];
    var i, j, k;

    for (i = data.length - 1; i >= 0; --i) {
      var datum = data[i];
      if (datum['Raw-Type'].indexOf('Current') === 0) {
        var endOfCurrent = i;
        while (endOfCurrent >= 0 && data[endOfCurrent]['Raw-Type'].indexOf('Current') === 0) {
          --endOfCurrent;
        }
        ++endOfCurrent;

        var settings = {basalSchedules: {}, units: {}};
        for (j = endOfCurrent; j <= i; ++j) {
          switch (data[j]['Raw-Type']) {
            case 'CurrentActiveBasalProfilePattern':
              settings.activeSchedule = data[j]['Raw-Values']['PATTERN_NAME'];
              break;
            case 'CurrentBasalProfilePattern':
              var patternName = data[j]['Raw-Values']['PATTERN_NAME'];
              var basalEntries = new Array(parseInt(data[j]['Raw-Values']['NUM_PROFILES'], 10));

              for (k = 1; k <= basalEntries.length; ++k) {
                var basalRate = basalRateParser(data[j + k]);
                if (basalRate == null) {
                  throw new Error(util.format('Expected a CurrentBasalProfile, got [%j] instead.', data[j + k]));
                }
                basalEntries[basalRate.index] = basalRate.payload;
              }

              j += basalEntries.length;
              settings.basalSchedules[patternName] = basalEntries;
              break;
            case 'CurrentBGTargetRangePattern':
              var bgTargetEntries = new Array(parseInt(data[j]['Raw-Values']['SIZE'], 10));

              for (k = 1; k <= bgTargetEntries.length; ++k) {
                var bgTarget = bgTargetParser(data[j + k]);
                if (bgTarget == null) {
                  throw new Error(util.format('Expected a CurrentBGTargetRange, got [%j] instead.', data[j + k]));
                }
                bgTargetEntries[bgTarget.index] = bgTarget.payload;
              }

              j += bgTargetEntries.length;
              settings.bgTarget = bgTargetEntries;
              break;
            case 'CurrentBolusWizardBGUnits':
              var units = data[j]['Raw-Values']['UNITS'];
              if (units === 'mg dl') {
                units = 'mg/dL';
              }
              settings.units.bg = units;
              break;
            case 'CurrentBolusWizardCarbUnits':
              settings.units.carb = data[j]['Raw-Values']['UNITS'];
              break;
            case 'CurrentCarbRatioPattern':
              var carbRatioEntries = new Array(parseInt(data[j]['Raw-Values']['SIZE'], 10));

              for (k = 1; k <= carbRatioEntries.length; ++k) {
                var carbRatio = carbRatioParser(data[j + k]);
                if (carbRatio == null) {
                  throw new Error(util.format('Expected a CurrentCarbRatio, got [%j] instead.', data[j + k]));
                }
                carbRatioEntries[carbRatio.index] = carbRatio.payload;
              }

              j += carbRatioEntries.length;
              settings.carbRatio = carbRatioEntries;
              break;
            case 'CurrentInsulinSensitivityPattern':
              var insulinSensitivityEntries = new Array(parseInt(data[j]['Raw-Values']['SIZE'], 10));

              for (k = 1; k <= insulinSensitivityEntries.length; ++k) {
                var insulinSensitivity = insulinSensitivityParser(data[j + k]);
                if (insulinSensitivity == null) {
                  throw new Error(util.format('Expected a CurrentCarbRatio, got [%j] instead.', data[j + k]));
                }
                insulinSensitivityEntries[insulinSensitivity.index] = insulinSensitivity.payload;
              }

              j += insulinSensitivityEntries.length;
              settings.insulinSensitivity = insulinSensitivityEntries;
              break;
          }
        }

        // Figure out when this settings object first existed
        for (j = endOfCurrent - 1; j > 0; --j) {
          var type = data[j]['Raw-Type'];
          if (type.indexOf('Current') === 0) {
            // We have another upload, so use this datum to set the timestmap for the current settings
            break;
          }

          switch (type) {
            case 'ChangeBasalProfilePattern':
            case 'ChangeActiveBasalProfilePattern':
            case 'ChangeBGTargetRangePattern':
            case 'ChangeCarbRatioPattern':
            case 'ChangeInsulinSensitivityPattern':
              // Have a change in the schedule, so use this datum to set the timestamp
              break;
            default:
              continue;
          }
          break;
        }

        cachedObjects.unshift(_.assign({}, parser(data[j]), settings));
        i = endOfCurrent;
      }
    }
  }

  /**
   * We take a slightly different strategy with settings than we do with other data types.
   * The way carelink provides settings objects lends itself to working backwards from the
   * most recent settings and applying deltas as you go back in time.  Our simulator wants
   * to see things in forward-time order, so we need to prepare the events ahead of time
   * and thread them into the simulator as needed.
   *
   * So, the strategy is that on the first event, we take the entire data array and process
   * it, generating and caching the settings objects that we will need for all events.
   *
   * Then, as further events come in, when we get an event that is equal to or newer
   * than the next settings event, we emit the settings event and increment our pointer
   */
  return function (simulator, datum, index, data) {
    if (cachedObjects == null) {
      buildCache(data);
    }

    var obj = parser(data);
    while (pointer < cachedObjects.length && obj.time >= cachedObjects[pointer].time ) {
      simulator.settings(cachedObjects[pointer]);
      ++pointer;
    }
  };
};
