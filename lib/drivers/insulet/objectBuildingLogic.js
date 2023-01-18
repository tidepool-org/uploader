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

import common from './common';

module.exports = {
  calculateNetRecommendation: (wizDetails) => {
    let total = wizDetails.carb_bolus_units_suggested;
    // only consider IOB (and add a correction) if there's a BG input
    if (wizDetails.current_bg !== null) {
      if (wizDetails.meal_units_iob < wizDetails.corr_units_suggested) {
        total += wizDetails.corr_units_suggested - wizDetails.meal_units_iob;
      } else if (wizDetails.corr_units_suggested < 0) {
        total += wizDetails.corr_units_suggested;
      }
      total -= wizDetails.corr_units_iob;
    }
    const correctPrecision = common.fixFloatingPoint(total, 2);
    return correctPrecision < 0 ? 0.0 : correctPrecision;
  },
};
