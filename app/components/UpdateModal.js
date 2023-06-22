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

const remote = require('@electron/remote');
const i18n = remote.getGlobal( 'i18n' );

export class UpdateModal extends Component {
  handleInstall = () => {
    const { sync } = this.props;
    sync.quitAndInstall();
    ipcRenderer.send('autoUpdater', 'quitAndInstall');
  };

  render() {
    const {
      checkingElectronUpdate,
      electronUpdateDownloaded,
      electronUpdateAvailable,
      electronUpdateManualChecked,
      electronUpdateAvailableDismissed,
      sync
    } = this.props;

    let title, actions, newVersion, newDate, currentVersion, currentDate = 'N/A';

    if (electronUpdateAvailable) {
      newVersion = electronUpdateAvailable.info.version;
      newDate = electronUpdateAvailable.info.releaseDate.slice(0, 10);
      currentVersion = remote.app.getVersion();
      
      if (electronUpdateAvailable.info.installDate) {
        currentDate = electronUpdateAvailable.info.installDate.slice(0, 10);
      }
    }

    let text = (
      <div className={styles.text}>
        <div className={styles.body}>
          <div className={styles.text}>
            {i18n.t('Newest version: {{newVersion}} - released {{newDate}}', { newVersion: newVersion, newDate: newDate })}
            </div>
          <div className={styles.textRed}>
            {i18n.t('Your version: {{currentVersion}} - installed {{currentDate}}', { currentVersion: currentVersion, currentDate: currentDate })}
          </div>
        </div>
        <div className={styles.body}>
          <a href='http://release.tidepool.org' target='_blank'>{i18n.t('See what\'s new with Tidepool Uploader')}.</a>
        </div>
        <div className={styles.body}>
          {i18n.t('You can continue to use your current version,')}<br/>
          {i18n.t('but we recommend updating as soon as possible.')}<br/>
        </div>
        <div className={styles.body}>
          {i18n.t('After clicking Install, the uploader will restart to complete the installation.')}
        </div>
      </div>
    );

    if(electronUpdateAvailableDismissed){
      return null;
    }

    if (electronUpdateManualChecked) {
      if (checkingElectronUpdate){
        title = i18n.t('Checking for update...');
        text = 'Please wait';
      } else {
        if (electronUpdateAvailable) {
          title = i18n.t('Update Available!');
          if (!electronUpdateDownloaded) {
            text = i18n.t('Downloading update');
          } else { // available and downloaded
            actions = [
              <button key='dismiss' className={styles.buttonSecondary} onClick={sync.dismissUpdateAvailable}>
                {i18n.t('Dismiss')}
              </button>,
              <button key='install' className={styles.button} onClick={this.handleInstall}>
                {i18n.t('Install')}
              </button>
            ];
          }
        } else { // no update available
          title = i18n.t('Uploader is up-to-date!');
          text = i18n.t('You are running version {{text}}, the most recent one.', { text: config.version });
          actions = (
            <button className={styles.button} onClick={sync.dismissUpdateNotAvailable}>
              {i18n.t('Okay!')}
            </button>
          );
        }
      }
    }
    else { // automatic background check
      if(electronUpdateAvailable && electronUpdateDownloaded){
        title = i18n.t('A new version of Tidepool Uploader is available!');
        actions = [
          <button key='dismiss' className={styles.buttonSecondary} onClick={sync.dismissUpdateAvailable}>
            {i18n.t('Dismiss')}
          </button>,
          <button key='install' className={styles.button} onClick={this.handleInstall}>
            {i18n.t('Install')}
          </button>
        ];
      } else {
        return null;
      }
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
      checkingElectronUpdate: state.working.checkingElectronUpdate.inProgress,
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
