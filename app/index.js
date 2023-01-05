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
import { createMemoryHistory } from 'history';
import { KeycloakWrapper } from './keycloak';

import config from '../lib/config';
window.DEBUG = config.DEBUG;
import configureStore from './store/configureStore';
import App from './containers/App';
import './app.global.css';
import '../styles/main.less';

import localStore from '../lib/core/localStore';
localStore.init(localStore.getInitialState(), () => {});

// createHashHistory collides with the keycloak library #state
// createBrowserHistory creates a login loop
const history = createMemoryHistory();

const store = configureStore(undefined, history);
store.dispatch(push('/'));

// This is the communication mechanism for receiving actions dispatched from
// the `main` Electron process. `action` should always be the resulting object
// from an action creator.
ipcRenderer.on('action', function(event, action) {
  store.dispatch(action);
});

ipcRenderer.on('newHash', (e, hash) => {
  window.location.hash = hash;
});

const AppContainer = process.env.PLAIN_HMR ? Fragment : ReactHotAppContainer;

render(
  <AppContainer>
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <KeycloakWrapper>
          <Route path="/" render={(props) => <App {...props} />} />
        </KeycloakWrapper>
      </ConnectedRouter>
    </Provider>
  </AppContainer>,
  document.getElementById('app')
);
