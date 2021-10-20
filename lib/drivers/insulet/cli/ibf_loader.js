#!/usr/bin/env node

import program from 'commander';
import fs from 'fs';

import driverManager from '../../../driverManager';
import insuletDriver from '../insuletDriver';
import api from '../../../core/api';
import config from '../../../../.config';
import pkg from '../../../../package.json';
import builder from '../../../objectBuilder';

const intro = 'Insulet CLI:';

/*
 * Process our raw insulet data
 */
function processInsulet(driverMgr) {
  driverMgr.process('Insulet', (err, result) => {
    if (err) {
      console.log(intro, 'Error processing Insulet data:', err);
      console.log(err.stack);
      process.exit();
    }
    console.log(`${intro} All good! loaded ${result.post_records.length} events - check in blip :)`);
    process.exit();
  });
}

/*
 * Load the given insulet file and then parse and send the data to the tp-platform
 */
function loadFile(filePath, tz, userid) {
  // http://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer
  function toArrayBuffer(buffer) {
    const ab = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buffer.length; ++i) {
      view[i] = buffer[i];
    }
    return ab;
  }

  fs.readFile(filePath, (error, data) => {
    console.log(intro, 'Reading', filePath);
    if (error) {
      console.log(intro, 'Error reading Insulet file', error);
      return;
    }

    const drivers = { Insulet: insuletDriver };
    const cfg = {
      Insulet: {
        api,
        builder: builder(),
        filedata: toArrayBuffer(data),
        filename: filePath,
        timezone: tz,
        version: `${pkg.name} ${pkg.version}`,
        groupId: userid,
      },
    };

    processInsulet(driverManager(drivers, cfg));
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
    version: 'uploader node CLI tool - Insulet',
  });
  api.init(() => {
    api.user.login({ username: un, password: pw }, cb);
  });
}
/*
 * Our CLI that does the work to load the specified raw insulet data
 */

program
  .version('0.0.1')
  .option('-f, --file [path]', 'insulet file path')
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)
  .parse(process.argv);

console.log(intro, 'Loading Insulet file...');

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
    console.log(`${intro} Insulet file at ${program.file} not found`);
  }
} else {
  program.help();
}
