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

var styles = require('../../styles/components/LoggedInAs.module.less');

var LoggedInAs = React.createClass({
  propTypes: {
    dropMenu: React.PropTypes.bool.isRequired,
    isUploadInProgress: React.PropTypes.bool.isRequired,
    onChooseDevices: React.PropTypes.func.isRequired,
    onClicked: React.PropTypes.func.isRequired,
    onLogout: React.PropTypes.func.isRequired,
    user: React.PropTypes.object,
    isClinicAccount: React.PropTypes.bool,
    targetUsersForUpload: React.PropTypes.array
  },

  getInitialState: function() {
    return {
      loggingOut: false
    };
  },

  render: function() {
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
  },

  renderDropMenu: function() {
    function stopPropagation(e) {
      e.stopPropagation();
    }
    return (
      <div className={styles.dropdown} onClick={stopPropagation}>
        <ul>
          {this.renderChooseDevices()}
          <li>{this.renderLogout()}</li>
        </ul>
      </div>
    );
  },

  renderChooseDevices: function() {
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
  },

  renderLogout: function() {
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
  },

  getName: function() {
    return _.get(this.props.user, ['profile', 'fullName']);
  },

  noopHandler: function(e) {
    if (e) {
      e.preventDefault();
    }
  },

  handleChooseDevices: function(e) {
    e.preventDefault();
    this.props.onChooseDevices();
  },

  handleLogout: function(e) {
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
});

module.exports = LoggedInAs;
