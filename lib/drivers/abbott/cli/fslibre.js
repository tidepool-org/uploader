#!/usr/bin/env babel-node
/* eslint-disable no-console,no-use-before-define */

import program from 'commander';
import fs from 'fs';
import pako from 'pako';

import api from '../../../core/api';
import device from '../../../core/device';
import config from '../../../../.config';
import pkg from '../../../../package.json';
import builder from '../../../objectBuilder';
import abbottFreeStyleLibre from '../abbottFreeStyleLibre';

// eslint-disable-next-line no-underscore-dangle
global.__DEBUG__ = true;

const intro = 'FSLibre CLI:';
let libreDriver;

program
  .version('0.0.1', null)
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)
  .option('-f, --file [path]', 'load deviceInfo and aapPackets from JSON file instead of device')
  .parse(process.argv);

const options = {
  api,
  timezone: program.timezone,
  version: `${pkg.version}`,
  builder: builder(),
};

if (program.username && program.password) {
  login(program.username, program.password, config);
} else {
  program.help();
}

function login(username, password, cfg) {
  console.log(intro, 'login:', cfg.API_URL);
  api.create({
    apiUrl: cfg.API_URL,
    uploadUrl: cfg.UPLOAD_URL,
    dataUrl: cfg.DATA_URL,
    version: 'uploader node CLI tool - fslibre',
  });
  api.init(() => {
    api.user.login({ username, password }, loginCallback);
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

  const compressed = fs.readFileSync(program.file);
  console.log('Decompressing..');
  const data = pako.ungzip(compressed, { to: 'string' });
  console.log('Parsing JSON..');

  return JSON.parse(data, (k, v) => {
    if (v !== null && typeof v === 'object' && 'type' in v &&
      v.type === 'Buffer' && 'data' in v && Array.isArray(v.data)) {
      // re-create Buffer objects for data fields of aapPackets
      return Buffer.from(v.data);
    }
    return v;
  });
}

function initCallback() {
  if (program.file) {
    const data = readDataFromFile();

    if (options.deviceInfo == null) {
      options.deviceInfo = {
        deviceId: 'blob-000000',
      };
    }

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

  libreDriver.uploadData(progress => progress, data, uploadCallback);
}

function detectCallback(error, deviceInfo) {
  if (deviceInfo !== undefined) {
    console.log(intro, 'detectCallback:', 'deviceInfo: ', deviceInfo);
    options.deviceInfo = deviceInfo;
    device.upload('AbbottFreeStyleLibre', options, uploadCallback);
  } else {
    console.error(intro, 'detectCallback:', 'Could not find FreeStyle Libre device. Is it connected via USB?');
    console.error(intro, 'detectCallback:', `Error value: ${error}`);
  }
}

function uploadCallback(error) {
  if (error) {
    console.log(intro, 'uploadCallback:', 'error: ', error);
    process.exit();
  }
  done();
}

function done() {
  console.log(intro, 'Done!');
  process.exit();
}
