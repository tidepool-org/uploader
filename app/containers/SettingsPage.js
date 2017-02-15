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

import _ from 'lodash';
import React, { Component } from 'react';
import DeviceSelection from '../components/DeviceSelection';
import UserDropdown from '../components/UserDropdown';
import ClinicUserBlock from '../components/ClinicUserBlock';
import cx from 'classnames';
import styles from '../../styles/components/App.module.less';
import { pages, urls } from '../constants/otherConstants';
import * as metrics from '../constants/metrics';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import actions from '../actions/';
const asyncActions = actions.async;
const syncActions = actions.sync;

export class SettingsPage extends Component {
  constructor(props) {
    super(props);
    this.handleClickChangePerson = this.handleClickChangePerson.bind(this);
    this.handleClickEditUser = this.handleClickEditUser.bind(this);
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

  renderChangePersonLink() {
    var classes = cx({
      [styles.changePerson]: true,
      [styles.linkDisabled]: this.props.uploadIsInProgress
    });
    return (
      <div className={classes}
        onClick={this.props.uploadIsInProgress ?
          this.noopHandler :
          _.partial(this.handleClickChangePerson, {metric: {eventName: metrics.CLINIC_CHANGE_PERSON}})}>Change Person</div>
    );
  }

  renderClinicUserBlock() {
    const { page, isClinicAccount } = this.props;
    if (!isClinicAccount) return null;
    return (
      <ClinicUserBlock
        allUsers={this.props.allUsers}
        targetId={this.props.uploadTargetUser}
        timezoneDropdown={null}
        onEditUser={this.handleClickEditUser}
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

  render() {
    let userDropdown = this.props.showingUserSelectionDropdown ?
      this.renderUserDropdown() : null;

    let changePersonLink = null;
    let clinicUserBlock = null;

    if(this.props.isClinicAccount){
      changePersonLink = this.renderChangePersonLink();
      clinicUserBlock = this.renderClinicUserBlock();
    }

    return (
      <div>
        {userDropdown}
        {changePersonLink}
        {clinicUserBlock}
        <DeviceSelection
          addDevice={this.props.sync.addTargetDevice}
          devices={this.props.devices}
          disabled={this.props.disabled}
          isClinicAccount={this.props.isClinicAccount}
          onDone={this.props.async.clickDeviceSelectionDone}
          removeDevice={this.props.sync.removeTargetDevice}
          targetDevices={this.props.targetDevices}
          targetId={this.props.uploadTargetUser}
          timezoneIsSelected={Boolean(this.props.selectedTimezone)}
          userDropdownShowing={this.props.showingUserSelectionDropdown}
          userIsSelected={this.props.uploadTargetUser !== null} />
      </div>
    );
  }
}

export default connect(
  (state, ownProps) => {
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
      allUsers: state.allUsers,
      devices: state.devices,
      disabled: Boolean(state.unsupported),
      errorMessage: state.loginErrorMessage,
      forgotPasswordUrl: state.blipUrls.forgotPassword,
      isClinicAccount: isClinicAccount(state),
      isFetching: state.working.fetchingUserInfo,
      page: state.page,
      selectedTimezone: getSelectedTimezone(state),
      showingUserSelectionDropdown: shouldShowUserSelectionDropdown(state),
      targetDevices: getSelectedTargetDevices(state),
      targetUsersForUpload: state.targetUsersForUpload,
      uploadIsInProgress: state.working.uploading,
      uploadTargetUser: state.uploadTargetUser,
    };
  },
  (dispatch) => {
    return {
      async: bindActionCreators(asyncActions, dispatch),
      sync: bindActionCreators(syncActions, dispatch)
    };
  }
)(SettingsPage);
