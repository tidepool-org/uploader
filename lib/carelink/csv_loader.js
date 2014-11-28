#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');

var driverManager = require('../driverManager');
var pwdSimulator = require('../simulator/pwdSimulator.js');
var carelinkDriver = require('../carelink/carelinkDriver');

function loadFile(filePath, tz) {
  fs.readFile(filePath, 'utf8', function(error, data) {
      console.log('Reading File :: '+filePath);
      if (error) {
        console.log('There is an error reading file...'+error);
      }
      else {
        var drivers = {'Carelink': carelinkDriver(pwdSimulator, {})};
        var cfg = { 'Carelink': { filename: filePath, fileData: data, timezone: tz } };
        processCarelink(driverManager(drivers,cfg));
      }
  });
}

function processCarelink(driverMgr){
  driverMgr.process('Carelink', function(err, result) {
    if (err) {
      console.log('crap: ',err);
    }
    console.log('yay! ',result.post_records);
  });
}

program
  .version('0.0.1')
  .option('-c, --carelink [path]', 'carelink csv file path')
  .option('-t, --timezone [name]', 'timezone')
  .parse(process.argv);

console.log('loading carelink csv:');

if(program.carelink && program.timezone) {
  console.log(' csv %s', program.carelink);
  console.log(' tz %s', program.timezone);
  if (fs.existsSync(program.carelink)){
    loadFile(program.carelink, program.timezone);
  }else{
    console.log('csv file at [%s] not found', program.carelink);
  }
}else{
  program.help();
}