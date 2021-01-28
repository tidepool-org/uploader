class UploadScreen {
  setApp = function (app) {
    this.app = app;
  };

  get loginName() {
    return this.app.client.$('[class*="LoggedInAs"]');
  }

  get deviceSelectionContainer() {
    return this.app.client.$('[class*="DeviceSelection-module"]');
  }

  get accuCheckUsbCheckbox() {
    return this.app.client.$('input[value="accuchekusb"]');
  }

  get accuCheckUsbLabel() {
    return this.app.client.$('label[for="accuchekusb"]');
  }

  get doneButton() {
    return this.app.client.$('button[type="submit"]');
  }

  get timezoneModule() {
    return this.app.client.$('[class*="TimezoneDropdown-module"]');
  }

  get timeZoneDropdown() {
    return this.app.client.$('[class*="Select-input"]');
  }

  get timeZoneMessage() {
    return this.app.client.$('[class*="TimezoneDropdown-module_timeDetail]');
  }

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
