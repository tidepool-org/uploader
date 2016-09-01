var fs = require('fs');
var path = require('path');
var proc = require('../processData.js');

var driver = require('../../drivers/medtronicDriver');
var builder = require('../../objectBuilder.js')();
var driverManager = require('../../driverManager');
var config = require('../../../.config.js');
var pkg = require('../../../package.json');
var TZOUtil = require('../../TimezoneOffsetUtil');

var filePath = path.join(__dirname, 'medtronicPages.json');


var cfg = {
  builder: builder,
  timezone: 'Europe/London', //FIXME
  version : pkg.name+' '+pkg.version,
 };

console.log(cfg.timezone);
cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);  //FIXME
proc.init(cfg);

fs.readFile(filePath, {encoding: 'utf-8'}, function(err,data){
    if (!err){
      var json = JSON.parse(data);
      //console.log('received data: ' + json, json.length);

      proc.processPages({pages:json}, function(err, records) {
        //console.log('Data:', results, results.length);
        proc.buildBolusRecords(records);
        proc.buildWizardRecords(records);
      });

    }else{
      console.log(err);
    }
});
