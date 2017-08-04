/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2017, Tidepool Project
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

/* global beforeEach, describe, it */

// eslint-disable-next-line import/no-extraneous-dependencies
const expect = require('salinity').expect;

const NGPHistoryParser = require('../../../lib/drivers/medtronic600/NGPHistoryParser');
const builder = require('../../../lib/objectBuilder')();
const TZOUtil = require('../../../lib/TimezoneOffsetUtil');

describe('NGPHistoryParser.js', () => {
  const tzoUtil = new TZOUtil('GMT', '2016-12-01T00:00:00.000Z', []);
  const cfg = {
    builder,
    tzoUtil,
  };
  const settings = {};

  describe('wizard', () => {
    it('should add bolus record to wizard', () => {
      const bolusData = 'dc001a822dff2e9e029f8e01aa0000014dfc00014dfc000032c8';
      const wizardData = '3d0035822dfdd69e029f8e01000000003c002300000046003200370000000000014dfc000032c80000000000014dfc000000014dfc';
      const historyParser = new NGPHistoryParser(cfg, settings, [wizardData + bolusData]);
      const events = [];

      const expected = {
        bgTarget: {
          high: 5.5,
          low: 5,
        },
        bolus: {
          clockDriftOffset: 0,
          conversionOffset: 0,
          deviceTime: '2017-02-10T15:54:36',
          normal: 8.55,
          payload: {
            logIndices: [
              2184052526,
            ],
          },
          subType: 'normal',
          time: '2017-02-10T15:54:36.000Z',
          timezoneOffset: 0,
          type: 'bolus',
        },
        carbInput: 60,
        clockDriftOffset: 0,
        conversionOffset: 0,
        deviceTime: '2017-02-10T15:48:52',
        index: 2184052182,
        insulinCarbRatio: 7,
        insulinOnBoard: 1.3,
        insulinSensitivity: 3.5,
        jsDate: new Date('2017-02-10T15:48:52.000Z'),
        payload: {
          logIndices: [
            2184052182,
          ],
        },
        recommended: {
          carb: 8.55,
          correction: 0,
          net: 8.55,
        },
        time: '2017-02-10T15:48:52.000Z',
        timezoneOffset: 0,
        type: 'wizard',
        units: 'mmol/L',
      };

      historyParser.buildNormalBolusRecords(events);
      expect(events[0]).to.deep.equal(expected);
    });
  });
});
