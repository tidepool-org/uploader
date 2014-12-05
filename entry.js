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

require('./styles/main.less');

var React = require('react');
window.React = React;
var config = require('./lib/config');
window.DEBUG = config.DEBUG;
// Important: need to require App after setting `window.DEBUG` to enable logging
var App = require('./lib/components/App.jsx');

if (config.MOCK) {
  var mock = require('mock');
  var api = require('./lib/core/api');
  var device = require('./lib/core/device');
  var carelink = require('./lib/core/carelink');
  mock.patchApi(api);
  mock.patchDevice(device);
  mock.patchCarelink(carelink);
}

window.app = React.render(
  React.createElement(App), document.body
);
