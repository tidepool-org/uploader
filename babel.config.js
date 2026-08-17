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
          modules: 'commonjs'
        }
      ],
      [require('@babel/preset-react'), { development, runtime: 'classic' }]
    ],
    retainLines: true,
    plugins: [
      [
        require('babel-plugin-polyfill-corejs3'),
        {
          method: 'usage-global',
          // stay in sync with the installed core-js version so the plugin
          // knows exactly which polyfills are available
          version: require('core-js/package.json').version
        }
      ],

      ...(development ? developmentPlugins : productionPlugins),
      require('babel-plugin-add-module-exports'),
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
