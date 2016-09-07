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

var savedFileEntry, fileDisplayPath;
var debug = (typeof __DEBUG__ === 'undefined') ? false : __DEBUG__;
var isBrowser = typeof window !== 'undefined';

var larger = true; //TODO: this should be based on model number

var RECORD_TYPES = {
  BOLUS: { value: 0x01, head_length: 5, larger: { head_length: 8 }, name: 'BOLUS'},
  PRIME: { value: 0x03, head_length: 5, name: 'PRIME'},
  ALARM_PUMP: { value: 0x06, head_length: 4, name: 'ALARM_PUMP'},
  RESULT_DAILY_TOTAL: { value: 0x07, head_length: 5, date_length: 2, larger: { body_length: 3 }, name: 'RESULT_DAILY_TOTAL' },
  CHANGE_BASAL_PROFILE_OLD: { value: 0x08, body_length:145, name: 'CHANGE_BASAL_PROFILE_OLD'},
  CHANGE_BASAL_PROFILE_NEW: { value: 0X09, body_length:145, name: 'CHANGE_BASAL_PROFILE_NEW'},
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
  UNKNOWN_54: { value:0x54, body_length:57, name:'UNKNOWN_54'},
  UNKNOWN_55: { value:0x55, name: 'UNKNOWN_55'}, //TODO: figure out body_length
  UNKNOWN_56: { value:0x56, body_length:5, name: 'UNKNOWN_56'},
  UNKNOWN_57: { value:0x57, name:'UNKNOWN_57'},
  BOLUS_WIZARD_CHANGE_OLD: { value:0x5A, body_length:117, larger:{ body_length:137 }, name:'BOLUS_WIZARD_CHANGE_OLD'},
  BOLUS_WIZARD_CHANGE_BIG: { value:0x5A, body_length:143, name:'BOLUS_WIZARD_CHANGE_BIG'},
  BOLUS_WIZARD: { value:0x5B, body_length:13, larger:{body_length:15}, name:'BOLUS_WIZARD'},
 UNKNOWN_5C: { value:0x5C, body_length:1, name:'UNKNOWN_5C'},
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

var cfg;

var init = function(config) {
  cfg = _.clone(config);
};

var decodeDate = function (payload) {
 if(payload.length < 5) {
   console.log('Skipping short dates for now');
   return true;
 }
 var encoded = struct.unpack(payload,0,'bbbbb',['second','minute','hour','day','year']);
 var second = encoded.second & 0x3f;
 var minute = encoded.minute & 0x3f;
 var hour = encoded.hour & 0x1f;
 var day = encoded.day & 0x1f;
 var month = (((encoded.second & 0xc0) >> 4) | ((encoded.minute & 0xc0) >> 6));
 var year = (encoded.year & 0x7f)+2000;
 var date = sundial.buildTimestamp({year:year,month:month,day:day,hours:hour,minutes:minute,seconds:second});
 return date;
};

var savePages = function(data) {
  function exportToFileEntry(fileEntry) {
    savedFileEntry = fileEntry;

    // TODO: this should be changed to a link that says "Download blob" instead
    chrome.fileSystem.getDisplayPath(fileEntry, function(path) {
      fileDisplayPath = path;
      console.log('Exporting to '+path);

      fileEntry.createWriter(function(fileWriter) {
        var json = JSON.stringify(data);
        var blob = new Blob([json], {type: 'application/json'});

        fileWriter.onwriteend = function(e) {
          console.log('Export to '+fileDisplayPath+' completed');
        };

        fileWriter.onerror = function(e) {
          console.log('Export failed: '+e.toString());
        };

        fileWriter.write(blob);

      });
    });
  }

  if (savedFileEntry) {
    exportToFileEntry(savedFileEntry);
  } else {
    chrome.fileSystem.chooseEntry( {
      type: 'saveFile',
      suggestedName: 'medtronicPages.json',
      accepts: [ { description: 'Binary files (*.json)',
                   extensions: ['json']} ],
      acceptsAllTypes: true
    }, exportToFileEntry);
  }
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

var buildWizardRecords = function (records) {
  var wizardRecords = filterHistory([RECORD_TYPES.BOLUS_WIZARD], records);
  var postrecords = [];
  wizardRecords.forEach(function(record) {
    console.log('Wizard:', record.jsDate, common.bytes2hex(record.date), common.bytes2hex(record.body));
    var carbInput = struct.extractByte(record.body,0);
    var bgRaw = [struct.extractByte(record.head,1)];
    bgRaw = bgRaw.concat(struct.extractByte(record.body,1) & 0x0f);
    var bgInput = struct.extractShort(bgRaw,0);
    var carbRatio = struct.extractByte(record.body,14) / 10.0;
    var bgTarget = {};
    bgTarget.low = struct.extractByte(record.body,5);
    var isf = struct.extractByte(record.body,4);
    bgTarget.high = struct.extractByte(record.body,3);
    var recommended = {};
    recommended.carb = struct.extractBEShort(record.body,7) / 40.0;
    recommended.correction = struct.extractByte(record.body,6) / 40.0;
    recommended.net = struct.extractBEShort(record.body,12) / 40.0;
    var iob =  struct.extractBEShort(record.body,10) / 40.0;

    var wizard = cfg.builder.makeWizard()
      .with_recommended({
        carb: recommended.carb,
        correction: recommended.correction,
        net: recommended.net
      })
      .with_bgInput(bgInput)
      .with_carbInput(carbInput)
      .with_insulinOnBoard(iob)
      .with_insulinCarbRatio(carbRatio)
      .with_insulinSensitivity(isf)
      .with_bgTarget({
        low: bgTarget.low,
        high: bgTarget.high
      })
      .with_units('mg/dL'); //TODO: see if we can find units

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

    if (larger) {
      var duration = record.head[7] * 30 * sundial.MIN_TO_MSEC;
      var amount = struct.extractBEShort(record.head,3)/40.0;
      var programmed = struct.extractBEShort(record.head,1)/40.0;
      var iob = struct.extractBEShort(record.head,5)/40.0;
      if (duration > 0) {
        //TODO: put iob in payload?

        if((record.date[2] & 0xC0) == 0x80) {
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
            amount = struct.extractBEShort(record.head,3)/40.0;
            programmed = struct.extractBEShort(record.head,1)/40.0;
            iob = struct.extractBEShort(record.head,5)/40.0;

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

    } else {
      // TODO: handle smaller bolus records
    }

  };

  return postrecords;
};

var processPages = function(data, callback) {

  var records = [];
  var numRecords = 0;
  var pages = data.pages;

  if(debug && isBrowser) {
    savePages(pages);
  }

  for(var i = 0; i < pages.length; i++) {
    var page = pages[i];
    console.log('Page',i,common.bytes2hex(page));
    var index = 0;
    while(index < 1024) {
      var record = {};
      record.head = struct.extractBytes(page,index,2);
      if(record.head[0] === 0) {
        console.log('End of page.');
        break;
      }
      record.type = getType(record.head[0]);
      if(record.type.value === 0x55) {
        throw new Error('Not supporting type 0x55 yet:', common.bytes2hex(record.head));
      }
      if(record.type === 'unknown') {
        throw new Error('Unknown type: ' + common.bytes2hex([record.head[0]]));
      }
      if(larger) {
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
      console.log(record.jsDate, record.type.name, common.bytes2hex(record.head),',',common.bytes2hex(record.date),',',common.bytes2hex(record.body));
      //TODO: fix index numbers: pages are reverse chronological, but records in each page are chronological
      record.index = numRecords;
      records.push(record);
      numRecords += 1;
    }
  }

  return callback(null,records);

};

module.exports.init = init;
module.exports.processPages = processPages;
module.exports.buildBolusRecords = buildBolusRecords;
module.exports.buildWizardRecords = buildWizardRecords;
