import LoginScreen from '../../src/LoginScreen';
import Base from '../../src/Base';
import { startApp, stopApp } from '../../utilities';

jest.setTimeout(20000);

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
    let check = await app.client.isExisting(LoginScreen.driverDismiss);
    if (check) {
      await app.client.click(LoginScreen.driverDismiss);
    }
  });

  test('should login', async () => {
    await LoginScreen.usernameInput.setValue(LoginScreen.loginUsername);
    await LoginScreen.usernameInput.getValue()
      .should.eventually.equal(LoginScreen.loginUsername);
    await LoginScreen.passwordInput.setValue(LoginScreen.loginPassword);
    await LoginScreen.passwordInput.getValue()
      .should.eventually.equal(LoginScreen.loginPassword);
    await LoginScreen.loginButton.click();
  });
});
