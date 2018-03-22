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
import sundial from 'sundial';

import { sync as syncActions } from '../actions/';

import styles from '../../styles/components/DeviceTimeModal.module.less';

export class DeviceTimeModal extends Component {
  determineDeviceType = () => {
    const { showingDeviceTimePrompt } = this.props;
    const { deviceTags } = showingDeviceTimePrompt.cfg;
    if(_.indexOf(deviceTags, 'insulin-pump') !== -1){
      return 'insulin-pump';
    }
    if(_.indexOf(deviceTags, 'cgm') !== -1){
      return 'cgm';
    }
    if(_.indexOf(deviceTags, 'bgm') !== -1){
      return 'bgm';
    }
    return 'unknown';
  }

  handleContinue = () => {
    const { sync, showingDeviceTimePrompt } = this.props;
    showingDeviceTimePrompt.callback(null);
    sync.dismissedDeviceTimePromp();
  }

  handleCancel = () => {
    const { sync, showingDeviceTimePrompt } = this.props;
    showingDeviceTimePrompt.callback('deviceTimePromptClose');
    sync.dismissedDeviceTimePromp();
  }

  getActions = () => {
    return [
      <button key='continue' className={styles.buttonSecondary} onClick={this.handleContinue}>
        Upload anyway
      </button>,
      <button key='cancel' className={styles.button} onClick={this.handleCancel}>
        Check time again
      </button>
    ];
  }

  getMessage = () => {
    const type = this.determineDeviceType();
    let message;
    switch (type) {
      case 'insulin-pump':
        message = (
          <div className={styles.text}>
            <div className={styles.body}>
            Is your pump time set correctly? If not:
            <br/>
            <div><span className={styles.numeral}>1.</span> Update the time on your pump</div>
            <div><span className={styles.numeral}>2.</span> Suspend your pump</div>
            <div><span className={styles.numeral}>3.</span> Resume your pump</div>
            <div><span className={styles.numeral}>4.</span> Try uploading again</div> 
            </div>
          </div>
        );
        break;
      case 'cgm':
        message = (
          <div className={styles.text}>
            <div className={styles.body}>
            Is your CGM time set correctly? If not:
            <br/>
            <div><span className={styles.numeral}>1.</span> Update the time and date on your CGM</div>
            <div><span className={styles.numeral}>2.</span> Wait for a new reading to appear</div>
            <div><span className={styles.numeral}>3.</span> Try uploading again</div> 
            </div>
          </div>
        );
        break;
      case 'bgm':
        message = (
          <div className={styles.text}>
            <div className={styles.body}>
            Is your meter time set correctly? If not:
            <br/>
            <div><span className={styles.numeral}>1.</span> Update the time and date on your meter</div>
            <div><span className={styles.numeral}>2.</span> Test your blood glucose again</div>
            <div><span className={styles.numeral}>3.</span> Try uploading again</div> 
            </div>
          </div>
        );
        break;
      default:
        break;
    }
    return message;
  }

  getTitle = () => {
    const type = this.determineDeviceType();
    let title;
    switch (type) {
      case 'insulin-pump':
        title = 'Your pump doesn\'t appear to be in';
        break;
      case 'cgm':
        title = 'Your CGM doesn\'t appear to be in';
        break;
      case 'bgm':
        title = 'Your meter doesn\'t appear to be in';
        break;
      default:
        break;
    }
    return title;
  }

  render() {
    const { showingDeviceTimePrompt } = this.props;

    if(!showingDeviceTimePrompt){
      return null;
    }

    const { showingDeviceTimePrompt: { cfg: { timezone }, times: { serverTime, deviceTime } } } = this.props;

    const title = this.getTitle();
    const message = this.getMessage();
    const actions = this.getActions();

    return (
      <div className={styles.modalWrap}>
        <div className={styles.modal}>
          <div className={styles.title}>
            <div>{title}</div>
            <div className={styles.highlight}>{`${timezone}:`}</div>
          </div>
          <hr className={styles.hr} />
          <div className={styles.text}>
            <div className={styles.timeCompare}>
              <div>{timezone}:</div>
              <div className={styles.highlight}>{sundial.formatInTimezone(serverTime, timezone, 'h:mm a')}</div>
            </div>
            <div className={styles.timeCompare}>
              <div>Device time:</div>
              <div className={styles.highlight}>{sundial.formatInTimezone(deviceTime, timezone, 'h:mm a')}</div>
            </div>
          </div>
          <hr className={styles.hr} />
          {message}
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
      showingDeviceTimePrompt: state.showingDeviceTimePrompt
    };
  },
  (dispatch) => {
    return {
      sync: bindActionCreators(syncActions, dispatch)
    };
  }
)(DeviceTimeModal);
