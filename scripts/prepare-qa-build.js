const shell = require('shelljs');
const {
  gitDescribeSync
} = require('git-describe');

const gitInfo = gitDescribeSync();
if (gitInfo.dirty) {
  console.log('Please start with a clean repo');
  shell.exit(1);
}

const qaVersion = gitInfo.semverString.replace('+', '.');

for (const file of ['package.json', 'app/package.json']) {
  shell.sed('-i', '"version":[ ]*".*",$', `"version": "${qaVersion}",`, file);
}
