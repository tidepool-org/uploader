import { spectronUserEmail, spectronUserPassword } from '../config';

class LoginScreen {
    setApp = function (app) {
      this.app = app;
    };

    get loginUsername() {
      return spectronUserEmail;
    }

    get loginPassword() {
      return spectronUserPassword;
    }

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
      return 'button[class*="btnSecondary"]';
    }
}

export default new LoginScreen();
