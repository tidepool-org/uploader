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

 Number.prototype.toFixedNumber = function(significant){
   var pow = Math.pow(10,significant);
   return +( Math.round(this*pow) / pow );
 };

 var roundAndNotNegative = function(number) {
   if(number < 0) {
     return 0;
   }
   // Calculated total units are rounded to the nearest .05 units
   return (Math.ceil(number*20 - 0.5)/20).toFixedNumber(2);
 };

var withinTarget = function(wizDetails) {
  if(Math.abs(wizDetails.bg - wizDetails.target_bg) < wizDetails.bg_delta) {
   return true;
  }
  else {
   return false;
  }
};

var calculateCarbRecommendation = function(wizDetails) {
  return wizDetails.carb_amount / wizDetails.carb_ratio;
};

var calculateCorrectionRecommendation = function(wizDetails) {
  if(!withinTarget(wizDetails)) {
    return (wizDetails.bg - wizDetails.target_bg) / wizDetails.isf;
  }
  else {
    return 0;
  }
};

var calculateNetRecommendation = function(wizDetails, bgOrCarbTriggered) {

  if (bgOrCarbTriggered === 'bg')  {
    // ezBG only
    var correction = calculateCorrectionRecommendation(wizDetails);
    if (wizDetails.configuration.iobEnabled) {
      // IOB enabled
      if (withinTarget(wizDetails)) {
        return roundAndNotNegative(correction);
      }
      else {
        if ((wizDetails.bg - wizDetails.target_bg) > 0) {
          // above target, subtract IOB from correction bolus
          return roundAndNotNegative(correction - wizDetails.iob);
        }
        else {
          // below target, IOB not subtracted as it's ezBG only
          return roundAndNotNegative(correction);
        }
      }
    }
    else {
      // IOB disabled
      return roundAndNotNegative(correction);
    }
  }

  if (wizDetails.configuration.correctionAdded === false) {
    // ezCarb only
    return roundAndNotNegative(calculateCarbRecommendation(wizDetails));
  }

  // ezCarb with correction
  if (wizDetails.configuration.iobEnabled) {
    //IOB enabled
    if (withinTarget(wizDetails)) {
      //IOB not subtracted; just add food bolus and correction bolus
      return roundAndNotNegative(calculateCarbRecommendation(wizDetails) + calculateCorrectionRecommendation(wizDetails));
    }
    else {
      if ((wizDetails.bg - wizDetails.target_bg) > 0) {
        // above target, subtract IOB from correction bolus
        var correctionMinIOB =  calculateCorrectionRecommendation(wizDetails) - wizDetails.iob;
        return roundAndNotNegative(calculateCarbRecommendation(wizDetails) + Math.max(0,correctionMinIOB));
      }
      else {
        // below target, subtract IOB from food bolus
        var foodBolusMinIOB = calculateCarbRecommendation(wizDetails) - wizDetails.iob;
        return roundAndNotNegative(calculateCorrectionRecommendation(wizDetails) + Math.max(0,foodBolusMinIOB));
      }
    }
  }
  else {
    // IOB disabled
    return roundAndNotNegative(calculateCarbRecommendation(wizDetails) + calculateCorrectionRecommendation(wizDetails));
  }
};

exports.calculateCarbRecommendation = calculateCarbRecommendation;
exports.calculateCorrectionRecommendation = calculateCorrectionRecommendation;
exports.calculateNetRecommendation = calculateNetRecommendation;
