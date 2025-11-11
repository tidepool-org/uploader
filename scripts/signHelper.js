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
    console.log('Available signing identities:');
    try {
      execSync('security find-identity -v -p codesigning', { stdio: 'inherit' });
    } catch (err) {
      console.error('Could not list identities');
    }

    // Try signing with explicit identity from electron-builder's context
    const identity = context.packager.platformSpecificBuildOptions.identity ||
                     process.env.CSC_NAME ||
                     'Developer ID Application';

    console.log(`Attempting to sign with identity: ${identity}`);

    execSync(
      `codesign --force --sign "${identity}" "${helperPath}"`,
      { stdio: 'inherit', timeout: 30000 }
    );
  }
};
