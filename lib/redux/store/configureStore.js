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

/* global __REDUX_DEV_UI__, __REDUX_LOG__ */

import { compose, createStore } from 'redux';

import api from '../../core/api';
import config from '../../config';
api.create({
  apiUrl: config.API_URL,
  uploadUrl: config.UPLOAD_URL,
  dataservicesUrl: config.DATASERVICES_URL,
  version: config.version
});

// without this, right-click env-changing menu won't work!
window.api = api;

import uploader from '../reducers/';

import DevTools from '../../components/DevTools';

let middlewares;

if (__REDUX_LOG__ === true) {
  middlewares = require('./middlewares.dev.js')(api);
} else {
  middlewares = require('./middlewares.prod.js')(api);
}

let finalCreateStore;

if (__REDUX_DEV_UI__ === true) {
  finalCreateStore = compose(
    middlewares,
    DevTools.instrument()
  )(createStore);
}
else {
  finalCreateStore = compose(middlewares)(createStore);
}

export default function configureStore(initialState) {
  const store = finalCreateStore(uploader, initialState);
  return { api, store, version: config.version};
}
