// webpack.config.js
module.exports = {
  entry: './index.js',
  output: {
    filename: 'bundle.js'       
  },
  module: {
    loaders: [
      { test: /\.css$/, loader: 'style-loader!css-loader' },
      { test: /\.(png|jpg|gif)$/, loader: 'url-loader?limit=8192' } // inline base64 URLs for <=8k images, direct URLs for the rest
    ]
  },
  resolve: {
    alias: {
      lodash: 'lodash/dist/lodash.js'
    }
  }
};
