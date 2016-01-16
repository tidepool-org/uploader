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
      showErrorDetails: []
    };
  },
  getDefaultProps: function(){
    return {
      text: {
        SHOW_ERROR : 'Error details',
        HIDE_ERROR : 'Hide details',
        UPLOAD_FAILED : 'Upload Failed: '
      }
    };
  },
  makeHandleShowDetailsFn: function(upload){
    var self = this;

    return function(e) {
      if(e){
        e.preventDefault();
      }
      // add or remove this upload's key to the list of uploads to show errors for
      var showErrorsList = self.state.showErrorDetails;
      if (_.includes(showErrorsList, upload.key)) {
        showErrorsList = _.reject(showErrorsList, function(i) { return i === upload.key; });
      }
      else {
        showErrorsList.push(upload.key);
      }
      self.setState({showErrorDetails: showErrorsList});
    };
  },
  renderErrorForUpload: function(upload) {
    if (_.isEmpty(upload) || _.isEmpty(upload.error)) {
      return;
    }
    var showDetailsThisUpload = _.includes(this.state.showErrorDetails, upload.key);
    var errorDetails = showDetailsThisUpload ? (<div className="UploadList-error-details">{upload.error.debug}</div>) : null;
    var showErrorsText = showDetailsThisUpload ? this.props.text.HIDE_ERROR : this.props.text.SHOW_ERROR;
    var errorMessage = upload.error.driverLink ? <div className="UploadList-error-message-wrapper">
                                                  <span className="UploadList-error-message">{this.props.text.UPLOAD_FAILED}</span>
                                                  <span className="UploadList-error-message-friendly">{upload.error.friendlyMessage}</span>
                                                  <span className="UploadList-error-message-link"><a href={upload.error.driverLink} target="_blank">{upload.error.driverName}</a></span>
                                                 </div> :
        <span className="UploadList-error-message">{this.props.text.UPLOAD_FAILED + upload.error.friendlyMessage}</span>;

    var clickHandler = this.makeHandleShowDetailsFn(upload);

    return (
      <div className="UploadList-error-item">
        {errorMessage}
        <div className="UploadList-error-text"><a href="" onClick={clickHandler}>{showErrorsText}</a></div>
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
      var keyToMatch;
      var index = _.findIndex(self.props.uploads, function(upload) {
        if(upload.key === target.key){
          keyToMatch = target.key;
          return true;
        }
        return false;
      });
      var matchingUpload = _.find(self.props.targetedUploads, function(upload) {
        return upload.key === keyToMatch;
      });
      return (
        <div key={index} className="UploadList-item">
          <Upload
            upload={matchingUpload}
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
