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

import { expect } from 'chai';

import personUtils from '../../../lib/core/personUtils';

describe('personUtils', () => {
  describe('patientFullName', () => {
    test('(normal account) should return the fullName for the person', () => {
      const person = { profile: {fullName: 'Joe Smith' } };
      expect(personUtils.patientFullName(person)).to.equal('Joe Smith');
    });

    test('(fake child account) should return the patient profile fullName', () => {
      const person = {
        profile: {
          fullName: 'Jane Smith',
          patient: {
            isOtherPerson: true,
            fullName: 'Child Smith'
          }
        }
      };
      expect(personUtils.patientFullName(person)).to.equal('Child Smith');
    });
  });

  describe('userHasRole', () => {
    test('should return true if role is present on user', () => {
      const user = {
        roles: ['clinic']
      };
      const role = 'clinic';
      expect(personUtils.userHasRole(user, role)).to.be.true;
    });

    test('should return false if user has no roles', () => {
      const user = {
        fullName: 'Joe Smith'
      };
      const role = 'clinic';
      expect(personUtils.userHasRole(user, role)).to.be.false;
    });

    test('should return false if user lacks role', () => {
      const user = {
        roles: ['awesome']
      };
      const role = 'clinic';
      expect(personUtils.userHasRole(user, role)).to.be.false;
    });
  });

  describe('patientInfo', () => {
    test('should return patient info if exists', () => {
      var person = {
        profile: {patient: {diagnosisDate: '1990-01-31'}}
      };

      var result = personUtils.patientInfo(person);

      expect(result.diagnosisDate).to.equal('1990-01-31');
    });
  });

  describe('isPatient', () => {
    test('should return true if person has patient info', () => {
      var person = {
        profile: {patient: {diagnosisDate: '1990-01-31'}}
      };

      var result = personUtils.isPatient(person);

      expect(result).to.be.ok;
    });

    test('should return false if person does not have patient info', () => {
      var person = {
        profile: {}
      };

      var result = personUtils.isPatient(person);

      expect(result).to.not.be.ok;
    });
  });

  describe('isClinicianAccount', () => {
    test('should return true if person has clinic role', () => {
      var person = {
        profile: {
          fullName: 'Mary Smith'
        },
        roles: ['clinic']
      };

      var result = personUtils.isClinicianAccount(person);

      expect(result).to.be.ok;
    });

    test('should return false if person has no clinic role', () => {
      var person = {
        profile: {}
      };

      var result = personUtils.isClinicianAccount(person);

      expect(result).to.not.be.ok;
    });

    test('should return true if person is clinic member', () => {
      var person = {
        profile: {
          fullName: 'Mary Smith'
        },
        isClinicMember: true,
      };

      var result = personUtils.isClinicianAccount(person);

      expect(result).to.be.ok;
    });

    test('should return false if person is not a clinic member', () => {
      var person = {
        profile: {
          fullName: 'Mary Smith'
        },
        isClinicMember: false,
      };

      var result = personUtils.isClinicianAccount(person);

      expect(result).to.not.be.ok;
    });
  });

  describe('isDataDonationAccount', () => {
    test('should return true if the account username or email matches the donation account format', function () {
      var account1 = { email: 'bigdata+BT1@tidepool.org' };
      var account2 = { email: 'bigdata+NSF@tidepool.org' };
      var account3 = { username: 'bigdata@tidepool.org' };

      var result1 = personUtils.isDataDonationAccount(account1);
      var result2 = personUtils.isDataDonationAccount(account2);
      var result3 = personUtils.isDataDonationAccount(account3);

      expect(result1).to.be.true;
      expect(result2).to.be.true;
      expect(result3).to.be.true;
    });

    test('should return false if the account username or email does not match the donation account format', function () {
      var account1 = { email: 'user@tidepool.org' };
      var account2 = { username: 'user@gmail.com' };

      var result1 = personUtils.isDataDonationAccount(account1);
      var result2 = personUtils.isDataDonationAccount(account2);

      expect(result1).to.be.false;
      expect(result2).to.be.false;
    });
  });

});
