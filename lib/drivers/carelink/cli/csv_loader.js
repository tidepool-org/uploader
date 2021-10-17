#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');

var driverManager = require('../../../driverManager');
var pwdSimulator = require('../carelinkSimulator.js');
var carelinkDriver = require('../carelinkDriver');
var api = require('../../../core/api.js');
var config = require('../../../../.config.js');
var pkg = require('../../../../package.json');
var builder = require('../../../objectBuilder');
var TZOUtil = require('../../../TimezoneOffsetUtil');

var intro = 'CareLink CLI:';


/*
 * Load the given carelink file and then parse and send the data to the tp-platform
 */
function loadFile(filePath, tz, userid, dev_mode) {
    console.log(intro, 'Reading', filePath);
    fs.readFile(filePath, 'utf8', function(error, data) {
        if (error) {
            console.log(intro, 'Error reading CareLink file', error);
            return;
        }

        var drivers = {'Carelink': carelinkDriver(pwdSimulator, api)};
        var cfg = { 'Carelink': { filename: filePath, fileData: data, timezone: tz, version: pkg.version, groupId: userid, builder: builder(), api: api, dev_mode: dev_mode} };

        processCarelink(driverManager(drivers, cfg));
    });
}

/*
 * Process our raw carelink data
 */
function processCarelink(driverMgr){
    driverMgr.process('Carelink', function(err, result) {
        if (err) {
            console.log(intro, 'Error processing CareLink data:', err);
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
    version: 'uploader node CLI tool - CareLink',
    builder: builder(),
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
    .option('-f, --file [path]', 'carelink csv file path')
    .option('-u, --username [user]', 'username')
    .option('-p, --password [pw]', 'password')
    .option('-i, --id [id]', 'user id') /* dev only */
    .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)//default is 'America/Los_Angeles'
    .parse(process.argv);

function load(program) {
    console.log(intro, 'Loading CareLink CSV...');

    if(!(program.file && program.username && program.password)) {
        program.help();
        return
    }
    if (!fs.existsSync(program.file)){
        console.log(intro + ' CSV file at [%s] not found', program.carelink);
        return
    }

    var userid = program.id;
    if (userid !== true) { /* dev only */
        console.log(intro, "DEV MODE", userid)
        loadFile(program.file, program.timezone, userid, true);
        return
    }
    login(program.username, program.password, config, function(err, data){
        if (err) {
            console.log(intro, 'Failed authentication!');
            console.log(err);
            return;
        }
        console.log(intro, 'Loading using the timezone', program.timezone);
        console.log(intro, 'Loading for user', data.userid);

        loadFile(program.file, program.timezone, data.userid, false);
        return;
    });
}

load(program)
