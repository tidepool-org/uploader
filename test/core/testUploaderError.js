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

  var errToTest = new UploaderError('Yay',{ Code: 'E_TEST' , Message: 'Test', Step: 'Loading' });

  it('message', function(){
    expect(errToTest.message).to.include(UploaderError.STAGE);
    expect(errToTest.message).to.include(UploaderError.UTC_TIME);
    expect(errToTest.message).to.include('Yay');
  });
  it('name', function(){
    expect(errToTest.name).to.equal('UploaderError');
  });
  it('code', function(){
    expect(errToTest.code).to.equal('E_TEST');
  });
  it('step', function(){
    expect(errToTest.step).to.equal('Loading');
  });
  it('originalError when none passed', function(){
    expect(errToTest.originalError).to.be.empty;
  });
  it('originalError when none passed', function(){
    var errorToWarp = new Error('error to wrap');
    var err = new UploaderError('Yay',{ Code: 'E_TEST' , Message: 'Test', Step: 'Loading' },errorToWarp);
    expect(err.originalError).to.deep.equal(errorToWarp);
  });
});
