/**
 * Copy this file to `config/local.js` and update as needed
 */

const linkedPackages = {
  // 'tidepool-platform-client': process.env.TIDEPOOL_DOCKER_PLATFORM_CLIENT_DIR || '../platform-client',
};

const environments = {
  local: {
    API_URL: 'http://localhost:8009',
    UPLOAD_URL: 'http://localhost:8009',
    DATA_URL: 'http://localhost:9220',
    BLIP_URL: 'http://localhost:3000'
  },
  qa1: {
    API_URL: 'https://qa1.development.tidepool.org',
    UPLOAD_URL: 'https://qa1.development.tidepool.org',
    DATA_URL: 'https://qa1.development.tidepool.org/dataservices',
    BLIP_URL: 'https://qa1.development.tidepool.org'
  },
  qa2: {
    API_URL: 'https://qa2.development.tidepool.org',
    UPLOAD_URL: 'https://qa2.development.tidepool.org',
    DATA_URL: 'https://qa2.development.tidepool.org/dataservices',
    BLIP_URL: 'https://qa2.development.tidepool.org'
  },
  int: {
    API_URL: 'https://external.integration.tidepool.org/',
    UPLOAD_URL: 'https://external.integration.tidepool.org/',
    DATA_URL: 'https://external.integration.tidepool.org/dataservices',
    BLIP_URL: 'https://external.integration.tidepool.org/'
  },
  prd: {
    API_URL: 'https://api.tidepool.org',
    UPLOAD_URL: 'https://api.tidepool.org',
    DATA_URL: 'https://api.tidepool.org/dataservices',
    BLIP_URL: 'https://app.tidepool.org'
  },
};

// Select environment here
const env = 'qa1';

const selectedEnv = environments[env];
const apiHost = selectedEnv.API_URL;
const uploadApi = apiHost;

module.exports = {
  listLinkedPackages: () => console.log(Object.keys(linkedPackages).join(',')),
  linkedPackages,
  apiHost,
  uploadApi,
  environment: selectedEnv
};
