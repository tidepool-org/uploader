class LoginScreen {
    setApp = function (app) {
      this.app = app;
    };

    get usernameInput() {
      return this.app.client.$('[placeholder="Email"]');
    }

    get passwordInput() {
      return this.app.client.$('[placeholder="Password"]');
    }

    get loginButton() {
      return this.app.client.$('button[type="submit"]');
    }

    get signUpLink() {
      return this.app.client.$('[href*="signup"]');
    }

    get tidepoolLogo() {
      return this.app.client.$('img[class*="logo"]');
    }

    get uploaderLogo() {
      return this.app.client.$('div[class*="heroText"]');
    }

    get forgotPasswordLink() {
      return this.app.client.$('a[href="https://app.tidepool.org/request-password-from-uploader"]');
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

    get driverDismiss() {
      return this.app.client.$('button[class*="btnSecondary"]');
    }
}

export default new LoginScreen();
