/**
 * Base webpack config used across other specific configs
 */

import _ from 'lodash';
import path from 'path';
import { dependencies as externals } from './app/package.json';
import { optionalDependencies as additionalExternals } from './app/package.json';

export default {
  module: {
    rules: [{
      test: /\.jsx?$/,
      use: [{
        loader: 'babel-loader'
      }],
      exclude: /node_modules/
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
    extensions: ['.js', '.jsx', '.json'],
    mainFields: ['webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main'],
  },
  resolveLoader: { },

  plugins: [],

  externals: _.keys(_.merge({}, externals, additionalExternals) || {})
};
