const { notarize } = require('@electron/notarize');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function notarizing(context) {
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

  // Re-sign helper without hardened runtime
  if (fs.existsSync(helperPath)) {
    console.log(`Re-signing helper binary: ${helperPath}`);
    try {
      execSync(`codesign --remove-signature "${helperPath}"`);
      execSync(`codesign --force --sign - "${helperPath}"`);
    } catch (err) {
      console.warn('Failed to re-sign helper binary:', err.message);
    }
  } else {
    console.warn('Helper binary not found, skipping re-sign step.');
  }

  console.log(`Notarizing ${appName}`);

  return await notarize({
    appPath,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
    teamId: process.env.TEAMID,
    tool: 'notarytool',
  });
};
