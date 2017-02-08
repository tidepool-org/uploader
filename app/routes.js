import React from 'react';
import { Route, IndexRoute } from 'react-router';
import App from './containers/App';
import HomePage from './containers/HomePage';
import api from '../lib/core/api';
import config from '../lib/config';
api.create({
  apiUrl: config.API_URL,
  uploadUrl: config.UPLOAD_URL,
  dataUrl: config.DATA_URL,
  version: config.version
});

export default (
  <Route path="/" component={App} api={api}>
    <IndexRoute component={HomePage} />
  </Route>
);
