module.exports = api => {
  api.cache.never();
  return {
  'presets': [
    ['@babel/preset-env', { 'targets': { 'electron': '3.1.1' }, 'useBuiltIns': 'usage', 'corejs':2, 'modules': 'commonjs' }],
    ['@babel/preset-react', {'development': true}]
  ],
  'retainLines': true,
  'plugins': [
    // Stage 0
    '@babel/plugin-proposal-function-bind',

    // Stage 1
    '@babel/plugin-proposal-export-default-from',
    '@babel/plugin-proposal-logical-assignment-operators',
    ['@babel/plugin-proposal-optional-chaining', { 'loose': false }],
    [
      '@babel/plugin-proposal-pipeline-operator',
      { 'proposal': 'minimal' }
    ],
    [
      '@babel/plugin-proposal-nullish-coalescing-operator',
      { 'loose': false }
    ],
    '@babel/plugin-proposal-do-expressions',

    // Stage 2
    ['@babel/plugin-proposal-decorators', { 'legacy': true }],
    '@babel/plugin-proposal-function-sent',
    '@babel/plugin-proposal-export-namespace-from',
    '@babel/plugin-proposal-numeric-separator',
    '@babel/plugin-proposal-throw-expressions',

    // Stage 3
    '@babel/plugin-syntax-dynamic-import',
    '@babel/plugin-syntax-import-meta',
    ['@babel/plugin-proposal-class-properties', { 'loose': true }],
    '@babel/plugin-proposal-json-strings'
  ],
  'env': {
    'production': {
      'presets': ['react-optimize'],
      'plugins': [
        'babel-plugin-dev-expression',
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-transform-classes'
      ]
    },
    'development': {
      'plugins': [
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-transform-classes',
        [
          'transform-define',
          {
            '__VERSION_SHA__': 'abcd'
          }
        ],
        'react-hot-loader/babel'
      ]
    },
    'test': {
      'plugins': [
        [
          'module-resolver',
          {
            'root': ['./app/node_modules'],
            'alias': {
              'node-hid': './app/node_modules/node-hid',
              'serialport': './app/node_modules/serialport'
            }
          }
        ],
        'babel-plugin-rewire',
        [
          'transform-define',
          {
            '__VERSION_SHA__': 'abcd',
            'process.env.DEBUG_ERROR': false
          }
        ],
        'react-hot-loader/babel'
      ]
    }
  }
};
};
