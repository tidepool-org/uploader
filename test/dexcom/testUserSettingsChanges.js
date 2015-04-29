/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

var userSettingsChanges = require('../../lib/dexcom/userSettingsChanges');

describe('userSettingsChanges.js', function() {
	it('is a function', function() {
		expect(typeof userSettingsChanges).to.equal('function');
	});

	it('returns an object with `timeChanges` and `settingsChange` attributes', function() {
		var res = userSettingsChanges([]);
		expect(typeof res).to.equal('object');
		expect(res.timeChanges).to.exist;
		expect(res.settingChanges).to.exist;
	});
});