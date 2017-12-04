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
var PropTypes = require('prop-types');

var styles = require('../../styles/components/ProgressBar.module.less');

class ProgressBar extends React.Component {
  static propTypes = {
    // Percentage is an integer between 0 and 100
    percentage: PropTypes.number.isRequired
  };

  render() {
    // Minimum fill of 1%
    var width = this.props.percentage ? this.props.percentage : 1;
    return (
      <div className={styles.progressBar} title={'Progress: ' + this.props.percentage + '%'}>
        <div className={styles.fill} style={{width: width + '%'}}>&nbsp;</div>
      </div>
    );
  }
}

module.exports = ProgressBar;
