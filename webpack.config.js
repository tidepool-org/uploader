var path = require('path');
var _ = require('lodash');

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
