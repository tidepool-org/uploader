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
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

const remote = require('@electron/remote');
const i18n = remote.getGlobal( 'i18n' );

import api from '../../lib/core/api';

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
    onSetSelectedClinicId: PropTypes.func.isRequired,
    blipUrls: PropTypes.object.isRequired,
    loggedInUser: PropTypes.string.isRequired,
    onGoToWorkspaceSwitch: PropTypes.func.isRequired,
    goToPrivateWorkspace: PropTypes.func.isRequired,
    fetchingPatientsForClinic: PropTypes.object.isRequired,
    fetchPatientsForClinic: PropTypes.func.isRequired,
    searchDebounceMs: PropTypes.number.isRequired,
  };

  static defaultProps = {
    searchDebounceMs: 1000,
  };

  constructor(props) {
    super(props);
    this.state = { clinicDropdownOpen: false, searchText: '' };
  };

  handleSearchChange = () => _.debounce((searchText) => {
    const {fetchPatientsForClinic, selectedClinicId, targetId} = this.props;
    if(searchText !== this.state.searchText){
      if(_.isEmpty(searchText)){
        if(!targetId){
          this.setState({searchText});
          fetchPatientsForClinic(selectedClinicId);
        }
      } else {
        this.setState({searchText});
        fetchPatientsForClinic(selectedClinicId, {search: searchText});
      }
    }
  }, this.props.searchDebounceMs);

  handleClickNext = (e) => {
    e.preventDefault();
    if(this.props.targetId){
      this.props.onUserChange(this.props.targetId);
    }
  };

  handleOnChange = (userId) => {
    this.props.setTargetUser(userId, {eventName: metrics.CLINIC_SEARCH_SELECTED});
  };

  handleDropdownToggle = (e) => {
    e.preventDefault();
    this.setState({
      clinicDropdownOpen: !this.state.clinicDropdownOpen
    });
  };

  handleSwitchClinic = (clinic) => {
    this.setState({
      clinicDropdownOpen: false
    });
    this.props.onSetSelectedClinicId(clinic.id);
    api.metrics.track(metrics.WORKSPACE_GO_TO_SWITCHER, {
      clinicId: clinic.id,
    });
  };

  handleSwitchToPrivate = (e) => {
    e.preventDefault();
    this.props.goToPrivateWorkspace();
  };

  handleWorkspaceSwitch = (e) => {
    e.preventDefault();
    const metricProps = this.props.selectedClinicId
      ? { clinicId: this.props.selectedClinicId }
      : {};
    api.metrics.track(metrics.WORKSPACE_TEXT_CHANGE, metricProps);
    this.props.onGoToWorkspaceSwitch();
  };

  handleTidepoolWebLink = (e) => {
    const metricProps = this.props.selectedClinicId
      ? { clinicId: this.props.selectedClinicId }
      : {};
    api.metrics.track(metrics.WORKSPACE_GO_TO_TIDEPOOL_WEB, metricProps);
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
      bday = _.get(user, ['profile', 'patient', 'birthday'], '');
      mrn = _.get(user, ['profile', 'patient', 'mrn'], '');
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
    const clinicSearchProps = {};

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
      clinicSearchProps.onInputChange = this.handleSearchChange();
      clinicSearchProps.filterOptions = (opts)=>opts;
    } else {
      var { allUsers, targetUsersForUpload: targets, loggedInUser } = this.props;
      var user = allUsers[loggedInUser];
      var hasPatientProfile = _.get(user, ['profile', 'patient'], false);
      if(hasPatientProfile && !_.includes(targets, loggedInUser)) {
        targets.push(loggedInUser);
      }
      var sorted = _.sortBy(targets, function(targetId) {
        return personUtils.patientFullName(allUsers[targetId]);
      });

      var selectorOpts = _.map(sorted, function(targetId) {
        var targetInfo = allUsers[targetId];
        var mrn = _.get(targetInfo, ['profile', 'patient', 'mrn'], '');
        var bday = _.get(targetInfo, ['profile', 'patient', 'birthday'], '');
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
        isLoading={this.props.fetchingPatientsForClinic.inProgress}
        onSelectResetsInput={false}
        {...clinicSearchProps}
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
    const {loggedInUser, allUsers, selectedClinicId} = this.props;
    const user = allUsers[loggedInUser];

    var classes = cx({
      [styles.addLink]: true
    });
    if((user?.isClinicMember && !!selectedClinicId) || personUtils.isClinic(user)){
      return (
        <div className={classes} onClick={this.props.onAddUserClick}>
          <i className={styles.addIcon}></i>
          {i18n.t('Add new')}
        </div>
      );
    }
  };

  renderClinicIndicator = () => {
    var {clinics, selectedClinicId} = this.props;
    if(!_.isEmpty(clinics)){
      if(selectedClinicId) {
        var keys = _.keys(clinics);
        if(keys.length > 1){
          return (
            <div className={styles.clinicWrapper}>
              <div className={styles.clinicHeader} onClick={this.handleDropdownToggle}>
                {clinics[selectedClinicId].name}
                <div className={styles.dropdownWrap}>
                  <ArrowDropDownIcon fontSize='inherit' />
                  {this.state.clinicDropdownOpen &&
                  <div className={styles.dropdown} onClick={(e)=>e.stopPropagation()}>
                    <ul>
                      {_.map(clinics,(clinic) =>
                        <li>
                          <div
                            className={styles.clinicItem}
                            onClick={()=>this.handleSwitchClinic(clinic)}>
                              {clinic.name}
                              {clinic.id === selectedClinicId && <CheckRoundedIcon />}
                          </div>
                        </li>
                      )}
                    </ul>
                  </div>
                  }
                </div>
              </div>
            </div>
          );
        } else {
          return (
            <div className={styles.clinicWrapper}>
              <div className={styles.header}>
                {clinics[selectedClinicId].name}
              </div>
            </div>
          );
        }
      } else {
        return (
          <div className={styles.clinicWrapper}>
            <div className={styles.header}>
              {i18n.t('Private Workspace')}
            </div>
          </div>
        );
      }
    }
  };

  renderWebOrSwitchLink = () => {
    const {clinics, selectedClinicId} = this.props;
    const keys = _.keys(clinics);
    const workspaceText = selectedClinicId ? i18n.t('clinic') : i18n.t('your private');
    if(keys.length == 1){
      return (
        <div className={styles.postScript}>
          {i18n.t(
            'To manage {{workspace}} workspace and view patient invites, go to',
            { workspace: workspaceText }
          )}{' '}
          <a
            href={this.props.blipUrls.blipUrl}
            onClick={this.handleTidepoolWebLink}
            target="_blank"
          >
            {i18n.t('Tidepool Web')}
          </a>
        </div>
      );
    }
    if(keys.length > 1){
      return (
        <div className={styles.postScript}>
          {i18n.t('Can’t find a patient you are looking for?')}{' '}
          <a href="" onClick={this.handleWorkspaceSwitch}>
            {i18n.t('Change Workspace')}
          </a>
        </div>
      );
    }
  };

  renderPrivateWorkspaceLink = () => {
    const {loggedInUser, allUsers, selectedClinicId} = this.props;
    const user = allUsers[loggedInUser];
    if(!!selectedClinicId && !personUtils.isClinic(user)) {
      return (
        <div className={styles.postScript}>
          {i18n.t('Want to use Tidepool for your private data?')}{' '}
          <a href="" onClick={this.handleSwitchToPrivate}>
            {i18n.t('Go to Private Workspace')}
          </a>
        </div>
      );
    }
  };

  render() {
    return (
      <>
      <div className={styles.wrap}>
        {this.renderClinicIndicator()}
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
      {this.renderWebOrSwitchLink()}
      {this.renderPrivateWorkspaceLink()}
      </>
    );
  }
}

module.exports = ClinicUserSelect;
