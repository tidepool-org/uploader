/* eslint-disable max-len */
/**
 * Build config for development process that uses Hot-Module-Replacement
 * https://webpack.github.io/docs/hot-module-replacement-with-webpack.html
 */

import webpack from 'webpack';
import { merge } from 'webpack-merge';
import baseConfig from './webpack.config.base.mjs';
import cp from 'node:child_process';
import { spawn } from 'node:child_process';
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

const port = process.env.PORT || 3005;
const publicPath = `http://localhost:${port}/dist`;

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

export default (env => merge(baseConfig, {
  devtool: 'inline-source-map',//'#cheap-module-source-map',

  mode: 'development',

  target: 'electron-renderer',

  entry: [
    ...(process.env.PLAIN_HMR ? [] : ['react-hot-loader/patch']),
    path.resolve(__dirname, './app/index')
  ],

  output: {
    publicPath: `http://localhost:${port}/dist/`,
    filename: 'renderer.dev.js'
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
        use: [{
          loader: 'file-loader',
          options: {
            name: '[name].[ext]'
          }
        }]
      },
      {
        test: /\.node$/,
        loader: 'node-loader',
      },

    ]
  },
  resolve: {
    alias: {
      'react-dom': '@hot-loader/react-dom'
    }
  },
  plugins: [
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
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true
    })

  ],

  node: {
    __dirname: true, // https://github.com/visionmedia/superagent/wiki/SuperAgent-for-Webpack for platform-client
    __filename: false
  },

  devServer: {
    client: {
      logging: 'verbose'
    },
    port,
    devMiddleware: {
      publicPath,
      stats: 'errors-only'
    },
    hot: 'only',
    headers: { 'Access-Control-Allow-Origin': '*' },
    static: {
      directory: path.join(__dirname, 'dist'),
      watch: {
        aggregateTimeout: 300,
        ignored: /node_modules/,
        poll: 100
      }
    },
    historyApiFallback: {
      verbose: true,
      disableDotRule: false
    },
    setupMiddlewares(middlewares, devServer) {
      if (process.env.START_HOT) {
        console.log('Starting Main Process...');
        const argv = env?.argv;

        spawn('yarn', ['start-main-dev', `"${argv}"`], {
          shell: true,
          env: process.env,
          stdio: 'inherit'
        })
          .on('close', code => process.exit(code))
          .on('error', spawnError => console.error(spawnError));
      } else {
        console.log('not starting main process');
      }
      return middlewares;
    }
  }
}));
