/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2026, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

const fs = require('fs');
const path = require('path');
const { SES } = require('@aws-sdk/client-ses');
const semver = require('semver');
const pkg = require('../package.json');

const VT_BASE = 'https://www.virustotal.com/api/v3';
const RELEASE_DIR = path.join(__dirname, '..', 'release');
const ORG = 'tidepool-org';
const REPO = 'uploader';
const SENDER = process.env.VT_SENDER || 'noreply@tidepool.org';
const RECIPIENT = process.env.VT_RECIPIENT || 'gerrit@tidepool.org';
const AWS_REGION = process.env.AWS_REGION || 'us-west-2';
const POLL_INTERVAL_MS = 30 * 1000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30 * 1000;
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

async function isReleaseCandidate() {
  const current = pkg.version;

  if (semver.prerelease(current) !== null) {
    console.log(`Version ${current} is a prerelease; skipping VT scan.`);
    return false;
  }

  const res = await fetch(
    `https://api.github.com/repos/${ORG}/${REPO}/releases/latest`,
    {
      headers: { 'user-agent': `${ORG}.vt-submit`, accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }
  );
  if (res.status === 404) {
    console.log('No prior GitHub release found; treating as new release.');
    return true;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch latest release: ${res.status} ${await res.text()}`);
  }
  const tagName = (await res.json()).tag_name;
  const latest = semver.clean(tagName);
  if (!latest) {
    throw new Error(`Could not parse latest release tag: ${tagName}`);
  }

  if (!semver.gt(current, latest)) {
    console.log(`Version ${current} is not greater than latest release ${latest}; skipping VT scan.`);
    return false;
  }

  console.log(`Version ${current} > latest release ${latest}; proceeding with VT scan.`);
  return true;
}

function findInstaller() {
  const entries = fs.readdirSync(RELEASE_DIR, { withFileTypes: true });
  const matches = entries
    .filter((e) => e.isFile() && /Setup.*\.exe$/i.test(e.name))
    .map((e) => e.name)
    .sort();
  if (matches.length === 0) {
    throw new Error(`No Setup .exe found in ${RELEASE_DIR}`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple Setup .exe files found in ${RELEASE_DIR}: ${matches.join(', ')}`);
  }
  return path.join(RELEASE_DIR, matches[0]);
}

async function vtFetch(url, apiKey, init = {}) {
  const res = await fetch(url, {
    ...init,
    signal: init.signal || AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      'x-apikey': apiKey,
      accept: 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${init.method || 'GET'} ${url} failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function getUploadUrl(apiKey) {
  const json = await vtFetch(`${VT_BASE}/files/upload_url`, apiKey);
  return json.data;
}

async function uploadFile(uploadUrl, filePath, apiKey) {
  const blob = await fs.openAsBlob(filePath);
  const form = new FormData();
  form.append('file', blob, path.basename(filePath));

  const json = await vtFetch(uploadUrl, apiKey, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });
  return json.data.id;
}

async function pollAnalysis(analysisId, apiKey) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const json = await vtFetch(`${VT_BASE}/analyses/${analysisId}`, apiKey);
    const { status } = json.data.attributes;
    console.log(`Analysis ${analysisId}: ${status}`);
    if (status === 'completed') {
      return json;
    }
    if (status !== 'queued' && status !== 'in-progress') {
      throw new Error(`Analysis ${analysisId} returned unexpected status: ${status}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Analysis ${analysisId} did not complete within ${POLL_TIMEOUT_MS / 1000}s`);
}

function formatReport(filename, analysisId, analysis) {
  const { stats, results } = analysis.data.attributes;
  const sha256 = analysis.meta?.file_info?.sha256;
  const permalink = sha256
    ? `https://www.virustotal.com/gui/file/${sha256}`
    : `https://www.virustotal.com/gui/analysis/${analysisId}`;

  const flagged = Object.entries(results || {})
    .filter(([, r]) => r.category === 'malicious' || r.category === 'suspicious')
    .map(([engine, r]) => `  - ${engine}: ${r.category} (${r.result})`)
    .join('\n');

  return [
    `File:       ${filename}`,
    `SHA-256:    ${sha256 || 'unknown'}`,
    `Permalink:  ${permalink}`,
    '',
    'Stats:',
    `  Malicious:  ${stats.malicious}`,
    `  Suspicious: ${stats.suspicious}`,
    `  Undetected: ${stats.undetected}`,
    `  Harmless:   ${stats.harmless}`,
    `  Timeout:    ${stats.timeout}`,
    '',
    flagged ? `Flagged by:\n${flagged}` : 'No engines flagged this file.',
    '',
  ].join('\n');
}

function verdict(stats) {
  if (stats.malicious > 0) return `MALICIOUS (${stats.malicious})`;
  if (stats.suspicious > 0) return `SUSPICIOUS (${stats.suspicious})`;
  return 'clean';
}

async function sendEmail(filename, report, stats) {
  const params = {
    Source: SENDER,
    Destination: { ToAddresses: [RECIPIENT] },
    Message: {
      Subject: {
        Data: `VirusTotal scan: ${filename} — ${verdict(stats)}`,
        Charset: 'UTF-8',
      },
      Body: { Text: { Data: report, Charset: 'UTF-8' } },
    },
  };

  const data = await new SES({ region: AWS_REGION }).sendEmail(params);
  console.log(`E-mail sent (MessageId: ${data.MessageId})`);
}

async function main() {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    throw new Error('VIRUSTOTAL_API_KEY environment variable is not set');
  }

  if (!(await isReleaseCandidate())) {
    return;
  }

  const filePath = findInstaller();
  const filename = path.basename(filePath);
  const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1);
  console.log(`Submitting ${filename} (${sizeMB} MB) to VirusTotal...`);

  const uploadUrl = await getUploadUrl(apiKey);
  const analysisId = await uploadFile(uploadUrl, filePath, apiKey);
  console.log(`Analysis ID: ${analysisId}`);

  const analysis = await pollAnalysis(analysisId, apiKey);
  const report = formatReport(filename, analysisId, analysis);
  console.log(report);

  await sendEmail(filename, report, analysis.data.attributes.stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
