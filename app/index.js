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
import { ipcRenderer, crashReporter } from 'electron';

window._trackJs = {
    token: 'f739b1e86d654970b6ce9170f0e63a33'
};
var trackJs = require('trackjs');

var Raven = require('raven');
Raven.config('https://ae50ed563cf24caab8ed7f469b0b0c78:32643a50ee9241c18b97f0c1ed5ed228@sentry.io/183894',{
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

crashReporter.start({
  productName: 'Uploader',
  companyName: 'Tidepool',
  submitURL: '',
  uploadToServer: false
});

console.log('Crash logs can be found in:',crashReporter.getCrashesDirectory());
console.log('Last crash report:', crashReporter.getLastCrashReport());

render(
  <Provider store={store}>
    <Router history={history} routes={routes} />
  </Provider>,
  document.getElementById('app')
);
