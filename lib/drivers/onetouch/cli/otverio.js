#!/usr/bin/env babel-node
/* eslint-disable no-console */

import program from 'commander';

import api from '../../../core/api';
import config from '../../../../.config';
import pkg from '../../../../package.json';
import builder from '../../../objectBuilder';

import OneTouchVerioModule from '../oneTouchVerio';

const intro = 'OTVerio CLI:';

program
  .version('0.0.1', null)
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)
  .parse(process.argv);

const options = {
  api,
  timezone: program.timezone,
  version: `${pkg.name} ${pkg.version}`,
  builder: builder(),
};

const data = {
  deviceInfo: {
    driverId: 'OneTouchVerio',
  },
};

function showData(err, resultData) {
  if (err) {
    console.log(intro, 'ERROR:', err);
    process.exit(1);
  }
  console.log(intro, resultData);
}

function processDevice(opt) {
  const OTVerio = OneTouchVerioModule(opt);
  OTVerio.connect(() => {}, data, (err1, data1) => {
    showData(err1, data1);
    OTVerio.getConfigInfo(() => {}, data1, (err2, data2) => {
      showData(err2, data2);
      OTVerio.fetchData(() => {}, data2, (err3, data3) => {
        showData(err3, data3);
        OTVerio.processData(() => {}, data2, (err4, data4) => {
          showData(err4, data4);
          if (opt.groupId) {
            OTVerio.uploadData(() => {}, data2, (err5, data5) => {
              showData(err5, data5);
              OTVerio.disconnect(() => {}, {}, () => {
                process.exit(0);
              });
            });
          } else {
            console.log(intro, 'processDevice: No login provided, not uploading!');
            OTVerio.disconnect(() => {}, {}, () => {
              process.exit(0);
            });
          }
        });
      });
    });
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
  processDevice(options);
}

function login(username, password, cfg) {
  console.log(intro, 'login:', cfg.API_URL);
  api.create({
    apiUrl: cfg.API_URL,
    uploadUrl: cfg.UPLOAD_URL,
    dataUrl: cfg.DATA_URL,
    version: 'uploader CLI tool - otverio',
  });
  api.init(() => {
    api.user.login({ username, password }, loginCallback);
  });
}

if (program.username && program.password) {
  login(program.username, program.password, config);
} else {
  processDevice(options);
}
