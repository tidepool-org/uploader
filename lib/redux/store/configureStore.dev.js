import { applyMiddleware, compose, createStore } from 'redux'
import createLogger from 'redux-logger'
import thunk from 'redux-thunk'

import uploader from '../reducers'

import DevTools from '../../components/DevTools.jsx'

const finalCreateStore = compose(
  /*
   * order is significant here!
   * in particular, the thunk middleware must be applied first
   * redux middleware doc is a work of easily-understood genius:
   * http://redux.js.org/docs/advanced/Middleware.html
   */
  applyMiddleware(thunk),
  applyMiddleware(createLogger()),
  DevTools.instrument()
)(createStore)

export default function configureStore(initialState) {
  const store = finalCreateStore(uploader, initialState)
  return store
}