import { applyMiddleware, compose, createStore } from 'redux'
import createLogger from 'redux-logger'
import thunk from 'redux-thunk'

import uploader from '../reducers'

import DevTools from '../../components/DevTools.jsx'

const finalCreateStore = compose(
  applyMiddleware(thunk),
  applyMiddleware(createLogger()),
  DevTools.instrument()
)(createStore)

export default function configureStore(initialState) {
  const store = finalCreateStore(uploader, initialState)
  return store
}