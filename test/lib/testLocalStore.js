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

/*eslint-env mocha */

var expect = require('chai').expect;

var localStore = require('../../lib/core/localStore');

describe('localStore', () => {
  test('is an object', () => {
    expect(typeof localStore).equals('object');
  });

  describe('localStore.init', () => {
    test('is a function', () => {
      expect(localStore.init).to.exist;
      expect(typeof localStore.init).equals('function');
    });

    test('accepts options and calls cb', () => {
      var key = 'Hello';
      var cb = function() { key = 'world'; };
      localStore.init({foo: 'bar'}, cb);
      expect(key).equals('world');
    });
  });

  describe('localStore.getInitialState', () => {
    test('is a function', () => {
      expect(localStore.getInitialState).to.exist;
      expect(typeof localStore.getInitialState).equals('function');
    });
  });

  describe('localStore.getItem', () => {
    var data = 'awesome_data';

    beforeAll(function(){
      localStore.setItem('blocks', data);
    });

    test('is a function', () => {
      expect(localStore.getItem).to.exist;
      expect(typeof localStore.getItem).equals('function');
    });

    test('retrieves an item from the store', () => {
      expect(localStore.getItem('blocks', console.log)).deep.equals(data);
    });
  });

  describe('localStore.setItem', () => {
    test('is a function', () => {
      expect(localStore.setItem).to.exist;
      expect(typeof localStore.setItem).equals('function');
    });

    test('adds an item to the store', () => {
      localStore.setItem('foo', 'bar');
      expect(localStore.getItem('foo')).equals('bar');
    });

    test('overwrites an existing item', () => {
      localStore.setItem('foo', 'blocks');
      expect(localStore.getItem('foo')).equals('blocks');
    });
  });
});
