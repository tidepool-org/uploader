#!/usr/bin/env babel-node

global.__DEBUG__ = true;

import program from 'commander';
import fs from 'fs';

import api from '../../../core/api.js';
import device from '../../../core/device';
import config from '../../../../.config.js';
import pkg from '../../../../package.json';
import builder from '../../../objectBuilder.js';
import {FreeStyleLibreData} from '../freeStyleLibreData';
import abbottFreeStyleLibre from '../abbottFreeStyleLibre';

import {stringify} from './stringify';

const intro = 'FSLibre CLI:';

program
  .version('0.0.1', null)
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)
  .option('-f, --file [path]', 'blob file path')
  .parse(process.argv);

const options = {
  api: api,
  timezone: program.timezone,
  version : pkg.name + ' ' + pkg.version,
  builder: builder()
};

if(program.username && program.password) {
  login(program.username, program.password, config);
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
  api.init(function() {
    api.user.login({ username: username, password:password }, loginCallback);
  });
}

function loginCallback(error, loginData) {
  if(error){
    console.log(intro, 'loginCallback: Failed authentication!');
    console.log(error);
    return;
  }
  console.log(intro, 'loginCallback:', 'Loading using the timezone', program.timezone);
  console.log(intro, 'loginCallback:', 'Loading for user ', loginData.userid);

  console.log(intro, 'loginCallback:', 'Starting connection to device...');
  options.targetId = loginData.userid;
  options.groupId = loginData.userid;
  device.init(options, initCallback);
}

function initCallback() {
  if(program.file) {

    console.log(intro, 'Reading JSON data...');
    const data = JSON.parse(fs.readFileSync(program.file, 'utf8'), (k, v) => {
      if (v !== null && typeof v === 'object' && 'type' in v &&
        v.type === 'Buffer' && 'data' in v && Array.isArray(v.data)) {
        // re-create Buffer objects for data fields of aapPackets
        return new Buffer(v.data);
      }
      return v;
    });

    const dataParser = new FreeStyleLibreData(options);
    options.deviceInfo = data.deviceInfo;
    options.builder.setDefaults({ deviceId: data.deviceInfo.deviceId});

    console.log(intro, 'Processing AAP packets, length:', data.aapPackets.length);
    data.post_records = dataParser.processAapPackets(data.aapPackets, data.deviceInfo.dbRecordNumber);
    console.log(intro, 'Num post records:', data.post_records.length);
    abbottFreeStyleLibre(options).uploadData(progress => progress, data, uploadCallback);
  } else {
    device.detect('AbbottFreeStyleLibre', options, detectCallback);
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
  console.log(intro, 'uploadCallback:', 'error: ', error);
  //console.log(intro, 'uploadCallback:', 'data: ', data);

  console.log(intro, 'uploadCallback:', 'writing data to file "data.json"...');
  fs.writeFile('data.json', stringify(data, {indent: 2, maxLevelPretty: 3}), 'utf8', () => {
    // exit from main electron process
    console.log(intro, 'Exiting...');
    process.exit();
  });
}
