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

import { expect } from 'chai';

import NGPHistoryParser from '../../../lib/drivers/medtronic600/NGPHistoryParser';
import builder from '../../../lib/objectBuilder';
import TZOUtil from '../../../lib/TimezoneOffsetUtil';

describe('NGPHistoryParser.js', () => {
  const tzoUtil = new TZOUtil('GMT', '2016-12-01T00:00:00.000Z', []);
  const cfg = {
    builder: builder(),
    tzoUtil,
  };
  const settings = {};

  describe('wizard', () => {
    test('should add bolus record with matching programmed event to wizard', () => {
      const bolusProgrammedData = '150016822dff2e9e029f8e01aa0000014dfc000032c8';
      const bolusCompleteData = 'dc001a822dff189e029f8e01aa0000014dfc00014dfc000032c8';
      const wizardData = '3d0035822dfdd69e029f8e01000000003c002300000046003200370000000000014dfc000032c80000000000014dfc000000014dfc';
      const historyParser = new NGPHistoryParser(
        cfg, settings,
        [bolusProgrammedData + wizardData + bolusCompleteData],
      );
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
        carbUnits: 'grams',
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

    test('should ignore a bolus record without a matching programmed event', () => {
      const bolusData = 'dc001a822dff2e9e029f8e01aa0000014dfc00014dfc000032c8';
      const wizardData = '3d0035822dfdd69e029f8e01000000003c002300000046003200370000000000014dfc000032c80000000000014dfc000000014dfc';
      const historyParser = new NGPHistoryParser(cfg, settings, [wizardData + bolusData]);
      const events = [];

      const expected = undefined;

      historyParser.buildNormalBolusRecords(events);
      expect(events[0]).to.deep.equal(expected);
    });
  });

  describe('suspend', () => {
    test('should calculate the correct suspend duration', () => {
      const suspendData = '1e000c81ee52f6a092886601';
      const resumeData = '1f000c81ee56b5a092886602';
      const historyParser = new NGPHistoryParser(cfg, settings, [suspendData + resumeData]);
      const events = [];

      const expected = {
        time: '2018-05-05T21:15:08.000Z',
        timezoneOffset: 0,
        clockDriftOffset: 0,
        conversionOffset: 0,
        deviceTime: '2018-05-05T21:15:08',
        type: 'deviceEvent',
        subType: 'status',
        status: 'suspended',
        reason: { suspended: 'automatic', resumed: 'manual' },
        duration: 959000,
        payload: {
          suspended: { cause: 'Alarm suspend' },
          resumed: { cause: 'User cleared alarm' },
          logIndices: [2179879670],
        },
        index: 2179879670,
        jsDate: new Date('2018-05-05T21:15:08.000Z'),
      };

      historyParser.buildSuspendResumeRecords(events);
      expect(events[0]).to.deep.equal(expected);
    });
  });

  describe('temp basal', () => {
    test('should not create a temp basal event if a TEMP_BASAL_COMPLETE has no corresponding TEMP_BASAL_PROGRAMMED', () => {
      const tempBasalComplete = '22001582b21d749e0290540001000000007d005a00';
      const historyParser = new NGPHistoryParser(cfg, settings, [tempBasalComplete]);
      const events = [];

      const expected = undefined;

      historyParser.buildTempBasalRecords(events);
      expect(events[0]).to.deep.equal(expected);
    });

    test('should not create a temp basal event if a corresponding suppressed basal cannot be found', () => {
      const tempBasalProgrammed = '1b001482e91daa9e0274350001000000007d005a';
      const tempBasalComplete = '22001582e9329f9e0274350001000000007d005a00';
      const historyParser = new NGPHistoryParser(cfg, settings, [tempBasalProgrammed
          + tempBasalComplete]);
      const events = [];

      const expected = undefined;

      historyParser.buildTempBasalRecords(events);
      expect(events[0]).to.deep.equal(expected);
    });

    test('should create a temp basal event when all required pump history events are found', () => {
      const basalSegmentStart = '1d001182e8f04b9e0274350101000032c8';
      const tempBasalProgrammed = '1b001482e91daa9e0274350001000000007d005a';
      const tempBasalComplete = '22001582e9329f9e0274350001000000007d005a00';
      const historyParser = new NGPHistoryParser(cfg, settings, [basalSegmentStart
          + tempBasalProgrammed + tempBasalComplete]);
      const events = [];

      const expectedTempBasal = JSON.parse(JSON.stringify(builder().makeTempBasal()
        .with_time('2017-07-02T11:13:35.000Z')
        .with_deviceTime('2017-07-02T11:13:35')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_clockDriftOffset(0)
        .with_rate(1.625)
        .with_percent(1.25)
        .with_expectedDuration(5400000)
        .with_duration(5400000)
        .set('index', 2196315562)
        .set('jsDate', '2017-07-02T11:13:35.000Z')
        .set('suppressed', {
          type: 'basal',
          deliveryType: 'scheduled',
          rate: 1.3,
          scheduleName: 'Pattern 1',
        })));

      historyParser.buildTempBasalRecords(events);
      expect(JSON.parse(JSON.stringify(events))).to.deep.equal([expectedTempBasal]);
    });

    test('should synthesize a temp basal with annotations if final temp basal event is TEMP_BASAL_PROGRAMMED', () => {
      const basalSegmentStart = '1d001181963895a101dbab020200001482';
      const tempBasalProgrammed = '1b00148196614ca101dbab000100000000c800f0';
      const historyParser = new NGPHistoryParser(cfg, settings, [basalSegmentStart
          + tempBasalProgrammed]);
      const events = [];

      // We need to simplify the object using JSON.parse/JSON.stringify because
      // .done() would cause an error on an incomplete builder() object.
      const expectedFirstBasal = JSON.parse(JSON.stringify(builder().makeScheduledBasal()
        .with_time('2018-05-23T12:00:00.000Z')
        .with_deviceTime('2018-05-23T12:00:00')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_clockDriftOffset(0)
        .with_scheduleName('Pattern 2')
        .with_rate(0.525)
        .set('index', 2174105749)
        .set('jsDate', new Date('2018-05-23T12:00:00.000Z'))));

      const expectedTempBasal = JSON.parse(JSON.stringify(builder().makeTempBasal()
        .with_time('2018-05-23T14:53:43.000Z')
        .with_deviceTime('2018-05-23T14:53:43')
        .with_timezoneOffset(0)
        .with_conversionOffset(0)
        .with_clockDriftOffset(0)
        .with_rate(1.05)
        .with_percent(2)
        .with_expectedDuration(14400000)
        .with_duration(14400000)
        .set('index', 2174116172)
        .set('jsDate', '2018-05-23T14:53:43.000Z')
        .set('annotations', [{
          code: 'basal/unknown-duration',
        }])
        .set('suppressed', {
          type: 'basal',
          deliveryType: 'scheduled',
          rate: 0.525,
          scheduleName: 'Pattern 2',
        })));

      historyParser.buildBasalRecords(events);
      historyParser.buildTempBasalRecords(events);

      expect(JSON.parse(JSON.stringify(events))).to.deep.equal([expectedFirstBasal,
        expectedTempBasal]);
    });
  });

  describe('pumpSettings', () => {
    let currentSettings;

    beforeEach(() => {
      currentSettings = {
        units: {
          bg: 'mg/dL',
          carb: 'grams',
        },
        currentNgpTimestamp: {
          rtc: 2153075802,
          offset: -1548581457,
        },
        currentDeviceTime: '2019-02-26T11:05:45.000Z',
        activeSchedule: 'Pattern 1',
        bgTarget: [
          {
            start: 0,
            high: 110,
            low: 90,
          },
        ],
        carbRatio: [
          {
            start: 0,
            amount: 16,
          },
        ],
        insulinSensitivity: [
          {
            start: 0,
            amount: 50,
          },
        ],
        isBolusWizardEnabled: true,
        durationOfInsulinAction: 240,
        isExtendedBolusEnabled: false,
        maxBolusAmount: 10,
        tempBasalType: 0,
        maxBasalAmount: 35,
        pumpSerial: 'NG1422190H',
        displayBgUnits: 0,
        deviceManufacturers: [
          'Medtronic',
        ],
        pumpModel: 'MMT-1780',
        basalSchedules: {
          'Pattern 1': [
            {
              start: 0,
              rate: 0,
            },
          ],
        },
      };
    });

    describe('min/max values', () => {
      test('should handle min/max values for bolus wizard changes', () => {
        const carbRatioChange = '61002180558481a3b285af0004000000000a020000000b04000007d00600000096';
        const bgTargetChange = '63002180558af8a3b285af00040000fa003c0200fa00fa04003c003c0600780064';
        const isfChange = '5f001680558aa4a3b285af0003000190020005040032';
        const bolusWizardSettingsChange = '5d001380558b04a3b285af010000f0010001e0';
        const historyParser = new NGPHistoryParser(
          cfg,
          currentSettings,
          [isfChange, bgTargetChange, carbRatioChange, bolusWizardSettingsChange],
        );
        const events = [];

        historyParser.buildSettingsRecords(events);

        expect(events[0].bolus.calculator.insulin).to.deep.equal({ duration: 480, units: 'minutes' });

        expect(events[1].carbRatio[0]).to.deep.equal({ start: 0, amount: 1 });
        expect(events[1].carbRatio[1]).to.deep.equal({ start: 3600000, amount: 1.1 });
        expect(events[1].carbRatio[2]).to.deep.equal({ start: 7200000, amount: 200 });

        expect(events[2].bgTarget[0]).to.deep.equal({ start: 0, low: 60, high: 250 });
        expect(events[2].bgTarget[1]).to.deep.equal({ start: 3600000, low: 250, high: 250 });
        expect(events[2].bgTarget[2]).to.deep.equal({ start: 7200000, low: 60, high: 60 });

        expect(events[3].insulinSensitivity[0]).to.deep.equal({ start: 0, amount: 400 });
        expect(events[3].insulinSensitivity[1]).to.deep.equal({ start: 3600000, amount: 5 });
      });

      test('should handle max bolus of 0-25', () => {
        const maxBolus1 = '590013805ec8c7a3b284fb0003d09000000000';
        const maxBolus2 = '590013805ec8d7a3b284fb000000000003d090';
        const maxBolus3 = '590013805ec8fda3b284fb0003d0900001a9c8';

        const historyParser = new NGPHistoryParser(
          cfg,
          currentSettings,
          [maxBolus1, maxBolus2, maxBolus3],
        );
        const events = [];

        historyParser.buildSettingsRecords(events);

        expect(events[0].bolus.amountMaximum).to.deep.equals({ value: 10.9, units: 'Units' });
        expect(events[1].bolus.amountMaximum).to.deep.equals({ value: 25, units: 'Units' });
        expect(events[2].bolus.amountMaximum).to.deep.equals({ value: 0, units: 'Units' });
      });
    });

    test('should handle max basal of 0-35', () => {
      const maxBasal1 = '580013805ed36fa3b284fb000347d800000000';
      const maxBasal2 = '580013805ed37ea3b284fb00000000000000fa';
      const maxBasal3 = '580013805ed393a3b284fb000000fa00055730';
      const maxBasal4 = '580013805ed3b5a3b284fb00055730000178f4';

      const historyParser = new NGPHistoryParser(
        cfg,
        currentSettings,
        [maxBasal1, maxBasal2, maxBasal3, maxBasal4],
      );
      const events = [];

      historyParser.buildSettingsRecords(events);

      expect(events[0].basal.rateMaximum).to.deep.equals({ value: 9.65, units: 'Units/hour' });
      expect(events[1].basal.rateMaximum).to.deep.equals({ value: 35, units: 'Units/hour' });
      expect(events[2].basal.rateMaximum).to.deep.equals({ value: 0.025, units: 'Units/hour' });
      expect(events[3].basal.rateMaximum).to.deep.equals({ value: 0, units: 'Units/hour' });
    });
  });
});
