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


var expect = require('salinity').expect;

var struct = require('../../lib/struct.js');


describe('struct.js', () => {

  var theStruct;

  beforeEach(() => {
    theStruct = struct();
  });

  describe('extractString', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('extractString');
    });
  });
  describe('extractZString', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('extractZString');
    });
  });
  describe('extractInt', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('extractInt');
    });
  });
  describe('extractShort', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('extractShort');
    });
  });
  describe('extractFloat', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('extractFloat');
    });
  });
  describe('extractBEFloat', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('extractBEFloat');
    });
  });
  describe('extractByte', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('extractByte');
    });
  });
  describe('extractBEInt', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('extractBEInt');
    });
  });
  describe('storeShort', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('storeShort');
    });
  });
  describe('storeBEShort', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('storeBEShort');
    });
  });
  describe('storeFloat', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('storeFloat');
    });
  });
  describe('storeBEFloat', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('storeBEFloat');
    });
  });
  describe('storeByte', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('storeByte');
    });
  });
  describe('extractBytes', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('extractBytes');
    });
  });
  describe('storeString', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('storeString');
    });
  });
  describe('pack', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('pack');
    });
  });
  describe('createUnpacker', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('createUnpacker');
    });
  });
  describe('unpack', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('unpack');
    });
  });
  describe('structlen', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('structlen');
    });
  });
  describe('copyBytes', () => {
    test('exists', () => {
      expect(theStruct).itself.to.respondTo('copyBytes');
    });
  });
  // The legal type characters are and their meaning are described at the top of the struct.js file.
  describe('structlen and format parsing', () => {
    test('work properly', () => {
      expect(theStruct.structlen('b6.Si')).to.equal(13);
      expect(theStruct.structlen('y6.Si')).to.equal(13);
      expect(theStruct.structlen('bsSiInNhHfF.')).to.equal(34);
      expect(theStruct.structlen('4b2s1I48.')).to.equal(60);
      expect(theStruct.structlen('4b 2s 1I 48.')).to.equal(60);
      expect(theStruct.structlen('4bK')).to.equal(5); // K isn't currently used
      expect(theStruct.structlen('8z')).to.equal(8);
      expect(theStruct.structlen('4Z')).to.equal(4);
      expect(theStruct.structlen('4B')).to.equal(4);
      expect(theStruct.structlen('Z')).to.equal(1);
    });
  });
  describe('pack functionality', () => {
    test('works for b', () => {
      var buf = new Uint8Array(5);
      var len = theStruct.pack(buf, 0, '5b', 0x48, 0x65, 0x6c, 0x6c, 0x6f);
      expect(len).to.equal(5);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('Hello');
    });
    test('works for s', () => {
      var buf = new Uint8Array(4);
      var len = theStruct.pack(buf, 0, '2s', 0x6574, 0x7473);
      expect(len).to.equal(4);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('test');
    });
    test('works for S', () => {
      var buf = new Uint8Array(4);
      var len = theStruct.pack(buf, 0, '2S', 0x7465, 0x7374);
      expect(len).to.equal(4);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('test');
    });
    test('works for i', () => {
      var buf = new Uint8Array(4);
      var len = theStruct.pack(buf, 0, 'i', 0x74736574);
      expect(len).to.equal(4);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('test');
    });
    test('can handle all the bits', () => {
      var buf = new Uint8Array(16);
      var len = theStruct.pack(buf, 0, '4i', 0x55555555, 0xAAAAAAAA, 0xFFFFFFFF, 0);
      expect(len).to.equal(16);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('\u0055\u0055\u0055\u0055\u00AA\u00AA\u00AA\u00AA\u00FF\u00FF\u00FF\u00FF\u0000\u0000\u0000\u0000');
    });
    test('works for B', () => {
      var buf = new Uint8Array(4);
      var inputBuf = [1, 2, 3, 4];
      var len = theStruct.pack(buf, 0, '4B', inputBuf);
      expect(len).to.equal(4);
      var result = String.fromCharCode.apply(null, buf);
      var expected = String.fromCharCode.apply(null, inputBuf);
      expect(result).to.equal(expected);
    });
    test('works for z', () => {
      var buf = new Uint8Array(8);
      var len = theStruct.pack(buf, 0, '8z', 'banana');
      expect(len).to.equal(8);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('banana\u0000\u0000');
    });
    test('works for z even if too long', () => {
      var buf = new Uint8Array(8);
      var len = theStruct.pack(buf, 0, '8z', 'verylongstring');
      expect(len).to.equal(8);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('verylong');
    });
    test('does big positives properly for h', () => {
      var buf = new Uint8Array(4);
      var len = theStruct.pack(buf, 0, 'h', 65534);
      expect(len).to.equal(2);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('\u00FE\u00FF\u0000\u0000');
    });
    test('does negatives properly for h', () => {
      var buf = new Uint8Array(4);
      var len = theStruct.pack(buf, 0, 'h', -2);
      expect(len).to.equal(2);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('\u00FE\u00FF\u0000\u0000');
    });
    test('does negatives properly for n', () => {
      var buf = new Uint8Array(4);
      var len = theStruct.pack(buf, 0, 'n', -2);
      expect(len).to.equal(4);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('\u00FE\u00FF\u00FF\u00FF');
    });
    test('works for f', () => {
      var buf = new Uint8Array(4);
      var len = theStruct.pack(buf, 0, 'f', -1.5);
      expect(len).to.equal(4);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('\u0000\u0000\u00C0\u00BF');
    });
    test('works for F', () => {
      var buf = new Uint8Array(4);
      var len = theStruct.pack(buf, 0, 'F', -2.5);
      expect(len).to.equal(4);
      var s = String.fromCharCode.apply(null, buf);
      expect(s).to.equal('\u00C0\u0020\u0000\u0000');
    });
  });
  describe('unpack functionality', () => {
    test('works for b', () => {
      var buf = new Uint8Array(4);
      buf[0] = 0xff;
      buf[1] = 0x55;
      buf[2] = 0xaa;
      buf[3] = 0x01;
      var result = theStruct.unpack(buf, 0, '4b', ['a', 'b', 'c', 'd']);
      expect(result.a).to.equal(255);
      expect(result.b).to.equal(0x55);
      expect(result.c).to.equal(0xAA);
      expect(result.d).to.equal(1);
    });
    test('works for y', () => {
      var buf = new Uint8Array(4);
      buf[0] = 0x80;
      buf[1] = 0x7F;
      buf[2] = 0x00;
      buf[3] = 0x01;
      var result = theStruct.unpack(buf, 0, '4y', ['a', 'b', 'c', 'd']);
      expect(result.a).to.equal(-128);
      expect(result.b).to.equal(127);
      expect(result.c).to.equal(0);
      expect(result.d).to.equal(1);
    });
    test('works for B', () => {
      var buf = new Uint8Array(4);
      buf[0] = 0xff;
      buf[1] = 0x55;
      buf[2] = 0xaa;
      buf[3] = 0x01;
      var result = theStruct.unpack(buf, 0, '4B', ['a']);
      expect(result.a[0]).to.equal(255);
      expect(result.a[1]).to.equal(0x55);
      expect(result.a[2]).to.equal(0xAA);
      expect(result.a[3]).to.equal(1);
    });
    test('ignores .', () => {
      var buf = new Uint8Array(4);
      buf[0] = 0xff;
      buf[1] = 0x55;
      buf[2] = 0xaa;
      buf[3] = 0x01;
      var result = theStruct.unpack(buf, 0, 'bb.b', ['a', 'b', 'c']);
      expect(result.a).to.equal(255);
      expect(result.b).to.equal(0x55);
      expect(result.c).to.equal(1);
    });
    test('works for s', () => {
      var buf = new Uint8Array(4);
      buf[0] = 0xff;
      buf[1] = 0x55;
      buf[2] = 0xaa;
      buf[3] = 0x01;
      var result = theStruct.unpack(buf, 0, '2s', ['a', 'b']);
      expect(result.a).to.equal(0x55ff);
      expect(result.b).to.equal(0x01aa);
    });
    test('works for S', () => {
      var buf = new Uint8Array(4);
      buf[0] = 0xff;
      buf[1] = 0x55;
      buf[2] = 0xaa;
      buf[3] = 0x01;
      var result = theStruct.unpack(buf, 0, '2S', ['a', 'b']);
      expect(result.a).to.equal(0xff55);
      expect(result.b).to.equal(0xaa01);
    });
    test('works for h', () => {
      var buf = new Uint8Array(4);
      buf[0] = 0xfe;
      buf[1] = 0xff;
      buf[2] = 0x02;
      buf[3] = 0x01;
      var result = theStruct.unpack(buf, 0, '2h', ['a', 'b']);
      expect(result.a).to.equal(-2);
      expect(result.b).to.equal(258);
    });
    test('works for H', () => {
      var buf = new Uint8Array(4);
      buf[0] = 0xff;
      buf[1] = 0xfe;
      buf[2] = 0x01;
      buf[3] = 0x02;
      var result = theStruct.unpack(buf, 0, '2H', ['a', 'b']);
      expect(result.a).to.equal(-2);
      expect(result.b).to.equal(258);
    });
    test('works for i', () => {
      var buf = new Uint8Array(4);
      buf[0] = 0xff;
      buf[1] = 0x55;
      buf[2] = 0xaa;
      buf[3] = 0x01;
      var result = theStruct.unpack(buf, 0, 'i', ['a']);
      expect(result.a).to.equal(0x01aa55ff);
    });
    test('works for I', () => {
      var buf = new Uint8Array(4);
      buf[0] = 0xff;
      buf[1] = 0x55;
      buf[2] = 0xaa;
      buf[3] = 0x01;
      var result = theStruct.unpack(buf, 0, 'I', ['a']);
      expect(result.a).to.equal(0xff55aa01);
    });
    test('works for n', () => {
      var buf = new Uint8Array(8);
      buf[0] = 0xfe;
      buf[1] = 0xff;
      buf[2] = 0xff;
      buf[3] = 0xff;
      buf[4] = 0x02;
      buf[5] = 0x01;
      buf[6] = 0x00;
      buf[7] = 0x00;
      var result = theStruct.unpack(buf, 0, '2n', ['a', 'b']);
      expect(result.a).to.equal(-2);
      expect(result.b).to.equal(258);
    });
    test('works for N', () => {
      var buf = new Uint8Array(8);
      buf[0] = 0xff;
      buf[1] = 0xff;
      buf[2] = 0xff;
      buf[3] = 0xfe;
      buf[4] = 0x00;
      buf[5] = 0x00;
      buf[6] = 0x01;
      buf[7] = 0x02;
      var result = theStruct.unpack(buf, 0, '2N', ['a', 'b']);
      expect(result.a).to.equal(-2);
      expect(result.b).to.equal(258);
    });
    test('works for z with null term', () => {
      var buf = new Uint8Array(8);
      buf[0] = 0x48;
      buf[1] = 0x65;
      buf[2] = 0x6c;
      buf[3] = 0x6c;
      buf[4] = 0x6f;
      buf[5] = 0x00;
      buf[6] = 0x01;
      buf[7] = 0x02;
      var result = theStruct.unpack(buf, 0, '8z', ['s']);
      expect(result.s).to.equal('Hello');
    });
    test('works for z truncated', () => {
      var buf = new Uint8Array(8);
      buf[0] = 0x48;
      buf[1] = 0x65;
      buf[2] = 0x6c;
      buf[3] = 0x6c;
      buf[4] = 0x6f;
      buf[5] = 0x00;
      buf[6] = 0x01;
      buf[7] = 0x02;
      var result = theStruct.unpack(buf, 0, '4z', ['s']);
      expect(result.s).to.equal('Hell');
    });
    test('works for z truncated with offset', () => {
      var buf = new Uint8Array(8);
      buf[0] = 0x48;
      buf[1] = 0x65;
      buf[2] = 0x6c;
      buf[3] = 0x6c;
      buf[4] = 0x6f;
      buf[5] = 0x00;
      buf[6] = 0x01;
      buf[7] = 0x02;
      var result = theStruct.unpack(buf, 1, '4z', ['s']);
      expect(result.s).to.equal('ello');
    });
    test('works for Z', () => {
      var buf = new Uint8Array(8);
      buf[0] = 0x48;
      buf[1] = 0x65;
      buf[2] = 0x6c;
      buf[3] = 0x6c;
      buf[4] = 0x6f;
      buf[5] = 0x00;
      buf[6] = 0x01;
      buf[7] = 0x02;
      var result = theStruct.unpack(buf, 0, '8Z', ['s']);
      expect(result.s).to.equal('Hello\u0000\u0001\u0002');
    });
    test('works for f', () => {
      var buf = new Uint8Array(8);
      buf[0] = 0x00;
      buf[1] = 0x00;
      buf[2] = 0xD0;
      buf[3] = 0x3F;
      buf[4] = 0x00;
      buf[5] = 0x00;
      buf[6] = 0xA0;
      buf[7] = 0x3F;
      var result = theStruct.unpack(buf, 0, 'ff', ['a', 'b']);
      expect(result.a).to.equal(1.625);
      expect(result.b).to.equal(1.25);
    });
    test('works for F', () => {
      var buf = new Uint8Array(8);
      buf[0] = 0x3F;
      buf[1] = 0xD0;
      buf[2] = 0x00;
      buf[3] = 0x00;
      buf[4] = 0x3F;
      buf[5] = 0xA0;
      buf[6] = 0x00;
      buf[7] = 0x00;
      var result = theStruct.unpack(buf, 0, 'FF', ['a', 'b']);
      expect(result.a).to.equal(1.625);
      expect(result.b).to.equal(1.25);
    });
  });
  describe('general test of pack/unpack', () => {
    test('works', () => {
      var buf = new Uint8Array(32);
      var len = theStruct.pack(buf, 0, 'bsShHiInNy', 254, 65534, 65533, -3, -4, 65537, 65538, -5, -6,-127);
      expect(len).to.equal(26);
      var result = theStruct.unpack(buf, 0, 'bsShHiInNy', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
      expect(result.a).to.equal(254);
      expect(result.b).to.equal(65534);
      expect(result.c).to.equal(65533);
      expect(result.d).to.equal(-3);
      expect(result.e).to.equal(-4);
      expect(result.f).to.equal(65537);
      expect(result.g).to.equal(65538);
      expect(result.h).to.equal(-5);
      expect(result.i).to.equal(-6);
      expect(result.j).to.equal(-127);
    });
  });
  describe('test of packString', () => {
    test('basically works', () => {
      var s = 'ABC';
      var buf = theStruct.packString(s);
      expect(buf.byteLength).to.equal(3);
      var data = new Uint8Array(buf);
      expect(data[0]).to.equal(65);
      expect(data[1]).to.equal(66);
      expect(data[2]).to.equal(67);
    });
  });
  describe('general test of unpack builder', () => {
    test('works', () => {
      var buf = new Uint8Array(32);
      var len = theStruct.pack(buf, 0, 'bsShHiInNy', 254, 65534, 65533, -3, -4, 65537, 65538, -5, -6, -127);
      expect(len).to.equal(26);
      var unpacker = theStruct.createUnpacker()
        .add('b', ['a'])
        .add('sS', ['b', 'c'])
        .add('hH', ['d', 'e'])
        .add('iInNy', ['f', 'g', 'h', 'i', 'j']);
      var result = unpacker.go(buf, 0);
      expect(result.a).to.equal(254);
      expect(result.b).to.equal(65534);
      expect(result.c).to.equal(65533);
      expect(result.d).to.equal(-3);
      expect(result.e).to.equal(-4);
      expect(result.f).to.equal(65537);
      expect(result.g).to.equal(65538);
      expect(result.h).to.equal(-5);
      expect(result.i).to.equal(-6);
      expect(result.j).to.equal(-127);
    });
    test('can use your object', () => {
      var buf = new Uint8Array(32);
      var len = theStruct.pack(buf, 0, 'bsShHiInNy', 254, 65534, 65533, -3, -4, 65537, 65538, -5, -6, -127);
      expect(len).to.equal(26);
      var unpacker = theStruct.createUnpacker()
        .add('b', ['a'])
        .add('sS', ['b', 'c'])
        .add('hH', ['d', 'e'])
        .add('iInNy', ['f', 'g', 'h', 'i', 'j']);
      var result = {};
      var result2 = unpacker.go(buf, 0, result);
      expect(result2).to.equal(result);
      expect(result.a).to.equal(254);
      expect(result.b).to.equal(65534);
      expect(result.c).to.equal(65533);
      expect(result.d).to.equal(-3);
      expect(result.e).to.equal(-4);
      expect(result.f).to.equal(65537);
      expect(result.g).to.equal(65538);
      expect(result.h).to.equal(-5);
      expect(result.i).to.equal(-6);
      expect(result.j).to.equal(-127);
    });
  });
});
