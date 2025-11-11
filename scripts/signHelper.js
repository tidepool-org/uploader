const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function beforeSign(context) {
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
    console.log(`Signing helper binary: ${helperPath}`);
    try {
      // Sign with ad-hoc signature (no hardened runtime)
      execSync(`codesign --force --sign - "${helperPath}"`, { stdio: 'inherit' });
    } catch (err) {
      console.error('Failed to sign helper binary:', err.message);
      throw err;
    }
  } else {
    console.warn('Helper binary not found at expected path');
  }
}
