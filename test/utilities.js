import { Application } from 'spectron';
import { should, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import electron from 'electron';
import path from 'path';
import LoginScreen from './src/LoginScreen';
import Base from './src/Base';

global.before(() => {
  should();
  use(chaiAsPromised);
});

export async function startApp() {
  const app = new Application({
    path: electron,
    args: [path.join(__dirname, '../app')],
  });
  chaiAsPromised.transferPromiseness = app.transferPromiseness;
  LoginScreen.setApp(app);
  Base.setApp(app);
  return app.start();
}

export async function stopApp(app) {
  if (app && app.isRunning()) {
    await app.stop();
  }
}
