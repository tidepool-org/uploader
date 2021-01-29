import { Application } from 'spectron';
import path from 'path';
import chaiAsPromised from 'chai-as-promised';
import { should, use } from 'chai';
import LoginScreen from './src/LoginScreen';
import Base from './src/Base';
import UploadScreen from './src/UploadScreen';

global.beforeAll(() => {
  should();
  use(chaiAsPromised);
});

function getElectronPath() {
  let electronPath = path.join(__dirname, '../../node_modules/.bin/electron');
    if (process.platform ==='win32') electronPath += '.cmd';
    return electronPath; 
}

export async function startApp() {
  const app = new Application({
    path: getElectronPath(),
    args: [path.join(__dirname, '../../app')],
  });
  // chaiAsPromised allows us to make assertions directly on promises
  chaiAsPromised.transferPromiseness = app.transferPromiseness;
  UploadScreen.setApp(app);
  LoginScreen.setApp(app);
  Base.setApp(app);
  return app.start();
}

export async function stopApp(app) {
  if (app && app.isRunning()) {
    await app.stop();
  }
}
