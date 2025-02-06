/* eslint-disable max-len */
/**
 * Build config for development process that uses Hot-Module-Replacement
 * https://webpack.github.io/docs/hot-module-replacement-with-webpack.html
 */

import webpack from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin';
import { merge } from 'webpack-merge';
import baseConfig from './webpack.config.base.mjs';
import cp from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import * as terser from 'terser';
import optional from 'optional';
import _ from 'lodash';
import { fileURLToPath } from 'node:url';
import RollbarSourceMapPlugin from 'rollbar-sourcemap-webpack-plugin';
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';

// Create dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

const VERSION_SHA =
  process.env.CIRCLE_SHA1 ||
  process.env.APPVEYOR_REPO_COMMIT ||
  cp.execSync('git rev-parse HEAD', { cwd: __dirname, encoding: 'utf8' });

const {ROLLBAR_POST_TOKEN} = process.env;

const port = process.env.PORT || 3005;
const devPublicPath =
  process.env.WEBPACK_PUBLIC_PATH || `http://localhost:${port}`;

if (process.env.DEBUG_ERROR === 'true') {
  console.log('~ ~ ~ ~ ~ ~ ~ ~ ~ ~');
  console.log('### DEBUG MODE ###');
  console.log('~ ~ ~ ~ ~ ~ ~ ~ ~ ~');
  console.log();
}

const localConfig = optional('./config/local');

const apiUrl = _.get(
  localConfig,
  'environment.API_URL',
  process.env.API_URL || null
);
const uploadUrl = _.get(
  localConfig,
  'environment.UPLOAD_URL',
  process.env.UPLOAD_URL || null
);
const dataUrl = _.get(
  optional('./config/local'),
  'environment.DATA_URL',
  process.env.DATA_URL || null
);
const blipUrl = _.get(
  localConfig,
  'environment.BLIP_URL',
  process.env.BLIP_URL || null
);
const i18nEnabled = _.get(
  localConfig,
  'I18N_ENABLED',
  process.env.I18N_ENABLED || null
);

console.log('API_URL =', apiUrl);
console.log('UPLOAD_URL =', uploadUrl);
console.log('DATA_URL =', dataUrl);
console.log('BLIP_URL =', blipUrl);
console.log('I18N_ENABLED =', i18nEnabled);

const output = {
  path: path.join(__dirname, 'dist'),
  publicPath: isDev ? `${devPublicPath}/` : '/uploader/',
  filename: 'bundle.js',
  libraryTarget: 'umd',
};

const entry = [path.resolve(__dirname, './app/index.js')];

let devtool = process.env.WEBPACK_DEVTOOL || 'inline-source-map';
if (process.env.WEBPACK_DEVTOOL === false) devtool = undefined;

const plugins = [
  new NodePolyfillPlugin({
    additionalAliases: ['process'],
  }),
  new webpack.NoEmitOnErrorsPlugin(),

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
    'process.env.NODE_ENV':
      JSON.stringify(process.env.NODE_ENV) || '"development"',
    'process.env.BUILD': JSON.stringify(process.env.BUILD) || '"dev"',
    __DEBUG__: JSON.stringify(JSON.parse(process.env.DEBUG_ERROR || 'false')),
    __VERSION_SHA__: JSON.stringify(VERSION_SHA),
    'global.GENTLY': false, // http://github.com/visionmedia/superagent/wiki/SuperAgent-for-Webpack for platform-client
    'process.env.API_URL': JSON.stringify(apiUrl),
    'process.env.UPLOAD_URL': JSON.stringify(uploadUrl),
    'process.env.DATA_URL': JSON.stringify(dataUrl),
    'process.env.BLIP_URL': JSON.stringify(blipUrl),
    'process.env.I18N_ENABLED': JSON.stringify(i18nEnabled),
  }),

  new webpack.LoaderOptionsPlugin({
    debug: true,
  }),

  new MiniCssExtractPlugin({
    filename: isDev ? 'style.css' : 'style.[contenthash].css',
  }),

  new CopyWebpackPlugin({
    patterns: [
      {
        from: 'app/static',
        transform: (content, path) => {
          if (isDev || !path.endsWith('js')) {
            return content;
          }

          const code = fs.readFileSync(path, 'utf8');
          const result = terser.minify(code);
          return result.code;
        },
      },
    ],
  }),

  new HtmlWebpackPlugin({
    template: 'app/web.ejs',
    //inject: false,
  }),

  /** Upload sourcemap to Rollbar */
  ...(ROLLBAR_POST_TOKEN ? [new RollbarSourceMapPlugin({
    accessToken: ROLLBAR_POST_TOKEN,
    version: VERSION_SHA,
    publicPath: 'http://dynamichost/dist'
  })] : []),
];
let styleLoader = 'style-loader';
if (isProd) {
  styleLoader = MiniCssExtractPlugin.loader;
}

export default merge(baseConfig, {
  devtool,

  mode: isDev ? 'development' : 'production',

  target: 'web',

  entry,

  output,

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
          },
        },
      },
      // https://github.com/ashtuchkin/iconv-lite/issues/204#issuecomment-432048618
      {
        test: /node_modules[\/\\](iconv-lite)[\/\\].+/,
        resolve: {
          aliasFields: ['main'],
        },
      },
      {
        test: /\.global\.css$/,
        use: [
          {
            loader: styleLoader,
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
            },
          },
        ],
      },

      {
        test: /^((?!\.global).)*\.css$/,
        use: [
          {
            loader: styleLoader,
          },
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[name]__[local]___[hash:base64:5]',
              },
              sourceMap: true,
              importLoaders: 1,
            },
          },
        ],
      },

      {
        test: /\.module\.less$/,
        use: [
          {
            loader: styleLoader,
          },
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[name]__[local]___[hash:base64:5]',
              },
              sourceMap: true,
              importLoaders: 1,
            },
          },
          {
            loader: 'less-loader',
            options: {
              sourceMap: true,
            },
          },
        ],
      },

      {
        test: /^((?!module).)*\.less$/,
        use: [
          {
            loader: styleLoader,
          },
          {
            loader: 'css-loader',

            options: {
              sourceMap: true,
            },
          },
          {
            loader: 'less-loader',

            options: {
              sourceMap: true,
            },
          },
        ],
      },

      {
        test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
      },
      {
        test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
      },
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
      },
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
      },
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
      },
      {
        test: /\.(?:ico|gif|png|jpg|jpeg|webp)$/,
        type: 'asset',
      },
      {
        test: /\.wasm$/,
        type: 'javascript/auto',
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
            },
          },
        ],
      },
      {
        test: /\.node$/,
        loader: 'node-loader',
      },
    ],
  },
  resolve: {
    alias: {
      'react-dom': '@hot-loader/react-dom',
    },
    fallback: {
      dns: false,
      child_process: false,
    },
  },
  optimization: {
    minimizer: isDev
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
        ],
      moduleIds: 'named',
  },
  plugins,

  node: {
    __dirname: true, // https://github.com/visionmedia/superagent/wiki/SuperAgent-for-Webpack for platform-client
    __filename: false,
  },

  devServer: {
    client: {
      logging: 'verbose'
    },
    port,
    devMiddleware: {
      publicPath: devPublicPath,
      stats: 'errors-only'
    },
    hot: 'only',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    static: {
      directory: path.join(__dirname),
      watch: {
        aggregateTimeout: 300,
        ignored: /node_modules/,
        poll: 100
      }
    },
    historyApiFallback: {
      verbose: true,
      disableDotRule: false,
    },
  },
});
