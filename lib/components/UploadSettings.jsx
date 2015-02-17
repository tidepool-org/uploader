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

var UploadSettings = React.createClass({
  propTypes: {
    user: React.PropTypes.object.isRequired,
    onGroupChange: React.PropTypes.func.isRequired,
    targetId: React.PropTypes.string,
    isUploadInProgress: React.PropTypes.bool
  },

  // Can I only upload for myself
  onlyMe: function(){
    return (this.props.user.uploadGroups.length == 1 && this.props.user.uploadGroups[0].userid == this.props.user.userid);
  },

  render: function() {
    //do we want to render??
    if (_.isEmpty(this.props.user.uploadGroups) || this.onlyMe()) {
      return null;
    }
    var self = this;

    // sort users alpha by full name
    var sortedGroups = _.sortBy(this.props.user.uploadGroups, function(group) {
      return group.profile.fullName;
    });

    var options = _.map(sortedGroups, function(group) {
      return (
        <option key={group.userid} value={group.userid}>{group.profile.fullName}</option>
      );
    });

    var disabled = this.props.isUploadInProgress ? 'disabled': '';

    var select = function() {
      if (self.props.isUploadInProgress) {
        return (
          <select disabled onChange={self.props.onGroupChange} value={self.props.targetId} ref='uploadGroupSelect'>
            {options}
          </select>
        );
      }

      return (
        <select onChange={self.props.onGroupChange} defaultValue={self.props.targetId} ref='uploadGroupSelect'>
          {options}
        </select>
      );
    }();

    return (
      <div className="UploadSettings">
        <div className="UploadSettings-uploadGroup">
          <div className="UploadSettings-left UploadSettings-uploadGroup--label">{"Upload data for"}</div>
          <div className="UploadSettings-right UploadSettings-uploadGroup--list">
            {select}
          </div>
        </div>
      </div>
    );
  }
});

module.exports = UploadSettings;
