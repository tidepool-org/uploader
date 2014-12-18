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
var debug = require('../bows')('RemoveOverlaps');

module.exports = function(payload) {
  var supportedModels = {
    'Paradigm 522': true,
    'Paradigm 722': true,
    'Paradigm Revel - 523': true,
    'Paradigm Revel - 723': true,
    'Paradigm Veo - 554': true,
    'MiniMed 530G - 551': true
  };
  var uploads = {}, uploadIdsInOrder = [];
  for (var i = 0; i < payload.theData.length; ++i) {
    if (supportedModels[payload.theData[i]['Raw-Device Type']] &&
      payload.theData[i]['Raw-Type'] !== 'ResultDailyTotal' &&
      payload.theData[i]['Raw-Type'] !== 'SensorTimestamp') {
      if (uploads[payload.theData[i]['Raw-Upload ID']] != null) {
        uploads[payload.theData[i]['Raw-Upload ID']].end = payload.theData[i].deviceTime;
      }
      else {
        uploadIdsInOrder.push(payload.theData[i]['Raw-Upload ID']);
        uploads[payload.theData[i]['Raw-Upload ID']] = {
          start: payload.theData[i].deviceTime,
          device: payload.theData[i]['Raw-Device Type']
        };
      }
    }
  }
  for (var j = 0; j < uploadIdsInOrder.length; ++j) {
    if (j+1 === uploadIdsInOrder.length) {
      break;
    }
    if (uploads[uploadIdsInOrder[j]].end > uploads[uploadIdsInOrder[j+1]].start &&
      uploads[uploadIdsInOrder[j]].device === uploads[uploadIdsInOrder[j+1]].device) {
      delete uploads[uploadIdsInOrder[j]];
    }
  }

  return uploads;
};