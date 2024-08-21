import * as types from './actionTypes';

export default (type) => {
  switch (type) {
    case types.FETCH_ASSOCIATED_ACCOUNTS_REQUEST:
    case types.FETCH_ASSOCIATED_ACCOUNTS_SUCCESS:
    case types.FETCH_ASSOCIATED_ACCOUNTS_FAILURE:
      return 'fetchingAssociatedAccounts';

    case types.FETCH_PATIENT_REQUEST:
    case types.FETCH_PATIENT_SUCCESS:
    case types.FETCH_PATIENT_FAILURE:
      return 'fetchingPatient';

    case types.LOGOUT_REQUEST:
    case types.LOGOUT_SUCCESS:
    case types.LOGOUT_FAILURE:
      return 'loggingOut';

    case types.LOGIN_REQUEST:
    case types.LOGIN_SUCCESS:
    case types.LOGIN_FAILURE:
      return 'loggingIn';

    case types.CREATE_CUSTODIAL_ACCOUNT_REQUEST:
    case types.CREATE_CUSTODIAL_ACCOUNT_SUCCESS:
    case types.CREATE_CUSTODIAL_ACCOUNT_FAILURE:
    case types.DISMISS_CREATE_CUSTODIAL_ACCOUNT_ERROR:
      return 'creatingCustodialAccount';

    case types.CREATE_CLINIC_CUSTODIAL_ACCOUNT_REQUEST:
    case types.CREATE_CLINIC_CUSTODIAL_ACCOUNT_SUCCESS:
    case types.CREATE_CLINIC_CUSTODIAL_ACCOUNT_FAILURE:
      return 'creatingClinicCustodialAccount';

    case types.UPDATE_PROFILE_REQUEST:
    case types.UPDATE_PROFILE_SUCCESS:
    case types.UPDATE_PROFILE_FAILURE:
    case types.DISMISS_UPDATE_PROFILE_ERROR:
      return 'updatingProfile';

    case types.FETCH_PATIENTS_FOR_CLINIC_REQUEST:
    case types.FETCH_PATIENTS_FOR_CLINIC_SUCCESS:
    case types.FETCH_PATIENTS_FOR_CLINIC_FAILURE:
      return 'fetchingPatientsForClinic';

    case types.UPDATE_CLINIC_PATIENT_REQUEST:
    case types.UPDATE_CLINIC_PATIENT_SUCCESS:
    case types.UPDATE_CLINIC_PATIENT_FAILURE:
      return 'updatingClinicPatient';

    case types.GET_CLINICS_FOR_CLINICIAN_REQUEST:
    case types.GET_CLINICS_FOR_CLINICIAN_SUCCESS:
    case types.GET_CLINICS_FOR_CLINICIAN_FAILURE:
      return 'fetchingClinicsForClinician';

    case types.FETCH_CLINIC_MRN_SETTINGS_REQUEST:
    case types.FETCH_CLINIC_MRN_SETTINGS_SUCCESS:
    case types.FETCH_CLINIC_MRN_SETTINGS_FAILURE:
      return 'fetchingClinicMRNSettings';

    case types.FETCH_CLINIC_EHR_SETTINGS_REQUEST:
    case types.FETCH_CLINIC_EHR_SETTINGS_SUCCESS:
    case types.FETCH_CLINIC_EHR_SETTINGS_FAILURE:
      return 'fetchingClinicEHRSettings';

    case types.FETCH_CLINIC_PATIENT_COUNT_REQUEST:
    case types.FETCH_CLINIC_PATIENT_COUNT_SUCCESS:
    case types.FETCH_CLINIC_PATIENT_COUNT_FAILURE:
      return 'fetchingClinicPatientCount';

    case types.FETCH_CLINIC_PATIENT_COUNT_SETTINGS_REQUEST:
    case types.FETCH_CLINIC_PATIENT_COUNT_SETTINGS_SUCCESS:
    case types.FETCH_CLINIC_PATIENT_COUNT_SETTINGS_FAILURE:
      return 'fetchingClinicPatientCountSettings';

    case types.AUTO_UPDATE_CHECKING_FOR_UPDATES:
    case types.MANUAL_UPDATE_CHECKING_FOR_UPDATES:
    case types.UPDATE_AVAILABLE:
    case types.UPDATE_NOT_AVAILABLE:
    case types.AUTOUPDATE_ERROR:
      return 'checkingElectronUpdate';

    case types.UPLOAD_REQUEST:
    case types.READ_FILE_ABORTED:
    case types.READ_FILE_FAILURE:
    case types.UPLOAD_FAILURE:
    case types.UPLOAD_SUCCESS:
    case types.UPLOAD_CANCELLED:
      return 'uploading';

    case types.INIT_APP_FAILURE:
    case types.INIT_APP_SUCCESS:
    case types.INIT_APP_REQUEST:
      return 'initializingApp';

    case types.VERSION_CHECK_FAILURE:
    case types.VERSION_CHECK_SUCCESS:
    case types.VERSION_CHECK_REQUEST:
      return 'checkingVersion';

    case types.FETCH_INFO_REQUEST:
    case types.FETCH_INFO_SUCCESS:
    case types.FETCH_INFO_FAILURE:
      return 'fetchingInfo';

    default:
      return null;
  }
};
