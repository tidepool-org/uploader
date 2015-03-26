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

/* global beforeEach, describe, it */

var expect = require('salinity').expect;

var UploaderError = require('../../lib/core/uploaderError.js');

describe('UploaderError', function(){

  var errToTest = new UploaderError('Oh noes',{ Code: 'E_TEST' , Message: 'Test', Step: 'Loading' });
  describe('message', function(){
    it('set as given message', function(){
      expect(errToTest.message).to.equal('Oh noes');
    });
    it('set as wrapped error message if not overridden', function(){
      var originalError = new Error('the original error we caught');
      var err = new UploaderError('',{ Code: 'E_TEST_OTHER_PART_A' , Message: 'Test' }, originalError);
      var errTwo = new UploaderError('',{ Code: 'E_TEST_OTHER_PART_B' , Message: 'Test_2' }, err);
      expect(errTwo.message).to.equal(originalError.message);
    });
    it('set from wrapped error', function(){
      var originalError = {error: "Request failed with statusCode 500", code: null, message: null};
      var ule = new UploaderError('',{ Code: 'E_TEST_OTHER_PART_B' , Message: 'Test_2' }, originalError);
      expect(ule.message).to.equal(originalError.error);
    });
  });
  it('debug', function(){
    expect(errToTest.debug).to.include(UploaderError.CODE);
    expect(errToTest.debug).to.include('E_TEST');
    expect(errToTest.debug).to.include(UploaderError.UTC_TIME);
    expect(errToTest.debug).to.include('Oh noes');
    expect(errToTest.debug).to.include(UploaderError.STEP);
    expect(errToTest.debug).to.include('Loading');
  });
  it('debug when no step set', function(){
    var errToTest = new UploaderError('Oh noes',{ Code: 'E_TEST' , Message: 'Test', Step: '' });
    expect(errToTest.debug).to.include(UploaderError.CODE);
    expect(errToTest.debug).to.include('E_TEST');
    expect(errToTest.debug).to.include(UploaderError.UTC_TIME);
    expect(errToTest.debug).to.include('Oh noes');
    expect(errToTest.debug).to.not.include(UploaderError.STEP);
  });
  it('name', function(){
    expect(errToTest.name).to.equal('UploaderError');
  });
  it('originalError when none passed', function(){
    expect(errToTest.originalError).to.be.empty;
  });
  it('originalError when passed', function(){
    var errorToWarp = new Error('error to wrap');
    var err = new UploaderError('Something bad happened',{ Code: 'E_TEST_OTHER' , Message: 'Test', Step: 'Loading' },errorToWarp);
    expect(err.originalError).to.deep.equal({'originalError':errorToWarp});
  });
  it('step is set from originalError', function(){
    var errorToWarp = new Error('error to wrap w step');
    errorToWarp.step = 'carelink_parsefile';
    var err = new UploaderError('Something bad happened',{ Code: 'E_TEST_OTHER' , Message: 'Test', Step: 'Loading' },errorToWarp);
    expect(err.debug).to.include(errorToWarp.step);
  });
  it('keep wrapping errors', function(){
    var originalError = new Error('the original error we caught');
    var firstUploaderError = new UploaderError('',{ Code: 'E_TEST_OTHER_PART_A' , Message: 'Test' }, originalError);
    expect(firstUploaderError.originalError).to.deep.equal({'originalError':originalError});
    var secondUploaderError = new UploaderError('',{ Code: 'E_TEST_OTHER_PART_B' , Message: 'Test_2' }, firstUploaderError);
    expect(secondUploaderError.originalError).to.deep.equal({'originalError':firstUploaderError});
  });
});
