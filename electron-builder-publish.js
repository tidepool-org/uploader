const config = {
  publish: [
      'github'
  ],
  productName: 'Tidepool Uploader',
  appId: 'org.tidepool.TidepoolUploader',
  directories: {
    buildResources: 'resources',
    output: 'release'
  },
  afterSign: 'scripts/notarize.js',
  dmg: {
    artifactName: '${productName}-${version}.${ext}',
    contents: [
      {
        x: 381,
        y: 190,
        type: 'link',
        path: '/Applications'
      },
      {
        x: 159,
        y: 190,
        type: 'file'
      }
    ],
    background: 'resources/background.tiff'
  },
  nsis: {
    oneClick: false,
    perMachine: true,
    allowElevation: true
  },
  files: [
    'dist/',
    'node_modules/',
    'app.html',
    'main.prod.js',
    'main.prod.js.map',
    'package.json'
  ],
  extraResources: [
    {
      from: 'resources/${os}',
      to: 'driver/',
      filter: [
        '**/*',
        '!*.md'
      ]
    },
    'sounds/',
    'locales/'
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: [
          'x64'
        ]
      },
      {
        target: 'zip',
        arch: [
          'x64'
        ]
      }
    ],
    publisherName: [
      'Tidepool Project'
    ],
    rfc3161TimeStampServer: 'http://timestamp.digicert.com',
    asarUnpack: '**\\*.node',
  },
  mac: {
    category: 'public.app-category.tools',
    artifactName: '${productName}-${version}-${os}.${ext}',
    target: [
      {
        target: 'zip',
        arch: [
          'universal'
        ]
      },
      {
        target: 'dmg',
        arch: [
          'universal'
        ]
      },
      'dir'
    ],
    notarize: false,
    asarUnpack: [
      'app/node_modules/keytar', // https://github.com/electron-userland/electron-builder/issues/3940#issuecomment-900527250
      'app/node_modules/@tidepool/direct-io',
    ],
  },
  protocols: [{
    name: 'Tidepool Uploader',
    schemes: ['tidepooluploader', 'tidepoolupload'],
  }],
};

console.log('CIRCLE_TAG:', process.env.CIRCLE_TAG);
console.log('APPVEYOR_REPO_TAG:', process.env.APPVEYOR_REPO_TAG);

if ( (process.env.CIRCLE_TAG && process.env.CIRCLE_TAG.length > 0) ||
     (process.env.APPVEYOR_REPO_TAG_NAME && process.env.APPVEYOR_REPO_TAG_NAME.length > 0) ) {
  let releaseType = null;

  if ( (process.env.CIRCLE_TAG && process.env.CIRCLE_TAG.indexOf('-') !== -1) ||
       (process.env.APPVEYOR_REPO_TAG_NAME && process.env.APPVEYOR_REPO_TAG_NAME.indexOf('-') !== -1) ) {
    releaseType = 'prerelease';
  } else {
    releaseType = 'release';
  }

  config.publish = [
    {
      provider: 'github',
      owner: 'tidepool-org', // required to overwrite existing binaries
      releaseType: releaseType,
    },
    {
      provider: 's3',
      bucket: 'downloads.tidepool.org',
    },
  ];
}

module.exports = config;
