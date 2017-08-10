#!/usr/bin/env babel-node

global.__DEBUG__ = true;

import fs from 'fs';
import {FreeStyleLibreData} from '../freeStyleLibreData';
import builder from '../../../objectBuilder.js';
import {stringify} from './stringify';

const intro = 'FSLibre Data CLI:';

console.log(intro, 'Reading JSON data...');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'), (k, v) => {
  if (v !== null && typeof v === 'object' && 'type' in v &&
    v.type === 'Buffer' && 'data' in v && Array.isArray(v.data)) {
    // re-create Buffer objects for data fields of aapPackets
    return new Buffer(v.data);
  }
  return v;
});

const cfg = {
  timezone: 'Europe/Berlin',
  builder: builder()
};
const dataParser = new FreeStyleLibreData(cfg);

console.log(intro, 'Processing AAP packets, length:', data.aapPackets.length);
data.post_records = dataParser.processAapPackets(data.aapPackets);
console.log(intro, 'Num post records:', data.post_records.length);

console.log(intro, 'uploadCallback:', 'writing data to file "data.json"...');
fs.writeFile('data.json', stringify(data, {indent: 2, maxLevelPretty: 3}), 'utf8', () => {
  // exit from main electron process
  console.log(intro, 'Exiting...');
  process.exit();
});
