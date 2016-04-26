var webpack = require('webpack');
var webpackConf = require('./test.config.js');

module.exports = function (config) {
  config.set({
    browsers: [ 'PhantomJS' ],
    captureTimeout: 60000,
    browserNoActivityTimeout: 60000, // We need to accept that Webpack may take a while to build!
    singleRun: true,
    colors: true,
    frameworks: [ 'mocha', 'chai', 'sinon' ], // Mocha is our testing framework of choice
    files: [
      'browser.tests.js'
    ],
    preprocessors: {
      'browser.tests.js': [ 'webpack' ] // Preprocess with webpack and our sourcemap loader
    },
    reporters: [ 'mocha' ],
    webpack: webpackConf,
    webpackServer: {
      noInfo: true // We don't want webpack output
    }
  });
};