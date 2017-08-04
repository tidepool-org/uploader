const shell = require('shelljs');
const nodegit = require('nodegit');
const {
  gitDescribeSync
} = require('git-describe');

const gitInfo = gitDescribeSync();
if (gitInfo.dirty) {
  console.log('Please start with a clean repo');
  shell.exit(1);
}

const qaVersion = gitInfo.semverString.replace('+', '.');

(async() => {
  const repo = await nodegit.Repository.open('.');
  const index = await repo.refreshIndex();

  const defaultSig = nodegit.Signature.default(repo);

  for (const file of ['package.json', 'app/package.json']) {
    shell.sed('-i', '"version":[ ]*".*",$', `"version": "${qaVersion}",`, file);
    await index.addByPath(file);
  }

  await index.write();
  const oid = await index.writeTree();
  const head = await nodegit.Reference.nameToId(repo, 'HEAD');
  const parent = await repo.getCommit(head);
  const commitId = await repo.createCommit('HEAD', defaultSig, defaultSig, `Create QA build version ${qaVersion}`, oid, [parent]);
  console.log(`Created QA build version '${qaVersion}' with commit ID '${commitId}'`);
})();
