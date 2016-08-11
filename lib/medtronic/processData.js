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

 var struct = require('../struct.js')();
 var common = require('../commonFunctions');

 var  SEND_MESSAGE = [0x12,0x21,0x05];

 var _sum_lsb = function(bytes) {
   var sum = 0;
   bytes.forEach(function (byte) {
     sum += byte;
   });
   return sum & 0xff;
 };

 var buildMedtronicPacket = function (command, cmdlength, payload, payloadlength) {
   var datalen = 30 + cmdlength + payloadlength;
   var buf = new ArrayBuffer(datalen + 4); // include 4-byte header
   var bytes = new Uint8Array(buf);

   var pumpSerial = '698426'; // FIXME

   var ctr = struct.pack(bytes, 0, '6b6z10b', 0x00, 0x00, 0x00, datalen, 0x51, 0x01, pumpSerial,
                                               0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
   ctr += struct.copyBytes(bytes, ctr, command, cmdlength);
   ctr += struct.pack(bytes, ctr, '7bi', 0, 0, 0, 0, 0, 0, 0, payloadlength);

   var checkbytes = new Uint8Array(buf.slice(4)); // checksum excludes 4-byte header
   struct.copyBytes(checkbytes, ctr - 4, payload, payloadlength);
   var checksum = _sum_lsb(checkbytes);

   ctr += struct.pack(bytes, ctr, 'b', checksum);
   ctr += struct.copyBytes(bytes, ctr, payload, payloadlength);

   console.log('Sending bytes:', common.bytes2hex(bytes));
   return buf;
 };

 var readModel = function (rectype, offset, numRecords) {

   var cmd = [0xA7,0x69,0x84,0x26,0x8D,0x00,0xE2];

   return {
     command: buildMedtronicPacket(
       SEND_MESSAGE,
       3,
       cmd,
       7
     ),
     parser: function (packet) {
       console.log("PACKET:", packet);
       return packet;
     }
   };
 };


 module.exports.readModel = readModel;
 module.exports.buildMedtronicPacket = buildMedtronicPacket;
