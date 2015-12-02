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

import React, { Component, PropTypes } from 'react'
import { connect } from 'react-redux'

import bows from '../bows.js'

import config from '../config.js'

import api from '../core/api.js'
import carelink from '../core/carelink.js'
import device from '../core/device.js'
import localStore from '../core/localStore.js'

import { appInit } from '../redux/actions'

export default class App extends Component {
  constructor(props) {
    super(props)
    this.log = bows('App');
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
    return (<p>{this.props.page}</p>);
  }
}

App.propTypes = {
  page: React.PropTypes.string.isRequired
}

// Which props do we want to inject, given the global state?
// Note: use https://github.com/faassen/reselect for better performance.
function select(state) {
  return {
    page: state.page
  }
}

// Wrap the component to inject dispatch and state into it
export default connect(select)(App)