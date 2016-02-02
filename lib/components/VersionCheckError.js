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

export default class VersionCheckError extends Component {
  static propTypes = {
    errorMessage: PropTypes.string.isRequired,
    errorText: PropTypes.object.isRequired
  };

  static defaultProps = {
    errorText: {
      CHECKING: '(We are checking their blood sugar.)',
      // TODO: if keeping, refactor into errors util as shared constants (also in UploadList)
      HIDE_ERROR_DETAILS: 'Hide details',
      SERVERS_DOWN: 'Tidepool\'s servers are not available right now.',
      // TODO: ditto
      SHOW_ERROR_DETAILS: 'Error details',
      TRY_AGAIN: 'Try again in a few minutes.',
      VERSION_CHECK_FAILED: 'Uploader version check failed'
    }
  };

  state = {
    showingErrorDetails: false
  };

  constructor(props) {
    super(props);
    this.toggleErrorDetails = this.toggleErrorDetails.bind(this);
  }

  render() {
    const { errorMessage, errorText } = this.props;
    const { showingErrorDetails } = this.state;
    const errorDetails = showingErrorDetails ? (
      <div className="UploadList-error-details">{errorMessage}</div>
    ) : false;
    return (
      <div className="VersionCheck">
        <div className="VersionCheck-text">
          <p>{errorText.SERVERS_DOWN}</p>
          <p>{errorText.CHECKING}</p>
          <p>{errorText.TRY_AGAIN}</p>
          <div className="VersionCheck-error">
            <div className="UploadList-error-message-wrapper">
              <span className="UploadList-error-message">
                {errorText.VERSION_CHECK_FAILED}
              </span>
            </div>
            <div className="UploadList-error-text">
              <a href="" onClick={this.toggleErrorDetails}>
                {errorText.SHOW_ERROR_DETAILS}
              </a>
            </div>
            {errorDetails}
          </div>
        </div>
      </div>
    );
  }

  toggleErrorDetails(e) {
    if (e) {
      e.preventDefault();
    }
    const { showingErrorDetails } = this.state;
    this.setState({showingErrorDetails: !showingErrorDetails});
  }
};
