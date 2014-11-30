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
var proxyquire = require('proxyquire').noCallThru();
var expect = require('salinity').expect;
var appState = require('../../lib/state/appState');

describe('appActions', function() {
  // Mock all I/O
  var config, now, sundial, api, jellyfish, device, carelink;
  var app;
  var appActions;
  beforeEach(function() {
    config = {};
    now = '2014-01-31T22:00:00-05:00';
    sundial = {
      utcDateString: function() { return now; }
    };
    api = {};
    jellyfish = {};
    device = {};
    carelink = {};

    app = {
      state: {},
      setState: function(updates) {
        this.state = _.assign(this.state, updates);
      }
    };
    appState.bindApp(app);

    appActions = proxyquire('../../lib/state/appActions', {
      '../config': config,
      'sundial': sundial,
      '../core/api': api,
      '../jellyfishClient': function() { return jellyfish; },
      '../core/device': device,
      '../core/carelink': carelink
    });
    appActions.bindApp(app);
  });

  it('binds to app component', function() {
    app.state.FOO = 'bar';
    expect(appActions.app.state.FOO).to.equal('bar');
  });

  describe('detectDevices', function() {
    var connectedDevices;
    beforeEach(function() {
      connectedDevices = [];
      device.detectAll = function(cb) {
        return cb(null, connectedDevices);
      };
    });

    it('adds a new device upload', function(done) {
      app.state.uploads = [];
      connectedDevices = [{
        driverId: 'DexcomG4',
        usb: 3
      }];

      appActions.detectDevices(function(err) {
        if (err) throw err;
        expect(app.state.uploads).to.have.length(1);
        expect(app.state.uploads[0].source).to.deep.equal({
          type: 'device',
          driverId: 'DexcomG4',
          usb: 3,
          connected: true
        });
        done();
      });
    });

    it('keeps carelink at the end when adding new device', function(done) {
      app.state.uploads = [
        {source: {type: 'carelink'}}
      ];
      connectedDevices = [{
        driverId: 'DexcomG4',
        usb: 3
      }];

      appActions.detectDevices(function(err) {
        if (err) throw err;
        expect(app.state.uploads).to.have.length(2);
        expect(app.state.uploads[1].source.type).to.equal('carelink');
        done();
      });
    });

    it('marks device upload as disconnected', function(done) {
      app.state.uploads = [
        {
          source: {
            type: 'device',
            driverId: 'DexcomG4',
            usb: 3,
            connected: true
          }
        }
      ];
      connectedDevices = [];

      appActions.detectDevices(function(err) {
        if (err) throw err;
        expect(app.state.uploads).to.have.length(1);
        expect(app.state.uploads[0].source.connected).to.be.false;
        done();
      });
    });

    it('marks device upload as connected', function(done) {
      app.state.uploads = [
      {
        source: {
          type: 'device',
          driverId: 'DexcomG4',
          usb: 3,
          connected: false
        }
      }
      ];
      connectedDevices = [{
        driverId: 'DexcomG4',
        usb: 3
      }];

      appActions.detectDevices(function(err) {
        if (err) throw err;
        expect(app.state.uploads).to.have.length(1);
        expect(app.state.uploads[0].source.connected).to.be.true;
        done();
      });
    });

    it('updates connected device info', function(done) {
      app.state.uploads = [
      {
        source: {
          type: 'device',
          driverId: 'DexcomG4',
          usb: 3,
          connected: true
        }
      }
      ];
      connectedDevices = [{
        driverId: 'DexcomG4',
        usb: 11
      }];

      appActions.detectDevices(function(err) {
        if (err) throw err;
        expect(app.state.uploads).to.have.length(1);
        expect(app.state.uploads[0].source.usb).to.equal(11);
        done();
      });
    });

  });

  describe('uploadDevice', function() {

    it('throws an error if upload index is invalid', function() {
      app.state.uploads = [];

      expect(appActions.upload.bind(appActions, 0))
        .to.throw(/index/);
    });

    it('throws an error if an upload is already in progress', function() {
      app.state.uploads = [{
        progress: {}
      }];

      expect(appActions.upload.bind(appActions, 0))
        .to.throw(/progress/);
    });

    it('starts upload with correct progress data', function() {
      now = '2014-01-31T22:00:00-05:00';
      device.detect = _.noop;
      device.upload = _.noop;
      app.state.targetId = '11';
      app.state.uploads = [{
        source: {
          type: 'device',
          driverId: 'DexcomG4'
        }
      }];

      appActions.upload(0, {}, _.noop);
      expect(app.state.uploads[0].progress).to.deep.equal({
        targetId: '11',
        start: '2014-01-31T22:00:00-05:00',
        step: 'start',
        percentage: 0
      });
    });

    it('updates upload with correct progress data', function(done) {
      device.detect = function(driverId, cb) { return cb(null, {}); };
      device.upload = function(driverId, options, cb) {
        options.progress('foo', 50);
        expect(app.state.uploads[0].progress).to.have.property('step', 'foo');
        expect(app.state.uploads[0].progress).to.have.property('percentage', 50);
        return cb();
      };
      app.state.targetId = '11';
      app.state.uploads = [{
        source: {
          type: 'device',
          driverId: 'DexcomG4'
        }
      }];

      appActions.upload(0, {}, done);
    });

    it('adds correct object to upload history when complete and clears progress', function(done) {
      now = '2014-01-31T22:00:00-05:00';
      device.detect = function(driverId, cb) { return cb(null, {}); };
      device.upload = function(driverId, options, cb) {
        now = '2014-01-31T22:00:30-05:00';
        options.progress('cleanup', 100);
        var records = [{}, {}];
        return cb(null, records);
      };
      app.state.targetId = '11';
      app.state.uploads = [{
        source: {
          type: 'device',
          driverId: 'DexcomG4'
        }
      }];

      appActions.upload(0, {}, function(err) {
        if (err) throw err;
        expect(app.state.uploads[0].progress).to.be.undefined;
        expect(app.state.uploads[0].history).to.have.length(1);
        expect(app.state.uploads[0].history[0]).to.deep.equal({
          targetId: '11',
          start: '2014-01-31T22:00:00-05:00',
          finish: '2014-01-31T22:00:30-05:00',
          step: 'cleanup',
          percentage: 100,
          success: true,
          count: 2
        });
        done();
      });
    });

    it('adds correct object to upload history when upload failed', function(done) {
      now = '2014-01-31T22:00:00-05:00';
      device.detect = function(driverId, cb) { return cb(null, {}); };
      device.upload = function(driverId, options, cb) {
        now = '2014-01-31T22:00:30-05:00';
        options.progress('fetchData', 50);
        var err = 'oops';
        return cb(err);
      };
      app.state.targetId = '11';
      app.state.uploads = [{
        source: {
          type: 'device',
          driverId: 'DexcomG4'
        }
      }];

      appActions.upload(0, {}, function(err) {
        if (err && err !== 'oops') throw err;
        expect(app.state.uploads[0].history).to.have.length(1);
        expect(app.state.uploads[0].history[0]).to.deep.equal({
          targetId: '11',
          start: '2014-01-31T22:00:00-05:00',
          finish: '2014-01-31T22:00:30-05:00',
          step: 'fetchData',
          percentage: 50,
          error: 'oops'
        });
        done();
      });
    });

    it('adds to upload history most recent first', function(done) {
      device.detect = function(driverId, cb) { return cb(null, {}); };
      device.upload = function(driverId, options, cb) { return cb(null, []); };
      app.state.uploads = [{
        source: {
          type: 'device',
          driverId: 'DexcomG4'
        },
        history: [
          {targetId: '1'}
        ]
      }];
      app.state.targetId = '2';

      appActions.upload(0, {}, function(err) {
        if (err) throw err;
        expect(app.state.uploads[0].history).to.have.length(2);
        expect(app.state.uploads[0].history[0].targetId).to.equal('2');
        expect(app.state.uploads[0].history[1].targetId).to.equal('1');
        done();
      });
    });

  });

});
