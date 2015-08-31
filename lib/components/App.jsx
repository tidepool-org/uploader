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

var Loading = require('./Loading.jsx');
var Login = require('./Login.jsx');
var LoggedInAs = require('./LoggedInAs.jsx');
var Scan = require('./Scan.jsx');
var UploadList = require('./UploadList.jsx');
var ViewDataLink = require('./ViewDataLink.jsx');
var UploadSettings = require('./UploadSettings.jsx');
var TimezoneSelection = require('./TimezoneSelection.jsx');
var DeviceSelection = require('./DeviceSelection.jsx');
var UpdatePlease = require('./UpdatePlease.jsx');

var config = require('../config');

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
    this.device = require('../core/device');
  },

  onlyMe: function() {
    var self = this;
    return (!_.isEmpty(self.state.user.uploadGroups) && this.state.user.uploadGroups.length === 1);
  },

  render: function() {
    return (
      <div className={'App App--' + this.state.page} onClick={this.appActions.hideDropMenu.bind(this.appActions)}>
        <div className="App-header">{this.renderHeader()}</div>
        <div className="App-page">{this.renderPage()}</div>
        <div className="App-footer">{this.renderFooter()}</div>
      </div>
    );
  },

  renderHeader: function() {
    if (this.state.page === 'loading') {
      return null;
    }

    if (!this.appState.isLoggedIn()) {
      return this.renderSignupLink();
    }

    return <LoggedInAs
      dropMenu={this.state.dropMenu}
      user={this.state.user}
      onClicked={this.appActions.toggleDropMenu.bind(this.appActions)}
      onChooseDevices={this.appActions.chooseDevices.bind(this.appActions)}
      onLogout={this.appActions.logout.bind(this.appActions)} />;
  },

  renderPage: function() {
    var page = this.state.page;
    var targetTimezone = this.state.targetTimezone;

    if (page === 'loading') {
      return <Loading />;
    }

    if (page === 'login') {
      return <Login onLogin={this.appActions.login.bind(this.appActions)} />;
    }

    var uploadSettings = this.onlyMe() ? null : this.renderUploadSettings();
    var timezone = this.renderTimezoneSelection();

    if (page === 'settings') {
      return (
        <div>
          {uploadSettings}
          {timezone}
          <DeviceSelection
            uploads={this.state.uploads}
            targetId={this.state.targetId}
            targetDevices={this.state.targetDevices}
            timezoneIsSelected={!_.isEmpty(targetTimezone)}
            onCheckChange={this.appActions.addOrRemoveTargetDevice.bind(this.appActions)}
            onDone={this.appActions.storeUserTargets.bind(this.appActions)}
            groupsDropdown={!this.onlyMe()} />
        </div>
      );
    }

    if (page === 'main') {
      return (
        <div>
          {uploadSettings}
          <UploadList
            targetId={this.state.targetId}
            uploads={this.state.uploads}
            targetedUploads={this.appState.uploadsWithFlags()}
            onUpload={this.appActions.upload.bind(this.appActions)}
            onReset={this.appActions.reset.bind(this.appActions)}
            readFile={this.appActions.readFile.bind(this.appActions)}
            groupsDropdown={!this.onlyMe()} />
          {this.renderViewDataLink()}
        </div>
      );
    }

    if (page === 'error') {
      return (
        // TODO: add the link to help page on tidepool.org or knowledge base
        // re: how to update the uploader
        <UpdatePlease link={this.state.howToUpdateKBLink} />
      );
    }

    return null;
  },

  renderFooter: function() {
    return(
      <div>
        <div className="mailto">
          <a href="mailto:support@tidepool.org?Subject=Feedback on Blip" target="mailto">Send us feedback</a>
        </div>
        <div className="App-footer-version">{'v'+config.version+' beta'}</div>
      </div>
    );
  },

  renderSignupLink: function() {
    return (
      <div className="App-signup">
        <a  href={this.appActions.app.api.makeBlipUrl('#/signup')} target="_blank">
          <i className="icon-add"> Sign up</i></a>
      </div>
    );
  },

  renderScan: function() {
    if (this.appState.hasUploadInProgress()) {
      return null;
    }

    return <Scan
      ref="scan"
      onDetectDevices={this.appActions.detectDevices.bind(this.appActions)} />;
  },

  renderUploadSettings: function() {
    return (
      <UploadSettings
        page={this.state.page}
        user={this.state.user}
        targetId={this.state.targetId}
        isUploadInProgress={this.appState.hasUploadInProgress()}
        onGroupChange={this.appActions.changeGroup.bind(this.appActions)} />
    );
  },

  renderTimezoneSelection: function() {
    return (
      <TimezoneSelection
        timezoneLabel={'Choose timezone'}
        onTimezoneChange={this.appActions.changeTimezone.bind(this.appActions)}
        targetTimezone={this.state.targetTimezone}
        targetTimezoneLabel={this.state.targetTimezoneLabel} />
    );
  },

  renderViewDataLink: function() {
    return <ViewDataLink
      href={this.appActions.app.api.makeBlipUrl('/#/patients/' + this.state.targetId + '/data')}
      onViewClicked={this.appActions.viewData.bind(this.appActions)} />;
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
