import { UserManager } from 'oidc-client-ts';
import Keycloak from 'keycloak-js/dist/keycloak.mjs';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AuthProvider } from 'react-oidc-context';
import { useSelector, useStore } from 'react-redux';
import _ from 'lodash';
import * as ActionTypes from './constants/actionTypes.js';
import { sync, async } from './actions/index.js';
import api from '../lib/core/api.js';
import env from './utils/env.js';
import { ipcRenderer } from './utils/ipc.js';

/**
 * @type {Keycloak}
 */
export let keycloak = null;

/**
 * @type {UserManager}
 */
let userManager;

export const oidcMiddleware = api => storeAPI => next => action => {
  switch (action.type) {
    case ActionTypes.KEYCLOAK_READY: {
      const blipUrl = storeAPI.getState()?.blipUrls?.blipUrl;
      if (blipUrl) {
        const blipHref = new URL(blipUrl).href;
        const registrationUrl = keycloak.createRegisterUrl({
          redirectUri: blipHref,
        });
        ipcRenderer.send('keycloakRegistrationUrl', registrationUrl);
        storeAPI.dispatch(sync.setKeycloakRegistrationUrl(registrationUrl));
      }
      break;
    }
    case ActionTypes.SET_BLIP_URL: {
      const blipUrl = action?.payload?.url;
      const initialized = storeAPI.getState()?.keycloakConfig?.initialized;
      if (blipUrl && initialized && keycloak) {
        const blipHref = new URL(blipUrl).href;
        const registrationUrl = keycloak.createRegisterUrl({
          redirectUri: blipHref,
        });
        ipcRenderer.send('keycloakRegistrationUrl', registrationUrl);
        storeAPI.dispatch(sync.setKeycloakRegistrationUrl(registrationUrl));
      }
      break;
    }
    case ActionTypes.LOGOUT_REQUEST: {
      userManager?.removeUser();
      break;
    }
    case ActionTypes.LOGOUT_SUCCESS:
    case ActionTypes.LOGOUT_FAILURE: {
      if (!env.electron) {
        userManager?.signoutSilent();
      }
      break;
    }
    default: {
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
        // on any action with a 401 or 403, we try to refresh the oidc token to verify
        // if the user is still logged in

        userManager.signinSilent().then(user => {
          if (!user) {
            storeAPI.dispatch(sync.keycloakAuthRefreshError('onAuthRefreshError', null));
            storeAPI.dispatch(async.doLoggedOut());
          }
        }).catch(err => {
          // if the silent signin errors, we consider the user logged out
          storeAPI.dispatch(sync.keycloakAuthRefreshError('onAuthRefreshError', err));
          storeAPI.dispatch(async.doLoggedOut());
        });
      }
      break;
    }
  }
  return next(action);
};

let refreshCount = 0;

export const OidcWrapper = props => {
  const [wrapperUserManager, setUserManager] = useState(null);
  const blipUrl = useSelector(state => state.blipUrls.blipUrl);
  const blipRedirect = useMemo(() => {
    if (!blipUrl) return null;
    const url = new URL(`${blipUrl}upload-redirect`);
    return url.href;
  }, [blipUrl]);
  const keycloakConfig = useSelector(state => state.keycloakConfig);
  const { url, realm } = keycloakConfig;
  const authority = useMemo(
    () =>
      keycloakConfig?.url && keycloakConfig?.realm ? `${keycloakConfig?.url}/realms/${keycloakConfig?.realm}` : null,
    [keycloakConfig?.url, keycloakConfig?.realm],
  );
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);
  const store = useStore();
  const isOauthRedirectRoute = /^(\/upload-redirect)/.test(window?.location?.pathname);

  useEffect(() => {
    if (!authority || !blipRedirect) return;

    userManager = new UserManager({
      authority: authority,
      client_id: 'tidepool-uploader-sso',
      redirect_uri: blipRedirect,
      response_mode: 'fragment',
      monitorSession: !env.electron,
    });

    const loggedOut = () => {
      store.dispatch(async.doLoggedOut());
    };

    const loggedIn = (user) => {
      store.dispatch(sync.keycloakAuthSuccess('onAuthSuccess', null));
      api.user.saveSession(user.profile.sub, user.access_token, {
        noRefresh: true,
      });
      if (!store.getState().loggedInUser) {
        store.dispatch(async.doLogin());
      }
    };

    userManager.events.addUserSignedIn(() => {
      userManager.getUser().then(loggedIn);
    });

    userManager.events.addUserLoaded(loggedIn);

    userManager.events.addAccessTokenExpired(() => {
      store.dispatch(sync.keycloakTokenExpired('onTokenExpired', null));
      loggedOut();
    });

    userManager.events.addSilentRenewError(() => {
      store.dispatch(sync.keycloakAuthRefreshError('onAuthRefreshError', null));
      loggedOut();
    });

    userManager.events.addUserUnloaded(() => {
      store.dispatch(sync.keycloakAuthLogout('onAuthLogout', null));
    });

    const keycloakInitOptions = {
      checkLoginIframe: false,
      enableLogging: process.env.NODE_ENV === 'development',
      redirectUri: blipRedirect,
    };

    keycloak = new Keycloak({
      url: url,
      realm: realm,
      clientId: 'tidepool-uploader-sso',
    });

    keycloak.init(keycloakInitOptions).then(() => {
      const logoutUrl = keycloak.createLogoutUrl({
        redirectUri: 'tidepooluploader://localhost/keycloak-redirect',
      });
      store.dispatch(sync.keycloakReady('onReady', null, logoutUrl));
    });

    setUserManager(userManager);
    refreshCount++;

  }, [authority, blipRedirect, store, url, realm]);

  // watch for hash changes and re-instantiate the authClient and force a re-render of the provider
  // incrementing externally defined `key` forces unmount/remount as provider doesn't expect to
  // have the authClient refreshed and only sets up refresh timeout on mount
  if(env.electron){
    const onHashChange = useCallback(async () => {
      if(!await userManager.getUser()){
        refreshCount++;
        forceUpdate();
      }
    }, [forceUpdate]);

    useEffect(() => {
      window.addEventListener('hashchange', onHashChange, false);
      return () => {
        window.removeEventListener('hashchange', onHashChange, false);
      };
    }, [onHashChange]);
  }

  if (authority && blipRedirect && wrapperUserManager && !isOauthRedirectRoute) {
    return (
      <AuthProvider userManager={wrapperUserManager} key={refreshCount}>
        {props.children}
      </AuthProvider>
    );
  }

  return props.children;
};

export default {
  keycloak,
  userManager,
  oidcMiddleware,
};
