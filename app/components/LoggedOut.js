import React from 'react';
import * as styles from '../../styles/components/LoggedOut.module.less';
import { useDispatch } from 'react-redux';

import actions from '../actions/';
const asyncActions = actions.async;
import { pages } from '../constants/otherConstants';
import * as actionSources from '../constants/actionSources';
import logo from '../../images/Tidepool_Logo_Light x2.png';

import { i18n } from '../utils/config.i18next';

export const LoggedOut = () => {
  const dispatch = useDispatch();

  const handleReturn = (e) => {
    e.preventDefault();
    dispatch(asyncActions.setPage(pages.LOGIN, actionSources.USER));
  };

  return (
    <div className={styles.loggedOutPage}>
      <div className={styles.logoWrapper}>
        <img className={styles.logo} src={logo} />
      </div>
      <hr className={styles.hr} />
      <div className={styles.heroText}>
        {i18n.t('You have been signed out of your session.')}
      </div>
      <div className={styles.explainer}>
        {i18n.t(
          'For security reasons, we automatically sign you out after a certain period of inactivity, or if you\'ve signed out from another browser tab.'
        )}
      </div>
      <div className={styles.explainer}>
        {i18n.t('Please sign in again to continue.')}
      </div>
      <form className={styles.form}>
        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.button}
            onClick={handleReturn}
          >
            {i18n.t('Return to Login')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoggedOut;
