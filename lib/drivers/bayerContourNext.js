var _ = require('lodash');
var async = require('async');
var moment = require('moment-timezone');
var sundial = require('sundial');
var crcCalculator = require('../crc.js');
var struct = require('../struct.js')();

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('../bows')('BCNextDriver') : debug;

module.exports = function (config) {
  var cfg = _.clone(config);
  var hidDevice = config.deviceComms;

  var STX = 0x02;
  var ETX = 0x03;

  var LINK_CTRL_MASK = {
    DISC: 0x08,
    ACK : 0x06,
    E   : 0x02,     // last bit of "expected" (receive) counter
    S   : 0x01,      // last bit of send counter
    NONE: 0x00,
    NAK : 0x15
  };

  var send_bit = 0;

  var probe = function(cb){
    debug('attempting probe of Bayer Contour Next');
    cb();
  };

  var isValidAcknowledgePacket = function(packet) {
    if (packet.packet_len !== 6) {
      debug(packet.packet_len);
      return false;
    }
    if (packet.lcb & LINK_CTRL_MASK.ACK !== LINK_CTRL_MASK.ACK) {
      debug('link ctrl mask doesn\'t validate');
      return false;
    }
    //return checkFlags(packet.lcb);
    return true;
  };

  var buildAckPacket = function() {
    return buildPacket(LINK_CTRL_MASK.NONE, 0);
  };

  var bcnCommandResponse = function (commandpacket, callback) {
    // this is a parser for the ack packet only
    var ackparser = function(packet) {
      if (!isValidAcknowledgePacket(packet)) {
        debug('ERROR expected ACK failed to validate!');
        debug(packet);
        return false;
      }
      return true;
    };

    hidDevice.send(commandpacket.packet, function () {
      // once we've sent the command, start listening for a response
      // but if we don't get one in 1 second give up
      receivePacket(1000, ackparser, function(got_ack) {
        // toggle the acknowledge bit
        send_bit ^= LINK_CTRL_MASK.S;
        // eventually should probably skip listening for second packet
        // if the first didn't validate, but for now just go on
        receivePacket(1000, commandpacket.parser, function(err, result) {
          if (err === 'TIMEOUT') {
            //TODO: puede que no necesitemos enviar un ACK de regreso y peor si es
            //      durante la recepcion
            // after parsing, ack the packet
            //var ackpacket = buildAckPacket();
            //// and toggle the expected_receive bit
            //expected_receive_bit ^= LINK_CTRL_MASK.E;
            //// now send it
            //hidDevice.send(ackpacket, function() {
            //  callback(err, result);
            //});
          } else {
            // if we timed out, just say so
            callback(err, result);
          }
        });
      });
    });
  };

  var receivePacket = function (timeout, parser, callback) {
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      debug('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(function () {
      hidDevice.receive(function(pkt) {
          debug('en receivePacket', pkt);
          //var pkt = hidDevice.nextPacket();
          // we always call the callback if we get a packet back,
          // so just cancel the timers if we do
          clearTimeout(abortTimer);
          clearInterval(listenTimer);
          pkt.parsed_payload = parser(pkt);
          callback(null, pkt);
        });
      }, 20);
  };

  var getSomeInfo = function (obj, cb) {
      debug('DEBUG: on getSomeInfo');
      cb();
  };

  var buildPacket = function (linkctrl, payloadLength, payload) {
    var datalen = payloadLength + 6; // PV TODO: 6 es un numero magico
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);
    var link = 1; // TODO: remover este bit
    var ctr = struct.pack(bytes, 0, 'bbb', STX, datalen, link);
    if (payloadLength) {
      ctr += struct.copyBytes(bytes, ctr, payload, payloadLength);
    }
    bytes[ctr++] = ETX;
    //var crc = crcCalculator.calcCRC_A(bytes, ctr);
    //struct.pack(bytes, ctr, 's', crc);
    return buf;
  };

  var buildReadRecord = function(recnum) {
      var cmd = [0x05, 0x1F, 0x00, 0x00];  // the two 0s are filled with the rec #
      if(recnum){
          struct.pack(cmd, 2, 's', recnum);
      }else{
          // PV R|N||<CR>
          struct.pack(cmd, 2, 's', 0);
      }
      return buildPacket(LINK_CTRL_MASK.NONE, cmd.length, cmd);
  };

  var getOneRecord = function (cb) {
    //var cmd = readRecordNumber(recnum);
    var cmd = buildReadRecord();
    bcnCommandResponse(cmd, function (err, result) {
      if (err) {
        debug('Failure trying to read record #');
        debug(err);
        debug(result);
        cb(err, null);
      } else {
        cb(null, result.parsed_payload);
      }
    });
  };

  return {
    // using the default detect for this driver
    // detect: function(cb) {
    // },

    // this function starts the chain, so it has to create but not accept
    // the result (data) object; it's then passed down the rest of the chain
    setup: function (deviceInfo, progress, cb) {
      console.log('in setup!');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      console.log('in connect!');
      progress(100);
      //debug('in connect!');
      /*
      var handlers = {
        packetHandler: otu2MessageHandler,
        errorHandler: otu2ErrorHandler
      };*/

      //PV add some timeout - maybe there is a better place to set this
      //on manifest is not working
      data.deviceInfo.sendTimeout = 5000;
      data.deviceInfo.receiveTimeout = 5000;

      console.info('data',data);

      cfg.deviceComms.connect(data.deviceInfo, probe, function(err) {

        if (err) {
          return cb(err);
        }

        getSomeInfo({}, function (err, result) {
          progress(100);
          data.connect = true;
          _.assign(data, result);
          cb(null, data);
        });
      });
    },

    getConfigInfo: function (progress, data, cb) {
      // get the number of records
      debug('in getConfigInfo', data);
      progress(100);
      cb(null, data);
    },

    fetchData: function (progress, data, cb) {
      function getOneRecordWithProgress(recnum, cb) {
        progress(100.0 * recnum / data.nrecs);
        setTimeout(function() {
          getOneRecord(recnum, cb);
        }, 20);
      }

      async.timesSeries(data.nrecs, getOneRecordWithProgress, function(err, result) {
        if (err) {
          debug('fetchData failed');
          debug(err);
          debug(result);
        } else {
          debug('fetchData', result);
        }
        data.fetchData = true;
        data.bgmReadings = result;
        progress(100);
        cb(err, data);
      });

    },

    processData: function (progress, data, cb) {

    },

    uploadData: function (progress, data, cb) {


    },

    disconnect: function (progress, data, cb) {

    },

    cleanup: function (progress, data, cb) {

    },

    testDriver: function(config) {

    }
  };
};
