#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');

var driverManager = require('../../driverManager');
var pwdSimulator = require('../../simulator/pwdSimulator.js');
var carelinkDriver = require('../carelinkDriver');
var api = require('../../core/api.js');
var config = require('./loaderConfig.js');

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
      return;
    }
    console.log('All good! loaded [%s] events - check in Blip',result.post_records.length);
    return;
  });
}

/*
 * login to the platform
 */
function login(un, pw, config, cb){
  api.init(config, function(){
    api.user.login({ username: un, password:pw}, cb);
  });
}

/*
 * load correct config for your environment
 */
function loadConfig(environment){
  var envConfig = {};
  switch (environment) {
    case 'local':
      envConfig = config.local;
      break;
    case 'devel':
      envConfig = config.devel;
      break;
    case 'staging':
      envConfig = config.staging;
      break;
    case 'prod':
      envConfig = config.prod;
      break;
    default:
  }
  return envConfig;
}


/*
 * Our CLI that does the work to load the specified raw csv data
 */

program
  .version('0.0.1')
  .option('-c, --carelink [path]', 'carelink csv file path')
  .option('-e, --environment [env]', 'load into local, devel, staging or prod environments', 'staging')//default is 'staging'
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .option('-t, --timezone [tz]', 'named timezone', 'America/Los_Angeles')//default is 'America/Los_Angeles'
  .parse(process.argv);

console.log('loading carelink csv:');

if(program.carelink && program.environment && program.username && program.password) {
  if (fs.existsSync(program.carelink)){

    console.log('getting config for ', program.environment);
    var envConfig = loadConfig(program.environment);
    console.log('using config ', envConfig);

    login(program.username, program.password, envConfig, function(err, data){
      if(err){
        console.log('failed authentication!');
        console.log(err);
        return;
      }
      console.log('loading using the timezone ', program.timezone);
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