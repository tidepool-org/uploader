/* eslint-disable no-undef */
import LoginScreen from './src/LoginScreen';
import Base from './src/Base';
import { startApp, stopApp } from './utilities';

describe('Smoke Test', () => {
  let app;
  
  before(async () => {
    app = await startApp();
  });


  after(async () => {
    await stopApp(app);
  });

  it('should open', async () => {
    Base.appIsOpen().should.eventually.equal(1);
  });

  it('should have all UI elements', async () => {
    await LoginScreen.signUpLink.should.eventually.exist;
    await LoginScreen.tidepoolLogo.should.eventually.exist;
    await LoginScreen.uploaderLogo.getText()
      .should.eventually.equal('Uploader');
    await LoginScreen.forgotPasswordLink.should.eventually.exist;
    await LoginScreen.supportLink.getText()
      .should.eventually.equal('Get Support');
    await LoginScreen.privacyLink.getText()
      .should.eventually.equal('Privacy and Terms of Use');
    await LoginScreen.jdrfText.should.eventually.exist;
    await LoginScreen.jdrfLogo.should.eventually.exist;
    await LoginScreen.version.should.eventually.exist;
    
  });

  it('should login', async () => {
    await LoginScreen.usernameInput.setValue(LoginScreen.loginUsername);
    await LoginScreen.usernameInput.getValue()
      .should.eventually.equal(LoginScreen.loginUsername);
    await LoginScreen.passwordInput.setValue(LoginScreen.loginPassword);
    await LoginScreen.passwordInput.getValue()
      .should.eventually.equal(LoginScreen.loginPassword);
    await LoginScreen.loginButton.click();
  });
});
