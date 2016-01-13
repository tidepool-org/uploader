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

  var defaultUploadGroups = [{
    profile: {
      fullName: 'Bob',
      patient: {
        birthday: '2000-01-01',
        diagnosisDate: '2010-04-01',
        about: ''
      }
    },
    userid: '11'
  }, {
    profile: {
      fullName: 'Alice',
      patient: {
        birthday: '1985-07-04',
        diagnosisDate: '1993-03-25',
        about: 'Foo bar'
      }
    },
    userid: '12'
  }];

  beforeEach(function() {

    config = {};
    now = '2014-01-31T22:00:00-05:00';
    sundial = {
      utcDateString: function() { return now; }
    };
    localStore = require('../../lib/core/localStore')({
      devices: {'11': [{
        key: 'carelink',
        timezone: 'oldTz'
      }]}
    });
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
      api.user.getUploadGroups = function(cb) { cb(null, defaultUploadGroups); };
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

      appActions.load(function(err) {
        if (err) throw err;
        expect(app.state.page).to.equal('login');
        done();
      });
    });

    it('goes to main page if local session found and targeted devices fetched from localStore', function(done) {
      api.init = function(options, cb) { cb(null, {token: '1234'}); };
      api.user.account = function(cb) { cb(null, {userid: '11'}); };
      api.user.profile = function(cb) { cb(null, {fullName: 'Bob', patient: {about: 'Foo'}}); };

      appActions.load(function(err) {
        if (err) throw err;
        expect(app.state.page).to.equal('main');
        done();
      });
    });

    it('goes to settings page if local session found and no targeted devices fetched from localStore', function(done) {
      api.init = function(options, cb) { cb(null, {token: '1234'}); };
      api.user.account = function(cb) { cb(null, {userid: '12'}); };
      api.user.profile = function(cb) { cb(null, {fullName: 'Alice'}); };

      appActions.load(function(err) {
        if (err) throw err;
        expect(app.state.page).to.equal('settings');
        done();
      });
    });

    it('loads logged-in user if local session found', function(done) {
      api.init = function(options, cb) { cb(null, {token: '1234'}); };
      api.user.account = function(cb) { cb(null, {userid: '11'}); };
      api.user.profile = function(cb) { cb(null, {fullName: 'Bob'}); };

      appActions.load(function(err) {
        if (err) throw err;
        expect(app.state.user).to.deep.equal({
          userid: '11',
          profile: {fullName: 'Bob'},
          uploadGroups: defaultUploadGroups
        });
        done();
      });
    });

    it('sets target user id as logged-in userid if data storage exists for logged-in user', function(done) {
      api.init = function(options, cb) { cb(null, {token: '1234'}); };
      api.user.account = function(cb) { cb(null, {userid: '11'}); };
      api.user.profile = function(cb) { cb(null, {fullName: 'Bob', patient: {about: 'Foo'}}); };

      appActions.load(function(err) {
        if (err) throw err;
        expect(app.state.targetId).to.equal('11');
        done();
      });
    });

    it('sets target user id to other userid if data storage does not exist for logged-in user', function(done) {
      api.init = function(options, cb) { cb(null, {token: '1234'}); };
      api.user.account = function(cb) { cb(null, {userid: '2'}); };
      api.user.profile = function(cb) { cb(null, {fullName: 'Cookie'}); };
      api.user.getUploadGroups = function(cb) { cb(null, [defaultUploadGroups[1], {
        profile: {
          fullName: 'Cookie'
        },
        userid: '2'
      }]); };

      appActions.load(function(err) {
        if (err) throw err;
        expect(app.state.targetId).to.equal('12');
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
      api.user.getUploadGroups = function(cb) { cb(null, defaultUploadGroups); };
      api.metrics = { track : function(one, two) { loginMetricsCall.one = one; loginMetricsCall.two = two;  }};
    });

    it('goes to settings page by default', function(done) {
      api.user.profile = function(cb) { cb(null, {fullName: 'Bob', patient: {about: 'Foo'}}); };

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
      api.user.profile = function(cb) { cb(null, {fullName: 'Bob', patient: {about: 'Foo'}}); };

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
      api.user.profile = function(cb) { cb(null, {fullName: 'Bob', patient: {about: 'Foo'}}); };

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
      api.user.profile = function(cb) { cb(null, {fullName: 'Bob'}); };

      appActions.login({}, {}, function(err) {
        if (err) throw err;

        expect(app.state.user).to.deep.equal({
          userid: '11',
          profile: {fullName: 'Bob'},
          uploadGroups: defaultUploadGroups
        });
        done();
      });
    });

    it('calls callback with error if login failed', function(done) {

      var loginError = {message: 'login failed', step: 'platform_login'};

      api.user.login = function(credentials, options, cb) {
        cb(loginError);
      };

      appActions.login({}, {}, function(err) {
        expect(err.message).to.contain(loginError.message);
        done();
      });
    });

    it('sets target user id as logged-in user id if data storage exists for logged-in user', function(done) {
      api.user.login = function(credentials, options, cb) {
        cb(null, {user: {userid: '11'}});
      };
      api.user.profile = function(cb) { cb(null, {fullName: 'Bob', patient: {about: 'Foo'}}); };

      appActions.login({}, {}, function(err) {
        if (err) throw err;
        expect(app.state.targetId).to.equal('11');
        done();
      });
    });

    it('sets target user id to other userid if data storage does not exist for logged-in user', function(done) {
      api.user.login = function(credentials, options, cb) {
        cb(null, {user: {userid: '2'}});
      };
      api.user.getUploadGroups = function(cb) { cb(null, [defaultUploadGroups[1], {
        profile: {
          fullName: 'Cookie'
        },
        userid: '2'
      }]); };

      appActions.login({}, {}, function(err) {
        if (err) throw err;
        expect(app.state.targetId).to.equal('12');
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

  describe('hideUnavailableDevices', function() {
    beforeEach(function() {
      var state = appState.getInitial();
      app.setState(state);
    });

    describe('[windows]', function() {
      beforeEach(function() {
        app.setState({_os: 'win'});
      });

      it('excludes nothing', function() {
        expect(app.state.uploads.length).to.equal(11);
        appActions._hideUnavailableDevices();
        expect(app.state.uploads.length).to.equal(11);
      });
    });

    describe('[mac]', function() {
      beforeEach(function() {
        app.setState({_os: 'mac'});
      });

      it('excludes all Abbott devices', function() {
        expect(app.state.uploads.length).to.equal(11);
        appActions._hideUnavailableDevices();
        expect(app.state.uploads.length).to.equal(8);
        expect(_.findWhere(app.state.uploads, {key: 'precisionxtra'})).to.not.be.ok;
        expect(_.findWhere(app.state.uploads, {key: 'abbottfreestylelite'})).to.not.be.ok;
        expect(_.findWhere(app.state.uploads, {key: 'abbottfreestylefreedomlite'})).to.not.be.ok;
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

  describe('storeUserTargets', function() {
    beforeEach(function() {
      app.state = {
        page: 'settings',
        targetDevices: ['foo', 'bar'],
        targetTimezone: 'fooTz'
      };
    });

    it('saves the current targetDevices in the app state in the localStore under the target userid', function() {
      expect(localStore.getItem('devices')['11'][0].key).to.deep.equal('carelink');
      appActions.storeUserTargets('11');
      expect(_.pluck(localStore.getItem('devices')['11'], 'key')).to.deep.equal(['foo', 'bar']);
    });

    it('saves the current targetTimezone in the app state in the localStore along with each target device', function() {
      expect(localStore.getItem('devices')['11'][0].timezone).to.equal('oldTz');
      appActions.storeUserTargets('11');
      expect(_.uniq(_.pluck(localStore.getItem('devices')['11'], 'timezone'))[0]).to.equal('fooTz');
    });

    it('also redirects to main page', function() {
      expect(app.state.page).to.equal('settings');
      appActions.storeUserTargets('11');
      expect(app.state.page).to.equal('main');
    });
  });

  describe('storeUserTargets, timezone empty', function() {
    beforeEach(function() {
      app.state = {
        page: 'settings',
        targetDevices: ['foo', 'bar'],
        targetTimezone: ''
      };
    });

    it('does not redirect to the main page', function() {
      expect(app.state.page).to.equal('settings');
      appActions.storeUserTargets('11');
      expect(app.state.page).to.equal('settings');
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
      expect(err.message).to.equal(appActions.errorText.E_WRONG_FILE_EXT+'.txt');
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
        .to.throw(appActions.errorText.E_INVAILD_UPLOAD_INDEX);
    });

    it('throws an error if an upload is already in progress', function() {
      app.state.uploads = [{
        progress: {}
      }];

      expect(appActions.upload.bind(appActions, 0))
        .to.throw(appActions.errorText.E_UPLOAD_IN_PROGRESS);
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
      var uploadError = new Error('oops');
      uploadError.step = 'fetching_carelink';
      device.detect = function(driverId, options, cb) { return cb(null, {}); };
      device.upload = function(driverId, options, cb) {
        now = '2014-01-31T22:00:30-05:00';
        options.progress('fetchData', 50);
        return cb(uploadError);
      };
      app.state.targetId = '11';
      app.state.uploads = [{
        source: {
          type: 'device',
          driverId: 'DexcomG4'
        }
      }];

      appActions.upload(0, {}, function() {

        function checkInstance(actual, expected){
          expect(actual.targetId).to.equal(expected.targetId);
          expect(actual.start).to.equal(expected.start);
          expect(actual.percentage).to.equal(expected.percentage);
          expect(actual.error.name).to.equal('Error');
        }

        var instance = {
          targetId: '11',
          start: '2014-01-31T22:00:00-05:00',
          finish: '2014-01-31T22:00:30-05:00',
          step: 'fetchData',
          percentage: 50,
          error: uploadError
        };

        expect(app.state.uploads[0].history).to.have.length(1);
        checkInstance(app.state.uploads[0].progress,instance);
        checkInstance(app.state.uploads[0].history[0],instance);
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
        .to.throw(appActions.errorText.E_INVAILD_UPLOAD_INDEX);
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
      appActions.changeGroup('bar');
      expect(app.state.targetId).to.equal('bar');
    });

  });

  describe('changeTimezone', function() {

    it('updates the timezone ', function() {
      app.state.targetTimezone = 'foo';
      appActions.changeTimezone('bar');
      expect(app.state.targetTimezone).to.equal('bar');
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

    it('each error has a detailed `debug` string attached for logging', function(done) {
      now = '2014-01-31T22:00:00-05:00';
      device.detect = function(driverId, options, cb) { return cb(null, {}); };
      device.upload = function(driverId, options, cb) {
        now = '2014-01-31T22:00:30-05:00';
        options.progress('fetchData', 50);
        var err = new Error('Oops, we got an error');
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
        expect(err.debug).to.contain('Detail: ');
        expect(err.debug).to.contain('Error UTC Time: ');
        expect(err.debug).to.contain('Code: E_');
        expect(err.debug).to.contain('Error Type: Error');
        expect(err.debug).to.contain('Version: tidepool-uploader');
        done();
      });
    });

    it('redirects to the `error` page if jellyfish errors because uploader is out-of-date', function(done) {
      now = '2014-01-31T22:00:00-05:00';
      device.detect = function(driverId, options, cb) { return cb(null, {}); };
      device.upload = function(driverId, options, cb) {
        now = '2014-01-31T22:00:30-05:00';
        options.progress('fetchData', 50);
        var err = new Error('Oops, we got an error');
        err.code = 'outdatedVersion';
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
        expect(app.state.page).to.equal('error');
        done();
      });
    });

  });

});
