class Base {
  setApp = function (app) {
    this.app = app;
  }

  windowCount() {
    return this.app.client.waitUntilWindowLoaded().getWindowCount();
  }

  focusUploader() {
    return this.app.browserWindow.focus();
  }
}

export default new Base();
