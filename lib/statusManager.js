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

module.exports = function (config) {
  var progress = config.progress;
  var steps = config.steps;

  var stepProgress = function(step, stepPercentage, isFirstUpload) {
    var stepName = steps[step].name;
    var range = steps[step].max - steps[step].min;
    var totalPercentage = steps[step].min + Math.floor(range * stepPercentage / 100.0);
    progress(stepName, totalPercentage, isFirstUpload);
  };

  return {
    progressForStep: function(step) {
      return stepProgress.bind(this, step);
    }
  };
};
