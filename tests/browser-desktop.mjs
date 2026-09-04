// Requires the local game at http://127.0.0.1:5173 and a dedicated agent-browser session.
// Pass the websocket URL returned by agent-browser get cdp-url as the first argument.
import { mkdir } from 'node:fs/promises';
await mkdir('outputs', { recursive: true });
import assert from 'node:assert/strict';
const socket = new WebSocket(process.argv[2]);
await new Promise((r) => socket.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown')
    errors.push(m.params.exceptionDetails.text);
  if (pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(m.error);
    else p.resolve(m.result);
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const seq = ++id;
    pending.set(seq, { resolve, reject });
    socket.send(JSON.stringify({ id: seq, method, params, sessionId }));
  });
const { targetInfos } = await send('Target.getTargets');
const target = targetInfos.find(
  (t) => t.type === 'page' && t.url.includes('127.0.0.1:5173'),
);
const { sessionId } = await send('Target.attachToTarget', {
  targetId: target.targetId,
  flatten: true,
});
const cdp = (m, p) => send(m, p, sessionId);
await cdp('Runtime.enable');
const evaluate = async (expression) => {
  const r = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const state = () =>
  evaluate(`({...document.querySelector('.game-shell').dataset})`);

await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
await cdp('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp('Page.navigate', { url: 'http://127.0.0.1:5173/' });
for (let i = 0; i < 60; i++) {
  await wait(100);
  if (
    await evaluate(
      `!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('DEPLOY OPERATIVE')&&!b.disabled)`,
    )
  )
    break;
}
await evaluate(`document.querySelector('.deploy').click()`);
await wait(200);
assert.equal(
  await evaluate(`document.querySelectorAll('.touch-controls').length`),
  0,
);
const key = async (type, code, k) =>
  cdp('Input.dispatchKeyEvent', { type, code, key: k });
await key('keyDown', 'KeyD', 'd');
await key('keyDown', 'KeyJ', 'j');
await wait(750);
await key('keyDown', 'Space', ' ');
await wait(160);
await key('keyUp', 'Space', ' ');
const moved = await state();
assert(Number(moved.playerX) > 14);
assert(Number(moved.playerY) > 0.5);
await wait(1000);
await key('keyUp', 'KeyD', 'd');
await key('keyUp', 'KeyJ', 'j');
assert(Number((await state()).kills) >= 1);
await key('keyDown', 'Escape', 'Escape');
await key('keyUp', 'Escape', 'Escape');
await wait(150);
assert.equal((await state()).mode, 'paused');
assert.equal(errors.length, 0);
console.log(
  'PASS Desktop keyboard movement, jumping, auto-target fire, kill and pause',
  JSON.stringify(await state()),
);
socket.close();
