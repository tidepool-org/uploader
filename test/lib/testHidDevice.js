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

/*eslint-env mocha*/

/*
 * IOET
 * Test for new hidDevice facilities
 * */

var expect = require('salinity').expect;

var hidDevice = require('../../lib/hidDevice.js');

describe('hidDevice.js', function(){

  var device;
  var config = {};

  beforeEach(function(){
    device = hidDevice(config);
  });

  describe('connect', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('connect');
    });
  });
  describe('discardBytes', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('discardBytes');
    });
  });
  describe('receive', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('receive');
    });
  });
  describe('send', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('send');
    });
  });
  describe('hasAvailablePacket', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('hasAvailablePacket');
    });
  });
  describe('peekPacket', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('peekPacket');
    });
  });
  describe('nextPacket', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('nextPacket');
    });
  });
  describe('flush', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('flush');
    });
  });
});
