/**
 * Base webpack config used across other specific configs
 */

import _ from 'lodash';
import path from 'path';
import validate from 'webpack-validator';
import { dependencies as externals } from './app/package.json';
import { optionalDependencies as additionalExternals } from './app/package.json';

export default validate({
  module: {
    loaders: [{
      test: /\.jsx?$/,
      loaders: ['babel-loader'],
      exclude: /node_modules/
    }, {
      test: /\.json$/,
      loader: 'json-loader'
    },
    {
      test: require.resolve('trackjs'),
      loader: 'exports?trackJs'
    }]
  },

  output: {
    path: path.join(__dirname, 'app'),
    filename: 'bundle.js',

    // https://github.com/webpack/webpack/issues/1114
    libraryTarget: 'commonjs2'
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['', '.js', '.jsx', '.json'],
    packageMains: ['webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main'],
    fallback: path.join(__dirname, 'node_modules')
  },
  resolveLoader: { fallback: path.join(__dirname, 'node_modules') },

  plugins: [],

  devtool: 'source-map',

  externals: Object.keys(_.merge({}, externals, additionalExternals) || {})
});
