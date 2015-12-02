import { ActionTypes, Pages, Paths } from './constants'

export function setForgotPasswordUrl(url) {
  return { type: ActionTypes.SET_FORGOT_PASSWORD_URL, payload: { url } }
}

export function setSignUpUrl(url) {
  return { type: ActionTypes.SET_SIGNUP_URL, payload: { url } }
}

export function setOs(os) {
  return { type: ActionTypes.SET_OS, payload: { os } }
}

export function setPage(page) {
  return { type: ActionTypes.SET_PAGE, payload: { page } }
}

export function setVersion(version) {
  return { type: ActionTypes.SET_VERSION, payload: { version }}
}

export function toggleDropdown(previous) {
  return { type: ActionTypes.TOGGLE_DROPDOWN, payload: { isVisible: !previous }}
}