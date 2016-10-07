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

var _ = require('lodash');
var React = require('react');

import { urls } from '../redux/constants/otherConstants';

import styles from '../../styles/components/DataStorageCheck.module.less';

var DataStorageCheck = React.createClass({
  render: function() {
    return (
      <div>
        <div className={styles.main}>
          <a className={styles.linkCentered}
            href={urls.ADD_NEW_PATIENT}
            target="_blank">
            <div className={styles.buttonCta}>
              Set up data storage
            </div>
          </a>
          <p className={styles.paragraph}>Or, ask the person you are uploading for to grant you access to upload.<br/> <a href={urls.HOW_TO_SHARE_KB_ARTICLE}>How?</a></p>
        </div>
      </div>
    );
  },
});

module.exports = DataStorageCheck;
