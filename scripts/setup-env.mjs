// Creates .env from .env.example with a freshly generated secret.
// Prints variable NAMES only, never values, so it is safe for an AI agent to run.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const GENERATED = { JWT_ACCESS_SECRET: () => randomBytes(48).toString('base64url') };

const parseNames = (text) =>
  new Map(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );

if (!existsSync('.env.example')) {
  console.error('Run this from the capsule-api folder: .env.example not found.');
  process.exit(1);
}

if (!existsSync('.env')) {
  const filled = readFileSync('.env.example', 'utf8')
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^([A-Z0-9_]+)=$/);
      return m && GENERATED[m[1]] ? `${m[1]}=${GENERATED[m[1]]()}` : line;
    })
    .join('\n');
  writeFileSync('.env', filled, { mode: 0o600 });
  console.log('Created .env (generated: ' + Object.keys(GENERATED).join(', ') + ').');
  process.exit(0);
}

// .env exists: never overwrite it. Add only what is missing or empty.
let current = readFileSync('.env', 'utf8');
const have = parseNames(current);
const added = [];
for (const [name, make] of Object.entries(GENERATED)) {
  if (!have.get(name)) {
    current = have.has(name)
      ? current.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}=${make()}`)
      : `${current.replace(/\n*$/, '\n')}${name}=${make()}\n`;
    added.push(name);
  }
}
// Variables added to .env.example later, with a local default: copy them across.
const example = parseNames(readFileSync('.env.example', 'utf8'));
for (const [name, value] of example) {
  if (!have.has(name) && !added.includes(name) && value) {
    current = `${current.replace(/\n*$/, '\n')}${name}=${value}\n`;
    added.push(name);
  }
}
const missing = [...example.keys()].filter((name) => !have.has(name) && !added.includes(name));
if (added.length > 0) writeFileSync('.env', current, { mode: 0o600 });
console.log(
  '.env already exists; left as it is' +
    (added.length ? `, added: ${added.join(', ')}` : '') +
    (missing.length ? `. Not set (defaults apply): ${missing.join(', ')}` : '') +
    '.',
);
