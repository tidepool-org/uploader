/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2016, Tidepool Project
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

import _ from 'lodash';
import * as actionTypes from '../constants/actionTypes';

const ADD_PATIENT_EVENTS = [
  actionTypes.UPLOAD_REQUEST,
  actionTypes.UPLOAD_FAILURE,
  actionTypes.UPLOAD_SUCCESS,
];

const NONE_PROVIDED = 'No Event Name Provided';

export function createMetricsTracker(api) {
  return (store) => (next) => (action) => {
    const { selectedClinicId, uploadTargetUser } = store.getState();
    const defaultProperties = {};
    if (selectedClinicId) {
      _.extend(defaultProperties, { clinicId: selectedClinicId });
      if (_.includes(ADD_PATIENT_EVENTS, action.type)) {
        _.extend(defaultProperties, { patientID: uploadTargetUser });
      }
    }
    if (_.get(action, 'meta.metric', null) !== null) {
      api.metrics.track(
        _.get(action, 'meta.metric.eventName', NONE_PROVIDED),
        _.defaults(_.get(action, 'meta.metric.properties', {}), defaultProperties)
      );
    }
		if (_.get(action, 'payload.state.meta.metric', null) !== null) {
			api.metrics.track(
        _.get(action, 'payload.state.meta.metric.eventName', NONE_PROVIDED),
        _.defaults(_.get(action, 'payload.state.meta.metric.properties', {}), defaultProperties)
      );
		}
    return next(action);
  };
}
