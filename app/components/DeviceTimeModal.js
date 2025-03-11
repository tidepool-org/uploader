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
import WarningIcon from '@mui/icons-material/Warning';

import { sync as syncActions } from '../actions/';

import * as styles from '../../styles/components/DeviceTimeModal.module.less';

import { i18n } from '../utils/config.i18next';

export class DeviceTimeModal extends Component {
  determineDeviceType = () => {
    const { showingDeviceTimePrompt } = this.props;
    const { deviceInfo } = showingDeviceTimePrompt.cfg;
    if(_.indexOf(deviceInfo?.tags, 'insulin-pump') !== -1){
      return { value: 'insulin-pump', text: i18n.t('pump') };
    }
    if(_.indexOf(deviceInfo?.tags, 'cgm') !== -1){
      return { value: 'cgm', text: i18n.t('CGM') };
    }
    if(_.indexOf(deviceInfo?.tags, 'bgm') !== -1){
      return { value: 'bgm', text: i18n.t('meter') };
    }
    return 'unknown';
  };

  isDevice = (name) => {
    const { showingDeviceTimePrompt } = this.props;
    const {deviceInfo} = showingDeviceTimePrompt.cfg;
    return deviceInfo && deviceInfo.driverId && deviceInfo.driverId === name;
  };

  handleContinue = () => {
    const { sync, showingDeviceTimePrompt } = this.props;
    showingDeviceTimePrompt.callback('updateTime');
    sync.dismissedDeviceTimePrompt();
  };

  handleCancel = () => {
    const { sync, showingDeviceTimePrompt } = this.props;
    showingDeviceTimePrompt.callback('deviceTimePromptClose');
    sync.dismissedDeviceTimePrompt();
  };

  getActions = () => {
    const { showingDeviceTimePrompt: { cfg: { timezone }, times: { serverTime, deviceTime } } } = this.props;
    const type = this.determineDeviceType();
    const reminder = this.getReminder();
    const isTimeSetOnly = this.isSetTimeOnly();
    const buttons = [];
    const footnote = type.value === 'bgm' ? '*' : '';
    let prompt;
    let question;

    buttons.push(
      <div className={styles.buttonGroup} key='cancel'>
      {question}
      {reminder}
      <button className={styles.buttonSecondary} onClick={this.handleCancel}>
        {i18n.t('Cancel this upload')}
      </button>
      </div>
    );

    if ( !this.isDevice('InsuletOmniPod') &&
         !this.isDevice('Medtronic') &&     // these two lines should be removed
         !this.isDevice('Medtronic600') &&  // when we can update time on Medtronic pumps
         !this.isDevice('Tandem') &&
         !this.isDevice('TrueMetrix') &&
         !this.isDevice('Weitai')
      ) {

      let buttonText = (
        <div>
          {i18n.t('Continue with the upload')}<br/>
          <i>Note that past data times will remain incorrect</i>
        </div>
      );

      if (isTimeSetOnly) {
        buttonText = (
          <div>
            {i18n.t('Continue with the upload')}{footnote}
          </div>
        );
      } else {
        prompt = (
          <div>
            {i18n.t('Is the time on your {{text}} incorrect?', { text: type.text })}<br/>&nbsp;
          </div>
        );
        question = (
          <div>
            { i18n.t('Are you in {{timezone}}? Double-check', { timezone: timezone }) } < br />
            { i18n.t('selected time zone and current device time.') }
          </div>
        );
      }
      buttons.push(
        <div className={styles.buttonGroup} key='continue' >
        <button className={styles.button} onClick={this.handleContinue}>
          {buttonText}
        </button>
        </div>
      );
    }

    return buttons;
  };

  getMessage = () => {
    const type = this.determineDeviceType();
    const { showingDeviceTimePrompt: { cfg: { timezone } } } = this.props;
    let message;
    if (type.value === 'bgm') {
        message = (
          <div className={styles.text}>
            <div className={styles.body}>
            {i18n.t('* Changing your device time will not change any previous records.')}<br/>
            {i18n.t('All future readings will be in {{timezone}}.', { timezone: timezone })}
            <a href='https://support.tidepool.org/hc/en-us/articles/360034136632' target='_blank'>{i18n.t('Click to learn more about meters and device time.')}</a>
            </div>
          </div>
        );
    }
    return message;
  };

  getReminder = () => {
    const { showingDeviceTimePrompt: { cfg: { deviceInfo } } } = this.props;
    let reminder;
    if (deviceInfo.model === 'Dash') {
      reminder = (
        <div className={styles.text}>
          <div className={styles.body}>
          {i18n.t('Remember to tap "Export" on the PDM before clicking "Upload".')}
          </div>
        </div>
      );
    }
    return reminder;
  };

  isSetTimeOnly = () => {
    const { showingDeviceTimePrompt: { cfg: { deviceInfo } } } = this.props;
    return deviceInfo.setTimeOnly ? true : false;
  };

  getDifference = (from, to) => {
    const units = [
        ['year', 31536000000],
        ['month', 2628000000],
        ['week', 604800000],
        ['day', 86400000],
        ['hour', 3600000],
        ['minute', 60000],
        ['second', 1000]
    ];

    const diff = to - from;
    const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

    for (const [unit, ms] of units) {
        const value = Math.round(diff / ms);
        if (Math.abs(value) >= 1) {
          const parts = formatter.formatToParts(value, unit);

          if (diff > 0) {
            return `${parts[1].value} ${parts[2].value} ahead`;
          } else {
            return `${parts[0].value} ${parts[1].value.replace(/\s*ago$/, '')} behind`;
          }
        }
    }
    return 'up to date';
  };

  render() {
    const { showingDeviceTimePrompt } = this.props;

    if(!showingDeviceTimePrompt){
      return null;
    }

    const { showingDeviceTimePrompt: { cfg: { timezone, deviceInfo }, times: { serverTime, deviceTime } } } = this.props;

    const type = this.determineDeviceType();
    const actions = this.getActions();
    const message = this.getMessage();
    const mismatch = this.getDifference(serverTime, deviceTime);

    if (this.isSetTimeOnly()) {
      return (
        <div className={styles.modalWrap}>
          <div className={styles.modal}>
            <div className={styles.warningText}>
              <WarningIcon classes={{root:styles.warningIcon}} fontSize='inherit'/> {i18n.t('Warning: The readings may not be shown at the correct date or time.')}
            </div>
            <div className={styles.text}>
              <div className={styles.body}>
                {i18n.t('{{model}} meters are not able share device time with Tidepool. This means we cannot', { model: deviceInfo.model })}<br/>
                {i18n.t('confirm the data you want to upload corresponds with your selected timezone. Tidepool')}<br/>
                {i18n.t('Uploader can set the device\'s date and time based on your current timezone, so future')}<br/>
                {i18n.t('readings have an accurate timestamp associated with them. If this meter already has the')}<br/>
                {i18n.t('correct date and time, nothing will change.')}<br/>
              </div>
            </div>

            <hr className={styles.hr} />
            <div className={styles.text}>
              <div className={styles.timeCompare}>
                <div>{i18n.t('Device Time:')}</div>
                <div className={styles.highlight}>{i18n.t('Unknown')}</div>
              </div>
              <div className={styles.timeCompare}>
                <div>{i18n.t('Tidepool Time:')}</div>
                <div className={styles.highlight}>({timezone}) {sundial.formatInTimezone(serverTime, timezone, 'LT, LL')}</div>
              </div>
            </div>
            <hr className={styles.hr} />
            <div className={styles.actions}>
              {actions}
            </div>
            <div className={styles.text}>
              <div className={styles.body}>
              {i18n.t('* By clicking "Continue", you acknowledge that the date and time of past data may not')}<br/>
              {i18n.t('be accurate and Tidepool will update the date and time of this meter to ensure future')}<br/>
              {i18n.t('readings have an accurate timestamp.')} <a href='https://support.tidepool.org/hc/en-us/articles/360034136632' target='_blank'>{i18n.t('Learn more about meters and device time.')}</a>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className={styles.modalWrap}>
          <div className={styles.modal}>
            <div className={styles.warningText}>
              <WarningIcon classes={{ root: styles.warningIcon }} fontSize='inherit' />
              <div className={styles.warningMessage}>
                <strong>{i18n.t('Warning: Time Mismatch Detected')}</strong>
                <div>{i18n.t('The device is {{mismatch}}, based on the time zone selected in Tidepool Uploader.', { mismatch: mismatch })}</div>
              </div>
            </div>
            <hr className={styles.hr} />
            <div className={styles.text}>
              <div className={styles.timeCompare}>
                <div>{i18n.t('Device Time:')}</div>
                <div className={styles.highlight}>{sundial.formatInTimezone(deviceTime, timezone, 'LT, LL')}</div>
              </div>
              <div className={styles.timeCompare}>
                <div>Tidepool Time:</div>
                <div className={styles.highlight}>{timezone} {sundial.formatInTimezone(serverTime, timezone, 'LT, LL')}</div>
              </div>
            </div>
            <hr className={styles.hr} />
            <div className={styles.list}>
              <ol>
                <li>{i18n.t('Please check that the time zone you selected in Tidepool Uploader is correct before continuing. Cancel this upload if it is not correct.')}</li>
                <li>{i18n.t('Tidepool can not fix past readings, so if you choose to upload, the readings will remain incorrect. However, Tidepool will update the meter\'s clock so future readings show the right time.')} <a href='https://support.tidepool.org/hc/en-us/articles/360034136632' target='_blank'>{i18n.t('Learn more.')}</a></li>
              </ol>
            </div>
            <div className={styles.actions}>
              {actions}
            </div>
          </div>
        </div>
      );
    }
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
