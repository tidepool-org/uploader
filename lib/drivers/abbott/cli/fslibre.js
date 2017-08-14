#!/usr/bin/env babel-node

global.__DEBUG__ = true;

import program from 'commander';
import fs from 'fs';

import api from '../../../core/api.js';
import device from '../../../core/device';
import config from '../../../../.config.js';
import pkg from '../../../../package.json';
import builder from '../../../objectBuilder.js';
import abbottFreeStyleLibre from '../abbottFreeStyleLibre';

import {stringify} from './stringify';

const intro = 'FSLibre CLI:';
let libreDriver;

program
  .version('0.0.1', null)
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)
  .option('-f, --file [path]', 'load deviceInfo and aapPackets from JSON file instead of device')
  .option('-o, --output [path]', 'save processed data to JSON file instead of uploading')
  .parse(process.argv);

const options = {
  api: api,
  timezone: program.timezone,
  version : pkg.name + ' ' + pkg.version,
  builder: builder()
};

if((program.username && program.password) || program.output) {
  if (program.output) {
    device.init(options, initCallback);
  } else {
    login(program.username, program.password, config);
  }
} else {
  program.help();
}

function login(username, password, config) {
  console.log(intro, 'login:', config.API_URL);
  api.create({
    apiUrl: config.API_URL,
    uploadUrl: config.UPLOAD_URL,
    dataUrl: config.DATA_URL,
    version: 'uploader node CLI tool - fslibre'
  });
  api.init(() => {
    api.user.login({ username: username, password:password }, loginCallback);
  });
}

function loginCallback(error, loginData) {
  if (error) {
    console.log(intro, 'loginCallback: Failed authentication!');
    console.log(error);
    process.exit();
  }
  console.log(intro, 'loginCallback:', 'Uploading using the timezone', program.timezone);
  console.log(intro, 'loginCallback:', 'Uploading for user ', loginData.userid);

  console.log(intro, 'loginCallback:', 'Starting connection to device...');
  options.targetId = loginData.userid;
  options.groupId = loginData.userid;
  device.init(options, initCallback);
}

function readDataFromFile() {
  console.log(intro, 'Reading JSON data from:', program.file);
  return JSON.parse(fs.readFileSync(program.file, 'utf8'), (k, v) => {
    if (v !== null && typeof v === 'object' && 'type' in v &&
      v.type === 'Buffer' && 'data' in v && Array.isArray(v.data)) {
      // re-create Buffer objects for data fields of aapPackets
      return new Buffer(v.data);
    }
    return v;
  });
}

function initCallback() {
  if (program.file) {
    const data = readDataFromFile();

    console.log(intro, 'Processing AAP packets, length:', data.aapPackets.length);
    libreDriver = abbottFreeStyleLibre(options);
    libreDriver.processData(progress => progress, data, processCallback);

  } else {
    device.detect('AbbottFreeStyleLibre', options, detectCallback);
  }
}

function processCallback(error, data) {
  if (error) {
    console.log(intro, 'processCallback: Failed:', error);
    process.exit();
  }

  console.log(intro, 'Num post records:', data.post_records.length);

  if (program.output) {
    writeDataToFile(data, done);
  } else {
    libreDriver.uploadData(progress => progress, data, uploadCallback);
  }
}

function detectCallback(error, deviceInfo) {
  if (deviceInfo !== undefined) {
    console.log(intro, 'detectCallback:', 'deviceInfo: ', deviceInfo);
    options.deviceInfo = deviceInfo;
    device.upload('AbbottFreeStyleLibre', options, uploadCallback);
  } else {
    console.error(intro, 'detectCallback:', 'Could not find FreeStyle Libre device. Is it connected via USB?');
    console.error(intro, 'detectCallback:', 'Error value: ' + error);
  }
}

function uploadCallback(error, data) {
  if (error) {
    console.log(intro, 'uploadCallback:', 'error: ', error);
    process.exit();
  }
  //console.log(intro, 'uploadCallback:', 'data: ', data);
  done();
}

function writeDataToFile(data, callback) {
  console.log(intro, 'uploadCallback:', 'writing data to file:', program.output);
  fs.writeFile(program.output, stringify(data, {indent: 2, maxLevelPretty: 3}), 'utf8', callback);
}

function done() {
  console.log(intro, 'Done!');
  process.exit();
}
