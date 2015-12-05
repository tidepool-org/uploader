var path = require('path');

module.exports = {
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        loader: 'babel-loader?optional=runtime&plugins=babel-plugin-rewire'
      },      {
        test: /\.jsx$/,
        exclude: /(node_modules)/,
        loader: 'babel-loader?optional=runtime&plugins=babel-plugin-rewire'
      },
      { test: /\.json$/, loader: 'json' }
    ]
  },
  // to fix the 'broken by design' issue with npm link-ing modules
  resolve: { fallback: path.join(__dirname, 'node_modules') },
  resolveLoader: { fallback: path.join(__dirname, 'node_modules') }
};
