var path = require('path');

module.exports = {
  entry: './entry.js',
  output: {
    path: path.join(__dirname, '/build'),
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      { test: /\.jsx$/, loader: 'jsx' },
      { test: /\.css$/, loader: 'style!css' },
      { test: /\.json$/, loader: 'json' }
    ]
  },
  resolve: {
    alias: {
      lodash: 'lodash/dist/lodash.js'
    }
  }
};
