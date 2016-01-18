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

/* globals __DEBUG__ */

var _ = require('lodash');
var struct = require('./../struct.js')();
var sundial = require('sundial');

var tandemSimulatorMaker = require('../tandem/tandemSimulator');

var TZOUtil = require('../TimezoneOffsetUtil');
var annotate = require('../eventAnnotations');
var debug = require('../bows')('TandemDriver');

module.exports = function (config) {
  var cfg = config;

  var SYNC_BYTE = 0x55;

  var getFlagNames = function (list, v) {
    var flags = [];
    for (var i in list) {
      if (list[i].value & v) {
        flags.push(list[i].name);
      }
    }
    return flags;
  };

  var BASAL_CHANGE_TYPE_FLAGS = [
    {value: 0x01, name: 'timed_segment'},
    {value: 0x02, name: 'new_profile'},
    {value: 0x04, name: 'temp_rate_start'},
    {value: 0x08, name: 'temp_rate_end'},
    {value: 0x10, name: 'pump_suspended'},
    {value: 0x20, name: 'pump_resumed'},
    {value: 0x40, name: 'pump_shut_down'}
  ];

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
      response: RESPONSES.LOG_ENTRY_TE
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
        rec.change_types = getFlagNames(BASAL_CHANGE_TYPE_FLAGS, rec.change_type);
        rec.command_basal_rate = rec.command_basal_rate.toFixedNumber(SIGNIFICANT_DIGITS);
        rec.base_basal_rate = rec.base_basal_rate.toFixedNumber(SIGNIFICANT_DIGITS);
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
        rec.carb_ratio = (rec.carb_ratio * 0.001).toFixedNumber(SIGNIFICANT_DIGITS);
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
        else if (rec.options === 2) {
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
      fields: ['prime_size'],
      postprocess: function (rec) {
        rec.prime_size = rec.prime_size.toFixedNumber(SIGNIFICANT_DIGITS);
      }
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
      fields: ['insulin_display', 'insulin_actual'],
      postprocess: function (rec) {
        rec.insulin_actual = rec.insulin_actual.toFixedNumber(SIGNIFICANT_DIGITS);
      }
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
            debug('unhandled operation in profile event', rec);
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
        rec.basal_rate = (rec.basal_rate * 0.001).toFixedNumber(SIGNIFICANT_DIGITS);
        rec.carb_ratio = (rec.carb_ratio * 0.001).toFixedNumber(SIGNIFICANT_DIGITS);
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
      }
    },
    LID_PARAM_REM_SETTINGS: {
      value: 0x61,
      name: 'Reminder Parameter Change Event',
      format: 'bb..hhb.......',
      fields: ['modification', 'status', 'low_bg_threshold', 'high_bg_threshold', 'site_change_days']
    },
    LID_PARAM_REMINDER: {
      value: 0x60,
      name: 'Reminder Time Based Parameter Change Event',
      format: 'bbbbihhb...',
      fields: ['modification', 'reminder_id', 'status', 'enable', 'frequency_minutes', 'start_time', 'end_time', 'active_days']
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
      fields: ['prime_size'],
      postprocess: function (rec) {
        rec.prime_size = rec.prime_size.toFixedNumber(SIGNIFICANT_DIGITS);
      }
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
    },
    LID_ALARM_ACTIVATED: {
      value: 0x05,
      name: 'Alarm Activated Event',
      format: 'i............',
      fields: ['alarm_id']
    },
    LID_ALERT_ACTIVATED: {
      value: 0x04,
      name: 'Alert Activated Event',
      format: 'i............',
      fields: ['alert_id']
    }
  };

  var ALARM_TYPES = {
    ALARM_OCCLUSION: { value: 2, name: 'Occlusion detected'},
    ALARM_AUTO_OFF: { value: 7, name: 'Auto Off'},
    ALARM_OUT_OF_LIQUID: { value: 8, name: 'Out of Liquid'},
    ALARM_TEMPERATURE_OUT_OF_RANGE: { value: 10, name: 'Temperature Out of Range'},
    ALARM_EXTREMELY_LOW_LIPO: { value: 12, name: 'Extremely low LiPo percent charge'},
    ALARM_STUCK_WAKE_BUTTON: { value: 22, name: 'Stuck Wake Button'},
    ALARM_PRESSURE_OUT_OF_RANGE: { value: 24, name: 'Atmosphere Pressure Out of Range'},
    ALARM_CARTRIDGE_REMOVED: { value: 25, name: 'Cartridge Removed'},
    ALARM_SECOND_OCCLUSION: { value: 26, name: 'Second Occlusion detected in a row'}
  };

  var ALERT_TYPES = {
    ALERT_LOW_INSULIN: { value: 0, name: 'Low Insulin level'},
    ALERT_LOW_LIPO_CHARGE: { value: 2, name: 'Low LiPo percent charge'},
    ALERT_VERY_LOW_LIPO_CHARGE: { value: 3, name: 'Very Low LiPo percent charge'},
    ALERT_VERY_LOW_INSULIN: { value: 17, name: 'Very Low Insulin Level'}
  };

  var IDP_TDEP = {
    name: 'Time Dependent Settings Segment Structure',
    format: 'hhihhb',
    fields: ['startTime', 'basalRate', 'carbRatio', 'TargetBG', 'ISF', 'status'],
    postprocess: function (rec) {
      rec.startTime = rec.startTime * sundial.MIN_TO_MSEC;
      rec.basalRate = (rec.basalRate * 0.001).toFixedNumber(SIGNIFICANT_DIGITS);
      rec.carbRatio = (rec.carbRatio * 0.001).toFixedNumber(SIGNIFICANT_DIGITS);
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

  var pending = false;    //if serial send is pending, we have to wait before we send again
  var INTERVAL_FREQ = 5;  // time between sending serial packets
  var SEND_WAIT = 800; // time to wait when serial send is pending
  var RETRY_TIMEOUT = 1000; // time to wait before retrying to send packet

  var BASE_TIME = Date.UTC(2008, 0, 1, 0, 0, 0).valueOf(); /* new Date(2008, 0, 1, 0, 0, 0).valueOf(); */
  var addTimestamp = function (o, rawTime) {
    o.rawTimestamp = BASE_TIME + rawTime * sundial.SEC_TO_MSEC;
    var dt = new Date(o.rawTimestamp); // rawTimeStamp is "UTC" unix time
    o.jsDate = dt;
    o.deviceTime = sundial.formatDeviceTime(dt);
  };
  var uploadTime = {};

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
      if (list[i].value === idx) {
        return list[i].name;
      }
    }
    return 'UNKNOWN!';
  };

  var _getItem = function (list, idx) {
    for (var i in list) {
      if (list[i].value === idx) {
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

  var getAlarmName = function (idx,types) {
    return _getName(types, idx);
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
    return buf;
  };

  // accepts a stream of bytes and tries to find a Tandem packet
  // at the beginning of it. in no case should there be fewer than 9 bytes
  // in the bytestream.
  // returns a packet object; if valid === true it's a valid packet
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
      debug('Bad Checksum!');
      debug('checksums:', packet.crc, checksum);
      return packet;
    }

    if (packet.payload_len) {
      packet.payload = new Uint8Array(packet.payload_len);
      for (var i = 0; i < packet.payload_len; ++i) {
        packet.payload[i] = bytes[i + 3];
      }
      var response = getResponseById(packet.descriptor);
      if (response && response.fields && response.format) {
        packet.payload = struct.unpack(bytes, 3, response.format, response.fields);
        if (response.postprocess) {
          response.postprocess(packet.payload);
        }
      }
      if(packet.descriptor === RESPONSES.IDP_TE.value) {
        // Tandem only returns timestamps for when an event occurred for
        // the event history log entries. For other records, e.g. personal profile (IDP_TE)
        // or reminder settings, the only available timestamp is the packet timestamp,
        // i.e., the device time at time of upload.
        packet.timestamp = struct.extractBEInt(bytes,packet.packet_len - 6);
        addTimestamp(uploadTime,packet.timestamp);
      }
    }
    packet.valid = true;
    return packet;
  };

  var tandemPacketHandler = function (buffer) {
    // first, discard bytes that can't start a packet
    while ((buffer.len() > 0) && (buffer.get(0) !== SYNC_BYTE)) {
      buffer.discard(1);
    }

    if (buffer.len() < 9) { // all complete packets must be at least this long
      return null; // not enough there yet
    }

    // there's enough there to try, anyway
    var packet = extractPacket(buffer.bytes());
    if (packet.packet_len !== 0) {
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

  var listenForPacket = function (command,args,callback) {

    var retryTimer = setTimeout(function() {
      console.log('Retrying with ',command, ', ',args);
      tandemCommand(command, args, function (err) {
        if(err) {
          callback(err,null);
        }
      });
    },RETRY_TIMEOUT);

    var listenTimer = setInterval(function () {
      if (cfg.deviceComms.hasAvailablePacket()) {
        var pkt = cfg.deviceComms.nextPacket();
        if (pkt.valid && (command.response.value === pkt.descriptor)) {
          clearTimeout(retryTimer);
          clearInterval(listenTimer);
          callback(null, pkt);
        }else{
          console.log('Packet not valid');
        }
      }
    }, 1); // spin on this one quickly
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
    cfg.deviceComms.writeSerial(commandPacket, function(err) {
      if(err) {
        console.log('Write error:',err);
        if(err.name === 'pending' || err.name === 'timeout') {
          pending = true;
          callback();
          setTimeout(function() {
            pending = false;
          },SEND_WAIT);
        } else if(err.name === 'system_error') {
          pending = true;
          callback();
          cfg.deviceComms.changeBitRate(cfg.deviceInfo.bitrate,function(){
            pending=false;
          });
        }
        else{
          callback(err);
        }
      }else{
        callback();
      }
    });
  };

  var tandemLogRequester = function (start, end, progress, callback) {
    // TODO: implement and test multi-record download commands
    if (__DEBUG__) {
      debug('tandemLogRequester', start, end);
      var start_exec = Date.now();
    }
    var send_seq = start;
    var receive_seq = start;
    var recovering = false;
    var percentage = 0;
    var prevPercentage = 0;
    var retryRecoverTimer;

    var listenTimer = setInterval(function () {
      if(pending) {
        debug('pending');
      }
      while (cfg.deviceComms.hasAvailablePacket() && !pending) {
        var processPacket = function (pkt) {
          if (pkt.valid &&
            pkt.descriptor === RESPONSES.LOG_ENTRY_TE.value &&
            pkt.payload['header_log_seq_no'] >= receive_seq) {
            if (receive_seq != pkt.payload['header_log_seq_no']) {
              if (!recovering) {
                recovering = true;
                debug('recovering ', receive_seq, '(received ',pkt.payload['header_log_seq_no'], ')');
                send_seq = receive_seq + 1;
              }

              tandemCommand(COMMANDS.LOG_ENTRY_SEQ_REQ, [receive_seq], function (err) {
                if(err) {
                  callback(err,null);
                }
                retryRecoverTimer = setTimeout(function() {
                  if(recovering) {
                    debug('Retrying to recover..',receive_seq);
                    tandemCommand(COMMANDS.LOG_ENTRY_SEQ_REQ, [receive_seq], function (err) {
                      if(err) {
                        callback(err,null);
                      }
                    });
                  }
                },RETRY_TIMEOUT);
              });
            }
            else {
              if (recovering) {
                debug('recovered ', receive_seq, pkt);
                clearTimeout(retryRecoverTimer);
              }
              receive_seq = pkt.payload['header_log_seq_no'] + 1;
              recovering = false;

              percentage = ((receive_seq-start)/(end-start) * 90)+10;
              if(percentage > (prevPercentage+1)) {
                // only update progress to UI if there's an increase of at least 1 percent
                prevPercentage = percentage;
                progress(percentage);
              }

              if (receive_seq % 1000 === 0) {
                debug('received ', receive_seq, ' of ', end);
              }
              if (receive_seq > end) {
                if (__DEBUG__) {
                  var end_exec = Date.now();
                  var time = end_exec - start_exec;
                  debug('Execution time of tandemLogRequester: ' + time);
                }
                cfg.deviceComms.flush(); // making sure we flush the buffers
                clearInterval(sendTimer);
                clearInterval(listenTimer);
              }
              callback(null, pkt);
            }
          }
        };
        processPacket(cfg.deviceComms.nextPacket());
      }
    }, INTERVAL_FREQ);

    var sendTimer = setInterval(function () {
      if (send_seq % 1000 === 0) {
        debug('requesting ', send_seq);
      }
      if (!recovering && !pending) {
        tandemCommand(COMMANDS.LOG_ENTRY_SEQ_REQ, [send_seq], function (err) {
          if(err) {
            clearInterval(sendTimer);
            callback(err,null);
          }
        });
        if ((send_seq < end) && !recovering) {
          send_seq++;
        }
      }
    }, INTERVAL_FREQ); // if we spin too quickly on this, packets don't get sent when window doesn't have focus
  };

  var newestEventRequester = function (start, end, progress, callback) {
    var send_seq = start;
    var end_seq = end;
    var receive_seq = start;
    var recovering = false;
    var percentage_seq = 0;
    var retryRecoverTimer;

    // this contains only the log events that we consider to define
    // a set of events that can truly be considered "pump data"
    // (basically a subset of the log records we currently parse)
    var headerIdFilter = [
      PUMP_LOG_RECORDS.LID_BASAL_RATE_CHANGE.value,
      PUMP_LOG_RECORDS.LID_BG_READING_TAKEN.value,
      PUMP_LOG_RECORDS.LID_BOLEX_ACTIVATED.value,
      PUMP_LOG_RECORDS.LID_BOLEX_COMPLETED.value,
      PUMP_LOG_RECORDS.LID_BOLUS_ACTIVATED.value,
      PUMP_LOG_RECORDS.LID_BOLUS_COMPLETED.value,
      PUMP_LOG_RECORDS.LID_BOLUS_REQUESTED_MSG1.value,
      PUMP_LOG_RECORDS.LID_BOLUS_REQUESTED_MSG2.value,
      PUMP_LOG_RECORDS.LID_BOLUS_REQUESTED_MSG3.value,
      PUMP_LOG_RECORDS.LID_TEMP_RATE_ACTIVATED.value,
      PUMP_LOG_RECORDS.LID_TEMP_RATE_COMPLETED.value,
      PUMP_LOG_RECORDS.LID_PUMPING_SUSPENDED.value,
      PUMP_LOG_RECORDS.LID_PUMPING_RESUMED.value,
      PUMP_LOG_RECORDS.LID_CANNULA_FILLED.value,
      PUMP_LOG_RECORDS.LID_CARTRIDGE_FILLED.value,
      PUMP_LOG_RECORDS.LID_TUBING_FILLED.value
    ];

    var listenTimer = setInterval(function () {
      if(pending) {
        debug('pending');
      }
      while (cfg.deviceComms.hasAvailablePacket() && !pending) {
        var processPacket = function (pkt) {
          if (pkt.valid &&
            pkt.descriptor === RESPONSES.LOG_ENTRY_TE.value &&
            pkt.payload['header_log_seq_no'] <= receive_seq) {
            if (receive_seq != pkt.payload['header_log_seq_no']) {
              if (!recovering) {
                recovering = true;
                debug('recovering ', receive_seq);
              }

              send_seq = receive_seq - 1;
              tandemCommand(COMMANDS.LOG_ENTRY_SEQ_REQ, [receive_seq], function (err) {
                if(err) {
                  callback(err,null);
                }
                retryRecoverTimer = setTimeout(function() {
                  if(recovering) {
                    debug('Retrying to recover..',receive_seq);
                    tandemCommand(COMMANDS.LOG_ENTRY_SEQ_REQ, [receive_seq], function (err) {
                      if(err) {
                        callback(err,null);
                      }
                    });
                  }
                },RETRY_TIMEOUT);
              });
            }
            else {
              if (recovering) {
                debug('recovered ', receive_seq, pkt);
              }
              receive_seq = pkt.payload['header_log_seq_no'] - 1;
              recovering = false;

              percentage_seq += 1;
              if(percentage_seq % 100 === 0) {
                // increase percentage every 100 records
                var percentage = percentage_seq/100;
                progress(percentage < 5 ? percentage : 5); //up to a max of 5 percent
              }

              if (headerIdFilter.indexOf(pkt.payload.header_id) === -1 || pkt.payload.name  === undefined) {
                if(__DEBUG__) {
                  debug('skipping record in search for newest: ', pkt.payload ? pkt.payload.name : '', pkt);
                }
                end_seq--;
              }
              else{
                clearInterval(sendTimer);
                clearInterval(listenTimer);
                cfg.deviceComms.flush(); // making sure we flush the buffers
                if(__DEBUG__) {
                  debug('Found newest event: ',pkt);
                }
                progress(5);
                callback(null,pkt);
              }

              if (receive_seq < end_seq) {
                debug('We did not find any events');
                clearInterval(sendTimer);
                clearInterval(listenTimer);
              }
            }
          }
        };
        processPacket(cfg.deviceComms.nextPacket());
      }
    }, INTERVAL_FREQ);

    var sendTimer = setInterval(function () {
      if (send_seq % 1000 === 0) {
        console.log('requesting', send_seq);
      }
      if (!recovering && !pending) {
        tandemCommand(COMMANDS.LOG_ENTRY_SEQ_REQ, [send_seq], function (err) {
          if(err) {
            clearInterval(sendTimer);
            callback(err,null);
          }
        });
        if ((send_seq > end) && !recovering) {
          send_seq--;
        }
      }
    }, INTERVAL_FREQ); // if we spin too quickly on this, packets don't get sent when window doesn't have focus
  };

  var tandemCommandResponse = function (command, args, callback) {

    tandemCommand(command, args, function (err) {
      if(err) {
        callback(err,null);
      }
      listenForPacket(command,args,callback);
    });
  };

  // callback is called when EOF happens with all records retrieved
  var tandemDownloadRecords = function (progress, data, callback) {
    var retval = [];
    var entries;
    var end_seq;
    var start_seq;

    function iterate(err, result) {
      if (err) {
        debug('error retrieving record ', result);
        callback(err, null);
      }
      else {
        if (!result.payload.tdeps) {
          retval.push(result.payload);
        }
        if (result.payload.header_log_seq_no === end_seq) {
          debug('fetched all records');
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
        debug('fetch failed');
        callback(err, null);
      } else {
        debug('tandemFetchEventRange:', retval);
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
        debug('error reading settings');
        callback(err, null);
      }
      else {
        if (result.valid && result.descriptor === RESPONSES.IDP_TE.value) {
          parsed_profiles.push(result.payload);
          var profile_id = profile_ids.shift();
          if (profile_id === undefined) {
            data.profiles = parsed_profiles;
            debug('parsed profiles: ', parsed_profiles);
            callback(null, data);
          }
          else {
            tandemCommandResponse(COMMANDS.IDP_REQ, [profile_id], iterate);
          }
        }
      }
    }

    tandemCommandResponse(COMMANDS.GLOBALS_REQ, null, function (err, pkt) {
      if (err) {
        debug('Error reading globals ', err);
        callback(err, null);
      }
      else {
        tandemCommandResponse(COMMANDS.IDP_LIST_REQ, null, function (err, pkt) {
          if (err) {
            debug('Error reading globals ', err);
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
    if (__DEBUG__) {
      var start_exec = Date.now();
    }
    debug('getting event ranges');
    var entries;
    var end_seq;
    var start_seq;

    var minIndex;
    var maxIndex;
    var currentIndex;
    var currentTimestamp;
    var timestampToFind;

    function getNewestEvent(err, result) {

      if (err) {
        debug('error retrieving record ', result);
        callback(err, null);
      }

      timestampToFind = result.payload.rawTimestamp - 90 * 24 * 60 * 60 * 1000;

      debug('newest record deviceTime: ', result.payload.deviceTime);
      debug('end_seq after finding newest record: ', result.payload.header_log_seq_no);
      maxIndex = result.payload.header_log_seq_no;
      data.end_seq = result.payload.header_log_seq_no;

      if(__DEBUG__) {
        debug('oldest event seq: ', start_seq);
      }
      minIndex = start_seq;
      currentIndex = Math.floor( (minIndex + maxIndex) / 2);
      tandemCommandResponse(COMMANDS.LOG_ENTRY_SEQ_REQ, [currentIndex], binarySearch);
    }

    function binarySearch(err, result) {

      var foundClosest = function() {
        debug('90 day, closest record: ', result.payload.deviceTime);
        debug('start_seq: ', currentIndex);

        data.start_seq = currentIndex;
        if (__DEBUG__) {
          var end_exec = Date.now();
          var time = end_exec - start_exec;
          debug('Execution time for binary search: ' + time);
        }
        progress(10);
        cfg.deviceComms.flush(); // making sure we flush the buffers
        tandemFetchEventRange(progress, data, callback);
      };

      if (err) {
        debug('error retrieving record during binary search ', result);
        callback(err, null);
      }
      else {
        if (minIndex <= maxIndex) {

          currentTimestamp = result.payload.rawTimestamp;

          if (currentTimestamp < timestampToFind) {
            minIndex = currentIndex + 1;
          }
          else if (currentTimestamp > timestampToFind) {
            maxIndex = currentIndex - 1;
          }
          else {
            return foundClosest();
          }
          currentIndex = Math.floor( (minIndex + maxIndex) / 2 );
          if (currentIndex < start_seq) {
            currentIndex = start_seq;
          }
          tandemCommandResponse(COMMANDS.LOG_ENTRY_SEQ_REQ, [currentIndex], binarySearch);
        }
        else {
          return foundClosest();
        }
      }
    }

    debug('requesting log size');
    tandemCommandResponse(COMMANDS.LOG_SIZE_REQ, null, function (err, result) {
      if (err) {
        debug('Error reading log size ', err);
        callback(err, null);
      }
      else {
        if (result.valid && (result.descriptor === RESPONSES.LOG_SIZE_TE.value)) {
          entries = result.payload['entries'];
          end_seq = result.payload['end_seq'];
          start_seq = result.payload['start_seq']; // limit to 3000 for debugging
          debug('end_seq before looking for newest record: ',end_seq);
          newestEventRequester(end_seq, start_seq, progress, getNewestEvent);
        }
        else{
          console.log('Invalid log size:', result);
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
    var activeName = data.profiles[0].name; // first is always the active profile
    var basalSchedules = {};
    var carbSchedules = {};
    var sensitivitySchedules = {};
    var targetSchedules = {};
    data.profiles.forEach(function (profile) {
      var scheduleName = profile.name;
      var schedule = [];
      var carbSchedule = [];
      var sensitivitySchedule = [];
      var targetSchedule = [];
      profile.tdeps.forEach(function (tdep) {
        schedule.push({ rate: tdep['basalRate'], start: tdep['startTime'] });
        carbSchedule.push({ amount: tdep['carbRatio'], start: tdep['startTime'] });
        sensitivitySchedule.push({ amount: tdep['ISF'], 'start': tdep['startTime'] });
        targetSchedule.push({ target: tdep['TargetBG'], start: tdep['startTime'] });
      });
      basalSchedules[scheduleName] = schedule;
      carbSchedules[scheduleName] = carbSchedule;
      sensitivitySchedules[scheduleName] = sensitivitySchedule;
      targetSchedules[scheduleName] = targetSchedule;
    });

    var postsettings = cfg.builder.makeTandemPumpSettings()
      .with_activeSchedule(activeName)
      .with_units({ carb: 'grams', bg: 'mg/dL' })
      .with_basalSchedules(basalSchedules)
      .with_carbRatios(carbSchedules)
      .with_insulinSensitivities(sensitivitySchedules)
      .with_bgTargets(targetSchedules)
      .with_time(sundial.applyTimezone(uploadTime.jsDate, cfg.timezone).toISOString())
      .with_deviceTime(uploadTime.deviceTime)
      .with_timezoneOffset(sundial.getOffsetFromZone(uploadTime.jsDate, cfg.timezone))
      .with_conversionOffset(0)
      .done();

    postrecords.push(postsettings);
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
          var rawToTime = BASE_TIME + (event.date_after * 864e5) + tc.time_after;
          var datetimechange = cfg.builder.makeDeviceEventTimeChange()
            .with_change({
              from: sundial.formatDeviceTime(BASE_TIME + (event.date_prior * 864e5) + tc.time_prior),
              to: sundial.formatDeviceTime(rawToTime),
              agent: 'manual'
            })
            .with_deviceTime(sundial.formatDeviceTime(rawToTime))
            .set('jsDate', new Date(rawToTime))
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
    debug('Most recent datum at', mostRecent);
    var tzoUtil = new TZOUtil(
      cfg.timezone,
      mostRecent,
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
      if (bolus.bolex_size !== undefined || bolus.bolus_option === 'extended') {
        if (bolus.bolus_size !== undefined || bolus.insulin_requested !== undefined) {
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
          if(bolus.endDeviceTime !== undefined) {
            record = record.with_duration(
              Date.parse(bolus.endDeviceTime) - Date.parse(bolus.extendedStartDeviceTime)
            );
          }
          else{
            // no end time, so extended bolus still in progress
            debug('Extended bolus in progress: ', bolus);
            continue;
          }

          // cancelled before any insulin was given on dual bolus
          if (bolus.bolex_insulin_delivered === undefined) {
            record = record.with_extended(0);
          }
          else {
            record = record.with_extended(bolus.bolex_insulin_delivered);
          }
          record = record.with_expectedExtended(bolus.bolex_insulin_requested)
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
          record = record.with_expectedNormal(bolus.insulin_requested);
        }
        else {
          record = record.with_normal(bolus.insulin_delivered);
        }
      }
      // non-extended bolus cancelled before any insulin was given
      if ((bolus.bolus_option === 'standard' || bolus.bolus_option === 'quickbolus') &&
        bolus.bolus_size === undefined) {
        record = record.with_normal(0)
          .with_expectedNormal(bolus.insulin_requested);
      }
      // extended bolus cancelled before any insulin was given
      if (bolus.bolus_option === 'extended' && bolus.bolex_size === undefined) {
        record = record.with_duration(0)
          .with_extended(0)
          .with_expectedDuration(bolus.duration)
          .with_expectedExtended(bolus.bolex_insulin_requested);
      }
      record = record.set('index', bolus.index);
      cfg.tzoUtil.fillInUTCInfo(record, bolus.jsDate);
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

      var changesTypesArray = event.change_types;
      var filteredChangeTypes;
      if(event.change_types.length > 1) {
        filteredChangeTypes = _.without(event.change_types,'timed_segment','new_profile').join('|');
      } else {
        filteredChangeTypes = event.change_types[0];
      }

      switch (filteredChangeTypes) {
        case 'timed_segment':
        case 'new_profile':
        case 'temp_rate_end':
        case 'temp_rate_end|pump_resumed':
        case 'pump_resumed':
          // when the command_basal_rate is not the same as the base_basal_rate
          // that means we're in a temp basal that crosses the border between
          // scheduled segments, so the temp rate is being recalculated
          // as a percentage of the current base_basal_rate (from the schedule)
          if (event.command_basal_rate !== event.base_basal_rate) {
            postbasal = cfg.builder.makeTempBasal()
              .with_deviceTime(event.deviceTime)
              .with_rate(event.command_basal_rate)
              .set('index', event.index)
              .with_payload({change_types: changesTypesArray});
            cfg.tzoUtil.fillInUTCInfo(postbasal, event.jsDate);
            break;
          }
          postbasal = cfg.builder.makeScheduledBasal()
            .with_deviceTime(event.deviceTime)
            .with_rate(event.command_basal_rate)
            .set('index', event.index)
            .with_payload({
              personalProfileIndex : event.idp,
              change_types: changesTypesArray
            });
          cfg.tzoUtil.fillInUTCInfo(postbasal, event.jsDate);
          break;
        case 'temp_rate_start':
        case 'temp_rate_start|pump_resumed':
          postbasal = cfg.builder.makeTempBasal()
            .with_deviceTime(event.deviceTime)
            .with_rate(event.command_basal_rate)
            .set('index', event.index)
            .with_payload({change_types: changesTypesArray});
          cfg.tzoUtil.fillInUTCInfo(postbasal, event.jsDate);
          break;
        case 'pump_suspended':
        case 'temp_rate_end|pump_suspended':
          postbasal = cfg.builder.makeSuspendBasal()
            .with_deviceTime(event.deviceTime)
            .set('index', event.index)
            .with_payload({change_types: changesTypesArray});
          cfg.tzoUtil.fillInUTCInfo(postbasal, event.jsDate);
          break;
        case 'pump_shut_down':
        case 'temp_rate_end|pump_shut_down':
          // no basal record gets built in this case
          break;
        default:
          debug('Event with unhandled change type:', event);
          throw new Error('Unhandled combination of basal change types: ' + event.change_types.join('|'));
      }
      if (postbasal != null) {
        if(postbasal.deliveryType === 'temp') {
          var suppressed = {
            type: 'basal',
            deliveryType: 'scheduled',
            rate: event.base_basal_rate
          };
          postbasal.set('suppressed', suppressed);
        }
        records.push(postbasal);
      }
    }
    return records;
  };

  var buildTempBasalRecords = function(data, records) {
    var tempBasalRecords = filterLogEntries([PUMP_LOG_RECORDS.LID_TEMP_RATE_ACTIVATED,PUMP_LOG_RECORDS.LID_TEMP_RATE_COMPLETED], data.log_records);

    for(var i = 0; i < tempBasalRecords.length; ++i) {
      var event = tempBasalRecords[i];
      var record = null;
      if(event.header_id === PUMP_LOG_RECORDS.LID_TEMP_RATE_ACTIVATED.value) {
        record = {
          type: 'temp-basal',
          subType: 'start',
          percent: event.percent,
          duration: event.duration
        };
      }
      else if(event.header_id === PUMP_LOG_RECORDS.LID_TEMP_RATE_COMPLETED.value) {
        record = {
          type: 'temp-basal',
          subType: 'stop',
          time_left: event.time_left
        };
      }
      record.deviceTime = event.deviceTime;
      record.index = event.index;
      cfg.tzoUtil.fillInUTCInfo(record, event.jsDate);
      records.push(record);
    }
    return records;
  };

  var buildNewDayRecords = function(data, records) {
    var newDayRecords = filterLogEntries([PUMP_LOG_RECORDS.LID_NEW_DAY], data.log_records);

    for (var b = 0; b < newDayRecords.length; ++b) {
      var event = newDayRecords[b];
      var rate = event.commanded_basal_rate;
      if ((rate !== null) && (rate > 0)) {
        // new day event; breaks up flat-rate basals
        var postrecord = cfg.builder.makeScheduledBasal()
            .with_deviceTime(event.deviceTime)
            .with_rate(rate)
            .set('index', event.index);
        cfg.tzoUtil.fillInUTCInfo(postrecord, event.jsDate);
        postrecord.set('type', 'new-day');
        records.push(postrecord);
      }
    }
    return records;
  };

  var buildSuspendRecords = function (data, records) {
    var suspendRecords = filterLogEntries([PUMP_LOG_RECORDS.LID_PUMPING_SUSPENDED], data.log_records);

    suspendRecords.forEach(function (entry) {
      var postrecord = cfg.builder.makeDeviceEventSuspend()
          .with_reason({suspended: 'manual'})
          .with_deviceTime(entry.deviceTime)
          .set('index', entry.index);
      cfg.tzoUtil.fillInUTCInfo(postrecord, entry.jsDate);
      records.push(postrecord.done());
    });

    return records;
  };

  var buildResumeRecords = function (data, records) {
    var resumeRecords = filterLogEntries([PUMP_LOG_RECORDS.LID_PUMPING_RESUMED], data.log_records);

    resumeRecords.forEach(function (entry) {
      var postrecord = cfg.builder.makeDeviceEventResume()
          .with_reason({resumed: 'manual'})
          .with_deviceTime(entry.deviceTime)
          .set('index', entry.index);
      cfg.tzoUtil.fillInUTCInfo(postrecord, entry.jsDate);
      records.push(postrecord);
    });

    return records;
  };

  var buildCartridgeChangeRecords = function (data, records) {
    var cartridgeChangeRecords = filterLogEntries([PUMP_LOG_RECORDS.LID_TUBING_FILLED,PUMP_LOG_RECORDS.LID_CANNULA_FILLED,PUMP_LOG_RECORDS.LID_CARTRIDGE_FILLED], data.log_records);

    cartridgeChangeRecords.forEach(function (entry) {
      var cartridgeChangeRecord;
      if (entry.header_id === PUMP_LOG_RECORDS.LID_TUBING_FILLED.value) {
        cartridgeChangeRecord = cfg.builder.makeDeviceEventPrime()
          .with_primeTarget('tubing')
          .with_volume(entry.prime_size);
      } else if (entry.header_id === PUMP_LOG_RECORDS.LID_CANNULA_FILLED.value) {
        cartridgeChangeRecord = cfg.builder.makeDeviceEventPrime()
          .with_primeTarget('cannula')
          .with_volume(entry.prime_size);
      } else if (entry.header_id === PUMP_LOG_RECORDS.LID_CARTRIDGE_FILLED.value) {
        cartridgeChangeRecord = cfg.builder.makeDeviceEventReservoirChange()
          .with_payload({event: 'cartridge_filled',
                         insulin_display: entry.insulin_display,
                         insulin_actual: entry.insulin_actual});
      }

      cartridgeChangeRecord.with_deviceTime(entry.deviceTime)
          .set('index',entry.index);
      cfg.tzoUtil.fillInUTCInfo(cartridgeChangeRecord, entry.jsDate);
      records.push(cartridgeChangeRecord.done());
    });

    return records;
  };
  var buildCannulaChangeRecords = function (data, records) {
    return records;
  };

  var buildBGRecords = function (data, records) {
    var bgRecords = filterLogEntries([PUMP_LOG_RECORDS.LID_BG_READING_TAKEN], data.log_records);
    bgRecords.forEach(function (bgEntry) {
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

  var buildAlarmRecords = function (data,records) {
    var alarmRecords = filterLogEntries([PUMP_LOG_RECORDS.LID_ALARM_ACTIVATED,PUMP_LOG_RECORDS.LID_ALERT_ACTIVATED],data.log_records);
    alarmRecords.forEach(function (alarmEntry) {
      var alarmRecord = cfg.builder.makeDeviceEventAlarm()
        .with_deviceTime(alarmEntry.deviceTime)
        .set('index', alarmEntry.index);
      cfg.tzoUtil.fillInUTCInfo(alarmRecord, alarmEntry.jsDate);

      if(alarmEntry.alarm_id != null) {
        var alarmValue = alarmEntry.alarm_id;
        var alarmText = getAlarmName(alarmValue,ALARM_TYPES);
        var postbasal = null;

        switch (alarmValue) {
          case ALARM_TYPES.ALARM_OCCLUSION.value:
            alarmRecord = alarmRecord.with_alarmType('occlusion');
            // occlusions do not create suspended basals in basal rate change events,
            // so we have to create them manually
            postbasal = cfg.builder.makeSuspendBasal()
              .with_deviceTime(alarmEntry.deviceTime)
              .with_payload({alarm_id: alarmValue})
              .set('index', alarmEntry.index);
            annotate.annotateEvent(postbasal, 'tandem/basal/fabricated-from-occlusion-alarm');
            cfg.tzoUtil.fillInUTCInfo(postbasal, alarmEntry.jsDate);
            records.push(postbasal);
            break;
          case ALARM_TYPES.ALARM_SECOND_OCCLUSION.value:
            alarmRecord = alarmRecord.with_alarmType('occlusion');
            alarmRecord = alarmRecord.with_payload({alarm_id: alarmValue, alarm_name: alarmText});
            // occlusions do not create suspended basals in basal rate change events,
            // so we have to create them manually
            postbasal = cfg.builder.makeSuspendBasal()
              .with_deviceTime(alarmEntry.deviceTime)
              .with_payload({alarm_id: alarmValue, alarm_name: alarmText})
              .set('index', alarmEntry.index);
            annotate.annotateEvent(postbasal, 'tandem/basal/fabricated-from-occlusion-alarm');
            cfg.tzoUtil.fillInUTCInfo(postbasal, alarmEntry.jsDate);
            records.push(postbasal);
            break;
          case ALARM_TYPES.ALARM_AUTO_OFF.value:
            alarmRecord = alarmRecord.with_alarmType('auto_off');
            break;
          case ALARM_TYPES.ALARM_OUT_OF_LIQUID.value:
            alarmRecord = alarmRecord.with_alarmType('no_insulin');
            break;
          case ALARM_TYPES.ALARM_EXTREMELY_LOW_LIPO.value:
            alarmRecord = alarmRecord.with_alarmType('no_power');
            break;
          case ALARM_TYPES.ALARM_TEMPERATURE_OUT_OF_RANGE:
          case ALARM_TYPES.ALARM_STUCK_WAKE_BUTTON:
          case ALARM_TYPES.ALARM_PRESSURE_OUT_OF_RANGE:
          case ALARM_TYPES.ALARM_CARTRIDGE_REMOVED:
            alarmRecord = alarmRecord.with_alarmType('other');
            alarmRecord = alarmRecord.with_payload({alarm_id: alarmValue, alarm_name: alarmText});
            break;
          default:
            alarmRecord = alarmRecord.with_alarmType('other');
            alarmRecord = alarmRecord.with_payload({alarm_id: alarmValue});
        }
      }

      if(alarmEntry.alert_id != null) {
        var alertValue = alarmEntry.alert_id;
        var alertText = getAlarmName(alertValue, ALERT_TYPES);

        switch (alertValue) {
          case ALERT_TYPES.ALERT_LOW_INSULIN.value:
            alarmRecord = alarmRecord.with_alarmType('low_insulin');
            break;
          case ALERT_TYPES.ALERT_LOW_LIPO_CHARGE.value:
          case ALERT_TYPES.ALERT_VERY_LOW_LIPO_CHARGE.value:
            alarmRecord = alarmRecord.with_alarmType('low_power');
            alarmRecord = alarmRecord.with_payload({alert_name: alertText});
            break;
          default:
            alarmRecord = alarmRecord.with_alarmType('other');
            alarmRecord = alarmRecord.with_payload({alert_id: alertValue});
        }
      }

      alarmRecord = alarmRecord.done();
      records.push(alarmRecord);
    });

    return records;
  };

  var probe = function (cb, data) {
    tandemCommandResponse(COMMANDS.VERSION_REQ, null, function (err, result) {
      if (err) {
        console.log(err);
        cb(err, null);
      }
      else {
        console.log('Tandem found: ', result);
        if (data == null) {
          data = {};
        }
        data.model_no = result.payload.model_no;
        data.pump_sn = result.payload.pump_sn;
        cb(null, data);
      }
    });
  };

  return {
    setup: function (deviceInfo, progress, cb) {
      debug('in setup!');
      progress(100);
      cb(null, { stage: 'setup', deviceInfo: deviceInfo });
    },

    connect: function (progress, data, cb) {
      console.log('connecting');
      cfg.deviceComms.connect(data.deviceInfo, tandemPacketHandler, probe, function (err) {
        if(err) {
          cb(err,null);
        }else{
          cfg.deviceComms.flush();
          progress(100);
          data.stage = 'connect';
          cb(null, data);
        }
      });
    },

    getConfigInfo: function (progress, data, cb) {
      debug('in getConfigInfo');
      data.stage = 'getConfigInfo';
      progress(100);
      probe(cb, data);
    },

    fetchData: function (progress, data, cb) {
      debug('in fetchData');
      tandemFetch(progress, data, cb);
      data.stage = 'fetchData';
    },

    processData: function (progress, data, cb) {
      debug('in processData');
      progress(100);
      data.stage = 'processData';
      cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      data.stage = 'uploadData';
      progress(0);
      var deviceId = 'tandem' + data.model_no + data.pump_sn;
      cfg.builder.setDefaults({ deviceId: deviceId });

      var postrecords = [], settings = null;
      /*
        Because pump shut-down interferes with BtUTC, anywhere
        where a pump shut-down appears in records to be processed
        we only attempt to process and upload the data following
        the most recent device shut-down.
      */
      if (!__DEBUG__) {
        data.log_records = _.takeRightWhile(data.log_records, function(rec) {
          if (rec.change_types &&
            _.includes(rec.change_types,'pump_shut_down')) {
            debug('Most recent pump shut down:', rec);
            return false;
          }
          return true;
        });
        debug('Will process', data.log_records.length, 'log records.');
      }

      if (!_.isEmpty(data.log_records)) {
        postrecords = buildSettingsRecords(data, postrecords);
        if (!_.isEmpty(postrecords)) {
          settings = postrecords[0];
        }
        postrecords = buildTimeChangeRecords(data, postrecords);
        postrecords = buildBolusRecords(data, postrecords);

        postrecords = buildBasalRecords(data, postrecords);
        postrecords = buildNewDayRecords(data, postrecords);
        postrecords = buildBGRecords(data, postrecords);
        postrecords = buildTempBasalRecords(data, postrecords);
        postrecords = buildCartridgeChangeRecords(data, postrecords);
        postrecords = buildSuspendRecords(data, postrecords);
        postrecords = buildResumeRecords(data, postrecords);
        postrecords = buildAlarmRecords(data, postrecords);
        // sort by time for the simulator
        postrecords = _.sortBy(postrecords, function(d) { return d.time; });
      }
      else {
        throw new Error('No records since most recent pump shut down; nothing to upload.');
      }

      var simulator = tandemSimulatorMaker.make({settings: settings, profiles:data.profiles});

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
            else if(datum.subType === 'prime' || datum.subType === 'reservoirChange'){
              simulator.cartridgeChange(datum);
            }
            else if (datum.subType === 'status') {
              if(datum.status === 'suspended') {
                simulator.suspend(datum);
              }
              else if (datum.status === 'resumed') {
                simulator.resume(datum);
              }
            }
            else if (datum.subType === 'alarm'){
              simulator.alarm(datum);
            }
            else {
              debug('Unknown deviceEvent subType:', datum.subType);
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
          case 'new-day':
            simulator.newDay(datum);
            break;
          case 'temp-basal':
            simulator.tempBasal(datum);
            break;
          default:
            debug('[Hand-off to simulator] Unhandled type!', datum.type);
        }
      }
      simulator.finalBasal();
      data.post_records = [];

      var sessionInfo = {
        deviceTags: ['insulin-pump'],
        deviceManufacturers: ['Tandem'],
        deviceModel: String(data.model_no),
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
            debug('Error: ', err);
            debug('Result: ', result);
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
      debug('disconnect');
      progress(100);
      data.disconnect = true;
      cb(null, data);
    },

    cleanup: function (progress, data, cb) {
      debug('in cleanup');
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
