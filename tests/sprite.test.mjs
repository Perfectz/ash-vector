import assert from 'node:assert/strict';
import { clearSpriteBackground, operativeFrame, spriteFrames } from '../app/game/sprite.ts';
import { Simulation } from '../app/game/simulation.ts';

const p = new Simulation().player;
const poses = (state, time = 1) => operativeFrame({ ...p, ...state }, time);
assert(poses({ moving: 1 }) >= 4 && poses({ moving: 1 }) <= 7);
assert.equal(poses({ moving: 1, jumps: 1, vy: 7 }), 9);
assert.equal(poses({ jumps: 1, vy: 0 }), 10);
assert.equal(poses({ jumps: 1, vy: -7 }), 11);
assert.equal(poses({ jumps: 1, dashTime: 0.2 }), 14);
assert.equal(poses({ flash: 0.1 }), 12);
assert.equal(poses({ aimPitch: 0.6 }), 13);
assert.equal(poses({ lastDamage: 0.9, dashTime: 0.2 }), 15);
// A raised platform is still ground; its world height must not trigger jumping.
assert(poses({ y: 2.9, jumps: 0, vy: 0 }) < 4);
console.log('PASS Sprite actions respect jump, dash, damage and platform state');

const pixels = new Uint8ClampedArray(7 * 7 * 4).fill(255);
const color = (x, y, rgb) => pixels.set([...rgb, 255], (y * 7 + x) * 4);
for (let n = 1; n <= 5; n++) {
  color(n, 1, [20, 30, 35]); color(n, 5, [20, 30, 35]);
  color(1, n, [20, 30, 35]); color(5, n, [20, 30, 35]);
}
color(0, 3, [240, 230, 205]);
clearSpriteBackground(pixels, 7, 7);
assert.equal(pixels[3], 0, 'Outside background is transparent');
assert.equal(pixels[(3 * 7 + 3) * 4 + 3], 255, 'Enclosed white highlights survive');
assert.equal(pixels[(3 * 7) * 4 + 3], 255, 'Ivory armor touching background survives');
for (const [x, y, w, h, anchor, baseline] of spriteFrames) {
  assert(x >= 0 && y >= 0 && x + w <= 1254 && y + h <= 1254);
  assert(160 - (anchor - x) >= 0 && 160 - (anchor - x) + w <= 384);
  assert(350 - (baseline - y) >= 0 && 350 - (baseline - y) + h <= 384);
}
console.log('PASS Background removal preserves armor; every authored frame fits its registered canvas');
