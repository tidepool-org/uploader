/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015-2017, Tidepool Project
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

import { exec } from 'child_process';
import { remote } from 'electron';
//import Sudoer from 'electron-sudo';
import sudo from 'sudo-prompt';
import plist from 'plist';
import fs from 'fs';
import path from 'path';

export function checkVersion() {


  async function updateDrivers() {
    const options = {
      name: 'Tidepool Driver Installer',
      icns: '/Applications/Tidepool Uploader.app/Contents/Resources/Tidepool Uploader.icns',
    };
    sudo.exec('echo hello', options,
      (error, stdout, stderr) => {
        if (error) throw error;
        console.log('stdout: ' + stdout);
      }
    );
  }

  const driverPath = path.join(path.dirname(remote.app.getAppPath()),'driver/extensions/');
  const driverList = fs.readdirSync(driverPath).filter(e => path.extname(e) === '.kext' );

  for (let driver of driverList) {
    console.log(driver);
    const currentplist = plist.parse(fs.readFileSync(path.join(driverPath, driver, '/Contents/Info.plist'), 'utf8'));
    const currentVersion = currentplist.CFBundleVersion;
    console.log('Current Driver version:', currentVersion);

    const installedplist = plist.parse(fs.readFileSync(path.join('/Library/Extensions/',driver,'/Contents/Info.plist'),'utf8'));
    const installedVersion = installedplist.CFBundleVersion;
    console.log('Installed Driver version: ', installedVersion);
  }

  updateDrivers();

}
