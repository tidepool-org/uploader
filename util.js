// Implements something like the rudiments of the Python struct class;
// you can give it a format string and it will attempt to parse a stream
// of bytes or into numbers of different sizes, or format a stream of bytes
// from a set of values, corresponding to the format.
utils = function() {
    var extractString = function(bytes, start, len) {
        if (!len) {
            len = bytes.length;
        }
        s = "";
        for (var i=start; i<len; ++i) {
            s += String.fromCharCode(bytes[i]);
        }
        return s;
    };
    // extract a null-terminated string of at most len bytes
    var extractZString = function(bytes, start, len) {
        if (!len) {
            len = bytes.length;
        }
        s = "";
        for (var i=start; i<len; ++i) {
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
    // get a big-endian short
    var extractBEShort = function(b, st) {
        return ((b[st] << 8) + b[st+1]);
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
    var storeZString = function(v, b, st) {
        var i=0;
        while (i<v.length) {
            b[st + i] = v[i];
            ++i;
        }
        b[st + i] = 0;
    };
    var strlen = function(field) {
        // string length calculation for the zstring above
        return field.length+1;
    };
    var fixedlen = function(size) {
        return function(field) { return size; };
    };

    var fields = {
        'i': { len: fixedlen(4), put: storeInt, get: extractInt },
        's': { len: fixedlen(2), put: storeShort, get: extractShort },
        'b': { len: fixedlen(1), put: storeByte, get: extractByte },
        'I': { len: fixedlen(4), put: storeBEInt, get: extractBEInt },
        'S': { len: fixedlen(2), put: storeBEShort, get: extractBEShort },
        'z': { len: strlen, put: storeZString, get: extractZString },
    };

    // this doesn't work in the presence of zstring
    /*
    var structlen = function(s) {
        var t = 0;
        for (var i = 0; i < s.length; ++i) {
            t += util.fields[s[i]].len;
        }
        return t;
    };
    */

    var pack = function(buf, offset, format) {
        if (format.length != arguments.length - 3) {
            console.log("Bad args to pack!");
            return 0;
        }

        ctr = 0;
        for (var i=0; i < format.length; ++i) {
            var c = format[i];
            fields[c].put(arguments[i+3], buf, offset + ctr);
            ctr += fields[c].len(arguments[i+3]);
        }
        return ctr;
    };

    var createUnpacker = function() {
        return {
            format: "",
            names: [],
            add: function(fmts, nms) {
                this.format += fmts;
                this.names = names.concat(nms);
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
    // unpacked data; if a name is "_" the field is not stored.
    // o is the result object -- if it does not exist, it will be created
    // returns (and potentially modifies o)
    var unpack = function(buf, offset, format, names, o) {
        var result;
        if (o != null) {
            result = o;
        } else {
            result = {};
        }

        if (format.length != names.length) {
            console.log("Bad args to unpack!");
            return result;
        }

        var ctr = 0;
        for (var i=0; i < format.length; ++i) {
            var c = format[i];
            var value = fields[c].get(buf, offset + ctr);
            if (names[i] != "_") {
                result[names[i]] = value;
            }
            ctr += fields[c].len(value);
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
        var buf = new Uint8Array(32);
        var len = pack(buf, 0, "iibsib", 254, 65534, 55, 1023, 256, 7);
        console.log(buf);
        var result = unpack(buf, 0, "iibsib", ['a', 'b', 'c', 'd', 'e', 'f']);
        console.log(result);
        buf[0] = 0xff;
        buf[1] = 0xff;
        buf[2] = 0xff;
        buf[3] = 0xff;
        result = unpack(buf, 0, "i", ['x']);
        console.log(result);
        var v = [0, 30, 0, 0, 0, 1, 0, 7, 0, 0, 0, 1, 0, 7, 73, 110, 115, 117, 108, 101, 116, 0, 79, 109, 110, 105, 80, 111, 100, 0, 5, 170];
        for (var i = 0; i < v.length; ++i) {
            buf[i] = v[i];
        }
        result = unpack(buf, 0, "SSSSSSSzzS", ['l', 'b', 'c', 'd', 'e', 'f', 'g', 's1', 's2', 'ck']);
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
        storeZString: storeZString,
        pack: pack,
        createUnpacker: createUnpacker,
        unpack: unpack,
        copyBytes: copyBytes,
    };
};

