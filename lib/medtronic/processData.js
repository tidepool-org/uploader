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
  UNKNOWN_50: { value:0x50, body_length:30, name:'UNKNOWN_50'}, //TODO: body_length 34 on model 530
  UNKNOWN_51: { value:0x51, name:'UNKNOWN_51'},
  UNKNOWN_52: { value:0x52, name:'UNKNOWN_52'},
  UNKNOWN_53: { value:0x53, body_length:1, name:'UNKNOWN_53'},
  UNKNOWN_54: { value:0x54, body_length:3, name:'UNKNOWN_54'},
  UNKNOWN_55: { value:0x55, name: 'UNKNOWN_55'}, //TODO: figure out body_length
  UNKNOWN_56: { value:0x56, body_length:5, name: 'UNKNOWN_56'},
  UNKNOWN_57: { value:0x57, name:'UNKNOWN_57'},
  BOLUS_WIZARD_CHANGE_OLD: { value:0x5A, body_length:117, larger:{ body_length:137 }, name:'BOLUS_WIZARD_CHANGE_OLD'},
  BOLUS_WIZARD_CHANGE_BIG: { value:0x5A, body_length:143, name:'BOLUS_WIZARD_CHANGE_BIG'},
  BOLUS_WIZARD: { value:0x5B, body_length:13, larger:{body_length:15}, name:'BOLUS_WIZARD'},
  UNABSORBED_INSULIN: { value:0x5C, date_length:0, name:'UNABSORBED_INSULIN'},
  UNKNOWN_5E: { value:0x5E, name:'UNKNOWN_5E'},
  CHANGE_AUDIO_BOLUS: { value:0x5F, name:'CHANGE_AUDIO_BOLUS'},
  CHANGE_BG_REMINDER_ENABLE: { value:0x60, name:'CHANGE_BG_REMINDER_ENABLE'},
  UNKNOWN_61: { value:0x61, name:'UNKNOWN_61'},
  CHANGE_TEMP_BASAL_TYPE: { value:0x62, name:'CHANGE_TEMP_BASAL_TYPE'},
  CHANGE_ALARM_NOTIFY_MODE: { value:0x63, body_length:0, name:'CHANGE_ALARM_NOTIFY_MODE'},
  CHANGE_TIME_DISPLAY: { value:0x64, name:'CHANGE_TIME_DISPLAY'},
  UNKNOWN_65: { value:0x65, name:'UNKNOWN_65'},
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

var BITMASKS = {
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

var decodeDate = function (payload) {
 if(payload.length < 5) {
   console.log('Skipping short dates for now');
   return false;
 }
 var encoded = struct.unpack(payload,0,'bbbbb',['second','minute','hour','day','year']);
 var second = encoded.second & BITMASKS.RIGHT_SIX;
 var minute = encoded.minute & BITMASKS.RIGHT_SIX;
 var hour = encoded.hour & BITMASKS.RIGHT_FIVE;
 var day = encoded.day & BITMASKS.RIGHT_FIVE;
 var month = (((encoded.second & BITMASKS.LEFT_TWO) >> 4) | ((encoded.minute & BITMASKS.LEFT_TWO) >> 6));

 var year = (encoded.year & BITMASKS.RIGHT_SEVEN) + 2000;
 if(year === 2000) {
   // Incorrect date
   return false;
 }
 var date = sundial.buildTimestamp({year:year,month:month,day:day,hours:hour,minutes:minute,seconds:second});
 return date;
};

var getType = function (idx) {
  for (var i in RECORD_TYPES) {
    if (RECORD_TYPES[i].value === idx) {
      return RECORD_TYPES[i];
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

var twosComplement = function (value) {
  if((value & 128) != 0 ) { // check if highest bit is set
    value = value - 256; // use two complement to get negative value
  }
  return value;
};

var buildWizardRecords = function (records) {
  var wizardRecords = filterHistory([RECORD_TYPES.BOLUS_WIZARD], records);
  var postrecords = [];
  wizardRecords.forEach(function(record) {
    console.log('Wizard:', record.jsDate, common.bytes2hex(record.date), common.bytes2hex(record.body));

    var carbInput, bgInput, carbRatio, bgTarget = {}, isf, recommended = {}, iob;
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

      if((struct.extractByte(record.body,9) & BITMASKS.LEFT_00111) > 0) {
        recommended.correction = twosComplement(struct.extractByte(record.body,6)) / cfg.settings.strokesPerUnit;
      } else {
        recommended.correction = struct.extractByte(record.body,6) / cfg.settings.strokesPerUnit;
      }

      recommended.net = struct.extractBEShort(record.body,12) / cfg.settings.strokesPerUnit;
      iob =  struct.extractBEShort(record.body,10) / cfg.settings.strokesPerUnit;
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

      var correctionRaw = [twosComplement(struct.extractByte(record.body,5) & BITMASKS.RIGHT_FOUR)];
      correctionRaw = correctionRaw.concat(twosComplement(struct.extractByte(record.body,7)));
      recommended.correction = struct.extractBEShort(correctionRaw,0) / cfg.settings.strokesPerUnit;

      recommended.net = struct.extractBEShort(record.body,11) / cfg.settings.strokesPerUnit;
      iob =  struct.extractBEShort(record.body,9) / cfg.settings.strokesPerUnit;
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
      .with_units('mg/dL'); //TODO: see if we can find units

      if (bgInput > 0) {
        var bgRecord = cfg.builder.makeSMBG()
          .with_subType('manual')
          .with_value(bgInput)
          .with_units('mg/dL') //TODO: see if we can find units
          .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
          .set('index',record.index)
          .set('jsDate',record.jsDate);
        cfg.tzoUtil.fillInUTCInfo(bgRecord, record.jsDate);
        bgRecord.done();
        postrecords.push(bgRecord);

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

  var bgRecords = filterHistory([RECORD_TYPES.BG_RECEIVED], records);
  var postrecords = [];

  bgRecords.forEach(function (bgEntry) {

    console.log('smbg:',bgEntry.jsDate, common.bytes2hex(bgEntry.head), common.bytes2hex(bgEntry.date), common.bytes2hex(bgEntry.body));

    var bg = (struct.extractByte(bgEntry.head,1) << 3) + (struct.extractByte(bgEntry.date,2) >> 5);
    var meter = common.bytes2hex(struct.extractBytes(bgEntry.body, 0, 3), true);

    // Note: Bayer does not send control solution readings to the pump

    var bgRecord = cfg.builder.makeSMBG()
      .with_deviceTime(sundial.formatDeviceTime(bgEntry.jsDate))
      .with_subType('linked')
      .with_value(bg)
      .with_units('mg/dL')  // TODO: check if values from meters are always in mg/dL
      .set('index',bgEntry.index)
      .with_payload({
        meterSerial: meter
      });
    cfg.tzoUtil.fillInUTCInfo(bgRecord, bgEntry.jsDate);
    bgRecord.done();
    postrecords.push(bgRecord);
  });
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
        .with_reason({suspended: 'manual', resumed: 'manual'}) // TODO: get reason
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

function getCarbRatios(encoded) {
  var carbRatios = [];
  for(var j = 0; j < 8; j++ ) {
    var carbRatio = struct.unpack(encoded,(j*3)+2,'bS',['offset', 'ratio']);
    if (carbRatio.offset === 0 && carbRatio.ratio === 0) {
      break;
    }
    var startTime = carbRatio.offset * 30 * sundial.MIN_TO_MSEC;
    carbRatios.push( { start: startTime, amount: carbRatio.ratio / 10.0 } );
  };

  return carbRatios;
}

function getBGTargets(encoded) {
  var bgTargets = [];
  for(var j = 0; j < 8; j++ ) {
    var bgTarget = struct.unpack(encoded,(j*3)+1,'bbb',['offset', 'low','high']);
    if (bgTarget.offset === 0 && bgTarget.low === 0 && bgTarget.high === 0) {
      break;
    }
    var startTime = bgTarget.offset * 30 * sundial.MIN_TO_MSEC;
    bgTargets.push( { start: startTime, low: bgTarget.low, high: bgTarget.high} );
  };
  return bgTargets;
}

function getInsulinSensitivities(encoded) {
  var insulinSensitivities = [];
  for(var j = 0; j < 8; j++ ) {
    var sensitivity = struct.unpack(encoded,(j*2)+1,'bb',['offset', 'val']);
    if (sensitivity.offset === 0 && sensitivity.val === 0) {
      break;
    }
    var startTime = (sensitivity.offset & BITMASKS.RIGHT_SIX) * 30 * sundial.MIN_TO_MSEC;
    var amount = sensitivity.val + ((sensitivity.offset & BITMASKS.LEFT_TWO) << 2);
    insulinSensitivities.push( { start: startTime, amount: amount } );
  };
  return insulinSensitivities;
}

function buildSettings(records) {

  var getWizardSettings = function(record) {

    console.log('Wizard first bytes:', common.bytes2hex([record.body[0],record.body[1]]));
    var bgUnits = record.body[0] & 0x04 ? 'mg/dL' : 'mmol/L';
    // TODO: get units from head

    var SIZES = {
      CARB_RATIO :27,
      INSULIN_SENSITIVITY: 16,
      BG_TARGET : 25
    };

    var oldSettings = {};
    var newSettings = {};

    oldSettings.carbRatio = getCarbRatios(record.body);
    var index = SIZES.CARB_RATIO;
    oldSettings.insulinSensitivity = getInsulinSensitivities(struct.extractBytes(record.body, index, SIZES.INSULIN_SENSITIVITY));
    index += SIZES.INSULIN_SENSITIVITY;
    oldSettings.bgTarget = getBGTargets(struct.extractBytes(record.body, index, SIZES.BG_TARGET));
    index += SIZES.BG_TARGET;

    newSettings.carbRatio = getCarbRatios(struct.extractBytes(record.body, index, SIZES.CARB_RATIO));
    index += SIZES.CARB_RATIO;
    newSettings.insulinSensitivity = getInsulinSensitivities(struct.extractBytes(record.body, index,SIZES.INSULIN_SENSITIVITY));
    index += SIZES.INSULIN_SENSITIVITY;
    newSettings.bgTarget = getBGTargets(struct.extractBytes(record.body, index,SIZES.BG_TARGET));

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
  var prevRecord = {};

  // when we record schedule changes, we need to start with the
  // most recent schedules and work our way back
  var settingsChange = {
    basalSchedules : _.clone(cfg.settings.basalSchedules),
    bgTarget : _.clone(cfg.settings.bgTarget),
    insulinSensitivity : _.clone(cfg.settings.insulinSensitivity),
    carbRatio : _.clone(cfg.settings.carbRatio),
    units : _.clone(cfg.settings.units),
    activeSchedule : _.clone(cfg.settings.activeSchedule)
  };
  settingsChanges.push(_.clone(settingsChange));

  changes.forEach(function (settingsEntry) {
    console.log('settings change:',common.getName(RECORD_TYPES,settingsEntry.type.value),settingsEntry.jsDate, common.bytes2hex(settingsEntry.head), common.bytes2hex(settingsEntry.date), common.bytes2hex(settingsEntry.body));
  });

  for(var i=0; i < changes.length; i++) {
    var record = changes[i];

    if(!_.isEmpty(prevRecord) && (record.jsDate.valueOf() !== prevRecord.jsDate.valueOf())) {
      // when the date changes, we push the current
      // schedule we've been building onto the stack

      // use the previous schedule change, not the most recent schedule change
      var settings = _.cloneDeep(settingsChanges[settingsChanges.length-2]);
      var postsettings = cfg.builder.makePumpSettings();
      postsettings.with_units(settings.units)
                  .with_carbRatio(settings.carbRatio)
                  .with_insulinSensitivity(settings.insulinSensitivity)
                  .with_bgTarget(settings.bgTarget)
                  .set('index', prevRecord.index)
                  .with_basalSchedules(settings.basalSchedules)
                  .with_activeSchedule(settings.activeSchedule)
                  .with_deviceTime(sundial.formatDeviceTime(prevRecord.jsDate));
      cfg.tzoUtil.fillInUTCInfo(postsettings, prevRecord.jsDate);
      postrecords.push(postsettings.done());
    }

    prevRecord = _.pick(record, ['index','jsDate']);

    if(record.type.value === RECORD_TYPES.SELECT_BASAL_PROFILE.value ) {
      settingsChange.activeSchedule = PROFILES[record.head[1]];
    };

    if(record.type.value === RECORD_TYPES.BOLUS_WIZARD_CHANGE_OLD.value ) {
      // bolus wizard settings were changed

      var wizardSettings = getWizardSettings(record);
      var currSettings = _.pick(settingsChange,['bgTarget','carbRatio','insulinSensitivity']);

      if(_.isEqual(currSettings,wizardSettings.new)) {
        _.assign(settingsChange, wizardSettings.old);
      } else {
        throw new Error('Could not find bolus wizard settings');
      }
    };

    if(record.type.value === RECORD_TYPES.CHANGE_BASAL_PROFILE_NEW.value) {
      // basal profile was modified and then started automatically

      var profileNum = struct.extractByte(record.date,2) >> 5;
      settingsChange.activeSchedule = PROFILES[profileNum];

      var newSchedule = getSchedule(record);
      i += 1; //advance to next record for old schedule
      record = changes[i];
      if(record && record.type.value === RECORD_TYPES.CHANGE_BASAL_PROFILE_OLD.value) {
        var oldSchedule = getSchedule(record);
      } else {
        throw new Error('Old basal schedule is missing');
      }

      if(_.isEqual(settingsChange.basalSchedules[settingsChange.activeSchedule],newSchedule)) {
        settingsChange.basalSchedules[settingsChange.activeSchedule] = oldSchedule;
      } else {
        throw new Error('Could not find basal schedule');
      }
    }

    settingsChanges.push(_.clone(settingsChange));
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

    basal = cfg.builder.makeScheduledBasal()
      .with_rate(rate)
      .with_deviceTime(sundial.formatDeviceTime(record.jsDate))
      .set('index', record.index);

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

function buildTimeChangeRecords(records, mostRecent) {

  var timeChangeRecords = filterHistory([RECORD_TYPES.CHANGE_TIME, RECORD_TYPES.NEW_TIME_SET], records);
  var postrecords = [];

  for(var i=0; i < timeChangeRecords.length; i++) {
    var fromDatum = timeChangeRecords[i];

    console.log('time change from :',fromDatum.jsDate, common.bytes2hex(fromDatum.head), common.bytes2hex(fromDatum.date), common.bytes2hex(fromDatum.body));

    i += 1; // advance to next record for duration
    var toDatum = timeChangeRecords[i];

    if(toDatum && toDatum.type.value === RECORD_TYPES.NEW_TIME_SET.value) {
      console.log('time change to :',toDatum.jsDate, common.bytes2hex(toDatum.head), common.bytes2hex(toDatum.date), common.bytes2hex(toDatum.body));

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
  cfg.tzoUtil = new TZOUtil(cfg.timezone, mostRecent, postrecords);
  return { postrecords : postrecords, tzoUtil : cfg.tzoUtil };
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
        alarmRecord = alarmRecord.with_alarmType('low_insulin');
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

var processPages = function(data, callback) {

  var records = [];
  var numRecords = 0;
  var pages = data.pages;
  var MAX_PAGE_SIZE = 1024;

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
      record.type = getType(record.head[0]);
      if(record.type.value === RECORD_TYPES.UNKNOWN_55.value) {
        // TODO: calculate body length for 0x55 using body_length = (self.head[1] - 1) * 3
        throw new Error('Not supporting type 0x55 yet:', common.bytes2hex(record.head));
      }
      if(record.type.value === RECORD_TYPES.UNABSORBED_INSULIN.value) {
        // IOB record has variable head length
        record.type.head_length = record.head[1];
      }
      if(record.type === 'unknown') {
        throw new Error('Unknown type: ' + common.bytes2hex([record.head[0]]));
      }
      if(data.settings.larger) {
        record.type = _.assign(record.type,record.type.larger);
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
      if(record.jsDate) {
        records.push(record);
      } else {
        console.log('Dropping event with incorrect date for now');
      }

      numRecords += 1;
    }
  }

  return callback(null,records);

};

module.exports.init = init;
module.exports.processPages = processPages;
module.exports.buildBasalRecords = buildBasalRecords;
module.exports.buildTempBasalRecords = buildTempBasalRecords;
module.exports.buildBolusRecords = buildBolusRecords;
module.exports.buildWizardRecords = buildWizardRecords;
module.exports.buildSuspendResumeRecords = buildSuspendResumeRecords;
module.exports.buildBGRecords = buildBGRecords;
module.exports.buildSettings = buildSettings;
module.exports.buildAlarmRecords = buildAlarmRecords;
module.exports.buildPrimeRecords = buildPrimeRecords;
module.exports.buildRewindRecords = buildRewindRecords;
module.exports.buildTimeChangeRecords = buildTimeChangeRecords;
module.exports.getCarbRatios = getCarbRatios;
module.exports.getBGTargets = getBGTargets;
module.exports.getInsulinSensitivities = getInsulinSensitivities;
module.exports.PROFILES = PROFILES;
