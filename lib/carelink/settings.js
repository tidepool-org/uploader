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
    ChangeBasalProfile: {
      index: parsing.asNumber(['Raw-Values', 'PROFILE_INDEX']),
      patternDatum: parsing.asNumber(['Raw-Values', 'PATTERN_DATUM']),
      payload: {
        rate: parsing.asNumber(['Raw-Values', 'RATE']),
        start: parsing.asNumber(['Raw-Values', 'START_TIME'])
      }
    },
    ChangeBasalProfilePre: {
      index: parsing.asNumber(['Raw-Values', 'PROFILE_INDEX']),
      patternDatum: parsing.asNumber(['Raw-Values', 'PATTERN_DATUM']),
      payload: {
        rate: parsing.asNumber(['Raw-Values', 'RATE']),
        start: parsing.asNumber(['Raw-Values', 'START_TIME'])
      }
    },
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
    ChangeBGTargetRange: {
      index: parsing.asNumber(['Raw-Values', 'INDEX']),
      patternDatum: parsing.asNumber(['Raw-Values', 'PATTERN_DATUM']),
      payload: {
        low: parsing.asNumber(['Raw-Values', 'AMOUNT_LOW']),
        high: parsing.asNumber(['Raw-Values', 'AMOUNT_HIGH']),
        start: parsing.asNumber(['Raw-Values', 'START_TIME'])
      }
    },
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
    ChangeCarbRatio: {
      index: parsing.asNumber(['Raw-Values', 'INDEX']),
      patternDatum: parsing.asNumber(['Raw-Values', 'PATTERN_DATUM']),
      payload: {
        amount: parsing.asNumber(['Raw-Values', 'AMOUNT']),
        start: parsing.asNumber(['Raw-Values', 'START_TIME'])
      }
    },
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
    ChangeInsulinSensitivity: {
      index: parsing.asNumber(['Raw-Values', 'INDEX']),
      patternDatum: parsing.asNumber(['Raw-Values', 'PATTERN_DATUM']),
      payload: {
        amount: parsing.asNumber(['Raw-Values', 'AMOUNT']),
        start: parsing.asNumber(['Raw-Values', 'START_TIME'])
      }
    },
    CurrentInsulinSensitivity: {
      index: parsing.asNumber(['Raw-Values', 'INDEX']),
      payload: {
        amount: parsing.asNumber(['Raw-Values', 'AMOUNT']),
        start: parsing.asNumber(['Raw-Values', 'START_TIME'])
      }
    }
  });

var wizardChangeParser = function(e){
  var retVal = bgTargetParser(e);
  if (retVal == null) {
    retVal = carbRatioParser(e);
  }
  if (retVal == null) {
    retVal = insulinSensitivityParser(e);
  }
  return retVal;
};

/**
 * Returns an object with `start` and `end` fields that are inclusive and exclusive, respectively.
 *
 * The data points between `start` and `end` all have the same Timestamp value.
 *
 * @param data array of elements with a Timestamp field
 * @param index index to start at
 */
function findTimestampGrouping(data, index) {
  // Find the range of events that are in the set of "Current" events
  var ts = data[index]['Timestamp'];
  var end = index;
  while (end < data.length && data[end]['Timestamp'] === ts){
    ++end;
  }

  var start = index;
  while (start >= 0 && data[start]['Timestamp'] === ts) {
    --start;
  }
  ++start;

  return {start: start, end: end};
}

function normalizeBgUnits(units) {
  if (units === 'mg dl') {
    units = 'mg/dL';
  }
  return units;
}

function findDatum(data, range, id) {
  if (typeof(id) === 'string') {
    id = parseInt(id);
  }
  for (var i = range.start; i < range.end; ++i) {
    if (data[i]['Raw-ID'] === id) {
      return data[i];
    }
  }
  throw new Error('Couldn\'t find datum for id[' + id + ']');
}

function buildWizardChange(data, range, id){
  var configDatum = findDatum(data, range, id);

  var bgTargetDatum = findDatum(data, range, configDatum['Raw-Values']['BG_TARGET_RANGE_PATTERN_DATUM']);
  var carbRatioDatum = findDatum(data, range, configDatum['Raw-Values']['CARB_RATIO_PATTERN_DATUM']);
  var insSensDatum = findDatum(data, range, configDatum['Raw-Values']['INSULIN_SENSITIVITY_PATTERN_DATUM']);

  var retVal = {
    bgTarget: new Array(parseInt(bgTargetDatum['Raw-Values']['SIZE'])),
    carbRatio: new Array(parseInt(carbRatioDatum['Raw-Values']['SIZE'])),
    insulinSensitivity: new Array(parseInt(insSensDatum['Raw-Values']['SIZE'])),
    units: {
      bg: normalizeBgUnits(configDatum['Raw-Values']['BG_UNITS']),
      carb: configDatum['Raw-Values']['CARB_UNITS']
    }
  };
  var lookup = {};
  lookup[bgTargetDatum['Raw-ID']] = retVal.bgTarget;
  lookup[carbRatioDatum['Raw-ID']] = retVal.carbRatio;
  lookup[insSensDatum['Raw-ID']] = retVal.insulinSensitivity;

  for (var j = range.start; j < range.end; ++j) {
    var parsed = wizardChangeParser(data[j]);
    if (parsed != null && lookup[parsed.patternDatum] != null) {
      lookup[parsed.patternDatum][parsed.index] = parsed.payload;
    }
  }

  return retVal;
}

module.exports = function (timezone) {
  var commonParser = common.makeCommonVals(timezone);

  var cachedObjects = null;
  var pointer = 0;

  function buildCache(data) {
    function findSettingsChangeBefore(index) {
      // Figure out when this settings object first existed
      for (var j = index - 1; j > 0; --j) {
        var type = data[j]['Raw-Type'];

        switch (type) {
          case 'CurrentActiveBasalProfilePattern':
          case 'CurrentBasalProfilePattern':
          case 'CurrentBGTargetRangePattern':
          case 'CurrentBolusWizardBGUnits':
          case 'CurrentBolusWizardCarbUnits':
          case 'CurrentCarbRatioPattern':
          case 'CurrentInsulinSensitivityPattern':
          case 'ChangeBolusWizardSetup':
          case 'ChangeBasalProfilePattern':
          case 'ChangeActiveBasalProfilePattern':
          case 'ChangeBGTargetRangePattern':
          case 'ChangeCarbRatioPattern':
          case 'ChangeInsulinSensitivityPattern':
            // Have a change in the settings, so use this datum to set the timestamp
            break;
          default:
            continue;
        }
        break;
      }

      return data[j];
    }

    cachedObjects = [];

    for (var i = data.length - 1; i >= 0; --i) {
      var datum = data[i];
      var type = datum['Raw-Type'];
      switch (type) {
        case 'ChangeActiveBasalProfilePattern':
          if (cachedObjects.length === 0) {
            // If we don't have a settings object yet, then we don't have anything to apply it to ==> ignore it!
            break;
          }

          (function(){
            // We walk settings backwards, so all of these events indicate a change to
            // *become* our "current" settings, rather than a change *away from* our "current" settings.
            var currSettings = cachedObjects[0];
            var prevSettings = _.assign(
              _.cloneDeep(currSettings),
              commonParser(findSettingsChangeBefore(i)),
              { activeSchedule: datum['Raw-Values']['OLD_PATTERN_NAME'] }
            );
            delete prevSettings.annotations;

            if (datum['Raw-Values']['PATTERN_NAME'] !== currSettings.activeSchedule) {
              common.annotateEvent(prevSettings, 'carelink/settings/activeSchedule-mismatch');
            }

            cachedObjects.unshift(prevSettings);
          })();
          break;
        case 'ChangeBasalProfilePattern':
          if (cachedObjects.length === 0) {
            // If we don't have a settings object yet, then we don't have anything to apply it to ==> ignore it!
            break;
          }

          (function(){
            var range = findTimestampGrouping(data, i);
            var preIndex = range.start;
            while (preIndex < range.end && data[preIndex]['Raw-Type'] !== 'ChangeBasalProfilePatternPre') {
              ++preIndex;
            }

            var scheduleName = data[i]['Raw-Values']['PATTERN_NAME'];
            var newSchedule = new Array(parseInt(data[i]['Raw-Values']['NUM_PROFILES']));
            var oldSchedule = preIndex === range.end ? [] : new Array(parseInt(data[preIndex]['Raw-Values']['NUM_PROFILES']));

            var lookup = {};
            lookup[data[i]['Raw-ID']] = newSchedule;
            if (preIndex !== range.end) {
              lookup[data[preIndex]['Raw-ID']] = oldSchedule;
            }

            for (var j = range.start; j < range.end; ++j) {
              var parsed = basalRateParser(data[j]);
              if (parsed != null) {
                lookup[parsed.patternDatum][parsed.index] = parsed.payload;
              }
            }

            // We walk settings backwards, so all of these events indicate a change to
            // *become* our "current" settings, rather than a change *away from* our "current" settings.
            var currSettings = cachedObjects[0];
            var prevSettings = _.assign(
              _.cloneDeep(currSettings),
              commonParser(findSettingsChangeBefore(range.start))
            );
            prevSettings.basalSchedules[scheduleName] = oldSchedule;
            delete prevSettings.annotations;

            if (!_.isEqual(newSchedule, currSettings.basalSchedules[scheduleName])) {
              common.annotateEvent(prevSettings, 'carelink/settings/basal-mismatch');
            }

            cachedObjects.unshift(prevSettings);
            i = range.start;
          })();
          break;
        case 'ChangeBolusWizardSetup':
          if (cachedObjects.length === 0) {
            // If we don't have a settings object yet, then we don't have anything to apply it to ==> ignore it!
            break;
          }

          (function(){
            var range = findTimestampGrouping(data, i);

            var newConfig = buildWizardChange(data, range, datum['Raw-Values']['NEW_CONFIG_DATUM']);
            var oldConfig = buildWizardChange(data, range, datum['Raw-Values']['OLD_CONFIG_DATUM']);

            // We walk settings backwards, so all of these events indicate a change to
            // *become* our "current" settings, rather than a change *away from* our "current" settings.
            var currSettings = cachedObjects[0];
            var prevSettings = _.assign(
              _.cloneDeep(currSettings),
              commonParser(findSettingsChangeBefore(range.start)),
              oldConfig
            );
            delete prevSettings.annotations;

            if (!_.isEqual(newConfig, _.pick(currSettings, Object.keys(newConfig)))) {
              common.annotateEvent(prevSettings, 'carelink/settings/wizard-mismatch');
            }

            cachedObjects.unshift(prevSettings);
            i = range.start;
          })();
          break;
        case 'CurrentActiveBasalProfilePattern':
        case 'CurrentBasalProfilePattern':
        case 'CurrentBGTargetRangePattern':
        case 'CurrentBolusWizardBGUnits':
        case 'CurrentBolusWizardCarbUnits':
        case 'CurrentCarbRatioPattern':
        case 'CurrentInsulinSensitivityPattern':
          (function(){
            var k;

            // These events are all generated when a medtronic pump is uploaded to Carelink.  They indicate the
            // settings of the pump at the time of upload.

            // Find the range of events that are in the set of "Current" events
            var range = findTimestampGrouping(data, i);

            // Run through the events and build up the settings object
            var settings = {basalSchedules: {}, units: {}};
            for (var j = range.start; j < range.end; ++j) {
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
                  settings.units.bg = normalizeBgUnits(data[j]['Raw-Values']['UNITS']);
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

            cachedObjects.unshift(_.assign({}, commonParser(findSettingsChangeBefore(range.start)), settings));
            i = range.start;
          })();
          break;
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

    var obj = commonParser(datum);
    while (pointer < cachedObjects.length && obj.time >= cachedObjects[pointer].time ) {
      simulator.settings(cachedObjects[pointer]);
      ++pointer;
    }
  };
};
