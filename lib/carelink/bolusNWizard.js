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

module.exports = function(timezone, model) {
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

  function cleanEvent(bolus) {
    return _.omit(bolus, 'dualComponent', 'type', 'uploadId', 'uploadSeqNum');
  }

  function buildCache(data) {
    datumsBySeqNum = {};

    for (var i = 0; i < data.length; ++i) {
      if (datumsBySeqNum[data[i]['Raw-Upload ID']] == null) {
        var upload = datumsBySeqNum[data[i]['Raw-Upload ID']] = {};
        upload[data[i]['Raw-Seq Num']] = data[i];
      }
      else {
        datumsBySeqNum[data[i]['Raw-Upload ID']][data[i]['Raw-Seq Num']] = data[i];
      }
    }
  }

  function isInCache(parsed) {
    return datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum] != null;
  }

  function removeFromCache(parsed) {
    datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum] = null;
  }

  function makeFindNormalFn() {
    if (common.autoGenModels[model]) {
      return function(bolus) {

      };
    }
    else {
      return function(parsed, i) {
        var obj;
        i = i || 0;
        if (parsed.type === 'bolusSquare') {
          obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - 1];
          if (obj != null) {
            obj = parser(obj);
          }
          if (obj != null && obj.type === 'bolusNormal') {
            return obj;
          }
          else {
            return null;
          }
        }
        if (parsed.type === 'wizard') {
          obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - (1 + i)];
          if (obj != null && obj['Raw-Type'] === 'BolusNormal') {
            obj = parser(obj);
          }
          else {
            obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - (2 + i)];
            obj = obj ? parser(obj) : null;
          }
          if (obj != null && obj.type === 'bolusNormal') {
            // only allow two minutes between wizard and bolus
            if (Math.abs(Date.parse(parsed.time) - Date.parse(obj.time)) > 1000 * 60 * 2) {
              return null;
            }
            if (i !== 0) {
              obj = common.annotateEvent(obj, 'carelink/wizard/long-search');
            }
            return obj;
          }
          else {
            return null;
          }
        }
      };
    }
  }

  function makeFindSquareFn() {
    if (common.autoGenModels[model]) {
      return function(bolus) {

      };
    }
    else {
      return function(parsed, i) {
        var obj;
        i = i || 0;
        if (parsed.type === 'bolusNormal') {
          obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum + 1];
          if (obj != null) {
            obj = parser(obj);
          }
          if (obj != null && obj.type === 'bolusSquare') {
            return obj;
          }
          else {
            return null;
          }
        }
        if (parsed.type === 'wizard') {
          obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - (1 + i)];
          if (obj != null) {
            obj = parser(obj);
          }
          if (obj != null && obj.type === 'bolusSquare') {
            if (i !== 0) {
              obj = common.annotateEvent(obj, 'carelink/wizard/long-search');
            }
            return obj;
          }
          else {
            return null;
          }
        }
      };
    }
  }

  function makeFindWizardFn() {
    if (common.autoGenModels[model]) {
      return function(bolus) {

      };
    }
    else {
      return function(bolus) {
        var obj;
        if (bolus.type === 'bolusNormal') {
          if (bolus.dualComponent) {
            obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 2];
            obj = obj ? parser(obj) : null;
            if (obj == null) {
              obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 3];
              obj = obj ? parser(obj) : null;
              obj = obj ? common.annotateEvent(obj, 'carelink/wizard/long-search') : null;
            }
            if (obj != null && obj.type === 'wizard') {
              return obj;
            }
            else {
              return null;
            }
          }
          else {
            obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 1];
            obj = obj ? parser(obj) : null;
            if (obj == null) {
              obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 2];
              obj = obj ? parser(obj) : null;
              obj = obj ? common.annotateEvent(obj, 'carelink/wizard/long-search') : null;
            }
            if (obj != null && obj.type === 'wizard') {
              return obj;
            }
            else {
              return null;
            }
          }
        }
        if (bolus.type === 'bolusSquare') {
          obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 1];
          if (obj != null) {
            obj = parser(obj);
          }
          if (obj != null && obj.type === 'wizard') {
            return obj;
          }
          else {
            return null;
          }
        }
      };
    }
  }

  function buildBolus(normal, square) {

    if (normal == null && square == null) {
      return null;
    }

    if (normal == null) {
      return _.clone(cleanEvent(square));
    }
    else {
      if (square == null) {
        return _.clone(cleanEvent(normal));
      }
      else {
        return _.assign({}, cleanEvent(square), cleanEvent(normal), {subType: 'dual/square'});
      }
    }
  }

  var datumsBySeqNum = null, findNormal = null, findSquare = null, findWizard = null;

  return function(simulator, datum, i, data) {
    var normal = null, square = null, wizard = null;
    var parsed = parser(datum);

    if (datumsBySeqNum == null) {
      buildCache(data);
    }

    if (findNormal == null) {
      findNormal = makeFindNormalFn();
    }

    if (findSquare == null) {
      findSquare = makeFindSquareFn();
    }

    if (findWizard == null) {
      findWizard = makeFindWizardFn();
    }
    
    if (parsed != null) {
      switch(parsed.type) {
        case 'bolusNormal':
          if (isInCache(parsed)) {
            removeFromCache(parsed);
            normal = cleanEvent(parsed);
            if (parsed.dualComponent) {
              square = findSquare(parsed);
              if (square != null) {
                datumsBySeqNum[square.uploadId][square.uploadSeqNum] = null;
              }
            }
            wizard = findWizard(parsed);
            if (wizard != null) {
              removeFromCache(wizard);
            }
          }
          break;
        case 'bolusSquare':
          if (isInCache(parsed)) {
            removeFromCache(parsed);
            square = cleanEvent(parsed);
            wizard = findWizard(parsed);
            if (wizard != null) {
              removeFromCache(wizard);
            }
          }
          break;
        case 'wizard':
          if (isInCache(parsed)) {
            wizard = parsed;
            normal = findNormal(parsed);
            if (normal != null) {
              removeFromCache(normal);
            }
            square = findSquare(parsed);
            if (square != null) {
              removeFromCache(square);
            }
            if (normal != null || square != null) {
              removeFromCache(parsed);
            }
            else {
              normal = findNormal(parsed, 1);
              if (normal != null) {
                removeFromCache(normal);
              }
              square = findSquare(parsed, 1);
              if (square != null) {
                removeFromCache(square);
              }
              removeFromCache(parsed);
            }
          }
          break;
      }
      var bolus = buildBolus(normal, square);

      if (bolus != null) {
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
        }
        else {
          simulator.wizard(cleanEvent(wizard), {bolus: _.assign({type: 'bolus'}, bolus)});
        }
      }
    }
  };
};