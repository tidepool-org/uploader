#!/usr/bin/env node
/* eslint-disable no-console */

const program = require('commander');
const fs = require('fs');

const driverManager = require('../../../driverManager');
const builder = require('../../../objectBuilder')();
const medtronic600Driver = require('../medtronic600Driver');
const api = require('../../../core/api');
const config = require('../../../../.config');
const pkg = require('../../../../package.json');

const intro = 'Medtronic 600-series CLI:';

/*
 * Process our raw medtronic data
 */
function processMedtronic(driverMgr) {
  driverMgr.process('Medtronic600', (err, result) => {
    if (err) {
      console.log(intro, 'Error processing Medtronic 600-series data:', err);
      console.log(err.stack);
      process.exit();
    }
    console.log(`${intro} All good! Uploaded [%s] events - check in Tidepool for Web :)`, result.post_records.length);
    process.exit();
  });
}

/*
 * Load the given medtronic blob and then parse and send the data to the tp-platform
 */
function loadFile(filePath, tz, userid) {
  fs.readFile(filePath, 'utf8', (error, data) => {
    console.log(intro, 'Reading', filePath);
    if (error) {
      console.log(intro, 'Error reading Medtronic 600-series blob', error);
      return;
    }

    const json = JSON.parse(data);

    const drivers = {
      Medtronic600: medtronic600Driver,
    };
    const cfg = {
      Medtronic600: {
        filename: filePath,
        fileData: json,
        timezone: tz,
        version: `${pkg.version}`,
        groupId: userid,
        builder,
        api,
        deviceInfo: json.deviceInfo,
      },
    };

    processMedtronic(driverManager(drivers, cfg));
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
    version: 'uploader node CLI tool - Medtronic 600-series',
  });
  api.init(() => {
    api.user.login({
      username: un,
      password: pw,
    }, cb);
  });
}

/*
 * Our CLI that does the work to load the specified raw json data
 */
program
  .version('0.0.1')
  .option('-f, --file [path]', 'medtronic blob file path')
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE) // default is 'America/Los_Angeles'
  .parse(process.argv);

console.log(intro, 'Loading Medtronic 600-series blob...');

if (program.file && program.username && program.password) {
  if (fs.existsSync(program.file)) {
    login(program.username, program.password, config, (err, data) => {
      if (err) {
        console.log(intro, 'Failed authentication!');
        console.log(err);
        return;
      }
      console.log(intro, 'Loading using the timezone', program.timezone);
      console.log(intro, 'Loading for user ', data.userid);

      loadFile(program.file, program.timezone, data.userid);
    });
  } else {
    console.log(`${intro} file at [%s] not found`, program.medtronic);
  }
} else {
  program.help();
}
