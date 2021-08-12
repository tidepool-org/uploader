/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2019, Tidepool Project
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

const fs = require('fs');
const builder = require('xmlbuilder');
const Client = require('ftp');
const https = require('https');
const aws = require('aws-sdk');

const ORG = 'tidepool-org';
const REPO = 'uploader';
const CONTACT_PERSON = 'Gerrit Niezen';
const CONTACT_EMAIL = 'gerrit@tidepool.org';

function getDownloadURL(cb) {
  const options = {
    hostname: 'api.github.com',
    port: 443,
    path: `/repos/${ORG}/${REPO}/releases/latest`,
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

      let windows = '';
      let macOS = '';

      for (let asset of data.assets) {
        if (asset.name.endsWith('.exe')) {
          windows = asset.browser_download_url;
        }

        if (asset.name.endsWith('.dmg')) {
          macOS = asset.browser_download_url;
        }
      }

      console.log('Windows Download URL:', windows);
      console.log('macOS Download URL:', macOS);
      return cb(null, { windows, macOS });
    });
  }).on('error', (e) => {
    console.error(e);
    return cb(e);
  });
}

function sendToKaspersky(downloadURL) {
  if(!process.env.FTP_AV_PASSWORD_TIDEPOOL) {
    console.log('Please set the FTP_AV_PASSWORD_TIDEPOOL environment variable');
  } else {

    const xml = builder.create('products', { encoding: 'utf-8'})
      .att('xmlns', 'http://www.kaspersky.com/KLSRL/ISV')
      .ele('product')
        .ele('url', downloadURL.windows)
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
        host : 'allowlist.kaspersky-labs.com',
        user : 'wl-Tidepool',
        port : 990,
        secure : true,
        secureOptions: { rejectUnauthorized: false },
        password: process.env.FTP_AV_PASSWORD_TIDEPOOL
      });
    });
  }
}

function sendtoMcAfee(downloadURL) {
  aws.config.update({region: 'us-west-2'});

  var params = {
    Destination: { /* required */
      CcAddresses: [
        CONTACT_EMAIL,
      ],
      ToAddresses: [
        'datasubmission@mcafee.com',
      ]
    },
    Source: 'noreply@tidepool.org', /* required */
    Template: 'mcafee-template', /* required */
    ConfigurationSetName: 'mcafee-email',
    TemplateData: /* required */
      '{ \"contactName\":\"' + CONTACT_PERSON +
      '\", \"windowsLink\":\"' + downloadURL.windows +
      '\", \"macOSLink\":\"' + downloadURL.macOS + '\"}',
    ReplyToAddresses: [
       'noreply@tidepool.org',
       CONTACT_EMAIL,
    ],
  };

  // Create the promise and SES service object
  const sendPromise = new aws.SES({apiVersion: '2010-12-01'})
                             .sendTemplatedEmail(params).promise();

  sendPromise.then((data) => {
    console.log('E-mail has been sent:', data);
  }).catch((err) => {
    console.error(err, err.stack);
  });
}

getDownloadURL((error, downloadURL) => {
  sendtoMcAfee(downloadURL);
  sendToKaspersky(downloadURL);
});
