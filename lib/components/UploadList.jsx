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
    groupsDropdown: React.PropTypes.bool.isRequired,
    text: React.PropTypes.object
  },
  getInitialState: function() {
    return {
      showErrorDetails: false
    };
  },
  getDefaultProps: function(){
    return {
      text: {
        SHOW_ERROR : '(Show details)',
        HIDE_ERROR : '(Hide details)',
        UPLOAD_FAILED : 'Upload Failed: '
      }
    };
  },
  handleShowDetails:function(e){
    if(e){
      e.preventDefault();
    }
    //toggle the current setting
    this.setState({showErrorDetails: !this.state.showErrorDetails});
  },
  renderErrorForUpload: function(upload) {
    if (_.isEmpty(upload) || _.isEmpty(upload.error)){
      return;
    }
    var errorDetails = this.state.showErrorDetails ? (<div className="UploadList-error-details">{upload.error.debug}</div>) : null;
    var showErrorsText = this.state.showErrorDetails ? this.props.text.HIDE_ERROR : this.props.text.SHOW_ERROR;
    
    return (
      <div className="UploadList-error-item">
        <span className="UploadList-error-message">{this.props.text.UPLOAD_FAILED + upload.error.friendlyMessage}</span>
        <a href="" onClick={this.handleShowDetails}>{showErrorsText}</a>
        {errorDetails}
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
