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
var React = require('react');
var appState = require('../state/appState');
var appActions = require('../state/appActions');

var LoadingPage = require('./LoadingPage.jsx');
var LoginPage = require('./LoginPage.jsx');
var LoggedInAs = require('./LoggedInAs.jsx');
var MainPage = require('./MainPage.jsx');

var App = React.createClass({
  getInitialState: function() {
    return appState.getInitial();
  },

  componentWillMount: function() {
    appState.bindApp(this);
    appActions.bindApp(this);

    appActions.load(_.noop);

    this.appState = appState;
    this.appActions = appActions;
    this.localStore = require('../core/localStore');
    this.api = require('../core/api');
  },

  render: function() {
    return (
      <div>
        {this.renderHeader()}
        {this.renderPage()}
        {this.renderAppState()}
      </div>
    );
  },

  renderHeader: function() {
    if (!this.appState.isLoggedIn()) {
      return null;
    }

    return <LoggedInAs
      user={this.state.user}
      onLogout={this.appActions.logout.bind(this.appActions)} />;
  },

  renderPage: function() {
    var page = this.state.page;

    if (page === 'loading') {
      return <LoadingPage />;
    }

    if (page === 'login') {
      return <LoginPage onLogin={this.appActions.login.bind(this.appActions)} />;
    }

    if (page === 'main') {
      return <MainPage />;
    }

    return null;
  },

  renderAppState: function() {
    return (
      <div>
        <br />
        <pre>{JSON.stringify(this.state, null, 2)}</pre>
      </div>
    );
  }
});

module.exports = App;
