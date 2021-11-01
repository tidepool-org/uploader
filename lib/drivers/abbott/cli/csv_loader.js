#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');

var driverManager = require('../../../driverManager');
var libreViewDriver = require('../libreViewDriver');
var api = require('../../../core/api.js');
var config = require('../../../../.config.js');
var pkg = require('../../../../package.json');
var builder = require('../../../objectBuilder');

var intro = 'LibreView CLI:';

/*
 * Load the given LibreView file and then parse and send the data to the tp-platform
 */
function loadFile(filePath, tz, userid) {
    console.log(intro, 'Reading', filePath);
    fs.readFile(filePath, 'utf8', function(error, data) {
        if (error) {
            console.log(intro, 'Error reading LibreView file', error);
            return;
        }

        var drivers = {'LibreView': libreViewDriver};
        var cfg = { 'LibreView':
          {
            filename: filePath,
            fileData: data,
            timezone: tz,
            version: pkg.version,
            groupId: userid,
            builder: builder(),
            api: api
          }
        };

        processLibreView(driverManager(drivers, cfg));
    });
}

/*
 * Process our raw LibreView data
 */
function processLibreView(driverMgr){
    driverMgr.process('LibreView', function(err, result) {
        if (err) {
            console.log(intro, 'Error processing LibreView data:', err);
            process.exit();
        }

        console.log(intro + ' All good! Uploaded [%s] events - check in blip :)',
                    result.postRecords.length);
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
    version: 'uploader node CLI tool - LibreView',
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
    .option('-f, --file [path]', 'LibreView csv file path')
    .option('-u, --username [user]', 'username')
    .option('-p, --password [pw]', 'password')
    .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE) // default is 'America/Los_Angeles'
    .parse(process.argv);

function load(program) {
    console.log(intro, 'Loading LibreView CSV...');

    if(!(program.file && program.username && program.password)) {
        program.help();
        return;
    }
    if (!fs.existsSync(program.file)){
        console.log(intro + ' CSV file at [%s] not found', program.LibreView);
        return;
    }

    login(program.username, program.password, config, function(err, data){
        if (err) {
            console.log(intro, 'Failed authentication!');
            console.log(err);
            return;
        }
        console.log(intro, 'Loading using the timezone', program.timezone);
        console.log(intro, 'Loading for user', data.userid);

        loadFile(program.file, program.timezone, data.userid);
        return;
    });
}

load(program);
