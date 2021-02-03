import LoginScreen from '../../src/LoginScreen';
import Base from '../../src/Base';
import { startApp, stopApp } from '../../utilities';

describe('UI Test', () => {
  let app;
  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(async () => {
    await stopApp(app);
  });

  test('app should open', async () => {
    await Base.windowCount()
      .should.eventually.have.at.least(1);
    if(process.env.CI_ENV === 'true'){
      return LoginScreen.driverDismiss.click();
    }
  });

  test('should have all UI elements', async () => {
    LoginScreen.signUpLink.isVisible()
      .should.eventually.be.true;
    await LoginScreen.tidepoolLogo.isVisible()
      .should.eventually.be.true;
    await LoginScreen.uploaderLogo.getText()
      .should.eventually.equal('Uploader');
    await LoginScreen.forgotPasswordLink.isVisible()
      .should.eventually.be.true;
    await LoginScreen.supportLink.getText()
      .should.eventually.equal('Get Support');
    await LoginScreen.privacyLink.getText()
      .should.eventually.equal('Privacy and Terms of Use');
    await LoginScreen.jdrfText.isVisible()
      .should.eventually.be.true;
    await LoginScreen.jdrfLogo.isVisible()
      .should.eventually.be.true;
    await LoginScreen.version.isVisible()
      .should.eventually.be.true;
    
  });
});