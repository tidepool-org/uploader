/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2016, Tidepool Project
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


var expect = require('salinity').expect;

var driver = require('../../../lib/drivers/animas/animasDriver');

describe('animasDriver.js', () => {

  var animasDriver;
  var config = {
    deviceComms: {
      flush: function (){}
    }
  };

  beforeEach(() => {
    animasDriver = driver(config);
  });

  describe('extractPacket', () => {
    test('is valid', () => {
      var bytes = [0xC0, 0x02, 0x73, 0x88, 0x1B, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0xBC, 0x29, 0xC1];
      var packet = animasDriver._extractPacket(bytes);
      expect(packet.valid).to.be.true;
    });

    test('is invalid', () => {
      var bytes = [0xC0, 0x00, 0x00, 0xC1];
      var packet = animasDriver._extractPacket(bytes);
      expect(packet.valid).to.be.false;
    });

    test('escapes special character in the checksum', () => {
      var bytes = [0xC0, 0x80, 0x74, 0x44, 0x49, 0x30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x8B, 0x7D, 0xE1, 0xC1];
      var packet = animasDriver._extractPacket(bytes);
      expect(packet.valid).to.be.true;
    });
  });
});
