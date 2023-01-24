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
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { pages } from '../constants/otherConstants';
import * as metrics from '../constants/metrics';
import actions from '../actions/';
import React, { Component } from 'react';
import ClinicUserEdit from '../components/ClinicUserEdit';

const asyncActions = actions.async;
const syncActions = actions.sync;

export class ClinicUserEditPage extends Component {
  handleClickChangePerson = (metric = {metric: {eventName: metrics.CLINIC_SEARCH_DISPLAYED}}) => {
    const { setUploadTargetUser } = this.props.sync;
    const { setPage } = this.props.async;
    setUploadTargetUser(null);
    setPage(pages.CLINIC_USER_SELECT, undefined, metric);
  };

  render() {
    const { allUsers, uploadTargetUser, memberships } = this.props;
    return (
      <div>
        <ClinicUserEdit
          targetId={uploadTargetUser}
          allUsers={allUsers}
          memberships={memberships}
          loggedInUser={this.props.loggedInUser}
          createUser={this.props.async.createCustodialAccount}
          createClinicUser={this.props.async.createClinicCustodialAccount}
          updateUser={this.props.async.clickEditUserNext}
          updateClinicPatient={this.props.async.clickClinicEditUserNext}
          cancelEdit={_.partial(this.handleClickChangePerson, {metric: {eventName: metrics.CLINIC_ADD_CANCEL}})}
          createCustodialAccountErrorMessage={this.props.createCustodialAccountErrorMessage}
          createCustodialAccountErrorDismissed={this.props.createCustodialAccountErrorDismissed}
          updateProfileErrorMessage={this.props.updateProfileErrorMessage}
          updateProfileErrorDismissed={this.props.updateProfileErrorDismissed}
          dismissCreateCustodialAccountError={this.props.sync.dismissCreateCustodialAccountError}
          dismissUpdateProfileError={this.props.sync.dismissUpdateProfileError}
          onSubmitFail={this.props.sync.clinicInvalidDate}
          selectedClinicId={this.props.selectedClinicId}
          clinics={this.props.clinics}
          working={this.props.working}
          acknowledgeNotification={this.props.sync.acknowledgeNotification} />
      </div>
    );
  }
}

export default connect(
  (state) => {
    return {
      allUsers: state.allUsers,
      loggedInUser: state.loggedInUser,
      targetUsersForUpload: state.targetUsersForUpload,
      uploadTargetUser: state.uploadTargetUser,
      updateProfileErrorMessage: state.updateProfileErrorMessage,
      updateProfileErrorDismissed: state.updateProfileErrorDismissed,
      createCustodialAccountErrorMessage: state.createCustodialAccountErrorMessage,
      createCustodialAccountErrorDismissed: state.createCustodialAccountErrorDismissed,
      memberships: state.memberships,
      selectedClinicId: state.selectedClinicId,
      clinics: state.clinics,
      working: state.working,
    };
  },
  (dispatch) => {
    return {
      async: bindActionCreators(asyncActions, dispatch),
      sync: bindActionCreators(syncActions, dispatch)
    };
  }
)(ClinicUserEditPage);
