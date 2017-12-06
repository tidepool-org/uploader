/**
* Build config for electron 'Renderer Process' file
*/

import path from 'path';
import webpack from 'webpack';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import merge from 'webpack-merge';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import BabiliPlugin from 'babili-webpack-plugin';
import baseConfig from './webpack.config.base';
import RollbarSourceMapPlugin from 'rollbar-sourcemap-webpack-plugin';
import cp from 'child_process';

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


export default merge(baseConfig, {
  devtool: 'source-map',

  entry: ['babel-polyfill', './app/index'],

  output: {
    path: path.join(__dirname, 'app/dist'),
    publicPath: '../dist/'
  },

  module: {
    rules: [
      // Extract all .global.css to style.css as is
      {
        test: /\.global\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: {
            loader: 'style-loader',
            options: {
              hmr: false
            }
          },
          use: 'css-loader'
        })
      },

      // Pipe other styles through css modules and append to style.css
      {
        test: /^((?!\.global).)*\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: {
            loader: 'style-loader',
            options: {
              hmr: false
            }
          },
          use: 'css-loader?modules&importLoaders=1&localIdentName=[name]__[local]___[hash:base64:5]'
        })
      },

      {
        test: /\.module\.less$/,
        use: [{
          loader: 'style-loader',
          options: {
            hmr: false
          }
        }, {
          loader: 'css-loader',
          options: {
            modules: true,
            importLoaders: 1,
            localIdentName: '[name]__[local]___[hash:base64:5]'
          }
        }, {
          loader: 'less-loader'
        }]
      },

      {
        test: /^((?!module).)*\.less$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: ['css-loader', 'less-loader']
        })
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
      }
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
    * Babli is an ES6+ aware minifier based on the Babel toolchain (beta)

    new BabiliPlugin({
    // Disable deadcode until https://github.com/babel/babili/issues/385 fixed
    deadcode: false,
  }),
  */
  new ExtractTextPlugin({ filename: 'style.css', allChunks: true }),
  /**
  * Dynamically generate index.html page
  */
  new HtmlWebpackPlugin({
    filename: '../app.html',
    template: 'app/app.html',
    inject: false
  }),

  /** Upload sourcemap to Rollbar */
  new RollbarSourceMapPlugin({
    accessToken: ROLLBAR_POST_TOKEN,
    version: VERSION_SHA,
    publicPath: 'http://dynamichost/dist'
  })],

  // https://github.com/chentsulin/webpack-target-electron-renderer#how-this-module-works
  target: 'electron-renderer',
  node: {
    __dirname: true, // https://github.com/visionmedia/superagent/wiki/SuperAgent-for-Webpack for platform-client
  }
});
