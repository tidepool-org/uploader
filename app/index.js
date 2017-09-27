import rollbar from './utils/rollbar';
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
