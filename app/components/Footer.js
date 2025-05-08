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

import PropTypes from 'prop-types';

import React, { Component } from 'react';

import * as styles from '../../styles/components/Footer.module.less';
import debugMode from '../utils/debugMode';
import env from '../utils/env';
import { getOSDetails } from '../actions/utils';

import { i18n } from '../utils/config.i18next';

export default class Footer extends Component {
  static propTypes = {
    version: PropTypes.string.isRequired,
  };

  render() {
    const {version} = this.props;
    let osArch = '';
    let environment = '';
    let betaWarning = '';

    if (debugMode.isDebug) {
      osArch = ` (${getOSDetails()})`;
      environment = `  - ${this.props.environment}`;
    }

    if(env.browser){
      betaWarning = (<div className={styles.footerRow}>
          <div className={styles.betaWarning}>Tidepool Web Uploader BETA</div>
        </div>);
    }

    return (
      <div className={styles.footer}>
        {betaWarning}
        <div className={styles.footerRow}>
          <div>
            <a className={styles.footerLink} href="http://support.tidepool.org/" target="_blank">{i18n.t('Get Support')}</a>
          </div>
          <div>
            <a className={styles.footerLink} href="http://tidepool.org/legal/" target="_blank">{i18n.t('Privacy and Terms of Use')}</a>
          </div>
        </div>
        <div className={styles.footerRow}>
          <div className={styles.version}>{`v${version}${osArch}${environment}`}</div>
        </div>
      </div>
    );
  }
}
