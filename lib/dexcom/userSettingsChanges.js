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

var _ = require('lodash');

var sundial = require('sundial');

module.exports = function(settings, opts) {
	settings = settings || [];
	settings = _.sortBy(settings, function(rec) { return rec.systemSeconds; });

	var timeChanges = [], lastDisplayOffset = null;

	for (var i = 0; i < settings.length; ++i) {
		var rec = settings[i];
		if (rec.internalTime.slice(0,4) !== '2009') {
			if (rec.displayOffset !== lastDisplayOffset) {
				var newDate = new Date(rec.systemTimeMsec + 1000 * rec.displayOffset);
				var deviceTimeFrom = sundial.formatDeviceTime(new Date(rec.systemTimeMsec + 1000 * lastDisplayOffset));
				var change = opts.builder.makeDeviceMetaTimeChange()
					.with_change({
						from: deviceTimeFrom,
						to: sundial.formatDeviceTime(newDate),
						agent: 'manual'
					})
					.with_deviceTime(deviceTimeFrom)
					.set('index', rec.systemSeconds)
					.set('jsDate', newDate)
					.with_payload({
						systemSeconds: rec.systemSeconds,
						oldDisplayOffset: lastDisplayOffset,
						newDisplayOffset: rec.displayOffset
					});
				timeChanges.push(change);
			}
			lastDisplayOffset = rec.displayOffset;
		}
	}
	// first "change" is not a change
	timeChanges.shift();

	return {
		timeChanges: timeChanges,
		settingChanges: []
	};
};