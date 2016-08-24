var fs = require('fs');
var path = require('path');
var proc = require('./processData.js');

var filePath = path.join(__dirname, 'medtronicPages.json');

fs.readFile(filePath, {encoding: 'utf-8'}, function(err,data){
    if (!err){
      var json = JSON.parse(data);
      console.log('received data: ' + json, json.length);

      proc.processPages(json, function(results) {
        //console.log('Data:', results, results.length);
      });

    }else{
      console.log(err);
    }
});
