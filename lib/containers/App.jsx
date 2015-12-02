/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014-2015, Tidepool Project
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

import _ from 'lodash'
import React, { Component, PropTypes } from 'react'
import { connect } from 'react-redux'

import bows from '../bows.js'

import config from '../config.js'

import api from '../core/api.js'
import carelink from '../core/carelink.js'
import device from '../core/device.js'
import localStore from '../core/localStore.js'

import { appInit, toggleDropdown, Pages } from '../redux/actions'

import Loading from '../components/Loading.jsx'
import Login from '../components/Login.jsx'

export default class App extends Component {
  constructor(props) {
    super(props)
    this.log = bows('App');
    this.handleToggleDropdown = this.handleToggleDropdown.bind(this)
  }

  componentWillMount() {
    const { dispatch } = this.props
    dispatch(appInit(config, {
      api,
      carelink,
      device,
      localStore,
      log: this.log
    }))
  }

  render() {
    return (
      <div className={'App App--' + this.props.page.toLowerCase()}
        onClick={this.handleToggleDropdown}>
        <div className="App-header">{this.renderHeader()}</div>
        <div className="App-page">{this.renderPage()}</div>
        <div className="App-footer">{this.renderFooter()}</div>
      </div>
    );
  }

  handleToggleDropdown() {
    const { dispatch } = this.props
    dispatch(toggleDropdown(this.state.dropdown))
  }

  renderHeader() {
    return null;
  }

  renderPage() {
    const { page, url } = this.props

    if (page === Pages.LOADING) {
      return (<Loading />)
    }
    else if (page === Pages.LOGIN) {
      return (<Login onLogin={_.noop} forgotPasswordUrl={url.forgotPassword} />)
    }
  }

  renderFooter() {
    return (
      <div>
        <div className="mailto">
          <a href="mailto:support@tidepool.org?Subject=Feedback on Blip" target="mailto">Send us feedback</a>
        </div>
        <div className="App-footer-version">{'v'+this.props.version+' beta'}</div>
      </div>
    )
  }
}

App.propTypes = {
  page: React.PropTypes.string.isRequired
}

// Which props do we want to inject, given the global state?
// Note: use https://github.com/faassen/reselect for better performance.
function select(state) {
  return {
    dropdown: state.dropdown,
    page: state.page,
    version: state.version,
    url: state.url
  }
}

// Wrap the component to inject dispatch and state into it
export default connect(select)(App)