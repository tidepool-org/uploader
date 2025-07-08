const cp = require('child_process');

function isEmpty(value) {
  return !value || !value.length;
}

// uses configuration.path to sign the file, passes in the keyvault auth as an env variable
exports.default = async function (configuration) {
  const timeserver = 'http://timestamp.digicert.com';
  const azureURL = process.env.AZURE_KEY_VAULT_URI;
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const certificateName = process.env.AZURE_CERT_NAME;

  if (isEmpty(configuration.path)) {
    throw new Error('Path to file is required');
  }

  const command = [
      'azuresigntool.exe sign',
      '-kvu',
      azureURL,
      '-kvi',
      clientId,
      '-kvt',
      tenantId,
      '-kvs',
      clientSecret,
      '-kvc',
      certificateName,
      '-tr',
      timeserver,
      //'-td',
      //'sha384',
      '-v',
    ];

    // throws an error if non-0 exit code, that's what we want.
    cp.execSync(`${command.join(' ')} "${configuration.path}"`, {
      stdio: 'inherit',
    });
};
