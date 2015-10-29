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
    acknowledged: React.PropTypes.number,
    timezone: React.PropTypes.any
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
   * Determine whether the message should be displayed to the user or not
   * 
   * @return {boolean}
   */
  shouldDisplayOverlay: function() {
    // for now show if the user has not previously acknowledged this warning
    // in future though, we could make this show if
    //  - the current date is within X days of DST starting/ending
    //  - and acknowledged is false or not within X days
    return (!this.props.acknowledged);
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
    var timeString = sundial.formatInTimezone(this.state.time, this.props.timezone,'h:mm a');

    if (this.shouldDisplayOverlay()) {
      return (
        <div className="DaylightSavingMessage-container">
          <h2 className="DaylightSavingMessage-header">Make sure your <span className="red-text">device time</span> is the <span className="blue-text">right time</span></h2>
          <div className="DaylightSavingMessage-clock"></div>
          <p>It is <span className="DaylightSavingMessage-time">{timeString}</span> in the selected timezone: <span className="DaylightSavingMessage-timezone">{this.props.timezone}</span></p>
          <p>Daylight savings happened on Nov 1 and our magic time adjusting with your data depends on it.</p>
          <button className="btn btn-primary" onClick={this.handleAcknowledge}>Okay, it is</button>

        </div>
      );
    } else {
      return null;
    }
  }
});

module.exports = DaylightSavingMessage;