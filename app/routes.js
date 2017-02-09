import React from 'react';
import { Route, IndexRoute } from 'react-router';
import App from './containers/App';
import MainPage from './containers/MainPage';
import Login from './components/Login';
import Loading from './components/Loading';
import api from '../lib/core/api';
import config from '../lib/config';

api.create({
  apiUrl: config.API_URL,
  uploadUrl: config.UPLOAD_URL,
  dataUrl: config.DATA_URL,
  version: config.version
});

export default (
  <Route path="/" component={App} api={api}>
    <IndexRoute component={Loading} />
    <Route path="login" component={Login}/>
    <Route path="main" component={MainPage}/>
    {/*<Route path="no_upload_targets" component={}/>
    <Route path="settings" component={}/>
    <Route path="clinic_user_select" component={}/>
    <Route path="clinic_user_edit" component={}/> */}
  </Route>
);
