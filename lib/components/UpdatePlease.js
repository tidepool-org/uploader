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

import React, { Component, PropTypes } from 'react';

export default class UpdatePlease extends Component {
  static propTypes = {
    knowledgeBaseLink: PropTypes.string.isRequired,
    updateText: PropTypes.object.isRequired
  };

  static defaultProps = {
    updateText: {
      NEEDS_UPDATED: 'This uploader needs to be updated!',
      IMPROVEMENTS: '(We made some improvements.)'
    }
  };

  render() {
    const { knowledgeBaseLink, updateText } = this.props;
    return (
      <div className="VersionCheck">
        <div className="VersionCheck-text">
          <p>{updateText.NEEDS_UPDATED}</p>
          <p>{updateText.IMPROVEMENTS}</p>
          <p className='most-important'>
            Follow <a href={knowledgeBaseLink} target="_blank">these instructions</a> to do so.
          </p>
        </div>
      </div>
    );
  }
};
