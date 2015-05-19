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

/* global beforeEach, describe, it */

var _ = require('lodash');
var expect = require('salinity').expect;

var ObjectBuilder = require('../lib/objectBuilder.js');

describe('objectBuilder.js', function(){
  var objBuilder = null;
  var REQUIRED = '**REQUIRED**';
  var OPTIONAL = '**OPTIONAL**';
  var bob;

  beforeEach(function(){
    bob = ObjectBuilder();
  });

  describe('setDefaults', function(){
    it('works', function(){

      var defaults = {deviceId:'123-gg-33-4rrr'};

      bob.setDefaults(defaults);

      var dualBolus = bob.makeDualBolus();

      expect(dualBolus.deviceId).to.equal(defaults.deviceId);

    });
  });

  describe('makeCBG', function(){

    var defaults = {deviceId:'makeCBG'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var cbg = bob.makeCBG();

      expect(cbg.deviceId).to.equal(defaults.deviceId);
      expect(cbg.time).to.equal(REQUIRED);
      expect(cbg.deviceTime).to.equal(OPTIONAL);
      expect(cbg.value).to.equal(REQUIRED);

    });
  });

  describe('makeDualBolus', function(){

    var defaults = {deviceId:'makeDualBolus'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var dualBolus = bob.makeDualBolus();

      expect(dualBolus.deviceId).to.equal(defaults.deviceId);
      expect(dualBolus.type).to.equal('bolus');
      expect(dualBolus.subType).to.equal('dual/square');
      expect(dualBolus.deviceTime).to.equal(OPTIONAL);
      expect(dualBolus.time).to.equal(REQUIRED);
      expect(dualBolus.normal).to.equal(REQUIRED);
      expect(dualBolus.extended).to.equal(REQUIRED);
      expect(dualBolus.duration).to.equal(REQUIRED);

    });
  });

  describe('makeFood', function(){

    var defaults = {deviceId:'makeFood'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var food = bob.makeFood();

      expect(food.deviceId).to.equal(defaults.deviceId);
      expect(food.type).to.equal('food');
      expect(food.deviceTime).to.equal(OPTIONAL);
      expect(food.time).to.equal(REQUIRED);
      expect(food.carbs).to.equal(REQUIRED);

    });
  });

  describe('makeSuspendBasal', function(){

    var defaults = {deviceId:'makeSuspendBasal'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var suspendBasal = bob.makeSuspendBasal();

      expect(suspendBasal.deviceId).to.equal(defaults.deviceId);
      expect(suspendBasal.deliveryType).to.equal('suspend');
      expect(suspendBasal.type).to.equal('basal');

      expect(suspendBasal.deviceTime).to.equal(OPTIONAL);
      expect(suspendBasal.time).to.equal(REQUIRED);
      expect(suspendBasal.duration).to.equal(OPTIONAL);
      expect(suspendBasal.suppressed).to.equal(OPTIONAL);
      expect(suspendBasal.previous).to.equal(OPTIONAL);

    });
  });

  describe('makeNormalBolus', function(){

    var defaults = {deviceId:'makeNormalBolus'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var normal = bob.makeNormalBolus();

      expect(normal.deviceId).to.equal(defaults.deviceId);
      expect(normal.type).to.equal('bolus');
      expect(normal.subType).to.equal('normal');
      expect(normal.deviceTime).to.equal(OPTIONAL);
      expect(normal.time).to.equal(REQUIRED);
      expect(normal.normal).to.equal(REQUIRED);

    });
  });

  describe('makeNote', function(){

    var defaults = {deviceId:'makeNormalBolus'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var note = bob.makeNote();

      expect(note.deviceId).to.equal(defaults.deviceId);
      expect(note.type).to.equal('note');
      expect(note.deviceTime).to.equal(OPTIONAL);
      expect(note.time).to.equal(REQUIRED);
      expect(note.value).to.equal(REQUIRED);

    });
  });

  describe('makePumpSettings', function(){

    var defaults = {deviceId:'makePumpSettings'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var settings = bob.makePumpSettings();

      expect(settings.deviceId).to.equal(defaults.deviceId);
      expect(settings.type).to.equal('pumpSettings');
      expect(settings.deviceTime).to.equal(OPTIONAL);
      expect(settings.time).to.equal(REQUIRED);
      expect(settings.activeSchedule).to.equal(REQUIRED);
      expect(settings.units).to.equal(REQUIRED);

    });
  });

  describe('makeSMBG', function(){

    var defaults = {deviceId:'makeSMBG'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var smbg = bob.makeSMBG();

      expect(smbg.deviceId).to.equal(defaults.deviceId);
      expect(smbg.type).to.equal('smbg');
      expect(smbg.deviceTime).to.equal(OPTIONAL);
      expect(smbg.time).to.equal(REQUIRED);
      expect(smbg.value).to.equal(REQUIRED);

    });
  });

  describe('makeSquareBolus', function(){

    var defaults = {deviceId:'makeSquareBolus'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var square = bob.makeSquareBolus();


      expect(square.deviceId).to.equal(defaults.deviceId);
      expect(square.type).to.equal('bolus');
      expect(square.subType).to.equal('square');
      expect(square.deviceTime).to.equal(OPTIONAL);
      expect(square.time).to.equal(REQUIRED);
      expect(square.extended).to.equal(REQUIRED);
      expect(square.duration).to.equal(REQUIRED);

    });
  });

  describe('makeTempBasal', function(){

    var defaults = {deviceId:'makeTempBasal'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var temp = bob.makeTempBasal();

      expect(temp.deviceId).to.equal(defaults.deviceId);
      expect(temp.type).to.equal('basal');
      expect(temp.deliveryType).to.equal('temp');
      expect(temp.deviceTime).to.equal(OPTIONAL);
      expect(temp.time).to.equal(REQUIRED);
      expect(temp.rate).to.equal(OPTIONAL);
      expect(temp.duration).to.equal(REQUIRED);
      expect(temp.percent).to.equal(OPTIONAL);
      expect(temp.previous).to.equal(OPTIONAL);

    });
  });

  describe('makeWizard', function(){

    var defaults = {deviceId:'makeWizard'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var wiz = bob.makeWizard();

      expect(wiz.deviceId).to.equal(defaults.deviceId);
      expect(wiz.type).to.equal('wizard');
      expect(wiz.deviceTime).to.equal(OPTIONAL);
      expect(wiz.time).to.equal(REQUIRED);
      expect(wiz.bgInput).to.equal(OPTIONAL);
      expect(wiz.insulinOnBoard).to.equal(OPTIONAL);
      expect(wiz.insulinCarbRatio).to.equal(OPTIONAL);
      expect(wiz.bgTarget).to.equal(OPTIONAL);
      expect(wiz.carbInput).to.equal(OPTIONAL);
      expect(wiz.bolus).to.equal(OPTIONAL);
      expect(wiz.payload).to.equal(OPTIONAL);
      expect(wiz.recommended).to.equal(OPTIONAL);

    });
  });

  describe('makeDeviceMetaResume', function(){

    var defaults = {deviceId:'makeDeviceMetaResume'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var resumeMeta = bob.makeDeviceMetaResume();

      expect(resumeMeta.deviceId).to.equal(defaults.deviceId);
      expect(resumeMeta.type).to.equal('deviceMeta');
      expect(resumeMeta.subType).to.equal('status');
      expect(resumeMeta.deviceTime).to.equal(OPTIONAL);
      expect(resumeMeta.time).to.equal(REQUIRED);
      expect(resumeMeta.status).to.equal('resumed');
      expect(resumeMeta.reason).to.equal(REQUIRED);

    });
  });

  describe('makeDeviceMetaSuspend', function(){

    var defaults = {deviceId:'makeDeviceMetaSuspend'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var suspendMeta = bob.makeDeviceMetaSuspend();

      expect(suspendMeta.deviceId).to.equal(defaults.deviceId);
      expect(suspendMeta.type).to.equal('deviceMeta');
      expect(suspendMeta.subType).to.equal('status');
      expect(suspendMeta.deviceTime).to.equal(OPTIONAL);
      expect(suspendMeta.time).to.equal(REQUIRED);
      expect(suspendMeta.status).to.equal('suspended');
      expect(suspendMeta.reason).to.equal(REQUIRED);

    });
  });

});