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
    const { tags } = showingDeviceTimePrompt.cfg.deviceInfo;
    if(_.indexOf(tags, 'insulin-pump') !== -1){
      return { value: 'insulin-pump', text: 'pump' };
    }
    if(_.indexOf(tags, 'cgm') !== -1){
      return { value: 'cgm', text: 'CGM' };
    }
    if(_.indexOf(tags, 'bgm') !== -1){
      return { value: 'bgm', text: 'meter' };
    }
    return 'unknown';
  }

  isDevice = (name) => {
    const { showingDeviceTimePrompt } = this.props;
    const {deviceInfo} = showingDeviceTimePrompt.cfg;
    return deviceInfo && deviceInfo.driverId && deviceInfo.driverId === name;
  }

  handleContinue = () => {
    const { sync, showingDeviceTimePrompt } = this.props;
    showingDeviceTimePrompt.callback('updateTime');
    sync.dismissedDeviceTimePrompt();
  }

  handleCancel = () => {
    const { sync, showingDeviceTimePrompt } = this.props;
    showingDeviceTimePrompt.callback('deviceTimePromptClose');
    sync.dismissedDeviceTimePrompt();
  }

  getActions = () => {
    const { showingDeviceTimePrompt: { cfg: { timezone }, times: { serverTime, deviceTime } } } = this.props;
    const type = this.determineDeviceType();
    const buttons = [];
    const footnote = type.value === 'bgm' ? '*' : '';
    if ( !this.isDevice('Animas') &&
         !this.isDevice('InsuletOmniPod') &&
         !this.isDevice('Medtronic') &&     // these two lines should be removed
         !this.isDevice('Medtronic600') &&  // when we can update time on Medtronic pumps
         !this.isDevice('Tandem') &&
         !this.isDevice('TrueMetrix')
      ) {
      buttons.push(
        <div className={styles.buttonGroup} key='continue' >
        Is the time on your {type.text} incorrect?<br/>&nbsp;
        <button className={styles.button} onClick={this.handleContinue}>
          Automatically update time to<br/>
          {sundial.formatInTimezone(serverTime, timezone, 'LT')}{footnote}, and upload
        </button>
        </div>
      );
    }
    buttons.push(
      <div className={styles.buttonGroup} key='cancel'>
      Are you in {timezone}? Double-check<br/>
      selected time zone and current device time.
      <button className={styles.button} onClick={this.handleCancel}>
        Cancel this upload
      </button>
      </div>
    );

    return buttons;
  }

  getMessage = () => {
    const type = this.determineDeviceType();
    const { showingDeviceTimePrompt: { cfg: { timezone } } } = this.props;
    let message;
    switch (type.value) {
      case 'bgm':
        message = (
          <div className={styles.text}>
            <div className={styles.body}>
            * Changing your device time will not change any previous records.<br/>
            All future readings will be in {timezone}.
            <a href='https://support.tidepool.org/hc/en-us/articles/360034136632' target='_blank'>Click to learn more about meters and device time.</a>
            </div>
          </div>
        );
        break;
      default:
        break;
    }
    return message;
  }

  render() {
    const { showingDeviceTimePrompt } = this.props;

    if(!showingDeviceTimePrompt){
      return null;
    }

    const { showingDeviceTimePrompt: { cfg: { timezone }, times: { serverTime, deviceTime } } } = this.props;

    const type = this.determineDeviceType();
    const message = this.getMessage();
    const actions = this.getActions();

    return (
      <div className={styles.modalWrap}>
        <div className={styles.modal}>
          <div className={styles.title}>
            <div>Your {type.text} doesn't appear to be in</div>
            <div className={styles.highlight}>{`${timezone}:`}</div>
          </div>
          <hr className={styles.hr} />
          <div className={styles.text}>
            <div className={styles.timeCompare}>
              <div>{timezone}:</div>
              <div className={styles.highlight}>{sundial.formatInTimezone(serverTime, timezone, 'LT, LL')}</div>
            </div>
            <div className={styles.timeCompare}>
              <div>Device time:</div>
              <div className={styles.highlight}>{sundial.formatInTimezone(deviceTime, timezone, 'LT, LL')}</div>
            </div>
          </div>
          <hr className={styles.hr} />
          <div className={styles.actions}>
            {actions}
          </div>
          {message}
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
