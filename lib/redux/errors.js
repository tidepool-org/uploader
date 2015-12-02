export const ErrorText = {
  E_INIT: 'Error during app initialization.'
}

export function getLoginErrorMessage(status) {
  switch(status) {
    case 400:
      return 'Sorry, I need a username to log you in!'
    case 401:
      return 'Login error! Check your username and password.'
    default:
      return 'Sorry, error attempting to log in.'
  }
}
