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

/*
  makeCBG: makeCBG,
  makeDeviceMetaResume: makeDeviceMetaResume,
  makeDeviceMetaSuspend: makeDeviceMetaSuspend,
  makeDualBolus: makeDualBolus,
  makeFood: makeFood,
  makeNormalBolus: makeNormalBolus,
  makeNote: makeNote,
  makeScheduledBasal: makeScheduledBasal,
  makeSettings: makeSettings,
  makeSMBG: makeSMBG,
  makeSquareBolus: makeSquareBolus,
  makeSuspendBasal: makeSuspendBasal,
  makeTempBasal: makeTempBasal,
  makeWizard: makeWizard,
  setDefaults: setDefaults
*/

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

      var defaults = {deviceId:'123-gg-33-4rrr',timezoneOffset:'-420'};

      bob.setDefaults(defaults);

      var dualBolus = bob.makeDualBolus();

      expect(dualBolus.deviceId).to.equal(defaults.deviceId);
      expect(dualBolus.timezoneOffset).to.equal(defaults.timezoneOffset);

    });
  });

  describe('makeCBG', function(){

    var defaults = {deviceId:'makeCBG',timezoneOffset:'-420'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var cbg = bob.makeCBG();

      expect(cbg.deviceId).to.equal(defaults.deviceId);
      expect(cbg.timezoneOffset).to.equal(defaults.timezoneOffset);
      expect(cbg.time).to.equal(REQUIRED);
      expect(cbg.deviceTime).to.equal(OPTIONAL);
      expect(cbg.value).to.equal(REQUIRED);

    });
  });

  describe('makeDualBolus', function(){

    var defaults = {deviceId:'makeDualBolus',timezoneOffset:'-420'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var dualBolus = bob.makeDualBolus();

      expect(dualBolus.deviceId).to.equal(defaults.deviceId);
      expect(dualBolus.timezoneOffset).to.equal(defaults.timezoneOffset);
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

    var defaults = {deviceId:'makeFood',timezoneOffset:'-420'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var food = bob.makeFood();

      expect(food.deviceId).to.equal(defaults.deviceId);
      expect(food.timezoneOffset).to.equal(defaults.timezoneOffset);
      expect(food.type).to.equal('food');
      expect(food.deviceTime).to.equal(OPTIONAL);
      expect(food.time).to.equal(REQUIRED);
      expect(food.carbs).to.equal(REQUIRED);

    });
  });

  describe('makeSuspendBasal', function(){

    var defaults = {deviceId:'makeSuspendBasal',timezoneOffset:'-420'};

    beforeEach(function(){
      bob = ObjectBuilder();
      bob.setDefaults(defaults);
    });

    it('works', function(){
      var suspendBasal = bob.makeSuspendBasal();

      expect(suspendBasal.deviceId).to.equal(defaults.deviceId);
      expect(suspendBasal.timezoneOffset).to.equal(defaults.timezoneOffset);
      expect(suspendBasal.deliveryType).to.equal('suspend');
      expect(suspendBasal.type).to.equal('basal');

      expect(suspendBasal.deviceTime).to.equal(OPTIONAL);
      expect(suspendBasal.time).to.equal(REQUIRED);
      expect(suspendBasal.duration).to.equal(OPTIONAL);
      expect(suspendBasal.suppressed).to.equal(OPTIONAL);
      expect(suspendBasal.previous).to.equal(OPTIONAL);

    });

    it('can use with_deviceId', function(){

      var updatedDeviceId = '123';

      var suspendBasal =
        bob.makeSuspendBasal()
        .with_deviceId(updatedDeviceId);

      expect(suspendBasal.deviceId).to.equal(updatedDeviceId);

    });

  });

});