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

/* global describe, it */

var _ = require('lodash');
var expect = require('salinity').expect;

var builder = require('../lib/objectBuilder')();
var TZOUtil = require('../lib/TimezoneOffsetUtil');

describe('TimezoneOffsetUtil.js', function(){
  it('exports a function', function(){
    expect(typeof TZOUtil).to.equal('function');
  });

  it('returns an object', function(){
    var util = new TZOUtil('US/Pacific', '2016-01-01T00:00:00.000Z', []);
    expect(typeof util).to.equal('object');
  });

  it('throws an error if a named timezone not provided as first param', function(){
    var fn = function() { new TZOUtil('foo', '2016-01-01T00:00:00.000Z', '2015-01-01T00:00:00.000Z', []); };
    expect(fn).to.throw('Unrecognized timezone name!');
  });

  it('throws an error if a valid timestamp is not provided as second param', function(){
    var fn = function() { new TZOUtil('US/Pacific', 'foo', []); };
    expect(fn).to.throw('Invalid timestamp for most recent datum!');
  });

  it('throws an error if `changes` not empty and not all events are `timeChange`', function(){
    var fn = function() { new TZOUtil('US/Eastern', '2016-01-01T00:00:00.000Z', [{type: 'foo'}]); };
    expect(fn).to.throw(Error);
  });

  it('defaults to accross-the-board timezone application if no `changes` provided as third param', function(){
    var util = new TZOUtil('US/Eastern', '2016-01-01T00:00:00.000Z', []);
    expect(util.lookup(new Date('2015-04-01T00:00:00'))).to.deep.equal({
      time: '2015-04-01T04:00:00.000Z',
      timezoneOffset: -240
    });
  });

  it('adds `time` and `timezoneOffset` attrs to the `changes` provided (and calls `.done()`)', function(){
    var belatedDST = builder.makeDeviceMetaTimeChange()
      .with_change({
        from: '2015-03-08T12:01:21',
        to: '2015-03-08T13:00:00',
      })
      .with_deviceTime('2015-03-08T12:01:21')
      .set('jsDate', new Date('2015-03-08T12:01:21'))
      .set('index', 10);
    var travel = builder.makeDeviceMetaTimeChange()
      .with_change({
        from: '2015-04-01T15:33:24',
        to: '2015-04-01T14:35:00'
      })
      .with_deviceTime('2015-04-01T15:33:24')
      .set('jsDate', new Date('2015-04-01T15:33:24'))
      .set('index', 100);
    var util = new TZOUtil('US/Central', '2016-01-01T00:00:00.000Z', [belatedDST, travel]);
    expect(_.map(util.records, function(rec) { return _.omit(rec, ['payload', 'index']); })).to.deep.equal([
      {
        time: '2015-04-01T20:33:24.000Z',
        deviceTime: '2015-04-01T15:33:24',
        timezoneOffset: -300,
        type: 'deviceMeta',
        subType: 'timeChange',
        change: {
          from: '2015-04-01T15:33:24',
          to: '2015-04-01T14:35:00'
        }
      }, {
        time: '2015-03-08T16:01:21.000Z',
        deviceTime: '2015-03-08T12:01:21',
        timezoneOffset: -240,
        type: 'deviceMeta',
        subType: 'timeChange',
        change: {
          from: '2015-03-08T12:01:21',
          to: '2015-03-08T13:00:00',
        }
      }
    ]);
  });

  it('makes the `changes` provided (with additional attrs added) publicly available as `records`', function(){
    var belatedDST = builder.makeDeviceMetaTimeChange()
      .with_change({
        from: '2015-03-08T12:01:21',
        to: '2015-03-08T13:00:00',
      })
      .with_deviceTime('2015-03-08T12:01:21')
      .set('jsDate', new Date('2015-03-08T12:01:21'))
      .set('index', 10);
    var travel = builder.makeDeviceMetaTimeChange()
      .with_change({
        from: '2015-04-01T15:33:24',
        to: '2015-04-01T14:35:00'
      })
      .with_deviceTime('2015-04-01T15:33:24')
      .set('jsDate', new Date('2015-04-01T15:33:24'))
      .set('index', 100);
    var util = new TZOUtil('US/Central', '2016-01-01T00:00:00.000Z', [belatedDST, travel]);
    expect(Array.isArray(util.records)).to.be.true;
    expect(util.records.length).to.equal(2);
    var noChangesUtil = new TZOUtil('US/Central', '2016-01-01T00:00:00.000Z', []);
    expect(Array.isArray(noChangesUtil.records)).to.be.true;
    expect(noChangesUtil.records.length).to.equal(0);
  });

  describe('findOffsetDifference', function(){
    var util = new TZOUtil('Pacific/Auckland', '2016-01-01T00:00:00.000Z', []);
    it('is a function', function(){
      expect(typeof util.findOffsetDifference).to.equal('function');
    });

    it('returns the difference between two deviceTimes in minutes', function(){
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
      expect(util.findOffsetDifference(a)).to.equal(-120);
      expect(util.findOffsetDifference(b)).to.equal(120);
    });

    it('rounds to the nearest 15 minutes', function(){
      // from Pacific/Chatham (UTC+13:45) to UTC
      var a = {
        change: {
          from: '2015-04-03T09:48:00',
          to: '2015-04-02T20:04:00'
        }
      };
      expect(util.findOffsetDifference(a)).to.equal(825);
    });

    it('only allows for "clock drift" adjustments of < 8 minutes', function(){
      // clock drift adjustment = difference of 0
      var a = {
        change: {
          from: '2015-04-01T00:07:59',
          to: '2015-04-01T00:00:00'
        }
      };
      // won't be interpreted as clock drift
      // but rather offset change of 15 minutes
      var b = {
        change: {
          from: '2015-04-01T00:08:00',
          to: '2015-04-01T00:00:00'
        }
      };
      expect(util.findOffsetDifference(a)).to.equal(0);
      expect(util.findOffsetDifference(b)).to.equal(15);
    });
  });

  describe('uses the appropriate offset from UTC given (non-empty) `changes` provided', function(){
    it('under clock drift adjustment only, offset doesn\'t change even if DST', function(){
      var clockDriftAdjust = builder.makeDeviceMetaTimeChange()
        .with_change({
          from: '2015-03-01T12:02:05',
          to: '2015-03-01T12:00:00'
        })
        .with_deviceTime('2015-03-01T12:02:05')
        .set('jsDate', new Date('2015-03-01T12:02:05'))
        .set('index', 50);
      var util = new TZOUtil('US/Eastern', '2016-01-01T00:00:00.000Z', [clockDriftAdjust]);
      expect(util.lookup(new Date('2015-04-01T00:00:00'))).to.deep.equal({
        time: '2015-04-01T05:00:00.000Z',
        timezoneOffset: -300
      });
    });

    it('under DST change (spring forward), offset changes', function(){
      var belatedDST = builder.makeDeviceMetaTimeChange()
        .with_change({
          from: '2015-03-08T12:01:21',
          to: '2015-03-08T13:00:00',
        })
        .with_deviceTime('2015-03-08T12:01:21')
        .set('jsDate', new Date('2015-03-08T12:01:21'))
        .set('index', 10);
      var util = new TZOUtil('US/Eastern', '2016-01-01T00:00:00.000Z', [belatedDST]);
      expect(util.lookup(new Date('2015-04-01T00:00:00'))).to.deep.equal({
        time: '2015-04-01T04:00:00.000Z',
        timezoneOffset: -240
      });
      expect(util.lookup(new Date('2015-03-01T00:00:00'))).to.deep.equal({
        time: '2015-03-01T05:00:00.000Z',
        timezoneOffset: -300
      });
    });

    it('under DST change (fall back), offset changes', function(){
      var onTimeDST = builder.makeDeviceMetaTimeChange()
        .with_change({
          from: '2015-11-01T02:00:00',
          to: '2015-11-01T01:00:00'
        })
        .with_deviceTime('2015-11-01T02:00:00')
        .set('jsDate', new Date('2015-11-01T02:00:00'))
        .set('index', 10);
      var util = new TZOUtil('US/Eastern', '2016-01-01T00:00:00.000Z', [onTimeDST]);
      expect(util.lookup(new Date('2015-11-05T00:00:00'))).to.deep.equal({
        time: '2015-11-05T05:00:00.000Z',
        timezoneOffset: -300
      });
      expect(util.lookup(new Date('2015-10-05T00:00:00'))).to.deep.equal({
        time: '2015-10-05T04:00:00.000Z',
        timezoneOffset: -240
      });
    });

    it('under travel across the date line (eastward), offset changes', function(){
      // i.e., JHB comes to visit
      var fromNZ = builder.makeDeviceMetaTimeChange()
        .with_change({
          from: '2015-04-03T08:25:00',
          to: '2015-04-02T12:26:00'
        })
        .with_deviceTime('2015-04-03T08:25:00')
        .set('jsDate', new Date('2015-04-03T08:25:00'))
        .set('index', 10);
      var util = new TZOUtil('US/Pacific', '2015-06-01T00:00:00.000Z', [fromNZ]);
      expect(util.lookup(new Date('2015-04-10T00:00:00'))).to.deep.equal({
        time: '2015-04-10T07:00:00.000Z',
        timezoneOffset: -420
      });
      expect(util.lookup(new Date('2015-03-10T00:00:00' ))).to.deep.equal({
        time: '2015-03-09T11:00:00.000Z',
        timezoneOffset: 780
      });
    });

    it('under travel across the date line (westward), offset changes', function(){
      // i.e., Left Coaster goes to NZ
      var toNZ = builder.makeDeviceMetaTimeChange()
        .with_change({
          from: '2015-04-02T12:26:00',
          to: '2015-04-03T08:25:00'
        })
        .with_deviceTime('2015-04-02T12:26:00')
        .set('jsDate', new Date('2015-04-02T12:26:00'))
        .set('index', 10);
      var util = new TZOUtil('Pacific/Auckland', '2015-04-15T00:00:00.000Z', [toNZ]);
      expect(util.lookup(new Date('2015-04-05T00:00:00'))).to.deep.equal({
        time: '2015-04-04T11:00:00.000Z',
        timezoneOffset: 780
      });
      expect(util.lookup(new Date('2015-03-10T00:00:00'))).to.deep.equal({
        time: '2015-03-10T07:00:00.000Z',
        timezoneOffset: -420
      });
    });

    it('under huge change (month, year), offset doesn\'t change', function(){
      var wrongYear = builder.makeDeviceMetaTimeChange()
        .with_change({
          from: '2013-12-15T15:00:00',
          to: '2014-12-15T15:00:00'
        })
        .with_deviceTime('2013-12-15T15:00:00')
        .set('jsDate', new Date('2013-12-15T15:00:00'))
        .set('index', 10);
      var util = new TZOUtil('US/Eastern', '2015-01-01T00:00:00.000Z', [wrongYear]);
      expect(util.lookup(new Date('2014-12-25T00:00:00'))).to.deep.equal({
        time: '2014-12-25T05:00:00.000Z',
        timezoneOffset: -300
      });
      expect(util.lookup(new Date('2013-12-10T00:00:00'))).to.deep.equal({
        time: '2013-12-10T05:00:00.000Z',
        timezoneOffset: -300
      });
    });
  });
});