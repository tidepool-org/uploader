import { Application } from 'spectron';
import path from 'path';
import chaiAsPromised from 'chai-as-promised';
import { should, use } from 'chai';
import LoginScreen from './src/LoginScreen';
import Base from './src/Base';

global.beforeAll(() => {
  should();
  use(chaiAsPromised);
});

export async function startApp() {
  const electronPath = path.resolve(__dirname, '../../node_modules/.bin/electron');
  const app = new Application({
    path: electronPath,
    args: [path.join(__dirname, '../../app')],
  });
  // chaiAsPromised allows us to make assertions directly on promises
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
