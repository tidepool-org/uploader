#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');
var _ = require('lodash');
var difflet = require('difflet')({ indent : 2, comment: true });

var intro = 'Compare JSON CLI:';
var file1, file2;

var EXCLUDES = ['payload','bolus.payload','guid','uploadId'];

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

function cleanup(record) {
  return _.omit(record,EXCLUDES);
}

function compareData(data1, data2){
  var successful = 0;

  for (var i = 0; i < data1.length - 1; i++) {
    var record1 = data1[i];
    var records2 = _.filter(data2, {deviceTime: record1.deviceTime, type: record1.type, type: record1.type});
    var matched = false;
    if(records2.length > 0) {
      records2.forEach(function (record2) {
        matched = matched || _.isEqual(cleanup(record1), cleanup(record2));
      });
      if(!matched) {

        console.log('Difference at:', record1.deviceTime);

        records2.forEach(function (record2) {

          if(record1.type === record2.type) {
            console.log('Diff:');
            var s = difflet.compare(cleanup(record1), cleanup(record2));
            process.stdout.write(s);
          } else {
            console.log('Record from',file1,':', JSON.stringify(cleanup(record1),null,4));
            console.log('Record from',file2,':', JSON.stringify(cleanup(record2),null,4));
          }

        });
      } else {
        successful += 1;
      }
    } else {
      console.log('No matching record at ', record1.deviceTime);
    }

  };
  console.log('A total of',successful,'records passed successfully');
}

program
  .version('0.0.1')
  .arguments('[file1] [file2] ')
  .option('-t, --type <type>', 'filter by type')
  .option('-s, --subType <subType>', 'filter by subType')
  .action(function (f1, f2) {
    file1 = f1;
    file2 = f2;
  })
  .parse(process.argv);

if(file1 && file2) {
  if (fs.existsSync(file1) && fs.existsSync(file2)){

    console.log(intro, 'Loading files...');
    console.log(intro, 'Excluding ',EXCLUDES);

    loadFile(file1, function(json1) {
      loadFile(file2, function(json2) {
        _.remove(json1, function (record) {
          return record.type === 'pumpSettings' || record.type == 'upload';
        });
        if(program.type) {
          console.log(intro,'Filtering by', program.type);
          json1 = _.filter(json1,{'type' : program.type});
          json2 = _.filter(json2,{'type' : program.type});
        }
        if(program.subType) {
          console.log(intro,'Filtering by', program.subType);
          json1 = _.filter(json1,{'subType' : program.subType});
          json2 = _.filter(json2,{'subType' : program.subType});
        }
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
