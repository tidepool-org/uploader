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
var cx = require('classnames');
var node_os = require('os');
const remote = require('@electron/remote');
const i18n = remote.getGlobal( 'i18n' );

import { urls } from '../constants/otherConstants';

import styles from '../../styles/components/DeviceSelection.module.less';

var hostMap = {
  'darwin': 'mac',
  'win32' : 'win',
  'linux': 'linux',
};

class DeviceSelection extends React.Component {
  static propTypes = {
    disabled: PropTypes.bool.isRequired,
    devices: PropTypes.object.isRequired,
    targetDevices: PropTypes.array.isRequired,
    // targetId can be null when logged in user is not a data storage account
    // for example a clinic worker
    targetId: PropTypes.string,
    timezoneIsSelected: PropTypes.bool.isRequired,
    userDropdownShowing: PropTypes.bool.isRequired,
    userIsSelected: PropTypes.bool.isRequired,
    addDevice: PropTypes.func.isRequired,
    removeDevice: PropTypes.func.isRequired,
    onDone: PropTypes.func.isRequired,
    renderClinicUi: PropTypes.bool.isRequired,
    selectedClinicId: PropTypes.string,
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    var self = this;

    if (!this.props.userIsSelected && nextProps.userIsSelected) {
      _.each(self.props.targetDevices, function(device) {
        self.props.addDevice(nextProps.targetId, device, self.props.selectedClinicId);
      });
    }
  }

  render() {
    var {selectedClinicId} = this.props;
    var targetUser = this.props.targetId || 'noUserSelected';
    var addDevice = this.props.addDevice.bind(null, targetUser);
    var removeDevice = this.props.removeDevice.bind(null, targetUser);
    var {devices} = this.props;

    var onCheckedChange = function(e) {
      if (e.target.checked) {
        addDevice(e.target.value, selectedClinicId);
      }
      else {
        removeDevice(e.target.value, selectedClinicId);
      }
    };
    var {targetDevices} = this.props;

    var items = _.map(devices, function(device) {
      var isChecked = _.includes(targetDevices, device.key);

      return (
        <div key={device.key}>
          <div className={styles.checkbox}>
            <input type="checkbox"
              value={device.key}
              ref={device.key}
              id={device.key}
              checked={isChecked}
              onChange={onCheckedChange} />
              <label className={styles.label} htmlFor={device.key}>{device.selectName || device.name}</label>
          </div>
        </div>
      );
    });

    // TODO: when this gets the ES6 treatment, use computed property syntax
    var formClassesObject = {};
    formClassesObject[styles.form] = true;
    formClassesObject[styles.onlyme] = !this.props.userDropdownShowing;
    formClassesObject[styles.groups] = this.props.userDropdownShowing;
    formClassesObject[styles.clinic] = this.props.renderClinicUi;
    var formClasses = cx(formClassesObject);

    var disabled = (this.props.targetDevices.length > 0 &&
      this.props.userIsSelected) &&
      !this.props.disabled ?
      false : true;
    return (
      <div>
        <div className={styles.main}>
          <h3 className={styles.headline}>{i18n.t('Choose devices')}</h3>
          <form className={formClasses}>{items}</form>
        </div>
        <div className={styles.buttonWrap}>
          <button type="submit"
            className={styles.button}
            onClick={this.handleSubmit}
            disabled={disabled}>
            {i18n.t('Done')}
          </button>
        </div>
      </div>
    );
  }

  handleSubmit = () => {
    this.props.onDone();
  };
}

module.exports = DeviceSelection;
