var path = require('path');

module.exports = {
  entry: './index.js',
  output: {
    path: path.join(__dirname, '/build'),
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      { test: /\.css$/, loader: 'style-loader!css-loader' },
      { test: /\.json$/, loader: 'json-loader' }
    ]
  },
  resolve: {
    alias: {
      lodash: 'lodash/dist/lodash.js'
    }
  }
};
