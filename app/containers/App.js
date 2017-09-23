/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014-2016, Tidepool Project
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

import _ from 'lodash';
import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { remote } from 'electron';
import * as metrics from '../constants/metrics';

const { Menu } = remote;

import bows from 'bows';

import config from '../../lib/config.js';

import carelink from '../../lib/core/carelink.js';
import device from '../../lib/core/device.js';
import localStore from '../../lib/core/localStore.js';

import actions from '../actions/';
const asyncActions = actions.async;
const syncActions = actions.sync;

import * as actionSources from '../constants/actionSources';
import { pages, urls, pagesMap } from '../constants/otherConstants';
import { checkVersion } from '../utils/drivers';
import debugMode from '../utils/debugMode';

import UpdatePlease from '../components/UpdatePlease';
import VersionCheckError from '../components/VersionCheckError';
import Footer from '../components/Footer';
import Header from '../components/Header';
import UpdateModal from '../components/UpdateModal';
import UpdateDriverModal from '../components/UpdateDriverModal';

import styles from '../../styles/components/App.module.less';

const serverdata = {
  Local: {
    API_URL: 'http://localhost:8009',
    UPLOAD_URL: 'http://localhost:9122',
    DATA_URL: 'http://localhost:8077',
    BLIP_URL: 'http://localhost:3000'
  },
  Development: {
    API_URL: 'https://dev-api.tidepool.org',
    UPLOAD_URL: 'https://dev-uploads.tidepool.org',
    DATA_URL: 'https://dev-api.tidepool.org/dataservices',
    BLIP_URL: 'https://dev-blip.tidepool.org'
  },
  Staging: {
    API_URL: 'https://stg-api.tidepool.org',
    UPLOAD_URL: 'https://stg-uploads.tidepool.org',
    DATA_URL: 'https://stg-api.tidepool.org/dataservices',
    BLIP_URL: 'https://stg-blip.tidepool.org'
  },
  Integration: {
    API_URL: 'https://int-api.tidepool.org',
    UPLOAD_URL: 'https://int-uploads.tidepool.org',
    DATA_URL: 'https://int-api.tidepool.org/dataservices',
    BLIP_URL: 'https://int-blip.tidepool.org'
  },
  Production: {
    API_URL: 'https://api.tidepool.org',
    UPLOAD_URL: 'https://uploads.tidepool.org',
    DATA_URL: 'https://api.tidepool.org/dataservices',
    BLIP_URL: 'https://blip.tidepool.org'
  }
};

export class App extends Component {
  static propTypes = {
    route: PropTypes.shape({
      api: PropTypes.func.isRequired
    }).isRequired
  };

  constructor(props) {
    super(props);
    this.log = bows('App');
    this.handleDismissDropdown = this.handleDismissDropdown.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.setServer = this.setServer.bind(this);
    const initial_server = _.findKey(serverdata, (key) => key.API_URL === config.API_URL);
    this.state = {
      server: initial_server
    };
  }

  componentWillMount(){
    checkVersion(this.props.dispatch);
    let api = this.props.route.api;
    this.props.async.doAppInit(Object.assign({}, config), {
      api: api,
      carelink,
      device,
      localStore,
      log: this.log
    });

    window.addEventListener('contextmenu', this.handleContextMenu, false);
  }

  setServer(info) {
    console.log('will use', info.label, 'server');
    var serverinfo = serverdata[info.label];
    this.props.route.api.setHosts(serverinfo);
    this.setState({server: info.label});
  }

  render() {
    return (
      <div className={styles.app} onClick={this.handleDismissDropdown}>
        <Header location={this.props.location} />
        {this.props.children}
        <Footer version={config.version} />
        {/* VersionCheck as overlay */}
        {this.renderVersionCheck()}
        <UpdateModal />
        <UpdateDriverModal />
      </div>
    );
  }

  handleContextMenu(e){
    e.preventDefault();
    const { clientX, clientY } = e;
    let template = [];
    if (process.env.NODE_ENV === 'development') {
      template.push({
        label: 'Inspect element',
        click() {
          remote.getCurrentWindow().inspectElement(clientX, clientY);
        }
      });
      template.push({
        type: 'separator'
      });
    }
    if (this.props.location.pathname === pagesMap.LOGIN) {
      template.push({
        label: 'Change server',
        submenu: [
          {
            label: 'Local',
            click: this.setServer,
            type: 'radio',
            checked: this.state.server === 'Local'
          },
          {
            label: 'Development',
            click: this.setServer,
            type: 'radio',
            checked: this.state.server === 'Development'
          },
          {
            label: 'Staging',
            click: this.setServer,
            type: 'radio',
            checked: this.state.server === 'Staging'
          },
          {
            label: 'Integration',
            click: this.setServer,
            type: 'radio',
            checked: this.state.server === 'Integration'
          },
          {
            label: 'Production',
            click: this.setServer,
            type: 'radio',
            checked: this.state.server === 'Production'
          }
        ]
      });
      template.push({
        label: 'Toggle Debug Mode',
        type: 'checkbox',
        checked: debugMode.isDebug,
        click() {
          debugMode.setDebug(!debugMode.isDebug);
        }
      });
    }
    const menu = Menu.buildFromTemplate(template);
    menu.popup(remote.getCurrentWindow());
  }

  handleDismissDropdown() {
    const { dropdown } = this.props;
    // only toggle the dropdown by clicking elsewhere if it's open
    if (dropdown === true) {
      this.props.sync.toggleDropdown(dropdown);
    }
  }

  renderVersionCheck() {
    const { readyToRenderVersionCheckOverlay, unsupported } = this.props;
    if (readyToRenderVersionCheckOverlay === false || unsupported === false) {
      return null;
    }
    if (unsupported instanceof Error) {
      return (
        <VersionCheckError errorMessage={unsupported.message || 'Unknown error'}/>
      );
    }
    if (unsupported === true) {
      return (
        <UpdatePlease knowledgeBaseLink={urls.HOW_TO_UPDATE_KB_ARTICLE} />
      );
    }
  }
}

App.propTypes = {};

export default connect(
  (state, ownProps) => {
    return {
      // plain state
      dropdown: state.dropdown,
      unsupported: state.unsupported,
      // derived state
      readyToRenderVersionCheckOverlay: (
        !state.working.initializingApp && !state.working.checkingVersion
      )
    };
  },
  (dispatch) => {
    return {
      async: bindActionCreators(asyncActions, dispatch),
      sync: bindActionCreators(syncActions, dispatch),
      dispatch: dispatch
    };
  }
)(App);
