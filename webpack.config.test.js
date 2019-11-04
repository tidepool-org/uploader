/** Used in .babelrc for 'test' environment */

// for babel-plugin-webpack-loaders
require('@babel/register');
const devConfig = require('./webpack.config.development');
//devConfig.entry.push('./test/index.js');
module.exports = {
  mode: 'development',
  entry: devConfig.entry,
  output: {
    libraryTarget: 'commonjs2'
  },
  module: {
    // Use base + development loaders, but exclude 'babel-loader'
    rules: devConfig.module.rules
  },
  target: 'electron-renderer'
};