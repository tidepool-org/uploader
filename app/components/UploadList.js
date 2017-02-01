
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

import styles from '../../styles/components/UploadList.module.less';

export default class UploadList extends Component {
  static propTypes = {
    disabled: PropTypes.bool.isRequired,
    // targetId can be null when logged in user is not a data storage account
    // for example a clinic worker
    targetId: PropTypes.string,
    uploads: PropTypes.array.isRequired,
    userDropdownShowing: PropTypes.bool.isRequired,
    onReset: PropTypes.func.isRequired,
    onUpload: PropTypes.func.isRequired,
    readFile: PropTypes.func.isRequired,
    toggleErrorDetails: PropTypes.func.isRequired,
    updateProfileErrorMessage: React.PropTypes.string,
    isClinicAccount: React.PropTypes.bool.isRequired,
    onChooseDevices: React.PropTypes.func.isRequired,
    timezoneIsSelected: React.PropTypes.bool.isRequired,
    isUploadInProgress: React.PropTypes.bool.isRequired
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
      [styles.onlyme]: !this.props.userDropdownShowing,
      [styles.selectuser]: this.props.userDropdownShowing,
      [styles.profileError]: this.props.updateProfileErrorMessage,
      [styles.clinic]: this.props.isClinicAccount
    });

    const wrapClasses = cx({
      [styles.wrap]: true,
      [styles.wrapNoTZ]: !this.props.timezoneIsSelected
    });

    const { devices, disabled, onReset, onUpload, targetId } = this.props;

    const headlineText = this.props.isClinicAccount ? 'Devices' : 'Upload Devices';

    const items = _.map(this.props.uploads, (upload) => {
      return (
        <div key={upload.key} className={styles.item}>
          <Upload
            disabled={disabled}
            upload={upload}
            onReset={onReset.bind(null, targetId, upload.key)}
            onUpload={onUpload.bind(null, upload.key)}
            readFile={this.props.readFile.bind(null, targetId, upload.key)} />
          {this.renderErrorForUpload(upload)}
        </div>
      );
    });

    return (
      <div className={wrapClasses}>
        <div className={styles.headlineWrap}>
          <div className={styles.headline}>{headlineText}</div>
          {this.renderChooseDeviceLink()}
        </div>
        <div className={uploadListClasses}>
          {items}
        </div>
      </div>
    );
  }

  renderErrorForUpload(upload) {
    const { targetId, toggleErrorDetails } = this.props;
    if (_.isEmpty(upload) || _.isEmpty(upload.error)) {
      return null;
    }
    const errorDetails = upload.showErrorDetails ?
      (<div>{upload.error.debug}</div>) : null;
    const errorMessage = upload.error.driverLink ?
      (
        <div className={styles.errorMessageWrapper}>
          <span className={styles.errorMessage}>{this.props.text.UPLOAD_FAILED}</span>
          <span className={styles.errorMessageFriendly}>{'It\'s possible you need to install the '}</span>
          <span className={styles.errorMessageLinkWrap}><a className={styles.errorMessageLink} href={upload.error.driverLink} target="_blank">Tidepool USB driver</a></span>
        </div>
      ) :
      (
        <div className={styles.errorMessageWrapper}>
          <span className={styles.errorMessage}>{this.props.text.UPLOAD_FAILED}</span>
          <span className={styles.errorMessageFriendly}>{upload.error.message}</span>
        </div>
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
      <div className={styles.errorItem}>
        {errorMessage}
        <div><a className={styles.errorTextLink} href="" onClick={makeToggleDetailsFn()}>{showErrorsText}</a></div>
        {errorDetails}
      </div>
    );
  }

  noopHandler(e){
    e.preventDefault();
  }

  renderChooseDeviceLink(){
    if(this.props.isClinicAccount){
      var classes = cx({
        [styles.chooseDeviceLink]: true,
        [styles.linkDisabled]: this.props.isUploadInProgress
      });
      return (
        <div className={classes}
          onClick={this.props.isUploadInProgress ? this.noopHandler : this.props.onChooseDevices}>
            Change Devices
        </div>
      );
    } else {
      return null;
    }
  }
}
