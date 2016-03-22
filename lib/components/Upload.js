/*
* == BSD2 LICENSE ==
* Copyright (c) 2015-2016, Tidepool Project
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

/* global __DEBUG__ */

import _ from 'lodash';
import cx from 'classnames';
import React, { Component, PropTypes } from 'react';

import sundial from 'sundial';

import LoadingBar from './LoadingBar';
import ProgressBar from './ProgressBar';

export default class Upload extends Component {
  static propTypes = {
    disabled: PropTypes.bool.isRequired,
    upload: PropTypes.object.isRequired,
    onUpload: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    readFile: PropTypes.func.isRequired,
    text: PropTypes.object.isRequired
  };

  static defaultProps = {
    text: {
      CARELINK_USERNAME: 'CareLink username',
      CARELINK_PASSWORD: 'CareLink password',
      CARELINK_DOWNLOADING: 'Downloading CareLink export...',
      LABEL_UPLOAD: 'Upload',
      LABEL_IMPORT: 'Import',
      LABEL_OK: 'OK',
      LABEL_FAILED: 'Try again',
      LAST_UPLOAD: 'Last upload: ',
      DEVICE_UNKOWN: 'Unknown device',
      UPLOAD_COMPLETE: 'Done!',
      UPLOAD_PROGRESS: 'Uploading... '
    }
  };

  state = {
    carelinkFormIncomplete: true
  };

  constructor(props) {
    super(props);
    this.handleCareLinkUpload = this.handleCareLinkUpload.bind(this);
    this.handleReset = this.handleReset.bind(this);
    this.handleUpload = this.handleUpload.bind(this);
    this.onBlockModeInputChange = this.onBlockModeInputChange.bind(this);
    this.onCareLinkInputChange = this.onCareLinkInputChange.bind(this);
  }

  handleCareLinkUpload() {
    const { refs } = this;
    let options = {
      username: refs.username.value,
      password: refs.password.value
    };
    this.props.onUpload(options);
  }

  handleReset(e) {
    if (e) {
      e.preventDefault();
    }
    this.setState({
      carelinkFormIncomplete: true
    });
    this.props.onReset();
  }

  handleUpload(e) {
    const { upload } = this.props;
    if (e) {
      e.preventDefault();
    }

    if (_.get(upload, 'source.type', null) === 'carelink') {
      return this.handleCareLinkUpload();
    }

    var options = {};
    this.props.onUpload(options);
  }

  onBlockModeInputChange(e) {
    const { upload } = this.props;
    let file = e.target.files[0];
    this.props.readFile(file, upload.source.extension);
  }

  onCareLinkInputChange() {
    const { refs } = this;
    let username = refs.username && refs.username.value;
    let password = refs.password && refs.password.value;

    if (!username || !password) {
      this.setState({carelinkFormIncomplete: true});
    }
    else {
      this.setState({carelinkFormIncomplete: false});
    }
  }

  render() {
    return (
      <div className="Upload">
        <div className="Upload-left">
          {this.renderName()}
          {this.renderInstructions()}
          {this.renderLastUpload()}
        </div>
        <div className="Upload-right">
          <div className="Upload-statusSection">
            {this.renderStatus()}
          </div>
          {this.renderProgress()}
          {this.renderActions()}
        </div>
      </div>
    );
  }

  renderActions() {
    const { upload } = this.props;
    if (upload.uploading) {
      return null;
    }

    if (upload.completed) {
      return (
        <div className="Upload-button">
          {this.renderReset()}
        </div>
      );
    }

    return (
      <form className="Upload-form">
        {this.renderCareLinkInputs()}
        {this.renderBlockModeInput()}
        {this.renderButton()}
      </form>
    );
  }

  renderBlockModeInput() {
    const { upload } = this.props;
    if (_.get(upload, 'source.type', null) !== 'block') {
      return null;
    }

    // don't show the 'choose file' button if a file has already been selected.
    if (this.isBlockModeFileChosen()) {
      return null;
    }

    const disabled = upload.disabled || this.props.disabled;

    return (
      <div className="Upload-inputWrapper">
        <input
          className='Upload-fileinput'
          disabled={disabled}
          ref="file"
          type="file"
          onChange={this.onBlockModeInputChange}/>
      </div>
    );
  }

  renderButton() {
    const { text, upload } = this.props;
    let labelText = text.LABEL_UPLOAD;
    let disabled = upload.disabled || this.props.disabled;

    if (_.get(upload, 'source.type', null) === 'carelink') {
      labelText = text.LABEL_IMPORT;
      disabled = disabled || this.state.carelinkFormIncomplete;
    }

    if (_.get(upload, 'source.type', null) === 'block') {
      return null;
    }

    return (
      <div className="Upload-button">
        <button
          className="btn btn-primary"
          disabled={disabled}
          onClick={disabled ? _.noop : this.handleUpload}
          title={disabled ? 'Upload in progress! Please wait.' : ''}>
          {labelText}
        </button>
      </div>
    );
  }

  renderCareLinkInputs() {
    const { upload } = this.props;
    if (_.get(upload, 'source.type', null) !== 'carelink') {
      return null;
    }

    return (
      <div>
        <div className="Upload-input">
          <input
            onChange={this.onCareLinkInputChange}
            className="form-control"
            ref="username"
            placeholder={this.props.text.CARELINK_USERNAME}/>
        </div>
        <div className="Upload-input">
          <input
            onChange={this.onCareLinkInputChange}
            className="form-control"
            ref="password"
            type="password"
            placeholder={this.props.text.CARELINK_PASSWORD}/>
        </div>
      </div>
    );
  }

  renderInstructions() {
    const { upload } = this.props;
    let details = upload.instructions || '';
    if (Array.isArray(details)) {
      return (
        <div className="Upload-detail">
          {_.get(details, 0, '')}
          {_.get(details, 1, '')}
        </div>
      );
    }
    return (
      <div className="Upload-detail">{details}</div>
    );
  }

  renderLastUpload() {
    const { upload } = this.props;
    let history = upload.history;

    if (!(history && history.length)) {
      return null;
    }

    let lastUpload = _.find(history, function(upload) {
      return upload.finish && !upload.error;
    });

    if (lastUpload == null) {
      return null;
    }

    let time = sundial.formatCalendarTime(lastUpload.finish);
    return (
      <div className="Upload-detail">{this.props.text.LAST_UPLOAD + time}</div>
    );
  }

  renderName() {
    const { upload, text } = this.props;
    return (
      <div className="Upload-name">{upload.name || text.DEVICE_UNKOWN}</div>
    );
  }

  renderProgress() {
    const { upload } = this.props;
    if (upload.failed) {
      return <div className="Upload-progress"></div>;
    }

    if (this.isFetchingCareLinkData()) {
      return <div className="Upload-progress"><LoadingBar/></div>;
    }

    let percentage = upload.progress && upload.progress.percentage;

    // can be equal to 0, so check for null or undefined
    if (percentage == null) {
      return null;
    }

    return <div className="Upload-progress"><ProgressBar percentage={percentage}/></div>;
  }

  renderReset() {
    const { upload } = this.props;
    if (!upload.completed) {
      return null;
    }
    let resetClass = cx({
      'Upload-reset': true,
      'Upload-reset--error': upload.failed,
      'Upload-reset--success': upload.successful
    });

    let text = upload.successful ?
      this.props.text.LABEL_OK : this.props.text.LABEL_FAILED;

    return (
      <div className={resetClass}>
        <a href="" onClick={this.handleReset}>{text}</a>
      </div>
    );
  }

  renderStatus() {
    const { upload } = this.props;
    if (this.isFetchingCareLinkData()) {
      return <div className="Upload-status Upload-status--uploading">{this.props.text.CARELINK_DOWNLOADING}</div>;
    }

    if (upload.uploading) {
      return <div className="Upload-status Upload-status--uploading">{this.props.text.UPLOAD_PROGRESS + this.props.upload.progress.percentage + '%'}</div>;
    }

    function createFileDownloadLink(data, filename) {
      let jsonData = JSON.stringify(data, undefined, 4);
      let blob = new Blob([jsonData], {type: 'text/json'});
      let dataHref = URL.createObjectURL(blob);
      return (
        <a href={dataHref}
          download={filename}
          data-downloadurl={['text/json', filename, dataHref].join(':')}>
          POST data
        </a>
      );
    }

    if (upload.successful) {
      let dataDownloadLink = null;
      if (__DEBUG__ && (!_.isEmpty(this.props.upload.data))) {
        if (Array.isArray(this.props.upload.data)) {
          dataDownloadLink = createFileDownloadLink(
            this.props.upload.data, 'uploader-processed-records.json'
          );
        } else if (typeof this.props.upload.data === 'object') {
          const dataDownloadLink1 = createFileDownloadLink(
            this.props.upload.data.post_records, 'jellyfish-post-records.json'
          );
          const dataDownloadLink2 = createFileDownloadLink(
            this.props.upload.data.post_dataservices, 'dataservices-post-records.json'
          );
          dataDownloadLink = (
            <div>
              {dataDownloadLink1} for uploads,<br/>
              {dataDownloadLink2} for data services
            </div>
          );
        }
      }
      return <div className="Upload-status Upload-status--success">{this.props.text.UPLOAD_COMPLETE}&nbsp;{dataDownloadLink}</div>;
    }

    if (this.isBlockModeFileChosen()) {
      return (
          <div className="Upload-blockMode">
            <div className="Upload-blockMode Upload-blockMode--preparing">Preparing file &hellip;</div>
            <div className="Upload-blockMode">{this.props.upload.file.name}</div>
          </div>
      );
    }
    return null;
  }

  isBlockModeFileChosen() {
    const { upload } = this.props;
    if (_.get(upload, 'source.type', null) !== 'block') {
      return false;
    }
    else {
      if (!_.isEmpty(_.get(upload, 'file.name', ''))) {
        return true;
      }
      return false;
    }
  }

  isFetchingCareLinkData() {
    const { upload } = this.props;
    return (_.get(upload, 'source.type', null) === 'carelink') &&
      (upload.isFetching);
  }
};
