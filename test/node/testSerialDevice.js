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

var expect = require('salinity').expect;

var serialDevice = require('../../lib/serialDevice.js');

/*
setPattern: setPattern,
setBitrate: setBitrate,
connect: connect,
disconnect: disconnect,
changeBitRate: changeBitRate,
discardBytes: discardBytes,
readSerial: readSerial,
writeSerial: writeSerial,
setPacketHandler: setPacketHandler,
clearPacketHandler: clearPacketHandler,
hasAvailablePacket: hasAvailablePacket,
peekPacket: peekPacket,
nextPacket: nextPacket,
flush: flush,
*/


describe('serialDevice.js', function(){

  var device;
  var config = {};

  beforeEach(function(){
    device = serialDevice(config);
  });

  describe('setPattern', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('setPattern');
    });
  });
  describe('setBitrate', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('setBitrate');
    });
  });
  describe('connect', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('connect');
    });
  });
  describe('changeBitRate', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('changeBitRate');
    });
  });
  describe('discardBytes', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('discardBytes');
    });
  });
  describe('readSerial', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('readSerial');
    });
  });
  describe('writeSerial', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('writeSerial');
    });
  });
  describe('setPacketHandler', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('setPacketHandler');
    });
  });
  describe('clearPacketHandler', function(){
    it('exists', function(){
      expect(device).itself.to.respondTo('clearPacketHandler');
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
