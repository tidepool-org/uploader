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

/* global beforeEach, describe, it */

var expect = require('salinity').expect;

var struct = require('../lib/struct.js');


describe('struct.js', function(){

  beforeEach(function(){
    theStruct = struct();
  });

  describe('extractString', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('extractString');
    });
  });
  describe('extractZString', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('extractZString');
    });
  });
  describe('extractInt', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('extractInt');
    });
  });
  describe('extractShort', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('extractShort');
    });
  });
  describe('extractByte', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('extractByte');
    });
  });
  describe('extractBEInt', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('extractBEInt');
    });
  });
  describe('storeShort', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('storeShort');
    });
  });
  describe('storeBEShort', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('storeBEShort');
    });
  });
  describe('storeByte', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('storeByte');
    });
  });
  describe('storeString', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('storeString');
    });
  });
  describe('pack', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('pack');
    });
  });
  describe('createUnpacker', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('createUnpacker');
    });
  });
  describe('unpack', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('unpack');
    });
  });
  describe('pack', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('pack');
    });
  });
  describe('structlen', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('structlen');
    });
  });
  describe('copyBytes', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('copyBytes');
    });
  });
  describe('test', function(){
    it('exists', function(){
      expect(theStruct).itself.to.respondTo('test');
    });
  });
});