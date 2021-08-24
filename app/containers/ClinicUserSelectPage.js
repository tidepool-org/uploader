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

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import actions from '../actions/';
import React, { Component } from 'react';
import ClinicUserSelect from '../components/ClinicUserSelect';

const asyncActions = actions.async;
const syncActions = actions.sync;

export class ClinicUserSelectPage extends Component {

  render() {
    const {
      allUsers,
      targetUsersForUpload,
      uploadTargetUser,
      clinics,
      selectedClinicId,
    } = this.props;
    return (
      <div>
        <ClinicUserSelect
          allUsers={allUsers}
          onUserChange={this.props.async.checkUploadTargetUserAndMaybeRedirect}
          targetId={uploadTargetUser}
          targetUsersForUpload={targetUsersForUpload}
          onAddUserClick={this.props.async.clickAddNewUser}
          setTargetUser={this.props.sync.setUploadTargetUser}
          clinics={clinics}
          selectedClinicId={selectedClinicId} />
      </div>
    );
  }
}

export default connect(
  (state) => {
    return {
      allUsers: state.allUsers,
      targetUsersForUpload: state.targetUsersForUpload,
      uploadTargetUser: state.uploadTargetUser,
      clinics: state.clinics,
      selectedClinicId: state.selectedClinicId,
    };
  },
  (dispatch) => {
    return {
      async: bindActionCreators(asyncActions, dispatch),
      sync: bindActionCreators(syncActions, dispatch)
    };
  }
)(ClinicUserSelectPage);
