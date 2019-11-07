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


/*
 * IOET
 * Test for new hidDevice facilities
 * */

var expect = require('salinity').expect;

var hidDevice = require('../../lib/hidDevice.js');

describe('hidDevice.js', () => {

  var device;
  var config = {};

  beforeEach(() => {
    device = hidDevice(config);
  });

  describe('connect', () => {
    test('exists', () => {
      expect(device).itself.to.respondTo('connect');
    });
  });
  describe('disconnect', () => {
    test('exists', () => {
      expect(device).itself.to.respondTo('disconnect');
    });
  });
  describe('receive', () => {
    test('exists', () => {
      expect(device).itself.to.respondTo('receive');
    });
  });
  describe('send', () => {
    test('exists', () => {
      expect(device).itself.to.respondTo('send');
    });
  });
});
