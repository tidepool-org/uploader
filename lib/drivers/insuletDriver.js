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

var _ = require('lodash');
var struct = require('./../struct.js')();
var sundial = require('sundial');

module.exports = function (config) {
  var cfg = _.clone(config);
  var buf;
  var bytes;

  // all insulin unit readings are in .01 unit increments, so we divide by 100.0 to get units
  // (multiplying by 0.01 tends to cause floating point issues)
  var toUnits = function (x) {
    return x / 100.0;
  };

  // This is a particularly weak checksum algorithm but that's what Insulet uses...
  var weakChecksum = function (offset, count) {
    var total = 0;
    for (var i = 0; i < count; ++i) {
      total += bytes[offset + i];
    }
    return total & 0xFFFF;
  };

  var getRecord = function (offset) {
    var recsize = struct.extractBEShort(bytes, offset);
    var retval = {
      recsize: recsize,
      packetlen: recsize + 2,
      rawdata: new Uint8Array(buf, offset + 2, recsize - 2),
      chksum: struct.extractBEShort(bytes, offset + recsize),
      calcsum: weakChecksum(offset + 2, recsize - 2)
    };
    retval.valid = (retval.calcsum == retval.chksum);
    return retval;
  };

  var addTimestamp = function (o) {
    var dt = sundial.buildTimestamp(o);
    if (dt) {
      o.timestamp = sundial.applyTimezone(dt, cfg.timezone);
      o.deviceTime = sundial.formatDeviceTime(dt);
      o.timezoneOffset = sundial.getOffsetFromZone(o.timestamp, cfg.timezone);
    }
  };

  // postprocess is a function that accepts a record, optionally modifies it,
  // and returns null if the record is good, and a message if processing should halt.
  var fixedRecords = {
    ibf_version: { format: '6S8z8z', fields: [
      'ibf_maj', 'ibf_min', 'ibf_patch',
      'eng_maj', 'eng_min', 'eng_patch',
      'vendorid', 'productid'
    ], postprocess: function (rec) {
      if ((rec.ibf_maj === 0) && (rec.ibf_min >= 1) &&
          (rec.eng_maj === 0) && (rec.ibf_min >= 1) &&
          (rec.vendorid === 'Insulet') && (rec.productid === 'OmniPod')) {
        return null;
      } else {
        return 'ibf_version record is incompatible with this driver.';
      }
    }
    },
    pdm_version: { format: '3S', fields: [
      'pdm_maj', 'pdm_min', 'pdm_patch'
    ], postprocess: function (rec) {
      if ((rec.pdm_maj === 2) && (rec.pdm_min >= 3)) {
        return null;
      } else {
        return 'pdm_version record is incompatible with this driver.';
      }
    } },
    // this format gets rewritten before being used
    mfg_data: { format: '??z', fields: ['data']},
    basal_programs_hdr: { format: '3S', fields: [
      'num_progs', 'enabled_idx', 'max_name_size'
    ] },
    // this format gets rewritten before being used
    basal_programs_name: { format: 'S??z', fields: ['index', 'name'] },
    eeprom_settings: {
      format: '13.4i2b4.b5.b.bb8.i19.7b3sb19.bi',
      fields: [
        'BOLUS_INCR',
        'BOLUS_MAX',
        'BASAL_MAX',
        'LOW_VOL',
        'AUTO_OFF',
        'LANGUAGE',
        'EXPIRE_ALERT',
        'BG_REMINDER',
        'CONF_ALERT',
        'REMDR_ALERT',
        'REMOTE_ID',
        'TEMP_BAS_TYPE',
        'EXT_BOL_TYPE',
        'BOL_REMINDER',
        'BOL_CALCS',
        'BOL_CALCS_REVERSE',
        'BG_DISPLAY',
        'BG_SOUND',
        'BG_MIN',
        'BG_GOAL_LOW',
        'BG_GOAL_UP',
        'INSULIN_DURATION',
        'ALARM_REPAIR_COUNT',
        'PDM_CONFIG'
      ],
      postprocess: function (rec) {
        rec.bolus_incr_units = toUnits(rec.BOLUS_INCR);
        rec.bolus_max_units = toUnits(rec.BOLUS_MAX);
        rec.basal_max_units = toUnits(rec.BASAL_MAX);
        rec.low_vol_units = toUnits(rec.LOW_VOL);
        rec.serial_number = rec.REMOTE_ID.toString();
        if (rec.BG_DISPLAY === 0) {
          rec.units = 'mg/dL';
        } else {
          rec.units = 'mmol/L';
        }
        rec.insulin_duration_msec = rec.INSULIN_DURATION * sundial.MIN30_TO_MSEC;
        return null;
      }
    },
    profile_hdr: { format: 'b6.Si', fields: [
      'profile_idx', 'error_code', 'operation_time'
    ] },
    log_hdr: { format: '7bS3b.S', fields: [
      'logs_info_revision',
      'insulin_history_revision',
      'alarm_history_revision',
      'blood_glucose_revision',
      'insulet_stats_revision',
      'day',
      'month',
      'year',
      'seconds',
      'minutes',
      'hours',
      'num_log_descriptions'
    ]},
    log_description: { format: '5S2N', fields: [
      'log_index', 'backup', 'location', 'has_variable', 'record_size',
      'first_index', 'last_index'
    ]},
    log_record: { format: 'bNSSbbsbbb.i', fields: [
      'log_id', 'log_index', 'record_size', 'error_code',
      'day', 'month', 'year', 'seconds', 'minutes', 'hours',
      'secs_since_powerup'
    ]},
    history_record: { format: 'bNSSbbsbbb.ins..', fields: [
      'log_id', 'log_index', 'record_size', 'error_code',
      'day', 'month', 'year', 'seconds', 'minutes', 'hours',
      'secs_since_powerup', 'rectype', 'flags'
    ]}
  };

  var logRecords = {
    0x0000: { value: 0x0000, name: 'End_Marker', format: '', fields: [] },
    0x0001: { value: 0x0001, name: 'Deactivate', format: '', fields: [] },
    0x0002: { value: 0x0002, name: 'Time_Change', format: '3b.', fields: [
      'seconds',
      'minutes',
      'hours'
    ]
    },
    0x0004: { value: 0x0004, name: 'Bolus', format: 'isss', fields: [
      'volume',
      'extended_duration_minutes',
      'calculation_record_offset',
      'immediate_duration_seconds'
    ], postprocess: function (rec) {
      rec.volume_units = toUnits(rec.volume);
      rec.extended_duration_msec = rec.extended_duration_minutes * sundial.MIN_TO_MSEC;
      rec.immediate_duration_msec = rec.immediate_duration_seconds * sundial.SEC_TO_MSEC;
      // console.log('bolus vol: %f, immed: %d sec, ext: %d min',
      //     rec.volume_units, rec.immediate_duration_seconds, rec.extended_duration_minutes);
    }
    },
    0x0008: { value: 0x0008, name: 'Basal_Rate', format: 'iss', fields: [
      'basal_rate', 'duration', 'percent'
    ], postprocess: function (rec) {
      rec.basal_rate_units_per_hour = toUnits(rec.basal_rate);
      rec.duration_msec = rec.duration * sundial.MIN_TO_MSEC;
    }
    },
    0x0010: { value: 0x0010, name: 'Suspend', format: '', fields: [] },
    0x0020: { value: 0x0020, name: 'Date_Change', format: 'bbs', fields: [
      'day',
      'month',
      'year'
    ]
    },
    0x0040: { value: 0x0040, name: 'Suggested_Calc', format: '4in3i6s', fields: [
      'correction_delivered', 'carb_bolus_delivered',
      'correction_programmed', 'carb_bolus_programmed',
      'correction_suggested', 'carb_bolus_suggested',
      'correction_iob', 'meal_iob',
      'correction_factor_used', 'current_bg',
      'target_bg', 'bg_correction_threshold',
      'carb_grams', 'ic_ratio_used'
    ],
      postprocess: function (rec) {
        rec.corr_units_delivered = toUnits(rec.correction_delivered);
        rec.carb_bolus_units_delivered = toUnits(rec.carb_bolus_delivered);
        rec.corr_units_programmed = toUnits(rec.correction_programmed);
        rec.carb_bolus_units_programmed = toUnits(rec.carb_bolus_programmed);
        rec.corr_units_suggested = toUnits(rec.correction_suggested);
        rec.carb_bolus_units_suggested = toUnits(rec.carb_bolus_suggested);
        rec.corr_units_iob = toUnits(rec.correction_iob);
        rec.meal_units_iob = toUnits(rec.meal_iob);
      }
    },
    0x0080: { value: 0x0080, name: 'Remote_Hazard_Alarm', format: '2bs3b.4s', fields: [
      'day', 'month', 'year', 'seconds', 'minutes', 'hours',
      'alarm_type', 'file_number', 'line_number', 'error_code'
    ], postprocess: function (rec) {
      addTimestamp(rec);
    }
    },
    0x0400: { value: 0x0400, name: 'Alarm', format: '2bs3b.4s', fields: [
      'day', 'month', 'year', 'seconds', 'minutes', 'hours',
      'alarm_type', 'file_number', 'line_number', 'error_code'
    ], postprocess: function (rec) {
      addTimestamp(rec);
    }
    },
    0x0800: { value: 0x0800, name: 'Blood_Glucose', format: 'is24z24zb.', fields: [
      'error_code', 'bg_reading',
      'user_tag_1', 'user_tag_2',
      'flags'
    ]
    },
    0x1000: { value: 0x1000, name: 'Carb', format: 'sbb', fields: [
      'carbs',
      'was_preset',
      'preset_type'
    ]
    },
    0x2000: { value: 0x2000, name: 'Terminate_Bolus', format: 'is', fields: [
      'insulin_left',
      'time_left_seconds'
    ], postprocess: function (rec) {
      rec.insulin_units_left = toUnits(rec.insulin_left);
      rec.time_left_msec = rec.time_left_seconds * sundial.SEC_TO_MSEC;
    }
    },
    0x4000: { value: 0x4000, name: 'Terminate_Basal', format: 's', fields: [
      'time_left_minutes'
    ], postprocess: function (rec) {
      rec.time_left_msec = rec.time_left_minutes * sundial.MIN_TO_MSEC;
    }
    },
    0x8000: { value: 0x8000, name: 'Activate', format: '2S6b', fields: [
      'lot_number', 'serial_number',
      'pod_maj', 'pod_min', 'pod_patch',
      'interlock_maj', 'interlock_min', 'interlock_patch'
    ]
    },
    0x10000: { value: 0x10000, name: 'Resume', format: '', fields: [] },
    0x20000: { value: 0x20000, name: 'Download', format: '', fields: [] },
    0x40000: { value: 0x40000, name: 'Occlusion', format: '', fields: [] }
  };

  var PROFILES = {
    carbRatio: {
      value: 11, name: 'carbRatio', mfrname: 'IC Ratio', isBasal: false,
      keyname: 'amount', valuename: 'value'
    },
    insulinSensitivity: {
      value: 12, name: 'insulinSensitivity', mfrname: 'Correction', isBasal: false,
      keyname: 'amount', valuename: 'value'
    },
    bgTarget: {
      value: 13, name: 'bgTarget', mfrname: 'Target BG', isBasal: false,
      keyname: 'low', valuename: 'value'
    },
    bgThreshold: {
      value: 14, name: 'bgThreshold', mfrname: 'BG Threshold', isBasal: false,
      keyname: 'amount', valuename: 'value'
    },
    basalprofile0: {
      value: 15, name: 'basalprofile0', mfrname: 'Basal Profile 0', isBasal: true,
      keyname: 'rate', valuename: 'units'
    },
    basalprofile1: {
      value: 16, name: 'basalprofile1', mfrname: 'Basal Profile 1', isBasal: true,
      keyname: 'rate', valuename: 'units'
    },
    basalprofile2: {
      value: 17, name: 'basalprofile2', mfrname: 'Basal Profile 2', isBasal: true,
      keyname: 'rate', valuename: 'units'
    },
    basalprofile3: {
      value: 18, name: 'basalprofile3', mfrname: 'Basal Profile 3', isBasal: true,
      keyname: 'rate', valuename: 'units'
    },
    basalprofile4: {
      value: 19, name: 'basalprofile4', mfrname: 'Basal Profile 4', isBasal: true,
      keyname: 'rate', valuename: 'units'
    },
    basalprofile5: {
      value: 20, name: 'basalprofile5', mfrname: 'Basal Profile 5', isBasal: true,
      keyname: 'rate', valuename: 'units'
    },
    basalprofile6: {
      value: 21, name: 'basalprofile6', mfrname: 'Basal Profile 6', isBasal: true,
      keyname: 'rate', valuename: 'units'
    }
  };

  var pump_alarm_record = {
    format: '2bs3b.s.b2i6b', fields: [
      'day', 'month', 'year', 'seconds', 'minutes', 'hours',
      'alarm', 'error_code', 'lot_number', 'seq_number',
      'processor_maj', 'processor_min', 'processor_patch',
      'interlock_maj', 'interlock_min', 'interlock_patch'
    ]
  };

  var PDM_CONFIG_FLAGS = {
    SUGGESTED_BOLUS_STYLE: { value: 0x01, name: 'SUGGESTED_BOLUS_STYLE' },
    PRODUCT_ID: { mask: 0x1E, shift: 1, name: 'PRODUCT_ID' },
    LOT_TID_SUPPORT: { value: 0x20, name: 'LOT_TID_SUPPORT' },
    BG_BOARD_TYPE: { mask: 0x3C0, shift: 6, name: 'BG_BOARD_TYPE' }
  };

  var LOG_FLAGS = {
    CARRY_OVER_FLAG: { value: 0x01, name: 'CARRY_OVER_FLAG' },
    NEW_DAY_FLAG: { value: 0x02, name: 'NEW_DAY_FLAG' },
    IN_PROGRESS_FLAG: { value: 0x04, name: 'IN_PROGRESS_FLAG' },
    END_DAY_FLAG: { value: 0x08, name: 'END_DAY_FLAG' },
    UNCOMFIRMED_FLAG: { value: 0x10, name: 'UNCOMFIRMED_FLAG' },
    REVERSE_CORR_FLAG: { value: 0x0100, name: 'REVERSE_CORR_FLAG' },
    MAX_BOLUS_FLAG: { value: 0x0200, name: 'MAX_BOLUS_FLAG' },
    ERROR: { value: 0x80000000, name: 'ERROR' }
  };

  var LOG_TYPES = {
    HISTORY: { value: 0x03, name: 'HISTORY' },
    PUMP_ALARM: { value: 0x05, name: 'PUMP_ALARM' },
    DELETED: { mask: 0x80000000, name: 'DELETED' },
    // this is an impossible value for a 1-byte LOG_TYPE
    IGNORE: { value: 0x100, name: 'IGNORED by driver' }
  };

  var ALARM_TYPES = {
    ALARM_PDM_ERROR0: { value: 0, name: 'ALARM_PDM_ERROR0' },
    ALARM_PDM_ERROR1: { value: 1, name: 'ALARM_PDM_ERROR1' },
    ALARM_PDM_ERROR2: { value: 2, name: 'ALARM_PDM_ERROR2' },
    ALARM_PDM_ERROR3: { value: 3, name: 'ALARM_PDM_ERROR3' },
    ALARM_PDM_ERROR4: { value: 4, name: 'ALARM_PDM_ERROR4' },
    ALARM_PDM_ERROR5: { value: 5, name: 'ALARM_PDM_ERROR5' },
    ALARM_PDM_ERROR6: { value: 6, name: 'ALARM_PDM_ERROR6' },
    ALARM_PDM_ERROR7: { value: 7, name: 'ALARM_PDM_ERROR7' },
    ALARM_PDM_ERROR8: { value: 8, name: 'ALARM_PDM_ERROR8' },
    ALARM_PDM_ERROR9: { value: 9, name: 'ALARM_PDM_ERROR9' },
    ALARM_SYSTEM_ERROR10: { value: 10, name: 'ALARM_SYSTEM_ERROR10' },
    ALARM_SYSTEM_ERROR12: { value: 12, name: 'ALARM_SYSTEM_ERROR12' },
    ALARM_HAZ_REMOTE: { value: 13, name: 'ALARM_HAZ_REMOTE' },
    ALARM_HAZ_PUMP_VOL: { value: 14, name: 'ALARM_HAZ_PUMP_VOL' },
    ALARM_HAZ_PUMP_AUTO_OFF: { value: 15, name: 'ALARM_HAZ_PUMP_AUTO_OFF' },
    ALARM_HAZ_EXPIRED: { value: 16, name: 'ALARM_HAZ_EXPIRED' },
    ALARM_HAZ_OCCL: { value: 17, name: 'ALARM_HAZ_OCCL' },
    ALARM_HAZ_ACTIVATE: { value: 18, name: 'ALARM_HAZ_ACTIVATE' },
    ALARM_KEY: { value: 21, name: 'ALARM_KEY' },
    ALARM_ADV_PUMP_VOL: { value: 23, name: 'ALARM_ADV_PUMP_VOL' },
    ALARM_ADV_PUMP_AUTO_OFF: { value: 24, name: 'ALARM_ADV_PUMP_AUTO_OFF' },
    ALARM_ADV_PUMP_SUSPEND: { value: 25, name: 'ALARM_ADV_PUMP_SUSPEND' },
    ALARM_ADV_PUMP_EXP1: { value: 26, name: 'ALARM_ADV_PUMP_EXP1' },
    ALARM_ADV_PUMP_EXP2: { value: 27, name: 'ALARM_ADV_PUMP_EXP2' },
    ALARM_SYSTEM_ERROR28: { value: 28, name: 'ALARM_SYSTEM_ERROR28' },
    ALARM_EXPIRATION: { value: 37, name: 'ALARM_EXPIRATION' },
    ALARM_PDM_AUTO_OFF: { value: 39, name: 'ALARM_PDM_AUTO_OFF' }
  };

  var LOG_ERRORS = {
    eLogNoErr: { value: 0, name: 'eLogNoErr' },
    eLogGetEEPROMErr: { value: 3, name: 'eLogGetEEPROMErr' },
    eLogCRCErr: { value: 4, name: 'eLogCRCErr' },
    eLogLogIndexErr: { value: 6, name: 'eLogLogIndexErr' },
    eLogRecSizeErr: { value: 8, name: 'eLogRecSizeErr' }
  };

  var getItemWithValue = function (list, itemname, valuename, value) {
    for (var i in list) {
      if (list[i][valuename] == value) {
        return list[i][itemname];
      }
    }
    return null;
  };

  var getNameForValue = function (list, v) {
    return getItemWithValue(list, 'name', 'value', v);
  };

  var getValueForName = function (list, n) {
    return getItemWithValue(list, 'value', 'name', n);
  };


  var getFlagNames = function (list, v) {
    var flags = [];
    for (var i in list) {
      if (list[i].value & v) {
        flags.push(list[i].name);
      }
    }
    return flags.join('|');
  };


  var getFixedRecord = function (recname, offset) {
    var rec = getRecord(offset);
    var decoded = struct.unpack(rec.rawdata, 0,
                                fixedRecords[recname].format, fixedRecords[recname].fields);
    _.assign(rec, decoded);
    // console.log(rec);
    return rec;
  };

  var getManufacturingData = function (offset) {
    var rec = getRecord(offset);
    var fmt = rec.recsize + 'z';
    var decoded = struct.unpack(rec.rawdata, 0, fmt, fixedRecords.mfg_data.fields);
    _.assign(rec, decoded);
    return rec;
  };

  var getBasalProgramNames = function (offset) {
    var basalProgramsHeader = getFixedRecord('basal_programs_hdr', offset);
    var basalProgramNames = [];
    for (var i = 0; i < 7; ++i) {
      var prgOffset = 6 + i * (2 + basalProgramsHeader.max_name_size);
      // the format for the name data is dependent on the name size
      fixedRecords.basal_programs_name.format = 'S' +
                                                basalProgramsHeader.max_name_size + 'z';
      var prog = struct.unpack(basalProgramsHeader.rawdata, prgOffset,
                               fixedRecords.basal_programs_name.format,
                               fixedRecords.basal_programs_name.fields);
      basalProgramNames.push(prog);
    }
    basalProgramsHeader.names = basalProgramNames;
    // console.log(basalProgramsHeader);
    return basalProgramsHeader;
  };

  var getProfiles = function (offset, basalProgramNames) {
    var profiles = [];
    var totalLen = 0;
    // there are 11 profiles in a row
    for (var i = 0; i < 11; ++i) {
      // profiles consist of a header plus 48 integers
      var profile = getFixedRecord('profile_hdr', offset);
      profile.standard_name = getItemWithValue(PROFILES, 'mfrname', 'value', profile.profile_idx);
      if (getItemWithValue(PROFILES, 'isBasal', 'value', profile.profile_idx)) {
        // user-assigned name is at an index in the program names
        // relative to the profile index, which starts at 15 in
        // insulet data
        profile.name = basalProgramNames[profile.profile_idx - 15].name;
      }
      profile.steps = [];
      var step_offset = struct.structlen(fixedRecords.profile_hdr.format);
      for (var j = 0; j < 48; ++j) {
        profile.steps.push({
                             // profile steps are every 30 minutes starting at midnight
                             // convert them to milliseconds
                             starttime: j * sundial.MIN30_TO_MSEC,
                             value: struct.extractInt(profile.rawdata, step_offset + j * 4)
                           });
        // if it's a basal profile, add the units conversion
        if (getItemWithValue(PROFILES, 'isBasal', 'value', profile.profile_idx)) {
          profile.steps[j].units = toUnits(profile.steps[j].value);
        }
      }
      profiles.push(profile);
      offset += profile.packetlen;
      totalLen += profile.packetlen;
    }
    profiles.packetlen = totalLen;
    return profiles;
  };

  var getLogDescriptions = function (offset) {
    var logDescriptions = getFixedRecord('log_hdr', offset);
    logDescriptions.descs = [];
    addTimestamp(logDescriptions);
    for (var i = 0; i < logDescriptions.num_log_descriptions; ++i) {
      var descOffset = 15 + i * 18;
      var desc = struct.unpack(logDescriptions.rawdata, descOffset,
                               fixedRecords.log_description.format,
                               fixedRecords.log_description.fields);
      logDescriptions.descs.push(desc);
    }
    // console.log(logDescriptions);
    return logDescriptions;
  };

  var getLogRecord = function (offset) {
    var rec = getRecord(offset);
    var logheader = struct.unpack(rec.rawdata, 0,
                                  fixedRecords.log_record.format,
                                  fixedRecords.log_record.fields);
    if (logheader.log_id == LOG_TYPES.HISTORY.value) { // history
      logheader = struct.unpack(rec.rawdata, 0,
                                fixedRecords.history_record.format,
                                fixedRecords.history_record.fields);
      if (logheader.error_code) {
        logheader.error_text = getNameForValue(LOG_ERRORS, logheader.error_code);
      }
      if (logheader.flags !== 0) {
        logheader.flag_text = getFlagNames(LOG_FLAGS, logheader.flags);
      }
    } else {
      // There are other record types but we don't have documentation on them,
      // so we're going to ignore them.
      //console.log('log_id == ', logheader.log_id);
    }
    _.assign(rec, logheader);
    if (rec.rectype & LOG_TYPES.DELETED.mask) {
      // this is a deleted record so we're going to only return
      // a deleted flag and a size
      return { rectype: LOG_TYPES.IGNORE.value, packetlen: rec.packetlen };
    }
    // now process further data, if there is any
    if (rec.log_id == LOG_TYPES.HISTORY.value) {
      if (logRecords[rec.rectype]) {
        if (rec.rectype !== 0) {
          addTimestamp(rec);
        }
        rec.rectype_name = logRecords[rec.rectype].name;
        var detail = struct.unpack(rec.rawdata,
                                   struct.structlen(fixedRecords.history_record.format),
                                   logRecords[rec.rectype].format,
                                   logRecords[rec.rectype].fields);
        if (logRecords[rec.rectype].postprocess) {
          logRecords[rec.rectype].postprocess(detail);
        }
        rec.detail = detail;
      } else {
        console.log('Unknown history record type %d', rec.rectype);
        console.log(rec);
      }
    } else if (rec.log_id == LOG_TYPES.PUMP_ALARM.value) {
      rec.alarm = struct.unpack(rec.rawdata,
                                struct.structlen(fixedRecords.log_record.format),
                                pump_alarm_record.format,
                                pump_alarm_record.fields);
      rec.alarm.alarm_text = getNameForValue(ALARM_TYPES, rec.alarm.alarm);
      addTimestamp(rec.alarm);
    } else {
      // all other log types are meaningless to us, we're told
      return { rectype: LOG_TYPES.IGNORE.value, packetlen: rec.packetlen };
    }
    // console.log(rec);
    return rec;
  };

  var getLogRecords = function (recordset) {
    // this is where we get the position-independent information
    var offset = recordset.independent_offset;
    var done = false;
    var log_records = [];
    var index = 0;
    while (!done) {
      var rec = getLogRecord(offset);
      offset += rec.packetlen;
      if (offset >= bytes.length) {
        done = true;
      }
      if (rec.rectype == LOG_TYPES.IGNORE.value) {
        // console.log('Ignoring record.');
        continue;
      }
      // console.log(rec);
      if (rec.error_code) {
        console.log('Nonzero error_code!');
      }
      rec.index = index++;
      log_records.push(rec);
    }

    return log_records;
  };

  // returns indices of the matching records
  var findSpecificRecords = function (recordlist, rectypelist) {
    var result = [];
    for (var i = 0; i < recordlist.length; ++i) {
      for (var j = 0; j < rectypelist.length; ++j) {
        if (recordlist[i].rectype === rectypelist[j]) {
          result.push(i);
        }
      }
    }
    return result.sort(function compare(a, b) {
      return recordlist[a].log_index - recordlist[b].log_index;
    });
  };

  var linkWizardRecords = function (data, bolusrecs) {
    // we need to see if two boluses come from the same calculation (wizard) record
    // if so, they're actually a dual bolus, and need to be consolidated
    // so we create a table of backlinks from the calc records to the bolus records that
    // refer to them
    var wizRecords = {};
    for (var b = 0; b < bolusrecs.length; ++b) {
      var bolus = data.log_records[bolusrecs[b]];
      var wiz_idx = bolusrecs[b] + bolus.detail.calculation_record_offset;
      var r = wizRecords[wiz_idx] || {};
      if (bolus.detail.extended_duration_msec !== 0) {
        r.extended = bolusrecs[b];
      } else {
        r.immediate = bolusrecs[b];
      }
      if (r.immediate && r.extended) {
        r.isDual = true;
      }
      wizRecords[wiz_idx] = r;
    }
    return wizRecords;
  };


  var buildBolusRecords = function (data, records) {
    var bolusrecs = findSpecificRecords(data.log_records, [
      getValueForName(logRecords, 'Bolus')
    ]);
    var wizRecords = linkWizardRecords(data, bolusrecs);
    var postrecords = [];
    for (var b = 0; b < bolusrecs.length; ++b) {
      var bolus = data.log_records[bolusrecs[b]];
      var wiz_idx = -1;
      if (bolus.detail.calculation_record_offset !== 0) {
        wiz_idx = bolusrecs[b] + bolus.detail.calculation_record_offset;
      }

      // if we already did this dual bolus, skip it on the second round
      if (wizRecords[wiz_idx] && wizRecords[wiz_idx].handled) {
        continue;
      }

      var postbolus = null;
      if (wizRecords[wiz_idx] && wizRecords[wiz_idx].isDual) {
        var ext = wizRecords[wiz_idx].extended;
        var imm = wizRecords[wiz_idx].immediate;
        postbolus = cfg.builder.makeDualBolus()
          .with_normal(data.log_records[imm].detail.volume_units)
          .with_extended(data.log_records[ext].detail.volume_units)
          .with_duration(data.log_records[ext].detail.extended_duration_msec)
          .with_time(data.log_records[ext].timestamp)
          .with_deviceTime(data.log_records[ext].deviceTime)
          .with_timezoneOffset(data.log_records[ext].timezoneOffset)
          .done();
        wizRecords[wiz_idx].handled = true;
      } else if (bolus.detail.extended_duration_msec !== 0) {
        postbolus = cfg.builder.makeSquareBolus()
          .with_extended(bolus.detail.volume_units)
          .with_duration(bolus.detail.extended_duration_msec)
          .with_time(bolus.timestamp)
          .with_deviceTime(bolus.deviceTime)
          .with_timezoneOffset(bolus.timezoneOffset)
          .done();
      } else if (bolus.detail.immediate_duration_msec !== 0) {
        postbolus = cfg.builder.makeNormalBolus()
          .with_normal(bolus.detail.volume_units)
          .with_time(bolus.timestamp)
          .with_deviceTime(bolus.deviceTime)
          .with_timezoneOffset(bolus.timezoneOffset)
          .done();
      }
      if (postbolus) {
        postrecords.push(postbolus);
        if (wizRecords[wiz_idx]) {
          var wiz = data.log_records[wiz_idx];
          // current blip requires a carbInput in the payload -- but we'll be
          // moving that up a level soon.
          var payload = _.assign({}, wiz.detail, { carbInput: wiz.detail.carb_grams });
          if (payload.carbInput == 65535) // no carbs into the wizard
          {
            delete payload.carbInput;
          }
          var bg = wiz.detail.current_bg;
          if (bg == 65535) {
            // if bg was not given to the wizard, don't report it.
            bg = null;
          }
          var postwiz = cfg.builder.makeWizard()
            .with_recommended({carb: wiz.detail.carb_bolus_units_suggested,
                                correction: wiz.detail.corr_units_suggested })
            .with_bgInput(bg)
            .with_carbInput(wiz.detail.carb_grams)
            .with_insulinOnBoard(
              wiz.detail.correction_iob + wiz.detail.meal_iob)
            .with_insulinCarbRatio(wiz.detail.ic_ratio_used)
            .with_insulinSensitivity(wiz.detail.correction_factor_used)
            .with_bgTarget({target: wiz.detail.target_bg,
                             high: wiz.detail.bg_correction_threshold })
            .with_bolus(postbolus)
            .with_payload(payload)
            .with_time(wiz.timestamp)
            .with_deviceTime(wiz.deviceTime)
            .with_timezoneOffset(wiz.timezoneOffset)
            .done();
          postrecords.push(postwiz);
        }
      } else {
        console.log('zero bolus -- skipping it');
        console.log(bolus);
      }
    }
    return records.concat(postrecords);
  };

  var buildBasalRecords = function (data, records) {
    var basalrecs = findSpecificRecords(data.log_records, [
      getValueForName(logRecords, 'Basal_Rate')
    ]);
    var postrecords = [];
    var postbasal = null;
    var prevbasal = null;
    var dupcheck = {};
    for (var b = 0; b < basalrecs.length; ++b) {
      var basal = data.log_records[basalrecs[b]];
      // for Tidepool's purposes, the 'duration' field of a scheduled basal is
      // how long it's supposed to last. In this case, the answer is "until the next rate
      // change" -- but it's NOT the duration field of the basal record; that's only for
      // temp basals
      if (basal.detail.duration === 0) {
        postbasal = cfg.builder.makeScheduledBasal()
          .with_scheduleName(
          data.basalPrograms.names[data.basalPrograms.enabled_idx].name)
          .with_rate(basal.detail.basal_rate_units_per_hour)
          // temporarily, we're going to set all scheduled basals to 1 day
          .with_duration(24 * 60 * sundial.MIN_TO_MSEC)
          .with_time(basal.timestamp)
          .with_deviceTime(basal.deviceTime)
          .with_timezoneOffset(basal.timezoneOffset)
          .set('index', data.log_records[basalrecs[b]].log_index)
          .done();

        if (dupcheck[postbasal.time]) {
          console.log('DUP BASAL!');
          console.log(postbasal);
          console.log(dupcheck[postbasal.time]);
        } else {
          dupcheck[postbasal.time] = postbasal;
          postrecords.push(postbasal);        // don't push the dup records for now.
        }
        prevbasal = _.clone(postbasal);
        delete prevbasal.previous;
      }
    }
    // now set the duration of the last basal record to 30 min -- hack for demo
    postrecords[postrecords.length - 1].duration = 30 * sundial.MIN_TO_MSEC;
    return records.concat(postrecords);
  };

  var buildBGRecords = function (data, records) {
    var bgrecs = findSpecificRecords(data.log_records, [
      getValueForName(logRecords, 'Blood_Glucose')
    ]);
    var postrecords = [];
    for (var i = 0; i < bgrecs.length; ++i) {
      var bg = data.log_records[bgrecs[i]];
      if (bg.detail.error_code !== 0 || bg.detail.bg_reading === 65535) {
        // skip records that don't have valid data
        // we should properly report errors and also evaluate the flags we see
        console.log('meter error');
        console.log(bg.detail);
        continue;
      }
      var postbg = cfg.builder.makeSMBG()
        .with_value(bg.detail.bg_reading)
        .with_time(bg.timestamp)
        .with_deviceTime(bg.deviceTime)
        .with_timezoneOffset(bg.timezoneOffset)
        .done();
      postrecords.push(postbg);
      if (bg.user_tag_1 || bg.user_tag_2) {
        var s = bg.user_tag_1 + ' ' + bg.user_tag_2;
        var note = cfg.builder.makeNote()
          .with_value(s)
          .with_time(bg.timestamp)
          .with_deviceTime(bg.deviceTime)
          .with_timezoneOffset(bg.timezoneOffset)
          .done();
        console.log('NOT storing note: ' + s);
        // postrecords.push(note);
      }
    }
    return records.concat(postrecords);
  };

  var buildCarbRecords = function (data, records) {
    var carbRecs = findSpecificRecords(data.log_records, [
      getValueForName(logRecords, 'Carb')
    ]);
    var postrecords = [];
    for (var i = 0; i < carbRecs.length; ++i) {
      var carb = data.log_records[carbRecs[i]];
      var postcarb = cfg.builder.makeFood()
        .with_carbs(carb.detail.carbs)
        .with_time(carb.timestamp)
        .with_deviceTime(carb.deviceTime)
        .with_timezoneOffset(carb.timezoneOffset)
        .done();
      postrecords.push(postcarb);
    }
    // This is stupid but I'm not fixing it now because I don't want to break it
    // we shouldn't modify AND return and then reassign
    return records.concat(postrecords);
  };

  var buildSettingsRecord = function (data, records) {
    var downloads = findSpecificRecords(data.log_records, [
      getValueForName(logRecords, 'Download')
    ]);
    var download = data.log_records[downloads[0]];

    var bgunits = ['mg/dL', 'mmol/L'][data.eeprom_settings.BG_DISPLAY];

    var schedules = {};
    var generateSchedule = function (prof_idx) {
      var keyname = getItemWithValue(PROFILES, 'keyname', 'value', data.profiles[prof_idx].profile_idx);
      var valname = getItemWithValue(PROFILES, 'valuename', 'value', data.profiles[prof_idx].profile_idx);
      var sked = [];
      var addStep = function (idx) {
        var o = { start: data.profiles[prof_idx].steps[idx].starttime };
        o[keyname] = data.profiles[prof_idx].steps[idx][valname];
        sked.push(o);
      };
      addStep(0);
      for (var j = 1; j < data.profiles[prof_idx].steps.length; ++j) {
        if (data.profiles[prof_idx].steps[j][valname] != sked[sked.length - 1][keyname]) {
          addStep(j);
        }
      }
      return sked;
    };
    var settings = {};
    for (var i = 0; i < data.profiles.length; ++i) {
      if (getItemWithValue(PROFILES, 'isBasal', 'value', data.profiles[i].profile_idx)) {
        if (data.profiles[i].name) {
          schedules[data.profiles[i].name] = generateSchedule(i);
        }
      } else {
        settings[getNameForValue(PROFILES, data.profiles[i].profile_idx)] = generateSchedule(i);
      }
    }
    for (i = 0; i < settings.bgTarget.length; ++i) {
      settings.bgTarget[i].high = settings.bgTarget[i].low;
    }

    var postsettings = cfg.builder.makeSettings()
      .with_activeSchedule(data.basalPrograms.names[data.basalPrograms.enabled_idx].name)
      .with_units({ carb: 'grams', bg: bgunits })
      .with_basalSchedules(schedules)
      .with_carbRatio(settings.carbRatio)
      .with_insulinSensitivity(settings.insulinSensitivity)
      .with_bgTarget(settings.bgTarget)
      .with_time(download.timestamp)
      .with_deviceTime(download.deviceTime)
      .with_timezoneOffset(download.timezoneOffset)
      .done();

    records.push(postsettings);
    return records;
  };

  return {
    setup: function (deviceInfo, progress, cb) {
      console.log('Insulet Setup!');
      progress(0);
      var data = {stage: 'setup'};
      if (cfg.filename && cfg.filedata) {
        buf = cfg.filedata;
        bytes = new Uint8Array(buf);
        progress(100);
        return cb(null, data);
      } else {
        progress(100);
        return cb('No filedata available!', null);
      }
    },

    connect: function (progress, data, cb) {
      console.log('Insulet Connect!');
      // let's do a validation pass
      data.stage = 'connect';
      progress(0);
      var done = false;
      var offset = 0;
      data.npackets = 0;
      while (!done) {
        var rec = getRecord(offset);
        if (!rec.valid) {
          return cb('Checksum error', rec);
        }
        ++data.npackets;
        offset += rec.packetlen;
        if (offset >= bytes.length) {
          done = true;
        }
      }

      // we made it through
      progress(100);
      return cb(null, data);
    },

    getConfigInfo: function (progress, data, cb) {
      console.log('Insulet GetConfigInfo!');
      data.stage = 'getConfigInfo';
      progress(0);
      var offset = 0;
      data.ibf_version = getFixedRecord('ibf_version', offset);
      offset += data.ibf_version.packetlen;

      progress(10);
      data.pdm_version = getFixedRecord('pdm_version', offset);
      offset += data.pdm_version.packetlen;

      progress(20);
      data.mfg_data = getManufacturingData(offset);
      offset += data.mfg_data.packetlen;

      progress(30);
      data.basalPrograms = getBasalProgramNames(offset);
      offset += data.basalPrograms.packetlen;

      progress(50);
      data.eeprom_settings = getFixedRecord('eeprom_settings', offset);
      offset += data.eeprom_settings.packetlen;

      progress(70);
      data.profiles = getProfiles(offset, data.basalPrograms.names);
      offset += data.profiles.packetlen;

      progress(80);
      data.logDescriptions = getLogDescriptions(offset);
      offset += data.logDescriptions.packetlen;
      data.independent_offset = offset;

      progress(100);
      return cb(null, data);
    },

    fetchData: function (progress, data, cb) {
      console.log('Insulet FetchData!');
      data.stage = 'fetchData';
      progress(0);
      var log_records = getLogRecords(data);
      data.log_records = log_records;
      progress(100);
      return cb(null, data);
    },

    processData: function (progress, data, cb) {
      console.log('Insulet ProcessData!');
      data.stage = 'processData';
      // basal and profiles are processed while being loaded
      var recnames = ['ibf_version', 'pdm_version', 'mfg_data', 'eeprom_settings'];
      for (var i = 0; i < recnames.length; ++i) {
        if (fixedRecords[recnames[i]].postprocess) {
          var err = fixedRecords[recnames[i]].postprocess(data[recnames[i]]);
          if (err) {
            return cb(err, null);
          }
        }
      }
      progress(100);
      return cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      console.log('Insulet UploadData!');
      data.stage = 'uploadData';
      var insuletDeviceId = data.ibf_version.vendorid + ' ' + data.ibf_version.productid + ' ' + data.eeprom_settings.REMOTE_ID.toString();

      cfg.builder.setDefaults({
                                deviceId: insuletDeviceId,
                                units: 'mg/dL'      // everything the Insulet pump stores is in this unit
                              });

      var postrecords = [];
      postrecords = buildSettingsRecord(data, postrecords);
      postrecords = buildBolusRecords(data, postrecords);
      postrecords = buildBasalRecords(data, postrecords);
      postrecords = buildBGRecords(data, postrecords);
      // postrecords = buildCarbRecords(data, postrecords);
      // console.log(postrecords);
      data.post_records = [];

      cfg.api.upload.toPlatform(
        postrecords,
        {deviceId: insuletDeviceId, start: sundial.utcDateString(), tzName : cfg.timezone, version: cfg.version},
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
      });

    },

    disconnect: function (progress, data, cb) {
      console.log('Insulet Disconnect!');
      data.stage = 'disconnect';
      progress(100);
      return cb(null, data);
    },

    cleanup: function (progress, data, cb) {
      console.log('Insulet Cleanup!');
      data.stage = 'cleanup';
      progress(100);
      delete data.stage;
      return cb(null, data);
    }
  };
};