// == BSD2 LICENSE ==
// Copyright (c) 2014, Tidepool Project
//
// This program is free software; you can redistribute it and/or modify it under
// the terms of the associated License, which is identical to the BSD 2-Clause
// License as published by the Open Source Initiative at opensource.org.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the License for more details.
//
// You should have received a copy of the License along with this program; if
// not, you can obtain one from Tidepool Project at tidepool.org.
// == BSD2 LICENSE ==

'use strict';

var sundial = require('sundial');

// if another error is passed in then attach it
function attachOriginal(otherError){
  if(otherError){
    return { 'originalError' : otherError };
  }
  return;
}

// creates our debug info from the details passed
function buildDebug(message, stage, otherError){
  var theStep = stage.Step || '';
  if(otherError && otherError.step){
    theStep = UploaderError.STEP +' '+otherError.step;
  } else if (theStep) {
    theStep = UploaderError.STEP +' '+theStep;
  }

  return [
    message || otherError.message ,'|',
    UploaderError.UTC_TIME, sundial.utcDateString(),'|',
    UploaderError.CODE, stage.Code,'|',
    UploaderError.CODE_MSG, stage.Message,'|',
    theStep
  ].join(' ');
}

// Create a new object, that prototypally inherits from the Error constructor.
function UploaderError(message, stage, otherError) {
  this.name = this.constructor.name;
  this.message = message || otherError.message || otherError.error; //sometimes they aren't actual errors but wrapped from service calls
  this.debug = buildDebug(message, stage, otherError);
  this.originalError = attachOriginal(otherError);
}

UploaderError.UTC_TIME = 'UTC Time:';
UploaderError.CODE = 'Code:';
UploaderError.CODE_MSG = 'Detail:';
UploaderError.STEP = 'Step:';

UploaderError.prototype = Object.create(Error.prototype);
UploaderError.prototype.constructor = UploaderError;

exports = module.exports = UploaderError;