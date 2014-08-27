var $ = require('jquery');

module.exports = function (config) {
  var progress = function(msg, pctg) {
    // console.log('Progress: %s -- %d', msg, pctg);
    $('#progressbar').show();
    $('#progressbar').progressbar('option', 'value', pctg);
    $('.progress-label').text(msg);
  };

  var hideProgressBar = function() {
    $('#progressbar').hide();
  };

  var cfg = config;
  if (cfg.progress) {
    progress = cfg.progress;
  }
  var statuses = cfg.steps;

  var setStatus = function(stage, pct) {
    var msg = statuses[stage].name;
    var range = statuses[stage].max - statuses[stage].min;
    var displayPctg = statuses[stage].min + Math.floor(range * pct / 100.0);
    progress(msg, displayPctg);
  };

  return {
    hideProgressBar: hideProgressBar,
    statf: function(stage) {
      return setStatus.bind(this, stage);
    }
  };
};