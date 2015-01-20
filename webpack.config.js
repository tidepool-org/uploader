var path = require('path');
var _ = require('lodash');

if ((!process.env.API_URL || !process.env.UPLOAD_URL || !process.env.BLIP_URL) &&
     process.env.MOCK != 'true') {
  console.log('Using the default environment, which is now production.');
} else {
  console.log('***** NOT using the default environment *****');
  console.log('The default right-click server menu may be incorrect.');
  console.log('API_URL =', process.env.API_URL);
  console.log('UPLOAD_URL =', process.env.UPLOAD_URL);
  console.log('BLIP_URL =', process.env.BLIP_URL);
  console.log('MOCK =', process.env.MOCK);
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
  resolve: {
    alias: {
      lodash: 'lodash/dist/lodash.js',
      mock: './mock/empty.js'
    }
  }
};

if (process.env.MOCK === 'true') {
  config.resolve.alias = _.assign(config.resolve.alias, {
    mock: './mock'
  });
}

module.exports = config;
