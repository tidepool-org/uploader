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
var expect = require('salinity').expect;

var objectBuilder = require('../../lib/objectBuilder.js');

describe('objectBuilder.js', () => {
  var objBuilder = null;
  var REQUIRED = '**REQUIRED**';
  var OPTIONAL = '**OPTIONAL**';
  var bob;

  beforeEach(() => {
    bob = objectBuilder();
  });

  describe('setDefaults', () => {
    test('works', () => {

      var defaults = {deviceId:'123-gg-33-4rrr'};

      bob.setDefaults(defaults);

      var dualBolus = bob.makeDualBolus();

      expect(dualBolus.deviceId).to.equal(defaults.deviceId);

    });
  });

  describe('makeBloodKetone', () => {

    var defaults = {deviceId:'makeBloodKetone'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var bk = bob.makeBloodKetone();

      expect(bk.deviceId).to.equal(defaults.deviceId);
      expect(bk.type).to.equal('bloodKetone');
      expect(bk.time).to.equal(REQUIRED);
      expect(bk.timezoneOffset).to.equal(REQUIRED);
      expect(bk.conversionOffset).to.equal(REQUIRED);
      expect(bk.deviceTime).to.equal(REQUIRED);
      expect(bk.value).to.equal(REQUIRED);
      expect(bk.units).to.equal('mmol/L');

      expect(bk.clockDriftOffset).to.equal(OPTIONAL);
      expect(bk.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeCBG', () => {

    var defaults = {deviceId:'makeCBG'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var cbg = bob.makeCBG();

      expect(cbg.deviceId).to.equal(defaults.deviceId);
      expect(cbg.type).to.equal('cbg');
      expect(cbg.time).to.equal(REQUIRED);
      expect(cbg.timezoneOffset).to.equal(REQUIRED);
      expect(cbg.conversionOffset).to.equal(REQUIRED);
      expect(cbg.deviceTime).to.equal(REQUIRED);
      expect(cbg.value).to.equal(REQUIRED);
      expect(cbg.units).to.equal(REQUIRED);

      expect(cbg.clockDriftOffset).to.equal(OPTIONAL);
      expect(cbg.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeCGMSettings', () => {

    var defaults = {deviceId:'makeCGMSettings'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var settings = bob.makeCGMSettings();

      expect(settings.deviceId).to.equal(defaults.deviceId);
      expect(settings.type).to.equal('cgmSettings');
      expect(settings.time).to.equal(REQUIRED);
      expect(settings.timezoneOffset).to.equal(REQUIRED);
      expect(settings.conversionOffset).to.equal(REQUIRED);
      expect(settings.deviceTime).to.equal(REQUIRED);
      expect(settings.transmitterId).to.equal(REQUIRED);
      expect(settings.units).to.equal(REQUIRED);
      expect(settings.lowAlerts).to.equal(REQUIRED);
      expect(settings.highAlerts).to.equal(REQUIRED);
      expect(settings.rateOfChangeAlerts).to.equal(REQUIRED);

      expect(settings.clockDriftOffset).to.equal(OPTIONAL);
      expect(settings.outOfRangeAlerts).to.equal(OPTIONAL);
      expect(settings.predictiveAlerts).to.equal(OPTIONAL);
      expect(settings.displayUnits).to.equal(OPTIONAL);
      expect(settings.calibrationAlerts).to.equal(OPTIONAL);
      expect(settings.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeDeviceEventAlarm', () => {

    var defaults = {deviceId:'makeDeviceEventAlarm'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var alarm = bob.makeDeviceEventAlarm();

      expect(alarm.deviceId).to.equal(defaults.deviceId);
      expect(alarm.type).to.equal('deviceEvent');
      expect(alarm.subType).to.equal('alarm');
      expect(alarm.time).to.equal(REQUIRED);
      expect(alarm.timezoneOffset).to.equal(REQUIRED);
      expect(alarm.conversionOffset).to.equal(REQUIRED);
      expect(alarm.deviceTime).to.equal(REQUIRED);
      expect(alarm.alarmType).to.equal(REQUIRED);

      expect(alarm.clockDriftOffset).to.equal(OPTIONAL);
      expect(alarm.status).to.equal(OPTIONAL);
      expect(alarm.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeDeviceEventCalibration', () => {

    var defaults = {deviceId:'makeDeviceEventCalibration'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var cal = bob.makeDeviceEventCalibration();

      expect(cal.deviceId).to.equal(defaults.deviceId);
      expect(cal.type).to.equal('deviceEvent');
      expect(cal.subType).to.equal('calibration');
      expect(cal.time).to.equal(REQUIRED);
      expect(cal.timezoneOffset).to.equal(REQUIRED);
      expect(cal.conversionOffset).to.equal(REQUIRED);
      expect(cal.deviceTime).to.equal(REQUIRED);
      expect(cal.value).to.equal(REQUIRED);
      expect(cal.units).to.equal(REQUIRED);

      expect(cal.clockDriftOffset).to.equal(OPTIONAL);
      expect(cal.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeDeviceEventReservoirChange', () => {

    var defaults = {deviceId:'makeDeviceEventReservoirChange'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var reschange = bob.makeDeviceEventReservoirChange();

      expect(reschange.deviceId).to.equal(defaults.deviceId);
      expect(reschange.type).to.equal('deviceEvent');
      expect(reschange.subType).to.equal('reservoirChange');
      expect(reschange.time).to.equal(REQUIRED);
      expect(reschange.timezoneOffset).to.equal(REQUIRED);
      expect(reschange.conversionOffset).to.equal(REQUIRED);
      expect(reschange.deviceTime).to.equal(REQUIRED);

      expect(reschange.clockDriftOffset).to.equal(OPTIONAL);
      expect(reschange.status).to.equal(OPTIONAL);
      expect(reschange.payload).to.equal(OPTIONAL);
    });
  });

  describe('makedeviceEventResume', () => {

    var defaults = {deviceId:'makeDeviceEventResume'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var resumeMeta = bob.makeDeviceEventResume();

      expect(resumeMeta.deviceId).to.equal(defaults.deviceId);
      expect(resumeMeta.type).to.equal('deviceEvent');
      expect(resumeMeta.subType).to.equal('status');
      expect(resumeMeta.time).to.equal(REQUIRED);
      expect(resumeMeta.timezoneOffset).to.equal(REQUIRED);
      expect(resumeMeta.conversionOffset).to.equal(REQUIRED);
      expect(resumeMeta.deviceTime).to.equal(REQUIRED);
      expect(resumeMeta.status).to.equal('resumed');
      expect(resumeMeta.reason).to.equal(REQUIRED);

      expect(resumeMeta.clockDriftOffset).to.equal(OPTIONAL);
      expect(resumeMeta.payload).to.equal(OPTIONAL);
    });
  });

  describe('makedeviceEventSuspend', () => {

    var defaults = {deviceId:'makeDeviceEventSuspend'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var suspendMeta = bob.makeDeviceEventSuspend();

      expect(suspendMeta.deviceId).to.equal(defaults.deviceId);
      expect(suspendMeta.type).to.equal('deviceEvent');
      expect(suspendMeta.subType).to.equal('status');
      expect(suspendMeta.time).to.equal(REQUIRED);
      expect(suspendMeta.timezoneOffset).to.equal(REQUIRED);
      expect(suspendMeta.conversionOffset).to.equal(REQUIRED);
      expect(suspendMeta.deviceTime).to.equal(REQUIRED);
      expect(suspendMeta.status).to.equal('suspended');
      expect(suspendMeta.reason).to.equal(REQUIRED);

      expect(suspendMeta.clockDriftOffset).to.equal(OPTIONAL);
      expect(suspendMeta.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeDeviceEventTimeChange', () => {

    var defaults = {deviceId:'makeDeviceEventTimeChange'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var timechange = bob.makeDeviceEventTimeChange();

      expect(timechange.deviceId).to.equal(defaults.deviceId);
      expect(timechange.type).to.equal('deviceEvent');
      expect(timechange.subType).to.equal('timeChange');
      expect(timechange.time).to.equal(REQUIRED);
      expect(timechange.timezoneOffset).to.equal(REQUIRED);
      expect(timechange.conversionOffset).to.equal(REQUIRED);
      expect(timechange.deviceTime).to.equal(REQUIRED);
      expect(timechange.change).to.equal(REQUIRED);

      expect(timechange.clockDriftOffset).to.equal(OPTIONAL);
      expect(timechange.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeDualBolus', () => {

    var defaults = {deviceId:'makeDualBolus'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var dualBolus = bob.makeDualBolus();

      expect(dualBolus.deviceId).to.equal(defaults.deviceId);
      expect(dualBolus.type).to.equal('bolus');
      expect(dualBolus.subType).to.equal('dual/square');
      expect(dualBolus.time).to.equal(REQUIRED);
      expect(dualBolus.timezoneOffset).to.equal(REQUIRED);
      expect(dualBolus.conversionOffset).to.equal(REQUIRED);
      expect(dualBolus.deviceTime).to.equal(REQUIRED);
      expect(dualBolus.normal).to.equal(REQUIRED);
      expect(dualBolus.extended).to.equal(REQUIRED);
      expect(dualBolus.duration).to.equal(REQUIRED);

      expect(dualBolus.clockDriftOffset).to.equal(OPTIONAL);
      expect(dualBolus.payload).to.equal(OPTIONAL);
      expect(dualBolus.expectedNormal).to.equal(OPTIONAL);
      expect(dualBolus.expectedExtended).to.equal(OPTIONAL);
      expect(dualBolus.expectedDuration).to.equal(OPTIONAL);
    });
  });

  describe('makeFood', () => {

    var defaults = {deviceId:'makeFood'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var food = bob.makeFood();

      expect(food.deviceId).to.equal(defaults.deviceId);
      expect(food.type).to.equal('food');
      expect(food.time).to.equal(REQUIRED);
      expect(food.timezoneOffset).to.equal(REQUIRED);
      expect(food.conversionOffset).to.equal(REQUIRED);
      expect(food.deviceTime).to.equal(REQUIRED);
      expect(food.amount).to.equal(OPTIONAL);
      expect(food.brand).to.equal(OPTIONAL);
      expect(food.code).to.equal(OPTIONAL);
      expect(food.ingredients).to.equal(OPTIONAL);
      expect(food.meal).to.equal(OPTIONAL);
      expect(food.mealOther).to.equal(OPTIONAL);
      expect(food.name).to.equal(OPTIONAL);
      expect(food.nutrition).to.equal(OPTIONAL);

      expect(food.clockDriftOffset).to.equal(OPTIONAL);
      expect(food.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeInsulin', () => {

    var defaults = {deviceId:'makeInsulin'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var insulin = bob.makeInsulin();

      expect(insulin.deviceId).to.equal(defaults.deviceId);
      expect(insulin.type).to.equal('insulin');
      expect(insulin.time).to.equal(REQUIRED);
      expect(insulin.timezoneOffset).to.equal(REQUIRED);
      expect(insulin.conversionOffset).to.equal(REQUIRED);
      expect(insulin.deviceTime).to.equal(REQUIRED);
      expect(insulin.dose).to.equal(OPTIONAL);
      expect(insulin.formulation).to.equal(OPTIONAL);
      expect(insulin.site).to.equal(OPTIONAL);

      expect(insulin.clockDriftOffset).to.equal(OPTIONAL);
      expect(insulin.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeReportedState', () => {

    var defaults = {deviceId:'reportedState'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var state = bob.makeReportedState();

      expect(state.deviceId).to.equal(defaults.deviceId);
      expect(state.type).to.equal('reportedState');
      expect(state.time).to.equal(REQUIRED);
      expect(state.timezoneOffset).to.equal(REQUIRED);
      expect(state.conversionOffset).to.equal(REQUIRED);
      expect(state.deviceTime).to.equal(REQUIRED);
      expect(state.states).to.deep.equal([]);

      expect(state.clockDriftOffset).to.equal(OPTIONAL);
      expect(state.payload).to.equal(OPTIONAL);
    });
  });

  describe('makePhysicalActivity', () => {

    var defaults = {deviceId:'physicalActivity'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var state = bob.makePhysicalActivity();

      expect(state.deviceId).to.equal(defaults.deviceId);
      expect(state.type).to.equal('physicalActivity');
      expect(state.time).to.equal(REQUIRED);
      expect(state.timezoneOffset).to.equal(REQUIRED);
      expect(state.conversionOffset).to.equal(REQUIRED);
      expect(state.deviceTime).to.equal(REQUIRED);

      expect(state.activityType).to.equal(OPTIONAL);
      expect(state.activityTypeOther).to.equal(OPTIONAL);
      expect(state.aggregate).to.equal(OPTIONAL);
      expect(state.distance).to.equal(OPTIONAL);
      expect(state.duration).to.equal(OPTIONAL);
      expect(state.elevationChange).to.equal(OPTIONAL);
      expect(state.energy).to.equal(OPTIONAL);
      expect(state.flight).to.equal(OPTIONAL);
      expect(state.lap).to.equal(OPTIONAL);
      expect(state.name).to.equal(OPTIONAL);
      expect(state.reportedIntensity).to.equal(OPTIONAL);
      expect(state.step).to.equal(OPTIONAL);

      expect(state.clockDriftOffset).to.equal(OPTIONAL);
      expect(state.payload).to.equal(OPTIONAL);
    });
  });


  describe('makeNormalBolus', () => {

    var defaults = {deviceId:'makeNormalBolus'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var normal = bob.makeNormalBolus();

      expect(normal.deviceId).to.equal(defaults.deviceId);
      expect(normal.type).to.equal('bolus');
      expect(normal.subType).to.equal('normal');
      expect(normal.time).to.equal(REQUIRED);
      expect(normal.timezoneOffset).to.equal(REQUIRED);
      expect(normal.conversionOffset).to.equal(REQUIRED);
      expect(normal.deviceTime).to.equal(REQUIRED);
      expect(normal.normal).to.equal(REQUIRED);

      expect(normal.clockDriftOffset).to.equal(OPTIONAL);
      expect(normal.payload).to.equal(OPTIONAL);
      expect(normal.expectedNormal).to.equal(OPTIONAL);
    });
  });

  describe('makeNote', () => {

    var defaults = {deviceId:'makeNormalBolus'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var note = bob.makeNote();

      expect(note.deviceId).to.equal(defaults.deviceId);
      expect(note.type).to.equal('note');
      expect(note.time).to.equal(REQUIRED);
      expect(note.timezoneOffset).to.equal(REQUIRED);
      expect(note.conversionOffset).to.equal(REQUIRED);
      expect(note.deviceTime).to.equal(REQUIRED);
      expect(note.value).to.equal(REQUIRED);

      expect(note.clockDriftOffset).to.equal(OPTIONAL);
      expect(note.payload).to.equal(OPTIONAL);
    });
  });

  describe('makePumpSettings', () => {

    var defaults = {deviceId:'makePumpSettings'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var settings = bob.makePumpSettings();

      expect(settings.deviceId).to.equal(defaults.deviceId);
      expect(settings.type).to.equal('pumpSettings');
      expect(settings.time).to.equal(REQUIRED);
      expect(settings.timezoneOffset).to.equal(REQUIRED);
      expect(settings.conversionOffset).to.equal(REQUIRED);
      expect(settings.deviceTime).to.equal(REQUIRED);
      expect(settings.activeSchedule).to.equal(REQUIRED);
      expect(settings.units).to.equal(REQUIRED);
      expect(settings.basalSchedules).to.deep.equal({});
      expect(settings.carbRatio).to.deep.equal([]);
      expect(settings.insulinSensitivity).to.deep.equal([]);
      expect(settings.bgTarget).to.deep.equal([]);

      expect(settings.clockDriftOffset).to.equal(OPTIONAL);
      expect(settings.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeScheduledBasal', () => {

    var defaults = {deviceId:'makeScheduledBasal'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var schedBasal = bob.makeScheduledBasal();

      expect(schedBasal.deviceId).to.equal(defaults.deviceId);
      expect(schedBasal.deliveryType).to.equal('scheduled');
      expect(schedBasal.type).to.equal('basal');
      expect(schedBasal.time).to.equal(REQUIRED);
      expect(schedBasal.timezoneOffset).to.equal(REQUIRED);
      expect(schedBasal.conversionOffset).to.equal(REQUIRED);
      expect(schedBasal.deviceTime).to.equal(REQUIRED);
      expect(schedBasal.duration).to.equal(REQUIRED);

      expect(schedBasal.scheduleName).to.equal(OPTIONAL);
      expect(schedBasal.clockDriftOffset).to.equal(OPTIONAL);
      expect(schedBasal.payload).to.equal(OPTIONAL);
      expect(schedBasal.expectedDuration).to.equal(OPTIONAL);
    });
  });

  describe('makeSMBG', () => {

    var defaults = {deviceId:'makeSMBG'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var smbg = bob.makeSMBG();

      expect(smbg.deviceId).to.equal(defaults.deviceId);
      expect(smbg.type).to.equal('smbg');
      expect(smbg.time).to.equal(REQUIRED);
      expect(smbg.timezoneOffset).to.equal(REQUIRED);
      expect(smbg.conversionOffset).to.equal(REQUIRED);
      expect(smbg.deviceTime).to.equal(REQUIRED);
      expect(smbg.value).to.equal(REQUIRED);
      expect(smbg.units).to.equal(REQUIRED);

      expect(smbg.clockDriftOffset).to.equal(OPTIONAL);
      expect(smbg.subType).to.equal(OPTIONAL);
      expect(smbg.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeSquareBolus', () => {

    var defaults = {deviceId:'makeSquareBolus'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var square = bob.makeSquareBolus();


      expect(square.deviceId).to.equal(defaults.deviceId);
      expect(square.type).to.equal('bolus');
      expect(square.subType).to.equal('square');
      expect(square.time).to.equal(REQUIRED);
      expect(square.timezoneOffset).to.equal(REQUIRED);
      expect(square.conversionOffset).to.equal(REQUIRED);
      expect(square.deviceTime).to.equal(REQUIRED);
      expect(square.extended).to.equal(REQUIRED);
      expect(square.duration).to.equal(REQUIRED);

      expect(square.clockDriftOffset).to.equal(OPTIONAL);
      expect(square.payload).to.equal(OPTIONAL);
      expect(square.expectedExtended).to.equal(OPTIONAL);
      expect(square.expectedDuration).to.equal(OPTIONAL);
    });
  });

  describe('makeSuspendBasal', () => {

    var defaults = {deviceId:'makeSuspendBasal'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var suspendBasal = bob.makeSuspendBasal();

      expect(suspendBasal.deviceId).to.equal(defaults.deviceId);
      expect(suspendBasal.deliveryType).to.equal('suspend');
      expect(suspendBasal.type).to.equal('basal');
      expect(suspendBasal.time).to.equal(REQUIRED);
      expect(suspendBasal.timezoneOffset).to.equal(REQUIRED);
      expect(suspendBasal.conversionOffset).to.equal(REQUIRED);
      expect(suspendBasal.deviceTime).to.equal(REQUIRED);

      expect(suspendBasal.clockDriftOffset).to.equal(OPTIONAL);
      expect(suspendBasal.duration).to.equal(OPTIONAL);
      expect(suspendBasal.suppressed).to.equal(OPTIONAL);
      expect(suspendBasal.payload).to.equal(OPTIONAL);
      expect(suspendBasal.expectedDuration).to.equal(OPTIONAL);
    });
  });

  describe('makeTempBasal', () => {

    var defaults = {deviceId:'makeTempBasal'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var temp = bob.makeTempBasal();

      expect(temp.deviceId).to.equal(defaults.deviceId);
      expect(temp.type).to.equal('basal');
      expect(temp.deliveryType).to.equal('temp');
      expect(temp.time).to.equal(REQUIRED);
      expect(temp.timezoneOffset).to.equal(REQUIRED);
      expect(temp.conversionOffset).to.equal(REQUIRED);
      expect(temp.deviceTime).to.equal(REQUIRED);
      expect(temp.duration).to.equal(REQUIRED);

      expect(temp.clockDriftOffset).to.equal(OPTIONAL);
      expect(temp.rate).to.equal(OPTIONAL);
      expect(temp.percent).to.equal(OPTIONAL);
      expect(temp.suppressed).to.equal(OPTIONAL);
      expect(temp.payload).to.equal(OPTIONAL);
      expect(temp.expectedDuration).to.equal(OPTIONAL);
    });
  });

  describe('makeWizard', () => {

    var defaults = {deviceId:'makeWizard'};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var wiz = bob.makeWizard();

      expect(wiz.deviceId).to.equal(defaults.deviceId);
      expect(wiz.type).to.equal('wizard');
      expect(wiz.time).to.equal(REQUIRED);
      expect(wiz.timezoneOffset).to.equal(REQUIRED);
      expect(wiz.conversionOffset).to.equal(REQUIRED);
      expect(wiz.deviceTime).to.equal(REQUIRED);
      expect(wiz.insulinOnBoard).to.equal(OPTIONAL);
      expect(wiz.insulinSensitivity).to.equal(OPTIONAL);
      expect(wiz.bgTarget).to.equal(OPTIONAL);
      expect(wiz.bolus).to.equal(REQUIRED);
      expect(wiz.recommended).to.equal(OPTIONAL);
      expect(wiz.units).to.equal(REQUIRED);

      expect(wiz.clockDriftOffset).to.equal(OPTIONAL);
      expect(wiz.bgInput).to.equal(OPTIONAL);
      expect(wiz.carbInput).to.equal(OPTIONAL);
      expect(wiz.insulinCarbRatio).to.equal(OPTIONAL);
      expect(wiz.payload).to.equal(OPTIONAL);
    });
  });

  describe('makeUpload', () => {

    var defaults = {};

    beforeEach(() => {
      bob = objectBuilder();
      bob.setDefaults(defaults);
    });

    test('works', () => {
      var upload = bob.makeUpload();


      expect(upload.deviceId).to.equal(OPTIONAL);
      expect(upload.type).to.equal('upload');
      expect(upload.time).to.equal(REQUIRED);
      expect(upload.timezoneOffset).to.equal(REQUIRED);
      expect(upload.conversionOffset).to.equal(REQUIRED);
      expect(upload.computerTime).to.equal(REQUIRED);
      expect(upload.timezone).to.equal(REQUIRED);
      expect(upload.timeProcessing).to.equal(REQUIRED);
      expect(upload.version).to.equal(REQUIRED);
      expect(upload.timezone).to.equal(REQUIRED);
      expect(upload.guid).to.equal(OPTIONAL);
      expect(upload.uploadId).to.equal(OPTIONAL);
      expect(upload.byUser).to.equal(OPTIONAL);
      expect(upload.deviceTags).to.equal(REQUIRED);
      expect(upload.deviceManufacturers).to.equal(REQUIRED);
      expect(upload.deviceModel).to.equal(REQUIRED);
      expect(upload.deviceSerialNumber).to.equal(OPTIONAL);

      expect(upload.payload).to.equal(OPTIONAL);
    });
  });

});
