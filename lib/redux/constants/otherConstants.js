/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

export const pages = {
  LOADING: 'LOADING',
  LOGIN: 'LOGIN',
  MAIN: 'MAIN',
  SETTINGS: 'SETTINGS',
  CLINIC_USER_SELECT: 'CLINIC_USER_SELECT',
  CLINIC_USER_EDIT: 'CLINIC_USER_EDIT'
};

export const paths = {
  FORGOT_PASSWORD: '/request-password-from-uploader',
  SIGNUP: '/signup'
};

export const steps = {
  start: 'START',
  carelinkFetch: 'CARELINK_FETCH',
  choosingFile: 'CHOOSING_FILE',
  detect: 'DETECT',
  setup: 'SETUP',
  connect: 'CONNECT',
  getConfigInfo: 'GET_CONFIG_INFO',
  fetchData: 'FETCH_DATA',
  processData: 'PROCESS_DATA',
  uploadData: 'UPLOAD_DATA',
  disconnect: 'DISCONNECT',
  cleanup: 'CLEANUP'
};

export const urls = {
  DRIVER_DOWNLOAD: 'http://tidepool.org/downloads/',
  HOW_TO_UPDATE_KB_ARTICLE: 'https://tidepool-project.helpscoutdocs.com/article/6-how-to-install-or-upgrade-the-tidepool-uploader-gen'
};
