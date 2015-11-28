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

/* global describe, it */

var _ = require('lodash');
var expect = require('salinity').expect;

var getDeviceInfo = require('../../lib/carelink/getDeviceInfo');

describe('getDeviceInfo', function() {
  var fakeRows = [
    ['The cure for anything is salt water:', 'sweat', 'tears', 'or the sea'],
    ['Isak', 'Dinesen'],
    ['Meter:', 'OneTouch Mini', '#12345', ''],
    ['Pump:', 'MiniMed 530G - 551', '#6789A', 'Time Changes: 2'],
    ['Baroness', 'Karen', 'von', 'Blixen-Finecke']
  ];

  var multiplePumps = _.cloneDeep(fakeRows);
  multiplePumps.splice(4, 0, ['Pump:', 'Paradigm Revel - 523', 'foobar', '']);

  it('should return an object', function() {
    expect(getDeviceInfo([], /foo/)).to.be.an('object');
  });

  it('should read the model and serial number of a bgm', function() {
    var devices = getDeviceInfo(fakeRows, /Meter/);
    expect(devices.getDeviceModel()).to.equal('OneTouch Mini');
    expect(devices.getDeviceSerialNumber()).to.equal('12345');
  });

  it('should read the model and serial number of a pump', function() {
    var devices = getDeviceInfo(fakeRows, /Pump/);
    expect(devices.getDeviceModel()).to.equal('MiniMed 530G 551');
  });

  it('should return `multiple` when more than one pump or meter is present', function() {
    var devices = getDeviceInfo(multiplePumps, /Pump/);
    expect(devices.getDeviceModel()).to.equal('multiple');
    expect(devices.getDeviceSerialNumber()).to.equal('multiple');
  });

  it('should return a payload object containing a `devices` array that is an array of all devices', function() {
    var devices = getDeviceInfo(multiplePumps, /Pump/);
    var payloadDevices = devices.getPayload().devices;
    expect(payloadDevices).to.be.an('array');
    expect(payloadDevices.length).to.equal(2);
  });

  describe('getDeviceModel', function() {
    it('should throw an error if devices array is empty', function() {
      var devices = getDeviceInfo([], /Pump/);
      var fn = function() { devices.getDeviceModel(); };
      expect(fn).to.throw(Error);
    });
  });

  describe('getDeviceSerialNumber', function() {
    it('should throw an error if devices array is empty', function() {
      var devices = getDeviceInfo([], /Pump/);
      var fn = function() { devices.getDeviceSerialNumber(); };
      expect(fn).to.throw(Error);
    });
  });

  describe('hasMultiple', function() {
    it('should return false when only one device of a particular type present', function() {
      var meters1 = getDeviceInfo(fakeRows, /Meter/);
      var pumps = getDeviceInfo(fakeRows, /Pump/);
      var meters2 = getDeviceInfo(multiplePumps, /Meter/);
      expect(meters1.hasMultiple()).to.be.false;
      expect(pumps.hasMultiple()).to.be.false;
      expect(meters2.hasMultiple()).to.be.false;
    });

    it('should return true when multiple devices of a particular type present', function() {
      var pumps = getDeviceInfo(multiplePumps, /Pump/);
      expect(pumps.hasMultiple()).to.be.true;
    });
  });

  describe('getNumTimeChangesPerSN', function() {
    it('should return an array giving number of time changes per SN', function() {
      var pumps = getDeviceInfo(fakeRows, /Pump/);
      expect(pumps.getNumTimeChangesPerSN()).to.be.an('array');
      expect(pumps.getNumTimeChangesPerSN()).deep.equals([{
        deviceSerialNumber: '6789A',
        numTimeChanges: 2
      }]);
    });

    it('should return an empty array if no time changes', function() {
      var meters = getDeviceInfo(fakeRows, /Meter/);
      expect(meters.getNumTimeChangesPerSN()).to.be.an('array');
      expect(meters.getNumTimeChangesPerSN()).deep.equals([]);
    });
  });

  describe('hasTimeChanges', function() {
    it('should return true if there are time changes in one or more devices within a category (pumps or meters)', function() {
      var pumps = getDeviceInfo(fakeRows, /Pump/);
      expect(pumps.hasTimeChanges()).to.be.true;
    });

    it('should return false if there are time changes in one or more devices within a category (pumps or meters)', function() {
      var meters = getDeviceInfo(fakeRows, /Meter/);
      expect(meters.hasTimeChanges()).to.be.false;
    });
  });
});