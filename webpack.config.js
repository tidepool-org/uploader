var path = require('path');
var _ = require('lodash');
var webpack = require('webpack');

var definePlugin = new webpack.DefinePlugin({
  __DEBUG__: JSON.stringify(JSON.parse(process.env.DEBUG || 'false'))
});

if (process.env.DEBUG === 'true') {
  console.log('~ ~ ~ ~ ~ ~ ~ ~ ~ ~');
  console.log('### DEBUG MODE ###');
  console.log('~ ~ ~ ~ ~ ~ ~ ~ ~ ~');
  console.log();
}

if ((!process.env.API_URL || !process.env.UPLOAD_URL || !process.env.BLIP_URL)) {
  console.log('Using the default environment, which is now production.');
} else {
  console.log('***** NOT using the default environment *****');
  console.log('The default right-click server menu may be incorrect.');
  console.log('API_URL =', process.env.API_URL);
  console.log('UPLOAD_URL =', process.env.UPLOAD_URL);
  console.log('BLIP_URL =', process.env.BLIP_URL);
}

var config = {
  entry: './entry.js',
  output: {
    path: path.join(__dirname, '/build'),
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      { test: /\.jsx$/, loader: 'jsx' },
      { test: /\.less$/, loader: 'style!css!less' },
      { test: /\.json$/, loader: 'json' }
    ]
  },
  plugins: [
    definePlugin,
    new webpack.DefinePlugin({
      'process.env': Object.keys(process.env).reduce(function(o, k) {
        o[k] = JSON.stringify(process.env[k]);
        return o;
      }, {})
    })
  ]
};

module.exports = config;
