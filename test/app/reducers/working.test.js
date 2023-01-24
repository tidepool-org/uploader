/* global chai */
/* global sinon */
/* global describe */
/* global it */
/* global expect */
import _ from 'lodash';
import mutationTracker from 'object-invariant-test-helper';
import {expect} from 'chai';

import reducer from '../../../app/reducers/working';
import actions from '../../../app/actions/index';
import devices from '../../../app/reducers/devices';

import initialAll from '../../../app/reducers/initialState';
import {getLoginErrorMessage, getCreateCustodialAccountErrorMessage, getUpdateProfileErrorMessage, getAppInitErrorMessage} from '../../../app/utils/errors';
const { working: initialState } = initialAll;
let tracked = mutationTracker.trackObj(initialState);

jest.mock('@electron/remote', () => ({
  getGlobal: (string) => {
    if (string === 'i18n') {
        return { t: (string) => string };
    }
  }
}));

describe('working', () => {

  describe('logout', () => {
    describe('request', () => {
      it('should set loggingOut.inProgress to be true', () => {
        let action = actions.sync.logoutRequest();
        expect(initialState.loggingOut.inProgress).to.be.false;

        let state = reducer(initialState, action);
        expect(state.loggingOut.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set loggingOut.inProgress to be false', () => {
        let user = 'user';

        let requestAction = actions.sync.logoutRequest();
        expect(initialState.loggingOut.inProgress).to.be.false;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.loggingOut.inProgress).to.be.true;

        let successAction = actions.sync.logoutSuccess(user);
        let state = reducer(intermediateState, successAction);
        expect(state.loggingOut.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set loggingOut.completed to be true', () => {
        let user = 'user';

        let requestAction = actions.sync.logoutRequest();
        expect(initialState.loggingOut.completed).to.be.null;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.loggingOut.completed).to.be.null;

        let successAction = actions.sync.logoutSuccess(user);
        let state = reducer(intermediateState, successAction);
        expect(state.loggingOut.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should reset to the initial working state for all other actions', () => {
        let user = 'user';

        expect(initialState.fetchingPatient.completed).to.be.null;
        let updateOtherAction = actions.sync.fetchPatientSuccess(user);

        let intermediateState = reducer(initialState, updateOtherAction);
        expect(intermediateState.fetchingPatient.completed).to.be.true;

        let logoutSuccessAction = actions.sync.logoutSuccess(user);
        let state = reducer(intermediateState, logoutSuccessAction);
        expect(_.omit(state, 'loggingOut')).to.eql(_.omit(initialState, 'loggingOut'));
        expect(state.fetchingPatient.completed).to.be.null;
      });
    });
  });

  describe('login', () => {
    describe('request', () => {
      it('should leave loggingIn.completed unchanged', () => {
        expect(initialState.loggingIn.completed).to.be.null;

        let requestAction = actions.sync.loginRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.loggingIn.completed).to.be.null;

        let successAction = actions.sync.loginSuccess('foo');
        let successState = reducer(requestState, successAction);

        expect(successState.loggingIn.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.loggingIn.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set loggingIn.inProgress to be true', () => {
        let action = actions.sync.loginRequest();
        expect(initialState.loggingIn.inProgress).to.be.false;

        let state = reducer(initialState, action);

        expect(state.loggingIn.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set loggingIn.completed to be false', () => {
        let error = new Error('Something bad happened :(');

        expect(initialState.loggingIn.completed).to.be.null;

        let failureAction = actions.sync.loginFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.loggingIn.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set loggingIn.inProgress to be false and set error', () => {
        let errorMessage = getLoginErrorMessage(400);

        let requestAction = actions.sync.loginRequest();
        expect(initialState.loggingIn.inProgress).to.be.false;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.loggingIn.inProgress).to.be.true;

        let failureAction = actions.sync.loginFailure(400);
        let state = reducer(intermediateState, failureAction);
        expect(state.loggingIn.inProgress).to.be.false;
        expect(state.loggingIn.notification.type).to.equal('error');
        expect(state.loggingIn.notification.message).to.equal(errorMessage);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set loggingIn.completed to be true', () => {
        expect(initialState.loggingIn.completed).to.be.null;

        let successAction = actions.sync.loginSuccess('foo');
        let state = reducer(initialState, successAction);

        expect(state.loggingIn.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set loggingIn.inProgress to be false', () => {
        let user = 'user';

        let requestAction = actions.sync.loginRequest();
        expect(initialState.loggingIn.inProgress).to.be.false;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.loggingIn.inProgress).to.be.true;

        let successAction = actions.sync.loginSuccess(user);
        let state = reducer(intermediateState, successAction);
        expect(state.loggingIn.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('fetchPatient', () => {
    describe('request', () => {
      it('should leave fetchingPatient.completed unchanged', () => {
        expect(initialState.fetchingPatient.completed).to.be.null;

        let requestAction = actions.sync.fetchPatientRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.fetchingPatient.completed).to.be.null;

        let successAction = actions.sync.fetchPatientSuccess('foo');
        let successState = reducer(requestState, successAction);

        expect(successState.fetchingPatient.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.fetchingPatient.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingPatient.inProgress to be true', () => {
        let action = actions.sync.fetchPatientRequest();

        expect(initialState.fetchingPatient.inProgress).to.be.false;

        let state = reducer(initialState, action);
        expect(state.fetchingPatient.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set fetchingPatient.completed to be false', () => {
        let error = new Error('Something bad happened :(');

        expect(initialState.fetchingPatient.completed).to.be.null;

        let failureAction = actions.sync.fetchPatientFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.fetchingPatient.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingPatient.inProgress to be false and set error', () => {
        let initialStateForTest = _.merge({}, { fetchingPatient: { inProgress : true, notification: null } });
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let error = new Error('Something bad happened :(');
        let action = actions.sync.fetchPatientFailure(error);

        expect(initialStateForTest.fetchingPatient.inProgress).to.be.true;
        expect(initialStateForTest.fetchingPatient.notification).to.be.null;

        let state = reducer(initialStateForTest, action);

        expect(state.fetchingPatient.inProgress).to.be.false;
        expect(state.fetchingPatient.notification.type).to.equal('error');
        expect(state.fetchingPatient.notification.message).to.equal(error.message);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set fetchingPatient.completed to be true', () => {
        expect(initialState.fetchingPatient.completed).to.be.null;

        let successAction = actions.sync.fetchPatientSuccess('foo');
        let state = reducer(initialState, successAction);

        expect(state.fetchingPatient.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingPatient.inProgress to be false', () => {
        let initialStateForTest = _.merge({}, { fetchingPatient: { inProgress : true, notification: null } });
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let patient = { id: 2020, name: 'Megan Durrant'};
        let action = actions.sync.fetchPatientSuccess(patient);

        expect(initialStateForTest.fetchingPatient.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.fetchingPatient.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('fetchAssociatedAccounts', () => {
    describe('request', () => {
      it('should leave fetchingAssociatedAccounts.completed unchanged', () => {
        expect(initialState.fetchingAssociatedAccounts.completed).to.be.null;

        let requestAction = actions.sync.fetchAssociatedAccountsRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.fetchingAssociatedAccounts.completed).to.be.null;

        let successAction = actions.sync.fetchAssociatedAccountsSuccess('foo');
        let successState = reducer(requestState, successAction);

        expect(successState.fetchingAssociatedAccounts.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.fetchingAssociatedAccounts.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingAssociatedAccounts.inProgress to be true', () => {
        let action = actions.sync.fetchAssociatedAccountsRequest();

        expect(initialState.fetchingAssociatedAccounts.inProgress).to.be.false;

        let state = reducer(initialState, action);
        expect(state.fetchingAssociatedAccounts.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set fetchingAssociatedAccounts.completed to be false', () => {
        let error = new Error('Something bad happened :(');

        expect(initialState.fetchingAssociatedAccounts.completed).to.be.null;

        let failureAction = actions.sync.fetchAssociatedAccountsFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.fetchingAssociatedAccounts.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingAssociatedAccounts.inProgress to be false and set error', () => {
        let initialStateForTest = _.merge({}, { fetchingAssociatedAccounts: { inProgress : true, notification: null } });
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let error = new Error('Something bad happened :(');
        let action = actions.sync.fetchAssociatedAccountsFailure(error);

        expect(initialStateForTest.fetchingAssociatedAccounts.inProgress).to.be.true;
        expect(initialStateForTest.fetchingAssociatedAccounts.notification).to.be.null;

        let state = reducer(initialStateForTest, action);

        expect(state.fetchingAssociatedAccounts.inProgress).to.be.false;
        expect(state.fetchingAssociatedAccounts.notification.type).to.equal('error');
        expect(state.fetchingAssociatedAccounts.notification.message).to.equal(error.message);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set fetchingAssociatedAccounts.completed to be true', () => {
        expect(initialState.fetchingAssociatedAccounts.completed).to.be.null;

        let successAction = actions.sync.fetchAssociatedAccountsSuccess('foo');
        let state = reducer(initialState, successAction);

        expect(state.fetchingAssociatedAccounts.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingAssociatedAccounts.inProgress to be false', () => {
        let initialStateForTest = _.merge({}, { fetchingAssociatedAccounts: { inProgress : true, notification: null } });
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let patients = [
          { userid: 2020, name: 'Megan Durrant'},
          { userid: 501, name: 'Jamie Blake'}
        ];
        let action = actions.sync.fetchAssociatedAccountsSuccess(patients);

        expect(initialStateForTest.fetchingAssociatedAccounts.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.fetchingAssociatedAccounts.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('fetchPatientsForClinic', () => {
    describe('request', () => {
      it('should set fetchingPatientsForClinic.completed to be null', () => {
        expect(initialState.fetchingPatientsForClinic.completed).to.be.null;

        let requestAction = actions.sync.fetchPatientsForClinicRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.fetchingPatientsForClinic.completed).to.be.null;

        let successAction = actions.sync.fetchPatientsForClinicSuccess('foo', 'bar', 100);
        let successState = reducer(requestState, successAction);

        expect(successState.fetchingPatientsForClinic.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.fetchingPatientsForClinic.completed).to.be.null;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingPatientsForClinic.inProgress to be true', () => {
        let initialStateForTest = _.merge({}, initialState);
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let action = actions.sync.fetchPatientsForClinicRequest();

        expect(initialStateForTest.fetchingPatientsForClinic.inProgress).to.be.false;

        let state = reducer(initialStateForTest, action);
        expect(state.fetchingPatientsForClinic.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set fetchingPatientsForClinic.completed to be false', () => {
        let error = new Error('Something bad happened :(');

        expect(initialState.fetchingPatientsForClinic.completed).to.be.null;

        let failureAction = actions.sync.fetchPatientsForClinicFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.fetchingPatientsForClinic.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingPatientsForClinic.inProgress to be false and set error', () => {
        let initialStateForTest = _.merge({}, initialState, {
          fetchingPatientsForClinic: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);
        let error = new Error('Something bad happened :(');
        let action = actions.sync.fetchPatientsForClinicFailure(error);

        expect(initialStateForTest.fetchingPatientsForClinic.inProgress).to.be.true;
        expect(initialStateForTest.fetchingPatientsForClinic.notification).to.be.null;

        let state = reducer(initialStateForTest, action);

        expect(state.fetchingPatientsForClinic.inProgress).to.be.false;
        expect(state.fetchingPatientsForClinic.notification.type).to.equal('error');
        expect(state.fetchingPatientsForClinic.notification.message).to.equal(error.message);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set fetchingPatientsForClinic.completed to be true', () => {
        expect(initialState.fetchingPatientsForClinic.completed).to.be.null;

        let successAction = actions.sync.fetchPatientsForClinicSuccess('foo');
        let state = reducer(initialState, successAction);

        expect(state.fetchingPatientsForClinic.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingPatientsForClinic.inProgress to be false', () => {

        let initialStateForTest = _.merge({}, initialState, {
          fetchingPatientsForClinic: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);

        let action = actions.sync.fetchPatientsForClinicSuccess([{id:'patientId', name:'patient name'}]);

        expect(initialStateForTest.fetchingPatientsForClinic.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.fetchingPatientsForClinic.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('createCustodialAccount', () => {
    describe('request', () => {
      it('should set creatingCustodialAccount.completed to null', () => {
        expect(initialState.creatingCustodialAccount.completed).to.be.null;

        let requestAction = actions.sync.createCustodialAccountRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.creatingCustodialAccount.completed).to.be.null;

        let successAction = actions.sync.createCustodialAccountSuccess('foo', 'bar', 'baz');
        let successState = reducer(requestState, successAction);

        expect(successState.creatingCustodialAccount.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.creatingCustodialAccount.completed).to.be.null;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set creatingCustodialAccount.inProgress to be true', () => {
        let initialStateForTest = _.merge({}, initialState);
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let action = actions.sync.createCustodialAccountRequest();

        expect(initialStateForTest.creatingCustodialAccount.inProgress).to.be.false;

        let state = reducer(initialStateForTest, action);
        expect(state.creatingCustodialAccount.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set creatingCustodialAccount.completed to be false', () => {
        let error = new Error('Something bad happened :(');

        expect(initialState.creatingCustodialAccount.completed).to.be.null;

        let failureAction = actions.sync.createCustodialAccountFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.creatingCustodialAccount.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set creatingCustodialAccount.inProgress to be false and set error', () => {
        let initialStateForTest = _.merge({}, initialState, {
          creatingCustodialAccount: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);
        let error = new Error('Something bad happened :(');
        let errorMessage = getCreateCustodialAccountErrorMessage();
        let action = actions.sync.createCustodialAccountFailure(error);

        expect(initialStateForTest.creatingCustodialAccount.inProgress).to.be.true;
        expect(initialStateForTest.creatingCustodialAccount.notification).to.be.null;

        let state = reducer(initialStateForTest, action);

        expect(state.creatingCustodialAccount.inProgress).to.be.false;
        expect(state.creatingCustodialAccount.notification.type).to.equal('error');
        expect(state.creatingCustodialAccount.notification.message).to.equal(errorMessage);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set creatingCustodialAccount.completed to be true', () => {
        expect(initialState.creatingCustodialAccount.completed).to.be.null;

        let successAction = actions.sync.createCustodialAccountSuccess('foo');
        let state = reducer(initialState, successAction);

        expect(state.creatingCustodialAccount.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set creatingCustodialAccount.inProgress to be false', () => {

        let initialStateForTest = _.merge({}, initialState, {
          creatingCustodialAccount: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);

        let action = actions.sync.createCustodialAccountSuccess('clinicId', {id:'patientId'},'patientId');

        expect(initialStateForTest.creatingCustodialAccount.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.creatingCustodialAccount.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('createClinicCustodialAccount', () => {
    describe('request', () => {
      it('should set creatingClinicCustodialAccount.completed to null', () => {
        expect(initialState.creatingClinicCustodialAccount.completed).to.be.null;

        let requestAction = actions.sync.createClinicCustodialAccountRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.creatingClinicCustodialAccount.completed).to.be.null;

        let successAction = actions.sync.createClinicCustodialAccountSuccess('foo', 'bar', 'baz');
        let successState = reducer(requestState, successAction);

        expect(successState.creatingClinicCustodialAccount.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.creatingClinicCustodialAccount.completed).to.be.null;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set creatingClinicCustodialAccount.inProgress to be true', () => {
        let initialStateForTest = _.merge({}, initialState);
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let action = actions.sync.createClinicCustodialAccountRequest();

        expect(initialStateForTest.creatingClinicCustodialAccount.inProgress).to.be.false;

        let state = reducer(initialStateForTest, action);
        expect(state.creatingClinicCustodialAccount.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set creatingClinicCustodialAccount.completed to be false', () => {
        let error = new Error('Something bad happened :(');

        expect(initialState.creatingClinicCustodialAccount.completed).to.be.null;

        let failureAction = actions.sync.createClinicCustodialAccountFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.creatingClinicCustodialAccount.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set creatingClinicCustodialAccount.inProgress to be false and set error', () => {
        let initialStateForTest = _.merge({}, initialState, {
          creatingClinicCustodialAccount: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);
        let error = new Error(getCreateCustodialAccountErrorMessage());
        let errorMessage = getCreateCustodialAccountErrorMessage();
        let action = actions.sync.createClinicCustodialAccountFailure(error);

        expect(initialStateForTest.creatingClinicCustodialAccount.inProgress).to.be.true;
        expect(initialStateForTest.creatingClinicCustodialAccount.notification).to.be.null;

        let state = reducer(initialStateForTest, action);

        expect(state.creatingClinicCustodialAccount.inProgress).to.be.false;
        expect(state.creatingClinicCustodialAccount.notification.type).to.equal('error');
        expect(state.creatingClinicCustodialAccount.notification.message).to.equal(errorMessage);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set creatingClinicCustodialAccount.completed to be true', () => {
        expect(initialState.creatingClinicCustodialAccount.completed).to.be.null;

        let successAction = actions.sync.createClinicCustodialAccountSuccess('foo');
        let state = reducer(initialState, successAction);

        expect(state.creatingClinicCustodialAccount.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set creatingClinicCustodialAccount.inProgress to be false', () => {

        let initialStateForTest = _.merge({}, initialState, {
          creatingClinicCustodialAccount: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);

        let action = actions.sync.createClinicCustodialAccountSuccess('clinicId', {id:'patientId'},'patientId');

        expect(initialStateForTest.creatingClinicCustodialAccount.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.creatingClinicCustodialAccount.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('initializeApp', () => {
    describe('request', () => {
      it('should leave initializingApp.completed unchanged', () => {
        expect(initialState.initializingApp.completed).to.be.null;

        let requestAction = actions.sync.initializeAppRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.initializingApp.completed).to.be.null;

        let successAction = actions.sync.initializeAppSuccess();
        let successState = reducer(requestState, successAction);

        expect(successState.initializingApp.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.initializingApp.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set initializingApp.inProgress to be true', () => {
        let action = actions.sync.initializeAppRequest();
        expect(initialState.initializingApp.inProgress).to.be.true;

        let state = reducer(initialState, action);

        expect(state.initializingApp.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set initializingApp.completed to be false', () => {
        let error = new Error(getAppInitErrorMessage());

        expect(initialState.initializingApp.completed).to.be.null;

        let failureAction = actions.sync.initializeAppFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.initializingApp.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set initializingApp.inProgress to be false and set error', () => {
        let error = new Error(getAppInitErrorMessage());

        let requestAction = actions.sync.initializeAppRequest();
        expect(initialState.initializingApp.inProgress).to.be.true;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.initializingApp.inProgress).to.be.true;

        let failureAction = actions.sync.initializeAppFailure(400);
        let state = reducer(intermediateState, failureAction);
        expect(state.initializingApp.inProgress).to.be.false;
        expect(state.initializingApp.notification.type).to.equal('error');
        expect(state.initializingApp.notification.message).to.equal(error.message);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set initializingApp.completed to be true', () => {
        expect(initialState.initializingApp.completed).to.be.null;

        let successAction = actions.sync.initializeAppSuccess('foo');
        let state = reducer(initialState, successAction);

        expect(state.initializingApp.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set initializingApp.inProgress to be false', () => {
        let user = 'user';

        let requestAction = actions.sync.initializeAppRequest();
        expect(initialState.initializingApp.inProgress).to.be.true;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.initializingApp.inProgress).to.be.true;

        let successAction = actions.sync.initializeAppSuccess(user);
        let state = reducer(intermediateState, successAction);
        expect(state.initializingApp.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('versionCheck', () => {
    describe('request', () => {
      it('should leave checkingVersion.completed unchanged', () => {
        expect(initialState.checkingVersion.completed).to.be.null;

        let requestAction = actions.sync.versionCheckRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.checkingVersion.completed).to.be.null;

        let successAction = actions.sync.versionCheckSuccess('foo');
        let successState = reducer(requestState, successAction);

        expect(successState.checkingVersion.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.checkingVersion.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set checkingVersion.inProgress to be true', () => {
        let action = actions.sync.versionCheckRequest();
        expect(initialState.checkingVersion.inProgress).to.be.false;

        let state = reducer(initialState, action);

        expect(state.checkingVersion.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set checkingVersion.completed to be false', () => {
        let error = new Error('Something bad happened :(');

        expect(initialState.checkingVersion.completed).to.be.null;

        let failureAction = actions.sync.versionCheckFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.checkingVersion.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set checkingVersion.inProgress to be false and set error', () => {
        let error = new Error('Something bad happened :(');

        let requestAction = actions.sync.versionCheckRequest();
        expect(initialState.checkingVersion.inProgress).to.be.false;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.checkingVersion.inProgress).to.be.true;

        let failureAction = actions.sync.versionCheckFailure(error);
        let state = reducer(intermediateState, failureAction);
        expect(state.checkingVersion.inProgress).to.be.false;
        expect(state.checkingVersion.notification.type).to.equal('error');
        expect(state.checkingVersion.notification.message).to.equal(error.message);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set checkingVersion.completed to be true', () => {
        expect(initialState.checkingVersion.completed).to.be.null;

        let successAction = actions.sync.versionCheckSuccess('foo');
        let state = reducer(initialState, successAction);

        expect(state.checkingVersion.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set checkingVersion.inProgress to be false', () => {
        let user = 'user';

        let requestAction = actions.sync.versionCheckRequest();
        expect(initialState.checkingVersion.inProgress).to.be.false;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.checkingVersion.inProgress).to.be.true;

        let successAction = actions.sync.versionCheckSuccess(user);
        let state = reducer(intermediateState, successAction);
        expect(state.checkingVersion.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('upload', () => {
    const time = '2016-01-01T12:05:00.123Z';
    const userId = 'a1b2c3', deviceKey = 'a_pump';
    const device = {
      key: deviceKey,
      source: {type: 'device', driverId: 'AcmePump'}
    };
    const upload = {
      history: [{start: time}]
    };
    const data = {
      post_records: [1,2,3,4,5],
      deviceModel: 'acme'
    };
    const origError = new Error('I\'m an upload error!');
    const errProps = {
      utc: '2016-01-01T12:05:00.123Z',
      code: 'RED'
    };
    let resError = new Error('I\'m an upload error!');
    resError.code = errProps.code;
    resError.utc = errProps.utc;
    resError.debug = `UTC Time: ${errProps.utc} | Code: ${errProps.code}`;

    describe('request', () => {
      it('should leave uploading.completed unchanged', () => {
        expect(initialState.uploading.completed).to.be.null;

        let requestAction = actions.sync.uploadRequest(userId, device);
        let requestState = reducer(initialState, requestAction);

        expect(requestState.uploading.completed).to.be.null;

        let successAction = actions.sync.uploadSuccess(userId, device, upload, data);
        let successState = reducer(requestState, successAction);

        expect(successState.uploading.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.uploading.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set uploading.inProgress to be true', () => {
        let action = actions.sync.uploadRequest(userId, device);
        expect(initialState.uploading.inProgress).to.be.false;

        let state = reducer(initialState, action);

        expect(state.uploading.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set uploading.completed to be false', () => {
        expect(initialState.uploading.completed).to.be.null;

        let failureAction = actions.sync.uploadFailure(origError, errProps, device);
        let state = reducer(initialState, failureAction);

        expect(state.uploading.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set uploading.inProgress to be false and set error', () => {
        let requestAction = actions.sync.uploadRequest(userId, device);
        expect(initialState.uploading.inProgress).to.be.false;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.uploading.inProgress).to.be.true;

        let failureAction = actions.sync.uploadFailure(origError, errProps, device);
        let state = reducer(intermediateState, failureAction);
        expect(state.uploading.inProgress).to.be.false;
        expect(state.uploading.notification.type).to.equal('error');
        expect(state.uploading.notification.message).to.equal(origError.message);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('cancelled', () => {
      it('should set uploading.completed to be false', () => {
        expect(initialState.uploading.completed).to.be.null;

        let cancelAction = actions.sync.uploadCancelled(time);
        let state = reducer(initialState, cancelAction);

        expect(state.uploading.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set uploading.inProgress to be false', () => {
        let requestAction = actions.sync.uploadRequest(userId, device);
        expect(initialState.uploading.inProgress).to.be.false;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.uploading.inProgress).to.be.true;

        let cancelAction = actions.sync.uploadCancelled(time);
        let state = reducer(intermediateState, cancelAction);
        expect(state.uploading.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('readFileAborted', () => {
      let err = new Error('Wrong file extension!');
      it('should set uploading.completed to be false', () => {
        expect(initialState.uploading.completed).to.be.null;

        let cancelAction = actions.sync.readFileAborted(err);
        let state = reducer(initialState, cancelAction);

        expect(state.uploading.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set uploading.inProgress to be false and set error', () => {
        let requestAction = actions.sync.uploadRequest(userId, device);
        expect(initialState.uploading.inProgress).to.be.false;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.uploading.inProgress).to.be.true;

        let failureAction = actions.sync.readFileAborted(err);
        let state = reducer(intermediateState, failureAction);
        expect(state.uploading.inProgress).to.be.false;
        expect(state.uploading.notification.type).to.equal('error');
        expect(state.uploading.notification.message).to.equal(err.message);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('readFileFailure', () => {
      let err = new Error('Error reading file!');
      it('should set uploading.completed to be false', () => {
        expect(initialState.uploading.completed).to.be.null;

        let cancelAction = actions.sync.readFileFailure(err);
        let state = reducer(initialState, cancelAction);

        expect(state.uploading.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set uploading.inProgress to be false and set error', () => {
        let requestAction = actions.sync.uploadRequest(userId, device);
        expect(initialState.uploading.inProgress).to.be.false;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.uploading.inProgress).to.be.true;

        let failureAction = actions.sync.readFileFailure(err);
        let state = reducer(intermediateState, failureAction);
        expect(state.uploading.inProgress).to.be.false;
        expect(state.uploading.notification.type).to.equal('error');
        expect(state.uploading.notification.message).to.equal(err.message);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set uploading.completed to be true', () => {
        expect(initialState.uploading.completed).to.be.null;

        let successAction = actions.sync.uploadSuccess(userId, device, upload, data);
        let state = reducer(initialState, successAction);

        expect(state.uploading.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set uploading.inProgress to be false', () => {
        let user = 'user';

        let requestAction = actions.sync.uploadRequest(userId, device);
        expect(initialState.uploading.inProgress).to.be.false;

        let intermediateState = reducer(initialState, requestAction);
        expect(intermediateState.uploading.inProgress).to.be.true;

        let successAction = actions.sync.uploadSuccess(userId, device, upload, data);
        let state = reducer(intermediateState, successAction);
        expect(state.uploading.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('checkingElectronUpdate', () => {
    const updateInfo = {'url':'http://example.com'};
    describe('autoCheckingForUpdates', () => {
      it('should leave checkingElectronUpdate.completed unchanged', () => {
        expect(initialState.checkingElectronUpdate.completed).to.be.null;

        let requestAction = actions.sync.autoCheckingForUpdates();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.checkingElectronUpdate.completed).to.be.null;

        let successAction = actions.sync.updateAvailable('foo');
        let successState = reducer(requestState, successAction);

        expect(successState.checkingElectronUpdate.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.checkingElectronUpdate.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set checkingElectronUpdate.inProgress to be true', () => {
        let initialStateForTest = _.merge({}, initialState);
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let action = actions.sync.autoCheckingForUpdates();

        expect(initialStateForTest.checkingElectronUpdate.inProgress).to.be.false;

        let state = reducer(initialStateForTest, action);
        expect(state.checkingElectronUpdate.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('manualCheckingForUpdates', () => {
      it('should leave checkingElectronUpdate.completed unchanged', () => {
        expect(initialState.checkingElectronUpdate.completed).to.be.null;

        let requestAction = actions.sync.manualCheckingForUpdates();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.checkingElectronUpdate.completed).to.be.null;

        let successAction = actions.sync.updateAvailable('foo');
        let successState = reducer(requestState, successAction);

        expect(successState.checkingElectronUpdate.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.checkingElectronUpdate.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set checkingElectronUpdate.inProgress to be true', () => {
        let initialStateForTest = _.merge({}, initialState);
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let action = actions.sync.manualCheckingForUpdates();

        expect(initialStateForTest.checkingElectronUpdate.inProgress).to.be.false;

        let state = reducer(initialStateForTest, action);
        expect(state.checkingElectronUpdate.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('updateAvailable', () => {
      it('should set checkingElectronUpdate.completed to be true', () => {
        expect(initialState.checkingElectronUpdate.completed).to.be.null;

        let successAction = actions.sync.updateAvailable(updateInfo);
        let state = reducer(initialState, successAction);

        expect(state.checkingElectronUpdate.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set checkingElectronUpdate.inProgress to be false', () => {

        let initialStateForTest = _.merge({}, initialState, {
          checkingElectronUpdate: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);

        let action = actions.sync.updateAvailable(updateInfo);

        expect(initialStateForTest.checkingElectronUpdate.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.checkingElectronUpdate.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('updateNotAvailable', () => {
      it('should set checkingElectronUpdate.completed to be true', () => {
        expect(initialState.checkingElectronUpdate.completed).to.be.null;

        let successAction = actions.sync.updateNotAvailable(updateInfo);
        let state = reducer(initialState, successAction);

        expect(state.checkingElectronUpdate.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set checkingElectronUpdate.inProgress to be false', () => {

        let initialStateForTest = _.merge({}, initialState, {
          checkingElectronUpdate: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);

        let action = actions.sync.updateNotAvailable(updateInfo);

        expect(initialStateForTest.checkingElectronUpdate.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.checkingElectronUpdate.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('autoUpdateError', () => {
      it('should set checkingElectronUpdate.completed to be false', () => {

        expect(initialState.checkingElectronUpdate.completed).to.be.null;

        let failureAction = actions.sync.autoUpdateError(updateInfo);
        let state = reducer(initialState, failureAction);

        expect(state.checkingElectronUpdate.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set checkingElectronUpdate.inProgress to be false and set error', () => {
        let initialStateForTest = _.merge({}, initialState, {
          checkingElectronUpdate: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);
        let action = actions.sync.autoUpdateError(updateInfo);

        expect(initialStateForTest.checkingElectronUpdate.inProgress).to.be.true;
        expect(initialStateForTest.checkingElectronUpdate.notification).to.be.null;

        let state = reducer(initialStateForTest, action);

        expect(state.checkingElectronUpdate.inProgress).to.be.false;
        expect(state.checkingElectronUpdate.notification.type).to.equal('error');
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('checkingDriverUpdate', () => {
    describe('checkingForDriverUpdate', () => {
      it('should leave checkingDriverUpdate.completed unchanged', () => {
        expect(initialState.checkingDriverUpdate.completed).to.be.null;

        let requestAction = actions.sync.checkingForDriverUpdate();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.checkingDriverUpdate.completed).to.be.null;

        let successAction = actions.sync.driverUpdateAvailable('1','2');
        let successState = reducer(requestState, successAction);

        expect(successState.checkingDriverUpdate.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.checkingDriverUpdate.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set checkingDriverUpdate.inProgress to be true', () => {
        let initialStateForTest = _.merge({}, initialState);
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let action = actions.sync.checkingForDriverUpdate();

        expect(initialStateForTest.checkingDriverUpdate.inProgress).to.be.false;

        let state = reducer(initialStateForTest, action);
        expect(state.checkingDriverUpdate.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('driverUpdateAvailable', () => {
      it('should set checkingDriverUpdate.completed to be true', () => {
        expect(initialState.checkingDriverUpdate.completed).to.be.null;

        let successAction = actions.sync.driverUpdateAvailable('1','2');
        let state = reducer(initialState, successAction);

        expect(state.checkingDriverUpdate.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set checkingDriverUpdate.inProgress to be false', () => {

        let initialStateForTest = _.merge({}, initialState, {
          checkingDriverUpdate: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);

        let action = actions.sync.driverUpdateAvailable('1','2');

        expect(initialStateForTest.checkingDriverUpdate.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.checkingDriverUpdate.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('driverUpdateNotAvailable', () => {
      it('should set checkingDriverUpdate.completed to be true', () => {
        expect(initialState.checkingDriverUpdate.completed).to.be.null;

        let successAction = actions.sync.driverUpdateNotAvailable();
        let state = reducer(initialState, successAction);

        expect(state.checkingDriverUpdate.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set checkingDriverUpdate.inProgress to be false', () => {

        let initialStateForTest = _.merge({}, initialState, {
          checkingDriverUpdate: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);

        let action = actions.sync.driverUpdateNotAvailable();

        expect(initialStateForTest.checkingDriverUpdate.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.checkingDriverUpdate.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('updateClinicPatient', () => {
    describe('request', () => {
      it('should leave updatingClinicPatient.completed unchanged', () => {
        expect(initialState.updatingClinicPatient.completed).to.be.null;

        let requestAction = actions.sync.updateClinicPatientRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.updatingClinicPatient.completed).to.be.null;

        let successAction = actions.sync.updateClinicPatientSuccess('foo', 'bar', 'baz');
        let successState = reducer(requestState, successAction);

        expect(successState.updatingClinicPatient.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.updatingClinicPatient.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set updatingClinicPatient.inProgress to be true', () => {
        let initialStateForTest = _.merge({}, initialState);
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let action = actions.sync.updateClinicPatientRequest();

        expect(initialStateForTest.updatingClinicPatient.inProgress).to.be.false;

        let state = reducer(initialStateForTest, action);
        expect(state.updatingClinicPatient.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set updatingClinicPatient.completed to be false', () => {
        let error = new Error('Something bad happened :(');

        expect(initialState.updatingClinicPatient.completed).to.be.null;

        let failureAction = actions.sync.updateClinicPatientFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.updatingClinicPatient.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set updatingClinicPatient.inProgress to be false and set error', () => {
        let initialStateForTest = _.merge({}, initialState, {
          updatingClinicPatient: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);
        let error = new Error('Something bad happened :(');
        let errorMessage = getUpdateProfileErrorMessage();
        let action = actions.sync.updateClinicPatientFailure(error);

        expect(initialStateForTest.updatingClinicPatient.inProgress).to.be.true;
        expect(initialStateForTest.updatingClinicPatient.notification).to.be.null;

        let state = reducer(initialStateForTest, action);

        expect(state.updatingClinicPatient.inProgress).to.be.false;
        expect(state.updatingClinicPatient.notification.type).to.equal('error');
        expect(state.updatingClinicPatient.notification.message).to.equal(errorMessage);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set updatingClinicPatient.completed to be true', () => {
        expect(initialState.updatingClinicPatient.completed).to.be.null;

        let successAction = actions.sync.updateClinicPatientSuccess('foo');
        let state = reducer(initialState, successAction);

        expect(state.updatingClinicPatient.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set updatingClinicPatient.inProgress to be false', () => {

        let initialStateForTest = _.merge({}, initialState, {
          updatingClinicPatient: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);

        let action = actions.sync.updateClinicPatientSuccess('clinicId','patientId',{id:'patientId', name:'newName'});

        expect(initialStateForTest.updatingClinicPatient.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.updatingClinicPatient.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('getClinicsForClinician', () => {
    describe('request', () => {
      it('should leave fetchingClinicsForClinician.completed unchanged', () => {
        expect(initialState.fetchingClinicsForClinician.completed).to.be.null;

        let requestAction = actions.sync.getClinicsForClinicianRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.fetchingClinicsForClinician.completed).to.be.null;

        let successAction = actions.sync.getClinicsForClinicianSuccess('foo');
        let successState = reducer(requestState, successAction);

        expect(successState.fetchingClinicsForClinician.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.fetchingClinicsForClinician.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingClinicsForClinician.inProgress to be true', () => {
        let initialStateForTest = _.merge({}, initialState);
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let action = actions.sync.getClinicsForClinicianRequest();

        expect(initialStateForTest.fetchingClinicsForClinician.inProgress).to.be.false;

        let state = reducer(initialStateForTest, action);
        expect(state.fetchingClinicsForClinician.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set fetchingClinicsForClinician.completed to be false', () => {
        let error = new Error('Something bad happened :(');

        expect(initialState.fetchingClinicsForClinician.completed).to.be.null;

        let failureAction = actions.sync.getClinicsForClinicianFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.fetchingClinicsForClinician.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingClinicsForClinician.inProgress to be false and set error', () => {
        let initialStateForTest = _.merge({}, initialState, {
          fetchingClinicsForClinician: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);
        let error = new Error('Something bad happened :(');
        let action = actions.sync.getClinicsForClinicianFailure(error);

        expect(initialStateForTest.fetchingClinicsForClinician.inProgress).to.be.true;
        expect(initialStateForTest.fetchingClinicsForClinician.notification).to.be.null;

        let state = reducer(initialStateForTest, action);

        expect(state.fetchingClinicsForClinician.inProgress).to.be.false;
        expect(state.fetchingClinicsForClinician.notification.type).to.equal('error');
        expect(state.fetchingClinicsForClinician.notification.message).to.equal(error.message);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set fetchingClinicsForClinician.completed to be true', () => {
        expect(initialState.fetchingClinicsForClinician.completed).to.be.null;

        let successAction = actions.sync.getClinicsForClinicianSuccess('foo');
        let state = reducer(initialState, successAction);

        expect(state.fetchingClinicsForClinician.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingClinicsForClinician.inProgress to be false', () => {

        let initialStateForTest = _.merge({}, initialState, {
          fetchingClinicsForClinician: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);

        let action = actions.sync.getClinicsForClinicianSuccess('strava', 'blah');

        expect(initialStateForTest.fetchingClinicsForClinician.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.fetchingClinicsForClinician.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('updateProfile', () => {
    describe('request', () => {
      it('should leave updatingProfile.completed unchanged', () => {
        expect(initialState.updatingProfile.completed).to.be.null;

        let requestAction = actions.sync.updateProfileRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.updatingProfile.completed).to.be.null;

        let successAction = actions.sync.updateProfileSuccess({profile:'user'}, 'user123');
        let successState = reducer(requestState, successAction);

        expect(successState.updatingProfile.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.updatingProfile.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set updatingProfile.inProgress to be true', () => {
        let initialStateForTest = _.merge({}, initialState);
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let action = actions.sync.updateProfileRequest();

        expect(initialStateForTest.updatingProfile.inProgress).to.be.false;

        let state = reducer(initialStateForTest, action);
        expect(state.updatingProfile.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set updatingProfile.completed to be false', () => {
        let error = new Error('Something bad happened :(');

        expect(initialState.updatingProfile.completed).to.be.null;

        let failureAction = actions.sync.updateProfileFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.updatingProfile.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set updatingProfile.inProgress to be false and set error', () => {
        let initialStateForTest = _.merge({}, initialState, {
          updatingProfile: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);
        let error = new Error('Something bad happened :(');
        let errorMessage = getUpdateProfileErrorMessage();
        let action = actions.sync.updateProfileFailure(error);

        expect(initialStateForTest.updatingProfile.inProgress).to.be.true;
        expect(initialStateForTest.updatingProfile.notification).to.be.null;

        let state = reducer(initialStateForTest, action);

        expect(state.updatingProfile.inProgress).to.be.false;
        expect(state.updatingProfile.notification.type).to.equal('error');
        expect(state.updatingProfile.notification.message).to.equal(errorMessage);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set updatingProfile.completed to be true', () => {
        expect(initialState.updatingProfile.completed).to.be.null;

        let successAction = actions.sync.updateProfileSuccess({profile:'user'}, 'user123');
        let state = reducer(initialState, successAction);

        expect(state.updatingProfile.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set updatingProfile.inProgress to be false', () => {

        let initialStateForTest = _.merge({}, initialState, {
          updatingProfile: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);

        let action = actions.sync.updateProfileSuccess('clinicId','patientId',{id:'patientId', name:'newName'});

        expect(initialStateForTest.updatingProfile.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.updatingProfile.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });

  describe('selectClinic', () => {
    it('should reset `fetchingPatientsForClinic` to the default working state', () => {
      let initialStateForTest = _.merge({}, initialState, {
        fetchingPatientsForClinic: { inProgress: false, notification: {}, completed: true },
      });

      let tracked = mutationTracker.trackObj(initialStateForTest);

      let action = actions.sync.selectClinic('clinicId123');
      let state = reducer(initialStateForTest, action);

      expect(state.fetchingPatientsForClinic).to.eql({
        inProgress: false,
        notification: null,
        completed: null,
      });

      expect(mutationTracker.hasMutated(tracked)).to.be.false;
    });
  });

  describe('fetchInfo', () => {
    describe('request', () => {
      it('should leave fetchingInfo.completed unchanged', () => {
        expect(initialState.fetchingInfo.completed).to.be.null;

        let requestAction = actions.sync.fetchInfoRequest();
        let requestState = reducer(initialState, requestAction);

        expect(requestState.fetchingInfo.completed).to.be.null;

        let successAction = actions.sync.fetchInfoSuccess('foo');
        let successState = reducer(requestState, successAction);

        expect(successState.fetchingInfo.completed).to.be.true;

        let state = reducer(successState, requestAction);
        expect(state.fetchingInfo.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingInfo.inProgress to be true', () => {
        let initialStateForTest = _.merge({}, initialState);
        let tracked = mutationTracker.trackObj(initialStateForTest);
        let action = actions.sync.fetchInfoRequest();

        expect(initialStateForTest.fetchingInfo.inProgress).to.be.false;

        let state = reducer(initialStateForTest, action);
        expect(state.fetchingInfo.inProgress).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('failure', () => {
      it('should set fetchingInfo.completed to be false', () => {
        let error = new Error('Something bad happened :(');

        expect(initialState.fetchingInfo.completed).to.be.null;

        let failureAction = actions.sync.fetchInfoFailure(error);
        let state = reducer(initialState, failureAction);

        expect(state.fetchingInfo.completed).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingInfo.inProgress to be false and set error', () => {
        let initialStateForTest = _.merge({}, initialState, {
          fetchingInfo: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);
        let error = new Error('Something bad happened :(');
        let action = actions.sync.fetchInfoFailure(error);

        expect(initialStateForTest.fetchingInfo.inProgress).to.be.true;
        expect(initialStateForTest.fetchingInfo.notification).to.be.null;

        let state = reducer(initialStateForTest, action);

        expect(state.fetchingInfo.inProgress).to.be.false;
        expect(state.fetchingInfo.notification.type).to.equal('error');
        expect(state.fetchingInfo.notification.message).to.equal(error.message);
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });

    describe('success', () => {
      it('should set fetchingInfo.completed to be true', () => {
        expect(initialState.fetchingInfo.completed).to.be.null;

        let successAction = actions.sync.fetchInfoSuccess('foo');
        let state = reducer(initialState, successAction);

        expect(state.fetchingInfo.completed).to.be.true;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });

      it('should set fetchingInfo.inProgress to be false', () => {

        let initialStateForTest = _.merge({}, initialState, {
          fetchingInfo: { inProgress: true, notification: null },
        });

        let tracked = mutationTracker.trackObj(initialStateForTest);

        let action = actions.sync.fetchInfoSuccess('foo');

        expect(initialStateForTest.fetchingInfo.inProgress).to.be.true;

        let state = reducer(initialStateForTest, action);

        expect(state.fetchingInfo.inProgress).to.be.false;
        expect(mutationTracker.hasMutated(tracked)).to.be.false;
      });
    });
  });
});
