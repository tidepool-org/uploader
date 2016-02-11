/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014-2016, Tidepool Project
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
const asyncActions = actions.async;
const syncActions = actions.sync;

import * as actionTypes from '../redux/constants/actionTypes';
import * as actionSources from '../redux/constants/actionSources';
import { pages, urls } from '../redux/constants/otherConstants';

import DeviceSelection from '../components/DeviceSelection';
import Loading from '../components/Loading';
import Login from '../components/Login';
import LoggedInAs from '../components/LoggedInAs';
import TimezoneDropdown from '../components/TimezoneDropdown';
import UploadList from '../components/UploadList';
import UpdatePlease from '../components/UpdatePlease';
import UserDropdown from '../components/UserDropdown';
import VersionCheckError from '../components/VersionCheckError';
import ViewDataLink from '../components/ViewDataLink';

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
        {/* VersionCheck as overlay */}
        {this.renderVersionCheck()}
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
    const { allUsers, dropdown, isLoggedIn, page } = this.props;
    if (page === pages.LOADING) {
      return null;
    }

    if (!isLoggedIn) {
      return (
        <div className="App-signup">
          <a  href={this.props.blipUrls.signUp} target="_blank">
            <i className="icon-add"> Sign up</i></a>
        </div>
      );
    }

    return (
      <LoggedInAs
        dropMenu={dropdown}
        isUploadInProgress={this.props.uploadIsInProgress}
        onChooseDevices={this.handleClickChooseDevices}
        onClicked={this.props.sync.toggleDropdown.bind(this, this.props.dropdown)}
        onLogout={this.props.async.doLogout}
        user={allUsers[this.props.loggedInUser]} />
    );
  }

  renderPage() {
    const { page, unsupported, uploadTargetUser } = this.props;

    let userDropdown = this.props.showingUserSelectionDropdown ?
      this.renderUserDropdown() : null;

    if (page === pages.LOADING) {
      return (<Loading />);
    } else if (page === pages.LOGIN) {
      return (
        <Login 
          disabled={Boolean(unsupported)}
          errorMessage={this.props.loginErrorMessage}
          forgotPasswordUrl={this.props.blipUrls.forgotPassword}
          isFetching={this.props.fetchingUserInfo}
          onLogin={this.props.async.doLogin} />
        );
    } else if (page === pages.MAIN) {
      const viewDataLink = _.get(this.props, ['blipUrls', 'viewDataLink'], '');
      return (
        <div>
          {userDropdown}
          <UploadList
            disabled={Boolean(unsupported)}
            targetId={uploadTargetUser}
            uploads={this.props.activeUploads}
            userDropdownShowing={this.props.showingUserSelectionDropdown}
            onReset={this.props.sync.resetUpload}
            onUpload={this.props.async.doUpload}
            readFile={this.props.async.readFile}
            toggleErrorDetails={this.props.sync.toggleErrorDetails} />
          <ViewDataLink
            href={viewDataLink}
            onViewClicked={this.props.sync.clickGoToBlip} />
        </div>
      );
    } else if (page === pages.SETTINGS) {
      let timezoneDropdown = this.renderTimezoneDropdown();
      return (
        <div>
          {userDropdown}
          {timezoneDropdown}
          <DeviceSelection
            disabled={Boolean(unsupported)}
            devices={this.props.devices}
            os={this.props.os}
            targetDevices={this.props.selectedTargetDevices}
            targetId={uploadTargetUser}
            timezoneIsSelected={Boolean(this.props.selectedTimezone)}
            userDropdownShowing={this.props.showingUserSelectionDropdown}
            userIsSelected={uploadTargetUser !== null}
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
    const { uploadTargetUser } = this.props;
    return (
      <TimezoneDropdown
        onTimezoneChange={this.props.sync.setTargetTimezone}
        selectorLabel={'Choose timezone'}
        targetId={uploadTargetUser || null}
        targetTimezone={this.props.selectedTimezone} />
    );
  }

  renderUserDropdown() {
    const { allUsers, page, targetUsersForUpload, uploadTargetUser } = this.props;
    return (
      <UserDropdown
        allUsers={allUsers}
        isUploadInProgress={this.props.uploadIsInProgress}
        onGroupChange={this.props.async.setUploadTargetUserAndMaybeRedirect}
        page={page}
        targetId={uploadTargetUser}
        targetUsersForUpload={targetUsersForUpload} />
    );
  }

  renderVersionCheck() {
    const { readyToRenderVersionCheckOverlay, unsupported } = this.props;
    if (readyToRenderVersionCheckOverlay === false || unsupported === false) {
      return null;
    }
    if (unsupported instanceof Error) {
      return (
        <VersionCheckError errorMessage={unsupported.message || 'Unknown error'}/>
      );
    }
    if (unsupported === true) {
      return (
        <UpdatePlease knowledgeBaseLink={urls.HOW_TO_UPDATE_KB_ARTICLE} />
      );
    }
  }
}

App.propTypes = {
  page: React.PropTypes.string.isRequired
};

// wrap the component to inject dispatch and state into it
export default connect(
  (state) => {
    function getActiveUploads(state) {
      const { devices, uploadsByUser, uploadTargetUser } = state;
      if (uploadTargetUser === null) {
        return [];
      }
      let activeUploads = [];
      const targetUsersUploads = _.get(uploadsByUser, uploadTargetUser, []);
      _.map(Object.keys(targetUsersUploads), (deviceKey) => {
        const upload = uploadsByUser[uploadTargetUser][deviceKey];
        const device = _.pick(devices[deviceKey], ['instructions', 'key', 'name', 'source']);
        const progress = upload.uploading ? {progress: state.uploadProgress} :
          (upload.successful ? {progress: {percentage: 100}} : {});
        activeUploads.push(_.assign({}, device, upload, progress));
      });
      return activeUploads;
    }
    function hasSomeoneLoggedIn(state) {
      return !_.includes([pages.LOADING, pages.LOGIN], state.page);
    }
    function isUploadInProgress(state) {
      let blockModePrepInProgress = false;
      if (state.uploadTargetDevice !== null) {
        const currentDevice = state.devices[state.uploadTargetDevice];
        if (currentDevice.source.type === 'block') {
          let blockModeInProgress = _.get(state.uploadsByUser, [state.uploadTargetUser, currentDevice.key], {});
          if (blockModeInProgress.choosingFile || blockModeInProgress.readingFile ||
            _.get(blockModeInProgress, ['file', 'data'], null) !== null) {
            blockModePrepInProgress = true;
          }
        }
      }
      if (state.working.uploading || blockModePrepInProgress) {
        return true;
      }
      else {
        return false;
      }
    }
    function getPotentialUploadsForUploadTargetUser(state) {
      return Object.keys(
        _.get(state, ['uploadsByUser', state.uploadTargetUser], {})
      );
    }
    function getSelectedTargetDevices(state) {
      return _.get(
        state,
        ['targetDevices', state.uploadTargetUser],
        // fall back to the targets stored under 'noUserSelected', if any
        _.get(state, ['targetDevices', 'noUserSelected'], [])
      );
    }
    function getSelectedTimezone(state) {
      return _.get(
        state,
        ['targetTimezones', state.uploadTargetUser],
        // fall back to the timezone stored under 'noUserSelected', if any
        _.get(state, ['targetTimezones', 'noUserSelected'], null)
      );
    }
    function shouldShowUserSelectionDropdown(state) {
      return !_.isEmpty(state.targetUsersForUpload) &&
        state.targetUsersForUpload.length > 1;
    }
    return {
      // plain state
      allUsers: state.allUsers,
      blipUrls: state.blipUrls,
      devices: state.devices,
      dropdown: state.dropdown,
      loggedInUser: state.loggedInUser,
      loginErrorMessage: state.loginErrorMessage,
      os: state.os,
      page: state.page,
      targetUsersForUpload: state.targetUsersForUpload,
      unsupported: state.unsupported,
      uploadIsInProgress: state.working.uploading,
      uploadsByUser: state.uploadsByUser,
      uploadTargetUser: state.uploadTargetUser,
      // derived state
      activeUploads: getActiveUploads(state),
      fetchingUserInfo: state.working.fetchingUserInfo,
      isLoggedIn: hasSomeoneLoggedIn(state),
      potentialUploads: getPotentialUploadsForUploadTargetUser(state),
      readyToRenderVersionCheckOverlay: (
        !state.working.initializingApp && !state.working.checkingVersion
      ),
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
