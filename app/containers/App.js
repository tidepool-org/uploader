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

import ClinicUserBlock from '../components/ClinicUserBlock';
import ClinicUserEdit from '../components/ClinicUserEdit';
import ClinicUserSelect from '../components/ClinicUserSelect';
import ClinicUploadDone from '../components/ClinicUploadDone';
import NoUploadTargets from '../components/NoUploadTargets';
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
    this.handleClickChangePerson = this.handleClickChangePerson.bind(this);
    this.handleClickEditUser = this.handleClickEditUser.bind(this);
    let api = this.props.route.api;
    this.props.async.doAppInit(Object.assign({}, config, {os: props.os}), {
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
    const { setPage, toggleDropdown } = this.props.sync;
    // ensure dropdown closes after click
    setPage(pages.SETTINGS, true, metric);
    toggleDropdown(true, actionSources.UNDER_THE_HOOD);
  }

  handleClickChangePerson(metric = {metric: {eventName: metrics.CLINIC_SEARCH_DISPLAYED}}) {
    const { setPage, setUploadTargetUser } = this.props.sync;
    setUploadTargetUser(null);
    setPage(pages.CLINIC_USER_SELECT, undefined, metric);
  }

  handleClickEditUser() {
    const { setPage } = this.props.sync;
    setPage(pages.CLINIC_USER_EDIT, undefined, {metric: {eventName: metrics.CLINIC_EDIT_INFO}});
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
    const { allUsers, dropdown, isLoggedIn, page } = this.props;
    if (page === pages.LOADING) {
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

  renderPage() {
    const { page, unsupported, uploadTargetUser } = this.props;

    let userDropdown = this.props.showingUserSelectionDropdown ?
      this.renderUserDropdown() : null;

    let changePersonLink = null;
    let clinicUserBlock = null;

    if(this.props.isClinicAccount){
      changePersonLink = this.renderChangePersonLink();
      clinicUserBlock = this.renderClinicUserBlock();
    }

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
      let timezoneDropdown = null;
      let viewDataLinkButton = this.renderUploadListDoneButton();
      if(!this.props.isClinicAccount){
        timezoneDropdown = this.renderTimezoneDropdown();
      }
      return (
        <div className={styles.mainWrap}>
          {userDropdown}
          {timezoneDropdown}
          {changePersonLink}
          {clinicUserBlock}
          <UploadList
            disabled={Boolean(unsupported) || !Boolean(this.props.selectedTimezone)}
            targetId={uploadTargetUser}
            uploads={this.props.activeUploads}
            userDropdownShowing={this.props.showingUserSelectionDropdown}
            onReset={this.props.sync.resetUpload}
            onUpload={this.props.async.doUpload}
            readFile={this.props.async.readFile}
            toggleErrorDetails={this.props.sync.toggleErrorDetails}
            updateProfileErrorMessage={this.props.updateProfileErrorMessage}
            isClinicAccount={this.props.isClinicAccount}
            onChooseDevices={_.partial(this.handleClickChooseDevices, {metric: {eventName: metrics.CLINIC_CHANGE_DEVICES}})}
            timezoneIsSelected={Boolean(this.props.selectedTimezone)}
            isUploadInProgress={this.props.uploadIsInProgress} />
          {viewDataLinkButton}
        </div>
      );
    } else if (page === pages.NO_UPLOAD_TARGETS) {
      const newPatientLink = _.get(this.props, ['blipUrls', 'newPatient'], '');
      return (
        <div>
          <NoUploadTargets
            newPatientLink={newPatientLink} />
        </div>
      );
    } else if (page === pages.SETTINGS) {
      return (
        <div>
          {userDropdown}
          {changePersonLink}
          {clinicUserBlock}
          <DeviceSelection
            disabled={Boolean(unsupported)}
            devices={this.props.devices}
            os={this.props.os}
            targetDevices={this.props.selectedTargetDevices}
            targetId={uploadTargetUser}
            timezoneIsSelected={Boolean(this.props.selectedTimezone)}
            userDropdownShowing={this.props.showingUserSelectionDropdown}
            isClinicAccount={this.props.isClinicAccount}
            userIsSelected={uploadTargetUser !== null}
            addDevice={this.props.sync.addTargetDevice}
            removeDevice={this.props.sync.removeTargetDevice}
            onDone={this.props.async.clickDeviceSelectionDone} />
        </div>
      );
    } else if (page === pages.CLINIC_USER_SELECT) {
      const { allUsers, page, targetUsersForUpload, uploadTargetUser } = this.props;
      return (
        <div>
          <ClinicUserSelect
            allUsers={allUsers}
            onUserChange={this.props.async.checkUploadTargetUserAndMaybeRedirect}
            page={page}
            targetId={uploadTargetUser}
            targetUsersForUpload={targetUsersForUpload}
            onAddUserClick={this.props.async.clickAddNewUser}
            setTargetUser={this.props.sync.setUploadTargetUser} />
        </div>
      );
    } else if (page === pages.CLINIC_USER_EDIT) {
      const { allUsers, page, targetUsersForUpload, uploadTargetUser } = this.props;
      return (
        <div>
          <ClinicUserEdit
            targetId={uploadTargetUser}
            allUsers={allUsers}
            loggedInUser={this.props.loggedInUser}
            createUser={this.props.async.createCustodialAccount}
            updateUser={this.props.async.clickEditUserNext}
            cancelEdit={_.partial(this.handleClickChangePerson, {metric: {eventName: metrics.CLINIC_ADD_CANCEL}})}
            createCustodialAccountErrorMessage={this.props.createCustodialAccountErrorMessage}
            createCustodialAccountErrorDismissed={this.props.createCustodialAccountErrorDismissed}
            updateProfileErrorMessage={this.props.updateProfileErrorMessage}
            updateProfileErrorDismissed={this.props.updateProfileErrorDismissed}
            dismissCreateCustodialAccountError={this.props.sync.dismissCreateCustodialAccountError}
            dismissUpdateProfileError={this.props.sync.dismissUpdateProfileError}
            onSubmitFail={this.props.sync.clinicInvalidDate} />
        </div>
      );
    } else {
      throw new Error('Unrecognized page!');
    }
  }

  renderFooter() {
    const { version } = this.props;
    return (
      <div className={styles.footerRow}>
        <div className={styles.version}>{`v${version} beta`}</div>
        <div className="mailto">
          <a className={styles.footerLink} href="mailto:support@tidepool.org?Subject=Feedback on Uploader" target="mailto">Get support</a>
        </div>
      </div>
    );
  }

  renderTimezoneDropdown() {
    const { uploadTargetUser } = this.props;
    return (
      <TimezoneDropdown
        onTimezoneChange={this.props.async.setTargetTimezone}
        selectorLabel={'Time zone'}
        targetId={uploadTargetUser || null}
        targetTimezone={this.props.selectedTimezone}
        updateProfileErrorMessage={this.props.updateProfileErrorMessage}
        updateProfileErrorDismissed={this.props.updateProfileErrorDismissed}
        dismissUpdateProfileError={this.props.sync.dismissUpdateProfileError}
        isClinicAccount={this.props.isClinicAccount}
        userDropdownShowing={this.props.showingUserSelectionDropdown}
        isUploadInProgress={this.props.uploadIsInProgress} />
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

  renderChangePersonLink() {
    var classes = cx({
      [styles.changePerson]: true,
      [styles.linkDisabled]: this.props.uploadIsInProgress
    });
    return (
      <div className={classes}
        onClick={this.props.uploadIsInProgress ? this.noopHandler : _.partial(this.handleClickChangePerson, {metric: {eventName: metrics.CLINIC_CHANGE_PERSON}})}>Change Person</div>
    );
  }

  renderClinicUserBlock() {
    const { page, isClinicAccount } = this.props;
    if (!isClinicAccount) return null;
    let timezoneDropdown = (page === pages.MAIN) ? this.renderTimezoneDropdown() : null;
    return (
      <ClinicUserBlock
        allUsers={this.props.allUsers}
        targetId={this.props.uploadTargetUser}
        timezoneDropdown={timezoneDropdown}
        onEditUser={this.handleClickEditUser}
        isUploadInProgress={this.props.uploadIsInProgress} />
    );
  }

  renderUploadListDoneButton() {
    const { isClinicAccount } = this.props;
    if (isClinicAccount) {
      return <ClinicUploadDone
        onClicked= {this.handleClickChangePerson}
        uploadTargetUser={this.props.uploadTargetUser}
        uploadsByUser={this.props.uploadsByUser} />;
    } else {
      const viewDataLink = _.get(this.props, ['blipUrls', 'viewDataLink'], '');
      return <ViewDataLink
        href={viewDataLink}
        onViewClicked={this.props.sync.clickGoToBlip} />;
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
    function isClinicAccount(state) {
      return _.indexOf(_.get(_.get(state.allUsers, state.loggedInUser, {}), 'roles', []), 'clinic') !== -1;
    }
    function shouldShowUserSelectionDropdown(state) {
      if (!_.isEmpty(state.targetUsersForUpload) && !isClinicAccount(state)) {
        // if there's only one potential target for upload but it's *not* the loggedInUser
        if (state.targetUsersForUpload.length === 1 &&
          !_.includes(state.targetUsersForUpload, state.loggedInUser)) {
          return true;
        }
        if (state.targetUsersForUpload.length > 1) {
          return true;
        }
      }
      return false;
    }
    return {
      // plain state
      allUsers: state.allUsers,
      blipUrls: state.blipUrls,
      devices: state.devices,
      dropdown: state.dropdown,
      loggedInUser: state.loggedInUser,
      loginErrorMessage: state.loginErrorMessage,
      updateProfileErrorMessage: state.updateProfileErrorMessage,
      updateProfileErrorDismissed: state.updateProfileErrorDismissed,
      createCustodialAccountErrorMessage: state.createCustodialAccountErrorMessage,
      createCustodialAccountErrorDismissed: state.createCustodialAccountErrorDismissed,
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
      showingUserSelectionDropdown: shouldShowUserSelectionDropdown(state),
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
