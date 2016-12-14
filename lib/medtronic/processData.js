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

/* globals chrome, __DEBUG__  */

var _ = require('lodash');

var sundial = require('sundial');
var struct = require('../struct.js')();
var common = require('../commonFunctions');
var annotate = require('../eventAnnotations');
var TZOUtil = require('../TimezoneOffsetUtil');

var debug = (typeof __DEBUG__ === 'undefined') ? false : __DEBUG__;
var isBrowser = typeof window !== 'undefined';

var RECORD_TYPES = {
  BOLUS: { value: 0x01, head_length: 5, larger: { head_length: 8 }, name: 'BOLUS'},
  PRIME: { value: 0x03, head_length: 5, name: 'PRIME'},
  ALARM_PUMP: { value: 0x06, head_length: 4, name: 'ALARM_PUMP'},
  RESULT_DAILY_TOTAL: { value: 0x07, head_length: 5, date_length: 2, larger: { body_length: 3 }, name: 'RESULT_DAILY_TOTAL' },
  CHANGE_BASAL_PROFILE_OLD: { value: 0x08, body_length:145, name: 'CHANGE_BASAL_PROFILE_OLD'},
  CHANGE_BASAL_PROFILE_NEW: { value: 0X09, body_length:145, name: 'CHANGE_BASAL_PROFILE_NEW'},
  UNKNOWN_10: { value: 0x10, date_length: 2, name: 'UNKNOWN_10' },
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
  PUMP_SUSPEND: { value:0x1e, name: 'PUMP_SUSPEND'},
  PUMP_RESUME: { value:0x1f, name: 'PUMP_RESUME'},
  REWIND: { value:0x21, name: 'REWIND'},
  UNKNOWN_22: { value:0x22, name:'UNKNOWN_22'},
  UNKNOWN_23: { value:0x23, name:'UNKNOWN_23'},
  UNKNOWN_24: { value:0x24, name:'UNKNOWN_24'},
  ENABLE_DISABLE_REMOTE: { value:0x26, body_length:14, name:'ENABLE_DISABLE_REMOTE'},
  CHANGE_REMOTE_ID: { value:0x27, name: 'CHANGE_REMOTE_ID'},
  CHANGE_MAX_BASAL: { value:0x2C, name:'CHANGE_MAX_BASAL'},
  SET_BOLUS_WIZARD_ENABLED: { value:0x2D, name:'SET_BOLUS_WIZARD_ENABLED'},
  UNKNOWN_2E: { value:0x2E, body_length:100, name: 'UNKNOWN_2E'},
  BOLUS_WIZARD_512: { value:0x2F, body_length:12, name:'BOLUS_WIZARD_512'},
  IOB_512: { value:0x30, name:'IOB_512'},
  TEMP_BASAL: { value:0x33, body_length:1, name:'TEMP_BASAL'},
  LOW_RESERVOIR: { value:0x34, name:'LOW_RESERVOIR'},
  UNKNOWN_3B: { value:0x3B, name:'UNKNOWN_3B'},
  CHANGE_PARADIGM_LINK_ID: { value:0x3C, body_length:14, name:'CHANGE_PARADIGM_LINK_ID'},
  BG_RECEIVED: { value:0x3F, body_length:3, name:'BG_RECEIVED'},
  JOURNAL_ENTRY_MEAL_MARKER: { value:0x40, body_length:2, name:'JOURNAL_ENTRY_MEAL_MARKER'},
  JOURNAL_ENTRY_EXERCISE_MARKER: { value:0x41, body_length:1, name:'JOURNAL_ENTRY_EXERCISE_MARKER'},
  JOURNAL_ENTRY_OTHER_MARKER: { value:0x42, body_length:1, name:'JOURNAL_ENTRY_OTHER_MARKER'},
  CHANGE_BOLUS_WIZARD_SETUP: { value:0x4F, body_length:40, name:'CHANGE_BOLUS_WIZARD_SETUP'},
  UNKNOWN_50: { value:0x50, body_length:30, larger:{ body_length:34 }, name:'UNKNOWN_50'},
  UNKNOWN_51: { value:0x51, name:'UNKNOWN_51'},
  UNKNOWN_52: { value:0x52, name:'UNKNOWN_52'},
  UNKNOWN_53: { value:0x53, body_length:1, name:'UNKNOWN_53'},
  UNKNOWN_54: { value:0x54, body_length:57, name:'UNKNOWN_54'},
  UNKNOWN_55: { value:0x55, name: 'UNKNOWN_55'},
  UNKNOWN_56: { value:0x56, body_length:5, name: 'UNKNOWN_56'},
  UNKNOWN_57: { value:0x57, name:'UNKNOWN_57'},
  BOLUS_WIZARD_CHANGE_OLD: { value:0x5A, body_length:117, larger:{ body_length:137 }, name:'BOLUS_WIZARD_CHANGE_OLD'},
  BOLUS_WIZARD_CHANGE_BIG: { value:0x5A, body_length:143, name:'BOLUS_WIZARD_CHANGE_BIG'},
  BOLUS_WIZARD: { value:0x5B, body_length:13, larger:{body_length:15}, name:'BOLUS_WIZARD'},
  UNABSORBED_INSULIN: { value:0x5C, date_length:0, name:'UNABSORBED_INSULIN'},
  SAVE_SETTINGS: { value:0x5D, name:'SAVE_SETTINGS'},
  UNKNOWN_5E: { value:0x5E, name:'UNKNOWN_5E'},
  CHANGE_AUDIO_BOLUS: { value:0x5F, name:'CHANGE_AUDIO_BOLUS'},
  CHANGE_BG_REMINDER_ENABLE: { value:0x60, name:'CHANGE_BG_REMINDER_ENABLE'},
  UNKNOWN_61: { value:0x61, name:'UNKNOWN_61'},
  CHANGE_TEMP_BASAL_TYPE: { value:0x62, name:'CHANGE_TEMP_BASAL_TYPE'},
  CHANGE_ALARM_NOTIFY_MODE: { value:0x63, body_length:0, name:'CHANGE_ALARM_NOTIFY_MODE'},
  CHANGE_TIME_DISPLAY: { value:0x64, name:'CHANGE_TIME_DISPLAY'},
  UNKNOWN_65: { value:0x65, name:'UNKNOWN_65'},
  UNKNOWN_66: { value:0x66, name:'UNKNOWN_66'},
  UNKNOWN_69: { value:0x69, body_length:2, name:'UNKNOWN_69'},
  UNKNOWN_6C: { value:0x6C, head_length:1, date_length:2, body_length:40, name:'UNKNOWN_6C'}, //TODO: body_length model522:41, model508:34
  MODEL_522_RESULTS_TOTALS: { value:0x6D, head_length:1, date_length:2, body_length:40, name:'MODEL_522_RESULTS_TOTALS'},
  UNKNOWN_6E: { value:0x6E, head_length:1, date_length:2, body_length:49, name:'UNKNOWN_6E'}, //TODO: make sure about date_length, body_length
  UNKNOWN_6F: { value:0x6F, name:'UNKNOWN_6F'},
  BASAL_PROFILE_START: { value:0x7B, body_length:3, name:'BASAL_PROFILE_START'},
  CONNECT_DEVICES_OTHER_DEVICES_ENABLED: { value:0x7C, name:'CONNECT_DEVICES_OTHER_DEVICES_ENABLED'},
  CHANGE_OTHER_DEVICE_ID: { value:0x7D, body_length:30, name:'CHANGE_OTHER_DEVICE_ID'},
  CHANGE_WATCHDOG_MARRIAGE_PROFILE: { value:0x81, body_length:5, name:'CHANGE_WATCHDOG_MARRIAGE_PROFILE'},
  DELETE_OTHER_DEVICE_ID: { value:0x82, body_length:5, name:'DELETE_OTHER_DEVICE_ID'},
  CHANGE_CAPTURE_EVENT_ENABLE: { value:0x83, name:'CHANGE_CAPTURE_EVENT_ENABLE'},
  UNKNOWN_A8: { value:0xA8, head_length:10, name:'UNKNOWN_A8'},
};

var CBG_RECORD_TYPES = {
  DATA_END: { value: 0x01, name:'DATA_END'},
  SENSOR_WEAK_SIGNAL: { value:0x02, name: 'SENSOR_WEAK_SIGNAL'},
  UNKNOWN_03: { value:0x03, name: 'UNKNOWN_03'},
  UNKNOWN_07: { value:0x07, name: 'UNKNOWN_07'},
  SENSOR_TIMESTAMP: { value:0x08, name: 'SENSOR_TIMESTAMP'},
  BATTERY_CHANGE: { value:0x0A, name:'BATTERY_CHANGE'},
  SENSOR_STATUS: { value:0x0B, name:'SENSOR_STATUS'},
  DATE_TIME_CHANGE: { value:0x0C, name:'DATE_TIME_CHANGE'},
  SENSOR_SYNC: { value: 0x0D, name:'SENSOR_SYNC'},
  SENSOR_CAL_BG: { value: 0x0E, name:'SENSOR_CAL_BG'},
  SENSOR_CAL_FACTOR: { value: 0x0F, name:'SENSOR_CAL_FACTOR'},
  SENSOR_CAL: { value: 0x10, name:'SENSOR_CAL'}
};

var BITMASKS = {
  LEFT_ONE: 0x80,     // b10000000
  LEFT_TWO: 0xc0,     // b11000000
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

var ALARM_TYPES = {
  ALARM_BATTERY_LIMIT: { value: 3, name: 'Battery out limit exceeded'},
  ALARM_NO_DELIVERY: { value: 4, name: 'No delivery'},
  ALARM_BATTERY_DEPLETED: { value: 5, name: 'Battery depleted'},
  ALARM_AUTO_OFF: {value: 6, name: 'Auto off'},
  ALARM_BUTTON: { value: 59, name: 'Button error'}
};

var cfg;
var basalSchedules = {};

var init = function(config, settings) {
  cfg = _.clone(config);
  cfg.settings = _.clone(settings);
};

var updateConfig = function(config) {
  _.assign(cfg,config);
};

Number.prototype.toFixedNumber = function(significant){
  var pow = Math.pow(10,significant);
  return +( Math.round(this*pow) / pow );
};

var decodeDate = function (payload) {
 var encoded, second, minute, hour, day, month, year;

 if(payload.length < 4) {
   console.log('Skipping short dates for now');
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
    console.log('Wizard:', record.jsDate, common.bytes2hex(record.date), common.bytes2hex(record.body));

    var carbInput, bgInput, carbRatio, bgTarget = {}, isf, recommended = {}, iob, units;
    if (cfg.settings.larger) {
      var bgRaw = [struct.extractByte(record.body,1) & BITMASKS.RIGHT_TWO];
      bgRaw = bgRaw.concat(struct.extractByte(record.head,1));
      bgInput = struct.extractBEShort(bgRaw,0);

      var carbRaw = [(struct.extractByte(record.body,1) & BITMASKS.RIGHT_1100) >> 2];
      carbRaw = carbRaw.concat(struct.extractByte(record.body,0));
      carbInput = struct.extractBEShort(carbRaw,0);

      var carbRatioRaw = [struct.extractByte(record.body,2) & BITMASKS.RIGHT_THREE];
      carbRatioRaw = carbRatioRaw.concat(struct.extractByte(record.body,3));
      carbRatio = struct.extractBEShort(carbRatioRaw,0) / 10.0;

      bgTarget.low = struct.extractByte(record.body,5);
      isf = struct.extractByte(record.body,4);
      bgTarget.high = struct.extractByte(record.body,14);
      recommended.carb = struct.extractBEShort(record.body,7) / cfg.settings.strokesPerUnit;

      recommended.correction = twosComplement((((struct.extractByte(record.body,9) & BITMASKS.LEFT_00111) << 5) + struct.extractByte(record.body,6)),11) / cfg.settings.strokesPerUnit;

      recommended.net = struct.extractBEShort(record.body,12) / cfg.settings.strokesPerUnit;
      iob =  struct.extractBEShort(record.body,10) / cfg.settings.strokesPerUnit;

      units = (struct.extractByte(record.body,1) & BITMASKS.LEFT_TWO) === 0x80 ? 'mmol/L' : 'mg/dL';
    } else {
      var bgRaw = [struct.extractByte(record.body,1) & BITMASKS.RIGHT_FOUR];
      bgRaw = bgRaw.concat(struct.extractByte(record.head,1));
      bgInput = struct.extractBEShort(bgRaw,0);

      carbInput = struct.extractByte(record.body,0);
      carbRatio = struct.extractByte(record.body,2);

      bgTarget.low = struct.extractByte(record.body,4);
      isf = struct.extractByte(record.body,3);
      bgTarget.high = struct.extractByte(record.body,12);
      recommended.carb = struct.extractBEShort(record.body,6) / cfg.settings.strokesPerUnit;

      var correctionRaw = [twosComplement(struct.extractByte(record.body,5) & BITMASKS.RIGHT_FOUR, 8)];
      correctionRaw = correctionRaw.concat(twosComplement(struct.extractByte(record.body,7), 8));
      recommended.correction = struct.extractBEShort(correctionRaw,0) / cfg.settings.strokesPerUnit;

      recommended.net = struct.extractBEShort(record.body,11) / cfg.settings.strokesPerUnit;
      iob =  struct.extractBEShort(record.body,9) / cfg.settings.strokesPerUnit;

      units = 'mg/dL'; // TODO: figure out these units when we get hold of pump model with smaller record format
    }

    if(units == 'mmol/L') {
      bgTarget.low = bgTarget.low / 10.0;
      bgTarget.high = bgTarget.high / 10.0;
      isf = isf / 10.0;
      bgInput = bgInput / 10.0;
    }

    var wizard = cfg.builder.makeWizard()
      .with_recommended({
        carb: recommended.carb,
        correction: recommended.correction,
        net: recommended.net
      })
      .with_carbInput(carbInput)
      .with_insulinOnBoard(iob)
      .with_insulinCarbRatio(carbRatio)
      .with_insulinSensitivity(isf)
      .with_bgTarget({
        low: bgTarget.low,
        high: bgTarget.high
      })
      .with_units(units);

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

  bolusRecords.forEach(function(bolus) {
    console.log('Bolus:',bolus.jsDate, common.bytes2hex(bolus.head), common.bytes2hex(bolus.date));
  });

  for(var i=0; i < bolusRecords.length; i++) {
    var record = bolusRecords[i];

    var bolus;

    var amount, programmed, iob;
    if(cfg.settings.larger) {
      amount = struct.extractBEShort(record.head,3)/cfg.settings.strokesPerUnit;
      programmed = struct.extractBEShort(record.head,1)/cfg.settings.strokesPerUnit;
      iob = struct.extractBEShort(record.head,5)/cfg.settings.strokesPerUnit;
    } else {
      amount = struct.extractByte(record.head,2)/cfg.settings.strokesPerUnit;
      programmed = struct.extractByte(record.head,1)/cfg.settings.strokesPerUnit;
      iob = null;
    }

    var duration = record.head[7] * 30 * sundial.MIN_TO_MSEC;

    if (duration > 0) {
      //TODO: put iob in payload?

      if((record.date[2] & BITMASKS.LEFT_TWO) === 0x80) {
        // we mask out the time from the hour byte and check if the result is binary 10
        bolus = cfg.builder.makeDualBolus()
          .with_duration(duration)
          .with_extended(amount);

          if(programmed !== amount) {
            // dual bolus was cancelled
            var actualDuration = Math.round((amount / (programmed * 1.0)) * duration);
            bolus = bolus.with_expectedExtended(programmed)
                      .with_expectedDuration(duration)
                      .with_duration(actualDuration);
          }

          i+=1; // advance to next bolus for normal portion
          //TODO: add second index to payload
          record = bolusRecords[i];
          amount = struct.extractBEShort(record.head,3) / cfg.settings.strokesPerUnit;
          programmed = struct.extractBEShort(record.head,1) / cfg.settings.strokesPerUnit;
          iob = struct.extractBEShort(record.head,5) / cfg.settings.strokesPerUnit;

          bolus = bolus.with_normal(amount);
          if(programmed !== amount) {
            bolus = bolus.with_expectedNormal(programmed);
          }
      } else {
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

      } else {
        // normal bolus
        bolus = cfg.builder.makeNormalBolus()
          .with_normal(amount);

        if(programmed !== amount) {
          bolus = bolus.with_expectedNormal(programmed);
        }
      }

    bolus = bolus.with_deviceTime(sundial.formatDeviceTime(record.jsDate))
        .set('index', record.index)
        .set('jsDate', record.jsDate);

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

    console.log('smbg:',bgEntry.jsDate, common.bytes2hex(bgEntry.head), common.bytes2hex(bgEntry.date), common.bytes2hex(bgEntry.body));

    var bg = bgEntry.head[1] + ((struct.extractByte(bgEntry.date,4) & BITMASKS.LEFT_ONE) << 1) + ((struct.extractByte(bgEntry.date,2) & BITMASKS.LEFT_TWO) << 2);
    var bgRecord = cfg.builder.makeSMBG()
      .with_deviceTime(sundial.formatDeviceTime(bgEntry.jsDate))
      .with_value(bg);

    if(bgRecords[i+1] && bgRecords[i+1].type.value === RECORD_TYPES.BG_RECEIVED.value) {
      // if value is from linked meter, CAL_BG_FOR_PH record is followed by BG_RECEIVED record
      i += 1;
      bgEntry = bgRecords[i];

      // Note: Bayer does not send control solution readings to the pump
      var linkedBg = (struct.extractByte(bgEntry.head,1) << 3) + (struct.extractByte(bgEntry.date,2) >> 5);
      if(bg !== linkedBg) {
        console.log(bgEntry.jsDate, bg, linkedBg);
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

    // records from mg/dL meters are always in mg/dL. If pump is set to mmol/L,
    // smbg record will be mg/dL and wizard record will be mmol/L
    bgRecord.with_units('mg/dL')  // TODO: check if mmol/L meters send data in mmol/L
            .set('index',bgEntry.index);
    cfg.tzoUtil.fillInUTCInfo(bgRecord, bgEntry.jsDate);
    bgRecord.done();
    postrecords.push(bgRecord);
  };
  return postrecords;
}

function buildCGMRecords(events) {

  var postrecords = [];
  var start = null;
  var recordsSinceTimestamp = null;

  for( var i = 0; i < events.length; i++ ) {
    var event = events[i];

    if(event.jsDate != false) {
      console.log('CGM event:',sundial.formatDeviceTime(event.jsDate), event.type.name, common.bytes2hex([event.head]),common.bytes2hex(event.date),common.bytes2hex(event.body),common.bytes2hex(event.descriptor) );

      if(event.body) {
        var offset = 0;

        while(offset < event.body.length) {

          var isig = struct.extractShort(event.descriptor, offset * 2);

          if(isig !== 0x22 && isig > 100) {
            var cbg = (isig & 0x01) + (event.body[offset] << 1);
            recordsSinceTimestamp += 1;

            var date = sundial.applyOffset(start, recordsSinceTimestamp * 5);

            console.log('CBG:', sundial.formatDeviceTime(date), common.bytes2hex(struct.extractBytes(event.descriptor, offset * 2, 2)),',',common.bytes2hex([struct.extractByte(event.body,offset)]),',',(isig & 0x01) + (event.body[offset] << 1),',',(isig  & 0xFFFE) / 100.0);
            if(cbg >= 40) { // ignore magic numbers
              var record = cfg.builder.makeCBG()
                    .with_value(cbg)
                    .with_deviceTime(sundial.formatDeviceTime(date))
                    .with_units('mg/dL')      // TODO: check if mmol/L cbg is also hard-coded in mg/dL
                    .with_payload({ interstitialSignal : (isig  & 0xFFFE) / 100.0 }) // mask out lsb
                    .set('index', event.index);
              cfg.cgmTzoUtil.fillInUTCInfo(record, date);
              //TODO: date/time change events
              record = record.done();
              postrecords.push(record);
            }
          } else {
            if(isig === 2 && event.body[offset] === 0x02) {
              console.log('Weak signal');
              recordsSinceTimestamp += 1;
            }
          }

          offset += 1;
        }

      }
    } else {
      console.log('Skipping', event);
    }

    if(event.type.value === CBG_RECORD_TYPES.SENSOR_TIMESTAMP.value) {
      start = event.jsDate;
      recordsSinceTimestamp = 0;
    }

    if(event.type.value === CBG_RECORD_TYPES.SENSOR_CAL_BG.value) {
      if(struct.extractShort(event.descriptor, event.descriptor.length - 12) === 0x22) {
        var record = cfg.builder.makeDeviceEventCalibration();
        record.with_value(event.body[event.body.length-1])
              .with_deviceTime(sundial.formatDeviceTime(event.jsDate))
              .with_units('mg/dL')      // TODO: hard-coded in mg/dL on device?
              .set('index', event.index);
        cfg.cgmTzoUtil.fillInUTCInfo(record, event.jsDate);
        record = record.done();
        postrecords.push(record);
      }
    }

  };
  return postrecords;
}

function buildSuspendResumeRecords(records) {

  var suspendResumeRecords = filterHistory([RECORD_TYPES.PUMP_SUSPEND, RECORD_TYPES.PUMP_RESUME], records);
  var postrecords = [];

  suspendResumeRecords.forEach(function (entry) {
    console.log('suspend/resume:',entry.jsDate, common.bytes2hex(entry.head), common.bytes2hex(entry.date), common.bytes2hex(entry.body));
  });

  for(var i=0; i < suspendResumeRecords.length; i++) {
    var suspendEntry = suspendResumeRecords[i];

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

      //TODO: handle LGS of 530G

      var resumeEntry = suspendResumeRecords[i+1];
      if(resumeEntry && resumeEntry.type.value === RECORD_TYPES.PUMP_RESUME.value) {
        i += 1; // increment counter, as we have a matching resume
        var duration = resumeEntry.jsDate.valueOf() - suspendEntry.jsDate.valueOf();
        suspendResume.with_duration(duration)
                     .set('resumeIndex', resumeEntry.index);
      } else {
        suspendResume.with_duration(0);
        annotate.annotateEvent(suspendResume,'status/incomplete-tuple');
      }

      // order here is important, as we use it in the simulator
      postrecords.push(suspendResume.done());
      postrecords.push(suspendedBasal);

    } else {
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
      INSULIN_SENSITIVITY: 16,
      BG_TARGET : 25
    };

    var oldSettings = {};
    var newSettings = {};

    var getUnits = function(encoded) {
      return {
        bg :  encoded & 0x04 ? 'mg/dL' : 'mmol/L',
        carb : encoded & 0x01 ? 'grams' : 'exchanges'
      };
    };

    oldSettings.units = getUnits(record.body[0]);
    oldSettings.carbRatio = getCarbRatios(record.body, oldSettings.units.carb);
    var index = SIZES.CARB_RATIO;
    oldSettings.insulinSensitivity = getInsulinSensitivities(struct.extractBytes(record.body, index, SIZES.INSULIN_SENSITIVITY), oldSettings.units.bg);
    index += SIZES.INSULIN_SENSITIVITY;
    oldSettings.bgTarget = getBGTargets(struct.extractBytes(record.body, index, SIZES.BG_TARGET), oldSettings.units.bg);
    index += SIZES.BG_TARGET;

    newSettings.units = getUnits(record.body[index]);
    newSettings.carbRatio = getCarbRatios(struct.extractBytes(record.body, index, SIZES.CARB_RATIO), newSettings.units.carb);
    index += SIZES.CARB_RATIO;
    newSettings.insulinSensitivity = getInsulinSensitivities(struct.extractBytes(record.body, index,SIZES.INSULIN_SENSITIVITY), newSettings.units.bg);
    index += SIZES.INSULIN_SENSITIVITY;
    newSettings.bgTarget = getBGTargets(struct.extractBytes(record.body, index,SIZES.BG_TARGET), newSettings.units.bg);

    return { old: oldSettings, new: newSettings};
  };

  var getSchedule = function(record) {
    var schedules = [];

    if (record.head[1] === 0) {
      return schedules; // record not set yet
    }

    for(var j = 0; j < 47; j++ ) {
      var schedule = struct.unpack(record.body,j*3,'bbb',['offset', 'rate', 'q']);
      if (schedule.offset === 0 && schedule.rate === 0 && schedule.q === 0) {
        break;
      }
      var startTime = schedule.offset * 30 * sundial.MIN_TO_MSEC;
      schedules.push( { start: startTime, rate: schedule.rate / cfg.settings.strokesPerUnit} );
    };
    return schedules;
  };

  // we start with the current basal profiles and work our way back
  var changes = filterHistory([RECORD_TYPES.CHANGE_BASAL_PROFILE_OLD,
                                 RECORD_TYPES.CHANGE_BASAL_PROFILE_NEW,
                                 RECORD_TYPES.SELECT_BASAL_PROFILE,
                                 RECORD_TYPES.BOLUS_WIZARD_CHANGE_OLD], records).reverse();
  var postrecords = [];
  var settingsChanges = [];
  var prevDate = null;

  // when we record schedule changes, we need to start with the
  // most recent schedules and work our way back
  var settingsChange = _.cloneDeep(_.pick(cfg.settings,['basalSchedules','bgTarget','insulinSensitivity','carbRatio','units','activeSchedule']));
  // as we're modifying settingsChange later, we have to cloneDeep
  settingsChanges.push(_.cloneDeep(settingsChange));

  // push current settings onto stack
  var postsettings = cfg.builder.makePumpSettings();
  postsettings.with_units(cfg.settings.units)
              .with_carbRatio(cfg.settings.carbRatio)
              .with_insulinSensitivity(cfg.settings.insulinSensitivity)
              .with_bgTarget(cfg.settings.bgTarget)
              .with_basalSchedules(cfg.settings.basalSchedules)
              .with_activeSchedule(cfg.settings.activeSchedule)
              // current settings do not have an index, so can't use TZOUtil.
              .with_time(sundial.applyTimezone(cfg.settings.currentDeviceTime, cfg.timezone).toISOString())
              .with_deviceTime(sundial.formatDeviceTime(cfg.settings.currentDeviceTime))
              .with_timezoneOffset(sundial.getOffsetFromZone(cfg.settings.currentDeviceTime, cfg.timezone))
              .with_conversionOffset(0);
  postrecords.push(postsettings.done());

  changes.forEach(function (settingsEntry) {
    console.log('settings change:',common.getName(RECORD_TYPES,settingsEntry.type.value),settingsEntry.jsDate, common.bytes2hex(settingsEntry.head), common.bytes2hex(settingsEntry.date), common.bytes2hex(settingsEntry.body));
  });

  for(var i=0; i < changes.length; i++) {
    var record = changes[i];

    if(record.type.value === RECORD_TYPES.SELECT_BASAL_PROFILE.value ) {
      // active schedule was changed
      settingsChange.activeSchedule = PROFILES[record.head[1]];
    };

    if(record.type.value === RECORD_TYPES.BOLUS_WIZARD_CHANGE_OLD.value ) {
      // bolus wizard settings were changed

      var wizardSettings = getWizardSettings(record);
      var currSettings = _.pick(settingsChange,['bgTarget','carbRatio','insulinSensitivity','units']);

      if(_.isEqual(currSettings,wizardSettings.new)) {
        _.assign(settingsChange, wizardSettings.old);
      } else {
        console.log('Could not find bolus wizard settings. Current wizard settings:', JSON.stringify(currSettings,null,4));
        console.log('New wizard settings:', JSON.stringify(wizardSettings.new,null,4));
        throw new Error('Could not find bolus wizard settings');
      }
    };

    if(record.type.value === RECORD_TYPES.CHANGE_BASAL_PROFILE_NEW.value) {
      // basal profile was modified and then started automatically

      var profileNum = struct.extractByte(record.date,2) >> 5;
      settingsChange.activeSchedule = PROFILES[profileNum];

      var newSchedule = _.clone(getSchedule(record));
      i += 1; //advance to next record for old schedule
      record = changes[i];
      if(record && record.type.value === RECORD_TYPES.CHANGE_BASAL_PROFILE_OLD.value) {
        var oldSchedule = _.clone(getSchedule(record));
      } else {
        throw new Error('Old basal schedule is missing');
      }

      if(_.isEqual(settingsChange.basalSchedules[settingsChange.activeSchedule],newSchedule)) {
        settingsChange.basalSchedules[settingsChange.activeSchedule] = oldSchedule;
      } else {

        if(settingsChange.basalSchedules[settingsChange.activeSchedule].length === 0) {
          console.log('Pump settings were cleared, using last available settings');
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

      var settings = _.cloneDeep(settingsChanges[settingsChanges.length-2]);
      // use the previous schedule change, as that matches up with the date/time
      // it actually changed

      var postsettings = cfg.builder.makePumpSettings();
      postsettings.with_units(settings.units)
                  .with_carbRatio(settings.carbRatio)
                  .with_insulinSensitivity(settings.insulinSensitivity)
                  .with_bgTarget(settings.bgTarget)
                  .set('index', record.index)
                  .with_basalSchedules(settings.basalSchedules)
                  .with_activeSchedule(settings.activeSchedule)
                  .with_deviceTime(sundial.formatDeviceTime(record.jsDate));
      cfg.tzoUtil.fillInUTCInfo(postsettings, record.jsDate);
      postrecords.push(postsettings.done());
    }

    prevDate = record.jsDate;

  }

  return postrecords;

}

var buildTempBasalRecords = function (records) {
  var basalRecords = filterHistory([RECORD_TYPES.TEMP_BASAL, RECORD_TYPES.TEMP_BASAL_DURATION], records);
  var postrecords = [];

  basalRecords.forEach(function(basal) {
    console.log('Temp basal:',basal.jsDate, common.bytes2hex(basal.head), common.bytes2hex(basal.body), common.bytes2hex(basal.date));
  });

  for(var i=0; i < basalRecords.length; i++) {
    var record = basalRecords[i];

    if(record.type.value === RECORD_TYPES.TEMP_BASAL.value) {
      var tempBasal;
      var type = (struct.extractByte(record.body,0) >> 3) ? 'percent' : 'absolute';

      var rate = null, percentage = null;
      if(type === 'absolute') {
        rate = struct.extractByte(record.head,1) / cfg.settings.strokesPerUnit;
      } else {
        percentage = struct.extractByte(record.head,1);
      }

      tempBasal = cfg.builder.makeTempBasal()
        .with_rate(rate)
        .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
        .set('index', record.index)
        .set('jsDate',record.jsDate);

      if(percentage) {
        tempBasal = tempBasal.with_percent(percentage/100.0);
      }

      i += 1; // advance to next record for duration
      var durationRecord = basalRecords[i];
      if(durationRecord && durationRecord.type.value === RECORD_TYPES.TEMP_BASAL_DURATION.value) {
        tempBasal = tempBasal.with_duration(struct.extractByte(durationRecord.head,1) * 30 * sundial.MIN_TO_MSEC);
      } else {
        console.log('Records not matching:',record, durationRecord);
        throw new Error('Missing record');
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

  basalRecords.forEach(function(basal) {
    console.log('Basal:',basal.jsDate, common.bytes2hex(basal.head), common.bytes2hex(basal.date));
  });

  for(var i=0; i < basalRecords.length; i++) {
    var record = basalRecords[i];

    var basal;
    var offset = (30*1000*60) * struct.extractByte(record.body,0);
    var rate = struct.extractByte(record.body,1) / cfg.settings.strokesPerUnit;
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

    console.log('prime:',primedatum.jsDate, common.bytes2hex(primedatum.head), common.bytes2hex(primedatum.date), common.bytes2hex(primedatum.body));

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

    console.log('rewind:',rewinddatum.jsDate, common.bytes2hex(rewinddatum.head), common.bytes2hex(rewinddatum.date), common.bytes2hex(rewinddatum.body));

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

  for(var i=0; i < timeChangeRecords.length; i++) {
    var fromDatum = timeChangeRecords[i];

    console.log('time change from :',fromDatum.jsDate);

    i += 1; // advance to next record for duration
    var toDatum = timeChangeRecords[i];

    if(toDatum) {
      console.log('time change to :',toDatum.jsDate);

      /* We need to filter out spurious time changes that appear in the data when
         the battery is left out for too long. The strategy is to filter out any
         time change to a date where the year is less than the current year
         minus one. This is the same strategy used in the CareLink driver. */
      if (fromDatum.jsDate.getUTCFullYear() < (new Date().getUTCFullYear() - 1)) {
        console.log('Excluding time change to', toDatum.jsDate.toISOString().slice(0,-5), 'as spurious.');
        continue;
      }

      var timeChange = cfg.builder.makeDeviceEventTimeChange()
        .with_change({
          from: sundial.formatDeviceTime(fromDatum.jsDate),
          to: sundial.formatDeviceTime(toDatum.jsDate),
          agent: 'manual'
        })
        .with_deviceTime(sundial.formatDeviceTime(toDatum.jsDate))
        .set('jsDate', toDatum.jsDate)
        .set('index', toDatum.index);
      postrecords.push(timeChange);
    } else {
      console.log('Records not matching:',fromDatum, toDatum);
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

    console.log('alarm:',alarmdatum.jsDate, common.bytes2hex(alarmdatum.head), common.bytes2hex(alarmdatum.date), common.bytes2hex(alarmdatum.body));

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
  var isigBytes = new Uint8Array(DEFAULT_PAGE_SIZE * 2 * isigPages.length);
  var cbgBytes = new Uint8Array(DEFAULT_PAGE_SIZE * pages.length);
  var index = 0;

  // first we move the pages into continuous byte streams,
  // as the streams are easier to match up than pages
  var offset = 0;
  for(var i = 0; i < isigPages.length; i++) {
    console.log('ISIG page',i,common.bytes2hex(isigPages[i]));
    isigBytes.set(struct.extractBytes(isigPages[i],0,DEFAULT_PAGE_SIZE * 2),offset);
    offset += (DEFAULT_PAGE_SIZE * 2);
  };

  offset = 0;
  for(var i = 0; i < pages.length; i++) {
    console.log('CBG page',i,common.bytes2hex(pages[i]));
    cbgBytes.set(struct.extractBytes(pages[i],0,DEFAULT_PAGE_SIZE),offset);
    offset += DEFAULT_PAGE_SIZE;
  };

  while (index < cbgBytes.length) {
    var record = { body: [], descriptor: [] };
    var found = false;

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
        console.log('Reached end of CBG data');
        break;
      }

      if(_.isEqual(record.descriptor.slice(record.descriptor.length - 8), [0,0,0,0,0,0,0,0])) {
        // even if we didn't reach DATA_END, if we hit a stream of zeroes
        // we remove the zeroes and end processing
        record.descriptor = _.dropRight(record.descriptor, 8);
        record.body = _.dropRight(record.body, 4);
        break;
      }

      index += 1;
    }

    record.head = record.body.pop();
    record.type = getType(record.head,CBG_RECORD_TYPES);

    if(record.head == null || record.type.value === CBG_RECORD_TYPES.DATA_END.value) {
      console.log('End of CBG pages.');
      break;
    }

    record.date = record.body.splice(record.body.length - DATE_LENGTH);
    record.jsDate = decodeDate(record.date);

    if(record.type === 'unknown') {
      console.log('Unknown type or corrupt CBG record starting with: ' + common.bytes2hex([record.head]));
      console.log('Discarding records and starting from next page');
      records = [];
      numRecords = 0;
      break;
    }

    record.index = numRecords;
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
    var page = pages[i];
    console.log('Page',i,common.bytes2hex(page));
    var index = 0;
    while(index < MAX_PAGE_SIZE-2) { // last two bytes are check bytes
      var record = {};
      record.head = struct.extractBytes(page,index,2);
      if(record.head[0] === 0) {
        console.log('End of page.');
        break;
      }
      record.type = getType(record.head[0],RECORD_TYPES);
      if(data.settings.larger) {
        record.type = _.assign(record.type,record.type.larger);
      }
      if(record.type.value === RECORD_TYPES.UNKNOWN_55.value) {
        record.type.body_length = (record.head[1] - 1) * 3;
      }
      if(record.type.value === RECORD_TYPES.UNABSORBED_INSULIN.value) {
        // IOB record has variable head length
        record.type.head_length = record.head[1];
      }
      if(record.type.value === RECORD_TYPES.UNKNOWN_50.value &&
          (data.settings.modelNumber === '523' || data.settings.modelNumber === '723')) {
            record.type.body_length = 30;
      }
      if(record.type === 'unknown') {
        console.log('Unknown type or corrupt record starting with: ' + common.bytes2hex([record.head[0]]));
        console.log('Discarding records and starting from next page');
        records = [];
        numRecords = 0;
        break;
      }
      delete record.type.larger;
      _.defaults(record.type, { head_length : 2, date_length : 5, body_length : 0 });

      record.head = struct.extractBytes(page, index,record.type.head_length);
      index += record.type.head_length;

      record.date = struct.extractBytes(page, index, record.type.date_length);
      index += record.type.date_length;

      record.body = struct.extractBytes(page, index, record.type.body_length);
      index += record.type.body_length;

      record.jsDate = decodeDate(record.date);
      console.log(record.jsDate, record.type.name, common.bytes2hex(record.head),common.bytes2hex(record.date),common.bytes2hex(record.body));
      record.index = numRecords;
      if(record.jsDate && record.jsDate.valueOf() !== RESET_DATE.valueOf()) {
        records.push(record);
      } else {
        console.log('Dropping event with incorrect date');
      }

      numRecords += 1;
    }
  }

  return callback(null,records);

};

module.exports.init = init;
module.exports.updateConfig = updateConfig;
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
