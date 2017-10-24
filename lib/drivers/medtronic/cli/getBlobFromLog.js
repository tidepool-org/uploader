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

const fs = require('fs');
const readline = require('readline');
const program = require('commander');

program
  .version('0.0.1')
  .option('-f, --file [path]', 'console log file path')
  .option('-o, --output [path]', 'output file path')
  .parse(process.argv);

if (program.file && program.output && fs.existsSync(program.file)){
  console.log('Loading console log file...');
  let inputFile = fs.createReadStream(program.file);
  const rl = readline.createInterface({
     input: inputFile
  });

  let pages = [];

  rl.on('line', (input) => {
    if(input.indexOf('Reading CGM history') > 1) {
      // skip CGM history for now
      rl.close();
    }
    const pos = input.indexOf('| Page ');
    if ( pos > -1 ) {
      let bytes = [];
      const hexString = input.slice(input.indexOf(' ',pos+8)+1);
      for (var i = 0; i < hexString.length-1; i+=2) {
        bytes.push(parseInt(hexString.substr(i,2),16));
      }
      let arr = new Uint8Array(bytes.length);
      arr.set(bytes);

      pages.push({
        page: arr,
        nak: false,
        valid: true
      });
    }
  });

  rl.on('close', () => {
    console.log(JSON.stringify(pages, null, 4));

    // since we don't have the binary settings data, we have to
    // use some default values for the processing to work
    const settings =  {
        modelNumber: '523',
        strokesPerUnit: 40,
        basalSchedules: {
            standard: []
        },
        units: {
            bg: 'mg/dL',
            carb: 'grams'
        },
        activeSchedule: 'standard',
        currentDeviceTime: new Date().toISOString(),
        deviceId: 'MedT-523-000000'
    };

    const json = JSON.stringify({
        settings: settings,
        pages: pages
    }, null, 4);

    fs.writeFile(program.output, json, (err) => {
      if (err) throw err;
      console.log('The file has been saved!');
    });

  });

}else{
  program.help();
}
