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
    page: React.PropTypes.string.isRequired,
    user: React.PropTypes.object.isRequired,
    onGroupChange: React.PropTypes.func.isRequired,
    targetId: React.PropTypes.string,
    isUploadInProgress: React.PropTypes.bool
  },

  availableUploadGroups: function(){
    //can only upload for yourself
    if (_.isEmpty(this.props.user.uploadGroups) || this.props.user.uploadGroups.length <= 1) {
      return null;
    }

    //only groups we can upload too, e.g. some people simply aren't `patients` and might be setup without data storage
    var available = _.filter(this.props.user.uploadGroups, function(group) {
      return _.isEmpty(group.profile.patient) === false;
    });

    //and now return them sorted them by name
    return _.sortBy(available, function(group) {
      if (group.profile.patient.isOtherPerson) {
        return group.profile.patient.fullName;
      }
      return group.profile.fullName;
    });
  },

  render: function() {
    var sortedGroups = this.availableUploadGroups();

    if (_.isEmpty(sortedGroups)){
      // we're already doing a check to see if we want to render in App.jsx
      // but this is an extra measure of protection against trying to render
      // when we don't have the groups to do so
      return null;
    }

    var options = _.map(sortedGroups, function(group) {
      // for child accounts
      if (group.profile.patient.isOtherPerson){
        return (
          <option key={group.userid} value={group.userid}>{group.profile.patient.fullName}</option>
        );
      }
      return (
        <option key={group.userid} value={group.userid}>{group.profile.fullName}</option>
      );
    });

    var disabled = this.props.isUploadInProgress ? 'disabled' : '';

    var text = this.props.page === 'main' ? 'Upload data for' : 'Choose devices for';

    var self = this;

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
          <div className="UploadSettings-uploadGroup--label">{text}</div>
          <div className={'UploadSettings-uploadGroup--list UploadSettings--' + this.props.page}>
            {select}
          </div>
        </div>
      </div>
    );
  }
});

module.exports = UploadSettings;
