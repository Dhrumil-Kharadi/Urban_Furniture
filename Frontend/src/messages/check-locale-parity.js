const fs = require('fs');
const path = require('path');

const dir = __dirname;
const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));
const hi = JSON.parse(fs.readFileSync(path.join(dir, 'hi.json'), 'utf8'));
const gu = JSON.parse(fs.readFileSync(path.join(dir, 'gu.json'), 'utf8'));

function flattenKeys(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(flattenKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = new Set(flattenKeys(en));
const hiKeys = new Set(flattenKeys(hi));
const guKeys = new Set(flattenKeys(gu));

console.log(`Total keys: en=${enKeys.size}, hi=${hiKeys.size}, gu=${guKeys.size}`);

const missingInHi = [...enKeys].filter(k => !hiKeys.has(k));
const missingInGu = [...enKeys].filter(k => !guKeys.has(k));
const extraInHi = [...hiKeys].filter(k => !enKeys.has(k));
const extraInGu = [...guKeys].filter(k => !enKeys.has(k));

let hasErrors = false;

if (missingInHi.length > 0) {
  console.error(`\nMissing in Hindi (${missingInHi.length}):`);
  missingInHi.forEach(k => console.error(`  - ${k}`));
  hasErrors = true;
}

if (missingInGu.length > 0) {
  console.error(`\nMissing in Gujarati (${missingInGu.length}):`);
  missingInGu.forEach(k => console.error(`  - ${k}`));
  hasErrors = true;
}

if (extraInHi.length > 0) {
  console.warn(`\nExtra in Hindi (${extraInHi.length}):`);
  extraInHi.forEach(k => console.warn(`  - ${k}`));
  hasErrors = true;
}

if (extraInGu.length > 0) {
  console.warn(`\nExtra in Gujarati (${extraInGu.length}):`);
  extraInGu.forEach(k => console.warn(`  - ${k}`));
  hasErrors = true;
}

if (!hasErrors) {
  console.log('\n[SUCCESS] Perfect parity across en, hi, and gu! All key trees are identical.');
  process.exit(0);
} else {
  console.log('\n[FAILURE] Key disparity found.');
  process.exit(1);
}
