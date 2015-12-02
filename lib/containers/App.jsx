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

import { doAppInit, doLogin, toggleDropdown, Pages } from '../redux/actions'

import Loading from '../components/Loading.jsx'
import Login from '../components/Login.jsx'
import LoggedInAs from '../components/LoggedInAs.jsx'

export default class App extends Component {
  constructor(props) {
    super(props)
    this.log = bows('App');
    this.handleToggleDropdown = this.handleToggleDropdown.bind(this)
    this.handleLogin = this.handleLogin.bind(this)
  }

  componentWillMount() {
    const { dispatch } = this.props
    dispatch(doAppInit(config, {
      api,
      carelink,
      device,
      localStore,
      log: this.log
    }))
  }

  render() {
    const { isLoggedIn, page } = this.props
    return (
      <div className={'App App--' + page.toLowerCase()}
        onClick={isLoggedIn ? this.handleToggleDropdown : _.noop}>
        <div className="App-header">{this.renderHeader()}</div>
        <div className="App-page">{this.renderPage()}</div>
        <div className="App-footer">{this.renderFooter()}</div>
      </div>
    );
  }

  handleLogin(creds, opts) {
    const { dispatch } = this.props
    dispatch(doLogin(creds, opts))
  }

  handleToggleDropdown() {
    const { dispatch } = this.props
    dispatch(toggleDropdown(this.props.dropdown))
  }

  renderHeader() {
    const { dropdown, isLoggedIn, page, url, users } = this.props
    if (page === Pages.LOADING) {
      return null
    }

    if (!isLoggedIn) {
      return (
        <div className="App-signup">
          <a  href={url.signUp} target="_blank">
            <i className="icon-add"> Sign up</i></a>
        </div>
      )
    }

    return (
      <LoggedInAs
        dropMenu={dropdown}
        user={users[users.loggedInUser]}
        onClicked={_.noop}
        onChooseDevices={_.noop}
        onLogout={_.noop} />
    );
  }

  renderPage() {
    const { page, url, users } = this.props

    if (page === Pages.LOADING) {
      return (<Loading />)
    }
    else if (page === Pages.LOGIN) {
      return (
        <Login errorMessage={users.errorMessage || null}
          forgotPasswordUrl={url.forgotPassword}
          isFetching={users.isFetching}
          onLogin={this.handleLogin} />
        )
    } else if (page === Pages.MAIN) {
      return null
    }
  }

  renderFooter() {
    const { version } = this.props
    return (
      <div>
        <div className="mailto">
          <a href="mailto:support@tidepool.org?Subject=Feedback on Blip" target="mailto">Send us feedback</a>
        </div>
        <div className="App-footer-version">{`v${version} beta`}</div>
      </div>
    )
  }
}

App.propTypes = {
  page: React.PropTypes.string.isRequired
}

function select(state) {
  return {
    dropdown: state.dropdown,
    isLoggedIn: !_.includes([Pages.LOADING, Pages.LOGIN], state.page),
    page: state.page,
    version: state.version,
    url: state.url,
    users: state.users
  }
}

// wrap the component to inject dispatch and state into it
export default connect(select)(App)