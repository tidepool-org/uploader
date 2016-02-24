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

var ViewDataLink = React.createClass({
  propTypes: {
    href: React.PropTypes.string.isRequired,
    onViewClicked: React.PropTypes.func.isRequired
  },

  render: function() {
    return (
      <a className="ViewData-button btn btn-primary"
        disabled={_.isEmpty(this.props.href)}
        href={this.props.href}
        onClick={this.props.onViewClicked}
        target="_blank" >
        Go to Blip
      </a>
    );
  }
});

module.exports = ViewDataLink;
