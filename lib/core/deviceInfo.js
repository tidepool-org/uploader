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
  'Dexcom': infoBuilder('Dexcom', 'Plug in receiver with micro-USB'),
  'OneTouchMini': infoBuilder('OneTouch UltraMini', ''),
  'AbbottPrecisionXtra': infoBuilder('Abbott Precision Xtra',
                                 'Plug in meter with cable'),
  'InsuletOmniPod': infoBuilder('Insulet OmniPod', 'Choose .ibf file from PDM'),
  'Tandem': infoBuilder('Tandem', 'Plug in pump with micro-USB'),
  'OneTouchUltra2': infoBuilder('OneTouch Ultra2', ''),
  'AbbottFreeStyleLite': infoBuilder('Abbott FreeStyle Lite','Plug in meter with cable'),
  'AbbottFreeStyleFreedomLite': infoBuilder('Abbott FreeStyle Freedom Lite','Plug in meter with cable'),
  'BayerContourNext': infoBuilder('Bayer Contour Next', 'Plug in meter with micro-USB'),
  'BayerContourNextUsb': infoBuilder('Bayer Contour Next USB', 'Plug meter into USB port'),
  'BayerContourUsb': infoBuilder('Bayer Contour USB', 'Plug meter into USB port'),
  'BayerContourNextLink': infoBuilder('Bayer Contour Next LINK', 'Plug meter into USB port'),
  'BayerContourNextLink24': infoBuilder('Bayer Contour Next LINK 2.4', 'Plug meter into USB port')
};
