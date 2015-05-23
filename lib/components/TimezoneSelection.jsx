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

var TimezoneSelection = React.createClass({
  propTypes: {
    onTimezoneChange: React.PropTypes.func.isRequired,
    timezoneLabel : React.PropTypes.string.isRequired,
    targetTimezone: React.PropTypes.string,
    targetTimezoneLabel: React.PropTypes.string
  },

  buildTzSelector:function(){
    var opts = _.map(sundial.getTimezones(), function(tz, i) {
      // we have to concatenate the name and label for each timezone
      // because a name can map to more than one label, and that causes
      // React to choke because the component keys are not unique
      return { value : tz.name + '_' + tz.label, label : tz.label };
    });

    return (
      <Select name='timezoneSelect'
        // if for whatever reason we don't have the label, just display the actual timezone name
        value={this.props.targetTimezoneLabel || this.props.targetTimezone}
        options={opts}
        onChange={this.props.onTimezoneChange} />
    );
  },

  render: function() {

    return (
      <div className='TimezoneSelection'>
        <div className='TimezoneSelection-timezone'>
          <div className='TimezoneSelection-timezone--label'>{this.props.timezoneLabel}</div>
          <div className='TimezoneSelection-timezone--list TimezoneSelection--settings'>
            {this.buildTzSelector()}
          </div>
        </div>
      </div>
    );
  }
});

module.exports = TimezoneSelection;
