/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015-2016, Tidepool Project
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

import _ from 'lodash';
import regedit from 'regedit';

export function checkVersion() {
  var software;
  regedit.list('HKLM\\SYSTEM\\DriverDatabase\\DriverPackages',
  	function(err, result) {
  		software = result['HKLM\\SYSTEM\\DriverDatabase\\DriverPackages'].keys;
  		var filtered = _.filter(software, function(name){
  			return _.startsWith(name, 'tidepool');
  		});
  		var tandemPaths = _.map(filtered, function(key) { return 'HKLM\\SYSTEM\\DriverDatabase\\DriverPackages\\' + key; });
  		regedit.list(tandemPaths, function(err, result) {
  			_.forEach(result, function(regvalues){
  				var versionValue = regvalues.values.Version.value;
  				console.log([versionValue[38],versionValue[36],versionValue[34],versionValue[32]].join('.'));
  			});
  		});
  	}
  );
}
