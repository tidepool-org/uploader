import { Application } from 'spectron';
import Electron from 'electron';
import path from 'path';
import chaiAsPromised from 'chai-as-promised';
import { should, use } from 'chai';
import LoginScreen from './src/LoginScreen';
import Base from './src/Base';
import UploadScreen from './src/UploadScreen';

global.beforeAll(() => {
  should();
  use(chaiAsPromised);
  jest.setTimeout(25000);
});

export async function startApp() {
  const app = new Application({
    path: Electron,
    args: [path.join(__dirname, '..', '..', 'app')],
  });
  // chaiAsPromised allows us to make assertions directly on promises
  chaiAsPromised.transferPromiseness = app.transferPromiseness;
  UploadScreen.setApp(app);
  LoginScreen.setApp(app);
  Base.setApp(app);
  return app.start().then(() => {
    app.browserWindow.focus();
    app.browserWindow.setAlwaysOnTop(true);
  });
}

export async function stopApp(app) {
  if (app && app.isRunning()) {
    await app.stop();
  }
}
