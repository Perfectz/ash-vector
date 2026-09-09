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
  if (pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(m.error); else p.resolve(m.result); }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const seq = ++id; pending.set(seq, { resolve, reject }); socket.send(JSON.stringify({ id: seq, method, params, sessionId })); });
const { targetInfos } = await send('Target.getTargets');
const target = targetInfos.find(t => t.type === 'page' && t.url.includes('127.0.0.1:5173'));
const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
const cdp = (m, p) => send(m, p, sessionId);
const evaluate = async expression => { const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await wait(100); } throw new Error(`Timed out: ${expression}`); };
const state = () => evaluate(`({...document.querySelector('.game-shell').dataset, ...document.querySelector('.world').dataset})`);
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const shot = async name => { const { data } = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(`outputs/${name}.png`, Buffer.from(data, 'base64')); };
const key = (type, code, key) => cdp('Input.dispatchKeyEvent', { type, code, key });
const tap = async (code, name) => { await key('keyDown', code, name); await key('keyUp', code, name); };
const reload = async () => { await cdp('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await until(`!!document.querySelector('[data-hero="patrick"]:not(:disabled)') && !!document.querySelector('[data-hero="su"]:not(:disabled)')`); await wait(150); };
try {
 await cdp('Runtime.enable');
 await cdp('Emulation.setTouchEmulationEnabled',{enabled:false});
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await reload(); await click('[data-hero="patrick"]'); await click('.deploy');
 await tap('KeyK','k'); await wait(95); await shot('effects-saber');
 assert(Number((await state()).effectParticles)>0);
 await tap('Escape','Escape'); const frozen=await state(); await wait(350); assert.equal((await state()).effectParticles,frozen.effectParticles);
 await click('.state-panel .deploy');
 await key('keyDown','KeyD','d'); await key('keyDown','KeyJ','j'); await tap('Digit4','4');
 await wait(950); await tap('Space',' '); await wait(500); await tap('ShiftLeft','Shift'); await wait(90); await shot('effects-rocket-dash');
 await wait(900); await tap('KeyE','e'); await wait(1000); await shot('effects-combat');
 await key('keyUp','KeyD','d'); await key('keyUp','KeyJ','j');
 assert(Number((await state()).effectParticles)<=900);
 await tap('Escape','Escape');
 await evaluate(`document.querySelector('[aria-label^="Graphics quality"]').click()`);
 await click('[data-hero="su"]'); await click('.state-panel .deploy');
 await tap('Space',' '); await wait(150); await tap('Space',' '); await wait(80); await shot('effects-su-low-quality');
 assert(Number((await state()).effectParticles)>0);
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('PASS combat effects emit, remain bounded, freeze during pause, and work with low-quality Su boost; no browser exceptions');
} finally {socket.close();}
