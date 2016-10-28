#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');
var _ = require('lodash');

var intro = 'Compare JSON CLI:';


function loadFile(filePath, cb) {
  fs.readFile(filePath, 'utf8', function(error, data) {
    console.log(intro, 'Reading', filePath);
    if (error) {
      console.log(intro, 'Error reading JSON file', error);
      return;
    }

    return cb(JSON.parse(data));
  });
}

function compareData(data1, data2){
  /*
  Action plan:
  - Match timestamps of records (could be more than one with the same timestamp)
  - drop the fields that will be different (e.g. index, source, previous, payload, deviceId)
  - Do _.isEqual on between them
  */
  console.log(JSON.stringify(data1[0],null,4));

  data1.forEach(function (record1) {
    var records2 = _.filter(data2, {deviceTime: record1.deviceTime});
    if(records2.length > 0) {
      console.log(record1.deviceTime, records2[0].deviceTime);
    } else {
      console.log('No matching record at ', record1.deviceTime);
    }

  });
}

var file1, file2;
program
  .version('0.0.1')
  .arguments('[file1] [file2]')
  .action(function (f1, f2) {
    file1 = f1;
    file2 = f2;
  })
  .parse(process.argv);

console.log(intro, 'Loading files...');

if(file1 && file2) {
  if (fs.existsSync(file1) && fs.existsSync(file2)){
    loadFile(file1, function(json1) {
      loadFile(file2, function(json2) {
        compareData(json1, json2);
        return;
      });
    });
  }else{
    console.log(intro + ' file not found');
    return;
  }
}else{
  program.help();
}
