import moment from 'moment';
import * as clinicUtils from '../../../lib/core/clinicUtils';
import { CLINIC_REMAINING_PATIENTS_WARNING_THRESHOLD, DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT, URL_TIDEPOOL_PLUS_CONTACT_SALES, URL_TIDEPOOL_PLUS_PLANS } from '../../../app/constants/otherConstants';

/* global chai */
/* global sinon */
/* global describe */
/* global it */
/* global beforeEach */

import { expect } from 'chai';

describe('clinicUtils', function() {
  it('should return all roles options', () => {
    expect(clinicUtils.roles).to.eql([
      { value: 'clinic_manager', label: 'Clinic Manager' },
      { value: 'diabetes_educator', label: 'Diabetes Educator' },
      { value: 'dietician', label: 'Dietician' },
      { value: 'endocrinologist', label: 'Endocrinologist' },
      { value: 'front_desk', label: 'Front Desk' },
      { value: 'health_student', label: 'Health Professions Student' },
      { value: 'information_technology', label: 'IT/Technology' },
      { value: 'medical_assistant', label: 'Medical Assistant' },
      { value: 'nurse', label: 'Nurse/Nurse Practitioner' },
      { value: 'primary_care_physician', label: 'Primary Care Physician' },
      { value: 'physician_assistant', label: 'Physician Assistant' },
      { value: 'pharmacist', label: 'Pharmacist' },
      { value: 'other', label: 'Other' },
    ]);
  });

  it('should export the `dateFormat`', function() {
    expect(clinicUtils.dateFormat).to.equal('YYYY-MM-DD');
  });

  it('should export the `dateRegex`', function() {
    expect(clinicUtils.dateRegex).to.eql(/^(.*)[-|/](.*)[-|/](.*)$/);
  });

  it('should export the `maxClinicPatientTags`', function() {
    expect(clinicUtils.maxClinicPatientTags).to.equal(50);
  });

  it('should return all clinicTypes options', () => {
    expect(clinicUtils.clinicTypes).to.eql([
      { value: 'provider_practice', label: 'Provider Practice' },
      { value: 'healthcare_system', label: 'Healthcare System' },
      { value: 'veterinary_clinic', label: 'Veterinary Clinic' },
      { value: 'researcher', label: 'Research Organization' },
      { value: 'other', label: 'Other' },
    ]);
  });

  it('should return all preferredBgUnits options', () => {
    expect(clinicUtils.preferredBgUnits).to.eql([
      { value: 'mg/dL', label: 'mg/dL' },
      { value: 'mmol/L', label: 'mmol/L' },
    ]);
  });

  it('should return all lastUploadDateFilterOptions options', () => {
    expect(clinicUtils.lastUploadDateFilterOptions).to.eql([
      { value: 1, label: 'Today' },
      { value: 2, label: 'Last 2 days' },
      { value: 7, label: 'Last 7 days' },
      { value: 14, label: 'Last 14 days' },
      { value: 30, label: 'Last 30 days' },
    ]);
  });

  it('should return all summaryPeriodOptions options', () => {
    expect(clinicUtils.summaryPeriodOptions).to.eql([
      { value: '1d', label: '24 hours' },
      { value: '7d', label: '7 days' },
      { value: '14d', label: '14 days' },
      { value: '30d', label: '30 days' },
    ]);
  });

  describe('clinicTierDetails', () => {
    let createClinic;

    beforeEach(() => {
      createClinic = clinicOverrides => ({
        country: 'US',
        patientCountSettings: {},
        ...clinicOverrides,
      });
    });

    it('should set appropriate details for a tier0100 clinic that has a patient count hard limit and no start date', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({
        tier: 'tier0100',
        patientCountSettings: { hardLimit: { patientCount: DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT } }
      }));

      expect(details.planName).to.equal('base');
      expect(details.patientLimitEnforced).to.equal(true);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: true,
        workspacePlan: true,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: false,
        rpmReport: false,
        summaryDashboard: false,
        tideDashboard: false,
      });
    });

    it('should set appropriate details for a tier0100 clinic that has a patient count hard limit start date in the past', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({
        tier: 'tier0100',
        patientCountSettings: { hardLimit: { patientCount: DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT, startDate: moment().subtract(1, 'day').toISOString() } }
      }));

      expect(details.planName).to.equal('base');
      expect(details.patientLimitEnforced).to.equal(true);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: true,
        workspacePlan: true,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: false,
        rpmReport: false,
        summaryDashboard: false,
        tideDashboard: false,
      });
    });

    it('should set appropriate details for a tier0100 clinic that has a patient count hard limit start date in the future', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({
        tier: 'tier0100',
        patientCountSettings: { hardLimit: { patientCount: DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT, startDate: moment().add(1, 'day').toISOString() } }
      }));

      expect(details.planName).to.equal('honoredBase');
      expect(details.patientLimitEnforced).to.equal(false);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: false,
        workspacePlan: true,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: false,
        rpmReport: false,
        summaryDashboard: false,
        tideDashboard: false,
      });
    });

    it('should set appropriate details for a tier0100 clinic that is OUS', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({
        tier: 'tier0100',
        country: 'CA',
      }));

      expect(details.planName).to.equal('internationalBase');
      expect(details.patientLimitEnforced).to.equal(false);

      expect(details.display).to.eql({
        planName: false,
        patientCount: true,
        patientLimit: false,
        workspacePlan: false,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: false,
        rpmReport: false,
        summaryDashboard: false,
        tideDashboard: false,
      });
    });

    it('should set appropriate details for a tier0100 clinic that is has a limit but is in active sales conversations', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({
        tier: 'tier0100',
        patientCountSettings: {}, // no hard or soft limits for a tier0100 denotes active sales convos
      }));

      expect(details.planName).to.equal('activeSalesBase');
      expect(details.patientLimitEnforced).to.equal(false);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: false,
        workspacePlan: true,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: false,
        rpmReport: false,
        summaryDashboard: false,
        tideDashboard: false,
      });
    });

    it('should set appropriate details for a tier0200 clinic', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({ tier: 'tier0200' }));
      expect(details.planName).to.equal('essential');
      expect(details.patientLimitEnforced).to.equal(false);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: false,
        workspacePlan: false,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: false,
        rpmReport: false,
        summaryDashboard: false,
        tideDashboard: false,
      });
    });

    it('should set appropriate details for a tier0201 clinic', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({ tier: 'tier0201' }));
      expect(details.planName).to.equal('essential');
      expect(details.patientLimitEnforced).to.equal(false);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: false,
        workspacePlan: false,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: true,
        rpmReport: false,
        summaryDashboard: true,
        tideDashboard: false,
      });
    });

    it('should set appropriate details for a tier0202 clinic', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({ tier: 'tier0202' }));
      expect(details.planName).to.equal('professional');
      expect(details.patientLimitEnforced).to.equal(false);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: false,
        workspacePlan: false,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: true,
        rpmReport: false,
        summaryDashboard: true,
        tideDashboard: false,
      });
    });

    it('should set appropriate details for a tier0300 clinic', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({ tier: 'tier0300' }));
      expect(details.planName).to.equal('professional');
      expect(details.patientLimitEnforced).to.equal(false);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: false,
        workspacePlan: false,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: true,
        rpmReport: false,
        summaryDashboard: true,
        tideDashboard: false,
      });
    });

    it('should set appropriate details for a tier0301 clinic', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({ tier: 'tier0301' }));
      expect(details.planName).to.equal('professional');
      expect(details.patientLimitEnforced).to.equal(false);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: false,
        workspacePlan: false,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: true,
        rpmReport: true,
        summaryDashboard: true,
        tideDashboard: true,
      });
    });

    it('should set appropriate details for a tier0302 clinic', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({ tier: 'tier0302' }));
      expect(details.planName).to.equal('professional');
      expect(details.patientLimitEnforced).to.equal(false);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: false,
        workspacePlan: false,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: true,
        rpmReport: true,
        summaryDashboard: true,
        tideDashboard: false,
      });
    });

    it('should set appropriate details for a tier0303 clinic', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({ tier: 'tier0303' }));
      expect(details.planName).to.equal('professional');
      expect(details.patientLimitEnforced).to.equal(false);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: false,
        workspacePlan: false,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: true,
        rpmReport: true,
        summaryDashboard: true,
        tideDashboard: true,
      });
    });

    it('should set appropriate details for a tier0400 clinic', () => {
      const details = clinicUtils.clinicTierDetails(createClinic({ tier: 'tier0400' }));
      expect(details.planName).to.equal('enterprise');
      expect(details.patientLimitEnforced).to.equal(false);

      expect(details.display).to.eql({
        planName: true,
        patientCount: true,
        patientLimit: false,
        workspacePlan: false,
        workspaceLimitDescription: false,
        workspaceLimitFeedback: false,
        workspaceLimitResolutionLink: false,
      });

      expect(details.entitlements).to.eql({
        patientTags: true,
        rpmReport: true,
        summaryDashboard: true,
        tideDashboard: true,
      });
    });
  });

  describe('clinicUIDetails', () => {let createClinic;
    beforeEach(() => {
      createClinic = clinicOverrides => ({
        country: 'US',
        patientCountSettings: {},
        ...clinicOverrides,
      });
    });

    it('should add warnings if patientLimitEnforced is true and limit is approaching or reached', () => {
      const underWarningThreshold = clinicUtils.clinicUIDetails(createClinic({
        tier: 'tier0100',
        patientCount: DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT - CLINIC_REMAINING_PATIENTS_WARNING_THRESHOLD - 1,
        patientCountSettings: { hardLimit: { patientCount: DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT, startDate: moment().subtract(1, 'day').toISOString() } }
      }));

      expect(underWarningThreshold.ui.warnings).to.eql({
        limitReached: false,
        limitApproaching: false,
      });

      const atWarningThreshold = clinicUtils.clinicUIDetails(createClinic({
        tier: 'tier0100',
        patientCount: DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT - CLINIC_REMAINING_PATIENTS_WARNING_THRESHOLD,
        patientCountSettings: { hardLimit: { patientCount: DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT, startDate: moment().subtract(1, 'day').toISOString() } }
      }));

      expect(atWarningThreshold.ui.warnings).to.eql({
        limitReached: false,
        limitApproaching: true,
      });

      const atLimit = clinicUtils.clinicUIDetails(createClinic({
        tier: 'tier0100',
        patientCount: DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT,
        patientCountSettings: { hardLimit: { patientCount: DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT, startDate: moment().subtract(1, 'day').toISOString() } }
      }));

      expect(atLimit.ui.warnings).to.eql({
        limitReached: true,
        limitApproaching: true,
      });
    });

    it('should add text appropriate to the workspace plan', () => {
      const base = clinicUtils.clinicUIDetails(createClinic({
        tier: 'tier0100',
        patientCount: 1,
        patientCountSettings: {
          hardLimit: {
            startDate: moment().subtract(1, 'day').toISOString(),
          },
        },
      }));

      expect(base.ui.text).to.eql({
        planDisplayName: 'Base',
        limitDescription: `Limited to ${DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT} patients`,
        limitFeedback: {
          status: 'warning',
          text: `Maximum of ${DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT} patient accounts reached`,
        },
        limitResolutionLink: {
          text: 'Unlock plans',
          url: URL_TIDEPOOL_PLUS_PLANS,
        },
      });

      const baseLimitReached = clinicUtils.clinicUIDetails(createClinic({
        tier: 'tier0100',
        patientCount: DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT,
        patientCountSettings: {
          hardLimit: {
            startDate: moment().subtract(1, 'day').toISOString(),
          },
        },
      }));

      expect(baseLimitReached.ui.text).to.eql({
        planDisplayName: 'Base',
        limitDescription: `Limited to ${DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT} patients`,
        limitFeedback: {
          status: 'warning',
          text: `Maximum of ${DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT} patient accounts reached`,
        },
        limitResolutionLink: {
          text: 'Contact us to unlock plans',
          url: URL_TIDEPOOL_PLUS_CONTACT_SALES,
        },
      });

      const startDate = moment().add(1, 'day').toISOString();

      const honored = clinicUtils.clinicUIDetails(createClinic({
        tier: 'tier0100',
        patientCount: 1,
        patientCountSettings: {
          hardLimit: {
            startDate,
          },
        },
      }));

      expect(honored.ui.text).to.eql({
        planDisplayName: 'Base',
        limitDescription: `Please note that starting on ${moment(startDate).format('MMM D, YYYY')}, Base Plans will support up to 250 patient accounts.`,
        limitFeedback: {
          status: 'warning',
          text: 'Please take action now to avoid disruptions',
        },
        limitResolutionLink: {
          text: 'Unlock plans',
          url: URL_TIDEPOOL_PLUS_PLANS,
        },
      });

      const honoredLimitApproaching = clinicUtils.clinicUIDetails(createClinic({
        tier: 'tier0100',
        patientCount: DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT - CLINIC_REMAINING_PATIENTS_WARNING_THRESHOLD,
        patientCountSettings: {
          hardLimit: {
            startDate,
          },
        },
      }));

      expect(honoredLimitApproaching.ui.text).to.eql({
        planDisplayName: 'Base',
        limitDescription: `Please note that starting on ${moment(startDate).format('MMM D, YYYY')}, Base Plans will support up to 250 patient accounts.`,
        limitFeedback: {
          status: 'warning',
          text: 'Please take action now to avoid disruptions',
        },
        limitResolutionLink: {
          text: 'Contact us to unlock plans',
          url: URL_TIDEPOOL_PLUS_CONTACT_SALES,
        },
      });

      const activeSales = clinicUtils.clinicUIDetails(createClinic({
        tier: 'tier0100',
      }));

      expect(activeSales.ui.text).to.eql({
        planDisplayName: 'Base',
        limitDescription: `Limited to ${DEFAULT_CLINIC_PATIENT_COUNT_HARD_LIMIT} patients`,
        limitFeedback: {
          status: 'success',
          text: 'Change to plan in progress',
        },
        limitResolutionLink: {
          text: 'Unlock plans',
          url: URL_TIDEPOOL_PLUS_PLANS,
        },
      });

      const essential = clinicUtils.clinicUIDetails(createClinic({
        tier: 'tier0200',
      }));

      expect(essential.ui.text).to.eql({
        planDisplayName: 'Essential',
        limitDescription: undefined,
        limitFeedback: undefined,
        limitResolutionLink: undefined,
      });

      const professional = clinicUtils.clinicUIDetails(createClinic({
        tier: 'tier0300',
      }));

      expect(professional.ui.text).to.eql({
        planDisplayName: 'Professional',
        limitDescription: undefined,
        limitFeedback: undefined,
        limitResolutionLink: undefined,
      });

      const enterprise = clinicUtils.clinicUIDetails(createClinic({
        tier: 'tier0400',
      }));

      expect(enterprise.ui.text).to.eql({
        planDisplayName: 'Enterprise',
        limitDescription: undefined,
        limitFeedback: undefined,
        limitResolutionLink: undefined,
      });
    });
  });

  describe('clinicValuesFromClinic', () => {
    it('should return default values for any missing clinic fields', () => {
      const emptyClinic = {};
      expect(clinicUtils.clinicValuesFromClinic(emptyClinic)).to.eql({
        name: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        clinicType: '',
        website: '',
        preferredBgUnits: '',
      });
    });

    it('should return existing fields values from the provided clinic', () => {
      const clinic = {
        name: 'Clinic 1',
        address: '253 MyStreet',
        city: 'MyTown',
        state: 'NB',
        postalCode: '12345',
        country: 'US',
        clinicType: 'provider_practice',
        website: 'http://mysite.com',
        preferredBgUnits: 'mmol/L',
        timezone: 'America/Los_Angeles',
      };

      expect(clinicUtils.clinicValuesFromClinic(clinic)).to.eql(clinic);
    });
  });

  describe('clinicSchema', () => {
    it('should return a yup schema for clinic fields', () => {
      expect(clinicUtils.clinicSchema).to.be.an('object');

      expect(clinicUtils.clinicSchema._nodes).to.be.an('array').and.have.members([
        'name',
        'address',
        'city',
        'state',
        'postalCode',
        'country',
        'clinicType',
        'website',
        'preferredBgUnits',
        'timezone',
      ]);
    });
  });

  describe('patientSchema', () => {
    it('should return a yup schema for clinic fields', () => {
      expect(clinicUtils.patientSchema()).to.be.an('object');

      expect(clinicUtils.patientSchema()._nodes).to.be.an('array').and.have.members([
        'fullName',
        'birthDate',
        'email',
        'mrn',
        'tags',
        'connectDexcom',
        'dataSources',
      ]);
    });

    it('should set mrn required when mrnSettings specify required', () => {
      let defaultSchema = clinicUtils.patientSchema().describe();
      let requiredSchema = clinicUtils.patientSchema({ mrnSettings: { required: true } }).describe();
      expect(defaultSchema.fields.mrn.tests).to.be.an('array').and.have.length(1);
      expect(requiredSchema.fields.mrn.tests).to.be.an('array').and.have.length(2);
      expect(requiredSchema.fields.mrn.tests[1].name).to.equal('required');
    });

    it('should set uniqueness restriction for mrn when provided with existing mrns', () => {
      let existingMRNs = ['123456', '123457'];
      let defaultSchema = clinicUtils.patientSchema().describe();
      let schema = clinicUtils.patientSchema({ existingMRNs }).describe();
      expect(defaultSchema.fields.mrn.notOneOf).to.be.an('array').and.have.length(0);
      expect(schema.fields.mrn.notOneOf).to.be.an('array').and.have.length(2);
    });

  });

  describe('tideDashboardConfigSchema', () => {
    it('should return a yup schema for clinic fields', () => {
      expect(clinicUtils.tideDashboardConfigSchema).to.be.an('object');

      expect(clinicUtils.tideDashboardConfigSchema._nodes).to.be.an('array').and.have.members([
        'period',
        'lastUpload',
        'tags',
      ]);
    });
  });
});
