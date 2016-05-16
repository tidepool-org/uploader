/*
* == BSD2 LICENSE ==
* Copyright (c) 2014, Tidepool Project
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
var Select = require('react-select');

var styles = require('../../styles/components/ClinicUserSelect.module.less');
 
var ClinicUserSelect = React.createClass({
  propTypes: {
    allUsers: React.PropTypes.object.isRequired,
    onUserChange: React.PropTypes.func.isRequired,
    targetId: React.PropTypes.string,
    targetUsersForUpload: React.PropTypes.array.isRequired,
    onAddUserClick: React.PropTypes.func.isRequired
  },

  renderError: function() {
    var self = this;
    if(this.props.updateProfileErrorMessage && !this.props.updateProfileErrorDismissed){
      return (
        <div className={styles.error}>
          {this.props.updateProfileErrorMessage}
          <i className={styles.iconClose} onClick={this.props.dismissUpdateProfileError}></i>
        </div>
      );
    }
  },

  renderSelector: function(){
    var allUsers = this.props.allUsers;
    var targets = this.props.targetUsersForUpload;

    // and now return them sorted them by name
    var sorted = _.sortBy(targets, function(targetId) {
      var targetInfo = allUsers[targetId];
      if (_.get(targetInfo, ['patient','isOtherPerson'])) {
        return targetInfo.patient.fullName;
      }
      return targetInfo.fullName;
    });

    var selectorOpts = _.map(sorted, function(targetId) {
      var targetInfo = allUsers[targetId];
      if (_.get(targetInfo, ['patient','isOtherPerson'])) {
        return {value: targetId, label: targetInfo.patient.fullName};
      }
      return {value: targetId, label: targetInfo.fullName};
    });

    return (
      <Select clearable={false}
        name={'uploadTargetSelect'}
        onChange={this.props.onUserChange}
        options={selectorOpts}
        simpleValue={true}
        value={this.props.targetId}
        className={styles.Select}
        placeholder={'Search'} />
    );
  },

  render: function() {

    return (
      <div className={styles.wrap}>
        <div className={styles.wrapInner}>
          <div className={styles.headerWrap}>
            <div className={styles.header}>
              Who are you uploading for?
            </div>
            <div className={styles.addLink} onClick={this.props.onAddUserClick}>
              <i className={styles.addIcon}></i>
              Add new
            </div>
          </div>
          <div className={styles.clinicUserDropdown}>
            {this.renderSelector()}
            {this.renderError()}
          </div>
        </div>
      </div>
    );
  }
});

module.exports = ClinicUserSelect;
