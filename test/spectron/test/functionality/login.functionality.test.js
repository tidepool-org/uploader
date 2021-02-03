import LoginScreen from '../../src/LoginScreen';
import Base from '../../src/Base';
import UploadScreen from '../../src/UploadScreen';
import { startApp, stopApp } from '../../utilities';

describe('Login', () => {
  let app;
  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(async () => {
    await stopApp(app);
  });

  test('app should open and dismiss modals', async () => {
    await Base.windowCount()
      .should.eventually.have.at.least(1);
    if(process.env.CI_ENV === 'true'){
      return LoginScreen.driverDismiss.click();
    }
  });

  test('should login', async () => {
    await LoginScreen.usernameInput.setValue(process.env.SPECTRON_USER_EMAIL);
    await LoginScreen.usernameInput.getValue()
      .should.eventually.equal(process.env.SPECTRON_USER_EMAIL);
    await LoginScreen.passwordInput.setValue(process.env.SPECTRON_USER_PASSWORD);
    await LoginScreen.passwordInput.getValue()
      .should.eventually.equal(process.env.SPECTRON_USER_PASSWORD);
    await LoginScreen.waitUntilLoginButtonLoaded(5000);
    await LoginScreen.loginButton.click();
    await UploadScreen.waitUntilDeviceScreenLoaded();
    await UploadScreen.uploadDeviceList.isVisible()
      .should.eventually.be.true;
  });
});
