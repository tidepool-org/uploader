
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

import _ from 'lodash';
import React, { Component, PropTypes } from 'react';
import cx from 'classnames';

import Upload from './Upload';

export default class UploadList extends Component {
  static propTypes = {
    devices: PropTypes.object.isRequired,
    potentialUploads: PropTypes.array.isRequired,
    // targetId can be null when logged in user is not a data storage account
    // for example a clinic worker
    targetId: PropTypes.string,
    userDropdownShowing: PropTypes.bool.isRequired
  };

  static defaultProps = {
    SHOW_ERROR : 'Error details',
    HIDE_ERROR : 'Hide details',
    UPLOAD_FAILED : 'Upload Failed: '
  };

  constructor(props) {
    super(props);
  }

  render() {
    const uploadListClasses = cx({
      UploadList: true,
      'UploadList--onlyme': !this.props.userDropdownShowing,
      'UploadList--selectuser': this.props.userDropdownShowing
    });

    const { devices } = this.props;

    const items = _.map(this.props.potentialUploads, (deviceKey) => {
      return (
        <div key={deviceKey} className='UploadList-item'>
          <Upload
            upload={devices[deviceKey]}
            onReset={_.noop}
            onUpload={_.noop}
            readFile={_.noop} />
        </div>
      );
    });

    return (
      <div className={uploadListClasses}>
        {items}
      </div>
    );
  }
}