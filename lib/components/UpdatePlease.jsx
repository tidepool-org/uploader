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

var React = require('react');

var UpdatePlease = React.createClass({
  propTypes: {
    link: React.PropTypes.string.isRequired
  },
  render: function() {
    var text = {
      OUT_OF_DATE: 'Your uploader is out-of-date.',
      TO_UPDATE: 'To update it, please follow ',
      LINK_TEXT: 'these instructions',
      TRY_AGAIN: 'Then try your upload again!'
    };

    return (
      <div className="UpdatePlease">
        <p>{text.OUT_OF_DATE}</p>
        <p className='most-important'>{text.TO_UPDATE}<a href={this.props.link}>{text.LINK_TEXT}</a>.</p>
        <p>{text.TRY_AGAIN}</p>
      </div>
    );
  }
});

module.exports = UpdatePlease;