/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2018, Tidepool Project
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

/* global beforeEach, describe, it */

var _ = require('lodash');
var expect = require('salinity').expect;

var driver = require('../../../lib/drivers/insulet/insuletDriver.js');

describe('insuletDriver.js', () => {
  var insuletDriver;

  beforeEach(() => {
    insuletDriver = driver({});
  });

  describe('decodeSerial', () => {
    test('decodes 0x20409A4', () => {
      expect(insuletDriver._decodeSerial(0x20409A4)).to.equal('010002-00617');
    });
  });
});
