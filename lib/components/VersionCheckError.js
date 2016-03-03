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

import cx from 'classnames';
import React, { Component, PropTypes } from 'react';

import * as errorUtils from '../redux/utils/errors';
import errorText from '../redux/constants/errors';

import styles from '../../styles/components/VersionCheck.module.less';

export default class VersionCheckError extends Component {
  static propTypes = {
    errorMessage: PropTypes.string.isRequired,
    errorText: PropTypes.object.isRequired
  };

  static defaultProps = {
    errorText: {
      CONNECT: 'Please check your connection, quit & relaunch to try again.',
      ERROR_DETAILS: 'Details for Tidepool\'s developers:',
      OFFLINE: 'You\'re not connected to the Internet.',
      SERVERS_DOWN: 'Tidepool\'s servers are down.',
      TRY_AGAIN: 'In a few minutes, please quit & relaunch to try again.'
    }
  };

  constructor(props) {
    super(props);
  }

  render() {
    const { errorMessage, errorText } = this.props;
    const offline = errorMessage === errorUtils.errorText.E_OFFLINE;
    const errorDetails = offline ? null : (
      <div className={styles['VersionCheck-error']}>
        <p>{errorText.ERROR_DETAILS}</p>
        <p>{errorMessage}</p>
      </div>
    );
    const firstLine = offline ? errorText.OFFLINE : errorText.SERVERS_DOWN;
    const secondLine = offline ? errorText.CONNECT : errorText.TRY_AGAIN;
    const versionCheckClass = cx({
      [styles['VersionCheck--failed']]: !offline,
      [styles['VersionCheck--offline']]: offline
    });
    return (
      <div className={versionCheckClass}>
        <div className={styles['VersionCheck-text']}>
          <p>{firstLine}</p>
          <p>{secondLine}</p>
        </div>
        {errorDetails}
      </div>
    );
  }
};
