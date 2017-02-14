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
var _ = require('lodash');
var debug = require('../../bows')('RemoveOverlaps');

var RAW_DEVICE_TYPE = 'Raw-Device Type';
var RAW_SEQ_NUM = 'Raw-Seq Num';
var RAW_TYPE = 'Raw-Type';
var RAW_UPLOAD_ID = 'Raw-Upload ID';
var TIMESTAMP = 'Timestamp';

module.exports = function(payload) {
  var supportedModels = {
    'Paradigm Revel - 523': true,
    'Paradigm Revel - 723': true,
    'Paradigm Veo - 554': true,
    'Paradigm Veo - 754': true,
    'MiniMed 530G - 551': true,
    'MiniMed 530G - 751': true
  };
  var uploads = {}, uploadIdsInOrder = [];
  for (var i = 0; i < payload.theData.length; ++i) {
    /**
     * The last data dump while uploading is the pump's current settings.
     * The `Raw-Type` for all of these rows starts with `Current`.
     * Stuff that happens to the pump *during* the upload can intervene among these(!)
     * but will have the Upload ID of the *next* upload D:
     * So we just ignore all `Current`* for the purposes of judging upload overlap.
     */
    if (payload.theData[i][RAW_TYPE].search('Current') === -1) {
      var currIndex = payload.theData[i].csvIndex;
      if (uploads[payload.theData[i][RAW_UPLOAD_ID]] != null) {
        var currStart = uploads[payload.theData[i][RAW_UPLOAD_ID]].start;
        var currEnd = uploads[payload.theData[i][RAW_UPLOAD_ID]].end;
        if (!currEnd || currIndex > currEnd) {
          uploads[payload.theData[i][RAW_UPLOAD_ID]].end = currIndex;
        }
        if (currIndex < currStart) {
          uploads[payload.theData[i][RAW_UPLOAD_ID]].start = currIndex;
        }
      }
      else {
        uploads[payload.theData[i][RAW_UPLOAD_ID]] = {
          id: payload.theData[i][RAW_UPLOAD_ID].toString(),
          start: payload.theData[i].csvIndex,
          device: payload.theData[i][RAW_DEVICE_TYPE],
          supported: Boolean(supportedModels[payload.theData[i][RAW_DEVICE_TYPE]])
        };
      }
    }
  }
  if (_.some(uploads, {supported: false})) {
    return {};
  }
  uploadIdsInOrder = _.map(
    _.sortBy(uploads, function(upload) { return upload.start; }),
    function(upload) { return upload.id; }
  );
  var lastUploadId = uploadIdsInOrder[uploadIdsInOrder.length - 1];
  for (var j = 0; j < uploadIdsInOrder.length; ++j) {
    if (j+1 === uploadIdsInOrder.length) {
      break;
    }
    if (uploads[uploadIdsInOrder[j]].end > uploads[uploadIdsInOrder[j+1]].start &&
      uploads[uploadIdsInOrder[j]].device === uploads[uploadIdsInOrder[j+1]].device) {
      debug('Found overlapping uploads! Returning only most recent upload for processing.');
      payload.skippedUploads = _.pluck(_.omit(uploads, lastUploadId), 'id');
      return _.pick(uploads, lastUploadId);
    }
  }

  payload.skippedUploads = [];
  return uploads;
};
