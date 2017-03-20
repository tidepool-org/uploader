import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { hashHistory } from 'react-router';
import { routerMiddleware } from 'react-router-redux';
import rootReducer from '../reducers';
import api from '../../lib/core/api';
import config from '../../lib/config';
import { createErrorLogger } from '../utils/errors';
import { createMetricsTracker } from '../utils/metrics';

api.create({
  apiUrl: config.API_URL,
  uploadUrl: config.UPLOAD_URL,
  dataUrl: config.DATA_URL,
  version: config.version
});

const router = routerMiddleware(hashHistory);

const enhancer = applyMiddleware(
  thunk,
  router,
  createErrorLogger(api),
  createMetricsTracker(api)
);

export default function configureStore(initialState) {
  return createStore(rootReducer, initialState, enhancer); // eslint-disable-line
}
