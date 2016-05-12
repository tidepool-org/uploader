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
    isUploadInProgress: React.PropTypes.bool,
    onGroupChange: React.PropTypes.func.isRequired,
    page: React.PropTypes.string.isRequired,
    targetId: React.PropTypes.string,
    targetUsersForUpload: React.PropTypes.array.isRequired
  },

  componentWillReceiveProps: function(nextProps) {
    var self = this;

    if (!this.props.targetId && nextProps.targetId !== null) {
    //  if (this.props.targetTimezone !== null) {
    //    this.props.onTimezoneChange(
    //      nextProps.targetId,
    //      this.props.targetTimezone
    //    );
    //  }
    }
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
      if (targetInfo.patient.isOtherPerson) {
        return targetInfo.patient.fullName;
      }
      return targetInfo.fullName;
    });

    var selectorOpts = _.map(sorted, function(targetId) {
      var targetInfo = allUsers[targetId];
      if (targetInfo.patient.isOtherPerson) {
        return {value: targetId, label: targetInfo.patient.fullName};
      }
      return {value: targetId, label: targetInfo.fullName};
    });

    var disable = this.props.isUploadInProgress ? true : false;

    return (
      <Select clearable={false}
        disabled={disable}
        name={'uploadTargetSelect'}
        onChange={this.props.onGroupChange}
        options={selectorOpts}
        simpleValue={true}
        value={this.props.targetId} />
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
            <div className={styles.addLink}>
              <i className={styles.addIcon}></i>
              Add new
            </div>
          </div>
          <div className={styles.timezoneDropdown}>
            <div className={styles.timezone}>
              <div className={styles.list}>
                {this.renderSelector()}
              </div>
            </div>
            {this.renderError()}
          </div>
        </div>
      </div>
    );
  }
});

module.exports = ClinicUserSelect;
