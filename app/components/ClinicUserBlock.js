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
var PropTypes = require('prop-types');
var React = require('react');
var sundial = require('sundial');
var personUtils = require('../../lib/core/personUtils');
var cx = require('classnames');

const remote = require('@electron/remote');
const i18n = remote.getGlobal( 'i18n' );

var styles = require('../../styles/components/ClinicUserBlock.module.less');

class ClinicUserBlock extends React.Component {
  static propTypes = {
    allUsers: PropTypes.object.isRequired,
    memberships: PropTypes.object,
    targetId: PropTypes.string,
    timezoneDropdown: PropTypes.element,
    onEditUser: PropTypes.func.isRequired,
    isUploadInProgress: PropTypes.bool.isRequired,
    selectedClinicId: PropTypes.string,
    clinics: PropTypes.object.isRequired
  };

  formatBirthday = (birthday) => {
    return sundial.translateMask(birthday, 'YYYY-MM-DD', 'M/D/YYYY');
  };

  noopHandler = (e) => {
    e.preventDefault();
  };

  render() {
    var {
      allUsers,
      isUploadInProgress,
      memberships,
      targetId,
      selectedClinicId,
      clinics,
    } = this.props;
    var user;
    var birthday = '';
    var isCustodialAccount;
    var fullName;

    var editClasses = cx({
      [styles.edit]: true,
      [styles.disabled]: isUploadInProgress
    });

    if(selectedClinicId){
      user = _.get(clinics, [selectedClinicId, 'patients', targetId]);
      isCustodialAccount = _.has(_.get(user, ['permissions']), 'custodian');
      birthday = this.formatBirthday(_.get(user,'birthDate'));
      fullName = _.get(user,'fullName');
    } else {
      user = _.get(allUsers, [targetId]);
      isCustodialAccount = _.has(_.get(memberships, [targetId, 'permissions']), 'custodian');
      birthday = this.formatBirthday(_.get(user, ['profile','patient','birthday']));
      fullName = personUtils.patientFullName(user);
    }

    return (
      <div className={styles.main}>
        <div className={styles.nameWrap}>
          <div className={styles.name}>
            {fullName}
          </div>
          <div className={styles.birthday}>
            {birthday}
          </div>
          {isCustodialAccount && (
            <div
              className={editClasses}
              onClick={
                isUploadInProgress ? this.noopHandler : this.props.onEditUser
              }
            >
              {i18n.t('Edit Info')}
            </div>
          )}
        </div>
        {this.props.timezoneDropdown}
      </div>
    );
  }
}

module.exports = ClinicUserBlock;
