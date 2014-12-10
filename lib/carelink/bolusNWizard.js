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

module.exports = function (timezone) {
  var parser = common.makeParser(
    {
      'BolusNormal': [
        common.makeCommonVals(timezone),
        {
          type: 'bolusNormal',
          subType: 'normal',
          normal: parsing.asNumber('Bolus Volume Delivered (U)'),
          expectedNormal: parsing.asNumber('Bolus Volume Selected (U)'),
          uploadId: parsing.extract('Raw-Upload ID'),
          uploadSeqNum: parsing.asNumber('Raw-Seq Num'),
          dualComponent: parsing.asBoolean(['Raw-Values', 'IS_DUAL_COMPONENT'])
        }
      ],
      'BolusSquare': [
        common.makeCommonVals(timezone),
        {
          type: 'bolusSquare',
          subType: 'square',
          extended: parsing.asNumber('Bolus Volume Delivered (U)'),
          expectedExtended: parsing.asNumber('Bolus Volume Selected (U)'),
          duration: parsing.asNumber(['Raw-Values', 'DURATION']),
          uploadId: parsing.extract('Raw-Upload ID'),
          uploadSeqNum: parsing.asNumber('Raw-Seq Num'),
          dualComponent: parsing.asBoolean(['Raw-Values', 'IS_DUAL_COMPONENT'])
        }
      ],
      'BolusWizardBolusEstimate': [
        common.makeCommonVals(timezone),
        {
          type: 'wizard',
          uploadId: parsing.extract('Raw-Upload ID'),
          uploadSeqNum: parsing.asNumber('Raw-Seq Num'),
          bgInput: parsing.asNumber(['Raw-Values', 'BG_INPUT']),
          bgTarget: {
            high: parsing.asNumber('BWZ Target High BG (mg/dL)'),
            low: parsing.asNumber('BWZ Target Low BG (mg/dL)')
          },
          carbInput: parsing.asNumber(['Raw-Values', 'CARB_INPUT']),
          insulinCarbRatio: parsing.asNumber('BWZ Carb Ratio (grams)'),
          insulinOnBoard: parsing.asNumber('BWZ Active Insulin (U)'),
          insulinSensitivity: parsing.asNumber('BWZ Insulin Sensitivity (mg/dL)'),
          recommended: {
            carb: parsing.asNumber('BWZ Food Estimate (U)'),
            correction: parsing.asNumber('BWZ Correction Estimate (U)'),
            net: parsing.asNumber('BWZ Estimate (U)')
          },
          payload: {},
          units: parsing.map(parsing.extract(['Raw-Values', 'BG_UNITS']), common.normalizeBgUnits)
        }
      ]
    }
  );

  var processedIndex = 0;

  function buildBolus(normal, square) {
    if (normal == null && square == null) {
      return null;
    }

    if (normal == null) {
      return _.clone(square);
    } else {
      if (square == null) {
        return _.clone(normal);
      } else {
        return _.assign({}, square, normal, {subType: 'dual/square'});
      }
    }
  }

  /**
   * Increments processedIndex until the findFn returns true
   *
   * This is essentially the equivalent of a foreach loop across data, but it updates processedIndex
   * as a side-effect.  The findFn should be the body of the foreach loop and return true when it wants
   * to be done iterating
   *
   * @param data array of data to iterate over
   * @param start starting index
   * @param findFn body of loop iteration, returns true when done iterating
   */
  function incrementProcessedIndexUntil(data, start, findFn) {
    for (processedIndex = start; processedIndex < data.length; ++processedIndex) {
      var parsed = parser(data[processedIndex]);
      if (parsed != null) {
        if (findFn(parsed)) {
          break;
        }
      }
    }
  }

  function cleanEvent(bolus) {
    return _.omit(bolus, 'uploadId', 'uploadSeqNum', 'dualComponent', 'type');
  }

  function numbersInOrderNoGaps() {
    var nums = Array.prototype.splice.call(arguments, 0).filter(function(e){return e != null;});
    nums.sort();
    for (var i = 0; i < nums.length - 1; ++i) {
      if (nums[i]+1 !== nums[i+1]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Handles processing of wizard and bolus objects from Carelink CSV.  These objects are pretty annoying in that
   * they don't happen in chronological order.  There is an expected "uploadSeqNum" order that is always in the same
   * order for a given device, but that order varies between different devices for dual-wave boluses.  Luckily, the
   * sequence number values always seem to be grouped together when the bolus is generated by a wizard, so we take
   * advantage of that fact.
   *
   * There are also quick boluses and other things that cause boluses to happen without a wizard or cause a wizard
   * to exist without a bolus.  All of these cases must be handled by this code.
   *
   * The basic algorithm is to chug along until we find the first bolus/wizard event.  Then, from there search
   * forward for the other events (if they exist) and keep track of how far we've gone.  We stop the search either
   * when we get a full set of expected bolus events, or we get another bolus event that doesn't match our expectations.
   *
   * We then emit the proper event to the simulator based on what we've seen.
   *
   * We also keep track of the index that we searched up to and short-circuit the logic if we are asked to look at
   * a datum we have already searched through.
   */
  return function (simulator, datum, i, data) {
    if (i < processedIndex) {
      return;
    }

    function findWizard(e) {
      if (e.type === 'wizard') {
        wizard = e;
        return true;
      }
      return false;
    }

    function findBolus(e) {
      if (e.type === 'bolusNormal' || e.type === 'bolusSquare') {
        bolus = e;
        return true;
      }
      return false;
    }

    var parsed = parser(datum);
    if (parsed != null) {

      var wizard = null;
      var bolus = null;

      var findFn = null;
      switch (parsed.type) {
        case 'wizard':
          wizard = parsed;
          findFn = findBolus;
          break;
        case 'bolusNormal':
        case 'bolusSquare':
          bolus = parsed;
          findFn = findWizard;
          break;
        default:
          throw new Error('Unknown type[' + parsed.type + '].');
      }

      // Allow 2 seconds for the reporting of the events to actually occur
      // It has happened that the bolus event that happens from a wizard is a little bit delayed.
      var beforeDate = new Date(Date.parse(parsed.time) + 2000).toISOString();
      var uploadId = parsed.uploadId;
      incrementProcessedIndexUntil(data, i+1, function(e){
        if (uploadId === e.uploadId && e.time <= beforeDate) {
          var retVal = findFn(e);
          if (retVal) {
            ++processedIndex;
          }
          return retVal;
        }
        return true;
      });

      if (bolus == null) {
        if (wizard == null) {
          throw new Error('Didn\'t have a bolus or a wizard, wtf?');
        } else {
          simulator.wizard(cleanEvent(wizard));
          return;
        }
      }

      if (bolus.dualComponent) {
        var normal = null;
        var square = null;

        switch (bolus.type) {
          case 'bolusNormal':
            normal = cleanEvent(bolus);
            incrementProcessedIndexUntil(data, processedIndex, function(e){
              if (uploadId === e.uploadId) {
                var seq = e.uploadSeqNum;
                if (e.type === 'bolusSquare' && e.dualComponent &&
                    numbersInOrderNoGaps(wizard != null ? wizard.uploadSeqNum : null, bolus.uploadSeqNum, seq)) {
                  square = cleanEvent(e);
                  ++processedIndex;
                }
                return true;
              }
              return false;
            });
            break;
          case 'bolusSquare':
            square = cleanEvent(bolus);
            incrementProcessedIndexUntil(data, processedIndex, function(e){
              if (uploadId === e.uploadId) {
                var seq = e.uploadSeqNum;
                if (e.type === 'bolusNormal' && e.dualComponent &&
                    numbersInOrderNoGaps(wizard != null ? wizard.uploadSeqNum : null, bolus.uploadSeqNum, seq)) {
                  normal = cleanEvent(e);
                  ++processedIndex;
                }
                return true;
              }
              return false;
            });
            break;
          default:
            throw new Error('Unknown bolus type[' + bolus.type + ']');
        }
        bolus = cleanEvent(buildBolus(normal, square));
      } else {
        bolus = cleanEvent(bolus);
      }

      if (bolus.normal === bolus.expectedNormal) {
        bolus = _.omit(bolus, 'expectedNormal');
      }

      if (bolus.extended === bolus.expectedExtended) {
        bolus = _.omit(bolus, 'expectedExtended');
      } else {
        bolus.expectedDuration = bolus.duration;
        bolus.duration = Math.round((bolus.extended / (bolus.expectedExtended * 1.0)) * bolus.duration);
      }

      if (bolus.duration === bolus.expectedDuration) {
        bolus = _.omit(bolus, 'expectedDuration');
      }

      if (wizard == null) {
        simulator.bolus(bolus);
      } else {
        simulator.wizard(cleanEvent(wizard), {bolus: _.assign({type: 'bolus'}, bolus)});
      }
    }
  };
};
