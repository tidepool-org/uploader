/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

import React, { useState } from 'react';
import styles from '../../styles/components/Login.module.less';
import { useDispatch, useSelector } from 'react-redux';

import actions from '../actions/';
const asyncActions = actions.async;

const remote = require('@electron/remote');
const i18n = remote.getGlobal( 'i18n' );

import { keycloak } from '../keycloak';

export const Login = () => {
  const dispatch = useDispatch();
  const disabled = useSelector((state) => Boolean(state.unsupported));
  const errorMessage = useSelector((state) => state.loginErrorMessage);
  const forgotPasswordUrl = useSelector(
    (state) => state.blipUrls.forgotPassword
  );
  const isLoggingIn = useSelector(
    (state) => state.working.loggingIn.inProgress
  );
  const keycloakConfig = useSelector((state) => state.keycloakConfig);
  const keycloakInitializing = keycloakConfig.url && !keycloakConfig.initialized;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);

  const renderForgotPasswordLink = () => {
    return (
      <a className={styles.forgotLink} href={forgotPasswordUrl} target="_blank">
        {i18n.t('Forgot password?')}
      </a>
    );
  };

  const renderButton = () => {
    var text = i18n.t('Log in');

    if (isLoggingIn) {
      text = i18n.t('Logging in...');
    }

    if (keycloakInitializing) {
      text = i18n.t('Loading...');
    }

    return (
      <button
        type="submit"
        className={styles.button}
        onClick={handleLogin}
        disabled={isLoggingIn || disabled || keycloakInitializing}
      >
        {text}
      </button>
    );
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (keycloakConfig.initialized) {
      keycloak.login();
    } else {
      dispatch(asyncActions.doLogin({ username, password }, { remember }));
    }
  };

  const renderError = () => {
    if (!errorMessage) {
      return null;
    }

    return <span>{i18n.t(errorMessage)}</span>;
  };

  return keycloakConfig.url ? (
    <div className={styles.loginPage}>{renderButton()}</div>
  ) : (
    <div className={styles.loginPage}>
      <form className={styles.form}>
        <div className={styles.inputWrap}>
          <input
            className={styles.input}
            placeholder={i18n.t('Email')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className={styles.inputWrap}>
          <input
            className={styles.input}
            placeholder={i18n.t('Password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className={styles.actions}>
          <div>
            <div className={styles.remember}>
              <input
                type="checkbox"
                id="remember"
                value={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor="remember">{i18n.t('Remember me')}</label>
            </div>
            <div className={styles.forgot}>{renderForgotPasswordLink()}</div>
          </div>
          <div>{renderButton()}</div>
        </div>
        <div className={styles.error}>{renderError()}</div>
      </form>
    </div>
  );
};

export default Login;
