class UploadScreen {
  setApp = function (app) {
    this.app = app;
  };

  get uploadDeviceList() {
    return this.app.client.$('div[class*="UploadList-module"]');
  }

  get supportLink() {
    return this.app.client.$('a[href="http://support.tidepool.org/"]');
  }

  get privacyLink() {
    return this.app.client.$('a[href="http://tidepool.org/legal/"]');
  }

  get jdrfText() {
    return this.app.client.$('span[class*="jdrfText"]');
  }

  get jdrfLogo() {
    return this.app.client.$('img[class*="jdrfImage"]');
  }

  get version() {
    return this.app.client.$('div[class*="version"]');
  }

  waitUntilDeviceScreenLoaded() {
    return this.app.client.waitUntilTextExists('[class*="UploadList-module__headline"]', 'Upload Devices', 5000);
  }
}

export default new UploadScreen();
