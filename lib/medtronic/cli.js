var fs = require('fs');
var path = require('path');
var proc = require('./processData.js');

var driver = require('../drivers/medtronicDriver');
var builder = require('../objectBuilder.js')();
var driverManager = require('../driverManager');
//var api = require('../core/api.js');
var config = require('../../.config.js');
var pkg = require('../../package.json');

var filePath = path.join(__dirname, 'medtronicPages.json');


var cfg = {
  //api: api,
  builder: builder,
  timezone: config.DEFAULT_TIMEZONE,
  version : pkg.name+' '+pkg.version,
  //groupId: userid,
 };

proc.init(cfg);

fs.readFile(filePath, {encoding: 'utf-8'}, function(err,data){
    if (!err){
      var json = JSON.parse(data);
      //console.log('received data: ' + json, json.length);

      proc.processPages(json, function(data) {
        //console.log('Data:', results, results.length);
        proc.buildBolusRecords(data.log_records);
      });

    }else{
      console.log(err);
    }
});
