#!/usr/bin/env node

import program from 'commander';
import fs from 'fs';

import driverManager from '../../../driverManager';
import libreViewDriver from '../libreViewDriver';
import api from '../../../core/api';
import config from '../../../../.config';
import pkg from '../../../../package.json';
import builder from '../../../objectBuilder';

const intro = 'LibreView CLI:';

/*
 * Process our raw LibreView data
 */
function processLibreView(driverMgr) {
  driverMgr.process('LibreView', (err, result) => {
    if (err) {
      console.log(intro, 'Error processing LibreView data:', err);
      process.exit();
    }

    console.log(`${intro} All good! Uploaded [%s] events - check in blip :)`,
      result.postRecords.length);
    process.exit();
  });
}

/*
 * Load the given LibreView file and then parse and send the data to the tp-platform
 */
function loadFile(filePath, tz, userid) {
  console.log(intro, 'Reading', filePath);
  fs.readFile(filePath, 'utf8', (error, data) => {
    if (error) {
      console.log(intro, 'Error reading LibreView file', error);
      return;
    }

    const drivers = { LibreView: libreViewDriver };
    const cfg = { LibreView:
      {
        filename: filePath,
        filedata: data,
        timezone: tz,
        version: pkg.version,
        groupId: userid,
        builder: builder(),
        api,
      },
    };

    processLibreView(driverManager(drivers, cfg));
  });
}

/*
 * login to the platform
 */
function login(un, pw, cfg, cb) {
  api.create({
    apiUrl: cfg.API_URL,
    uploadUrl: cfg.UPLOAD_URL,
    dataUrl: cfg.DATA_URL,
    version: 'uploader node CLI tool - LibreView',
  });
  api.init(() => {
    api.user.login({ username: un, password: pw }, cb);
  });
}
/*
 * Our CLI that does the work to load the specified raw csv data
 */

program
  .version('0.0.1')
  .option('-f, --file [path]', 'LibreView csv file path')
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE) // default is 'America/Los_Angeles'
  .parse(process.argv);

console.log(intro, 'Loading LibreView CSV...');

if (!(program.file && program.username && program.password)) {
  program.help();
  process.exit();
}
if (!fs.existsSync(program.file)) {
  console.log(`${intro} CSV file at ${program.file} not found`);
  process.exit();
}

login(program.username, program.password, config, (err, data) => {
  if (err) {
    console.log(intro, 'Failed authentication!');
    console.log(err);
    process.exit();
  }
  console.log(intro, 'Loading using the timezone', program.timezone);
  console.log(intro, 'Loading for user', data.userid);

  loadFile(program.file, program.timezone, data.userid);
});
