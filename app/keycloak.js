import Keycloak from 'keycloak-js/dist/keycloak.mjs';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ReactKeycloakProvider } from '@react-keycloak/web';
import { useSelector, useStore } from 'react-redux';
import _ from 'lodash';
import * as ActionTypes from './constants/actionTypes';
import { sync, async } from './actions';
import api from '../lib/core/api';
import env from './utils/env';

let ipcRenderer;
if(env.electron_renderer){
  ({ipcRenderer} = require('electron'));
}

export let keycloak = null;

let _keycloakConfig = {};

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

const onKeycloakEvent = (store) => (event, error) => {
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
        if (env.electron_renderer) {
          ipcRenderer.send('keycloakRegistrationUrl', registrationUrl);
        }
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
        if (env.electron_renderer) {
          ipcRenderer.send('keycloakRegistrationUrl', registrationUrl);
        }
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
        action?.error?.originalError?.status === 403
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

let keyCount = 0;

export const KeycloakElectronWrapper = (props) => {
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
    keycloak = new Keycloak({
      url: keycloakConfig.url,
      realm: keycloakConfig.realm,
      clientId: 'tidepool-uploader-sso',
    });
    keyCount++;
    forceUpdate();
  }, [keycloakConfig.realm, keycloakConfig.url, blipRedirect]);

  useEffect(() => {
    window.addEventListener('hashchange', onHashChange, false);
    return () => {
      window.removeEventListener('hashchange', onHashChange, false);
    };
  }, [onHashChange]);

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

export const KeycloakWebWrapper = (props) => {
  const keycloakConfig = useSelector((state) => state.keycloakConfig);
  const store = useStore();
  let Wrapper = React.Fragment;
  let wrapperProps = props;
  const isOauthRedirectRoute = /^(\/upload-redirect)/.test(window?.location?.pathname);
  if (keycloakConfig?.url && !isOauthRedirectRoute && keycloakConfig?.instantiated) {
    Wrapper = ReactKeycloakProvider;
    wrapperProps = {
      ...wrapperProps,

      authClient: keycloak,
      onEvent: onKeycloakEvent(store),
      onTokens: onKeycloakTokens(store),
      initOptions: {
        onLoad: 'check-sso',
        enableLogging: true,

        //redirectUri: blipRedirect,
        //TODO: might be able to use Iframe/silent sso check if we can get CORP headers served
        // by envoy on the 3 3rd-party cookie checking html pages. required because we need
        // SharedArrayBuffer which requires COEP set on our own pages
        //silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        checkLoginIframe: false,
      }
    };
  }

  return <Wrapper {...wrapperProps}>{props.children}</Wrapper>;
};

export const KeycloakWrapper = env.electron ? KeycloakElectronWrapper : KeycloakWebWrapper;

export default {
  keycloak,
  keycloakMiddleware,
};
