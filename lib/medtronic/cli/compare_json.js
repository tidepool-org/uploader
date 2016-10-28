#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');
var _ = require('lodash');
var difflet = require('difflet')({ indent : 2, comment: true });

var intro = 'Compare JSON CLI:';

var EXCLUDES = ['index','source','previous','payload','deviceId','scheduleName',
                'bolus.index', 'bolus.previous', 'bolus.payload', 'bolus.deviceId', 'bolus.jaebPayload'];

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
  if(record.suppressed) {
    record.suppressed = _.pick(record.suppressed, ['type', 'deliveryType', 'rate', 'percent', 'scheduleName']);
  }
  return _.omit(record,EXCLUDES);
}

function compareData(data1, data2){
  /*
  Action plan:
  - Match timestamps of records (could be more than one with the same timestamp)
  - drop the fields that will be different (e.g. index, source, previous, payload, deviceId)
  - Do _.isEqual on between them
  */

  data1.forEach(function (record1) {
    var records2 = _.filter(data2, {deviceTime: record1.deviceTime});
    var matched = false;
    if(records2.length > 0) {
      records2.forEach(function (record2) {
        matched = _.isEqual(cleanup(record1), cleanup(record2));
      });
      if(!matched) {
        console.log('Difference at:', record1.deviceTime);

        records2.forEach(function (record2) {
    
          if(record1.type === record2.type) {
            var s = difflet.compare(cleanup(record1), cleanup(record2));
            process.stdout.write(s);
          } else {
            console.log('Record 1:', JSON.stringify(cleanup(record1),null,4));
            console.log('Record 2:', JSON.stringify(cleanup(record2),null,4));
          }

        });
      }
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
console.log(intro, 'Excluding ',EXCLUDES);

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
