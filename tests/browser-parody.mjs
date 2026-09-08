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
const touch = async selector => {
  const p = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 5 }] });
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
try {
  await cdp('Runtime.enable');
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await reload();
  await click('[data-hero="patrick"]'); await wait(120); await shot('parody-patrick-title');
  assert.equal((await state()).renderedCharacter, 'patrick');
  await click('.deploy'); await wait(150);
  await tap('KeyK', 'k'); await wait(80);
  assert(Number((await state()).spriteFrame) >= 12);
  await shot('parody-saber');
  await tap('Escape', 'Escape'); await wait(120);
  const panel = await evaluate(`(() => { const p=document.querySelector('.state-panel'), r=p.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,height:innerHeight,scrollTop:p.scrollTop}; })()`);
  assert(panel.top >= 0 && panel.bottom <= panel.height && panel.scrollTop === 0, 'Pause panel starts visibly and remains scrollable within the viewport');
  const paused = await state();
  await click('[data-hero="su"]'); await wait(100);
  assert.equal((await state()).renderedCharacter, 'su'); assert.equal((await state()).playerX, paused.playerX);
  for (let i = 1; i <= 8; i++) { await tap(`Digit${i}`, String(i)); await wait(100); assert.equal((await state()).weapon, String(i - 1)); }
  await shot('parody-arsenal');
  await click('.state-panel .deploy'); await wait(100);
  await tap('Space', ' '); await wait(150); await tap('Space', ' '); await wait(80);
  assert.equal((await state()).jumps, '2'); assert(Number((await state()).spriteFrame) >= 12);
  await shot('parody-su-double-jump');
  await tap('Space', ' '); await wait(60); assert.equal((await state()).jumps, '2');
  await reload(); assert.equal((await state()).character, 'su');
  await click('[data-hero="operative"]'); await wait(100);
  await evaluate(`[...document.querySelectorAll('.character-options button')].find(b=>b.textContent.includes('2D SPRITE')).click()`); await wait(100);
  assert.equal((await state()).characterRenderer,'2d');
  await evaluate(`[...document.querySelectorAll('.character-options button')].find(b=>b.textContent.includes('3D MODEL')).click()`); await wait(100);
  assert.equal((await state()).characterRenderer,'3d');
  await click('[data-hero="patrick"]'); await click('.deploy'); await wait(100);
  await evaluate(`window.testPad={axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))}; navigator.getGamepads=()=>[window.testPad];`);
  await evaluate(`window.testPad.buttons[3].pressed=true`); await wait(100);
  assert(Number((await state()).meleeCooldown)>0, 'Gamepad Y invokes Patrick saber');
  await evaluate(`window.testPad.buttons[3].pressed=false;window.testPad.buttons[0].pressed=true`); await wait(100);
  assert.equal((await state()).jumps,'1','Gamepad A jumps');
  await evaluate(`window.testPad.buttons[0].pressed=false`); await wait(60);
  await evaluate(`window.testPad.buttons[0].pressed=true`); await wait(80);
  assert.equal((await state()).jumps,'2','Second gamepad press double jumps');
  await evaluate(`navigator.getGamepads=()=>[]`);
  console.log('PASS Desktop roster, persistent Su selection, Patrick sword, eight weapon hotkeys and double-jump frames');

  for (const [width, height] of [[393, 852], [320, 568], [844, 390], [568, 320]]) {
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await reload(); await click('[data-hero="patrick"]'); await wait(100);
    const menu = await evaluate(`[...document.querySelectorAll('.roster-options button, .title-screen .deploy')].map(b => { const r=b.getBoundingClientRect(); return {name:b.textContent, x:r.x, y:r.y, w:r.width, h:r.height, right:r.right, bottom:r.bottom}; })`);
    for (const b of menu) assert(b.x >= 0 && b.y >= 0 && b.right <= width && b.bottom <= height && b.w >= 44 && b.h >= 44, `Menu ${width}x${height}: ${JSON.stringify(b)}`);
    await shot(`parody-phone-menu-${width}`);
    await click('.deploy'); await wait(150);
    const buttons = await evaluate(`Array.from(document.querySelectorAll('.touch-controls button')).map(b => { const r=b.getBoundingClientRect(); return {name:b.getAttribute('aria-label') || b.textContent,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}; })`);
    for (let i=0;i<buttons.length;i++) {
      const b=buttons[i]; assert(b.w>=44&&b.h>=44&&b.x>=0&&b.y>=0&&b.right<=width&&b.bottom<=height,`Control ${width}x${height}: ${JSON.stringify(b)}`);
      for(let j=0;j<i;j++){ const a=buttons[j]; assert(Math.min(a.right,b.right)-Math.max(a.x,b.x)<=1 || Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)<=1, `Overlap ${width}x${height}: ${a.name}/${b.name}`); }
    }
    await touch('.touch-saber'); await wait(100); assert(Number((await state()).meleeCooldown)>0);
    await shot(`parody-phone-saber-${width}`);
    await click('[aria-label="Pause game"]'); await wait(100); await click('[data-hero="su"]'); await click('.state-panel .deploy'); await wait(100);
    await touch('.touch-jump'); await wait(130); await touch('.touch-jump'); await wait(100); assert.equal((await state()).jumps,'2');
    assert.equal(await evaluate(`document.querySelectorAll('.touch-saber').length`),0);
    console.log(`PASS ${width}x${height}: roster/controls in bounds, no overlapping touch targets, actual saber tap and Su double jump`);
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('PASS No uncaught browser exceptions');
} finally { socket.close(); }
