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

describe('appActions', function() {
  // Mock all I/O
  var config, api, jellyfish, device, carelink;
  var app;
  var appActions;
  beforeEach(function() {
    config = {};
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

    appActions = proxyquire('../../lib/state/appActions', {
      '../config': config,
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
});
