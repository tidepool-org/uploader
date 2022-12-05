/*
* == BSD2 LICENSE ==
* Copyright (c) 2022, Tidepool Project
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
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { sync as syncActions } from '../actions/';

import styles from '../../styles/components/BluetoothModal.module.less';

const remote = require('@electron/remote');
const i18n = remote.getGlobal( 'i18n' );

export class BluetoothModal extends Component {
  handleContinue = () => {
    const { showingBluetoothPairingDialog, sync } = this.props;
    const response = {
      confirmed: true,
    };

    if (this.pin.value) {
      console.log('pin', this.pin.value); // TODO: remove this
      response.pin = this.pin.value;
    }

    showingBluetoothPairingDialog.callback(response);
    sync.dismissedBluetoothPairingDialog();
  };

  handleCancel = () => {
    const { showingBluetoothPairingDialog, sync } = this.props;
    const response = {
      confirmed : false,
    };
    showingBluetoothPairingDialog.callback(response);
    sync.dismissedBluetoothPairingDialog();
  };

  render() {
    const { showingBluetoothPairingDialog } = this.props;

    if(!showingBluetoothPairingDialog){
      return null;
    }

    const { deviceInfo } = showingBluetoothPairingDialog.cfg;

    switch (details.pairingKind) {
      case 'confirm': {
        return (
          <div className={styles.modalWrap}>
            <div className={styles.modal}>
              <div className={styles.title}>
                <div>{i18n.t('Do you want to connect to {{device}}?', { device: deviceInfo.name })}</div>
              </div>
              <div className={styles.actions}>
                <button className={styles.button} onClick={this.handleContinue}>
                  {i18n.t('Confirm')}
                </button>
                <button className={styles.buttonSecondary} onClick={this.handleCancel}>
                  {i18n.t('Cancel')}
                </button>
              </div>
            </div>
          </div>
        );
      }
      case 'confirmPin': {
        response.confirmed = confirm(`Does the pin ${details.pin} match the pin displayed on device ${details.deviceId}?`);
        return (
          <div className={styles.modalWrap}>
            <div className={styles.modal}>
              <div className={styles.title}>
                <div>{i18n.t('Does the pin {{pin}} match the pin displayed on device {{device}}?', { pin: details.pin, device: deviceInfo.name })}</div>
              </div>
              <div className={styles.actions}>
                <button className={styles.button} onClick={this.handleContinue}>
                  {i18n.t('Confirm')}
                </button>
                <button className={styles.buttonSecondary} onClick={this.handleCancel}>
                  {i18n.t('Cancel')}
                </button>
              </div>
            </div>
          </div>
        );
      }
      case 'providePin': {
        return (
          <div className={styles.modalWrap}>
            <div className={styles.modal}>
              <div className={styles.title}>
                <div>{i18n.t('Enter Bluetooth Passkey for device {{device}}:', { device: deviceInfo.name })}</div>
              </div>
              <div className={styles.textInputWrapper}>
                <input
                  type="text"
                  ref={(input) => { this.pin = input; }}
                  className={styles.textInput} />
              </div>
              <div className={styles.actions}>
                <button className={styles.button} onClick={this.handleContinue}>
                  {i18n.t('Continue')}
                </button>
                <button className={styles.buttonSecondary} onClick={this.handleCancel}>
                  {i18n.t('Cancel')}
                </button>
              </div>
            </div>
          </div>
        );
      }
    }  
  }
};

export default connect(
  (state, ownProps) => {
    return {
      showingBluetoothPairingDialog: state.showingBluetoothPairingDialog
    };
  },
  (dispatch) => {
    return {
      sync: bindActionCreators(syncActions, dispatch)
    };
  }
)(BluetoothModal);