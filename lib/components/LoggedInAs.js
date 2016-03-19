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
var getIn = require('../core/getIn');

var LoggedInAs = React.createClass({
  propTypes: {
    dropMenu: React.PropTypes.bool.isRequired,
    isUploadInProgress: React.PropTypes.bool.isRequired,
    onChooseDevices: React.PropTypes.func.isRequired,
    onClicked: React.PropTypes.func.isRequired,
    onLogout: React.PropTypes.func.isRequired,
    user: React.PropTypes.object
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
      <div className="LoggedInAsWrapper">
        <div className="LoggedInAs" onClick={this.props.onClicked}>
          <span>{_.get(user, 'fullName', '')}</span>
          <i className="Menu-arrow-down icon-arrow-down"></i>
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
      <div className="Menu-dropdown" onClick={stopPropagation}>
        <ul>
          <li>{this.renderChooseDevices()}</li>
          <li>{this.renderLogout()}</li>
        </ul>
      </div>
    );
  },

  renderChooseDevices: function() {
    var uploadInProgress = this.props.isUploadInProgress;

    var noopHandler = function(e) {
      if (e) {
        e.preventDefault();
      }
    };
    return (
      <a className="LoggedInAs-link"
        disabled={uploadInProgress}
        href=""
        onClick={uploadInProgress ? noopHandler : this.handleChooseDevices}
        title={uploadInProgress ? 'Upload in progress!\nPlease wait to change device selection.' : ''}>
        <i className="icon-edit"></i>
        Choose Devices
      </a>
    );
  },

  renderLogout: function() {
    if (this.state.loggingOut) {
      return <span className="LoggedInAs-link">Logging out...</span>;
    }

    return (
      <a className="LoggedInAs-link"
        href=""
        onClick={this.handleLogout}>
        <i className="icon-logout"></i>
        Logout
      </a>
    );
  },

  getName: function() {
    return getIn(this.props.user, ['profile', 'fullName']);
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
