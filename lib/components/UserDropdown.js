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
var personUtils = require('../core/personUtils');

var pages = require('../redux/constants/otherConstants').pages;

var styles = require('../../styles/components/UserDropdown.module.less');

var UserDropdown = React.createClass({
  propTypes: {
    allUsers: React.PropTypes.object.isRequired,
    isUploadInProgress: React.PropTypes.bool,
    onGroupChange: React.PropTypes.func.isRequired,
    page: React.PropTypes.string.isRequired,
    targetId: React.PropTypes.string,
    targetUsersForUpload: React.PropTypes.array.isRequired
  },

  groupSelector: function(){
    var allUsers = this.props.allUsers;
    var targets = this.props.targetUsersForUpload;

    // and now return them sorted them by name
    var sorted = _.sortBy(targets, function(targetId) {
      return personUtils.patientFullName(allUsers[targetId]);
    });

    var selectorOpts = _.map(sorted, function(targetId) {
      return {
        value: targetId,
        label: personUtils.patientFullName(allUsers[targetId])
      };
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
    // we're already doing a check to see if we want to render in App.js
    // but this is an extra measure of protection against trying to render
    // when we don't have the potential target users to do so
    if (_.isEmpty(this.props.targetUsersForUpload)) {
      return null;
    }

    var text = this.props.page === pages.MAIN ?
      'Upload data for' : 'Choose devices for';

    return (
      <div>
        <div className={styles.uploadGroup}>
          <div className={styles.label}>{text}</div>
          <div className={styles[this.props.page.toLowerCase()]}>
            {this.groupSelector()}
          </div>
        </div>
      </div>
    );
  }
});

module.exports = UserDropdown;
