import _ from 'lodash';
import React, { Component } from 'react';
import UploadList from '../components/UploadList';
import styles from '../../styles/components/App.module.less';
import { pages, urls } from '../constants/otherConstants';
import cx from 'classnames';
import * as metrics from '../constants/metrics';
import { connect } from 'react-redux';


export class MainPage extends Component {
  renderUserDropdown() {
    const { allUsers, page, targetUsersForUpload, uploadTargetUser } = this.props;
    return (
      <UserDropdown
        allUsers={allUsers}
        isUploadInProgress={this.props.uploadIsInProgress}
        onGroupChange={this.props.async.setUploadTargetUserAndMaybeRedirect}
        page={page}
        targetId={uploadTargetUser}
        targetUsersForUpload={targetUsersForUpload} />
    );
  }

  renderChangePersonLink() {
    var classes = cx({
      [styles.changePerson]: true,
      [styles.linkDisabled]: this.props.uploadIsInProgress
    });
    return (
      <div className={classes}
        onClick={this.props.uploadIsInProgress ? this.noopHandler : _.partial(this.handleClickChangePerson, {metric: {eventName: metrics.CLINIC_CHANGE_PERSON}})}>Change Person</div>
    );
  }

  renderClinicUserBlock() {
    const { page, isClinicAccount } = this.props;
    if (!isClinicAccount) return null;
    let timezoneDropdown = (page === pages.MAIN) ? this.renderTimezoneDropdown() : null;
    return (
      <ClinicUserBlock
        allUsers={this.props.allUsers}
        targetId={this.props.uploadTargetUser}
        timezoneDropdown={timezoneDropdown}
        onEditUser={this.handleClickEditUser}
        isUploadInProgress={this.props.uploadIsInProgress} />
    );
  }

  render() {
    let changePersonLink = null;
    let clinicUserBlock = null;

    if(this.props.isClinicAccount){
      changePersonLink = this.renderChangePersonLink();
      clinicUserBlock = this.renderClinicUserBlock();
    }

    let userDropdown = this.props.showingUserSelectionDropdown ?
      this.renderUserDropdown() : null;

    const viewDataLink = _.get(this.props, ['blipUrls', 'viewDataLink'], '');
    let timezoneDropdown = null;
    let viewDataLinkButton = this.renderUploadListDoneButton();
    if(!this.props.isClinicAccount){
      timezoneDropdown = this.renderTimezoneDropdown();
    }
    return (
      <div className={styles.mainWrap}>
        {userDropdown}
        {timezoneDropdown}
        {changePersonLink}
        {clinicUserBlock}
        <UploadList
          disabled={Boolean(this.props.unsupported) || !Boolean(this.props.selectedTimezone)}
          targetId={this.props.uploadTargetUser}
          uploads={this.props.activeUploads}
          userDropdownShowing={this.props.showingUserSelectionDropdown}
          onReset={this.props.sync.resetUpload}
          onUpload={this.props.async.doUpload}
          readFile={this.props.async.readFile}
          toggleErrorDetails={this.props.sync.toggleErrorDetails}
          updateProfileErrorMessage={this.props.updateProfileErrorMessage}
          isClinicAccount={this.props.isClinicAccount}
          onChooseDevices={_.partial(this.handleClickChooseDevices, {metric: {eventName: metrics.CLINIC_CHANGE_DEVICES}})}
          timezoneIsSelected={Boolean(this.props.selectedTimezone)}
          isUploadInProgress={this.props.uploadIsInProgress} />
        {viewDataLinkButton}
      </div>
    );
  }
}

export default connect(
  (state, ownProps) => {
    return {
      unsupported: state.unsupported,
      uploadTargetUser: state.uploadTargetUser,
    };
  }
)(MainPage);
