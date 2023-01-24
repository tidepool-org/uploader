/*
* == BSD2 LICENSE ==
* Copyright (c) 2015-2016, Tidepool Project
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

import _ from 'lodash';
import cx from 'classnames';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import Select from 'react-select';

import sundial from 'sundial';
import keytar from 'keytar';
import BLE from 'ble-glucose';

import LoadingBar from './LoadingBar';
import ProgressBar from './ProgressBar';
import debugMode from '../utils/debugMode';
import uploadDataPeriod from '../utils/uploadDataPeriod';

import { VerioBLE } from '../../lib/drivers/onetouch/oneTouchVerioBLE';

import styles from '../../styles/components/Upload.module.less';

const remote = require('@electron/remote');
const i18n = remote.getGlobal( 'i18n' );

const MEDTRONIC_KEYTAR_SERVICE = 'org.tidepool.uploader.medtronic.serialnumber';
const ble = new BLE();
const verioBLE = new VerioBLE();

export default class Upload extends Component {
  static propTypes = {
    disabled: PropTypes.bool.isRequired,
    rememberMedtronicSerialNumber: PropTypes.func.isRequired,
    // targetId is needed to remember the pump serial number.
    // It can be null when logged in user is not a data storage account
    // for example a clinic worker
    targetId: PropTypes.string,
    upload: PropTypes.object.isRequired,
    addDevice: PropTypes.func.isRequired,
    removeDevice: PropTypes.func.isRequired,
    onDone: PropTypes.func.isRequired,
    onUpload: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    readFile: PropTypes.func.isRequired,
    text: PropTypes.object.isRequired,
    selectedClinicId: PropTypes.string,
  };

  static defaultProps = {
    text: {
      MEDTRONIC_SERIAL_NUMBER: i18n.t('Pump Serial number'),
      REMEMBER_SERIAL_NUMBER: i18n.t('Remember serial number'),
      MEDTRONIC_600_IS_LINKED: i18n.t('Meter and pump are linked'),
      LABEL_UPLOAD: i18n.t('Upload'),
      LABEL_IMPORT: i18n.t('Import'),
      LABEL_OK: i18n.t('OK'),
      LABEL_FAILED: i18n.t('Try again'),
      LAST_UPLOAD: i18n.t('Last upload'),
      DEVICE_UNKNOWN: i18n.t('Unknown device'),
      UPLOAD_COMPLETE: i18n.t('Done!'),
      UPLOAD_PROGRESS: i18n.t('Uploading... '),
      NOTE: i18n.t('Note:'),
      FIRST_UPLOAD: i18n.t('We\'ve improved how devices upload. This upload will take longer than usual, but your future uploads will be much, much faster.')
    }
  };

  state = {
    medtronicFormIncomplete: true,
    medtronicSerialNumberValue: '',
    medtronicSerialNumberRemember: false,
    medtronic600FormIncomplete: false,
    medtronic600SerialNumberValue: '',
    medtronic600SerialNumberValid: true,
    medtronic600Linked: true,
    medtronic600UploadPeriod: uploadDataPeriod.periodMedtronic600,
  };

  constructor(props) {
    super(props);
    this.ble = ble;
    this.verioBLE = verioBLE;

    this.populateRememberedSerialNumber();
  }

  UNSAFE_componentWillMount() {
      // Initialize the UI state. Needed for logout/login scenarios
      this.handleReset();
   }

  populateRememberedSerialNumber() {
    keytar.getPassword(MEDTRONIC_KEYTAR_SERVICE, this.props.targetId)
      .then((serialNumber) => {
        if(serialNumber) {
          this.setState({
            medtronicSerialNumberValue: serialNumber,
            medtronicSerialNumberRemember: true,
            medtronicFormIncomplete: false,
          });
        }
    });
  }

  handleMedtronicUpload() {
    if (this.state.medtronicSerialNumberRemember) {
      // Only set the password if it is different
      keytar.getPassword(MEDTRONIC_KEYTAR_SERVICE, this.props.targetId)
        .then((serialNumber) => {
          if (serialNumber != this.state.medtronicSerialNumberValue) {
            keytar.setPassword(MEDTRONIC_KEYTAR_SERVICE, this.props.targetId,
              this.state.medtronicSerialNumberValue)
              .then(() => {
                this.props.rememberMedtronicSerialNumber();
              });
          }
        });
    }

    let options = {
      serialNumber: this.state.medtronicSerialNumberValue
    };
    this.props.onUpload(options);
  }

  handleMedtronic600Upload() {
    let options = {
      serialNumber: this.state.medtronic600SerialNumberValue
    };
    this.props.onUpload(options);
  }

  async handleBluetoothUpload(device) {
    let options = { };

    if (device === 'onetouchverioble') {
      options.ble = this.verioBLE;
    } else {
      options.ble = this.ble;
    }

    this.props.onUpload(options);
  }

  handleReset = e => {
    if (e) {
      e.preventDefault();
    }
    this.setState({
      medtronicFormIncomplete: true,
      medtronicSerialNumberValue: '',
      medtronic600FormIncomplete: false,
      medtronic600SerialNumberValue: '',
      medtronic600SerialNumberValid: true,
      medtronic600Linked: true
    });
    this.props.onReset();
    this.populateRememberedSerialNumber();
  };

  handleUpload = e => {
    const { upload } = this.props;
    if (e) {
      e.preventDefault();
    }

    const device = _.get(upload, 'key', null);

    if (device === 'medtronic') {
      return this.handleMedtronicUpload();
    }

    if (device === 'medtronic600') {
      return this.handleMedtronic600Upload();
    }

    if (device === 'caresensble' || device === 'onetouchverioble') {
      return this.handleBluetoothUpload(_.get(upload, 'key', null));
    }

    var options = {};
    this.props.onUpload(options);
  };

  onBlockModeInputChange = e => {
    const { upload } = this.props;
    let file = e.target.files[0];
    this.props.readFile(file, upload.source.extension);
  };

  onMedtronicSerialNumberRememberChange = e => {
    const checkbox = e.target;
    const {checked} = checkbox;

    this.setState({
      medtronicSerialNumberRemember: checked
    });

    // Delete the stored serial number if the "Remember" box is being unchecked
    if(!checked) {
      keytar.deletePassword(MEDTRONIC_KEYTAR_SERVICE, this.props.targetId);
    }
  };

  onMedtronicSerialNumberInputChange = e => {
    const field = e.target;
    const {value} = field;
    const chars = _.split(value, '');

    // Check if input is purely numbers.
    // E.g., 123e4 is considered numeric, as is -123, but for our purposes they are not valid input.
    let isValid = _.every(chars, function(char, n) {
      return !isNaN(char);
    });

    // Don't update field input if non-numeric character is entered.
    if (!isValid) {
      return;
    }

    if (field && value) {
      if (value.length === 6) {
        this.setState({
          medtronicFormIncomplete: false,
          medtronicSerialNumberValue: value
        });
      }
      else if (value.length < 6) {
        this.setState({
          medtronicSerialNumberValue: value,
          medtronicFormIncomplete: true
        });
      }
    }
    else {
      this.setState({
        medtronicSerialNumberValue: '',
        medtronicFormIncomplete: true
      });
    }
  };

  onMedtronic600LinkedChange = e => {
    const checkbox = e.target;
    const { checked } = checkbox;

    this.setState({
      medtronic600Linked: checked,
      medtronic600FormIncomplete: !checked,
      medtronic600SerialNumberValue: checked ? '' :
        this.state.medtronic600SerialNumberValue,
      medtronic600SerialNumberValid: true,
    });
  };

  onMedtronic600SerialNumberInputChange = e => {
    const field = e.target;
    // Capitalise any characters
    const value = _.toUpper(field.value);

    if (value.length > 10) {
      return;
    }

    // The final valid match is /^\d{2}[0-9A-Z]\d{6}A-Z}/
    // The following matches progressively as well.
    // eslint-disable-next-line max-len
    const regex = /^([A-Z]([A-Z]([0-9A-Z](\d(\d(\d(\d(\d(\d([A-Z])?)?)?)?)?)?)?)?)?)?$/;
    const match = regex.exec(value);
    const isCompleteMatch = match && !_.isUndefined(match[10]);
    if (!match) {
      this.setState({
        medtronic600SerialNumberValid: false,
      });
    } else {
      this.setState({
        medtronic600SerialNumberValid: true,
      });
    }

    if (field && value) {
      if (value.length === 10) {
        this.setState({
          medtronic600SerialNumberValue: value,
          medtronic600FormIncomplete: !isCompleteMatch,
        });
      }
      else if (value.length < 10) {
        this.setState({
          medtronic600SerialNumberValue: value,
          medtronic600FormIncomplete: true,
        });
      }
    }
    else {
      this.setState({
        medtronic600SerialNumberValue: '',
        medtronic600SerialNumberValid: true,
        medtronic600FormIncomplete: true
      });
    }
  };

  onMedtronic600UploadPeriodChange = period => {
    this.setState({
      medtronic600UploadPeriod: uploadDataPeriod.setPeriodMedtronic600(period)
    });
  };

  getDebugLinks(data) {

    let post_link = null;

    if(_.isArray(data) || _.isArray(data.post_records)) {

      let filename = 'uploader-processed-records.json';
      let jsonData = null;
      if (_.isArray(data)) {
        jsonData = JSON.stringify(data, undefined, 4);
      } else {
        jsonData = JSON.stringify(data.post_records, undefined, 4);
      }
      let blob = new Blob([jsonData], {type: 'text/json'});
      let dataHref = URL.createObjectURL(blob);
      post_link = (
        <a href={dataHref}
          className={styles.dataDownloadLink}
          download={filename}
          data-downloadurl={['text/json', filename, dataHref].join(':')}>
          POST data
        </a>
      );
    }

    let binary_link = null;
    if(_.isArray(data.pages || data.aapPackets)) {
      /*
        we currently support binary blobs for Medtronic (.pages) and
        Libre (.aapPackets)
      */
      let filenameBinary = 'binary-blob.json';
      let jsonDataBinary = JSON.stringify(data, undefined, 4);
      let blobBinary = new Blob([jsonDataBinary], {type: 'text/json'});
      let dataHrefBinary = URL.createObjectURL(blobBinary);
      binary_link = (
        <a href={dataHrefBinary}
          className={styles.dataDownloadLink}
          download={filenameBinary}
          data-downloadurl={['text/json', filenameBinary, dataHrefBinary].join(':')}>
          Binary blob
        </a>
      );
    }

    if(post_link || binary_link) {
      return (
        <div>
          {post_link}&nbsp;{binary_link}
        </div>
      );
    }
    return null;
  }

  render() {
    return (
      <div className={styles.main}>
        <div className={styles.left}>
          {this.renderName()}
          {this.renderInstructions()}
          {this.renderImage()}
          {this.renderLastUpload()}
        </div>
        <div className={styles.right}>
          <div className={styles.statusSection}>
            {this.renderStatus()}
          </div>
          {this.renderProgress()}
          {this.renderFirstUpload()}
          {this.renderActions()}
        </div>
      </div>
    );
  }

  renderActions() {
    const { upload } = this.props;
    if (upload.uploading) {
      return null;
    }

    if (upload.completed) {
      return (
        <div className={styles.buttonWrap}>
          {this.renderReset()}
        </div>
      );
    }

    return (
      <form className={styles.form}>
        {this.renderMedtronicSerialNumberInput()}
        {this.renderMedtronic600SerialNumberInput()}
        {this.renderMedtronicUploadRangeSelect()}
        {this.renderBlockModeInput()}
        {this.renderButton()}
      </form>
    );
  }

  renderBlockModeInput() {
    const { upload } = this.props;
    if (_.get(upload, 'source.type', null) !== 'block') {
      return null;
    }

    // don't show the 'choose file' button if a file has already been selected.
    if (this.isBlockModeFileChosen()) {
      return null;
    }

    const disabled = upload.disabled || this.props.disabled;

    return (
      <div className={styles.inputWrapper}>
        <input
          className={styles.fileinput}
          disabled={disabled}
          ref="file"
          type="file"
          accept={_.get(upload, 'source.extension')}
          onChange={this.onBlockModeInputChange}/>
      </div>
    );
  }

  renderButton() {
    const { text, upload } = this.props;
    let labelText = text.LABEL_UPLOAD;
    let disabled = upload.disabled || this.props.disabled;

    if (_.get(upload, 'key', null) === 'medtronic') {
      disabled = disabled || this.state.medtronicFormIncomplete;
    }

    if (_.get(upload, 'key', null) === 'medtronic600') {
      disabled = disabled || this.state.medtronic600FormIncomplete;
    }

    if (_.get(upload, 'source.type', null) === 'block') {
      return null;
    }

    return (
      <div className={styles.buttonWrap}>
        <button
          className={styles.button}
          disabled={disabled}
          onClick={disabled ? _.noop : this.handleUpload}
          title={disabled ? i18n.t('Upload in progress! Please wait.') : ''}>
          {labelText}
        </button>
      </div>
    );
  }

  renderMedtronicSerialNumberInput() {
    const { upload } = this.props;
    if (_.get(upload, 'source.driverId', null) !== 'Medtronic') {
      return null;
    }

    return (
      <div>
        <div className={styles.textInputWrapper}>
          <p>{i18n.t('Enter your 6 digit serial number found on the back of your pump.')}</p>
          <input
            type="text"
            value={this.state.medtronicSerialNumberValue}
            onChange={this.onMedtronicSerialNumberInputChange}
            className={styles.textInput}
            placeholder={this.props.text.MEDTRONIC_SERIAL_NUMBER} />
          <div className={styles.rememberWrap}>
            <input
              type="checkbox"
              id="medtronicSerialRemember"
              onChange={this.onMedtronicSerialNumberRememberChange}
              checked={this.state.medtronicSerialNumberRemember} />
            <label htmlFor="medtronicSerialRemember">
              {this.props.text.REMEMBER_SERIAL_NUMBER}
            </label>
          </div>
        </div>
      </div>
    );
  }

  renderMedtronic600SerialNumberInput() {
    const { upload } = this.props;
    if (_.get(upload, 'source.driverId', null) !== 'Medtronic600') {
      return null;
    }

    const divHidden = cx({
      [styles.hidden]: this.state.medtronic600Linked,
    });

    const serialInputStyle = cx({
      [styles.textInput]: this.state.medtronic600SerialNumberValid,
      [styles.textInputError]: !this.state.medtronic600SerialNumberValid,
    });

    return (
      <div>
        <div className={styles.textInputWrapper}>
          <div className={styles.rememberWrap}>
            <input
              type="checkbox"
              id="medtronic600Linked"
              onChange={this.onMedtronic600LinkedChange}
              checked={this.state.medtronic600Linked} />
            <label htmlFor="medtronic600Linked">
              {this.props.text.MEDTRONIC_600_IS_LINKED}
            </label>
          </div>
          <div className={divHidden}>
            <p>{i18n.t('Enter 10 character serial number.')}</p>
            <input
              type="text"
              value={this.state.medtronic600SerialNumberValue}
              onChange={this.onMedtronic600SerialNumberInputChange}
              className={serialInputStyle}
              placeholder={this.props.text.MEDTRONIC_SERIAL_NUMBER} />
          </div>
        </div>
      </div>
    );
  }

  renderMedtronicUploadRangeSelect() {
    const { upload } = this.props;
    if (_.get(upload, 'source.driverId', null) !== 'Medtronic600') {
      return null;
    }
    const opts = [
      { label: i18n.t('since last upload'), value: uploadDataPeriod.PERIODS.DELTA },
      { label: i18n.t('last 4 weeks'), value: uploadDataPeriod.PERIODS.FOUR_WEEKS },
      { label: i18n.t('all data on pump'), value: uploadDataPeriod.PERIODS.ALL }
    ];
    return (
      <div className={styles.uploadPeriodRow}>
        <div>{i18n.t('Upload:')}</div>
        <div className={styles.dropdown}>
          <Select clearable={false}
            name={'uploadDataPeriodSelect'}
            options={opts}
            simpleValue={true}
            onChange={this.onMedtronic600UploadPeriodChange}
            value={this.state.medtronic600UploadPeriod} />
        </div>
      </div>
    );
  }

  renderInstructions() {
    const { upload } = this.props;
    let details = upload.instructions || '';
    if (_.isArray(details)) {
      return (
        <div className={styles.detail}>
          {i18n.t(_.get(details, 0, ''))}<br/>
          {i18n.t(_.get(details, 1, ''))}
        </div>
      );
    }
    if (_.isObject(details)) {
      return (
        <div className={styles.detail}>{details.text} <a href={details.link} target="_blank">{i18n.t(details.linkText)}</a></div>
      );
    }
    return (
      <div className={styles.detail}>{i18n.t(details)}</div>
    );
  }

  renderImage() {
    const { upload } = this.props;
    let image = upload.image || null;

    if (!image) {
      return null;
    }

    return (
      <div className={styles.detail}><img src={image.src} height={image.height} width={image.width} alt={image.alt} /></div>
    );
  }

  renderLastUpload() {
    const { upload } = this.props;
    let {history} = upload;

    if (!(history && history.length)) {
      return null;
    }

    let lastUpload = _.find(history, function(upload) {
      return upload.finish && !upload.error;
    });

    if (lastUpload == null) {
      return null;
    }

    let time = sundial.formatCalendarTime(lastUpload.finish);
    return (
      <div className={styles.detail}>{this.props.text.LAST_UPLOAD + ': ' + time}</div>
    );
  }

  renderName() {
    const { upload, text } = this.props;
    return (
      <div className={styles.name}>{upload.name || text.DEVICE_UNKNOWN}</div>
    );
  }

  renderProgress() {
    const { upload } = this.props;
    if (upload.failed) {
      return <div className={styles.progress}></div>;
    }

    let percentage = upload.progress && upload.progress.percentage;

    // can be equal to 0, so check for null or undefined
    if (percentage == null) {
      return null;
    }

    return <div className={styles.progress}><ProgressBar percentage={percentage}/></div>;
  }

  renderFirstUpload() {
    const { upload } = this.props;

    if (upload.uploading && upload.progress && upload.progress.isFirstUpload) {
      return (
        <div className={styles.detail}><b>{this.props.text.NOTE}</b>&nbsp;{this.props.text.FIRST_UPLOAD}</div>
      );
    } else {
      return null;
    }
  }

  renderReset() {
    const { upload } = this.props;
    if (!upload.completed) {
      return null;
    }
    let resetClass = cx({
      [styles.resetError]: upload.failed,
      [styles.resetSuccess]: upload.successful
    });

    let text = upload.successful ?
      this.props.text.LABEL_OK : this.props.text.LABEL_FAILED;

    return (
      <div>
        <a href="" onClick={this.handleReset} className={resetClass}>{text}</a>
      </div>
    );
  }

  renderStatus() {
    const { upload } = this.props;

    if (upload.uploading) {
      return <div className={styles.status}>{this.props.text.UPLOAD_PROGRESS + this.props.upload.progress.percentage + '%'}</div>;
    }

    if (upload.successful) {
      let dataDownloadLink = null;
      if (debugMode.isDebug && !_.isEmpty(this.props.upload.data)) {
        dataDownloadLink = this.getDebugLinks(this.props.upload.data);
      }
      return <div className={styles.status}>{this.props.text.UPLOAD_COMPLETE}&nbsp;{dataDownloadLink}</div>;
    }

    if(upload.failed) {
      let dataDownloadLink = null;
      if (debugMode.isDebug && this.props.upload.error.data) {
        dataDownloadLink = this.getDebugLinks(this.props.upload.error.data);
      }
      return <div className={styles.status}>{dataDownloadLink}</div>;
    }

    if (this.isBlockModeFileChosen()) {
      return (
        <div className={styles.blockMode}>
          <div className={styles.preparing}>{i18n.t('Preparing file')}</div>
          <div className={styles.blockMode}>&apos;{this.props.upload.file.name}&apos;&hellip;</div>
        </div>
      );
    }
    return null;
  }

  isBlockModeFileChosen() {
    const { upload } = this.props;
    if (_.get(upload, 'source.type', null) !== 'block') {
      return false;
    }
    else {
      if (!_.isEmpty(_.get(upload, 'file.name', ''))) {
        return true;
      }
      return false;
    }
  }
}
