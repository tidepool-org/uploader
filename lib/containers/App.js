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
import { bindActionCreators } from 'redux';

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
import UploadList from '../components/UploadList';
import UserDropdown from '../components/UserDropdown';

export default class App extends Component {
  static propTypes = {
    api: PropTypes.func.isRequired
  };

  constructor(props) {
    super(props);
    this.log = bows('App');
    this.handleClickChooseDevices = this.handleClickChooseDevices.bind(this);
    this.handleDismissDropdown = this.handleDismissDropdown.bind(this);
    this.props.async.doAppInit(config, {
      api: props.api,
      carelink,
      device,
      localStore,
      log: this.log
    });
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

  handleClickChooseDevices() {
    const { setPage, toggleDropdown } = this.props.sync;
    // ensure dropdown closes after click
    setPage(pages.SETTINGS, true);
    toggleDropdown(true, actionSources.UNDER_THE_HOOD);
  }

  handleDismissDropdown() {
    const { dropdown } = this.props;
    // only toggle the dropdown by clicking elsewhere if it's open
    if (dropdown === true) {
      this.props.sync.toggleDropdown(dropdown);
    }
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
        onClicked={this.props.sync.toggleDropdown.bind(this, this.props.dropdown)}
        onChooseDevices={this.handleClickChooseDevices}
        onLogout={this.props.async.doLogout} />
    );
  }

  renderPage() {
    const { page, showingUserSelectionDropdown, users } = this.props;

    let userDropdown = showingUserSelectionDropdown ?
      this.renderUserDropdown() : null;

    if (page === pages.LOADING) {
      return (<Loading />);
    } else if (page === pages.LOGIN) {
      return (
        <Login 
          errorMessage={users.errorMessage || null}
          forgotPasswordUrl={this.props.url.forgotPassword}
          isFetching={users.isFetching}
          onLogin={this.props.async.doLogin} />
        );
    } else if (page === pages.MAIN) {
      return (
        <div>
          {userDropdown}
          <UploadList
            devices={this.props.devices}
            potentialUploads={this.props.potentialUploads}
            targetId={users.uploadTargetUser}
            userDropdownShowing={showingUserSelectionDropdown} />
        </div>
      );
    } else if (page === pages.SETTINGS) {
      let timezoneDropdown = this.renderTimezoneDropdown();
      return (
        <div>
          {userDropdown}
          {timezoneDropdown}
          <DeviceSelection 
            devices={this.props.devices}
            os={this.props.os}
            targetDevices={this.props.selectedTargetDevices}
            targetId={users.uploadTargetUser}
            timezoneIsSelected={Boolean(this.props.selectedTimezone)}
            userDropdownShowing={showingUserSelectionDropdown}
            userIsSelected={users.uploadTargetUser !== null}
            addDevice={this.props.sync.addTargetDevice}
            removeDevice={this.props.sync.removeTargetDevice}
            onDone={this.props.async.putTargetsInStorage} />
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
        onTimezoneChange={this.props.sync.setTargetTimezone}
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
        onGroupChange={this.props.async.setUploadTargetUserAndMaybeRedirect}
        users={users}
        isUploadInProgress={null}
        targetId={users.uploadTargetUser} />
    );
  }
}

App.propTypes = {
  page: React.PropTypes.string.isRequired
};

// wrap the component to inject dispatch and state into it
export default connect(
  (state) => {
    function hasSomeoneLoggedIn(state) {
      return !_.includes([pages.LOADING, pages.LOGIN], state.page);
    }
    function getPotentialUploadsForUploadTargetUser(state) {
      return Object.keys(
        _.get(state, ['uploads', state.users.uploadTargetUser], {})
      );
    }
    function getSelectedTargetDevices(state) {
      return _.get(
        state.users[state.users.uploadTargetUser],
        ['targets', 'devices'],
        // fall back to the targets stored under 'noUserSelected', if any
        _.get(state.users['noUserSelected'], ['targets', 'devices'], [])
      );
    }
    function getSelectedTimezone(state) {
      return _.get(
        state.users[state.users.uploadTargetUser],
        ['targets', 'timezone'],
        // fall back to the timezone stored under 'noUserSelected', if any
        _.get(state.users['noUserSelected'], ['targets', 'timezone'], null)
      );
    }
    function shouldShowUserSelectionDropdown(state) {
      return !_.isEmpty(state.users.targetsForUpload) &&
        state.users.targetsForUpload.length > 1;
    }
    return {
      // plain state
      devices: state.devices,
      dropdown: state.dropdown,
      os: state.os,
      page: state.page,
      version: state.version,
      uploads: state.uploads,
      url: state.url,
      users: state.users,
      // derived state
      isLoggedIn: hasSomeoneLoggedIn(state),
      potentialUploads: getPotentialUploadsForUploadTargetUser(state),
      selectedTargetDevices: getSelectedTargetDevices(state),
      selectedTimezone: getSelectedTimezone(state),
      showingUserSelectionDropdown: shouldShowUserSelectionDropdown(state)
    };
  },
  (dispatch) => {
    return {
      async: bindActionCreators(asyncActions, dispatch),
      sync: bindActionCreators(syncActions, dispatch)
    };
  }
)(App);
