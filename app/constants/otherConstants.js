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
  NO_UPLOAD_TARGETS: 'NO_UPLOAD_TARGETS',
  SETTINGS: 'SETTINGS',
  CLINIC_USER_SELECT: 'CLINIC_USER_SELECT',
  CLINIC_USER_EDIT: 'CLINIC_USER_EDIT',
  WORKSPACE_SWITCH: 'WORKSPACE_SWITCH',
  LOGGED_OUT: 'LOGGED_OUT',
};

export const pagesMap = {
  LOADING: '/',
  LOGIN: '/login',
  MAIN: '/main',
  NO_UPLOAD_TARGETS: '/no_upload_targets',
  SETTINGS: '/settings',
  CLINIC_USER_SELECT: '/clinic_user_select',
  CLINIC_USER_EDIT: '/clinic_user_edit',
  WORKSPACE_SWITCH: '/workspace_switch',
  LOGGED_OUT: '/logged_out'
};

export const paths = {
  FORGOT_PASSWORD: '/request-password-from-uploader',
  SIGNUP: '/signup',
  NEW_PATIENT: '/patients/new'
};

export const steps = {
  start: 'START',
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
  HOW_TO_UPDATE_KB_ARTICLE: 'http://support.tidepool.org/article/6-how-to-install-or-upgrade-the-tidepool-uploader-gen',
  HOW_TO_SHARE_DATA_KB_ARTICLE: 'http://support.tidepool.org/article/16-share-your-data',
  HOW_TO_CREATE_CLINICIAN_ACCOUNT_KB_ARTICLE: 'https://support.tidepool.org/hc/en-us/articles/9159893429908-Creating-a-new-Clinic-account',
};
