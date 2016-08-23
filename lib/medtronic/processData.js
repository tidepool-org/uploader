/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2016, Tidepool Project
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

var sundial = require('sundial');
var struct = require('../struct.js')();

var decodeDate = function (payload, index) {
 var encoded = struct.unpack(payload,index,'bbbbb',['second','minute','hour','day','year']);
 var second = encoded.second & 0x3f;
 var minute = encoded.minute & 0x3f;
 var hour = encoded.hour & 0x3f;
 var day = encoded.day & 0x1f;
 var month = (((encoded.second & 0xc0) >> 4) | ((encoded.minutes & 0xc0) >> 6));
 var year = (encoded.year & 0x7f)+2000;
 var date = sundial.buildTimestamp({year:year,month:month,day:day,hours:hour,minutes:minute,seconds:second});
 return date;
};
