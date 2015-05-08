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

var UploaderError = require('../../lib/core/uploaderError.js');

describe('UploaderError', function(){

  var details = {version: '123', stage: { Code: 'E_TEST' , Message: 'Test', Step: 'Loading' }};
  var errToTest = new UploaderError('Oh noes', details);

  describe('message', function(){
    it('set as given message', function(){
      expect(errToTest.message).to.equal('Oh noes');
    });
    it('set as wrapped error message if not overridden', function(){
      var originalError = new Error('the original error we caught');
      var err = new UploaderError('',{version: '123', stage:{ Code: 'E_TEST_OTHER_PART_A' , Message: 'Test' }}, originalError);
      var errTwo = new UploaderError('',{version: '123', stage: { Code: 'E_TEST_OTHER_PART_B' , Message: 'Test_2' }}, err);
      expect(errTwo.message).to.equal(originalError.message);
    });
    it('set from wrapped error', function(){
      var originalError = {error: 'Request failed with statusCode 500', code: null, message: null};
      var ule = new UploaderError('',{version: '123', stage:{ Code: 'E_TEST_OTHER_PART_B' , Message: 'Test_2' }}, originalError);
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
    expect(errToTest.debug).to.include(UploaderError.VERSION);
    expect(errToTest.debug).to.include('123');
  });
  it('stack', function(){
    expect(errToTest.stack).to.not.be.empty;
  });
  it('debug when no step set', function(){
    var errToTest = new UploaderError('Oh noes',{version: '123', stage:{ Code: 'E_TEST' , Message: 'Test', Step: '' }});
    expect(errToTest.debug).to.include(UploaderError.CODE);
    expect(errToTest.debug).to.include('E_TEST');
    expect(errToTest.debug).to.include(UploaderError.UTC_TIME);
    expect(errToTest.debug).to.include('Oh noes');
    expect(errToTest.debug).to.include(UploaderError.VERSION);
    expect(errToTest.debug).to.include('123');
    expect(errToTest.debug).to.not.include(UploaderError.STEP);

  });
  it('name', function(){
    expect(errToTest.name).to.equal('UploaderError');
  });

  it('toString', function(){
    expect(errToTest.toString()).to.not.be.empty;
    var aString = errToTest.toString();

    expect(aString).to.include(' stack:');
    expect(aString).to.include(String(errToTest.stack));
    expect(aString).to.include(' debug:');
    expect(aString).to.include(String(errToTest.debug));
    expect(aString).to.include(' message:');
    expect(aString).to.include(String(errToTest.message));
    expect(aString).to.include(errToTest.name);
  });
  it('step is set from originalError', function(){
    var errorToWarp = new Error('error to wrap w step');
    errorToWarp.step = 'carelink_parsefile';
    var err = new UploaderError('Something bad happened',{version: '123', stage:{ Code: 'E_TEST_OTHER' , Message: 'Test', Step: 'Loading' }},errorToWarp);
    expect(err.debug).to.include(errorToWarp.step);
  });
});
