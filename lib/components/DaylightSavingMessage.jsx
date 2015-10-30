/*
* == BSD2 LICENSE ==
* Copyright (c) 2015, Tidepool Project
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
var sundial = require('sundial');

var DaylightSavingMessage = React.createClass({
  propTypes: {
    onAcknowledge: React.PropTypes.func.isRequired,
    timezone: React.PropTypes.string,
    onlyMe: React.PropTypes.bool
  },
  /**
   * Set the initial state of the component
   * 
   * @return {Object}
   */
  getInitialState: function() {
    return {
      time: new Date().toISOString()
    };
  },

  /**
   * Handle the acknowledgement of the message
   */
  handleAcknowledge: function() {
    this.props.onAcknowledge();
  },

  /**
   * On mounting component set up a timeout to update the UI to show the correct
   * time
   */
  componentDidMount: function() {
    this.monitorTime();
  },

  /**
   * Loop to update time
   */
  monitorTime: function() {
    var self = this;
    setTimeout(function() {
      if(self.isMounted()) {
        self.setState({time: new Date().toISOString()});
        self.monitorTime();
      }
    }, 5000);
  },

  /**
   * Render the component
   * 
   * @return {Component | null}
   */
  render: function() {
    var timeString = sundial.formatInTimezone(this.state.time, this.props.timezone, 'h:mm a');
    var extraSpacingClass = (!this.props.onlyMe) ? ' DaylightSavingMessage-showSelector' : '';
    var containerClasses = 'DaylightSavingMessage-container' + extraSpacingClass;
    return (
      <div className={containerClasses}>
        <h2 className="DaylightSavingMessage-header">Make sure your <span className="red-text">device time</span> is the <span className="blue-text">right time</span>.</h2>
        <div className="DaylightSavingMessage-clock"></div>
        <p>It is <span className="DaylightSavingMessage-time">{timeString}</span> in your selected timezone: <span className="DaylightSavingMessage-timezone">{this.props.timezone}</span>.</p>
        <p>Daylight savings time ended on Nov 1. Make sure your<br/>device times are up-to-date.</p>
        <button className="btn btn-primary" onClick={this.handleAcknowledge}>Okay, it is</button>

      </div>
    );
  }
});

module.exports = DaylightSavingMessage;