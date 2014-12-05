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
var cx = require('react/lib/cx');
var getIn = require('../core/getIn');
var deviceInfo = require('../core/deviceInfo');

var Upload = React.createClass({
  propTypes: {
    upload: React.PropTypes.object.isRequired,
    onUpload: React.PropTypes.func.isRequired
  },

  render: function() {
    var classes = cx({
      'Upload': true,
      'is-disconnected': this.isDisconnected()
    });

    return (
      <div className={classes}>
        <div className="Upload-left">
          {this.renderName()}
          {this.renderDetail()}
          {this.renderLastUpload()}
        </div>
        <div className="Upload-right">
          {this.renderStatus()}
          {this.renderProgress()}
          <form className="Upload-form">
            {this.renderCarelinkInputs()}
            {this.renderButton()}
          </form>
        </div>
      </div>
    );
  },

  renderName: function() {
    var name;
    if (this.isCarelinkUpload()) {
      name = 'Medtronic Device';
    }
    else {
      name = this.getDeviceName(this.props.upload);
    }
    if (this.isDisconnected()) {
      name = name + ' (disconnected)';
    }
    return (
      <div className="Upload-name">{name}</div>
    );
  },

  renderDetail: function() {
    var detail;
    if (this.isCarelinkUpload()) {
      detail = 'CareLink';
    }
    else {
      detail = this.getDeviceDetail(this.props.upload);
    }
    return (
      <div className="Upload-detail">{detail}</div>
    );
  },

  renderCarelinkInputs: function() {
    if (!this.isCarelinkUpload()) {
      return null;
    }
    if (this.isUploading()) {
      return null;
    }

    return (
      <div>
        <div className="Upload-input"><input className="form-control" ref="username" placeholder="carelink username"/></div>
        <div className="Upload-input"><input className="form-control" ref="password" type="password" placeholder="carelink password"/></div>
      </div>
    );
  },

  renderButton: function() {
    if (this.isUploading()) {
      return null;
    }

    var text = 'Upload';
    if (this.isCarelinkUpload()) {
      text = 'Import';
    }
    var disabled = this.isDisabled();

    return (
      <div className="Upload-button">
        <button
          className="btn btn-secondary"
          disabled={disabled}
          onClick={this.handleUpload}>{text}</button>
      </div>
    );
  },

  renderProgress: function() {
    var percentage;
    if (this.isUploading()) {
      percentage = this.props.upload.progress.percentage;
    }
    else {
      var lastUpload = this.getLastUpload();
      percentage = lastUpload && lastUpload.percentage;
    }

    // Can be equal to 0
    if (percentage == null) {
      return null;
    }

    return (
      <div className="Upload-progress">
        {'Progress: ' + percentage + '%'}
      </div>
    );
  },

  renderStatus: function() {
    if (this.isUploading()) {
      return <div className="Upload-status Upload-status--uploading">{'Uploading...'}</div>;
    }
    if (this.isUploadSuccessful()) {
      return <div className="Upload-status Upload-status--success">{'Uploaded!'}</div>;
    }
    if (this.isUploadFailed()) {
      return <div className="Upload-status Upload-status--error">{'An error occured while uploading.'}</div>;
    }
    return null;
  },

  renderLastUpload: function() {
    var lastUpload = this.getLastUpload();
    if (!lastUpload) {
      return null;
    }
    return <div className="Upload-detail">{'Last upload: ' + lastUpload.finish}</div>;
  },

  getLastUpload: function() {
    var history = this.props.upload.history;
    if (!(history && history.length)) {
      return null;
    }
    return history[0];
  },

  getDeviceName: function(upload) {
    var getName = getIn(
      deviceInfo,
      [upload.source.driverId, 'getName'],
      function() { return 'Unknown device'; }
    );
    return getName(upload.source);
  },

  getDeviceDetail: function(upload) {
    var getDetail = getIn(
      deviceInfo,
      [upload.source.driverId, 'getDetail'],
      function() { return ''; }
    );
    return getDetail(upload.source);
  },

  isDisabled: function() {
    return this.props.upload.disabled;
  },

  isDisconnected: function() {
    return this.props.upload.disconnected;
  },

  isUploading: function() {
    return this.props.upload.uploading;
  },

  isCarelinkUpload: function() {
    return this.props.upload.carelink;
  },

  isUploadSuccessful: function() {
    return this.props.upload.successful;
  },

  isUploadFailed: function() {
    return this.props.upload.failed;
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
