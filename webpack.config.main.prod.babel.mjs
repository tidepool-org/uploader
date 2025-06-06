/**
 * Build config for electron 'Main Process' file
 */

import _ from 'lodash';
import webpack from 'webpack';
import { merge } from 'webpack-merge';
import TerserPlugin from 'terser-webpack-plugin';
import baseConfig from './webpack.config.base.mjs';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import cp from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Create dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION_SHA = 
  process.env.VERSION_SHA ||
  process.env.CIRCLE_SHA1 ||
  process.env.APPVEYOR_REPO_COMMIT ||
  cp.execSync('git rev-parse HEAD', {cwd: __dirname, encoding: 'utf8' });

export default merge(baseConfig, {
  devtool: 'source-map',

  mode: 'production',

  target: 'electron-main',

  entry: ['./app/main.dev'],

  output: {
    path: __dirname,
    filename: './app/main.prod.js'
  },

  optimization: {
    minimizer: process.env.E2E_BUILD
      ? []
      : [
          new TerserPlugin({
            parallel: true,
            extractComments: false,
            terserOptions: {
              sourceMap: true,
            }
          })
        ]
  },

  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode:
        process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true'
    }),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.BUILD': JSON.stringify(process.env.BUILD) || '"prod"',
      __ROLLBAR_POST_TOKEN__: JSON.stringify(process.env.ROLLBAR_POST_TOKEN),
      __VERSION_SHA__: JSON.stringify(VERSION_SHA),
    })
  ],

  /**
   * Disables webpack processing of __dirname and __filename.
   * If you run the bundle in node.js it falls back to these values of node.js.
   * https://github.com/webpack/webpack/issues/2010
   */
  node: {
    __dirname: false,
    __filename: false
  },
});
