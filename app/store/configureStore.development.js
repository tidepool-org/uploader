/* global __REDUX_LOG__ */

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
import { remote } from 'electron';

const {Menu, MenuItem} = remote;

api.create({
  apiUrl: config.API_URL,
  uploadUrl: config.UPLOAD_URL,
  dataUrl: config.DATA_URL,
  version: config.version
});

function setServer(info) {
  var serverdata = {
    Local: {
      API_URL: 'http://localhost:8009',
      UPLOAD_URL: 'http://localhost:9122',
      DATA_URL: 'http://localhost:8077',
      BLIP_URL: 'http://localhost:3000'
    },
    Development: {
      API_URL: 'https://dev-api.tidepool.org',
      UPLOAD_URL: 'https://dev-uploads.tidepool.org',
      DATA_URL: 'https://dev-api.tidepool.org/dataservices',
      BLIP_URL: 'https://dev-blip.tidepool.org'
    },
    Staging: {
      API_URL: 'https://stg-api.tidepool.org',
      UPLOAD_URL: 'https://stg-uploads.tidepool.org',
      DATA_URL: 'https://stg-api.tidepool.org/dataservices',
      BLIP_URL: 'https://stg-blip.tidepool.org'
    },
    Integration: {
      API_URL: 'https://int-api.tidepool.org',
      UPLOAD_URL: 'https://int-uploads.tidepool.org',
      DATA_URL: 'https://int-api.tidepool.org/dataservices',
      BLIP_URL: 'https://int-blip.tidepool.org'
    },
    Production: {
      API_URL: 'https://api.tidepool.org',
      UPLOAD_URL: 'https://uploads.tidepool.org',
      DATA_URL: 'https://api.tidepool.org/dataservices',
      BLIP_URL: 'https://blip.tidepool.org'
    }
  };

  console.log('will use', info.label, 'server');
  var serverinfo = serverdata[info.label];
  api.setHosts(serverinfo);
}

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const { clientX, clientY } = e;
  const menu = Menu.buildFromTemplate([
      {
        label: 'Inspect element',
        click() {
          remote.getCurrentWindow().inspectElement(clientX, clientY);
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Change server',
        submenu: [
          {
            label: 'Local',
            click: setServer
          },
          {
            label: 'Development',
            click: setServer
          },
          {
            label: 'Staging',
            click: setServer
          },
          {
            label: 'Integration',
            click: setServer
          },
          {
            label: 'Production',
            click: setServer
          }
        ]
      }
    ]);
  Menu.setApplicationMenu(menu);
  menu.popup(remote.getCurrentWindow());
}, false);

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
