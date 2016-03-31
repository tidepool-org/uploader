var path = require('path');
var webpack = require('webpack');

var definePlugin = new webpack.DefinePlugin({
  __TEST__: true
});

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
  plugins: [
    definePlugin
  ],
  // to fix the 'broken by design' issue with npm link-ing modules
  resolve: { fallback: path.join(__dirname, 'node_modules') },
  resolveLoader: { fallback: path.join(__dirname, 'node_modules') }
};
