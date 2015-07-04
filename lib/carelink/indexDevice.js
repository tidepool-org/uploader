/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

var _ = require('lodash');

var RAW_TYPE = 'Raw-Type';
var TIME_CHANGE_CGM = 'ChangeTimeGH';
var uploadIdKey = 'Raw-Upload ID', seqNumKey = 'Raw-Seq Num';

module.exports = function(device, isAPump) {
  function uploadId(d) {
    if (isAPump && d[RAW_TYPE] === TIME_CHANGE_CGM) {
      return d['pumpUploadId'];
    }
    return d[uploadIdKey];
  }
  function seqNum(d) {
    if (isAPump && d[RAW_TYPE] === TIME_CHANGE_CGM) {
      return d['pumpSeqNum'];
    }
    return d[seqNumKey];
  }
  device.data.sort(function(lhs, rhs) {
    if (uploadId(lhs) < uploadId(rhs)) {
      return -1;
    } else if (uploadId(lhs) > uploadId(rhs)) {
      return 1;
    } else if (seqNum(lhs) < seqNum(rhs)) {
      return 1;
    } else if (seqNum(lhs) > seqNum(rhs)) {
      return -1;
    }
    return 0;
  });

  _.each(device.data, function(d, i) {
    d.index = i;
  });

  return device;
};