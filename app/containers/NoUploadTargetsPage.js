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
import { connect } from 'react-redux';
import React, { Component } from 'react';
import NoUploadTargets from '../components/NoUploadTargets';

export class NoUploadTargetsPage extends Component {

  render() {
    const newPatientLink = _.get(this.props, ['blipUrls', 'newPatient'], '');
    const blipUrl = _.get(this.props, ['blipUrls', 'blipUrl'], '');
    const user = _.get(this.props, ['allUsers', this.props.loggedInUser], null);
    return (
      <div>
        <NoUploadTargets
          blipUrl={blipUrl}
          newPatientLink={newPatientLink}
          user={user} />
      </div>
    );
  }
}

export default connect(
  (state) => {
    return {
      allUsers: state.allUsers,
      blipUrls: state.blipUrls,
      loggedInUser: state.loggedInUser,
    };
  }
)(NoUploadTargetsPage);
