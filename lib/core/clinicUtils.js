/* eslint-disable global-require */
/* eslint-disable import/no-extraneous-dependencies */
import React from 'react';
import * as yup from 'yup';
import get from 'lodash/get';
import includes from 'lodash/includes';
import keys from 'lodash/keys';
import map from 'lodash/map';
import moment from 'moment';
import countries from 'i18n-iso-countries';
import env from '../../app/utils/env';

import postalCodes from './validation/postalCodes';
import states from './validation/states';

import {
  URL_TIDEPOOL_PLUS_PLANS,
  URL_TIDEPOOL_PLUS_CONTACT_SALES,
  CLINIC_REMAINING_PATIENTS_WARNING_THRESHOLD,
  DEFAULT_CLINIC_TIER,
  DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT,
  MGDL_UNITS,
  MMOLL_UNITS,
} from '../../app/constants/otherConstants';

let t;
if (env.electron_renderer) {
  const remote = require('@electron/remote');
  const i18n = remote.getGlobal('i18n');
  t = i18n.t.bind(i18n);
} else {
  let i18n = require('i18next');

  if (i18n.default) {
    i18n = i18n.default;
  }

  t = i18n.t.bind(i18n);
}

yup.setLocale({
  mixed: {
    notType: ({ type }) => {
      let msg = t(`Please enter a valid ${type}`);

      if (type === 'date') {
        msg += t(' in the requested format');
      }

      return msg;
    },
  },
});

export const dateFormat = 'YYYY-MM-DD';
export const dateRegex = /^(.*)[-|/](.*)[-|/](.*)$/;

export const roles = [
  { value: 'clinic_manager', label: t('Clinic Manager') },
  { value: 'diabetes_educator', label: t('Diabetes Educator') },
  { value: 'dietician', label: t('Dietician') },
  { value: 'endocrinologist', label: t('Endocrinologist') },
  { value: 'front_desk', label: t('Front Desk') },
  { value: 'health_student', label: t('Health Professions Student') },
  { value: 'information_technology', label: t('IT/Technology') },
  { value: 'medical_assistant', label: t('Medical Assistant') },
  { value: 'nurse', label: t('Nurse/Nurse Practitioner') },
  { value: 'primary_care_physician', label: t('Primary Care Physician') },
  { value: 'physician_assistant', label: t('Physician Assistant') },
  { value: 'pharmacist', label: t('Pharmacist') },
  { value: 'other', label: t('Other') },
];

export const clinicTypes = [
  { value: 'provider_practice', label: t('Provider Practice') },
  { value: 'healthcare_system', label: t('Healthcare System') },
  { value: 'veterinary_clinic', label: t('Veterinary Clinic') },
  { value: 'researcher', label: t('Research Organization') },
  { value: 'other', label: t('Other') },
];

export const preferredBgUnits = [
  { value: MGDL_UNITS, label: MGDL_UNITS },
  { value: MMOLL_UNITS, label: MMOLL_UNITS },
];

export const lastUploadDateFilterOptions = [
  { value: 1, label: t('Today') },
  { value: 2, label: t('Last 2 days') },
  { value: 7, label: t('Last 7 days') },
  { value: 14, label: t('Last 14 days') },
  { value: 30, label: t('Last 30 days') },
];

export const summaryPeriodOptions = [
  { value: '1d', label: t('24 hours') },
  { value: '7d', label: t('7 days') },
  { value: '14d', label: t('14 days') },
  { value: '30d', label: t('30 days') },
];

export const maxClinicPatientTags = 50;

export const clinicPlansNames = {
  base: t('Base'),
  activeSalesBase: t('Base'),
  honoredBase: t('Base'),
  internationalBase: t('Base'),
  essential: t('Essential'),
  professional: t('Professional'),
  enterprise: t('Enterprise'),
};

export const clinicTierDetails = (clinic = {}) => {
  const {
    tier = DEFAULT_CLINIC_TIER,
    country,
    patientCountSettings = {},
  } = clinic;

  const hardLimit = patientCountSettings?.hardLimit;
  const hardLimitStartDate = patientCountSettings?.hardLimit?.startDate;
  const hardLimitStartDateIsFuture = hardLimitStartDate && moment(hardLimitStartDate).isValid() && moment(hardLimitStartDate).isAfter();
  const isBaseTier = tier.indexOf('tier01') === 0;
  let activeTier = tier;

  // Handle various base tier clinic states
  if (isBaseTier) {
    const isOUS = country !== 'US';
    const isInActiveSalesConversation = !isOUS && !hardLimit;
    const isHonoredBaseClinic = !isOUS && hardLimitStartDateIsFuture;

    if (isOUS) {
      // Ensure OUS clinics render as international plan
      activeTier = 'tier0101';
    } else if (isInActiveSalesConversation) {
      // Ensure clinics in active sales conversations render as activeSalesBase plan
      activeTier = 'tier0103';
    } else if (isHonoredBaseClinic) {
      // Ensure Honored Base clinics render as hononored plan
      activeTier = 'tier0102';
    }
  }

  const entitlements = {
    rpmReport: false,
    summaryDashboard: false,
    tideDashboard: false,
    patientTags: false,
  };

  const display = {
    planName: true,
    patientCount: true,
    patientLimit: false,
    workspacePlan: false,
    workspaceLimitDescription: false,
    workspaceLimitFeedback: false,
    workspaceLimitResolutionLink: false,
  };

  const details = {
    patientLimitEnforced: false,
    display,
    entitlements,
  };

  const tierSpecificOverrides = {
    tier0100: {
      planName: 'base',
      patientLimitEnforced: true,
      display: { ...display, patientLimit: true, workspacePlan: true },
    },
    tier0101: {
      planName: 'internationalBase',
      display: { ...display, planName: false },
    },
    tier0102: {
      planName: 'honoredBase',
      display: { ...display, workspacePlan: true },
    },
    tier0103: {
      planName: 'activeSalesBase',
      display: { ...display, workspacePlan: true },
    },
    tier0200: {
      planName: 'essential',
    },
    tier0201: {
      planName: 'essential',
      entitlements: { ...entitlements, patientTags: true, summaryDashboard: true },
    },
    tier0202: {
      planName: 'professional',
      entitlements: { ...entitlements, patientTags: true, summaryDashboard: true },
    },
    tier0300: {
      planName: 'professional',
      entitlements: { ...entitlements, patientTags: true, summaryDashboard: true },
    },
    tier0301: {
      planName: 'professional',
      entitlements: {
        rpmReport: true, patientTags: true, summaryDashboard: true, tideDashboard: true,
      },
    },
    tier0302: {
      planName: 'professional',
      entitlements: {
        ...entitlements, rpmReport: true, patientTags: true, summaryDashboard: true,
      },
    },
    tier0303: {
      planName: 'professional',
      entitlements: {
        rpmReport: true, patientTags: true, summaryDashboard: true, tideDashboard: true,
      },
    },
    tier0400: {
      planName: 'enterprise',
      entitlements: {
        rpmReport: true, patientTags: true, summaryDashboard: true, tideDashboard: true,
      },
    },
  };

  return {
    ...details,
    ...tierSpecificOverrides[activeTier],
  };
};

export const clinicUIDetails = (clinic = {}) => {
  const { display, ...tierDetails } = clinicTierDetails(clinic);
  const { patientCount, patientCountSettings } = clinic;
  const patientCountHardLimit = patientCountSettings?.hardLimit?.patientCount;
  const isBase = tierDetails.planName === 'base';
  const isHonoredBase = tierDetails.planName === 'honoredBase';
  const isActiveSalesBase = tierDetails.planName === 'activeSalesBase';

  const warnings = {
    limitReached: false,
    limitApproaching: false,
  };

  const limit = patientCountHardLimit || DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT;

  if (tierDetails.patientLimitEnforced || isHonoredBase) {
    warnings.limitReached = tierDetails.patientLimitEnforced && patientCount >= limit;
    warnings.limitApproaching = limit - patientCount <= CLINIC_REMAINING_PATIENTS_WARNING_THRESHOLD;
  }

  let limitDescription;
  let limitFeedback;
  let limitResolutionLink;
  const contactUsText = t('Contact us to unlock plans');
  const unlockPlansText = t('Unlock plans');

  if (isBase) {
    limitDescription = t('Limited to {{limit}} patients', { limit });

    limitFeedback = {
      text: t('Maximum of {{limit}} patient accounts reached', { limit }),
      status: 'warning',
    };

    limitResolutionLink = {
      text: warnings.limitReached ? contactUsText : unlockPlansText,
      url: warnings.limitReached ? URL_TIDEPOOL_PLUS_CONTACT_SALES : URL_TIDEPOOL_PLUS_PLANS,
    };

    display.workspaceLimitResolutionLink = true;

    if (warnings.limitReached) {
      display.workspaceLimitFeedback = true;
    } else {
      display.workspaceLimitDescription = true;
    }
  }

  if (isHonoredBase) {
    const hardLimitStartDate = patientCountSettings?.hardLimit?.startDate;
    limitDescription = t('Please note that starting on {{ date }}, Base Plans will support up to {{limit}} patient accounts.', {
      date: moment(hardLimitStartDate).format('MMM D, YYYY'),
      limit,
    });

    limitFeedback = {
      text: t('Please take action now to avoid disruptions'),
      status: 'warning',
    };

    limitResolutionLink = {
      text: warnings.limitApproaching ? contactUsText : unlockPlansText,
      url: warnings.limitApproaching ? URL_TIDEPOOL_PLUS_CONTACT_SALES : URL_TIDEPOOL_PLUS_PLANS,
    };

    display.workspaceLimitResolutionLink = true;
    display.workspaceLimitDescription = true;
    display.workspaceLimitFeedback = warnings.limitApproaching;
  }

  if (isActiveSalesBase) {
    limitDescription = t('Limited to {{limit}} patients', { limit });

    limitFeedback = {
      text: t('Change to plan in progress'),
      status: 'success',
    };

    limitResolutionLink = {
      text: unlockPlansText,
      url: URL_TIDEPOOL_PLUS_PLANS,
    };

    display.workspaceLimitResolutionLink = true;
    display.workspaceLimitDescription = true;
    display.workspaceLimitFeedback = true;
  }

  const details = {
    ...tierDetails,
    ui: {
      display,
      text: {
        planDisplayName: clinicPlansNames[tierDetails.planName],
        limitDescription,
        limitFeedback,
        limitResolutionLink,
      },
      warnings,
    },
  };

  return details;
};

export const clinicValuesFromClinic = (clinic) => ({
  name: get(clinic, 'name', ''),
  address: get(clinic, 'address', ''),
  city: get(clinic, 'city', ''),
  state: get(clinic, 'state', ''),
  postalCode: get(clinic, 'postalCode', ''),
  country: get(clinic, 'country', 'US'),
  clinicType: get(clinic, 'clinicType', ''),
  preferredBgUnits: get(clinic, 'preferredBgUnits', ''),
  website: get(clinic, 'website', ''),
  ...(get(clinic, 'timezone')) && { timezone: clinic.timezone },
});

export const clinicSchema = yup.object().shape({
  name: yup.string().required(t('Please enter an organization name')),
  address: yup.string().required(t('Please enter an address')),
  city: yup.string().required(t('Please enter a city')),
  country: yup
    .string()
    .oneOf(keys(countries.getAlpha2Codes()))
    .required(t('Please enter a country')),
  state: yup
    .string()
    .required(t('Please enter a state'))
    .when('country', (country, schema) => (!includes(keys(states), country)
      ? schema.required(t('Please enter a state'))
      : schema.oneOf(keys(states[country]), t('Please enter a valid state')))),
  postalCode: yup
    .string()
    .required(t('Please enter a zip/postal code'))
    .when('country', (country, schema) => (!includes(keys(postalCodes), country)
      ? schema.required(t('Please enter a zip/postal code'))
      : schema.matches(postalCodes[country], t('Please enter a valid zip/postal code')))),
  clinicType: yup
    .string()
    .oneOf(map(clinicTypes, 'value'))
    .required(t('Please select a clinic type')),
  preferredBgUnits: yup
    .string()
    .oneOf(map(preferredBgUnits, 'value'))
    .required(t('Please select your preferred BG units')),
  website: yup
    .string()
    .url(({ value }) => (/^https?:\/\//.test(value)
      ? t('Please enter a valid website address')
      : t('Please enter a valid website address with https:// at the beginning'))),
  timezone: yup.string(),
});

export const clinicPatientTagSchema = yup.object().shape({
  name: yup.string()
    // eslint-disable-next-line no-template-curly-in-string
    .max(20, t('Tag name max length is ${max} characters'))
    .matches(/^[\p{L}\p{N}_+><-]{1}[\p{L}\p{N}\s_+><-]*$/u, t('Allowed special characters: - _ + > <')),
});

/**
 * yup schema for patient form
 * @function patientSchema
 * @param {Object} [config]
 * @param {Array} [config.existingMRNs] - array of existing MRNs to check against
 * @param {Object} [config.mrnSettings]
 * @param {boolean} [config.mrnSettings.required] - whether or not the MRN field is required
 * @returns {Object} yup schema
 *
 * @example
 * import { patientSchema } from 'core/clinicUtils';
 *
 * const schema = patientSchema({ mrnSettings:{ required: true } });
 *
 */
export const patientSchema = (config) => {
  let mrnSchema = yup
    .string()
    .matches(/^$|^[A-Z0-9]{4,25}$/, () => (
      // eslint-disable-next-line react/jsx-filename-extension
      <div>
        {t('Patient\'s MRN is invalid. MRN must meet the following criteria:')}
        <ul>
          <li>{t('All upper case letters or numbers')}</li>
          <li>{t('Minimum length: 4 characters')}</li>
          <li>{t('Maximum length: 25 characters')}</li>
          <li>{t('No spaces')}</li>
        </ul>
      </div>
    ))
    .notOneOf(config?.existingMRNs || [], t('This MRN is already in use. Please enter a valid MRN.'));

  if (config?.mrnSettings?.required) {
    mrnSchema = mrnSchema.required(t('Patient\'s MRN is required'));
  }

  return yup.object().shape({
    fullName: yup.string().required(t('Please enter the patient\'s full name')),
    birthDate: yup.date()
      .transform((value, originalValue) => {
        // eslint-disable-next-line no-param-reassign
        value = moment(originalValue, dateFormat, true);
        return value.isValid() ? value.toDate() : new Date('');
      })
      .min(moment().subtract(130, 'years').format(dateFormat), t('Please enter a date within the last 130 years'))
      .max(moment().subtract(1, 'day').format(dateFormat), t('Please enter a date prior to today'))
      .required(t('Patient\'s birthday is required')),
    mrn: mrnSchema,
    email: yup.string().email(t('Please enter a valid email address')),
    connectDexcom: yup.boolean(),
    dataSources: yup.array().of(
      yup.object().shape({
        providerName: yup.string(),
        state: yup.string().oneOf(['pending', 'pendingReconnect', 'connected', 'error', 'disconnected']),
      }),
    ),
    tags: yup.array().of(
      yup.string(),
    ),
  });
};

export const tideDashboardConfigSchema = yup.object().shape({
  period: yup
    .string()
    .oneOf(map(summaryPeriodOptions, 'value'))
    .required(t('Please select a duration period')),
  lastUpload: yup
    .number()
    .oneOf(map(lastUploadDateFilterOptions, 'value'))
    .required(t('Please select a last upload date option')),
  tags: yup.array().of(yup.string())
    .min(1, t('Please select at least one tag')),
});
