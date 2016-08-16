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

 var crcCalculator = require('../crc.js');
 crcCalculator.crc8_init(0x9b);

 var struct = require('../struct.js')();
 var common = require('../commonFunctions');

 var SEND_MESSAGE = [0x12,0x21,0x05];

 var _sum_lsb = function(bytes) {
   var sum = 0;
   bytes.forEach(function (byte) {
     sum += byte;
   });
   return sum & 0xff;
 };

 var buildMedtronicPacket = function (type, command, parameter) {
   var pumpSerial = '698426'; // FIXME

   var payload = [];
   if(command != null) {
     // first construct payload before we can determine packet length
     var medtronicHeader = [0xA7,parseInt(pumpSerial.substring(0,2),16),
                                 parseInt(pumpSerial.substring(2,4),16),
                                 parseInt(pumpSerial.substring(4,6),16)];
     if(parameter != null) {
       payload = medtronicHeader.concat(command,parameter);
       var padding = _.fill(new Array(20),0);
       payload = payload.concat(padding);
     } else {
       payload = medtronicHeader.concat(command,0x00);
       var payloadChecksum = crcCalculator.crc8_checksum(payload);
       payload = payload.concat(payloadChecksum);
     }
   }

   var datalen = 30 + type.length + payload.length;
   var buf = new ArrayBuffer(datalen + 4); // include 4-byte header
   var bytes = new Uint8Array(buf);

   var ctr = struct.pack(bytes, 0, '6b6z10b', 0x00, 0x00, 0x00, datalen, 0x51, 0x01, pumpSerial,
                                               0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
   ctr += struct.copyBytes(bytes, ctr, type, type.length);

   // TODO: with parameters: [0,0,0,0x04,0x10,0x10,0x00]
   // and total length: 0x47 = 71 = 7 + 20 + 44
   ctr += struct.pack(bytes, ctr, '7bi', 0, 0, 0, 0, 0, 0, 0, payload.length);

   var checkbytes = new Uint8Array(buf.slice(4)); // checksum excludes 4-byte header
   struct.copyBytes(checkbytes, ctr - 4, payload, payload.length);
   var checksum = _sum_lsb(checkbytes);

   ctr += struct.pack(bytes, ctr, 'b', checksum);
   ctr += struct.copyBytes(bytes, ctr, payload, payload.length);

   console.log('Sending bytes:', common.bytes2hex(bytes));
   return buf;
 };


 var buildPaddingPacket = function (length) {

   var padding = _.fill(new Array(length), 0);

   // var checksum = crcCalculator.crc8_checksum(payload);
   var checksum = 0x69; //FIXME

   var datalen = length + 1; // include checksum
   var buf = new ArrayBuffer(datalen + 4 ); // include 4-byte header
   var bytes = new Uint8Array(buf);

   var ctr = struct.pack(bytes, 0, '4b', 0x00, 0x00, 0x00, datalen);
   ctr += struct.copyBytes(bytes, ctr, padding, padding.length);
   ctr += struct.pack(bytes, ctr, 'b', checksum);

   console.log('Sending bytes:', common.bytes2hex(bytes));
   return {command : buf};
 };

 var readModel = function () {

   var cmd = 0x8D;

   return {
     command: buildMedtronicPacket(SEND_MESSAGE,cmd),
     parser: function (packet) {
       var medtronicMessage = packet.slice(33);
       var messageLength = medtronicMessage[0];
       var model = struct.extractString(medtronicMessage,1,messageLength);
       return {model: model};
     }
   };
 };

 var readHistory = function () {

   var cmd = 0x80;

   return {
     command: buildMedtronicPacket(SEND_MESSAGE,cmd),
     parser: function (packet) {
       return true;
     }
   };
 };

 var readPage = function (cmd, page) {
   return {
     command: buildMedtronicPacket(SEND_MESSAGE,cmd,page),
     parser: function (packet) {
       var medtronicMessage = packet.slice(33);
       console.log('Page:', medtronicMessage);
       return true;
      }
   };
 };

 module.exports.readModel = readModel;
 module.exports.readHistory = readHistory;
 module.exports.readPage = readPage;
 module.exports.buildPaddingPacket = buildPaddingPacket;
 module.exports.buildMedtronicPacket = buildMedtronicPacket;
