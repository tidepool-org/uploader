module.exports = {
  local: {
      API_URL: 'http://localhost:8009',
      UPLOAD_URL: 'http://localhost:9122'
  },
  devel: {
      API_URL: 'https://devel-api.tidepool.io',
      UPLOAD_URL: 'https://devel-uploads.tidepool.io'
  },
  staging: {
      API_URL: 'https://staging-api.tidepool.io',
      UPLOAD_URL: 'https://staging-uploads.tidepool.io'
  },
  prod: {
      API_URL: 'https://api.tidepool.io',
      UPLOAD_URL: 'https://uploads.tidepool.io'
  }
};
