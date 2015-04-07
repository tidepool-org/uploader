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
var d3 = require('d3');
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

  it('defaults to across-the-board timezone application if no `changes` provided as third param', function(){
    var util = new TZOUtil('US/Eastern', '2016-01-01T00:00:00.000Z', []);
    expect(util.lookup(new Date('2015-04-01T00:00:00'))).to.deep.equal({
      time: '2015-04-01T04:00:00.000Z',
      timezoneOffset: -240
    });
  });

  describe('records', function(){
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

  describe('lookup', function(){
    it('is a function', function(){
      var util = new TZOUtil('Pacific/Auckland', '2016-01-01T00:00:00.000Z', []);
      expect(typeof util.lookup).to.equal('function');
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
        var wrongMonth = builder.makeDeviceMetaTimeChange()
          .with_change({
            from: '2014-11-15T15:00:00',
            to: '2014-12-15T15:00:00'
          })
          .with_deviceTime('2014-11-15T15:00:00')
          .set('jsDate', new Date('2014-11-15T15:00:00'))
          .set('index', 10);
        var util2 = new TZOUtil('US/Eastern', '2015-01-01T00:00:00.000Z', [wrongMonth]);
        expect(util2.lookup(new Date('2014-12-25T00:00:00'))).to.deep.equal({
          time: '2014-12-25T05:00:00.000Z',
          timezoneOffset: -300
        });
        expect(util2.lookup(new Date('2014-11-10T00:00:00'))).to.deep.equal({
          time: '2014-11-10T05:00:00.000Z',
          timezoneOffset: -300
        });
      });

      it('when no `index`, uses first UTC timestamp that fits in an offsetInterval', function(){
        var ambiguousDeviceTime = '2015-04-01T12:00:00';
        var amNotPM = builder.makeDeviceMetaTimeChange()
          .with_change({
            from: '2015-04-01T19:00:00',
            to: '2015-04-01T07:00:00'
          })
          .with_deviceTime('2015-04-01T19:00:00')
          .set('jsDate', new Date('2015-04-01T19:00:00'))
          .set('index', 50);
        var util = new TZOUtil('US/Mountain', '2015-05-01T00:00:00.000Z', [amNotPM]);
        expect(util.lookup(new Date(ambiguousDeviceTime), 51)).to.deep.equal({
          time: '2015-04-01T18:00:00.000Z',
          timezoneOffset: -360
        });
        expect(util.lookup(new Date(ambiguousDeviceTime), 49)).to.deep.equal({
          time: '2015-04-01T06:00:00.000Z',
          timezoneOffset: 360
        });
        expect(util.lookup(new Date(ambiguousDeviceTime))).to.deep.equal({
          time: '2015-04-01T06:00:00.000Z',
          timezoneOffset: 360
        });
      });
    });
  });

  describe('fillInUTCInfo', function(){
    var noChangesUtil = new TZOUtil('Pacific/Auckland', '2016-01-01T00:00:00.000Z', []);
    it('is a function', function() {
      expect(typeof noChangesUtil.fillInUTCInfo).to.equal('function');
    });

    it('throws an error if something other than an object provided as first param', function(){
      var fn1 = function() { noChangesUtil.fillInUTCInfo(1, new Date()); };
      expect(fn1).to.throw('Must provide an object!');
      var fn2 = function() { noChangesUtil.fillInUTCInfo([1,2,3], new Date()); };
      expect(fn2).to.throw('Must provide an object!');
    });

    it('throws an error if an empty object provided as first param', function(){
      var fn = function() { noChangesUtil.fillInUTCInfo({}, new Date()); };
      expect(fn).to.throw('Object must not be empty!');
    });

    it('throws an error if a valid JavaScript Date not provided as second param', function(){
      var fn = function() { noChangesUtil.fillInUTCInfo({type: 'foo'}, 'bar'); };
      expect(fn).to.throw('Date must be provided!');
    });

    it('mutates the object passed in, adding `time` and `timezoneOffset` attrs by way of lookup function', function(){
      var obj = {
        type: 'foo'
      };
      var dt = new Date('2015-04-03T11:30:00');
      expect(noChangesUtil.fillInUTCInfo(obj, dt)).to.deep.equal(_.assign({}, obj, {
        time: '2015-04-02T22:30:00.000Z',
        timezoneOffset: 780
      }));
    });

    it('annotates the object if no `index` present', function(){
      var obj = {
        type: 'deviceMeta',
        subType: 'alarm'
      };
      var dt = new Date('2015-04-03T11:30:00');
      expect(noChangesUtil.fillInUTCInfo(obj, dt)).to.deep.equal(_.assign({}, obj, {
        time: '2015-04-02T22:30:00.000Z',
        timezoneOffset: 780,
        annotations: [{code: 'uncertain-timestamp'}]
      }));
    });
  });
});

describe('TimezoneOffsetUtil in practice', function(){
  it('applies a timezone across-the-board when no `changes` provided', function(){
    var data = _.map(_.range(0,100), function(d) { return {value: d, type: 'foo'}; });
    var dates = d3.time.day.range(new Date('2015-02-01T00:00:00'), new Date('2015-05-12T00:00:00'));
    // Hawaii doesn't use Daylight Savings Time
    var util = new TZOUtil('Pacific/Honolulu', '2015-06-01T00:00:00.000Z', []);
    for (var i = 0; i < data.length; ++i) {
      var datum = data[i], date = dates[i];
      util.fillInUTCInfo(datum, date);
    }
    expect(_.pluck(data, 'timezoneOffset')[0]).to.equal(-600);
  });

  it('applies a timezone across-the-board (including offset changes b/c of DST) when no `changes` provided', function(){
    var data = _.map(_.range(0,100), function(d) { return {value: d, type: 'foo'}; });
    var dates = d3.time.day.range(new Date('2015-02-01T00:00:00'), new Date('2015-05-12T00:00:00'));
    // US/Mountain *does* use Daylight Savings Time
    var util = new TZOUtil('US/Mountain', '2015-06-01T00:00:00.000Z', []);
    for (var i = 0; i < data.length; ++i) {
      var datum = data[i], date = dates[i];
      util.fillInUTCInfo(datum, date);
    }
    var offsets = _.uniq(_.pluck(data, 'timezoneOffset'));
    expect(offsets.length).to.equal(2);
    expect(offsets).to.deep.equal([-420, -360]);
  });
  
  it('applies the offsets inferred from `changes`, resulting in no gaps or overlaps', function(done){
    this.timeout(5000);
    setTimeout(function() {
      var data = [], index = 0;
      var datetimesHomeAgain = d3.time.minute.utc.range(
        new Date('2015-04-19T05:05:00'),
        new Date('2015-05-01T00:00:00'),
        5
      );
      var datetimesInNZ = d3.time.minute.utc.range(
        new Date('2015-04-10T19:05:00'),
        new Date('2015-04-20T00:05:00'),
        5
      );
      var datetimesBeforeTrip = d3.time.minute.utc.range(
        new Date('2015-04-01T00:00:00'),
        new Date('2015-04-10T00:05:00'),
        5
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
      var fromNZ = builder.makeDeviceMetaTimeChange()
        .with_change({
          from: '2015-04-20T00:02:30',
          to: '2015-04-19T05:03:00'
        })
        .with_deviceTime('2015-04-20T00:00:00')
        .set('jsDate', new Date('2015-04-20T00:00:00'))
        .set('index', 10489);
      var toNZ = builder.makeDeviceMetaTimeChange()
        .with_change({
          from: '2015-04-10T00:02:30',
          to: '2015-04-10T19:02:00'
        })
        .with_deviceTime('2015-04-10T00:02:30')
        .set('jsDate', new Date('2015-04-10T00:02:30'))
        .set('index', 5185);
      var util = new TZOUtil('US/Pacific', '2015-06-01T00:00:00.000Z', [toNZ, fromNZ]);
      for (var i = 0; i < data.length; ++i) {
        var datum = data[i], date = datetimes[i];
        util.fillInUTCInfo(datum, date);
      }
      var byTime = _.sortBy(data, function(d) { return d.time; });
      var byIndex = _.sortBy(data, function(d) { return d.index; });
      expect(byTime).to.deep.equal(byIndex);
      var deviceTimes = _.pluck(data, 'deviceTime');
      var uniqDeviceTimes = _.uniq(deviceTimes);
      // given the time changes involved, device times are *not*
      // expected to be unique, hence the length of arrays should vary
      expect(deviceTimes.length).not.to.equal(uniqDeviceTimes.length);
      var times = _.pluck(data, 'time');
      var uniqTimes = _.uniq(times);
      // but UTC times should *always* be unique, even with travel!
      // so the length of arrays should stay the same, even when reducing to unique
      expect(times.length).to.equal(uniqTimes.length);
      done();
    }, 50);
  });
});