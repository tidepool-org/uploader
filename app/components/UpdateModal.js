/*
* == BSD2 LICENSE ==
* Copyright (c) 2014-2016, Tidepool Project
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
import { ipcRenderer } from 'electron';

import { sync as syncActions } from '../actions/';
import config from '../../lib/config.js';

import styles from '../../styles/components/UpdateModal.module.less';

export class UpdateModal extends Component {
  handleInstall() {
    ipcRenderer.send('autoUpdater', 'quitAndInstall');
  }

  render() {
    const {
      checkingElectronUpdate,
      electronUpdateDownloaded,
      electronUpdateAvailable,
      electronUpdateManualChecked,
      electronUpdateAvailableDismissed,
      sync
    } = this.props;

    if ( checkingElectronUpdate ||
      (
        !(electronUpdateDownloaded && !electronUpdateAvailableDismissed) &&
        !(electronUpdateManualChecked && (
            !electronUpdateAvailableDismissed ||
            electronUpdateDownloaded
          )
        )
      )
    ) {
      return null;
    }

    let title, text, actions;

    if(electronUpdateAvailable) {
      title = 'Updates Available!';
      text = 'After clicking Install, the uploader will restart to complete the installation.';
      actions = [
        <button key='dismiss' className={styles.buttonSecondary} onClick={sync.dismissUpdateAvailable}>
          Dismiss
        </button>,
        <button key='install' className={styles.button} onClick={this.handleInstall}>
          Install
        </button>
      ];
    } else {
      title = 'Uploader is up-to-date!';
      text = `You are running version ${config.version}, the most recent one.`;
      actions = (
        <button className={styles.button} onClick={sync.dismissUpdateNotAvailable}>
          Okay!
        </button>
      );
    }

    return (
      <div className={styles.modalWrap}>
        <div className={styles.modal}>
          <div className={styles.title}>
            {title}
          </div>
          <div className={styles.text}>
            {text}
          </div>
          <div className={styles.actions}>
            {actions}
          </div>
        </div>
      </div>
    );
  }
};

export default connect(
  (state, ownProps) => {
    return {
      // plain state
      checkingElectronUpdate: state.working.checkingElectronUpdate,
      electronUpdateAvailableDismissed: state.electronUpdateAvailableDismissed,
      electronUpdateAvailable: state.electronUpdateAvailable,
      electronUpdateDownloaded: state.electronUpdateDownloaded,
      electronUpdateManualChecked: state.electronUpdateManualChecked
    };
  },
  (dispatch) => {
    return {
      sync: bindActionCreators(syncActions, dispatch)
    };
  }
)(UpdateModal);
