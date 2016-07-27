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

/*eslint-env mocha*/

import _ from 'lodash';

import * as utils from '../../../../lib/redux/actions/utils';

describe('utils', () => {
  describe('mergeProfileUpdates', () => {
    const profile = {
      emails: ['joe@example.com'],
      emailVerified: true,
      fullName: 'Joe',
      patient: {
        birthday: '1980-02-05',
        diagnosisDate: '1990-02-06',
        targetDevices: ['carelink', 'omnipod'],
        targetTimezone: 'US/Central'
      },
      termsAccepted: '2016-05-09T14:33:59-04:00',
      username: 'joe@example.com'
    };

    it('should merge profile updates', () => {
      var update = {fullName: 'New Joe'};
      expect(utils.mergeProfileUpdates(_.cloneDeep(profile), update)).to.deep.equal({
        emails: ['joe@example.com'],
        emailVerified: true,
        fullName: 'New Joe',
        patient: {
          birthday: '1980-02-05',
          diagnosisDate: '1990-02-06',
          targetDevices: ['carelink', 'omnipod'],
          targetTimezone: 'US/Central'
        },
        termsAccepted: '2016-05-09T14:33:59-04:00',
        username: 'joe@example.com'
      });
    });

    it('should merge patient updates', () => {
      var update = {patient: {birthday: '1981-02-05'}};
      expect(utils.mergeProfileUpdates(_.cloneDeep(profile), update)).to.deep.equal({
        emails: ['joe@example.com'],
        emailVerified: true,
        fullName: 'Joe',
        patient: {
          birthday: '1981-02-05',
          diagnosisDate: '1990-02-06',
          targetDevices: ['carelink', 'omnipod'],
          targetTimezone: 'US/Central'
        },
        termsAccepted: '2016-05-09T14:33:59-04:00',
        username: 'joe@example.com'
      });
    });

    it('should replace emails array on update', () => {
      var update = {emails:['joe2@example.com']};
      expect(utils.mergeProfileUpdates(_.cloneDeep(profile), update)).to.deep.equal({
        emails: ['joe2@example.com'],
        emailVerified: true,
        fullName: 'Joe',
        patient: {
          birthday: '1980-02-05',
          diagnosisDate: '1990-02-06',
          targetDevices: ['carelink', 'omnipod'],
          targetTimezone: 'US/Central'
        },
        termsAccepted: '2016-05-09T14:33:59-04:00',
        username: 'joe@example.com'
      });
    });

    it('should replace targetDevices array on update', () => {
      var update = {patient: {targetDevices: ['tandem']}};
      expect(utils.mergeProfileUpdates(_.cloneDeep(profile), update)).to.deep.equal({
        emails: ['joe@example.com'],
        emailVerified: true,
        fullName: 'Joe',
        patient: {
          birthday: '1980-02-05',
          diagnosisDate: '1990-02-06',
          targetDevices: ['tandem'],
          targetTimezone: 'US/Central'
        },
        termsAccepted: '2016-05-09T14:33:59-04:00',
        username: 'joe@example.com'
      });
    });

  });
});
