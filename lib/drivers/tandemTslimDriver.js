/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014-2015, Tidepool Project
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
 var struct = require('./../struct.js')();
 var sundial = require('sundial');

 var TZOUtil = require('../TimezoneOffsetUtil');

 module.exports = function (config) {
  var cfg = config;

  var SYNC_BYTE = 0x55;

  var RESPONSES = {
    VERSION_TE: {
      value: 81,
      name: 'Version Message',
      version: 36102,
      format: '16Z16Z20.ii8Zi....8Z50.i',
      fields: ['arm_sw_ver', 'msp_sw_ver', 'pump_sn', 'pump_part_no', 'pump_rev', 'pcba_sn', 'pcba_rev', 'model_no']
    },
    COMMAND_ACK: {
      value: 123,
      name: 'Command Acknowledge',
      version: 36102,
      format: 'bb',
      fields: ['msg_id', 'success']
    },
    LOG_ENTRY_TE: {
      value: 125,
      name: 'Event History Log Entry',
      version: 36102,
      format: 'i2.hiii16B',
      fields: ['index', 'header_id', 'header_ts', 'header_log_seq_no', 'header_spare', 'tdeps'],
      postprocess: function (rec) {
        addTimestamp(rec, rec.header_ts);
        /*
          rec.header_ts = sundial.applyTimezone(BASE_TIME + rec.header_ts * sundial.SEC_TO_MSEC, cfg.timezone);
          rec.headerDeviceTime = sundial.formatDeviceTime(new Date(rec.header_ts).toISOString());
          rec.headerUtc = sundial.applyTimezone(rec.displayTime, cfg.timezone);

        */              
        var recordType = getLogRecordById(rec.header_id);
        if (recordType != null) {
          _.assign(rec, struct.unpack(rec.tdeps, 0, recordType.format, recordType.fields));
            rec.name = getLogRecordName(rec.header_id); // for debugging
            if (recordType.postprocess) {
              recordType.postprocess(rec);
            }
            delete rec.tdeps;
          }
        }
    },
    LOG_SIZE_TE: {
      value: 169,
      name: 'Event History Log Size Response',
      version: 36102,
      format: 'iii',
      fields: ['entries', 'start_seq', 'end_seq']
    },
    IDP_LIST_TE: {
      value: 174, name: 'Personal Profile List Message', version: 36102, format: 'b6b',
      fields: ['num_available',
      'slot1', /* active */  'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
    },
    // tricky. contains packed structures and fixed-length
    // zero-terminated strings. be sure to test extensively.
    IDP_TE: {
      value: 176, name: 'Personal Profile Message', version: 36102, format: 'b17zb208Bhhbb',
      fields: ['idp', 'name', 'tdep_num', 'tdeps', 'insulin_duration', 'max_bolus', 'carb_entry', 'status'],
      postprocess: function (rec) {
        rec.insulin_duration = rec.insulin_duration * sundial.MIN_TO_MSEC;
        rec.max_bolus = rec.max_bolus * 0.001;
        rec.carb_entry = rec.carb_entry ? 'carbs' : 'units';

        var tdeps = [];
        var tdep_size = struct.structlen(IDP_TDEP.format);
        for (var i = 0; i < rec.tdep_num; i++) {
          tdeps.push(IDP_TDEP.postprocess(struct.unpack(rec.tdeps, i * tdep_size, IDP_TDEP.format, IDP_TDEP.fields)));
        }
        rec.tdeps = tdeps;
      }
    },
    // GLOBALS_TE is unknown endianness on half-words
    GLOBALS_TE: {
      value: 179, name: 'Globals Report Message', version: 36102, format: 'bhhbbbbbbbb',
      fields: [
        'quickbolus_active', // 0=off, 1=active
        'quickbolus_units', // 0.001u
        'quickbolus_carbs',  // 0.001 g
        'quickbolus_iscarbs', // 0=insulin, 1=carbs
        'quickbolus_status', // bit 0,1,2,3 for active, carbs, units, entry_type, respectively
        'button_annun',
        'quickbolus_annun',
        'bolus_annun',
        'reminder_annun',
        'alert_annun',
        'alarm_annun'
      ],
      postprocess: function (rec) {
        rec.quickbolus_units = rec.quickbolus_units * 0.001;
        rec.quickbolus_carbs = rec.quickbolus_carbs * 0.001;
        rec.quickbolus_type = rec.quickbolus_iscarbs ? 'carbs' : 'units';
      }
    },
    PUMP_SETTINGS_TE: {
      value: 182,
      name: 'Pump Settings Report Message',
      version: 36102,
      format: 'bbbh..hhb.b.11..h',
      fields: ['low_insulin_threshold', 'cannula_prime_size', 'auto_shutdown_en', 'auto_shutdown_hours', 'recent_bolus_no', 'recent_temp_rate_no', 'is_pump_locked', 'oled_timeout', 'status'],
      postprocess: function (rec) {
        rec.cannula_prime_size = rec.cannula_prime_size * 0.01; // hundredths, not thousandths intentionally
        rec.auto_shutdown_duration = rec.auto_shutdown_duration * sundial.MIN_TO_MSEC * 60;
        rec.oled_timeout = rec.oled_timeout * sundial.SEC_TO_MSEC;
        if ((status&0x01) === 0) {
          delete rec.low_insulin_threshold;
        }
        if ((status&0x02) === 0) {
          delete rec.auto_shutdown_enabled;
        }
        if ((status&0x04) === 0) {
          delete rec.auto_shutdown_duration;
        }
        if ((status&0x08) === 0) {
          delete rec.cannula_prime_size;
        }
        if ((status&0x10) === 0) {
          delete rec.is_pump_locked;
        }
        if ((status&0x20) === 0) {
          delete rec.oled_timeout;
        }
      }
    },
    REMIND_SETTINGS_TE: {
      value: 185,
      name: 'Reminder Settings Report',
      version: 36102,
      format: '99Zhhbb',
      fields: ['reminders', 'low_bg_threshold', 'high_bg_threshold', 'site_change_days', 'status']
    }
  };

  var COMMANDS = {
    VERSION_REQ: {
      value: 82,
      name: 'Version Request',
      version: 36102,
      response: RESPONSES.VERSION_TE
    },
    LOG_ENTRY_SEQ_REQ: {
      value: 151,
      name: 'Event History Log Request By Sequence',
      version: 36102,
      format: 'i',
      fields: ['seqNum'],
      response: 125
    },
    LOG_ENTRY_SEQ_MULTI_REQ: {
      value: 152,
      name: 'Multiple Event History Log Request by Sequence',
      version: 47144,
      format: 'ii',
      fields: ['seqNum', 'count']
    },
    LOG_ENTRY_SEQ_MULTI_STOP_DUMP: {
      value: 153,
      name: 'Stops Multiple Event History Log Download',
      version: 47144
    },
    LOG_SIZE_REQ: {
      value: 168,
      name: 'Event History Log Size Request',
      version: 36102,
      response: RESPONSES.LOG_SIZE_TE
    },
    IDP_LIST_REQ: {
      value: 173,
      name: 'Personal Profile List Request',
      version: 36102,
      response: RESPONSES.IDP_LIST_TE
    },
    IDP_REQ: {
      value: 175,
      name: 'Personal Profile Request',
      version: 36102,
      format: 'b',
      fields: ['idp'],
      response: RESPONSES.IDP_TE
    },
    GLOBALS_REQ: {
      value: 178,
      name: 'Global Data Request',
      version: 36102,
      response: RESPONSES.GLOBALS_TE
    },
    PUMP_SETTINGS_REQ: {
      value: 181,
      name: 'Pump Settings Request',
      version: 36102,
      response: RESPONSES.PUMP_SETTINGS_TE
    },
    REMIND_SETTINGS_REQ: {
      value: 184,
      name: 'Reminder Settings Request',
      version: 36102,
      response: RESPONSES.REMIND_SETTINGS_TE
    }
  };

  var ALERT_ANNUN = {
    0: 'ANNUN_AUDIO_HIGH',
    1: 'ANNUN_AUDIO_MED',
    2: 'ANNUN_AUDIO_LOW',
    3: 'ANNUN_VIBE'
  };

  var PUMP_LOG_RECORDS = {
    LID_BASAL_RATE_CHANGE: {
      value: 0x03,
      name: 'Basal Rate Change Event',
      format: 'fffhb.',
      fields: ['command_basal_rate', 'base_basal_rate', 'max_basal_rate', 'idp', 'change_type'],
      postprocess: function(rec) {
        switch(rec.change_type) {
          case 1:
            rec.change_type = 'timed_segment';
            break;
          case 2:
            rec.change_type = 'new_profile';
            break;
          case 4:
            rec.change_type = 'temp_rate_start';
            break;
          case 8:
            rec.change_type = 'temp_rate_end';
            break;
          case 16:
            rec.change_type = 'pump_suspended';
            break;
          case 32:
            rec.change_type = 'pump_resumed';
            break;
          case 64:
            rec.change_type = 'pump_shut_down';
            break;
          default:
            console.log ('unhandled change_type in ', rec);
        }
      }
    },
    LID_BG_READING_TAKEN: {
      value: 0x10,
      name: 'BG Taken Event',
      format: 'h..fhh....',
      fields: ['bg', 'iob', 'target_bg', 'isf']
    },
    LID_BOLEX_ACTIVATED: {
      value: 0x3B,
      name: 'Extended Bolus Activated Event',
      format: 'h..ff....',
      fields: ['bolus_id', 'iob', 'bolex_size']
    },
    LID_BOLEX_COMPLETED: {
      value: 0x15,
      name: 'Extended Portion of a Bolus Complete Event',
      format: '..hfff',
      fields: ['bolus_id', 'iob', 'bolex_insulin_delivered', 'bolex_insulin_requested']
    },
    LID_BOLUS_ACTIVATED: {
      value: 0x37,
      name: 'Bolus Activated Event',
      format: 'h..ff....',
      fields: ['bolus_id', 'iob', 'bolus_size']
    },
    LID_BOLUS_COMPLETED: {
      value: 0x14,
      name: 'Bolus Completed Event',
      format: '..hfff',
      fields: ['bolus_id', 'iob', 'insulin_delivered', 'insulin_requested']
    },
    LID_BOLUS_REQUESTED_MSG1: {
      value: 0x40,
      name: 'Bolus Requested Event 1 of 3',
      format: 'hbbhhfi',
      fields: ['bolus_id', 'bolus_type', 'correction_bolus_included', 'carb_amount', 'bg', 'iob', 'carb_ratio'],
      postprocess: function (rec) {
        rec.carb_ratio = rec.carb_ratio * 0.001;
      }
    },
    LID_BOLUS_REQUESTED_MSG2: {
      value: 0x41,
      name: 'Bolus Requested Event 2 of 3',
      format: 'hbbh..hhbb..',
      fields: ['bolus_id', 'options', 'standard_percent', 'duration', 'isf', 'target_bg', 'user_override', 'declined_correction'],
      postprocess: function (rec) {
        if (rec.options === 0) {
          rec.type = 'standard';
        }
        else if (rec.options === 1) {
          rec.type = 'extended';
        }
        else if (rec.options == 2) {
          rec.type = 'quickbolus';
        }
        rec.duration = rec.duration * sundial.MIN_TO_MSEC;
      }
    },
    LID_BOLUS_REQUESTED_MSG3: {
      value: 0x42,
      name: 'Bolus Requested Event 3 of 3',
      format: 'h..fff',
      fields: ['bolus_id', 'food_bolus_size', 'correction_bolus_size', 'total_bolus_size']
    },
    LID_CANNULA_FILLED: {
      value: 0x3D,
      name: 'Cannula Filled Event',
      format: 'f............',
      fields: ['prime_size']
    },
    LID_CARB_ENTERED: {
      value: 0x30,
      name: 'Carbs Entered Event',
      format: 'f............',
      fields: ['carbs']
    },
    LID_CARTRIDGE_FILLED: {
      value: 0x21,
      name: 'Cartridge Filled Event',
      format: 'if........',
      fields: ['insulin_display', 'insulin_actual']
    },
    LID_CORRECTION_DECLINED: {
      value: 0x5D,
      name: 'Correction Declined Event',
      format: 'hhfhh........',
      fields: ['bg', 'bolus_id', 'iob', 'target_bg', 'isf']
    },
    LID_DAILY_BASAL: {
      value: 0x51,
      name: 'Daily Basal Event',
      format: 'fff.bh',
      fields: ['daily_total_basal', 'last_basal_rate', 'iob', 'actual_battery_charge', 'lipo_mv']
    },
    LID_DATA_LOG_CORRUPTION: {
      value: 0x3C,
      name: 'Data Log Corruption Event',
      format: '................',
      fields: []
    },
    LID_DATE_CHANGED: {
      value: 0x0E,
      name: 'Date Change Event',
      format: 'ii........',
      fields: ['date_prior', 'date_after']
    },
    LID_FACTORY_RESET: {
      value: 0x52,
      name: 'Factory Reset Event',
      format: '.............',
      fields: []
    },
    LID_IDP: {
      value: 0x45,
      name: 'Personal Profile Add/Delete Event 1 of 2',
      format: 'bbb.....8Z',
      fields: ['idp', 'status', 'source_idp', 'name_start'],
      postprocess: function (rec) {
        switch (rec.status) {
          case 0:
            rec.operation = 'new';
            break;
          case 1:
            rec.operation = 'copy';
            break;
          case 2:
            rec.operation = 'delete';
            break;
          case 3:
            rec.operation = 'activate';
            break;
          case 4:
            rec.operation = 'rename';
            break;
          default:
            console.log('unhandled operation in profile event', rec);
            rec.operation = 'unknown';
        }
      }
    },
    LID_IDP_BOLUS: {
      value: 0x46,
      name: 'Personal Profile Bolus Data Change Event',
      format: 'bbb.hhb.......',
      fields: ['idp', 'modification', 'bolus_status', 'insulin_duration', 'max_bolus_size', 'bolus_entry_type'],
      postprocess: function(rec) {
        rec.insulin_duration = rec.insulin_duration * sundial.MIN_TO_MSEC;
        rec.max_bolus_size = rec.max_bolus_size * 0.001;
        // TODO: status
      }
    },
    LID_IDP_LIST: {
      value: 0x47,
      name: 'Personal Profile List Event',
      format: 'b...bbbbbb......',
      fields: ['num_profiles', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
    },
    LID_IDP_MSG2: {
      value: 0x39,
      name: 'Personal Profile Add/Delete Event 2 of 2',
      format: 'b.......8Z',
      fields: ['idp', 'name_end']
    },
    LID_IDP_TD_SEG: {
      value: 0x44,
      name: 'Personal Profile Time Dependent Segment Event',
      format: 'bbbbhhhhi1',
      fields: ['idp', 'status', 'segment_index', 'modification_type', 'start_time', 'basal_rate', 'isf', 'target_bg', 'carb_ratio'],
      postprocess: function(rec) {
        rec.start_time = rec.start_time * sundial.MIN_TO_MSEC;
        rec.basal_rate = rec.basal_rate * 0.001;
        rec.carb_ratio = rec.carb_ratio * 0.001;
        // TODO: status
      }
    },
    LID_LOG_ERASED: {
      value: 0x00,
      name: 'Log Erased Event',
      format: 'i............',
      fields: ['num_erased']
    },
    LID_NEW_DAY: {
      value: 0x5A,
      name: 'New Day Event',
      format: 'f............',
      fields: ['commanded_basal_rate']
    },
    LID_PARAM_GLOBAL_SETTINGS: {
      value: 0x4A,
      name: 'Global Settings Change Event',
      format: 'bbbbhhbbbbbb..',
      fields: ['modified_data', 'qb_data_status', 'qb_active', 'qb_data_entry_type', 'qb_increment_units', 'qb_increment_carbs', 'button_volume', 'qb_volume', 'bolus_volume', 'reminder_volume', 'alert_volume'],
      postprocess: function(rec) {
        rec.qb_increment_units = rec.qb_increment_units * 0.001;
        rec.qb_increment_carbs = rec.qb_increment_carbs * 0.001;
        // TODO: status
      }
    },
    LID_PARAM_PUMP_SETTINGS: {
      value: 0x49,
      name: 'Pump Parameter Change Event',
      format: 'b.hbbbb.bh....',
      fields: ['modification', 'status', 'low_insulin_threshold', 'cannula_prime_size', 'is_feature_locked', 'auto_shutdown_enabled', 'oled_timeout', 'auto_shutdown_duration'],
      postprocess: function(rec) {
        rec.cannula_prime_size = rec.cannula_prime_size * 0.01;
        rec.oled_timeout = rec.oled_timeout * sundial.SEC_TO_MSEC;
        rec.auto_shutdown_duration = rec.auto_shutdown_duration * sundial.MIN_TO_MSEC * 60;
        // TODO: status
      }
    },
    LID_PARAM_REM_SETTINGS: {
      value: 0x61,
      name: 'Reminder Parameter Change Event',
      format: 'bb..hhb.......',
      fields: ['modification', 'status', 'low_bg_threshold', 'high_bg_threshold', 'site_change_days'],
      postprocess: function(rec) {
        // TODO: status
      }
    },
    LID_PARAM_REMINDER: {
      value: 0x60,
      name: 'Reminder Time Based Parameter Change Event',
      format: 'bbbbihhb...',
      fields: ['modification', 'reminder_id', 'status', 'enable', 'frequency_minutes', 'start_time', 'end_time', 'active_days'],
      postprocess: function(rec) {
        // TODO: status
      }
    },
    LID_PUMPING_RESUMED: {
      value: 0x0C,
      name: 'Pumping Resumed Event',
      format: '....h..........',
      fields: ['insulin_amount']
    },
    LID_PUMPING_SUSPENDED: {
      value: 0x0B,
      name: 'Pumping Suspended Event',
      format: '....h..........',
      fields: ['insulin_amount']
    },
    LID_TEMP_RATE_ACTIVATED: {
      value: 0x02,
      name: 'Temporary Basal Rate Activated Event',
      format: 'ff..h....',
      fields: ['percent', 'duration', 'temp_rate_id'],
      postprocess: function(rec) {
        rec.percent = rec.percent/100;
      }
    },
    LID_TEMP_RATE_COMPLETED: {
      value: 0x0F,
      name: 'Temporary Basal Rate Completed Event',
      format: '..hi........',
      fields: ['temp_rate_id', 'time_left']
    },
    LID_TIME_CHANGED: {
      value: 0x0D,
      name: 'Time Change Event',
      format: 'ii........',
      fields: ['time_prior', 'time_after']
    },
    LID_TUBING_FILLED: {
      value: 0x3F,
      name: 'Tubing Filled Event',
      format: 'f............',
      fields: ['prime_size']
    },
    LID_USB_CONNECTED: {
      value: 0x24,
      name: 'USB Connected Event',
      format: 'f............',
      fields: ['negotiated_current_mA']
    },
    LID_USB_DISCONNECTED: {
      value: 0x25,
      name: 'USB Disconnected Event',
      format: 'f............',
      fields: ['negotiated_current_mA']
    },
    LID_USB_ENUMERATED: {
      value: 0x43,
      name: 'USB Enumerated Event',
      format: 'f............',
      fields: ['negotiated_current_mA']
    }
  };

  var IDP_TDEP = {
    name: 'Time Dependent Settings Segment Structure',
    format: 'hhihhb',
    fields: ['startTime', 'basalRate', 'carbRatio', 'TargetBG', 'ISF', 'status'],
    postprocess: function(rec) {
      rec.startTime = rec.startTime * sundial.MIN_TO_MSEC;
      rec.basalRate = rec.basalRate * 0.001;
      rec.carbRatio = rec.carbRatio * 0.001;
      // TODO status
      return rec;
    }
  };

  var BASE_TIME = Date.UTC(2008, 0, 1, 0, 0, 0).valueOf(); /* new Date(2008, 0, 1, 0, 0, 0).valueOf();*/
  var addTimestamp = function (o, rawTime) {
    o.rawTimestamp = BASE_TIME + rawTime * sundial.SEC_TO_MSEC;
    o.timestamp = sundial.applyTimezone(new Date(o.rawTimestamp), cfg.timezone).toISOString();
    o.deviceTime = sundial.formatDeviceTime(new Date(o.rawTimestamp));
    o.timezoneOffset = sundial.getOffsetFromZone(o.timestamp, cfg.timezone);
  };

  // This is a particularly weak checksum algorithm but that's what Insulet and Tandem use...
  var weakChecksum = function (bytes, offset, count) {
    var total = 0;
    for (var i = 0; i < count; ++i) {
      total += bytes[i+offset];
    }
    return total & 0xFFFF;
  };

  var _getName = function (list, idx) {
    for (var i in list) {
      if (list[i].value == idx) {
        return list[i].name;
      }
    }
    return 'UNKNOWN!';
  };

  var _getItem = function (list, idx) {
    for (var i in list) {
      if (list[i].value == idx) {
        return list[i];
      }
    }
    return null;
  };

  var getCommandName = function (idx) {
    return _getName(COMMANDS, idx);
  };

  var getResponseName = function (idx) {
    return _getName(RESPONSES, idx);
  };

  var getResponseById = function (idx) {
    return _getItem(RESPONSES, idx);
  };

  var getLogRecordName = function (idx) {
    return _getName(PUMP_LOG_RECORDS, idx);
  };

  var getLogRecordById = function (idx) {
    return _getItem(PUMP_LOG_RECORDS, idx);
  };

    // builds a command in an ArrayBuffer
    // the first byte is always 0x55 (SYNC),
    // the second byte is the command descriptor,
    // the third and fourth bytes are a little-endian payload length.
    // then comes the payload,
    // finally, it's followed with a 2-byte little-endian CRC of all the bytes
    // up to that point.
    // payload is any indexable array-like object that returns Numbers

    var buildPacket = function (descriptor, payloadLength, payload) {
      var buf = new ArrayBuffer(payloadLength + 9);
      var bytes = new Uint8Array(buf);
      var ctr = struct.pack(
        bytes,
        0,
        'bbb',
        SYNC_BYTE,
        descriptor.value,
        payloadLength
      );
      ctr += struct.copyBytes(bytes, ctr, payload, payloadLength);
      var checksum = weakChecksum(bytes, 1, ctr - 1);
      struct.pack(bytes, ctr, 'IS', 0, checksum); // the checksum is big-endian and timestamp always 0
      // console.log('Built packet for ', descriptor.name, '"', bytes, '"');
      return buf;
    };

    // accepts a stream of bytes and tries to find a Tandem packet
    // at the beginning of it. in no case should there be fewer than 9 bytes
    // in the bytestream.
    // returns a packet object; if valid == true it's a valid packet
    // if packet_len is nonzero, that much should be deleted from the stream
    // if valid is false and packet_len is nonzero, the previous packet
    // should be NAKed.
    var extractPacket = function (bytes) {
      var packet = {
        valid: false,
        sync: 0,
        descriptor: 0,
        payload_len: 0,
        payload: null,
        crc: 0,
        packet_len: 0,
        body: null
      };

      var plen = bytes.length;
      if (plen < 9) {
        return packet;
      }

      // we know we have at least enough to check the packet header, so do that
      struct.unpack(bytes, 0, 'bbb', ['sync', 'descriptor', 'payload_len'], packet);
      //console.log ('packet:', packet);
      // if the first byte isn't our sync byte, then just discard that
      // one byte and let our caller try again.
      if (packet.sync != SYNC_BYTE) {
        packet.packet_len = 1;
        return packet;
      }

      var need_len = packet.payload_len + 9;
      if (need_len > plen) {
        return packet;  // we don't have enough yet so go back for more
      }
      packet.packet_len = need_len;

      // we now have enough length for a complete packet, so calc the CRC
      packet.crc = struct.extractBEShort(bytes, packet.packet_len - 2);
      var checksum = weakChecksum(bytes, 1, packet.packet_len - 3);
      if (checksum != packet.crc) {
        // if the crc is bad, we should discard the whole packet
        // (packet_len is nonzero)
        console.log('Bad Checksum!');
        console.log('checksums:', packet.crc, checksum);
        return packet;
      }

      //console.log('pl_len:', packet.payload_len);

      if (packet.payload_len) {
        packet.payload = new Uint8Array(packet.payload_len);
        for (var i = 0; i < packet.payload_len; ++i) {
          packet.payload[i] = bytes[i + 3];
        }
        var response = getResponseById(packet.descriptor);
        //console.log('response:', response, packet);
        if (response && response.fields && response.format) {
          packet.payload = struct.unpack(bytes, 3, response.format, response.fields);
          if (response.postprocess) {
            response.postprocess(packet.payload);
            //console.log('payload:', packet.payload);
          }
        }
      }
      addTimestamp(packet, struct.extractBEInt(bytes, packet.packet_len - 6));
      packet.valid = true;
      //console.log(packet);
      return packet;
    };

    var tandemPacketHandler = function (buffer) {
      // console.log('in tandemPacketHandler');
      // first, discard bytes that can't start a packet
      var discardCount = 0;
      while (buffer.len() > discardCount && buffer.get(0) != SYNC_BYTE) {
        ++discardCount;
      }
      if (discardCount) {
        //console.log('discarded '+ discardCount + ' bytes from ', buffer.bytes());
        buffer.discard(discardCount);
      }

      if (buffer.len() < 9) { // all complete packets must be at least this long
        //console.log('aborting, buffer only ', buffer.len());
        return null; // not enough there yet
      }

      // there's enough there to try, anyway
      //console.log('extractPacket on ', buffer.bytes());
      var packet = extractPacket(buffer.bytes());
      if (packet.packet_len !== 0) {
        // console.log('discarding processed packet of '+packet.packet_len);
        // remove the now-processed packet
        buffer.discard(packet.packet_len);
      }

      if (packet.valid) {
        return packet;
      }
      else {
        return null;
      }
    };

    var listenForPacket = function (timeout, callback) {
      var abortTimer = setTimeout(function () {
        clearInterval(listenTimer);
        console.log('abortTimer TIMEOUT');
        callback('TIMEOUT', null);
      }, timeout);

      var listenTimer = setInterval(function () {
        //console.log('awaiting packets');
        while (cfg.deviceComms.hasAvailablePacket()) {
          //console.log('packet found');
          var pkt = cfg.deviceComms.nextPacket();
          if (pkt.valid) {
            clearTimeout(abortTimer);
            clearInterval(listenTimer);
            return callback(null, pkt);
          }
        }
      }, 10); // spin on this one quickly
    };

    var tandemCommand = function (command, args, callback) {
      var format = command.format;
      var payload;
      var payload_len = 0;
      if (format) {
        payload_len = struct.structlen(format);
        payload = new Uint8Array(payload_len);
        struct.pack(payload, 0, format, args);
      }

      var commandPacket = buildPacket(command, payload_len, payload);
      // console.log ('Writing packet', new Uint8Array(commandPacket));
      cfg.deviceComms.writeSerial(commandPacket, callback);
    };

    var tandemLogRequester = function (start, end, callback) {
      // TODO implement and test multi-record download commands (my pump doesn't support the command) -- Matthias

      console.log('tandemLogRequester', start, end);
      console.log(new Date());
      var send_seq = start;
      var receive_seq = start;
      var alarm_seq = -1;
      var recovering = false;
      var delay = [];
      var abortCallback = function () {
        if (alarm_seq == receive_seq) {
          console.log('no activity in 5 seconds');
          clearInterval(sendTimer);
          clearInterval(listenTimer);

          callback('TIMEOUT', null);
        }
        else {
          alarm_seq = receive_seq;
          abortTimer = setTimeout(abortCallback, 5000);
        }
      };
      var abortTimer = setTimeout(abortCallback, 5000); // timeout after 10 seconds

      var sendTimer = setInterval(function () {
        if (send_seq % 1000 === 0) {
          console.log('requesting', send_seq);
        }
        if (!recovering) {
          tandemCommand(COMMANDS.LOG_ENTRY_SEQ_REQ, [send_seq++], function () {});
        }
        if (send_seq > end) {
          clearInterval(sendTimer);
        }
      }, 1);

      var listenTimer = setInterval(function () {
        //console.log('awaiting packets');
        while (cfg.deviceComms.hasAvailablePacket()) {
          var processPacket = function (pkt) {
            if (pkt.valid &&
              pkt.descriptor == RESPONSES.LOG_ENTRY_TE.value &&
              pkt.payload['header_log_seq_no'] >= receive_seq) {
              if (receive_seq != pkt.payload['header_log_seq_no']) {
                if (!recovering) {
                  recovering = true;
                  send_seq = receive_seq + 1;
                  console.log('recovering', receive_seq);
                  tandemCommand(COMMANDS.LOG_ENTRY_SEQ_REQ, [receive_seq], function () {});
                } // drop out-of-order packets on the floor.  They will be re-requested.
              }
              else {
                if (recovering) {
                  console.log('recovered', receive_seq, pkt);
                }
                receive_seq = pkt.payload['header_log_seq_no'] + 1;
                recovering = false;
                if (receive_seq % 1000 === 0) {
                  console.log('received', receive_seq);
                }
                callback(null, pkt);
                if (receive_seq > end) {
                  console.log('end tandemLogRequester');
                  clearInterval(listenTimer);
                  clearTimeout(abortTimer);
                  console.log(Date());
                }
              }
            }
          };
          processPacket(cfg.deviceComms.nextPacket());
          delay.forEach(processPacket);
        }
      }, 1);
    };

  var tandemCommandResponse = function (command, args, callback) {
    tandemCommand(command, args, function () {
      // once we've sent the command, start listening for a response
      // but if we don't get one in 2 seconds give up
      listenForPacket(2000, callback);
    });
  };

  // callback is called when EOF happens with all records retrieved
  var tandemDownloadRecords = function (progress, data, callback) {
    //console.log('in tandemDownloadRecords');
    var retval = [];
    var entries;
    var end_seq;
    var start_seq;

    function iterate(err, result) {
      if (err) {
        console.log('error retrieving record', result);
        callback(err, null);
      }
      else {
        if (!result.payload.tdeps) {
          retval.push(result.payload);
        } 
        if (result.payload.header_log_seq_no == end_seq) {
          console.log('fetched all records');
          data.log_records = retval;
          callback(null, data);
        }
      }
    }

    console.log('requesting log size');
    tandemCommandResponse(COMMANDS.LOG_SIZE_REQ, null, function (err, result) {
      //console.log ('log req finished', err, result);
      if (err) {
        console.log('Error reading log size', err);
        callback(err, null);
      }
      else {
        //console.log ('received', result);
        if (result.valid && (result.descriptor == RESPONSES.LOG_SIZE_TE.value)) {
          entries = result.payload['entries'];
          end_seq = result.payload['end_seq'];
          // TODO change this back before merging
          // start_seq = result.payload['start_seq']; // limit to 3000 for debugging
          start_seq = result.payload['end_seq'] - 5000;
          tandemLogRequester(start_seq, end_seq, iterate);
        }
      }
    });
  };

  var tandemFetch = function (progress, data, callback) {
    tandemDownloadRecords(progress, data, function (err, retval) {
      if (err) {
        console.log('fetch failed');
        callback(err, null);
      } else {
        console.log(retval);
        tandemFetchSettings(progress, data, function () {
          callback(null, data);
        });
      }
    });
  };

  var tandemFetchSettings = function (progress, data, callback) {
    var profile_ids = [];
    var parsed_profiles = [];

    function iterate(err, result) {
      if (err) {
        console.log('error reading profile');
        callback(err, null);
      }
      else {
        if (result.valid && result.descriptor == RESPONSES.IDP_TE.value) {
          parsed_profiles.push(result.payload);
          var profile_id = profile_ids.shift();
          if (profile_id === undefined) {
            data.profiles = parsed_profiles;
            console.log('parsed profiles', parsed_profiles);
            callback(null, data);
          }
          else {
            console.log('profiles', parsed_profiles);
            tandemCommandResponse(COMMANDS.IDP_REQ, [profile_id], iterate);
          }
        }
      }
    }

    tandemCommandResponse(COMMANDS.GLOBALS_REQ, null, function (err, pkt) {
      if (err) {
        console.log('Error reading globals', err);
        callback(err, null);
      }
      else {
        tandemCommandResponse(COMMANDS.IDP_LIST_REQ, null, function (err, pkt) {
          if (err) {
            console.log('Error reading globals', err);
            callback(err, null);
          }
          else {
            var num_profiles = pkt.payload['num_available'];
            for (var i = 1; i <= num_profiles; i++) {
              profile_ids.push(pkt.payload['slot' + i]);
            }
            tandemCommandResponse(COMMANDS.IDP_REQ, [profile_ids.shift()], iterate);
          }
        });
      }
    });
  };

  var filterLogEntries = function(types, log_records) {
    var neededLogIds = [];
    types.forEach(function(element) { neededLogIds.push(element.value); });
    return log_records.filter(function (record) {
      return neededLogIds.indexOf(record.header_id) >= 0;
    });
  };

  var buildSettingsRecords = function buildSettingsRecord(data, postrecords) {
    var activeName = data.profiles[0].name;
    var basalSchedules = {};
    var carbSchedules = {}; // TODO only basal schedules are represented as profile-dependent in tidepool
    var sensitivitySchedules = {}; // TODO only basal schedules are represented as profile-dependent in tidepool
    var targetSchedules = {}; // TODO only basal schedules are represented as profile-dependent in tidepool
    data.profiles.forEach(function(profile) {
      var scheduleName = profile.name;
      var schedule = [];
      var carbSchedule = [];
      var sensitivitySchedule = [];
      var targetSchedule = [];
      profile.tdeps.forEach(function(tdep) {
        schedule.push( {rate: Math.fround(tdep['basalRate']), start: tdep['startTime']} );
        carbSchedule.push( {amount: Math.fround(tdep['carbRatio']), start: tdep['startTime']} );
        sensitivitySchedule.push( {amount: tdep['ISF'], 'start': tdep['startTime']} );
        targetSchedule.push( {low: tdep['TargetBG'], high: tdep['TargetBG'], start: tdep['startTime']} );
      });
      basalSchedules[scheduleName] = schedule;
      carbSchedules[scheduleName] = carbSchedule;
      sensitivitySchedules[scheduleName] = sensitivitySchedule;
      targetSchedules[scheduleName] = targetSchedule;
    });

    var postsettings = cfg.builder.makePumpSettings()
      .with_activeSchedule(activeName)
      .with_units({ carb: 'grams', bg: 'mg/dL' })
      .with_basalSchedules(basalSchedules)
      .with_carbRatio(carbSchedules[activeName])
      .with_insulinSensitivity(sensitivitySchedules[activeName])
      .with_bgTarget(targetSchedules[activeName])
      .with_time(data.log_records[data.log_records.length - 1].timestamp)
      .with_deviceTime(data.log_records[data.log_records.length - 1].deviceTime)
      .with_timezoneOffset(data.log_records[data.log_records.length - 1].timezoneOffset)
      .with_conversionOffset(0)
      .done();

    postsettings.jsDate = new Date(data.log_records[data.log_records.length - 1].rawTimestamp);
    cfg.tzoUtil.fillInUTCInfo(postsettings, postsettings.jsDate);
    postrecords.push(postsettings);

    var records = filterLogEntries([PUMP_LOG_RECORDS.LID_IDP, PUMP_LOG_RECORDS.LID_IDP_BOLUS,
      PUMP_LOG_RECORDS.LID_IDP_LIST, PUMP_LOG_RECORDS.LID_IDP_MSG2, PUMP_LOG_RECORDS.LID_IDP_TD_SEG,
      PUMP_LOG_RECORDS.LID_PARAM_GLOBAL_SETTINGS], data.log_records);
    //console.log(records);
    //console.log(postrecords);
    return postrecords;
  };

  var buildTimeChangeRecords = function (data, postrecords) {
    var timeChangeLogs = filterLogEntries([PUMP_LOG_RECORDS.LID_TIME_CHANGED, PUMP_LOG_RECORDS.LID_DATE_CHANGED],
      data.log_records);

    timeChangeLogs.forEach(function(change) {
      var change_ts = change.header_ts;
        //console.log(change);
        var fromTime = change_ts - sundial.floor(change_ts, 'day', cfg.timezone);
        var toTime = fromTime;
        var fromDay = sundial.floor(change_ts, 'day', cfg.timezone); //TODO this doesn't appear to actually work because of UTC issues.
        var toDay = fromDay;
        if (change.header_id == PUMP_LOG_RECORDS.LID_DATE_CHANGED.value) {
          toDay =  BASE_TIME + change.date_after * sundial.MIN_TO_MSEC * 60 * 24;
          fromDay = BASE_TIME + change.date_prior * sundial.MIN_TO_MSEC * 60 * 24;
        }
        else if (change.header_id == PUMP_LOG_RECORDS.LID_TIME_CHANGED.value) {
          toTime = change.time_after;
          fromTime = change.time_prior;
        }
        change.jsDate = new Date(change.rawTimestamp);
        var lastIndex = change.index;
        change = cfg.builder.makeDeviceEventTimeChange()
          .with_time(change.timestamp)
          .with_deviceTime(change.deviceTime)
          .with_timezoneOffset(change.timezoneOffset)
          .with_conversionOffset(0)
          .with_change({
            from: sundial.formatDeviceTime(new Date(fromTime + fromDay.valueOf()).toISOString()),
            to: sundial.formatDeviceTime(new Date(toTime + toDay.valueOf()).toISOString()),
            agent:'manual'
          });
        change.index = lastIndex;  
        change.done();
        console.log(change, fromTime, fromDay, fromTime + fromDay.valueOf(), toTime, toDay, toDay.valueOf() + toTime);
        postrecords.push(change);
    });

    var tzoUtil;
    if (postrecords.length > 0) {
     tzoUtil = new TZOUtil(cfg.timezone, postrecords[0].time, postrecords);
    }
    else {
      tzoUtil = new TZOUtil(cfg.timezone, data.log_records[data.log_records.length - 1].timestamp, postrecords);
    }

    cfg.tzoUtil = tzoUtil;
    return postrecords;
  };

  var buildBolusRecords = function (data, records) {
    var bolusLogs = filterLogEntries([PUMP_LOG_RECORDS.LID_BOLUS_ACTIVATED, PUMP_LOG_RECORDS.LID_BOLUS_COMPLETED,
      PUMP_LOG_RECORDS.LID_BOLEX_ACTIVATED, PUMP_LOG_RECORDS.LID_BOLEX_COMPLETED,
      PUMP_LOG_RECORDS.LID_BOLUS_REQUESTED_MSG1, PUMP_LOG_RECORDS.LID_BOLUS_REQUESTED_MSG2,
      PUMP_LOG_RECORDS.LID_BOLUS_REQUESTED_MSG3],
      data.log_records);
    console.log(bolusLogs);
    var boluses = {};
    bolusLogs.forEach(function(event) {
      var bolusId = event.bolus_id;
      var bolus = _.defaults({bolus_id: bolusId}, boluses[bolusId], event);
      bolus.jsDate = new Date(bolus.rawTimestamp);
      cfg.tzoUtil.fillInUTCInfo(bolus, bolus.jsDate);
      if (event.header_id == PUMP_LOG_RECORDS.LID_BOLUS_ACTIVATED.value ||
        event.header_id == PUMP_LOG_RECORDS.LID_BOLEX_ACTIVATED.value) {
        bolus.startDeviceTime = event.deviceTime;
        bolus.startUtc = event.timestamp;
      }
      if (event.header_id == PUMP_LOG_RECORDS.LID_BOLUS_REQUESTED_MSG1.value) {
        bolus.bc_iob = event.iob;
        bolus.wizardDeviceTime = event.deviceTime;
        bolus.wizardUtc = event.timestamp;
      }
      boluses[bolusId] = bolus;
    });
    for (var key in boluses) {
      var bolus = boluses[key];
      var record;

      // bolus records
      if (bolus.bolex_size !== undefined || bolus.type == 'extended') {
        if (bolus.bolus_size !== undefined || bolus.bolus_insulin_requested !== undefined) {
          record = cfg.builder.makeDualBolus();
        }
        else {
          record = cfg.builder.makeSquareBolus();
        }
      }
      else {
        record = cfg.builder.makeNormalBolus();
      }
      record = record.with_time(bolus.timestamp)
        .with_deviceTime(bolus.deviceTime)
        .with_timezoneOffset(bolus.timezoneOffset)
        .with_conversionOffset(bolus.conversionOffset);
      if (bolus.bolex_size !== undefined) {
        record = record.with_duration(bolus.duration)
          .with_extended(bolus.bolex_insulin_delivered);
        if (bolus.bolex_size != bolus.bolex_insulin_delivered) {
          if (bolus.bolex_insulin_delivered === undefined) { // cancelled before any insulin was given on dual bolus
            record = record.with_extended(0);
          }
          record = record.with_expectedExtended(bolus.bolex_size)
            .with_expectedDuration(bolus.duration);
        }
      }
      if (bolus.bolus_size !== undefined || bolus.insulin_delivered !== undefined) {
        record = record.with_normal(bolus.insulin_delivered);
        if (bolus.bolus_size != bolus.insulin_delivered) {
          record = record.expectedNormal(bolus.bolex_size);
        }
      }
      if ((bolus.type == 'standard' || bolus.type == 'quickbolus') &&
        bolus.bolus_size === undefined) { // cancelled before any insulin was given
        record.with_normal(0)
          .with_expectedNormal(bolus.insulin_requested);
      }
      if (bolus.type == 'extended' && bolus.bolex_size === undefined) { // cancelled before any insulin was given
        record.with_duration(0)
          .with_extended(0)
          .with_expectedDuration(bolus.duration)
          .with_expectedExtended(bolus.bolex_insulin_requested);
      }
      console.log(boluses[key], record);
      records.push(record.done());

      // wizard records
      if (bolus.total_bolus_size !== undefined && bolus.target_bg !== 0 && bolus.target_bg) {
        var wizard_record = cfg.builder.makeWizard()
          .with_time(bolus.wizardUtc)
          .with_deviceTime(bolus.wizardDeviceTime)
          .with_timezoneOffset(record.timezoneOffset)
          .with_conversionOffset(record.conversionOffset)
          .with_recommended({
            carb: bolus.food_bolus_size,
            correction: bolus.correction_bolus_size,
            net: bolus.total_bolus_size
          })
          .with_bgInput(bolus.bg)
          .with_carbInput(bolus.carb_amount)
          .with_insulinOnBoard(bolus.bc_iob)
          .with_insulinCarbRatio(bolus.carb_ratio)
          .with_insulinSensitivity(bolus.isf)
          .with_bgTarget({
            low: bolus.target_bg,
            high: bolus.target_bg,
            target: bolus.target_bg
          })
          .with_bolus(record)
          .with_units('mg/dL')
          .done();
        records.push(wizard_record);
      }
    }
    console.log('Bolus records:', records);
    return records;
  };

  var buildBasalRecords = function (data, records) {
    var makeTempBasal = function(event, suppressed, currentTemp) {
      event.jsDate = new Date(event.rawTimestamp);
      cfg.tzoUtil.fillInUTCInfo(event, event.jsDate);
      return cfg.builder.makeTempBasal() // TODO verify that this handles canceled temps properly
        .with_time(event.timestamp)
        .with_deviceTime(event.deviceTime)
        .with_timezoneOffset(event.timezoneOffset)
        .with_conversionOffset(event.conversionOffset)
        .with_rate(event.command_rate)
        .with_percent(currentTemp.percent)
        .with_duration(event.duration)
        .with_previous(suppressed)
        .with_suppressed(suppressed);
    };
    var makeScheduledBasal = function(event, previous) {
      var singlePrevious = previous ? _.omit(previous, 'previous') : undefined;
      event.jsDate = new Date(event.rawTimestamp);
      cfg.tzoUtil.fillInUTCInfo(event, event.jsDate);
      return cfg.builder.makeScheduledBasal()
        .with_scheduleName('profile_' + event.idp)
        .with_time(event.timestamp)
        .with_deviceTime(event.deviceTime)
        .with_timezoneOffset(event.timezoneOffset)
        .with_conversionOffset(event.conversionOffset)
        .with_rate(event.base_basal_rate)
        .with_previous(singlePrevious);
    };
    var finalizeBasal = function(event, basal, currentTemp) {
      var duration = new Date(event.timestamp).valueOf() - new Date(basal.time).valueOf();
      console.log('duration:', duration);
      if (duration != basal.duration) {
        if (currentTemp) {
          basal.with_duration(currentTemp.actualDuration)
            .with_expectedDuration(currentTemp.expectedDuration);
        }
        else {
          basal.with_duration(duration);
        }
      }
      return basal.done();
    };
    var basalRecords = filterLogEntries([PUMP_LOG_RECORDS.LID_BASAL_RATE_CHANGE,
      PUMP_LOG_RECORDS.LID_TEMP_RATE_ACTIVATED, PUMP_LOG_RECORDS.LID_TEMP_RATE_COMPLETED,
      PUMP_LOG_RECORDS.LID_PUMPING_RESUMED, PUMP_LOG_RECORDS.LID_PUMPING_SUSPENDED],
      data.log_records);
    console.log('basal records:', basalRecords);
    var currentBasal;
    var currentScheduled;
    var currentTemp;
    //console.log(basalRecords);
    basalRecords.forEach(function(event, index) {
      if (event.header_id == PUMP_LOG_RECORDS.LID_TEMP_RATE_ACTIVATED.value) {
        currentTemp = {id: event.temp_rate_id, expectedDuration: event.duration, percent: event.percent, start: event.header_ts};
        console.log('temp start', event);
      }
      else if (event.header_id == PUMP_LOG_RECORDS.LID_TEMP_RATE_COMPLETED.value) {
        var actualDuration = currentTemp.expectedDuration - event.time_left;
        currentTemp.actualDuration = (actualDuration > 0) ? actualDuration : 0;
        console.log('temp end', event);
      }
      else if (event.header_id == PUMP_LOG_RECORDS.LID_BASAL_RATE_CHANGE.value) {
        console.log('event.change_type =',event.change_type, event);
        switch(event.change_type) {
          case 'timed_segment':
          case 'new_profile':
            if (currentTemp !== undefined) {
              console.log('schedule change within temp basal', event);
              // terminate current temp basal and initiate a new one based upon the new scheduled basal
              if (currentBasal) {
                records.push(finalizeBasal(event, currentBasal));
              }
              currentScheduled = makeScheduledBasal(event, currentBasal);
              currentBasal = makeTempBasal(event, currentScheduled, currentTemp);
            }
            else {
              // new scheduled basal segment
              if (currentBasal) {
                records.push(finalizeBasal(event, currentBasal));
              }
              currentScheduled = makeScheduledBasal(event, currentBasal);
              currentBasal = currentScheduled;
            }
            break;
          case 'temp_rate_start':
            if (currentBasal) {
              records.push(finalizeBasal(event, currentBasal));
            }
            currentScheduled = makeScheduledBasal(event, currentBasal);
            currentBasal = makeTempBasal(event, currentScheduled, currentTemp);
            break;
          case 'temp_rate_end':
            // terminate current temp basal
            // update temp duration, expectedDuration
            if (currentBasal) {
              records.push(finalizeBasal(event, currentBasal, currentTemp));
            }
            currentTemp = undefined;
            currentScheduled = makeScheduledBasal(event, currentBasal);
            currentBasal = currentScheduled;
            break;
          case 'pump_suspended':
            // terminate current temp basal
            // update temp duration, expectedDuration
            // TODO device meta resume (user initiated)
            currentTemp = undefined;
            if (currentBasal) {
              records.push(finalizeBasal(event, currentBasal, currentTemp));
            }
            currentScheduled = makeScheduledBasal(event, currentBasal);
            currentBasal = currentScheduled;
            break;
          case 'pump_resumed':
            // terminate current temp basal
            // update temp duration, expectedDuration
            // TODO device meta resume (user initiated)
            if (currentBasal) {
              records.push(finalizeBasal(event, currentBasal, undefined));
            }
            currentTemp = undefined;
            currentScheduled = makeScheduledBasal(event, currentBasal);
            currentBasal = currentScheduled;
            break;
          case 'pump_shut_down':
            // TODO device meta suspend (indefinite)
            if (currentBasal) {
              records.push(finalizeBasal(event, currentBasal, currentTemp));
            }
            currentScheduled = makeScheduledBasal(event, currentBasal, currentTemp);
            currentBasal = currentScheduled;
            break;
        }
      }
    });
    return records;
  };

  var buildCartridgeChangeRecords = function (data, records) {
    var cartridgeRecords = filterLogEntries([PUMP_LOG_RECORDS.LID_CARTRIDGE_FILLED], data.log_records);
     /* 
    cartridgeRecords.forEach(function(record) {
      records.push(cfg.builder.makeDeviceMetaReservoirChange());
    });
    */ 
    return records;
  };
  var buildCannulaChangeRecords = function (data, records) {
    return records;
  };

  var buildBGRecords = function (data, records) {
    var bgRecords = filterLogEntries([PUMP_LOG_RECORDS.LID_BG_READING_TAKEN], data.log_records);
    bgRecords.forEach(function(bgEntry) {
      console.log(bgEntry);
      bgEntry.jsDate = new Date(bgEntry.rawTimestamp);
      cfg.tzoUtil.fillInUTCInfo(bgEntry, bgEntry.jsDate);
      var bgRecord = cfg.builder.makeSMBG()
        .with_time(bgEntry.timestamp)
        .with_deviceTime(bgEntry.deviceTime)
        .with_timezoneOffset(bgEntry.timezoneOffset)
        .with_conversionOffset(bgEntry.conversionOffset)
        .with_subType('manual')
        .with_value(bgEntry.bg)
        .with_units('mg/dL')
        .done();
      records.push(bgRecord);
    });
    return records;
  };

  var probe = function (cb, data) {
    // TODO clean up this comment
    console.log('spray and pray. if it is a t:slim pump, it will respond with a version response');
    tandemCommandResponse(COMMANDS.VERSION_REQ, null, function (err, result) {
      if (err) {
        console.log(err);
        cb(err, null);
      }
      else {
        console.log('t:slim found: ', result);
        if (data == null) {
          data = {};
        }
        data.deviceId = 'Tandem ' + result.payload.model_no + ' ' + result.payload.pump_sn;
        data.model_no = result.payload.model_no;
        data.pump_sn = result.payload.pump_sn;
        cb(null, data);
      }
    });
  };

  return {
    setup: function (deviceInfo, progress, cb) {
      console.log('in setup!');
      progress(100);
      cb(null, {stage: 'setup', deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      console.log('connecting');
      data.deviceInfo.bitrate = 921600;
      data.deviceInfo.ctsFlowControl = true;
      cfg.deviceComms.connect(data.deviceInfo, tandemPacketHandler, probe, function () {
        cfg.deviceComms.flush();
        progress(100);
        data.stage = 'connect';
        cb(null, data);
      });
    },

    getConfigInfo: function (progress, data, cb) {
      console.log('in getConfigInfo');
      data.stage = 'getConfigInfo';
      progress(100);
      probe(cb, data);
    },

    fetchData: function (progress, data, cb) {
      console.log('in fetchData');
      progress(0);
      data.stage = 'fetchData';
      tandemFetch(progress, data, cb);
    },

    processData: function (progress, data, cb) {
      console.log('in processData');
      progress(0);
      progress(100);
      data.stage = 'processData';
      cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      data.stage = 'uploadData';
      var deviceId = 'tandemTslim'+data.model_no+data.pump_sn;
      cfg.builder.setDefaults({deviceId: deviceId});

      var postrecords = [], settings = null;

      postrecords = buildTimeChangeRecords(data, postrecords);
      postrecords = buildSettingsRecords(data, postrecords);
      postrecords = buildBolusRecords(data, postrecords);
      // TODO these are pending on new document from Tandem
      // postrecords = buildAlarmRecords(data, postrecords);
      // postrecords = buildOcclusionRecords(data, postrecords);

      //postrecords = buildSuspendRecords(data, postrecords);
      //postrecords = buildResumeRecords(data, postrecords);

      postrecords = buildBasalRecords(data, postrecords);
      postrecords = buildBGRecords(data, postrecords);
      data.post_records = [];

      var sessionInfo = {
        deviceTags: ['insulin-pump'],
        deviceManufacturers: ['Tandem'],
        deviceModel: 'pump:'+data.model_no,
        deviceSerialNumber: String(data.pump_sn),
        deviceId: deviceId,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version
      };

      cfg.api.upload.toPlatform(
        postrecords,
        sessionInfo,
        progress,
        cfg.groupId,
        function (err, result) {
          if (err) {
            console.log(err);
            console.log(result);
            progress(100);
            return cb(err, data);
          } else {
            progress(100);
            data.post_records = data.post_records.concat(postrecords);
            return cb(null, data);
          }
        }
      );
    },

    disconnect: function (progress, data, cb) {
      progress(100);
      data.disconnect = true;
      cb(null, data);
    },

    cleanup: function (progress, data, cb) {
      console.log('in cleanup');
      progress(0);
      cfg.deviceComms.clearPacketHandler();
      cfg.deviceComms.disconnect(function () {
        progress(100);
        data.stage = 'cleanup';
        cb(null, data);
      });
    }
  };
};
