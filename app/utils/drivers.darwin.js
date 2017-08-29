/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2017, Tidepool Project
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

import { remote } from 'electron';
import sudo from 'sudo-prompt';
import plist from 'plist';
import fs from 'fs';
import path from 'path';
import isDev from 'electron-is-dev';
import decompress from 'decompress';

export function checkVersion() {

  function updateDrivers(appFolder, driverPath) {
    const options = {
      name: 'Tidepool Driver Installer',
      icns: path.join(appFolder,'/Tidepool Uploader.icns')
    };
    sudo.exec(path.join(appFolder,'driver/updateDrivers.sh').replace(/ /g, '\\ ') + ' ' + driverPath.replace(/ /g, '\\ '), options,
      (error, stdout, stderr) => {
        console.log('sudo result: ' + stdout);
        if (error) {
          console.log(error);
        }
      }
    );
  }

  function readVersion(dPath, driver) {
    try {
      const list = plist.parse(fs.readFileSync(path.join(dPath, driver, '/Contents/Info.plist'), 'utf8'));
      const version = list.CFBundleVersion;
      return version;
    } catch (error) {
      if(error.code ==='ENOENT') {
        return 'Not found';
      } else {
        console.log(error);
      }
      return null;
    }
  }

  function hasOldDriver(dPath, driverList) {
    for (const driver of driverList) {
      const currentVersion = readVersion(dPath, driver);
      const installedVersion = readVersion('/Library/Extensions/', driver);
      console.log(driver,'version: Installed =', installedVersion, ', Current =', currentVersion);

      if(currentVersion !== installedVersion) {
        return true;
      }
    }
    return false;
  }

  if (isDev) {
    // The dev mode Electron.app does not contain the drivers or update script,
    // it gets copied into the .app during packaging.
    console.log('Not checking driver versions in dev mode.');
    return;
  }

  const appFolder = path.dirname(remote.app.getAppPath());

  decompress(path.join(appFolder,'driver/extensions.zip'), path.join(appFolder,'driver/')).then(files => {
    const driverPath = path.join(appFolder,'driver/extensions');
    const driverList = fs.readdirSync(driverPath).filter(e => path.extname(e) === '.kext' );

    if (hasOldDriver(driverPath, driverList)) {
      updateDrivers(appFolder, driverPath);
    }
  });

}
