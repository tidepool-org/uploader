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

/**
 * IOET's code start here
 * */

var _ = require('lodash');
var async = require('async');
var sundial = require('sundial');
var crcCalculator = require('../crc.js');
var struct = require('../struct.js')();
var annotate = require('../eventAnnotations');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('../bows')('BCNextDriver') : debug;


module.exports = function (config) {

  var cfg = _.clone(config);
  var serialDevice = config.deviceComms;

  var ASCII_CONTROL = {
    ACK : 0x06,
    NAK : 0x15,
    ENQ : 0x05,
    STX : 0x02,
    ETB : 0x17,
    ETX : 0x03,
    EOT : 0x04,
    TER : 0x4c
  };

    var probe = function(cb){
     debug('attempting probe EZ');
     cb();
  };

  var bcnPacketHandler = function (buffer) {

    if (buffer.len() < 1) { //empty buffer finish the data gathering
      return false;
    }

    debug('importante', buffer.len(), buffer.bytes());

    var packet = extractPacket(buffer.bytes());
    if (packet.packet_len !== 0) {
      // cleanup the buffer data
      buffer.discard(packet.packet_len);
    }

    if (packet.valid) {
      return packet;
    } else {
      return null;
    }
  };

  var buildPacket = function (command, cmdlength) {
    var datalen = cmdlength;
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);
    var ctr = struct.pack(bytes, 0, 'b', command);
    return buf;
  };

  var packetParser = function(result){
    var tostr = _.map(result,
                      function(e){
                        return String.fromCharCode(e);
                      }).join('');
    result.payload = tostr;
    return tostr;
  };

  var buildAckPacket = function() {
    return buildPacket(ASCII_CONTROL.ACK, 1);
  };

  var extractPacket = function (bytes) {
    var packet = {
      bytes: bytes,
      valid: false,
      packet_len: 0,
      payload: null
    };

    var packet_len = bytes.length;

    //discard the length byte from the begining
    packet.packet_len = packet_len;
    packet.valid = true;

    return packet;
  };


  var buildHeaderCmd = function() {
    return {
      packet: buildAckPacket(),
      parser: packetParser
    };
  };

  var parseHeader = function (s){
    var data = s.split('\n').filter(function(e){ return e.length > 1;});
    var header = data.shift();

    if(verifyChecksum(header)){
      var patient = data.shift();
      var lineFeed = data.pop();
      var pString = header.split('|');
      var pInfo = pString[4].split('^');
      var sNum = pInfo[2];
      var records = data.filter(function(e){ return e[2] === 'R';});
      var recordAverage = records.shift();
      var ordRecords = data.filter(function(e){ return e[2] === 'O';});
      var lowT = 9;
      var hiT = 601;

      var devInfo = {
        model: pInfo[0],
        serialNumber: sNum,
        nrecs: records.length,
        recordA: recordAverage,
        rawrecords: records,
        ordRecords: ordRecords,
        lowT: lowT,
        hiT: hiT
      };

      return devInfo;
    }else{
      return null;
    }
  };

  function verifyChecksum(record){
      var str = record.trim();
      var data = str.split(String.fromCharCode(ASCII_CONTROL.ETB));
      var check = data[1];
      var sum = 0;
      var n = record.slice(0, record.length - 3);

      _.map(n, function(e){
          if(e.charCodeAt(0) !== ASCII_CONTROL.STX){
              sum += e.charCodeAt(0);
          }
      });

      if((sum % 256) !== parseInt(check, 16)){
          return null;
      }else{
          return data[0];
      }
  }  


  return {
    detect: function(deviceInfo, cb){

    },

    setup: function (deviceInfo, progress, cb) {

    },

    connect: function (progress, data, cb) {

    },

    getConfigInfo: function (progress, data, cb) {

    },

    fetchData: function (progress, data, cb) {

    },

    processData: function (progress, data, cb) {
        
    },

    uploadData: function (progress, data, cb) {

    },

    disconnect: function (progress, data, cb) {

    },

    cleanup: function (progress, data, cb) {
      
    }
  };
};
