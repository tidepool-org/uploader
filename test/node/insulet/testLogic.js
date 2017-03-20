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

/* global describe, it */

var _ = require('lodash');
var expect = require('salinity').expect;

var logic = require('../../../lib/drivers/insulet/objectBuildingLogic');

describe('objectBuildingLogic', function() {
  describe('calculateNetRecommendation', function() {
    var wizDetails = {
      carb_bolus_units_suggested: 5.0,
      corr_units_suggested: 2.0,
      meal_units_iob: 0.0,
      corr_units_iob: 1.5,
      current_bg: 150
    };

    it('should be a function', function() {
      expect(logic.calculateNetRecommendation).to.exist;
      expect(typeof logic.calculateNetRecommendation).to.equal('function');
    });

    it('should subtract total IOB from suggested correction when a BG is input', function() {
      expect(logic.calculateNetRecommendation(wizDetails)).to.equal(5.5);
    });

    it('should not take IOB into account if no BG value was input', function() {
      var details = _.assign({}, wizDetails, {current_bg: 65535});
      expect(logic.calculateNetRecommendation(details)).to.equal(5.0);
    });

    it('should subtract leftover suggestion from bolus when correction IOB is >= suggested correction', function() {
      var details = _.assign({}, wizDetails, {corr_units_iob: 2.5});
      expect(logic.calculateNetRecommendation(details)).to.equal(4.5);
    });

    it('should subtract total IOB from bolus if meal IOB is < suggested correction', function() {
      var details = _.assign({}, wizDetails, {meal_units_iob: 0.5});
      expect(logic.calculateNetRecommendation(details)).to.equal(5.0);
    });

    it('should add a negative correction to the total if present', function() {
      var details = _.assign({}, wizDetails, {current_bg: 50, corr_units_suggested: -1.0});
      expect(logic.calculateNetRecommendation(details)).to.equal(2.5);
    });

    it('should never recommended a net negative bolus', function() {
      var details = _.assign({}, wizDetails, {meal_units_iob: 1.0, carb_bolus_units_suggested: 0.0});
      expect(logic.calculateNetRecommendation(details)).to.equal(0.0);
    });
  });
});
