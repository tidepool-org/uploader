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

var tandemSimulatorMaker = require('../tandem/tandemSimulator');

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
        if ((status & 0x01) === 0) {
          delete rec.low_insulin_threshold;
        }
        if ((status & 0x02) === 0) {
          delete rec.auto_shutdown_enabled;
        }
        if ((status & 0x04) === 0) {
          delete rec.auto_shutdown_duration;
        }
        if ((status & 0x08) === 0) {
          delete rec.cannula_prime_size;
        }
        if ((status & 0x10) === 0) {
          delete rec.is_pump_locked;
        }
        if ((status & 0x20) === 0) {
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
      postprocess: function (rec) {
        rec.timed_segment = rec.change_type & 1 ? true : false; // if true, segment advanced based on time, the user changed the pump time or changed the active segment
        switch (rec.change_type & 0xFE) { //mask out timed_segment bit
          case 0:
            rec.change_type = 'only_timed_segment';
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
            console.log('unhandled change_type in ', rec);
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
      fields: ['bolus_id', 'iob', 'bolex_size'],
      postprocess: function (rec) {
        rec.bolex_size = rec.bolex_size.toFixedNumber(SIGNIFICANT_DIGITS);
        rec.iob = rec.iob.toFixedNumber(SIGNIFICANT_DIGITS);
      }
    },
    LID_BOLEX_COMPLETED: {
      value: 0x15,
      name: 'Extended Portion of a Bolus Complete Event',
      format: '..hfff',
      fields: ['bolus_id', 'iob', 'bolex_insulin_delivered', 'bolex_insulin_requested'],
      postprocess: function (rec) {
        rec.bolex_insulin_delivered = rec.bolex_insulin_delivered.toFixedNumber(SIGNIFICANT_DIGITS);
        rec.bolex_insulin_requested = rec.bolex_insulin_requested.toFixedNumber(SIGNIFICANT_DIGITS);
        rec.iob = rec.iob.toFixedNumber(SIGNIFICANT_DIGITS);
      }
    },
    LID_BOLUS_ACTIVATED: {
      value: 0x37,
      name: 'Bolus Activated Event',
      format: 'h..ff....',
      fields: ['bolus_id', 'iob', 'bolus_size'],
      postprocess: function (rec) {
        rec.bolus_size = rec.bolus_size.toFixedNumber(SIGNIFICANT_DIGITS);
        rec.iob = rec.iob.toFixedNumber(SIGNIFICANT_DIGITS);
      }
    },
    LID_BOLUS_COMPLETED: {
      value: 0x14,
      name: 'Bolus Completed Event',
      format: '..hfff',
      fields: ['bolus_id', 'iob', 'insulin_delivered', 'insulin_requested'],
      postprocess: function (rec) {
        rec.insulin_delivered = rec.insulin_delivered.toFixedNumber(SIGNIFICANT_DIGITS);
        rec.insulin_requested = rec.insulin_requested.toFixedNumber(SIGNIFICANT_DIGITS);
        rec.iob = rec.iob.toFixedNumber(SIGNIFICANT_DIGITS);
      }
    },
    LID_BOLUS_REQUESTED_MSG1: {
      value: 0x40,
      name: 'Bolus Requested Event 1 of 3',
      format: 'hbbhhfi',
      fields: ['bolus_id', 'bolus_type', 'correction_bolus_included', 'carb_amount', 'bg', 'iob', 'carb_ratio'],
      postprocess: function (rec) {
        if (rec.bolus_type === 0) {
          rec.bolus_type_str = 'insulin';
        }
        else if (rec.bolus_type === 1) {
          rec.bolus_type_str = 'carb';
        }
        rec.carb_ratio = rec.carb_ratio * 0.001;
        rec.iob = rec.iob.toFixedNumber(SIGNIFICANT_DIGITS);
      }
    },
    LID_BOLUS_REQUESTED_MSG2: {
      value: 0x41,
      name: 'Bolus Requested Event 2 of 3',
      format: 'hbbh..hhbb..',
      fields: ['bolus_id', 'options', 'standard_percent', 'duration', 'isf', 'target_bg', 'user_override', 'declined_correction'],
      postprocess: function (rec) {
        if (rec.options === 0) {
          rec.bolus_option = 'standard';
        }
        else if (rec.options === 1) {
          rec.bolus_option = 'extended';
        }
        else if (rec.options == 2) {
          rec.bolus_option = 'quickbolus';
        }
        rec.duration = rec.duration * sundial.MIN_TO_MSEC;
      }
    },
    LID_BOLUS_REQUESTED_MSG3: {
      value: 0x42,
      name: 'Bolus Requested Event 3 of 3',
      format: 'h..fff',
      fields: ['bolus_id', 'food_bolus_size', 'correction_bolus_size', 'total_bolus_size'],
      postprocess: function (rec) {
        rec.food_bolus_size = rec.food_bolus_size.toFixedNumber(SIGNIFICANT_DIGITS);
        rec.correction_bolus_size = rec.correction_bolus_size.toFixedNumber(SIGNIFICANT_DIGITS);
        rec.total_bolus_size = rec.total_bolus_size.toFixedNumber(SIGNIFICANT_DIGITS);
      }
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
      postprocess: function (rec) {
        rec.insulin_duration = rec.insulin_duration * sundial.MIN_TO_MSEC;
        rec.max_bolus_size = (rec.max_bolus_size * 0.001).toFixedNumber(SIGNIFICANT_DIGITS);
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
      postprocess: function (rec) {
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
      postprocess: function (rec) {
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
      postprocess: function (rec) {
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
      postprocess: function (rec) {
        // TODO: status
      }
    },
    LID_PARAM_REMINDER: {
      value: 0x60,
      name: 'Reminder Time Based Parameter Change Event',
      format: 'bbbbihhb...',
      fields: ['modification', 'reminder_id', 'status', 'enable', 'frequency_minutes', 'start_time', 'end_time', 'active_days'],
      postprocess: function (rec) {
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
      postprocess: function (rec) {
        rec.percent = rec.percent / 100;
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
    postprocess: function (rec) {
      rec.startTime = rec.startTime * sundial.MIN_TO_MSEC;
      rec.basalRate = rec.basalRate * 0.001;
      rec.carbRatio = rec.carbRatio * 0.001;
      // TODO status
      return rec;
    }
  };

  // Tandem represents values with false precision (https://en.wikipedia.org/wiki/False_precision),
  // so we have to specify the number of significant digits
  var SIGNIFICANT_DIGITS = 5;
  Number.prototype.toFixedNumber = function(significant){
    var pow = Math.pow(10,significant);
    return +( Math.round(this*pow) / pow );
  };

  var BASE_TIME = Date.UTC(2008, 0, 1, 0, 0, 0).valueOf(); /* new Date(2008, 0, 1, 0, 0, 0).valueOf();*/
  var addTimestamp = function (o, rawTime) {
    o.rawTimestamp = BASE_TIME + rawTime * sundial.SEC_TO_MSEC;
    var dt = new Date(o.rawTimestamp); // rawTimeStamp is UTC unix time
    o.jsDate = dt;
    o.deviceTime = sundial.formatDeviceTime(dt);
  };

  // This is a particularly weak checksum algorithm but that's what Insulet and Tandem use...
  var weakChecksum = function (bytes, offset, count) {
    var total = 0;
    for (var i = 0; i < count; ++i) {
      total += bytes[i + offset];
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

  var tandemLogRequester = function (start, end, progress, callback) {
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
        tandemCommand(COMMANDS.LOG_ENTRY_SEQ_REQ, [send_seq++], function () { });
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
                tandemCommand(COMMANDS.LOG_ENTRY_SEQ_REQ, [receive_seq], function () { });
              } // drop out-of-order packets on the floor.  They will be re-requested.
            }
            else {
              if (recovering) {
                console.log('recovered', receive_seq, pkt);
              }
              receive_seq = pkt.payload['header_log_seq_no'] + 1;
              recovering = false;
              if (receive_seq % 1000 === 0) {
                console.log('received ', receive_seq, ' of ', end);
                progress(receive_seq/end * 100);
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

    end_seq = data.end_seq;
    start_seq = data.start_seq;
    tandemLogRequester(start_seq, end_seq, progress, iterate);
  };

  var tandemFetchEventRange = function (progress, data, callback) {
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


    var tandemFetch = function (progress, data, callback) {
      var start_exec = new Date().getTime();
      console.log('getting event ranges');
      var entries;
      var end_seq;
      var start_seq;

      var minIndex;
      var maxIndex;
      var currentIndex;
      var currentElement; //TIME
      var searchElement = new Date().getTime() - 90 * 24 * 60 * 60 * 1000; //Hardcoded to 90 days

      function getNewestEvent(err, result) {

        if (err) {
          console.log('error retrieving record', result);
          callback(err, null);
        }
        else {

          if (result.payload.rawTimeStamp < searchElement) {
            searchElement = result.payload.rawTimestamp - 90 * 24 * 60 * 60 * 1000;
            tandemLogRequester(start_seq, start_seq, progress, getOldestEvent);
          } else {
            maxIndex = end_seq;
            currentIndex = (minIndex + maxIndex) / 2 | 0;
            data.end_seq = end_seq;
            tandemLogRequester(currentIndex, currentIndex, progress, binarySearch);
          }
        }

      }

      function getOldestEvent(err, result) {

        if (err) {
          console.log('error retrieving record', result);
          callback(err, null);
        }
        else {
          //If greater than searchElement set OldestEvent Index as start, end_seq as end, callback
          if (result.payload.rawTimestamp > searchElement) {
            data.start_seq = start_seq;
            data.end_seq = end_seq;
            callback(null, data);
          } else { //check newestEvent
            minIndex = start_seq;
            tandemLogRequester(end_seq, end_seq, progress, getNewestEvent);
          }
        }
      }

      function binarySearch(err, result) {

        if (err) {
          console.log('error retrieving record', result);
          callback(err, null);
        }
        else {
          if (minIndex <= maxIndex) {
            console.log('currentElement: ' + result.payload.rawTimestamp);
            currentElement = result.payload.rawTimestamp;

            if (currentElement < searchElement) {
              minIndex = currentIndex + 1;
            }
            else if (currentElement > searchElement) {
              maxIndex = currentIndex - 1;
            }
            else {
              data.start_seq = currentIndex;
              tandemFetchEventRange(progress, data, callback);
            }
            currentIndex = (minIndex + maxIndex) / 2 | 0;
            tandemLogRequester(currentIndex, currentIndex, progress, binarySearch);
          } else {
            data.start_seq = currentIndex;
            var end_exec = new Date().getTime();
            var time = end_exec - start_exec;
            console.log('Execution time: ' + time);
            tandemFetchEventRange(progress, data, callback);
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
            start_seq = result.payload['start_seq']; // limit to 3000 for debugging

            tandemLogRequester(start_seq, start_seq, progress, getOldestEvent);
          }
        }
      });
    };

  var filterLogEntries = function (types, log_records) {
    var neededLogIds = [];
    types.forEach(function (element) { neededLogIds.push(element.value); });
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
    data.profiles.forEach(function (profile) {
      var scheduleName = profile.name;
      var schedule = [];
      var carbSchedule = [];
      var sensitivitySchedule = [];
      var targetSchedule = [];
      profile.tdeps.forEach(function (tdep) {
        schedule.push({ rate: Math.fround(tdep['basalRate']), start: tdep['startTime'] });
        carbSchedule.push({ amount: Math.fround(tdep['carbRatio']), start: tdep['startTime'] });
        sensitivitySchedule.push({ amount: tdep['ISF'], 'start': tdep['startTime'] });
        targetSchedule.push({ target: tdep['TargetBG'], start: tdep['startTime'] });
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
      .with_time(sundial.applyTimezone(data.log_records[data.log_records.length - 1].jsDate, cfg.timezone).toISOString())
      .with_deviceTime(data.log_records[data.log_records.length - 1].deviceTime)
      .with_timezoneOffset(sundial.getOffsetFromZone(data.log_records[data.log_records.length - 1].jsDate, cfg.timezone))
      .with_conversionOffset(0)
      .done();

    postrecords.push(postsettings);

    var records = filterLogEntries([PUMP_LOG_RECORDS.LID_IDP, PUMP_LOG_RECORDS.LID_IDP_BOLUS,
      PUMP_LOG_RECORDS.LID_IDP_LIST, PUMP_LOG_RECORDS.LID_IDP_MSG2, PUMP_LOG_RECORDS.LID_IDP_TD_SEG,
      PUMP_LOG_RECORDS.LID_PARAM_GLOBAL_SETTINGS], data.log_records);
    //console.log(records);
    //console.log(postrecords);
    return postrecords;
  };

  var buildTimeChangeRecords = function (data, records) {
    var timeChangeLogs = filterLogEntries(
      [PUMP_LOG_RECORDS.LID_TIME_CHANGED],
      data.log_records
    );

    var dateChangeLogs = filterLogEntries(
      [PUMP_LOG_RECORDS.LID_DATE_CHANGED],
      data.log_records
    );

    var postrecords = [];

    for (var i = 0; i < timeChangeLogs.length; ++i) {
      var tc = timeChangeLogs[i];
      var tc_base = sundial.floor(tc.rawTimestamp, 'day').valueOf();

      // look for a corresponding date change event
      var found = false;
      var index = tc.index;
      var lastIndex = data.log_records[data.log_records.length - 1].index;
      var SEARCH_THRESHOLD = 5;
      var start = index < SEARCH_THRESHOLD ? 0 : index - SEARCH_THRESHOLD; // look at x entries before
      var end = (index + SEARCH_THRESHOLD) < lastIndex ?
        index + SEARCH_THRESHOLD : lastIndex; // and up to x entries after
      for (var k = start; k <= end; k++) {
        var event = _.find(dateChangeLogs, {index: k});
        if (event) {
          found = true;
          var datetimechange = cfg.builder.makeDeviceEventTimeChange()
            .with_change({
              from: sundial.formatDeviceTime(BASE_TIME + (event.date_prior * 864e5) + tc.time_prior),
              to: sundial.formatDeviceTime(BASE_TIME + (event.date_after * 864e5) + tc.time_after),
              agent: 'manual'
            })
            .with_deviceTime(tc.deviceTime)
            .set('jsDate', tc.jsDate)
            .set('index', tc.index);
          postrecords.push(datetimechange);

          // remove the date change event from dateChangeLogs so that we don't process it twice
          dateChangeLogs = _.without(dateChangeLogs, event);
        }
      }

      if (!found) { // a regular time change event
        var timechange = cfg.builder.makeDeviceEventTimeChange()
          .with_change({
            from: sundial.formatDeviceTime(tc_base + tc.time_prior),
            to: sundial.formatDeviceTime(tc_base + tc.time_after),
            agent: 'manual'
          })
          .with_deviceTime(tc.deviceTime)
          .set('jsDate', tc.jsDate)
          .set('index', tc.index);
        postrecords.push(timechange);
      }
    }

    for (var j = 0; j < dateChangeLogs.length; ++j) {
      var dc = dateChangeLogs[j];
      console.log(dc);
      var dc_base = BASE_TIME;
      var datechange = cfg.builder.makeDeviceEventTimeChange()
        .with_change({
          from: sundial.formatDeviceTime(BASE_TIME + dc.date_prior * 864e5),
          to: sundial.formatDeviceTime(BASE_TIME + dc.date_after * 864e5),
          agent: 'manual'
        })
        .with_deviceTime(dc.deviceTime)
        .set('jsDate', dc.jsDate)
        .set('index', dc.index);
      postrecords.push(datechange);
    }

    var mostRecent = sundial.applyTimezone(data.log_records[data.log_records.length - 1].jsDate, cfg.timezone).toISOString();
    console.log('Most recent datum at', mostRecent);
    var tzoUtil = new TZOUtil(
      cfg.timezone,
      mostRecent, //TODO: or should we be using settings.time here?
      postrecords
    );

    cfg.tzoUtil = tzoUtil;
    return records.concat(tzoUtil.records);
  };

  var buildBolusRecords = function (data, records) {
    var bolusLogs = filterLogEntries([
        PUMP_LOG_RECORDS.LID_BOLUS_ACTIVATED,
        PUMP_LOG_RECORDS.LID_BOLUS_COMPLETED,
        PUMP_LOG_RECORDS.LID_BOLEX_ACTIVATED,
        PUMP_LOG_RECORDS.LID_BOLEX_COMPLETED,
        PUMP_LOG_RECORDS.LID_BOLUS_REQUESTED_MSG1,
        PUMP_LOG_RECORDS.LID_BOLUS_REQUESTED_MSG2,
        PUMP_LOG_RECORDS.LID_BOLUS_REQUESTED_MSG3
      ],
      data.log_records
    );
    console.log('Boluses:', bolusLogs);
    var boluses = {};
    bolusLogs.forEach(function(event) {
      var bolusId = event.bolus_id;
      var bolus = _.defaults({ bolus_id: bolusId }, boluses[bolusId], event);
      if (event.header_id === PUMP_LOG_RECORDS.LID_BOLUS_ACTIVATED.value) {
        bolus.startDeviceTime = event.deviceTime;
      }
      if (event.header_id === PUMP_LOG_RECORDS.LID_BOLEX_ACTIVATED.value) {
        bolus.extendedStartDeviceTime = event.deviceTime;
      }
      if (event.header_id === PUMP_LOG_RECORDS.LID_BOLEX_COMPLETED.value) {
        bolus.endDeviceTime = event.deviceTime;
      }
      if (event.header_id === PUMP_LOG_RECORDS.LID_BOLUS_REQUESTED_MSG1.value) {
        bolus.bc_iob = event.iob;
        bolus.wizardDeviceTime = event.deviceTime;
      }
      boluses[bolusId] = bolus;
    });
    for (var key in boluses) {
      var bolus = boluses[key];
      var record;

      // bolus records
      if (bolus.bolex_size !== undefined || bolus.type === 'extended') {
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
      record = record.with_deviceTime(bolus.deviceTime);
      if (bolus.bolex_size !== undefined) {
        // extended bolus
        // first case: extended bolus was cancelled
        if (bolus.bolex_size !== bolus.bolex_insulin_delivered) {
          record = record.with_duration(
            Date.parse(bolus.endDeviceTime) - Date.parse(bolus.extendedStartDeviceTime)
          );
          // cancelled before any insulin was given on dual bolus
          if (bolus.bolex_insulin_delivered === undefined) {
            record = record.with_extended(0);
          }
          else {
            record = record.with_extended(bolus.bolex_insulin_delivered);
          }
          record = record.with_expectedExtended(bolus.bolex_size)
            .with_expectedDuration(bolus.duration);
        }
        // other case: extended bolus completed
        else {
          record = record.with_extended(bolus.bolex_insulin_delivered);
          record = record.with_duration(bolus.duration);
        }
      }
      if (bolus.bolus_size !== undefined || bolus.insulin_delivered !== undefined) {
        if (bolus.bolus_size !== bolus.insulin_delivered) {
          record = record.with_normal(bolus.insulin_delivered);
          record = record.with_expectedNormal(bolus.bolex_size);
        }
        else {
          record = record.with_normal(bolus.insulin_delivered);
        }
      }
      // non-extended bolus cancelled before any insulin was given
      if ((bolus.type == 'standard' || bolus.type === 'quickbolus') &&
        bolus.bolus_size === undefined) {
        record.with_normal(0)
          .with_expectedNormal(bolus.insulin_requested);
      }
      // extended bolus cancelled before any insulin was given
      if (bolus.type == 'extended' && bolus.bolex_size === undefined) {
        record.with_duration(0)
          .with_extended(0)
          .with_expectedDuration(bolus.duration)
          .with_expectedExtended(bolus.bolex_insulin_requested);
      }
      record = record.set('index', bolus.index);
      cfg.tzoUtil.fillInUTCInfo(record, bolus.jsDate);
      console.log(boluses[key], record);
      records.push(record.done());

      // wizard records
      if (_.includes(['standard', 'extended'], bolus.bolus_option) &&
        (bolus.correction_bolus_included || (bolus.food_bolus_size > 0))) {
        // a wizard bolus can be a correction bolus or food bolus (or both)

        var netBolus = null;
        if (bolus.correction_bolus_included) {
          netBolus = bolus.correction_bolus_size + bolus.food_bolus_size;
        }
        else {
          netBolus = bolus.food_bolus_size;
        }

        var wizard_record = cfg.builder.makeWizard()
          .with_deviceTime(bolus.wizardDeviceTime)
          .with_recommended({
            carb: bolus.food_bolus_size,
            correction: bolus.correction_bolus_size,
            net: netBolus.toFixedNumber(SIGNIFICANT_DIGITS)
          })
          .with_bgInput(bolus.bg)
          .with_carbInput(bolus.carb_amount)
          .with_insulinOnBoard(bolus.bc_iob)
          .with_insulinCarbRatio(bolus.carb_ratio)
          .with_insulinSensitivity(bolus.isf)
          .with_bgTarget({
            target: bolus.target_bg
          })
          .with_bolus(record)
          .with_units('mg/dL')
          .set('index', bolus.index);
        cfg.tzoUtil.fillInUTCInfo(wizard_record, bolus.jsDate);
        wizard_record = wizard_record.done();
        records.push(wizard_record);
      }
    }
    return records;
  };

  var buildBasalRecords = function (data, records) {
    var basalRecords = filterLogEntries(
      [PUMP_LOG_RECORDS.LID_BASAL_RATE_CHANGE],
      data.log_records
    );
    var postbasal = null;
    for (var b = 0; b < basalRecords.length; ++b) {
      var event = basalRecords[b];
      switch (event.change_type) {
        case 'only_timed_segment':
        case 'new_profile':
        case 'temp_rate_end':
        case 'pump_resumed':
          // TODO: remove scary logging when confident that this situation (command != base)
          // either does not arise or is handled
          if (event.command_basal_rate !== event.base_basal_rate) {
            console.log('COMMAND BASAL NOT EQUAL TO BASE!!');
          }
          postbasal = cfg.builder.makeScheduledBasal()
            .with_deviceTime(event.deviceTime)
            .with_rate(event.command_basal_rate)
            .set('index', event.index);
          cfg.tzoUtil.fillInUTCInfo(postbasal, event.jsDate);
          break;
        case 'temp_rate_start':
          postbasal = cfg.builder.makeTempBasal()
            .with_deviceTime(event.deviceTime)
            .with_rate(event.command_basal_rate)
            .set('index', event.index);
          cfg.tzoUtil.fillInUTCInfo(postbasal, event.jsDate);
          break;
        case 'pump_suspended':
          postbasal = cfg.builder.makeSuspendBasal()
            .with_deviceTime(event.deviceTime)
            .set('index', event.index);
          cfg.tzoUtil.fillInUTCInfo(postbasal, event.jsDate);
          break;
      }
      // there are some unhandled change types, so it's sometimes null
      // TODO: be certain about this ^
      if (postbasal != null) {
        records.push(postbasal);
      }
    }
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
    bgRecords.forEach(function (bgEntry) {
      console.log(bgEntry);
      var bgRecord = cfg.builder.makeSMBG()
        .with_deviceTime(bgEntry.deviceTime)
        .with_subType('manual')
        .with_value(bgEntry.bg)
        .with_units('mg/dL')
        .set('index',bgEntry.index);
        cfg.tzoUtil.fillInUTCInfo(bgRecord, bgEntry.jsDate);
        bgRecord.done();
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
      cb(null, { stage: 'setup', deviceInfo: deviceInfo });
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
      console.log('hit getEventRange');
      tandemFetch(progress, data, cb);
      console.log('in fetchData');
      progress(0);
      data.stage = 'fetchData';
      // tandemFetch(progress, data, cb);
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
      var deviceId = 'tandemTslim' + data.model_no + data.pump_sn;
      cfg.builder.setDefaults({ deviceId: deviceId });

      var postrecords = [], settings = null;
      /*
        Because pump shut-down interferes with BtUTC, anywhere
        where a pump shut-down appears in records to be processed
        we only attempt to process and upload the data following
        the most recent device shut-down.
      */
      data.log_records = _.takeRightWhile(data.log_records, function(rec) {
        if (rec.change_type && rec.change_type === 'pump_shut_down') {
          return false;
        }
        return true;
      });

      postrecords = buildSettingsRecords(data, postrecords);
      if (!_.isEmpty(postrecords)) {
        settings = postrecords[0];
      }
      postrecords = buildTimeChangeRecords(data, postrecords);
      postrecords = buildBolusRecords(data, postrecords);
      // TODO these are pending on new document from Tandem
      // postrecords = buildAlarmRecords(data, postrecords);
      // postrecords = buildOcclusionRecords(data, postrecords);

      //postrecords = buildSuspendRecords(data, postrecords);
      //postrecords = buildResumeRecords(data, postrecords);

      postrecords = buildBasalRecords(data, postrecords);
      postrecords = buildBGRecords(data, postrecords);
      // sort by time for the simulator
      postrecords = _.sortBy(postrecords, function(d) { return d.time; });
      var simulator = tandemSimulatorMaker.make({settings: settings});

      for (var n = 0; n < postrecords.length; ++n) {
        var datum = postrecords[n];
        switch (datum.type) {
          case 'basal':
            simulator.basal(datum);
            break;
          case 'bolus':
            simulator.bolus(datum);
            break;
          case 'deviceEvent':
            if (datum.subType === 'timeChange') {
              simulator.changeDeviceTime(datum);
            }
            else {
              console.log('Unknown deviceEvent subType:', datum.subType);
            }
            break;
          case 'pumpSettings':
            simulator.pumpSettings(datum);
            break;
          case 'smbg':
            simulator.smbg(datum);
            break;
          case 'wizard':
            simulator.wizard(datum);
            break;
          default:
            console.log('[Hand-off to simulator] Unhandled type!', datum.type);
        }
      }
      simulator.finalBasal();
      data.post_records = [];

      var sessionInfo = {
        deviceTags: ['insulin-pump'],
        deviceManufacturers: ['Tandem'],
        deviceModel: 'pump:' + data.model_no,
        deviceSerialNumber: String(data.pump_sn),
        deviceId: deviceId,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version
      };

      cfg.api.upload.toPlatform(
        simulator.getEvents(),
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
