import { startApp, stopApp } from './utilities';

describe('Sample Test', () => {
  let app;

  beforeEach(async () => {
    app = await startApp();
  });

  afterEach(async () => {
    await stopApp(app);
  });

  it('opens the app', async () => {
    app.client.waitUntilWindowLoaded();
    app.client.getWindowCount()
      .should.eventually.equal(1);
  });

  it('should login', async () => {
    const loginUsername = 'ginny@tidepool.org';
    const loginPassword = 'aryan2016';
    app.client.waitUntilWindowLoaded();
    app.client.getWindowCount()
      .should.eventually.equal(1);
    await (app.client.$('[placeholder="Email"]')).setValue(loginUsername);
    await (app.client.$('[placeholder="Email"]')).getValue()
      .should.eventually.equal(loginUsername);
    await (app.client.$('[placeholder="Password"]')).setValue(loginPassword);
    await (app.client.$('[placeholder="Password"]')).getValue()
      .should.eventually.equal(loginPassword);
    await (app.client.$('[type="Submit"]')).click();
  });
});
