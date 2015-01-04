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

module.exports = {
  'DexcomG4': {
    getName: function(device) {
      return 'Dexcom CGM';
    },
    getDetail: function(device) {
      var detail = 'Dexcom G4';
      if (device.serialNumber) {
        detail = detail + '<br>Serial # ' + device.serialNumber;
      }
      return detail;
    }
  },
  'OneTouchMini': {
    getName: function(device) {
      return 'OneTouch Mini BGM';
    },
    getDetail: function(device) {
      var detail = 'OneTouch Mini';
      if (device.serialNumber) {
        detail = detail + '<br>Serial # ' + device.serialNumber;
      }
      return detail;
    }
  },
  'AbbottFreeStyle': {
    getName: function(device) {
      return 'Abbott FreeStyle Precision Xtra BGM';
    },
    getDetail: function(device) {
      var detail = 'FreeStyle Precision Xtra';
      if (device.serialNumber) {
        detail = detail + '<br>Serial # ' + device.serialNumber;
      }
      return detail;
    }
  }
};
