/* global __REDUX_DEV_UI__, __REDUX_LOG__ */

import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import { hashHistory } from 'react-router';
import { routerMiddleware, push } from 'react-router-redux';
import createLogger from 'redux-logger';
import rootReducer from '../reducers';
import { async, sync } from '../actions';
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

const noop = function(middlewareAPI){
  return function(next){
    return function(action){
      return next(action);
    };
  };
};

const actionCreators = {
  ...async,
  ...sync,
  push,
};

const logger = __REDUX_LOG__ ? createLogger({
  level: 'info',
  collapsed: true
}) : noop;

const router = routerMiddleware(hashHistory);

// If Redux DevTools Extension is installed use it, otherwise use Redux compose
/* eslint-disable no-underscore-dangle */
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ?
  window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
    // Options: http://zalmoxisus.github.io/redux-devtools-extension/API/Arguments.html
    actionCreators,
  }) :
  compose;
/* eslint-enable no-underscore-dangle */
const enhancer = composeEnhancers(
  applyMiddleware(
    thunk,
    router,
    logger,
    createErrorLogger(api),
    createMetricsTracker(api)
  )
);

export default function configureStore(initialState) {
  const store = createStore(rootReducer, initialState, enhancer);

  if (module.hot) {
    module.hot.accept('../reducers', () =>
      store.replaceReducer(require('../reducers')) // eslint-disable-line global-require
    );
  }

  return store;
}

export { api };
