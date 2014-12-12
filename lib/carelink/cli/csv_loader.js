#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');

var driverManager = require('../../driverManager');
var pwdSimulator = require('../../simulator/carelinkSimulator.js');
var carelinkDriver = require('../carelinkDriver');
var api = require('../../core/api.js');
var config = require('../../../.config.js');

/*
 * Load the given carelink file and then parse and send the data to the tp-platform
 */
function loadFile(filePath, tz) {
  fs.readFile(filePath, 'utf8', function(error, data) {
    console.log('Reading :: ', filePath);
    if (error) {
      console.log('Error reading carelink file ', error);
      return;
    }

    var drivers = {'Carelink': carelinkDriver(pwdSimulator, require('../../jellyfishClient.js')({tidepoolServer: api}))};
    var cfg = { 'Carelink': { filename: filePath, fileData: data, timezone: tz } };

    processCarelink(driverManager(drivers,cfg));
  });
}
/*
 * Process our raw carelink data
 */
function processCarelink(driverMgr){
  driverMgr.process('Carelink', function(err, result) {
    if (err) {
      console.log('Error processing carelink data: ',err);
      process.exit();
    }
    console.log('All good! loaded [%s] events - check in Blip',result.post_records.length);
    process.exit();
  });
}
/*
 * login to the platform
 */
function login(un, pw, config, cb){
  api.init({
    apiUrl: config.API_URL,
    uploadUrl: config.UPLOAD_URL
  }, function(){
    api.user.login({ username: un, password:pw}, cb);
  });
}
/*
 * Our CLI that does the work to load the specified raw csv data
 */

program
  .version('0.0.1')
  .option('-f, --file [path]', 'carelink csv file path')
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)//default is 'America/Los_Angeles'
  .parse(process.argv);

console.log('loading carelink csv:');

if(program.file && program.username && program.password) {
  if (fs.existsSync(program.file)){

    login(program.username, program.password, config, function(err, data){
      if(err){
        console.log('failed authentication!');
        console.log(err);
        return;
      }
      console.log('loading using the timezone ', program.timezone);
      loadFile(program.file, program.timezone,program.username,program.password);
      return;
    });
  }else{
    console.log('csv file at [%s] not found', program.carelink);
    return;
  }
}else{
  program.help();
}
