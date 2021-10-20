import rollbar from './utils/rollbar';
import _ from 'lodash';
import React, { Fragment } from 'react';
import { AppContainer as ReactHotAppContainer } from 'react-hot-loader';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { Route } from 'react-router-dom';
import { push } from 'connected-react-router';
import { ipcRenderer } from 'electron';
import { ConnectedRouter } from 'connected-react-router';
import { createHashHistory } from 'history';

import config from '../lib/config';
window.DEBUG = config.DEBUG;
import configureStore from './store/configureStore';
import api from '../lib/core/api';
import App from './containers/App';
import './app.global.css';
import '../styles/main.less';


const history = createHashHistory();

const store = configureStore(undefined, history);
store.dispatch(push('/'));

// This is the communication mechanism for receiving actions dispatched from
// the `main` Electron process. `action` should always be the resulting object
// from an action creator.
ipcRenderer.on('action', function(event, action) {
  store.dispatch(action);
});

const AppContainer = process.env.PLAIN_HMR ? Fragment : ReactHotAppContainer;

render(
  <AppContainer>
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <Route path="/" render={(props)=><App api={api} {...props}/>} ></Route>
      </ConnectedRouter>
    </Provider>
  </AppContainer>,
  document.getElementById('app')
);
