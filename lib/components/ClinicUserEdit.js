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
var personUtils = require('../core/personUtils');

var config = require('../config');

var styles = require('../../styles/components/ClinicUserEdit.module.less');

var MONTHS = [
  {value: '', label: 'Month'},
  {value: '01', label: 'January'},
  {value: '02', label: 'February'},
  {value: '03', label: 'March'},
  {value: '04', label: 'April'},
  {value: '05', label: 'May'},
  {value: '06', label: 'June'},
  {value: '07', label: 'July'},
  {value: '08', label: 'August'},
  {value: '09', label: 'September'},
  {value: '10', label: 'October'},
  {value: '11', label: 'November'},
  {value: '12', label: 'December'}
];

var ClinicUserEdit = React.createClass({
  propTypes: {
    errorMessage: React.PropTypes.string,
    errorDismissed: React.PropTypes.bool.isRequired,
    allUsers: React.PropTypes.object.isRequired,
    loggedInUser: React.PropTypes.string.isRequired,
    targetId: React.PropTypes.string,
    updateUser: React.PropTypes.func.isRequired,
    createUser: React.PropTypes.func.isRequired,
    cancelEdit: React.PropTypes.func.isRequired
  },

  getInitialState: function(){
    if(this.props.targetId){
      var user = _.get(this.props.allUsers, this.props.targetId);
      return {
        name: personUtils.patientFullName(user),
        year: _.get(user, ['patient', 'birthday'], '').substr(0,4),
        month: _.get(user, ['patient', 'birthday'], '').substr(5,2),
        day: _.get(user, ['patient', 'birthday'], '').substr(8,2),
        email: _.get(user, ['patient', 'email'], ''),
        mrn: _.get(user, ['patient', 'mrn'], '')
      };
    }
    return {
      name: '',
      year: '',
      month: '',
      day: ''
    };
  },

  zeroPad: function(value){
    return _.padLeft(value, 2, '0');
  },

  getDateString: function() {
    return _.get(this,'refs.year.value')+'-'+_.get(this,'refs.month.value')+'-'+this.zeroPad(_.get(this,'refs.day.value', ''));
  },

  isValidDate: function(dateString){
    // check to see if date is proper and not in the future
    return (sundial.isValidDateForMask(dateString, 'YYYY-MM-DD')) &&
      (sundial.dateDifference(new Date(), dateString, 'd') > 0);
  },

  handleChange: function(e){
    var errorMessage = '';
    var dateString = this.getDateString();
    if(!_.get(this, 'refs.name.value')){
      errorMessage = 'Name is required';
    }
    if((!_.get(this,'refs.month.value')) || (!_.get(this,'refs.day.value')) ||
      (!_.get(this,'refs.year.value')) || !this.isValidDate(dateString)) {
        errorMessage = 'Invalid date.';
    }
    this.setState({
      [e.target.name]: e.target.value,
      errorMessage: errorMessage
    });
  },

  handleCancel: function(e){
    this.props.cancelEdit();
  },

  handleNext: function(e) {
    e.preventDefault();
    var name = this.refs.name.value;
    var dateString = this.refs.year.value+'-'+this.refs.month.value+'-'+this.zeroPad(this.refs.day.value);
    var email = this.refs.email.value;
    var mrn = this.refs.mrn.value;
    if(sundial.isValidDateForMask(dateString, 'YYYY-MM-DD')){
      var profile = {
        fullName: name,
        patient: {
          birthday: dateString
        }
      };

      if(email){
        profile.patient.email = email;
        profile.emails = [email];
      }

      if(mrn){
        profile.patient.mrn = mrn;
      }

      if(this.props.targetId){
        this.props.updateUser(profile);
      } else {
        this.props.createUser(profile);
      }
    }
  },

  renderMonth: function() {
    var options = _.map(MONTHS, function(item) {
      return <option key={item.value} value={item.value}>{item.label}</option>;
    });
    return (
      <select
        className={styles.monthInput}
        name="month"
        ref="month"
        value={this.state.month}
        onChange={this.handleChange}>
        {options}
      </select>
    );
  },

  renderDay: function() {
    return <input
      className={styles.dateInput}
      name="day"
      ref="day"
      placeholder="Day"
      value={this.state.day}
      onChange={this.handleChange} />;
  },

  renderYear: function() {
    return <input
      className={styles.dateInput}
      name="year"
      ref="year"
      placeholder="Year"
      value={this.state.year}
      onChange={this.handleChange} />;
  },

  renderButton: function() {
    var text = 'Save';
    return (
      <button type="submit"
        className={styles.button}
        onClick={this.handleNext}
        disabled={!!this.state.errorMessage}>
        {text}
      </button>
    );
  },

  renderError: function() {
    if (this.props.errorDismissed || (!this.props.errorMessage && !_.get(this,['state','errorMessage']))) {
      return null;
    }
    return (
      <div className={styles.error}>
        <span>
          {this.props.errorMessage}{this.state.errorMessage}<i className={styles.iconClose} onClick={this.props.dismissCreateCustodialAccountError}></i>
        </span>
      </div>
    );
  },

  render: function() {
    var titleText = this.props.targetId ? 'Edit patient account' : 'Create a new patient account';
    return (
      <div className={styles.main}>
        <div className={styles.header}>
          <div className={styles.title}>
            {titleText}
          </div>
          <div className={styles.accountName}>
            {_.get(this.props.allUsers, [this.props.loggedInUser, 'fullName'])}
          </div>
        </div>
        <form className={styles.form}>
          <div className={styles.inputWrap}>
            <label className={styles.inputLabel} htmlFor="name">Patient Full Name*</label>
            <input className={styles.input} ref="name" name='name' value={this.state.name} onChange={this.handleChange} placeholder=""/>
          </div>
          <div className={styles.inputWrap}>
            <label className={styles.inputLabel} htmlFor="birthday">Patient Birthdate*</label>
            <div className={styles.bdayWrap}>
              {this.renderMonth()}
              {this.renderDay()}
              {this.renderYear()}
            </div>
          </div>
          <div className={styles.inputWrap}>
            <label className={styles.inputLabel} htmlFor="mrn">MRN (optional)</label>
            <input className={styles.input} ref="mrn" name="mrn" value={this.state.mrn} onChange={this.handleChange} />
          </div>
          <div className={styles.inputWrap}>
            <label className={styles.inputLabel} htmlFor="email">Patient Email (optional)</label>
            <input className={styles.input} ref="email" name="email" value={this.state.email} onChange={this.handleChange} />
          </div>
          <div className={styles.actions}>
            <div>
              {this.renderButton()}
            </div>
            <div>
              <div className={styles.cancel} onClick={this.handleCancel}>Cancel</div>
            </div>
          </div>
          {this.renderError()}
        </form>
      </div>
    );
  }
});

module.exports = ClinicUserEdit;
