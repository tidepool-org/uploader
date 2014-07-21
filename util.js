// Implements something like the rudiments of the Python struct class;
// you can give it a format string and it will attempt to parse a stream
// of bytes or into numbers of different sizes, or format a stream of bytes
// from a set of values, corresponding to the format.

utils = function() {
    var extractString = function(bytes, start, len) {
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
    var extractByte = function(b, st) {
        return b[st];
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
    var storeString = function(v, b, st) {
        var i=0;
        while (i<v.length) {
            b[st + i] = v[i];
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
        'b': { len: 1, put: storeByte, get: extractByte },
        'I': { len: 4, put: storeBEInt, get: extractBEInt },
        'N': { len: 4, put: storeBEInt, get: extractSignedBEInt },
        'S': { len: 2, put: storeBEShort, get: extractBEShort },
        'z': { len: 0, put: storeString, get: extractZString },
        'Z': { len: 0, put: storeString, get: extractString },
    };

    var parseformat = function(format, names) {
        var formats = [];
        if (names == null)
            names = [];
        var nameindex = 0;
        var pat = /([0-9]*)([a-zA-Z.])/g;
        var a;
        while ((a = pat.exec(format)) !== null) {
            var fmt = {};
            var count = 1;
            if (a[1]) { 
                count = parseInt(a[1], 10);
            }
            var f = a[2];
            // we treat Z and z specially -- the length field is their
            // maximum length
            if (f === 'z' || f === 'Z') {
                fmt.len = count;
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

        var ctr = 0;
        for (var i=0; i < fmts.length; ++i) {
            fmts[i].put(arguments[i+3], buf, offset + ctr, fmts[i].len);
            ctr += fmts[i].len;
        }
        return ctr;
    };

    var createUnpacker = function() {
        return {
            format: '',
            names: [],
            add: function(fmts, nms) {
                this.format += fmts;
                this.names = this.names.concat(nms);
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

        var ctr = 0;
        for (var i=0; i < fmts.length; ++i) {
            var value = fmts[i].get(buf, offset + ctr, fmts[i].len);
            if (fmts[i].name != null) {
                result[fmts[i].name] = value;
            }
            ctr += fmts[i].len;
        }
        result.unpack_length = ctr;
        return result;
    };

    var copyBytes = function(buf, offset, bytes, bytecount) {
        for (var i = 0; i < bytecount; ++i) {
            buf[offset + i] = bytes[i];
        }
        return bytecount;
    };

    var test = function() {
        var p = parseformat('2ibsi4.b32z', 'abcd');
        console.log(p);
        var buf = new Uint8Array(32);
        var len = pack(buf, 0, 'iI2bsSb', 254, 65534, 55, 66, 1023, 256, 7);
        console.log(len);
        console.log(buf);
        var result = unpack(buf, 0, 'iI2bsS.', ['a', 'b', 'c', 'd', 'e', 'f']);
        console.log(result);
        buf[0] = 0xff;
        buf[1] = 0xff;
        buf[2] = 0xff;
        buf[3] = 0xff;
        result = unpack(buf, 0, 'i', ['x']);
        console.log(result);
        var v = [0, 30, 0, 0, 0, 1, 0, 7, 0, 0, 0, 1, 0, 7, 73, 110, 115, 117, 108, 101, 116, 0, 79, 109, 110, 105, 80, 111, 100, 0, 5, 170];
        for (var i = 0; i < v.length; ++i) {
            buf[i] = v[i];
        }
        result = unpack(buf, 0, '7S8z8zS', ['l', 'b', 'c', 'd', 'e', 'f', 'g', 's1', 's2', 'ck']);
        len = structlen('7S8z8zS');
        console.log(v.length, len);
        console.log(result);
    };


    return {
        extractString: extractString,
        extractZString: extractZString,
        extractInt: extractInt,
        extractShort: extractShort,
        extractByte: extractByte,
        extractBEInt: extractBEInt,
        extractBEShort: extractBEShort,
        storeInt: storeInt,
        storeBEInt: storeBEInt,
        storeShort: storeShort,
        storeBEShort: storeBEShort,
        storeByte: storeByte,
        storeString: storeString,
        pack: pack,
        createUnpacker: createUnpacker,
        unpack: unpack,
        structlen: structlen,
        copyBytes: copyBytes,
        // test: test
    };
};

