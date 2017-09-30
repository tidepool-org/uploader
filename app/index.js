import _ from 'lodash';
import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { Route } from 'react-router-dom';
import { push } from 'react-router-redux';
import { ipcRenderer } from 'electron';
import { ConnectedRouter } from 'react-router-redux';
import createHistory from 'history/createHashHistory';

import config from '../lib/config';
window.DEBUG = config.DEBUG;
import configureStore from './store/configureStore';
import api from '../lib/core/api';
import App from './containers/App';
import './app.global.css';
import '../styles/main.less';


const history = createHistory();

const store = configureStore(undefined, history);
store.dispatch(push('/'));

// This is the communication mechanism for receiving actions dispatched from
// the `main` Electron process. `action` should always be the resulting object
// from an action creator.
ipcRenderer.on('action', function(event, action) {
  store.dispatch(action);
});

render(
  <Provider store={store}>
		<ConnectedRouter history={history}>
			<Route path="/" render={(props)=><App api={api} {...props}/>} ></Route>
		</ConnectedRouter>
  </Provider>,
  document.getElementById('app')
);
