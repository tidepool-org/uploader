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
var sundial = require('sundial');
var Select = require('react-select');
var cx = require('classnames');

var styles = require('../../styles/components/TimezoneDropdown.module.less');

var TimezoneDropdown = React.createClass({
  propTypes: {
    onTimezoneChange: React.PropTypes.func.isRequired,
    selectorLabel: React.PropTypes.string.isRequired,
    // targetId can be null when logged in user is not a data storage account
    // for example a clinic worker
    targetId: React.PropTypes.string,
    targetTimezone: React.PropTypes.string,
    updateProfileErrorMessage: React.PropTypes.string,
    updateProfileErrorDismissed: React.PropTypes.bool,
    dismissUpdateProfileError: React.PropTypes.func.isRequired,
    isClinicAccount: React.PropTypes.bool,
    userDropdownShowing: React.PropTypes.bool,
    isUploadInProgress: React.PropTypes.bool.isRequired
  },

  componentWillReceiveProps: function(nextProps) {
    var self = this;

    if (!this.props.targetId && nextProps.targetId !== null) {
      if (this.props.targetTimezone !== null) {
        this.props.onTimezoneChange(
          nextProps.targetId,
          this.props.targetTimezone
        );
      }
    }
  },

  componentDidMount: function() {
    var self = this;
    self.updateSuggestedInterval = setInterval(
      function(){
        self.setState({time: new Date()});
      }, 1000 * 60
    );
  },

  componentWillUnmount: function() {
    clearInterval(this.updateSuggestedInterval);
  },

  buildTzSelector: function() {
    var self = this;
    function sortByOffset(timezones) {
      return _.sortBy(timezones, function(tz) {
        return tz.offset;
      });
    }
    var timezones = sundial.getTimezones();
    var opts = sortByOffset(timezones.bigFour)
      .concat(sortByOffset(timezones.unitedStates))
      .concat(sortByOffset(timezones.hoisted))
      .concat(sortByOffset(timezones.theRest));
    var targetUser = this.props.targetId || 'noUserSelected';

    return (
      <Select clearable={false}
        name={'timezoneSelect'}
        onChange={this.props.onTimezoneChange.bind(null, targetUser)}
        options={opts}
        simpleValue={true}
        placeholder={'Type to search...'}
        value={this.props.targetTimezone}
        disabled={this.props.isUploadInProgress} />
    );
  },

  renderSuggestedTime: function() {
    var self = this;
    if(this.props.targetTimezone){
      return (
        <div className={styles.timeDetail}>
          Your device times should be approximately {sundial.formatInTimezone(new Date(), this.props.targetTimezone, 'h:mm a')}
        </div>
      );
    } else {
      return (
        <div className={styles.timeDetail}>
          Please select a time zone.
        </div>
      );
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

  render: function() {
    var timezoneClasses = cx({
      [styles.clinic]: this.props.isClinicAccount,
      [styles.userDropdownShowing]: this.props.userDropdownShowing,
      [styles.timezoneDropdown]: true
    });

    var listClasses = cx({
      [styles.list]: true,
      [styles.listNoValue]: !this.props.targetTimezone
    });

    return (
      <div className={timezoneClasses}>
      {this.renderError()}
        <div className={styles.timezone}>
          <div className={styles.label}>{this.props.selectorLabel}</div>
          <div className={listClasses}>
            {this.buildTzSelector()}
          </div>
          {this.renderSuggestedTime()}
        </div>
      </div>
    );
  }
});

module.exports = TimezoneDropdown;
