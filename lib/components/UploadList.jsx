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
var Upload = require('./Upload.jsx');

var UploadList = React.createClass({
  propTypes: {
    uploads: React.PropTypes.array.isRequired,
    targetedUploads: React.PropTypes.array.isRequired,
    onUpload: React.PropTypes.func.isRequired,
    onReset: React.PropTypes.func.isRequired,
    readFile: React.PropTypes.func.isRequired,
    groupsDropdown: React.PropTypes.bool.isRequired
  },

  renderErrors: function() {
    //do any of the target uploads have errors
    var errors = _.filter(this.props.targetedUploads, function(upload) {
      return _.isEmpty(upload.error) === false;
    });

    if(_.isEmpty(errors)) {
      return null;
    }
    return (
      <div className="UploadList-error">
        <div className="UploadList-error-name">{errors[0].name}</div>
        <div className="UploadList-error-message">{errors[0].error.message}</div>
        <div className="UploadList-error-debug">{errors[0].error.debug}</div>
      </div>
    );
  },

  render: function() {
    var self = this;
    var uploadListClasses = cx({
      UploadList: true,
      'UploadList--onlyme': !this.props.groupsDropdown,
      'UploadList--groups': this.props.groupsDropdown
    });

    var nodes = _.map(this.props.targetedUploads, function(target){
      var index = _.findIndex(self.props.uploads, function(upload) {
        return upload.key === target.key;
      });
      return (
        <div key={index} className="UploadList-item">
          <Upload
            upload={target}
            onUpload={self.props.onUpload.bind(null, index)}
            onReset={self.props.onReset.bind(null, index)}
            readFile={self.props.readFile.bind(null, index, self.props.targetId)} />
        </div>
      );
    });

    return (
      <div>
        <div className={uploadListClasses}>
          {this.renderErrors()}
          {nodes}
        </div>
      </div>
      );
  }
});

module.exports = UploadList;
