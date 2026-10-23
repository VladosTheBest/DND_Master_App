import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const shell = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/sh.exe' : '/bin/sh';
const unix = value => value.replaceAll('\\', '/');
async function execute(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(shell, args, { env: { ...process.env, ...env }, windowsHide: true });
    let output = '';
    child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
    child.on('error', reject); child.on('close', code => resolve({ code, output }));
  });
}

test('supervisor retries failed starts, recovers, forwards stop and never overlaps writers', { timeout: 20000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shadow-supervisor-'));
  const worker = join(dir, 'server.sh'), supervisor = join(dir, 'supervisor.sh');
  await writeFile(worker, `#!/bin/sh
if [ "$#" -gt 0 ]; then echo "$*"; exit 7; fi
n=0
if [ -f "$COUNT_FILE" ]; then n=$(cat "$COUNT_FILE"); fi
n=$((n + 1)); echo "$n" > "$COUNT_FILE"
if [ "$n" -lt 3 ]; then exit 1; fi
if [ -f "$LOCK_FILE" ]; then echo OVERLAP >> "$EVENTS"; exit 1; fi
touch "$LOCK_FILE"
if command -v setsid >/dev/null 2>&1; then sleep 120 & echo "$!" > "$CHILD_FILE"; fi
trap 'rm -f "$LOCK_FILE"; echo STOPPED >> "$EVENTS"; exit 0' TERM INT
echo READY >> "$EVENTS"
while :; do sleep 1; done
`);
  const script = (await readFile(process.env.SUPERVISOR_SOURCE || resolve('scripts/run-server.sh'), 'utf8')).replaceAll('/app/shadow-edge-server', `"${unix(worker)}"`);
  await writeFile(supervisor, script); await chmod(worker, 0o755); await chmod(supervisor, 0o755);
  const env = { SUPERVISOR: unix(supervisor), COUNT_FILE: unix(join(dir, 'count')), EVENTS: unix(join(dir, 'events')), LOCK_FILE: unix(join(dir, 'lock')), LOG: unix(join(dir, 'log')), CHILD_FILE: unix(join(dir, 'child')) };
  const result = await execute(['-c', `
"$SUPERVISOR" > "$LOG" 2>&1 &
pid=$!
trap 'kill -TERM "$pid" 2>/dev/null || true' EXIT
n=0
while ! grep -q READY "$EVENTS" 2>/dev/null; do
  n=$((n + 1)); if [ "$n" -gt 100 ]; then cat "$LOG"; exit 1; fi
  sleep .1
done
kill -TERM "$pid"
wait "$pid"
cat "$LOG"
`], env);
  assert.equal(result.code, 0, result.output);
  assert.equal((await readFile(join(dir, 'count'), 'utf8')).trim(), '3');
  const events = await readFile(join(dir, 'events'), 'utf8');
  assert.match(events, /READY/); assert.match(events, /STOPPED/); assert.doesNotMatch(events, /OVERLAP/);
  assert.match(result.output, /retry_in=1s/); assert.match(result.output, /retry_in=2s/);
  if(process.platform==='linux') {
    const pid=(await readFile(join(dir,'child'),'utf8')).trim();
    try { const stat=await readFile(`/proc/${pid}/stat`,'utf8'); assert.match(stat,/\) Z /,'helper process survived its server'); }
    catch(error) { if(error.code!=='ENOENT') throw error; }
  }
  const maintenance = await execute([unix(supervisor), 'reset-password', '--example'], env);
  assert.equal(maintenance.code, 7); assert.equal(maintenance.output.trim(), 'reset-password --example');
});
