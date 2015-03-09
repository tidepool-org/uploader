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

var annotate = require('../eventAnnotations');
var common = require('./common.js');
var parsing = require('./parsing.js');

var bgConversionFn = function(n) { return n; };

var entryParser;

function makeEntryParser() {
  return common.makeParser(
    {
      /** basal **/
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
        patternDatum: parsing.asNumber(['Raw-Values', 'PATTERN_DATUM']),
        payload: {
          rate: parsing.asNumber(['Raw-Values', 'RATE']),
          start: parsing.asNumber(['Raw-Values', 'START_TIME'])
        }
      },

      /** bgTarget **/
      ChangeBGTargetRange: {
        index: parsing.asNumber(['Raw-Values', 'INDEX']),
        patternDatum: parsing.asNumber(['Raw-Values', 'PATTERN_DATUM']),
        payload: {
          low: parsing.map(parsing.asNumber(['Raw-Values', 'AMOUNT_LOW']), bgConversionFn),
          high: parsing.map(parsing.asNumber(['Raw-Values', 'AMOUNT_HIGH']), bgConversionFn),
          start: parsing.asNumber(['Raw-Values', 'START_TIME'])
        }
      },
      CurrentBGTargetRange: {
        index: parsing.asNumber(['Raw-Values', 'INDEX']),
        patternDatum: parsing.asNumber(['Raw-Values', 'PATTERN_DATUM']),
        payload: {
          low: parsing.map(parsing.asNumber(['Raw-Values', 'AMOUNT_LOW']), bgConversionFn),
          high: parsing.map(parsing.asNumber(['Raw-Values', 'AMOUNT_HIGH']), bgConversionFn),
          start: parsing.asNumber(['Raw-Values', 'START_TIME'])
        }
      },

      /** carbRatio **/
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
        patternDatum: parsing.asNumber(['Raw-Values', 'PATTERN_DATUM']),
        payload: {
          amount: parsing.asNumber(['Raw-Values', 'AMOUNT']),
          start: parsing.asNumber(['Raw-Values', 'START_TIME'])
        }
      },

      /** insulinSensitivity **/
      ChangeInsulinSensitivity: {
        index: parsing.asNumber(['Raw-Values', 'INDEX']),
        patternDatum: parsing.asNumber(['Raw-Values', 'PATTERN_DATUM']),
        payload: {
          amount: parsing.map(parsing.asNumber(['Raw-Values', 'AMOUNT']), bgConversionFn),
          start: parsing.asNumber(['Raw-Values', 'START_TIME'])
        }
      },
      CurrentInsulinSensitivity: {
        index: parsing.asNumber(['Raw-Values', 'INDEX']),
        patternDatum: parsing.asNumber(['Raw-Values', 'PATTERN_DATUM']),
        payload: {
          amount: parsing.map(parsing.asNumber(['Raw-Values', 'AMOUNT']), bgConversionFn),
          start: parsing.asNumber(['Raw-Values', 'START_TIME'])
        }
      }
  });
}



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

function applyEntries(data, range, lookup) {
  for (var j = range.start; j < range.end; ++j) {
    var parsed = entryParser(data[j]);
    // if parsed *is* null, we're just in a row of the CSV
    // that isn't relevant to this processor
    // hence the lack of an `else` condition
    if (parsed != null && lookup[parsed.patternDatum] != null) {
      lookup[parsed.patternDatum][parsed.index] = parsed.payload;
    }
  }
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
      carb: configDatum['Raw-Values']['CARB_UNITS']
    }
  };
  var normalizedBg = common.normalizeBgUnits(configDatum['Raw-Values']['BG_UNITS']);
  if (normalizedBg != null) {
    retVal.units.bg = normalizedBg;
  }

  var lookup = {};
  lookup[bgTargetDatum['Raw-ID']] = retVal.bgTarget;
  lookup[carbRatioDatum['Raw-ID']] = retVal.carbRatio;
  lookup[insSensDatum['Raw-ID']] = retVal.insulinSensitivity;
  applyEntries(data, range, lookup);

  return retVal;
}

module.exports = function (timezone, opts) {
  if (opts.units === 'mmol/L') {
    bgConversionFn = common.convertBackToMmol;
  }
  entryParser = makeEntryParser();

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
            // Have a change in the settings, so use this datum to set the timestamp
            break;
          default:
            continue;
        }
        break;
      }

      if (j === -1) {
        return data[index];
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
              annotate.annotateEvent(prevSettings, 'carelink/settings/activeSchedule-mismatch');
            }


            if (common.isSuspectedNewDevice(prevSettings)) {
              prevSettings = _.assign(
                prevSettings,
                commonParser(data[i])
              );
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
            applyEntries(data, range, lookup);

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
              annotate.annotateEvent(prevSettings, 'carelink/settings/basal-mismatch');
            }


            if (common.isSuspectedNewDevice(prevSettings)) {
              prevSettings = _.assign(
                prevSettings,
                commonParser(data[i])
              );
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
              annotate.annotateEvent(prevSettings, 'carelink/settings/wizard-mismatch');
            }

            if (common.isSuspectedNewDevice(prevSettings)) {
              prevSettings = _.assign(
                prevSettings,
                commonParser(data[i])
              );
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
            // These events are all generated when a medtronic pump is uploaded to Carelink.  They indicate the
            // settings of the pump at the time of upload.

            // Find the range of events that are in the set of "Current" events
            var range = findTimestampGrouping(data, i);

            var lookup = {};

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
                  lookup[data[j]['Raw-ID']]  = settings.basalSchedules[patternName] = basalEntries;
                  break;
                case 'CurrentBGTargetRangePattern':
                  var bgTargetEntries = new Array(parseInt(data[j]['Raw-Values']['SIZE'], 10));
                  lookup[data[j]['Raw-ID']] = settings.bgTarget = bgTargetEntries;
                  break;
                case 'CurrentBolusWizardBGUnits':
                  var normalized = common.normalizeBgUnits(data[j]['Raw-Values']['UNITS']);
                  if (normalized != null) {
                    settings.units.bg = normalized;
                  }
                  break;
                case 'CurrentBolusWizardCarbUnits':
                  settings.units.carb = data[j]['Raw-Values']['UNITS'];
                  break;
                case 'CurrentCarbRatioPattern':
                  var carbRatioEntries = new Array(parseInt(data[j]['Raw-Values']['SIZE'], 10));
                  lookup[data[j]['Raw-ID']] = settings.carbRatio = carbRatioEntries;
                  break;
                case 'CurrentInsulinSensitivityPattern':
                  var insulinSensitivityEntries = new Array(parseInt(data[j]['Raw-Values']['SIZE'], 10));
                  lookup[data[j]['Raw-ID']] = settings.insulinSensitivity = insulinSensitivityEntries;
                  break;
              }
            }

            applyEntries(data, range, lookup);

            var effectiveDate = commonParser(findSettingsChangeBefore(range.start));
            if (cachedObjects.length !== 0 && common.isSuspectedNewDevice(settings)) {
              effectiveDate = commonParser(data[i]);
            }
            cachedObjects.unshift(_.assign({}, effectiveDate, settings));
            i = range.start;
          })();
          break;
      }
    }

    /**
     * We dedupe settings because there is one case where MedT does a sneaky thing that
     * results in two changes at the exact same time. That case is creating a new basal profile.
     * When that happens, you have the change creating the segments of the profile
     * and simultaneously you have a change to make that profile your active basal profile 
     * (MedT doesn't give you a choice about this, but rather automatically switches you to the new one.)
     *
     * It doesn't make sense to keep settings events that don't represent a final state
     * of settings, so we dedupe them.
     */
    var unique = {};
    _.each(cachedObjects, function(obj) {
      unique[obj.time] = obj;
    });

    cachedObjects = _.sortBy(
      _.map(Object.keys(unique), function(key) {
        // TODO: delete after conclusion of Jaeb study
        delete unique[key].jaebPayload;
        // TODO: end deletion
        return unique[key];
      }),
      function(obj) { return obj.time; }
    );
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
