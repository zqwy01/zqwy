import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18000 + (process.pid % 1000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Server is still starting.
    }
    await sleep(100);
  }
  throw new Error('server did not start in time');
}

test('server serves the prototype, preserves the old game and enforces whitelists', async (t) => {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  t.after(() => {
    child.kill('SIGTERM');
  });

  const base = `http://127.0.0.1:${PORT}`;
  const health = await waitForServer(`${base}/api/health`);
  const body = await health.json();
  assert.equal(body.ok, true);
  assert.equal(body.game, 'to-east-browser-prototype');
  assert.deepEqual(body.musicIds, ['tablet', 'labyrinth', 'trial', 'deep']);

  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /К Востоку/);

  const oldGame = await fetch(`${base}/index.html`);
  assert.equal(oldGame.status, 200);
  assert.match(await oldGame.text(), /Клетчатый лист/);

  const css = await fetch(`${base}/east.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type') || '', /text\/css/);

  const tablet = await fetch(`${base}/music/tablet`, { headers: { Range: 'bytes=0-15' } });
  assert.equal(tablet.status, 206);
  assert.match(tablet.headers.get('content-type') || '', /audio\/ogg/);
  assert.match(tablet.headers.get('content-range') || '', /^bytes 0-15\//);

  const unknownTrack = await fetch(`${base}/music/server.mjs`);
  assert.equal(unknownTrack.status, 404);
  assert.equal((await unknownTrack.json()).error, 'unknown_music_id');

  const denied = await fetch(`${base}/server.mjs`);
  assert.equal(denied.status, 404);

  const traversal = await fetch(`${base}/../server.mjs`);
  assert.equal(traversal.status, 404);

  const angel = await fetch(`${base}/asset/angel.webp`, { method: 'HEAD' });
  assert.equal(angel.status, 200);
  assert.equal(angel.headers.get('content-type'), 'image/webp');

  assert.equal(stderr.trim(), '');
});
