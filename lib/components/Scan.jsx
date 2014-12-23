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
var bows = require('../bows');
var repeat = require('../core/repeat');

var DETECT_DELAY = 120000; // Scan every X milliseconds
var DETECT_TIMEOUT = null; // Scan forever

var Scan = React.createClass({
  propTypes: {
    onDetectDevices: React.PropTypes.func.isRequired
  },

  log: bows('Scan'),

  getInitialState: function() {
    return {
      scanning: true,
      error: null
    };
  },

  stopScanning: _.noop,

  componentDidMount: function() {
    this.log('Start scanning for devices...');
    this.startScanning();
  },

  componentWillUnmount: function() {
    this.log('Stop scanning for devices');
    //this.stopScanning();
  },

  render: function() {
    return (
      <div className="Scan">
        {this.renderError()}
        {this.renderScan()}
      </div>
    );
  },

  renderError: function() {
    if (!this.state.error) {
      return null;
    }

    return (
      <div className="Scan-status Scan-status--error">
        {'An error occured while scanning for devices.'}
      </div>
    );
  },

  renderScan: function() {
    if (this.state.scanning) {
      return null;
    }

    return (
      <div className="Scan-status">
        <button className="btn btn-secondary" onClick={this.startScanning}>
          {'Scan for devices'}
        </button>
      </div>
    );
  },

  startScanning: function() {
    this.setState({
      scanning: true,
      error: null
    });

    this.stopScanning = repeat(
      this.props.onDetectDevices, DETECT_DELAY, DETECT_TIMEOUT, this.handleScanEnd
    );
  },

  handleScanEnd: function(err) {
    this.setState({
      scanning: false,
      error: err
    });
  }
});

module.exports = Scan;
