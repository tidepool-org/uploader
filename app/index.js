import React from 'react';
import { render } from 'react-dom';

import localStore from '../lib/core/localStore';
import Top from './containers/Top';

localStore.init(localStore.getInitialState(), () => {});

render(
  <Top/>,
  document.getElementById('app')
);
