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

function infoBuilder(generalName, detailName) {
  return {
    getName: function(device) {
      return generalName;
    },
    getDetail: function(device) {
      var detail = detailName;
      if (device.serialNumber) {
        detail = detail + '<br>Serial # ' + device.serialNumber;
      }
      return detail;
    }
  };
}

module.exports = {
  'DexcomG4': infoBuilder('Dexcom CGM', 'Dexcom G4 Platinum'),
  'OneTouchMini': infoBuilder('OneTouch Mini BGM', 'OneTouch Mini'),
  'AsanteSNAP': infoBuilder('AsanteSnap Pump', 'Asante Snap'),
  'AbbottFreeStyle': infoBuilder('Abbott FreeStyle Precision Xtra BGM',
                                 'FreeStyle Precision Xtra'),
  'InsuletOmniPod': infoBuilder('Insulet OmniPod', 'Upload .ibf file from PDM.'),
  'OneTouchUltra2': infoBuilder('OneTouch Ultra2', 'OneTouch Ultra2')
};
