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
var deviceInfo = require('../core/deviceInfo');

var Upload = React.createClass({
  propTypes: {
    upload: React.PropTypes.object.isRequired,
    onUpload: React.PropTypes.func.isRequired
  },

  render: function() {
    var style = {};
    if (this.isDisabled()) {
      style = {color: '#ccc'};
    }

    return (
      <div style={style}>
        {this.renderInfo()}
        {this.renderCarelinkForm()}
        {this.renderButton()}
        {this.renderProgress()}
        {this.renderSuccess()}
        {this.renderError()}
        {this.renderLastUpload()}
      </div>
    );
  },

  renderInfo: function() {
    var name;
    if (this.isCarelinkUpload()) {
      name = 'Carelink';
    }
    else {
      name = this.getDeviceDisplayName(this.props.upload);
    }
    var status;
    if (this.isDisconnected()) {
      status = ' - (disconnected)';
    }
    return (
      <p><strong>{name}</strong>{status}</p>
    );
  },

  renderCarelinkForm: function() {
    if (!this.isCarelinkUpload()) {
      return null;
    }

    return (
      <form>
        <p><input ref="username" placeholder="carelink username"/></p>
        <p><input ref="password" type="password" placeholder="carelink password"/></p>
      </form>
    );
  },

  renderButton: function() {
    var text = this.isUploading() ? 'Uploading...' : 'Upload';
    var disabled = this.isDisabled() || this.isUploading();

    return (
      <p>
        <button
          disabled={disabled}
          onClick={this.handleUpload}>{text}</button>
      </p>
    );
  },

  renderProgress: function() {
    if (!this.isUploading()) {
      return null;
    }
    return (
      <p>{'Progress: ' + this.props.upload.progress.percentage + '%'}</p>
    );
  },

  renderSuccess: function() {
    if (!this.isUploadSuccessful()) {
      return null;
    }

    return (
      <p style={{color: 'green'}}>{'Upload successful!'}</p>
    );
  },

  renderError: function() {
    if (!this.isUploadFailed()) {
      return null;
    }

    return <p style={{color: 'red'}}>{'An error occured while uploading'}</p>;
  },

  renderLastUpload: function() {
    var history = this.props.upload.history;
    if (!(history && history.length)) {
      return null;
    }
    return <p>{'Uploaded on: ' + history[0].finish}</p>;
  },

  getDeviceDisplayName: function(upload) {
    var getDisplayName = getIn(
      deviceInfo,
      [upload.source.driverId, 'getDisplayName'],
      function() { return 'Unknown device'; }
    );
    return getDisplayName(upload.source);
  },

  isDisabled: function() {
    return this.props.upload.disabled;
  },

  isDisconnected: function() {
    return (
      this.props.upload.source.type === 'device' &&
      !Boolean(this.props.upload.source.connected)
    );
  },

  isUploading: function() {
    return Boolean(this.props.upload.progress);
  },

  isCarelinkUpload: function() {
    return Boolean(this.props.upload.source.type === 'carelink');
  },

  isUploadSuccessful: function() {
    if (this.isUploading()) {
      return false;
    }
    var history = this.props.upload.history;
    return history && history.length && history[0].success;
  },

  isUploadFailed: function() {
    if (this.isUploading()) {
      return false;
    }
    var history = this.props.upload.history;
    return history && history.length && history[0].error;
  },

  handleUpload: function() {
    if (this.isCarelinkUpload()) {
      return this.handleCarelinkUpload();
    }

    var options = {};
    this.props.onUpload(options);
  },

  handleCarelinkUpload: function() {
    var username = this.refs.username.getDOMNode().value;
    var password = this.refs.password.getDOMNode().value;
    var options = {
      username: username,
      password: password
    };
    this.props.onUpload(options);
  }
});

module.exports = Upload;
