
class Base {
    setApp = function(app) {
        this.app = app;
    }
    appIsOpen() {
        return this.app.client.waitUntilWindowLoaded().getWindowCount();
    }
};

export default new Base();