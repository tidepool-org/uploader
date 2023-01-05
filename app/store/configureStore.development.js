import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import { routerMiddleware, push } from 'connected-react-router';
import rootReducer from '../reducers';
import { async, sync } from '../actions';
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

const actionCreators = {
  ...async,
  ...sync,
  push,
};

export default function configureStore(initialState, history) {
  const router = routerMiddleware(history);

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
      createErrorLogger(api),
      createMetricsTracker(api),
      keycloakMiddleware(api),
    )
  );

  const store = createStore(rootReducer(history), initialState, enhancer);

  if (module.hot) {
    module.hot.accept('../reducers', () =>
      store.replaceReducer(require('../reducers')(history)).default // eslint-disable-line global-require
    );
  }

  return store;
}

export { api };
