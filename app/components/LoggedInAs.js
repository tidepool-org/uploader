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
import { ipcRenderer } from 'electron';

import styles from '../../styles/components/LoggedInAs.module.less';

export default class LoggedInAs extends Component {
  static propTypes = {
    dropMenu: React.PropTypes.bool.isRequired,
    isUploadInProgress: React.PropTypes.bool.isRequired,
    onChooseDevices: React.PropTypes.func.isRequired,
    onClicked: React.PropTypes.func.isRequired,
    onLogout: React.PropTypes.func.isRequired,
    user: React.PropTypes.object,
    isClinicAccount: React.PropTypes.bool,
    targetUsersForUpload: React.PropTypes.array
  }

  constructor(props) {
    super(props);
    this.state = { loggingOut: false };

    this.handleChooseDevices = this.handleChooseDevices.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
  }

  noopHandler(e) {
    if (e) {
      e.preventDefault();
    }
  }

  handleChooseDevices(e) {
    e.preventDefault();
    this.props.onChooseDevices();
  }

  handleCheckForUpdates(e) {
    e.preventDefault();
    ipcRenderer.send('autoUpdater','checkForUpdates');
  }

  handleLogout(e) {
    e.preventDefault();
    this.setState({
      loggingOut: true
    });
    var self = this;
    this.props.onLogout(function(err) {
      if (err) {
        self.setState({
          loggingOut: false
        });
      }
    });
  }
  renderChooseDevices() {
    var title = '';
    var uploadInProgress = this.props.isUploadInProgress;
    var isDisabled = uploadInProgress;

    if (this.props.isClinicAccount) {
      return null;
    }

    if (_.isEmpty(this.props.targetUsersForUpload)) {
      isDisabled = true;
    }


    if (uploadInProgress) {
      title = 'Upload in progress!\nPlease wait to change device selection.';
    } else if (isDisabled) {
      title = 'Set up data storage to upload devices.';
    }

    return (
      <li>
        <a className={styles.link}
          disabled={isDisabled}
          href=""
          onClick={isDisabled ? this.noopHandler : this.handleChooseDevices}
          title={title}>
          <i className={styles.editIcon}></i>
          Choose Devices
        </a>
      </li>
    );
  }

  renderCheckForUpdates() {
    return (
      <li>
        <a className={styles.link}
          onClick={this.handleCheckForUpdates}
          href=""
          title="Check for Updates">
          <i className={styles.updateIcon}></i>
          Check for Updates
        </a>
      </li>
    );
  }

  renderLogout() {
    var uploadInProgress = this.props.isUploadInProgress;

    if (this.state.loggingOut) {
      return <span className={styles.link}>Logging out...</span>;
    }

    return (
      <a className={styles.link}
        disabled={uploadInProgress}
        href=""
        onClick={uploadInProgress ? this.noopHandler : this.handleLogout}
        title={uploadInProgress ? 'Upload in progress!\nPlease wait to log out.' : ''}>
        <i className={styles.logoutIcon}></i>
        Logout
      </a>
    );
  }

  renderDropMenu() {
    function stopPropagation(e) {
      e.stopPropagation();
    }
    return (
      <div className={styles.dropdown} onClick={stopPropagation}>
        <ul>
          {this.renderChooseDevices()}
          {this.renderCheckForUpdates()}
          <li>{this.renderLogout()}</li>
        </ul>
      </div>
    );
  }



  render() {
    var dropMenu = this.props.dropMenu ? this.renderDropMenu() : null;
    var user = this.props.user;

    return (
      <div className={styles.wrapper}>
        <div className={styles.main} onClick={this.props.onClicked}>
          <span className={styles.name}>{_.get(user, 'fullName', '')}</span>
          <i className={styles.downArrow}></i>
        </div>
        {dropMenu}
      </div>
    );
  }
};
