import { Application } from 'spectron';
import { should, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import electron from 'electron';
import path from 'path';

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
  return app.start();
}

export async function stopApp(app) {
  if (app && app.isRunning()) {
    await app.stop();
  }
}
