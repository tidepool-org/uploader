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

var RAW_TYPE = 'Raw-Type', RAW_VALUES = 'Raw-Values';
var RAW_UPLOAD_ID = 'Raw-Upload ID', RAW_SEQ_NUM = 'Raw-Seq Num';

var BOLUS_DELIVERED = 'Bolus Volume Delivered (U)';
var BOLUS_SELECTED = 'Bolus Volume Selected (U)';

var BWZ_CARB_RATIO = 'BWZ Carb Ratio (grams)';
var BWZ_IOB = 'BWZ Active Insulin (U)';

var BWZ_REC_FOOD = 'BWZ Food Estimate (U)';
var BWZ_REC_CORRECTION = 'BWZ Correction Estimate (U)';
var BWZ_REC_NET = 'BWZ Estimate (U)';

var BOLUS_NORMAL = 'BolusNormal', BOLUS_SQUARE = 'BolusSquare';
var WIZARD = 'BolusWizardBolusEstimate';

var RV_KEYS = {
  BG_UNITS: 'BG_UNITS',
  CARB_INPUT: 'CARB_INPUT',
  DURATION: 'DURATION',
  IS_DUAL_COMPONENT: 'IS_DUAL_COMPONENT'
};

module.exports = function(opts) {
  var commonParser = common.makeCommonVals();

  var parserSchema = {};
  parserSchema[BOLUS_NORMAL] = [
    common.makeCommonVals(),
    {
      type: 'bolusNormal',
      subType: 'normal',
      normal: parsing.asNumber(BOLUS_DELIVERED),
      expectedNormal: parsing.asNumber(BOLUS_SELECTED),
      uploadId: parsing.extract(RAW_UPLOAD_ID),
      uploadSeqNum: parsing.asNumber(RAW_SEQ_NUM),
      dualComponent: parsing.asBoolean([RAW_VALUES, RV_KEYS.IS_DUAL_COMPONENT])
    }
    ];
  parserSchema[BOLUS_SQUARE] = [
    common.makeCommonVals(),
    {
      type: 'bolusSquare',
      subType: 'square',
      extended: parsing.asNumber(BOLUS_DELIVERED),
      expectedExtended: parsing.asNumber(BOLUS_SELECTED),
      duration: parsing.asNumber([RAW_VALUES, RV_KEYS.DURATION]),
      uploadId: parsing.extract(RAW_UPLOAD_ID),
      uploadSeqNum: parsing.asNumber(RAW_SEQ_NUM),
      /**
       * NB: The IS_DUAL_COMPONENT field is only reliable on `DualNormal`-typed events.
       * (This is because when a bolus is entered via the dual-wave bolus menu, but
       * has a 0% normal component, the square component will have IS_DUAL_COMPONENT=true
       * but no `DualNormal` event will appear in the data!)
       * We parse it here to avoid undefined errors, but all code in this module
       * should avoid making reference to the `dualComponent` property on square-wave
       * boluses (or square-wave components of boluses).
       */
      dualComponent: parsing.asBoolean([RAW_VALUES, RV_KEYS.IS_DUAL_COMPONENT])
    }
  ];
  parserSchema[WIZARD] = [
    common.makeCommonVals(),
    {
      type: 'wizard',
      uploadId: parsing.extract(RAW_UPLOAD_ID),
      uploadSeqNum: parsing.asNumber(RAW_SEQ_NUM),
      bgInput: parsing.asNumber(opts.colNames.bgInput),
      bgTarget: {
        high: parsing.asNumber(opts.colNames.bgTargetHigh),
        low: parsing.asNumber(opts.colNames.bgTargetLow)
      },
      carbInput: parsing.asNumber([RAW_VALUES, RV_KEYS.CARB_INPUT]),
      insulinCarbRatio: parsing.asNumber(BWZ_CARB_RATIO),
      insulinOnBoard: parsing.asNumber(BWZ_IOB),
      insulinSensitivity: parsing.asNumber(opts.colNames.insulinSensitivity),
      recommended: {
        carb: parsing.asNumber(BWZ_REC_FOOD),
        correction: parsing.asNumber(BWZ_REC_CORRECTION),
        net: parsing.asNumber(BWZ_REC_NET)
      },
      payload: {},
      units: parsing.map(parsing.extract([RAW_VALUES, RV_KEYS.BG_UNITS]), common.normalizeBgUnits)
    }
    ];

  var parser = common.makeParser(parserSchema);

  /**
   * We use some fields in the data processing that are not part of our data model,
   * so they are removed prior to the next steps (simulator, then storage).
   */
  function cleanEvent(bolus) {
    return _.omit(bolus, 'dualComponent', 'type', 'uploadId', 'uploadSeqNum');
  }

  /**
   * Bolus (components) and wizard events in the CareLink CSV data are not explicitly connected
   * together via ID attributes and occur in different `uploadSeqNum` sequences depending
   * on the model of the pump (*22 series vs. "modern" pumps - i.e., *23 series and later).
   *
   * The general strategy here is to build a hash of all bolus (component) and wizard events
   * keyed by `uploadSeqNum` (within an `uploadId`), then as we're traversing the data
   * we try to handle each event as it comes, removing it from the hash *as well as any
   * events we end up handling in conjunction with it* before we move on.
   *
   * We also traverse all the data on the first call of this processor and cache the results
   * in the cachedObjects array, because otherwise we can end up with ordering paradoxes
   * when passing the resulting wizard and bolus objects to the simulator.
   */
  function buildSeqNumHash(data) {
    datumsBySeqNum = {};
    var bolusNWizTypes = {};
    bolusNWizTypes[BOLUS_NORMAL] = true;
    bolusNWizTypes[BOLUS_SQUARE] = true;
    bolusNWizTypes[WIZARD] = true;

    for (var i = 0; i < data.length; ++i) {
      if (bolusNWizTypes[data[i][RAW_TYPE]] === true) {
        if (datumsBySeqNum[data[i][RAW_UPLOAD_ID]] == null) {
          var upload = datumsBySeqNum[data[i][RAW_UPLOAD_ID]] = {};
          upload[data[i][RAW_SEQ_NUM]] = data[i];
        }
        else {
          datumsBySeqNum[data[i][RAW_UPLOAD_ID]][data[i][RAW_SEQ_NUM]] = data[i];
        }
      }
    }
  }

  function isInHash(parsed) {
    return datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum] != null;
  }

  function removeFromHash(parsed) {
    datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum] = null;
  }

  /**
   * We use the model/device identifier in the data to determine which function to use
   * to find a (potential) component normal bolus when given a square or wizard event.
   *
   * Generally speaking, normals follow squares and precede wizards wrt `uploadSeqNum`
   * for the older model pumps, and precede *both* squares and wizards wrt `uploadSeqNum`
   * for the "modern" pumps.
   */
  function makeFindNormalFn() {
    if (common.autoGenModels[opts.model]) {
      return function(parsed, i) {
        var obj;
        i = i || 0;
        if (parsed.type === 'bolusSquare') {
          obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum + 1];
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
        else if (parsed.type === 'wizard') {
          obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - (1 + i)];
          if (obj != null && obj[RAW_TYPE] === BOLUS_NORMAL) {
            obj = parser(obj);
          }
          else {
            obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - (2 + i)];
            obj = obj ? parser(obj) : null;
          }
          if (obj != null && obj.type === 'bolusNormal') {
            // only allow five minutes between wizard and bolus
            if (Math.abs(Date.parse(parsed.time) - Date.parse(obj.time)) > 1000 * 60 * 5) {
              return null;
            }
            if (i !== 0) {
              obj = annotate.annotateEvent(obj, 'carelink/wizard/long-search');
            }
            return obj;
          }
          // return a wizard if we find it to help short-circuit a long search
          // but only if we're not already in a long search (i.e., i must be 0)
          else if (obj != null && obj.type === 'wizard' && i === 0) {
            return obj;
          }
          else {
            return null;
          }
        }
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
        else if (parsed.type === 'wizard') {
          obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - (1 + i)];
          if (obj != null && obj[RAW_TYPE] === BOLUS_NORMAL) {
            obj = parser(obj);
          }
          else {
            obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - (2 + i)];
            obj = obj ? parser(obj) : null;
            // conduct an embedded long search; inspired by a true story
            // NB: this is intentionally not replicated in the older model pumps logic
            // because of the difference in sequencing expectations there
            if (obj == null) {
              obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - (3 + i)];
              obj = obj ? parser(obj) : null;
              if (obj != null) {
                obj = annotate.annotateEvent(obj, 'carelink/wizard/long-search');
              }
            }
          }
          if (obj != null && obj.type === 'bolusNormal') {
            // only allow five minutes between wizard and bolus
            if (Math.abs(Date.parse(parsed.time) - Date.parse(obj.time)) > 1000 * 60 * 5) {
              return null;
            }
            if (i !== 0) {
              obj = annotate.annotateEvent(obj, 'carelink/wizard/long-search');
            }
            return obj;
          }
          // return a wizard if we find it to help short-circuit a long search
          // but only if we're not already in a long search (i.e., i must be 0)
          else if (obj != null && obj.type === 'wizard' && i === 0) {
            return obj;
          }
          else {
            return null;
          }
        }
      };
    }
  }

  /**
   * We use the model/device identifier in the data to determine which function to use
   * to find a (potential) component square bolus when given a normal or wizard event.
   *
   * Generally speaking, squares precede *both* normals and wizards wrt `uploadSeqNum`
   * for the older model pumps, while they follow normals and precede wizards for the
   * "modern" pumps.
   */
  function makeFindSquareFn() {
    if (common.autoGenModels[opts.model]) {
      return function(parsed, i) {
        var obj;
        i = i || 0;
        if (parsed.type === 'bolusNormal') {
          obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - 1];
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
        else if (parsed.type === 'wizard') {
          obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - (2 + i)];
          if (obj != null) {
            obj = parser(obj);
          }
          if (obj != null && obj.type === 'bolusSquare') {
            // only allow five minutes between wizard and bolus
            if (Math.abs(Date.parse(parsed.time) - Date.parse(obj.time)) > 1000 * 60 * 5) {
              return null;
            }
            if (i !== 0) {
              obj = annotate.annotateEvent(obj, 'carelink/wizard/long-search');
            }
            return obj;
          }
          // return a wizard if we find it to help short-circuit a long search
          // but only if we're not already in a long search (i.e., i must be 0)
          else if (obj != null && obj.type === 'wizard' && i === 0) {
            return obj;
          }
          else {
            return null;
          }
        }
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
          else {
            obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum + 2];
            obj = obj ? parser(obj) : null;
            obj = obj ? annotate.annotateEvent(obj, 'carelink/wizard/long-search') : null;
          }
          if (obj != null && obj.type === 'bolusSquare') {
            return obj;
          }
          else {
            return null;
          }
        }
        else if (parsed.type === 'wizard') {
          obj = datumsBySeqNum[parsed.uploadId][parsed.uploadSeqNum - (1 + i)];
          if (obj != null) {
            obj = parser(obj);
          }
          if (obj != null && obj.type === 'bolusSquare') {
            // only allow five minutes between wizard and bolus
            if (Math.abs(Date.parse(parsed.time) - Date.parse(obj.time)) > 1000 * 60 * 5) {
              return null;
            }
            if (i !== 0) {
              obj = annotate.annotateEvent(obj, 'carelink/wizard/long-search');
            }
            return obj;
          }
          // return a wizard if we find it to help short-circuit a long search
          // but only if we're not already in a long search (i.e., i must be 0)
          else if (obj != null && obj.type === 'wizard' && i === 0) {
            return obj;
          }
          else {
            return null;
          }
        }
      };
    }
  }

  /**
   * We use the model/device identifier in the data to determine which function to use
   * to find a (potential) wizard event when given a normal or square bolus (component).
   *
   * Generally speaking, wizards *always* follow bolus events wrt to `uploadSeqNum`, but
   * their ordering with respect to normal bolus components, on the one hand, and squares,
   * on the other, varies depending on the generation of device. (See comments on 
   * makeFindNormalFn and makeFindSquareFn above.)
   */
  function makeFindWizardFn() {
    if (common.autoGenModels[opts.model]) {
      return function(bolus) {
        var obj;
        if (bolus.type === 'bolusNormal') {
          obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 1];
          obj = obj ? parser(obj) : null;
          if (obj == null) {
            obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 2];
            obj = obj ? parser(obj) : null;
            obj = obj ? annotate.annotateEvent(obj, 'carelink/wizard/long-search') : null;
          }
          if (obj != null && obj.type === 'wizard') {
            return obj;
          }
          else {
            return null;
          }
        }
        else if (bolus.type === 'bolusSquare') {
          obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 1];
          if (obj != null) {
            obj = parser(obj);
          }
          if (obj != null && obj.type === 'wizard') {
            // only allow five minutes between wizard and bolus
            if (Math.abs(Date.parse(bolus.time) - Date.parse(obj.time)) > 1000 * 60 * 5) {
              return null;
            }
            return obj;
          }
          else {
            return null;
          }
        }
      };
    }
    else {
      return function(bolus) {
        var obj;
        if (bolus.type === 'bolusNormal') {
          if (bolus.dualComponent) {
            obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 2];
            obj = obj && obj[RAW_TYPE] === WIZARD ? parser(obj) : null;
            if (obj == null) {
              obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 3];
              obj = obj ? parser(obj) : null;
              obj = obj ? annotate.annotateEvent(obj, 'carelink/wizard/long-search') : null;
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
            obj = obj && obj[RAW_TYPE] === WIZARD ? parser(obj) : null;
            if (obj == null) {
              obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 2];
              obj = obj ? parser(obj) : null;
              obj = obj ? annotate.annotateEvent(obj, 'carelink/wizard/long-search') : null;
            }
            if (obj != null && obj.type === 'wizard') {
              return obj;
            }
            else {
              return null;
            }
          }
        }
        else if (bolus.type === 'bolusSquare') {
          obj = datumsBySeqNum[bolus.uploadId][bolus.uploadSeqNum + 1];
          if (obj != null) {
            obj = parser(obj);
          }
          if (obj != null && obj.type === 'wizard') {
            // only allow five minutes between wizard and bolus
            if (Math.abs(Date.parse(bolus.time) - Date.parse(obj.time)) > 1000 * 60 * 5) {
              return null;
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
        // TODO: delete after conclusion of Jaeb study
        common.mergeJaebPayloads(normal, square);
        // TODO: end deletion
        return _.assign({}, cleanEvent(square), cleanEvent(normal), {subType: 'dual/square'});
      }
    }
  }

  var datumsBySeqNum = null, findNormal = null, findSquare = null, findWizard = null;
  var pointer = 0, cachedObjects = null;

  function buildCache(data) {
    cachedObjects = [];
    for (var i = 0; i < data.length; ++i) {
      var normal = null, square = null, wizard = null;
      var parsed = parser(data[i]);

      if (datumsBySeqNum == null) {
        buildSeqNumHash(data);
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
      
      // if parsed *is* null, we're just in a row of the CSV
      // that isn't relevant to this processor
      // hence the lack of an `else` condition
      if (parsed != null) {
        switch(parsed.type) {
          case 'bolusNormal':
            // no `else` b/c we may have processed this event out-of-order
            // and removed it from the hash already
            if (isInHash(parsed)) {
              removeFromHash(parsed);
              normal = cleanEvent(parsed);
              if (parsed.dualComponent) {
                square = findSquare(parsed);
                if (square != null) {
                  datumsBySeqNum[square.uploadId][square.uploadSeqNum] = null;
                }
                else {
                  normal = annotate.annotateEvent(normal, 'carelink/bolus/missing-square-component');
                }
              }
              wizard = findWizard(parsed);
              if (wizard != null) {
                removeFromHash(wizard);
              }
            }
            break;
          case 'bolusSquare':
            // no `else` b/c we may have processed this event out-of-order
            // and removed it from the hash already
            if (isInHash(parsed)) {
              removeFromHash(parsed);
              square = cleanEvent(parsed);
              wizard = findWizard(parsed);
              if (wizard != null) {
                removeFromHash(wizard);
              }
            }
            break;
          case 'wizard':
            // no `else` b/c we may have processed this event out-of-order
            // and removed it from the hash already
            if (isInHash(parsed)) {
              wizard = parsed;
              normal = findNormal(parsed);
              if (normal != null) {
                if (normal.type === 'bolusNormal') {
                  removeFromHash(normal);
                }
                // short circuit before even attempting a long search
                // if what we found is another wizard
                else if (normal.type === 'wizard') {
                  removeFromHash(parsed);
                  normal = null;
                  break;
                }
              }
              square = findSquare(parsed);
              if (square != null) {
                if (square.type === 'bolusSquare') {
                  removeFromHash(square);
                }
                // short circuit before even attempting a long search
                // if what we found is another wizard
                else if (square.type === 'wizard') {
                  removeFromHash(parsed);
                  square = null;
                  break;
                }
              }
              if (normal != null || square != null) {
                removeFromHash(parsed);
              }
              // because other events (like alarms) can sometimes intervene between
              // a wizard and bolus components, we will try to search one index further
              // for such events if we don't find any
              else {
                normal = findNormal(parsed, 1);
                if (normal != null) {
                  removeFromHash(normal);
                }
                square = findSquare(parsed, 1);
                if (square != null) {
                  removeFromHash(square);
                }
                removeFromHash(parsed);
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
            cachedObjects.push(bolus);
          }
          else {
            var bolusToSimulate = bolus;
            var wizardtoSimulate = cleanEvent(wizard);
            wizardtoSimulate.bolus = _.assign({type: 'bolus'}, bolus);
            if (wizard.time <= bolus.time) {
              cachedObjects.push(wizardtoSimulate);
              cachedObjects.push(bolusToSimulate);
            }
            else {
              throw new Error('Unexpected wizard following bolus at time[' + wizardtoSimulate.time + ']');
            }
          }
        }
      }
    }

    cachedObjects = _.sortBy(cachedObjects, 'time');
  }

  return function(simulator, datum, i, data) {
    if (cachedObjects == null) {
      buildCache(data);
    }

    var obj = commonParser(datum);
    while (pointer < cachedObjects.length && obj.time >= cachedObjects[pointer].time ) {
      if (cachedObjects[pointer].bolus != null) {
        simulator.wizard(cachedObjects[pointer]);
      }
      else {
        simulator.bolus(cachedObjects[pointer]);
      }
      ++pointer;
    }
  };
};