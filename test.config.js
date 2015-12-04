module.exports = {
  module: {
    loaders: [
      { test: /\.js$/, exclude: /(node_modules)/, loader: 'babel-loader?plugins=babel-plugin-rewire' },
      { test: /\.jsx$/, exclude: /(node_modules)/, loader: 'babel-loader?plugins=babel-plugin-rewire' },
      { test: /\.json$/, loader: 'json' }
    ]
  }
};
