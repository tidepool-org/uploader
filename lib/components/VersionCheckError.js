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
    const { errorMessage } = this.props;
    const userErrorText = this.props.errorText;
    const offline = (errorMessage === errorText.E_OFFLINE);
    const errorDetails = offline ? null : (
      <div className={styles.error}>
        <p className={styles.errorText}>{userErrorText.ERROR_DETAILS}</p>
        <p className={styles.errorText}>{errorMessage}</p>
      </div>
    );
    const firstLine = offline ? userErrorText.OFFLINE : userErrorText.SERVERS_DOWN;
    const secondLine = offline ? userErrorText.CONNECT : userErrorText.TRY_AGAIN;
    const versionCheckClass = cx({
      [styles.failed]: !offline,
      [styles.offline]: offline
    });
    return (
      <div className={versionCheckClass}>
        <div className={styles.text}>
          <p className={styles.paragraph}>{firstLine}</p>
          <p className={styles.paragraph}>{secondLine}</p>
        </div>
        {errorDetails}
      </div>
    );
  }
};
