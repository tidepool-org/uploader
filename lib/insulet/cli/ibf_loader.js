#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');

var driverManager = require('../../driverManager');
var insuletDriver = require('../../drivers/insuletDriver.js');
var api = require('../../core/api.js');
var config = require('../../../.config.js');
var pkg = require('./../../../package.json');

var builder = require('../../objectBuilder.js')();

/*
 * Load the given insulet file and then parse and send the data to the tp-platform
 */
function loadFile(filePath, tz) {
  // http://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer
  function toArrayBuffer(buffer) {
      var ab = new ArrayBuffer(buffer.length);
      var view = new Uint8Array(ab);
      for (var i = 0; i < buffer.length; ++i) {
          view[i] = buffer[i];
      }
      return ab;
  }

  fs.readFile(filePath, function(error, data) {
    console.log('Reading :: ', filePath);
    if (error) {
      console.log('Error reading insulet file ', error);
      return;
    }

    var drivers = {'Insulet': insuletDriver};
    var cfg = { 'Insulet': {
      api: api,
      builder: builder,
      filedata: toArrayBuffer(data),
      filename: filePath,
      timezone: tz,
      version : pkg.name+' '+pkg.version
    } };

    processInsulet(driverManager(drivers,cfg));
  });
}

/*
 * Process our raw insulet data
 */
function processInsulet(driverMgr){
  driverMgr.process('Insulet', function(err, result) {
    if (err) {
      console.log('Error processing insulet data: ',err);
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
 * Our CLI that does the work to load the specified raw insulet data
 */

program
  .version('0.0.1')
  .option('-f, --file [path]', 'insulet file path')
  .option('-u, --username [user]', 'username')
  .option('-p, --password [pw]', 'password')
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)
  .parse(process.argv);

console.log('loading insulet file:');

if(program.file && program.username && program.password) {
  if (fs.existsSync(program.file)){

    login(program.username, program.password, config, function(err){
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
    console.log('insulet file at [%s] not found', program.file);
    return;
  }
}else{
  program.help();
}
