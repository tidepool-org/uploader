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
var Devices = require('./Devices.jsx');

var config = require('../config');

var MainPage = React.createClass({
  propTypes: {
    devices: React.PropTypes.array.isRequired,
    history: React.PropTypes.array.isRequired,
    onDetectDevices: React.PropTypes.func.isRequired,
    onOpenUpload: React.PropTypes.func.isRequired
  },

  render: function() {
    return (
      <div>
        <Devices
          devices={this.props.devices}
          onDetectDevices={this.props.onDetectDevices}
          onOpenUpload={this.props.onOpenUpload}/>
        {this.renderCarelink()}
      </div>
    );
  },

  renderCarelink: function() {
    if (!this.isCarelinkEnabled()) {
      return null;
    }
    return (
      <p>
        <a href="" onClick={this.handleSelectCarelink}>Upload Carelink data</a>
      </p>
    );
  },

  isCarelinkEnabled: function() {
    return config.CARELINK;
  },

  handleSelectCarelink: function(e) {
    e.preventDefault();
    this.props.onOpenUpload({
      carelink: true
    });
  }
});

module.exports = MainPage;
