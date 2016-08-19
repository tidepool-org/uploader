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


 /*

 Command examples:

Get model number: -> 0 0 0 28 51 1 36 39 38 34 32 36 0 0 0 0 0 0 0 0 0 0 12 21 5 0 0 0 0 0 0 0 7 0 0 0 FD A7 69 84 26 8D 0 E2
Suspend:          -> 0 0 0 28 51 1 36 39 38 34 32 36 0 0 0 0 0 0 0 0 0 0 12 21 5 0 0 0 0 0 0 0 7 0 0 0 F2 A7 69 84 26 4D 0 17
                  <- ACK
                  -> 0 0 0 3C 51 1 36 39 38 34 32 36 0 0 0 0 0 0 0 0 0 0 12 21 5 0 0 0 0 0 0 0 47 0 0 0 E6 A7 69 84 26 4D 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
                  -> 0 0 0 2C 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 C9
                  <- ACK
Get history:      -> 0 0 0 28 51 1 36 39 38 34 32 36 0 0 0 0 0 0 0 0 0 0 12 21 5 0 0 0 0 0 0 0 7 0 0 0 2A A7 69 84 26 80 0 1C
                  <- ACK
                  -> 0 0 0 3C 51 1 36 39 38 34 32 36 0 0 0 0 0 0 0 0 0 0 12 21 5 0 0 0 4 10 10 0 47 0 0 0 DC A7 69 84 26 80 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
                  -> 0 0 0 2C 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 69
                  <- pages

 */

var _ = require('lodash');

 var crcCalculator = require('../crc.js');
 crcCalculator.crc8_init(0x9b);

 var struct = require('../struct.js')();
 var common = require('../commonFunctions');

 var SEND_MESSAGE = [0x12,0x21,0x05];

 var MESSAGES = {
   SUSPEND : 0x4D,
   READ_HISTORY : 0x80
 };

var getSerial = function() {
  return '698426'; // FIXME
};

 var medtronicHeader = [0xA7,parseInt(getSerial().substring(0,2),16),
                             parseInt(getSerial().substring(2,4),16),
                             parseInt(getSerial().substring(4,6),16)];

 var _sum_lsb = function(bytes) {
   var sum = 0;
   bytes.forEach(function (byte) {
     sum += byte;
   });
   return sum & 0xff;
 };

 var buildMedtronicPacket = function (type, command, parameter) {
   // first construct payload before we can determine packet length
   var payload = [];
   if(command != null) {

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

   var ctr = struct.pack(bytes, 0, '6b6z10b', 0x00, 0x00, 0x00, datalen, 0x51, 0x01, getSerial(),
                                               0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
   ctr += struct.copyBytes(bytes, ctr, type, type.length);

   var secondPacketLength = 44; //FIXME
   if(parameter != null ) {
     if (command == 0x4D) {
       ctr += struct.pack(bytes, ctr, '7bi', 0, 0, 0, 0, 0, 0, 0, payload.length+secondPacketLength);
     } else{
       //FIXME
       ctr += struct.pack(bytes, ctr, '7bi', 0,0,0, 0x04,0x10,0x10,0x00,payload.length+secondPacketLength);
     }
   } else {
     ctr += struct.pack(bytes, ctr, '7bi', 0, 0, 0, 0, 0, 0, 0, payload.length);
   }

   var checkbytes = new Uint8Array(buf.slice(4)); // checksum excludes 4-byte header
   var ctr2 = struct.copyBytes(checkbytes, ctr - 4, payload, payload.length);

   if(parameter != null) {
     var secondPacket = buildPaddingPacket(command,parameter).checksum;
     struct.pack(checkbytes, ctr2 + payload.length + 4, 'b', secondPacket);
   }
   var checksum = _sum_lsb(checkbytes);

   ctr += struct.pack(bytes, ctr, 'b', checksum);
   ctr += struct.copyBytes(bytes, ctr, payload, payload.length);

   console.log('Sending bytes:', common.bytes2hex(bytes));
   return buf;
 };


 var buildPaddingPacket = function (command, parameter) {
   var length = 43; //FIXME
   var padding = _.fill(new Array(length), 0);

   var prevPacketPadding = _.fill(new Array(20), 0);
   var checkbuf = medtronicHeader.concat(command,parameter,prevPacketPadding,padding);
   var checksum = crcCalculator.crc8_checksum(checkbuf);

   var datalen = length + 1; // include checksum
   var buf = new ArrayBuffer(datalen + 4 ); // include 4-byte header
   var bytes = new Uint8Array(buf);

   var ctr = struct.pack(bytes, 0, '4b', 0x00, 0x00, 0x00, datalen);
   ctr += struct.copyBytes(bytes, ctr, padding, padding.length);
   ctr += struct.pack(bytes, ctr, 'b', checksum);

   console.log('Padding packet:', common.bytes2hex(bytes));

   return {command : buf, checksum: checksum};
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

 var sendCommand = function (cmd) {

   return {
     command: buildMedtronicPacket(SEND_MESSAGE,cmd),
     parser: function (packet) {
       return true;
     }
   };
 };

 var readPage = function (cmd, page) {
   return {
     command1: buildMedtronicPacket(SEND_MESSAGE,cmd,page),
     command2: buildPaddingPacket(cmd,page),
     parser: function (packet) {
       var medtronicMessage = packet.slice(33);
       console.log('Page:', common.bytes2hex(medtronicMessage));
       return true;
      }
   };
 };

 module.exports.readModel = readModel;
 module.exports.sendCommand = sendCommand;
 module.exports.readPage = readPage;
 module.exports.buildMedtronicPacket = buildMedtronicPacket;
 module.exports.MESSAGES = MESSAGES;
 module.exports.getSerial = getSerial;
