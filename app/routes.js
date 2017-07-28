import React from 'react';
import { Route, IndexRoute } from 'react-router';
import App from './containers/App';
import MainPage from './containers/MainPage';
import Login from './components/Login';
import Loading from './components/Loading';
import SettingsPage from './containers/SettingsPage';
import ClinicUserSelectPage from './containers/ClinicUserSelectPage';
import ClinicUserEditPage from './containers/ClinicUserEditPage';
import NoUploadTargetsPage from './containers/NoUploadTargetsPage';
import api from '../lib/core/api';

export default (
  <Route path="/" component={App} api={api}>
    <IndexRoute component={Loading} />
    <Route path="login" component={Login}/>
    <Route path="main" component={MainPage}/>
    <Route path="settings" component={SettingsPage}/>
    <Route path="clinic_user_select" component={ClinicUserSelectPage}/>
    <Route path="clinic_user_edit" component={ClinicUserEditPage}/>
    <Route path="no_upload_targets" component={NoUploadTargetsPage}/>
  </Route>
);
