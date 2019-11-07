/**
 * Build config for electron 'Main Process' file
 */

import webpack from 'webpack';
import merge from 'webpack-merge';
import TerserPlugin from 'terser-webpack-plugin';
import baseConfig from './webpack.config.base';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';


export default merge.smart(baseConfig, {
  devtool: 'source-map',

  mode: 'production',

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
            sourceMap: true,
            cache: true
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
    })
  ],

  /**
   * Set target to Electron specific node.js env.
   * https://github.com/chentsulin/webpack-target-electron-renderer#how-this-module-works
   */
  target: 'electron-main',

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