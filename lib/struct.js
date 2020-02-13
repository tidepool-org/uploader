// Inspired by the Python struct class but not an attempt to duplicate it.
//
// You can give it a format string and it will attempt to parse a stream
// of bytes or into numbers of different sizes, or format a stream of bytes
// from a set of values, corresponding to the format string.
// Usage:
// format strings define the layout of a stream of values in an array, assumed
// to be an array of byte values; the array must be indexable.
// Format strings consist of fields; a field is a numeric size followed by a
// non-numeric character indicating the type. Whitespace between fields is ignored.
// The size parameter has 2 meanings -- for numeric values, it's the number of repetitions of
// this field. For strings, it's the storage length of the string.
// The legal type characters are:
// b -- a 1-byte unsigned value
// y -- a 1-byte signed value
// s -- a 2-byte unsigned short in little-endian format (0x01 0x00 is returned as 1, not 256)
// S -- a 2-byte unsigned short in big-endian format (0x01 0x00 is returned as 256, not 1)
// i -- a 4-byte unsigned integer in little-endian format
// I -- a 4-byte unsigned integer in big-endian format
// n -- a 4-byte signed integer in little-endian format
// N -- a 4-byte signed integer in big-endian format
// h -- a 2-byte signed integer in little-endian format
// H -- a 2-byte signed integer in big-endian format
// z -- a zero-terminated string of maximum length controlled by the size parameter.
// Z -- a string of bytes with the length controlled by the size parameter.
// B -- an array of bytes with the length controlled by the size parameter.
// f -- a 4-byte float in little-endian format
// F -- a 4-byte float in big-endian format
// . -- the appropriate number of bytes is ignored (used for padding)
// Any other character is treated like '.' -- but don't depend on this, because we may
// someday decide to use other characters.
//
// To put bytes into a structure, use pack as follows:
// len = pack(buf, offset, format, value...)
// for example:
// pack(buf, 0, "bbsi", 1, 2, 3, 4) would yield: 01 02 03 00 04 00 00 00 and return 8.
//
// To pull data back out, give unpack the format string and a list of parameter names.
// unpack(buf, 0, "2bsi", ["a", "b", "c", "d"]) will give you { a: 1, b: 2, c: 3, d: 4 }
// unpack can pack into an existing object if you pass it as the last argument. Otherwise,
// it will create one.

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


var _ = require('lodash');

module.exports = function() {
    var extractString = function(bytes, start, len) {
        if (start === undefined) {
            start = 0;
        }
        if (!len) {
            len = bytes.length;
        }
        var s = '';
        for (var i=start; i<start + len; ++i) {
            s += String.fromCharCode(bytes[i]);
        }
        return s;
    };
    // extract a null-terminated string of at most len bytes
    var extractZString = function(bytes, start, len) {
        if (!len) {
            len = bytes.length;
        }
        var s = '';
        for (var i=start; i<start + len; ++i) {
            if (bytes[i]) {
                s += String.fromCharCode(bytes[i]);
            } else {
                break;
            }
        }
        return s;
    };
    var extractBytes = function(bytes, start, len) {
        var b = new Uint8Array(len);
        copyBytes(b, 0, bytes, len, start);
        return b;
    };
    var extractInt = function(b, st) {
        // because js always does bit shift on 32-bit values and treats them
        // as signed, we have to fake it out by doing a multiply instead of
        // a shift on the largest value.
        return ((16777216 * b[st+3]) + (b[st+2] << 16) + (b[st+1] << 8) + b[st]);
    };
    var extractSignedInt = function(b, st) {
        return ((b[st+3] << 24) + (b[st+2] << 16) + (b[st+1] << 8) + b[st]);
    };
    var extractShort = function(b, st) {
        return ((b[st+1] << 8) + b[st]);
    };
    var extractSignedShort = function(b, st) {
        var s = extractShort(b, st);
        if (s & 0x8000) {
            // it's a negative number, so do a bitwise negation to get
            // the positive equivalent, and then flip the sign.
            s = -((~s & 0xffff) + 1);
        }
        return s;
    };
    var extractByte = function(b, st) {
        return b[st];
    };
    var extractSignedByte = function(b, st) {
      // it's a signed 8-bit integer (called sbyte in c sharp)
      var byte = b[st];
      return (byte & 127) - (byte & 128);
    };
    // get a big-endian int
    var extractBEInt = function(b, st) {
        // because js always does bit shift on 32-bit values and treats them
        // as signed, we have to fake it out by doing a multiply instead of
        // a shift on the largest value.
        return ((16777216 * b[st]) + (b[st+1] << 16) + (b[st+2] << 8) + b[st+3]);
    };
    var extractSignedBEInt = function(b, st) {
        return ((b[st] << 24) + (b[st+1] << 16) + (b[st+2] << 8) + b[st+3]);
    };
    // get a big-endian short
    var extractBEShort = function(b, st) {
        return ((b[st] << 8) + b[st+1]);
    };
    var extractSignedBEShort = function(b, st) {
        var s = extractBEShort(b, st);
        if (s & 0x8000) {
            // it's a negative number, so do a bitwise negation to get
            // the positive equivalent, and then flip the sign.
            s = -((~s & 0xffff) + 1);
        }
        return s;
    };
    var extractFloat = function(b, st){
      var buffer = new ArrayBuffer(4);
      var dataview = new DataView(buffer);
      dataview.setUint8(0, b[st]);
      dataview.setUint8(1, b[st+1]);
      dataview.setUint8(2, b[st+2]);
      dataview.setUint8(3, b[st+3]);
      return dataview.getFloat32(0, true);
    };
    var extractBEFloat = function(b, st){
      var buffer = new ArrayBuffer(4);
      var dataview = new DataView(buffer);
      dataview.setUint8(0, b[st]);
      dataview.setUint8(1, b[st+1]);
      dataview.setUint8(2, b[st+2]);
      dataview.setUint8(3, b[st+3]);
      return dataview.getFloat32(0, false);
    };
    var storeFloat = function(v, b, st) {
      var buffer = new ArrayBuffer(4);
      var dataview = new DataView(buffer);
      dataview.setFloat32(0, v, true);
      b[st] = dataview.getUint8(0);
      b[st+1] = dataview.getUint8(1);
      b[st+2] = dataview.getUint8(2);
      b[st+3] = dataview.getUint8(3);
    };
    var storeBEFloat = function(v, b, st) {
      var buffer = new ArrayBuffer(4);
      var dataview = new DataView(buffer);
      dataview.setFloat32(0,v, false);
      b[st] = dataview.getUint8(0);
      b[st+1] = dataview.getUint8(1);
      b[st+2] = dataview.getUint8(2);
      b[st+3] = dataview.getUint8(3);
    };
    var extractNothing = function() {
        return 0;
    };
    var storeInt = function(v, b, st) {
        b[st] = v & 0xFF;
        b[st + 1] = (v >> 8) & 0xFF;
        b[st + 2] = (v >> 16) & 0xFF;
        b[st + 3] = (v >> 24) & 0xFF;
    };
    var storeBEInt = function(v, b, st) {
        b[st + 3] = v & 0xFF;
        b[st + 2] = (v >> 8) & 0xFF;
        b[st + 1] = (v >> 16) & 0xFF;
        b[st] = (v >> 24) & 0xFF;
    };
    var storeShort = function(v, b, st) {
        b[st] = v & 0xFF;
        b[st + 1] = (v >> 8) & 0xFF;
    };
    var storeBEShort = function(v, b, st) {
        b[st + 1] = v & 0xFF;
        b[st] = (v >> 8) & 0xFF;
    };
    var storeByte = function(v, b, st) {
        b[st] = v & 0xFF;
    };
    var storeBytes = function(v, b, st) {
        var i=0;
        while (i<v.length) {
            b[st + i] = v[i];
            ++i;
        }
    };
    var storeString = function(v, b, st) {
        var i=0;
        while (i<v.length) {
            b[st + i] = v.charCodeAt(i);
            ++i;
        }
        b[st + i] = 0;
    };
    var storeNothing = function() {
    };

    var fields = {
        'i': { len: 4, put: storeInt, get: extractInt },
        'n': { len: 4, put: storeInt, get: extractSignedInt },
        's': { len: 2, put: storeShort, get: extractShort },
        'h': { len: 2, put: storeShort, get: extractSignedShort },
        'b': { len: 1, put: storeByte, get: extractByte },
        'y': { len: 1, put: storeByte, get: extractSignedByte },
        'B': { len: 0, put: storeBytes, get: extractBytes },
        'f': { len: 4, put: storeFloat, get: extractFloat },
        'F': { len: 4, put: storeBEFloat, get: extractBEFloat },
        'I': { len: 4, put: storeBEInt, get: extractBEInt },
        'N': { len: 4, put: storeBEInt, get: extractSignedBEInt },
        'S': { len: 2, put: storeBEShort, get: extractBEShort },
        'H': { len: 2, put: storeBEShort, get: extractSignedBEShort },
        'z': { len: 0, put: storeString, get: extractZString },
        'Z': { len: 0, put: storeString, get: extractString },
    };

    var parseformat = function(format, names) {
        var formats = [];
        if (names == null) {
            names = [];
        }
        var nameindex = 0;
        var pat = / *([0-9]*)([a-zA-Z.]) */g;
        var a;
        var offset = 0;
        while ((a = pat.exec(format)) !== null) {
            var fmt = {};
            var count = 1;
            if (a[1]) {
                count = parseInt(a[1], 10);
            }
            var f = a[2];
            // we treat these values specially -- the length field is their
            // maximum length
            if (f === 'z' || f === 'Z' || f === 'B') {
                fmt.len = count;
                fmt.offset = offset;
                offset += fmt.len;
                fmt.get = fields[f].get;
                fmt.put = fields[f].put;
                if (names[nameindex]) {
                    fmt.name = names[nameindex++];
                } else {
                    fmt.name = '_field_' + nameindex++;
                }
                formats.push(fmt);
            }
            else if (fields[f]) {
                for (var j=0; j<count; ++j) {
                    fmt.len = fields[f].len;
                    fmt.offset = offset;
                    offset += fmt.len;
                    fmt.get = fields[f].get;
                    fmt.put = fields[f].put;
                    if (names[nameindex]) {
                        fmt.name = names[nameindex++];
                    } else {
                        fmt.name = '_field_' + nameindex++;
                    }
                    formats.push(_.clone(fmt));
                }
            } else {
                fmt.len = count;
                fmt.offset = offset;
                offset += fmt.len;
                fmt.get = extractNothing;
                fmt.put = storeNothing;
                fmt.name = null;
                formats.push(fmt);
            }
        }
        return formats;

    };

    var structlen = function(s) {
        var fmts = parseformat(s);
        var t = 0;
        for (var i = 0; i < fmts.length; ++i) {
            t += fmts[i].len;
        }
        return t;
    };

    var pack = function(buf, offset, format) {
        var fmts = parseformat(format);

        for (var i=0; i < fmts.length; ++i) {
            fmts[i].put(arguments[i+3], buf, offset + fmts[i].offset, fmts[i].len);
        }
        // inefficient but probably doesn't ever matter
        return structlen(format);
    };

    // helper function for if you just want a string in a buffer
    var packString = function(s) {
        var len = s.length;
        var buf = new ArrayBuffer(len);
        var bytes = new Uint8Array(buf);

        storeString(s, bytes, 0);
        return buf;
    };

    // This is if you prefer to build things with a chaining api
    var createUnpacker = function() {
        return {
            format: '',
            names: [],
            add: function(fmts, nms) {
                this.format += fmts;
                this.names = this.names.concat(nms);
                return this;
            },
            go: function(buf, offset, o) {
                return unpack(buf, offset, this.format, this.names, o);
            }
        };
    };


    // buf is an indexable array of bytes
    // offset is the starting offset within buf to unpack the structure
    // format is a format string
    // names is an array of names (within the result object) to store the
    // unpacked data; if a name is '_' the field is not stored.
    // o is the result object -- if it does not exist, it will be created
    // returns (and potentially modifies o)
    var unpack = function(buf, offset, format, names, o) {
        var result;
        if (o != null) {
            result = o;
        } else {
            result = {};
        }

        var fmts = parseformat(format, names);

        for (var i=0; i < fmts.length; ++i) {
            var value = fmts[i].get(buf, offset + fmts[i].offset, fmts[i].len);
            var name = fmts[i].name;
            if (name != null) {
                if (typeof(name) == 'string') {
                    result[name] = value;
                } else {
                    // if not a string it will be an array of keys we should nest
                    // so ["a", "b", 1] does result[a][b][1]=value
                    var v = result;
                    for (var j=0; j<name.length-1; ++j) {
                        if (!v[name[j]]) {
                            v[name[j]] = [];
                        }
                        v = v[name[j]];
                    }
                    v[name[j]] = value;
                }
            }
        }
        // result.formats = fmts;
        return result;
    };

    var copyBytes = function(buf, offset, bytes, bytecount, byteoffset) {
        var bo = (byteoffset == null)? 0 : byteoffset;
        for (var i = 0; i < bytecount; ++i) {
            buf[offset + i] = bytes[bo + i];
        }
        return bytecount;
    };

    return {
        extractString: extractString,
        extractZString: extractZString,
        extractBytes: extractBytes,
        extractInt: extractInt,
        extractSignedInt: extractSignedInt,
        extractShort: extractShort,
        extractFloat: extractFloat,
        extractByte: extractByte,
        extractBEInt: extractBEInt,
        extractBEShort: extractBEShort,
        extractBEFloat: extractBEFloat,
        storeInt: storeInt,
        storeBEInt: storeBEInt,
        storeFloat: storeFloat,
        storeBEFloat: storeBEFloat,
        storeShort: storeShort,
        storeBEShort: storeBEShort,
        storeByte: storeByte,
        storeBytes: storeBytes,
        storeString: storeString,
        pack: pack,
        packString: packString,
        createUnpacker: createUnpacker,
        unpack: unpack,
        structlen: structlen,
        copyBytes: copyBytes,
    };
};
