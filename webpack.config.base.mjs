/**
 * Base webpack config used across other specific configs
 */

import _ from 'lodash';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpack from 'webpack';
import appPkg from './app/package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const externals = _.get(appPkg, 'dependencies', {});
const additionalExternals = _.get(appPkg, 'optionalDependencies', {});

export default {
  module: {
    rules: [{
      test: /\.jsx?$/,
      use: [{
        loader: 'babel-loader',
        options: {
          cacheDirectory: true
        }
      }],
      exclude: /node_modules/
    },
    // https://github.com/ashtuchkin/iconv-lite/issues/204#issuecomment-432048618
    {
      test: /node_modules[\/\\](iconv-lite)[\/\\].+/,
      resolve: {
        aliasFields: ['main']
      }
    }]
  },

  output: {
    path: path.join(__dirname, 'app'),
    // https://github.com/webpack/webpack/issues/1114
    library: {
      type: 'commonjs2'
    }
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      superagent: 'superagent/lib/client.js',
      emitter: 'component-emitter',
      reduce: 'reduce-component'
    }
  },
  resolveLoader: { },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production'
    }),
  ],

  externals: [
    ...Object.keys(externals || {}),
    ...Object.keys(additionalExternals || {}),
    {
      'electron-updater': 'commonjs2 electron-updater'
    }
  ],
};
