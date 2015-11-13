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
  'DexcomG4': infoBuilder('Dexcom CGM', 'G4 Platinum or Share'),
  'OneTouchMini': infoBuilder('OneTouch UltraMini', ''),
  'AbbottPrecisionXtra': infoBuilder('Abbott Precision Xtra',
                                 'Blood glucose and ketone meter'),
  'InsuletOmniPod': infoBuilder('Insulet OmniPod', 'Upload .ibf file from PDM.'),
  'TandemTslim': infoBuilder('Tandem Diabetes t:slim', 'Tandem t:slim'),
  'OneTouchUltra2': infoBuilder('OneTouch Ultra2', ''),
  'AbbottFreeStyleLite': infoBuilder('Abbott FreeStyle Lite','Blood glucose meter'),
  'AbbottFreeStyleFreedomLite': infoBuilder('Abbott FreeStyle Freedom Lite','Blood glucose meter'),
  'BayerContourNext': infoBuilder('Bayer Contour Next', 'Blood glucose meter'),
  'BayerContourNextUsb': infoBuilder('Bayer Contour Next USB', 'Blood glucose meter'),
  'BayerContourUsb': infoBuilder('Bayer Contour USB', 'Blood glucose meter'),
  'BayerContourNextLink': infoBuilder('Bayer Contour Next LINK', 'Blood glucose meter')
};
