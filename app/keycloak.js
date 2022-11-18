import Keycloak from 'keycloak-js/dist/keycloak.js';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ReactKeycloakProvider } from '@react-keycloak/web';
import { useSelector, useStore } from 'react-redux';
import _ from 'lodash';
import * as ActionTypes from './constants/actionTypes';
import { sync, async } from './actions';
import api from '../lib/core/api';
import { ipcRenderer } from 'electron';

export let keycloak = null;

let _keycloakConfig = {};

const updateKeycloakConfig = (info, store) => {
  if (!_.isEqual(_keycloakConfig, info)) {
    if (info?.url && info?.realm) {
      keycloak = new Keycloak({
        url: info.url,
        realm: info.realm,
        clientId: 'tidepool-uploader',
      });
      store.dispatch(sync.keycloakInstantiated());
    } else {
      keycloak = null;
    }

    _keycloakConfig = info;
  }
};

const onKeycloakEvent = (store) => (event, error) => {
  switch (event) {
    case 'onReady': {
      store.dispatch(sync.keycloakReady(event, error));
      break;
    }
    case 'onInitError': {
      store.dispatch(sync.keycloakInitError(event, error));
      break;
    }
    case 'onAuthSuccess': {
      store.dispatch(sync.keycloakAuthSuccess(event, error));
      api.user.saveSession(keycloak?.tokenParsed?.sub, keycloak?.token, {
        noRefresh: true,
      });
      store.dispatch(async.doLogin());
      break;
    }
    case 'onAuthError': {
      store.dispatch(sync.keycloakAuthError(event, error));
      break;
    }
    case 'onAuthRefreshSuccess': {
      store.dispatch(sync.keycloakAuthRefreshSuccess(event, error));
      break;
    }
    case 'onAuthRefreshError': {
      store.dispatch(sync.keycloakAuthRefreshError(event, error));
      break;
    }
    case 'onTokenExpired': {
      store.dispatch(sync.keycloakTokenExpired(event, error));
      break;
    }
    case 'onAuthLogout': {
      store.dispatch(sync.keycloakAuthLogout(event, error));
      break;
    }
    default:
      break;
  }
};

const onKeycloakTokens = (store) => (tokens) => {
  if (tokens?.token) {
    store.dispatch(sync.keycloakTokensReceived(tokens));
    api.user.saveSession(keycloak?.tokenParsed?.sub, keycloak?.token, {
      noRefresh: true,
    });
    if (!store.getState().loggedInUser) {
      store.dispatch(async.doLogin());
    }
  }
};

export const keycloakMiddleware = (api) => (storeAPI) => (next) => (action) => {
  switch (action.type) {
    case ActionTypes.LOGOUT_REQUEST: {
      keycloak?.logout();
      break;
    }
    case ActionTypes.FETCH_INFO_SUCCESS: {
      if (!_.isEqual(_keycloakConfig, action.payload?.info?.auth)) {
        updateKeycloakConfig(action.payload?.info?.auth, storeAPI);
      }
      break;
    }
    case ActionTypes.KEYCLOAK_READY: {
      let blipUrl = storeAPI.getState()?.blipUrls?.blipUrl;
      if (blipUrl) {
        let blipHref = new URL(blipUrl).href;
        let registrationUrl = keycloak.createRegisterUrl({
          redirectUri: blipHref,
        });
        ipcRenderer.send('keycloakRegistrationUrl', registrationUrl);
        storeAPI.dispatch(sync.setKeycloakRegistrationUrl(registrationUrl));
      }
      break;
    }
    case ActionTypes.SET_BLIP_URL: {
      let blipUrl = action?.payload?.url;
      let initialized = storeAPI.getState()?.keycloakConfig?.initialized;
      if (blipUrl && initialized && keycloak) {
        let blipHref = new URL(blipUrl).href;
        let registrationUrl = keycloak.createRegisterUrl({
          redirectUri: blipHref,
        });
        ipcRenderer.send('keycloakRegistrationUrl', registrationUrl);
        storeAPI.dispatch(sync.setKeycloakRegistrationUrl(registrationUrl));
      }
      break;
    }
    default:
      break;
  }
  return next(action);
};

export const KeycloakWrapper = (props) => {
  const keycloakConfig = useSelector((state) => state.keycloakConfig);
  const [, setHash] = useState(window.location.hash);
  const store = useStore();
  const initOptions = useMemo(
    () => ({
      onLoad: 'check-sso',
      enableLogging: process.env.NODE_ENV === 'development',
      redirectUri: 'tidepooluploader://localhost/keycloak-redirect'
    }),
    []
  );

  const onEvent = useCallback(onKeycloakEvent(store), [store]);
  const onTokens = useCallback(onKeycloakTokens(store), [store]);

  // watch for hash changes and re-instantiate the authClient and force a re-render of the provider
  const onHashChange = useCallback(() => {
    keycloak = new Keycloak({
      url: keycloakConfig.url,
      realm: keycloakConfig.realm,
      clientId: 'tidepool-uploader',
    });
    setHash(window.location.hash);
  }, [keycloakConfig.realm, keycloakConfig.url]);

  useEffect(() => {
    window.addEventListener('hashchange', onHashChange, false);
    return () => {
      window.removeEventListener('hashchange', onHashChange, false);
    };
  }, [onHashChange]);

  if (keycloakConfig.url && keycloakConfig.instantiated) {
    return (
      <ReactKeycloakProvider
        authClient={keycloak}
        onEvent={onEvent}
        onTokens={onTokens}
        initOptions={initOptions}
      >
        {props.children}
      </ReactKeycloakProvider>
    );
  } else {
    return <React.Fragment>{props.children}</React.Fragment>;
  }
};

export default {
  keycloak,
  keycloakMiddleware,
};
