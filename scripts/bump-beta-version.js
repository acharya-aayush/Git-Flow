const fs = require('fs');
const path = require('path');

const versionFile = path.resolve(process.cwd(), 'BETA_VERSION');

if (!fs.existsSync(versionFile)) {
  throw new Error('BETA_VERSION file not found.');
}

const raw = fs.readFileSync(versionFile, 'utf8').trim();
const parts = raw.split('.').map((part) => Number(part));

if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || !Number.isInteger(n))) {
  throw new Error(`Invalid beta version format: ${raw}. Expected x.y.z.n`);
}

parts[3] += 1;
const next = parts.join('.');

fs.writeFileSync(versionFile, `${next}\n`, 'utf8');
console.log(next);
