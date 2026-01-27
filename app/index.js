import React from 'react';
import { render } from 'react-dom';

import localStore from '../lib/core/localStore.js';
import Top from './containers/Top.js';

localStore.init(localStore.getInitialState(), () => {});

render(
  <Top/>,
  document.getElementById('app')
);
