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

var lookupMaker = require('../lib/timezoneOffsetLookup');

describe('timezoneOffsetLookup.js', function(){
  it('is a function', function(){
    expect(typeof lookupMaker).to.equal('function');
  });

  it('returns an object', function(){
    var lookup = lookupMaker('US/Pacific', '2015-01-01T00:00:00.000Z', []);
    expect(typeof lookup).to.equal('object');
  });

  it('throws an error if a named timezone not provided as first param', function(){
    var fn = function() { lookupMaker('foo', '2015-01-01T00:00:00.000Z', '2015-01-01T00:00:00.000Z', []); };
    expect(fn).to.throw('Unrecognized timezone name!');
  });

  it('throws an error if a valid timestamp is not provided as second param', function(){
    var fn = function() { lookupMaker('US/Pacific', 'foo', []); };
    expect(fn).to.throw('Invalid timestamp for most recent datum!');
  });

  it('defaults to accross-the-board timezone application if no `changes` provided as third param', function(){
    var lookup = lookupMaker('US/Eastern', '2015-01-01T00:00:00.000Z', []);
    expect(lookup.fn(new Date('2015-04-01T00:00:00'))).to.deep.equal({
      time: '2015-04-01T04:00:00.000Z',
      timezoneOffset: -240
    });
  });

  it('throws an error if `changes` not empty and not all events are `timeChange`', function(){
    var fn = function() { lookupMaker('US/Eastern', '2015-01-01T00:00:00.000Z', [{type: 'foo'}]); };
    expect(fn).to.throw(Error);
  });
});