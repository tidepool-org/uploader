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

// TODO: pick one of the two options below after testing thoroughly

import _ from 'lodash';
//import regedit from 'regedit';
import winreg from 'winreg';

export function checkVersion(dispatch) {
/*
  var software;
  regedit.list('HKLM\\SYSTEM\\DriverDatabase\\DriverPackages',
    function(err, result) {
      software = result['HKLM\\SYSTEM\\DriverDatabase\\DriverPackages'].keys;
      var filtered = _.filter(software, function(name){
        return _.startsWith(name, 'tidepool');
      });
      var tidepoolPaths = _.map(filtered, function(key) { return 'HKLM\\SYSTEM\\DriverDatabase\\DriverPackages\\' + key; });
      regedit.list(tidepoolPaths, function(err, result) {
        _.forEach(result, function(regvalues){
          var versionValue = regvalues.values.Version.value;
          console.log([versionValue[38],versionValue[36],versionValue[34],versionValue[32]].join('.'));
        });
      });
    }
  );
*/
  var regKey = winreg({
    hive: winreg.HKLM,
    key: '\\SYSTEM\\DriverDatabase\\DriverPackages'
  });

  regKey.keys(function(err, items){
    var filtered = _.filter(items, function(item){
      return _.startsWith(item.key.split('\\').pop(), 'tidepool');
    });
    _.each(filtered, function(tidepoolKey){
      console.log(tidepoolKey.key);
      tidepoolKey.values(function(err, values){
        _.each(values, function(value){
          if(value.name === 'Version'){
            console.log('Driver version: ', [value.value[77], value.value[73], value.value[69], value.value[65]].join('.'));
          }
        });
      });
    });
  });
}
