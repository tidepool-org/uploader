#!/usr/bin/env node

var program = require('commander');
var fs = require('fs');
var _ = require('lodash');
var difflet = require('difflet')({ indent : 2, comment: true });

var intro = 'Compare JSON CLI:';
var file1, file2;

var EXCLUDES = ['index','source','previous','payload','deviceId','annotations',
'_deduplicator', 'createdUserId', 'guid', 'id', 'uploadId','deviceSerialNumber', 'modifiedUserId'
];
/* reasons for exclusion:
   index - always different between CareLink and Medtronic drivers
   source - not used in Medtronic driver
   previous - not used in Medtronic driver
   payload - always different between CareLink and Medtronic drivers
   deviceId - always different between CareLink and Medtronic drivers
   annotations - can be different
*/

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
    record.suppressed = _.pick(record.suppressed, ['type', 'deliveryType', 'rate', 'percent', 'scheduleName', 'suppressed']);
  }
  if (record.bolus) {
    record.bolus = _.omit(record.bolus, ['index', 'previous', 'payload', 'deviceId', 'jaebPayload', 'jsDate','annotations']);
  }
  if(record.subType === 'status') {
    // CareLink driver sometimes does not record duration when resumed
    delete record.duration;
    delete record.reason.resumed;
  }
  if(record.bgInput === 0) {
    // CareLink driver records zero bg values
    delete record.bgInput;
  }
  if(record.type === 'cbg') {
    record.value -= record.value % 2; // CareLink only reports even values (!)
    if(record.value === 40) {
      record.value = 38; // difference between CL and TP implementation for BG low
    }
  }
  if(record.type === 'basal') {
    // CareLink driver always uses expectedDuration as duration (which then gets modified by Jellyfish)
    // so we can't compare durations
    // Also, reservoir changes or alarms (not supported by CareLink driver) can modify durations
    delete record.duration;
    delete record.expectedDuration;

    if(record.suppressed) {
      if(record.deliveryType === 'temp') {
        // CareLink driver records updated temp basals as suppressed, while the
        // new Medtronic driver record the original scheduled basal as suppressed
        delete record.suppressed.deliveryType;
        delete record.suppressed.rate;
        delete record.suppressed.scheduleName;
        delete record.suppressed.suppressed;
      }
      if(record.deliveryType === 'suspend') {
        // As CareLink driver is not aware of reservoir changes or alarms, it may think that it's
        // the suspended basal that is suppressing a scheduled basal, while the Medtronic driver
        // knows that the previous scheduled basal was cancelled by an alarm or a reservoir change
        delete record.suppressed;
      }
    }
  }

  if(record.type === 'pumpSettings') {
    if(record.units.bg === 'mmol/L') {
      // CareLink driver does not convert ISF and BG targets to mmol/L
      delete record.insulinSensitivity;
      delete record.bgTarget;
    }
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

  var successful = 0;

  for (var i = 0; i < data1.length - 1; i++) {
    var record1 = data1[i];
    var records2 = _.filter(data2, {deviceTime: record1.deviceTime});
    var matched = false;
    if(records2.length > 0) {
      records2.forEach(function (record2) {


        if(!(record1.scheduleName && record2.scheduleName)) {
          // if either doesn't exist, don't compare
          delete record1.scheduleName;
          delete record2.scheduleName;
        }

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
      if(record1.deliveryType === 'suspend') {
        console.log('Skipping suspend that may be caused by alarm or reservoir change');
        continue;
      }
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
          return record.subType === 'alarm' ||
                 record.subType === 'reservoirChange' ||
                 record.subType === 'prime' ||
                 record.subType === 'timeChange' ||
                 record.status === 'resumed' ||
                 record.subType === 'calibration';
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
