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
import {pages} from '../constants/otherConstants';
import * as actionSources from '../constants/actionSources';
import * as metrics from '../constants/metrics';

const asyncActions = actions.async;
const syncActions = actions.sync;

export class ClinicUserSelectPage extends Component {

  onSetSelectedClinicId = (clinicId) => {
    this.props.async.fetchPatientsForClinic(clinicId);
    this.props.sync.selectClinic(clinicId);
  };

  onGoToWorkspaceSwitch = () => {
    this.props.async.setPage(pages.WORKSPACE_SWITCH, actionSources.USER, {
      metric: { eventName: metrics.WORKSPACE_SWITCH_DISPLAYED}
    });
  };

  render() {
    const {
      allUsers,
      targetUsersForUpload,
      uploadTargetUser,
      clinics,
      selectedClinicId,
      blipUrls,
      loggedInUser,
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
          selectedClinicId={selectedClinicId}
          onSetSelectedClinicId={this.onSetSelectedClinicId}
          blipUrls={blipUrls}
          loggedInUser={loggedInUser}
          onGoToWorkspaceSwitch={this.onGoToWorkspaceSwitch}
          goToPrivateWorkspace={this.props.async.goToPrivateWorkspace}
          fetchingPatientsForClinic={this.props.fetchingPatientsForClinic}
          fetchPatientsForClinic={this.props.async.fetchPatientsForClinic} />
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
      blipUrls: state.blipUrls,
      loggedInUser: state.loggedInUser,
      fetchingPatientsForClinic: state.working.fetchingPatientsForClinic,
    };
  },
  (dispatch) => {
    return {
      async: bindActionCreators(asyncActions, dispatch),
      sync: bindActionCreators(syncActions, dispatch)
    };
  }
)(ClinicUserSelectPage);
