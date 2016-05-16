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

var React = require('react');
var _ = require('lodash');
var sundial = require('sundial');

var config = require('../config');

var styles = require('../../styles/components/ClinicUserEdit.module.less');

var MONTHS = [
  {value: '', label: 'Month'},
  {value: '1', label: 'January'},
  {value: '2', label: 'February'},
  {value: '3', label: 'March'},
  {value: '4', label: 'April'},
  {value: '5', label: 'May'},
  {value: '6', label: 'June'},
  {value: '7', label: 'July'},
  {value: '8', label: 'August'},
  {value: '9', label: 'September'},
  {value: '10', label: 'October'},
  {value: '11', label: 'November'},
  {value: '12', label: 'December'}
];

var ClinicUserEdit = React.createClass({
  propTypes: {
    errorMessage: React.PropTypes.string,
    allUsers: React.PropTypes.object,
    loggedInUser: React.PropTypes.string,
    targetId: React.PropTypes.string,
    updateUser: React.PropTypes.func,
    createUser: React.PropTypes.func
  },
  renderMonth: function() {
    var options = _.map(MONTHS, function(item) {
      return <option key={item.value} value={item.value}>{item.label}</option>;
    });
    return (
      <select
        className={styles.monthInput}
        name="month"
        ref="month">
        {options}
      </select>
    );
  },
  renderDay: function() {
    return <input
      className={styles.dateInput}
      name="day"
      ref="day"
      placeholder="Day" />;
  },
  renderYear: function() {
    return <input
      className={styles.dateInput}
      name="year"
      ref="year"
      placeholder="Year" />;
  },
  render: function() {
    return (
      <div className={styles.main}>
        <div className={styles.header}>
          <div className={styles.title}>
            Create a new patient account
          </div>
          <div className={styles.accountName}>
            {_.get(this.props.allUsers, [this.props.loggedInUser, 'fullName'])}
          </div>
        </div>
        <form className={styles.form}>
          <div className={styles.inputWrap}>
            <label className={styles.inputLabel} htmlFor="name">Patient Full Name*</label>
            <input className={styles.input} ref="name" placeholder=""/>
          </div>
          <div className={styles.inputWrap}>
            <label className={styles.inputLabel} htmlFor="birthday">Patient Birthdate*</label>
            <div className={styles.bdayWrap}>
              {this.renderMonth()}
              {this.renderDay()}
              {this.renderYear()}
            </div>
          </div>
          <div className={styles.actions}>
            <div>
              {this.renderButton()}
            </div>
          </div>
          <div className={styles.error}>{this.renderError()}</div>
        </form>
      </div>
    );
  },

  renderButton: function() {
    var text = 'Next';

    return (
      <button type="submit"
        className={styles.button}
        onClick={this.handleNext}
        disabled={this.props.isFetching || this.props.disabled}>
        {text}
      </button>
    );
  },

  handleNext: function(e) {
    e.preventDefault();
    var name = this.refs.name.value;
    var date = {
      month: this.refs.month.value,
      day: this.refs.day.value,
      year: this.refs.year.value,
      minutes: 0,
      seconds: 0,
      hours: 0
    };
    var timestamp = sundial.buildTimestamp(date);
    var dateString = sundial.formatFromOffset(timestamp, 0, 'YYYY-MM-DD');
    var profile = {
      fullName: name,
      patient: {
        birthday: dateString
      }
    };

    if(this.props.targetId){
      //update existing user
      this.props.updateUser();
    } else {
      this.props.createUser(profile);
      //create new user
    }
  },

  renderError: function() {
    if (!this.props.errorMessage && !_.get(this,['state','errorMessage'])) {
      return null;
    }
    return <span>{this.props.errorMessage}{this.state.errorMessage}</span>;
  }
});

module.exports = ClinicUserEdit;
