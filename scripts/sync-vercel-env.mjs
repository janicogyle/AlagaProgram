/**
 * Sync .env.local secrets to linked Vercel project (production + preview).
 * Usage: node scripts/sync-vercel-env.mjs
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

const envPath = resolve(process.cwd(), '.env.local');
const raw = readFileSync(envPath, 'utf8');

const parsed = {};
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + 1).trim();
  if (!parsed[key]) parsed[key] = value;
}

if (parsed.CLOUDINARY_CLOUD_NAME && parsed.CLOUDINARY_API_KEY && parsed.CLOUDINARY_API_SECRET) {
  parsed.CLOUDINARY_URL = `cloudinary://${parsed.CLOUDINARY_API_KEY}:${parsed.CLOUDINARY_API_SECRET}@${parsed.CLOUDINARY_CLOUD_NAME}`;
}

const KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'QR_CARD_SECRET',
  'SMS_OTP_SECRET',
  'UNISMS_API_KEY',
  'UNISMS_API_URL',
  'CLOUDINARY_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const TARGET_ENVS = ['production', 'preview'];

function addEnv(name, value) {
  for (const target of TARGET_ENVS) {
    const result = spawnSync(
      'pnpm',
      ['dlx', 'vercel@latest', 'env', 'add', name, target, '--force'],
      {
        input: value,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        shell: true,
      },
    );

    if (result.status !== 0) {
      const err = (result.stderr || result.stdout || '').trim();
      if (/already exists/i.test(err)) {
        console.log(`  [${target}] ${name} (exists, skipped)`);
        continue;
      }
      console.error(`  [${target}] ${name} FAILED:`, err);
      return false;
    }
    console.log(`  [${target}] ${name} OK`);
  }
  return true;
}

console.log('Syncing environment variables to Vercel...\n');

let ok = true;
for (const key of KEYS) {
  const value = parsed[key];
  if (!value) {
    console.log(`  skip ${key} (empty)`);
    continue;
  }
  console.log(`${key}:`);
  if (!addEnv(key, value)) ok = false;
}

if (!ok) process.exit(1);
console.log('\nDone. Redeploying production...');

const deploy = spawnSync('pnpm', ['dlx', 'vercel@latest', 'deploy', '--prod', '--yes'], {
  encoding: 'utf8',
  stdio: 'inherit',
  cwd: process.cwd(),
  shell: true,
});

process.exit(deploy.status === 0 ? 0 : 1);
