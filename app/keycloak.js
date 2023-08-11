import Keycloak from 'keycloak-js/dist/keycloak.js';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ReactKeycloakProvider } from '@react-keycloak/web';
import { useSelector, useStore } from 'react-redux';
import _ from 'lodash';
import * as jose from 'jose';
import * as ActionTypes from './constants/actionTypes';
import { sync, async } from './actions';
import api from '../lib/core/api';
import { ipcRenderer } from 'electron';
import rollbar from './utils/rollbar';

export let keycloak = null;

let _keycloakConfig = {};
let refreshTimeout = null;

export const setTokenRefresh = (tokenParsed) => {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
  let timeskew = keycloak?.timeSkew ?? 0;
  let expiresIn = (tokenParsed.exp - new Date().getTime() / 1000 + timeskew) * 1000;
  refreshTimeout = setTimeout(() => { keycloak.updateToken(-1); }, expiresIn - 10000);
};

const updateKeycloakConfig = (info, store) => {
  if (!_.isEqual(_keycloakConfig, info)) {
    if (info?.url && info?.realm) {
      keycloak = new Keycloak({
        url: info.url,
        realm: info.realm,
        clientId: 'tidepool-uploader-sso',
      });
      store.dispatch(sync.keycloakInstantiated());
    } else {
      keycloak = null;
    }

    _keycloakConfig = info;
  }
};

let latestKeycloakEvent = null;

const onKeycloakEvent = (store) => (event, error) => {
  latestKeycloakEvent = event;
  switch (event) {
    case 'onReady': {
      let logoutUrl = keycloak.createLogoutUrl({
        redirectUri: 'tidepooluploader://localhost/keycloak-redirect'
      });
      store.dispatch(sync.keycloakReady(event, error, logoutUrl));
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
      store.dispatch(async.doLoggedOut());
      break;
    }
    case 'onTokenExpired': {
      store.dispatch(sync.keycloakTokenExpired(event, error));
      break;
    }
    case 'onAuthLogout': {
      store.dispatch(sync.keycloakAuthLogout(event, error));
      store.dispatch(async.doLoggedOut());
      break;
    }
    default:
      break;
  }
};

const onKeycloakTokens = (store) => (tokens) => {
  if (tokens?.token) {
    store.dispatch(sync.keycloakTokensReceived(tokens));
    let tokenParsed;
    try {
      tokenParsed = jose.decodeJwt(tokens?.token);
    } catch (e) {
      if (rollbar) {
        rollbar.error('keycloak token decode error', {
          error: e,
          tokens,
        });
      }
      store.dispatch(async.doLoggedOut());
      return;
    }

    if(tokenParsed?.sub && tokenParsed?.exp) {
      api.user.saveSession(tokenParsed.sub, tokens.token, {
        noRefresh: true,
      });

      // this should be a reference to the same object property
      if (tokens.token !== keycloak?.token) {
        if (rollbar) {
          rollbar.info('keycloak token mismatch', {
            keycloakToken: keycloak?.token ? jose.decodeJwt(keycloak?.token) : {},
            tokensToken: tokenParsed,
          });
        }
      }

      if (!store.getState().loggedInUser) {
        store.dispatch(async.doLogin());
      }
      setTokenRefresh(tokenParsed);
    } else {
      // if we don't have a sub and exp, we can't save the session
      if (rollbar) {
        rollbar.error('keycloak token missing sub or exp', {
          tokenParsed,
        });
      }
      store.dispatch(async.doLoggedOut());
      return;
    }
  } else {
    const expectedEvents = [
      'onReady',
      'onAuthLogout',
      'onAuthRefreshError',
      'onAuthError',
      'onInitError'
    ];
    if (expectedEvents.includes(latestKeycloakEvent)) {
      return;
    }

    // if we don't have a token, we can't save the session
    if(rollbar) {
      rollbar.error('keycloak token missing', {
        tokens,
      });
    }
    store.dispatch(async.doLoggedOut());
  }
};

export const keycloakMiddleware = (api) => (storeAPI) => (next) => (action) => {
  switch (action.type) {
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
    case ActionTypes.LOGOUT_SUCCESS:
    case ActionTypes.LOGOUT_FAILURE: {
      keycloak.clearToken();
    }
    default:{
      if (
        action?.error?.status === 401 ||
        action?.error?.originalError?.status === 401 ||
        action?.error?.status === 403 ||
        action?.error?.originalError?.status === 403 ||
        action?.payload?.status === 401 ||
        action?.payload?.originalError?.status === 401 ||
        action?.payload?.status === 403 ||
        action?.payload?.originalError?.status === 403
      ) {
        // on any action with a 401 or 403, we try to refresh to keycloak token to verify
        // if the user is still logged in
        keycloak.updateToken(-1);
      }
      break;
    }
  }
  return next(action);
};

let hashChanges = [];

let keyCount = 0;

export const KeycloakWrapper = (props) => {
  const keycloakConfig = useSelector((state) => state.keycloakConfig);
  const blipUrl = useSelector((state) => state.blipUrls.blipUrl);
  const blipRedirect = useMemo(() => {
    if (!blipUrl) return null;
    let url = new URL(`${blipUrl}upload-redirect`);
    return url.href;
  }, [blipUrl]);
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);
  const store = useStore();
  const initOptions = useMemo(
    () => ({
      checkLoginIframe: false,
      enableLogging: process.env.NODE_ENV === 'development',
      redirectUri: blipRedirect,
    }),
    [blipRedirect]
  );

  const onEvent = useCallback(onKeycloakEvent(store), [store]);
  const onTokens = useCallback(onKeycloakTokens(store), [store]);

  // watch for hash changes and re-instantiate the authClient and force a re-render of the provider
  // incrementing externally defined `key` forces unmount/remount as provider doesn't expect to
  // have the authClient refreshed and only sets up refresh timeout on mount
  const onHashChange = useCallback(() => {
    // we only want to do this once per hash since people can hit the launch button multiple times
    if (!hashChanges.includes(window.location.hash)) {
      hashChanges.push(window.location.hash);

      keycloak = new Keycloak({
        url: keycloakConfig.url,
        realm: keycloakConfig.realm,
        clientId: 'tidepool-uploader-sso',
      });
      keyCount++;
      forceUpdate();
    }
  }, [keycloakConfig.realm, keycloakConfig.url, blipRedirect]);

  useEffect(() => {
    window.addEventListener('hashchange', onHashChange, false);
    return () => {
      window.removeEventListener('hashchange', onHashChange, false);
    };
  }, [onHashChange]);

  // clear the refresh timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
    };
  }, []);

  if (keycloakConfig.url && keycloakConfig.instantiated && blipRedirect) {
    return (
      <ReactKeycloakProvider
        authClient={keycloak}
        onEvent={onEvent}
        onTokens={onTokens}
        initOptions={initOptions}
        key={keyCount}
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
