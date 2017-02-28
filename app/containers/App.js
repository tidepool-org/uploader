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
import cx from 'classnames';

import bows from '../../lib/bows.js';

import config from '../../lib/config.js';

import carelink from '../../lib/core/carelink.js';
import device from '../../lib/core/device.js';
import localStore from '../../lib/core/localStore.js';

import actions from '../actions/';
const asyncActions = actions.async;
const syncActions = actions.sync;

import * as actionTypes from '../constants/actionTypes';
import * as actionSources from '../constants/actionSources';
import { pages, urls } from '../constants/otherConstants';
import * as metrics from '../constants/metrics';
import { checkVersion } from '../utils/drivers';

import Loading from '../components/Loading';
import LoggedInAs from '../components/LoggedInAs';
import UpdatePlease from '../components/UpdatePlease';
import VersionCheckError from '../components/VersionCheckError';

import styles from '../../styles/components/App.module.less';

export class App extends Component {
  static propTypes = {
    // api: PropTypes.func.isRequired
  };

  constructor(props) {
    super(props);
    this.log = bows('App');
    this.handleClickChooseDevices = this.handleClickChooseDevices.bind(this);
    this.handleDismissDropdown = this.handleDismissDropdown.bind(this);
  }

  componentWillMount(){
    checkVersion();
    let api = this.props.route.api;
    this.props.async.doAppInit(Object.assign({}, config), {
      api: api,
      carelink,
      device,
      localStore,
      log: this.log
    });
  }

  render() {
    const { isLoggedIn, page } = this.props;
    return (
      <div className={styles.app} onClick={this.handleDismissDropdown}>
        <div className={styles.header}>{this.renderHeader()}</div>
        {this.props.children}
        {/* <div className={styles[page.toLowerCase() + 'Page']}>{this.renderPage()}</div> */}
        <div className={styles.footer}>{this.renderFooter()}</div>
        {/* VersionCheck as overlay */}
        {this.renderVersionCheck()}
      </div>
    );
  }

  handleClickChooseDevices(metric) {
    const { toggleDropdown } = this.props.sync;
    const { setPage } = this.props.async;
    // ensure dropdown closes after click
    setPage(pages.SETTINGS, true, metric);
    toggleDropdown(true, actionSources.UNDER_THE_HOOD);
  }

  handleDismissDropdown() {
    const { dropdown } = this.props;
    // only toggle the dropdown by clicking elsewhere if it's open
    if (dropdown === true) {
      this.props.sync.toggleDropdown(dropdown);
    }
  }

  noopHandler(e) {
    e.preventDefault();
  }

  renderHeader() {
    const { allUsers, dropdown, isLoggedIn, page, route } = this.props;
    if (route.path === '/loading') {
      return null;
    }

    if (!isLoggedIn) {
      return (
        <div className={styles.signup}>
          <a className={styles.signupLink} href={this.props.blipUrls.signUp} target="_blank">
            <i className={styles.signupIcon}> Sign up</i></a>
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
        user={allUsers[this.props.loggedInUser]}
        isClinicAccount={this.props.isClinicAccount}
        targetUsersForUpload={this.props.targetUsersForUpload} />
    );
  }

  renderFooter() {
    const { version } = config;
    return (
      <div className={styles.footerRow}>
        <div className={styles.version}>{`v${version} beta`}</div>
        <div className="mailto">
          <a className={styles.footerLink} href="mailto:support@tidepool.org?Subject=Feedback on Uploader" target="mailto">Get support</a>
        </div>
      </div>
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
    function isClinicAccount(state) {
      return _.indexOf(_.get(_.get(state.allUsers, state.loggedInUser, {}), 'roles', []), 'clinic') !== -1;
    }
    return {
      // plain state
      allUsers: state.allUsers,
      blipUrls: state.blipUrls,
      dropdown: state.dropdown,
      loggedInUser: state.loggedInUser,
      page: state.page,
      targetUsersForUpload: state.targetUsersForUpload,
      unsupported: state.unsupported,
      uploadIsInProgress: state.working.uploading,
      uploadTargetUser: state.uploadTargetUser,
      // derived state
      isLoggedIn: hasSomeoneLoggedIn(state),
      readyToRenderVersionCheckOverlay: (
        !state.working.initializingApp && !state.working.checkingVersion
      ),
      isClinicAccount: isClinicAccount(state)
    };
  },
  (dispatch) => {
    return {
      async: bindActionCreators(asyncActions, dispatch),
      sync: bindActionCreators(syncActions, dispatch)
    };
  }
)(App);
