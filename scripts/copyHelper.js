const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const isUniversalBuild = !appOutDir.includes('--x64') && !appOutDir.includes('--arm64');

  console.log(`afterPack: appOutDir=${appOutDir}, isUniversalBuild=${isUniversalBuild}`);

  // Only copy in the final universal build, not in intermediate arch builds
  if (!isUniversalBuild) {
    console.log('Skipping helper copy for intermediate arch build');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const helperDest = path.join(appPath, 'Contents', 'Resources', 'driver/helpers');
  const helperPath = path.join(helperDest, 'helper-macos');

  console.log('Copying helper binary to final universal build...');
  fs.mkdirSync(helperDest, { recursive: true });
  fs.copyFileSync('resources/mac/helpers/helper-macos', helperPath);
  fs.chmodSync(helperPath, 0o755);
  console.log('Helper binary copied successfully');
};
