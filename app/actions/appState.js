/*
 * App-level mutable state shared by the action creators: the service
 * implementations injected at app init time, and the running app's
 * version info.
 */
const appState = {
  services: {},
  versionInfo: {},
};

export default appState;
