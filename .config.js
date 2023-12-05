/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

import env from "./app/utils/env";

const serverEnvironments = {
  local: {
    hosts: ['localhost:3001'],
    API_URL: 'http://localhost:8009',
    UPLOAD_URL: 'http://localhost:8009',
    DATA_URL: 'http://localhost:9220',
    BLIP_URL: 'http://localhost:3000'
  },
  development: {
    hosts: ['localhost:31500'],
    API_URL: 'http://localhost:31500',
    UPLOAD_URL: 'http://localhost:31500',
    DATA_URL: 'http://localhost:31500/dataservices',
    BLIP_URL: 'http://localhost:31500'
  },
  dev1: {
    hosts: ['dev1.dev.tidepool.org'],
    API_URL: 'https://dev1.dev.tidepool.org',
    UPLOAD_URL: 'https://dev1.dev.tidepool.org',
    DATA_URL: 'https://dev1.dev.tidepool.org/dataservices',
    BLIP_URL: 'https://dev1.dev.tidepool.org'
  },
  qa1: {
    hosts: ['qa1.development.tidepool.org', 'dev-app.tidepool.org', 'dev-api.tidepool.org'],
    API_URL: 'https://qa1.development.tidepool.org',
    UPLOAD_URL: 'https://qa1.development.tidepool.org',
    DATA_URL: 'https://qa1.development.tidepool.org/dataservices',
    BLIP_URL: 'https://qa1.development.tidepool.org'
  },
  qa2: {
    hosts: ['qa2.development.tidepool.org', 'stg-app.tidepool.org', 'stg-api.tidepool.org'],
    API_URL: 'https://qa2.development.tidepool.org',
    UPLOAD_URL: 'https://qa2.development.tidepool.org',
    DATA_URL: 'https://qa2.development.tidepool.org/dataservices',
    BLIP_URL: 'https://qa2.development.tidepool.org'
  },
  qa3: {
    hosts: ['qa3.development.tidepool.org'],
    API_URL: 'https://qa3.development.tidepool.org',
    UPLOAD_URL: 'https://qa3.development.tidepool.org',
    DATA_URL: 'https://qa3.development.tidepool.org/dataservices',
    BLIP_URL: 'https://qa3.development.tidepool.org'
  },
  int: {
    hosts: ['external.integration.tidepool.org', 'int-app.tidepool.org', 'int-api.tidepool.org'],
    API_URL: 'https://external.integration.tidepool.org',
    UPLOAD_URL: 'https://external.integration.tidepool.org',
    DATA_URL: 'https://external.integration.tidepool.org/dataservices',
    BLIP_URL: 'https://external.integration.tidepool.org'
  },
  prd: {
    hosts: ['app.tidepool.org', 'api.tidepool.org', 'prd-app.tidepool.org', 'prd-api.tidepool.org'],
    API_URL: 'https://api.tidepool.org',
    UPLOAD_URL: 'https://api.tidepool.org',
    DATA_URL: 'https://api.tidepool.org/dataservices',
    BLIP_URL: 'https://app.tidepool.org'
  },
};

function serverEnvFromLocation() {
  const url = new URL(window.location.href);
  let host = url.hostname;
  if (host === 'localhost') {
    host += ':' + url.port;
  }
  return serverEnvFromHost(host)
}

function serverEnvFromHost(host) {
  for (const [server, environment] of Object.entries(serverEnvironments)) {
    if (_.includes(environment.hosts, host)) {
      return server
    }
  }
  return 'prd';
}

function stringToBoolean(str, defaultValue) {
  if (str === 'true') {
    return true;
  }
  if (str === 'false') {
    return false;
  }
  return defaultValue || false;
}

function stringToArray(str, defaultValue) {
  if (!(str && str.length)) {
    return defaultValue;
  }
  return str.split(',');
}

const selectedServerEnv = env.browser ? serverEnvFromLocation() : 'prd';

module.exports = {
  // this is to always have the Bows logger turned on!
  // NB: it is distinct from our own "debug mode"
  DEBUG: stringToBoolean(process.env.DEBUG, true),
  // the defaults for these need to be pointing to prod
  API_URL: process.env.API_URL || serverEnvironments[selectedServerEnv].API_URL,
  UPLOAD_URL: process.env.UPLOAD_URL || serverEnvironments[selectedServerEnv].UPLOAD_URL,
  DATA_URL: process.env.DATA_URL || serverEnvironments[selectedServerEnv].DATA_URL,
  BLIP_URL: process.env.BLIP_URL || serverEnvironments[selectedServerEnv].BLIP_URL,
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'America/Los_Angeles',
};
