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

const NONE_PROVIDED = 'No Event Name Provided';

export function createMetricsTracker(api) {
  return (store) => (next) => (action) => {
    let { selectedClinicId } = store.getState();
    let defaultProperties = selectedClinicId ? { clinicId: selectedClinicId } : {};
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
