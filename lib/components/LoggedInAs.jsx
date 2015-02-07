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

var React = require('react');
var getIn = require('../core/getIn');
var cx = require('react/lib/cx');

var LoggedInAs = React.createClass({
  propTypes: {
    user: React.PropTypes.object.isRequired,
    onLogout: React.PropTypes.func.isRequired
  },

  getInitialState: function() {
    return {
      loggingOut: false,
      showDropdown: false
    };
  },

  render: function() {
    var dropdownClasses = cx({
      'Menu-dropdown': true,
      'Menu-dropdown-hide': !this.state.showDropdown
    });

    return (
      <div>
        <div className="LoggedInAs" onClick={this.toggleDropdown}>
          <span>{this.getName()}</span>
          <i className="Menu-arrow-down icon-arrow-down"></i>
        </div>
        <div className={dropdownClasses} onClick={this.stopPropagation}>
          <ul>
            <li><i className="icon-edit"></i>Choose Devices</li>
            <li>{this.renderLogout()}</li>
          </ul>
        </div>
      </div>
    );
  },

  renderLogout: function() {
    if (this.state.loggingOut) {
      return <span className="LoggedInAs-logout">Logging out...</span>;
    }

    return <a className="LoggedInAs-logout" href="" onClick={this.handleLogout}><i className="icon-logout"></i>Logout</a>;
  },

  getName: function() {
    return getIn(this.props.user, ['profile', 'fullName']);
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
  },

  toggleDropdown: function(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    this.setState({showDropdown: !this.state.showDropdown});
  },

  stopPropagation: function(e) {
    e.stopPropagation();
  },

  hideDropdown: function()  {
    if (this.state.showDropdown) {
      this.setState({showDropdown: false});
    }
  },
});

module.exports = LoggedInAs;
