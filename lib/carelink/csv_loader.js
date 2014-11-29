#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');

var driverManager = require('../driverManager');
var pwdSimulator = require('../simulator/pwdSimulator.js');
var carelinkDriver = require('../carelink/carelinkDriver');
var api = require('../core/api.js');

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

    var drivers = {'Carelink': carelinkDriver(pwdSimulator, require('../jellyfishClient.js')({tidepoolServer: api}))};
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
      return;
    }
    console.log('All good! loaded [%s] events - check in Blip',result.post_records.length);
    return;
  });
}

/*
 * login to the platform
 */
function login(un, pw, cb){
  var config = {
    API_URL: 'http://localhost:8009',
    UPLOAD_URL: 'http://localhost:9122'
  };

  api.init(config, function(){
    api.user.login({ username: un, password:pw}, cb);
  });
}

program
  .version('0.0.1')
  .option('-c, --carelink [path]', 'carelink csv file path')
  .option('-t, --timezone [tz]', 'timezone')
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .parse(process.argv);

console.log('loading carelink csv:');

if(program.carelink && program.timezone && program.username && program.password) {
  if (fs.existsSync(program.carelink)){
    login(program.username, program.password, function(err, data){
      if(err){
        console.log('failed authentication!');
        console.log(err);
        return;
      }
      loadFile(program.carelink, program.timezone,program.username,program.password);
      return;
    });
  }else{
    console.log('csv file at [%s] not found', program.carelink);
    return;
  }
}else{
  program.help();
}