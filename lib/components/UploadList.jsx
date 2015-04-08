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

  renderErrorForUpload: function(upload) {
    if (_.isEmpty(upload) || _.isEmpty(upload.error)){
      return;
    }
    return (
      <div className="UploadList-error-item">
        <div className="UploadList-error-message">{upload.error.message}</div>
        <span className="UploadList-error-show">Details:</span>
        <div className="UploadList-error-debug">{upload.error.debug}</div>
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

      var matchingUpload;
      var index = _.findIndex(self.props.uploads, function(upload) {
        if(upload.key === target.key){
          matchingUpload = target;
          return true;
        }
        return false;
      });
      return (
        <div key={index} className="UploadList-item">
          <Upload
            upload={target}
            onUpload={self.props.onUpload.bind(null, index)}
            onReset={self.props.onReset.bind(null, index)}
            readFile={self.props.readFile.bind(null, index, self.props.targetId)} />
          {self.renderErrorForUpload(matchingUpload)}
        </div>
      );
    });

    return (
      <div>
        <div className={uploadListClasses}>
          {nodes}
        </div>
      </div>
      );
  }
});

module.exports = UploadList;
