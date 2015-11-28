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

var expect = require('salinity').expect;

var getIn = require('../../lib/core/getIn');

describe('getIn', function() {
  var obj = {
    a: {
      b: {
        c: 3
      }
    }
  };
  it('should be a function', function() {
    expect(typeof getIn).to.equal('function');
  });

  it('should return a value from following a path of nested object keys', function() {
    expect(getIn(obj, ['a', 'b', 'c'])).to.equal(3);
  });

  it('should return `undefined` by default if value not found', function() {
    expect(getIn(obj, ['a', 'b', 'd'])).to.equal(undefined);
  });

  it('should return the specified value for `notFound` if value not found', function() {
    expect(getIn(obj, ['a', 'b', 'd'], null)).to.equal(null);
    expect(getIn(obj, ['a', 'b', 'd'], 'foo')).to.equal('foo');
  });
});