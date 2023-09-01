import { hot } from 'react-hot-loader';
import rollbar from '../utils/rollbar';
import _ from 'lodash';
import React from 'react';
import { Provider } from 'react-redux';
import { Route } from 'react-router-dom';
import { push } from 'connected-react-router';
import { ConnectedRouter } from 'connected-react-router';
import { createBrowserHistory, createMemoryHistory } from 'history';

import env from '../utils/env';
import { ipcRenderer } from '../utils/ipc';
import config from '../../lib/config';
window.DEBUG = config.DEBUG;
import configureStore from '../store/configureStore';
import App from './App';
import '..//app.global.css';
import '../../styles/main.less';
import { KeycloakWrapper } from '../keycloak';

let history;
if (env.electron) {
  history = createMemoryHistory();
} else {
  history = createBrowserHistory();
}

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

// const AppContainer = process.env.PLAIN_HMR ? Fragment : ReactHotAppContainer;
const Top = () => (
  <Provider store={store}>
    <ConnectedRouter history={history}>
      <KeycloakWrapper>
        <Route path="/" render={(props) => <App {...props} />} />
      </KeycloakWrapper>
    </ConnectedRouter>
  </Provider>
);
export default hot(module)(Top);
