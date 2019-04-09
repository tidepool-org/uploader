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

import { reduxForm, Field, Fields } from 'redux-form';
import { connect } from 'react-redux';

var React = require('react');
var PropTypes = require('prop-types');
var _ = require('lodash');
var sundial = require('sundial');
var personUtils = require('../../lib/core/personUtils');
var styles = require('../../styles/components/ClinicUserEdit.module.less');

function zeroPad(value){
  return _.padStart(value, 2, '0');
}

function validateForm(values){
  var errors = {};
  if(!values.fullName){
    errors.fullName = 'Your patient\'s full name is needed';
  }
  if(values.year && values.month && values.day){
    if(!isValidDate(values.year + '-' + values.month + '-' + zeroPad(values.day))){
      errors.year = 'Hmm, this date doesn’t look right';
    }
  } else {
    errors.year = 'Hmm, this date doesn’t look right';
  }
  return errors;
}

function isValidDate(dateString){
  // check to see if date is proper and not in the future
  return (sundial.isValidDateForMask(dateString, 'YYYY-MM-DD')) &&
    (sundial.dateDifference(new Date(), dateString, 'd') > 0);
}

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

var options = _.map(MONTHS, function(item) {
  return <option key={item.value} value={item.value}>{item.label}</option>;
});

function renderInput(field){
  return (
    <div>
      <input className={styles.input} {...field.input} type={field.type} disabled={field.disabled} />
      {field.meta.touched &&
       field.meta.error &&
       <div className={styles.validationError}>{field.meta.error}</div>}
    </div>
  );
};

class ClinicUserEdit extends React.Component {
  static propTypes = {
    createCustodialAccountErrorMessage: PropTypes.string,
    createCustodialAccountErrorDismissed: PropTypes.bool.isRequired,
    dismissCreateCustodialAccountError: PropTypes.func.isRequired,
    updateProfileErrorMessage: PropTypes.string,
    updateProfileErrorDismissed: PropTypes.bool.isRequired,
    dismissUpdateProfileError: PropTypes.func.isRequired,
    allUsers: PropTypes.object.isRequired,
    loggedInUser: PropTypes.string.isRequired,
    targetId: PropTypes.string,
    updateUser: PropTypes.func.isRequired,
    createUser: PropTypes.func.isRequired,
    cancelEdit: PropTypes.func.isRequired,
    onSubmitFail: PropTypes.func.isRequired
  };

  handleCancel = () => {
    this.props.cancelEdit();
  };

  handleNext = (values) => {
    var name = values.fullName;
    var dateString = values.year+'-'+values.month+'-'+zeroPad(values.day);
    var { email, mrn } = values;
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
  };

  renderCreateError = () => {
    if (this.props.createCustodialAccountErrorDismissed || !this.props.createCustodialAccountErrorMessage) {
      return null;
    }
    return (
      <div className={styles.error}>
        <span>
          {this.props.createCustodialAccountErrorMessage}<i className={styles.iconClose} onClick={this.props.dismissCreateCustodialAccountError}></i>
        </span>
      </div>
    );
  };

  renderUpdateError = () => {
    if (this.props.updateProfileErrorDismissed || !this.props.updateProfileErrorMessage) {
      return null;
    }
    return (
      <div className={styles.error}>
        <span>
          {this.props.updateProfileErrorMessage}<i className={styles.iconClose} onClick={this.props.dismissUpdateProfileError}></i>
        </span>
      </div>
    );
  };

  renderDateInputs = (fields) => (
    <div>
      <div className={styles.bdayWrap}>
        <select className={styles.monthInput} {...fields.month.input} disabled={fields.disabled}>
          {options}
        </select>
        <input className={styles.dateInput} placeholder="Day" {...fields.day.input} type="text" disabled={fields.disabled}/>
        <input className={styles.dateInput} placeholder="Year" {...fields.year.input} type="text" disabled={fields.disabled}/>
      </div>
      {this.renderDateError(fields)}
    </div>
  );

  renderDateError = (fields) => {
    const {month, day, year} = fields;
    if (!year || !year.meta.error) { return null; }
    // only render the error if each field has either been touched or has a value
    // and the user is not interacting with any of them
    const monthCheck = ((month.meta.touched || month.input.value) && !month.meta.active);
    const dayCheck = ((day.meta.touched || day.input.value) && !day.meta.active);
    const yearCheck = ((year.meta.touched || year.input.value) && !year.meta.active);
    return monthCheck && dayCheck && yearCheck &&
      (<div className={styles.validationError}>{year.meta.error}</div>);
  };

  render() {
    const { handleSubmit, targetId, memberships } = this.props;
    const isCustodialAccount = _.has(_.get(memberships, [targetId, 'permissions']), 'custodian');
    const titleText = targetId ? 'Edit patient account' : 'Create a new patient account';
    const editable = targetId ? isCustodialAccount : true;

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
        <form className={styles.form} onSubmit={handleSubmit(this.handleNext)}>
          <div className={styles.inputWrap}>
            <label className={styles.inputLabel} htmlFor="name">
              Patient Full Name
            </label>
            <Field name="fullName" component={renderInput} props={{ disabled: !editable }} />
          </div>
          <div className={styles.inputWrap}>
            <label className={styles.inputLabel} htmlFor="birthday">
              Patient Birthdate
            </label>
            <Fields names={['month', 'day', 'year']} component={this.renderDateInputs} props={{ disabled: !editable }} />
          </div>
          <div className={styles.inputWrap}>
            <label className={styles.inputLabel} htmlFor="mrn">
              MRN (optional)
            </label>
            <Field name="mrn" component={renderInput} props={{ disabled: !editable }} />
          </div>
          <div className={styles.inputWrap}>
            <label className={styles.inputLabel} htmlFor="email">
              Patient Email (optional)
            </label>
            <Field name="email" component={renderInput} props={{ disabled: !editable }} />
          </div>
          <div className={styles.actions}>
            <div>
              <button type="submit" className={styles.button} disabled={!editable}>
                Save
              </button>
            </div>
            <div>
              <div className={styles.cancel} onClick={this.handleCancel}>
                Cancel
              </div>
            </div>
            {this.renderCreateError()}
            {this.renderUpdateError()}
          </div>
        </form>
      </div>
    );
  }
}

const ClinicUserEditWrapped = reduxForm({
  form: 'userEdit',
  validate: validateForm
})(ClinicUserEdit);

function mapStateToProps(state){
    let initialValues = {};

    if(state.uploadTargetUser){
      var user = _.get(state.allUsers, state.uploadTargetUser);
      initialValues = {
        initialValues: {
          fullName: personUtils.patientFullName(user),
          year: _.get(user, ['patient', 'birthday'], '').substr(0,4),
          month: _.get(user, ['patient', 'birthday'], '').substr(5,2),
          day: _.get(user, ['patient', 'birthday'], '').substr(8,2),
          email: _.get(user, ['patient', 'email'], ''),
          mrn: _.get(user, ['patient', 'mrn'], '')
        }
      };
    };

    return initialValues;
}

export default connect(mapStateToProps)(ClinicUserEditWrapped);
