#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');

var driverManager = require('../../../driverManager');
var pwdSimulator = require('../medtronicSimulator.js');
var builder = require('../../../objectBuilder.js')();
var medtronicDriver = require('../medtronicDriver');
var api = require('../../../core/api.js');
var config = require('../../../../.config.js');
var pkg = require('./../../../../package.json');

var intro = 'Medtronic CLI:';


/*
 * Load the given medtronic blob and then parse and send the data to the tp-platform
 */
function loadFile(filePath, tz, userid) {
  fs.readFile(filePath, 'utf8', function(error, data) {
    console.log(intro, 'Reading', filePath);
    if (error) {
      console.log(intro, 'Error reading Medtronic blob', error);
      return;
    }

    var json = JSON.parse(data);

    var drivers = {'Medtronic': medtronicDriver};
    var cfg = { 'Medtronic': { filename: filePath,
                               fileData: json,
                               timezone: tz,
                               version: pkg.version,
                               groupId: userid,
                               builder: builder,
                               api: api,
                               deviceInfo: { deviceId: 'MedT-00000' }
                              } };

    processMedtronic(driverManager(drivers,cfg));
  });
}

/*
 * Process our raw medtronic data
 */
function processMedtronic(driverMgr){
  driverMgr.process('Medtronic', function(err, result) {
    if(result && result.post_records) {
      console.log('POST records:', JSON.stringify(result.post_records, null, '\t'));
    }
    if (err) {
      console.log(intro, 'Error processing Medtronic data:', err);
      console.log(err.stack);
      process.exit();
    }
    console.log(intro + ' All good! Uploaded [%s] events - check in blip :)', result.post_records.length);
    process.exit();
  });
}
/*
 * login to the platform
 */
function login(un, pw, config, cb){
  api.create({
    apiUrl: config.API_URL,
    uploadUrl: config.UPLOAD_URL,
    dataUrl: config.DATA_URL,
    version: 'uploader node CLI tool - Medtronic'
  });
  api.init(function() {
    api.user.login({ username: un, password:pw}, cb);
  });
}
/*
 * Our CLI that does the work to load the specified raw csv data
 */

program
  .version('0.0.1')
  .option('-f, --file [path]', 'medtronic blob file path')
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)//default is 'America/Los_Angeles'
  .parse(process.argv);

console.log(intro, 'Loading Medtronic blob...');

if(program.file && program.username && program.password) {
  if (fs.existsSync(program.file)){

    login(program.username, program.password, config, function(err, data){
      if(err){
        console.log(intro, 'Failed authentication!');
        console.log(err);
        return;
      }
      console.log(intro, 'Loading using the timezone', program.timezone);
      console.log(intro, 'Loading for user ', data.userid);

      loadFile( program.file, program.timezone, data.userid );
      return;
    });
  }else{
    console.log(intro + ' file at [%s] not found', program.medtronic);
    program.exit();
  }
}else{
  program.help();
}
