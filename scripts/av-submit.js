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

 /*
 This script generates an XML file for the Kaspersky Antivirus Whitelist program,
 and uploads it to their FTP. It requires a password that can be set using the
 FTP_AV_PASSWORD_TIDEPOOL environment variable and is stored in 1Password.
 */

const fs = require('fs');
const builder = require('xmlbuilder');
const Client = require('ftp');
const https = require('https');

const ORG = 'tidepool-org';
const REPO = 'chrome-uploader';

if(!process.env.FTP_AV_PASSWORD_TIDEPOOL) {
  console.log('Please set the FTP_AV_PASSWORD_TIDEPOOL environment variable.');
} else {

  const options = {
    hostname: 'api.github.com',
    port: 443,
    path: '/repos/' + ORG + '/' + REPO + '/releases/latest',
    method: 'GET',
    headers: {
        'accept': 'application/json',
        'user-agent': ORG + '.av-submit'
    }
  };

  https.get(options, res => {
    let body = '';

    res.on('data', function (chunk) {
      body += chunk;
    });

    res.on('end', function () {
      const data = JSON.parse(body);

      let downloadURL = '';
      for (let asset of data.assets) {
        if (asset.name.endsWith('.exe')) {
          downloadURL = asset.browser_download_url;
        }
      }

      console.log('File URL:', downloadURL);

      const xml = builder.create('products', { encoding: 'utf-8'})
        .att('xmlns', 'http://www.kaspersky.com/KLSRL/ISV')
        .ele('product')
          .ele('url', downloadURL)
        .end({ pretty: true});

      console.log(xml);

      fs.writeFile('uploader.xml', xml, (err) => {
        if (err) throw err;
        console.log('The file has been saved!');

        const c = new Client();
        c.on('ready', function() {
          c.put('uploader.xml', 'uploader.xml', function(err) {
            if (err) throw err;
            c.end();
            console.log('Uploaded file to FTP server.');
          });
        });

        c.connect({
          host : 'whitelist1.kaspersky-labs.com',
          user : 'wl-Tidepool',
          password: process.env.FTP_AV_PASSWORD_TIDEPOOL
        });
      });
    });
  });
}
