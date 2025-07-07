const cp = require('child_process');

function isEmpty(value) {
  return !value || !value.length;
}

// uses configuration.path to sign the file, passes in the keyvault auth as an env variable
exports.default = async function (configuration) {
  if (isEmpty(configuration.path)) {
    throw new Error('Path to file is required');
  }
  // AzureSignTool command with all the required parameters
  const command = 'azuresigntool sign -kvu "${AZURE_KEY_VAULT_URI}" --azure-key-vault-managed-identity -kvc "${AZURE_CERT_NAME}" -tr http://timestamp.digicert.com -v';

  // throws an error if non-0 exit code, that's what we want.
  cp.execSync(`${command.join(' ')} "${configuration.path}"`, {
    stdio: 'inherit',
  });
};
