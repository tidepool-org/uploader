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
  var config, now, sundial, localStore, api, jellyfish, device, carelink;
  var app;
  var appActions;

  beforeEach(function() {

    config = {};
    now = '2014-01-31T22:00:00-05:00';
    sundial = {
      utcDateString: function() { return now; }
    };
    localStore = require('../../lib/core/localStore')({devices: {'11': ['carelink']}});
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
      '../core/localStore': localStore,
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

  describe('load', function() {
    beforeEach(function() {
      api.init = function(options, cb) { cb(); };
      device.init = function(options, cb) { cb(); };
      carelink.init = function(options, cb) { cb(); };

      api.user = {};
      api.user.account = function(cb) { cb(); };
      api.user.profile = function(cb) { cb(); };
      api.user.getUploadGroups = function(cb) { cb(null,[{userid: '11'}]); };
      api.setHosts = function() {};
    });

    it('initializes all I/O services', function(done) {
      var initialized = {};
      var mark = function(name, cb) {
        initialized[name] = true;
        cb();
      };
      localStore.init = function(options, cb) { mark('localStore', cb); };
      api.init = function(options, cb) { mark('api', cb); };
      device.init = function(options, cb) { mark('device', cb); };
      carelink.init = function(options, cb) { mark('carelink', cb); };

      appActions.load(function(err) {
        if (err) throw err;
        expect(initialized.localStore).to.be.true;
        expect(initialized.api).to.be.true;
        expect(initialized.device).to.be.true;
        expect(initialized.carelink).to.be.true;
        done();
      });
    });

    it('goes to login page if no session found', function(done) {
      localStore.getInitialState = function() {};
      localStore.init = function(options, cb) { cb(); };
      api.init = function(options, cb) { cb(); };

      appActions.load(function(err) {
        if (err) throw err;
        expect(app.state.page).to.equal('login');
        done();
      });
    });

    it('goes to main page if local session found and targeted devices fetched from localStore', function(done) {
      api.init = function(options, cb) { cb(null, {token: '1234'}); };
      api.user.account = function(cb) { cb(null, {userid: '11'}); };
      api.user.profile = function(cb) { cb(null, {fullName: 'bob'}); };
      api.user.getUploadGroups = function(cb) { cb(null,[{userid: '11'},{userid: '13'}]); };

      appActions.load(function(err) {
        if (err) throw err;
        expect(app.state.page).to.equal('main');
        done();
      });
    });

    it('goes to settings page if local session found and no targeted devices fetched from localStore', function(done) {
      api.init = function(options, cb) { cb(null, {token: '1234'}); };
      api.user.account = function(cb) { cb(null, {userid: '12'}); };
      api.user.profile = function(cb) { cb(null, {fullName: 'alice'}); };
      api.user.getUploadGroups = function(cb) { cb(null,[{userid: '12'},{userid: '11'}]); };

      appActions.load(function(err) {
        if (err) throw err;
        expect(app.state.page).to.equal('settings');
        done();
      });
    });

    it('loads logged-in user if local session found', function(done) {
      api.init = function(options, cb) { cb(null, {token: '1234'}); };
      api.user.account = function(cb) { cb(null, {userid: '11'}); };
      api.user.profile = function(cb) { cb(null, {fullName: 'bob'}); };
      api.user.getUploadGroups = function(cb) { cb(null,[{userid: '11'},{userid: '13'}]); };

      appActions.load(function(err) {
        if (err) throw err;
        expect(app.state.user).to.deep.equal({
          userid: '11',
          profile: {fullName: 'bob'},
          uploadGroups: [ { userid: '11' }, { userid: '13'} ]
        });
        done();
      });
    });

    it('sets target user id as logged-in user id', function(done) {
      api.init = function(options, cb) { cb(null, {token: '1234'}); };
      api.user.account = function(cb) { cb(null, {userid: '11'}); };

      appActions.load(function(err) {
        if (err) throw err;
        expect(app.state.targetId).to.equal('11');
        done();
      });
    });

  });

  describe('login', function() {
    var loginMetricsCall = {};

    beforeEach(function() {
      api.user = {};
      api.user.login = function(credentials, options, cb) { cb(); };
      api.user.profile = function(cb) { cb(); };
      api.user.getUploadGroups = function(cb) { cb(null,[{userid: '11'}]); };
      api.metrics = { track : function(one, two) { loginMetricsCall.one = one; loginMetricsCall.two = two;  }};
    });

    it('goes to settings page by default', function(done) {
      appActions.login({}, {}, function(err) {
        if (err) throw err;
        expect(app.state.page).to.equal('settings');
        expect(loginMetricsCall).to.not.be.empty;
        expect(loginMetricsCall.one).to.equal(appActions.trackedState.LOGIN_SUCCESS);
        done();
      });
    });

    it('goes to main page if login successful and targeted devices fetched from localStore', function(done) {
      api.user.login = function(credentials, options, cb) {
        cb(null, {user: {userid: '11'}});
      };
      api.user.account = function(cb) { cb(null, {userid: '11'}); };
      api.user.profile = function(cb) { cb(null, {fullName: 'bob'}); };
      api.user.getUploadGroups = function(cb) { cb(null,[{userid: '11'},{userid: '13'}]); };

      appActions.login({}, {}, function(err) {
        if (err) throw err;

        expect(app.state.page).to.equal('main');
        done();
      });
    });

    it('goes to settings page if login successful and targeted devices not fetched from localStore', function(done) {
      api.user.login = function(credentials, options, cb) {
        cb(null, {user: {userid: '12'}});
      };
      api.user.account = function(cb) { cb(null, {userid: '12'}); };
      api.user.profile = function(cb) { cb(null, {fullName: 'alice'}); };
      api.user.getUploadGroups = function(cb) { cb(null,[{userid: '12'},{userid: '11'}]); };

      appActions.login({}, {}, function(err) {
        if (err) throw err;

        expect(app.state.page).to.equal('settings');
        done();
      });
    });

    it('loads logged-in user if login successful', function(done) {
      api.user.login = function(credentials, options, cb) {
        cb(null, {user: {userid: '11'}});
      };
      api.user.profile = function(cb) { cb(null, {fullName: 'bob'}); };

      appActions.login({}, {}, function(err) {
        if (err) throw err;

        expect(app.state.user).to.deep.equal({
          userid: '11',
          profile: {fullName: 'bob'},
          uploadGroups: [ { userid: '11' } ]
        });
        done();
      });
    });

    it('calls callback with error if login failed', function(done) {
      api.user.login = function(credentials, options, cb) {
        cb({status: 401});
      };

      appActions.login({}, {}, function(err) {
        if (err && err.status !== 401) throw err;
        expect(err.status).to.equal(401);
        done();
      });
    });

    it('sets target user id as logged-in user id', function(done) {
      api.user.login = function(credentials, options, cb) {
        cb(null, {user: {userid: '11'}});
      };

      appActions.login({}, {}, function(err) {
        if (err) throw err;
        expect(app.state.targetId).to.equal('11');
        done();
      });
    });

  });

  describe('viewData', function() {

    var viewDataMetricsCall = {};

    beforeEach(function() {
      api.metrics = { track : function(one, two) { viewDataMetricsCall.one = one; viewDataMetricsCall.two = two;  }};
    });

    it('logs metric', function(done) {
      appActions.viewData();
      expect(viewDataMetricsCall).to.not.be.empty;
      expect(viewDataMetricsCall.one).to.equal(appActions.trackedState.SEE_IN_BLIP);
      done();
    });
  });

  describe('logout', function() {

    var logoutMetricsCall = {};

    beforeEach(function() {
      api.user = {};
      api.user.logout = function(cb) { cb(); };
      api.metrics = { track : function(one, two) { logoutMetricsCall.one = one; logoutMetricsCall.two = two;  }};
    });

    it('resets app state', function(done) {
      var uploads = [1, 2, 3];
      app.state = {
        user: {userid: '11'},
        targetId: '11',
        uploads: uploads
      };
      appActions.logout(function(err) {
        if (err) throw err;
        expect(app.state.user).to.not.exist;
        expect(app.state.targetId).to.not.exist;
        expect(app.state.uploads).to.not.equal(uploads);
        expect(logoutMetricsCall).to.not.be.empty;
        expect(logoutMetricsCall.one).to.equal(appActions.trackedState.LOGOUT_CLICKED);
        done();
      });
    });

    it('goes back to login page', function(done) {
      app.state.page = 'main';
      appActions.logout(function(err) {
        if (err) throw err;
        expect(app.state.page).to.equal('login');
        done();
      });
    });

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

    it('keeps carelink at the beginning when adding new device', function(done) {
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
        expect(app.state.uploads[0].source.type).to.equal('carelink');
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

    it('resets progress for disconnected device', function(done) {
      app.state.uploads = [
      {
        source: {
          type: 'device',
          driverId: 'DexcomG4',
          usb: 3,
          connected: true
        },
        progress: {}
      }
      ];
      connectedDevices = [];

      appActions.detectDevices(function(err) {
        if (err) throw err;
        expect(app.state.uploads).to.have.length(1);
        expect(app.state.uploads[0].source.progress).to.not.exist;
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

    it('keeps one upload per device driverId', function(done) {
      app.state.uploads = [
      {
        source: {
          type: 'device',
          driverId: 'DexcomG4',
          serialNumber: 'AA11',
          usb: 3,
          connected: true
        }
      }
      ];
      connectedDevices = [{
        driverId: 'DexcomG4',
        serialNumber: 'BB22',
        usb: 11
      }];

      appActions.detectDevices(function(err) {
        if (err) throw err;
        expect(app.state.uploads).to.have.length(1);
        expect(app.state.uploads[0].source.serialNumber).to.equal('BB22');
        done();
      });
    });

  });

  describe('chooseDevices', function() {
    beforeEach(function() {
      app.state = {
        dropMenu: true,
        page: 'main'
      };
    });

    it('redirects to settings page and clears dropMenu', function() {
      appActions.chooseDevices();
      expect(app.state.dropMenu).to.be.false;
      expect(app.state.page).to.equal('settings');
    });
  });

  describe('addOrRemoveTargetDevice', function() {
    beforeEach(function() {
      app.state = {
        targetDevices: []
      };
    });

    it('adds the device if the event target is checked', function() {
      appActions.addOrRemoveTargetDevice({target: {value: 'foo', checked: true}});
      expect(app.state.targetDevices).to.deep.equal(['foo']);
    });

    it('removes the device if the event target is not checked', function() {
      app.state.targetDevices = ['foo', 'Kiwi'];
      appActions.addOrRemoveTargetDevice({target: {value: 'foo', checked: false}});
      appActions.addOrRemoveTargetDevice({target: {value: 'bar', checked: false}});
      expect(app.state.targetDevices).to.deep.equal(['Kiwi']);
    });
  });

  describe('storeTargetDevices', function() {
    beforeEach(function() {
      app.state = {
        page: 'settings',
        targetDevices: ['foo', 'bar']
      };
    });

    it('saves the current targetDevices in the app state in the localStore under the current\'s user\'s id', function() {
      expect(localStore.getItem('devices')['11']).to.deep.equal(['carelink']);
      appActions.storeTargetDevices('11');
      expect(localStore.getItem('devices')['11']).to.deep.equal(['foo', 'bar']);
    });

    it('also redirects to main page', function() {
      expect(app.state.page).to.equal('settings');
      appActions.storeTargetDevices('11');
      expect(app.state.page).to.equal('main');
    });
  });

  describe('readFile', function() {
    beforeEach(function() {
      app.state = {
        uploads: [{key: 'foo'}]
      };
    });

    it('should return an error if the filename doesn\'t end in the specified extension', function() {
      var err = appActions.readFile(0, '11', {name: 'foo.bar'}, '.txt');
      expect(err.message).to.equal('Please choose a file ending in .txt');
      expect(err.code).to.equal(404);
    });
  });

  describe('uploadDevice', function() {
    var uploadDeviceMetricsCall = {};
    var uploadErrorCall = {};

    beforeEach(function() {
      api.metrics = { track : function(one, two) { uploadDeviceMetricsCall.one = one; uploadDeviceMetricsCall.two = two;  }};
      api.errors = { log : function(one, two, three) { uploadErrorCall.one = one; uploadErrorCall.two = two; uploadErrorCall.three = three; }};
    });

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
      expect(uploadDeviceMetricsCall).to.not.be.empty;
      expect(uploadDeviceMetricsCall.one).to.equal(appActions.trackedState.UPLOAD_STARTED+' DexcomG4');
    });

    it('updates upload with correct progress data', function(done) {
      device.detect = function(driverId, options, cb) { return cb(null, {}); };
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

    it('adds correct object to upload history when complete', function(done) {
      now = '2014-01-31T22:00:00-05:00';
      device.detect = function(driverId, options, cb) { return cb(null, {}); };
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
        var instance = {
          targetId: '11',
          start: '2014-01-31T22:00:00-05:00',
          finish: '2014-01-31T22:00:30-05:00',
          step: 'cleanup',
          percentage: 100,
          success: true,
          count: 2
        };
        expect(app.state.uploads[0].progress).to.deep.equal(instance);
        expect(app.state.uploads[0].history).to.have.length(1);
        expect(app.state.uploads[0].history[0]).to.deep.equal(instance);
        expect(uploadDeviceMetricsCall).to.not.be.empty;
        expect(uploadDeviceMetricsCall.one).to.equal(appActions.trackedState.UPLOAD_SUCCESS+' DexcomG4');
        done();
      });
    });

    it('adds correct object to upload history when upload failed', function(done) {
      now = '2014-01-31T22:00:00-05:00';
      device.detect = function(driverId, options, cb) { return cb(null, {}); };
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
        var instance = {
          targetId: '11',
          start: '2014-01-31T22:00:00-05:00',
          finish: '2014-01-31T22:00:30-05:00',
          step: 'fetchData',
          percentage: 50,
          error: 'oops'
        };
        expect(app.state.uploads[0].progress).to.deep.equal(instance);
        expect(app.state.uploads[0].history).to.have.length(1);
        expect(app.state.uploads[0].history[0]).to.deep.equal(instance);
        expect(uploadErrorCall).to.not.be.empty;
        expect(uploadDeviceMetricsCall).to.not.be.empty;
        expect(uploadErrorCall.two).to.equal(appActions.trackedState.UPLOAD_FAILED+' DexcomG4');
        expect(uploadDeviceMetricsCall.one).to.equal(appActions.trackedState.UPLOAD_FAILED+' DexcomG4');
        done();
      });
    });

    it('adds to upload history most recent first', function(done) {
      device.detect = function(driverId, options, cb) { return cb(null, {}); };
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

  describe('reset', function() {

    it('throws an error if upload index is invalid', function() {
      app.state.uploads = [];

      expect(appActions.reset.bind(appActions, 0))
        .to.throw(/index/);
    });

    it('clears upload progress', function() {
      app.state.uploads = [
        {progress: {}}
      ];

      appActions.reset(0);
      expect(app.state.uploads[0].progress).to.not.exists;
    });

  });

  describe('changeGroup', function() {

    it('updates user id for uploading', function() {
      app.state.targetId = 'foo';
      appActions.changeGroup({target: {value: 'bar'}});
      expect(app.state.targetId).to.equal('bar');
    });

  });

  describe('hideDropMenu', function() {

    it('sets the boolean for the dropdown menu to false, always', function() {
      app.state.dropMenu = true;
      appActions.hideDropMenu();
      expect(app.state.dropMenu).to.be.false;
      appActions.hideDropMenu();
      expect(app.state.dropMenu).to.be.false;
    });

  });

  describe('toggleDropMenu', function() {

    it('toggles the boolean for the dropdown menu', function() {
      app.state.dropMenu = true;
      appActions.toggleDropMenu();
      expect(app.state.dropMenu).to.be.false;
      appActions.toggleDropMenu();
      expect(app.state.dropMenu).to.be.true;
    });

  });

  describe('_handleUploadError', function(){

    var uploadDeviceMetricsCall = {};
    var uploadErrorCall = {};

    beforeEach(function() {
      api.metrics = { track : function(one, two) { uploadDeviceMetricsCall.one = one; uploadDeviceMetricsCall.two = two;  }};
      api.errors = { log : function(one, two, three) { uploadErrorCall.one = one; uploadErrorCall.two = two; uploadErrorCall.three = three; }};
    });

    it('will attach the UTC time to the error message', function(done) {
      now = '2014-01-31T22:00:00-05:00';
      device.detect = function(driverId, options, cb) { return cb(null, {}); };
      device.upload = function(driverId, options, cb) {
        now = '2014-01-31T22:00:30-05:00';
        options.progress('fetchData', 50);
        var err = new Error('Opps, we got an error');
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
        expect(err.message).to.contain('UTC time: ' +now);
        done();
      });
    });

  });

});