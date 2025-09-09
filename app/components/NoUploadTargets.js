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

import { urls } from '../constants/otherConstants.js';
import personUtils from '../../lib/core/personUtils.js';

import * as styles from '../../styles/components/NoUploadTargets.module.less';

import { i18n } from '../utils/config.i18next.js';

export default class NoUploadTargets extends Component {
  static propTypes = {
    newPatientLink: PropTypes.string.isRequired,
  };

  render() {
    const { newPatientLink, blipUrl, user } = this.props;
    const isClinicianAccount = personUtils.isClinicianAccount(user);

    return (
      <div>
        <div className={styles.main}>
          {isClinicianAccount ? (
            <>
              <a className={styles.linkCentered} href={blipUrl} target="_blank">
                <div className={styles.buttonStandard}>
                  {i18n.t('Set up or join a clinic workspace')}
                </div>
              </a>
              <p className={styles.paragraph}>
                {i18n.t(
                  'You have not created or joined a clinic workspace yet.'
                )}
                <br />{' '}
                <a
                  className={styles.link}
                  href={urls.HOW_TO_CREATE_CLINICIAN_ACCOUNT_KB_ARTICLE}
                  target="_blank"
                >
                  {i18n.t('Learn more')}
                </a>
              </p>
            </>
          ) : (
            <>
              <a
                className={styles.linkCentered}
                href={newPatientLink}
                target="_blank"
              >
                <div className={styles.buttonCta}>
                  {i18n.t('Set up data storage')}
                </div>
              </a>
              <p className={styles.paragraph}>
                {i18n.t(
                  'Or, ask the person you are uploading for to grant you access to upload.'
                )}
                <br />{' '}
                <a
                  className={styles.link}
                  href={urls.HOW_TO_SHARE_DATA_KB_ARTICLE}
                  target="_blank"
                >
                  {i18n.t('How?')}
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    );
  }
}
