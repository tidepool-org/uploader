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
var cx = require('react/lib/cx');

var DeviceSelection = React.createClass({
  propTypes: {
    uploads: React.PropTypes.array.isRequired,
    // targetId can be null when logged in user is not a data storage account
    // for example a clinic worker
    targetId: React.PropTypes.string,
    targetDevices: React.PropTypes.array.isRequired,
    timezoneIsSelected: React.PropTypes.bool.isRequired,
    onCheckChange: React.PropTypes.func.isRequired,
    onDone: React.PropTypes.func.isRequired,
    groupsDropdown: React.PropTypes.bool.isRequired
  },

  render: function() {
    var self = this;

    var items = _.map(this.props.uploads, function(upload) {

      var isChecked = _.contains(self.props.targetDevices, upload.key);
      var driverLink = '';

      if((window.app.state._os === 'mac') && (upload.mac !== undefined) ) {
        driverLink = upload.mac.driverLink;
      }

      if((window.app.state._os === 'win') && (upload.win !== undefined) ) {
        driverLink = upload.win.driverLink;
      }

      var displayText = '';
      if (isChecked && !_.isEmpty(driverLink)) {
        displayText = <div className="DeviceSelection-detail">
                      <a href={driverLink} target="_blank">Download driver</a></div>;
      }
      return (
        <div key={upload.key} >
          <div className="Device-checkbox">
            <input type="checkbox"
              value={upload.key}
              ref={upload.key}
              id={upload.key}
              checked={isChecked}
              onChange={self.props.onCheckChange} />
              <label htmlFor={upload.key}>{upload.name}</label>
          </div>
          {displayText}
        </div>
      );
    });

    var formClasses = cx({
      'DeviceSelection-form': true,
      'DeviceSelection-form--onlyme': !this.props.groupsDropdown,
      'DeviceSelection-form--groups': this.props.groupsDropdown,
      'DeviceSelection-form--timezone' : true
    });

    var disabled = (this.props.targetDevices.length > 0 && this.props.timezoneIsSelected) ?
      false : true;
    return (
      <div className="DeviceSelection">
        <h3 className="DeviceSelection-headline">Choose devices</h3>
        <form className={formClasses}>{items}</form>
        <button type="submit"
          className="DeviceSelection-button btn btn-primary"
          onClick={this.handleSubmit}
          disabled={disabled}>
          Done
        </button>
      </div>
    );
  },

  handleSubmit: function() {
    this.props.onDone(this.props.targetId);
  }
});

module.exports = DeviceSelection;
