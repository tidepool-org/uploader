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

var $ = require('jquery');

module.exports = function (config) {
  var cfg = config;
  var statuses = cfg.steps;

  var theBar = cfg.progress_bar; // the ID of the bar that should be set to a value
  var theStatus = cfg.status_text;

  function progress (msg, pctg) {
    // console.log('Progress: %s -- %d', msg, pctg);
    $(theStatus).html(msg);
    $(theBar).css('width', pctg+'%').attr('aria-valuenow', pctg).text(pctg + '%');
  }

  function showProgressBar (bar, status) {
    if (bar) {
      theBar = bar;
    }
    if (status) {
      theStatus = status;
    }
    // $('#progress_bar').show();
    $('#logoStatic').hide();
    $('#logoAnimated').show();
  }

  function hideProgressBar () {
    // $('#progress_bar').hide();
    $(theStatus).html('Finished.');
    $('#logoStatic').show();
    $('#logoAnimated').hide();
  }

  var setStatus = function(stage, pct) {
    var msg = statuses[stage].name;
    var range = statuses[stage].max - statuses[stage].min;
    var displayPctg = statuses[stage].min + Math.floor(range * pct / 100.0);
    progress(msg, displayPctg);
  };

  return {
    showProgressBar: showProgressBar,
    hideProgressBar: hideProgressBar,
    progress: progress,
    statf: function(stage) {
      return setStatus.bind(this, stage);
    }
  };
};