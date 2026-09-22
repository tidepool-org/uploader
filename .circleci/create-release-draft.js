// electron-builder 26.15.x has a race in its publisher cache (getOrCreatePublisher)
// that can create duplicate draft releases. Pre-creating the draft means the build
// jobs only ever hit the raceless "reuse existing draft" path.
const token = process.env.GH_TOKEN;
if (process.env.CIRCLE_PR_NUMBER) {
  console.log('Forked PR; builds do not publish, skipping draft creation.');
  process.exit(0);
}
if (!token) {
  console.error('GH_TOKEN is not set.');
  process.exit(1);
}

const { version } = require('../app/package.json');
const tag = `v${version}`;
const api = 'https://api.github.com/repos/tidepool-org/uploader/releases';
const headers = { authorization: `token ${token}`, 'user-agent': 'tidepool-org-uploader-ci' };

(async () => {
  const res = await fetch(`${api}?per_page=100`, { headers });
  if (!res.ok) throw new Error(`Failed to list releases: ${res.status} ${await res.text()}`);
  // Match as broadly as electron-builder does (v-prefixed or bare tag), and skip if
  // ANY release exists for this version — creating a draft alongside a PUBLISHED
  // release would divert the build jobs' uploads away from it.
  const existing = (await res.json()).find((r) => r.tag_name === tag || r.tag_name === version);
  if (existing) {
    console.log(`${existing.draft ? 'Draft' : 'Published'} release for ${existing.tag_name} already exists.`);
    return;
  }
  const create = await fetch(api, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tag_name: tag, name: version, draft: true, prerelease: version.includes('-') }),
  });
  if (!create.ok) throw new Error(`Failed to create draft: ${create.status} ${await create.text()}`);
  console.log(`Created draft release for ${tag}.`);
})();
