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
    showingBluetoothPairingDialog.callback('bluetoothModalClose');
    sync.bluetoothPairingConfirm();
  };

  render() {
    const { showingBluetoothPairingDialog } = this.props;

    if(!showingBluetoothPairingDialog){
      return null;
    }

    const { deviceInfo } = showingBluetoothPairingDialog.cfg;

    return (
      <div className={styles.modalWrap}>
        <div className={styles.modal}>
          <div className={styles.title}>
            <div>{i18n.t('Enter Bluetooth Passkey for device {{device}}:', { device: deviceInfo.name })}</div>
          </div>
          <hr className={styles.hr} />
          <div className={styles.actions}>
            <button className={styles.buttonSecondary} onClick={this.handleContinue}>
              {i18n.t('Continue')}
            </button>
          </div>
        </div>
      </div>
    );
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
