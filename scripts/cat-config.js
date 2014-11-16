var util = require('util');

var output;
var config = require('../.config.js');

output = util.inspect(config, {depth: null});
output = 'window.config = ' + output + ';';

console.log(output);
