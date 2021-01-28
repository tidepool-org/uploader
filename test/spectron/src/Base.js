class Base {
  setApp = function (app) {
    this.app = app;
  }

  windowCount() {
    return this.app.client.waitUntilWindowLoaded().getWindowCount();
  }
}

export default new Base();
