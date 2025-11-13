const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const helperDest = path.join(appPath, 'Contents', 'Resources', 'driver/helpers');
  const helperPath = path.join(helperDest, 'helper-macos');

  // Only copy if it doesn't exist (universal build calls afterPack multiple times)
  if (!fs.existsSync(helperPath)) {
    console.log('Copying helper binary without processing...');
    fs.mkdirSync(helperDest, { recursive: true });
    fs.copyFileSync('resources/mac/helpers/helper-macos', helperPath);
    fs.chmodSync(helperPath, 0o755);
  }
}
