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
var cx = require('classnames');

import { urls } from '../redux/constants/otherConstants';

import styles from '../../styles/components/DeviceSelection.module.less';

var DeviceSelection = React.createClass({
  propTypes: {
    disabled: React.PropTypes.bool.isRequired,
    devices: React.PropTypes.object.isRequired,
    os: React.PropTypes.string.isRequired,
    targetDevices: React.PropTypes.array.isRequired,
    // targetId can be null when logged in user is not a data storage account
    // for example a clinic worker
    targetId: React.PropTypes.string,
    timezoneIsSelected: React.PropTypes.bool.isRequired,
    userDropdownShowing: React.PropTypes.bool.isRequired,
    userIsSelected: React.PropTypes.bool.isRequired,
    addDevice: React.PropTypes.func.isRequired,
    removeDevice: React.PropTypes.func.isRequired,
    onDone: React.PropTypes.func.isRequired
  },

  componentWillReceiveProps: function(nextProps) {
    var self = this;

    if (!this.props.userIsSelected && nextProps.userIsSelected) {
      _.each(self.props.targetDevices, function(device) {
        self.props.addDevice(nextProps.targetId, device);
      });
    }
  },

  render: function() {
    var targetUser = this.props.targetId || 'noUserSelected';
    var addDevice = this.props.addDevice.bind(null, targetUser);
    var removeDevice = this.props.removeDevice.bind(null, targetUser);
    var devices = this.props.devices;

    var onCheckedChange = function(e) {
      if (e.target.checked) {
        addDevice(e.target.value);
      }
      else {
        removeDevice(e.target.value);
      }
    };
    var os = this.props.os;
    var targetDevices = this.props.targetDevices;

    var items = _.map(devices, function(device) {
      var isChecked = _.contains(targetDevices, device.key);
      var driverLink = '';

      if (device.showDriverLink[os] === true &&
        device.enabled[os] === true) {
        driverLink = urls.DRIVER_DOWNLOAD;
      }

      var driverLinkDisplay = null;
      if (isChecked && !_.isEmpty(driverLink)) {
        driverLinkDisplay = (
          <div className={styles.detail}>
          <a href={driverLink} target="_blank">Download driver</a></div>
        );
      }
      return (
        <div key={device.key}>
          <div className={styles.checkbox}>
            <input type="checkbox"
              value={device.key}
              ref={device.key}
              id={device.key}
              checked={isChecked}
              onChange={onCheckedChange} />
              <label htmlFor={device.key}>{device.selectName || device.name}</label>
          </div>
          {driverLinkDisplay}
        </div>
      );
    });


    // TODO: when this gets the ES6 treatment, use computed property syntax
    var formClassesObject = {};
    formClassesObject[styles.form] = true;
    formClassesObject[styles.onlyme] = !this.props.userDropdownShowing;
    formClassesObject[styles.groups] = this.props.userDropdownShowing;
    var formClasses = cx(formClassesObject);

    var disabled = (this.props.targetDevices.length > 0 &&
      this.props.timezoneIsSelected &&
      this.props.userIsSelected) &&
      !this.props.disabled ?
      false : true;
    return (
      <div className={styles.main}>
        <h3 className={styles.headline}>Choose devices</h3>
        <form className={formClasses}>{items}</form>
        <button type="submit"
          className={styles.button}
          onClick={this.handleSubmit}
          disabled={disabled}>
          Done
        </button>
      </div>
    );
  },

  handleSubmit: function() {
    this.props.onDone();
  }
});

module.exports = DeviceSelection;
