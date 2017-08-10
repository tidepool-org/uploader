#!/usr/bin/env babel-node

global.__DEBUG__ = true;

import program from 'commander';
import fs from 'fs';

import device from '../../../core/device';
import config from '../../../../.config.js';
import pkg from '../../../../package.json';

import {stringify} from './stringify';

const intro = 'FSLibre CLI:';

program
  .version('0.0.1', null)
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)
  .parse(process.argv);

console.log(intro, 'Starting connection to device...');

const options = {
  timezone: program.timezone,
  version : pkg.name + ' ' + pkg.version,
  groupId: 'test'
};

device.init(options, initCallback);

function initCallback() {
  device.detect('AbbottFreeStyleLibre', options, detectCallback);
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
  console.log(intro, 'uploadCallback:', 'data: ', data);

  console.log(intro, 'uploadCallback:', 'writing data to file "data.json"...');
  fs.writeFile('data.json', stringify(data, {indent: 2, maxLevelPretty: 3}), 'utf8', () => {
    // exit from main electron process
    console.log(intro, 'Exiting...');
    process.exit();
  });
}
