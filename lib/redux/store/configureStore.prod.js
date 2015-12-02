import { applyMiddleware, compose, createStore } from 'redux'
import thunk from 'redux-thunk'

import uploader from '../reducers'

const finalCreateStore = compose(
  applyMiddleware(thunk)
)(createStore)

export default function configureStore(initialState) {
  const store = finalCreateStore(uploader, initialState)
  return store
}