/* eslint-disable max-len */
/**
 * Build config for development process that uses Hot-Module-Replacement
 * https://webpack.github.io/docs/hot-module-replacement-with-webpack.html
 */

import webpack from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import merge from 'webpack-merge';
import baseConfig from './webpack.config.base';
import cp from 'child_process';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import terser from 'terser';
import optional from 'optional';
import _ from 'lodash';

const isDev = (process.env.NODE_ENV === 'development');

const VERSION_SHA = process.env.CIRCLE_SHA1 ||
  process.env.APPVEYOR_REPO_COMMIT ||
  cp.execSync('git rev-parse HEAD', { cwd: __dirname, encoding: 'utf8' });

const port = process.env.PORT || 3005;
const publicPath = `http://localhost:${port}`;

if (process.env.DEBUG_ERROR === 'true') {
  console.log('~ ~ ~ ~ ~ ~ ~ ~ ~ ~');
  console.log('### DEBUG MODE ###');
  console.log('~ ~ ~ ~ ~ ~ ~ ~ ~ ~');
  console.log();
}

const apiUrl = _.get(optional('./config/local'), 'environment.API_URL', process.env.API_URL || 'https://api.tidepool.org');
const uploadUrl = _.get(optional('./config/local'), 'environment.UPLOAD_URL', process.env.UPLOAD_URL || 'https://uploads.tidepool.org');
const dataUrl = _.get(optional('./config/local'), 'environment.DATA_URL', process.env.DATA_URL || 'https://api.tidepool.org/dataservices');
const blipUrl = _.get(optional('./config/local'), 'environment.BLIP_URL', process.env.BLIP_URL || 'https://app.tidepool.org');

console.log('API_URL =', apiUrl);
console.log('UPLOAD_URL =', uploadUrl);
console.log('DATA_URL =', dataUrl);
console.log('BLIP_URL =', blipUrl);

export default merge.smart(baseConfig, {
  devtool: 'inline-source-map',//'#cheap-module-source-map',

  mode: 'development',

  target: 'web',

  entry: [
    //...(process.env.PLAIN_HMR ? [] : ['react-hot-loader/patch']),
    `webpack-dev-server/client?http://localhost:${port}/`,
    'webpack/hot/only-dev-server',
    require.resolve('./app/index')
  ],

  output: {
    publicPath: `http://localhost:${port}/`,
    filename: 'renderer.dev.js',
    libraryTarget: 'umd'
  },

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true
          }
        }
      },
      // https://github.com/ashtuchkin/iconv-lite/issues/204#issuecomment-432048618
      {
        test: /node_modules[\/\\](iconv-lite)[\/\\].+/,
        resolve: {
          aliasFields: ['main']
        }
      },
      {
        test: /\.global\.css$/,
        use: [{
          loader: 'style-loader'
        }, {
          loader: 'css-loader',
          options: {
            sourceMap: true
          }
        }]
      },

      {
        test: /^((?!\.global).)*\.css$/,
        use: [{
          loader: 'style-loader'
        }, {
          loader: 'css-loader',
          options: {
            modules: {
              localIdentName: '[name]__[local]___[hash:base64:5]'
            },
            sourceMap: true,
            importLoaders: 1,
          }
        }]
      },

      {
        test: /\.module\.less$/,
        use: [{
          loader: 'style-loader'
        }, {
          loader: 'css-loader',
          options: {
            modules: {
              localIdentName: '[name]__[local]___[hash:base64:5]'
            },
            sourceMap: true,
            importLoaders: 1
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
        use: [{
          loader: 'style-loader'
        }, {
          loader: 'css-loader',

          options: {
            sourceMap: true
          }
        }, {
          loader: 'less-loader',

          options: {
            sourceMap: true
          }
        }]
      },

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

      {
        test: /\.(?:ico|gif|png|jpg|jpeg|webp)$/,
        use: [{
          loader: 'url-loader',
          options: {
            limit: 10000,
          }
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
  resolve: {
    alias: {
      'react-dom': '@hot-loader/react-dom'
    }
  },
  plugins: [
    // new webpack.HotModuleReplacementPlugin({
    //   multiStep: true
    // }),

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
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV) || '"development"',
      'process.env.BUILD': JSON.stringify(process.env.BUILD) || '"dev"',
      __DEBUG__: JSON.stringify(JSON.parse(process.env.DEBUG_ERROR || 'false')),
      __VERSION_SHA__: JSON.stringify(VERSION_SHA),
      'global.GENTLY': false, // http://github.com/visionmedia/superagent/wiki/SuperAgent-for-Webpack for platform-client
      'process.env.API_URL': JSON.stringify(apiUrl),
      'process.env.UPLOAD_URL': JSON.stringify(uploadUrl),
      'process.env.DATA_URL': JSON.stringify(dataUrl),
      'process.env.BLIP_URL': JSON.stringify(blipUrl)
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true
    }),

    new CopyWebpackPlugin([
      {
        from: 'app/static',
        transform: (content, path) => {
          if (isDev || !path.endsWith('js')) {
           return content;
          }

          const code = fs.readFileSync(path, 'utf8');
          const result = terser.minify(code);
          return result.code;
        }
      }
    ]),

    new HtmlWebpackPlugin({
      template: 'app/web.html',
      inject: false
    }),
    new webpack.NamedModulesPlugin(),
  ],

  node: {
    __dirname: true, // https://github.com/visionmedia/superagent/wiki/SuperAgent-for-Webpack for platform-client
    __filename: false,
    fs: 'empty',
    dns: 'empty',
    child_process: 'empty'
  },

  devServer: {
    clientLogLevel: 'debug',
    port,
    publicPath,
    compress: true,
    noInfo: true,
    stats: 'errors-only',
    inline: true,
    lazy: false,
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    contentBase: path.join(__dirname),
    watchOptions: {
      aggregateTimeout: 300,
      ignored: /node_modules/,
      poll: 100
    },
    historyApiFallback: {
      verbose: true,
      disableDotRule: false
    },
    before() {
      if (process.env.START_HOT) {
        console.log('Starting Main Process...');
        spawn('npm', ['run', 'start-main-dev'], {
          shell: true,
          env: process.env,
          stdio: 'inherit'
        })
          .on('close', code => process.exit(code))
          .on('error', spawnError => console.error(spawnError));
      } else {
        console.log('not starting main process');
      }
    }
  }
});