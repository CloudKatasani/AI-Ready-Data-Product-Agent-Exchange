/**
 * pnpm doctor [--ping] — pre-demo checks (12 §5): Node version, free disk, app DB, packs and warehouses
 * (built for the current pack content), golden files present, API key presence (never the value) and an
 * optional 1-token live ping, clock sanity. Prints a "demo ready" verdict; exits 1 when not ready.
 */
import { existsSync, statfsSync } from 'node:fs';
import { join } from 'node:path';
import { anthropicApiKey, getEnv } from '../src/lib/config/env';
import { getPack, listPackIds, packsDir } from '../src/lib/packs/registry';
import { type Check, readinessChecks } from '../src/lib/presenter/readiness-check';
import { parseArgs } from './cli-args';

const { flags } = parseArgs(process.argv.slice(2));
const checks: Check[] = [];
const major = Number(process.versions.node.split('.')[0]);
checks.push({ name: 'node', ok: major >= 22, detail: `Node ${process.versions.node} (need ≥ 22)` });
try {
  const fs = statfsSync(process.cwd());
  const freeGb = (fs.bavail * fs.bsize) / 1e9;
  checks.push({ name: 'disk', ok: freeGb >= 1, detail: `${freeGb.toFixed(1)} GB free (need ≥ 1 GB)` });
} catch {
  checks.push({ name: 'disk', ok: true, detail: 'free space unknown on this platform' });
}
checks.push(...(await readinessChecks()));
for (const id of listPackIds()) {
  try {
    const p = getPack(id);
    if (p.manifest.depth !== 'deep') continue;
    const ok = existsSync(join(packsDir(), id, 'golden.json'));
    checks.push({ name: `golden:${id}`, ok, detail: ok ? `${id}: golden answers recorded` : `${id}: no golden.json (pnpm golden --pack ${id} --update)` });
  } catch {
    // reported by readinessChecks
  }
}
const now = new Date();
checks.push({ name: 'clock', ok: now.getUTCFullYear() >= 2024, detail: `system clock ${now.toISOString().slice(0, 10)} (packs answer as of their own asOf date)` });
const key = anthropicApiKey(getEnv());
checks.push({ name: 'llm-key', ok: true, detail: key ? 'API key present — Live and Auto modes available' : 'no API key — Scripted mode only (Auto falls back visibly)' });
if (key && flags.ping) {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const model = getEnv().KEYSTONE_MODEL_FAST ?? getEnv().KEYSTONE_MODEL_ANSWER;
    if (!model) throw new Error('set KEYSTONE_MODEL_FAST to ping');
    await new Anthropic({ apiKey: key, maxRetries: 0, timeout: 10_000 }).messages.create({ model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] });
    checks.push({ name: 'llm-ping', ok: true, detail: 'live ping ok' });
  } catch (e) {
    checks.push({ name: 'llm-ping', ok: false, detail: `live ping failed: ${e instanceof Error ? e.message.split('\n')[0] : 'error'}` });
  }
}
for (const c of checks) console.log(`${c.ok ? '✔' : '✘'} ${c.name.padEnd(22)} ${c.detail}`);
const ready = checks.every((c) => c.ok);
console.log(ready ? '\nDemo ready.' : '\nNot ready — fix the ✘ items above.');
process.exit(ready ? 0 : 1);
