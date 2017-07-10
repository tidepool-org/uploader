#!/usr/bin/env babel-node

global.__DEBUG__ = true;

import program from 'commander';

import device from '../../../core/device';
import config from '../../../../.config.js';
import pkg from '../../../../package.json';

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
    console.log(intro, 'deviceInfo value: ' + deviceInfo);
    options.deviceInfo = deviceInfo;
    device.upload('AbbottFreeStyleLibre', options, uploadCallback);
  } else {
    console.error(intro, 'Could not find FreeStyle Libre device. Is it connected via USB?');
    console.error(intro, 'Error value: ' + error);
  }
}

function uploadCallback(error, post_records) {
  console.log(intro, 'Error value: ' + error);
  console.log(intro, 'post_records value: ' + post_records);

  // exit from main electron process
  process.exit();
}
