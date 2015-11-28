module.exports = {
  module: {
    loaders: [
      { test: /\.jsx$/, exclude: /(node_modules)/, loader: 'babel-loader' },
      { test: /\.json$/, loader: 'json' }
    ]
  }
};
