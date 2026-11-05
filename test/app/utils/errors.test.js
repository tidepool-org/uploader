/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2026, Tidepool Project
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

import { addInfoToError } from '../../../app/utils/errors';

describe('errors', () => {
  describe('addInfoToError', () => {
    test('should copy device data onto the error for the debug download links', () => {
      const err = new Error('Oops!');
      const data = { post_records: [], compressed: new Uint8Array([31, 139]) };
      addInfoToError(err, { details: 'something broke', data });

      expect(err.data).to.equal(data);
    });

    test('should not expose device data to serialization of the error', () => {
      const err = new Error('Oops!');
      addInfoToError(err, {
        details: 'something broke',
        data: { post_records: [{ type: 'bolus' }] },
      });

      // the metrics middleware serializes the error's enumerable properties
      // into a GET query string, which must not include the device data
      expect(Object.keys(err)).to.not.contain('data');
      expect(JSON.stringify(err)).to.not.contain('bolus');
    });

    test('should not include device data in the debug details string', () => {
      const err = new Error('Oops!');
      addInfoToError(err, {
        details: 'something broke',
        data: { post_records: [{ type: 'bolus' }] },
      });

      expect(err.debug).to.equal('Details: something broke');
    });
  });
});
