
/*
* == BSD2 LICENSE ==
* Copyright (c) 2016, Tidepool Project
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

import _ from 'lodash';
import React, { Component, PropTypes } from 'react';
import cx from 'classnames';

import Upload from './Upload';

export default class UploadList extends Component {
  static propTypes = {
    // targetId can be null when logged in user is not a data storage account
    // for example a clinic worker
    targetId: PropTypes.string,
    uploads: PropTypes.array.isRequired,
    userDropdownShowing: PropTypes.bool.isRequired,
    onReset: PropTypes.func.isRequired,
    onUpload: PropTypes.func.isRequired,
    readFile: PropTypes.func.isRequired,
    toggleErrorDetails: PropTypes.func.isRequired
  };

  static defaultProps = {
    text: {
      SHOW_ERROR : 'Error details',
      HIDE_ERROR : 'Hide details',
      UPLOAD_FAILED : 'Upload Failed: '
    }
  };

  constructor(props) {
    super(props);
  }

  render() {
    const uploadListClasses = cx({
      UploadList: true,
      'UploadList--onlyme': !this.props.userDropdownShowing,
      'UploadList--selectuser': this.props.userDropdownShowing
    });

    const { devices, onReset, onUpload, targetId } = this.props;

    const items = _.map(this.props.uploads, (upload) => {
      return (
        <div key={upload.key} className='UploadList-item'>
          <Upload
            upload={upload}
            onReset={onReset.bind(null, targetId, upload.key)}
            onUpload={onUpload.bind(null, upload.key)}
            readFile={this.props.readFile.bind(null, targetId, upload.key)} />
          {this.renderErrorForUpload(upload)}
        </div>
      );
    });

    return (
      <div className={uploadListClasses}>
        {items}
      </div>
    );
  }

  renderErrorForUpload(upload) {
    const { targetId, toggleErrorDetails } = this.props;
    if (_.isEmpty(upload) || _.isEmpty(upload.error)) {
      return null;
    }
    const errorDetails = upload.showErrorDetails ?
      (<div className="UploadList-error-details">{upload.error.debug}</div>) : null;
    const errorMessage = upload.error.driverLink ?
      (
        <div className="UploadList-error-message-wrapper">
          <span className="UploadList-error-message">{this.props.text.UPLOAD_FAILED}</span>
          <span className="UploadList-error-message-friendly">{'You may need to install the '}</span>
          <span className="UploadList-error-message-link"><a href={upload.error.driverLink} target="_blank">{`${upload.name} device driver.`}</a></span>
        </div>
      ) :
      (
        <span className="UploadList-error-message">{this.props.text.UPLOAD_FAILED + upload.error.message}</span>
      );
    const showErrorsText = upload.showErrorDetails ? this.props.text.HIDE_ERROR : this.props.text.SHOW_ERROR;

    function makeToggleDetailsFn() {
      return function(e) {
        if (e) {
          e.preventDefault();
        }
        toggleErrorDetails(targetId, upload.key, upload.showErrorDetails);
      };
    }

    return (
      <div className="UploadList-error-item">
        {errorMessage}
        <div className="UploadList-error-text"><a href="" onClick={makeToggleDetailsFn()}>{showErrorsText}</a></div>
        {errorDetails}
      </div>
    );
  }
}