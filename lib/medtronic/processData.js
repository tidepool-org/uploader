/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2016, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

/* globals chrome, __DEBUG__  */

var _ = require('lodash');

var sundial = require('sundial');
var struct = require('../struct.js')();

var savedFileEntry, fileDisplayPath;
var debug = (typeof __DEBUG__ === 'undefined') ? false : __DEBUG__;

var decodeDate = function (payload, index) {
 var encoded = struct.unpack(payload,index,'bbbbb',['second','minute','hour','day','year']);
 var second = encoded.second & 0x3f;
 var minute = encoded.minute & 0x3f;
 var hour = encoded.hour & 0x3f;
 var day = encoded.day & 0x1f;
 var month = (((encoded.second & 0xc0) >> 4) | ((encoded.minutes & 0xc0) >> 6));
 var year = (encoded.year & 0x7f)+2000;
 var date = sundial.buildTimestamp({year:year,month:month,day:day,hours:hour,minutes:minute,seconds:second});
 return date;
};

var savePages = function(data) {
  function exportToFileEntry(fileEntry) {
    savedFileEntry = fileEntry;

    // Use this to get a file path appropriate for displaying
    chrome.fileSystem.getDisplayPath(fileEntry, function(path) {
      fileDisplayPath = path;
      console.log('Exporting to '+path);

      fileEntry.createWriter(function(fileWriter) {
        var json = JSON.stringify(data.pages);
        var blob = new Blob([json], {type: 'application/json'});

        fileWriter.onwriteend = function(e) {
          console.log('Export to '+fileDisplayPath+' completed');
        };

        fileWriter.onerror = function(e) {
          console.log('Export failed: '+e.toString());
        };

        fileWriter.write(blob);

      });
    });
  }

  if (savedFileEntry) {
    exportToFileEntry(savedFileEntry);
  } else {
    chrome.fileSystem.chooseEntry( {
      type: 'saveFile',
      suggestedName: 'medtronicPages.bin',
      accepts: [ { description: 'Binary files (*.json)',
                   extensions: ['json']} ],
      acceptsAllTypes: true
    }, exportToFileEntry);
  }
};

var processPages = function(data, callback) {

  if(debug) {
    savePages(data);
    return callback([]);
  } else {

    return callback(data);
  }


};

module.exports.processPages = processPages;
