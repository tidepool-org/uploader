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

if(!process.env.FTP_AV_PASSWORD_TIDEPOOL) {
  console.log('Please set the FTP_PASSWORD_TIDEPOOL environment variable.');
} else {
  //TODO: get filename
  const filename = 'https://github.com/tidepool-org/chrome-uploader/releases/download/v2.0.2/tidepool-uploader-setup-2.0.2.exe';

  const xml = builder.create('products', { encoding: 'utf-8'})
    .att('xlmns', 'http://www.kaspersky.com/KLSRL/ISV')
    .ele('product')
      .ele('url', filename)
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
}
