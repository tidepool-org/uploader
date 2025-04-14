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
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import cx from 'classnames';
import api from '../../lib/core/api';
import * as metrics  from '../constants/metrics';
import { v4 as uuidv4 } from 'uuid';

import Upload from './Upload';

import * as styles from '../../styles/components/UploadList.module.less';
import Email from '@mui/icons-material/Email';
import CheckCircle from '@mui/icons-material/CheckCircle';

import { i18n } from '../utils/config.i18next';

export default class UploadList extends Component {
  static propTypes = {
    disabled: PropTypes.bool.isRequired,
    rememberMedtronicSerialNumber: PropTypes.func.isRequired,
    // targetId can be null when logged in user is not a data storage account
    // for example a clinic worker
    targetId: PropTypes.string,
    addDevice: PropTypes.func.isRequired,
    removeDevice: PropTypes.func.isRequired,
    onDone: PropTypes.func.isRequired,
    uploads: PropTypes.array.isRequired,
    userDropdownShowing: PropTypes.bool.isRequired,
    onReset: PropTypes.func.isRequired,
    onUpload: PropTypes.func.isRequired,
    readFile: PropTypes.func.isRequired,
    updateProfileErrorMessage: PropTypes.string,
    onChooseDevices: PropTypes.func.isRequired,
    timezoneIsSelected: PropTypes.bool.isRequired,
    isUploadInProgress: PropTypes.bool.isRequired,
    selectedClinicId: PropTypes.string,
    renderClinicUi: PropTypes.bool.isRequired,
    showingUserSelectionDropdown: PropTypes.bool.isRequired,
  };

  static defaultProps = {
    text: {
      UPLOAD_FAILED: i18n.t('Upload Failed')
    }
  };

  constructor(props) {
    super(props);
    this.state = {
      uploadErrorSubmitSuccessSet: [],
      uploadErrorSubmitFailedSet: [],
      uploadErrorSubmitClicked: false,
    };
  }

  render() {
    const uploadListClasses = cx({
      [styles.onlyme]: !this.props.userDropdownShowing,
      [styles.selectuser]: this.props.userDropdownShowing,
      [styles.profileError]: this.props.updateProfileErrorMessage,
      [styles.clinic]: this.props.renderClinicUi
    });

    const wrapClasses = cx({
      [styles.wrap]: true,
      [styles.wrapNoTZ]: !this.props.timezoneIsSelected
    });

    const { disabled, onReset, onUpload, targetId } = this.props;

    const headlineText = this.props.renderClinicUi ? i18n.t('Devices') : i18n.t('Upload Devices');
    const medtronicEnabled = _.findIndex(this.props.uploads, { key: 'medtronic' }) === -1 ? false : true;
    const items = _.map(this.props.uploads, (upload) => {
      if (upload.name) {
        if (upload.key === 'carelink') {
          return;
        }
        return (
          <div key={upload.key} className={styles.item}>
            <Upload
              disabled={disabled}
              rememberMedtronicSerialNumber={this.props.rememberMedtronicSerialNumber}
              upload={upload}
              targetId={targetId}
              addDevice={this.props.addDevice}
              removeDevice={this.props.removeDevice}
              onDone={this.props.onDone}
              onReset={onReset.bind(null, targetId, upload.key)}
              onUpload={onUpload.bind(null, upload.key)}
              readFile={this.props.readFile.bind(null, targetId, upload.key)}
              selectedClinicId={this.props.selectedClinicId} />
            {this.renderErrorForUpload(upload)}
          </div>
        );
      }
      return;
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

  handleErrorSubmit(error) {
    const { targetId, uploads } = this.props;
    const baseUrl = 'https://tidepoolsupport.zendesk.com';
    const url = `${baseUrl}/api/v2/requests`;
    const headers = {
      'Content-Type': 'application/json'
    };
    const errorParts = {
      'User Email': error.userEmail,
      'User Name': error.userName,
      'User ID': error.loggedInUser,
      'Clinic Name': error.clinicName,
      'Clinic ID': error.clinicId,
      'Upload Target User': targetId,
      'Operating System': error.os,
      'Uploader Version': error.version,
      'Selected Device': error.device,
      '[Tidepool Support] Troubleshooting Info': error.debug
    };

    if (this.state.uploadErrorSubmitClicked) return;

    this.setState({ uploadErrorSubmitClicked: true });

    if (error.uuid) {
      errorParts['[Tidepool Support] Rollbar UUID'] = error.uuid;
      errorParts['[Tidepool Support] Rollbar Link'] = `https://rollbar.com/occurrence/uuid?uuid=${error.uuid}`;
    } else {
      error.unique_id = uuidv4();
    }
    const errorId = error.uuid || error.unique_id;

    const errorBodyText = _.reduce(errorParts, (text, value, key) => {
      if (value) {
        return `${text}\n${key}: ${value}`;
      }
      return text;
    }, '');

    const body = {
      request: {
        requester: {
          name: error.userName,
          email: error.userEmail
        },
        subject: `Uploader Error Report: ${error.message}`,
        comment: {
          body: errorBodyText
        },
      },
    };

    api.metrics.track(metrics.SUBMIT_ERROR_TO_ZENDESK_REQUEST);

    fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }).then((response) => {
      this.setState({ uploadErrorSubmitClicked: false });
      if (response.status === 201) {
        api.metrics.track(metrics.SUBMIT_ERROR_TO_ZENDESK_SUCCESS);
        this.setState({
          uploadErrorSubmitSuccessSet: this.state.uploadErrorSubmitSuccessSet.concat(
            [errorId]
          ),
        });
      } else {
        api.metrics.track(metrics.SUBMIT_ERROR_TO_ZENDESK_FAILURE);
        this.setState({
          uploadErrorSubmitFailedSet: this.state.uploadErrorSubmitFailedSet.concat(
            [errorId]
          ),
        });
      }
    }).catch((err) => {
      api.metrics.track(metrics.SUBMIT_ERROR_TO_ZENDESK_FAILURE);
      this.setState({
        uploadErrorSubmitFailedSet: this.state.uploadErrorSubmitFailedSet.concat(
          [errorId]
        ),
      });
    });
  }

  renderErrorForUpload(upload) {
    if (_.isEmpty(upload) || _.isEmpty(upload.error)) {
      return null;
    }
    const errorDetails = (<div>{upload.error.debug}</div>);
    const errorMessage = (
      <div className={styles.errorMessageWrapper}>
        <span className={styles.errorMessage}>{this.props.text.UPLOAD_FAILED}: </span>
        <span className={styles.errorMessageFriendly}>
          {i18n.t(upload.error.message)}&nbsp;
          {
            upload.error.link &&
            upload.error.linkText &&
            <a href={upload.error.link} target="_blank">
              {upload.error.linkText}
            </a>
          }
        </span>
      </div>
    );

    let rollbarUUID = null;
    if (!_.isEmpty(upload.error.uuid)) {
      rollbarUUID = (<div className={styles.errorTextTiny}>Rollbar UUID: {upload.error.uuid}</div>);
    }

    let sendToSupport = null;
    const errorId = upload.error.uuid || upload.error.unique_id;
    const { uploadErrorSubmitClicked } = this.state;
    if (this.state.uploadErrorSubmitSuccessSet.includes(errorId)) {
      sendToSupport = (
        <div className={styles.errorSubmitSuccess}>
          <CheckCircle className={styles.errorLinkIcon} sx={{ height: '0.8em', width: '0.8em' }} />
          {i18n.t(
            'Thanks for sharing. Someone will get back to you by email soon.'
          )}
        </div>
      );
    } else if (this.state.uploadErrorSubmitFailedSet.includes(errorId)) {
      sendToSupport = (
        <>
          <div className={styles.errorSubmitFailed}>
            {i18n.t('Sorry, we were unable to submit this error.')}
          </div>
          <div>
            {i18n.t('Make sure you are online and ')}
            <a
              className={styles.errorMessageLink}
              href="#"
              onClick={this.handleErrorSubmit.bind(this, upload.error)}
            >
              {i18n.t('try again')}
            </a>
            {i18n.t(' or contact us directly at ')}
            <a
              className={styles.errorMessageLink}
              href="mailto:support@tidepool.org"
            >
              support@tidepool.org
            </a>
          </div>
        </>
      );
    } else {
      sendToSupport = (
        <div>
          <a
            className={styles.errorMessageLink}
            href="#"
            onClick={this.handleErrorSubmit.bind(this, upload.error)}
            style={{ pointerEvents: uploadErrorSubmitClicked ? 'none' : 'auto', opacity: uploadErrorSubmitClicked ? 0.5 : 1 }}
          >
            <Email className={styles.errorLinkIcon} sx={{ height: '0.8em', width: '0.8em' }} />
            {i18n.t('Share this issue with the Tidepool Support Team')}
          </a>
        </div>
      );
    }

    if (upload.error.code === 'E_NO_RECORDS' || upload.error.code === 'E_NO_NEW_RECORDS') {
      return (
        <div className={styles.errorItem}>
          <div className={styles.errorMessageWrapper}>
            <span className={styles.boldMessage}>{i18n.t('Data is up to date')}</span>
            <span className={styles.errorMessageFriendly}>
              &nbsp;&#8212; {i18n.t(upload.error.message)}
            </span>
          </div>
          {rollbarUUID}
          {sendToSupport}
        </div>
      );
    } else {
      return (
        <div className={styles.errorItem}>
          {errorMessage}
          {errorDetails}
          {rollbarUUID}
          {sendToSupport}
        </div>
      );
    }
}

  noopHandler(e){
    e.preventDefault();
  }

  renderChooseDeviceLink(){
    if(this.props.renderClinicUi || this.props.showingUserSelectionDropdown){
      const classes = cx({
        [styles.chooseDeviceLink]: true,
        [styles.linkDisabled]: this.props.isUploadInProgress
      });
      return (
        <div className={classes}
          onClick={this.props.isUploadInProgress ? this.noopHandler : this.props.onChooseDevices}>
            {i18n.t('Change Devices')}
        </div>
      );
    }
    return null;
  }
}
