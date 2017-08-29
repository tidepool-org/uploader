/* global  __VERSION_SHA__ */
import _ from 'lodash';
import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { Router, hashHistory } from 'react-router';
import { syncHistoryWithStore, push } from 'react-router-redux';
import config from '../lib/config';
window.DEBUG = config.DEBUG;
import routes from './routes';
import configureStore from './store/configureStore';
import './app.global.css';
import '../styles/main.less';
import { ipcRenderer } from 'electron';
import Raven from 'raven-js';
import Rollbar from 'rollbar/dist/rollbar.umd';

let rollbar = new Rollbar({
    accessToken: '1843589282464f4facd43f794c8201a8',
    captureUncaught: true,
    payload: {
        environment: 'test',
        client: {
          javascript: {
            code_version: __VERSION_SHA__,
            guess_uncaught_frames: true
          }
        }
    },
    // to deal with URI's as local filesystem paths, we use the "many domain" transform:
    // https://rollbar.com/docs/source-maps/#using-source-maps-on-many-domains
    transform: function(payload) {
      var trace = payload.body.trace;
      if (trace && trace.frames) {
        for (var i = 0; i < trace.frames.length; i++) {
          var filename = trace.frames[i].filename;
          if (filename) {
            trace.frames[i].filename = 'http://dynamichost/dist/bundle.js';
          }
        }
      }
    }
  }
);

Raven.config('https://ae50ed563cf24caab8ed7f469b0b0c78@sentry.io/183894', {
  autoBreadcrumbs: {
    'console': true  // console logging
  }
}).install();

const store = configureStore();
const history = syncHistoryWithStore(hashHistory, store);
store.dispatch(push('/'));

// This is the communication mechanism for receiving actions dispatched from
// the `main` Electron process. `action` should always be the resulting object
// from an action creator.
ipcRenderer.on('action', function(event, action) {
  store.dispatch(action);
});

render(
  <Provider store={store}>
    <Router history={history} routes={routes} />
  </Provider>,
  document.getElementById('app')
);
