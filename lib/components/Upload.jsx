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
// This is "cheating" a bit, but need an easy way to format for this MVP :)
var moment = require('sundial/node_modules/moment');
var getIn = require('../core/getIn');
var deviceInfo = require('../core/deviceInfo');
var ProgressBar = require('./ProgressBar.jsx');
var LoadingBar = require('./LoadingBar.jsx');

var Upload = React.createClass({
  propTypes: {
    upload: React.PropTypes.object.isRequired,
    onUpload: React.PropTypes.func.isRequired,
    onReset: React.PropTypes.func.isRequired
  },

  getInitialState: function() {
    return {
      carelinkFormIncomplete: true
    };
  },

  render: function() {
    return (
      <div className="Upload">
        <div className="Upload-left">
          {this.renderName()}
          {this.renderDetail()}
          {this.renderLastUpload()}
        </div>
        <div className="Upload-right">
          <div className="Upload-statusSection">
            {this.renderStatus()}
            {this.renderReset()}
          </div>
          {this.renderProgress()}
          {this.renderActions()}
        </div>
      </div>
    );
  },

  renderName: function() {
    var name;
    if (this.isCarelinkUpload()) {
      name = 'Medtronic Devices';
    }
    else {
      name = this.getDeviceName(this.props.upload);
    }
    return (
      <div className="Upload-name">{name}</div>
    );
  },

  renderDetail: function() {
    var detail;
    if (this.isCarelinkUpload()) {
      detail = 'Import from CareLink';
    }
    else {
      detail = this.getDeviceDetail(this.props.upload);
    }
    return (
      <div className="Upload-detail">{detail}</div>
    );
  },

  renderActions: function() {
    if (this.isUploading() || this.isUploadCompleted() || this.isDisconnected()) {
      return null;
    }

    return (
      <form className="Upload-form">
        {this.renderCarelinkInputs()}
        {this.renderButton()}
      </form>
    );
  },

  renderCarelinkInputs: function() {
    if (!this.isCarelinkUpload()) {
      return null;
    }

    return (
      <div>
        <div className="Upload-input"><input onChange={this.onCareLinkInputChange} className="form-control" ref="username" placeholder="CareLink username"/></div>
        <div className="Upload-input"><input onChange={this.onCareLinkInputChange} className="form-control" ref="password" type="password" placeholder="CareLink password"/></div>
      </div>
    );
  },

  onCareLinkInputChange: function() {
    var username = this.refs.username && this.refs.username.getDOMNode().value;
    var password = this.refs.password && this.refs.password.getDOMNode().value;

    if (!username || !password) {
      this.setState({carelinkFormIncomplete: true});
    } else {
      this.setState({carelinkFormIncomplete: false});
    }
  },

  renderButton: function() {
    var text = 'Upload';
    var disabled = this.isDisabled();

    if (this.isCarelinkUpload()) {
      text = 'Import';
      disabled = disabled || this.state.carelinkFormIncomplete;
    }

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
    if (this.isFetchingCarelinkData()) {
      return <div className="Upload-progress"><LoadingBar/></div>;
    }

    var percentage =
      this.props.upload.progress && this.props.upload.progress.percentage;

    // Can be equal to 0, so check for null or undefined
    if (percentage == null) {
      return null;
    }

    return <div className="Upload-progress"><ProgressBar percentage={percentage}/></div>;
  },

  renderStatus: function() {
    if (this.isDisconnected()) {
      return (
        <div className="Upload-status Upload-status--disconnected">
          {'Connect your ' + this.getDeviceName(this.props.upload) + '...'}
        </div>
      );
    }
    if (this.isFetchingCarelinkData()) {
      return <div className="Upload-status Upload-status--uploading">{'Downloading CareLink export...'}</div>;
    }
    if (this.isUploading()) {
      return <div className="Upload-status Upload-status--uploading">{'Uploading... ' + this.props.upload.progress.percentage + '%'}</div>;
    }
    if (this.isUploadSuccessful()) {
      return <div className="Upload-status Upload-status--success">{'Done!'}</div>;
    }
    if (this.isUploadFailed()) {
      var uploadError = this.getUploadError();
      if (getIn(uploadError, ['error', 'code']) && getIn(uploadError, ['error', 'message'])) {
          return <div className="Upload-status Upload-status--error">{uploadError.error.message}</div>;
      }
      return <div className="Upload-status Upload-status--error">{'The upload didn\'t work.'}</div>;
    }
    return null;
  },

  renderReset: function() {
    if (!this.isUploadCompleted()) {
      return null;
    }

    var text = this.isUploadSuccessful() ? 'Start over' : 'Try again';

    return (
      <div className="Upload-reset">
      <a href="" onClick={this.handleReset}>{text}</a>
      </div>
    );
  },

  renderLastUpload: function() {
    var lastUpload = this.getLastUpload();
    if (!lastUpload) {
      return null;
    }
    var time = moment(lastUpload.finish).calendar();
    return <div className="Upload-detail">{'Last upload: ' + time}</div>;
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

  getUploadError: function() {
    return this.props.upload.error;
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

  isFetchingCarelinkData: function() {
    return this.props.upload.fetchingCarelinkData;
  },

  isUploadSuccessful: function() {
    return this.props.upload.successful;
  },

  isUploadFailed: function() {
    return this.props.upload.failed;
  },

  isUploadCompleted: function() {
    return this.props.upload.completed;
  },

  handleUpload: function(e) {
    if (e) {
      e.preventDefault();
    }

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
  },

  handleReset: function(e) {
    if (e) {
      e.preventDefault();
    }

    this.props.onReset();
  }
});

module.exports = Upload;
