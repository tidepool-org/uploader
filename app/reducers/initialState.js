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

import _ from 'lodash';

const working = {
  inProgress: false,
  notification: null,
  completed: null,
};

const initialState = {
  isLoggedIn: false,
  loggedInUserId: null,
  targetUserId: null,
  allUsers: {},
  working: {
    fetchingPatient: Object.assign({}, working),
    fetchingAssociatedAccounts: Object.assign({}, working),
    loggingIn: Object.assign({}, working),
    loggingOut: Object.assign({}, working),
    creatingCustodialAccount: Object.assign({}, working),
    creatingClinicCustodialAccount: Object.assign({}, working),
    initializingApp: Object.assign({}, working, {inProgress:true}),
    checkingVersion: Object.assign({}, working),
    uploading: Object.assign({}, working),
    checkingElectronUpdate: Object.assign({}, working),
    checkingDriverUpdate: Object.assign({}, working),
    fetchingClinicsForClinician: Object.assign({}, working),
    updatingClinicPatient: Object.assign({}, working),
    fetchingPatientsForClinic: Object.assign({}, working),
    updatingProfile: Object.assign({}, working),
    fetchingInfo: Object.assign({}, working),
  },
  notification: null,
  dataDonationAccounts: [],
  clinics: {},
  selectedClinicId: null,
  dropdown: false,
  os: null,
  unsupported: true,
  blipUrls: {},
  electronUpdateManualChecked: null,
  electronUpdateAvailableDismissed: null,
  electronUpdateAvailable: null,
  electronUpdateDownloaded: null,
  driverUpdateAvailable: null,
  driverUpdateAvailableDismissed: null,
  driverUpdateShellOpts: null,
  driverUpdateComplete: null,
  showingDeviceTimePrompt: null,
  isTimezoneFocused: false,
  showingAdHocPairingDialog: false,
  keycloakConfig: {},
};

export default initialState;
