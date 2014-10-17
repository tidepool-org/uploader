// webpack.config.js
module.exports = {
  entry: './index.js',
  output: {
    filename: 'bundle.js'       
  },
  module: {
    loaders: [
      { test: /\.css$/, loader: 'style-loader!css-loader' },
      { test: /\.json$/, loader: 'json-loader' },
      { test: /\.(png|jpg|gif)$/, loader: 'url-loader?limit=8192' }, // inline base64 URLs for <=8k images, direct URLs for the rest
      { test: /\.woff$/,   loader: 'url-loader?limit=8192&minetype=application/font-woff' },
      { test: /\.ttf$/,    loader: 'file-loader' },
      { test: /\.eot$/,    loader: 'file-loader' },
      { test: /\.svg$/,    loader: 'file-loader' }
    ]
  },
  resolve: {
    alias: {
      lodash: 'lodash/dist/lodash.js'
    }
  }
};
