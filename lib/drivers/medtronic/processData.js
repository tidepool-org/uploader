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
var struct = require('../../struct.js')();
var common = require('../../commonFunctions');
var annotate = require('../../eventAnnotations');
var TZOUtil = require('../../TimezoneOffsetUtil');
var debugMode = require('../../../app/utils/debugMode');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('bows')('MedtronicDriver') : console.log;

var RECORD_TYPES = {
  BOLUS: { value: 0x01, head_length: 8, name: 'BOLUS'},
  PRIME: { value: 0x03, head_length: 5, name: 'PRIME'},
  ALARM_PUMP: { value: 0x06, head_length: 4, name: 'ALARM_PUMP'},
  RESULT_DAILY_TOTAL: { value: 0x07, head_length: 5, date_length: 2, body_length: 3, name: 'RESULT_DAILY_TOTAL' },
  CHANGE_BASAL_PROFILE_OLD: { value: 0x08, body_length:145, name: 'CHANGE_BASAL_PROFILE_OLD'},
  CHANGE_BASAL_PROFILE_NEW: { value: 0x09, body_length:145, name: 'CHANGE_BASAL_PROFILE_NEW'},
  CAL_BG_FOR_PH: { value: 0x0A, name: 'CAL_BG_FOR_PH'},
  ALARM_SENSOR: { value:0x0B, head_length:3, name:'ALARM_SENSOR'},
  CLEAR_ALARM: { value: 0x0C, name: 'CLEAR_ALARM'},
  SELECT_BASAL_PROFILE: { value: 0x14, name: 'SELECT_BASAL_PROFILE'},
  TEMP_BASAL_DURATION: { value:0x16, name: 'TEMP_BASAL_DURATION'},
  CHANGE_TIME: { value: 0x17, name: 'CHANGE_TIME'},
  NEW_TIME_SET: { value:0x18, name: 'NEW_TIME_SET'},
  LOW_BATTERY: { value:0x19, name: 'LOW_BATTERY'},
  BATTERY: { value:0x1a, name: 'BATTERY'},
  SET_AUTO_OFF: { value:0x1b, name:'SET_AUTO_OFF'},
  CONCENTRATION: { value:0x1c, name: 'CONCENTRATION'},
  PUMP_SUSPEND: { value:0x1e, name: 'PUMP_SUSPEND'},
  PUMP_RESUME: { value:0x1f, name: 'PUMP_RESUME'},
  SELF_TEST: {value: 0x20, name: 'SELF_TEST'},
  REWIND: { value:0x21, name: 'REWIND'},
  CLEAR: { value:0x22, name:'CLEAR'},
  BLOCK: { value:0x23, name:'BLOCK'},
  MAX_BOLUS: { value:0x24, name:'MAX_BOLUS'},
  MAX_BASAL: { value:0x25, name:'MAX_BASAL'},
  ENABLE_DISABLE_REMOTE: { value:0x26, body_length:14, name:'ENABLE_DISABLE_REMOTE'},
  CHANGE_REMOTE_ID: { value:0x27, name: 'CHANGE_REMOTE_ID'},
  CODE_UPDATE: { value:0x29, body_length: 14, name: 'CODE_UPDATE'},
  CHANGE_MAX_BASAL: { value:0x2C, name:'CHANGE_MAX_BASAL'},
  SET_BOLUS_WIZARD_ENABLED: { value:0x2D, name:'SET_BOLUS_WIZARD_ENABLED'},
  BG_REMINDER_OFFSET_SET: { value:0x31, name:'BG_REMINDER_OFFSET_SET'},
  BG_REMINDER_ALARM_SET: { value:0x32, name:'BG_REMINDER_ALARM_SET'},
  TEMP_BASAL: { value:0x33, body_length:1, name:'TEMP_BASAL'},
  LOW_RESERVOIR: { value:0x34, name:'LOW_RESERVOIR'},
  BG_REMINDER: { value:0x35, name:'BG_REMINDER'},
  PARADIGM_LINK_SETUP: { value:0x36, body_length:14, name:'PARADIGM_LINK_SETUP'},
  INSULIN_ACTION_TYPE_CHANGE: { value:0x3A, name:'INSULIN_ACTION_TYPE_CHANGE'},
  WEAK_BATTERY: { value:0x3B, name:'WEAK_BATTERY'},
  CHANGE_PARADIGM_LINK_ID: { value:0x3C, body_length:14, name:'CHANGE_PARADIGM_LINK_ID'},
  BG_RECEIVED: { value:0x3F, body_length:3, name:'BG_RECEIVED'},
  JOURNAL_ENTRY_MEAL_MARKER: { value:0x40, body_length:2, name:'JOURNAL_ENTRY_MEAL_MARKER'},
  JOURNAL_ENTRY_EXERCISE_MARKER: { value:0x41, body_length:1, name:'JOURNAL_ENTRY_EXERCISE_MARKER'},
  JOURNAL_ENTRY_INSULIN_MARKER: { value:0x42, body_length:1, name:'JOURNAL_ENTRY_INSULIN_MARKER'},
  JOURNAL_ENTRY_OTHER_MARKER: { value:0x43, name:'JOURNAL_ENTRY_OTHER_MARKER'},
  AUTO_CAL_ENABLE: { value:0x44, name:'AUTO_CAL_ENABLE'},
  CHANGE_BOLUS_WIZARD_SETUP: { value:0x4F, body_length:32, name:'CHANGE_BOLUS_WIZARD_SETUP'},
  SENSOR_SETTINGS: { value:0x50, body_length:34, name:'SENSOR_SETTINGS'},
  SENSOR_GRAPH_TIMEOUT: { value:0x51, name:'SENSOR_GRAPH_TIMEOUT'},
  SENSOR_GRAPH_DEMO_MODE: { value:0x52, name:'SENSOR_GRAPH_DEMO_MODE'},
  SENSOR_ALARM_SILENCE: { value:0x53, body_length:1, name:'SENSOR_ALARM_SILENCE'},
  SENSOR_GLUCOSE_LIMITS: { value:0x54, body_length:57, name:'SENSOR_GLUCOSE_LIMITS'},
  SENSOR_PREDICTIVE_ALERTS: { value:0x55, name: 'SENSOR_PREDICTIVE_ALERTS'},
  SENSOR_RATE_OF_CHANGE_ALERTS: { value:0x56, body_length:5, name: 'SENSOR_RATE_OF_CHANGE_ALERTS'},
  BOLUS_SCROLL_SET: { value:0x57, name:'BOLUS_SCROLL_SET'},
  BOLUS_WIZARD_CHANGE: { value:0x5A, body_length:137, name:'BOLUS_WIZARD_CHANGE'},
  BOLUS_WIZARD: { value:0x5B, body_length:15, name:'BOLUS_WIZARD'},
  UNABSORBED_INSULIN: { value:0x5C, date_length:0, name:'UNABSORBED_INSULIN'},
  SAVE_SETTINGS: { value:0x5D, name:'SAVE_SETTINGS'},
  VAR_BOLUS_ENABLE: { value:0x5E, name:'VAR_BOLUS_ENABLE'},
  EASY_BOLUS_ENABLE: { value:0x5F, name:'EASY_BOLUS_ENABLE'},
  BG_REMINDER_ENABLE: { value:0x60, name:'BG_REMINDER_ENABLE'},
  ALARM_CLOCK_ENABLE: { value:0x61, name:'ALARM_CLOCK_ENABLE'},
  CHANGE_TEMP_BASAL_TYPE: { value:0x62, name:'CHANGE_TEMP_BASAL_TYPE'},
  CHANGE_ALARM_NOTIFY_MODE: { value:0x63, name:'CHANGE_ALARM_NOTIFY_MODE'},
  CHANGE_TIME_DISPLAY: { value:0x64, name:'CHANGE_TIME_DISPLAY'},
  LOW_RESERVOIR_WARNING: { value:0x65, name:'LOW_RESERVOIR_WARNING'},
  BOLUS_REMINDER_ENABLE: { value:0x66, name:'BOLUS_REMINDER_ENABLE'},
  BOLUS_REMINDER_SET: { value:0x67, body_length:2, name:'BOLUS_REMINDER_SET'},
  BOLUS_REMINDER_DELETE: { value:0x68, body_length:2, name:'BOLUS_REMINDER_DELETE'},
  BOLUS_REMINDER: { value:0x69, body_length:2, name:'BOLUS_REMINDER'},
  ALARM_CLOCK_DELETE: { value:0x6A, name:'ALARM_CLOCK_DELETE'},
  TOTAL_DETAILS: { value:0x6C, head_length:1, date_length:2, body_length:35, name:'TOTAL_DETAILS'},
  SENSOR_TOTAL_DETAILS: { value:0x6E, head_length:1, date_length:2, body_length:49, name:'SENSOR_TOTAL_DETAILS'},
  CARB_UNITS_SET: { value:0x6F, name:'CARB_UNITS_SET'},
  BASAL_PROFILE_START: { value:0x7B, body_length:3, name:'BASAL_PROFILE_START'},
  CONNECT_DEVICES_OTHER_DEVICES_ENABLED: { value:0x7C, name:'CONNECT_DEVICES_OTHER_DEVICES_ENABLED'},
  CHANGE_OTHER_DEVICE_ID: { value:0x7D, body_length:30, name:'CHANGE_OTHER_DEVICE_ID'},
  LOW_SUSPEND_LIMIT_SET: { value:0x7E, name:'LOW_SUSPEND_LIMIT_SET'},
  LOW_SUSPEND_PARAM_SET: { value:0x7F, body_length:1, name:'LOW_SUSPEND_PARAM_SET'},
  CHANGE_WATCHDOG_MARRIAGE_PROFILE: { value:0x81, body_length:5, name:'CHANGE_WATCHDOG_MARRIAGE_PROFILE'},
  DELETE_OTHER_DEVICE_ID: { value:0x82, body_length:5, name:'DELETE_OTHER_DEVICE_ID'},
  CHANGE_CAPTURE_EVENT_ENABLE: { value:0x83, name:'CHANGE_CAPTURE_EVENT_ENABLE'},
};

var CBG_RECORD_TYPES = {
  DATA_END: { value: 0x01, name:'DATA_END'},
  SENSOR_WEAK_SIGNAL: { value:0x02, name: 'SENSOR_WEAK_SIGNAL'},
  SENSOR_CALIBRATION_EVENT: { value:0x03, name: 'SENSOR_CALIBRATION_EVENT'},
  SENSOR_PACKET_EVENT: { value:0x04, name: 'SENSOR_PACKET_EVENT'},
  SENSOR_ERROR_EVENT: { value:0x05, name: 'SENSOR_ERROR_EVENT'},
  SENSOR_GLUCOSE_LESS_THAN_40: { value:0x06, name: 'SENSOR_GLUCOSE_LESS_THAN_40'},
  SENSOR_GLUCOSE_MORE_THAN_400: { value:0x07, name: 'SENSOR_GLUCOSE_MORE_THAN_400'},
  SENSOR_TIMESTAMP: { value:0x08, name: 'SENSOR_TIMESTAMP'},
  BATTERY_CHANGE: { value:0x0A, name:'BATTERY_CHANGE'},
  SENSOR_STATUS: { value:0x0B, name:'SENSOR_STATUS'},
  DATE_TIME_CHANGE: { value:0x0C, name:'DATE_TIME_CHANGE'},
  SENSOR_SYNC: { value: 0x0D, name:'SENSOR_SYNC'},
  SENSOR_CAL_BG: { value: 0x0E, name:'SENSOR_CAL_BG'},
  SENSOR_CAL_FACTOR: { value: 0x0F, name:'SENSOR_CAL_FACTOR'},
  SENSOR_SPECIAL_DISPLAY_EVENT: { value: 0x10, name:'SENSOR_SPECIAL_DISPLAY_EVENT'},
  NO_OP: { value: 0x13, name:'NO_OP'},
  GLUCOSE_40_TO_400_MIN: { value: 0x14, name: 'GLUCOSE_40_TO_400_MIN'},
  GLUCOSE_40_TO_400_MAX: { value: 0xC8, name: 'GLUCOSE_40_TO_400_MAX'}
};

var BITMASKS = {
  LEFT_ONE: 0x80,     // b10000000
  LEFT_TWO: 0xc0,     // b11000000
  LEFT_THREE: 0xe0,   // b11100000
  RIGHT_SIX: 0x3f,    // b00111111
  RIGHT_FIVE: 0x1f,   // b00011111
  RIGHT_SEVEN: 0x7f,  // b01111111
  RIGHT_TWO: 0x03,    // b00000011
  RIGHT_1100: 0x0c,   // b00001100
  RIGHT_THREE: 0x07,  // b00000111
  LEFT_00111: 0x38,   // b00111000
  RIGHT_FOUR: 0x0f    // b00001111
};

var PROFILES = {
  0 : 'standard',
  1 : 'pattern a',
  2 : 'pattern b'
};

var CGM_TIME_CHANGE_TYPES = {
  0 : 'manual',
  1 : 'from',
  2 : 'alarm'
};

var ALARM_TYPES = {
  ALARM_BATTERY_LIMIT: { value: 3, name: 'Battery out limit exceeded'},
  ALARM_NO_DELIVERY: { value: 4, name: 'No delivery'},
  ALARM_BATTERY_DEPLETED: { value: 5, name: 'Battery depleted'},
  ALARM_AUTO_OFF: {value: 6, name: 'Auto off'},
  ALARM_BUTTON: { value: 59, name: 'Button error'},
  ALARM_LGS: { value: 103, name: 'Low glucose suspend'}
};

var SUSPEND_REASONS = {
  SUSPEND_USER: { value: 0x01, name: 'Suspend user'},
  SUSPEND_ALARM: { value: 0x02, name: 'Suspend alarm'},
  SUSPEND_LGS: { value: 0x03, name: 'Suspend low glucose'},
  SUSPEND_NO_RESPONSE: { value: 0x04, name: 'Suspend no response'},
  SUSPEND_USER_SELECTED: { value: 0x05, name: 'Suspend user selected'},
  RESUME_USER: { value: 0x06, name: 'Resume user'},
  RESUME_AUTO_USER_SUSPEND: { value: 0x07, name: 'Automatic resume after user suspend'},
  RESUME_AUTO_NO_RESPONSE: { value: 0X08, name: 'Automatic resume after no response'}
};

var BOLUS_TYPES = {
  NORMAL: 1,
  NORMAL_VARIABLE: 2,
  SQUARE: 3,
  DUAL_NORMAL: 4,
  DUAL_SQUARE: 5
};

var cfg = null;
var settings = null;
var basalSchedules = {};

var init = function(config, settingsData) {
  cfg = config;
  settings = _.cloneDeep(settingsData);
};

Number.prototype.toFixedNumber = function(significant){
  var pow = Math.pow(10,significant);
  return +( Math.round(this*pow) / pow );
};

var decodeDate = function (payload) {
 var encoded, second, minute, hour, day, month, year;

 if(payload.length < 4) {
   return false;
 }
 if(payload.length === 4) {
   encoded = struct.unpack(payload,0,'bbbb',['year','day','minute','hour']);
   second = 0;
   minute = encoded.minute & BITMASKS.RIGHT_SIX;
   hour = encoded.hour & BITMASKS.RIGHT_FIVE;
   day = encoded.day & BITMASKS.RIGHT_FIVE;
   month = (((encoded.hour & BITMASKS.LEFT_TWO) >> 4) | ((encoded.minute & BITMASKS.LEFT_TWO) >> 6));
 } else {
   encoded = struct.unpack(payload,0,'bbbbb',['second','minute','hour','day','year']);
   second = encoded.second & BITMASKS.RIGHT_SIX;
   minute = encoded.minute & BITMASKS.RIGHT_SIX;
   hour = encoded.hour & BITMASKS.RIGHT_FIVE;
   day = encoded.day & BITMASKS.RIGHT_FIVE;
   month = (((encoded.second & BITMASKS.LEFT_TWO) >> 4) | ((encoded.minute & BITMASKS.LEFT_TWO) >> 6));
 }

 year = (encoded.year & BITMASKS.RIGHT_SEVEN) + 2000;
 if(year === 2000) {
   // Incorrect date
   return false;
 }
 var date = sundial.buildTimestamp({year:year,month:month,day:day,hours:hour,minutes:minute,seconds:second});
 return date;
};

var getType = function (idx, types) {
  for (var i in types) {
    if (types[i].value === idx) {
      return _.clone(types[i]);
    }
  }
  return 'unknown';
};

var getSubCode = function (obj, types) {
  var type = obj.date[1] >> 5 & 7;
  return types[type];
};

var filterHistory = function (types, log_records) {
  var neededLogIds = [];
  types.forEach(function (element) { neededLogIds.push(element.value); });
  return log_records.filter(function (record) {
    return neededLogIds.indexOf(record.type.value) >= 0;
  });
};

var twosComplement = function (value, bits) {
  if((value & (1 << (bits - 1))) != 0 ) { // check if highest bit is set
    value = value - (1 << bits); // use two complement to get negative value
  }
  return value;
};

var buildWizardRecords = function (records) {
  var wizardRecords = filterHistory([RECORD_TYPES.BOLUS_WIZARD], records);
  var postrecords = [];
  wizardRecords.forEach(function(record) {

    var carbInput, bgInput, carbRatio, bgTarget = {}, isf, recommended = {}, bgUnits, carbUnits;

    var bgRaw = [struct.extractByte(record.body,1) & BITMASKS.RIGHT_TWO];
    bgRaw = bgRaw.concat(struct.extractByte(record.head,1));
    bgInput = struct.extractBEShort(bgRaw,0);

    var carbRaw = [struct.extractByte(record.body,1) >> 2 & 1];
    carbRaw = carbRaw.concat(struct.extractByte(record.body,0));
    carbInput = struct.extractBEShort(carbRaw,0);

    var carbRatioRaw = [0,struct.extractByte(record.body,9) >> 1 & BITMASKS.RIGHT_TWO];
    carbRatioRaw = carbRatioRaw.concat(struct.extractByte(record.body,2));
    carbRatioRaw = carbRatioRaw.concat(struct.extractByte(record.body,3));
    carbRatio = struct.extractBEInt(carbRatioRaw,0) / 10.0;

    bgTarget.low = struct.extractByte(record.body,5);
    bgTarget.high = struct.extractByte(record.body,14);

    var isfRaw = [struct.extractByte(record.date,2) >> 6 & BITMASKS.RIGHT_TWO];
    isfRaw = isfRaw.concat(struct.extractByte(record.body,4));
    isf = struct.extractBEShort(isfRaw,0);

    var rawRecommendedCarb = [0,struct.extractByte(record.body,9) & 1];
    rawRecommendedCarb = rawRecommendedCarb.concat(struct.extractByte(record.body,7));
    rawRecommendedCarb = rawRecommendedCarb.concat(struct.extractByte(record.body,8));
    recommended.carb = struct.extractBEInt(rawRecommendedCarb,0) / settings.strokesPerUnit;

    var rawRecommendedCorrection = [struct.extractByte(record.body,9) >> 3 & 31];
    rawRecommendedCorrection = rawRecommendedCorrection.concat(struct.extractByte(record.body,6));
    recommended.correction = twosComplement(
      struct.extractBEShort(rawRecommendedCorrection,0),13
    ) / settings.strokesPerUnit;

    var rawRecommendedNet = [0,struct.extractByte(record.body,1) >> 3 & 1];
    rawRecommendedNet = rawRecommendedNet.concat(struct.extractByte(record.body,12));
    rawRecommendedNet = rawRecommendedNet.concat(struct.extractByte(record.body,13));
    recommended.net = struct.extractBEInt(rawRecommendedNet,0) / settings.strokesPerUnit;

    bgUnits = (struct.extractByte(record.body,1) >> 6 & BITMASKS.RIGHT_TWO) !== 2 ? 'mg/dL' : 'mmol/L';
    carbUnits = (struct.extractByte(record.body,1) >> 4 & BITMASKS.RIGHT_TWO) !== 2 ? 'grams' : 'exchanges';

    if(bgUnits == 'mmol/L') {
      bgTarget.low = (bgTarget.low / 10.0).toFixedNumber(1);
      bgTarget.high = (bgTarget.high / 10.0).toFixedNumber(1);
      isf = (isf / 10.0).toFixedNumber(1);
      bgInput = (bgInput / 10.0).toFixedNumber(1);
    }

    var wizard = cfg.builder.makeWizard()
      .with_recommended({
        carb: recommended.carb,
        correction: recommended.correction,
        net: recommended.net
      })
      .with_carbInput(carbInput)
      .with_insulinCarbRatio(carbRatio)
      .with_insulinSensitivity(isf)
      .with_bgTarget({
        low: bgTarget.low,
        high: bgTarget.high
      })
      .with_units(bgUnits)
      .with_carbUnits(carbUnits);

      if (bgInput > 0) {
        wizard = wizard.with_bgInput(bgInput);
      }

      wizard = wizard.with_deviceTime(sundial.formatDeviceTime(record.jsDate))
          .set('index', record.index)
          .set('jsDate', record.jsDate);

      cfg.tzoUtil.fillInUTCInfo(wizard, record.jsDate);
      postrecords.push(wizard);

  });

  return postrecords;
};

var buildBolusRecords = function (records) {
  var bolusRecords = filterHistory([RECORD_TYPES.BOLUS], records);
  var postrecords = [];

  for(var i=0; i < bolusRecords.length; i++) {
    var record = bolusRecords[i];

    var bolus;

    var amount, programmed, iob;

    amount = struct.extractBEShort(record.head,3)/settings.strokesPerUnit;
    programmed = struct.extractBEShort(record.head,1)/settings.strokesPerUnit;
    iob = struct.extractBEShort(record.head,5)/settings.strokesPerUnit;

    var duration = record.head[7] * 30 * sundial.MIN_TO_MSEC;
    var subType = record.date[2] >> 5;

    if (subType === BOLUS_TYPES.DUAL_SQUARE) {

      if ((i < bolusRecords.length - 1) && // is there still another bolus?
          (bolusRecords[i+1].date[2] >> 5 === BOLUS_TYPES.DUAL_NORMAL)) {
            // there is a dual normal portion
          bolus = cfg.builder.makeDualBolus();
      } else {
        // even though it's a dual bolus, there is no normal portion,
        // so we record it as a square bolus
        bolus = cfg.builder.makeSquareBolus();
      }

      bolus = bolus.with_duration(duration)
        .with_extended(amount);

      if(programmed !== amount) {
        // dual bolus was cancelled
        var actualDuration = Math.round((amount / (programmed * 1.0)) * duration);
        bolus = bolus.with_expectedExtended(programmed)
                  .with_expectedDuration(duration)
                  .with_duration(actualDuration);
      }

      if(bolus.subType === 'dual/square') {
        i+=1; // advance to next bolus for normal portion
        record = bolusRecords[i];
        amount = struct.extractBEShort(record.head,3) / settings.strokesPerUnit;
        programmed = struct.extractBEShort(record.head,1) / settings.strokesPerUnit;
        iob = struct.extractBEShort(record.head,5) / settings.strokesPerUnit;

        bolus = bolus.with_normal(amount);
        if(programmed !== amount) {
          bolus = bolus.with_expectedNormal(programmed);
        }

        if (bolus.extended === 0 && bolus.duration === 0) {
          // bolus ratio was 100%/0%, so there is no extended portion, and we
          // record it as a normal bolus instead
          bolus.subType = 'normal';
        }
      }

    } else if (subType === BOLUS_TYPES.NORMAL || subType === BOLUS_TYPES.NORMAL_VARIABLE) {
      // normal bolus
      bolus = cfg.builder.makeNormalBolus()
        .with_normal(amount);

      if(programmed !== amount) {
        bolus = bolus.with_expectedNormal(programmed);
      }
    } else {

      if (subType !== BOLUS_TYPES.SQUARE) {
        /* with delta uploads, the first part of a bolus may be on the previous page,
           in which case both parts were already uploaded previously */
        debug('Dropping an unexpected bolus of type', subType, 'as its matching record is not available');
        continue;
      }
      bolus = cfg.builder.makeSquareBolus()
        .with_duration(duration)
        .with_extended(amount);

        if(programmed !== amount) {
          // square bolus was cancelled
          var actualDuration = Math.round((amount / (programmed * 1.0)) * duration);
          bolus = bolus.with_expectedExtended(programmed)
                    .with_expectedDuration(duration)
                    .with_duration(actualDuration);
        }
    }

    bolus = bolus.with_deviceTime(sundial.formatDeviceTime(record.jsDate))
        .set('index', record.index)
        .set('jsDate', record.jsDate)
        .set('iob', iob);

    cfg.tzoUtil.fillInUTCInfo(bolus, record.jsDate);
    bolus = bolus.done();
    postrecords.push(bolus);

  };

  return postrecords;
};

function buildBGRecords(records) {

  var bgRecords = filterHistory([RECORD_TYPES.BG_RECEIVED, RECORD_TYPES.CAL_BG_FOR_PH], records);
  var postrecords = [];

  for( var i = 0; i < bgRecords.length; i++ ) {
    var bgEntry = bgRecords[i];

    var units = (struct.extractByte(bgEntry.date,2) & BITMASKS.LEFT_TWO) === 0x40 ? 'mmol/L': 'mg/dL';
    var bg = bgEntry.head[1] + ((struct.extractByte(bgEntry.date,4) & BITMASKS.LEFT_ONE) << 1) + ((struct.extractByte(bgEntry.date,2) & BITMASKS.LEFT_ONE) << 2);

    if(units === 'mmol/L') {
      bg = (bg / 10.0).toFixedNumber(1);
    }

    var bgRecord = cfg.builder.makeSMBG()
      .with_deviceTime(sundial.formatDeviceTime(bgEntry.jsDate))
      .with_value(bg);

    if(bgRecords[i+1] && bgRecords[i+1].type.value === RECORD_TYPES.BG_RECEIVED.value) {
      // if value is from linked meter, CAL_BG_FOR_PH record is followed by BG_RECEIVED record
      i += 1;
      bgEntry = bgRecords[i];

      // Note: Bayer does not send control solution readings to the pump
      var linkedBg = (struct.extractByte(bgEntry.head,1) << 3) + (struct.extractByte(bgEntry.date,2) >> 5);
      if(units === 'mmol/L') {
        linkedBg = (linkedBg / 10.0).toFixedNumber(1);
      }
      if(bg !== linkedBg) {
        debug('Linked smbg value does not match value on pump',bgEntry.jsDate, bg, linkedBg);
        throw new Error('Linked smbg value does not match value on pump');
      }
      var meter = common.bytes2hex(struct.extractBytes(bgEntry.body, 0, 3), true);
      bgRecord.with_subType('linked')
              .with_payload({
                meterSerial: meter
              });
    } else {
      bgRecord.with_subType('manual');
    }

    bgRecord.with_units(units)
            .set('index',bgEntry.index);
    cfg.tzoUtil.fillInUTCInfo(bgRecord, bgEntry.jsDate);
    postrecords.push(bgRecord.done());
  };
  return postrecords;
}

function buildCGMRecords(events) {

  var postrecords = [];

  if(events.length === 0 || events[events.length-1].jsDate == null) {
    // CGM pages are empty
    return postrecords;
  }

  var start = null;
  var recordsSinceTimestamp = null;

  // we have to work through the CGM records in reverse, as sensor timestamps
  // affect previous values and are subject to time changes

  for (var i = events.length - 1; i >= 0; i--) {
    var event = events[i];

    if (event.jsDate != false) {
      if (debugMode.isDebug) {
        debug('CGM event:',sundial.formatDeviceTime(event.jsDate), event.type.name, common.bytes2hex([event.head]),common.bytes2hex(event.date),common.bytes2hex(event.body),common.bytes2hex(event.descriptor) );
      }

      if (event.type.value === CBG_RECORD_TYPES.SENSOR_TIMESTAMP.value) {
        start = event.jsDate;
        recordsSinceTimestamp = 0;
      }

      if (event.body) {
        var offset = event.body.length;
        var index = event.index - offset;

        while (offset >= 0) {

          var descriptor = struct.extractShort(event.descriptor, offset * 2);

          // For each byte in the cbg bytestream, there are two bytes in the descriptor
          // bytestream. Where the second descriptor byte is non-zero, the value is
          // in the cbg bytestream is a cbg value, with the LSB of the 16-bit descriptor value
          // as part of the cbg value and the other 15 bytes of the descriptor value
          // containing the ISIG (Interstitial SIGnal).

          if (descriptor > 255) {
            var annotation = null;
            var cbg = (descriptor & 0x01) + (event.body[offset] << 1);

            if (start === null) {
              debug('Dropping CBG values without timestamp');
              break;
            }

            var date = sundial.applyOffset(start, -(recordsSinceTimestamp * 5));
            recordsSinceTimestamp += 1;

            if (debugMode.isDebug) {
              debug('CBG:', sundial.formatDeviceTime(date), common.bytes2hex(struct.extractBytes(event.descriptor, offset * 2, 2)), ',', common.bytes2hex([struct.extractByte(event.body, offset)]), ',', cbg, ',', (descriptor & 0xFFFE) / 100.0);
            }

            if (event.body[offset] === CBG_RECORD_TYPES.SENSOR_GLUCOSE_MORE_THAN_400.value) {
              cbg = 401;
              annotation = {
                code: 'bg/out-of-range',
                value: 'high',
                threshold: 400,
              };
            } else if (event.body[offset] === CBG_RECORD_TYPES.SENSOR_GLUCOSE_LESS_THAN_40.value) {
              cbg = 39;
              annotation = {
                code: 'bg/out-of-range',
                value: 'low',
                threshold: 40,
              };
            }

            if (cbg >= 40 || annotation) {
              var record = cfg.builder.makeCBG()
                .with_value(cbg)
                .with_deviceTime(sundial.formatDeviceTime(date))
                .with_units('mg/dL') // TODO: check if mmol/L cbg is also hard-coded in mg/dL
                .with_payload({
                  interstitialSignal: (descriptor & 0xFFFE) / 100.0
                }) // mask out lsb
                .set('index', index + offset);
              cfg.cgmTzoUtil.fillInUTCInfo(record, date);

              if (annotation) {
                annotate.annotateEvent(record, annotation);
              }
              record = record.done();
              postrecords.push(record);
            }
          } else {
            var type = getType(event.body[offset],CBG_RECORD_TYPES);
            if( (descriptor < 20 || descriptor > 200) && type != null) {
              if(debugMode.isDebug) {
                debug('CBG type:', type.name);
              }
              recordsSinceTimestamp += 1;
            }
          }

          offset -= 1;
        }
      }
    }

    if(event.type.value === CBG_RECORD_TYPES.SENSOR_CAL_BG.value) {
      if(struct.extractShort(event.descriptor, event.descriptor.length - 12) === 0x22) {
        var calibrationRecord = cfg.builder.makeDeviceEventCalibration();
        calibrationRecord.with_value(event.body[event.body.length-1])
              .with_deviceTime(sundial.formatDeviceTime(event.jsDate))
              .with_units('mg/dL')      // TODO: hard-coded in mg/dL on device?
              .set('index', event.index);
        cfg.cgmTzoUtil.fillInUTCInfo(calibrationRecord, event.jsDate);
        calibrationRecord = calibrationRecord.done();
        postrecords.push(calibrationRecord);
      }
    }
  }

  return postrecords;
}

function buildSuspendResumeRecords(records) {

  var suspendResumeRecords = filterHistory([RECORD_TYPES.PUMP_SUSPEND, RECORD_TYPES.PUMP_RESUME], records);
  var postrecords = [];

  debug('Suspend/resumes:');

  for(var i=0; i < suspendResumeRecords.length; i++) {
    if((suspendResumeRecords[i].head[1] & BITMASKS.RIGHT_FIVE) === 0) {
      // sometimes the suspend state can be "normal pumping", go figure
      debug('Normal pumping entry, skipping..');
      continue;
    }

    var suspendEntry = suspendResumeRecords[i];
    var suspendReasons = [];

    if(suspendEntry.type.value === RECORD_TYPES.PUMP_SUSPEND.value) {

      var suspendedBasal = cfg.builder.makeSuspendBasal()
        .with_deviceTime(sundial.formatDeviceTime(suspendEntry.jsDate))
        .set('jsDate', suspendEntry.jsDate)
        .set('index', suspendEntry.index);
      cfg.tzoUtil.fillInUTCInfo(suspendedBasal, suspendEntry.jsDate);

      var suspendResume = cfg.builder.makeDeviceEventSuspendResume()
        .with_deviceTime(sundial.formatDeviceTime(suspendEntry.jsDate))
        .with_reason({suspended: 'manual', resumed: 'manual'})
        .set('index', suspendEntry.index);
      cfg.tzoUtil.fillInUTCInfo(suspendResume, suspendEntry.jsDate);

      debug('Suspended at', suspendResume.deviceTime);

      while((i < suspendResumeRecords.length) && suspendResumeRecords[i].type.value === RECORD_TYPES.PUMP_SUSPEND.value) {
        // we use a while loop here, as the user can select suspend in the
        // UI multiple times or not respond to the suspend

        if((suspendResumeRecords[i].head[1] & BITMASKS.RIGHT_FIVE) === SUSPEND_REASONS.SUSPEND_ALARM.value) {
          // we are dealing with a Low Glucose Suspend (LGS) alarm
          suspendResume.reason.suspended = 'automatic';
          debug('LGS at', sundial.formatDeviceTime(suspendResumeRecords[i].jsDate));
        } else {
          var reason = suspendResumeRecords[i].head[1] & BITMASKS.RIGHT_FIVE;
          var name = common.getName(SUSPEND_REASONS, reason);
          suspendReasons.push(name);
          debug('Reason:',name);
        }

        i += 1;
      }

      var resumeEntry = suspendResumeRecords[i];
      if(resumeEntry && resumeEntry.type.value === RECORD_TYPES.PUMP_RESUME.value) {

        var headCheck = resumeEntry.head[1] & BITMASKS.RIGHT_FIVE;

        if(headCheck === SUSPEND_REASONS.RESUME_AUTO_NO_RESPONSE.value) {
          suspendResume.reason.resumed = 'automatic';
          suspendReasons.push(SUSPEND_REASONS.RESUME_AUTO_NO_RESPONSE.name);
          debug('LGS resumed automatically after no response at', sundial.formatDeviceTime(resumeEntry.jsDate));
          while (suspendResumeRecords[i+1] && suspendResumeRecords[i+1].type.value === RECORD_TYPES.PUMP_RESUME.value) {
            i += 1; // LGS auto has up to three resume records, so increment counter again
          }
        }

        if(headCheck === SUSPEND_REASONS.RESUME_AUTO_USER_SUSPEND.value) {
          suspendResume.reason.resumed = 'automatic';
          suspendReasons.push(SUSPEND_REASONS.RESUME_AUTO_USER_SUSPEND.name);
          debug('LGS resumed automatically after user suspend at', sundial.formatDeviceTime(resumeEntry.jsDate));
        }

        if(headCheck === SUSPEND_REASONS.RESUME_USER.value) {
          suspendReasons.push(SUSPEND_REASONS.RESUME_USER.name);
          debug('LGS resumed by user at', sundial.formatDeviceTime(resumeEntry.jsDate));

          if(suspendResumeRecords[i+1] && suspendResumeRecords[i+1].type.value === RECORD_TYPES.PUMP_RESUME.value) {
            i += 1; // LGS manual resume after suspend has two records, so increment counter again
          }
        }

        suspendResume.with_payload({reasons : suspendReasons});

        var duration = resumeEntry.jsDate.valueOf() - suspendEntry.jsDate.valueOf();
        suspendResume.with_duration(duration)
                     .set('resumeIndex', resumeEntry.index);
      } else {
        debug('Incomplete suspend/resume at', suspendResume.time);
        if(resumeEntry) {
          debug('resume entry:', resumeEntry.type.name, '(',resumeEntry.head[1],')');
        }
        suspendResume.with_duration(0);
        annotate.annotateEvent(suspendResume,'status/incomplete-tuple');
      }

      // order here is important, as we use it in the simulator
      postrecords.push(suspendResume.done());
      postrecords.push(suspendedBasal);

    } else {
      debug('Suspend event out of order:', JSON.stringify(suspendEntry));
      throw new Error('Suspend/resume events out of order');
    }

  };
  return postrecords;
}

function getCarbRatios(encoded, units) {
  var carbRatios = [];
  for(var j = 0; j < 8; j++ ) {
    var carbRatio = struct.unpack(encoded,(j*3)+2,'bS',['offset', 'ratio']);
    if (carbRatio.offset === 0 && carbRatio.ratio === 0) {
      break;
    }
    var startTime = carbRatio.offset * 30 * sundial.MIN_TO_MSEC;
    if((carbRatios.length > 0) && (startTime < carbRatios[carbRatios.length-1].start)) {
      debug('Dropping carb ratio with invalid start time:', carbRatio);
      break;
    }
    if(units === 'exchanges') {
      carbRatio.ratio = carbRatio.ratio / 100.0;
    }
    carbRatios.push( { start: startTime, amount: (carbRatio.ratio / 10.0).toFixedNumber(5) } );
  };

  return carbRatios;
}

function getBGTargets(encoded, units) {
  var bgTargets = [];
  for(var j = 0; j < 8; j++ ) {
    var bgTarget = struct.unpack(encoded,(j*3)+1,'bbb',['offset', 'low','high']);
    if (bgTarget.offset === 0 && bgTarget.low === 0 && bgTarget.high === 0) {
      break;
    }
    var startTime = bgTarget.offset * 30 * sundial.MIN_TO_MSEC;
    if(units === 'mmol/L') {
      bgTarget.low /= 10.0;
      bgTarget.high /= 10.0;
    }
    bgTargets.push( { start: startTime, low: bgTarget.low, high: bgTarget.high} );
  };
  return bgTargets;
}

function getInsulinSensitivities(encoded, units) {
  var insulinSensitivities = [];
  for(var j = 0; j < 8; j++ ) {
    var sensitivity = struct.unpack(encoded,(j*2)+1,'bb',['offset', 'val']);
    if (sensitivity.offset === 0 && sensitivity.val === 0) {
      break;
    }
    var startTime = (sensitivity.offset & BITMASKS.RIGHT_SIX) * 30 * sundial.MIN_TO_MSEC;
    var amount = sensitivity.val + ((sensitivity.offset & BITMASKS.LEFT_TWO) << 2);
    if(units === 'mmol/L') {
      amount /= 10.0;
    }
    insulinSensitivities.push( { start: startTime, amount: amount } );
  };
  return insulinSensitivities;
}

function buildSettings(records) {

  var getWizardSettings = function(record) {

    var SIZES = {
      CARB_RATIO :27,
      INSULIN_SENSITIVITY: 17,
      BG_TARGET : 25
    };

    var oldSettings = {};
    var newSettings = {};

    var getUnits = function(encoded) {

      var rawBGUnits = encoded >> 2 & 0x03;
      var rawCarbUnits = encoded & 0x03;
      var bg, carb = null; // units are 0 (null) when not set

      if (rawBGUnits === 1) {
        bg = 'mg/dL';
      } else if (rawBGUnits > 1) {
        bg = 'mmol/L';
      }

      if (rawCarbUnits === 1) {
        carb = 'grams';
      } else if (rawCarbUnits > 1) {
        carb = 'exchanges';
      }

      return { bg, carb };
    };

    oldSettings.bolus = {
      calculator: {
        enabled: (record.head[1] >> 2) & 1 ? true : false
      }
    };
    newSettings.bolus = {
      calculator: {
        enabled: (record.head[1] >> 3) & 1 ? true : false
      }
    };

    oldSettings.units = getUnits(record.body[0]);
    oldSettings.carbRatio = getCarbRatios(record.body, oldSettings.units.carb);
    var index = SIZES.CARB_RATIO;
    oldSettings.insulinSensitivity = getInsulinSensitivities(struct.extractBytes(record.body, index, SIZES.INSULIN_SENSITIVITY), oldSettings.units.bg);
    index += SIZES.INSULIN_SENSITIVITY;
    oldSettings.bgTarget = getBGTargets(struct.extractBytes(record.body, index - 1, SIZES.BG_TARGET), oldSettings.units.bg);
    index += SIZES.BG_TARGET - 1;
    newSettings.units = getUnits(record.body[index]);
    newSettings.carbRatio = getCarbRatios(struct.extractBytes(record.body, index, SIZES.CARB_RATIO), newSettings.units.carb);
    index += SIZES.CARB_RATIO;
    newSettings.insulinSensitivity = getInsulinSensitivities(struct.extractBytes(record.body, index,SIZES.INSULIN_SENSITIVITY), newSettings.units.bg);
    index += SIZES.INSULIN_SENSITIVITY;
    newSettings.bgTarget = getBGTargets(struct.extractBytes(record.body, index - 1, SIZES.BG_TARGET), newSettings.units.bg);
    var durations = record.body[index+SIZES.BG_TARGET-1];

    // insulin action duration is only valid when
   // bolus calculator is enabled

    var oldDuration = durations & 0x0F;
    if (oldDuration < 0x0F) {
      oldSettings.bolus.calculator.insulin = {
        duration: oldDuration,
        units: 'hours'
      };
    }

    var newDuration = durations >> 4;
    if (newDuration < 0x0F) {
      newSettings.bolus.calculator.insulin = {
        duration: newDuration,
        units: 'hours'
      };
    }

    return { old: oldSettings, new: newSettings};
  };

  var getSchedule = function(record) {
    var schedules = [];

    if (record.head[1] === 0) {
      return schedules; // record not set yet
    }

    for(var j = 0; j < 47; j++ ) {
      var schedule = struct.unpack(record.body,j*3,'bbb',['offset', 'rate', 'q']);
      if ((j > 0) && // only the first schedule can be {0,0,0}
          (schedule.offset === 0 && schedule.rate === 0 && schedule.q === 0)) {
        break;
      }
      var startTime = schedule.offset * 30 * sundial.MIN_TO_MSEC;
      schedules.push( { start: startTime, rate: schedule.rate / settings.strokesPerUnit} );
    };

    if (schedules.length === 0) {
      // schedules were cleared after pump error
      schedules = [{ start: 0, rate: 0 }];
    }

    return schedules;
  };

  // we start with the current basal profiles and work our way back
  var changes = filterHistory([RECORD_TYPES.CHANGE_BASAL_PROFILE_OLD,
                                 RECORD_TYPES.CHANGE_BASAL_PROFILE_NEW,
                                 RECORD_TYPES.SELECT_BASAL_PROFILE,
                                 RECORD_TYPES.BOLUS_WIZARD_CHANGE,
                                 RECORD_TYPES.CHANGE_TEMP_BASAL_TYPE,
                                 RECORD_TYPES.CHANGE_MAX_BASAL,
                                 RECORD_TYPES.VAR_BOLUS_ENABLE,
                                 RECORD_TYPES.MAX_BOLUS], records).reverse();
  var postrecords = [];
  var settingsChanges = [];
  var prevDate = null;

  // when we record schedule changes, we need to start with the
  // most recent schedules and work our way back
  var settingsChange = _.cloneDeep(_.pick(settings,['basalSchedules','bgTarget','insulinSensitivity','carbRatio','units','activeSchedule','insulin','bolus','basal']));
  // as we're modifying settingsChange later, we have to cloneDeep
  settingsChanges.push(_.cloneDeep(settingsChange));

  // push current settings onto stack
  var currentSettings = _.cloneDeep(settings);
  var postsettings = cfg.builder.makePumpSettings();
  postsettings.with_units(currentSettings.units)
              .with_carbRatio(currentSettings.carbRatio)
              .with_insulinSensitivity(currentSettings.insulinSensitivity)
              .with_bgTarget(currentSettings.bgTarget)
              .with_basalSchedules(currentSettings.basalSchedules)
              .with_activeSchedule(currentSettings.activeSchedule)
              .with_basal(currentSettings.basal)
              .with_bolus(currentSettings.bolus)
              // current settings do not have an index, so can't use TZOUtil.
              .with_time(sundial.applyTimezone(currentSettings.currentDeviceTime, cfg.timezone).toISOString())
              .with_deviceTime(sundial.formatDeviceTime(currentSettings.currentDeviceTime))
              .with_timezoneOffset(sundial.getOffsetFromZone(currentSettings.currentDeviceTime, cfg.timezone))              .with_timezoneOffset(sundial.getOffsetFromZone(settings.currentDeviceTime, cfg.timezone))
              .with_conversionOffset(0);
  postrecords.push(postsettings);

  if(changes.length > 0) {
    // we also need to record when the settings change was made to the current settings
    postsettings.set('index', changes[0].index)
              .with_deviceTime(sundial.formatDeviceTime(changes[0].jsDate));
    cfg.tzoUtil.fillInUTCInfo(postsettings, changes[0].jsDate);
    postrecords.push(postsettings);
  }

  for(var i=0; i < changes.length; i++) {
    var record = changes[i];

    if(record.type.value === RECORD_TYPES.SELECT_BASAL_PROFILE.value ) {
      // active schedule was changed
      settingsChange.activeSchedule = PROFILES[record.head[1]];
    };

    if(record.type.value === RECORD_TYPES.VAR_BOLUS_ENABLE.value ) {
      settings.bolus.extended = {
        enabled : record.head[1] ? true : false
      };
    };

    if(record.type.value === RECORD_TYPES.MAX_BOLUS.value) {

      var value = ((record.head[1] & 0x1F) << 5) |
                  ((record.date[2] & BITMASKS.LEFT_THREE) >> 3) |
                  ((record.date[4] & BITMASKS.LEFT_TWO) >> 6);

      settings.bolus.amountMaximum = {
        value: value / settings.strokesPerUnit,
        units: 'Units'
      };
    };

    if(record.type.value === RECORD_TYPES.CHANGE_MAX_BASAL.value) {
      var value = record.head[1] |
                  ((record.date[2] & BITMASKS.LEFT_THREE) << 3);

      settings.basal.rateMaximum = {
        value: value / settings.strokesPerUnit,
        units: 'Units/hour'
      };
    };

    if(record.type.value === RECORD_TYPES.CHANGE_TEMP_BASAL_TYPE.value) {
      settings.basal.temporary = {
        type: record.head[1] ? 'percent' : 'Units/hour'
      };
    };

    if(record.type.value === RECORD_TYPES.BOLUS_WIZARD_CHANGE.value ) {
      // bolus wizard settings were changed

      var isSetupCompleteOld = record.head[1] & 0x01 ? true : false;
      var isSetupCompleteNew = record.head[1] >> 1 & 0x01 ? true : false;
      var isEnabledOld = record.head[1] >> 2 & 0x01 ? true : false;
      var isEnabledNew = record.head[1] >> 3 & 0x01 ? true : false;

      if (!isSetupCompleteNew) {
        // new bolus wizard setup is not yet complete, so we ignore this change,
        // as it occurs after a pump is reset and could contain invalid values
        continue;
      }

      var wizardSettings = getWizardSettings(record);
      var currSettings = _.pick(settingsChange,['bgTarget','carbRatio','insulinSensitivity','units','insulin','bolus.calculator']);

      if(_.isEqual(currSettings,wizardSettings.new)) {
        _.assign(settingsChange, wizardSettings.old);
      } else {
        debug('Could not find bolus wizard settings. Current wizard settings:', JSON.stringify(currSettings,null,4));
        debug('New wizard settings:', JSON.stringify(wizardSettings.new,null,4));
        throw new Error('Could not find bolus wizard settings');
      }
    };

    if(record.type.value === RECORD_TYPES.CHANGE_BASAL_PROFILE_NEW.value) {
      // basal profile was modified and then started automatically

      var profileNum = struct.extractByte(record.date,2) >> 5;
      settingsChange.activeSchedule = PROFILES[profileNum];

      var newSchedule = _.clone(getSchedule(record));
      i += 1; //advance to next record for old schedule

      if(i < changes.length) {
        record = changes[i];
        if(record && record.type.value === RECORD_TYPES.CHANGE_BASAL_PROFILE_OLD.value) {
          var oldSchedule = _.clone(getSchedule(record));
        } else {
          throw new Error('Old basal schedule is missing');
        }
      } else {
        debug('Old basal schedule has dropped off the end');
        break;
      }


      if(_.isEqual(settingsChange.basalSchedules[settingsChange.activeSchedule],newSchedule)) {
        settingsChange.basalSchedules[settingsChange.activeSchedule] = oldSchedule;
      } else {

        if(settingsChange.basalSchedules[settingsChange.activeSchedule].length === 0) {
          debug('Pump settings were cleared, using last available settings');
          settingsChange.basalSchedules[settingsChange.activeSchedule] = oldSchedule;
        } else {
          throw new Error('Could not find basal schedule');
        }
      }
    }

    settingsChanges.push(_.cloneDeep(settingsChange));

    if(prevDate && prevDate.valueOf() !== record.jsDate.valueOf()) {
      // only when the date changes we push the settings onto the stack,
      // to account for the three records when changing and selecting
      // basal profile with the same timestamp

      var pumpSettings = _.cloneDeep(settingsChanges[settingsChanges.length-2]);
      // use the previous schedule change, as that matches up with the date/time
      // it actually changed

      var postsettings = cfg.builder.makePumpSettings();
      postsettings.with_units(pumpSettings.units)
                  .with_carbRatio(pumpSettings.carbRatio)
                  .with_insulinSensitivity(pumpSettings.insulinSensitivity)
                  .with_bgTarget(pumpSettings.bgTarget)
                  .set('index', record.index)
                  .with_basalSchedules(pumpSettings.basalSchedules)
                  .with_activeSchedule(pumpSettings.activeSchedule)
                  .with_bolus({
                    calculator: pumpSettings.bolus.calculator,
                    extended: settings.bolus.extended,
                    amountMaximum: settings.bolus.amountMaximum
                  })
                  .with_basal(_.clone(settings.basal))
                  .with_deviceTime(sundial.formatDeviceTime(record.jsDate));
      cfg.tzoUtil.fillInUTCInfo(postsettings, record.jsDate);
      postrecords.push(postsettings);
    }

    prevDate = record.jsDate;
    // we need to clear the following settings, as we only have the new value,
    // and will figure out the old value in the simulator
    settings.basal = {};
    settings.bolus = {};
  }

  // also, record initial pump settings. We don't know exactly when these initial
  // settings were record, so we use the time of the first available record
  var initialSettings = cfg.builder.makePumpSettings();
  var first = settingsChanges[settingsChanges.length-1];

  initialSettings.with_units(first.units)
              .with_carbRatio(first.carbRatio)
              .with_insulinSensitivity(first.insulinSensitivity)
              .with_bgTarget(first.bgTarget)
              .with_basalSchedules(first.basalSchedules)
              .with_activeSchedule(first.activeSchedule)
              .with_bolus({
                calculator: first.bolus.calculator,
              });

  return {
            postrecords : postrecords,
            initialSettings : initialSettings
         };

}

var buildTempBasalRecords = function (records) {
  var basalRecords = filterHistory([RECORD_TYPES.TEMP_BASAL, RECORD_TYPES.TEMP_BASAL_DURATION], records);
  var postrecords = [];

  for(var i=0; i < basalRecords.length; i++) {
    var record = basalRecords[i];

    if(record.type.value === RECORD_TYPES.TEMP_BASAL.value) {
      var tempBasal;
      var type = (struct.extractByte(record.body,0) >> 3) ? 'percent' : 'absolute';

      var rate = null, percentage = null;
      if(type === 'absolute') {
        rate = struct.extractByte(record.head,1) / settings.strokesPerUnit;
      } else {
        percentage = struct.extractByte(record.head,1);
      }

      tempBasal = cfg.builder.makeTempBasal()
        .with_rate(rate)
        .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
        .set('index', record.index)
        .set('jsDate',record.jsDate);

      if(percentage != null) {
        tempBasal = tempBasal.with_percent(percentage/100.0);
      }

      var durationRecord = basalRecords[i+1];
      if(durationRecord && durationRecord.type.value === RECORD_TYPES.TEMP_BASAL_DURATION.value &&
          durationRecord.jsDate.valueOf() === tempBasal.jsDate.valueOf()) {
        i += 1; // advance past duration record
        tempBasal = tempBasal.with_duration(struct.extractByte(durationRecord.head,1) * 30 * sundial.MIN_TO_MSEC);
      } else {
        debug('Temp basal not followed by duration:',record, durationRecord);
        tempBasal = tempBasal.with_duration(0);
        annotate.annotateEvent(tempBasal,'basal/unknown-duration');
      }

      cfg.tzoUtil.fillInUTCInfo(tempBasal, record.jsDate);
      postrecords.push(tempBasal);
    }

  };

  return postrecords;
};

var buildBasalRecords = function (records) {
  var basalRecords = filterHistory([RECORD_TYPES.BASAL_PROFILE_START], records);
  var postrecords = [];

  for(var i=0; i < basalRecords.length; i++) {
    var record = basalRecords[i];

    var basal;
    var offset = (30*1000*60) * struct.extractByte(record.body,0);
    var rate = struct.extractByte(record.body,1) / settings.strokesPerUnit;
    var scheduleNameNum = struct.extractByte(record.date,2) >> 5;

    basal = cfg.builder.makeScheduledBasal()
      .with_rate(rate)
      .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
      .set('index', record.index)
      .with_scheduleName(PROFILES[scheduleNameNum]);

    cfg.tzoUtil.fillInUTCInfo(basal, record.jsDate);
    postrecords.push(basal);
  };

  return postrecords;
};

function buildPrimeRecords(records) {

  var primeRecords = filterHistory([RECORD_TYPES.PRIME], records);
  var postrecords = [];

  primeRecords.forEach(function (primedatum) {
    var amount = struct.extractByte(primedatum.head,4) / 10.0;
    var fixed  = struct.extractByte(primedatum.head,2) / 10.0;

    var type = fixed === 0 ? 'tubing' : 'cannula';

    var deviceEvent = cfg.builder.makeDeviceEventPrime()
      .with_deviceTime(sundial.formatDeviceTime(primedatum.jsDate))
      .with_primeTarget(type)
      .with_volume(amount)
      .set('index', primedatum.index);

    if(type === 'cannula' && fixed !== amount) {
      // it's possible to cancel a cannula prime,
      // storing the programmed amount in payload for now
      deviceEvent.set('payload', {programmedAmount: fixed});
    }

    cfg.tzoUtil.fillInUTCInfo(deviceEvent, primedatum.jsDate);
    deviceEvent = deviceEvent.done();
    postrecords.push(deviceEvent);
  });
  return postrecords;
}

function buildRewindRecords(records) {

  var rewindRecords = filterHistory([RECORD_TYPES.REWIND], records);
  var postrecords = [];

  rewindRecords.forEach(function (rewinddatum) {

    var deviceEvent = cfg.builder.makeDeviceEventReservoirChange()
      .with_deviceTime(sundial.formatDeviceTime(rewinddatum.jsDate))
      .set('index', rewinddatum.index);
    cfg.tzoUtil.fillInUTCInfo(deviceEvent, rewinddatum.jsDate);

    deviceEvent = deviceEvent.done();
    postrecords.push(deviceEvent);
  });
  return postrecords;
}

function buildTimeChangeRecords(records, mostRecent, type) {

  var timeChangeRecords = null;



  if(type === 'cgm') {
    timeChangeRecords = filterHistory([CBG_RECORD_TYPES.DATE_TIME_CHANGE], records);
  } else if (type === 'pump') {
    timeChangeRecords = filterHistory([RECORD_TYPES.CHANGE_TIME, RECORD_TYPES.NEW_TIME_SET], records);
  } else {
    throw new Error('Unknown time change type');
  }
  var postrecords = [];

  for (var i = 0; i < timeChangeRecords.length; i++) {

    if ((type === 'pump' && timeChangeRecords[i].type.value !== RECORD_TYPES.CHANGE_TIME.value) ||
        (type === 'cgm' && getSubCode(timeChangeRecords[i], CGM_TIME_CHANGE_TYPES) !== 'from')) {
      debug('Skipping time change event that should be a "from" time change:',timeChangeRecords[i]);
      continue;
    }

    var fromDatum = timeChangeRecords[i];

    debug('time change from :',fromDatum.jsDate);

    i += 1; // advance to next record for duration
    if ((timeChangeRecords[i] == null) ||
        (type === 'pump' &&
         timeChangeRecords[i].type.value !== RECORD_TYPES.NEW_TIME_SET.value) ||
        (type === 'cgm' &&
         getSubCode(timeChangeRecords[i], CGM_TIME_CHANGE_TYPES) !== 'manual' &&
         getSubCode(timeChangeRecords[i], CGM_TIME_CHANGE_TYPES) !== 'alarm')) {
      debug('Missing "to" time change event');
      i -= 1; // pass this record to next iteration of loop
      continue;
    }

    var toDatum = timeChangeRecords[i];

    if(toDatum) {
      debug('time change to :',toDatum.jsDate);

      /* We need to filter out spurious time changes that appear in the data when
         the battery is left out for too long. The strategy is to filter out any
         time change to a date where the year is less than the current year
         minus one. This is the same strategy used in the CareLink driver. */
      if (fromDatum.jsDate.getUTCFullYear() < (new Date().getUTCFullYear() - 1) ||
        toDatum.jsDate.getUTCFullYear() < (new Date().getUTCFullYear() - 1) ||
        (type === 'cgm' && getSubCode(timeChangeRecords[i], CGM_TIME_CHANGE_TYPES) === 'alarm')) {
        debug('Excluding time change from', fromDatum.jsDate.toISOString().slice(0,-5), 'to', toDatum.jsDate.toISOString().slice(0,-5), 'as spurious.');
        continue;
      }

      var timeChange = cfg.builder.makeDeviceEventTimeChange()
        .with_change({
          from: sundial.formatDeviceTime(fromDatum.jsDate),
          to: sundial.formatDeviceTime(toDatum.jsDate),
          agent: 'manual'
        })
        .with_deviceTime(sundial.formatDeviceTime(toDatum.jsDate))
        .with_payload({ deviceType : type })
        .set('jsDate', toDatum.jsDate)
        .set('index', toDatum.index);
      postrecords.push(timeChange);
    } else {
      debug('Records not matching:',fromDatum, toDatum);
      throw new Error('Missing record');
    }

  };
  var tzoUtil = new TZOUtil(cfg.timezone, mostRecent, postrecords);
  return { postrecords : tzoUtil.records, tzoUtil : tzoUtil };
}

function buildAlarmRecords(records) {

  var alarmRecords = filterHistory([RECORD_TYPES.ALARM_PUMP, RECORD_TYPES.LOW_RESERVOIR, RECORD_TYPES.LOW_BATTERY], records);
  var postrecords = [];

  var getAlarmName = function (idx,types) {
    return common.getName(types, idx);
  };

  alarmRecords.forEach(function (alarmdatum) {

    var alarmRecord = cfg.builder.makeDeviceEventAlarm()
      .with_deviceTime(sundial.formatDeviceTime(alarmdatum.jsDate))
      .set('index', alarmdatum.index);
    cfg.tzoUtil.fillInUTCInfo(alarmRecord, alarmdatum.jsDate);

    switch(alarmdatum.type.value) {
      case RECORD_TYPES.ALARM_PUMP.value:
        var alarmValue = struct.extractByte(alarmdatum.head,1);
        var alarmText = getAlarmName(alarmValue,ALARM_TYPES);

        switch (alarmValue) {
          case ALARM_TYPES.ALARM_NO_DELIVERY.value:
            alarmRecord = alarmRecord.with_alarmType('no_delivery');
            break;
          case ALARM_TYPES.ALARM_BATTERY_DEPLETED.value:
            alarmRecord = alarmRecord.with_alarmType('no_power');
            break;
            case ALARM_TYPES.ALARM_AUTO_OFF.value:
              alarmRecord = alarmRecord.with_alarmType('auto_off');
              break;
          default:
            alarmRecord = alarmRecord.with_alarmType('other');
            var payload = {alarm_id: alarmValue};
            if(alarmText !== 'unknown') {
              payload.alarm_text = alarmText;
            }
            alarmRecord = alarmRecord.with_payload(payload);
        }
        break;
      case RECORD_TYPES.LOW_RESERVOIR.value:
        alarmRecord = alarmRecord.with_alarmType('low_insulin')
                                 .with_payload({ amount : alarmdatum.head[1]/10.0});
        break;
      case RECORD_TYPES.LOW_BATTERY.value:
        alarmRecord = alarmRecord.with_alarmType('low_power');
        break;
      default:
        throw Error('Unknown alarm');
    }


    alarmRecord = alarmRecord.done();
    postrecords.push(alarmRecord);
  });
  return postrecords;
}

var processCBGPages = function(data, callback) {
  var records = [];
  var numRecords = 0;
  var pages = data.cbg_pages;
  var isigPages = data.isig_pages;
  var DEFAULT_PAGE_SIZE = 1024;
  var DATE_LENGTH = 4;

  if(pages == null || isigPages == null) {
    debug('No CGM records found on pump.');
    return callback(null,[]);
  }

  var isigBytes = new Uint8Array(DEFAULT_PAGE_SIZE * 2 * isigPages.length);
  var cbgBytes = new Uint8Array(DEFAULT_PAGE_SIZE * pages.length);
  var index = 0;

  // first we move the pages into continuous byte streams,
  // as the streams are easier to match up than pages
  var offset = 0;
  for(var i = 0; i < isigPages.length; i++) {
    if (isigPages[i].valid) {
      isigBytes.set(struct.extractBytes(isigPages[i].page,0,DEFAULT_PAGE_SIZE * 2),offset);
      offset += (DEFAULT_PAGE_SIZE * 2);
    }
  };

  offset = 0;
  for(var i = 0; i < pages.length; i++) {
    if (pages[i].valid) {
      cbgBytes.set(struct.extractBytes(pages[i].page,0,DEFAULT_PAGE_SIZE),offset);
      offset += DEFAULT_PAGE_SIZE;
    }
  };

  while (index < cbgBytes.length) {
    var record = { body: [], descriptor: [] };
    var found = false;
    var checkIfEnd = false;

    while(!found && index < cbgBytes.length) {
      var cbgByte = struct.extractByte(cbgBytes,index);
      var descriptorByteA = struct.extractByte(isigBytes, index * 2);
      var descriptorByteB = struct.extractByte(isigBytes, (index * 2) + 1);

      if(_.isEqual(record.descriptor.slice(record.descriptor.length - 8), [0x22,0x00,0x22,0x00,0x22,0x00,0x22,0x00]) &&
        descriptorByteA !== 0x22 &&
        descriptorByteB === 0x00
      ) {
        found = true;
      }
      record.body.push(cbgByte);
      record.descriptor.push(descriptorByteA);
      record.descriptor.push(descriptorByteB);

      if(_.isEqual(record.descriptor, [0x01,0x00]) && cbgByte === CBG_RECORD_TYPES.DATA_END.value) {
        debug('Reached end of CBG data');
        break;
      }

      index += 1;
    }

    record.head = record.body.pop();
    record.type = getType(record.head,CBG_RECORD_TYPES);

    if(record.head == null || record.type.value === CBG_RECORD_TYPES.DATA_END.value) {
      debug('End of CBG pages.');
      break;
    }

    record.date = record.body.splice(record.body.length - DATE_LENGTH);
    record.jsDate = decodeDate(record.date);

    if(checkIfEnd) {
      // we got more records, so the corrupted record was not at the end
      debug('Discarding records and starting from next page');
      checkIfEnd = false;
      records = [];
      numRecords = 0;
      break;
    }

    if(record.type === 'unknown') {
      debug('Unknown type or corrupt CBG record starting with: ' + common.bytes2hex([record.head]));
      // are we maybe at the end of the stream?
      checkIfEnd = true;
      continue;
    }

    record.index = index;
    records.push(record);
    numRecords += 1;
  }

  return callback(null,records);
};

var processPages = function(data, callback) {

  var records = [];
  var numRecords = 0;
  var pages = data.pages;
  var MAX_PAGE_SIZE = 1024;
  var RESET_DATE = sundial.buildTimestamp({year:2012,month:1,day:1,hours:0,minutes:0,seconds:0}); // after a reset, some records will have this timestamp

  for(var i = pages.length - 1; i >= 0; i--) {
    // pages are reverse chronological, but records in each page are chronological
    if (pages[i].valid) {
      var page = pages[i].page;
      var index = 0;
      while(index < MAX_PAGE_SIZE-2) { // last two bytes are check bytes
        var record = {};
        record.head = struct.extractBytes(page,index,2);
        if(record.head[0] === 0) {
          index += 1;
          continue;
        }
        record.type = getType(record.head[0],RECORD_TYPES);

        if(record.type.value === RECORD_TYPES.SENSOR_PREDICTIVE_ALERTS.value) {
          record.type.body_length = (record.head[1] - 1) * 3;
        }
        if(record.type.value === RECORD_TYPES.UNABSORBED_INSULIN.value) {
          // IOB record has variable head length
          record.type.head_length = record.head[1];
        }
        if(record.type.value === RECORD_TYPES.SENSOR_SETTINGS.value &&
            (data.settings.modelNumber === '523' || data.settings.modelNumber === '723')) {
              record.type.body_length = 30;
        }
        if(record.type === 'unknown') {
          debug('Unknown type or corrupt record starting with: ' + common.bytes2hex([record.head[0]]));
          debug('Discarding records and starting from next page');
          records = [];
          numRecords = 0;
          break;
        }

        _.defaults(record.type, { head_length : 2, date_length : 5, body_length : 0 });

        record.head = struct.extractBytes(page, index,record.type.head_length);
        index += record.type.head_length;

        record.date = struct.extractBytes(page, index, record.type.date_length);
        index += record.type.date_length;

        record.body = struct.extractBytes(page, index, record.type.body_length);
        index += record.type.body_length;

        record.jsDate = decodeDate(record.date);
        if(debugMode.isDebug) {
          debug(record.jsDate, record.type.name, common.bytes2hex(record.head),common.bytes2hex(record.date),common.bytes2hex(record.body));
        }

        record.index = numRecords;
        if(record.jsDate && record.jsDate.valueOf() !== RESET_DATE.valueOf()) {
          records.push(record);
        } else {
          if(debugMode.isDebug) {
            debug('Dropping event with incorrect date');
          }
        }

        numRecords += 1;
      }
    }
  }

  return callback(null,records);

};

module.exports.init = init;
module.exports.processPages = processPages;
module.exports.processCBGPages = processCBGPages;
module.exports.buildBasalRecords = buildBasalRecords;
module.exports.buildTempBasalRecords = buildTempBasalRecords;
module.exports.buildBolusRecords = buildBolusRecords;
module.exports.buildWizardRecords = buildWizardRecords;
module.exports.buildSuspendResumeRecords = buildSuspendResumeRecords;
module.exports.buildBGRecords = buildBGRecords;
module.exports.buildCGMRecords = buildCGMRecords;
module.exports.buildSettings = buildSettings;
module.exports.buildAlarmRecords = buildAlarmRecords;
module.exports.buildPrimeRecords = buildPrimeRecords;
module.exports.buildRewindRecords = buildRewindRecords;
module.exports.buildTimeChangeRecords = buildTimeChangeRecords;
module.exports.getCarbRatios = getCarbRatios;
module.exports.getBGTargets = getBGTargets;
module.exports.getInsulinSensitivities = getInsulinSensitivities;
module.exports.PROFILES = PROFILES;
