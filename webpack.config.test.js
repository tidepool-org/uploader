/** Used in .babelrc for 'test' environment */

// for babel-plugin-webpack-loaders
require('babel-register');
const validate = require('webpack-validator');
const devConfig = require('./webpack.config.development');
const loaders = devConfig.default.module.loaders.slice(1);

module.exports = validate({
  output: {
    libraryTarget: 'commonjs2'
  },
  module: {
    // Use base + development loaders, but exclude 'babel-loader' and 'trackerjs'
    loaders: loaders
  }
});
