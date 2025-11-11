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
  const helperPath = path.join(
    appPath,
    'Contents',
    'Resources',
    'driver/helpers/helper-macos'
  );

  if (fs.existsSync(helperPath)) {
    console.log(`Signing helper binary without hardened runtime: ${helperPath}`);
    execSync(
      `codesign --force --sign "Developer ID Application: Tidepool Project" --timestamp "${helperPath}"`,
      { stdio: 'inherit' }
    );
  }
};
