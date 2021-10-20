/**
* Build config for electron 'Renderer Process' file
*/

import path from 'path';
import webpack from 'webpack';
import merge from 'webpack-merge';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import baseConfig from './webpack.config.base';
import RollbarSourceMapPlugin from 'rollbar-sourcemap-webpack-plugin';
import cp from 'child_process';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

const VERSION_SHA = process.env.CIRCLE_SHA1 ||
  process.env.APPVEYOR_REPO_COMMIT ||
  cp.execSync('git rev-parse HEAD', {cwd: __dirname, encoding: 'utf8' });

const ROLLBAR_POST_TOKEN = process.env.ROLLBAR_POST_TOKEN;

if (process.env.DEBUG_ERROR === 'true') {
  console.log('~ ~ ~ ~ ~ ~ ~ ~ ~ ~');
  console.log('### DEBUG MODE ###');
  console.log('~ ~ ~ ~ ~ ~ ~ ~ ~ ~');
  console.log();
}

if ((!process.env.API_URL && !process.env.UPLOAD_URL && !process.env.DATA_URL && !process.env.BLIP_URL)) {
  console.log('Using the default environment, which is now production.');
} else {
  console.log('***** NOT using the default environment *****');
  console.log('The default right-click server menu may be incorrect.');
  console.log('API_URL =', process.env.API_URL);
  console.log('UPLOAD_URL =', process.env.UPLOAD_URL);
  console.log('DATA_URL =', process.env.DATA_URL);
  console.log('BLIP_URL =', process.env.BLIP_URL);
}


export default merge.smart(baseConfig, {
  devtool: 'source-map',

  mode: 'production',

  target: 'electron-renderer',

  entry: ['./app/index'],

  output: {
    path: path.join(__dirname, 'app/dist'),
    publicPath: '../dist/',
    filename: 'renderer.prod.js'
  },

  module: {
    rules: [
      // Extract all .global.css to style.css as is
      {
        test: /\.global\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true
            }
          }
        ]
      },

      // Pipe other styles through css modules and append to style.css
      {
        test: /^((?!\.global).)*\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
              modules: {
                localIdentName: '[local]___[hash:base64:5]',
              },
              importLoaders: 1
            }
          }
        ]
      },

      {
        test: /\.module\.less$/,
        use: [{
          loader: MiniCssExtractPlugin.loader
        }, {
          loader: 'css-loader',
          options: {
            modules: {
              localIdentName: '[name]__[local]___[hash:base64:5]'
            },
            importLoaders: 1,
            sourceMap: true,
          }
        }, {
          loader: 'less-loader',
          options: {
            sourceMap: true
          }
        }]
      },

      {
        test: /^((?!module).)*\.less$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader
          },
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              sourceMap: true
            }
          },
          {
            loader: 'less-loader',
            options: {
              sourceMap: true
            }
          }
        ]
      },

      // Fonts
      { test: /\.woff(\?v=\d+\.\d+\.\d+)?$/, use: [{
        loader: 'url-loader',

        options: {
          limit: 10000,
          mimetype: 'application/font-woff'
        }
      }] },
      { test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/, use: [{
        loader: 'url-loader',

        options: {
          limit: 10000,
          mimetype: 'application/font-woff'
        }
      }] },
      { test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, use: [{
        loader: 'url-loader',

        options: {
          limit: 10000,
          mimetype: 'application/octet-stream'
        }
      }] },
      { test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, use: [{
        loader: 'file-loader'
      }] },
      { test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, use: [{
        loader: 'url-loader',

        options: {
          limit: 10000,
          mimetype: 'image/svg+xml'
        }
      }] },

      // Images
      {
        test: /\.(?:ico|gif|png|jpg|jpeg|webp)$/,
        use: [{
          loader: 'url-loader'
        }]
      },

      {
        test: /\.wasm$/,
        type: 'javascript/auto',
        use: [{
          loader: 'file-loader',
          options: {
            name: '[name].[ext]'
          }
        }]
      }
    ]
  },

  optimization: {
    minimizer: process.env.E2E_BUILD
      ? []
      : [
          new TerserPlugin({
            parallel: true,
            sourceMap: true,
            cache: true,
            terserOptions: {
              mangle: false
            },
            extractComments: false
          }),
          new OptimizeCSSAssetsPlugin({
            cssProcessorOptions: {
              map: {
                inline: false,
                annotation: true
              }
            }
          })
        ]
  },

  plugins: [
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
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV) || '"production"',
      'process.env.BUILD': JSON.stringify(process.env.BUILD) || '"prod"',
      __DEBUG__: JSON.stringify(JSON.parse(process.env.DEBUG_ERROR || 'false')),
      __VERSION_SHA__: JSON.stringify(VERSION_SHA),
      __ROLLBAR_POST_TOKEN__: JSON.stringify(ROLLBAR_POST_TOKEN),
      'global.GENTLY': false, // http://github.com/visionmedia/superagent/wiki/SuperAgent-for-Webpack for platform-client
    }),

    /**
    * Dynamically generate index.html page
    */
    new HtmlWebpackPlugin({
      filename: '../app.html',
      template: 'app/app.html',
      inject: false
    }),

    new MiniCssExtractPlugin({
      filename: 'style.css'
    }),

    /** Upload sourcemap to Rollbar */
    ...(ROLLBAR_POST_TOKEN ? [new RollbarSourceMapPlugin({
      accessToken: ROLLBAR_POST_TOKEN,
      version: VERSION_SHA,
      publicPath: 'http://dynamichost/dist'
    })] : []),

    new BundleAnalyzerPlugin({
      analyzerMode:
        process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true'
    })
  ],

  node: {
    __dirname: true, // https://github.com/visionmedia/superagent/wiki/SuperAgent-for-Webpack for platform-client
  }
});
