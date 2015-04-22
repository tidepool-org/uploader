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

function stackTrace(otherError){
  if(otherError && otherError.stack){
    return otherError.stack;
  }
  //workaround to get the current stack see https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
  var err = new Error();
  return err.stack;
}

// creates our debug info from the details passed
function buildDebug(message, details, otherError){

  var stage = details.stage;
  var theStep = stage.Step || '';

  if(otherError && otherError.step){
    theStep = ' | '+UploaderError.STEP +' '+otherError.step;
  } else if (theStep) {
    theStep = ' | '+UploaderError.STEP +' '+theStep;
  }

  return [
    message || otherError.message ,'|',
    UploaderError.UTC_TIME, sundial.utcDateString(),'|',
    UploaderError.VERSION, details.version,'|',
    UploaderError.CODE, stage.Code,'|',
    UploaderError.CODE_MSG, stage.Message,
    theStep
  ].join(' ');
}

function toString(){

  var name = this.name;
  name = (name === undefined) ? 'Error' : String(name);

  var msg = this.message;
  msg = (msg === undefined) ? '' : String(msg);

  var debug = this.debug;
  debug = (debug === undefined) ? '' : String(debug);

  var stack = this.stack;
  stack = (stack === undefined) ? '' : String(stack);

  if (name === '') {
    return msg;
  }
  if (msg === '') {
    return name;
  }

  return name + ' message: [' + msg + '] debug: [' + debug + '] stack: [' + stack+']';
}

// Create a new object, that prototypally inherits from the Error constructor.
function UploaderError(message, details, otherError) {
  this.name = this.constructor.name;

  this.message = message;

  if (otherError && otherError.message) {
    this.message = this.message || otherError.message;
  } else if (otherError && otherError.error) {
    //sometimes they aren't actual errors but wrapped from service calls
    this.message = this.message || otherError.error;
  }

  this.debug = buildDebug(message, details, otherError);
  this.stack = stackTrace(otherError);
}

UploaderError.UTC_TIME = 'UTC Time:';
UploaderError.VERSION = 'Version:';
UploaderError.CODE = 'Code:';
UploaderError.CODE_MSG = 'Detail:';
UploaderError.STEP = 'Step:';

UploaderError.prototype = Object.create(Error.prototype);
UploaderError.prototype.constructor = UploaderError;
UploaderError.prototype.toString = toString;

exports = module.exports = UploaderError;