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
var deviceInfo = require('../core/deviceInfo');

var UploadPage = React.createClass({
  propTypes: {
    upload: React.PropTypes.object.isRequired,
    progress: React.PropTypes.object,
    onUploadDevice: React.PropTypes.func.isRequired,
    onUploadCarelink: React.PropTypes.func.isRequired,
    onCloseUpload: React.PropTypes.func.isRequired
  },

  getInitialState: function() {
    return {
      working: false,
      error: null
    };
  },

  render: function() {
    return (
      <div>
        {this.renderUploadInfo()}
        {this.renderCarelinkForm()}
        {this.renderButton()}
        {this.renderProgress()}
        {this.renderSuccess()}
        {this.renderError()}
        {this.renderClose()}
      </div>
    );
  },

  renderUploadInfo: function() {
    var name;
    if (this.isCarelinkUpload()) {
      name = 'Carelink';
    }
    else {
      name = this.getDeviceDisplayName(this.props.upload);
    }
    return (
      <p>
        {'Upload for '}
        <strong>{name}</strong>
      </p>
    );
  },

  renderCarelinkForm: function() {
    if (!this.isCarelinkUpload()) {
      return null;
    }

    return (
      <form>
        <p><input ref="username" placeholder="carelink username"/></p>
        <p><input ref="password" placeholder="carelink password"/></p>
      </form>
    );
  },

  renderButton: function() {
    if (this.state.working) {
      return null;
    }

    return (
      <p>
        <button onClick={this.handleUpload}>Upload</button>
      </p>
    );
  },

  renderProgress: function() {
    var progress = this.props.progress;
    if (!progress || this.isUploadSuccessful()) {
      return null;
    }
    return (
      <p>
        {progress.percentage + '%'}
        <br />
        {progress.step + '...'}
      </p>
    );
  },

  renderSuccess: function() {
    if (!this.isUploadSuccessful()) {
      return null;
    }

    return (
      <p style={{color: 'green'}}>
        {'Successfully uploaded ' + this.props.upload.count + ' data points!'}
      </p>
    );
  },

  renderClose: function() {
    if (this.props.progress && !this.isUploadSuccessful()) {
      return null;
    }

    return (
      <p>
        <a href="" onClick={this.handleClose}>Close</a>
      </p>
    );
  },

  renderError: function() {
    if (!this.state.error) {
      return null;
    }

    return <p style={{color: 'red'}}>{this.state.error}</p>;
  },

  getDeviceDisplayName: function(device) {
    var getDisplayName = getIn(
      deviceInfo,
      [device.driverId, 'getDisplayName'],
      function() { return 'Unknown device'; }
    );
    return getDisplayName(device);
  },

  handleUpload: function() {
    if (this.isCarelinkUpload()) {
      return this.handleCarelinkUpload();
    }

    var self = this;

    self.setState({
      working: true,
      error: null
    });
    self.props.onUploadDevice(this.props.upload.driverId, function(err) {
      if (err) {
        self.setState({
          working: false,
          error: 'An error occured while uploading'
        });
      }

      self.setState({
        working: false
      });
    });
  },

  handleCarelinkUpload: function() {
    var username = this.refs.username.getDOMNode().value;
    var password = this.refs.password.getDOMNode().value;

    var self = this;

    self.setState({
      working: true,
      error: null
    });
    self.props.onUploadCarelink({
      username: username,
      password: password
    },{},function(err) {
      if (err) {
        self.setState({
          working: false,
          error: 'An error occured while uploading'
        });
      }

      self.setState({
        working: false
      });
    });
  },

  handleClose: function(e) {
    e.preventDefault();
    this.props.onCloseUpload();
  },

  isUploadSuccessful: function() {
    return Boolean(this.props.upload.success);
  },

  isCarelinkUpload: function() {
    return Boolean(this.props.upload.carelink);
  }
});

module.exports = UploadPage;
