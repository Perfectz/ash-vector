// Requires the local game at http://127.0.0.1:5173 and a dedicated agent-browser session.
// Pass the websocket URL returned by agent-browser get cdp-url as the first argument.
import { writeFile, mkdir } from 'node:fs/promises';
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
const box = (name) =>
  evaluate(
    `(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(name)});if(!e)throw new Error('Missing ${name}');const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()`,
  );
const touch = async (points) =>
  cdp('Input.dispatchTouchEvent', {
    type: points.length ? 'touchStart' : 'touchEnd',
    touchPoints: points.map(([id, p]) => ({
      id,
      x: p.x,
      y: p.y,
      radiusX: 6,
      radiusY: 6,
      force: 1,
    })),
  });
const end = async (points) =>
  cdp('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: points.map(([id, p]) => ({
      id,
      x: p.x,
      y: p.y,
      radiusX: 6,
      radiusY: 6,
      force: 1,
    })),
  });
const tap = async (name) => {
  const p = await box(name);
  await touch([[7, p]]);
  await wait(50);
  await end([]);
  await wait(150);
};
const state = () =>
  evaluate(`({...document.querySelector('.game-shell').dataset})`);
const shots = [];
for (const [width, height, label] of [
  [393, 852, 'portrait'],
  [844, 390, 'landscape'],
  [360, 640, 'compact'],
  [320, 568, 'small'],
]) {
  await cdp('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  }).catch(() => {});
  await cdp('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
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
  const selectedHero = process.argv.find(arg => arg.startsWith('--hero='))?.split('=')[1] || (process.argv.includes('--sprite') ? 'operative' : null);
  if (selectedHero) {
    for (let i = 0; i < 60; i++) {
      if (await evaluate(`!!document.querySelector('[data-hero="${selectedHero}"]:not(:disabled)')`)) break;
      await wait(100);
    }
    await evaluate(`document.querySelector('[data-hero="${selectedHero}"]').click()`);
  }
  if (process.argv.includes('--sprite')) {
    for (let i = 0; i < 60; i++) {
      const ready = await evaluate(`!![...document.querySelectorAll('.character-options button')].find(b=>b.textContent.includes('2D SPRITE')&&!b.disabled)`);
      if (ready) break;
      await wait(100);
    }
    await evaluate(`[...document.querySelectorAll('.character-options button')].find(b=>b.textContent.includes('2D SPRITE')).click()`);
  }
  await evaluate(`document.querySelector('.deploy').click()`);
  await wait(400);
  const layout = await evaluate(
    `(()=>{const boxes=[...document.querySelectorAll('.touch-controls button')].filter(e=>e.offsetWidth).map(e=>{const r=e.getBoundingClientRect();return {name:e.ariaLabel||e.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height}}); const world=document.querySelector('.world').getBoundingClientRect(); return {boxes, world:{y:world.y,bottom:world.bottom},overflow:document.documentElement.scrollWidth>innerWidth};})()`,
  );
  assert(!layout.overflow, `${label} horizontal overflow`);
  for (const b of layout.boxes) {
    assert(
      b.x >= -1 &&
        b.y >= -1 &&
        b.x + b.w <= width + 1 &&
        b.y + b.h <= height + 1,
      `${label} clipped ${b.name}`,
    );
    assert(b.w >= 44 && b.h >= 44, `${label} small target ${b.name}`);
  }
  for (let i = 0; i < layout.boxes.length; i++)
    for (let j = i + 1; j < layout.boxes.length; j++) {
      const a = layout.boxes[i],
        b = layout.boxes[j];
      assert(
        !(
          Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 &&
          Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1
        ),
        `${label} overlap ${a.name} / ${b.name}`,
      );
    }
  const right = await box('Move right'),
    jump = await box('Jump or double jump');
  const before = await state();
  await touch([[1, right]]);
  await wait(450);
  await touch([
    [1, right],
    [2, jump],
  ]);
  await wait(70);
  await end([[2, jump]]);
  await wait(180);
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Jump or double jump"]').dataset.pressed`,
    ),
    'false',
  );
  const during = await state();
  assert(
    Number(during.playerX) > Number(before.playerX) + 4.5,
    `${label} movement must continue after releasing jump`,
  );
  assert(Number(during.playerY) > 0.4, `${label} simultaneous jump`);
  await cdp('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  await wait(250);
  const released = await state();
  await wait(250);
  const after = await state();
  assert(
    Math.abs(Number(after.playerX) - Number(released.playerX)) < 0.2,
    `${label} stuck after cancel`,
  );
  const preDash = await state();
  await tap('Dash');
  await wait(140);
  assert(
    Number((await state()).playerX) > Number(preDash.playerX) + 1,
    'Dash must move the player',
  );
  await tap('Switch weapon');
  assert(
    (
      await evaluate(
        `document.querySelector('[aria-label="Switch weapon"]').textContent`,
      )
    ).includes('SPREAD'),
    'Weapon switch must advance exactly once',
  );
  await tap('Throw grenade, 3 remaining');
  assert(
    await evaluate(
      `!!document.querySelector('[aria-label="Throw grenade, 2 remaining"]')`,
    ),
    'Grenade must consume one charge',
  );
  await evaluate(`document.querySelector('.auto-fire').click()`);
  await wait(120);
  const manual = await evaluate(
    `(()=>{const boxes=[...document.querySelectorAll('.touch-controls button')].filter(e=>e.offsetWidth).map(e=>{const r=e.getBoundingClientRect();return {name:e.ariaLabel||e.textContent,x:r.x,y:r.y,w:r.width,h:r.height}});return boxes;})()`,
  );
  for (let i = 0; i < manual.length; i++)
    for (let j = i + 1; j < manual.length; j++) {
      const a = manual[i],
        b = manual[j];
      assert(
        !(
          Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 &&
          Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1
        ),
        `${label} manual overlap ${a.name}/${b.name}`,
      );
    }
  const fire = await box('Hold to fire');
  await touch([
    [1, right],
    [3, fire],
  ]);
  await wait(130);
  await end([[3, fire]]);
  await wait(100);
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Hold to fire"]').dataset.pressed`,
    ),
    'false',
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Move right"]').dataset.pressed`,
    ),
    'true',
  );
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: height,
    height: width,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await wait(300);
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Move right"]').dataset.pressed`,
    ),
    'false',
    'Rotation releases held directions',
  );
  await end([]).catch(() => {});
  await cdp('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await wait(200);
  await evaluate(`document.querySelector('.auto-fire').click()`);
  await wait(100);
  await tap('Pause game');
  assert.equal((await state()).mode, 'paused');
  await evaluate(`document.querySelector('.state-panel .deploy').click()`);
  await wait(150);
  const shot = await cdp('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    `outputs/phone-${label}-verified.png`,
    Buffer.from(shot.data, 'base64'),
  );
  shots.push(label);
  console.log(
    'PASS',
    label,
    JSON.stringify({ before, during, after, buttons: layout.boxes.length }),
  );
}
if (!process.argv.includes('--quick')) {
  // A sustained mission through real multi-touch input, with automatic firing.
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
    mobile: true,
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
  const selectedHero = process.argv.find(arg => arg.startsWith('--hero='))?.split('=')[1] || (process.argv.includes('--sprite') ? 'operative' : null);
  if (selectedHero) {
    for (let i = 0; i < 60; i++) {
      if (await evaluate(`!!document.querySelector('[data-hero="${selectedHero}"]:not(:disabled)')`)) break;
      await wait(100);
    }
    await evaluate(`document.querySelector('[data-hero="${selectedHero}"]').click()`);
  }
  if (process.argv.includes('--sprite')) {
    for (let i = 0; i < 60; i++) {
      const ready = await evaluate(`!![...document.querySelectorAll('.character-options button')].find(b=>b.textContent.includes('2D SPRITE')&&!b.disabled)`);
      if (ready) break;
      await wait(100);
    }
    await evaluate(`[...document.querySelectorAll('.character-options button')].find(b=>b.textContent.includes('2D SPRITE')).click()`);
  }
  await evaluate(`document.querySelector('.deploy').click()`);
  await wait(250);
  let deaths = 0;
  for (let frame = 0; frame < 100; frame++) {
    const s = await state();
    if (s.mode === 'won') {
      console.log(
        'PASS Real-touch mission completed',
        JSON.stringify({ ...s, deaths }),
      );
      break;
    }
    if (s.mode === 'dead') {
      deaths++;
      await end([]).catch(() => {});
      await evaluate(`document.querySelector('.state-panel .deploy').click()`);
      await wait(250);
      if (deaths > 4) break;
    }
    const r = await box('Move right'),
      j = await box('Jump or double jump');
    await touch([
      [1, r],
      [2, j],
    ]);
    await wait(60);
    await end([[2, j]]);
    await wait(510);
    if (frame % 10 === 0)
      console.log('MISSION', frame, JSON.stringify(await state()));
  }
  assert.equal((await state()).mode, 'won', 'Touch mission must reach victory');
  await end([]).catch(() => {});
  const victory = await cdp('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    'outputs/phone-victory-verified.png',
    Buffer.from(victory.data, 'base64'),
  );
}
assert.equal(errors.length, 0, JSON.stringify(errors));
console.log('PASS No browser exceptions. Screenshots:', shots.join(', '));
socket.close();
