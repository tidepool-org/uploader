/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2016, Tidepool Project
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

var _ = require('lodash');
var expect = require('salinity').expect;

var proc = require('../../../lib/drivers/medtronic/processData.js');
var builder = require('../../../lib/objectBuilder')();
var TZOUtil = require('../../../lib/TimezoneOffsetUtil');

describe('processData.js', () => {
  var tzoUtil = new TZOUtil('Europe/London', '2019-02-22T14:00:00.000Z', []);
  var cfg = { builder:builder, tzoUtil: tzoUtil, timezone: 'Europe/London' };
  var settings = { strokesPerUnit : 40, larger : true };

  beforeEach(() => {
    proc.init(cfg, settings);
  });

  describe('bolus', () => {

    describe('dual', () => {

      var bolus1 = {
          head: [ 1, 0, 20, 0, 1, 0, 8, 1 ],
          type: {
              value: 1,
              head_length: 8,
              name: 'BOLUS',
              date_length: 5,
              body_length: 0
          },
          date: [ 168, 234, 161, 14, 16 ],
          body: {},
          jsDate: new Date('2016-11-14T01:42:40.000Z'),
          index: 39
      };

      var bolus2 = {
        head: [ 1, 0, 20, 0, 20, 0, 8, 0 ],
        type: {
          value: 1,
          head_length: 8,
          name: 'BOLUS',
          date_length: 5,
          body_length: 0
        },
        date: [ 128, 234, 129, 14, 16 ],
        body: {},
        jsDate: new Date('2016-11-14T01:42:00.000Z'),
        index: 40
      };

      var expected = {
        time: '2016-11-14T01:42:00.000Z',
        timezoneOffset: 0,
        clockDriftOffset: 0,
        conversionOffset: 0,
        deviceTime: '2016-11-14T01:42:00',
        type: 'bolus',
        subType: 'dual/square',
        normal: 0.5,
        extended: 0.025,
        duration: 90000,
        expectedExtended: 0.5,
        expectedDuration: 1800000,
        payload: { logIndices: [40] },
        index: 40,
        iob: 0.2,
        jsDate: new Date('2016-11-14T01:42:00.000Z')
      };

      test('should not create two boluses when cancelled', () => {
        var result = proc.buildBolusRecords([bolus1,bolus2]);
        expect(result).deep.equals([expected]);
      });
    });
  });

  describe('deviceEvent', () => {
    describe('low glucose suspend status', () => {

      test('should handle being suspended and resumed by user ', () => {

        var suspend1 = {
            head: [ 0x1E, 0x02 ],
            type: {
                value: 0X1E,
                name: 'PUMP_SUSPEND'
            },
            jsDate: new Date('2016-12-14T12:15:50.000Z'),
            index: 1
        };

        var suspend2 = {
            head: [ 0x1E, 0x43 ],
            type: {
                value: 0X1E,
                name: 'PUMP_SUSPEND'
            },
            jsDate: new Date('2016-12-14T12:16:07.000Z'),
            index: 2
        };

        var suspend3 = {
            head: [ 0x1E, 0x65 ],
            type: {
                value: 0X1E,
                name: 'PUMP_SUSPEND'
            },
            jsDate: new Date('2016-12-14T12:16:17.000Z'),
            index: 3
        };

        var resume1 = {
            head: [ 0x1F, 0xA6 ],
            type: {
                value: 0X1F,
                name: 'PUMP_RESUME'
            },
            jsDate: new Date('2016-12-14T12:17:08.000Z'),
            index: 4
        };

        var resume2 = {
            head: [ 0x1F, 0xC0 ],
            type: {
                value: 0X1F,
                name: 'PUMP_RESUME'
            },
            jsDate: new Date('2016-12-14T12:17:10.000Z'),
            index: 5
        };

        var expected = {
          'time': '2016-12-14T12:15:50.000Z',
          'timezoneOffset': 0,
          'clockDriftOffset': 0,
          'conversionOffset': 0,
          'deviceTime': '2016-12-14T12:15:50',
          'type': 'deviceEvent',
          'subType': 'status',
          'status': 'suspended',
          'reason': {
            'suspended': 'automatic',
            'resumed': 'manual'
          },
          'duration': 78000,
          'index': 1,
          'resumeIndex': 4,
          'payload': {
            'reasons': [
              'Suspend low glucose',
              'Suspend user selected',
              'Resume user'
            ],
            'logIndices': [
              1
            ]
          }
        };

        var result = proc.buildSuspendResumeRecords([suspend1,suspend2,suspend3,resume1,resume2]);
        expect(result[0]).to.deep.equal(expected);
      });

      test('should resume automatically after two hours with no response by user', () => {
        var suspend1 = {
            head: [ 0x1E, 0x02 ],
            type: {
                value: 0X1E,
                name: 'PUMP_SUSPEND'
            },
            jsDate: new Date('2016-12-14T15:35:51.000Z'),
            index: 1
        };

        var suspend2 = {
            head: [ 0x1E, 0x44 ],
            type: {
                value: 0X1E,
                name: 'PUMP_SUSPEND'
            },
            jsDate: new Date('2016-12-14T15:37:51.000Z'),
            index: 2
        };

        var resume1 = {
            head: [ 0x1F, 0x88 ],
            type: {
                value: 0X1F,
                name: 'PUMP_RESUME'
            },
            jsDate: new Date('2016-12-14T17:35:00.000Z'),
            index: 3
        };

        var resume2 = {
            head: [ 0x1F, 0xC0 ],
            type: {
                value: 0X1F,
                name: 'PUMP_RESUME'
            },
            jsDate: new Date('2016-12-14T17:40:46.000Z'),
            index: 4
        };

        var resume3 = {
            head: [ 0x1F, 0xC0 ],
            type: {
                value: 0X1F,
                name: 'PUMP_RESUME'
            },
            jsDate: new Date('2016-12-14T17:40:52.000Z'),
            index: 5
        };

        var expected = {
                      'time': '2016-12-14T15:35:51.000Z',
                      'timezoneOffset': 0,
                      'clockDriftOffset': 0,
                      'conversionOffset': 0,
                      'deviceTime': '2016-12-14T15:35:51',
                      'type': 'deviceEvent',
                      'subType': 'status',
                      'status': 'suspended',
          'index' : 1,
          'resumeIndex' : 3,
                      'reason': {
                          'suspended': 'automatic',
                          'resumed': 'automatic'
                      },
                      'duration': 7149000,
                      'payload': {
                          'reasons': [
                              'Suspend no response',
                              'Automatic resume after no response'
                          ],
                          'logIndices': [
                              1
                          ]
                      }
                  };

        var result = proc.buildSuspendResumeRecords([suspend1,suspend2,resume1,resume2,resume3]);
        expect(result[0]).to.deep.equal(expected);
      });

      test('should resume automatically after two hours when user suspends', () => {
        var suspend1 = {
            head: [ 0x1E, 0x02 ],
            type: {
                value: 0X1E,
                name: 'PUMP_SUSPEND'
            },
            jsDate: new Date('2016-12-14T18:00:22.000Z'),
            index: 1
        };

        var suspend2 = {
            head: [ 0x1E, 0x43 ],
            type: {
                value: 0X1E,
                name: 'PUMP_SUSPEND'
            },
            jsDate: new Date('2016-12-14T18:00:32.000Z'),
            index: 2
        };

        var suspend3 = {
            head: [ 0x1E, 0x65 ],
            type: {
                value: 0X1E,
                name: 'PUMP_SUSPEND'
            },
            jsDate: new Date('2016-12-14T18:00:37.000Z'),
            index: 3
        };

        var resume1 = {
            head: [ 0x1F, 0xA7 ],
            type: {
                value: 0X1F,
                name: 'PUMP_RESUME'
            },
            jsDate: new Date('2016-12-14T20:00:00.000Z'),
            index: 4
        };

        var expected = {

                      'time': '2016-12-14T18:00:22.000Z',
                      'timezoneOffset': 0,
                      'clockDriftOffset': 0,
                      'conversionOffset': 0,
                      'deviceTime': '2016-12-14T18:00:22',
                      'type': 'deviceEvent',
                      'subType': 'status',
                      'status': 'suspended',
                      'reason': {
                          'suspended': 'automatic',
                          'resumed': 'automatic'
                      },
                      'duration': 7178000,
          'index' : 1,
          'resumeIndex' : 4,
                      'payload': {
                          'reasons': [
              'Suspend low glucose',
              'Suspend user selected',
              'Automatic resume after user suspend'
                          ],
                          'logIndices': [
                              1
                          ]
                      }
                  };

        var result = proc.buildSuspendResumeRecords([suspend1,suspend2,suspend3,resume1]);
        expect(result[0]).to.deep.equal(expected);
      });

      test('should have user suspend followed by LGS suspend', () => {

        // user suspend
        var suspend1 = {
            head: [ 0x1E, 0x01 ],
            type: {
                value: 0X1E,
                name: 'PUMP_SUSPEND'
            },
            jsDate: new Date('2016-12-14T18:00:22.000Z'),
            index: 1
        };

        // followed by LGS suspend
        var suspend2 = {
            head: [ 0x1E, 0x22 ],
            type: {
                value: 0X1E,
                name: 'PUMP_SUSPEND'
            },
            jsDate: new Date('2016-12-14T18:00:32.000Z'),
            index: 2
        };

        var suspend3 = {
            head: [ 0x1E, 0x43 ],
            type: {
                value: 0X1E,
                name: 'PUMP_SUSPEND'
            },
            jsDate: new Date('2016-12-14T18:00:37.000Z'),
            index: 3
        };

        var resume1 = {
            head: [ 0x1F, 0xA6 ],
            type: {
                value: 0X1F,
                name: 'PUMP_RESUME'
            },
            jsDate: new Date('2016-12-14T20:00:00.000Z'),
            index: 4
        };

        var expected = {

          'time': '2016-12-14T18:00:22.000Z',
          'timezoneOffset': 0,
          'clockDriftOffset': 0,
          'conversionOffset': 0,
          'deviceTime': '2016-12-14T18:00:22',
          'type': 'deviceEvent',
          'subType': 'status',
          'status': 'suspended',
          'reason': {
            'suspended': 'automatic',
            'resumed': 'manual'
          },
          'duration': 7178000,
          'index' : 1,
          'resumeIndex' : 4,
          'payload': {
            'reasons': [
              'Suspend user',
              'Suspend low glucose',
              'Resume user'
            ],
            'logIndices': [
              1
            ]
          }
        };

        var result = proc.buildSuspendResumeRecords([suspend1,suspend2,suspend3,resume1]);
        expect(result[0]).to.deep.equal(expected);

      });

    });
  });

  describe('pumpSettings', () => {

    beforeEach(() => {
      var currentSettings = {
        'modelNumber':'551',
        'deviceManufacturers':['Medtronic'],
        'serialNumber':'696693',
        'strokesPerUnit':40,
        'basalSchedules':{'standard':[{'start':0,'rate':0.2},{'start':10800000,'rate':0.45},{'start':28800000,'rate':0.8},{'start':43200000,'rate':0.975},{'start':50400000,'rate':0.3}],'pattern a':[{'start':0,'rate':1.5}],'pattern b':[{'start':0,'rate':0},{'start':54000000,'rate':2}]},
        'bgTarget':[{'start':0,'low':60,'high':250},{'start':3600000,'low':250,'high':250},{'start':7200000,'low':60,'high':60},{'start':16200000,'low':113,'high':125},{'start':21600000,'low':84,'high':101},{'start':43200000,'low':90,'high':101},{'start':52200000,'low':95,'high':99},{'start':66600000,'low':95,'high':112}],
        'carbRatio':[{'start':0,'amount':1},{'start':3600000,'amount':1.1},{'start':7200000,'amount':200},{'start':66600000,'amount':15},{'start':68400000,'amount':17},{'start':72000000,'amount':24},{'start':75600000,'amount':14},{'start':79200000,'amount':14}],
        'units':{'bg':'mg/dL','carb':'grams'},
        'insulinSensitivity':[{'start':0,'amount':400},{'start':3600000,'amount':10},{'start':7200000,'amount':61},{'start':14400000,'amount':41},{'start':21600000,'amount':64},{'start':25200000,'amount':47},{'start':30600000,'amount':64},{'start':61200000,'amount':50}],
        'activeSchedule':'standard',
        'currentDeviceTime':'2019-02-22T15:05:34.000Z',
        'bolus':{
          'amountMaximum':{'value':25,'units':'Units'},
          'calculator':{'enabled':true,'insulin':{'duration':8,'units':'hours'}
        },
        'extended':{'enabled':true}},
        'basal':{
          'rateMaximum':{'value':2,'units':'Units/hour'},
          'temporary':{'type':'percent'}
        }
      };
      proc.init(cfg, currentSettings);

    });

    describe('min/max values', () => {

      test('should handle min/max values for bolus wizard changes', () => {

        var bolusWizardChange = {
          head: [90, 15],
          type: {
              value: 90,
              body_length: 137,
              name: 'BOLUS_WIZARD_CHANGE',
              head_length: 2,
              date_length: 5
          },
          body: [ 133, 136, 0, 0, 10, 2, 0, 11, 4, 7, 208, 37, 0, 150, 38, 0, 170, 40, 0, 240, 42, 0, 140, 44, 0, 140, 0, 0, 64, 144, 2, 56, 6, 46, 8, 41, 12, 64, 14, 47, 17, 64, 34, 50, 0, 90, 100, 2, 98, 102, 4, 103, 110, 9, 113, 125, 12, 84, 101, 24, 90, 101, 29, 95, 99, 37, 95, 112, 133, 136, 0, 0, 10, 2, 0, 11, 4, 7, 208, 37, 0, 150, 38, 0, 170, 40, 0, 240, 42, 0, 140, 44, 0, 140, 0, 0, 64, 144, 2, 10, 4, 61, 8, 41, 12, 64, 14, 47, 17, 64, 34, 50, 0, 60, 250, 2, 250, 250, 4, 60, 60, 9, 113, 125, 12, 84, 101, 24, 90, 101, 29, 95, 99, 37, 95, 112, 136 ],
          jsDate: new Date('2019-02-22T12:16:42.000Z'),
          index: 42
        };

        var result = proc.buildSettings([bolusWizardChange]);

        expect(result.postrecords[0].carbRatio[0]).to.deep.equal({ start: 0, amount: 1 });
        expect(result.postrecords[0].carbRatio[1]).to.deep.equal({ start: 3600000, amount: 1.1 });
        expect(result.postrecords[0].carbRatio[2]).to.deep.equal({ start: 7200000, amount: 200 });

        expect(result.postrecords[0].insulinSensitivity[0]).to.deep.equal({ start: 0, amount: 400 });
        expect(result.postrecords[0].insulinSensitivity[1]).to.deep.equal({ start: 3600000, amount: 10 });

        expect(result.postrecords[0].bgTarget[0]).to.deep.equal({start: 0, low: 60, high: 250});
        expect(result.postrecords[0].bgTarget[1]).to.deep.equal({start: 3600000, low: 250, high: 250});
        expect(result.postrecords[0].bgTarget[2]).to.deep.equal({start: 7200000, low: 60, high: 60});

        expect(result.postrecords[0].bolus.calculator.insulin).to.deep.equal({duration: 8, units: 'hours'});

      });

      test('should handle max bolus of 0-25', () => {

        var maxBolus1 = {
          head: [36, 31],
          type: {
              value: 36,
              name: 'MAX_BOLUS',
              head_length: 2,
              date_length: 5,
              body_length: 0
          },
          date: [ 51, 164, 79, 22, 19 ],
          jsDate: new Date('2019-02-22T15:36:51.000Z'),
          index: 47
        };

        var maxBolus2 = {
          head: [36, 0],
          type: {
              value: 36,
              name: 'MAX_BOLUS',
              head_length: 2,
              date_length: 5,
              body_length: 0
          },
          date: [ 48, 164, 15, 22, 19],
          jsDate: new Date('2019-02-22T15:36:48.000Z'),
          index: 46
        };

        var result = proc.buildSettings([maxBolus2, maxBolus1]);

        expect(result.postrecords[0].bolus.amountMaximum).to.deep.equals({value:25, units:'Units'});
        expect(result.postrecords[2].bolus.amountMaximum).to.deep.equals({value:0, units:'Units'});
      });

      test('should handle max basal of 2-35', () => {

        var maxBasal1 = {
          head: [ 44, 120 ],
           type: {
               value: 44,
               name: 'CHANGE_MAX_BASAL',
               head_length: 2,
               date_length: 5,
               body_length: 0
           },
           date: [ 3, 141, 176, 22, 19 ],
           jsDate: new Date('2019-02-22T16:13:03.000Z'),
           index: 48
        };

        var maxBasal2 = {
          head: [ 44, 80 ],
          type: {
              value: 44,
              name: 'CHANGE_MAX_BASAL',
              head_length: 2,
              date_length: 5,
              body_length: 0
          },
          date: [ 11, 141, 16, 22, 19 ],
          jsDate: new Date('2019-02-22T16:13:11.000Z'),
          index: 49
        };

        var maxBasal3 = {
          head: [44, 82],
          type: {
              value: 44,
              name: 'CHANGE_MAX_BASAL',
              head_length: 2,
              date_length: 5,
              body_length: 0
          },
          date: [ 14, 141, 16, 22, 19 ],
          jsDate: new Date('2019-02-22T16:13:14.000Z'),
          index: 50,
        };

        var result = proc.buildSettings([maxBasal3, maxBasal1, maxBasal2]);

        expect(result.postrecords[1].basal.rateMaximum).to.deep.equals({'value': 2,'units':'Units/hour'});
        expect(result.postrecords[2].basal.rateMaximum).to.deep.equals({'value': 35,'units':'Units/hour'});
        expect(result.postrecords[3].basal.rateMaximum).to.deep.equals({'value':2.05,'units':'Units/hour'});
      });

    });
  });

});
