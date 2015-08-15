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
    targetTimezone: React.PropTypes.string
  },

  buildTzSelector: function() {
    var self = this;
    function sortByOffset(timezones) {
      return _.sortBy(timezones, function(tz) {
        return tz.offset;
      });
    }
    var timezones = sundial.getTimezones();
    var opts = sortByOffset(timezones.bigFour)
      .concat(sortByOffset(timezones.unitedStates))
      .concat(sortByOffset(timezones.hoisted))
      .concat(sortByOffset(timezones.theRest));

    return (
      <Select clearable={false}
        name={'timezoneSelect'}
        onChange={this.props.onTimezoneChange}
        options={opts}
        placeholder={'Type to search...'}
        value={this.props.targetTimezone} />
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
