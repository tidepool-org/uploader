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

    const identityOutput = execSync('security find-identity -v -p codesigning').toString();
    console.log('Identity output:', identityOutput);

    const match = identityOutput.match(/([A-F0-9]{40})/);

    if (!match) {
      throw new Error('Could not find any signing identity');
    }

    const identityHash = match[1];
    console.log(`Using identity hash: ${identityHash}`);

    try {
      execSync(
        `codesign --force --sign ${identityHash} "${helperPath}"`,
        { stdio: 'inherit', timeout: 30000 }
      );
      console.log('Helper binary signed successfully');
    } catch (err) {
      console.error('Signing failed:', err.message);
      throw err;
    }
  }
};
