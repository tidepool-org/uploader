/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

import React, { Component } from 'react';
import { Provider } from 'react-redux';

import configureStore from '../../redux/store/configureStore';

import App from '../App';
import DevTools from '../../components/DevTools';

import styles from '../../../styles/components/DevTools.module.less';

const { api, store, version } = configureStore();

export default class Root extends Component {
  render() {
    return (
      <Provider store={store}>
        <div className={styles['DevTools-container']}>
          <App api={api} os={this.props.os} version={version} />
          <div>
            <DevTools store={store} />
          </div>
        </div>
      </Provider>
    );
  }
}
