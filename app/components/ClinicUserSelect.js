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
import Select from 'react-select';

var _ = require('lodash');
var React = require('react');
var PropTypes = require('prop-types');
var sundial = require('sundial');
var cx = require('classnames');
var personUtils = require('../../lib/core/personUtils');
var metrics = require('../constants/metrics');

var styles = require('../../styles/components/ClinicUserSelect.module.less');

import { remote } from 'electron';
const i18n = remote.getGlobal( 'i18n' );

class ClinicUserSelect extends React.Component {
  static propTypes = {
    allUsers: PropTypes.object.isRequired,
    onUserChange: PropTypes.func.isRequired,
    targetId: PropTypes.string,
    targetUsersForUpload: PropTypes.array.isRequired,
    onAddUserClick: PropTypes.func.isRequired,
    setTargetUser: PropTypes.func.isRequired,
    clinics: PropTypes.object.isRequired,
    selectedClinicId: PropTypes.string,
  };

  handleClickNext = (e) => {
    e.preventDefault();
    if(this.props.targetId){
      this.props.onUserChange(this.props.targetId);
    }
  };

  handleOnChange = (userId) => {
    this.props.setTargetUser(userId, {eventName: metrics.CLINIC_SEARCH_SELECTED});
  };

  valueRenderer = (option) => {
    var user, name, bday, mrn, formattedBday, formattedMrn, patient;
    if(this.props.selectedClinicId){
      patient = _.get(this.props.clinics, [this.props.selectedClinicId, 'patients', option.value]);
      name = patient.fullName;
      bday = patient.birthDate;
      mrn = _.get(patient,'mrn','');
    } else {
      user = _.get(this.props.allUsers, option.value);
      name = personUtils.patientFullName(user);
      bday = _.get(user, ['patient', 'birthday'], '');
      mrn = _.get(user, ['patient', 'mrn'], '');
    }

    if (bday) {
      formattedBday = sundial.translateMask(bday, 'YYYY-MM-DD', 'M/D/YYYY');
    }

    if (mrn) {
      formattedMrn = 'MRN:'+mrn;
    }

    return (
      <div className={styles.optionLabelWrapper}>
        <div className={styles.optionLabelName}>
          {name} {formattedMrn}
        </div>
        <div className={styles.optionLabelBirthday}>
          {formattedBday}
        </div>
      </div>
    );
  };

  renderSelector = () => {
    const { selectedClinicId, clinics } = this.props;

    if (selectedClinicId) {
      var patients = _.filter(
        _.get(clinics, [selectedClinicId, 'patients'], []),
        { permissions: { upload: {} } }
      );
      if (!_.isEmpty(patients)) {
        var sortedPatients = _.sortBy(patients, 'fullName');
        var selectorOpts = _.map(sortedPatients, (patient) => {
          var mrn = _.get(patient, 'mrn', '');
          var bday = _.get(patient, 'birthDate', '');
          var fullName = _.get(patient, 'fullName');
          if (bday) {
            bday = ' ' + sundial.translateMask(bday, 'YYYY-MM-DD', 'M/D/YYYY');
          }
          if (mrn) {
            mrn = ' ' + mrn;
          }
          return { value: patient.id, label: fullName + mrn + bday };
        });
      }
    } else {
      var { allUsers, targetUsersForUpload: targets } = this.props;
      var sorted = _.sortBy(targets, function(targetId) {
        return personUtils.patientFullName(allUsers[targetId]);
      });

      var selectorOpts = _.map(sorted, function(targetId) {
        var targetInfo = allUsers[targetId];
        var mrn = _.get(targetInfo, ['patient', 'mrn'], '');
        var bday = _.get(targetInfo, ['patient', 'birthday'], '');
        if(bday){
          bday = ' ' + sundial.translateMask(bday, 'YYYY-MM-DD', 'M/D/YYYY');
        }
        if (mrn) {
          mrn = ' ' + mrn;
        }
        var fullName = personUtils.patientFullName(targetInfo);
        return {value: targetId, label: fullName + mrn + bday};
      });
    }

    return (
      <Select
        name={'uploadTargetSelect'}
        placeholder={i18n.t('Search')}
        className={styles.Select}
        clearable={false}
        simpleValue={true}
        value={this.props.targetId}
        options={selectorOpts}
        matchProp={'label'} //NOTE: we only want to match on the label!
        optionRenderer={this.valueRenderer}
        valueRenderer={this.valueRenderer}
        onChange={this.handleOnChange}
      />
    );
  };

  renderButton = () => {
    var classes = cx({
      [styles.button]: true,
      disabled: !this.props.targetId
    });
    return (
      <div className={classes} disabled={!this.props.targetId} onClick={this.handleClickNext}>
        {i18n.t('Next')}
      </div>
    );
  };

  renderAddNew = () => {
    var classes = cx({
      [styles.addLink]: true
    });
    return (
      <div className={classes} onClick={this.props.onAddUserClick}>
        <i className={styles.addIcon}></i>
        {i18n.t('Add new')}
      </div>
    );
  };

  render() {
    return (
      <div className={styles.wrap}>
        <div className={styles.wrapInner}>
          <div className={styles.headerWrap}>
            <div className={styles.header}>
              {i18n.t('Who are you uploading for?')}
            </div>
            {this.renderAddNew()}
          </div>
          <div className={styles.clinicUserDropdown}>
            {this.renderSelector()}
          </div>
          <div className={styles.buttonRow}>
            {this.renderButton()}
          </div>
        </div>
      </div>
    );
  }
}

module.exports = ClinicUserSelect;
