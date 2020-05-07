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


var _ = require('lodash');
var sinon = require('sinon');
var expect = require('chai').expect;

var builder = require('../../lib/objectBuilder')();
var TZOUtil = require('../../lib/TimezoneOffsetUtil');
var sundial = require('sundial');

describe('TimezoneOffsetUtil.js', () => {
  test('exports a function', () => {
    expect(typeof TZOUtil).to.equal('function');
  });

  test('returns an object', () => {
    var util = new TZOUtil('US/Pacific', '2015-06-01T00:00:00.000Z', []);
    expect(typeof util).to.equal('object');
  });

  test('throws an error if a named timezone not provided as first param', () => {
    var fn = function() { new TZOUtil('foo', '2015-06-01T00:00:00.000Z', '2015-01-01T00:00:00.000Z', []); };
    expect(fn).to.throw('Unrecognized timezone name!');
  });

  test('throws an error if a valid timestamp is not provided as second param', () => {
    var fn = function() { new TZOUtil('US/Pacific', 'foo', []); };
    expect(fn).to.throw('Invalid timestamp for most recent datum!');
  });

  test('throws an error if `changes` not empty and not all events are `timeChange`', () => {
    var fn = function() { new TZOUtil('US/Eastern', '2015-06-01T00:00:00.000Z', [{type: 'foo'}]); };
    expect(fn).to.throw(Error);
  });

  test('defaults to across-the-board timezone application if no `changes` provided as third param', () => {
    var util = new TZOUtil('US/Eastern', '2015-06-01T00:00:00.000Z', []);
    expect(util.lookup(sundial.parseFromFormat('2015-04-01T00:00:00'))).to.deep.equal({
      time: '2015-04-01T04:00:00.000Z',
      timezoneOffset: -240,
      clockDriftOffset: 0,
      conversionOffset: 0
    });
  });

  test('identifies the type of timezone offset production used as `utc-bootstrapping` or `across-the-board-timezone`', () => {
    var atbUtil = new TZOUtil('US/Eastern', '2015-06-01T00:00:00.000Z', []);
    expect(atbUtil.type).to.equal('across-the-board-timezone');
    var belatedDST = builder.makeDeviceEventTimeChange()
      .with_change({
        from: '2015-03-08T12:01:21',
        to: '2015-03-08T13:00:00',
      })
      .with_deviceTime('2015-03-08T12:01:21')
      .set('jsDate', sundial.parseFromFormat('2015-03-08T12:01:21'))
      .set('index', 10);
    var bootstrapUtil = new TZOUtil('US/Eastern', '2015-06-01T00:00:00.000Z', [belatedDST]);
    expect(bootstrapUtil.type).to.equal('utc-bootstrapping');
  });

  describe('records', () => {
    test('adds `time`, `timezoneOffset`, `clockDriftOffset`, and `conversionOffset` attrs to the `changes` provided (and calls `.done()`)', () => {
      var belatedDST = builder.makeDeviceEventTimeChange()
        .with_change({
          from: '2015-03-08T12:01:21',
          to: '2015-03-08T13:00:00',
        })
        .with_deviceTime('2015-03-08T12:01:21')
        .set('jsDate', sundial.parseFromFormat('2015-03-08T13:00:00'))
        .set('index', 10);
      var travel = builder.makeDeviceEventTimeChange()
        .with_change({
          from: '2015-04-01T15:33:24',
          to: '2015-04-01T14:35:00'
        })
        .with_deviceTime('2015-04-01T15:33:24')
        .set('jsDate', sundial.parseFromFormat('2015-04-01T14:35:00'))
        .set('index', 100);
      var wrongMonth = builder.makeDeviceEventTimeChange()
        .with_change({
          from: '2015-04-10T16:05:10',
          to: '2015-05-10T16:05:00'
        })
        .with_deviceTime('2015-04-10T16:05:10')
        .set('jsDate', sundial.parseFromFormat('2015-05-10T16:05:00'))
        .set('index', 200);
      var util = new TZOUtil('US/Central', '2015-06-01T00:00:00.000Z', [belatedDST, travel, wrongMonth]);
      expect(_.map(util.records, function(rec) { return _.omit(rec, ['payload', 'index']); })).to.deep.equal([
        {
          time: '2015-05-10T21:05:00.000Z',
          deviceTime: '2015-04-10T16:05:10',
          timezoneOffset: -300,
          clockDriftOffset: 0,
          conversionOffset: 0,
          type: 'deviceEvent',
          subType: 'timeChange',
          change: {
            from: '2015-04-10T16:05:10',
            to: '2015-05-10T16:05:00'
          }
        }, {
          time: '2015-05-01T19:34:50.000Z',
          deviceTime: '2015-04-01T15:33:24',
          timezoneOffset: -300,
          clockDriftOffset: 0,
          conversionOffset: -2591990000,
          type: 'deviceEvent',
          subType: 'timeChange',
          change: {
            from: '2015-04-01T15:33:24',
            to: '2015-04-01T14:35:00'
          }
        }, {
          time: '2015-04-07T16:59:50.000Z',
          deviceTime: '2015-03-08T12:01:21',
          timezoneOffset: -240,
          clockDriftOffset: -96000,
          conversionOffset: -2591990000,
          type: 'deviceEvent',
          subType: 'timeChange',
          change: {
            from: '2015-03-08T12:01:21',
            to: '2015-03-08T13:00:00',
          }
        }
      ]);
    });

    test('makes the `changes` provided (with additional attrs added) publicly available as `records`', () => {
      var belatedDST = builder.makeDeviceEventTimeChange()
        .with_change({
          from: '2015-03-08T12:01:21',
          to: '2015-03-08T13:00:00',
        })
        .with_deviceTime('2015-03-08T12:01:21')
        .set('jsDate', sundial.parseFromFormat('2015-03-08T12:01:21'))
        .set('index', 10);
      var travel = builder.makeDeviceEventTimeChange()
        .with_change({
          from: '2015-04-01T15:33:24',
          to: '2015-04-01T14:35:00'
        })
        .with_deviceTime('2015-04-01T15:33:24')
        .set('jsDate', sundial.parseFromFormat('2015-04-01T15:33:24'))
        .set('index', 100);
      var util = new TZOUtil('US/Central', '2015-06-01T00:00:00.000Z', [belatedDST, travel]);
      expect(Array.isArray(util.records)).to.be.true;
      expect(util.records.length).to.equal(2);
      var noChangesUtil = new TZOUtil('US/Central', '2015-06-01T00:00:00.000Z', []);
      expect(Array.isArray(noChangesUtil.records)).to.be.true;
      expect(noChangesUtil.records.length).to.equal(0);
    });
  });


  describe('findOffsetDifferences', () => {
    var util = new TZOUtil('Pacific/Auckland', '2015-06-01T00:00:00.000Z', []);
    test('is a function', () => {
      expect(typeof util.findOffsetDifferences).to.equal('function');
    });

    test('returns the offsetDifference between two deviceTimes in minutes', () => {
      var a = {
        change: {
          from: '2015-01-01T00:00:00',
          to: '2015-01-01T02:00:00'
        }
      };
      var b = {
        change: {
          from: '2015-01-01T02:00:00',
          to: '2015-01-01T00:00:00'
        }
      };
      expect(util.findOffsetDifferences(a).offsetDifference).to.equal(-120);
      expect(util.findOffsetDifferences(b).offsetDifference).to.equal(120);
    });

    test('returns the rawDifference between two deviceTimes in milliseconds', () => {
      var a = {
        change: {
          from: '2015-01-01T00:00:00',
          to: '2015-01-01T00:01:15'
        }
      };
      var b = {
        change: {
          from: '2015-01-01T00:01:20',
          to: '2015-01-01T00:00:00'
        }
      };
      expect(util.findOffsetDifferences(a).rawDifference).to.equal(-75000);
      expect(util.findOffsetDifferences(b).rawDifference).to.equal(80000);
    });

    test('rounds offsetDifference to the nearest 30 minutes', () => {
      // from Pacific/Chatham (UTC+13:45) to UTC
      var a = {
        change: {
          from: '2015-04-03T09:48:00',
          to: '2015-04-02T20:04:00'
        }
      };
      expect(util.findOffsetDifferences(a).offsetDifference).to.equal(810);
    });

    test('only allows for "clock drift" adjustments of < 15 minutes', () => {
      // clock drift adjustment = difference of 0
      var a = {
        change: {
          from: '2015-04-01T00:14:59',
          to: '2015-04-01T00:00:00'
        }
      };
      // won't be interpreted as clock drift
      // but rather offset change of 30 minutes
      var b = {
        change: {
          from: '2015-04-01T00:15:00',
          to: '2015-04-01T00:00:00'
        }
      };
      expect(util.findOffsetDifferences(a).offsetDifference).to.equal(0);
      expect(util.findOffsetDifferences(a).rawDifference).to.equal(899000);
      expect(util.findOffsetDifferences(b).offsetDifference).to.equal(30);
      expect(util.findOffsetDifferences(b).rawDifference).to.equal(900000);
    });
  });

  describe('lookup', () => {
    test('is a function', () => {
      var util = new TZOUtil('Pacific/Auckland', '2015-06-01T00:00:00.000Z', []);
      expect(typeof util.lookup).to.equal('function');
    });

    describe('uses the appropriate offset from UTC given (non-empty) `changes` provided', () => {
      test('under clock drift adjustment only, timezoneOffset doesn\'t change even if DST', () => {
        var clockDriftAdjust = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2015-03-01T12:02:05',
            to: '2015-03-01T12:00:00'
          })
          .with_deviceTime('2015-03-01T12:02:05')
          .set('jsDate', sundial.parseFromFormat('2015-03-01T12:02:05'))
          .set('index', 50);
        var util = new TZOUtil('US/Eastern', '2015-06-01T00:00:00.000Z', [clockDriftAdjust]);
        expect(util.lookup(sundial.parseFromFormat('2015-02-01T00:00:00'))).to.deep.equal({
          time: '2015-02-01T04:00:00.000Z',
          timezoneOffset: -240,
          clockDriftOffset: 125000,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat('2015-04-01T00:00:00'))).to.deep.equal({
          time: '2015-04-01T04:00:00.000Z',
          timezoneOffset: -240,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
        expect(util.type).to.equal('utc-bootstrapping');
      });

      test('under DST change (spring forward), timezoneOffset changes', () => {
        var belatedDST = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2015-03-08T12:01:21',
            to: '2015-03-08T13:00:00',
          })
          .with_deviceTime('2015-03-08T12:01:21')
          .set('jsDate', sundial.parseFromFormat('2015-03-08T12:01:21'))
          .set('index', 10);
        var util = new TZOUtil('US/Eastern', '2015-06-01T00:00:00.000Z', [belatedDST]);
        expect(util.lookup(sundial.parseFromFormat('2015-04-01T00:00:00'))).to.deep.equal({
          time: '2015-04-01T04:00:00.000Z',
          timezoneOffset: -240,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat('2015-03-01T00:00:00'))).to.deep.equal({
          time: '2015-03-01T05:00:00.000Z',
          timezoneOffset: -300,
          clockDriftOffset: 81000,
          conversionOffset: 0
        });
      });

      test('under mixture of clock drift and real changes, intervals are contiguous', () => {
        var clockDriftAdjust1 = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2015-03-01T12:02:05',
            to: '2015-03-01T12:00:00'
          })
          .with_deviceTime('2015-03-01T12:02:05')
          .set('jsDate', sundial.parseFromFormat('2015-03-01T12:02:05'))
          .set('index', 10);
        var belatedDST = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2015-03-08T12:01:21',
            to: '2015-03-08T13:00:00',
          })
          .with_deviceTime('2015-03-08T12:01:21')
          .set('jsDate', sundial.parseFromFormat('2015-03-08T12:01:21'))
          .set('index', 50);
        var clockDriftAdjust2 = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2015-03-15T12:02:05',
            to: '2015-03-15T12:00:00'
          })
          .with_deviceTime('2015-03-15T12:02:05')
          .set('jsDate', sundial.parseFromFormat('2015-03-15T12:02:05'))
          .set('index', 100);
        var justAChange = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2015-04-01T15:31:22',
            to: '2015-04-01T13:30:00'
          })
          .with_deviceTime('2015-04-01T15:31:22')
          .set('jsDate', sundial.parseFromFormat('2015-04-01T15:31:22'))
          .set('index', 120);
        var changeBack = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2015-04-08T09:04:02',
            to: '2015-04-08T11:03:00'
          })
          .with_deviceTime('2015-04-08T09:04:02')
          .set('jsDate', sundial.parseFromFormat('2015-04-08T09:04:02'))
          .set('index', 150);
        var util = new TZOUtil('US/Central', '2015-06-01T00:00:00.000Z', [
          clockDriftAdjust1,
          belatedDST,
          clockDriftAdjust2,
          justAChange,
          changeBack
        ]);
        expect(util.lookup(sundial.parseFromFormat('2015-03-05T12:00:00'))).to.deep.equal({
          time: '2015-03-05T18:00:00.000Z',
          timezoneOffset: -360,
          clockDriftOffset: 350000,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat('2015-03-10T12:00:00'))).to.deep.equal({
          time: '2015-03-10T17:00:00.000Z',
          timezoneOffset: -300,
          clockDriftOffset: 269000,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat('2015-03-20T12:00:00'))).to.deep.equal({
          time: '2015-03-20T17:00:00.000Z',
          timezoneOffset: -300,
          clockDriftOffset: 144000,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat('2015-04-02T12:00:00'))).to.deep.equal({
          time: '2015-04-02T19:00:00.000Z',
          timezoneOffset: -420,
          clockDriftOffset: 62000,
          conversionOffset: 0
        });
      });

      test('under DST change (fall back), timezoneOffset changes', () => {
        var onTimeDST = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2015-11-01T02:00:00',
            to: '2015-11-01T01:00:00'
          })
          .with_deviceTime('2015-11-01T02:00:00')
          .set('jsDate', sundial.parseFromFormat('2015-11-01T02:00:00'))
          .set('index', 10);
        var util = new TZOUtil('US/Eastern', '2016-01-01T00:00:00.000Z', [onTimeDST]);
        expect(util.lookup(sundial.parseFromFormat('2015-11-05T00:00:00'))).to.deep.equal({
          time: '2015-11-05T05:00:00.000Z',
          timezoneOffset: -300,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat('2015-10-05T00:00:00'))).to.deep.equal({
          time: '2015-10-05T04:00:00.000Z',
          timezoneOffset: -240,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
      });

      test('under travel across the date line (eastward), timezoneOffset changes', () => {
        // i.e., JHB comes to visit
        var fromNZ = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2015-04-03T08:25:00',
            to: '2015-04-02T12:26:00'
          })
          .with_deviceTime('2015-04-03T08:25:00')
          .set('jsDate', sundial.parseFromFormat('2015-04-03T08:25:00'))
          .set('index', 10);
        var util = new TZOUtil('US/Pacific', '2015-06-01T00:00:00.000Z', [fromNZ]);
        expect(util.lookup(sundial.parseFromFormat('2015-04-10T00:00:00'))).to.deep.equal({
          time: '2015-04-10T07:00:00.000Z',
          timezoneOffset: -420,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat('2015-03-10T00:00:00'))).to.deep.equal({
          time: '2015-03-09T11:00:00.000Z',
          timezoneOffset: 780,
          clockDriftOffset: -60000,
          conversionOffset: 0
        });
      });

      test('under travel across the date line (westward), timezoneOffset changes', () => {
        // i.e., Left Coaster goes to NZ
        var toNZ = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2015-03-25T12:26:00',
            to: '2015-03-26T08:25:00'
          })
          .with_deviceTime('2015-03-25T12:26:00')
          .set('jsDate', sundial.parseFromFormat('2015-03-25T12:26:00'))
          .set('index', 10);
        var util = new TZOUtil('Pacific/Auckland', '2015-04-01T00:00:00.000Z', [toNZ]);
        expect(util.lookup(sundial.parseFromFormat('2015-03-31T00:00:00'))).to.deep.equal({
          time: '2015-03-30T11:00:00.000Z',
          timezoneOffset: 780,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat('2015-03-15T00:00:00'))).to.deep.equal({
          time: '2015-03-15T07:00:00.000Z',
          timezoneOffset: -420,
          clockDriftOffset: 60000,
          conversionOffset: 0
        });
      });

      test('under huge change (month, year), timezoneOffset doesn\'t change but conversionOffset does', () => {
        // TODO: these don't work without the indices given to the lookup function
        // is this expected? is there a way to do the offsetIntervals differently to fix it?
        var wrongYear = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2013-12-15T15:00:00',
            to: '2014-12-15T15:00:00'
          })
          .with_deviceTime('2013-12-15T15:00:00')
          .set('jsDate', sundial.parseFromFormat('2013-12-15T15:00:00'))
          .set('index', 10);
        var util = new TZOUtil('US/Eastern', '2015-01-01T00:00:00.000Z', [wrongYear]);
        expect(util.lookup(sundial.parseFromFormat('2014-12-25T00:00:00'), 15)).to.deep.equal({
          time: '2014-12-25T05:00:00.000Z',
          timezoneOffset: -300,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat('2013-12-10T00:00:00'), 5)).to.deep.equal({
          time: '2014-12-10T05:00:00.000Z',
          timezoneOffset: -300,
          clockDriftOffset: 0,
          conversionOffset: -31536000000
        });
        var wrongMonth = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2014-11-15T15:00:00',
            to: '2014-12-15T15:00:00'
          })
          .with_deviceTime('2014-11-15T15:00:00')
          .set('jsDate', sundial.parseFromFormat('2014-11-15T15:00:00'))
          .set('index', 10);
        var util2 = new TZOUtil('US/Eastern', '2015-01-01T00:00:00.000Z', [wrongMonth]);
        expect(util2.lookup(sundial.parseFromFormat('2014-12-25T00:00:00'), 15)).to.deep.equal({
          time: '2014-12-25T05:00:00.000Z',
          timezoneOffset: -300,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
        expect(util2.lookup(sundial.parseFromFormat('2014-11-10T00:00:00'), 5)).to.deep.equal({
          time: '2014-12-10T05:00:00.000Z',
          timezoneOffset: -300,
          clockDriftOffset: 0,
          conversionOffset: -2592000000
        });
      });

      test('under 23-hour change, timezoneOffset doesn\'t change but conversionOffset does', () => {
        var twentyThree = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2013-12-15T23:00:00',
            to: '2013-12-16T22:00:00'
          })
          .with_deviceTime('2013-12-16T22:00:00')
          .set('jsDate', sundial.parseFromFormat('2013-12-16T22:00:00'))
          .set('index', 10);
        var util = new TZOUtil('US/Eastern', '2015-01-01T00:00:00.000Z', [twentyThree]);
        expect(util.lookup(sundial.parseFromFormat('2014-12-25T00:00:00'), 15)).to.deep.equal({
          time: '2014-12-25T05:00:00.000Z',
          timezoneOffset: -300,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat('2013-12-10T00:00:00'), 5)).to.deep.equal({
          time: '2013-12-11T04:00:00.000Z',
          timezoneOffset: -240,
          clockDriftOffset: 0,
          conversionOffset: -86400000
        });
      });

      test('when no `index`, uses first UTC timestamp that fits in an offsetInterval', () => {
        var ambiguousDeviceTime = '2015-04-01T12:00:00';
        var amNotPM = builder.makeDeviceEventTimeChange()
          .with_change({
            from: '2015-04-01T19:00:00',
            to: '2015-04-01T07:00:00'
          })
          .with_deviceTime('2015-04-01T19:00:00')
          .set('jsDate', sundial.parseFromFormat('2015-04-01T19:00:00'))
          .set('index', 50);
        var util = new TZOUtil('US/Mountain', '2015-05-01T00:00:00.000Z', [amNotPM]);
        expect(util.lookup(sundial.parseFromFormat(ambiguousDeviceTime), 51)).to.deep.equal({
          time: '2015-04-01T18:00:00.000Z',
          timezoneOffset: -360,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat(ambiguousDeviceTime), 49)).to.deep.equal({
          time: '2015-04-01T06:00:00.000Z',
          timezoneOffset: 360,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
        expect(util.lookup(sundial.parseFromFormat(ambiguousDeviceTime))).to.deep.equal({
          time: '2015-04-01T06:00:00.000Z',
          timezoneOffset: 360,
          clockDriftOffset: 0,
          conversionOffset: 0
        });
      });
    });
  });

  describe('fillInUTCInfo', () => {
    var noChangesUtil = new TZOUtil('Pacific/Auckland', '2015-06-01T00:00:00.000Z', []);
    test('is a function', () => {
      expect(typeof noChangesUtil.fillInUTCInfo).to.equal('function');
    });

    test('throws an error if something other than an object provided as first param', () => {
      var fn1 = function() { noChangesUtil.fillInUTCInfo(1, new Date()); };
      expect(fn1).to.throw('Must provide an object!');
      var fn2 = function() { noChangesUtil.fillInUTCInfo([1,2,3], new Date()); };
      expect(fn2).to.throw('Must provide an object!');
    });

    test('throws an error if an empty object provided as first param', () => {
      var fn = function() { noChangesUtil.fillInUTCInfo({}, new Date()); };
      expect(fn).to.throw('Object must not be empty!');
    });

    test('throws an error if a valid JavaScript Date not provided as second param', () => {
      var fn = function() { noChangesUtil.fillInUTCInfo({type: 'foo'}, 'bar'); };
      expect(fn).to.throw('Date must be provided!');
    });

    test('properly recognizes 0 as an index and passes it to `lookup` function', () => {
      var stubLookup = sinon.spy(noChangesUtil, 'lookup');
      var obj = {
        type: 'foo',
        index: 0
      };
      var dt = sundial.parseFromFormat('2015-04-03T11:30:00');
      expect(stubLookup.callCount).to.equal(0);
      noChangesUtil.fillInUTCInfo(obj, dt);
      expect(stubLookup.callCount).to.equal(1);
      expect(stubLookup.calledWith(dt, 0)).to.be.true;
    });

    test('mutates the object passed in, adding `time`, `timezoneOffset`, `clockDriftOffset`, and `conversionOffset` attrs by way of lookup function', () => {
      var obj = {
        type: 'foo',
        index: 10
      };
      var dt = sundial.parseFromFormat('2015-04-03T11:30:00');
      var expectedRes = _.assign({}, obj, {
        time: '2015-04-02T22:30:00.000Z',
        timezoneOffset: 780,
        clockDriftOffset: 0,
        conversionOffset: 0
      });
      expect(noChangesUtil.fillInUTCInfo(obj, dt)).to.deep.equal(expectedRes);
    });

    test('annotates the object if no `index` present', () => {
      var obj = {
        type: 'deviceEvent',
        subType: 'alarm'
      };
      var dt = sundial.parseFromFormat('2015-04-03T11:30:00');
      var expectedRes = _.assign({}, obj, {
        time: '2015-04-02T22:30:00.000Z',
        timezoneOffset: 780,
        clockDriftOffset: 0,
        conversionOffset: 0,
        annotations: [{code: 'uncertain-timestamp'}]
      });
      expect(noChangesUtil.fillInUTCInfo(obj, dt)).to.deep.equal(expectedRes);
    });

    // for OmniPod unbootstrappable alarms
    test('does not add `time` etc. to the object if lookup failed', () => {
      var ambiguousDeviceTime = '2015-03-31T23:59:00';
      var wrongMonth = builder.makeDeviceEventTimeChange()
        .with_change({
          from: '2015-04-01T06:00:00',
          to: '2015-05-01T06:00:00'
        })
        .with_deviceTime('2015-04-01T06:00:00')
        .set('jsDate', sundial.parseFromFormat('2015-04-01T06:00:00'))
        .set('index', 50);
      var clockDrift = builder.makeDeviceEventTimeChange()
        .with_change({
          from: '2015-05-14T23:57:00',
          to: '2015-05-15T00:00:00',
        })
        .with_deviceTime('2015-05-15T00:03:00')
        .set('jsDate', sundial.parseFromFormat('2015-05-15T00:03:00'))
        .set('index', 75);
      var util = new TZOUtil('US/Mountain', '2015-06-01T00:00:00.000Z', [wrongMonth, clockDrift]);
      const obj = { index: null };
      util.fillInUTCInfo(obj, sundial.parseFromFormat(ambiguousDeviceTime));
      expect(obj.time).to.be.undefined;
      expect(obj.timezoneOffset).to.be.undefined;
      expect(obj.clockDriftOffset).to.be.undefined;
      expect(obj.conversionOffset).to.be.undefined;
    });
  });
});

describe('TimezoneOffsetUtil in practice', () => {
  var oneDay = 1000 * 60 * 60 * 24;
  test('applies a timezone across-the-board when no `changes` provided', () => {
    var data = _.map(_.range(0,100), function(d) { return {value: d, type: 'foo'}; });
    var startDate = sundial.parseFromFormat('2015-02-01T00:00:00').getTime();
    var dates = _.map(_.range(100), (days) => new Date(startDate + days * oneDay));
    // Hawaii doesn't use Daylight Savings Time
    var util = new TZOUtil('Pacific/Honolulu', '2015-06-01T00:00:00.000Z', []);
    for (var i = 0; i < data.length; ++i) {
      var datum = data[i], date = dates[i];
      util.fillInUTCInfo(datum, date);
    }
    expect(_.map(data, 'timezoneOffset')[0]).to.equal(-600);
  });

  test('applies a timezone across-the-board (including offset changes b/c of DST) when no `changes` provided', () => {
    var data = _.map(_.range(0,100), function(d) { return {value: d, type: 'foo'}; });
    var startDate = sundial.parseFromFormat('2015-02-01T00:00:00').getTime();
    var dates = _.map(_.range(100), (days) => new Date(startDate + days * oneDay));
    // US/Mountain *does* use Daylight Savings Time
    var util = new TZOUtil('US/Mountain', '2015-06-01T00:00:00.000Z', []);
    for (var i = 0; i < data.length; ++i) {
      var datum = data[i], date = dates[i];
      util.fillInUTCInfo(datum, date);
    }
    var offsets = _.uniq(_.map(data, 'timezoneOffset'));
    expect(offsets.length).to.equal(2);
    expect(offsets).to.deep.equal([-420, -360]);
  });

  test('applies the offsets inferred from `changes`, resulting in no gaps or overlaps',
    done => {
    //this.timeout(5000);
    setTimeout(function() {
      var data = [], index = 0, fiveMinutes = 1000 * 60 * 5;
      var datetimesHomeAgainStart = sundial.parseFromFormat('2015-04-19T05:05:00').getTime();
      var datetimesHomeAgain = _.map(_.range(3395), (i) =>
        new Date(datetimesHomeAgainStart + fiveMinutes * i)
      );
      var datetimesInNZStart = sundial.parseFromFormat('2015-04-10T19:05:00').getTime();
      var datetimesInNZ = _.map(_.range(2652), (i) =>
        new Date(datetimesInNZStart + fiveMinutes * i)
      );
      var datetimesBeforeTripStart = sundial.parseFromFormat('2015-04-01T00:00:00').getTime();
      var datetimesBeforeTrip = _.map(_.range(2593), (i) =>
        new Date(datetimesBeforeTripStart + fiveMinutes * i)
      );
      var datetimes = _.flatten([datetimesBeforeTrip, datetimesInNZ, datetimesHomeAgain]);
      _.each(datetimes, function(dt) {
        data.push({
          type: 'foo',
          index: index,
          deviceTime: dt.toISOString().slice(0,-5)
        });
        index += 2;
      });
      var fromNZ = builder.makeDeviceEventTimeChange()
        .with_change({
          from: '2015-04-20T00:02:30',
          to: '2015-04-19T05:03:00'
        })
        .with_deviceTime('2015-04-20T00:00:00')
        .set('jsDate', sundial.parseFromFormat('2015-04-20T00:00:00'))
        .set('index', 10489);
      var toNZ = builder.makeDeviceEventTimeChange()
        .with_change({
          from: '2015-04-10T00:02:30',
          to: '2015-04-10T19:02:00'
        })
        .with_deviceTime('2015-04-10T00:02:30')
        .set('jsDate', sundial.parseFromFormat('2015-04-10T00:02:30'))
        .set('index', 5185);
      var util = new TZOUtil('US/Pacific', '2015-06-01T00:00:00.000Z', [toNZ, fromNZ]);
      for (var i = 0; i < data.length; ++i) {
        var datum = data[i], date = datetimes[i];
        util.fillInUTCInfo(datum, date);
      }
      var byTime = _.sortBy(data, function(d) { return d.time; });
      var byIndex = _.sortBy(data, function(d) { return d.index; });
      expect(byTime).to.deep.equal(byIndex);
      var deviceTimes = _.map(data, 'deviceTime');
      var uniqDeviceTimes = _.uniq(deviceTimes);
      // given the time changes involved, device times are *not*
      // expected to be unique, hence the length of arrays should vary
      expect(deviceTimes.length).not.to.equal(uniqDeviceTimes.length);
      var times = _.map(data, 'time');
      var uniqTimes = _.uniq(times);
      // but UTC times should *always* be unique, even with travel!
      // so the length of arrays should stay the same, even when reducing to unique
      expect(times.length).to.equal(uniqTimes.length);
      done();
    }, 50);
  });
});
