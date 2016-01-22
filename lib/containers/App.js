/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014-2015, Tidepool Project
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

import _ from 'lodash';
import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';

import bows from '../bows.js';

import config from '../config.js';

import carelink from '../core/carelink.js';
import device from '../core/device.js';
import localStore from '../core/localStore.js';

import actions from '../redux/actions/';
const asyncActions = actions.asyncActions;
const syncActions = actions.syncActions;

import * as actionTypes from '../redux/constants/actionTypes';
import * as actionSources from '../redux/constants/actionSources';
import { pages, path } from '../redux/constants/otherConstants';

import DeviceSelection from '../components/DeviceSelection';
import Loading from '../components/Loading';
import Login from '../components/Login';
import LoggedInAs from '../components/LoggedInAs';
import TimezoneDropdown from '../components/TimezoneDropdown';
import UserDropdown from '../components/UserDropdown';

export default class App extends Component {
  constructor(props) {
    super(props);
    this.log = bows('App');
    this.handleAddDevice = this.handleAddDevice.bind(this);
    this.handleClickChooseDevices = this.handleClickChooseDevices.bind(this);
    this.handleDismissDropdown = this.handleDismissDropdown.bind(this);
    this.handleLogin = this.handleLogin.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
    this.handleRemoveDevice = this.handleRemoveDevice.bind(this);
    this.handleSetTimezone = this.handleSetTimezone.bind(this);
    this.handleSetUploadTargetUser = this.handleSetUploadTargetUser.bind(this);
    this.handleStoreTargets = this.handleStoreTargets.bind(this);
    this.handleToggleDropdown = this.handleToggleDropdown.bind(this);
  }

  componentWillMount() {
    const { api, dispatch } = this.props;
    dispatch(asyncActions.doAppInit(config, {
      api,
      carelink,
      device,
      localStore,
      log: this.log
    }));
  }

  render() {
    const { isLoggedIn, page } = this.props;
    return (
      <div className={'App App--' + page.toLowerCase()} onClick={this.handleDismissDropdown}>
        <div className="App-header">{this.renderHeader()}</div>
        <div className="App-page">{this.renderPage()}</div>
        <div className="App-footer">{this.renderFooter()}</div>
      </div>
    );
  }

  handleAddDevice(userId, deviceKey) {
    const { dispatch } = this.props;
    dispatch(syncActions.addTargetDevice(userId, deviceKey));
  }

  handleClickChooseDevices() {
    const { dispatch } = this.props;
    dispatch(syncActions.setPage(pages.SETTINGS, true));
    // ensure dropdown closes after click
    dispatch(
      syncActions.toggleDropdown(true, actionSources.UNDER_THE_HOOD)
    );
  }

  handleDismissDropdown() {
    const { dispatch } = this.props;
    // only toggle the dropdown by clicking elsewhere if it's open
    if (this.props.dropdown === true) {
      dispatch(syncActions.toggleDropdown(this.props.dropdown));
    }
  }

  handleLogin(creds, opts) {
    const { dispatch } = this.props;
    dispatch(asyncActions.doLogin(creds, opts));
  }

  handleLogout() {
    const { dispatch } = this.props;
    dispatch(asyncActions.doLogout());
  }

  handleRemoveDevice(userId, deviceKey) {
    const { dispatch } = this.props;
    dispatch(syncActions.removeTargetDevice(userId, deviceKey));
  }

  handleSetTimezone(userId, timezoneName) {
    const { dispatch } = this.props;
    dispatch(syncActions.setTargetTimezone(userId, timezoneName));
  }

  handleSetUploadTargetUser(userId) {
    const { dispatch } = this.props;
    dispatch(syncActions.setUploadTargetUser(userId));
  }

  handleStoreTargets() {
    const { dispatch } = this.props;
    dispatch(asyncActions.putTargetsInStorage());
  }

  handleToggleDropdown() {
    const { dispatch } = this.props;
    dispatch(syncActions.toggleDropdown(this.props.dropdown));
  }

  showUserSelectionDropdown() {
    const { users } = this.props;
    return (!_.isEmpty(users.targetsForUpload) &&
      users.targetsForUpload.length > 1);
  }

  renderHeader() {
    const { dropdown, isLoggedIn, page, url, users } = this.props;
    if (page === pages.LOADING) {
      return null;
    }

    if (!isLoggedIn) {
      return (
        <div className="App-signup">
          <a  href={url.signUp} target="_blank">
            <i className="icon-add"> Sign up</i></a>
        </div>
      );
    }

    return (
      <LoggedInAs
        dropMenu={dropdown}
        user={users[users.loggedInUser]}
        onClicked={this.handleToggleDropdown}
        onChooseDevices={this.handleClickChooseDevices}
        onLogout={this.handleLogout} />
    );
  }

  renderPage() {
    const { devices, os, page, url, users } = this.props;

    let userDropdown = this.showUserSelectionDropdown() ?
      this.renderUserDropdown() : null;

    if (page === pages.LOADING) {
      return (<Loading />);
    } else if (page === pages.LOGIN) {
      return (
        <Login 
          errorMessage={users.errorMessage || null}
          forgotPasswordUrl={url.forgotPassword}
          isFetching={users.isFetching}
          onLogin={this.handleLogin} />
        );
    } else if (page === pages.MAIN) {
      return null;
    } else if (page === pages.SETTINGS) {
      let timezoneDropdown = this.renderTimezoneDropdown();
      const targetUser = users[users.uploadTargetUser] || {};
      return (
        <div>
          {userDropdown}
          {timezoneDropdown}
          <DeviceSelection 
            devices={devices}
            os={os}
            targetDevices={this.props.selectedTargetDevices}
            targetId={users.uploadTargetUser}
            timezoneIsSelected={Boolean(this.props.selectedTimezone)}
            userDropdownShowing={this.showUserSelectionDropdown()}
            userIsSelected={users.uploadTargetUser !== null}
            addDevice={this.handleAddDevice}
            removeDevice={this.handleRemoveDevice}
            onDone={this.handleStoreTargets} />
        </div>
      );
    } else {
      throw new Error('Unrecognized page!');
    }
  }

  renderFooter() {
    const { version } = this.props;
    return (
      <div>
        <div className="mailto">
          <a href="mailto:support@tidepool.org?Subject=Feedback on Blip" target="mailto">Send us feedback</a>
        </div>
        <div className="App-footer-version">{`v${version} beta`}</div>
      </div>
    );
  }

  renderTimezoneDropdown() {
    const { users } = this.props;
    return (
      <TimezoneDropdown
        onTimezoneChange={this.handleSetTimezone}
        selectorLabel={'Choose timezone'}
        targetId={users.uploadTargetUser || null}
        targetTimezone={this.props.selectedTimezone} />
    );
  }

  renderUserDropdown() {
    const { page, users } = this.props;
    return (
      <UserDropdown
        page={page}
        onGroupChange={this.handleSetUploadTargetUser}
        users={users}
        isUploadInProgress={null}
        targetId={users.uploadTargetUser} />
    );
  }
}

App.propTypes = {
  page: React.PropTypes.string.isRequired
};

function select(state) {
  return {
    // plain state
    devices: state.devices,
    dropdown: state.dropdown,
    os: state.os,
    page: state.page,
    version: state.version,
    url: state.url,
    users: state.users,
    // derived state
    isLoggedIn: !_.includes([pages.LOADING, pages.LOGIN], state.page),
    selectedTargetDevices: _.get(
      state.users[state.users.uploadTargetUser],
      ['targets', 'devices'],
      // fall back to the targets stored under 'noUserSelected', if any
      _.get(state.users['noUserSelected'], ['targets', 'devices'], [])
    ),
    selectedTimezone: _.get(
      state.users[state.users.uploadTargetUser],
      ['targets', 'timezone'],
      // fall back to the timezone stored under 'noUserSelected', if any
      _.get(state.users['noUserSelected'], ['targets', 'timezone'], null)
    )
  };
}

// wrap the component to inject dispatch and state into it
export default connect(select)(App);
