/* eslint global-require: off */
const developmentEnvironments = ['development', 'test'];

const developmentPlugins = [require('react-hot-loader/babel')];

const productionPlugins = [
  // babel-preset-react-optimize
  require('@babel/plugin-transform-react-constant-elements'),
  require('@babel/plugin-transform-react-inline-elements'),
  require('babel-plugin-transform-react-remove-prop-types')
];

module.exports = api => {
  const development = api.env(developmentEnvironments);
  api.cache.never();
  return {
    presets: [
      [
        require('@babel/preset-env'),
        {
          useBuiltIns: 'usage',
          // stay in sync with the installed core-js version so preset-env
          // knows exactly which polyfills are available
          corejs: require('core-js/package.json').version,
          modules: 'commonjs',
          bugfixes: true
        }
      ],
      [require('@babel/preset-react'), { development, runtime: 'classic', useSpread: true }]
    ],
    retainLines: true,
    plugins: [
      // Needed until Babel 8: parse-only support for syntax used in the app
      require('@babel/plugin-syntax-dynamic-import'),
      require('@babel/plugin-syntax-import-meta'),

      require('@babel/plugin-transform-class-properties'),

      ...(development ? developmentPlugins : productionPlugins),
      require('babel-plugin-add-module-exports'),
      require('@babel/plugin-transform-classes'),
    ],
    env: {
      development: {
        plugins: [
          [
            require('babel-plugin-transform-define'),
            {
              '__VERSION_SHA__': 'abcd'
            }
          ],
        ]
      },
      test: {
        plugins: [
          [
            require('babel-plugin-module-resolver'),
            {
              'root': ['./app/node_modules']
            }
          ],
          [
            require('babel-plugin-transform-define'),
            {
              '__VERSION_SHA__': 'abcd',
              'process.env.DEBUG_ERROR': false
            }
          ]
        ]
      }
    }
  };
};
