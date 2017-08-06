#!/usr/bin/env babel-node

global.__DEBUG__ = true;

import program from 'commander';
import fs from 'fs';

import device from '../../../core/device';
import config from '../../../../.config.js';
import pkg from '../../../../package.json';

const intro = 'FSLibre CLI:';

program
  .version('0.0.1', null)
  .option('-t, --timezone [tz]', 'named timezone', config.DEFAULT_TIMEZONE)
  .parse(process.argv);

console.log(intro, 'Starting connection to device...');

const options = {
  timezone: program.timezone,
  version : pkg.name + ' ' + pkg.version,
  groupId: 'test'
};

device.init(options, initCallback);

function initCallback() {
  device.detect('AbbottFreeStyleLibre', options, detectCallback);
}

function detectCallback(error, deviceInfo) {
  if (deviceInfo !== undefined) {
    console.log(intro, 'detectCallback:', 'deviceInfo: ', deviceInfo);
    options.deviceInfo = deviceInfo;
    device.upload('AbbottFreeStyleLibre', options, uploadCallback);
  } else {
    console.error(intro, 'detectCallback:', 'Could not find FreeStyle Libre device. Is it connected via USB?');
    console.error(intro, 'detectCallback:', 'Error value: ' + error);
  }
}

function uploadCallback(error, data) {
  console.log(intro, 'uploadCallback:', 'error: ', error);
  console.log(intro, 'uploadCallback:', 'data: ', data);

  console.log(intro, 'uploadCallback:', 'writing data to file "data.json"...');
  fs.writeFile('data.json', stringify(data, {indent: 2, maxLevelPretty: 3}), 'utf8', () => {
    // exit from main electron process
    console.log(intro, 'Exiting...');
    process.exit();
  });
}


function stringify(obj, options) {

  var stringOrChar = /("(?:[^\\"]|\\.)*")|[:,]/g;

  function prettify (string) {
    return string.replace(stringOrChar, function (match, string) {
      return string ? match : match + ' ';
    });
  }

  function get (options, name, defaultValue) {
    return (name in options ? options[name] : defaultValue);
  }

  options = options || {};
  var indent = JSON.stringify([1], null, get(options, 'indent', 2)).slice(2, -3);
  var maxLength = (indent === '' ? Infinity : get(options, 'maxLength', 80));
  var maxLevelPretty = get(options, 'maxLevelPretty', Infinity);

  return (function _stringify (obj, currentIndent, reserved) {
    if (obj && typeof obj.toJSON === 'function') {
      obj = obj.toJSON();
    }

    var string = JSON.stringify(obj);

    if (string === undefined) {
      return string;
    }

    var currentLevel = currentIndent.length / indent.length;
    if (currentLevel >= maxLevelPretty) {
      return string;
    }

    var length = maxLength - currentIndent.length - reserved;

    if (string.length <= length) {
      var prettified = prettify(string);
      if (prettified.length <= length) {
        return prettified;
      }
    }

    if (typeof obj === 'object' && obj !== null) {
      var nextIndent = currentIndent + indent;
      var items = [];
      var delimiters;
      var comma = function (array, index) {
        return (index === array.length - 1 ? 0 : 1);
      };

      if (Array.isArray(obj)) {
        for (var index = 0; index < obj.length; index++) {
          items.push(
            _stringify(obj[index], nextIndent, comma(obj, index)) || 'null'
          );
        }
        delimiters = '[]';
      } else {
        Object.keys(obj).forEach(function (key, index, array) {
          var keyPart = JSON.stringify(key) + ': ';
          var value = _stringify(obj[key], nextIndent,
            keyPart.length + comma(array, index));
          if (value !== undefined) {
            items.push(keyPart + value);
          }
        });
        delimiters = '{}';
      }

      if (items.length > 0) {
        return [
          delimiters[0],
          indent + items.join(',\n' + nextIndent),
          delimiters[1]
        ].join('\n' + currentIndent);
      }
    }

    return string;
  })(obj, '', 0);
}
