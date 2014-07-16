// Implements something like the rudiments of the Python struct class;
// you can give it a format string and it will attempt to parse a stream
// of bytes or into numbers of different sizes, or format a stream of bytes
// from a set of values, corresponding to the format.
var util = {
    extractString: function(bytes, start, len) {
        if (!len) {
            len = bytes.length;
        }
        s = "";
        for (var i=start; i<len; ++i) {
            s += String.fromCharCode(bytes[i]);
        }
        return s;
    },
    extractInt: function(b, st) {
        // because js always does bit shift on 32-bit values and treats them
        // as signed, we have to fake it out by doing a multiply instead of
        // a shift on the largest value.
        return ((16777216 * b[st+3]) + (b[st+2] << 16) + (b[st+1] << 8) + b[st]);
    },
    extractShort: function(b, st) {
        return ((b[st+1] << 8) + b[st]);
    },
    extractByte: function(b, st) {
        return b[st];
    },
    storeInt: function(v, b, st) {
        b[st] = v & 0xFF;
        b[st + 1] = (v >> 8) & 0xFF;
        b[st + 2] = (v >> 16) & 0xFF;
        b[st + 3] = (v >> 24) & 0xFF;
    },
    storeShort: function(v, b, st) {
        b[st] = v & 0xFF;
        b[st + 1] = (v >> 8) & 0xFF;
    },
    storeByte: function(v, b, st) {
        b[st] = v & 0xFF;
    },

    fields: {
        'I': { len: 4, put: 'storeInt', get: 'extractInt' },
        's': { len: 2, put: 'storeShort', get: 'extractShort' },
        'b': { len: 1, put: 'storeByte', get: 'extractByte' }
    },

    structlen: function(s) {
        var t = 0;
        for (var i = 0; i < s.length; ++i) {
            t += util.fields[s[i]].len;
        }
        return t;
    },

    pack: function(buf, offset, format) {
        if (format.length != arguments.length - 3) {
            console.log("Bad args to pack!");
            return 0;
        }

        var len = util.structlen(format);
        ctr = 0;
        for (var i=0; i < format.length; ++i) {
            var c = format[i];
            var put = util[util.fields[c].put];
            put(arguments[i+3], buf, offset + ctr);
            ctr += util.fields[c].len;
        }
        return ctr;
    },

    createUnpacker: function() {
        return {
            format: "",
            names: [],
            add: function(fmts, nms) {
                this.format += fmts;
                this.names = names.concat(nms);
            },
            go: function(buf, offset, o) {
                return utils.unpack(buf, offset, this.format, this.names, o);
            }
        };
    },



    // buf is an indexable array of bytes
    // offset is the starting offset within buf to unpack the structure
    // format is a format string
    // names is an array of names (within the result object) to store the unpacked data
    // o is the result object -- if it does not exist, it will be created
    // returns (and potentially modifies o)
    unpack: function(buf, offset, format, names, o) {
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

        // var len = util.structlen(format);
        var ctr = 0;
        for (var i=0; i < format.length; ++i) {
            var c = format[i];
            var get = util[util.fields[c].get];
            result[names[i]] = get(buf, offset + ctr);
            ctr += util.fields[c].len;
        }
        result.unpack_length = ctr;
        return result;
    },

    copyBytes: function(buf, offset, bytes, bytecount) {
        for (var i = 0; i < bytecount; ++i) {
            buf[offset + i] = bytes[i];
        }
        return bytecount;
    }        
};

