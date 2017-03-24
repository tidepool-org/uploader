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

import React, { Component, PropTypes } from 'react';

import styles from '../../styles/components/Footer.module.less';

export default class Footer extends Component {
  static propTypes = {
    version: PropTypes.string.isRequired,
  };

  render() {
		const version = this.props.version;
    return (
			<div className={styles.footer}>
	      <div className={styles.footerRow}>
					<div>
	          <a className={styles.footerLink} href="http://support.tidepool.org/" target="_blank">Get Support</a>
	        </div>
					<div>
						<a className={styles.footerLink} href="http://tidepool.org/legal/" target="_blank">Privacy and Terms of Use</a>
					</div>
					<div>
						<span className={styles.jdrfText}>Made possible by</span><img className={styles.jdrfImage} src="../images/JDRF_Reverse_Logo x2.png"/>
					</div>
	      </div>
				<div className={styles.footerRow}>
					<div className={styles.version}>{`v${version}`}</div>
				</div>
			</div>
    );
  }
};
