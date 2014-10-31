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
          type: 'bolus',
          subType: parsing.toLower('Bolus Type'),
          normal: parsing.asNumber('Bolus Volume Delivered (U)'),
          expectedNormal: parsing.asNumber('Bolus Volume Selected (U)'),
          uploadId: parsing.extract('Raw-Upload ID'),
          uploadSeqNum: parsing.asNumber('Raw-Seq Num')
        }
      ],
      'BolusSquare': [
        common.makeCommonVals(timezone),
        {
          type: 'bolus',
          subType: parsing.toLower('Bolus Type'),
          extended: parsing.asNumber('Bolus Volume Delivered (U)'),
          expectedExtended: parsing.asNumber('Bolus Volume Selected (U)'),
          duration: parsing.asNumber(['Raw-Values', 'DURATION']),
          uploadId: parsing.extract('Raw-Upload ID'),
          uploadSeqNum: parsing.asNumber('Raw-Seq Num')
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
            correction: parsing.asNumber('BWZ Correction Estimate (U)')
          },
          payload: {},
          units: parsing.map(parsing.extract(['Raw-Values', 'BG_UNITS']), common.normalizeBgUnits)
        }
      ]
    }
  );

  var processedIndex = 0;

  function setupLookups(lookups, expectedEvents, wizardId) {
    lookups.wizard = wizardId;
    lookups.square = wizardId - 1;
    lookups.normal = wizardId - 2;

    expectedEvents[lookups.wizard] = null;
    expectedEvents[lookups.square] = null;
    expectedEvents[lookups.normal] = null;
  }

  function buildBolus(normal, square) {
    if (normal == null && square == null) {
      return null;
    }

    if (normal != null && normal.subType === 'square') {
      square = normal;
      normal = null;
    }

    if (normal != null && normal.subType === 'dual/square') {
      throw new Error(util.format('normal event at[%s] was a dual/square, that\'s unexpected', normal.time));
    }

    var retVal = null;
    if (normal == null) {
      if (square != null) {
        retVal = _.assign({}, square, {subType: 'square'});
      }
    } else {
      if (square == null) {
        retVal = _.assign({}, normal, {subType: 'normal'});
      } else {
        retVal = _.assign({}, square, normal, {subType: 'dual/square'});
      }
    }

    if (retVal == null) {
      return null;
    }

    if (retVal.normal === retVal.expectedNormal) {
      retVal = _.omit(retVal, 'expectedNormal');
    }

    if (retVal.extended === retVal.expectedExtended) {
      retVal = _.omit(retVal, 'expectedExtended');
    } else {
      retVal.expectedDuration = retVal.duration;
      retVal.duration = Math.floor((retVal.extended / (retVal.expectedExtended * 1.0)) * retVal.duration);
    }

    if (retVal.duration === retVal.expectedDuration) {
      retVal = _.omit(retVal, 'expectedDuration');
    }

    return retVal;
  }

  /**
   * Handles processing of wizard and bolus objects from Carelink CSV.  These objects are pretty annoying in that
   * they don't happen in chronological order.  There is an expected "uploadSeqNum" order that is always out of
   * chronological order in the case of dual-wave boluses.
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

    var parsed = parser(datum);
    if (parsed != null) {
      var lookup = {};
      var expectedEvents = {};
      var toStore = _.omit(parsed, 'uploadId', 'uploadSeqNum');
      switch (parsed.type) {
        case 'wizard':
          setupLookups(lookup, expectedEvents, parsed.uploadSeqNum);
          expectedEvents[lookup.wizard] = toStore;
          break;
        case 'bolus':
          switch (parsed.subType) {
            case 'normal':
              setupLookups(lookup, expectedEvents, parsed.uploadSeqNum + 1);
              expectedEvents[lookup.normal] = toStore;
              break;
            case 'square':
              setupLookups(lookup, expectedEvents, parsed.uploadSeqNum + 1);
              expectedEvents[lookup.square] = toStore;
              break;
            case 'dual/normal':
              setupLookups(lookup, expectedEvents, parsed.uploadSeqNum + 1);
              expectedEvents[lookup.normal] = toStore;
              break;
            case 'dual/square':
              setupLookups(lookup, expectedEvents, parsed.uploadSeqNum + 2);
              expectedEvents[lookup.square] = toStore;
              break;
            default:
              console.log('Unknown bolus type[' + parsed.subType + '].');
              return;
          }
          break;
        default:
      }

      var uploadId = parsed.uploadId;

      for (processedIndex = i+1; processedIndex < data.length; ++processedIndex) {
        parsed = parser(data[processedIndex]);
        if (parsed != null) {
          if (uploadId !== parsed.uploadId || expectedEvents[parsed.uploadSeqNum] === undefined) {
            // Got an event for another bolus, so stop searching
            break;
          }
          expectedEvents[parsed.uploadSeqNum] = _.omit(parsed, 'uploadId', 'uploadSeqNum');
        }
      }

      var wizard = expectedEvents[lookup.wizard];
      var bolus = buildBolus(expectedEvents[lookup.normal], expectedEvents[lookup.square]);
      if (wizard == null) {
        if (bolus == null) {
          throw new Error('Didn\'t have a bolus or a wizard, wtf?');
        } else {
          simulator.bolus(bolus);
        }
      } else {
        if (bolus == null) {
          simulator.wizard(wizard);
        } else {
          simulator.wizard(wizard, {bolus: bolus});
        }
      }
    }
  };
};
