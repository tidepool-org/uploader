import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { routerMiddleware } from 'connected-react-router';
import rootReducer from '../reducers';
import api from '../../lib/core/api';
import config from '../../lib/config';
import { createErrorLogger } from '../utils/errors';
import { createMetricsTracker } from '../utils/metrics';
import { keycloakMiddleware } from '../keycloak';

api.create({
  apiUrl: config.API_URL,
  uploadUrl: config.UPLOAD_URL,
  dataUrl: config.DATA_URL,
  version: config.version
});

export default function configureStore(initialState, history) {
  const router = routerMiddleware(history);
  const enhancer = applyMiddleware(
    thunk,
    router,
    createErrorLogger(api),
    createMetricsTracker(api),
    keycloakMiddleware(api),
  );

  return createStore(rootReducer(history), initialState, enhancer); // eslint-disable-line
}
