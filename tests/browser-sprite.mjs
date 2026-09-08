// Production preview on :5173; pass agent-browser's CDP websocket as argv[2].
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('outputs', { recursive: true });
const socket = new WebSocket(process.argv[2]);
await new Promise(r => socket.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map(), errors = [];
socket.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
  if (pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    if (m.error) p.reject(m.error); else p.resolve(m.result);
  }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const seq = ++id; pending.set(seq, { resolve, reject });
  socket.send(JSON.stringify({ id: seq, method, params, sessionId }));
});
const { targetInfos } = await send('Target.getTargets');
const target = targetInfos.find(t => t.type === 'page' && t.url.includes('127.0.0.1:5173'));
const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
const cdp = (m, p) => send(m, p, sessionId);
const evaluate = async expression => {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async expression => {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await wait(100); }
  throw new Error(`Timed out: ${expression}`);
};
const state = () => evaluate(`({...document.querySelector('.game-shell').dataset, ...document.querySelector('.world').dataset})`);
const click = text => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(text)})).click()`);
const shot = async name => {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  await writeFile(`outputs/${name}.png`, Buffer.from(data, 'base64'));
};
const key = (type, code, key) => cdp('Input.dispatchKeyEvent', { type, code, key });
const tap = async (code, name) => { await key('keyDown', code, name); await key('keyUp', code, name); await wait(80); };
const reload = async () => {
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await until(`!![...document.querySelectorAll('button')].find(b => b.textContent.includes('2D SPRITE') && !b.disabled)`);
};
try {
  await cdp('Runtime.enable');
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await reload();
  await click('2D SPRITE'); await wait(200);
  assert.equal((await state()).characterRenderer, '2d');
  await shot('sprite-desktop-title');
  await reload();
  assert.equal((await state()).characterStyle, '2d');
  await click('DEPLOY OPERATIVE'); await wait(160);
  await key('keyDown', 'KeyD', 'd'); await wait(300);
  assert(Number((await state()).spriteFrame) >= 4 && Number((await state()).spriteFrame) <= 7);
  await tap('Space', ' ');
  assert([9, 10, 11].includes(Number((await state()).spriteFrame)));
  await shot('sprite-jump');
  await tap('ShiftLeft', 'Shift');
  assert.equal((await state()).spriteFrame, '14');
  await key('keyUp', 'KeyD', 'd');
  await tap('Escape', 'Escape');
  const paused = await state();
  assert.equal(paused.mode, 'paused');
  await click('3D MODEL'); await wait(120);
  let current = await state();
  assert.equal(current.characterRenderer, '3d');
  assert.equal(current.playerX, paused.playerX);
  assert.equal(current.kills, paused.kills);
  await click('2D SPRITE'); await wait(120);
  current = await state();
  assert.equal(current.characterRenderer, '2d');
  assert.equal(current.playerY, paused.playerY);
  const frame = current.spriteFrame;
  await wait(300); assert.equal((await state()).spriteFrame, frame, 'Animation freezes during pause');
  await click('RESUME OPERATION'); await wait(600);
  await shot('sprite-desktop-combat');
  await tap('Escape', 'Escape');
  await click('3D MODEL'); await reload();
  assert.equal((await state()).characterStyle, '3d');
  console.log('PASS 2D rendering, run/jump/dash poses, pause continuity, and persistence for both styles');

  for (const [width, height] of [[393, 852], [320, 568], [844, 390], [568, 320]]) {
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await reload();
    const layout = await evaluate(`(() => {
      const controls = [...document.querySelectorAll('.character-options button, .title-screen .deploy')].map(b => {
        const r = b.getBoundingClientRect(); return { text: b.textContent, x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
      }); return { controls, width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth };
    })()`);
    assert(!layout.overflow, `No horizontal overflow ${width}x${height}`);
    for (const b of layout.controls) {
      assert(b.width >= 44 && b.height >= 44, `Touch target ${b.text}: ${JSON.stringify(b)}`);
      assert(b.x >= 0 && b.y >= 0 && b.right <= width && b.bottom <= height, `Visible ${width}x${height}: ${JSON.stringify(b)}`);
    }
    await click('2D SPRITE'); await wait(120); await shot(`sprite-phone-title-${width}`);
    await click('DEPLOY OPERATIVE'); await wait(180);
    assert.equal((await state()).characterRenderer, '2d');
    await shot(`sprite-phone-combat-${width}`);
    await evaluate(`document.querySelector('[aria-label="Pause game"]').click()`);
    await click('3D MODEL'); await wait(100);
    assert.equal((await state()).characterRenderer, '3d');
    console.log(`PASS Phone ${width}x${height}: reachable selector, both renderers and pause switching`);
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('PASS No uncaught browser exceptions');

  // Failed artwork must never prevent deployment with the original 3D model.
  await evaluate(`localStorage.setItem('ash-vector:character-style', '2d')`);
  await cdp('Network.enable');
  await cdp('Network.setBlockedURLs', { urls: ['*sprites/operative-sheet-v1.png*'] });
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await until(`document.body.textContent.includes('Unavailable — reload to retry')`);
  assert.equal((await state()).characterStyle, '3d');
  await click('DEPLOY OPERATIVE'); await wait(150);
  assert.equal((await state()).mode, 'playing');
  assert.equal((await state()).characterRenderer, '3d');
  await cdp('Network.setBlockedURLs', { urls: [] });
  console.log('PASS Missing artwork falls back to a playable 3D operative');

  const injected = await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });`,
  });
  await reload();
  await click('2D SPRITE'); await wait(100);
  assert.equal((await state()).characterRenderer, '2d');
  await click('3D MODEL'); await wait(100);
  assert.equal((await state()).characterRenderer, '3d');
  await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier });
  await reload();
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('PASS Both style options remain usable when preference storage is blocked');
} finally { socket.close(); }
