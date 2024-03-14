import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { bindActionCreators } from 'redux';
import limitReached_img from '../../images/LimitReached.svg';
import styles from '../../styles/components/PatientLimitModal.module.less';
import { sync as syncActions } from '../actions/';
import { URL_TIDEPOOL_PLUS_PLANS } from '../constants/otherConstants';

const remote = require('@electron/remote');
const i18n = remote.getGlobal('i18n');

const PatientLimitModal = () => {
  const showingPatientLimitModal = useSelector(
    (state) => state.showingPatientLimitModal
  );
  const dispatch = useDispatch();
  const sync = bindActionCreators(syncActions, dispatch);

  const handleClose = () => {
    sync.dismissPatientLimitModal();
  };

  if (!showingPatientLimitModal) {
    return null;
  }

  return (
    <div className={styles.modalWrap}>
      <div className={styles.modal}>
        <div className={styles.text}>
          <div className={styles.body}>
            <img
              className={styles.image}
              src={limitReached_img}
              alt="Limit Reached"
            />
            <div className={styles.largeText}>
              {i18n.t(
                'Your workspace has reached the maximum number of patient accounts supported by our Base Plan.'
              )}
            </div>
            <div className={styles.smallText}>
              {i18n.t('Please reach out to your administrator and')}&nbsp;
              <a
                className={styles.learnMoreLink}
                href={URL_TIDEPOOL_PLUS_PLANS}
                target="_blank"
                rel="noreferrer"
              >
                {i18n.t('learn more about our plans')}
              </a>
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={handleClose}>
            {i18n.t('Close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientLimitModal;
